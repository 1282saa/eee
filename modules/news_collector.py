import os
import requests
from dotenv import load_dotenv
import psycopg2
from datetime import datetime, timedelta
import json # json 모듈 추가
from pprint import pprint # 디버깅용

# .env 파일 로드 (루트 디렉토리에서)
load_dotenv()

API_KEY = os.getenv("BIGKINDS_KEY")
URL = "https://tools.kinds.or.kr/search/news"

# 데이터베이스 환경 변수
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

def get_latest_economic_news(date_from: str, date_until: str, return_size: int = 1000) -> list:
    """
    지정된 기간의 경제 뉴스 데이터를 Bigkinds API에서 가져옵니다.
    :param date_from: 시작 날짜 (YYYY-MM-DD)
    :param date_until: 종료 날짜 (YYYY-MM-DD)
    :param return_size: 한 번에 가져올 최대 뉴스 수
    :return: 뉴스 문서 리스트
    """
    try:
        arg = {
            "query": "",
            "published_at": {"from": date_from, "until": date_until},
            "category": ["002000000"],  # 경제 카테고리
            "sort": {"date": "desc"},
            "return_size": return_size,
            "fields": ["doc_id", "title", "published_at", "provider", "category", "content", "url"]
        }
        payload = {"access_key": API_KEY, "argument": arg}

        print(f"Bigkinds API 요청: {date_from} ~ {date_until}, size={return_size}")
        r = requests.post(URL, json=payload, timeout=30) # 타임아웃 추가

        # --- 이 부분에 디버깅 코드 추가 ---
        print(f"API 응답 상태 코드: {r.status_code}")
        print(f"API 응답 텍스트: {r.text[:500]}") # 응답이 너무 길면 일부만 출력

        r.raise_for_status()  # HTTP 에러 (4xx, 5xx) 발생 시 예외를 발생시킴
        # --- 디버깅 코드 추가 끝 ---

        response_json = r.json() # json 파싱 결과를 변수에 저장

        if 'return_object' not in response_json:
            print(f"응답에 'return_object' 키가 없습니다. 전체 응답: {response_json}")
            return []

        data = response_json["return_object"]
        print(f"총 {data['total_hits']}개의 뉴스 중 {len(data['documents'])}개 가져옴")
        return data["documents"]

    except requests.exceptions.RequestException as e:
        print(f"Bigkinds API 호출 실패: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"실패 응답 텍스트: {e.response.text[:500]}")
        return []
    except json.JSONDecodeError as e:
        print(f"Bigkinds API 응답 JSON 디코딩 실패: {e}, 응답 텍스트: {r.text[:200]}")
        return []
    except KeyError as e:
        print(f"Bigkinds API 응답 구조 오류: {e}, 응답 데이터: {response_json}") # response_json 출력 추가
        return []
    except Exception as e:
        print(f"예상치 못한 오류 발생: {e}")
        return []

def save_news_to_db(news_data: list):
    """
    가져온 뉴스 데이터를 PostgreSQL 데이터베이스에 저장합니다.
    이미 존재하는 뉴스는 삽입하지 않고 건너뜠습니다.
    """
    if not news_data:
        print("저장할 뉴스 데이터가 없습니다.")
        return

    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()

        inserted_count = 0
        skipped_count = 0

        for news_item in news_data:
            bigkinds_id = news_item.get("doc_id")

            if not bigkinds_id:
                print(f"경고: 'doc_id'가 없는 뉴스 건너뜀: {news_item.get('title', '제목 없음')}")
                skipped_count += 1
                continue

            cur.execute("SELECT id FROM news WHERE bigkinds_id = %s", (bigkinds_id,))
            if cur.fetchone():
                skipped_count += 1
                continue

            try:
                cur.execute(
                    """
                    INSERT INTO news (bigkinds_id, title, content, published_at, provider, category, source_url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        bigkinds_id,
                        news_item.get("title"),
                        news_item.get("content"),
                        news_item.get("published_at"),
                        news_item.get("provider"),
                        json.dumps(news_item.get("category")),
                        news_item.get("url")
                    ),
                )
                inserted_count += 1
            except psycopg2.Error as db_error:
                print(f"DB 삽입 오류 ({bigkinds_id}): {db_error}")
                skipped_count += 1
                conn.rollback()
                continue

        conn.commit()
        print(f"뉴스 데이터 저장 완료: {inserted_count}개 삽입, {skipped_count}개 건너뜀")

    except psycopg2.Error as e:
        print(f"데이터베이스 연결 또는 작업 오류: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"데이터 수집 시작: {yesterday}부터 {today}까지")
    news_documents = get_latest_economic_news(date_from=yesterday, date_until=today, return_size=10000)
    if news_documents:
        save_news_to_db(news_documents)
    else:
        print("수집할 뉴스가 없거나 오류가 발생했습니다.")