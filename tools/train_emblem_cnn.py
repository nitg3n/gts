#!/usr/bin/env python3
"""Train a small CNN to predict the emblem's right-side boundary points."""

from __future__ import annotations

import argparse
import csv
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image, ImageOps
from torch import nn
from torch.utils.data import DataLoader, Dataset


DEFAULT_MANIFEST = Path("outputs") / "school-logos" / "labeling_manifest.csv"
DEFAULT_LABELS = Path("outputs") / "school-logos" / "emblem_labels.json"
DEFAULT_MODEL = Path("outputs") / "school-logos" / "models" / "emblem_cnn.pt"
IMAGE_WIDTH = 256
IMAGE_HEIGHT = 96


@dataclass
class Sample:
    image_key: str
    local_path: Path
    width: int
    height: int
    target: torch.Tensor


class EmblemDataset(Dataset[tuple[torch.Tensor, torch.Tensor, int, int]]):
    def __init__(self, samples: list[Sample], augment: bool) -> None:
        self.samples = samples
        self.augment = augment

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor, int, int]:
        sample = self.samples[index]
        image = Image.open(sample.local_path).convert("RGBA")
        image = alpha_composite_on_white(image)

        if self.augment:
            image = random_color_jitter(image)

        tensor = image_to_tensor(image)
        return tensor, sample.target, sample.width, sample.height


class EmblemBoundaryCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 24, kernel_size=3, padding=1),
            nn.BatchNorm2d(24),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(24, 48, kernel_size=3, padding=1),
            nn.BatchNorm2d(48),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(48, 96, kernel_size=3, padding=1),
            nn.BatchNorm2d(96),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(96, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((1, 1)),
        )
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.1),
            nn.Linear(64, 4),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


def alpha_composite_on_white(image: Image.Image) -> Image.Image:
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    background.alpha_composite(image)
    return background.convert("RGB")


def random_color_jitter(image: Image.Image) -> Image.Image:
    array = np.asarray(image).astype(np.float32)
    contrast = random.uniform(0.9, 1.1)
    brightness = random.uniform(-10, 10)
    array = (array - 127.5) * contrast + 127.5 + brightness
    array = np.clip(array, 0, 255).astype(np.uint8)
    return Image.fromarray(array, mode="RGB")


def image_to_tensor(image: Image.Image) -> torch.Tensor:
    image = ImageOps.contain(image, (IMAGE_WIDTH, IMAGE_HEIGHT), method=Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT), (255, 255, 255))
    x = (IMAGE_WIDTH - image.width) // 2
    y = (IMAGE_HEIGHT - image.height) // 2
    canvas.paste(image, (x, y))
    array = np.asarray(canvas).astype(np.float32) / 255.0
    array = np.transpose(array, (2, 0, 1))
    return torch.from_numpy(array)


def read_manifest(path: Path) -> dict[str, dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    return {Path(row["local_path"]).name: row for row in rows}


def read_labeled_samples(manifest_path: Path, labels_path: Path) -> list[Sample]:
    manifest = read_manifest(manifest_path)
    labels = json.loads(labels_path.read_text(encoding="utf-8"))
    samples: list[Sample] = []
    for image_key, label in labels.items():
        if label.get("status") != "labeled":
            continue
        row = manifest.get(image_key)
        if not row:
            continue
        local_path = Path(row["local_path"])
        if not local_path.is_absolute():
            local_path = Path.cwd() / local_path
        if not local_path.exists():
            continue

        width = int(label.get("width") or row.get("width") or 0)
        height = int(label.get("height") or row.get("height") or 0)
        points = label.get("points") or []
        if width <= 0 or height <= 0 or len(points) != 4:
            continue

        right_top = points[1]
        right_bottom = points[2]
        target = torch.tensor(
            [
                clamp01(float(right_top[0]) / width),
                clamp01(float(right_top[1]) / height),
                clamp01(float(right_bottom[0]) / width),
                clamp01(float(right_bottom[1]) / height),
            ],
            dtype=torch.float32,
        )
        samples.append(Sample(image_key=image_key, local_path=local_path, width=width, height=height, target=target))
    return samples


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def split_samples(samples: list[Sample], val_ratio: float, seed: int) -> tuple[list[Sample], list[Sample]]:
    shuffled = list(samples)
    random.Random(seed).shuffle(shuffled)
    val_count = max(1, int(round(len(shuffled) * val_ratio)))
    return shuffled[val_count:], shuffled[:val_count]


def bbox_iou(pred: torch.Tensor, target: torch.Tensor, widths: torch.Tensor, heights: torch.Tensor) -> torch.Tensor:
    pred_x2 = torch.maximum(pred[:, 0], pred[:, 2]) * widths
    pred_y1 = torch.minimum(pred[:, 1], pred[:, 3]) * heights
    pred_y2 = torch.maximum(pred[:, 1], pred[:, 3]) * heights
    target_x2 = torch.maximum(target[:, 0], target[:, 2]) * widths
    target_y1 = torch.minimum(target[:, 1], target[:, 3]) * heights
    target_y2 = torch.maximum(target[:, 1], target[:, 3]) * heights

    inter_x2 = torch.minimum(pred_x2, target_x2)
    inter_y1 = torch.maximum(pred_y1, target_y1)
    inter_y2 = torch.minimum(pred_y2, target_y2)
    inter_area = torch.clamp(inter_x2, min=0) * torch.clamp(inter_y2 - inter_y1, min=0)
    pred_area = torch.clamp(pred_x2, min=0) * torch.clamp(pred_y2 - pred_y1, min=0)
    target_area = torch.clamp(target_x2, min=0) * torch.clamp(target_y2 - target_y1, min=0)
    union = pred_area + target_area - inter_area
    return inter_area / torch.clamp(union, min=1.0)


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict[str, float]:
    model.eval()
    total_loss = 0.0
    total_count = 0
    ious: list[torch.Tensor] = []
    pixel_errors: list[torch.Tensor] = []
    criterion = nn.SmoothL1Loss(reduction="sum")
    for images, targets, widths, heights in loader:
        images = images.to(device)
        targets = targets.to(device)
        widths = widths.to(device=device, dtype=torch.float32)
        heights = heights.to(device=device, dtype=torch.float32)
        preds = model(images)
        loss = criterion(preds, targets)
        total_loss += float(loss.item())
        total_count += int(targets.numel())

        ious.append(bbox_iou(preds, targets, widths, heights).cpu())
        x_error = torch.abs(torch.maximum(preds[:, 0], preds[:, 2]) - torch.maximum(targets[:, 0], targets[:, 2])) * widths
        pixel_errors.append(x_error.cpu())

    if not ious:
        return {"loss": 0.0, "iou": 0.0, "x_mae_px": 0.0}
    return {
        "loss": total_loss / max(total_count, 1),
        "iou": float(torch.cat(ious).mean().item()),
        "x_mae_px": float(torch.cat(pixel_errors).mean().item()),
    }


def train(args: argparse.Namespace) -> dict[str, Any]:
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.set_num_threads(max(1, args.threads))

    samples = read_labeled_samples(args.manifest, args.labels)
    if len(samples) < 50:
        raise RuntimeError(f"not enough labeled samples: {len(samples)}")
    train_samples, val_samples = split_samples(samples, args.val_ratio, args.seed)

    train_loader = DataLoader(
        EmblemDataset(train_samples, augment=True),
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
    )
    val_loader = DataLoader(
        EmblemDataset(val_samples, augment=False),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
    )

    device = torch.device("cuda" if torch.cuda.is_available() and not args.cpu else "cpu")
    model = EmblemBoundaryCNN().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    criterion = nn.SmoothL1Loss()

    best_state = None
    best_iou = -1.0
    history: list[dict[str, float]] = []

    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_loss = 0.0
        batches = 0
        for images, targets, _, _ in train_loader:
            images = images.to(device)
            targets = targets.to(device)
            preds = model(images)
            loss = criterion(preds, targets)
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            optimizer.step()
            epoch_loss += float(loss.item())
            batches += 1

        val_metrics = evaluate(model, val_loader, device)
        record = {
            "epoch": float(epoch),
            "train_loss": epoch_loss / max(batches, 1),
            "val_loss": val_metrics["loss"],
            "val_iou": val_metrics["iou"],
            "val_x_mae_px": val_metrics["x_mae_px"],
        }
        history.append(record)

        if val_metrics["iou"] > best_iou:
            best_iou = val_metrics["iou"]
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

        if epoch == 1 or epoch % args.log_every == 0 or epoch == args.epochs:
            print(
                f"epoch={epoch:03d} "
                f"train_loss={record['train_loss']:.5f} "
                f"val_loss={record['val_loss']:.5f} "
                f"val_iou={record['val_iou']:.4f} "
                f"val_x_mae_px={record['val_x_mae_px']:.2f}",
                flush=True,
            )

    if best_state is not None:
        model.load_state_dict(best_state)
    train_metrics = evaluate(model, train_loader, device)
    val_metrics = evaluate(model, val_loader, device)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    checkpoint = {
        "model_state": model.state_dict(),
        "model_name": "EmblemBoundaryCNN",
        "image_width": IMAGE_WIDTH,
        "image_height": IMAGE_HEIGHT,
        "target": "right_top_x,right_top_y,right_bottom_x,right_bottom_y",
        "train_count": len(train_samples),
        "val_count": len(val_samples),
        "seed": args.seed,
        "train_metrics": train_metrics,
        "val_metrics": val_metrics,
        "history": history,
    }
    torch.save(checkpoint, args.output)

    summary_path = args.output.with_suffix(".summary.json")
    summary_path.write_text(
        json.dumps(
            {
                "model": str(args.output),
                "train_count": len(train_samples),
                "val_count": len(val_samples),
                "train_metrics": train_metrics,
                "val_metrics": val_metrics,
                "best_val_iou": best_iou,
                "epochs": args.epochs,
                "device": str(device),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return checkpoint


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train an emblem boundary CNN.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS)
    parser.add_argument("--output", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--epochs", type=int, default=120)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--log-every", type=int, default=10)
    parser.add_argument("--cpu", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = train(args)
    print("saved_model=", args.output)
    print("train_count=", result["train_count"])
    print("val_count=", result["val_count"])
    print("val_metrics=", json.dumps(result["val_metrics"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
