# 고속선 기상검지장치 기상현황

경부·호남·수도권 고속선 기상검지장치(METEO) 사이트의  
가장 가까운 기상청 관측소 데이터를 지도에서 확인하는 웹 앱입니다.

## 기능

- 🗺️ 23개 기상검지장치 위치 카카오 지도 표시
- 🌡️ 클릭 시 가장 가까운 기상청 관측소 자동 탐색 (Haversine 공식)
- 🌬️ 기상청 단기예보 API — 현재 기상 + 24시간 예보
- ⚠️ 강풍 위험도 색상 표시 (주의보 14 m/s / 경보 21 m/s)
- 📍 경부선 / 호남선 노선별 필터

## API 키 발급

| API | 발급처 | 비고 |
|-----|--------|------|
| 카카오 JavaScript | https://developers.kakao.com | 플랫폼 → 웹 → 도메인 등록 필요 |
| 기상청 API허브 | https://apihub.kma.go.kr | 단기예보조회서비스 승인 필요 |

## 로컬 실행

```bash
# Python 간이 서버 (index.html이 있는 폴더에서)
python -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

> ⚠️ `file://` 직접 열기는 Kakao Maps CORS 오류 발생. 반드시 로컬 서버로 실행하세요.

## API 키 설정 방법

### 방법 A) config.js에 직접 입력 (GitHub 배포용 권장)

```js
// js/config.js
const CONFIG = {
  KAKAO_APP_KEY: "발급받은_카카오_JS_앱_키",
  KMA_API_KEY:   "발급받은_기상청_API_키",
  KMA_API_TYPE:  "apihub"
};
```

### 방법 B) 브라우저 설정 화면 사용 (개인 테스트용)

앱 실행 시 자동으로 설정 화면이 나타납니다.  
입력한 키는 브라우저 `localStorage`에만 저장됩니다.

## GitHub Pages 배포

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/[계정명]/meteo-weather.git
git push -u origin main
```

GitHub 저장소 → Settings → Pages → Branch: main → Save

카카오 Developers에서 JavaScript 앱 키의 **허용 도메인**에  
`https://[계정명].github.io` 추가 필수!

## 파일 구조

```
meteo-weather/
├── index.html          메인 앱 (HTML + 앱 로직)
├── js/
│   ├── config.js       API 키 설정
│   ├── data.js         기상검지장치 23개 + 기상청 관측소 606개 데이터
│   ├── utils.js        거리 계산, 격자 변환, 유틸 함수
│   └── kma.js          기상청 API 호출 모듈
├── css/
│   └── style.css       스타일시트
└── README.md
```

## 주의사항

- 기상청 API 허브(apihub.kma.go.kr)는 CORS를 지원하므로 브라우저에서 직접 호출 가능
- 구 data.go.kr API 사용 시 CORS 오류 발생할 수 있음 → `KMA_API_TYPE: "apihub"` 유지
- 기상검지장치 좌표는 최초 1회 Kakao 주소 검색 후 localStorage에 캐싱됨
