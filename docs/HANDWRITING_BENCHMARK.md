# Handwritten mathematical OCR benchmark

## Goal
Measure **genuine human handwriting** recognition by the *browser* ONNX engine, independently of MathJax-rendered fixture tests. Never call printed formulas handwritten.

## Tasks and acceptance gates
| ID | Work | Gate |
|---|---|---|
| HWR-001 | Define dataset, split, licensing, metrics | Source attribution; no train/test mixing |
| HWR-002 | Deterministic real-handwriting fixture fetcher | Checked image bytes, reference text, row provenance |
| HWR-003 | Independent metric calculator and unit tests | Exact match, CER, normalized CER, coverage, time |
| HWR-004 | Chromium ONNX benchmark runner | Real images processed by production recognizeMath |
| HWR-005 | Manual GitHub Actions workflow | Real score artifacts, fail on missing/empty dataset |
| HWR-006 | Examine measured failures and optimize | Compare to Python on same samples |
| HWR-007 | CROHME 2019 evaluation | Official held-out evaluation and licensing |
| HWR-008 | Classroom-photo/handwriting acceptance set | Consent, privacy, stratification, multiple writers |

## Dataset
**Primary:** [MathWriting-human](https://huggingface.co/datasets/deepcopy/MathWriting-human), config `default`, split `test`. Source includes genuine handwritten equations, raster images and reference LaTeX. Images are obtained on demand from Hugging Face's dataset viewer API, **not** copied into the repository. Sampling is determined by explicit fixed row offsets; never select samples based on model correctness.

**Secondary:** [CROHME 2019](https://tc11.cvc.uab.es/datasets/ICDAR2019-CROHME-TDF_1), original competition dataset, noncommercial CC BY-NC-SA 3.0. Store only user-provided/authorized files locally; don't mirror the dataset without verifying rights.

## Protocol
1. Run `python3 scripts/fetch_handwriting.py --out benchmark-fixtures --offsets 0,3,7,11,19,27`. It downloads original image bytes and creates `manifest.json`, including source URL, split, row ID, SHA-256, and expected LaTeX.
2. Serve repository via `python3 -m http.server 8000`.
3. Run `node tests/handwriting-browser.mjs` under Playwright. Each image is processed with `recognizeMath()` (the production ONNX path). No replacement or mocked recognition.
4. Review `benchmark-results/handwriting-results.json` and `handwriting-summary.md`. Keep distinct `inference_errors`, *exact match* and CER. Fail if the dataset cannot be retrieved or zero images were actually inferred.
5. Retain workflow run ID, UTC timestamp, dataset, selected row indices, model URL, and code SHA. Do not claim broad accuracy from a six-image smoke benchmark.

## Metrics
- **Exact LaTeX (normalized):** exact byte sequence after a conservative whitespace normalization. We do not assume expressions are equivalent because they render similarly.
- **Character error rate:** sum of Levenshtein edit distances over Unicode codepoints / total reference codepoints. Values may exceed 1 if insertions dominate.
- **Success rate:** nonempty prediction with no exception / all attempted inputs. A confidently wrong answer is not a success on the exact-accuracy metric.
- **Latency:** per-sample time; report median, p95 and model cold-load time separately where measured.
- All empty, missing or inaccessible inputs must cause a test failure, never count as 100% accuracy.

## Interpreting results
A small deterministic smoke set validates the benchmark mechanism, not statistical generalization. Do not use the handwriting score as a product-quality claim until a sufficiently large, representative, held-out, multi-writer benchmark has been completed. Keep student data private; do not log/upload identifiable writing or personal information.
