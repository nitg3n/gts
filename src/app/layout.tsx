import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "학교로GO",
  description: "학생에게 맞는 학교 선택을 돕는 추천 서비스",
  icons: {
    icon: [{ url: "/logo-black.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/logo-black.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <AppHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
