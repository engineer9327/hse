# 고속선 기상검지장치 기상현황

경부·호남 고속선 기상검지장치(METEO) 23개소의  
가장 가까운 **기상청 AWS 매분자료**를 지도에서 확인하는 웹 앱입니다.

## 주요 기능

- 🗺️ 23개 기상검지장치 위치 카카오 지도 표시 (경부 🟠 / 호남 🟢)
- 🔵 기상청 AWS 관측소 606개 지도 표시 (클릭 시 데이터 조회)
- ❄️ 적설검지 AWS 별도 표시 (겨울철 적설 데이터 자동 표시)
- 🌬️ AWS 매분자료 실시간 조회 (기온·풍속·강수·습도·기압)
- ⚠️ 강풍 위험도 색상 표시 (주의보 14 m/s / 경보 21 m/s)
- 🔑 비밀번호 접근 제한 (지인 공유용)
- ⟳ 1분마다 자동 갱신
- 📱 반응형 (데스크톱·태블릿·스마트폰)

## API 키

| API | 발급처 |
|-----|--------|
| 카카오 JavaScript 키 | https://developers.kakao.com |
| 기상청 API허브 인증키 | https://apihub.kma.go.kr |

기상청 API허브에서 아래 두 가지 활용 신청 필요:
- 방재기상관측(AWS) > **AWS 매분자료 조회** (`nph-aws2_min`)
- 지상관측 지점정보 (`stn_inf.php`)

## 로컬 실행

```bash
# VS Code → index.html 우클릭 → Open with Live Server
# 또는
python -m http.server 8080  # http://localhost:8080
```

> ⚠️ `file://` 직접 열기 금지 — CORS 오류 발생

## 파일 구조

```
hse/
├── index.html     메인 앱 (지도·패널·비밀번호·전체 로직)
├── config.js      API 키 (카카오 JS키 + 기상청 authKey)
├── data.js        기상검지장치 23개 + KMA 관측소 606개 좌표
├── kma.js         기상청 AWS API 호출 (매분자료·적설검지)
├── utils.js       거리 계산·풍향 변환 등 유틸 함수
├── style.css      반응형 스타일
└── README.md
```

## GitHub Pages 배포

1. `config.js`에 실제 API 키 입력
2. GitHub 저장소에 파일 업로드
3. Settings → Pages → Branch: main → Save
4. 카카오 Developers → 플랫폼 → Web에 `https://[계정명].github.io` 추가

접속 URL: `https://engineer9327.github.io/hse`  
비밀번호: (관리자 문의)
