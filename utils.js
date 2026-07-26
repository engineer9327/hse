// ============================================================
//  유틸리티 함수
// ============================================================

/** Haversine 공식 - 두 좌표 간 거리(km) */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** 가장 가까운 KMA 관측지점 반환 */
function findNearestStation(lat, lon) {
  let nearest = null, minDist = Infinity;
  KMA_STATIONS.forEach(s => {
    const d = haversine(lat, lon, s.lat, s.lon);
    if (d < minDist) { minDist = d; nearest = s; }
  });
  return { station: nearest, distKm: minDist };
}

/** 위경도 → 기상청 격자 (nx, ny) 변환 */
function latLonToGrid(lat, lon) {
  const RE=6371.00877, GRID=5.0, SLAT1=30, SLAT2=60, OLON=126, OLAT=38, XO=43, YO=136;
  const DEGRAD = Math.PI / 180;
  const re = RE / GRID;
  const slat1=SLAT1*DEGRAD, slat2=SLAT2*DEGRAD, olon=OLON*DEGRAD, olat=OLAT*DEGRAD;
  let sn = Math.log(Math.cos(slat1)/Math.cos(slat2)) /
           Math.log(Math.tan(Math.PI*.25+slat2*.5)/Math.tan(Math.PI*.25+slat1*.5));
  let sf = Math.pow(Math.tan(Math.PI*.25+slat1*.5), sn) * Math.cos(slat1) / sn;
  let ro = re * sf / Math.pow(Math.tan(Math.PI*.25+olat*.5), sn);
  const ra = re * sf / Math.pow(Math.tan(Math.PI*.25+lat*DEGRAD*.5), sn);
  let theta = lon*DEGRAD - olon;
  if (theta > Math.PI) theta -= 2*Math.PI;
  if (theta < -Math.PI) theta += 2*Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra*Math.sin(theta)+XO+0.5),
    ny: Math.floor(ro-ra*Math.cos(theta)+YO+0.5)
  };
}

/** 풍향 각도 → 16방위 */
function vecToDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg/22.5) % 16];
}

/** 풍향 화살표 (SVG 경로용 rotate) */
function vecToArrow(deg) { return `rotate(${deg})`; }

/** 강수형태 코드 → 텍스트 */
function ptyText(code) {
  return ['없음','비','비/눈','눈','소나기','빗방울','빗방울·눈날림','눈날림'][+code] ?? '–';
}

/** 하늘상태 코드 → 텍스트 + 이모지 */
function skyText(code) {
  return [,'☀️ 맑음',,'🌤️ 구름많음','☁️ 흐림'][+code] ?? '–';
}

/** 기상청 API base_date, base_time 계산 (단기예보) */
function getBaseDateTime() {
  const now = new Date();
  // 발표 시각: 02, 05, 08, 11, 14, 17, 20, 23시 (발표 후 10분 부터 가능)
  const hours = [2,5,8,11,14,17,20,23];
  let h = now.getHours();
  let d = new Date(now);
  // 현재 시간보다 작은 가장 큰 발표시간 찾기 (10분 여유)
  let base = hours.filter(x => x <= h - (now.getMinutes()<10?1:0)).pop();
  if (base === undefined) {
    // 전날 23시
    d.setDate(d.getDate()-1);
    base = 23;
  }
  const pad = n => String(n).padStart(2,'0');
  const dateStr = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const timeStr = `${pad(base)}00`;
  return { base_date: dateStr, base_time: timeStr };
}

/** 초단기실황 base_date, base_time 계산 */
function getNowBaseDateTime() {
  const now = new Date();
  // 매 정각 발표, 40분 후부터 가능
  let h = now.getHours();
  if (now.getMinutes() < 40) h--;
  if (h < 0) { h = 23; now.setDate(now.getDate()-1); }
  const pad = n => String(n).padStart(2,'0');
  return {
    base_date: `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`,
    base_time: `${pad(h)}00`
  };
}

/** 숫자 반올림 표시 */
function fmt(val, unit='') {
  if (val === null || val === undefined || val === '') return '–';
  const n = parseFloat(val);
  return isNaN(n) ? val : `${n.toFixed(1)}${unit}`;
}

/** 풍속 → 위험도 클래스 */
function windClass(wsd) {
  const w = parseFloat(wsd);
  if (isNaN(w)) return '';
  if (w >= 21) return 'danger';    // 강풍경보 기준
  if (w >= 14) return 'warning';   // 강풍주의보 기준
  if (w >= 10) return 'caution';
  return '';
}
