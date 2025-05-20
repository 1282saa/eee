/**
 * 애플리케이션 초기화 모듈
 * 모든 모듈을 로드하고 애플리케이션을 초기화합니다.
 */

// 문서 로드 완료 시 실행
document.addEventListener("DOMContentLoaded", function () {
  try {
    console.log("경제용 뉴스레터 애플리케이션 초기화 중...");

    // 1면 언박싱 비디오 배너 설정
    setupVideoBanner();

    // 콘텐츠 관리자 초기화
    if (window.ContentManager) {
      window.ContentManager.init();
      console.log("콘텐츠 관리자 초기화 완료");
    } else {
      console.error("콘텐츠 관리자 모듈을 찾을 수 없습니다.");
    }

    // 챗봇 초기화
    if (window.Chatbot) {
      window.Chatbot.init();
      console.log("챗봇 초기화 완료");
    } else {
      console.error("챗봇 모듈을 찾을 수 없습니다.");
    }

    // 푸터 항목 클릭 이벤트 설정
    setupFooterEvents();

    // 전역 검색 창 동작 설정
    setupGlobalSearchEvents();

    console.log("경제용 뉴스레터 애플리케이션 초기화 완료");
  } catch (error) {
    console.error("애플리케이션 초기화 중 오류 발생:", error);
  }
});

/**
 * 푸터 항목 클릭 이벤트 설정
 */
function setupFooterEvents() {
  const footerItems = document.querySelectorAll(".footer-list-item");

  footerItems.forEach((item) => {
    item.addEventListener("click", () => {
      // 제목 추출
      const title = item.querySelector("h3").textContent;

      // 챗봇 탭 활성화
      document.getElementById("tab-chatbot").click();

      // 제목 기반으로 쿼리 생성
      const query = title.replace(/[📈🏦📊]/g, "").trim();

      // 챗봇에 메시지 추가
      window.Chatbot.addMessageToChat("user", query);

      // 챗봇 응답 처리
      setTimeout(() => {
        // 관련 응답 생성
        let response = "";

        if (query.includes("ETF")) {
          response = `ETF(Exchange-Traded Fund)는 주식처럼 거래소에서 거래되는 인덱스 펀드예요! 다양한 자산에 분산 투자할 수 있고, 거래 비용이 낮아 인기가 많습니다. 더 자세한 정보는 경제 용어 섹션에서 확인해보세요!`;
        } else if (query.includes("금리")) {
          response = `금리는 자금 대차에 따른 이자율을 의미해요. 금리가 오르면 예금 이자는 높아지지만, 대출 이자도 높아지고 기업 투자가 위축될 수 있어요. 또한 주식시장에는 부정적인 영향을 미칠 수 있답니다!`;
        } else if (query.includes("주식 투자")) {
          response = `처음 주식 투자를 시작할 때는 기본적인 투자 원칙을 알아두는 것이 중요해요! 분산투자, 장기투자, 가치투자 등의 원칙을 지키고, 무리한 레버리지나 단기매매는 피하는 것이 좋아요. 특히 처음에는 자신이 이해할 수 있는 기업에 투자하는 것이 좋습니다!`;
        } else {
          response = `${query}에 관심이 있으시군요! 이 주제는 최근 많은 투자자들에게 중요한 관심사예요. 궁금한 점이 있으면 구체적으로 질문해 주세요!`;
        }

        window.Chatbot.addMessageToChat("bot", response);
      }, 800);
    });
  });
}

/**
 * 전역 검색 이벤트 설정
 */
function setupGlobalSearchEvents() {
  const globalSearch = document.getElementById("global-search");

  // 포커스 시 스타일 변경
  globalSearch.addEventListener("focus", () => {
    globalSearch.classList.add("ring-2", "ring-orange-500");
  });

  globalSearch.addEventListener("blur", () => {
    globalSearch.classList.remove("ring-2", "ring-orange-500");
  });

  // 모바일 디바이스 검출
  const isMobile = window.innerWidth < 768;

  // 모바일인 경우 검색창 크기 조정
  if (isMobile) {
    globalSearch.setAttribute("placeholder", "검색...");
  }

  // 화면 크기 변경 시 대응
  window.addEventListener("resize", () => {
    const isMobileNow = window.innerWidth < 768;
    if (isMobileNow) {
      globalSearch.setAttribute("placeholder", "검색...");
    } else {
      globalSearch.setAttribute("placeholder", "경제 용어 또는 콘텐츠 검색...");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-button");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const contentGrid = document.getElementById("content-grid");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalCloseButtonTop = document.getElementById("modal-close-button-top");
  const modalCloseButtonBottom = document.getElementById(
    "modal-close-button-bottom"
  );
  const loadingIndicator = document.getElementById("loading-indicator");
  const noResultsMessage = document.getElementById("no-results-message");

  const globalSearchInput = document.getElementById("global-search-input");
  const globalSearchButton = document.getElementById("global-search-button");
  const tabSearchInput = document.getElementById("tab-search-input");
  const tabSearchButton = document.getElementById("tab-search-button");
  const sortSelect = document.getElementById("sort-select");
  const searchResultCount = document.getElementById("search-result-count");
  const resetSearchButton = document.getElementById("reset-search-button");

  // Chatbot elements
  const chatWindow = document.getElementById("chat-window");
  const chatInput = document.getElementById("chat-input");
  const chatSendButton = document.getElementById("chat-send-button");
  const chatbotStatusEl = document.getElementById("chatbot-status");
  const chatbotCitationsEl = document.getElementById("chatbot-citations");

  let currentTab = "chatbot"; // Default tab
  let allContents = { "economy-terms": [], "recent-contents": [] };
  let displayedContents = [];

  // --- 일반 유틸리티 함수 ---
  const showLoading = (tab) => {
    if (tab === "economy-terms" || tab === "recent-contents") {
      if (loadingIndicator) loadingIndicator.classList.remove("hidden");
      if (contentGrid) contentGrid.innerHTML = "";
      if (noResultsMessage) noResultsMessage.classList.add("hidden");
    }
  };

  const hideLoading = (tab) => {
    if (tab === "economy-terms" || tab === "recent-contents") {
      if (loadingIndicator) loadingIndicator.classList.add("hidden");
    }
  };

  // --- 탭 관리 ---
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      activateTab(tabName);
    });
  });

  function activateTab(tabName) {
    currentTab = tabName;
    tabs.forEach((t) => {
      t.classList.remove("active-tab");
      if (t.dataset.tab === tabName) {
        t.classList.add("active-tab");
      }
    });
    tabPanes.forEach((pane) => {
      pane.classList.remove("active-pane");
      pane.classList.add("hidden");
    });

    let activePaneId = "content-display-tab"; // for economy-terms and recent-contents
    if (tabName === "chatbot") {
      activePaneId = "chatbot-tab";
    }

    const activePane = document.getElementById(activePaneId);
    if (activePane) {
      activePane.classList.add("active-pane");
      activePane.classList.remove("hidden");
    }

    // 각 탭으로 전환 시 검색 입력 필드 초기화 및 콘텐츠 로드/갱신
    if (tabSearchInput) tabSearchInput.value = globalSearchInput.value; // 글로벌 검색어 동기화

    if (tabName === "economy-terms" || tabName === "recent-contents") {
      if (!allContents[tabName].length) {
        loadMarkdownList(tabName);
      } else {
        filterAndDisplayContents(
          tabName,
          tabSearchInput ? tabSearchInput.value : ""
        );
      }
    } else if (tabName === "chatbot") {
      checkChatbotStatus();
      // 챗봇 탭으로 올 때 글로벌 검색창의 내용을 챗봇 입력창으로 가져오기 (선택적)
      // if (globalSearchInput.value) chatInput.value = globalSearchInput.value;
    }
    updateSearchResultCount(0); // Or the actual count if search is preserved
    if (resetSearchButton) resetSearchButton.classList.add("hidden");
    if (noResultsMessage) noResultsMessage.classList.add("hidden");
  }

  // --- 마크다운 콘텐츠 로드 및 표시 ---
  async function loadMarkdownList(type) {
    showLoading(type);
    try {
      const response = await fetch(`/api/${type}`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      allContents[type] = data.files.map((fileName) =>
        extractFileInfo(fileName, type)
      );
      filterAndDisplayContents(
        type,
        tabSearchInput ? tabSearchInput.value : ""
      );
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
      if (contentGrid)
        contentGrid.innerHTML = `<p class="text-red-500">콘텐츠 로드 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
      hideLoading(type);
    }
  }

  function extractFileInfo(fileName, type) {
    const nameOnly = fileName.replace(/\.md$/, "");
    let number = Infinity; // 번호가 없는 경우를 위한 기본값 (정렬 시 마지막)
    let title = nameOnly;

    const match = nameOnly.match(/^(\d+)\.\s*(.*)$/);
    if (match) {
      number = parseInt(match[1], 10);
      title = match[2].trim();
    } else {
      // 번호가 없는 파일명도 제목으로 사용 (예: "가나다.md" -> "가나다")
      title = nameOnly;
    }
    return { fileName, title, number, type, summary: "" }; // 요약은 필요 시 생성
  }

  function generateSummary(content, maxLength = 100) {
    const cleanText = content.replace(/\s+/g, " ").trim();
    return cleanText.length > maxLength
      ? cleanText.substring(0, maxLength) + "..."
      : cleanText;
  }

  function renderCards(items) {
    if (!contentGrid) return;
    contentGrid.innerHTML = "";
    if (!items || items.length === 0) {
      if (noResultsMessage) noResultsMessage.classList.remove("hidden");
      updateSearchResultCount(0);
      return;
    }
    if (noResultsMessage) noResultsMessage.classList.add("hidden");

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "content-card transform hover:scale-105 cursor-pointer";
      card.innerHTML = `
                ${
                  item.number !== Infinity
                    ? `<span class="card-number-badge">${item.number}</span>`
                    : ""
                }
                <div class="card-content">
                    <h3 class="card-title truncate" title="${item.title}">${
        item.title
      }</h3>
                    <p class="card-summary"></p> 
                </div>
                <div class="card-footer">
                    <a href="#" data-filename="${item.fileName}" data-type="${
        item.type
      }" class="card-link read-more-link">더 보기 <i class="fas fa-arrow-right ml-1"></i></a>
                </div>
            `;
      contentGrid.appendChild(card);

      // 요약 생성 및 삽입 (비동기 처리)
      fetchMarkdownContent(item.fileName, item.type)
        .then((mdContent) => {
          const summaryText = generateSummary(
            marked.parse(mdContent).replace(/<[^>]+>/g, "")
          ); // HTML 태그 제거 후 요약
          const summaryEl = card.querySelector(".card-summary");
          if (summaryEl) summaryEl.textContent = summaryText;
        })
        .catch((err) =>
          console.error("Error fetching content for summary:", err)
        );
    });
    updateSearchResultCount(items.length);

    document.querySelectorAll(".read-more-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        openModal(link.dataset.filename, link.dataset.type);
      });
    });
  }

  async function fetchMarkdownContent(fileName, type) {
    const response = await fetch(`/api/${type}/${fileName}`);
    if (!response.ok) throw new Error(`Failed to fetch ${fileName}`);
    return await response.text();
  }

  // --- 모달 관리 ---
  async function openModal(fileName, type) {
    if (!modal || !modalTitle || !modalBody) return;
    try {
      const mdContent = await fetchMarkdownContent(fileName, type);
      const fileInfo = extractFileInfo(fileName, type);
      modalTitle.textContent = fileInfo.title;
      modalBody.innerHTML = marked.parse(mdContent);
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden"; // Prevent background scroll
    } catch (error) {
      console.error("Error opening modal:", error);
      modalBody.innerHTML = `<p class="text-red-500">콘텐츠를 불러오는 데 실패했습니다: ${error.message}</p>`;
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
  }

  if (modalCloseButtonTop)
    modalCloseButtonTop.addEventListener("click", closeModal);
  if (modalCloseButtonBottom)
    modalCloseButtonBottom.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      // Close on backdrop click
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    // Close on ESC key
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  // --- 검색 및 정렬 ---
  function filterAndDisplayContents(type, searchTerm = "") {
    if (!allContents[type]) return;
    const lowerSearchTerm = searchTerm.toLowerCase();
    displayedContents = allContents[type].filter(
      (item) =>
        item.title.toLowerCase().includes(lowerSearchTerm) ||
        (item.number !== Infinity &&
          String(item.number).includes(lowerSearchTerm))
    );
    sortContents(sortSelect ? sortSelect.value : "number-asc"); // 현재 정렬 기준 적용
    // renderCards는 sortContents 내부에서 호출됨
    if (resetSearchButton) {
      resetSearchButton.classList.toggle("hidden", !searchTerm);
    }
  }

  function sortContents(criteria) {
    const [sortBy, sortOrder] = criteria.split("-");
    displayedContents.sort((a, b) => {
      let valA, valB;
      if (sortBy === "title") {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else {
        // number
        valA = a.number;
        valB = b.number;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    renderCards(displayedContents);
  }

  if (sortSelect)
    sortSelect.addEventListener("change", (e) => sortContents(e.target.value));

  function handleSearch(inputElement) {
    const searchTerm = inputElement.value;
    if (currentTab === "economy-terms" || currentTab === "recent-contents") {
      filterAndDisplayContents(currentTab, searchTerm);
    } else if (currentTab === "chatbot") {
      // 챗봇 탭에서는 이 검색창이 직접 검색을 수행하지 않음.
      // 필요하다면 chatInput.value = searchTerm; 후 chatSendButton.click(); 등을 호출
    }
  }

  if (tabSearchInput && tabSearchButton) {
    tabSearchButton.addEventListener("click", () =>
      handleSearch(tabSearchInput)
    );
    tabSearchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") handleSearch(tabSearchInput);
    });
  }

  if (globalSearchInput && globalSearchButton) {
    globalSearchButton.addEventListener("click", () => {
      const searchTerm = globalSearchInput.value;
      if (currentTab === "chatbot") {
        chatInput.value = searchTerm;
        chatSendButton.click();
      } else {
        if (tabSearchInput) tabSearchInput.value = searchTerm;
        handleSearch(tabSearchInput || globalSearchInput);
      }
    });
    globalSearchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        globalSearchButton.click();
      }
    });
  }

  if (resetSearchButton) {
    resetSearchButton.addEventListener("click", () => {
      if (tabSearchInput) tabSearchInput.value = "";
      // globalSearchInput.value = ''; // 글로벌 검색창도 초기화할지 여부 결정
      filterAndDisplayContents(currentTab, "");
      resetSearchButton.classList.add("hidden");
    });
  }

  function updateSearchResultCount(count) {
    if (searchResultCount)
      searchResultCount.textContent = `검색 결과: ${count}개`;
  }

  // --- 챗봇 관련 기능 ---
  async function checkChatbotStatus() {
    if (!chatbotStatusEl) return;
    try {
      const response = await fetch("/api/chatbot/status");
      const data = await response.json();
      let statusText = "챗봇 상태: ";
      let statusClass = "text-gray-500 bg-gray-100";

      if (data.initializing) {
        statusText +=
          '초기화 중... <i class="fas fa-spinner fa-spin ml-1"></i>';
        statusClass = "text-blue-500 bg-blue-50";
        setTimeout(checkChatbotStatus, 3000); // 주기적 확인
      } else if (data.ready) {
        statusText +=
          '온라인 <i class="fas fa-check-circle text-green-500 ml-1"></i>';
        statusClass = "text-green-700 bg-green-50";
        if (data.documents_loaded !== undefined) {
          statusText += ` (문서 ${data.documents_loaded}개 로드됨)`;
        }
      } else {
        statusText +=
          '오프라인 <i class="fas fa-times-circle text-red-500 ml-1"></i>';
        statusClass = "text-red-700 bg-red-50";
        if (!data.openai_connected) {
          statusText += " (OpenAI API 키 문제)";
        } else {
          statusText += " (초기화 필요)";
        }
        // Add initialize button if needed
        if (!document.getElementById("init-chatbot-btn")) {
          const initButton = document.createElement("button");
          initButton.id = "init-chatbot-btn";
          initButton.innerHTML =
            '<i class="fas fa-redo mr-1"></i> 챗봇 초기화 시도';
          initButton.className =
            "ml-2 px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors";
          initButton.onclick = initializeChatbot;
          chatbotStatusEl.appendChild(initButton);
        }
      }
      chatbotStatusEl.innerHTML = statusText;
      chatbotStatusEl.className = `mb-4 p-3 rounded-lg text-sm ${statusClass}`;
    } catch (error) {
      console.error("Error fetching chatbot status:", error);
      chatbotStatusEl.textContent = "챗봇 상태를 확인할 수 없습니다.";
      chatbotStatusEl.className =
        "mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50";
    }
  }

  async function initializeChatbot() {
    if (!chatbotStatusEl) return;
    chatbotStatusEl.innerHTML =
      '챗봇 초기화 시작 중... <i class="fas fa-spinner fa-spin ml-1"></i>';
    chatbotStatusEl.className =
      "mb-4 p-3 rounded-lg text-sm text-blue-500 bg-blue-50";
    try {
      const response = await fetch("/api/chatbot/initialize", {
        method: "POST",
      });
      const data = await response.json();
      if (data.status === "initializing" || data.status === "success") {
        setTimeout(checkChatbotStatus, 2000); // 상태 업데이트 기다림
      } else {
        chatbotStatusEl.innerHTML = `초기화 실패: ${
          data.message || "알 수 없는 오류"
        }`;
        chatbotStatusEl.className =
          "mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50";
      }
      const initBtn = document.getElementById("init-chatbot-btn");
      if (initBtn) initBtn.remove();
    } catch (error) {
      console.error("Error initializing chatbot:", error);
      chatbotStatusEl.innerHTML = "챗봇 초기화 중 오류 발생.";
      chatbotStatusEl.className =
        "mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50";
    }
  }

  async function sendChatMessage() {
    const query = chatInput.value.trim();
    if (!query) return;

    appendMessage(query, "user");
    chatInput.value = "";
    chatInput.disabled = true;
    chatSendButton.disabled = true;
    appendMessage(
      '<i class="fas fa-spinner fa-spin"></i> 경제용이 답변을 생각하고 있어용...',
      "bot",
      true
    ); // isTyping = true

    try {
      // <<< 여기가 핵심 수정: /api/chatbot/query 사용 >>>
      const response = await fetch("/api/chatbot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const result = await response.json();

      removeTypingIndicator();
      if (result.status === "success") {
        appendMessage(result.answer, "bot");
        displayCitations(result.citations);
      } else {
        appendMessage(
          `오류: ${result.message || "답변을 가져오지 못했습니다."}`,
          "bot"
        );
        chatbotCitationsEl.innerHTML = "";
      }
    } catch (error) {
      console.error("Chat API error:", error);
      removeTypingIndicator();
      appendMessage(`채팅 중 오류 발생: ${error.message}`, "bot");
      chatbotCitationsEl.innerHTML = "";
    } finally {
      chatInput.disabled = false;
      chatSendButton.disabled = false;
      chatInput.focus();
    }
  }

  function appendMessage(text, sender, isTyping = false) {
    const messageContainer = document.createElement("div");
    messageContainer.classList.add("message-container", `${sender}-message`);
    if (isTyping) messageContainer.id = "typing-indicator";

    const senderName = sender === "user" ? "나" : "경제용";
    const senderEl = document.createElement("div");
    senderEl.classList.add("message-sender");
    senderEl.textContent = senderName;

    const messageBubble = document.createElement("div");
    messageBubble.classList.add("message-bubble");

    // marked.parse를 여기서 직접 사용
    messageBubble.innerHTML = marked.parse(
      text.replace(
        /\[(\d+)\]/g,
        '<span class="citation" data-citation-id="$1">[$1]</span>'
      )
    );

    messageContainer.appendChild(senderEl);
    messageContainer.appendChild(messageBubble);
    chatWindow.appendChild(messageContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function removeTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) typingIndicator.remove();
  }

  function displayCitations(citations) {
    if (!chatbotCitationsEl || !citations || citations.length === 0) {
      if (chatbotCitationsEl) chatbotCitationsEl.innerHTML = "";
      return;
    }
    let html =
      '<h4 class="font-semibold text-sm mb-1">출처 정보:</h4><ul class="list-none p-0">';
    citations.forEach((cite) => {
      let contentPreview = cite.content
        ? cite.content.substring(0, 100) + "..."
        : "내용 미리보기 없음";
      let link = "#";
      if (cite.type === "internal" && cite.file_name) {
        link = `/view/${cite.source_type}/${cite.file_name}`;
        html += `<li class="mb-1 p-2 bg-gray-50 rounded text-xs">
                           <strong class="block">[${cite.number}] ${cite.title} (내부문서)</strong>
                           <p class="text-gray-600 my-1">${contentPreview}</p>
                           <a href="${link}" target="_blank" class="text-indigo-600 hover:underline">문서 보기</a>
                       </li>`;
      } else if (
        cite.type === "web" &&
        cite.web_citations &&
        cite.web_citations.length > 0
      ) {
        const webCite = cite.web_citations[0]; // 첫 번째 웹 출처만 우선 표시
        link = webCite.url || "#";
        html += `<li class="mb-1 p-2 bg-gray-50 rounded text-xs">
                           <strong class="block">[${cite.number}] ${
          cite.title || webCite.title
        } (웹 검색)</strong>
                           <p class="text-gray-600 my-1">${contentPreview}</p>
                           <a href="${link}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline">출처 링크 보기</a>
                       </li>`;
      } else {
        html += `<li class="mb-1 p-2 bg-gray-50 rounded text-xs">
                           <strong class="block">[${cite.number}] ${cite.title}</strong>
                           <p class="text-gray-600 my-1">${contentPreview}</p>
                       </li>`;
      }
    });
    html += "</ul>";
    chatbotCitationsEl.innerHTML = html;
  }

  // Event listener for dynamically added citations in chat messages
  chatWindow.addEventListener("click", function (event) {
    if (event.target.classList.contains("citation")) {
      const citationId = event.target.dataset.citationId;
      const citationDetailEl = chatbotCitationsEl
        .querySelector(`li strong:contains('[${citationId}]')`)
        ?.closest("li");
      if (citationDetailEl) {
        citationDetailEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        citationDetailEl.classList.add("ring-2", "ring-indigo-300");
        setTimeout(() => {
          citationDetailEl.classList.remove("ring-2", "ring-indigo-300");
        }, 2500);
      }
    }
  });

  if (chatSendButton) chatSendButton.addEventListener("click", sendChatMessage);
  if (chatInput)
    chatInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });

  // --- 초기화 ---
  activateTab("chatbot"); // 초기 활성 탭 설정
});

// jQuery :contains selector in vanilla JS (for citation click)
function contains(selector, text) {
  var elements = document.querySelectorAll(selector);
  return Array.prototype.filter.call(elements, function (element) {
    return RegExp(text).test(element.textContent);
  });
}

/**
 * 1면 언박싱 비디오 배너 설정
 */
function setupVideoBanner() {
  const videoBanner = document.getElementById('video-banner');
  
  if (!videoBanner) return;
  
  videoBanner.addEventListener('click', handleUnboxingVideo);
}

async function handleUnboxingVideo() {
    console.log('서울경제 1면 언박싱 버튼 클릭됨');
    
    // 로딩 모달 생성
    createLoadingModal();
    
    try {
        const response = await fetch('/api/get-unboxing-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.url) {
            console.log('언박싱 비디오 URL:', data.url);
            // 새 창에서 열기
            window.open(data.url, '_blank');
        } else {
            alert('영상을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('오류 발생:', error);
        alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        // 로딩 모달 제거
        removeLoadingModal();
    }
}

function createLoadingModal() {
    // 기존 모달이 있다면 제거
    removeLoadingModal();
    
    // 모달 컨테이너 생성
    const modalContainer = document.createElement('div');
    modalContainer.id = 'loading-modal';
    modalContainer.className = 'loading-modal';
    
    // 경제용 캐릭터 메시지들
    const messages = [
        '경제용이가 영상을 찾고 있어요! 🐳',
        '잠깐만 기다려주세요~ 곧 영상이 열려요! 🎬',
        '서울경제 1면의 비밀을 언박싱 중... 📦',
        '경제용이가 열심히 준비 중이에요! 💪',
        '곧 만나요! 조금만 기다려주세요~ ✨'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    modalContainer.innerHTML = `
        <div class="loading-content">
            <img src="/static/경제용.png" alt="경제용" class="loading-character">
            <div class="loading-message">${randomMessage}</div>
            <div class="loading-spinner"></div>
        </div>
    `;
    
    document.body.appendChild(modalContainer);
}

function removeLoadingModal() {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        modal.remove();
    }
}

// 비디오 모달 관련 코드 제거됨 - 더 이상 필요없음

