// ============================================================
//  유틸리티 함수 (AWS 매분자료 전용)
// ============================================================

/** Haversine 거리(km) */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, D = Math.PI / 180;
  const dLat = (lat2-lat1)*D, dLon = (lon2-lon1)*D;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*D)*Math.cos(lat2*D)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** 가장 가까운 KMA 관측소 */
function findNearestStation(lat, lon) {
  let nearest = null, minDist = Infinity;
  KMA_STATIONS.forEach(s => {
    const d = haversine(lat, lon, s.lat, s.lon);
    if (d < minDist) { minDist = d; nearest = s; }
  });
  return { station: nearest, distKm: minDist };
}

/** 풍향 각도 → 16방위 */
function vecToDir(deg) {
  if (deg === null || isNaN(deg)) return '–';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** 풍속 → 위험도 클래스 */
function windClass(wsd) {
  const w = parseFloat(wsd);
  if (isNaN(w) || wsd === null) return '';
  if (w >= 21) return 'danger';
  if (w >= 14) return 'warning';
  if (w >= 10) return 'caution';
  return '';
}

/** 숫자 포맷 */
function fmt(val, unit = '') {
  if (val === null || val === undefined || val === '') return '–';
  const n = parseFloat(val);
  return isNaN(n) ? String(val) : `${n.toFixed(1)}${unit}`;
}
