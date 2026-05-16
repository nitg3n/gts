export function createSchoolSlug({
  name,
  district,
  address,
}: {
  name: string;
  district?: string;
  address?: string;
}) {
  const namePart = toSlugPart(name) || "school";
  const locationPart = toSlugPart(district || addressDistrict(address ?? ""));

  return [namePart, locationPart].filter(Boolean).join("-");
}

export function ensureUniqueSchoolSlugs<T extends { id: string }>(schools: T[]) {
  const seen = new Map<string, number>();

  return schools.map((school) => {
    const count = seen.get(school.id) ?? 0;
    seen.set(school.id, count + 1);

    if (count === 0) {
      return school;
    }

    return {
      ...school,
      id: `${school.id}-${count + 1}`,
    };
  });
}

export function normalizeSchoolIdParam(id: string) {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export function schoolNameFromSlug(id: string) {
  const normalizedId = normalizeSchoolIdParam(id);
  const [name] = normalizedId.split("-");

  return name?.trim() || normalizedId;
}

function toSlugPart(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^0-9a-z가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function addressDistrict(address: string) {
  return address.split(/\s+/).slice(0, 2).join(" ");
}
