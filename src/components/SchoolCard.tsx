import Link from "next/link";
import {
  ArrowRight,
  Info,
  MapPin,
  School as SchoolIcon,
  Sparkles,
} from "lucide-react";
import { CompareButton } from "@/components/CompareButton";
import { getPublicFactItems } from "@/lib/public-facts";
import type { School } from "@/lib/types";
import { formatDistance } from "@/lib/utils";

export function SchoolCard({
  school,
  distanceKm,
  reason,
  reasons,
  caution,
}: {
  school: School;
  distanceKm?: number;
  reason?: string;
  reasons?: string[];
  caution?: string;
}) {
  const publicFacts = getPublicFactItems(school).slice(0, 3);
  const reasonItems = reasons?.length ? reasons.slice(0, 2) : reason ? [reason] : [];

  return (
    <article className="apple-card group flex h-full flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-[rgba(70,138,87,0.38)] hover:shadow-[0_18px_44px_rgba(29,29,31,0.08)]">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--brand-primary)]">
              <SchoolIcon className="h-3.5 w-3.5" aria-hidden />
              고등학교
            </div>
            <h3 className="mt-2 text-[21px] font-black leading-tight tracking-tight text-[#1d1d1f]">
              {school.name}
            </h3>
            <p className="mt-1 text-sm font-bold text-[#6e6e73]">
              {school.category} · {school.district}
            </p>
          </div>
        </div>

        <p className="mt-5 line-clamp-3 text-sm font-semibold leading-6 text-[#6e6e73]">
          {school.description}
        </p>

        {publicFacts.length ? (
          <dl className="mt-5 grid grid-cols-3 divide-x divide-[#e8e8ed] rounded-2xl border border-[#e8e8ed] bg-white/60">
            {publicFacts.map((fact) => (
              <div key={fact.key} className="px-3 py-3">
                <dt className="text-[11px] font-black text-[#86868b]">
                  {fact.shortLabel}
                </dt>
                <dd className="mt-1 truncate text-sm font-black text-[#1d1d1f]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {school.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="apple-chip px-3 py-1">
              {tag}
            </span>
          ))}
        </div>

        {reasonItems.length ? (
          <div className="mt-5 flex gap-2 rounded-2xl bg-[var(--brand-primary-soft)] p-3 text-sm font-bold leading-5 text-[#1d1d1f]">
            <Sparkles
              className="mt-0.5 h-4 w-4 flex-none text-[var(--brand-primary)]"
              aria-hidden
            />
            <div className="space-y-1">
              {reasonItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        ) : null}

        {caution ? (
          <div className="mt-3 flex gap-2 text-xs font-bold leading-5 text-[#86868b]">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
            <span>{caution}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#f1f1f4] pt-4">
        <div className="inline-flex items-center gap-2 text-sm font-black text-[#6e6e73]">
          <MapPin className="h-4 w-4 text-[#ff9f0a]" aria-hidden />
          {formatDistance(distanceKm)}
        </div>
        <div className="flex items-center gap-2">
          <CompareButton school={school} variant="compact" />
          <Link
            href={`/schools/${school.id}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-sm font-black text-white transition group-hover:bg-[var(--brand-primary)]"
          >
            상세
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
