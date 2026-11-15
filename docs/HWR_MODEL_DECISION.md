# Handwriting-trained browser models — evaluation and integration plan

Date: 2026-11-15. This decision record separates **published model claims** from **results verified in our repository**.

## Current state
The original RapidLaTeXOCR model and Python reference both scored 0/6 exact on the same official MathWriting held-out InkML samples. Printed-MathJax recognition passed four test formulas. **No working handwriting model is currently enabled in the application**.

## Candidate A: MathWriting-fine-tuned TrOCR
- Source: https://huggingface.co/onnx-community/latex_finetuned-ONNX
- Browser interface: Transformers.js image-to-text pipeline.
- Positive: fine-tuned for Google MathWriting; model card reports 14.9% CER on its own evaluation (not comparable to ours without identical data).
- **Measured blocker:** headless Chromium CI could not load the model; Transformers.js 3.8.1 requested `onnx/decoder_model_merged_quantized.onnx`, which does not exist in the repository. The unquantized decoder is ~1.2 GB, impractical for ordinary GitHub Pages classroom use.
- Evidence: https://github.com/philiparad/pix2tex/actions/runs/43735607595
- Decision: keep adapter source for future compatible export, but DISABLE the UI engine until real images run successfully in browser.

## Candidate B: CoMER INT8, from ink-on (next priority)
- Source: https://github.com/kimseungdae/ink-on, license Apache-2.0 for the application code, but verify upstream CoMER weights and training-data rights independently.
- Uses real mathematical handwriting training (CROHME), ~3.4 MB encoder + 4 MB decoder, browser ONNX Runtime Web, beam decoding and lightweight vocabulary.
- Upstream project reports 36.41% expression accuracy on CROHME 2014 for its INT8 beam-3 pipeline. **Not our benchmark result.**
- Its core library handles online pen STROKES. Our Teacher-Board input is primarily raster PNG; we must develop/test raster-to-CoMER preprocessing and must NOT pretend a bitmap is a sequence of original pen strokes.
- Work: obtain provenance/license and model exports; port framework-agnostic inference into vanilla JS; support both raster and original pen-stroke input; verify outputs using official MathWriting test PNGs and a CROHME subset.

## Task order and acceptance gates
1. HWR-034: Acquire CoMER exports and verify file integrity/licensing. No copyrighted dataset redistribution.
2. HWR-035: Reproduce CoMER raster preprocessing (white foreground on black, height/stride/padding mask).
3. HWR-036: Implement encoder and autoregressive decoder with token vocabulary, stopping, confidence and overflow handling.
4. HWR-037: Browser smoke tests with genuine handwriting; report exact and CER. Do not enable by default merely because it runs.
5. HWR-038: Benchmark >=100 held-out expressions across writers, types and difficulty; compare to RapidLaTeXOCR on IDENTICAL rasters.
6. HWR-039: Enable model only after functional tests and the external weights' redistribution terms are validated.
7. HWR-040: Improve screenshot multi-expression segmentation; fractions and matrices must not be split.
8. HWR-041: Teacher-Board insertion, manual review UI and ambiguous glyph warning.

## Screenshot regression (four formulas)
The uploaded image contains a vertical sequence of formulas. A whole-image single-formula OCR call is inappropriate and caused corrupted symbols. We added an opt-in separate-formulas mode. It segments rows and joins results with MathJax `gathered`; cropping one equation remains the safest choice. CI covers four typeset formulas and preserves a fraction as one expression. This does NOT establish arbitrary document layout analysis.
