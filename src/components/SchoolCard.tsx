import Link from "next/link";
import { ArrowRight, MapPin, School as SchoolIcon, Sparkles } from "lucide-react";
import type { School } from "@/lib/types";
import { formatDistance, scoreLabel } from "@/lib/utils";

export function SchoolCard({
  school,
  distanceKm,
  score,
  reason,
}: {
  school: School;
  distanceKm?: number;
  score?: number;
  reason?: string;
}) {
  return (
    <article className="flex h-full flex-col justify-between rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              <SchoolIcon className="h-3.5 w-3.5" aria-hidden />
              {school.level === "middle" ? "Middle" : "High"}
            </div>
            <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-950">
              {school.name}
            </h3>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              {school.category} · {school.district}
            </p>
          </div>
          {typeof score === "number" ? (
            <div className="min-w-16 rounded-md bg-zinc-950 px-3 py-2 text-center text-white">
              <div className="text-xl font-black">{score}</div>
              <div className="text-[10px] font-bold text-zinc-300">
                {scoreLabel(score)}
              </div>
            </div>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-zinc-600">{school.description}</p>
        <div className="flex flex-wrap gap-2">
          {school.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-teal-50 p-3 text-teal-950">
            <div className="text-xs font-bold text-teal-700">학생 수</div>
            <div className="mt-1 font-black">{school.facts.students}명</div>
          </div>
          <div className="rounded-md bg-blue-50 p-3 text-blue-950">
            <div className="text-xs font-bold text-blue-700">동아리</div>
            <div className="mt-1 font-black">{school.facts.clubs}개</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
          <MapPin className="h-4 w-4 text-coral-600" aria-hidden />
          {formatDistance(distanceKm)}
        </div>
        {reason ? (
          <div className="flex gap-2 rounded-md bg-zinc-950 p-3 text-sm font-medium leading-5 text-white">
            <Sparkles className="mt-0.5 h-4 w-4 flex-none text-cyan-300" aria-hidden />
            <span>{reason}</span>
          </div>
        ) : null}
      </div>
      <Link
        href={`/schools/${school.id}`}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-teal-700"
      >
        학교 상세
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </article>
  );
}
