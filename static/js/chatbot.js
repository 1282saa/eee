/**
 * 챗봇 모듈
 * RAG 기반 챗봇 기능을 구현합니다.
 */

// 챗봇 객체
window.Chatbot = (function () {
  // 내부 변수
  let isWaiting = false;
  let chatHistory = [];
  let isRagEnabled = false;
  let isRagInitializing = false;

  // 경제 용어 데이터 캐시
  let termsData = [];

  /**
   * 초기화 함수
   */
  function init() {
    // 초기 메시지를 채팅 기록에 추가
    chatHistory.push({
      role: "bot",
      content: '무엇이 궁금한가용? 예를 들어 "ETF가 뭐야?" 라고 물어보세용!',
    });

    // 이벤트 리스너 설정
    setupEventListeners();

    // 경제 용어 데이터 로드
    loadTermsData();

    // RAG 챗봇 상태 확인
    checkRagChatbotStatus();
    
    // 추천 검색어 클릭 이벤트 설정
    setupSuggestedSearches();
  }

  /**
   * 이벤트 리스너 설정
   */
  function setupEventListeners() {
    const chatInput = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");
    const initRagButton = document.getElementById("init-rag-button");

    // 전송 버튼 클릭 이벤트
    sendButton.addEventListener("click", () => {
      sendMessage();
    });

    // 엔터 키 이벤트
    chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });

    // 입력 필드 포커스 이벤트
    chatInput.addEventListener("focus", () => {
      chatInput.classList.add("ring-2", "ring-orange-500");
    });

    chatInput.addEventListener("blur", () => {
      chatInput.classList.remove("ring-2", "ring-orange-500");
    });

    // RAG 초기화 버튼 이벤트
    if (initRagButton) {
      initRagButton.addEventListener("click", () => {
        initializeRagChatbot();
      });
    }
  }

  /**
   * 경제 용어 데이터 로드
   */
  function loadTermsData() {
    if (window.ContentData) {
      const files = window.ContentData.economyTermsFiles;
      termsData = files.map((file) =>
        window.ContentData.extractFileInfo(file, "economy_terms")
      );
    }
  }

  /**
   * RAG 챗봇 상태 확인
   */
  function checkRagChatbotStatus() {
    fetch("/api/chatbot/status")
      .then((response) => response.json())
      .then((data) => {
        isRagEnabled = data.ready;
        isRagInitializing = data.initializing;
        updateRagStatusUI();
        
        // 상세 상태 정보 표시
        if (data.rag_initialized && data.perplexity_initialized) {
          console.log("통합 챗봇 완전 활성화");
        } else if (data.rag_initialized) {
          console.log("RAG 활성화, 웹 검색 비활성화");
        }
      })
      .catch((error) => {
        console.error("RAG 챗봇 상태 확인 오류:", error);
        isRagEnabled = false;
        isRagInitializing = false;
        updateRagStatusUI();
      });
  }

  /**
   * RAG 상태 UI 업데이트
   */
  function updateRagStatusUI() {
    const ragStatusElement = document.getElementById("rag-status");
    const initRagButton = document.getElementById("init-rag-button");

    if (ragStatusElement) {
      if (isRagEnabled) {
        ragStatusElement.textContent = "AI 고급 기능: 활성화";
        ragStatusElement.classList.remove("text-gray-500", "text-yellow-500");
        ragStatusElement.classList.add("text-green-500");
      } else if (isRagInitializing) {
        ragStatusElement.textContent = "AI 고급 기능: 초기화 중...";
        ragStatusElement.classList.remove("text-gray-500", "text-green-500");
        ragStatusElement.classList.add("text-yellow-500");
      } else {
        ragStatusElement.textContent = "AI 고급 기능: 비활성화";
        ragStatusElement.classList.remove("text-green-500", "text-yellow-500");
        ragStatusElement.classList.add("text-gray-500");
      }
    }

    if (initRagButton) {
      if (isRagEnabled || isRagInitializing) {
        initRagButton.disabled = true;
        initRagButton.classList.add("opacity-50", "cursor-not-allowed");
      } else {
        initRagButton.disabled = false;
        initRagButton.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }
  }

  /**
   * RAG 챗봇 초기화
   */
  function initializeRagChatbot() {
    if (isRagEnabled || isRagInitializing) return;

    isRagInitializing = true;
    updateRagStatusUI();

    // 초기화 중임을 알리는 메시지 추가
    addMessageToChat(
      "bot",
      "AI 고급 기능을 초기화하는 중이에용! 몇 분 정도 소요될 수 있어용... 🧠"
    );

    fetch("/api/chatbot/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("RAG 챗봇 초기화 요청:", data);

        // 상태 확인을 위한 주기적 폴링
        const statusCheck = setInterval(() => {
          fetch("/api/chatbot/status")
            .then((response) => response.json())
            .then((statusData) => {
              isRagInitializing = statusData.initializing;
              isRagEnabled = statusData.ready;
              updateRagStatusUI();

              if (!statusData.initializing) {
                clearInterval(statusCheck);

                if (statusData.ready) {
                  addMessageToChat(
                    "bot",
                    "AI 고급 기능이 활성화되었어용! 이제 더 똑똑하게 질문에 답변해 드릴 수 있어용. 😊"
                  );
                } else {
                  addMessageToChat(
                    "bot",
                    "AI 고급 기능 초기화에 실패했어용. 😢 나중에 다시 시도해주세용."
                  );
                }
              }
            })
            .catch((error) => {
              console.error("RAG 챗봇 상태 확인 오류:", error);
              clearInterval(statusCheck);
              isRagInitializing = false;
              isRagEnabled = false;
              updateRagStatusUI();
              addMessageToChat(
                "bot",
                "AI 고급 기능 초기화 중 오류가 발생했어용. 😢 나중에 다시 시도해주세용."
              );
            });
        }, 5000); // 5초마다 상태 확인
      })
      .catch((error) => {
        console.error("RAG 챗봇 초기화 오류:", error);
        isRagInitializing = false;
        isRagEnabled = false;
        updateRagStatusUI();
        addMessageToChat(
          "bot",
          "AI 고급 기능 초기화 중 오류가 발생했어용. 😢 나중에 다시 시도해주세용."
        );
      });
  }

  /**
   * 메시지 전송
   */
  function sendMessage() {
    if (isWaiting) return;

    const chatInput = document.getElementById("chat-input");
    const message = chatInput.value.trim();

    if (!message) return;

    // 사용자 메시지 추가
    addMessageToChat("user", message);

    // 입력 필드 초기화
    chatInput.value = "";

    // 응답 대기 상태로 변경
    isWaiting = true;

    // 챗봇 응답 처리
    if (isRagEnabled) {
      // RAG 챗봇 응답 처리
      processRagChatbotResponse(message);
    } else {
      // 기본 챗봇 응답 처리
      setTimeout(() => {
        processUserMessage(message);
        isWaiting = false;
      }, 500);
    }
  }

  /**
   * RAG 챗봇 응답 처리 - 스트리밍 API 사용
   * @param {string} message - 사용자 메시지
   */
  function processRagChatbotResponse(message) {
    // EventSource를 사용한 스트리밍 처리
    const eventSource = new EventSource(`/api/chatbot/stream?query=${encodeURIComponent(message)}`);
    
    // 상태 메시지를 표시할 요소 생성
    const statusDiv = addStatusMessage("", "searching");
    let currentBotMessage = null;
    let accumulatedContent = "";
    
    eventSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'searching':
        case 'processing':
        case 'generating':
          // 상태 메시지 업데이트
          updateStatusMessage(statusDiv, data.message, data.type);
          break;
          
        case 'content':
          // 첫 콘텐츠인 경우 상태 메시지 제거하고 봇 메시지 생성
          if (!currentBotMessage) {
            removeStatusMessage(statusDiv);
            currentBotMessage = addStreamingMessage("bot");
          }
          // 콘텐츠 누적 및 표시
          accumulatedContent += data.content;
          updateStreamingMessage(currentBotMessage, accumulatedContent);
          break;
          
        case 'citations':
          // 인용 정보 저장 (나중에 사용)
          if (!currentBotMessage) {
            currentBotMessage = addStreamingMessage("bot");
          }
          // 최종 메시지를 인용과 함께 다시 렌더링
          finalizeStreamingMessage(currentBotMessage, accumulatedContent, data.citations);
          // 인용 정보 표시
          console.log('Received citations:', data.citations);
          addCitationsToChat(data.citations);
          break;
          
        case 'sources':
          // 사용된 소스 정보 표시
          if (data.sources_used) {
            const sources = [];
            if (data.sources_used.internal) sources.push("내부 문서");
            if (data.sources_used.web) sources.push("실시간 웹 검색");
            if (sources.length > 0) {
              addSourcesIndicator(sources);
            }
          }
          break;
          
        case 'timing':
          // 처리 시간 정보 기록
          console.log(`AI 응답 처리 시간: ${data.processing_time?.toFixed(2)}초, 총 소요시간: ${data.total_time?.toFixed(2)}초`);
          break;
          
        case 'done':
          // 완료 처리
          eventSource.close();
          isWaiting = false;
          break;
          
        case 'error':
          // 오류 처리
          removeStatusMessage(statusDiv);
          addMessageToChat("bot", `오류가 발생했어용: ${data.message}`);
          eventSource.close();
          isWaiting = false;
          break;
      }
    };
    
    eventSource.onerror = function(error) {
      console.error("스트리밍 연결 오류:", error);
      removeStatusMessage(statusDiv);
      
      // fetch 폴백
      fetch("/api/chatbot/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: message }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            addMessageToChat("bot", `오류가 발생했어용: ${data.error}`);
          } else {
            addMessageToChat("bot", data.answer);
            if (data.citations && data.citations.length > 0) {
              addCitationsToChat(data.citations);
            }
          }
          isWaiting = false;
        })
        .catch((error) => {
          console.error("폴백 질의 오류:", error);
          addMessageToChat(
            "bot",
            "죄송해용, 답변을 생성하는 도중 오류가 발생했어용. 다시 시도해주세용."
          );
          isWaiting = false;
        });
        
      eventSource.close();
    };
  }

  /**
   * 통합 챗봇의 출처 정보 추가
   * @param {Array} citations - 출처 정보 배열
   */
  function addCitationsToChat(citations) {
    if (!citations || citations.length === 0) return;

    console.log('Adding citations to chat:', citations);

    const chatOutput = document.getElementById("chat-output");

    // 새 메시지 요소 생성
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-bubble bot-bubble citations-info bg-gray-50 border border-gray-200";

    // 로고 이미지 URL (Perplexity 로고 추가)
    const perplexityLogo = '<img src="https://www.perplexity.ai/favicon.ico" alt="Perplexity" class="w-4 h-4 inline-block mr-1">';
    
    // 출처 정보 HTML 생성
    let citationsHtml = '<div class="font-semibold mb-2">📚 출처 정보:</div>';
    
    // 출처 분류
    const internalCitations = citations.filter(c => c.type === "internal");
    const webCitations = citations.filter(c => c.type === "web");
    
    // 내부 문서 출처
    if (internalCitations.length > 0) {
      citationsHtml += '<div class="mt-2 mb-1"><strong>내부 문서:</strong></div><ul class="space-y-1">';
      internalCitations.forEach((citation, index) => {
        const docType = citation.source_type === "economy_terms" ? "경제 용어" : "최신 콘텐츠";
        const cleanTitle = citation.title.replace(/_\d+/, '').replace(/\.md$/, '');
        
        const quotedText = citation.quoted_text ? encodeURIComponent(citation.quoted_text) : '';
        console.log(`Citation ${index + 1} quoted text:`, citation.quoted_text);
        console.log(`Citation ${index + 1} encoded quoted text:`, quotedText);
        
        citationsHtml += `
          <li class="citation-item ml-3">
            <a href="#" class="text-blue-600 hover:underline flex items-center gap-1" 
               onclick="event.preventDefault(); console.log('Citation clicked', '${citation.file_name}', '${citation.source_type}', '${quotedText}'); window.ContentManager.showCitationDetail('${citation.file_name}', '${citation.source_type}', '${quotedText}');">
              <span class="citation-number text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">${index + 1}</span>
              ${cleanTitle} (${docType})
            </a>
          </li>
        `;
      });
      citationsHtml += '</ul>';
    }
    
    // 웹 출처
    if (webCitations.length > 0) {
      citationsHtml += `<div class="mt-3 mb-1"><strong>웹 검색 결과 <span class="inline-flex items-center">${perplexityLogo}</span>:</strong></div><ul class="space-y-1">`;
      webCitations.forEach((citation, index) => {
        citationsHtml += `
          <li class="citation-item ml-3">
            <a href="${citation.url}" target="_blank" class="text-green-600 hover:underline flex items-center gap-1">
              <span class="citation-number text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">${internalCitations.length + index + 1}</span>
              ${citation.title}
              <span class="text-xs text-gray-500">(${citation.source})</span>
              <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </li>
        `;
      });
      citationsHtml += '</ul>';
    }

    messageDiv.innerHTML = citationsHtml;

    // 채팅창에 추가
    chatOutput.appendChild(messageDiv);

    // 스크롤을 최신 메시지 위치로 이동
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }

  /**
   * 타이핑 인디케이터 추가
   * @returns {HTMLElement} 생성된 타이핑 인디케이터 요소
   */
  function addTypingIndicator() {
    const chatOutput = document.getElementById("chat-output");

    // 새 메시지 요소 생성
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-bubble bot-bubble typing-indicator";
    messageDiv.innerHTML = `<span class="font-semibold">경제용:</span> <span class="dots"><span>.</span><span>.</span><span>.</span></span>`;

    // 채팅창에 추가
    chatOutput.appendChild(messageDiv);

    // 스크롤을 최신 메시지 위치로 이동
    chatOutput.scrollTop = chatOutput.scrollHeight;

    return messageDiv;
  }

  /**
   * 타이핑 인디케이터 제거
   * @param {HTMLElement} element - 제거할 타이핑 인디케이터 요소
   */
  function removeTypingIndicator(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * 관련 문서 정보 추가
   * @param {Array} relatedDocs - 관련 문서 목록
   */
  function addRelatedDocsToChat(relatedDocs) {
    if (!relatedDocs || relatedDocs.length === 0) return;

    const chatOutput = document.getElementById("chat-output");

    // 새 메시지 요소 생성
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-bubble bot-bubble related-docs";

    // 관련 문서 링크 생성
    let docsHtml = `<span class="font-semibold">관련 문서:</span><br>`;
    relatedDocs.forEach((doc) => {
      const docType =
        doc.source_type === "economy_terms" ? "경제 용어" : "최신 콘텐츠";
      const tabId =
        doc.source_type === "economy_terms" ? "tab-terms" : "tab-contents";

      docsHtml += `
        <div class="related-doc-item">
          <a href="#" class="text-orange-500 hover:underline" 
             onclick="event.preventDefault(); document.getElementById('${tabId}').click(); window.ContentManager.openContentModal('${doc.file_name}', '${doc.source_type}');">
            📄 ${doc.title} (${docType})
          </a>
        </div>
      `;
    });

    messageDiv.innerHTML = docsHtml;

    // 채팅창에 추가
    chatOutput.appendChild(messageDiv);

    // 스크롤을 최신 메시지 위치로 이동
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }

  /**
   * 출처 정보 추가
   * @param {Object} sources - 출처 정보 객체
   */
  function addSourcesToChat(sources) {
    if (!sources) return;

    const chatOutput = document.getElementById("chat-output");

    // 새 메시지 요소 생성
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-bubble bot-bubble sources-info";

    // 출처 정보 HTML 생성
    let sourcesHtml = '<span class="font-semibold">📚 출처 정보:</span><br>';
    
    // 소스 타입에 따른 표시
    if (sources.type === "hybrid") {
      sourcesHtml += '<div class="text-green-600 mb-2">🌐 실시간 웹 검색 + 내부 문서 결합</div>';
    } else if (sources.type === "rag_only") {
      sourcesHtml += '<div class="text-blue-600 mb-2">📖 내부 문서 기반 답변</div>';
    } else if (sources.type === "filtered") {
      sourcesHtml += `<div class="text-gray-600 mb-2">ℹ️ ${sources.reason}</div>`;
    }
    
    // 내부 문서 표시
    if (sources.internal_docs && sources.internal_docs.length > 0) {
      sourcesHtml += '<div class="mt-2">';
      sources.internal_docs.forEach(doc => {
        const docType = doc.source_type === "economy_terms" ? "경제 용어" : "최신 콘텐츠";
        const tabId = doc.source_type === "economy_terms" ? "tab-terms" : "tab-contents";
        
        sourcesHtml += `
          <div class="related-doc-item">
            <a href="#" class="text-orange-500 hover:underline" 
               onclick="event.preventDefault(); document.getElementById('${tabId}').click(); window.ContentManager.openContentModal('${doc.file_name || doc.title + '.md'}', '${doc.source_type}');">
              📄 ${doc.title} (${docType})
            </a>
          </div>
        `;
      });
      sourcesHtml += '</div>';
    }
    
    // 웹 검색 표시
    if (sources.web_search) {
      sourcesHtml += `<div class="mt-2 text-green-600">🔍 ${sources.web_search}</div>`;
    }

    messageDiv.innerHTML = sourcesHtml;

    // 채팅창에 추가
    chatOutput.appendChild(messageDiv);

    // 스크롤을 최신 메시지 위치로 이동
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }

  /**
   * 사용자 메시지 처리 (기본 챗봇)
   * @param {string} message - 사용자 메시지
   */
  function processUserMessage(message) {
    const lowercaseMsg = message.toLowerCase();

    // 인사 감지
    if (
      lowercaseMsg.includes("안녕") ||
      lowercaseMsg.includes("반가워") ||
      lowercaseMsg.includes("hello")
    ) {
      addMessageToChat("bot", "안녕하세요! 경제용이에용! 무엇을 도와드릴까용?");
      return;
    }

    // 감사 감지
    if (
      lowercaseMsg.includes("고마워") ||
      lowercaseMsg.includes("감사") ||
      lowercaseMsg.includes("thank")
    ) {
      addMessageToChat(
        "bot",
        "도움이 되었다니 기뻐용! 또 궁금한 점이 있으면 언제든 물어보세용!"
      );
      return;
    }

    // RAG 기능 활성화 요청 감지
    if (
      lowercaseMsg.includes("rag") ||
      lowercaseMsg.includes("고급 기능") ||
      lowercaseMsg.includes("ai 기능") ||
      (lowercaseMsg.includes("고급") && lowercaseMsg.includes("활성화"))
    ) {
      if (isRagEnabled) {
        addMessageToChat("bot", "AI 고급 기능이 이미 활성화되어 있어용!");
      } else if (isRagInitializing) {
        addMessageToChat(
          "bot",
          "AI 고급 기능을 초기화하는 중이에용! 조금만 기다려주세용..."
        );
      } else {
        addMessageToChat(
          "bot",
          "AI 고급 기능을 활성화하려면 상단의 '고급 AI 기능 활성화' 버튼을 클릭해주세용! 모든 경제 용어와 콘텐츠를 분석해서 더 똑똑한 답변을 드릴 수 있게 될 거예용."
        );
      }
      return;
    }

    // 경제 용어 검색
    const termMatch = findMatchingTerm(lowercaseMsg);
    if (termMatch) {
      // 용어 정보를 요약하여 응답
      const summaryContent = generateTermSummary(termMatch);
      addMessageToChat("bot", summaryContent);
      return;
    }

    // 정의되지 않은 질문에 대한 응답
    const fallbackResponses = [
      "흠, 그건 제가 잘 모르는 부분이네용. 경제 용어나 최신 경제 소식에 대해 물어보세용!",
      "아직 그 부분은 공부 중이에용! 다른 경제 관련 질문을 해주세용.",
      "재미있는 질문이지만, 제가 답변하기 어려운 내용이에용. 경제 용어나 투자에 대해 물어보세용!",
      "그 질문에 대한 답을 찾고 있는데 시간이 좀 필요해용. 다른 경제 관련 질문을 해주세용!",
      "더 정확한 답변을 드리려면 AI 고급 기능이 필요해 보여용! 상단의 'AI 고급 기능 활성화' 버튼을 클릭해보세요.",
    ];

    const randomResponse =
      fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    addMessageToChat("bot", randomResponse);
  }

  /**
   * 상태 메시지 추가
   * @param {string} message - 상태 메시지
   * @param {string} type - 메시지 타입
   * @returns {HTMLElement} 생성된 상태 메시지 요소
   */
  function addStatusMessage(message, type) {
    const chatOutput = document.getElementById("chat-output");
    const statusDiv = document.createElement("div");
    statusDiv.className = "chat-bubble bot-bubble status-message bg-orange-50 border-orange-200";
    statusDiv.id = `status-${Date.now()}`;
    
    let icon = "";
    let customMessage = "";
    
    switch (type) {
      case 'searching':
        icon = "🔍";
        customMessage = "검색중이에용! 기다려주세용~";
        break;
      case 'processing':
        icon = "📚";
        customMessage = "자료를 찾고 있어용! 조금만 기다려주세용~";
        break;
      case 'generating':
        icon = "💭";
        customMessage = "답변을 준비하고 있어용! 거의 다 됐어용~";
        break;
      default:
        icon = "⏳";
        customMessage = message;
    }
    
    statusDiv.innerHTML = `
      <div class="flex items-center space-x-3">
        <img src="https://img2.stibee.com/d2fad6b1-3012-4b5c-943a-3ca4c6a1b546.png" 
             alt="경제용" class="w-12 h-12 rounded-full animate-bounce">
        <div class="flex-grow">
          <div class="font-semibold text-orange-700">경제용</div>
          <div class="text-orange-600">${customMessage}</div>
        </div>
        <span class="animate-pulse text-2xl">${icon}</span>
      </div>
    `;
    
    chatOutput.appendChild(statusDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
    
    return statusDiv;
  }
  
  /**
   * 상태 메시지 업데이트
   * @param {HTMLElement} element - 업데이트할 요소
   * @param {string} message - 새 메시지
   * @param {string} type - 메시지 타입
   */
  function updateStatusMessage(element, message, type) {
    if (!element) return;
    
    let icon = "";
    switch (type) {
      case 'searching':
        icon = "🔍";
        break;
      case 'processing':
        icon = "📚";
        break;
      case 'generating':
        icon = "💭";
        break;
      default:
        icon = "⏳";
    }
    
    element.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="animate-pulse text-xl">${icon}</span>
        <span>${message}</span>
      </div>
    `;
  }
  
  /**
   * 상태 메시지 제거
   * @param {HTMLElement} element - 제거할 요소
   */
  function removeStatusMessage(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
  
  /**
   * 스트리밍 메시지 추가
   * @param {string} role - 메시지 발신자
   * @returns {HTMLElement} 생성된 메시지 요소
   */
  function addStreamingMessage(role) {
    const chatOutput = document.getElementById("chat-output");
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-bubble ${role === "user" ? "user-bubble ml-auto" : "bot-bubble"}`;
    messageDiv.id = `stream-${Date.now()}`;
    
    const sender = role === "user" ? "나" : "경제용";
    messageDiv.innerHTML = `
      <span class="font-semibold">${sender}:</span>
      <span class="message-content"></span>
      <span class="typing-cursor animate-pulse">▋</span>
    `;
    
    chatOutput.appendChild(messageDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
    
    return messageDiv;
  }
  
  /**
   * 스트리밍 메시지 업데이트
   * @param {HTMLElement} element - 업데이트할 요소
   * @param {string} content - 추가할 콘텐츠
   */
  function updateStreamingMessage(element, content) {
    if (!element) return;
    
    const contentSpan = element.querySelector('.message-content');
    if (contentSpan) {
      contentSpan.textContent = content;
      
      // 스크롤 위치 조정
      const chatOutput = document.getElementById("chat-output");
      chatOutput.scrollTop = chatOutput.scrollHeight;
    }
  }
  
  /**
   * 사용된 소스 표시
   * @param {Array} sources - 사용된 소스 목록
   */
  function addSourcesIndicator(sources) {
    const chatOutput = document.getElementById("chat-output");
    const sourceDiv = document.createElement("div");
    sourceDiv.className = "chat-bubble bot-bubble sources-indicator";
    
    let sourceIcons = [];
    if (sources.includes("내부 문서")) sourceIcons.push("📚");
    if (sources.includes("실시간 웹 검색")) sourceIcons.push("🌐");
    
    sourceDiv.innerHTML = `
      <div class="flex items-center space-x-2 text-sm text-gray-600">
        <span class="font-semibold">사용된 소스:</span>
        <span>${sourceIcons.join(" ")} ${sources.join(", ")}</span>
      </div>
    `;
    
    chatOutput.appendChild(sourceDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }
  
  /**
   * 스트리밍 메시지 최종화 (인용 번호 추가)
   * @param {HTMLElement} element - 메시지 요소
   * @param {string} content - 최종 콘텐츠
   * @param {Array} citations - 인용 정보
   */
  function finalizeStreamingMessage(element, content, citations) {
    if (!element || !citations) return;
    
    console.log('Finalizing streaming message with citations:', citations);
    
    // 타이핑 커서 제거
    const cursor = element.querySelector('.typing-cursor');
    if (cursor) {
      cursor.remove();
    }
    
    // 인용 번호를 클릭 가능한 링크로 변환
    let processedContent = content;
    if (citations.length > 0) {
      // 모든 인용에 대한 맵 생성
      const citationMap = {};
      citations.forEach((citation, index) => {
        citationMap[index + 1] = citation;
      });
      
      processedContent = content.replace(/\[(\d+)\]/g, (match, num) => {
        const citationNum = parseInt(num);
        const citation = citationMap[citationNum];
        
        if (citation) {
          console.log(`Processing citation [${num}]:`, citation);
          
          if (citation.type === "internal") {
            const quotedText = citation.quoted_text ? encodeURIComponent(citation.quoted_text) : '';
            console.log(`Encoded quoted text for [${num}]:`, quotedText);
            return `<a href="#" class="citation-link text-blue-600 hover:underline font-semibold" onclick="event.preventDefault(); console.log('Citation clicked', '${citation.file_name}', '${citation.source_type}', '${quotedText}'); window.ContentManager.showCitationDetail('${citation.file_name}', '${citation.source_type}', '${quotedText}');">[${num}]</a>`;
          } else if (citation.type === "web") {
            return `<a href="${citation.url}" target="_blank" class="citation-link text-green-600 hover:underline font-semibold">[${num}]</a>`;
          }
        }
        return match;
      });
    }
    
    // 메시지 내용 업데이트
    const contentSpan = element.querySelector('.message-content');
    if (contentSpan) {
      contentSpan.innerHTML = processedContent;
    }
  }

  /**
   * 메시지를 채팅창에 추가
   * @param {string} role - 메시지 발신자 역할 ('user' 또는 'bot')
   * @param {string} content - 메시지 내용
   * @param {Array} citations - 인용 정보 (옵션)
   */
  function addMessageToChat(role, content, citations = []) {
    const chatOutput = document.getElementById("chat-output");

    // 새 메시지 요소 생성
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-bubble ${
      role === "user" ? "user-bubble ml-auto" : "bot-bubble"
    }`;

    // 발신자 표시
    const sender = role === "user" ? "나" : "경제용";
    
    // 인용 번호 매칭 및 변환
    let processedContent = content;
    if (citations && citations.length > 0) {
      // [1], [2] 등의 패턴을 찾아서 클릭 가능한 링크로 변환
      processedContent = content.replace(/\[(\d+)\]/g, (match, num) => {
        const citationIndex = parseInt(num) - 1;
        if (citationIndex < citations.length) {
          const citation = citations[citationIndex];
          if (citation.type === "internal") {
            const quotedText = citation.quoted_text ? encodeURIComponent(citation.quoted_text) : '';
            return `<a href="#" class="citation-link text-blue-600 hover:underline" onclick="event.preventDefault(); window.ContentManager.showCitationDetail('${citation.file_name}', '${citation.source_type}', decodeURIComponent('${quotedText}'));">[${num}]</a>`;
          } else if (citation.type === "web") {
            return `<a href="${citation.url}" target="_blank" class="citation-link text-green-600 hover:underline">[${num}]</a>`;
          }
        }
        return match;
      });
    }
    
    messageDiv.innerHTML = `<span class="font-semibold">${sender}:</span> ${processedContent}`;

    // 채팅창에 추가
    chatOutput.appendChild(messageDiv);

    // 스크롤을 최신 메시지 위치로 이동
    chatOutput.scrollTop = chatOutput.scrollHeight;

    // 채팅 기록에 메시지 추가
    chatHistory.push({ role, content });
  }

  /**
   * 일치하는 경제 용어 찾기
   * @param {string} message - 사용자 메시지
   * @returns {Object|null} 일치하는 용어 데이터 또는 null
   */
  function findMatchingTerm(message) {
    if (!termsData || termsData.length === 0) return null;

    // 메시지에서 키워드 추출
    const keywords = extractKeywords(message);

    // 각 용어와 키워드 매칭 점수 계산
    const matches = termsData.map((term) => {
      const title = term.title.toLowerCase();
      let score = 0;

      // 제목에 키워드가 포함되어 있는지 확인
      keywords.forEach((keyword) => {
        if (title.includes(keyword)) {
          score += 10;
        }
      });

      // 정확한 용어 매칭
      if (keywords.some((keyword) => keyword === title)) {
        score += 50;
      }

      // "뭐야", "뭐임", "뭐에요" 등 질문 패턴 감지
      if (
        message.includes(title) &&
        (message.includes("뭐") ||
          message.includes("뭔가") ||
          message.includes("무엇") ||
          message.includes("설명"))
      ) {
        score += 30;
      }

      return { term, score };
    });

    // 점수가 가장 높은 용어 찾기
    const bestMatch = matches.sort((a, b) => b.score - a.score)[0];

    // 최소 점수 이상인 경우만 반환
    return bestMatch && bestMatch.score >= 10 ? bestMatch.term : null;
  }

  /**
   * 메시지에서 키워드 추출
   * @param {string} message - 사용자 메시지
   * @returns {Array} 추출된 키워드 배열
   */
  function extractKeywords(message) {
    // 불필요한 단어 제거
    const stopWords = [
      "가",
      "이",
      "그",
      "저",
      "것",
      "무엇",
      "뭐",
      "뭔가",
      "어떤",
      "어떻게",
      "왜",
      "언제",
      "어디",
      "누구",
      "이것",
      "저것",
    ];

    // 단어 분리 및 필터링
    return message
      .replace(/[.,?!;:]/g, " ")
      .split(" ")
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 1 && !stopWords.includes(word));
  }

  /**
   * 용어 요약 생성
   * @param {Object} term - 용어 데이터
   * @returns {string} 생성된 요약 HTML
   */
  function generateTermSummary(term) {
    // 마크다운 내용에서 첫 번째 섹션 추출
    const sections = term.content.split("##");
    let summary = "";

    if (sections.length > 1) {
      // 첫 번째 섹션 다음의 섹션 사용
      summary = sections[1].trim();
    } else {
      // 첫 번째 섹션만 있는 경우
      summary = sections[0].split("---")[1] || sections[0];
    }

    // 내용이 너무 길면 잘라내기
    if (summary.length > 300) {
      summary = summary.substring(0, 300) + "...";
    }

    // 링크 추가하여 결과 생성
    return `
      <strong>${term.title}</strong>에 대해 알려드릴게용!<br><br>
      ${summary}<br><br>
      <span class="text-orange-500 cursor-pointer" onclick="document.getElementById('tab-terms').click(); window.ContentManager.openContentModal('${term.fileName}', 'economy_terms');">
        더 자세히 알고 싶으시다면 경제 용어 섹션에서 확인해보세용! 👉
      </span>
    `;
  }

  /**
   * 추천 검색어 클릭 이벤트 설정
   */
  function setupSuggestedSearches() {
    const searchSuggestions = document.querySelectorAll('.search-suggestion');
    
    searchSuggestions.forEach(suggestion => {
      suggestion.addEventListener('click', () => {
        const searchText = suggestion.querySelector('p').textContent;
        
        // 입력 필드에 텍스트 설정
        const chatInput = document.getElementById('chat-input');
        chatInput.value = searchText;
        
        // 메시지 전송
        sendMessage();
      });
    });
  }

  // 공개 API
  return {
    init,
    sendMessage,
    addMessageToChat,
    initializeRagChatbot,
    isRagEnabled: () => isRagEnabled,
  };
})();
