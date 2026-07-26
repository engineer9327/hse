// ============================================================
//  API 키 설정 파일
// ============================================================
const CONFIG = {
  // 카카오 JavaScript 앱 키
  KAKAO_APP_KEY: "4275ca43e02ea72006df6b642b4d3b37",

  // 기상청 API 키
  // ※ 공공데이터포털(data.go.kr) 에서 발급받은 키 → KMA_API_TYPE: "df1c1621cbe51db0d3f36a15b036cc59f32fd7241a5ba4d75a12b16b9cdd77e2"
  // ※ 기상청 API허브(apihub.kma.go.kr) 에서 발급받은 키 → KMA_API_TYPE: "sUmofD71SUyJqHw-9dlMqw"
  KMA_API_KEY: "YOUR_KMA_API_KEY",

  // 기상청 API 종류 선택
  KMA_API_TYPE: "datagokr",   // "datagokr" | "apihub"

  // CORS 프록시 (브라우저에서 기상청 API 직접 호출 불가 → 프록시 경유)
  // GitHub Pages / localhost 모두 필요. 빈 문자열("")이면 직접 호출 시도.
  KMA_CORS_PROXY: "https://corsproxy.io/?"
};
