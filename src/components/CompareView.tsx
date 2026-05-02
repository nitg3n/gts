"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { MetricBar } from "@/components/MetricBar";
import { schools } from "@/lib/schools";
import type { SchoolMetricKey } from "@/lib/types";

const metrics: SchoolMetricKey[] = [
  "academics",
  "activities",
  "environment",
  "meal",
  "reviews",
  "stability",
];

export function CompareView({ ids }: { ids?: string }) {
  const selected = useMemo(() => {
    const requested = ids?.split(",").filter(Boolean) ?? [];
    const picked = requested.length
      ? requested
          .map((id) => schools.find((school) => school.id === id))
          .filter(Boolean)
      : schools.slice(0, 3);

    return picked.slice(0, 4);
  }, [ids]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-teal-700">
            <ArrowRightLeft className="h-4 w-4" aria-hidden />
            Compare
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl">
            학교 비교
          </h1>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl overflow-x-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="min-w-[880px] overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div
            className="grid border-b border-zinc-200 bg-zinc-100"
            style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}
          >
            <div className="p-4 text-sm font-black text-zinc-500">항목</div>
            {selected.map((school) => (
              <div key={school.id} className="p-4">
                <div className="font-black text-zinc-950">{school.name}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-500">
                  {school.category} · {school.district}
                </div>
              </div>
            ))}
          </div>

          <CompareRow label="규모">
            {selected.map((school) => (
              <Cell key={school.id}>
                {school.facts.students}명 · {school.facts.classes}학급
              </Cell>
            ))}
          </CompareRow>
          <CompareRow label="강점">
            {selected.map((school) => (
              <Cell key={school.id}>{school.highlights.join(" · ")}</Cell>
            ))}
          </CompareRow>
          {metrics.map((metric) => (
            <CompareRow key={metric} label={metric}>
              {selected.map((school) => (
                <div key={school.id} className="p-4">
                  <MetricBar metric={metric} value={school.metrics[metric]} />
                </div>
              ))}
            </CompareRow>
          ))}
          <CompareRow label="상세">
            {selected.map((school) => (
              <div key={school.id} className="p-4">
                <Link
                  href={`/schools/${school.id}`}
                  className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-teal-700"
                >
                  보기
                </Link>
              </div>
            ))}
          </CompareRow>
        </div>
      </section>
    </div>
  );
}

function CompareRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const childCount = Array.isArray(children) ? children.length : 1;

  return (
    <div
      className="grid border-b border-zinc-100 last:border-b-0"
      style={{ gridTemplateColumns: `180px repeat(${childCount}, 1fr)` }}
    >
      <div className="bg-zinc-50 p-4 text-sm font-black text-zinc-700">{label}</div>
      {children}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="p-4 text-sm font-semibold leading-6 text-zinc-700">{children}</div>;
}
