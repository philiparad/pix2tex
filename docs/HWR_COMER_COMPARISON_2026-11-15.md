# Handwriting engine comparative baseline — 2026-11-15

Official held-out Google MathWriting InkML test subset: **fixed indices 0,3,7,11,19,27**, identical rasterized PNG images for all engines, with no cherry-picking.

| Engine | Exact matches | CER | Median inference |
| --- | ---: | ---: | ---: |
| RapidLaTeXOCR in browser | 0/6 (0%) | 4.1236 (412.4%) | 12.9s |
| Original Python RapidLaTeXOCR | 0/6 (0%) | Not measured | Not measured |
| CoMER INT8 in browser | **2/6 (33.3%)** | **0.3371 (33.7%)** | **1.20s** |

Real CoMER Chromium evidence: https://github.com/philiparad/pix2tex/actions/runs/43736521887

CoMER sample output:
- Index 3, reference `x_{1}-x_{2}+x_{0}=0`, prediction `x _ { 1 } - x _ { 2 } + x _ { 0 } = 0` (correct normalized)
- Index 27, reference `-a^{n}u[-n-1]`, prediction `- a ^ { n } u [ - n - 1 ]` (correct normalized)
- Index 0, `(x-y)/sqrt(2)`, predicted `x - y / s q r + ( 2 )` (incorrect)

## Interpretation
CoMER clearly outperformed the previous model on this tiny, fixed six-example sample. **Do not generalize these percentages to all handwritten math.** Original samples include difficult notation and were rasterized from original pen strokes. Differences in handwriting acquisition, scanner noise, font, and expression length may affect results.

## Runtime
CoMER encoder ~3.4 MB, decoder ~4.0 MB (INT8); browser WASM; requires no API key, server or Python. Models are imported from a pinned external GitHub commit through jsDelivr. Single-thread WASM fallback works on ordinary GitHub Pages.

## Next acceptance gates
1. At least 100 held-out examples, fixed sample seed and stratification by notation, length, writer.
2. Check CoMER's original model weights redistribution / attribution terms separately from the library's Apache-2.0 license.
3. Verify exact LaTeX equivalence and renderability; CER and structural match separately.
4. Browser UI end-to-end on real handwritten PNG, including model selector and MathJax.
5. Add failure warning and ensure teacher must verify math notation before sending to Teacher-Board.
6. Test Windows Edge/Chrome, mobile browser and memory pressure.
