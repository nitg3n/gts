"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Scale,
  Trash2,
  X,
} from "lucide-react";
import {
  formatPublicFactValue,
  getPublicFactItems,
  getPublicFactValue,
  publicFactDefinitions,
} from "@/lib/public-facts";
import {
  clearCompareSchools,
  getStoredCompareSchools,
  mergeCompareSchools,
  removeSchoolFromCompare,
  saveStoredCompareSchools,
} from "@/lib/compare-list";
import { schools } from "@/lib/schools";
import type { School } from "@/lib/types";

export function CompareView({ ids }: { ids?: string }) {
  const router = useRouter();
  const requested = useMemo(() => parseCompareIds(ids), [ids]);
  const requestedKey = requested.join(",");
  const [selected, setSelected] = useState<School[]>([]);
  const [isReady, setIsReady] = useState(false);
  const visiblePublicFacts = publicFactDefinitions.filter((definition) =>
    selected.some((school) => getPublicFactValue(school, definition.key)),
  );

  useEffect(() => {
    let canceled = false;

    async function loadSelection() {
      setIsReady(false);
      const storedSchools = getStoredCompareSchools();

      if (!requested.length) {
        if (!canceled) {
          setSelected(storedSchools);
          setIsReady(true);
        }
        return;
      }

      const requestedSchools = await loadSchoolsByIds(requested, storedSchools);
      const nextSchools = saveStoredCompareSchools(
        mergeCompareSchools(storedSchools, requestedSchools),
      );

      if (!canceled) {
        setSelected(nextSchools);
        setIsReady(true);
        router.replace("/compare", { scroll: false });
      }
    }

    void loadSelection();

    return () => {
      canceled = true;
    };
  }, [requested, requestedKey, router]);

  function removeSelectedSchool(id: string) {
    const nextSchools = removeSchoolFromCompare(id);
    setSelected(nextSchools);
  }

  function clearSelectedSchools() {
    clearCompareSchools();
    setSelected([]);
  }

  if (!isReady) {
    return <LoadingCompareState />;
  }

  if (selected.length === 0) {
    return <EmptyCompareState />;
  }

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid gap-6 py-9 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end lg:py-11">
          <div>
            <p className="apple-eyebrow flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" aria-hidden />
              비교
            </p>
            <h1 className="apple-title mt-2 max-w-2xl text-3xl leading-tight sm:text-4xl">
              후보 학교를 같은 기준으로 비교합니다.
            </h1>
          </div>
          <div className="apple-panel p-5">
            <Scale className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden />
            <div className="mt-4 text-3xl font-extrabold text-[#1d1d1f]">
              {selected.length}
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#6e6e73]">
              비교 중인 학교
            </p>
            <button
              type="button"
              onClick={clearSelectedSchools}
              className="apple-button-secondary mt-4 h-10 gap-2 px-4 text-sm"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              비우기
            </button>
          </div>
        </div>
      </section>

      <section className="apple-shell py-8 lg:py-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {selected.map((school) => (
            <SchoolSnapshot
              key={school.id}
              school={school}
              onRemove={() => removeSelectedSchool(school.id)}
            />
          ))}
        </div>

        <div className="apple-panel mt-8 overflow-hidden">
          <div className="border-b border-[var(--line)] bg-white/50 px-5 py-4">
            <h2 className="text-xl font-extrabold text-[#1d1d1f]">핵심 비교</h2>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <FactRow label="학교 유형">
                {selected.map((school) => (
                  <FactCell key={school.id}>{school.category}</FactCell>
                ))}
              </FactRow>
              <FactRow label="지역">
                {selected.map((school) => (
                  <FactCell key={school.id}>{school.district}</FactCell>
                ))}
              </FactRow>
              <FactRow label="성별 유형">
                {selected.map((school) => (
                  <FactCell key={school.id}>{genderLabel(school.gender)}</FactCell>
                ))}
              </FactRow>
              <FactRow label="통학 메모">
                {selected.map((school) => (
                  <FactCell key={school.id}>{school.facts.commuteNote}</FactCell>
                ))}
              </FactRow>
              {visiblePublicFacts.map((definition) => (
                <FactRow key={definition.key} label={definition.label}>
                  {selected.map((school) => (
                    <FactCell key={school.id}>
                      {formatPublicFactValue(school, definition.key)}
                    </FactCell>
                  ))}
                </FactRow>
              ))}
            </div>
          </div>
        </div>

        <aside className="mt-8 grid gap-4 lg:grid-cols-3">
          {selected.map((school) => (
            <DecisionNote key={school.id} school={school} />
          ))}
        </aside>
      </section>
    </div>
  );
}

async function loadSchoolsByIds(ids: string[], storedSchools: School[]) {
  const storedById = new Map(storedSchools.map((school) => [school.id, school]));

  const items = await Promise.all(
    ids.map(async (id) => {
      const stored = storedById.get(id);

      if (stored) {
        return stored;
      }

      const seeded = schools.find((school) => school.id === id);

      if (seeded) {
        return seeded;
      }

      try {
        const response = await fetch(`/api/schools/${id}`);
        if (!response.ok) {
          return undefined;
        }

        const data = (await response.json()) as { school?: School };
        return data.school;
      } catch {
        return undefined;
      }
    }),
  );

  return items.filter(
    (school): school is School => school?.level === "high",
  );
}

function parseCompareIds(ids?: string) {
  return [
    ...new Set(ids?.split(",").map((id) => id.trim()).filter(Boolean) ?? []),
  ];
}

function EmptyCompareState() {
  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid min-h-[420px] place-items-center py-12 text-center">
          <div>
            <p className="apple-eyebrow inline-flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" aria-hidden />
              비교
            </p>
            <h1 className="apple-title mt-3 text-3xl leading-tight sm:text-4xl">
              비교할 학교가 아직 없습니다.
            </h1>
            <p className="apple-copy mx-auto mt-4 max-w-2xl text-base">
              학교 카드나 상세 화면에서 비교할 후보를 담아보세요.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/survey"
                className="apple-button-primary h-12 gap-2 px-5 text-sm"
              >
                설문으로 후보 만들기
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/" className="apple-button-secondary h-12 px-5 text-sm">
                주변 학교 탐색
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LoadingCompareState() {
  return (
    <div className="apple-page grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <p className="apple-eyebrow">비교</p>
        <h1 className="apple-title mt-3 text-3xl">학교 정보를 불러오는 중</h1>
      </div>
    </div>
  );
}

function SchoolSnapshot({
  school,
  onRemove,
}: {
  school: School;
  onRemove: () => void;
}) {
  const publicFacts = getPublicFactItems(school).slice(0, 3);

  return (
    <article className="apple-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold text-[var(--brand-primary)]">
            고등학교
          </p>
          <h2 className="mt-2 line-clamp-2 break-keep text-xl font-extrabold tracking-normal text-[#1d1d1f]">
            {school.name}
          </h2>
          <p className="mt-1 text-sm font-bold text-[#6e6e73]">
            {school.category} · {school.district}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/72 text-[#86868b] ring-1 ring-[var(--line)] transition hover:bg-[#ff3b30] hover:text-white"
          aria-label={`${school.name} 비교에서 제거`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-5 divide-y divide-[#f1f1f4] rounded-2xl border border-[#e8e8ed] bg-white/60">
        {publicFacts.map((fact) => (
          <MiniFact key={fact.key} label={fact.shortLabel} value={fact.value} />
        ))}
        <MiniFact label="위치" value={school.district} icon={<MapPin />} />
      </div>

      <Link
        href={`/schools/${school.id}`}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 text-sm font-extrabold text-white transition hover:bg-[var(--brand-primary-dark)]"
      >
        상세 보기
        <ExternalLink className="h-4 w-4" aria-hidden />
      </Link>
    </article>
  );
}

function MiniFact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-bold text-[#6e6e73]">
        {icon ? (
          <span className="text-[var(--brand-primary)] [&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
          </span>
        ) : null}
        {label}
      </div>
      <div className="font-extrabold text-[#1d1d1f]">{value}</div>
    </div>
  );
}

function FactRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode[];
}) {
  return (
    <div
      className="grid border-b border-[#f1f1f4] last:border-b-0"
      style={{ gridTemplateColumns: `180px repeat(${children.length}, 1fr)` }}
    >
      <div className="bg-white/50 p-4 text-sm font-extrabold text-[#6e6e73]">
        {label}
      </div>
      {children}
    </div>
  );
}

function FactCell({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 text-sm font-semibold leading-6 text-[#1d1d1f]">
      {children}
    </div>
  );
}

function DecisionNote({ school }: { school: School }) {
  return (
    <article className="apple-card p-5">
      <h3 className="line-clamp-2 text-lg font-extrabold text-[#1d1d1f]">
        {school.name}
      </h3>
      <div className="mt-4 space-y-3">
        {school.highlights.slice(0, 3).map((highlight) => (
          <div
            key={highlight}
            className="flex gap-2 text-sm font-semibold leading-6 text-[#6e6e73]"
          >
            <CheckCircle2
              className="mt-1 h-4 w-4 flex-none text-[#34c759]"
              aria-hidden
            />
            {highlight}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#6e6e73]">
        {school.description}
      </p>
    </article>
  );
}

function genderLabel(value: School["gender"]) {
  if (value === "boys") {
    return "남학교";
  }
  if (value === "girls") {
    return "여학교";
  }
  return "공학";
}
