// ============================================================
//  기상청 API허브 - AWS 매분자료 (nph-aws2_min)
// ============================================================

const AWS_MIN_URL = 'https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min';

/** 조회 시각 (현재 - 5분 지연, YYYYMMDDHHMM) */
function getAwsTm() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 5);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

/** 결측값 판별 */
function isMissing(v) {
  return v === undefined || v === null ||
         ['-9','-9.0','-9.9','-99','-999','-9999','0.0/0',''].includes(String(v).trim());
}

function clean(v) { return isMissing(v) ? null : v; }

/** 응답 텍스트 파싱 → 마지막 관측행 객체 반환 */
function parseAwsText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let headers = null;
  let lastData = null;

  for (const line of lines) {
    if (line.startsWith('#START') || line.startsWith('#END') || line === '') continue;
    if (line.startsWith('#')) {
      const cols = line.replace(/^#+\s*/, '').trim().split(/\s+/);
      if (cols.includes('WD') || cols.includes('WS') || cols.includes('TA')) {
        headers = cols;
      }
      continue;
    }
    lastData = line.split(/\s+/);
  }

  if (!lastData) return null;

  // 헤더 있으면 매핑, 없으면 고정 인덱스 사용
  if (headers) {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = clean(lastData[i]); });
    return obj;
  }

  // 고정 컬럼 순서 (AWS2 형식)
  return {
    TM:     clean(lastData[0]),
    STN:    clean(lastData[1]),
    WD:     clean(lastData[2]),
    WS:     clean(lastData[3]),
    GST_WD: clean(lastData[4]),
    GST_WS: clean(lastData[5]),
    PA:     clean(lastData[7]),
    TA:     clean(lastData[8]),
    TD:     clean(lastData[9]),
    HM:     clean(lastData[10]),
    RN:     clean(lastData[12]),
    RN_DAY: clean(lastData[13])
  };
}

/** AWS 매분자료 조회 */
async function fetchAwsMinute(stnNo) {
  const params = new URLSearchParams({
    tm2:     getAwsTm(),
    stn:     stnNo,
    disp:    0,
    help:    1,
    authKey: CONFIG.KMA_API_KEY
  });
  const direct = `${AWS_MIN_URL}?${params}`;
  const url = (CONFIG.KMA_CORS_PROXY || '') + encodeURIComponent(direct);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    console.log('[AWS] 응답 수신, 지점:', stnNo);
    const data = parseAwsText(text);
    if (!data) console.warn('[AWS] 파싱 결과 없음');
    return data;
  } catch (e) {
    console.error('[AWS] 오류:', e.message);
    return null;
  }
}

/** 관측 시각 포맷 (TM: YYYYMMDDHHMM01 → HH:MM) */
function formatObsTime(tm) {
  if (!tm || tm.length < 12) return '–';
  return `${tm.slice(8, 10)}:${tm.slice(10, 12)}`;
}
