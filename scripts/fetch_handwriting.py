#!/usr/bin/env python3
"""Download deterministic genuine handwritten images from MathWriting's TEST split.
Requires Python 3.10+ and Pillow. Never substitutes generated/printed images.
"""
import argparse
import hashlib
import io
import json
import time
from urllib.error import HTTPError, URLError
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DATASET = "deepcopy/MathWriting-human"
CONFIG = "default"
SPLIT = "test"
API = "https://datasets-server.huggingface.co/rows"

def get_bytes(url):
    request = Request(url, headers={"User-Agent": "pix2tex-handwriting-benchmark/1.0"})
    for attempt in range(5):
        try:
            with urlopen(request, timeout=65) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as exc:
            if isinstance(exc, HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                raise
            if attempt == 4:
                raise
            delay = 2 ** attempt
            print(f"Transient download problem ({exc}); retrying in {delay}s", flush=True)
            time.sleep(delay)
    raise RuntimeError("Unreachable download code")

def fetch(offsets, output):
    from PIL import Image
    output.mkdir(parents=True, exist_ok=True)
    manifest = {
        "dataset": DATASET,
        "config": CONFIG,
        "split": SPLIT,
        "sampling": "fixed row indices (preselected, not model-selected)",
        "items": [],
    }
    # One metadata request for all offsets reduces server load and retries.
    start = min(offsets)
    stop = max(offsets) + 1
    if stop - start > 100:
        raise ValueError("Fixed offsets must lie within one 100-row window")
    params = urlencode({"dataset": DATASET, "config": CONFIG, "split": SPLIT,
                        "offset": start, "length": stop - start})
    payload = json.loads(get_bytes(API + "?" + params))
    by_index = {item["row_idx"]: item["row"] for item in payload.get("rows", [])}
    for row_index in offsets:
        if row_index not in by_index:
            raise ValueError(f"Missing expected test row {row_index}")
        row = by_index[row_index]
        expected = row.get("latex")
        image_info = row.get("image")
        if not isinstance(expected, str) or not expected.strip():
            raise ValueError(f"No reference LaTeX for test row {row_index}")
        if not isinstance(image_info, dict) or not image_info.get("src"):
            raise ValueError(f"No actual image URL for test row {row_index}")
        raw = get_bytes(image_info["src"])
        source_sha256 = hashlib.sha256(raw).hexdigest()
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            if image.width < 4 or image.height < 4 or image.width * image.height > 30_000_000:
                raise ValueError(f"Invalid image size for test row {row_index}")
            # Convert to predictable PNG, preserving image pixels without generating text.
            image = image.convert("RGB")
            filename = f"mathwriting-test-{row_index:06d}.png"
            image.save(output / filename, "PNG")
        manifest["items"].append({
            "id": str(row.get("sample_id") or row_index),
            "index": row_index,
            "file": filename,
            "latex": expected,
            "source_sha256": source_sha256,
            "png_sha256": hashlib.sha256((output / filename).read_bytes()).hexdigest(),
            "original_size": len(raw),
        })
        print(f"Fetched test index {row_index}: {filename} ({len(raw)} source bytes)")
    if len(manifest["items"]) != len(offsets):
        raise ValueError("Some requested samples were not obtained")
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Manifest:", output / "manifest.json")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="benchmark-fixtures")
    parser.add_argument("--offsets", default="0,3,7,11,19,27")
    args = parser.parse_args()
    offsets = [int(i.strip()) for i in args.offsets.split(",")]
    if not offsets or min(offsets) < 0 or len(set(offsets)) != len(offsets):
        parser.error("Offsets must be distinct nonnegative row indices")
    fetch(offsets, Path(args.out))
