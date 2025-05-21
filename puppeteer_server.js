const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
const PORT = 3001; // Flask 서버에서 호출하는 포트와 일치해야 합니다.

// 미들웨어 설정
app.use(express.json());
app.use(cors());

// 브라우저 재사용 (싱글톤 패턴)
let browser = null;

// 브라우저 초기화 함수
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false, // ★ 디버깅 중이므로 false 유지. 배포 시 true로 변경 권장
      defaultViewport: null,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
    console.log("Puppeteer 브라우저 인스턴스 시작됨.");
  }
  return browser;
}

// 1면 언박싱 비디오 가져오기 엔드포인트
app.post("/api/get-unboxing-video", async (req, res) => {
  console.log("언박싱 비디오 요청 받음");

  const { url: requestedUrl, xpath: requestedXpath } = req.body; // 요청에서 URL과 XPath를 받습니다.

  if (!requestedUrl) {
    console.error("요청에 URL이 포함되어 있지 않습니다.");
    return res.status(400).json({ success: false, error: "URL is required." });
  }

  // XPath가 제공되지 않았다면 이전 성공 코드의 XPath를 기본값으로 사용합니다.
  if (!requestedXpath) {
    console.warn(
      "요청에 XPath가 포함되어 있지 않습니다. 기본 XPath를 사용합니다."
    );
    // 이전 성공 코드의 정확한 XPath를 기본값으로 설정
    requestedXpath =
      "/html/body/div[1]/div[3]/div[2]/div/div[3]/div/div[1]/ul/li[1]/a";
  }

  let page;
  try {
    const browserInstance = await initBrowser();
    page = await browserInstance.newPage();

    // 불필요한 리소스 차단으로 로딩 속도 개선
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (["image", "font", "stylesheet"].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    console.log("불필요한 리소스 차단 설정 완료.");

    // 플레이리스트 페이지로 이동
    console.log(`페이지로 이동: ${requestedUrl}`);
    await page.goto(requestedUrl, {
      waitUntil: "networkidle2", // 네트워크 활동이 줄어들 때까지 대기
      timeout: 30000, // 페이지 로드 30초 타임아웃
    });

    // 로딩 오버레이가 존재하면 사라질 때까지 기다립니다.
    const loadingOverlaySelector = "#loadingOverlay";
    try {
      await page.waitForSelector(loadingOverlaySelector, {
        state: "hidden", // hidden 상태를 기다림
        timeout: 10000, // 10초 내에 사라지길 기다림
      });
      console.log("로딩 오버레이가 사라졌습니다.");
    } catch (e) {
      console.warn(
        "로딩 오버레이가 10초 내에 사라지지 않거나 존재하지 않습니다. 계속 진행합니다."
      );
    }

    let finalVideoUrl = null;
    let successStatus = false;

    try {
      // ★★★ XPath로 '전체재생' 버튼 (<a> 태그)을 찾고 href 속성 직접 가져오기 (이전 성공 방식) ★★★
      console.log(`XPath '${requestedXpath}'로 요소 찾는 중...`);
      // waitForXPath는 요소가 보일 때까지 대기합니다.
      const elements = await page.waitForXPath(requestedXpath, {
        visible: true, // 요소가 보여야 함
        timeout: 15000, // 15초 대기
      });

      const playAllButtonElement = Array.isArray(elements)
        ? elements[0]
        : elements; // puppeteer 버전에 따라 반환 형태 다를 수 있음

      if (playAllButtonElement) {
        // 요소의 href 속성 값을 가져옵니다.
        const href = await page.evaluate((el) => el.href, playAllButtonElement);

        if (href && href.includes("tv.naver.com/v/")) {
          // 실제 비디오 URL 패턴 포함하는지 확인
          // 자동재생 파라미터 추가
          finalVideoUrl = href.includes("?")
            ? `${href}&autoPlay=true`
            : `${href}?autoPlay=true`;
          console.log(`비디오 링크 href 직접 획득: ${finalVideoUrl}`);
          successStatus = true;
        } else {
          console.warn(
            "찾은 요소에서 유효한 비디오 링크 (href)를 찾을 수 없습니다:",
            href
          );
          finalVideoUrl = requestedUrl; // 유효하지 않으면 요청된 URL 반환
          successStatus = false;
        }
      } else {
        console.warn("XPath에 해당하는 요소를 찾을 수 없습니다.");
        finalVideoUrl = requestedUrl; // 찾지 못하면 요청된 URL 반환
        successStatus = false;
      }
    } catch (error) {
      console.error(
        `XPath 요소 찾기 또는 href 추출 중 오류 발생: ${error.message}`
      );
      finalVideoUrl = requestedUrl; // 오류 발생 시 요청된 URL 반환
      successStatus = false;
    } finally {
      await page.close(); // 사용한 페이지 탭 닫기
      console.log("페이지 닫힘.");
    }

    res.json({
      success: successStatus,
      url: finalVideoUrl,
      video_url: finalVideoUrl,
      autoplay: successStatus, // 비디오 URL 획득 성공 시에만 자동재생
    });
  } catch (error) {
    console.error("Puppeteer 처리 중 치명적인 오류 발생:", error);
    if (page) {
      // 오류 발생 시에도 페이지가 열려있다면 닫아줍니다.
      await page
        .close()
        .catch((e) => console.error("오류 발생 중 페이지 닫기 실패:", e));
    }
    res.status(500).json({
      success: false,
      error: error.message,
      url: "https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727",
      video_url:
        "https://tv.naver.com/sed.thumb?tab=playlist&playlistNo=972727",
      autoplay: false,
    });
  }
});

// 브라우저 종료 엔드포인트 (개발용)
app.post("/api/close-browser", async (req, res) => {
  if (browser) {
    await browser.close();
    browser = null;
    console.log("Puppeteer 브라우저 인스턴스 종료됨.");
  }
  res.json({ success: true, message: "Browser closed." });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Puppeteer 서버가 포트 ${PORT}에서 실행 중입니다.`);
});

// 프로세스 종료 시 브라우저 정리 (CTRL+C 등)
process.on("SIGINT", async () => {
  if (browser) {
    await browser.close();
    console.log("Puppeteer 브라우저 SIGINT로 종료됨.");
  }
  process.exit();
});

// 예기치 않은 오류 발생 시 브라우저 정리
process.on("unhandledRejection", async (reason, promise) => {
  console.error("처리되지 않은 Promise Rejection:", reason);
  if (browser) {
    await browser.close();
    console.log("Puppeteer 브라우저 unhandledRejection으로 종료됨.");
  }
  process.exit(1);
});

process.on("uncaughtException", async (err) => {
  console.error("잡히지 않은 예외:", err);
  if (browser) {
    await browser.close();
    console.log("Puppeteer 브라우저 uncaughtException으로 종료됨.");
  }
  process.exit(1);
});
