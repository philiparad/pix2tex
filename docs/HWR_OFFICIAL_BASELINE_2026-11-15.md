# Official Google MathWriting excerpt TEST — baseline

Source: https://storage.googleapis.com/mathwriting_data/mathwriting-2024-excerpt.tgz
License: CC BY-NC-SA 4.0 (Google LLC)
Benchmark: 6 predetermined real handwritten InkML TEST items, indexed 0,3,7,11,19,27 after sorting test-file names. Rasterized using `scripts/fetch_official_mathwriting.py`. Test images are not included in this repository.

Observed browser ONNX results, 2026-11-15:
- Exact expression accuracy **0 / 6 (0%)**
- Non-empty outputs **6 / 6**
- Character error rate **4.1235955 (412.4%)**
- Median runtime **12,877.5 milliseconds**
- P95 runtime **18,093.75 milliseconds**
- Maximum decoding length in browser benchmark: **128 tokens per candidate**
- Browser workflow: https://github.com/philiparad/pix2tex/actions/runs/43722053437

**Interpretation:** Current OCR cannot be called handwriting-ready. The six images are a development smoke suite, not a representative or statistically meaningful accuracy estimate.

Follow-up: run the original RapidLaTeXOCR Python model against the *same PNGs* and compare raw output. This distinguishes upstream model weakness from browser normalization / resizing mismatch. Do not silently combine results from Hugging Face's MathWriting-human export with this official excerpt; they differ in rasterization and source preprocessing.
