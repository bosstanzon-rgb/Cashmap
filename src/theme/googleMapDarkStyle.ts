import type { MapStyleElement } from "react-native-maps";

/**
 * Google Maps JSON style — matches CashMap canvas (#0A0A0A), readable labels (#CCCCCC).
 */
export const GOOGLE_MAP_DARK_STYLE: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: "#0A0A0A" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0A0A" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#141414" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0C0C0C" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#181818" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#202020" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#262626" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#2A2A2A" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#060606" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#CCCCCC" }] },
];
