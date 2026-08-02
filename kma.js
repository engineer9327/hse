// ============================================================
//  기상청 API허브 - AWS 매분자료 + 관측소 좌표 조회
// ============================================================

const AWS_MIN_URL  = 'https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min';
const AWS_STN_URL  = 'https://apihub.kma.go.kr/api/typ01/url/stn_inf.php';
const PROXIES      = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?'
];

// ── 캐시 ──────────────────────────────────────────────────
let _awsCache      = null;  // 전체 AWS 실시간 데이터 { stnId: {...} }
let _awsCacheTime  = 0;
let _awsStnCoords  = null;  // AWS 관측소 좌표 { stnId: {lat,lon,name} }

// ── 공통 프록시 fetch ──────────────────────────────────────
async function proxyFetch(directUrl) {
  // origin=null(file://) 경고
  if (location.protocol === 'file:') {
    console.warn('[AWS] ⚠️ file:// 로 열면 CORS 오류 발생. Live Server 또는 GitHub Pages에서 사용하세요.');
  }
  for (const px of PROXIES) {
    const url = px + encodeURIComponent(directUrl);
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn(`[AWS] HTTP ${res.status} (${px.slice(8,24)})`); continue; }
      return await res.text();
    } catch (e) {
      console.warn(`[AWS] 오류 (${px.slice(8,24)}):`, e.message);
    }
  }
  console.error('[AWS] 모든 프록시 실패');
  return null;
}

// ── 결측값 정리 ───────────────────────────────────────────
function clean(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return ['-9','-9.0','-9.9','-99','-999','-9999',''].includes(s) ? null : s;
}

// ── 조회 시각 (현재 - 5분) ────────────────────────────────
function getAwsTm() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 5);
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

// ── AWS 관측소 좌표 조회 (앱 시작 시 1회) ─────────────────
async function fetchAwsStationCoords() {
  if (_awsStnCoords) return _awsStnCoords;
  const params = new URLSearchParams({ inf:'AWS', stn:'', help:1, authKey: CONFIG.KMA_API_KEY });
  const text = await proxyFetch(`${AWS_STN_URL}?${params}`);
  if (!text) return null;

  const coords = {};
  let colNames = null;
  text.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#START') || line.startsWith('#END')) return;
    if (line.startsWith('#')) {
      // 헤더 파싱 시도
      const cols = line.replace(/^#+\s*-*\s*/, '').split(/\s+/);
      if (cols.some(c => /^(LAT|LON|STN)/i.test(c))) colNames = cols;
      return;
    }
    const v = line.split(/\s+/);
    // 일반적 형식: STN NAME LAT LON HT START END
    const stn = v[0];
    if (!stn || isNaN(Number(stn))) return;
    let lat = NaN, lon = NaN, name = '';
    if (colNames) {
      colNames.forEach((c,i) => {
        const cl = c.toUpperCase();
        if (cl === 'LAT' || cl.includes('LAT')) lat = parseFloat(v[i]);
        if (cl === 'LON' || cl.includes('LON')) lon = parseFloat(v[i]);
        if (cl === 'NAME' || cl.includes('NM'))  name = v[i] || '';
      });
    } else {
      // fallback: STN(0) NAME(1) LAT(2) LON(3)
      name = v[1] || stn;
      lat  = parseFloat(v[2]);
      lon  = parseFloat(v[3]);
    }
    if (!isNaN(lat) && !isNaN(lon)) {
      coords[stn] = { id: stn, lat, lon, name };
    }
  });

  const cnt = Object.keys(coords).length;
  console.log('[AWS STN] 관측소 좌표 로드:', cnt, '개');
  if (cnt > 0) {
    const s = Object.values(coords)[0];
    console.log('[AWS STN] 샘플:', s);
  }
  _awsStnCoords = coords;
  return coords;
}

// ── 전체 AWS 실시간 데이터 조회 ───────────────────────────
async function fetchAllAws() {
  const now = Date.now();
  if (_awsCache && now - _awsCacheTime < 55000) { console.log('[AWS] 캐시 사용'); return _awsCache; }

  const params = new URLSearchParams({ tm2: getAwsTm(), stn:0, disp:0, help:1, authKey: CONFIG.KMA_API_KEY });
  const text = await proxyFetch(`${AWS_MIN_URL}?${params}`);
  if (!text) return null;

  console.log('[AWS] 응답 첫 300자:', text.slice(0,300));
  const data = parseAllAwsText(text);
  const cnt  = Object.keys(data).length;
  console.log('[AWS] 파싱 완료:', cnt, '개 지점');
  if (cnt > 0) console.log('[AWS] 샘플 지점:', Object.entries(data).slice(0,2));

  if (cnt > 0) { _awsCache = data; _awsCacheTime = Date.now(); }
  return data;
}

// ── AWS 응답 텍스트 파싱 → { stnId: {...} } ───────────────
function parseAllAwsText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let headers = null;
  const result = {};

  for (const line of lines) {
    if (line.startsWith('#START') || line.startsWith('#END')) continue;
    if (line.startsWith('#')) {
      const cols = line.replace(/^#+\s*-*\s*/, '').split(/\s+/);
      // 컬럼 헤더 감지 (WD, WS, TA 등 포함된 줄)
      if (cols.filter(c => ['WD','WS','TA','HM','PA','RN'].includes(c.replace(/\d/,''))).length >= 3) {
        headers = cols;
      }
      continue;
    }
    const vals = line.split(/\s+/);
    const stn  = vals[1];
    if (!stn || isNaN(Number(stn))) continue;

    const obj = {};
    if (headers) {
      headers.forEach((h, i) => {
        // WD1→WD, WS1→WS 등 숫자 접미사 제거
        const key = h.replace(/(\D+)\d+$/, '$1');
        obj[key] = clean(vals[i]);
      });
    } else {
      // AWS2 고정 컬럼 순서
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
      obj.SD_HR3 = clean(vals[16]);
      obj.SD_DAY = clean(vals[17]);
      obj.SD_TOT = clean(vals[18]);
    }
    // WD1/WS1 → WD/WS 별칭 처리
    if (!('WS' in obj) && 'WS1' in obj) obj.WS = obj.WS1;
    if (!('WD' in obj) && 'WD1' in obj) obj.WD = obj.WD1;

    result[stn] = obj;
  }
  return result;
}

// ── 좌표 기반 최근접 AWS 지점 탐색 ───────────────────────
async function findNearestAws(lat, lon, allAws) {
  // 1) AWS 관측소 좌표 조회
  const stnCoords = await fetchAwsStationCoords();

  if (stnCoords && Object.keys(stnCoords).length > 0) {
    // AWS 실시간 데이터와 좌표 모두 있는 지점만 후보로
    const activeStnIds = new Set(Object.keys(allAws || {}));
    let nearest = null, minDist = Infinity;

    Object.entries(stnCoords).forEach(([id, info]) => {
      if (activeStnIds.size > 0 && !activeStnIds.has(id)) return;
      const d = haversine(lat, lon, info.lat, info.lon);
      if (d < minDist) { minDist = d; nearest = { ...info, id }; }
    });

    if (nearest) {
      console.log('[AWS] 최근접 지점 (좌표 기반):', nearest.name, '(지점', nearest.id, ')  거리:', minDist.toFixed(1), 'km');
      return { station: nearest, distKm: minDist };
    }
  }

  // 2) fallback: KMA_STATIONS 매칭
  console.warn('[AWS] 좌표 기반 실패 → KMA_STATIONS fallback');
  const awsIds = new Set(Object.keys(allAws || {}));
  const candidates = KMA_STATIONS.filter(s => awsIds.has(String(s.id)));
  if (candidates.length > 0) {
    const { station, distKm } = findNearestStation(lat, lon);
    return { station, distKm };
  }

  // 3) 최후 fallback: KMA_STATIONS 가장 가까운 지점
  return findNearestStation(lat, lon);
}

// ── 특정 지점 데이터 반환 ─────────────────────────────────
async function fetchAwsMinute(stnId) {
  const allData = await fetchAllAws();
  return allData ? allData[String(stnId)] || null : null;
}

// ── 관측 시각 포맷 ────────────────────────────────────────
function formatObsTime(tm) {
  if (!tm || tm.length < 12) return '–';
  return `${tm.slice(8,10)}:${tm.slice(10,12)}`;
}

// ============================================================
//  적설 관측 지점 탐색 (겨울 데이터 기준)
// ============================================================

let _snowStationIds = null;   // Set: 적설계 설치 확인된 AWS 지점번호

/**
 * 겨울 기준 데이터로 적설계 설치 지점 확인
 * - 2025년 1월 15일 09시 데이터 조회
 * - SD_HR3, SD_DAY, SD_TOT 중 하나라도 non-null이면 적설검지 개소
 */
async function fetchSnowStations() {
  if (_snowStationIds) return _snowStationIds;

  const winterTm = '202501150900';
  const params = new URLSearchParams({
    tm2: winterTm, stn: 0, disp: 0, help: 1, authKey: CONFIG.KMA_API_KEY
  });
  console.log('[SNOW] 겨울 데이터로 적설검지 지점 파악 중...');
  const text = await proxyFetch(`${AWS_MIN_URL}?${params}`);
  if (!text) { console.warn('[SNOW] 적설 지점 조회 실패'); return new Set(); }

  const winterData = parseAllAwsText(text);
  const snowIds = new Set();

  Object.entries(winterData).forEach(([id, d]) => {
    if (d.SD_HR3 !== null || d.SD_DAY !== null || d.SD_TOT !== null) {
      snowIds.add(id);
    }
  });

  console.log(`[SNOW] 적설검지 개소: ${snowIds.size}개 (전체 AWS: ${Object.keys(winterData).length}개)`);
  _snowStationIds = snowIds;
  return snowIds;
}

/** 위치 기준 가장 가까운 적설검지 AWS 탐색 (폴백 포함) */
async function findNearestSnowAws(lat, lon) {
  const [snowIds, stnCoords] = await Promise.all([
    fetchSnowStations(),
    fetchAwsStationCoords()
  ]);

  // ① 겨울 데이터로 확인된 전용 적설검지 지점 탐색
  if (snowIds?.size > 0 && stnCoords) {
    let nearest = null, minDist = Infinity;
    snowIds.forEach(id => {
      const c = stnCoords[id];
      if (!c) return;
      const d = haversine(lat, lon, c.lat, c.lon);
      if (d < minDist) { minDist = d; nearest = { ...c, id }; }
    });
    if (nearest) {
      console.log(`[SNOW] ① 전용 적설검지 최근접: ${nearest.name}(${nearest.id}) ${minDist.toFixed(1)}km`);
      return { station: nearest, distKm: minDist, type: 'snow' };
    }
    console.warn('[SNOW] ① 전용 적설검지 좌표 매칭 실패 → 폴백');
  }

  // ② 좌표DB에서 최근접 AWS 탐색 (SD 항목은 있으나 여름엔 null)
  if (stnCoords && Object.keys(stnCoords).length > 0) {
    let nearest = null, minDist = Infinity;
    Object.entries(stnCoords).forEach(([id, c]) => {
      const d = haversine(lat, lon, c.lat, c.lon);
      if (d < minDist) { minDist = d; nearest = { ...c, id }; }
    });
    if (nearest) {
      console.log(`[SNOW] ② 좌표DB 최근접 AWS: ${nearest.name}(${nearest.id}) ${minDist.toFixed(1)}km`);
      return { station: nearest, distKm: minDist, type: 'aws_fallback' };
    }
  }

  // ③ KMA_STATIONS 최근접 (최후 폴백)
  console.warn('[SNOW] ③ KMA_STATIONS 폴백 사용');
  const { station, distKm } = findNearestStation(lat, lon);
  return { station, distKm, type: 'kma_fallback' };
}

/** 현재 적설 데이터 조회 (fetchAllAws 캐시 활용) */
async function fetchCurrentSnowData(stnId) {
  const allAws = await fetchAllAws();
  const d = allAws?.[String(stnId)];
  if (!d) return null;
  return {
    TM:     d.TM,
    SD_HR3: d.SD_HR3,  // 3시간 신적설 (cm)
    SD_DAY: d.SD_DAY,  // 일최심신적설 (cm)
    SD_TOT: d.SD_TOT   // 총적설 (cm)
  };
}
