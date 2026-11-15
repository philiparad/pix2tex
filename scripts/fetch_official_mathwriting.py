#!/usr/bin/env python3
"""Download official MathWriting excerpt and rasterize its real TEST InkML strokes.

Data: CC BY-NC-SA 4.0, Google LLC, https://github.com/google-research/google-research/tree/master/mathwriting
No source images or InkML files are committed to the repository.
"""
import argparse
import hashlib
import io
import json
import math
import tarfile
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw

SOURCE = "https://storage.googleapis.com/mathwriting_data/mathwriting-2024-excerpt.tgz"
DATASET = "google/mathwriting-2024-excerpt"
def get_archive():
    request = Request(SOURCE, headers={"User-Agent":"pix2tex-handwriting-benchmark/1"})
    with urlopen(request, timeout=90) as response:
        return response.read()

def parse_inkml(data):
    root = ET.fromstring(data)
    annotations = {
        node.attrib.get("type"): (node.text or "").strip()
        for node in root.iter() if node.tag.rsplit("}",1)[-1]=="annotation"
    }
    label = annotations.get("normalizedLabel") or annotations.get("label")
    if not label:
        raise ValueError("InkML missing normalizedLabel and label")
    strokes=[]
    for node in root.iter():
        if node.tag.rsplit("}",1)[-1]!="trace":
            continue
        points=[]
        for sample in (node.text or "").replace("\n"," ").split(","):
            coords=sample.strip().split()
            if len(coords)<2:continue
            try:x,y=float(coords[0]),float(coords[1])
            except ValueError:continue
            if math.isfinite(x) and math.isfinite(y):points.append((x,y))
        if points:strokes.append(points)
    if not strokes:raise ValueError("InkML contains no valid pen strokes")
    return label,strokes

def render_strokes(strokes, target_max=512, margin=16):
    coordinates=[p for stroke in strokes for p in stroke]
    min_x=min(x for x,_ in coordinates);max_x=max(x for x,_ in coordinates)
    min_y=min(y for _,y in coordinates);max_y=max(y for _,y in coordinates)
    extent_x=max(1.,max_x-min_x);extent_y=max(1.,max_y-min_y)
    scale=min(1.7,(target_max-2*margin)/max(extent_x,extent_y))
    w=max(32,int(math.ceil(extent_x*scale))+2*margin)
    h=max(32,int(math.ceil(extent_y*scale))+2*margin)
    image=Image.new("RGB",(w,h),"white")
    painter=ImageDraw.Draw(image)
    brush=2
    for stroke in strokes:
        path=[((x-min_x)*scale+margin,(y-min_y)*scale+margin) for x,y in stroke]
        if len(path)==1:
            x,y=path[0];painter.ellipse((x-brush,y-brush,x+brush,y+brush),fill="black")
        else:
            painter.line(path,fill="black",width=brush*2,joint="curve")
            for x,y in (path[0],path[-1]):
                painter.ellipse((x-brush,y-brush,x+brush,y+brush),fill="black")
    return image

def main(out,offsets):
    out.mkdir(parents=True,exist_ok=True)
    payload=get_archive()
    archive_hash=hashlib.sha256(payload).hexdigest()
    tar=tarfile.open(fileobj=io.BytesIO(payload),mode="r:gz")
    members=sorted(
        [m for m in tar.getmembers() if m.isfile() and "/test/" in m.name and m.name.endswith(".inkml")],
        key=lambda m:m.name
    )
    if not members:
        raise ValueError("Official excerpt contains no TEST InkML files")
    if min(offsets)<0 or max(offsets)>=len(members):
        raise ValueError(f"Selected indices must be in [0,{len(members)-1}]")
    manifest={
        "dataset":DATASET,"split":"test","config":"official-excerpt",
        "license":"CC BY-NC-SA 4.0",
        "source":SOURCE,"archive_sha256":archive_hash,
        "sampling":"fixed sorted test file indices (preselected, not model-selected)",
        "available_test_samples":len(members),"items":[]
    }
    for index in offsets:
        member=members[index]
        raw=tar.extractfile(member).read()
        latex,strokes=parse_inkml(raw)
        png=f"mathwriting-official-test-{index:06d}.png"
        render_strokes(strokes).save(out/png,"PNG")
        manifest["items"].append({
            "id":Path(member.name).stem,"index":index,"file":png,"latex":latex,
            "source_file":member.name,
            "source_sha256":hashlib.sha256(raw).hexdigest(),
            "png_sha256":hashlib.sha256((out/png).read_bytes()).hexdigest()
        })
        print(f"Official test index {index}: {png}, {len(strokes)} strokes",flush=True)
    (out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(f"Loaded {len(offsets)} genuine test items from {len(members)} available official excerpt test samples",flush=True)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",default="benchmark-fixtures")
    p.add_argument("--offsets",default="0,3,7,11,19,27")
    args=p.parse_args()
    values=[int(x.strip()) for x in args.offsets.split(",")]
    if not values or len(values)!=len(set(values)):p.error("Offsets must be distinct nonnegative integers")
    main(Path(args.out),values)
