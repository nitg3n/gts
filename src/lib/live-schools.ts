import "server-only";

import type {
  School,
  SchoolDataSource,
  SchoolGender,
  SchoolLevel,
  SchoolMetrics,
} from "@/lib/types";

type KakaoPlace = {
  id: string;
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
  distance?: string;
};

type KakaoCategoryResponse = {
  documents?: KakaoPlace[];
  meta?: {
    is_end?: boolean;
  };
};

type NeisSchoolInfoRow = {
  ATPT_OFCDC_SC_CODE?: string;
  ATPT_OFCDC_SC_NM?: string;
  SD_SCHUL_CODE?: string;
  SCHUL_NM?: string;
  SCHUL_KND_SC_NM?: string;
  LCTN_SC_NM?: string;
  ORG_RDNMA?: string;
  ORG_RDNDA?: string;
  ORG_TELNO?: string;
  HMPG_ADRES?: string;
  COEDU_SC_NM?: string;
  HS_SC_NM?: string;
  FOND_YMD?: string;
};

type NeisSchoolInfoResponse = {
  schoolInfo?: Array<{
    row?: NeisSchoolInfoRow[];
  }>;
};

type SchoolDisclosureRow = Record<string, string | number | undefined> & {
  SCHUL_NM?: string;
};

type SchoolDisclosureResponse = {
  resultCode?: string;
  resultMsg?: string;
  list?: SchoolDisclosureRow[];
};

type SchoolDisclosureFacts = Partial<School["facts"]>;

type NearbySchoolSearchParams = {
  lat: number;
  lng: number;
  level?: SchoolLevel | "all";
  radiusKm?: number;
  limit?: number;
};

export type NearbySchoolSearchResult = {
  schools: School[];
  source: SchoolDataSource;
  usedRadiusKm: number;
};

const KAKAO_LOCAL_CATEGORY_URL =
  "https://dapi.kakao.com/v2/local/search/category.json";
const NEIS_SCHOOL_INFO_URL = "https://open.neis.go.kr/hub/schoolInfo";
const SCHOOL_DISCLOSURE_URL = "https://www.schoolinfo.go.kr/openApi.do";
const disclosureListCache = new Map<string, Promise<SchoolDisclosureRow[]>>();

export async function fetchNearbyLiveSchools({
  lat,
  lng,
  level = "all",
  radiusKm = 20,
  limit = 30,
}: NearbySchoolSearchParams): Promise<NearbySchoolSearchResult | undefined> {
  const kakaoRestKey = process.env.KAKAO_REST_API_KEY;

  if (!kakaoRestKey || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }

  const usedRadiusKm = clamp(radiusKm, 1, 20);

  try {
    const places = await fetchKakaoSchoolPlaces({
      lat,
      lng,
      radiusMeters: Math.round(usedRadiusKm * 1000),
      restKey: kakaoRestKey,
    });

    const filteredPlaces = uniqueBy(places, (place) => place.id)
      .map((place) => ({
        place,
        inferredLevel: inferLevel(
          place.place_name,
          place.category_name,
          undefined,
        ),
      }))
      .filter(({ inferredLevel }) => inferredLevel)
      .filter(({ inferredLevel }) => level === "all" || inferredLevel === level)
      .slice(0, limit);

    if (filteredPlaces.length === 0) {
      return undefined;
    }

    const neisRows = await Promise.all(
      filteredPlaces.map(({ place, inferredLevel }) =>
        fetchNeisSchoolInfo(place.place_name, inferredLevel),
      ),
    );

    const disclosureFacts = await Promise.all(
      filteredPlaces.map(({ place, inferredLevel }, index) =>
        fetchSchoolDisclosureFacts(place, inferredLevel!, neisRows[index]),
      ),
    );

    const schools = filteredPlaces.map(({ place, inferredLevel }, index) =>
      mapPlaceToSchool(
        place,
        inferredLevel!,
        neisRows[index],
        disclosureFacts[index],
      ),
    );

    return {
      schools,
      source: schools.some((school) => school.source === "kakao-neis")
        ? "kakao-neis"
        : "kakao",
      usedRadiusKm,
    };
  } catch {
    return undefined;
  }
}

async function fetchKakaoSchoolPlaces({
  lat,
  lng,
  radiusMeters,
  restKey,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  restKey: string;
}) {
  const places: KakaoPlace[] = [];

  for (let page = 1; page <= 3; page += 1) {
    const url = new URL(KAKAO_LOCAL_CATEGORY_URL);
    url.search = new URLSearchParams({
      category_group_code: "SC4",
      x: String(lng),
      y: String(lat),
      radius: String(radiusMeters),
      sort: "distance",
      page: String(page),
      size: "15",
    }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `KakaoAK ${restKey}`,
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      throw new Error("Kakao Local request failed");
    }

    const data = (await response.json()) as KakaoCategoryResponse;
    places.push(...(data.documents ?? []));

    if (data.meta?.is_end) {
      break;
    }
  }

  return places;
}

async function fetchNeisSchoolInfo(
  placeName: string,
  level?: SchoolLevel,
): Promise<NeisSchoolInfoRow | undefined> {
  const key = process.env.NEIS_OPEN_API_KEY;

  if (!key) {
    return undefined;
  }

  try {
    const url = new URL(NEIS_SCHOOL_INFO_URL);
    url.search = new URLSearchParams({
      KEY: key,
      Type: "json",
      pIndex: "1",
      pSize: "10",
      SCHUL_NM: normalizeSchoolName(placeName),
    }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as NeisSchoolInfoResponse;
    const rows = data.schoolInfo?.flatMap((item) => item.row ?? []) ?? [];

    return (
      rows.find((row) => inferLevel(row.SCHUL_NM, "", row) === level) ??
      rows[0]
    );
  } catch {
    return undefined;
  }
}

function mapPlaceToSchool(
  place: KakaoPlace,
  fallbackLevel: SchoolLevel,
  neis?: NeisSchoolInfoRow,
  disclosureFacts?: SchoolDisclosureFacts,
): School {
  const level = inferLevel(place.place_name, place.category_name, neis) ?? fallbackLevel;
  const category = inferCategory(place.place_name, place.category_name, neis, level);
  const address = firstPresent(
    neis?.ORG_RDNMA,
    place.road_address_name,
    place.address_name,
  );
  const district = inferDistrict(address, neis);
  const gender = inferGender(neis?.COEDU_SC_NM);
  const source: SchoolDataSource = neis ? "kakao-neis" : "kakao";
  const metrics = inferMetrics(category, place.place_name, level);
  const commuteNote = formatCommute(place.distance);
  const tags = inferTags(category, place.place_name, level);

  const hasDisclosureFacts =
    Boolean(disclosureFacts?.students) ||
    Boolean(disclosureFacts?.classes) ||
    Boolean(disclosureFacts?.teachers) ||
    Boolean(disclosureFacts?.clubs);

  return {
    id: `kakao-${place.id}`,
    name: neis?.SCHUL_NM ?? place.place_name,
    level,
    category,
    district,
    address,
    lat: Number(place.y),
    lng: Number(place.x),
    gender,
    founded: inferFoundedYear(neis?.FOND_YMD),
    phone: firstPresent(neis?.ORG_TELNO, place.phone),
    website: firstPresent(neis?.HMPG_ADRES, place.place_url),
    tags,
    description:
      hasDisclosureFacts
        ? "현재 위치 주변에서 찾은 실제 학교이며, NEIS 기본정보와 학교알리미 공시 지표를 함께 반영했습니다."
        : source === "kakao-neis"
        ? "현재 위치 주변에서 찾은 실제 학교이며, NEIS 학교기본정보로 기본 정보를 보강했습니다."
        : "현재 위치 주변에서 찾은 실제 학교입니다. 세부 공시 정보는 추가 연동이 필요합니다.",
    highlights: [
      "현재 위치 기반 실제 후보",
      hasDisclosureFacts
        ? "학교알리미 공시 지표 반영"
        : source === "kakao-neis"
          ? "NEIS 기본정보 매칭"
          : "Kakao Local 위치 정보",
      commuteNote,
    ],
    metrics,
    source,
    externalIds: {
      kakaoPlaceId: place.id,
      neisSchoolCode: neis?.SD_SCHUL_CODE,
      neisOfficeCode: neis?.ATPT_OFCDC_SC_CODE,
    },
    dataUpdatedAt: new Date().toISOString(),
    facts: {
      students: disclosureFacts?.students ?? 0,
      classes: disclosureFacts?.classes ?? 0,
      teachers: disclosureFacts?.teachers ?? 0,
      clubs: disclosureFacts?.clubs ?? 0,
      libraryBooks: disclosureFacts?.libraryBooks ?? 0,
      mealSatisfaction: disclosureFacts?.mealSatisfaction ?? 0,
      commuteNote,
    },
  };
}

async function fetchSchoolDisclosureFacts(
  place: KakaoPlace,
  level: SchoolLevel,
  neis?: NeisSchoolInfoRow,
): Promise<SchoolDisclosureFacts | undefined> {
  const apiKey = process.env.SCHOOL_INFO_OPEN_API_KEY;
  const sidoCode = inferSidoCode(
    firstPresent(neis?.ORG_RDNMA, place.road_address_name, place.address_name),
    neis,
  );

  if (!apiKey || !sidoCode) {
    return undefined;
  }

  const year = getDisclosureYear();
  const kindCode = level === "high" ? "04" : "03";
  const [studentRows, clubRows] = await Promise.all([
    fetchDisclosureList({
      apiKey,
      apiType: "09",
      year,
      sidoCode,
      kindCode,
    }),
    fetchDisclosureList({
      apiKey,
      apiType: "56",
      year,
      sidoCode,
      kindCode,
    }),
  ]);
  const names = [
    neis?.SCHUL_NM,
    normalizeSchoolName(place.place_name),
    place.place_name,
  ].filter(Boolean) as string[];
  const studentRow = findDisclosureRow(studentRows, names);
  const clubRow = findDisclosureRow(clubRows, names);

  if (!studentRow && !clubRow) {
    return undefined;
  }

  return {
    students: parseNumberField(studentRow, "COL_S_SUM"),
    classes: parseNumberField(studentRow, "COL_C_SUM"),
    teachers: parseNumberField(studentRow, "TEACH_CNT"),
    clubs: getClubCount(clubRow),
  };
}

async function fetchDisclosureList({
  apiKey,
  apiType,
  year,
  sidoCode,
  kindCode,
}: {
  apiKey: string;
  apiType: string;
  year: number;
  sidoCode: string;
  kindCode: string;
}) {
  const cacheKey = `${apiType}:${year}:${sidoCode}:${kindCode}`;
  const cached = disclosureListCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const promise = fetchDisclosureListUncached({
    apiKey,
    apiType,
    year,
    sidoCode,
    kindCode,
  });
  disclosureListCache.set(cacheKey, promise);

  return promise;
}

async function fetchDisclosureListUncached({
  apiKey,
  apiType,
  year,
  sidoCode,
  kindCode,
}: {
  apiKey: string;
  apiType: string;
  year: number;
  sidoCode: string;
  kindCode: string;
}) {
  try {
    const url = new URL(SCHOOL_DISCLOSURE_URL);
    url.search = new URLSearchParams({
      apiKey,
      apiType,
      pbanYr: String(year),
      sidoCode,
      sggCode: "00000",
      schulKndCode: kindCode,
    }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as SchoolDisclosureResponse;
    return data.resultCode === "success" ? (data.list ?? []) : [];
  } catch {
    return [];
  }
}

function findDisclosureRow(rows: SchoolDisclosureRow[], schoolNames: string[]) {
  const normalizedNames = schoolNames.map(normalizeForMatch);

  return rows.find((row) => {
    const name = normalizeForMatch(row.SCHUL_NM ?? "");
    return normalizedNames.some(
      (schoolName) => name === schoolName || name.includes(schoolName),
    );
  });
}

function getClubCount(row?: SchoolDisclosureRow) {
  const creativeClubCount = parseNumberField(row, "CREAT_EXPER_ACT_CCCLU_FGR");
  const studentClubCount = parseNumberField(row, "STDNT_SLCTL_CCCLU_FGR");
  const total = creativeClubCount + studentClubCount;

  return total > 0 ? total : Math.max(creativeClubCount, studentClubCount);
}

function inferLevel(
  name = "",
  categoryName = "",
  neis?: NeisSchoolInfoRow,
): SchoolLevel | undefined {
  const text = `${neis?.SCHUL_KND_SC_NM ?? ""} ${name} ${categoryName}`;

  if (/고등학교|고교/.test(text)) {
    return "high";
  }

  if (/중학교|중학/.test(text)) {
    return "middle";
  }

  return undefined;
}

function inferCategory(
  name: string,
  categoryName: string,
  neis: NeisSchoolInfoRow | undefined,
  level: SchoolLevel,
) {
  const text = `${neis?.HS_SC_NM ?? ""} ${name} ${categoryName}`;
  const neisHighSchoolCategory = neis?.HS_SC_NM?.trim();

  if (
    level === "high" &&
    neisHighSchoolCategory &&
    neisHighSchoolCategory !== "해당없음"
  ) {
    return neisHighSchoolCategory;
  }

  if (/과학/.test(text)) {
    return "과학고";
  }
  if (/외국어|국제/.test(text)) {
    return "외국어·국제고";
  }
  if (/마이스터/.test(text)) {
    return "마이스터고";
  }
  if (/특성화|공업|상업|디자인|관광|정보|로봇/.test(text)) {
    return "특성화고";
  }

  return level === "high" ? "일반고" : "일반중";
}

function inferGender(value?: string): SchoolGender {
  if (!value) {
    return "coed";
  }

  if (/남여공학|남녀공학|공학/.test(value)) {
    return "coed";
  }
  if (/남/.test(value)) {
    return "boys";
  }
  if (/여/.test(value)) {
    return "girls";
  }

  return "coed";
}

function inferMetrics(
  category: string,
  name: string,
  level: SchoolLevel,
): SchoolMetrics {
  const text = `${category} ${name}`;
  const metrics: SchoolMetrics = {
    academics: level === "high" ? 74 : 70,
    activities: 70,
    environment: 72,
    meal: 64,
    reviews: 58,
    stability: 72,
  };

  if (/과학|외국어|국제/.test(text)) {
    metrics.academics += 12;
    metrics.activities += 5;
  }

  if (/특성화|마이스터|공업|상업|디자인|관광|정보|로봇/.test(text)) {
    metrics.activities += 12;
    metrics.environment += 4;
  }

  if (/일반고/.test(category)) {
    metrics.academics += 5;
    metrics.stability += 5;
  }

  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [key, clamp(value, 0, 100)]),
  ) as SchoolMetrics;
}

function inferTags(category: string, name: string, level: SchoolLevel) {
  const text = `${category} ${name}`;
  const tags = new Set<string>([
    "실제 위치",
    level === "high" ? "고등학교" : "중학교",
  ]);

  if (/과학/.test(text)) {
    tags.add("과학");
    tags.add("연구");
  }
  if (/외국어|국제/.test(text)) {
    tags.add("어학");
    tags.add("국제");
  }
  if (/특성화|마이스터|공업|상업|디자인|관광|정보|로봇/.test(text)) {
    tags.add("실습");
    tags.add("진로");
  }
  if (/일반고/.test(category)) {
    tags.add("진학");
  }

  tags.add("통학");

  return [...tags].slice(0, 6);
}

function inferDistrict(address: string, neis?: NeisSchoolInfoRow) {
  const neisLocation = neis?.LCTN_SC_NM?.trim();

  if (neisLocation) {
    return neisLocation;
  }

  return address.split(/\s+/).slice(0, 2).join(" ") || "위치 확인";
}

function inferSidoCode(address: string, neis?: NeisSchoolInfoRow) {
  const text = `${neis?.LCTN_SC_NM ?? ""} ${address}`;
  const entries: Array<[string, string]> = [
    ["서울", "11"],
    ["부산", "26"],
    ["대구", "27"],
    ["인천", "28"],
    ["광주", "29"],
    ["대전", "30"],
    ["울산", "31"],
    ["세종", "36"],
    ["경기", "41"],
    ["충북", "43"],
    ["충청북", "43"],
    ["충남", "44"],
    ["충청남", "44"],
    ["전남", "46"],
    ["전라남", "46"],
    ["경북", "47"],
    ["경상북", "47"],
    ["경남", "48"],
    ["경상남", "48"],
    ["제주", "50"],
    ["강원", "51"],
    ["전북", "52"],
    ["전라북", "52"],
  ];

  return entries.find(([label]) => text.includes(label))?.[1];
}

function inferFoundedYear(value?: string) {
  const year = Number(value?.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : 0;
}

function getDisclosureYear() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const date = today.getDate();
  const currentYearIsPublic = month > 4 || (month === 4 && date >= 30);

  return currentYearIsPublic ? year : year - 1;
}

function normalizeSchoolName(name: string) {
  return name.replace(/\([^)]*\)/g, "").trim();
}

function normalizeForMatch(value: string) {
  return normalizeSchoolName(value).replace(/\s+/g, "");
}

function parseNumberField(row: SchoolDisclosureRow | undefined, key: string) {
  const value = row?.[key];
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replaceAll(",", ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCommute(distance?: string) {
  const meters = Number(distance);

  if (!Number.isFinite(meters) || meters <= 0) {
    return "Kakao Local 기준 위치";
  }

  return meters < 1000
    ? `현재 위치에서 약 ${Math.round(meters)}m`
    : `현재 위치에서 약 ${(meters / 1000).toFixed(1)}km`;
}

function firstPresent(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? "";
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
