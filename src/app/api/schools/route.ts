import { fetchNearbyLiveSchools } from "@/lib/live-schools";
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
      message: "현재 위치 주변의 학교 후보를 찾지 못했습니다.",
    });
  }

  return Response.json({
    schools: [],
    source: "none",
    usedRadiusKm: radiusKm,
    message: "위치를 선택하면 공식 데이터가 확인된 주변 학교를 찾습니다.",
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
