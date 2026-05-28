import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  School as SchoolIcon,
  Sparkles,
  Trophy,
} from "lucide-react";
import { CompareButton } from "@/components/CompareButton";
import { SchoolEmblem } from "@/components/SchoolEmblem";
import type { GraduationOutcomeSummary } from "@/lib/graduation-outcomes";
import { getPublicFactItems } from "@/lib/public-facts";
import type {
  Recommendation,
  RecommendationEvidence,
  School,
} from "@/lib/types";
import { cn, formatDistance } from "@/lib/utils";

type SchoolCardProps = {
  school: School;
  distanceKm?: number;
  reason?: string;
  reasons?: string[];
  caution?: string;
  evidence?: RecommendationEvidence[];
  graduationOutcome?: GraduationOutcomeSummary;
  score?: number;
  semanticScore?: number;
  distanceScore?: number;
  confidence?: number;
  dimensionScores?: Recommendation["dimensionScores"];
  featured?: boolean;
  rankLabel?: string;
};

export function SchoolCard({
  school,
  distanceKm,
  reason,
  reasons,
  graduationOutcome,
  featured = false,
  rankLabel,
}: SchoolCardProps) {
  const publicFacts = getPublicFactItems(school).slice(0, 3);
  const displayTags = [
    graduationOutcome?.specialPurposeType,
    ...school.tags,
  ].filter((tag, index, tags): tag is string =>
    Boolean(tag && tags.indexOf(tag) === index),
  );
  const reasonItems = reasons?.length
    ? reasons.slice(0, 1)
    : reason
      ? [reason]
      : [];

  return (
    <article
      className={cn(
        "apple-card group relative flex h-full flex-col justify-between overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-[rgba(70,138,87,0.38)] hover:shadow-[0_12px_28px_rgba(29,29,31,0.06)]",
        featured &&
          "border-[rgba(70,138,87,0.32)] bg-white shadow-[0_12px_30px_rgba(70,138,87,0.08)] ring-1 ring-[rgba(70,138,87,0.08)]",
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--brand-primary)]">
                <SchoolIcon className="h-3.5 w-3.5" aria-hidden />
                고등학교
              </div>
              {rankLabel ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-[#e8e8ed] bg-white/70 px-2.5 py-1 text-xs font-extrabold text-[#6e6e73]",
                    featured &&
                      "border-[rgba(70,138,87,0.22)] bg-[var(--brand-primary)] text-white shadow-[0_10px_22px_rgba(70,138,87,0.18)]",
                  )}
                >
                  {featured ? <Trophy className="h-3.5 w-3.5" aria-hidden /> : null}
                  {rankLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex min-w-0 items-start gap-2.5">
              <SchoolEmblem school={school} size={34} className="mt-0.5" />
              <h3
                className={cn(
                  "line-clamp-2 min-w-0 break-keep font-extrabold leading-[1.18] tracking-normal text-[#1d1d1f]",
                  featured ? "text-[22px]" : "text-[20px]",
                )}
              >
                {school.name}
              </h3>
            </div>
            <p className="mt-1 text-sm font-bold text-[#6e6e73]">
              {school.category} · {school.district}
            </p>
          </div>
        </div>

        <FactStrip facts={publicFacts} />

        <div className="mt-4 flex flex-wrap gap-1.5">
          {displayTags.slice(0, 3).map((tag) => (
            <span key={tag} className="apple-chip px-2.5 py-1 text-[12px]">
              {tag}
            </span>
          ))}
        </div>

        {reasonItems.length ? (
          <div
            className={cn(
              "mt-4 flex gap-2 rounded-2xl bg-[var(--brand-primary-soft)] p-3 text-sm font-bold leading-5 text-[#1d1d1f]",
              featured && "border border-[rgba(70,138,87,0.12)] bg-white/72",
            )}
          >
            <Sparkles
              className="mt-0.5 h-4 w-4 flex-none text-[var(--brand-primary)]"
              aria-hidden
            />
            <div className="min-w-0">
              {reasonItems.map((item) => (
                <p key={item} className="line-clamp-2">
                  {item}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-5 flex items-center justify-between gap-3 border-t border-[#f1f1f4] pt-4",
          featured && "border-[rgba(70,138,87,0.14)]",
        )}
      >
        <div
          className={cn(
            "inline-flex items-center gap-2 text-sm font-extrabold text-[#6e6e73]",
            featured && "text-[var(--brand-primary)]",
          )}
        >
          <MapPin
            className={cn(
              "h-4 w-4 text-[#ff9f0a]",
              featured && "text-[var(--brand-primary)]",
            )}
            aria-hidden
          />
          {formatDistance(distanceKm)}
        </div>
        <div className="flex items-center gap-2">
          <CompareButton school={school} variant="compact" />
          <Link
            href={`/schools/${school.id}`}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 text-sm font-extrabold text-white transition hover:bg-[var(--brand-primary-dark)]",
              featured && "shadow-[0_10px_22px_rgba(70,138,87,0.16)]",
            )}
          >
            상세
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

function FactStrip({
  facts,
}: {
  facts: ReturnType<typeof getPublicFactItems>;
}) {
  if (!facts.length) {
    return null;
  }

  return (
    <dl className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-y border-[#f1f1f4] py-3">
      {facts.map((fact) => (
        <div key={fact.key} className="inline-flex min-w-0 items-baseline gap-1">
          <dt className="text-[11px] font-extrabold text-[#86868b]">
            {fact.shortLabel}
          </dt>
          <dd className="max-w-[6.5rem] truncate text-xs font-extrabold text-[#1d1d1f]">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
