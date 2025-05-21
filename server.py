from flask import Flask, send_from_directory, jsonify, render_template, request, Response
import os
import logging
from pathlib import Path
import mimetypes
import json
import threading
import time
import sys
import requests # requests 임포트 필요

# 프로젝트 루트를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 설정 파일 import (사용하지 않을 수도 있지만 기존 코드에 있었으므로 유지)
from configs.config import Config

# 통합 챗봇 모듈 import (기존 코드에서 사용하므로 유지)
import modules.unified_chatbot as unified_chatbot

app = Flask(__name__)

# --- 기존 로깅 및 디렉토리 설정 (변경 없음) ---
# 로그 디렉토리 생성
log_dir = '/tmp/logs' if os.environ.get('ENVIRONMENT') == 'cloud_run' else 'logs'
os.makedirs(log_dir, exist_ok=True)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename=f'{log_dir}/server.log'
)
logger = logging.getLogger(__name__)

# MIME 타입 설정
mimetypes.add_type('text/markdown', '.md')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# 환경에 따른 디렉토리 설정
ROOT_DIR = Path(__file__).parent
DATA_BASE_DIR = Path('/tmp/data') if os.environ.get('ENVIRONMENT') == 'cloud_run' else ROOT_DIR / "data"
ECONOMY_TERMS_DIR = DATA_BASE_DIR / "economy_terms"
RECENT_CONTENTS_DIR = DATA_BASE_DIR / "recent_contents_final"

logger.info(f"ROOT_DIR: {ROOT_DIR}")
logger.info(f"ECONOMY_TERMS_DIR: {ECONOMY_TERMS_DIR}")
logger.info(f"RECENT_CONTENTS_DIR: {RECENT_CONTENTS_DIR}")

# 폴더가 없는 경우 생성
os.makedirs(ECONOMY_TERMS_DIR, exist_ok=True)
os.makedirs(RECENT_CONTENTS_DIR, exist_ok=True)
os.makedirs(log_dir, exist_ok=True)
os.makedirs(ROOT_DIR / 'templates', exist_ok=True)

# 챗봇 초기화 상태 (기존 코드에서 사용하므로 유지)
chatbot_ready = False
chatbot_initializing = False

# 서버 시작 시 챗봇 자동 초기화 함수 (기존 코드에서 사용하므로 유지)
def initialize_chatbot_at_startup():
    global chatbot_ready, chatbot_initializing
    try:
        logger.info("서버 시작 시 통합 챗봇 자동 초기화 시작")
        chatbot_initializing = True
        success = unified_chatbot.initialize_unified_chatbot()
        chatbot_ready = success
        chatbot_initializing = False
        logger.info(f"통합 챗봇 자동 초기화 완료: {success}")
    except Exception as e:
        logger.error(f"통합 챗봇 자동 초기화 중 오류 발생: {str(e)}")
        chatbot_ready = False
        chatbot_initializing = False

# 서버 시작 시 백그라운드에서 챗봇 초기화 실행 (기존 코드에서 사용하므로 유지)
threading.Thread(target=initialize_chatbot_at_startup).start()

# CORS 설정 (기존 코드에서 사용하므로 유지)
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    return response

# --- 기존 라우트들 (변경 없음) ---
@app.route('/')
def index():
    return send_from_directory('templates', 'ui.html')

@app.route('/health')
def health():
    """Health check endpoint for monitoring"""
    return jsonify({"status": "healthy", "timestamp": time.time()})

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/economy_terms')
def get_economy_terms():
    files = []
    if ECONOMY_TERMS_DIR.exists():
        try:
            for file in ECONOMY_TERMS_DIR.glob('*.md'):
                files.append(file.name)
            logger.info(f"경제 용어 파일 목록 반환: {len(files)}개")
        except Exception as e:
            logger.error(f"경제 용어 파일 목록 조회 오류: {str(e)}")
    else:
        logger.warning(f"경제 용어 디렉토리가 존재하지 않음: {ECONOMY_TERMS_DIR}")
    return jsonify({'files': files})

@app.route('/api/recent_contents')
def get_recent_contents():
    files = []
    if RECENT_CONTENTS_DIR.exists():
        try:
            for file in RECENT_CONTENTS_DIR.glob('*.md'):
                files.append(file.name)
            logger.info(f"최신 콘텐츠 파일 목록 반환: {len(files)}개")
        except Exception as e:
            logger.error(f"최신 콘텐츠 파일 목록 조회 오류: {str(e)}")
    else:
        logger.warning(f"최신 콘텐츠 디렉토리가 존재하지 않음: {RECENT_CONTENTS_DIR}")
    return jsonify({'files': files})

@app.route('/api/economy_terms/<path:filename>')
def get_economy_term(filename):
    try:
        file_path = ECONOMY_TERMS_DIR / filename
        logger.info(f"경제 용어 파일 요청: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return content
    except Exception as e:
        logger.error(f"경제 용어 파일 로드 오류: {str(e)}")
        return str(e), 404

@app.route('/api/recent_contents/<path:filename>')
def get_recent_content(filename):
    try:
        file_path = RECENT_CONTENTS_DIR / filename
        logger.info(f"최신 콘텐츠 파일 요청: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return content
    except Exception as e:
        logger.error(f"최신 콘텐츠 파일 로드 오류: {str(e)}")
        return str(e), 404

# 통합 챗봇 API (기존 코드에서 사용하므로 유지)
@app.route('/api/chatbot/status')
def chatbot_status():
    global chatbot_ready, chatbot_initializing
    status_info = {
        'ready': chatbot_ready,
        'initializing': chatbot_initializing
    }
    if chatbot_ready:
        try:
            chatbot = unified_chatbot.get_unified_chatbot_instance()
            detailed_status = chatbot.get_status()
            status_info.update(detailed_status)
        except Exception as e:
            logger.error(f"챗봇 상세 상태 조회 오류: {str(e)}")
    return jsonify(status_info)

@app.route('/api/chatbot/initialize', methods=['POST'])
def initialize_chatbot():
    global chatbot_ready, chatbot_initializing
    if chatbot_ready:
        return jsonify({'status': 'success', 'message': '챗봇이 이미 초기화되어 있습니다.'})
    if chatbot_initializing:
        return jsonify({'status': 'pending', 'message': '챗봇이 초기화 중입니다.'})
    if not os.getenv('OPENAI_API_KEY'):
        return jsonify({
            'status': 'error',
            'message': 'OpenAI API 키가 설정되지 않았습니다.'
        }), 400
    def init_chatbot_thread():
        global chatbot_ready, chatbot_initializing
        try:
            logger.info("통합 챗봇 초기화 시작")
            chatbot_initializing = True
            success = unified_chatbot.initialize_unified_chatbot()
            chatbot_ready = success
            chatbot_initializing = False
            logger.info(f"통합 챗봇 초기화 완료: {success}")
        except Exception as e:
            logger.error(f"통합 챗봇 초기화 중 오류 발생: {str(e)}")
            chatbot_ready = False
            chatbot_initializing = False
    threading.Thread(target=init_chatbot_thread).start()
    return jsonify({'status': 'initializing', 'message': '챗봇 초기화가 시작되었습니다.'})

@app.route('/api/chatbot/query', methods=['POST'])
def query_chatbot():
    global chatbot_ready
    if not chatbot_ready:
        return jsonify({
            'status': 'error',
            'message': '챗봇이 초기화되지 않았습니다. 먼저 초기화를 진행해주세요.',
            'ready': chatbot_ready
        }), 400
    try:
        data = request.get_json()
        query = data.get('query', '')
        use_gemini = data.get('use_gemini', False)
        if not query:
            return jsonify({'status': 'error', 'message': '질문이 없습니다.'}), 400
        logger.info(f"통합 챗봇 질의: {query}, Gemini 사용: {use_gemini}")
        chatbot = unified_chatbot.get_unified_chatbot_instance()
        result = chatbot.process_query(query, use_gemini=use_gemini)
        return jsonify({
            'status': 'success',
            'answer': result['answer'],
            'citations': result['citations'],
            'sources_used': result.get('sources_used', {})
        })
    except Exception as e:
        logger.error(f"챗봇 질의 처리 중 오류 발생: {str(e)}")
        return jsonify({'status': 'error', 'message': f'오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/chatbot/stream', methods=['GET'])
def stream_chatbot():
    global chatbot_ready
    query = request.args.get('query', '')
    use_gemini = request.args.get('use_gemini', 'false').lower() == 'true'
    if not query:
        return 'data: ' + json.dumps({'type': 'error', 'message': '질문이 없습니다.'}) + '\n\n'
    if not chatbot_ready:
        return 'data: ' + json.dumps({'type': 'error', 'message': '챗봇이 아직 초기화되지 않았습니다.'}) + '\n\n'
    def generate():
        try:
            yield f"data: {json.dumps({'type': 'searching', 'message': '🔍 관련 정보를 검색하고 있습니다...'})}\n\n"
            time.sleep(0.5)
            chatbot = unified_chatbot.get_unified_chatbot_instance()
            yield f"data: {json.dumps({'type': 'processing', 'message': '📚 내부 문서를 확인하고 있습니다...'})}\n\n"
            api_name = "Gemini" if use_gemini else "Perplexity"
            yield f"data: {json.dumps({'type': 'processing', 'message': f'🌐 {api_name} API를 사용하여 실시간 정보를 검색합니다...'})}\n\n"
            time.sleep(0.5)
            result = chatbot.process_query(query, use_gemini=use_gemini)
            if result.get('sources_used', {}).get('web'):
                yield f"data: {json.dumps({'type': 'processing', 'message': '🌐 실시간 웹 검색을 진행하고 있습니다...'})}\n\n"
                time.sleep(0.5)
            yield f"data: {json.dumps({'type': 'generating', 'message': '💭 답변을 생성하고 있습니다...'})}\n\n"
            time.sleep(0.3)
            answer = result.get('answer', '')
            sentences = answer.replace('. ', '.|').split('|')
            for sentence in sentences:
                if sentence.strip():
                    words = sentence.split(' ')
                    for i in range(0, len(words), 3):
                        chunk = ' '.join(words[i:i+3])
                        yield f"data: {json.dumps({'type': 'content', 'content': chunk + ' '})}\n\n"
                        time.sleep(0.05)
            if result.get('citations'):
                yield f"data: {json.dumps({'type': 'citations', 'citations': result['citations']})}\n\n"
            yield f"data: {json.dumps({'type': 'sources', 'sources_used': result.get('sources_used', {})})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            logger.error(f"스트리밍 중 오류: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    })

@app.route('/api/chatbot/reset', methods=['POST'])
def reset_chatbot():
    global chatbot_ready, chatbot_initializing
    chatbot_ready = False
    chatbot_initializing = False
    unified_chatbot._unified_chatbot_instance = None
    return jsonify({'status': 'success', 'message': '챗봇이 재설정되었습니다.'})

# --- Puppeteer 서버를 호출하는 원래 get_unboxing_video 함수로 복구 ---
@app.route('/api/get-unboxing-video', methods=['POST'])
def get_unboxing_video():
    """서울경제 1면 언박싱 비디오 URL 가져오기 (Puppeteer 서버 사용)"""
    
    logger.info("언박싱 비디오 요청 받음")
    
    try:
        # JSON 데이터가 없어도 처리 가능하도록 수정
        data = request.get_json(force=True, silent=True) or {}
        
        # Puppeteer 사용 여부 확인
        # 환경 변수 USE_PUPPETEER를 'false'로 설정하면 Puppeteer 사용을 건너뛸 수 있음
        use_puppeteer = os.environ.get('USE_PUPPETEER', 'true').lower() == 'true'
        # Puppeteer 서버의 URL. 로컬에서 실행 시 'http://localhost:3001/api/get-unboxing-video'
        puppeteer_url = os.environ.get('PUPPETEER_URL', 'http://localhost:3001/api/get-unboxing-video')
        
        logger.info(f"환경: {os.environ.get('ENVIRONMENT', '프로덕션')}")
        logger.info(f"Puppeteer 사용: {use_puppeteer}")
        logger.info(f"Puppeteer 서버 URL: {puppeteer_url}")
        
        if not use_puppeteer:
            logger.warning("Puppeteer 사용이 비활성화되었습니다. 기본 URL을 반환합니다.")
            return jsonify({
                'success': True,
                'url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                'video_url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                'autoplay': False
            })

        try:
            # Puppeteer 서버로 언박싱 비디오 요청
            logger.info("Puppeteer 서버로 언박싱 비디오 요청 중...")
            response = requests.post(puppeteer_url, json=data, timeout=45) # Puppeteer 작업 시간을 고려하여 timeout 증가
            result = response.json()
            
            if result.get('success'):
                logger.info(f"비디오 URL 획득 성공: {result.get('url')}")
                return jsonify({
                    'success': True,
                    'url': result.get('url'),
                    'video_url': result.get('url'),
                    'autoplay': result.get('autoplay', False)
                })
            else:
                logger.error(f"Puppeteer 서버에서 오류 응답: {result.get('error')}")
                # 오류 시에도 기본 URL 반환
                return jsonify({
                    'success': True, # 이 경우엔 false가 더 적절할 수 있습니다. 필요에 따라 변경하세요.
                    'error': result.get('error'),
                    'url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                    'video_url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                    'autoplay': False
                })
                
        except requests.exceptions.ConnectionError:
            logger.error("Puppeteer 서버에 연결할 수 없습니다. Puppeteer 서버가 실행 중인지 확인하세요.")
            return jsonify({
                'success': False,
                'error': "Puppeteer 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.",
                'url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                'video_url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                'autoplay': False
            })
            
        except requests.exceptions.Timeout:
            logger.error("Puppeteer 서버 응답 시간 초과 (45초).")
            return jsonify({
                'success': False,
                'error': "Puppeteer 서버 응답 시간 초과.",
                'url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                'video_url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
                'autoplay': False
            })
            
    except Exception as e:
        logger.error(f"언박싱 비디오 가져오기 오류 (최상위 예외): {str(e)}")
        return jsonify({
            'success': False, # 이 경우엔 false가 더 적절할 수 있습니다. 필요에 따라 변경하세요.
            'error': f"서버 처리 중 알 수 없는 오류 발생: {str(e)}",
            'url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
            'video_url': 'https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727',
            'autoplay': False
        })


@app.route('/view/<source_type>/<filename>')
def view_document(source_type, filename):
    """내부 문서 보기 (새 창에서 열 때)"""
    try:
        if source_type == 'economy_terms':
            file_path = ECONOMY_TERMS_DIR / filename
        else:
            file_path = RECENT_CONTENTS_DIR / filename
            
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 백틱 문자를 미리 이스케이프 처리
        escaped_content = content.replace('`', r'\`')
            
        # 마크다운을 HTML로 변환하여 반환
        html_content = f"""
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{filename.replace('.md', '')}</title>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
        </head>
        <body class="font-sans p-8 max-w-4xl mx-auto">
            <div id="content" class="prose prose-lg"></div>
            <script>
                document.getElementById('content').innerHTML = marked.parse(`{escaped_content}`);
            </script>
        </body>
        </html>
        """
        return html_content
        
    except Exception as e:
        logger.error(f"문서 조회 오류: {str(e)}")
        return f"문서를 찾을 수 없습니다: {filename}", 404

# 환경 변수 확인 API
@app.route('/api/env/check')
def check_environment():
    """환경 변수 설정 상태 확인"""
    env_status = {
        'openai_api_key': bool(os.getenv('OPENAI_API_KEY')),
        'perplexity_api_key': bool(os.getenv('PERPLEXITY_API_KEY')),
        'gemini_api_key': bool(os.getenv('GEMINI_API_KEY')),
        'required_keys': ['OPENAI_API_KEY'],
        'optional_keys': ['PERPLEXITY_API_KEY', 'GEMINI_API_KEY'],
        'missing_keys': []
    }
    
    for key in env_status['required_keys']:
        if not os.getenv(key):
            env_status['missing_keys'].append(key)
    
    return jsonify(env_status)

# server.py 파일의 가장 마지막 부분 (if __name__ == '__main__': 블록)
if __name__ == '__main__':
    logger.info("통합 경제용 챗봇 서버 시작")

    # 환경 변수 확인 (Flask 컨텍스트 밖에서 직접 확인)
    env_status = {
        'openai_api_key': bool(os.getenv('OPENAI_API_KEY')),
        'perplexity_api_key': bool(os.getenv('PERPLEXITY_API_KEY')),
        'gemini_api_key': bool(os.getenv('GEMINI_API_KEY'))
    }
    logger.info(f"환경 변수 상태: {env_status}")

    # 서버 실행
    port = int(os.environ.get('PORT', 8080))

    # --- 이 부분에 로그 추가 ---
    logger.info(f"Flask 앱이 {port} 포트에서 0.0.0.0 호스트로 실행을 시도합니다.")
    # ---------------------------

    app.run(host='0.0.0.0', port=port, debug=False)

    # --- 만약 app.run() 이후에도 코드가 실행된다면, 서버가 예상과 다르게 종료된 것일 수 있습니다. ---
    logger.error("WARNING: Flask 개발 서버가 예상치 않게 종료되었습니다. 충돌 가능성.")