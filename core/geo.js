// Location resolution from "Geography model": nearest city within 40 km,
// then nearest locality in that city within 3 km. Plain haversine; ~120 localities.

export const CITY_RADIUS_KM = 40;
export const LOCALITY_RADIUS_KM = 3;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function nearest(rows, lat, lng, maxKm) {
  let best = null;
  for (const row of rows) {
    const km = haversineKm(lat, lng, row.lat, row.lng);
    if (km <= maxKm && (!best || km < best.km)) best = { row, km };
  }
  return best;
}

/** @returns {{ city: object|null, locality: object|null, cityKm?: number, localityKm?: number }} */
export function resolveLocation(lat, lng, cities, localities) {
  const city = nearest(cities, lat, lng, CITY_RADIUS_KM);
  if (!city) return { city: null, locality: null };
  const inCity = localities.filter((l) => l.city_id === city.row.$id);
  const locality = nearest(inCity, lat, lng, LOCALITY_RADIUS_KM);
  return {
    city: city.row,
    locality: locality?.row ?? null,
    cityKm: city.km,
    localityKm: locality?.km,
  };
}
