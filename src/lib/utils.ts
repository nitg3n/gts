import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

export function formatDistance(km?: number) {
  if (typeof km !== "number" || Number.isNaN(km)) {
    return "거리 계산 전";
  }

  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }

  return `${km.toFixed(1)}km`;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
