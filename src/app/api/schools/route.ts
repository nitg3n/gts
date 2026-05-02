import { filterSchools } from "@/lib/schools";
import type { SchoolLevel } from "@/lib/types";
import { distanceKm } from "@/lib/utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const level = parseLevel(url.searchParams.get("level"));
  const lat = parseNumber(url.searchParams.get("lat"));
  const lng = parseNumber(url.searchParams.get("lng"));
  const radiusKm = parseNumber(url.searchParams.get("radiusKm"));

  const schools = filterSchools(level)
    .map((school) => {
      const distance =
        typeof lat === "number" && typeof lng === "number"
          ? distanceKm({ lat, lng }, school)
          : undefined;

      return {
        ...school,
        distanceKm: distance,
      };
    })
    .filter((school) => {
      if (typeof radiusKm !== "number" || typeof school.distanceKm !== "number") {
        return true;
      }

      return school.distanceKm <= radiusKm;
    })
    .sort((a, b) => {
      if (typeof a.distanceKm !== "number" || typeof b.distanceKm !== "number") {
        return a.name.localeCompare(b.name, "ko");
      }

      return a.distanceKm - b.distanceKm;
    });

  return Response.json({ schools });
}

function parseLevel(value: string | null): SchoolLevel | "all" {
  return value === "middle" || value === "high" ? value : "all";
}

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
