# Cloud Run 배포 가이드

## 개요
이 문서는 서울경제 경제용 챗봇을 Google Cloud Run에 배포하기 위한 방법을 설명합니다.

## 사전 준비사항

1. Google Cloud 계정 및 프로젝트 설정
2. Google Cloud CLI 설치 및 로그인
3. Docker 설치
4. 필요한 API 키 (OpenAI, Perplexity)

## 환경 변수 설정

Cloud Run은 `.env` 파일을 직접 지원하지 않습니다. 대신 다음과 같이 환경 변수를 설정해야 합니다:

```bash
# 배포 시 필요한 환경 변수 목록
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
ENVIRONMENT=cloud_run
PUPPETEER_ENABLED=FALSE
PORT=8080
```

## 배포 단계

### 1. 코드 빌드 및 컨테이너 이미지 생성

```bash
# 프로젝트 루트 디렉토리에서 실행
docker build -t gcr.io/[YOUR_PROJECT_ID]/sedaily-chatbot:latest .
```

### 2. 이미지를 Google Container Registry에 푸시

```bash
# 인증 (처음 한 번만)
gcloud auth configure-docker

# 이미지 푸시
docker push gcr.io/[YOUR_PROJECT_ID]/sedaily-chatbot:latest
```

### 3. Cloud Run 서비스 배포

```bash
gcloud run deploy sedaily-chatbot \
  --image gcr.io/[YOUR_PROJECT_ID]/sedaily-chatbot:latest \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "OPENAI_API_KEY=sk-...,PERPLEXITY_API_KEY=pplx-...,ENVIRONMENT=cloud_run,PUPPETEER_ENABLED=FALSE"
```

> **참고**: 위 명령에서 실제 API 키로 교체하세요. 또는 Secret Manager를 사용하여 API 키를 더 안전하게 관리할 수 있습니다.

### 4. Secret Manager를 사용한 환경 변수 설정 (권장)

```bash
# Secret 생성
echo -n "sk-your-openai-key" | gcloud secrets create openai-api-key --data-file=-
echo -n "pplx-your-perplexity-key" | gcloud secrets create perplexity-api-key --data-file=-

# 서비스 계정에 Secret 접근 권한 부여
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:your-service-account@your-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
  
gcloud secrets add-iam-policy-binding perplexity-api-key \
  --member="serviceAccount:your-service-account@your-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Secret 참조를 사용한 배포
gcloud run deploy sedaily-chatbot \
  --image gcr.io/[YOUR_PROJECT_ID]/sedaily-chatbot:latest \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,PERPLEXITY_API_KEY=perplexity-api-key:latest" \
  --set-env-vars "ENVIRONMENT=cloud_run,PUPPETEER_ENABLED=FALSE"
```

## Cloud Run 특이사항 해결

Cloud Run에서 실행될 때 다음과 같은 특이사항이 코드에 적용되었습니다:

1. **임시 디렉토리 사용**:
   - Cloud Run에서는 `/tmp` 디렉토리만 쓰기 가능합니다.
   - 애플리케이션은 `ENVIRONMENT=cloud_run`일 경우 자동으로 `/tmp/data`와 `/tmp/logs` 경로를 사용합니다.

2. **환경 변수 처리**:
   - `.env` 파일 대신 Cloud Run 환경 변수 설정을 사용합니다.
   - `dotenv` 로드는 `.env` 파일이 있는 경우에만 실행됩니다.

3. **컨테이너 최적화**:
   - 4개의 gunicorn 워커를 사용하도록 설정했습니다.
   - 메모리와 CPU 설정을 최적화했습니다.

4. **파일 디렉토리 구조**:
   - `/tmp/data/economy_terms`: 경제 용어 파일 위치
   - `/tmp/data/recent_contents_final`: 최신 콘텐츠 파일 위치
   - `/tmp/logs`: 로그 파일 위치

## 모니터링 및 로그

Cloud Run 서비스 로그는 Google Cloud Console에서 확인할 수 있습니다:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sedaily-chatbot" --limit=10
```

## 배포 확인

배포가 성공적으로 완료되면 다음 엔드포인트를 통해 서비스를 확인할 수 있습니다:

- 메인 페이지: `https://sedaily-chatbot-[hash].run.app/`
- 헬스 체크: `https://sedaily-chatbot-[hash].run.app/health`
- 챗봇 상태 확인: `https://sedaily-chatbot-[hash].run.app/api/chatbot/status`

## 문제 해결

1. **메모리 부족 오류**
   - Cloud Run 서비스의 메모리 할당량을 늘립니다 (권장: 최소 2GB)

2. **콜드 스타트 문제**
   - 최소 인스턴스를 1로 설정하여 항상 하나의 인스턴스가 준비 상태로 유지되도록 합니다.

3. **타임아웃 오류**
   - Cloud Run의 기본 타임아웃은 60초입니다. 필요한 경우 이 시간을 늘릴 수 있습니다:
   ```bash
   gcloud run services update sedaily-chatbot --timeout=300s
   ```

4. **API 키 문제**
   - Cloud Run 콘솔에서 환경 변수가 올바르게 설정되었는지 확인합니다.
   - Secret Manager의 비밀 접근 권한이 올바르게 구성되었는지 확인합니다.