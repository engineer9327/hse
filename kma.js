// ============================================================
//  기상청 API허브 - AWS 매분자료 (전체 지점 조회 방식)
// ============================================================

const AWS_MIN_URL = 'https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min';

// 전체 AWS 데이터 캐시 (55초 유효)
let _awsCache     = null;
let _awsCacheTime = 0;

/** 조회 시각 (현재 - 5분, YYYYMMDDHHMM) */
function getAwsTm() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 5);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

/** 결측값 정리 */
function clean(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return ['-9','-9.0','-9.9','-99','-999','-9999',''].includes(s) ? null : s;
}

/** 전체 AWS 응답 텍스트 파싱 → { stnNo: {WD,WS,TA,...}, ... } */
function parseAllAwsText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let headers = null;
  const result = {};

  for (const line of lines) {
    if (line.startsWith('#START') || line.startsWith('#END')) continue;
    if (line.startsWith('#')) {
      const cols = line.replace(/^#+\s*/, '').split(/\s+/);
      if (cols.includes('WD') || cols.includes('TA') || cols.includes('WS')) {
        headers = cols;
      }
      continue;
    }
    const vals = line.split(/\s+/);
    const stn  = vals[1];
    if (!stn || isNaN(Number(stn))) continue;

    const obj = {};
    if (headers) {
      headers.forEach((h, i) => { obj[h] = clean(vals[i]); });
    } else {
      // 고정 컬럼 순서 fallback (AWS2 포맷)
      obj.TM     = clean(vals[0]);
      obj.STN    = clean(vals[1]);
      obj.WD     = clean(vals[2]);
      obj.WS     = clean(vals[3]);
      obj.GST_WD = clean(vals[4]);
      obj.GST_WS = clean(vals[5]);
      obj.PA     = clean(vals[7]);
      obj.TA     = clean(vals[8]);
      obj.TD     = clean(vals[9]);
      obj.HM     = clean(vals[10]);
      obj.RN     = clean(vals[12]);
      obj.RN_DAY = clean(vals[13]);
    }
    result[stn] = obj;
  }
  return result;
}

/** 전체 AWS 지점 조회 (캐시 활용) */
async function fetchAllAws() {
  const now = Date.now();
  if (_awsCache && now - _awsCacheTime < 55000) {
    console.log('[AWS] 캐시 사용');
    return _awsCache;
  }

  const params = new URLSearchParams({
    tm2:     getAwsTm(),
    stn:     0,           // 전체 지점
    disp:    0,
    help:    1,
    authKey: CONFIG.KMA_API_KEY
  });
  const direct = `${AWS_MIN_URL}?${params}`;
  const proxyUrl = (CONFIG.KMA_CORS_PROXY || '') + encodeURIComponent(direct);

  console.log('[AWS] 전체 조회 시작:', getAwsTm());

  // 프록시 자동 전환
  const proxies = [CONFIG.KMA_CORS_PROXY, 'https://corsproxy.io/?'];
  for (const px of proxies) {
    const url = px ? px + encodeURIComponent(direct) : direct;
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn('[AWS] HTTP', res.status, '(proxy:', px, ')'); continue; }
      const text = await res.text();
      console.log('[AWS] 응답 첫 200자:', text.slice(0, 200));
      const data = parseAllAwsText(text);
      const cnt  = Object.keys(data).length;
      console.log('[AWS] 파싱 완료:', cnt, '개 지점');
      if (cnt === 0) { console.warn('[AWS] 파싱 결과 0개'); continue; }
      _awsCache     = data;
      _awsCacheTime = Date.now();
      return data;
    } catch (e) {
      console.warn('[AWS] 오류 (proxy:', px, '):', e.message);
    }
  }
  console.error('[AWS] 모든 프록시 실패');
  return null;
}

/** 전체 AWS 데이터에서 위치 기준 최근접 지점 탐색 */
function findNearestAwsStation(lat, lon, awsData) {
  const awsIds = new Set(Object.keys(awsData || {}));

  // KMA_STATIONS 중 AWS 데이터에 있는 지점만 필터
  const candidates = KMA_STATIONS.filter(s => awsIds.has(String(s.id)));

  if (candidates.length === 0) {
    console.warn('[AWS] KMA_STATIONS와 매칭되는 AWS 지점 없음');
    return findNearestStation(lat, lon);  // fallback
  }

  let nearest = null, minDist = Infinity;
  candidates.forEach(s => {
    const d = haversine(lat, lon, s.lat, s.lon);
    if (d < minDist) { minDist = d; nearest = s; }
  });
  return { station: nearest, distKm: minDist };
}

/** 특정 지점 AWS 데이터 반환 (전체 조회 후 필터) */
async function fetchAwsMinute(stnNo) {
  const allData = await fetchAllAws();
  if (!allData) return null;
  const data = allData[String(stnNo)];
  if (!data) console.warn('[AWS] 지점', stnNo, '데이터 없음. 가용 지점 샘플:', Object.keys(allData).slice(0,8));
  return data || null;
}

/** 관측 시각 포맷 (TM: YYYYMMDDHHMM01 → HH:MM) */
function formatObsTime(tm) {
  if (!tm || tm.length < 12) return '–';
  return `${tm.slice(8, 10)}:${tm.slice(10, 12)}`;
}
