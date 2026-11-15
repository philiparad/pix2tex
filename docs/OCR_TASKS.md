# Browser-only mathematical OCR implementation backlog

Architecture: static GitHub Pages frontend → on-device preprocessing → ONNX Runtime Web (WASM first) → encoder → autoregressive decoder → tokenizer → editable MathJax. No Python, no API credentials, no image upload.

The original RapidLaTeXOCR implementation is the reference for normalization (mean 0.7931, std 0.1738), stride-32 padding, BOS 1, EOS 2, encoder and iterative decoder; see https://github.com/RapidAI/RapidLaTeXOCR/tree/main/rapid_latex_ocr .

| Task | Deliverable | Acceptance gate | Status |
| --- | --- | --- | --- |
| OCR-001 | Model architecture / licenses / source pinned | Document model origin, constraints and privacy | Done |
| OCR-002 | Deterministic image preprocessing | Tests for crop, padding, sizing, normalization | Implemented with multi-scale mitigation; exact pixel parity pending |
| OCR-003 | ONNX loader / error reporting | Show precise model/filename/download errors | Browser model loading verified in CI |
| OCR-004 | Encoder + decoder inference | Real outputs only; fail on incompatible tensors | Verified on actual ONNX model in Chromium |
| OCR-005 | Tokenizer + decoder tests | Golden token sequence and termination tests | Unit tests + 4 printed MathJax image fixtures passing |
| OCR-006 | Pin release model checksums | Verify source integrity and file digest | Pending |
| OCR-007 | Compare Python baseline on fixed images | Accuracy + tensor parity report | Python/browser output agree on x+1=2; exact tensor parity pending |
| OCR-008 | Browser UI regression + loading/progress | Chrome/Edge/Firefox, first/second load | Chromium upload/button/MathJax round-trip passed; Edge/Firefox/mobile pending |
| OCR-009 | GPU performance, cancellation | WebGPU fallback to WASM, timeout | Pending |
| OCR-010 | Teacher-Board integration | Authenticated message origin, insertion test | Same-origin popup message contract passed; Teacher-Board host insertion pending |
| OCR-011 | GitHub Pages E2E CI | Live image→LaTeX tests and deployment monitoring | CI: 4 real ONNX fixtures, UI round-trip, popup message; public Pages URL test pending |

Model distribution: use a pinned model revision from Hugging Face rather than checking ~179MB of weights into Git. The configured URL must be CORS-accessible. First use downloads large model assets. Model URLs must be configurable because third-party hosting can change.

IMPORTANT: ONNX contract and image-to-LaTeX accuracy must be checked against actual model bytes in a browser before the recognition feature can be considered complete. Successful static tests do not establish that the end-to-end OCR works.

## CI evidence

GitHub Actions `Static and OCR contract checks` runs on pushes and checks JavaScript syntax, crop/decoder unit tests, and static hosting entrypoint files. A passing run proves **only these tests**. It does **not** prove correct model inference or accurate LaTeX on actual mathematical images.

## Actual browser OCR evidence (2026-11-15)

The Playwright/Chromium workflow ran real `image_resizer.onnx`, `encoder.onnx` and `decoder.onnx` using MathJax-rendered PNG images. Correct normalized expressions were observed for: `x+1=2`, `x^{2}+1=0`, `\\frac{x}{2}`, and `\\sqrt{x+1}`. The Python baseline also recognized `x+1=2`. Four exact-output regression assertions are now part of the slow CI suite.

This evidence validates a **small, typeset-image sample**, not handwriting, broad mathematical accuracy, browser compatibility, or Teacher-Board end-to-end insertion.

## Browser UI and Teacher-Board contract

The headless Chromium workflow verifies that an uploaded PNG can be recognized from the UI, inserted into the editable LaTeX field, and rendered via MathJax. It also verifies a same-origin popup sends `{type:'pix2tex:result',latex:'x+1=2',source:'pix2tex-browser-lab',version:1}` to its opener. This validates the transport contract, **not** actual insertion into Teacher-Board's document model.
