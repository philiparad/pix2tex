# pix2tex Browser — Teacher-Board integration

**Status: v0.3 working experimental browser mathematical OCR.** Real ONNX inference and four MathJax-rendered PNG fixtures have passed in headless Chromium. Wider accuracy, handwriting, mobile browsers, and Teacher-Board insertion remain to be validated. This repository is intended for a browser-only image-to-LaTeX converter hosted as static files on GitHub Pages.

## Implemented

- Responsive HTML/CSS/JS page, no React or production server requirement.
- Image upload, drag/drop, clipboard paste and formula crop selection.
- Client-side image conversion utilities, editable LaTeX and live MathJax preview.
- Explicit `pix2tex:result` bridge to a same-origin parent/opener page on button click.
- ONNX asset checks and encoder session metadata diagnostics using ONNX Runtime Web.
- Node built-in unit tests for crop selection.

## Experimental inference implementation

The Recognize button executes real local image-to-LaTeX recognition: crop → grayscale and stride-32 normalization → ONNX image-size predictor → multi-scale candidates → ONNX encoder → decoder until EOS → BPE vocabulary decode → MathJax preview. It never substitutes fake OCR. A real Chromium test has validated four simple mathematical expressions, with Python reference agreement on one fixture. Browser preprocessing does not yet exactly match Pillow; multiple nearby widths are scored by the decoder as a mitigation. **Handwriting and broad accuracy remain unverified.** Errors are displayed if loading or inference fails.

Use the model directory input to supply the pinned Hugging Face model URL (preconfigured), or host a verified model locally. Initial weights are approximately **179 MB** and require an internet connection. Runtime memory use can be much higher.

See [sequenced implementation backlog](docs/OCR_TASKS.md).

## Model source and attribution

Original pix2tex: https://github.com/lukas-blecher/LaTeX-OCR (ViT/ResNet encoder, transformer decoder).

Candidate existing ONNX export: https://github.com/RapidAI/RapidLatexOCR

Candidate hosted model files: https://huggingface.co/inYourOwnBrowser/rapid-latex-ocr-onnx (image_resizer.onnx, encoder.onnx, decoder.onnx, tokenizer.json). Their documentation describes ~179MB of assets and client-side use, but those weights are not bundled here. Review licensing and upstream checksum / revision before use.

## Start locally

Run `python -m http.server 8000` then visit http://localhost:8000. Tests: `node --test tests/*.test.mjs`.

To check assets, keep the default pinned URL or place files in `models/` and change the model directory to `./models/`, then select Check model assets or Inspect ONNX encoder. The model files can also be served from a trusted CORS-enabled URL, but same-origin hosting is recommended for reliability.

## Deployment

1. The public repository `philiparad/pix2tex` already exists, and `main` contains `index.html` at repository root.
2. Open **Settings → Pages** in GitHub.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)**, then click **Save**.
4. Confirm the GitHub Pages URL `https://philiparad.github.io/pix2tex/` returns the UI, and that `style.css` and `src/app.js` load without errors in the browser's Network panel.
5. Verify that image selection and LaTeX/MathJax preview work; note that actual OCR remains unimplemented until an ONNX inference pipeline is added.
6. The repository includes `.nojekyll` to publish static assets without Jekyll processing.

**Deployment verification note (2026-11-15):** The repository contents were checked, but the live GitHub Pages site could not be confirmed from the available tools. GitHub Pages settings must be checked in the repository UI. No OCR functionality is claimed.

GitHub Pages serves static content and **cannot** run Python inference services. Keep OCR inference within browser JavaScript/WASM/WebGPU.

## Teacher-Board integration contract

On a user click the page sends the object:

```js
{type:'pix2tex:result',latex:'\\frac{a}{b}',source:'pix2tex-browser-lab',version:1}
```

Host listener example (use only when served from the same origin):

```js
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== 'pix2tex:result') return;
  const latex = event.data.latex;
  // insert latex in Teacher-Board's editor
});
```

For embedded cross-origin origins, define and validate an explicit allowlist and change `postMessage` target origin accordingly. Never use `'*'` for a trusted integration unless requirements justify it.

## Next implementation milestones

1. Record and verify SHA256 checksums of all ONNX assets and tokenizer.
2. Compare browser preprocessing to RapidLaTeXOCR Python preprocessing pixel-by-pixel, including size-predictor model.
3. Run live ONNX sessions, inspect tensor signatures, and fix any model input/output contract mismatch.
4. Validate ONNX decoder, masks, BOS/EOS, tokenization, and generation limits on a real benchmark.
5. Implement WASM fallback, optional WebGPU acceleration, and progress reporting.
6. Add image/LaTeX gold fixtures; measure character and expression accuracy, latency, memory, and MathJax compatibility.
7. Implement crop-to-board flow after recognition is validated.

## Security notes

Images are processed in memory and not uploaded by application code. ONNX runtime, MathJax scripts and optional weights currently refer to third-party origins and therefore require an internet connection on first load. Use pinned/self-hosted assets before claiming an offline release.

## Verified real-model results

The dedicated GitHub Actions workflow [Real ONNX browser smoke test](.github/workflows/ocr-browser.yml) loads actual models in Chromium. Its fixtures cover a linear equation, an exponent, a fraction, and a square root; all four produced the expected LaTeX in the first verified run. A later commit added strict assertions for all four. The original Python model was run on the same linear-equation PNG and returned the same expression.

Please do not equate this small sample with general accuracy. Before classroom rollout, test handwritten formulas, photographed worksheets, long fractions, matrices, systems, roots, and ambiguous notation on actual student material.

## Real handwritten-mathematics benchmark

This repository now contains a **separate genuine-human handwriting benchmark**, not a synthetic handwriting-font test.

- Methodology, data source, metrics and limitations: [docs/HANDWRITING_BENCHMARK.md](docs/HANDWRITING_BENCHMARK.md)
- Workflow: [Handwritten math OCR benchmark](.github/workflows/handwriting-benchmark.yml) (Actions → Run workflow)
- First run uses six preselected **MathWriting-human test** images with labels, image hashes, and provenance. No sample is selected based on the model's predictions.
- Scores: exact LaTeX expression accuracy, character error rate, inference coverage, median/p95 latency and per-example errors. Test results are provided as GitHub Actions artifacts.
- The workflow acquires test images temporarily and does not commit or publish source images to the repository.

**Do not claim handwriting accuracy without a completed real-image benchmark.** The four previously passed examples were MathJax-typeset, not handwritten. The initial six samples are an engineering smoke benchmark, not a statistically representative accuracy estimate.
