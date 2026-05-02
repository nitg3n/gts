import Image from "next/image";
import Link from "next/link";
import { ClipboardList, Compass, LayoutDashboard, LogIn, Map } from "lucide-react";

const navItems = [
  { href: "/", label: "탐색", icon: Compass },
  { href: "/survey", label: "설문", icon: ClipboardList },
  { href: "/compare", label: "비교", icon: Map },
  { href: "/admin", label: "관리", icon: LayoutDashboard },
  { href: "/login", label: "로그인", icon: LogIn },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="학교로GO 홈">
          <Image
            src="/logo.png"
            alt="학교로GO"
            width={42}
            height={42}
            className="h-10 w-10 rounded-sm object-contain"
            priority
          />
          <span className="text-lg font-black tracking-tight text-zinc-950">
            학교로GO
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
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
