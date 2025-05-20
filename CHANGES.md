# 변경 사항 요약 (Changelist)

## 코드 정리 및 개선
1. **불필요한 모듈 임포트 제거**
   - `server.py`에서 사용하지 않는 `mimetypes` 모듈 제거
   - `unified_chatbot.py`에서 사용하지 않는 `asyncio`, `concurrent.futures`, `markdown`, `BeautifulSoup` 모듈 제거
   - 중복 임포트 제거

2. **레거시 엔드포인트 제거**
   - 사용하지 않는 레거시 API 엔드포인트 (/api/ai-search) 제거
   - 레거시 경로 핸들러 (/js, /css) 제거 및 /static으로 통합

3. **자바스크립트 코드 정리**
   - 사용하지 않는 함수 제거 (addTypingIndicator, removeTypingIndicator, addRelatedDocsToChat, addSourcesToChat)
   - 코드 주석 개선 및 설명 추가

4. **폴더 구조 정리**
   - 오래된 배포 파일 제거 (deployment.yaml, service.yaml)
   - 사용하지 않는 인증서 파일 제거 (cert/cluster-issuer.yaml)
   - k8s 디렉토리로 쿠버네티스 관련 파일 통합

## Cloud Run 호환성 개선
1. **스토리지 경로 개선**
   - Cloud Run의 읽기 전용 파일시스템에 대응하기 위해 /tmp 디렉토리 사용
   - 환경에 따른 동적 경로 설정 (ENVIRONMENT=cloud_run 감지)
   - 로그 및 데이터 디렉토리 경로를 환경에 따라 자동 설정

2. **환경 변수 처리 개선**
   - .env 파일이 있을 때만 load_dotenv() 호출
   - .env 없이도 환경 변수 설정 가능하도록 개선
   - 개발 모드용 테스트 API 키 지원 추가

3. **Dockerfile 개선**
   - Cloud Run 환경에 최적화된 설정 추가
   - /tmp 디렉토리 구조 미리 생성
   - 환경 변수 기본값 설정

## 새로운 문서 및 스크립트
1. **새로운 배포 문서**
   - CLOUD_RUN_DEPLOYMENT.md: Cloud Run 배포 가이드 추가
   - .env.example: 환경 변수 예제 파일 업데이트
   - k8s/k8s-secret.yaml.example: 쿠버네티스 시크릿 예제 파일 추가

2. **새로운 스크립트**
   - scripts/deploy_to_cloudrun.sh: Cloud Run 배포 자동화 스크립트
   - scripts/test_chatbot.py: 로컬 챗봇 테스트 스크립트

3. **문서 업데이트**
   - README.md: 배포 및 개발 관련 정보 업데이트
   - DEPLOYMENT_CHECKLIST.md: 체크리스트 항목 업데이트

## 버그 수정
1. **환경 감지 개선**
   - Cloud Run 환경 자동 감지 및 최적화
   - 테스트 API 키 감지 기능 추가

2. **에러 처리 개선**
   - Perplexity API 호출 시 재시도 로직 추가
   - API 키 관련 오류 메시지 개선
   - 데이터 경로 예외 처리 강화

## 보안 개선
1. **.gitignore 강화**
   - __pycache__/ 추가
   - 쿠버네티스 시크릿 파일 추가
   - 로그 및 임시 파일 추가

2. **시크릿 관리 개선**
   - k8s-secret.yaml.example 파일 추가
   - 환경 변수 설정 가이드 개선
   - Secret Manager 지원 문서화