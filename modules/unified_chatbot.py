import os
import logging
import time
from typing import List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# .env 파일이 존재하는 경우에만 로드
if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')):
    load_dotenv()
    
import json
import requests
from functools import lru_cache

# Semantic Chunker is not used in this codebase
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_community.retrievers.bm25 import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.schema.document import Document
from langchain.prompts import ChatPromptTemplate

# 환경 변수 로드
load_dotenv()

# 로깅 설정
logger = logging.getLogger('unified_chatbot')
logger.setLevel(logging.INFO)

# 환경에 따른 디렉토리 설정
ROOT_DIR = Path(os.path.dirname(os.path.abspath(__file__))).parent
DATA_BASE_DIR = Path('/tmp/data') if os.environ.get('ENVIRONMENT') == 'cloud_run' else ROOT_DIR / "data"
ECONOMY_TERMS_DIR = DATA_BASE_DIR / "economy_terms"
RECENT_CONTENTS_DIR = DATA_BASE_DIR / "recent_contents_final"

class UnifiedChatbot:
    """GPT와 Perplexity API를 통합한 챗봇 시스템"""
    
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
        self.perplexity_api_key = os.getenv("PERPLEXITY_API_KEY")
        self.docs = []
        self.vectorstore = None
        self.retriever = None
        self.file_paths = {}
        
        # 초기화 타임스탬프 추가
        self.init_timestamp = None
        self.last_update = None
        
        # 초기화 상태
        self.initialized = False
        self.rag_initialized = False
        self.perplexity_initialized = False
        
        # 캐시 타임아웃 (1시간)
        self.cache_timeout = 3600
        
    def load_documents(self):
        """내부 문서 로드"""
        logger.info("문서 로드 시작")
        
        # 경제 용어 및 최신 콘텐츠 로드
        all_files = list(ECONOMY_TERMS_DIR.glob("*.md")) + list(RECENT_CONTENTS_DIR.glob("*.md"))
        
        for file_path in all_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # 메타데이터 추출
                file_name = file_path.name
                title = file_name.replace(".md", "")
                source_type = "economy_terms" if str(ECONOMY_TERMS_DIR) in str(file_path) else "recent_contents"
                
                doc = Document(
                    page_content=content,
                    metadata={
                        "source": str(file_path),
                        "title": title,
                        "file_name": file_name,
                        "source_type": source_type
                    }
                )
                
                self.docs.append(doc)
                self.file_paths[file_name] = file_path
                
            except Exception as e:
                logger.error(f"파일 로드 오류: {file_path}, {str(e)}")
        
        logger.info(f"총 {len(self.docs)}개 문서 로드 완료")
        
    def create_rag_index(self):
        """RAG 인덱스 생성"""
        if not self.docs:
            raise ValueError("문서가 로드되지 않았습니다")
            
        logger.info("RAG 인덱스 생성 시작")
        
        # RecursiveCharacterTextSplitter로 청킹 (토큰 제한 방지)
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,  # 최적화된 청크 크기
            chunk_overlap=100,  # 중복도 증가
            length_function=len,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        
        chunks = []
        for doc in self.docs:
            # 모든 문서를 청크로 분할
            doc_chunks = text_splitter.create_documents(
                texts=[doc.page_content],
                metadatas=[doc.metadata]
            )
            chunks.extend(doc_chunks)
        
        logger.info(f"총 {len(chunks)}개의 청크 생성")
        
        # 벡터스토어를 배치로 생성
        batch_size = 50  # 한 번에 처리할 청크 수
        
        # 빈 벡터스토어로 시작
        self.vectorstore = None
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            logger.info(f"처리 중: {i}/{len(chunks)}")
            
            if self.vectorstore is None:
                # 첫 배치로 벡터스토어 생성
                self.vectorstore = Chroma.from_documents(
                    documents=batch,
                    embedding=self.embeddings,
                    collection_name="unified_collection"
                )
            else:
                # 기존 벡터스토어에 추가
                self.vectorstore.add_documents(batch)
        
        # Ensemble retriever 생성 (Semantic + BM25)
        vector_retriever = self.vectorstore.as_retriever(search_kwargs={"k": 3})
        bm25_retriever = BM25Retriever.from_documents(chunks, k=3)
        
        self.retriever = EnsembleRetriever(
            retrievers=[vector_retriever, bm25_retriever],
            weights=[0.6, 0.4]
        )
        
        self.rag_initialized = True
        logger.info("RAG 인덱스 생성 완료")
        
    @lru_cache(maxsize=1)  # 캐싱을 통한 성능 최적화
    def check_perplexity_api(self):
        """Perplexity API 연결 확인"""
        if not self.perplexity_api_key:
            logger.warning("Perplexity API 키가 없습니다")
            self.perplexity_initialized = False
            return False
            
        # 테스트 API 키 확인
        if self.perplexity_api_key.startswith("pplx-test"):
            logger.warning("테스트 Perplexity API 키가 감지되었습니다. 테스트 모드로 설정")
            self.perplexity_initialized = True
            return True
            
        try:
            # API 연결 테스트
            headers = {
                "Authorization": f"Bearer {self.perplexity_api_key}",
                "Content-Type": "application/json"
            }
            
            # 간단한 테스트 쿼리
            max_retries = 2
            retry_delay = 2
            
            for retry in range(max_retries):
                try:
                    response = requests.post(
                        "https://api.perplexity.ai/chat/completions",
                        headers=headers,
                        json={
                            "model": "llama-3.1-sonar-small-128k-online",
                            "messages": [{"role": "user", "content": "test"}],
                            "max_tokens": 10
                        },
                        timeout=10  # 타임아웃 증가
                    )
                    
                    self.perplexity_initialized = response.status_code == 200
                    logger.info(f"Perplexity API 연결 확인: {self.perplexity_initialized}")
                    return self.perplexity_initialized
                    
                except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                    logger.warning(f"Perplexity API 테스트 중 연결 오류 (시도 {retry+1}/{max_retries}): {str(e)}")
                    if retry < max_retries - 1:
                        time.sleep(retry_delay)
                    else:
                        logger.error("Perplexity API 연결 시도 실패")
                        break
            
            # 모든 재시도 실패
            self.perplexity_initialized = False
            return False
            
        except Exception as e:
            logger.error(f"Perplexity API 연결 확인 실패: {str(e)}")
            self.perplexity_initialized = False
            return False
    
    def search_with_perplexity(self, query: str):
        """Perplexity API로 실시간 웹 검색"""
        if not self.perplexity_initialized:
            logger.warning("Perplexity API가 초기화되지 않았습니다")
            return {
                "success": False,
                "answer": "웹 검색 기능을 사용할 수 없습니다.",
                "citations": []
            }
            
        try:
            headers = {
                "Authorization": f"Bearer {self.perplexity_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.1-sonar-small-128k-online",
                "messages": [
                    {
                        "role": "system",
                        "content": "당신은 최신 한국 경제 정보를 제공하는 전문가입니다. 정확한 정보와 함께 출처를 제공하세요."
                    },
                    {
                        "role": "user",
                        "content": query
                    }
                ],
                "temperature": 0.2,
                "return_citations": True,
                "return_related_questions": True
            }
            
            # 타임아웃 증가 및 재시도 로직 추가
            max_retries = 3
            retry_delay = 2  # 초 단위
            
            for retry in range(max_retries):
                try:
                    response = requests.post(
                        "https://api.perplexity.ai/chat/completions",
                        headers=headers,
                        json=payload,
                        timeout=45  # 타임아웃 증가
                    )
                    break  # 성공하면 반복 종료
                except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                    logger.warning(f"Perplexity API 요청 실패 (시도 {retry+1}/{max_retries}): {str(e)}")
                    if retry < max_retries - 1:
                        logger.info(f"{retry_delay}초 후 재시도합니다...")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # 지수 백오프
                    else:
                        raise  # 최대 재시도 횟수 초과 시 예외 발생
            
            result = response.json()
            
            if response.status_code == 200:
                # 응답에서 정보 추출
                answer = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                # Perplexity API는 citations를 별도로 제공하지 않을 수 있음
                citations = []
                
                return {
                    "success": True,
                    "answer": answer,
                    "citations": citations
                }
            else:
                logger.error(f"Perplexity API 오류: {result}")
                return {
                    "success": False,
                    "answer": "웹 검색 중 오류가 발생했습니다.",
                    "citations": []
                }
                
        except Exception as e:
            logger.error(f"Perplexity 검색 오류: {str(e)}")
            return {
                "success": False,
                "answer": f"검색 중 오류 발생: {str(e)}",
                "citations": []
            }
    
    def search_internal_documents(self, query: str):
        """내부 문서에서 관련 정보 검색"""
        if not self.rag_initialized:
            logger.warning("RAG가 초기화되지 않아 내부 문서 검색을 건너뜁니다")
            return []
            
        try:
            start_time = time.time()
            docs = self.retriever.get_relevant_documents(query)
            elapsed = time.time() - start_time
            logger.info(f"내부 문서 검색 완료: {len(docs)}개 문서 발견 ({elapsed:.2f}초 소요)")
            return docs
        except Exception as e:
            logger.error(f"내부 문서 검색 오류: {str(e)}")
            return []
    
    def process_query(self, query: str) -> Dict[str, Any]:
        """사용자 질의 처리 (RAG + Perplexity 통합)"""
        if not self.initialized:
            return {
                "answer": "챗봇이 아직 초기화되지 않았습니다.",
                "citations": [],
                "sources_used": {"internal": False, "web": False}
            }
            
        # 개발 모드 확인 (테스트 API 키가 사용된 경우)
        if (os.getenv('OPENAI_API_KEY') and os.getenv('OPENAI_API_KEY').startswith("sk-test") and 
            os.getenv('PERPLEXITY_API_KEY') and os.getenv('PERPLEXITY_API_KEY').startswith("pplx-test")):
            logger.info(f"테스트 모드에서 질의 처리: {query}")
            return {
                "answer": f"[개발 모드] '{query}'에 대한 가상 답변입니다. 이것은 테스트 API 키를 사용하는 개발 모드에서의 응답입니다. 실제 API 키를 사용하시면 정확한 답변을 받으실 수 있습니다.",
                "citations": [
                    {"type": "internal", "title": "가상 문서 1", "source": "test_doc.md", "file_name": "test_doc.md", "source_type": "economy_terms", "quoted_text": "이것은 테스트용 인용문입니다."}
                ],
                "sources_used": {"internal": True, "web": True}
            }
        
        # 1. 내부 문서 검색
        internal_docs = self.search_internal_documents(query)
        
        # 2. Perplexity로 웹 검색
        web_search_result = self.search_with_perplexity(query)
        
        # 3. 결과 통합
        sources_used = {
            "internal": len(internal_docs) > 0,
            "web": web_search_result.get("success", False)
        }
        
        # 프롬프트 구성
        context_parts = []
        citations = []
        
        # 내부 문서 정보 추가
        if internal_docs:
            context_parts.append("=== 내부 문서 정보 ===")
            for i, doc in enumerate(internal_docs):
                context_parts.append(f"\n[내부문서 {i+1}] {doc.metadata.get('title')}")
                context_parts.append(doc.page_content[:500])
                
                # 문서의 실제 인용 구간 저장
                quoted_content = doc.page_content.strip()[:150]  # 처음 150자
                citations.append({
                    "type": "internal",
                    "title": doc.metadata.get('title'),
                    "source": doc.metadata.get('source'),
                    "file_name": doc.metadata.get('file_name'),
                    "source_type": doc.metadata.get('source_type'),
                    "quoted_text": quoted_content  # 인용된 텍스트 구간
                })
        
        # 웹 검색 정보 추가
        if web_search_result.get("success") and web_search_result.get("answer"):
            context_parts.append("\n=== 최신 웹 정보 ===")
            context_parts.append(web_search_result["answer"])
            
            # 웹 출처 추가
            for citation in web_search_result.get("citations", []):
                if isinstance(citation, dict):
                    # URL이 비어있는 경우 처리
                    url = citation.get("url", "")
                    if not url or url.strip() == "":
                        url = "https://www.google.com/search?q=" + citation.get("title", "경제 정보").replace(" ", "+")
                    
                    citations.append({
                        "type": "web",
                        "title": citation.get("title", "웹 자료"),
                        "url": url,
                        "source": citation.get("name", "웹")
                    })
                elif isinstance(citation, str):
                    citations.append({
                        "type": "web",
                        "title": citation,
                        "url": "https://www.google.com/search?q=" + citation.replace(" ", "+"),
                        "source": "웹"
                    })
        
        # GPT로 최종 답변 생성
        if context_parts:
            # 컨텍스트가 있는 경우
            prompt = ChatPromptTemplate.from_messages([
                ("system", """당신은 한국 경제 정보를 제공하는 전문가입니다. 
                제공된 정보를 바탕으로 사용자의 질문에 답변하세요.
                내부 문서와 최신 웹 정보를 적절히 종합하여 답변하세요.
                답변 시 출처를 명확히 밝히세요.
                
                답변 형식 가이드라인:
                1. 답변은 간결하고 명확하게 작성하세요.
                2. 출처는 [1], [2] 형식으로 표시하세요.
                3. 중요한 정보에는 반드시 출처를 표시하세요.
                4. 전문 용어는 쉽게 풀어서 설명하세요.
                5. 답변에 불확실한 정보가 있다면 그 점을 명시하세요.
                """),
                ("human", "{context}\n\n질문: {query}")
            ])
            
            chain = prompt | self.llm
            response = chain.invoke({
                "context": "\n".join(context_parts),
                "query": query
            })
            
            answer = response.content
        else:
            # 컨텍스트가 없는 경우 (일반 대화)
            prompt = ChatPromptTemplate.from_messages([
                ("system", """당신은 친절한 한국어 대화 AI입니다. 
                경제 관련 전문 지식을 가지고 있지만, 일반적인 대화도 자연스럽게 나눌 수 있습니다."""),
                ("human", "{query}")
            ])
            
            chain = prompt | self.llm
            response = chain.invoke({"query": query})
            answer = response.content
        
        return {
            "answer": answer,
            "citations": citations,
            "sources_used": sources_used
        }
    
    def get_status(self):
        """챗봇 상태 정보 반환"""
        uptime = None
        if self.init_timestamp:
            uptime = int(time.time() - self.init_timestamp)
        
        return {
            "initialized": self.initialized,
            "rag_initialized": self.rag_initialized,
            "perplexity_initialized": self.perplexity_initialized,
            "document_count": len(self.docs),
            "chunk_count": len(self.vectorstore.get()['ids']) if self.vectorstore else 0,
            "init_timestamp": self.init_timestamp,
            "last_update": self.last_update,
            "uptime": uptime,
            "api_keys": {
                "openai": bool(os.getenv("OPENAI_API_KEY")),
                "perplexity": bool(os.getenv("PERPLEXITY_API_KEY"))
            }
        }

# 싱글톤 인스턴스
_unified_chatbot_instance = None

def get_unified_chatbot_instance():
    """통합 챗봇 싱글톤 인스턴스 반환"""
    global _unified_chatbot_instance
    
    if _unified_chatbot_instance is None:
        _unified_chatbot_instance = UnifiedChatbot()
    
    return _unified_chatbot_instance

def initialize_unified_chatbot():
    """통합 챗봇 초기화"""
    try:
        logger.info("통합 챗봇 초기화 시작")
        start_time = time.time()
        
        chatbot = get_unified_chatbot_instance()
        
        # 테스트 API 키 확인
        if (os.getenv('OPENAI_API_KEY') and os.getenv('OPENAI_API_KEY').startswith("sk-test") and 
            os.getenv('PERPLEXITY_API_KEY') and os.getenv('PERPLEXITY_API_KEY').startswith("pplx-test")):
            logger.warning("테스트 API 키가 감지되었습니다. 개발 모드로 초기화합니다.")
            
            # 개발 모드에서는 실제 초기화를 건너뛰고 초기화된 것으로 표시
            chatbot.initialized = True
            chatbot.rag_initialized = True
            chatbot.perplexity_initialized = True
            chatbot.init_timestamp = time.time()
            chatbot.last_update = chatbot.init_timestamp
            
            return True
        
        # 문서 로드
        chatbot.load_documents()
        
        # RAG 인덱스 생성
        chatbot.create_rag_index()
        
        # Perplexity API 확인
        chatbot.check_perplexity_api()
        
        # 초기화 완료 및 타임스탬프 업데이트
        chatbot.initialized = True
        chatbot.init_timestamp = time.time()
        chatbot.last_update = chatbot.init_timestamp
        
        elapsed = time.time() - start_time
        logger.info(f"통합 챗봇 초기화 완료 (소요 시간: {elapsed:.2f}초)")
        
        return True
        
    except Exception as e:
        logger.error(f"통합 챗봇 초기화 오류: {str(e)}")
        return False