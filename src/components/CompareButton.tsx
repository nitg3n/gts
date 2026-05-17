"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Scale } from "lucide-react";
import {
  addSchoolsToCompare,
  getStoredCompareSchools,
  maxCompareSchools,
  subscribeCompareSchools,
} from "@/lib/compare-list";
import type { School } from "@/lib/types";
import { cn } from "@/lib/utils";

type CompareButtonVariant = "primary" | "secondary" | "compact";

export function CompareButton({
  school,
  schools,
  children,
  navigateOnAdd = false,
  variant = "secondary",
  className,
}: {
  school?: School;
  schools?: School[];
  children?: ReactNode;
  navigateOnAdd?: boolean;
  variant?: CompareButtonVariant;
  className?: string;
}) {
  const router = useRouter();
  const targets = useMemo(
    () =>
      (schools?.length ? schools : school ? [school] : []).filter(
        (item) => item.level === "high",
      ),
    [school, schools],
  );
  const [storedCount, setStoredCount] = useState(0);
  const [isAlreadyAdded, setIsAlreadyAdded] = useState(false);

  useEffect(() => {
    function sync() {
      const storedSchools = getStoredCompareSchools();
      const storedIds = new Set(storedSchools.map((item) => item.id));

      setStoredCount(storedSchools.length);
      setIsAlreadyAdded(
        targets.length > 0 && targets.every((item) => storedIds.has(item.id)),
      );
    }

    sync();
    return subscribeCompareSchools(sync);
  }, [targets]);

  function handleClick() {
    if (targets.length === 0) {
      return;
    }

    const nextSchools = addSchoolsToCompare(targets);
    const nextIds = new Set(nextSchools.map((item) => item.id));

    setStoredCount(nextSchools.length);
    setIsAlreadyAdded(targets.every((item) => nextIds.has(item.id)));

    if (navigateOnAdd) {
      router.push("/compare");
    }
  }

  const label =
    children ??
    (targets.length > 1
      ? "비교에 담기"
      : isAlreadyAdded
        ? "담김"
        : "비교");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={targets.length === 0}
      className={cn(compareButtonClass(variant), className)}
      title={`비교 목록 ${storedCount}/${maxCompareSchools}`}
    >
      {isAlreadyAdded ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Scale className="h-4 w-4" aria-hidden />
      )}
      {label}
    </button>
  );
}

function compareButtonClass(variant: CompareButtonVariant) {
  if (variant === "primary") {
    return "apple-button-primary h-11 gap-2 px-4 text-sm";
  }

  if (variant === "compact") {
    return "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] bg-white/78 px-3 text-sm font-black text-[#1d1d1f] transition hover:border-[rgba(70,138,87,0.42)] hover:bg-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50";
  }

  return "apple-button-secondary h-11 gap-2 px-4 text-sm";
}
