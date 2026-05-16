import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import { CompareButton } from "@/components/CompareButton";
import { KakaoMap } from "@/components/KakaoMap";
import { ReviewsPanel } from "@/components/ReviewsPanel";
import { getPublicFactItems } from "@/lib/public-facts";
import { getSchoolByRouteId, listReviews } from "@/lib/store";

export default async function SchoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const school = await getSchoolByRouteId(id);

  if (!school) {
    notFound();
  }

  const reviews = await listReviews(school.id);
  const publicFacts = getPublicFactItems(school);

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_460px] lg:py-16">
          <div>
            <p className="apple-eyebrow">
              {school.level === "middle" ? "Middle School" : "High School"}
            </p>
            <h1 className="apple-title mt-3 text-5xl leading-[1.04] sm:text-6xl">
              {school.name}
            </h1>
            <p className="apple-copy mt-5 max-w-2xl text-lg">
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
                  <p className="text-sm font-black text-[var(--brand-primary)]">
                    School Profile
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1d1d1f]">
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
                    <div className="text-xs font-black text-[#86868b]">
                      {fact.label}
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-[#1d1d1f]">
                      {fact.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <ReviewsPanel schoolId={school.id} initialReviews={reviews} />
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="apple-panel p-5">
            <h2 className="text-lg font-black text-[#1d1d1f]">학교 요약</h2>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="font-bold text-[#6e6e73]">{label}</span>
      <span className="font-black text-[#1d1d1f]">{value}</span>
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
