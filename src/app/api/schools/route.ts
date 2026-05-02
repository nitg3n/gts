import { fetchNearbyLiveSchools } from "@/lib/live-schools";
import { filterSchools } from "@/lib/schools";
import { cacheSchools } from "@/lib/store";
import type { SchoolLevel } from "@/lib/types";
import { distanceKm } from "@/lib/utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const level = parseLevel(url.searchParams.get("level"));
  const lat = parseNumber(url.searchParams.get("lat"));
  const lng = parseNumber(url.searchParams.get("lng"));
  const radiusKm = parseNumber(url.searchParams.get("radiusKm"));

  if (typeof lat === "number" && typeof lng === "number") {
    const liveResult = await fetchNearbyLiveSchools({
      lat,
      lng,
      level,
      radiusKm,
    });

    if (liveResult?.schools.length) {
      const schools = liveResult.schools.map((school) => ({
        ...school,
        distanceKm: distanceKm({ lat, lng }, school),
      }));

      cacheSchools(schools);

      return Response.json({
        schools,
        source: liveResult.source,
        usedRadiusKm: liveResult.usedRadiusKm,
      });
    }

    return Response.json({
      schools: [],
      source: "none",
      usedRadiusKm: radiusKm,
      message: "현재 위치 주변의 실제 학교 후보를 찾지 못했습니다.",
    });
  }

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

  cacheSchools(schools);

  return Response.json({
    schools,
    source: "seed",
    usedRadiusKm: radiusKm,
  });
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
