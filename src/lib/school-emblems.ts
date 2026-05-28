import { schoolEmblemCodes } from "@/data/school-emblem-codes";
import type { School } from "@/lib/types";

const schoolCodePattern = /^[A-Za-z0-9]+$/;

export function getSchoolEmblemSrc(
  school: Pick<School, "externalIds">,
): string | undefined {
  const code = school.externalIds?.neisSchoolCode?.trim();

  if (!code || !schoolCodePattern.test(code) || !schoolEmblemCodes[code]) {
    return undefined;
  }

  return `/school-emblems/${code}.png`;
}
