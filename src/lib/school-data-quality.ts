import type { School } from "@/lib/types";

export function hasOfficialSchoolData(school: School) {
  return (
    school.source === "kakao-neis" ||
    Boolean(school.externalIds?.neisSchoolCode || school.externalIds?.neisOfficeCode) ||
    hasPositiveOfficialFact(school)
  );
}

function hasPositiveOfficialFact(school: School) {
  return (
    school.facts.students > 0 ||
    school.facts.classes > 0 ||
    school.facts.teachers > 0 ||
    school.facts.clubs > 0 ||
    school.facts.libraryBooks > 0
  );
}
