import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "학교로GO",
  description: "학생에게 맞는 학교 선택을 돕는 데이터 기반 추천 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
