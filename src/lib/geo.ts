/**
 * Shared geographic utilities — single source of truth.
 * Used by locationTasks, useZoneAdvice, usePredictBestZones, rankDrivingOptions.
 */

const toRadians = (value: number) => (value * Math.PI) / 180;

/** Great-circle distance in km (Haversine, Earth radius 6371 km). */
export const distanceKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

/**
 * Real suburb boundary lookup for Gauteng, Cape Town, Durban, and Pretoria.
 * Returns the closest named suburb for a given coordinate.
 * Falls back to city name if no suburb is within 15km.
 */
const SUBURB_BOUNDARIES: Array<{
  name: string;
  city: string;
  lat: number;
  lng: number;
}> = [
  // Johannesburg / Gauteng
  { name: "Sandton", city: "Johannesburg", lat: -26.1076, lng: 28.0567 },
  { name: "Rosebank", city: "Johannesburg", lat: -26.1452, lng: 28.0436 },
  { name: "Midrand", city: "Johannesburg", lat: -25.9978, lng: 28.1284 },
  { name: "Fourways", city: "Johannesburg", lat: -26.0278, lng: 28.0106 },
  { name: "Randburg", city: "Johannesburg", lat: -26.0935, lng: 27.9923 },
  { name: "Soweto", city: "Johannesburg", lat: -26.2677, lng: 27.8587 },
  { name: "Bedfordview", city: "Johannesburg", lat: -26.1744, lng: 28.1361 },
  { name: "Roodepoort", city: "Johannesburg", lat: -26.1625, lng: 27.8727 },
  { name: "Alberton", city: "Johannesburg", lat: -26.2654, lng: 28.1218 },
  { name: "Germiston", city: "Johannesburg", lat: -26.2194, lng: 28.1624 },
  { name: "Johannesburg CBD", city: "Johannesburg", lat: -26.2041, lng: 28.0473 },
  { name: "Braamfontein", city: "Johannesburg", lat: -26.1929, lng: 28.0304 },
  { name: "Melrose Arch", city: "Johannesburg", lat: -26.1318, lng: 28.0681 },
  { name: "Hyde Park", city: "Johannesburg", lat: -26.1213, lng: 28.0381 },
  // Pretoria
  { name: "Pretoria CBD", city: "Pretoria", lat: -25.7479, lng: 28.2293 },
  { name: "Hatfield", city: "Pretoria", lat: -25.7545, lng: 28.2347 },
  { name: "Menlyn", city: "Pretoria", lat: -25.7836, lng: 28.2762 },
  { name: "Centurion", city: "Pretoria", lat: -25.8601, lng: 28.1894 },
  { name: "Brooklyn", city: "Pretoria", lat: -25.7675, lng: 28.2294 },
  { name: "Arcadia", city: "Pretoria", lat: -25.7461, lng: 28.2121 },
  // Cape Town
  { name: "Cape Town CBD", city: "Cape Town", lat: -33.9249, lng: 18.4241 },
  { name: "Waterfront", city: "Cape Town", lat: -33.9036, lng: 18.4197 },
  { name: "Sea Point", city: "Cape Town", lat: -33.9149, lng: 18.3910 },
  { name: "Claremont", city: "Cape Town", lat: -33.9802, lng: 18.4660 },
  { name: "Stellenbosch", city: "Cape Town", lat: -33.9321, lng: 18.8602 },
  { name: "Bellville", city: "Cape Town", lat: -33.8997, lng: 18.6306 },
  { name: "Brackenfell", city: "Cape Town", lat: -33.8758, lng: 18.6897 },
  // Durban
  { name: "Durban CBD", city: "Durban", lat: -29.8579, lng: 31.0292 },
  { name: "Umhlanga", city: "Durban", lat: -29.7237, lng: 31.0838 },
  { name: "Westville", city: "Durban", lat: -29.8381, lng: 30.9341 },
  { name: "Pinetown", city: "Durban", lat: -29.8191, lng: 30.8560 },
  { name: "Morningside", city: "Durban", lat: -29.8341, lng: 31.0097 },
  // Lagos (Nigeria)
  { name: "Victoria Island", city: "Lagos", lat: 6.4281, lng: 3.4219 },
  { name: "Lekki", city: "Lagos", lat: 6.4698, lng: 3.5852 },
  { name: "Ikeja", city: "Lagos", lat: 6.6018, lng: 3.3515 },
  { name: "Surulere", city: "Lagos", lat: 6.5059, lng: 3.3509 },
  // Nairobi (Kenya)
  { name: "Westlands", city: "Nairobi", lat: -1.2678, lng: 36.8030 },
  { name: "CBD Nairobi", city: "Nairobi", lat: -1.2921, lng: 36.8219 },
  { name: "Kilimani", city: "Nairobi", lat: -1.2864, lng: 36.7839 },
  // Accra (Ghana)
  { name: "Accra CBD", city: "Accra", lat: 5.5502, lng: -0.2174 },
  { name: "East Legon", city: "Accra", lat: 5.6352, lng: -0.1622 },
];

/**
 * Returns the closest real suburb name for a given lat/lng.
 * Uses actual coordinates instead of a mathematical hash.
 */
export const getSuburbName = (
  lat: number,
  lng: number,
  fallback = "City Centre"
): string => {
  let closest = fallback;
  let minDist = Infinity;
  for (const suburb of SUBURB_BOUNDARIES) {
    const d = distanceKm({ lat, lng }, { lat: suburb.lat, lng: suburb.lng });
    if (d < minDist) {
      minDist = d;
      closest = suburb.name;
    }
  }
  // Only return the suburb if it's within 15km, otherwise return fallback
  return minDist <= 15 ? closest : fallback;
};
