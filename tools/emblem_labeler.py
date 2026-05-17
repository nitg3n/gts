#!/usr/bin/env python3
"""Minimal school-logo emblem labeler.

Reads outputs/school-logos/labeling_manifest.csv and writes polygon labels to
outputs/school-logos/emblem_labels.json. The left-top and left-bottom points are
fixed to the image edge; the user clicks the two right-side boundary points.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tkinter as tk
from tkinter import messagebox

from PIL import Image, ImageTk


DEFAULT_MANIFEST = Path("outputs") / "school-logos" / "labeling_manifest.csv"
DEFAULT_LABELS = Path("outputs") / "school-logos" / "emblem_labels.json"
MAX_CANVAS_WIDTH = 980
MAX_CANVAS_HEIGHT = 420


@dataclass
class LogoItem:
    index: int
    office_code: str
    office_name: str
    school_code: str
    school_name: str
    region: str
    homepage: str
    page_url: str
    logo_url: str
    local_path: Path
    width: int
    height: int
    image_format: str
    source_status: str


def read_manifest(path: Path) -> list[LogoItem]:
    if not path.exists():
        raise FileNotFoundError(f"manifest not found: {path}")

    items: list[LogoItem] = []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        for index, row in enumerate(csv.DictReader(file)):
            local_path = Path(row["local_path"])
            if not local_path.is_absolute():
                local_path = Path.cwd() / local_path
            items.append(
                LogoItem(
                    index=index,
                    office_code=row.get("office_code", ""),
                    office_name=row.get("office_name", ""),
                    school_code=row.get("school_code", ""),
                    school_name=row.get("school_name", ""),
                    region=row.get("region", ""),
                    homepage=row.get("homepage", ""),
                    page_url=row.get("page_url", ""),
                    logo_url=row.get("logo_url", ""),
                    local_path=local_path,
                    width=int(float(row.get("width") or 0)),
                    height=int(float(row.get("height") or 0)),
                    image_format=row.get("format", ""),
                    source_status=row.get("status", ""),
                )
            )
    return items


def load_labels(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return {str(item["image"]): item for item in data if "image" in item}
    if isinstance(data, dict):
        return {str(key): value for key, value in data.items()}
    raise ValueError("labels file must be a JSON object or list")


def image_key(item: LogoItem) -> str:
    return item.local_path.name


def bbox_from_points(points: list[list[int]]) -> list[int]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return [min(xs), min(ys), max(xs), max(ys)]


class EmblemLabeler(tk.Tk):
    def __init__(self, items: list[LogoItem], labels_path: Path) -> None:
        super().__init__()
        self.title("Emblem Labeler")
        self.geometry("1120x700")
        self.minsize(920, 560)

        self.items = items
        self.labels_path = labels_path
        self.labels = load_labels(labels_path)
        self.current_index = self.first_unlabeled_index()
        self.current_image: Image.Image | None = None
        self.tk_image: ImageTk.PhotoImage | None = None
        self.display_scale = 1.0
        self.image_offset = (0, 0)
        self.click_points: list[list[int]] = []

        self.status_var = tk.StringVar()
        self.meta_var = tk.StringVar()
        self.help_var = tk.StringVar()

        self.build_ui()
        self.bind_keys()
        self.load_current_item()

    def build_ui(self) -> None:
        top = tk.Frame(self)
        top.pack(fill=tk.X, padx=12, pady=(10, 6))

        self.meta_label = tk.Label(top, textvariable=self.meta_var, anchor="w", justify="left", font=("Malgun Gothic", 11))
        self.meta_label.pack(side=tk.LEFT, fill=tk.X, expand=True)

        tk.Button(top, text="Prev", width=9, command=self.prev_item).pack(side=tk.LEFT, padx=3)
        tk.Button(top, text="Next", width=9, command=self.next_item).pack(side=tk.LEFT, padx=3)
        tk.Button(top, text="Skip labeled", width=11, command=self.next_unlabeled).pack(side=tk.LEFT, padx=3)

        self.canvas = tk.Canvas(self, bg="#f4f4f4", highlightthickness=1, highlightbackground="#cccccc")
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=12, pady=6)
        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<Configure>", self.on_canvas_resize)

        bottom = tk.Frame(self)
        bottom.pack(fill=tk.X, padx=12, pady=(6, 10))

        tk.Button(bottom, text="Undo", width=10, command=self.undo_point).pack(side=tk.LEFT, padx=3)
        tk.Button(bottom, text="Reset", width=10, command=self.reset_points).pack(side=tk.LEFT, padx=3)
        tk.Button(bottom, text="Save", width=10, command=self.save_label).pack(side=tk.LEFT, padx=3)
        tk.Button(bottom, text="No emblem", width=12, command=lambda: self.save_status("no_emblem")).pack(side=tk.LEFT, padx=3)
        tk.Button(bottom, text="Uncertain", width=12, command=lambda: self.save_status("uncertain")).pack(side=tk.LEFT, padx=3)

        self.status_label = tk.Label(bottom, textvariable=self.status_var, anchor="w", justify="left")
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=12)

        help_label = tk.Label(self, textvariable=self.help_var, anchor="w", justify="left", fg="#555555")
        help_label.pack(fill=tk.X, padx=12, pady=(0, 10))

    def bind_keys(self) -> None:
        self.bind("<Control-z>", lambda _: self.undo_point())
        self.bind("<BackSpace>", lambda _: self.undo_point())
        self.bind("<Escape>", lambda _: self.reset_points())
        self.bind("<Return>", lambda _: self.save_label())
        self.bind("<space>", lambda _: self.save_label())
        self.bind("<Right>", lambda _: self.next_item())
        self.bind("<Left>", lambda _: self.prev_item())
        self.bind("n", lambda _: self.save_status("no_emblem"))
        self.bind("u", lambda _: self.save_status("uncertain"))
        self.bind("s", lambda _: self.save_label())

    def first_unlabeled_index(self) -> int:
        for item in self.items:
            if image_key(item) not in self.labels:
                return item.index
        return 0

    def current_item(self) -> LogoItem:
        return self.items[self.current_index]

    def load_current_item(self) -> None:
        item = self.current_item()
        try:
            self.current_image = Image.open(item.local_path).convert("RGBA")
        except Exception as exc:
            messagebox.showerror("Image load failed", f"{item.local_path}\n\n{exc}")
            self.current_image = None
            return

        existing = self.labels.get(image_key(item), {})
        self.click_points = []
        if existing.get("status") == "labeled":
            points = existing.get("points") or []
            if len(points) == 4:
                self.click_points = [points[1], points[2]]

        self.update_meta()
        self.render()

    def update_meta(self) -> None:
        item = self.current_item()
        key = image_key(item)
        existing = self.labels.get(key)
        label_status = existing.get("status") if existing else "unlabeled"
        self.meta_var.set(
            f"{self.current_index + 1}/{len(self.items)}  "
            f"{item.school_name}  |  {item.office_name}  |  "
            f"{item.width}x{item.height}  |  {key}  |  label={label_status}"
        )
        self.status_var.set(f"Clicked right-side points: {len(self.click_points)}/2")
        self.help_var.set(
            "Click the top-right and bottom-right boundary of the emblem. "
            "Left-top and left-bottom are fixed to the image edge. "
            "Keys: Enter/Space=save, Backspace=undo, Esc=reset, arrows=move, n=no emblem, u=uncertain."
        )

    def on_canvas_resize(self, _: tk.Event) -> None:
        self.render()

    def display_geometry(self) -> tuple[int, int, int, int]:
        if self.current_image is None:
            return (0, 0, 1, 1)
        canvas_width = max(self.canvas.winfo_width(), 1)
        canvas_height = max(self.canvas.winfo_height(), 1)
        image_width, image_height = self.current_image.size
        scale = min(
            MAX_CANVAS_WIDTH / image_width,
            MAX_CANVAS_HEIGHT / image_height,
            (canvas_width - 40) / image_width,
            (canvas_height - 40) / image_height,
            8.0,
        )
        scale = max(scale, 0.05)
        display_width = max(1, int(round(image_width * scale)))
        display_height = max(1, int(round(image_height * scale)))
        offset_x = max(20, (canvas_width - display_width) // 2)
        offset_y = max(20, (canvas_height - display_height) // 2)
        self.display_scale = scale
        self.image_offset = (offset_x, offset_y)
        return offset_x, offset_y, display_width, display_height

    def original_to_canvas(self, point: list[int]) -> tuple[float, float]:
        offset_x, offset_y = self.image_offset
        return (
            offset_x + point[0] * self.display_scale,
            offset_y + point[1] * self.display_scale,
        )

    def canvas_to_original(self, x: float, y: float) -> list[int] | None:
        if self.current_image is None:
            return None
        offset_x, offset_y, display_width, display_height = self.display_geometry()
        if x < offset_x or y < offset_y or x > offset_x + display_width or y > offset_y + display_height:
            return None
        image_width, image_height = self.current_image.size
        original_x = round((x - offset_x) / self.display_scale)
        original_y = round((y - offset_y) / self.display_scale)
        original_x = max(0, min(image_width, int(original_x)))
        original_y = max(0, min(image_height, int(original_y)))
        return [original_x, original_y]

    def fixed_points(self) -> list[list[int]]:
        if self.current_image is None:
            return [[0, 0], [0, 0]]
        _, height = self.current_image.size
        return [[0, 0], [0, height]]

    def polygon_points(self) -> list[list[int]] | None:
        if self.current_image is None or len(self.click_points) != 2:
            return None
        left_top, left_bottom = self.fixed_points()
        right_points = sorted(self.click_points, key=lambda point: point[1])
        right_top, right_bottom = right_points
        return [left_top, right_top, right_bottom, left_bottom]

    def render(self) -> None:
        self.canvas.delete("all")
        if self.current_image is None:
            return

        offset_x, offset_y, display_width, display_height = self.display_geometry()
        resized = self.current_image.resize((display_width, display_height), Image.Resampling.LANCZOS)
        self.tk_image = ImageTk.PhotoImage(resized)
        self.canvas.create_image(offset_x, offset_y, image=self.tk_image, anchor="nw")
        self.canvas.create_rectangle(
            offset_x,
            offset_y,
            offset_x + display_width,
            offset_y + display_height,
            outline="#999999",
        )

        fixed = self.fixed_points()
        for point in fixed:
            self.draw_point(point, "#0077cc")

        for point in self.click_points:
            self.draw_point(point, "#d62728")

        polygon = self.polygon_points()
        if polygon:
            canvas_points: list[float] = []
            for point in polygon:
                cx, cy = self.original_to_canvas(point)
                canvas_points.extend([cx, cy])
            self.canvas.create_polygon(canvas_points, outline="#d62728", fill="", width=2)

            bbox = bbox_from_points(polygon)
            x1, y1 = self.original_to_canvas([bbox[0], bbox[1]])
            x2, y2 = self.original_to_canvas([bbox[2], bbox[3]])
            self.canvas.create_rectangle(x1, y1, x2, y2, outline="#ff9900", width=2, dash=(5, 3))

        self.update_meta()

    def draw_point(self, point: list[int], color: str) -> None:
        cx, cy = self.original_to_canvas(point)
        radius = 5
        self.canvas.create_oval(cx - radius, cy - radius, cx + radius, cy + radius, fill=color, outline="white", width=1)

    def on_canvas_click(self, event: tk.Event) -> None:
        point = self.canvas_to_original(event.x, event.y)
        if point is None:
            return
        if len(self.click_points) >= 2:
            self.click_points = []
        self.click_points.append(point)
        self.render()

    def undo_point(self) -> None:
        if self.click_points:
            self.click_points.pop()
            self.render()

    def reset_points(self) -> None:
        self.click_points = []
        self.render()

    def label_record(self, status: str, points: list[list[int]] | None = None) -> dict[str, Any]:
        item = self.current_item()
        record: dict[str, Any] = {
            "image": image_key(item),
            "schoolCode": item.school_code,
            "schoolName": item.school_name,
            "officeCode": item.office_code,
            "officeName": item.office_name,
            "region": item.region,
            "localPath": str(item.local_path),
            "logoUrl": item.logo_url,
            "width": item.width,
            "height": item.height,
            "status": status,
        }
        if points:
            record["points"] = points
            record["bbox"] = bbox_from_points(points)
        return record

    def write_labels(self) -> None:
        self.labels_path.parent.mkdir(parents=True, exist_ok=True)
        ordered = {
            image_key(item): self.labels[image_key(item)]
            for item in self.items
            if image_key(item) in self.labels
        }
        self.labels_path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2), encoding="utf-8")

    def save_label(self) -> None:
        polygon = self.polygon_points()
        if polygon is None:
            self.status_var.set("Need two right-side clicks before saving.")
            return
        item = self.current_item()
        self.labels[image_key(item)] = self.label_record("labeled", polygon)
        self.write_labels()
        self.next_unlabeled()

    def save_status(self, status: str) -> None:
        item = self.current_item()
        self.labels[image_key(item)] = self.label_record(status)
        self.write_labels()
        self.next_unlabeled()

    def next_item(self) -> None:
        self.current_index = (self.current_index + 1) % len(self.items)
        self.load_current_item()

    def prev_item(self) -> None:
        self.current_index = (self.current_index - 1) % len(self.items)
        self.load_current_item()

    def next_unlabeled(self) -> None:
        start = self.current_index
        for step in range(1, len(self.items) + 1):
            candidate = (start + step) % len(self.items)
            if image_key(self.items[candidate]) not in self.labels:
                self.current_index = candidate
                self.load_current_item()
                return
        self.next_item()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Label emblem polygons in school header logos.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        items = read_manifest(args.manifest)
    except Exception as exc:
        print(f"Failed to read manifest: {exc}", file=sys.stderr)
        return 2
    if not items:
        print("No logo items in manifest.", file=sys.stderr)
        return 2

    app = EmblemLabeler(items, args.labels)
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
