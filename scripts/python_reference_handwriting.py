#!/usr/bin/env python3
"""Compare upstream RapidLaTeXOCR on the EXACT same benchmark PNGs.

This runs in CI for diagnostic purposes; the shipping application remains
browser-only and requires no Python service.
"""
import json
import re
import statistics
import time
from pathlib import Path
from rapid_latex_ocr import LaTeXOCR

root=Path("benchmark-fixtures")
output=Path("benchmark-results")
output.mkdir(exist_ok=True)
manifest=json.loads((root/"manifest.json").read_text(encoding="utf8"))
model=LaTeXOCR()
def normalized(text):
    return re.sub(r"\s+","",str(text)).strip()
results=[]
for row in manifest["items"]:
    started=time.perf_counter()
    result={"id":row["id"],"index":row["index"],"reference":row["latex"],"prediction":"","status":"error"}
    try:
        pred=model(str(root/row["file"]))
        prediction=pred[0] if isinstance(pred,tuple) else pred
        result["prediction"]=prediction
        result["status"]="ok"
        result["exact"]=normalized(prediction)==normalized(row["latex"])
    except Exception as e:
        result["error"]=str(e)[:400]
        result["exact"]=False
    result["seconds"]=round(time.perf_counter()-started,3)
    print("Python handwritten test",row["index"],result["status"],"correct",result["exact"],flush=True)
    results.append(result)
data={
    "source":manifest["dataset"],"split":manifest["split"],"samples":len(results),
    "exact_matches":sum(item["exact"] for item in results),
    "completed":sum(item["status"]=="ok" for item in results),
    "results":results
}
(output/"python-reference.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("PYTHON_REFERENCE_SUMMARY",json.dumps({k:data[k] for k in ("source","split","samples","exact_matches","completed")}))
