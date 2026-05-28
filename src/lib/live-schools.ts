import "server-only";

import type {
  School,
  SchoolDataSource,
  SchoolDisclosureDetails,
  SchoolGender,
  SchoolLevel,
  SchoolMetrics,
} from "@/lib/types";
import { hasOfficialSchoolData } from "@/lib/school-data-quality";
import {
  createSchoolSlug,
  ensureUniqueSchoolSlugs,
  normalizeSchoolIdParam,
  schoolNameFromSlug,
} from "@/lib/school-slug";

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

type KakaoRegionResponse = {
  documents?: Array<{
    code?: string;
    region_type?: string;
  }>;
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

type SchoolDisclosureFacts = Partial<School["facts"]> & {
  disclosure?: SchoolDisclosureDetails;
};

type NearbySchoolSearchParams = {
  lat: number;
  lng: number;
  level?: SchoolLevel | "all";
  radiusKm?: number;
  limit?: number;
};

type SchoolNameSearchParams = {
  schoolName: string;
  region?: string;
  level?: SchoolLevel;
  includeDisclosureFacts?: boolean;
};

export type NearbySchoolSearchResult = {
  schools: School[];
  source: SchoolDataSource;
  usedRadiusKm: number;
};

const KAKAO_LOCAL_CATEGORY_URL =
  "https://dapi.kakao.com/v2/local/search/category.json";
const KAKAO_LOCAL_KEYWORD_URL =
  "https://dapi.kakao.com/v2/local/search/keyword.json";
const KAKAO_COORD2REGION_URL =
  "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";
const NEIS_SCHOOL_INFO_URL = "https://open.neis.go.kr/hub/schoolInfo";
const SCHOOL_DISCLOSURE_URL = "https://www.schoolinfo.go.kr/openApi.do";
const disclosureListCache = new Map<string, Promise<SchoolDisclosureRow[]>>();
const regionCodeCache = new Map<string, Promise<string | undefined>>();

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

    const schools = ensureUniqueSchoolSlugs(
      filteredPlaces
        .map(({ place, inferredLevel }, index) =>
          mapPlaceToSchool(
            place,
            inferredLevel!,
            neisRows[index],
            disclosureFacts[index],
          ),
        )
        .filter(hasOfficialSchoolData),
    );

    if (schools.length === 0) {
      return undefined;
    }

    return {
      schools,
      source: "kakao-neis",
      usedRadiusKm,
    };
  } catch {
    return undefined;
  }
}

export async function fetchLiveSchoolBySlug(id: string) {
  const kakaoRestKey = process.env.KAKAO_REST_API_KEY;
  const normalizedId = normalizeSchoolIdParam(id);
  const schoolName = schoolNameFromSlug(normalizedId);

  if (!kakaoRestKey || !schoolName) {
    return undefined;
  }

  try {
    const places = await fetchKakaoSchoolKeywordPlaces({
      query: schoolName,
      restKey: kakaoRestKey,
    });
    const filteredPlaces = uniqueBy(places, (place) => place.id)
      .map((place) => ({
        place,
        inferredLevel: inferLevel(place.place_name, place.category_name),
      }))
      .filter(({ inferredLevel }) => inferredLevel)
      .slice(0, 6);

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
    const schools = ensureUniqueSchoolSlugs(
      filteredPlaces
        .map(({ place, inferredLevel }, index) =>
          mapPlaceToSchool(
            place,
            inferredLevel!,
            neisRows[index],
            disclosureFacts[index],
          ),
        )
        .filter(hasOfficialSchoolData),
    );

    return (
      schools.find((school) => school.id === normalizedId) ??
      schools.find((school) => normalizeSchoolName(school.name) === schoolName) ??
      schools[0]
    );
  } catch {
    return undefined;
  }
}

export async function fetchLiveSchoolByName({
  schoolName,
  region,
  level = "high",
  includeDisclosureFacts = true,
}: SchoolNameSearchParams) {
  const kakaoRestKey = process.env.KAKAO_REST_API_KEY;

  if (!kakaoRestKey || !schoolName.trim()) {
    return undefined;
  }

  try {
    const query = region ? `${region} ${schoolName}` : schoolName;
    const places = await fetchKakaoSchoolKeywordPlaces({
      query,
      restKey: kakaoRestKey,
    });
    const fallbackPlaces =
      places.length > 0 || !region
        ? []
        : await fetchKakaoSchoolKeywordPlaces({
            query: schoolName,
            restKey: kakaoRestKey,
          });
    const filteredPlaces = uniqueBy([...places, ...fallbackPlaces], (place) => place.id)
      .map((place) => ({
        place,
        inferredLevel: inferLevel(place.place_name, place.category_name),
        matchScore: scoreSchoolNamePlaceMatch(place, schoolName, region),
      }))
      .filter(({ inferredLevel }) => inferredLevel === level)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);

    if (filteredPlaces.length === 0) {
      return undefined;
    }

    const neisRows = await Promise.all(
      filteredPlaces.map(({ place, inferredLevel }) =>
        fetchNeisSchoolInfo(place.place_name, inferredLevel),
      ),
    );
    const disclosureFacts = includeDisclosureFacts
      ? await Promise.all(
          filteredPlaces.map(({ place, inferredLevel }, index) =>
            fetchSchoolDisclosureFacts(place, inferredLevel!, neisRows[index]),
          ),
        )
      : filteredPlaces.map(() => undefined);
    const schools = ensureUniqueSchoolSlugs(
      filteredPlaces
        .map(({ place, inferredLevel }, index) =>
          mapPlaceToSchool(
            place,
            inferredLevel!,
            neisRows[index],
            disclosureFacts[index],
          ),
        )
        .filter(hasOfficialSchoolData),
    );
    const normalizedName = normalizeForMatch(schoolName);

    return (
      schools.find((school) => normalizeForMatch(school.name) === normalizedName) ??
      schools[0]
    );
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

async function fetchKakaoSchoolKeywordPlaces({
  query,
  restKey,
}: {
  query: string;
  restKey: string;
}) {
  const places: KakaoPlace[] = [];

  for (let page = 1; page <= 2; page += 1) {
    const url = new URL(KAKAO_LOCAL_KEYWORD_URL);
    url.search = new URLSearchParams({
      query,
      category_group_code: "SC4",
      page: String(page),
      size: "10",
    }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `KakaoAK ${restKey}`,
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      throw new Error("Kakao Local keyword request failed");
    }

    const data = (await response.json()) as KakaoCategoryResponse;
    places.push(...(data.documents ?? []));

    if (data.meta?.is_end) {
      break;
    }
  }

  return places;
}

async function fetchKakaoRegionCode(place: KakaoPlace) {
  const restKey = process.env.KAKAO_REST_API_KEY;
  const lng = Number(place.x);
  const lat = Number(place.y);

  if (!restKey || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return undefined;
  }

  const cacheKey = `${lng.toFixed(4)}:${lat.toFixed(4)}`;
  const cached = regionCodeCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const promise = fetchKakaoRegionCodeUncached({ lng, lat, restKey });
  regionCodeCache.set(cacheKey, promise);

  return promise;
}

async function fetchKakaoRegionCodeUncached({
  lng,
  lat,
  restKey,
}: {
  lng: number;
  lat: number;
  restKey: string;
}) {
  try {
    const url = new URL(KAKAO_COORD2REGION_URL);
    url.search = new URLSearchParams({
      x: String(lng),
      y: String(lat),
    }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `KakaoAK ${restKey}`,
      },
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as KakaoRegionResponse;
    const region =
      data.documents?.find((document) => document.region_type === "B") ??
      data.documents?.[0];
    const code = region?.code?.slice(0, 10);

    return code && /^\d{10}$/.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
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
  const commuteNote = formatCommute(place.distance);
  const metrics = inferMetrics(category, place.place_name, level, disclosureFacts);
  const tags = inferTags(category, place.place_name, level);
  const name = neis?.SCHUL_NM ?? place.place_name;

  const hasDisclosureFacts =
    Boolean(disclosureFacts?.students) ||
    Boolean(disclosureFacts?.classes) ||
    Boolean(disclosureFacts?.teachers) ||
    Boolean(disclosureFacts?.clubs) ||
    Boolean(disclosureFacts?.libraryBooks);
  const source: SchoolDataSource = neis || hasDisclosureFacts ? "kakao-neis" : "kakao";

  return {
    id: createSchoolSlug({ name, district, address }),
    name,
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
    description: buildSchoolDescription(disclosureFacts, hasDisclosureFacts),
    highlights: buildSchoolHighlights(disclosureFacts, commuteNote),
    metrics,
    source,
    externalIds: {
      kakaoPlaceId: place.id,
      neisSchoolCode: neis?.SD_SCHUL_CODE,
      neisOfficeCode: neis?.ATPT_OFCDC_SC_CODE,
    },
    dataUpdatedAt: new Date().toISOString(),
    disclosure: disclosureFacts?.disclosure,
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
  const regionCode = await fetchKakaoRegionCode(place);
  const sidoCode = inferSidoCode(
    firstPresent(neis?.ORG_RDNMA, place.road_address_name, place.address_name),
    neis,
  ) ?? regionCode?.slice(0, 2);
  const sggCode = regionCode?.slice(0, 5);

  if (!apiKey || !sidoCode || !sggCode) {
    return undefined;
  }

  const year = getDisclosureYear();
  const kindCode = level === "high" ? "04" : "03";
  const [
    studentRows,
    mealRows,
    libraryRows,
    scholarshipRows,
    clubRows,
    afterSchoolRows,
    counselingRows,
  ] = await Promise.all([
    fetchDisclosureList({
      apiKey,
      apiType: "09",
      year,
      sidoCode,
      sggCode,
      kindCode,
    }),
    fetchDisclosureList({
      apiKey,
      apiType: "34",
      year,
      sidoCode,
      sggCode,
      kindCode,
    }),
    fetchDisclosureList({
      apiKey,
      apiType: "38",
      year,
      sidoCode,
      sggCode,
      kindCode,
    }),
    fetchDisclosureList({
      apiKey,
      apiType: "55",
      year,
      sidoCode,
      sggCode,
      kindCode,
    }),
    fetchDisclosureList({
      apiKey,
      apiType: "56",
      year,
      sidoCode,
      sggCode,
      kindCode,
    }),
    fetchDisclosureList({
      apiKey,
      apiType: "59",
      year,
      sidoCode,
      sggCode,
      kindCode,
    }),
    fetchDisclosureList({
      apiKey,
      apiType: "61",
      year,
      sidoCode,
      sggCode,
      kindCode,
    }),
  ]);
  const names = [
    neis?.SCHUL_NM,
    normalizeSchoolName(place.place_name),
    place.place_name,
  ].filter(Boolean) as string[];
  const studentRow = findDisclosureRow(studentRows, names);
  const mealRow = findDisclosureRow(mealRows, names);
  const libraryRow = findDisclosureRow(libraryRows, names);
  const scholarshipRow = findDisclosureRow(scholarshipRows, names);
  const clubRow = findDisclosureRow(clubRows, names);
  const afterSchoolRow = findDisclosureRow(afterSchoolRows, names);
  const counselingRow = findDisclosureRow(counselingRows, names);

  if (
    !studentRow &&
    !mealRow &&
    !libraryRow &&
    !scholarshipRow &&
    !clubRow &&
    !afterSchoolRow &&
    !counselingRow
  ) {
    return undefined;
  }

  return {
    students: parseNumberField(studentRow, "COL_S_SUM"),
    classes: parseNumberField(studentRow, "COL_C_SUM"),
    teachers: parseNumberField(studentRow, "TEACH_CNT"),
    clubs: getClubCount(clubRow),
    mealSatisfaction: parseNumberField(mealRow, "KS_RATE"),
    disclosure: buildDisclosureDetails({
      year,
      mealRow,
      libraryRow,
      scholarshipRow,
      clubRow,
      afterSchoolRow,
      counselingRow,
    }),
  };
}

async function fetchDisclosureList({
  apiKey,
  apiType,
  year,
  sidoCode,
  sggCode,
  kindCode,
}: {
  apiKey: string;
  apiType: string;
  year: number;
  sidoCode: string;
  sggCode: string;
  kindCode: string;
}) {
  const cacheKey = `${apiType}:${year}:${sidoCode}:${sggCode}:${kindCode}`;
  const cached = disclosureListCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const promise = fetchDisclosureListUncached({
    apiKey,
    apiType,
    year,
    sidoCode,
    sggCode,
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
  sggCode,
  kindCode,
}: {
  apiKey: string;
  apiType: string;
  year: number;
  sidoCode: string;
  sggCode: string;
  kindCode: string;
}) {
  try {
    const url = new URL(SCHOOL_DISCLOSURE_URL);
    url.search = new URLSearchParams({
      apiKey,
      apiType,
      pbanYr: String(year),
      sidoCode,
      sggCode,
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

function scoreSchoolNamePlaceMatch(
  place: KakaoPlace,
  schoolName: string,
  region?: string,
) {
  const normalizedTarget = normalizeForMatch(schoolName);
  const normalizedPlaceName = normalizeForMatch(place.place_name);
  const placeAddress = `${place.road_address_name} ${place.address_name}`;
  let score = 0;

  if (normalizedPlaceName === normalizedTarget) {
    score += 100;
  } else if (normalizedPlaceName.includes(normalizedTarget)) {
    score += 60;
  }

  if (region) {
    const regionParts = region.split(/\s+/).filter(Boolean);
    score += regionParts.filter((part) => placeAddress.includes(part)).length * 18;
  }

  return score;
}

function getClubCount(row?: SchoolDisclosureRow) {
  const creativeClubCount = parseNumberField(row, "CREAT_EXPER_ACT_CCCLU_FGR");
  const studentClubCount = parseNumberField(row, "STDNT_SLCTL_CCCLU_FGR");
  const total = creativeClubCount + studentClubCount;

  return total > 0 ? total : Math.max(creativeClubCount, studentClubCount);
}

function buildDisclosureDetails({
  year,
  mealRow,
  libraryRow,
  scholarshipRow,
  clubRow,
  afterSchoolRow,
  counselingRow,
}: {
  year: number;
  mealRow?: SchoolDisclosureRow;
  libraryRow?: SchoolDisclosureRow;
  scholarshipRow?: SchoolDisclosureRow;
  clubRow?: SchoolDisclosureRow;
  afterSchoolRow?: SchoolDisclosureRow;
  counselingRow?: SchoolDisclosureRow;
}): SchoolDisclosureDetails | undefined {
  const details: SchoolDisclosureDetails = {
    year,
    library: compactObject({
      totalUsers: positiveNumberField(libraryRow, "ALL_IFRMA_UTILZ_STDNT_FGR"),
      weeklyAverageUsers: positiveNumberField(
        libraryRow,
        "WIK_AVRG_IFRMA_UTILZ_STDNT_FGR",
      ),
    }),
    meals: compactObject({
      targetStudents: positiveNumberField(mealRow, "HAKSAENGSU_TOT"),
      servedStudents: positiveNumberField(mealRow, "MLSV_STDNT_FGR"),
      cooks: positiveNumberField(mealRow, "COOK_FGR"),
      nutritionStaff: positiveNumberField(mealRow, "NTRST_FGR"),
      cookingAssistants: positiveNumberField(mealRow, "COOAS_FGR"),
      supplyRate: positiveNumberField(mealRow, "KS_RATE"),
    }),
    activities: compactObject({
      creativeClubs: positiveNumberField(clubRow, "CREAT_EXPER_ACT_CCCLU_FGR"),
      studentClubs: positiveNumberField(clubRow, "STDNT_SLCTL_CCCLU_FGR"),
      creativeParticipants: positiveNumberField(clubRow, "CREAT_EXPER_ACT_STDNT_FGR"),
      studentParticipants: positiveNumberField(clubRow, "STDNT_SLCTL_FGR"),
      creativeBudget: positiveNumberField(clubRow, "CREAT_EXPER_ACT_BDG_SPORT_AMT"),
      studentClubBudget: positiveNumberField(clubRow, "CCCLU_ACT_BDG_SPORT_AMT"),
    }),
    counseling: compactObject({
      weeClass: parseYesNoField(counselingRow, "WEE_CINSTL_YN"),
      internalSpecialist: parseYesNoField(counselingRow, "INNER_CNSL_SPLST_OPER_YN"),
      externalSpecialist: parseYesNoField(counselingRow, "EXTRL_CNSL_SPLST_OPER_YN"),
    }),
    afterSchool: compactObject({
      programs: positiveNumberField(afterSchoolRow, "SUM_ASL_PGM_FGR"),
      registeredStudents: positiveNumberField(afterSchoolRow, "SUM_ASL_REG_STDNT_FGR"),
      participatingStudents: positiveNumberField(afterSchoolRow, "ASL_PTPT_STDNT_FGR"),
      specialClasses: positiveNumberField(afterSchoolRow, "SPCLY_ADY_CCCCL_FGR"),
      eveningClasses: positiveNumberField(afterSchoolRow, "ECC_PM_OPER_CCCLA_FGR"),
    }),
    scholarships: compactObject({
      recipients: positiveNumberField(scholarshipRow, "NMPR_FGR_SUM"),
      amount: positiveNumberField(scholarshipRow, "AMT_SUM"),
    }),
  };
  const compactDetails = compactObject(details);

  return Object.keys(compactDetails).length > 1
    ? (compactDetails as SchoolDisclosureDetails)
    : undefined;
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
  const normalizedNeisCategory = normalizeHighSchoolCategory(
    neisHighSchoolCategory,
  );
  const nameSpecificCategory = inferNameSpecificHighSchoolCategory(
    `${name} ${categoryName}`,
  );

  if (level === "high" && isGiftedSchoolName(name, text)) {
    return "영재학교";
  }

  if (level === "high" && normalizedNeisCategory) {
    return normalizedNeisCategory;
  }

  if (level === "high" && nameSpecificCategory) {
    return nameSpecificCategory;
  }

  if (isScienceHighSchoolName(name)) {
    return "과학고";
  }
  if (/외국어|국제/.test(text)) {
    return "외국어·국제고";
  }
  if (/마이스터/.test(text)) {
    return "마이스터고";
  }
  if (/특성화|공업|상업|디자인|관광|정보|기술|로봇/.test(text)) {
    return "특성화고";
  }

  return level === "high" ? "일반고" : "일반중";
}

function inferNameSpecificHighSchoolCategory(text: string) {
  if (/영재/.test(text)) {
    return "영재학교";
  }
  if (isScienceHighSchoolName(text)) {
    return "과학고";
  }
  if (/외국어|외고|국제/.test(text)) {
    return "외국어·국제고";
  }
  if (/마이스터/.test(text)) {
    return "마이스터고";
  }
  if (/예술|예고/.test(text)) {
    return "예술고";
  }
  if (/체육|체고/.test(text)) {
    return "체육고";
  }
  if (/특성화|공업|상업|디자인|관광|정보|기술|로봇/.test(text)) {
    return "특성화고";
  }

  return undefined;
}

function normalizeHighSchoolCategory(value?: string) {
  if (!value || value === "해당없음" || value === "특목고") {
    return undefined;
  }

  if (/영재/.test(value)) {
    return "영재학교";
  }
  if (/자율|자사/.test(value)) {
    return value;
  }
  if (/일반/.test(value)) {
    return "일반고";
  }
  if (/특성화|공업|상업|디자인|관광|정보|기술|로봇/.test(value)) {
    return "특성화고";
  }
  if (/마이스터/.test(value)) {
    return "마이스터고";
  }

  return value;
}

function isGiftedSchoolName(name: string, text: string) {
  return (
    /영재/.test(text) ||
    /^(서울과학고등학교|경기과학고등학교|대구과학고등학교|대전과학고등학교|광주과학고등학교)$/.test(
      name,
    )
  );
}

function isScienceHighSchoolName(value: string) {
  const text = value.replace(/\s+/g, "");

  return /^(강원|경남|경북|경산|경기북|대구일|대전동신|부산|부산일|세종|울산|인천|인천진산|전남|전북|제주|창원|충남|충북|한성)과학고등학교$/.test(
    text,
  );
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
  facts?: SchoolDisclosureFacts,
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

  if (/영재|과학|외국어|국제/.test(text)) {
    metrics.academics += 12;
    metrics.activities += 5;
  }

  if (/특성화|마이스터|공업|상업|디자인|관광|정보|기술|로봇/.test(text)) {
    metrics.activities += 12;
    metrics.environment += 4;
  }

  if (/일반고/.test(category)) {
    metrics.academics += 5;
    metrics.stability += 5;
  }

  const studentsPerClass = ratio(facts?.students, facts?.classes);
  const studentsPerTeacher = ratio(facts?.students, facts?.teachers);

  if (studentsPerClass > 0) {
    metrics.environment = Math.max(metrics.environment, 98 - studentsPerClass);
  }

  if (studentsPerTeacher > 0) {
    metrics.stability = Math.max(metrics.stability, 104 - studentsPerTeacher * 2.3);
  }

  if (isPositive(facts?.clubs)) {
    metrics.activities = Math.max(metrics.activities, 58 + (facts?.clubs ?? 0) * 0.95);
  }

  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [key, clamp(value, 0, 100)]),
  ) as SchoolMetrics;
}

function buildSchoolDescription(
  facts: SchoolDisclosureFacts | undefined,
  hasDisclosureFacts: boolean,
) {
  if (!hasDisclosureFacts) {
    return "선택한 위치 주변에서 확인된 학교입니다. 학교 생활과 통학 조건을 함께 비교할 수 있습니다.";
  }

  const details: string[] = [];
  const studentsPerClass = ratio(facts?.students, facts?.classes);
  const studentsPerTeacher = ratio(facts?.students, facts?.teachers);

  if (isPositive(facts?.students)) {
    details.push(`학생 ${formatWhole(facts?.students)}명`);
  }

  if (studentsPerClass > 0) {
    details.push(`학급당 ${formatDecimal(studentsPerClass)}명`);
  }

  if (studentsPerTeacher > 0) {
    details.push(`교원 1인당 ${formatDecimal(studentsPerTeacher)}명`);
  }

  if (isPositive(facts?.clubs)) {
    details.push(`동아리 ${formatWhole(facts?.clubs)}개`);
  }

  if (isPositive(facts?.libraryBooks)) {
    details.push(`장서 ${formatWhole(facts?.libraryBooks)}권`);
  }

  if (details.length === 0) {
    return "학교 생활과 통학 조건을 함께 비교할 수 있습니다.";
  }

  return `${details.join(", ")} 기준으로 학교 규모와 활동 여건을 비교할 수 있습니다.`;
}

function buildSchoolHighlights(
  facts: SchoolDisclosureFacts | undefined,
  commuteNote: string,
) {
  const highlights: string[] = [];
  const studentsPerClass = ratio(facts?.students, facts?.classes);
  const studentsPerTeacher = ratio(facts?.students, facts?.teachers);

  if (studentsPerClass > 0) {
    highlights.push(`학급당 ${formatDecimal(studentsPerClass)}명`);
  }

  if (studentsPerTeacher > 0) {
    highlights.push(`교원당 ${formatDecimal(studentsPerTeacher)}명`);
  }

  if (isPositive(facts?.clubs)) {
    highlights.push(`동아리 ${formatWhole(facts?.clubs)}개`);
  }

  if (isPositive(facts?.libraryBooks)) {
    highlights.push(`장서 ${formatWhole(facts?.libraryBooks)}권`);
  }

  if (highlights.length === 0) {
    highlights.push("위치 조건에 맞는 후보");
  }

  highlights.push(commuteNote);

  return [...new Set(highlights)].slice(0, 4);
}

function inferTags(category: string, name: string, level: SchoolLevel) {
  const text = `${category} ${name}`;
  const tags = new Set<string>([
    "위치 확인",
    level === "high" ? "고등학교" : "중학교",
  ]);

  if (/영재/.test(text)) {
    tags.add("영재");
    tags.add("과학");
    tags.add("연구");
  } else if (/과학/.test(text)) {
    tags.add("과학");
    tags.add("연구");
  }
  if (/외국어|국제/.test(text)) {
    tags.add("어학");
    tags.add("국제");
  }
  if (/특성화|마이스터|공업|상업|디자인|관광|정보|기술|로봇/.test(text)) {
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

function positiveNumberField(row: SchoolDisclosureRow | undefined, key: string) {
  const value = parseNumberField(row, key);
  return value > 0 ? value : undefined;
}

function parseYesNoField(row: SchoolDisclosureRow | undefined, key: string) {
  const value = String(row?.[key] ?? "").trim();

  if (!value) {
    return undefined;
  }

  if (/^(Y|YES|TRUE|1|운영|설치|있음|예|○)$/i.test(value)) {
    return true;
  }

  if (/^(N|NO|FALSE|0|미운영|미설치|없음|아니오|X)$/i.test(value)) {
    return false;
  }

  return undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined) {
        return false;
      }

      return !(
        typeof entry === "object" &&
        entry !== null &&
        !Array.isArray(entry) &&
        Object.keys(entry).length === 0
      );
    }),
  ) as Partial<T>;
}

function formatCommute(distance?: string) {
  const meters = Number(distance);

  if (!Number.isFinite(meters) || meters <= 0) {
    return "선택한 위치 주변";
  }

  return meters < 1000
    ? `선택한 위치에서 약 ${Math.round(meters)}m`
    : `선택한 위치에서 약 ${(meters / 1000).toFixed(1)}km`;
}

function ratio(numerator?: number, denominator?: number) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    !denominator ||
    denominator <= 0
  ) {
    return 0;
  }

  return (numerator ?? 0) / denominator;
}

function isPositive(value?: number) {
  return Number.isFinite(value) && (value ?? 0) > 0;
}

function formatWhole(value?: number) {
  return Math.round(value ?? 0).toLocaleString("ko-KR");
}

function formatDecimal(value: number) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
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
