"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Compass, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "탐색", icon: Compass },
  { href: "/survey", label: "설문", icon: ClipboardList },
  { href: "/compare", label: "비교", icon: Map },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/76 backdrop-blur-2xl">
      <div className="apple-shell flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-full pr-3 transition hover:bg-[var(--brand-primary-soft)]"
          aria-label="학교로GO 홈"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-[0_5px_18px_rgba(29,29,31,0.08)]">
            <Image
              src="/logo-black.svg"
              alt="학교로GO"
              width={32}
              height={32}
              className="h-7 w-7 object-contain"
            />
          </span>
          <span className="text-[15px] font-black tracking-tight text-[#1d1d1f]">
            학교로GO
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/72 p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-black transition",
                  active
                    ? "bg-[#1d1d1f] text-white shadow-sm"
                    : "text-[#6e6e73] hover:bg-[var(--brand-primary-soft)] hover:text-[#1d1d1f]",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
