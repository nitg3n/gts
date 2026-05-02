"use client";

import { useEffect, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { PublicRuntimeConfig } from "@/lib/types";

export function LoginClient() {
  const [config, setConfig] = useState<PublicRuntimeConfig>();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Supabase 연결을 확인하는 중");

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((runtimeConfig: PublicRuntimeConfig) => {
        setConfig(runtimeConfig);
        setStatus(
          runtimeConfig.hasSupabase
            ? "이메일 로그인 링크를 받을 수 있습니다."
            : "Supabase 환경 변수를 확인해주세요.",
        );
      })
      .catch(() => setStatus("설정을 불러오지 못했습니다."));
  }, []);

  async function sendLoginLink() {
    if (!config?.hasSupabase) {
      setStatus("Supabase 설정이 필요합니다.");
      return;
    }

    const supabase = createBrowserSupabaseClient(config);
    if (!supabase) {
      setStatus("Supabase 클라이언트를 만들 수 없습니다.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    setStatus(
      error
        ? `로그인 링크 발송 실패: ${error.message}`
        : "이메일로 로그인 링크를 보냈습니다.",
    );
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl place-items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-teal-700 text-white">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-teal-700">
          Supabase Auth
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">
          리뷰와 관리는 로그인 후 이용합니다
        </h1>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@example.com"
              className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
          </label>
          <button
            type="button"
            onClick={sendLoginLink}
            className="h-12 rounded-md bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-teal-700"
          >
            링크 보내기
          </button>
        </div>
        <p className="mt-4 text-sm font-bold text-zinc-500">{status}</p>
      </section>
    </div>
  );
}
