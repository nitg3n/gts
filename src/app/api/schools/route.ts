import { fetchNearbyLiveSchools } from "@/lib/live-schools";
import { cacheSchools } from "@/lib/store";
import { distanceKm } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const level = "high";
  const lat = parseNumber(url.searchParams.get("lat"));
  const lng = parseNumber(url.searchParams.get("lng"));
  const radiusKm = parseNumber(url.searchParams.get("radiusKm"));

  if (typeof lat === "number" && typeof lng === "number") {
    if (!isValidCoordinate(lat, lng)) {
      return Response.json(
        {
          schools: [],
          source: "none",
          message: "위치 좌표를 확인해주세요.",
        },
        { status: 400 },
      );
    }

    const liveResult = await fetchNearbyLiveSchools({
      lat,
      lng,
      level,
      radiusKm,
    });

    if (liveResult?.schools.length) {
      const schools = liveResult.schools
        .filter((school) => school.level === "high")
        .map((school) => ({
          ...school,
          distanceKm: distanceKm({ lat, lng }, school),
        }));

      if (schools.length) {
        cacheSchools(schools);

        return Response.json({
          schools,
          source: liveResult.source,
          usedRadiusKm: liveResult.usedRadiusKm,
        });
      }
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

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isValidCoordinate(lat: number, lng: number) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
