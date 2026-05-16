import type { School } from "@/lib/types";

const storageKey = "gts:compare-schools:v1";
const changeEventName = "gts:compare-schools-changed";
export const maxCompareSchools = 6;

export function getStoredCompareSchools() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as School[]) : [];

    return Array.isArray(parsed)
      ? parsed.filter((school) => school && typeof school.id === "string")
      : [];
  } catch {
    clearCompareSchools();
    return [];
  }
}

export function saveStoredCompareSchools(schools: School[]) {
  const nextSchools = schools.slice(0, maxCompareSchools);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(nextSchools));
    window.dispatchEvent(new Event(changeEventName));
  }

  return nextSchools;
}

export function addSchoolsToCompare(schools: School | School[]) {
  const nextSchools = Array.isArray(schools) ? schools : [schools];
  return saveStoredCompareSchools(
    mergeCompareSchools(getStoredCompareSchools(), nextSchools),
  );
}

export function removeSchoolFromCompare(id: string) {
  return saveStoredCompareSchools(
    getStoredCompareSchools().filter((school) => school.id !== id),
  );
}

export function clearCompareSchools() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(changeEventName));
  }
}

export function hasSchoolInCompare(id: string) {
  return getStoredCompareSchools().some((school) => school.id === id);
}

export function mergeCompareSchools(current: School[], incoming: School[]) {
  const byId = new Map(current.map((school) => [school.id, school]));

  incoming.forEach((school) => {
    if (!school?.id) {
      return;
    }

    const currentSchool = byId.get(school.id);
    byId.set(school.id, currentSchool ? { ...currentSchool, ...school } : school);
  });

  return Array.from(byId.values()).slice(-maxCompareSchools);
}

export function subscribeCompareSchools(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(changeEventName, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(changeEventName, listener);
    window.removeEventListener("storage", listener);
  };
}
