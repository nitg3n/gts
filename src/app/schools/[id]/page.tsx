import { notFound } from "next/navigation";
import {
  BadgeDollarSign,
  ExternalLink,
  Library,
  MapPin,
  Phone,
  Soup,
} from "lucide-react";
import { CompareButton } from "@/components/CompareButton";
import { KakaoMap } from "@/components/KakaoMap";
import { ReviewsPanel } from "@/components/ReviewsPanel";
import {
  findGraduationOutcomeForSchool,
  loadGraduationOutcomeIndex,
  type GraduationOutcomeSummary,
} from "@/lib/graduation-outcomes";
import { getPublicFactItems } from "@/lib/public-facts";
import { getSchoolByRouteId, listReviews } from "@/lib/store";
import type { SchoolDisclosureDetails } from "@/lib/types";

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
            <h1 className="apple-title mt-2 text-3xl leading-tight sm:text-4xl">
              {school.name}
            </h1>
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
      title: "활동·도서관",
      icon: <Library className="h-5 w-5" aria-hidden />,
      items: [
        detailItem("창의적 체험 동아리", disclosure.activities?.creativeClubs, "개"),
        detailItem("학생 자율 동아리", disclosure.activities?.studentClubs, "개"),
        detailItem("동아리 참여 학생", disclosure.activities?.studentParticipants, "명"),
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
        detailItem("조리 인력", disclosure.meals?.cooks, "명"),
        detailItem("영양 인력", disclosure.meals?.nutritionStaff, "명"),
        detailItem("Wee 클래스", disclosure.counseling?.weeClass),
        detailItem("내부 상담전문가", disclosure.counseling?.internalSpecialist),
        detailItem("외부 상담전문가", disclosure.counseling?.externalSpecialist),
      ],
    },
    {
      title: "방과후·장학",
      icon: <BadgeDollarSign className="h-5 w-5" aria-hidden />,
      items: [
        detailItem("방과후 프로그램", disclosure.afterSchool?.programs, "개"),
        detailItem("방과후 신청 학생", disclosure.afterSchool?.registeredStudents, "명"),
        detailItem("방과후 참여 학생", disclosure.afterSchool?.participatingStudents, "명"),
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
