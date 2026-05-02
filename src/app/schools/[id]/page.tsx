import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft, ExternalLink, MapPin, Phone } from "lucide-react";
import { KakaoMap } from "@/components/KakaoMap";
import { ReviewsPanel } from "@/components/ReviewsPanel";
import { getPublicFactItems } from "@/lib/public-facts";
import { getCachedSchool, listReviews } from "@/lib/store";

export default async function SchoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const school = getCachedSchool(id);

  if (!school) {
    notFound();
  }

  const reviews = await listReviews(school.id, "approved");
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
              <Link
                href={`/compare?ids=${school.id}`}
                className="apple-button-primary h-11 gap-2 px-4 text-sm"
              >
                비교에 올리기
                <ArrowRightLeft className="h-4 w-4" aria-hidden />
              </Link>
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
          <ReviewsPanel schoolId={school.id} initialReviews={reviews} />
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {publicFacts.length ? (
            <div className="apple-panel p-5">
              <h2 className="text-lg font-black text-[#1d1d1f]">학교 공시 정보</h2>
              <div className="mt-4 divide-y divide-[#f1f1f4] rounded-2xl border border-[#e8e8ed] bg-white/60">
                {publicFacts.map((fact) => (
                  <div
                    key={fact.key}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-bold text-[#6e6e73]">
                      {fact.shortLabel}
                    </span>
                    <span className="font-black text-[#1d1d1f]">{fact.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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
