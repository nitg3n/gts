import { notFound } from "next/navigation";
import {
  BookOpen,
  BadgeDollarSign,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  Library,
  MapPin,
  Phone,
  Soup,
  Users,
} from "lucide-react";
import { CompareButton } from "@/components/CompareButton";
import { KakaoMap } from "@/components/KakaoMap";
import { ReviewsPanel } from "@/components/ReviewsPanel";
import { SchoolEmblem } from "@/components/SchoolEmblem";
import {
  findGraduationOutcomeForSchool,
  loadGraduationOutcomeIndex,
  type GraduationOutcomeSummary,
} from "@/lib/graduation-outcomes";
import { getPublicFactItems } from "@/lib/public-facts";
import { getSchoolByRouteId, listReviews } from "@/lib/store";
import type { School, SchoolDisclosureDetails } from "@/lib/types";

export const runtime = "nodejs";

export default async function SchoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const school = await getSchoolByRouteId(id);

  if (!school || school.level !== "high") {
    notFound();
  }

  const reviews = await listReviews(school.id);
  const publicFacts = getPublicFactItems(school);
  const graduationOutcome = findGraduationOutcomeForSchool(
    school,
    loadGraduationOutcomeIndex(),
  );

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid gap-7 py-9 lg:grid-cols-[minmax(0,1fr)_460px] lg:py-11">
          <div>
            <p className="apple-eyebrow">
              고등학교
            </p>
            <div className="mt-2 flex min-w-0 items-start gap-3">
              <SchoolEmblem school={school} size={48} className="mt-1 rounded-xl" />
              <h1 className="apple-title min-w-0 text-3xl leading-tight sm:text-4xl">
                {school.name}
              </h1>
            </div>
            <p className="apple-copy mt-4 max-w-2xl text-base">
              {school.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {school.tags.map((tag) => (
                <span key={tag} className="apple-chip px-3 py-1.5">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <CompareButton school={school} navigateOnAdd variant="primary">
                비교에 올리기
              </CompareButton>
              {school.website ? (
                <a
                  href={school.website}
                  target="_blank"
                  rel="noreferrer"
                  className="apple-button-secondary h-11 gap-2 px-4 text-sm"
                >
                  홈페이지
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
          <KakaoMap schools={[school]} center={{ lat: school.lat, lng: school.lng }} />
        </div>
      </section>

      <section className="apple-shell grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-12">
        <main className="space-y-8">
          <SchoolFitSummary
            school={school}
            graduationOutcome={graduationOutcome}
            hasPublicFacts={publicFacts.length > 0}
            reviewCount={reviews.length}
          />

          <SchoolDataOverview
            school={school}
            graduationOutcome={graduationOutcome}
            reviewCount={reviews.length}
          />

          {publicFacts.length ? (
            <section className="apple-panel p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-extrabold text-[var(--brand-primary)]">
                    학교 지표
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-normal text-[#1d1d1f]">
                    학교 지표
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {publicFacts.map((fact) => (
                  <div
                    key={fact.key}
                    className="rounded-lg border border-[#e8e8ed] bg-white/70 p-4"
                  >
                    <div className="text-xs font-extrabold text-[#86868b]">
                      {fact.label}
                    </div>
                    <div className="mt-2 text-xl font-extrabold tracking-normal text-[#1d1d1f]">
                      {fact.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {school.disclosure ? (
            <DisclosureDetailPanel disclosure={school.disclosure} />
          ) : null}

          {graduationOutcome ? (
            <GraduationOutcomePanel outcome={graduationOutcome} />
          ) : null}

          <ReviewsPanel schoolId={school.id} initialReviews={reviews} />
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="apple-panel p-5">
            <h2 className="text-lg font-extrabold text-[#1d1d1f]">학교 요약</h2>
            <div className="mt-4 divide-y divide-[#f1f1f4] rounded-2xl border border-[#e8e8ed] bg-white/60">
              <SummaryRow label="유형" value={school.category} />
              <SummaryRow label="성별" value={genderLabel(school.gender)} />
              {school.founded ? (
                <SummaryRow label="개교" value={`${school.founded}년`} />
              ) : null}
              <SummaryRow label="지역" value={school.district} />
            </div>
          </div>

          <div className="apple-panel p-5">
            <div className="flex items-start gap-3 text-sm font-bold leading-6 text-[#6e6e73]">
              <MapPin
                className="mt-1 h-4 w-4 text-[var(--brand-primary)]"
                aria-hidden
              />
              {school.address}
            </div>
            {school.phone ? (
              <div className="mt-3 flex items-center gap-3 text-sm font-bold text-[#6e6e73]">
                <Phone
                  className="h-4 w-4 text-[var(--brand-primary)]"
                  aria-hidden
                />
                {school.phone}
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}

type DetailItem = {
  label: string;
  value: string;
};

function SchoolFitSummary({
  school,
  graduationOutcome,
  hasPublicFacts,
  reviewCount,
}: {
  school: School;
  graduationOutcome?: GraduationOutcomeSummary;
  hasPublicFacts: boolean;
  reviewCount: number;
}) {
  const fit = getSchoolFitLine(school, graduationOutcome);
  const caution = getSchoolCautionLine(school, hasPublicFacts, reviewCount);

  return (
    <section className="apple-panel p-5">
      <p className="text-sm font-extrabold text-[var(--brand-primary)]">
        한 줄 결론
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-[var(--brand-primary-soft)] p-4">
          <p className="text-xs font-extrabold text-[var(--brand-primary)]">
            이런 학생에게 맞음
          </p>
          <p className="mt-2 text-base font-extrabold leading-7 text-[#1d1d1f]">
            {fit}
          </p>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-[#e8e8ed]">
          <p className="text-xs font-extrabold text-[#86868b]">
            확인할 점
          </p>
          <p className="mt-2 text-base font-extrabold leading-7 text-[#1d1d1f]">
            {caution}
          </p>
        </div>
      </div>
    </section>
  );
}

function SchoolDataOverview({
  school,
  graduationOutcome,
  reviewCount,
}: {
  school: School;
  graduationOutcome?: GraduationOutcomeSummary;
  reviewCount: number;
}) {
  const disclosure = school.disclosure;
  const activityCount =
    positiveNumber(school.facts.clubs) ??
    sumPositive(
      disclosure?.activities?.creativeClubs,
      disclosure?.activities?.studentClubs,
    );
  const libraryUse =
    positiveNumber(disclosure?.library?.weeklyAverageUsers) ??
    positiveNumber(disclosure?.library?.totalUsers);
  const careerReadyRate = graduationOutcome
    ? graduationOutcome.juniorCollegeRate + graduationOutcome.employmentRate
    : undefined;
  const metrics = [
    {
      label: "학급당 학생",
      value: formatRatio(school.facts.students, school.facts.classes, "명"),
      helper: "교실 규모",
      icon: <Users className="h-4 w-4" aria-hidden />,
    },
    {
      label: "교원 1인당 학생",
      value: formatRatio(school.facts.students, school.facts.teachers, "명"),
      helper: "학습 관리 여건",
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden />,
    },
    {
      label: "활동 선택지",
      value:
        typeof activityCount === "number"
          ? `${formatNumber(activityCount)}개`
          : undefined,
      helper: "동아리·창체",
      icon: <BookOpen className="h-4 w-4" aria-hidden />,
    },
    {
      label: "도서관 이용",
      value:
        typeof libraryUse === "number" ? `${formatNumber(libraryUse)}명` : undefined,
      helper: disclosure?.library?.weeklyAverageUsers
        ? "주 평균 이용"
        : "누적 이용",
      icon: <Library className="h-4 w-4" aria-hidden />,
    },
    {
      label: "대학 진학률",
      value: graduationOutcome
        ? formatPercent(graduationOutcome.advancementRate)
        : undefined,
      helper: graduationOutcome ? `${graduationOutcome.latestYear}년 포함` : "",
      icon: <GraduationCap className="h-4 w-4" aria-hidden />,
    },
    {
      label: "취업·전문 진로",
      value:
        typeof careerReadyRate === "number"
          ? formatPercent(careerReadyRate)
          : undefined,
      helper: "전문대·취업 합산",
      icon: <BadgeDollarSign className="h-4 w-4" aria-hidden />,
    },
  ].filter((metric) => Boolean(metric.value));
  const signals = buildSchoolDataSignals(school, graduationOutcome, reviewCount);

  if (!metrics.length && !signals.length) {
    return null;
  }

  return (
    <section className="apple-panel p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-[var(--brand-primary)]">
            학교 조건 한눈에
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-normal text-[#1d1d1f]">
            규모, 관리, 활동, 진로를 함께 보기
          </h2>
        </div>
        {school.dataUpdatedAt ? (
          <div className="text-sm font-extrabold text-[#6e6e73]">
            {school.dataUpdatedAt.slice(0, 10)} 기준
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-[#e8e8ed] bg-white/72 p-4"
          >
            <div className="flex items-center gap-2 text-[var(--brand-primary)]">
              {metric.icon}
              <span className="text-xs font-extrabold text-[#6e6e73]">
                {metric.label}
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-normal text-[#1d1d1f]">
              {metric.value}
            </div>
            <div className="mt-1 text-xs font-bold text-[#86868b]">
              {metric.helper}
            </div>
          </div>
        ))}
      </div>

      {signals.length ? (
        <div className="mt-5 rounded-2xl bg-[var(--brand-primary-soft)] p-4">
          <p className="text-sm font-extrabold text-[var(--brand-primary)]">
            해석 포인트
          </p>
          <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-[#1d1d1f]">
            {signals.map((signal) => (
              <li key={signal} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function detailItem(
  label: string,
  value: number | boolean | undefined,
  unit = "",
): DetailItem | undefined {
  if (typeof value === "boolean") {
    return {
      label,
      value: value ? "운영" : "미운영",
    };
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return {
    label,
    value: `${formatNumber(value)}${unit}`,
  };
}

function DisclosureDetailPanel({
  disclosure,
}: {
  disclosure: SchoolDisclosureDetails;
}) {
  const sections = [
    {
      title: "수업·학습 운영",
      icon: <ClipboardCheck className="h-5 w-5" aria-hidden />,
      items: [
        detailItem("수업일수", disclosure.instruction?.schoolDays, "일"),
        detailItem("주당 수업시수", disclosure.instruction?.weeklyClassHours, "시간"),
        detailItem("방과후 프로그램", disclosure.afterSchool?.programs, "개"),
        detailItem("방과후 신청 학생", disclosure.afterSchool?.registeredStudents, "명"),
        detailItem("방과후 참여 학생", disclosure.afterSchool?.participatingStudents, "명"),
        detailItem("특기적성 강좌", disclosure.afterSchool?.specialClasses, "개"),
        detailItem("야간 강좌", disclosure.afterSchool?.eveningClasses, "개"),
      ],
    },
    {
      title: "활동·도서관",
      icon: <Library className="h-5 w-5" aria-hidden />,
      items: [
        detailItem("창의적 체험 동아리", disclosure.activities?.creativeClubs, "개"),
        detailItem("학생 자율 동아리", disclosure.activities?.studentClubs, "개"),
        detailItem("창체 참여 학생", disclosure.activities?.creativeParticipants, "명"),
        detailItem("동아리 참여 학생", disclosure.activities?.studentParticipants, "명"),
        detailItem("창체 예산", disclosure.activities?.creativeBudget, "원"),
        detailItem("자율 동아리 예산", disclosure.activities?.studentClubBudget, "원"),
        detailItem("도서관 전체 이용", disclosure.library?.totalUsers, "명"),
        detailItem("주 평균 도서관 이용", disclosure.library?.weeklyAverageUsers, "명"),
      ],
    },
    {
      title: "급식·생활 지원",
      icon: <Soup className="h-5 w-5" aria-hidden />,
      items: [
        detailItem("급식 대상 학생", disclosure.meals?.targetStudents, "명"),
        detailItem("급식 이용 학생", disclosure.meals?.servedStudents, "명"),
        detailItem("급식 제공률", disclosure.meals?.supplyRate, "%"),
        detailItem("조리 인력", disclosure.meals?.cooks, "명"),
        detailItem("조리 보조 인력", disclosure.meals?.cookingAssistants, "명"),
        detailItem("영양 인력", disclosure.meals?.nutritionStaff, "명"),
        detailItem("Wee 클래스", disclosure.counseling?.weeClass),
        detailItem("내부 상담전문가", disclosure.counseling?.internalSpecialist),
        detailItem("외부 상담전문가", disclosure.counseling?.externalSpecialist),
        detailItem("상담 교사", disclosure.counseling?.counselingTeachers, "명"),
        detailItem("외부 전문 인력", disclosure.counseling?.externalSpecialists, "명"),
      ],
    },
    {
      title: "방과후·장학",
      icon: <BadgeDollarSign className="h-5 w-5" aria-hidden />,
      items: [
        detailItem("장학 수혜 학생", disclosure.scholarships?.recipients, "명"),
        detailItem("장학 총액", disclosure.scholarships?.amount, "원"),
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter(Boolean) as DetailItem[],
  })).filter((section) => section.items.length > 0);

  if (!sections.length) {
    return null;
  }

  return (
    <section className="apple-panel p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-[var(--brand-primary)]">
            공시 세부 정보
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-normal text-[#1d1d1f]">
            학교 생활을 더 구체적으로 보기
          </h2>
        </div>
        <div className="text-sm font-extrabold text-[#6e6e73]">
          {disclosure.year}년 공시 기준
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl border border-[#e8e8ed] bg-white/70 p-4"
          >
            <div className="flex items-center gap-2 text-[var(--brand-primary)]">
              {section.icon}
              <h3 className="text-base font-extrabold text-[#1d1d1f]">
                {section.title}
              </h3>
            </div>
            <dl className="mt-4 divide-y divide-[#f1f1f4]">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <dt className="font-bold text-[#6e6e73]">{item.label}</dt>
                  <dd className="text-right font-extrabold text-[#1d1d1f]">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function GraduationOutcomePanel({
  outcome,
}: {
  outcome: GraduationOutcomeSummary;
}) {
  const yearRange = formatYearRange(outcome.years);
  const careerReadyRate = outcome.juniorCollegeRate + outcome.employmentRate;
  const headlineMetrics = [
    {
      label: "대학 진학률",
      value: formatPercent(outcome.advancementRate),
      helper: "4년제·전문대·해외 진학 포함",
    },
    {
      label: "4년제 진학률",
      value: formatPercent(outcome.fourYearRate),
      helper: "국내외 4년제 대학 기준",
    },
    {
      label: "취업·전문 진로",
      value: formatPercent(careerReadyRate),
      helper: "전문대 진학과 취업 합산",
    },
  ];
  const detailRows = [
    ["전문대 진학률", formatPercent(outcome.juniorCollegeRate)],
    ["취업률", formatPercent(outcome.employmentRate)],
    ["해외 진학률", formatPercent(outcome.overseasRate)],
    ["기타·미상", formatPercent(outcome.otherRate)],
  ];

  return (
    <section className="apple-panel overflow-hidden">
      <div className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-[var(--brand-primary)]">
              졸업 후 데이터
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-normal text-[#1d1d1f]">
              졸업 후 상황
            </h2>
          </div>
          <div className="text-sm font-extrabold text-[#6e6e73]">
            {yearRange} · 졸업생 {formatNumber(outcome.graduatesTotal)}명
          </div>
        </div>
      </div>

      <div className="grid border-y border-[#e8e8ed] bg-white/70 md:grid-cols-3">
        {headlineMetrics.map((metric) => (
          <div
            key={metric.label}
            className="border-b border-[#e8e8ed] p-5 md:border-b-0 md:border-r md:last:border-r-0"
          >
            <div className="text-sm font-extrabold text-[#6e6e73]">
              {metric.label}
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-normal text-[#1d1d1f]">
              {metric.value}
            </div>
            <div className="mt-2 text-sm font-bold leading-5 text-[#86868b]">
              {metric.helper}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-0 p-5 sm:grid-cols-2">
        {detailRows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-[#f1f1f4] py-3 text-sm odd:sm:mr-5 even:sm:ml-5"
          >
            <span className="font-bold text-[#6e6e73]">{label}</span>
            <span className="font-extrabold text-[#1d1d1f]">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="font-bold text-[#6e6e73]">{label}</span>
      <span className="font-extrabold text-[#1d1d1f]">{value}</span>
    </div>
  );
}

function genderLabel(value: "coed" | "boys" | "girls") {
  if (value === "boys") {
    return "남학교";
  }
  if (value === "girls") {
    return "여학교";
  }
  return "공학";
}

function getSchoolFitLine(
  school: School,
  graduationOutcome?: GraduationOutcomeSummary,
) {
  const categoryText = `${school.category} ${school.tags.join(" ")}`;

  if (/과학|영재|연구/.test(categoryText)) {
    return "과학·탐구 활동과 면학 분위기를 학교 선택의 중심에 두는 학생에게 적합합니다.";
  }

  if (/외국어|국제/.test(categoryText)) {
    return "외국어와 국제 진로를 염두에 두고 학교 성격을 뚜렷하게 보고 싶은 학생에게 적합합니다.";
  }

  if (/특성화|마이스터|실습|취업|기술/.test(categoryText)) {
    return "실습 중심 수업과 취업·전문 진로를 빠르게 탐색하려는 학생에게 적합합니다.";
  }

  if (/예술|체육/.test(categoryText)) {
    return "예술·체육 활동을 고등학교 생활의 핵심 기준으로 보는 학생에게 적합합니다.";
  }

  if ((graduationOutcome?.fourYearRate ?? 0) >= 60) {
    return "대학 진학 흐름과 일반적인 학교 생활 균형을 함께 보고 싶은 학생에게 적합합니다.";
  }

  return "학교 유형, 지역, 공시 지표를 균형 있게 비교하려는 학생에게 적합합니다.";
}

function getSchoolCautionLine(
  school: School,
  hasPublicFacts: boolean,
  reviewCount: number,
) {
  if (!hasPublicFacts) {
    return "공시 세부 지표가 부족하므로 학교 홈페이지와 실제 통학 조건을 함께 확인해야 합니다.";
  }

  if (reviewCount === 0) {
    return "아직 공개 리뷰가 없어 실제 분위기는 재학생 후기나 학교 방문 정보로 보완하는 것이 좋습니다.";
  }

  if (/과학|영재|외국어|국제|예술|체육|마이스터|특성화/.test(school.category)) {
    return "계열 적합성이 중요하므로 전형 방식, 교육과정, 통학 시간을 함께 확인해야 합니다.";
  }

  return "통학 시간, 학급 규모, 동아리·상담 같은 생활 조건을 마지막으로 비교해 보세요.";
}

function buildSchoolDataSignals(
  school: School,
  graduationOutcome: GraduationOutcomeSummary | undefined,
  reviewCount: number,
) {
  const signals: string[] = [];
  const studentsPerClass = ratio(school.facts.students, school.facts.classes);
  const studentsPerTeacher = ratio(school.facts.students, school.facts.teachers);
  const clubCount = positiveNumber(school.facts.clubs);

  if (studentsPerClass && studentsPerClass <= 24) {
    signals.push("학급당 학생 수가 비교적 낮아 교실 규모를 중시하는 학생이 확인할 만합니다.");
  } else if (studentsPerClass && studentsPerClass >= 30) {
    signals.push("학급 규모가 큰 편이라 수업 분위기와 생활 관리 방식을 함께 확인해야 합니다.");
  }

  if (studentsPerTeacher && studentsPerTeacher <= 10) {
    signals.push("교원 1인당 학생 수가 낮아 학습 관리 여건을 긍정적으로 볼 수 있습니다.");
  }

  if (clubCount && clubCount >= 30) {
    signals.push("동아리 수가 충분해 활동 선택지를 중요하게 보는 학생에게 비교 가치가 있습니다.");
  }

  if (graduationOutcome && graduationOutcome.advancementRate >= 75) {
    signals.push("최근 졸업 후 진학 흐름이 높아 진학 중심 선택지로 검토할 수 있습니다.");
  } else if (graduationOutcome && graduationOutcome.employmentRate >= 20) {
    signals.push("취업 흐름이 확인되어 실무·전문 진로 관점에서도 살펴볼 수 있습니다.");
  }

  if (reviewCount > 0) {
    signals.push("재학생·졸업생 리뷰가 있어 실제 생활 분위기를 함께 비교할 수 있습니다.");
  }

  return signals.slice(0, 3);
}

function formatRatio(numerator: number, denominator: number, unit: string) {
  const value = ratio(numerator, denominator);

  if (!value) {
    return undefined;
  }

  return `${value.toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}${unit}`;
}

function ratio(numerator: number, denominator: number) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return undefined;
  }

  return numerator / denominator;
}

function positiveNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function sumPositive(...values: Array<number | undefined>) {
  const sum = values.reduce<number>(
    (total, value) => total + (positiveNumber(value) ?? 0),
    0,
  );
  return sum > 0 ? sum : undefined;
}

function formatYearRange(years: number[]) {
  const sortedYears = [...years].sort((a, b) => a - b);
  const first = sortedYears[0];
  const last = sortedYears.at(-1);

  if (!first || !last) {
    return "최근 3년";
  }

  if (first === last) {
    return `${first}년`;
  }

  return `${first}-${last}년`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}
