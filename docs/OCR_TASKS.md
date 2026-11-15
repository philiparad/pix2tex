# Browser-only mathematical OCR implementation backlog

Architecture: static GitHub Pages frontend → on-device preprocessing → ONNX Runtime Web (WASM first) → encoder → autoregressive decoder → tokenizer → editable MathJax. No Python, no API credentials, no image upload.

The original RapidLaTeXOCR implementation is the reference for normalization (mean 0.7931, std 0.1738), stride-32 padding, BOS 1, EOS 2, encoder and iterative decoder; see https://github.com/RapidAI/RapidLaTeXOCR/tree/main/rapid_latex_ocr .

| Task | Deliverable | Acceptance gate | Status |
| --- | --- | --- | --- |
| OCR-001 | Model architecture / licenses / source pinned | Document model origin, constraints and privacy | Done |
| OCR-002 | Deterministic image preprocessing | Tests for crop, padding, sizing, normalization | In progress |
| OCR-003 | ONNX loader / error reporting | Show precise model/filename/download errors | In progress |
| OCR-004 | Encoder + decoder inference | Real outputs only; fail on incompatible tensors | In progress, unverified on real model |
| OCR-005 | Tokenizer + decoder tests | Golden token sequence and termination tests | In progress |
| OCR-006 | Pin release model checksums | Verify source integrity and file digest | Pending |
| OCR-007 | Compare Python baseline on fixed images | Accuracy + tensor parity report | Pending |
| OCR-008 | Browser UI regression + loading/progress | Chrome/Edge/Firefox, first/second load | Pending |
| OCR-009 | GPU performance, cancellation | WebGPU fallback to WASM, timeout | Pending |
| OCR-010 | Teacher-Board integration | Authenticated message origin, insertion test | Pending |
| OCR-011 | GitHub Pages E2E CI | Live image→LaTeX tests and deployment monitoring | Pending |

Model distribution: use a pinned model revision from Hugging Face rather than checking ~179MB of weights into Git. The configured URL must be CORS-accessible. First use downloads large model assets. Model URLs must be configurable because third-party hosting can change.

IMPORTANT: ONNX contract and image-to-LaTeX accuracy must be checked against actual model bytes in a browser before the recognition feature can be considered complete. Successful static tests do not establish that the end-to-end OCR works.
