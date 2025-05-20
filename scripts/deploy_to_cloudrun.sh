#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# GCP 프로젝트 정보 (실제 정보로 수정 필요)
PROJECT_ID="your-project-id"
REGION="asia-northeast3"
SERVICE_NAME="sedaily-chatbot"
IMAGE_NAME="sedaily-chatbot"
VERSION="1.0"

# 스크립트 디렉토리로부터 프로젝트 루트로 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}경제용 챗봇 Cloud Run 배포 스크립트${NC}"
echo "======================================="

# API 키 확인
if [ -z "$OPENAI_API_KEY" ] || [ -z "$PERPLEXITY_API_KEY" ]; then
    echo -e "${RED}오류: API 키가 설정되지 않았습니다.${NC}"
    echo "다음 환경 변수를 설정하세요:"
    echo "OPENAI_API_KEY=sk-..."
    echo "PERPLEXITY_API_KEY=pplx-..."
    echo "예시: export OPENAI_API_KEY=sk-..."
    exit 1
fi

# 1. Docker 이미지 빌드
echo -e "\n${GREEN}1. Docker 이미지 빌드 중...${NC}"
docker build -t ${IMAGE_NAME}:${VERSION} .

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker 빌드 실패!${NC}"
    exit 1
fi

# 2. 이미지 태깅
echo -e "\n${GREEN}2. 이미지 태깅 중...${NC}"
docker tag ${IMAGE_NAME}:${VERSION} gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${VERSION}

# 3. GCP 인증
echo -e "\n${GREEN}3. GCP 인증 중...${NC}"
gcloud auth configure-docker

# 4. 이미지 푸시
echo -e "\n${GREEN}4. 이미지 푸시 중...${NC}"
docker push gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${VERSION}

if [ $? -ne 0 ]; then
    echo -e "${RED}이미지 푸시 실패!${NC}"
    exit 1
fi

# 5. Cloud Run 배포
echo -e "\n${GREEN}5. Cloud Run 배포 중...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${VERSION} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars "OPENAI_API_KEY=${OPENAI_API_KEY},PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY},ENVIRONMENT=cloud_run,PUPPETEER_ENABLED=FALSE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Cloud Run 배포 실패!${NC}"
    exit 1
fi

# 6. 배포 상태 확인
echo -e "\n${GREEN}6. 배포 URL:${NC}"
gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format='value(status.url)'

echo -e "\n${GREEN}배포 완료!${NC}"
echo "Cloud Run 서비스를 확인하려면: https://console.cloud.google.com/run"