"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { School } from "@/lib/types";
import type { PublicRuntimeConfig } from "@/lib/types";

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement, options: object) => unknown;
        Marker: new (options: object) => { setMap: (map: unknown) => void };
        InfoWindow: new (options: object) => { open: (map: unknown, marker: unknown) => void };
      };
    };
  }
}

let kakaoScriptPromise: Promise<void> | undefined;

export function KakaoMap({
  schools,
  center,
}: {
  schools: School[];
  center: { lat: number; lng: number };
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<PublicRuntimeConfig>();
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((runtimeConfig: PublicRuntimeConfig) => setConfig(runtimeConfig))
      .catch(() => setStatus("error"));
  }, []);

  const markerSchools = useMemo(() => schools.slice(0, 8), [schools]);

  useEffect(() => {
    if (!config) {
      return;
    }

    if (!config.kakaoJsKey) {
      setStatus("missing");
      return;
    }

    const container = mapRef.current;
    if (!container) {
      return;
    }

    loadKakao(config.kakaoJsKey)
      .then(() => {
        const kakao = window.kakao;
        if (!kakao) {
          setStatus("error");
          return;
        }

        kakao.maps.load(() => {
          const map = new kakao.maps.Map(container, {
            center: new kakao.maps.LatLng(center.lat, center.lng),
            level: 8,
          });

          markerSchools.forEach((school) => {
            const marker = new kakao.maps.Marker({
              position: new kakao.maps.LatLng(school.lat, school.lng),
            });
            marker.setMap(map);

            const info = new kakao.maps.InfoWindow({
              content: `<div style="padding:8px 10px;font-size:12px;font-weight:700;">${school.name}</div>`,
            });
            info.open(map, marker);
          });
          setStatus("ready");
        });
      })
      .catch(() => setStatus("error"));
  }, [center.lat, center.lng, config, markerSchools]);

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      <div ref={mapRef} className="absolute inset-0" />
      {status !== "ready" ? (
        <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#f8fafc,#ecfeff)] p-8 text-center">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.18em] text-teal-700">
              Map
            </div>
            <p className="mt-3 text-lg font-black text-zinc-950">
              {status === "missing"
                ? "Kakao Maps 키를 기다리는 중"
                : status === "error"
                  ? "지도 로딩 확인 필요"
                  : "학교 위치를 불러오는 중"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
              지도 없이도 주변 학교 목록과 추천 흐름은 사용할 수 있습니다.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function loadKakao(appKey: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.kakao?.maps) {
    return Promise.resolve();
  }

  if (!kakaoScriptPromise) {
    kakaoScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Kakao Maps SDK failed to load"));
      document.head.appendChild(script);
    });
  }

  return kakaoScriptPromise;
}
