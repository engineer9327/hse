// ============================================================
//  기상청 API 호출 모듈
// ============================================================

const KMA_BASE = {
  apihub:   'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0',
  datagokr: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0'
};

/** CORS 프록시 경유 URL 생성 */
function proxyUrl(url) {
  const proxy = CONFIG.KMA_CORS_PROXY || '';
  return proxy ? proxy + encodeURIComponent(url) : url;
}

/** 공통 파라미터 빌드 */
function buildParams(extra) {
  const p = new URLSearchParams({
    serviceKey: CONFIG.KMA_API_KEY,
    dataType:   'JSON',
    numOfRows:  1000,
    pageNo:     1,
    ...extra
  });
  return p.toString();
}

/** API 엔드포인트 URL (프록시 포함) */
function apiUrl(endpoint, params) {
  const direct = `${KMA_BASE[CONFIG.KMA_API_TYPE]}/${endpoint}?${params}`;
  return proxyUrl(direct);
}

/** 오류 메시지 파싱 */
function parseError(json) {
  const code = json?.response?.header?.resultCode;
  const msg  = json?.response?.header?.resultMsg;
  if (code && code !== '00') return `resultCode=${code} (${msg})`;
  return null;
}

/**
 * 초단기실황 조회 (현재 기상)
 * 항목: T1H(기온), RN1(강수량), WSD(풍속), VEC(풍향), SKY(하늘), PTY(강수형태), REH(습도)
 */
async function fetchCurrentWeather(nx, ny) {
  const { base_date, base_time } = getNowBaseDateTime();
  const params = buildParams({ base_date, base_time, nx, ny });
  const url = apiUrl('getUltraSrtNcst', params);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    const err = parseError(json);
    if (err) throw new Error(err);
    const items = json?.response?.body?.items?.item;
    if (!items) return null;
    return Object.fromEntries(items.map(i => [i.category, i.obsrValue]));
  } catch (e) {
    console.warn('초단기실황 오류:', e.message);
    return null;
  }
}

/**
 * 단기예보 조회 (3일 예보)
 */
async function fetchForecast(nx, ny) {
  const { base_date, base_time } = getBaseDateTime();
  const params = buildParams({ base_date, base_time, nx, ny });
  const url = apiUrl('getVilageFcst', params);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    const err = parseError(json);
    if (err) throw new Error(err);
    const items = json?.response?.body?.items?.item;
    if (!items) return null;

    const byTime = {};
    items.forEach(item => {
      const key = `${item.fcstDate}_${item.fcstTime}`;
      if (!byTime[key]) byTime[key] = { date: item.fcstDate, time: item.fcstTime };
      byTime[key][item.category] = item.fcstValue;
    });
    return Object.values(byTime).sort((a,b) =>
      (a.date+a.time).localeCompare(b.date+b.time)
    );
  } catch (e) {
    console.warn('단기예보 오류:', e.message);
    return null;
  }
}

/** 날짜 문자열 포맷 */
function formatDate(dateStr) {
  return `${dateStr.slice(4,6)}/${dateStr.slice(6,8)}`;
}

/** 시간 문자열 포맷 */
function formatTime(timeStr) {
  return `${timeStr.slice(0,2)}:${timeStr.slice(2,4)}`;
}
