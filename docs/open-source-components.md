# Reused open-source components

The three city experiences extend the existing `SOWORK-DEV/taichungway` application. They do not create a separate demo repository. The layout is original: restrained white surfaces, editorial spacing, typography and candidate-blue identity. The requested design reference was `https://kochihen2026.tw/policy`; browser and HTTP access encountered its security-verification page, so this is **not** a claimed pixel-exact copy of that site's CSS or assets.

This release integrates real existing GitHub libraries rather than just listing them as possible recommendations:

- `rough-stuff/rough` → `roughjs@4.6.6`: original sketch-style SVG scenes in the comic, with original geometry, deterministic seeds and editable text layered in HTML.
- `Nodlik/StPageFlip` → `page-flip@2.0.7`: optional wish/policy booklet page turn. A static accessible result remains available without animation.
- `goldfire/howler.js` → `howler@2.2.4`: user-activated looping sound beds, volume and fade controls; playback stops on page hiding/unmount.
- `bubkoo/html-to-image` → `html-to-image@1.11.13`: local DOM-to-canvas capture, then a complete 1080×1350 PNG without uploading user text.

Their MIT license texts are in `docs/licenses/`. The source reference revisions used for documentation/license review are recorded in `docs/open-source-components.json`. Exact installed package versions and registry integrity are pinned in `platform/pnpm-lock.yaml`; those registry packages are not claimed to be byte-identical to the referenced repository HEAD snapshots.

No candidate likeness, signature or voice is generated. No third-party comic artwork or reference-site photos are republished. Existing font licenses remain under `platform/assets/fonts/`.

## Honest capability limits

- Comics use prewritten scene templates and original generated geometry, **not a live AI story/image service**. Captions are editable; a user's text is identified as their own input.
- The cheque matcher uses conservative local keyword rules, **not AI semantic classification**. A null result means the local rules did not find a safe match, not that the official 117-policy catalog contains no relevant proposal.
- The postcard's six ten-second loops are original **synthetic demo soundscapes**, not recordings from Taichung. The 29 districts are a selection interface, not a claimed geographic acoustic survey. Field recordings require separately licensed/authorized source material.
- PNG cards do not contain playable sound. The listening link carries only public district IDs and integer volumes. Notes and nicknames remain out of URLs.
- Publication on the requested SoWork domain does not make this an official or authorized campaign website.
