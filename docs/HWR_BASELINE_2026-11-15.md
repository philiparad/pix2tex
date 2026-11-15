# First genuine handwritten mathematics baseline — 2026-11-15

## Source
- Dataset: `deepcopy/MathWriting-human`
- Split: **test**; fixed row indices `0,3,7,11,19,27`
- Real handwritten RGB images, **not MathJax or synthetic handwriting fonts**
- Browser: Chromium / ONNX Runtime Web (WASM)
- Evidence: https://github.com/philiparad/pix2tex/actions/runs/43721283832

## Results

| Metric | Observation |
| --- | --- |
| Sample size | 6 |
| Recognition completed | 6 / 6 |
| Exact LaTeX transcription | **0 / 6 (0.0%)** |
| Character error rate | **10.9329 (1093.3%)** |
| Median time | **26,520.5 ms** |
| P95 time | **194,977 ms** |
| Initial model load | **33,429 ms** |

**Important:** CER may exceed 100% when the model generates many spurious characters. A successful runtime invocation does not mean successful mathematical recognition. The sample size is far too small for a general population claim, but the observed failures are severe.

## Follow-up engineering actions
1. Keep the true handwritten benchmarks non-gating until a defensible benchmark set and reference-equivalence policy are established; they must still publish scores and explicit failures.
2. Limit runaway autoregressive inference to 128 tokens per candidate in benchmark mode.
3. Verify official Google MathWriting test InkML rendering and compare results; report this as a separate dataset rather than pooling scores from distinct sources.
4. Inspect preprocessing fidelity and grayscale/brush size on handwriting.
5. Compare source images with the original Python model to separate model limitations from ONNX port defects.
6. Test a suitable handwriting-trained model if RapidLaTeXOCR cannot achieve useful accuracy.

Do not present this implementation as handwriting-accurate or classroom-ready on the basis of the printed-equation test suite.
