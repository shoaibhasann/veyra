import { Vector3 } from "three";

export const DEG2RAD = Math.PI / 180;

export type LatLng = { lat: number; lng: number };

export type City = LatLng & { code: string; name: string };

/**
 * Geographic coordinate -> point on a sphere of `radius`.
 *
 * Convention: lat/lng 0,0 sits at +Z (straight at a camera on the +Z axis),
 * east increases toward +X, north toward +Y. Chosen so that framing a
 * longitude is a single rotation — see `centerLongitude`.
 */
export function latLngToVector3(
  lat: number,
  lng: number,
  radius = 1,
  target = new Vector3(),
): Vector3 {
  const latRad = lat * DEG2RAD;
  const lngRad = lng * DEG2RAD;
  const cosLat = Math.cos(latRad);
  return target.set(
    radius * cosLat * Math.sin(lngRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.cos(lngRad),
  );
}

/** Inverse of `latLngToVector3` for a unit-length vector. */
export function vector3ToLatLng(v: Vector3): LatLng {
  return {
    lat: Math.asin(v.y / v.length()) / DEG2RAD,
    lng: Math.atan2(v.x, v.z) / DEG2RAD,
  };
}

/** Y rotation that brings `lng` around to face the camera on +Z. */
export function centerLongitude(lng: number): number {
  return -lng * DEG2RAD;
}

/** Angular separation between two coordinates, in radians. */
export function angularDistance(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const dLat = lat2 - lat1;
  const dLng = (b.lng - a.lng) * DEG2RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Hero marker set — one country per pill label, anchored on its main freight
 * hub. APAC-weighted for the brand but globally spread, so wherever the slow
 * revolution is, several markers always face the camera.
 */
export const MARKERS: readonly City[] = [
  { code: "CN", name: "China", lat: 31.23, lng: 121.47 }, // Shanghai
  { code: "JP", name: "Japan", lat: 35.68, lng: 139.77 }, // Tokyo
  { code: "HK", name: "Hong Kong", lat: 22.32, lng: 114.17 },
  { code: "KR", name: "South Korea", lat: 35.1, lng: 129.04 }, // Busan
  { code: "TH", name: "Thailand", lat: 13.75, lng: 100.5 }, // Bangkok
  { code: "VN", name: "Vietnam", lat: 10.82, lng: 106.63 }, // Ho Chi Minh City
  { code: "SG", name: "Singapore", lat: 1.35, lng: 103.82 },
  { code: "MY", name: "Malaysia", lat: 5.42, lng: 100.33 }, // Penang — clear of SG
  { code: "ID", name: "Indonesia", lat: -6.13, lng: 106.88 }, // Jakarta
  { code: "PH", name: "Philippines", lat: 14.6, lng: 120.98 }, // Manila
  { code: "IN", name: "India", lat: 19.08, lng: 72.88 }, // Mumbai
  { code: "AU", name: "Australia", lat: -33.87, lng: 151.21 }, // Sydney
  { code: "NZ", name: "New Zealand", lat: -36.85, lng: 174.76 }, // Auckland
  { code: "AE", name: "UAE", lat: 25.01, lng: 55.06 }, // Jebel Ali
  { code: "SA", name: "Saudi Arabia", lat: 21.49, lng: 39.19 }, // Jeddah
  { code: "DE", name: "Germany", lat: 53.55, lng: 9.99 }, // Hamburg
  { code: "UK", name: "UK", lat: 51.51, lng: -0.13 }, // London
  { code: "ZA", name: "South Africa", lat: -29.86, lng: 31.02 }, // Durban
];

/** Lane pairs referenced by marker code — every marker joins at least one. */
export const ROUTES: readonly (readonly [string, string])[] = [
  ["SG", "HK"],
  ["HK", "CN"],
  ["CN", "JP"],
  ["JP", "KR"],
  ["TH", "SG"],
  ["VN", "SG"],
  ["PH", "JP"],
  ["ID", "SG"],
  ["MY", "HK"],
  ["IN", "SG"],
  ["IN", "AE"],
  ["AE", "SA"],
  ["AE", "DE"],
  ["DE", "UK"],
  ["ZA", "IN"],
  ["AU", "SG"],
  ["AU", "NZ"],
  ["CN", "AU"],
];

/**
 * Longitude framed on +Z at rest — mid-APAC, so the first thing a visitor
 * sees is the SE-Asia cluster with India and the Gulf on the left limb.
 */
export const REST_CENTER_LNG = 108;

const CITY_BY_CODE = new Map(MARKERS.map((c) => [c.code, c]));

export function cityByCode(code: string): City {
  const city = CITY_BY_CODE.get(code);
  if (!city) throw new Error(`Unknown marker code: ${code}`);
  return city;
}

/** Route pairs resolved to marker records, in declaration order. */
export function resolveRoutes(
  routes: readonly (readonly [string, string])[] = ROUTES,
): { from: City; to: City }[] {
  return routes.map(([from, to]) => ({
    from: cityByCode(from),
    to: cityByCode(to),
  }));
}
