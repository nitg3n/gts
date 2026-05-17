#!/usr/bin/env python3
"""Predict emblem boundaries and generate cropped emblem PNGs."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image, ImageOps

from train_emblem_cnn import (
    DEFAULT_LABELS,
    DEFAULT_MANIFEST,
    DEFAULT_MODEL,
    EmblemBoundaryCNN,
    alpha_composite_on_white,
    image_to_tensor,
)


DEFAULT_OUTPUT_DIR = Path("outputs") / "school-logos" / "emblem-crops-cnn"
DEFAULT_PREDICTIONS = Path("outputs") / "school-logos" / "emblem_predictions_cnn.json"
DEFAULT_CSV = Path("outputs") / "school-logos" / "emblem_crops_cnn.csv"


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    for row in rows:
        local_path = Path(row["local_path"])
        if not local_path.is_absolute():
            local_path = Path.cwd() / local_path
        row["resolved_local_path"] = str(local_path)
        row["image"] = local_path.name
    return rows


def load_labels(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        return data
    return {item["image"]: item for item in data if isinstance(item, dict) and "image" in item}


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def points_from_prediction(pred: torch.Tensor, width: int, height: int) -> list[list[int]]:
    values = pred.detach().cpu().numpy().astype(float).tolist()
    top_x = clamp(round(values[0] * width), 1, width)
    top_y = clamp(round(values[1] * height), 0, height)
    bottom_x = clamp(round(values[2] * width), 1, width)
    bottom_y = clamp(round(values[3] * height), 0, height)

    right_points = sorted([[top_x, top_y], [bottom_x, bottom_y]], key=lambda point: point[1])
    return [[0, 0], right_points[0], right_points[1], [0, height]]


def bbox_from_points(points: list[list[int]]) -> list[int]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return [min(xs), min(ys), max(xs), max(ys)]


def confidence_from_points(points: list[list[int]], width: int, height: int) -> str:
    bbox = bbox_from_points(points)
    x_ratio = bbox[2] / max(width, 1)
    vertical_span = abs(points[2][1] - points[1][1]) / max(height, 1)
    slope = abs(points[2][0] - points[1][0]) / max(width, 1)
    if 0.12 <= x_ratio <= 0.42 and vertical_span >= 0.45 and slope <= 0.18:
        return "high"
    if 0.08 <= x_ratio <= 0.55 and vertical_span >= 0.25:
        return "medium"
    return "low"


def crop_emblem(image: Image.Image, bbox: list[int], output_size: int, pad_ratio: float) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    x1, y1, x2, y2 = bbox
    pad = round(max(width, height) * pad_ratio)
    x1 = clamp(x1 - pad, 0, width)
    y1 = clamp(y1 - pad, 0, height)
    x2 = clamp(x2 + pad, 1, width)
    y2 = clamp(y2 + pad, 1, height)
    crop = image.crop((x1, y1, x2, y2))

    side = max(crop.width, crop.height)
    square = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    square.alpha_composite(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    square = square.resize((output_size, output_size), Image.Resampling.LANCZOS)
    return square


def load_model(model_path: Path, cpu: bool) -> tuple[EmblemBoundaryCNN, torch.device, dict[str, Any]]:
    device = torch.device("cuda" if torch.cuda.is_available() and not cpu else "cpu")
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    model = EmblemBoundaryCNN().to(device)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model, device, checkpoint


@torch.no_grad()
def predict_one(model: EmblemBoundaryCNN, device: torch.device, image: Image.Image) -> torch.Tensor:
    rgb = alpha_composite_on_white(image.convert("RGBA"))
    tensor = image_to_tensor(rgb).unsqueeze(0).to(device)
    return model(tensor).squeeze(0)


def build_record(
    row: dict[str, str],
    points: list[list[int]],
    source: str,
    confidence: str,
    crop_path: Path | None,
) -> dict[str, Any]:
    return {
        "image": row["image"],
        "schoolCode": row.get("school_code", ""),
        "schoolName": row.get("school_name", ""),
        "officeCode": row.get("office_code", ""),
        "officeName": row.get("office_name", ""),
        "localPath": row["resolved_local_path"],
        "cropPath": str(crop_path) if crop_path else "",
        "width": int(float(row.get("width") or 0)),
        "height": int(float(row.get("height") or 0)),
        "points": points,
        "bbox": bbox_from_points(points),
        "source": source,
        "confidence": confidence,
    }


def write_csv(path: Path, records: list[dict[str, Any]]) -> None:
    fieldnames = [
        "image",
        "schoolCode",
        "schoolName",
        "officeCode",
        "officeName",
        "localPath",
        "cropPath",
        "width",
        "height",
        "bbox",
        "source",
        "confidence",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            row = {key: record.get(key, "") for key in fieldnames}
            row["bbox"] = json.dumps(record.get("bbox", []), ensure_ascii=False)
            writer.writerow(row)


def create_contact_sheet(records: list[dict[str, Any]], output_path: Path, max_items: int = 80) -> None:
    selected = records[:max_items]
    if not selected:
        return
    thumb = 96
    cols = 10
    rows = (len(selected) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb, rows * thumb), (245, 245, 245))
    for index, record in enumerate(selected):
        crop_path = record.get("cropPath")
        if not crop_path:
            continue
        try:
            image = Image.open(crop_path).convert("RGBA")
        except Exception:
            continue
        image = ImageOps.contain(image, (thumb, thumb), method=Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (thumb, thumb), (255, 255, 255, 255))
        canvas.alpha_composite(image, ((thumb - image.width) // 2, (thumb - image.height) // 2))
        sheet.paste(canvas.convert("RGB"), ((index % cols) * thumb, (index // cols) * thumb))
    sheet.save(output_path)


def run(args: argparse.Namespace) -> dict[str, Any]:
    rows = read_manifest(args.manifest)
    labels = load_labels(args.labels)
    model, device, checkpoint = load_model(args.model, args.cpu)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.predictions.parent.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, Any]] = []
    skipped = 0
    for row in rows:
        image_key = row["image"]
        label = labels.get(image_key, {})
        label_status = label.get("status")
        if label_status == "no_emblem" and args.skip_no_emblem:
            skipped += 1
            continue

        try:
            image = Image.open(row["resolved_local_path"]).convert("RGBA")
        except Exception:
            skipped += 1
            continue
        width, height = image.size
        row["width"] = str(width)
        row["height"] = str(height)

        if args.prefer_human and label_status == "labeled" and len(label.get("points", [])) == 4:
            points = [[int(p[0]), int(p[1])] for p in label["points"]]
            source = "human"
            confidence = "human"
        else:
            prediction = predict_one(model, device, image)
            points = points_from_prediction(prediction, width, height)
            source = "cnn"
            confidence = confidence_from_points(points, width, height)

        bbox = bbox_from_points(points)
        crop = crop_emblem(image, bbox, args.output_size, args.pad_ratio)
        crop_path = args.output_dir / f"{Path(image_key).stem}.png"
        crop.save(crop_path)
        records.append(build_record(row, points, source, confidence, crop_path))

    args.predictions.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(args.csv, records)
    create_contact_sheet(records, args.output_dir / "contact_sheet.jpg")

    summary = {
        "total_manifest": len(rows),
        "generated": len(records),
        "skipped": skipped,
        "source_counts": count_values(records, "source"),
        "confidence_counts": count_values(records, "confidence"),
        "model": str(args.model),
        "train_count": checkpoint.get("train_count"),
        "val_count": checkpoint.get("val_count"),
        "val_metrics": checkpoint.get("val_metrics"),
    }
    (args.output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def count_values(records: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for record in records:
        value = str(record.get(key, ""))
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict and crop school emblems.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--predictions", type=Path, default=DEFAULT_PREDICTIONS)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--output-size", type=int, default=256)
    parser.add_argument("--pad-ratio", type=float, default=0.03)
    parser.add_argument("--prefer-human", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--skip-no-emblem", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--cpu", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.model.exists():
        print(f"model not found: {args.model}", file=sys.stderr)
        return 2
    summary = run(args)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
