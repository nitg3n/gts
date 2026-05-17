#!/usr/bin/env python3
"""Collect school header logo images from NEIS homepage URLs.

The script uses NEIS schoolInfo as the source of school metadata, visits each
homepage, finds the most likely header logo image, downloads it, and writes a
metadata CSV/JSON for later labeling.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import http.cookiejar
import io
import json
import os
import re
import ssl
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import HTTPCookieProcessor, HTTPSHandler, Request, build_opener, urlopen

from PIL import Image, UnidentifiedImageError


NEIS_SCHOOL_INFO_URL = "https://open.neis.go.kr/hub/schoolInfo"
HIGH_SCHOOL_NAME = "\uace0\ub4f1\ud559\uad50"
DEFAULT_OUTPUT_DIR = Path("outputs") / "school-logos"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
)


class ImageAndLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "img":
            return
        self.images.append({k.lower(): (v or "") for k, v in attrs})


@dataclass(frozen=True)
class FetchResult:
    body: bytes
    final_url: str
    headers: dict[str, str]


def load_env(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


def clean_url(url: str) -> str:
    url = url.strip()
    return re.sub(r"^(https?://[^/:?#]+):(?=/|$)", r"\1", url, flags=re.I)


def normalize_homepage(url: str | None) -> str | None:
    if not url:
        return None
    url = clean_url(url)
    if not url:
        return None
    if not re.match(r"https?://", url, flags=re.I):
        url = "https://" + url.lstrip("/")
    return clean_url(url)


def make_ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    try:
        context.set_ciphers("DEFAULT:@SECLEVEL=0")
    except ssl.SSLError:
        pass
    return context


SSL_CONTEXT = make_ssl_context()
THREAD_LOCAL = threading.local()


def get_opener():
    opener = getattr(THREAD_LOCAL, "opener", None)
    if opener is None:
        cookie_jar = http.cookiejar.CookieJar()
        opener = build_opener(
            HTTPCookieProcessor(cookie_jar),
            HTTPSHandler(context=SSL_CONTEXT),
        )
        THREAD_LOCAL.opener = opener
    return opener


def fetch_bytes(url: str, timeout: float, referer: str | None = None) -> FetchResult:
    url = clean_url(url)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.5",
        "Connection": "close",
    }
    if referer:
        headers["Referer"] = clean_url(referer)
    request = Request(url, headers=headers)
    with get_opener().open(request, timeout=timeout) as response:
        body = response.read()
        final_url = clean_url(response.geturl())
        response_headers = {k: v for k, v in response.headers.items()}
    return FetchResult(body=body, final_url=final_url, headers=response_headers)


def fetch_text(url: str, timeout: float, referer: str | None = None) -> tuple[str, str]:
    result = fetch_bytes(url, timeout=timeout, referer=referer)
    content_type = result.headers.get("Content-Type", "")
    match = re.search(r"charset=([^;]+)", content_type, flags=re.I)
    encoding = match.group(1).strip() if match else "utf-8"
    try:
        text = result.body.decode(encoding, errors="replace")
    except LookupError:
        text = result.body.decode("utf-8", errors="replace")
    return text, result.final_url


def possible_homepage_variants(url: str) -> list[str]:
    parsed = urlparse(url)
    variants = [url]
    if parsed.scheme == "https":
        variants.append("http://" + parsed.netloc + parsed.path)
    elif parsed.scheme == "http":
        variants.append("https://" + parsed.netloc + parsed.path)
    return list(dict.fromkeys(clean_url(v) for v in variants))


def find_javascript_redirect(html: str, base_url: str) -> str | None:
    patterns = [
        r"(?:document\.|window\.)?location\.href\s*=\s*[\"']([^\"']+)[\"']",
        r"(?:document\.|window\.)?location\s*=\s*[\"']([^\"']+)[\"']",
        r"(?:document\.|window\.)?location\.replace\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
        r"(?:document\.|window\.)?location\.assign\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.I)
        if match:
            return clean_url(urljoin(base_url, match.group(1)))

    meta = re.search(
        r"<meta[^>]+http-equiv=[\"']?refresh[\"']?[^>]+content=[\"'][^\"']*url=([^\"']+)[\"']",
        html,
        flags=re.I,
    )
    if meta:
        return clean_url(urljoin(base_url, meta.group(1).strip()))
    return None


def extract_regex_logo_candidates(html: str, page_url: str) -> list[str]:
    candidates: list[str] = []
    quoted = re.findall(r"[\"']([^\"']*logo[^\"']*\.(?:gif|png|jpe?g|webp)(?:\?[^\"']*)?)[\"']", html, flags=re.I)
    for src in quoted:
        candidates.append(clean_url(urljoin(page_url, src)))
    bare = re.findall(r"((?:/|https?://)[^\s\"'<>]*logo[^\s\"'<>]*\.(?:gif|png|jpe?g|webp)(?:\?[^\s\"'<>]*)?)", html, flags=re.I)
    for src in bare:
        candidates.append(clean_url(urljoin(page_url, src)))
    return list(dict.fromkeys(candidates))


def image_candidate_urls(html: str, page_url: str, school_name: str) -> list[str]:
    parser = ImageAndLinkParser()
    parser.feed(html)

    scored: list[tuple[int, str]] = []
    for img in parser.images:
        src = img.get("src") or img.get("data-src") or img.get("data-original") or ""
        if not src:
            continue
        url = clean_url(urljoin(page_url, src))
        parsed = urlparse(url)
        path = parsed.path.lower()
        attrs = " ".join(
            [
                src,
                img.get("alt", ""),
                img.get("title", ""),
                img.get("class", ""),
                img.get("id", ""),
            ]
        ).lower()

        score = 0
        if "logo" in path or "logo" in attrs:
            score += 20
        if "/common/logo" in path:
            score += 14
        if "/layout/logo" in path:
            score += 12
        if re.search(r"(?:^|/)logo\.(gif|png|jpe?g|webp)$", path):
            score += 8
        if school_name and school_name in " ".join([img.get("alt", ""), img.get("title", "")]):
            score += 8
        if any(token in path or token in attrs for token in ["banner", "popup", "sns", "facebook", "instagram", "youtube", "qr"]):
            score -= 16
        if any(token in path for token in ["favicon", "ico_", "icon_"]):
            score -= 8
        if not re.search(r"\.(gif|png|jpe?g|webp)(?:$|\?)", url, flags=re.I):
            score -= 3
        if score > 0:
            scored.append((score, url))

    for url in extract_regex_logo_candidates(html, page_url):
        path = urlparse(url).path.lower()
        score = 18
        if "/common/logo" in path:
            score += 12
        if "/layout/logo" in path:
            score += 10
        scored.append((score, url))

    scored.sort(key=lambda item: (-item[0], len(item[1])))
    return list(dict.fromkeys(url for _, url in scored))


def extension_from_response(url: str, content_type: str) -> str:
    path_ext = Path(urlparse(url).path).suffix.lower().lstrip(".")
    if path_ext in {"gif", "png", "jpg", "jpeg", "webp"}:
        return "jpg" if path_ext == "jpeg" else path_ext
    if "png" in content_type:
        return "png"
    if "gif" in content_type:
        return "gif"
    if "webp" in content_type:
        return "webp"
    if "jpeg" in content_type or "jpg" in content_type:
        return "jpg"
    return "img"


def safe_image_name(row: dict[str, Any], image_url: str, extension: str) -> str:
    office_code = str(row.get("ATPT_OFCDC_SC_CODE") or "office")
    school_code = str(row.get("SD_SCHUL_CODE") or "")
    if not school_code:
        digest = hashlib.sha1(image_url.encode("utf-8")).hexdigest()[:10]
        school_code = digest
    return f"{office_code}_{school_code}.{extension}"


def cached_logo_result(row: dict[str, Any], raw_dir: Path) -> dict[str, Any] | None:
    office_code = str(row.get("ATPT_OFCDC_SC_CODE") or "office")
    school_code = str(row.get("SD_SCHUL_CODE") or "")
    if not school_code:
        return None
    matches = sorted(raw_dir.glob(f"{office_code}_{school_code}.*"))
    for path in matches:
        try:
            with Image.open(path) as image:
                width, height = image.size
                image_format = (image.format or "").lower()
            return {
                "status": "ok_cached",
                "logo_url": "",
                "local_path": str(path),
                "width": width,
                "height": height,
                "format": image_format,
                "candidate_count": 0,
                "error": "",
            }
        except (UnidentifiedImageError, OSError):
            continue
    return None


def plausible_header_logo_size(width: int, height: int) -> bool:
    if width < 40 or height < 15:
        return False
    if width > 1000 or height > 250:
        return False
    return True


def download_best_logo(
    row: dict[str, Any],
    page_html: str,
    page_url: str,
    output_dir: Path,
    timeout: float,
    overwrite: bool,
) -> dict[str, Any]:
    school_name = str(row.get("SCHUL_NM") or "")
    candidates = image_candidate_urls(page_html, page_url, school_name)
    if not candidates:
        return {
            "status": "no_logo_candidate",
            "logo_url": "",
            "local_path": "",
            "width": "",
            "height": "",
            "format": "",
            "candidate_count": 0,
            "error": "",
        }

    errors: list[str] = []
    for candidate in candidates[:8]:
        try:
            result = fetch_bytes(candidate, timeout=timeout, referer=page_url)
            with Image.open(io.BytesIO(result.body)) as image:
                width, height = image.size
                image_format = (image.format or "").lower()
            if not plausible_header_logo_size(width, height):
                errors.append(f"implausible_size:{width}x{height}:{candidate}")
                continue

            content_type = result.headers.get("Content-Type", "")
            extension = extension_from_response(result.final_url, content_type)
            filename = safe_image_name(row, result.final_url, extension)
            local_path = output_dir / filename
            if overwrite or not local_path.exists():
                local_path.write_bytes(result.body)

            return {
                "status": "ok",
                "logo_url": result.final_url,
                "local_path": str(local_path),
                "width": width,
                "height": height,
                "format": image_format,
                "candidate_count": len(candidates),
                "error": "",
            }
        except (HTTPError, URLError, TimeoutError, UnidentifiedImageError, OSError) as exc:
            errors.append(f"{type(exc).__name__}:{candidate}")

    return {
        "status": "candidate_download_failed",
        "logo_url": candidates[0],
        "local_path": "",
        "width": "",
        "height": "",
        "format": "",
        "candidate_count": len(candidates),
        "error": " | ".join(errors[:5]),
    }


def fetch_homepage(homepage: str, timeout: float) -> tuple[str, str]:
    last_error: Exception | None = None
    for variant in possible_homepage_variants(homepage):
        try:
            html, final_url = fetch_text(variant, timeout=timeout)
            seen = {final_url}
            for _ in range(5):
                is_redirect_shell = len(html) < 8000 and "<img" not in html.lower()
                redirect = find_javascript_redirect(html, final_url) if is_redirect_shell else None
                if not redirect or redirect in seen:
                    break
                seen.add(redirect)
                html, final_url = fetch_text(redirect, timeout=timeout, referer=final_url)
            return html, final_url
        except Exception as exc:
            last_error = exc
    if last_error is None:
        raise RuntimeError("homepage_fetch_failed")
    raise last_error


def collect_one(row: dict[str, Any], raw_dir: Path, timeout: float, overwrite: bool) -> dict[str, Any]:
    school_name = str(row.get("SCHUL_NM") or "")
    homepage = normalize_homepage(row.get("HMPG_ADRES"))
    base_result = {
        "office_code": row.get("ATPT_OFCDC_SC_CODE", ""),
        "office_name": row.get("ATPT_OFCDC_SC_NM", ""),
        "school_code": row.get("SD_SCHUL_CODE", ""),
        "school_name": school_name,
        "school_kind": row.get("SCHUL_KND_SC_NM", ""),
        "region": row.get("LCTN_SC_NM", ""),
        "homepage": homepage or "",
        "page_url": "",
        "logo_url": "",
        "local_path": "",
        "width": "",
        "height": "",
        "format": "",
        "candidate_count": 0,
        "status": "",
        "error": "",
    }
    if not homepage:
        cached = cached_logo_result(row, raw_dir)
        if cached:
            base_result.update(cached)
            return base_result
        base_result["status"] = "no_homepage"
        return base_result

    try:
        html, page_url = fetch_homepage(homepage, timeout=timeout)
        base_result["page_url"] = page_url
        logo_result = download_best_logo(
            row=row,
            page_html=html,
            page_url=page_url,
            output_dir=raw_dir,
            timeout=timeout,
            overwrite=overwrite,
        )
        if logo_result.get("status") != "ok":
            cached = cached_logo_result(row, raw_dir)
            if cached:
                cached["error"] = f"fresh_status={logo_result.get('status')}; fresh_error={logo_result.get('error', '')}"
                logo_result = cached
        base_result.update(logo_result)
        return base_result
    except Exception as exc:
        cached = cached_logo_result(row, raw_dir)
        if cached:
            cached["error"] = f"fresh_exception={type(exc).__name__}: {exc}"
            base_result.update(cached)
            return base_result
        base_result["status"] = type(exc).__name__
        base_result["error"] = str(exc)
        return base_result


def fetch_neis_schools(api_key: str, school_kind: str, office_code: str | None, limit: int | None, timeout: float) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page = 1
    page_size = 1000
    while True:
        params: dict[str, Any] = {
            "KEY": api_key,
            "Type": "json",
            "pIndex": page,
            "pSize": page_size,
            "SCHUL_KND_SC_NM": school_kind,
        }
        if office_code:
            params["ATPT_OFCDC_SC_CODE"] = office_code
        url = NEIS_SCHOOL_INFO_URL + "?" + urlencode(params)
        result = fetch_bytes(url, timeout=timeout)
        payload = json.loads(result.body.decode("utf-8"))
        data = payload.get("schoolInfo")
        if not data:
            message = payload.get("RESULT", {}).get("MESSAGE", "No schoolInfo in NEIS response")
            raise RuntimeError(message)

        total = int(data[0]["head"][0]["list_total_count"])
        rows.extend(data[1]["row"])
        if limit and len(rows) >= limit:
            return rows[:limit]
        if len(rows) >= total:
            return rows
        page += 1


def write_outputs(results: list[dict[str, Any]], output_dir: Path) -> None:
    fieldnames = [
        "office_code",
        "office_name",
        "school_code",
        "school_name",
        "school_kind",
        "region",
        "homepage",
        "page_url",
        "logo_url",
        "local_path",
        "width",
        "height",
        "format",
        "candidate_count",
        "status",
        "error",
    ]
    csv_path = output_dir / "school_logos.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    json_path = output_dir / "school_logos.json"
    json_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    status_counts = Counter(str(row["status"]) for row in results)
    usable_statuses = {"ok", "ok_cached"}
    size_counts = Counter(
        f"{row['width']}x{row['height']}"
        for row in results
        if row.get("status") in usable_statuses and row.get("width") and row.get("height")
    )
    downloaded_office_counts = Counter(
        str(row["office_name"])
        for row in results
        if row.get("status") == "ok"
    )
    usable_office_counts = Counter(
        str(row["office_name"])
        for row in results
        if row.get("status") in usable_statuses
    )
    summary = {
        "total": len(results),
        "downloaded": status_counts.get("ok", 0),
        "usable": status_counts.get("ok", 0) + status_counts.get("ok_cached", 0),
        "cached": status_counts.get("ok_cached", 0),
        "status_counts": dict(status_counts.most_common()),
        "top_sizes": dict(size_counts.most_common(30)),
        "downloaded_by_office": dict(downloaded_office_counts.most_common()),
        "usable_by_office": dict(usable_office_counts.most_common()),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    summary_path = output_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect school header logo images.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--school-kind", default=HIGH_SCHOOL_NAME)
    parser.add_argument("--office-code", default=None, help="Optional NEIS office code, e.g. G10 for Daejeon.")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=24)
    parser.add_argument("--timeout", type=float, default=8.0)
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = os.environ.get("NEIS_OPEN_API_KEY") or load_env(Path(".env")).get("NEIS_OPEN_API_KEY")
    if not api_key:
        print("NEIS_OPEN_API_KEY is missing from environment or .env", file=sys.stderr)
        return 2

    output_dir: Path = args.output
    raw_dir = output_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    print("Fetching NEIS schools...")
    schools = fetch_neis_schools(
        api_key=api_key,
        school_kind=args.school_kind,
        office_code=args.office_code,
        limit=args.limit,
        timeout=args.timeout,
    )
    print(f"Schools: {len(schools)}")

    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [
            executor.submit(collect_one, row, raw_dir, args.timeout, args.overwrite)
            for row in schools
        ]
        for index, future in enumerate(as_completed(futures), start=1):
            results.append(future.result())
            if index % 100 == 0 or index == len(futures):
                ok_count = sum(1 for row in results if row["status"] == "ok")
                print(f"Processed {index}/{len(futures)} (ok={ok_count})")

    results.sort(key=lambda row: (str(row["office_name"]), str(row["school_name"]), str(row["school_code"])))
    write_outputs(results, output_dir)

    status_counts = Counter(str(row["status"]) for row in results)
    print("Done.")
    print(f"Output: {output_dir.resolve()}")
    print(f"Downloaded: {status_counts.get('ok', 0)} / {len(results)}")
    print(f"Usable including cache: {status_counts.get('ok', 0) + status_counts.get('ok_cached', 0)} / {len(results)}")
    print("Status counts:")
    for status, count in status_counts.most_common():
        print(f"  {status}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
