// Sun and moon for Medford, Oregon (42.33 N, 122.87 W), after the well-known formulas used by
// SunCalc (Vladimir Agafonkin, BSD-2) and Astronomy Answers. Angles in radians unless noted.
export const LAT = 42.33, LNG = -122.87, TZ = 'America/Los_Angeles';

const PI = Math.PI, rad = PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
const toDays = (ms) => ms / dayMs - 0.5 + J1970 - J2000;
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const azimuth = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
const altitude = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;

function sunCoords(d) {
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + PI;
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}
function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist };
}

// azimuth: 0 = south, +west; altitude above the horizon
export function sunPosition(ms, lat = LAT, lng = LNG) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(ms), c = sunCoords(d), H = sidereal(d, lw) - c.ra;
  return { azimuth: azimuth(H, phi, c.dec), altitude: altitude(H, phi, c.dec) };
}
export function moonPosition(ms, lat = LAT, lng = LNG) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(ms), c = moonCoords(d), H = sidereal(d, lw) - c.ra;
  let h = altitude(H, phi, c.dec);
  const hr = Math.max(h, 0); // refraction (the formula blows up below the horizon, so clamp like SunCalc does)
  h += rad * 0.017 / Math.tan(hr + rad * 10.26 / (hr + rad * 5.10));
  return { azimuth: azimuth(H, phi, c.dec), altitude: h };
}
// fraction lit (0..1), phase (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter), and the bright limb angle
export function moonIllumination(ms) {
  const d = toDays(ms), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / PI, angle };
}

// Local wall-clock parts in Medford for a timestamp.
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
export function localParts(ms) {
  const p = {}; for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = +value;
  if (p.hour === 24) p.hour = 0;
  return p; // { year, month, day, hour, minute, second }
}
export function localHour(ms) { const p = localParts(ms); return p.hour + p.minute / 60 + p.second / 3600; }
const tfmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const clockText = (ms) => tfmt.format(new Date(ms));

// Sunrise and sunset (sun at -0.833°) on the local day containing ms, found by bisection.
export function sunTimes(ms) {
  const p = localParts(ms);
  const noonGuess = ms - ((p.hour - 12) * 3600 + p.minute * 60 + p.second) * 1000; // local noon-ish
  const alt = (t) => sunPosition(t).altitude - rad * -0.833;
  const find = (a, b) => { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if ((alt(a) < 0) === (alt(m) < 0)) a = m; else b = m; } return (a + b) / 2; };
  const lo = noonGuess - 11 * 3600e3, hi = noonGuess + 11 * 3600e3;
  return { sunrise: alt(lo) < 0 && alt(noonGuess) > 0 ? find(lo, noonGuess) : null, sunset: alt(hi) < 0 && alt(noonGuess) > 0 ? find(noonGuess, hi) : null };
}
