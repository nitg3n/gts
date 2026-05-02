"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import type { PublicRuntimeConfig, School } from "@/lib/types";

type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

type KakaoMapInstance = {
  addControl?: (control: unknown, position: unknown) => void;
  getCenter?: () => KakaoLatLng;
  setBounds?: (bounds: unknown) => void;
  setDraggable?: (draggable: boolean) => void;
  setZoomable?: (zoomable: boolean) => void;
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new () => {
          extend: (latlng: unknown) => void;
        };
        Map: new (container: HTMLElement, options: object) => KakaoMapInstance;
        MapTypeControl: new () => unknown;
        ZoomControl: new () => unknown;
        Marker: new (options: object) => { setMap: (map: unknown) => void };
        InfoWindow: new (options: object) => {
          open: (map: unknown, marker: unknown) => void;
          close: () => void;
        };
        ControlPosition: {
          RIGHT: unknown;
          TOPRIGHT: unknown;
        };
        event: {
          addListener: (
            target: unknown,
            eventName: string,
            callback: () => void,
          ) => void;
        };
      };
    };
  }
}

let kakaoScriptPromise: Promise<void> | undefined;
const DEFAULT_MAP_LEVEL = 5;

export function KakaoMap({
  schools,
  center,
  centerMarkerLabel,
  className,
  onCenterChange,
}: {
  schools: School[];
  center: { lat: number; lng: number };
  centerMarkerLabel?: string;
  className?: string;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
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

  const markerSchools = useMemo(() => schools.slice(0, 10), [schools]);
  const displayStatus = config && !config.kakaoJsKey ? "missing" : status;

  useEffect(() => {
    if (!config?.kakaoJsKey || !mapRef.current) {
      return;
    }

    const container = mapRef.current;

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
            draggable: true,
            level: DEFAULT_MAP_LEVEL,
            scrollwheel: true,
          });
          const bounds = new kakao.maps.LatLngBounds();
          let activeInfoWindow: { close: () => void } | undefined;

          map.setDraggable?.(true);
          map.setZoomable?.(true);
          map.addControl?.(
            new kakao.maps.MapTypeControl(),
            kakao.maps.ControlPosition.TOPRIGHT,
          );
          map.addControl?.(
            new kakao.maps.ZoomControl(),
            kakao.maps.ControlPosition.RIGHT,
          );

          markerSchools.forEach((school) => {
            const position = new kakao.maps.LatLng(school.lat, school.lng);
            const marker = new kakao.maps.Marker({ position });
            marker.setMap(map);
            bounds.extend(position);

            const info = new kakao.maps.InfoWindow({
              content: `<div style="padding:10px 12px;font-size:12px;font-weight:800;color:#1d1d1f;white-space:nowrap;">${escapeHtml(school.name)}</div>`,
            });

            kakao.maps.event.addListener(marker, "click", () => {
              activeInfoWindow?.close();
              info.open(map, marker);
              activeInfoWindow = info;
            });
          });

          if (centerMarkerLabel && !onCenterChange) {
            const position = new kakao.maps.LatLng(center.lat, center.lng);
            const marker = new kakao.maps.Marker({ position });
            marker.setMap(map);

            const info = new kakao.maps.InfoWindow({
              content: `<div style="padding:10px 12px;font-size:12px;font-weight:800;color:#1d1d1f;white-space:nowrap;">${escapeHtml(centerMarkerLabel)}</div>`,
            });
            info.open(map, marker);
          }

          if (onCenterChange) {
            kakao.maps.event.addListener(map, "dragend", () => {
              const nextCenter = map.getCenter?.();
              const lat = nextCenter?.getLat();
              const lng = nextCenter?.getLng();

              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                onCenterChange({ lat: lat!, lng: lng! });
              }
            });
          }

          setStatus("ready");
        });
      })
      .catch(() => setStatus("error"));
  }, [
    center.lat,
    center.lng,
    centerMarkerLabel,
    config,
    markerSchools,
    onCenterChange,
  ]);

  return (
    <div
      className={`relative min-h-[380px] overflow-hidden rounded-[26px] border border-[var(--line)] bg-[#eef1ec] shadow-[0_18px_48px_rgba(29,29,31,0.08)] ${className ?? ""}`}
    >
      <div
        ref={mapRef}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ${
          displayStatus === "ready" ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-black/10 to-transparent" />
      {displayStatus === "ready" && centerMarkerLabel && onCenterChange ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="-mt-10 flex flex-col items-center">
            <div className="rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-black text-white shadow-sm">
              {centerMarkerLabel}
            </div>
            <div className="mt-1 h-5 w-5 rounded-full border-4 border-white bg-[var(--brand-primary)] shadow-sm" />
          </div>
        </div>
      ) : null}
      {displayStatus !== "ready" ? (
        <KakaoMapStatus status={displayStatus} />
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

function KakaoMapStatus({
  status,
}: {
  status: "loading" | "missing" | "error";
}) {
  const isLoading = status === "loading";

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[#f2f4f0] p-8 text-center">
      <div>
        <div className="apple-icon-bubble mx-auto h-12 w-12">
          <MapPinned className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-[#1d1d1f]">
          {isLoading ? "지도 연결 중" : "지도를 불러오지 못했어요"}
        </h2>
        <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-[#6e6e73]">
          {isLoading
            ? "잠시만 기다려주세요."
            : "카카오 개발자 설정에서 현재 도메인을 확인해주세요."}
        </p>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
