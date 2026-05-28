import Image from "next/image";
import type { School } from "@/lib/types";
import { getSchoolEmblemSrc } from "@/lib/school-emblems";
import { cn } from "@/lib/utils";

type SchoolEmblemProps = {
  school: Pick<School, "externalIds">;
  size?: number;
  className?: string;
};

export function SchoolEmblem({
  school,
  size = 32,
  className,
}: SchoolEmblemProps) {
  const src = getSchoolEmblemSrc(school) ?? "/logo-black.svg";
  const isFallback = src === "/logo-black.svg";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#e8e8ed] bg-white shadow-[0_4px_10px_rgba(29,29,31,0.04)]",
        isFallback && "bg-[var(--brand-primary-faint)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn("h-full w-full object-contain", isFallback && "p-1.5")}
        unoptimized
      />
    </span>
  );
}
