# 베이스 이미지로 Python 3.11 slim 사용
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 빌드 도구 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    cmake \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 파일 복사
COPY requirements.txt .

# pip 업그레이드 및 의존성 설치
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 파일 복사
COPY . .

# 데이터 디렉토리 생성 (Cloud Run에서는 /tmp를 사용)
RUN mkdir -p data/economy_terms data/recent_contents_final logs
RUN mkdir -p /tmp/data/economy_terms /tmp/data/recent_contents_final /tmp/logs

# 환경 변수 설정
ENV ENVIRONMENT=cloud_run
ENV PUPPETEER_ENABLED=FALSE
ENV OPENAI_API_KEY=""
ENV PERPLEXITY_API_KEY=""

ENV PORT=8080

# 애플리케이션 실행
CMD exec gunicorn server:app --bind 0.0.0.0:$PORT --workers 4 --log-level info