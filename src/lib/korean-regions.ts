const broadRegionAliases: Array<[string, string[]]> = [
  ["서울", ["서울", "서울특별시"]],
  ["부산", ["부산", "부산광역시"]],
  ["대구", ["대구", "대구광역시"]],
  ["인천", ["인천", "인천광역시"]],
  ["광주", ["광주", "광주광역시"]],
  ["대전", ["대전", "대전광역시"]],
  ["울산", ["울산", "울산광역시"]],
  ["세종", ["세종", "세종특별자치시"]],
  ["경기", ["경기", "경기도"]],
  ["강원", ["강원", "강원도", "강원특별자치도"]],
  ["충북", ["충북", "충청북도"]],
  ["충남", ["충남", "충청남도"]],
  ["전북", ["전북", "전라북도", "전북특별자치도"]],
  ["전남", ["전남", "전라남도"]],
  ["경북", ["경북", "경상북도"]],
  ["경남", ["경남", "경상남도"]],
  ["제주", ["제주", "제주도", "제주특별자치도"]],
];

export function normalizeBroadRegionName(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, "");

  return (
    broadRegionAliases.find(([, aliases]) =>
      aliases.some((alias) => normalized.includes(alias.replace(/\s+/g, ""))),
    )?.[0] ?? normalized.slice(0, 2)
  );
}

export function isSameBroadRegion(
  value: string | undefined,
  broadRegion: string | undefined,
) {
  const normalizedValue = normalizeBroadRegionName(value);
  const normalizedRegion = normalizeBroadRegionName(broadRegion);

  return Boolean(
    normalizedValue &&
      normalizedRegion &&
      normalizedValue === normalizedRegion,
  );
}
