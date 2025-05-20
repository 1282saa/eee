#!/usr/bin/env python
"""
테스트 스크립트: 경제용 챗봇 기능 테스트
환경 변수 설정 및 개발 모드에서 API 호출이 올바르게 작동하는지 확인합니다.
"""

import requests
import json
import os
import time
import sys
from pathlib import Path

# 프로젝트 루트 디렉토리
ROOT_DIR = Path(os.path.dirname(os.path.abspath(__file__))).parent
os.chdir(ROOT_DIR)

# 서버 URL 설정
BASE_URL = "http://localhost:8080"

def test_health_check():
    """헬스체크 API 테스트"""
    print("\n🔍 헬스체크 API 테스트 중...")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ 헬스체크 성공!")
            return True
        else:
            print(f"❌ 헬스체크 실패: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return False

def test_environment_vars():
    """환경 변수 확인 API 테스트"""
    print("\n🔍 환경 변수 확인 API 테스트 중...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/env/check")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 환경 변수 확인 성공!")
            print(f"   OpenAI API 키: {'설정됨' if data.get('openai_api_key') else '설정되지 않음'}")
            print(f"   Perplexity API 키: {'설정됨' if data.get('perplexity_api_key') else '설정되지 않음'}")
            
            if data.get('missing_keys'):
                print(f"⚠️ 누락된 API 키: {', '.join(data.get('missing_keys'))}")
                return False
            return True
        else:
            print(f"❌ 환경 변수 확인 실패: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return False

def test_chatbot_initialize():
    """챗봇 초기화 API 테스트"""
    print("\n🔍 챗봇 초기화 API 테스트 중...")
    
    try:
        response = requests.post(f"{BASE_URL}/api/chatbot/initialize")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 챗봇 초기화 요청 성공: {data.get('message')}")
            return True
        else:
            print(f"❌ 챗봇 초기화 요청 실패: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        return False

def test_chatbot_status():
    """챗봇 상태 확인 API 테스트"""
    print("\n🔍 챗봇 상태 확인 API 테스트 중...")
    max_retries = 10
    
    for i in range(max_retries):
        try:
            response = requests.get(f"{BASE_URL}/api/chatbot/status")
            if response.status_code == 200:
                data = response.json()
                if data.get('ready'):
                    print(f"✅ 챗봇 준비 완료!")
                    print(f"   초기화 상태: {data}")
                    return True
                else:
                    print(f"⏳ 챗봇 초기화 중... ({i+1}/{max_retries})")
                    if i < max_retries - 1:
                        time.sleep(3)  # 3초 간격으로 재시도
            else:
                print(f"❌ 챗봇 상태 확인 실패: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 오류 발생: {str(e)}")
            return False
    
    print("❌ 챗봇 초기화 시간 초과")
    return False

def test_chatbot_query():
    """챗봇 질의 API 테스트"""
    print("\n🔍 챗봇 질의 API 테스트 중...")
    
    test_questions = [
        "경제성장률이란 무엇인가요?",
        "최근 한국의 경제 상황은 어떤가요?",
        "인플레이션이 무엇인지 설명해주세요."
    ]
    
    success_count = 0
    
    for question in test_questions:
        try:
            print(f"\n📝 질문: '{question}'")
            
            response = requests.post(
                f"{BASE_URL}/api/chatbot/query",
                json={"query": question}
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 응답 성공!")
                answer = data.get('answer', '')
                print(f"📣 답변 (일부): {answer[:150]}..." if len(answer) > 150 else f"📣 답변: {answer}")
                
                if 'citations' in data:
                    print(f"📚 인용 수: {len(data['citations'])}")
                
                success_count += 1
            else:
                print(f"❌ 질의 실패: {response.status_code}")
                print(response.text)
        except Exception as e:
            print(f"❌ 오류 발생: {str(e)}")
    
    success_rate = (success_count / len(test_questions)) * 100
    print(f"\n📊 성공률: {success_rate:.2f}% ({success_count}/{len(test_questions)})")
    
    return success_count > 0

def main():
    """메인 테스트 함수"""
    print("=" * 60)
    print("🤖 경제용 챗봇 테스트 스크립트")
    print("=" * 60)
    
    # 서버 동작 확인
    if not test_health_check():
        print("\n❌ 서버가 실행 중이지 않습니다. 다음 명령어로 서버를 실행하세요:")
        print("   python server.py")
        return False
    
    # 환경 변수 확인
    if not test_environment_vars():
        print("\n⚠️ 환경 변수가 올바르게 설정되지 않았습니다.")
        print("   .env 파일을 확인하거나 개발 모드를 활성화하세요.")
    
    # 챗봇 초기화
    if not test_chatbot_initialize():
        print("\n❌ 챗봇 초기화에 실패했습니다.")
        return False
    
    # 챗봇 상태 확인
    if not test_chatbot_status():
        print("\n❌ 챗봇이 준비되지 않았습니다.")
        return False
    
    # 챗봇 질의 테스트
    if not test_chatbot_query():
        print("\n❌ 챗봇 질의 테스트에 실패했습니다.")
        return False
    
    print("\n" + "=" * 60)
    print("✅ 모든 테스트가 성공적으로 완료되었습니다!")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)