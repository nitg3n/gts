export type StoredUserLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  savedAt: string;
};

const storageKey = "gts:user-location:v1";
const maxAgeMs = 1000 * 60 * 60 * 24 * 30;

export function getStoredUserLocation(): StoredUserLocation | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as StoredUserLocation;
    const savedAt = Date.parse(parsed.savedAt);

    if (
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.lng) ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > maxAgeMs
    ) {
      clearStoredUserLocation();
      return undefined;
    }

    return parsed;
  } catch {
    clearStoredUserLocation();
    return undefined;
  }
}

export function saveUserLocation(
  location: { lat: number; lng: number },
  accuracy?: number,
) {
  if (typeof window === "undefined") {
    return;
  }

  const nextLocation: StoredUserLocation = {
    lat: location.lat,
    lng: location.lng,
    accuracy,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey, JSON.stringify(nextLocation));
}

export function clearStoredUserLocation() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

export function storedLocationLabel(location: StoredUserLocation) {
  const savedAt = Date.parse(location.savedAt);

  if (!Number.isFinite(savedAt)) {
    return "선택한 위치";
  }

  const minutes = Math.max(1, Math.round((Date.now() - savedAt) / 60000));

  if (minutes < 60) {
    return "최근 선택한 위치";
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return "오늘 선택한 위치";
  }

  return "선택한 위치";
}
