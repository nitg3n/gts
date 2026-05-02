# 학교로GO

학생이 자신에게 맞는 중학교/고등학교를 찾을 수 있도록 돕는 데이터 기반 학교 추천 웹 서비스입니다.

## 개발 실행

PowerShell 실행 정책 때문에 Windows에서는 `npm` 대신 `npm.cmd`를 사용합니다.

```bash
npm.cmd run dev
```

브라우저에서 [http://127.0.0.1:3000](http://127.0.0.1:3000)을 엽니다.

## 환경 변수

실제 키는 `.env`에만 저장합니다. `.env`는 Git에 포함되지 않습니다.

현재 사용하는 키 이름은 다음과 같습니다.

```bash
NEIS_OPEN_API_KEY=
SCHOOL_INFO_OPEN_API_KEY=
KAKAO_REST_API_KEY=
KAKAO_JS_KEY=
KAKAO_NATIVE_APP_KEY=
KAKAO_ADMIN_KEY=
SUPABASE_PROJECT_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_DIRECT_CONNECTION_KEY=
ADMIN_EMAILS=
```

`KAKAO_JS_KEY`는 Kakao Maps JavaScript SDK 로딩에 사용됩니다. 브라우저에 노출될 수 있는 키이므로 Kakao Developers에서 허용 도메인을 반드시 등록해야 합니다.

개발용 허용 도메인:

```text
http://localhost:3000
http://127.0.0.1:3000
```

## 데이터 소스 우선순위

1. 학교알리미 OpenAPI: 학교 공시정보와 추천 지표의 중심 데이터
2. NEIS OpenAPI: 학교 기본정보, 급식, 학사일정 등 생활 데이터
3. Kakao Local/Maps: 주소 좌표 변환, 지도, 위치 기반 주변 학교 탐색
4. 커리어넷 OpenAPI: 학교/진로/학과 정보 보강
5. EDSS: 학교알리미로 부족한 과거 자료나 심화 통계가 필요할 때 확장

## 설문 데이터

`examples/` 디렉터리는 Google Form에서 가져온 원본 예시를 보관하는 곳입니다. 앱에서 실제로 사용하는 정제된 설문 스키마는 `src/data/surveys.ts`에 둡니다.

현재 설문 구성:

- `high-school-selection-v1`: 중학생이 고등학교를 고르는 추천 설문
- `school-experience-v1`: 리뷰/만족도 수집에 사용할 보조 설문
