---
'@link-foundation/example-package-name': minor
---

Add a release-time `preview-regen` job to `example-app.yml` and a
`scripts/update-preview-images.mjs` driver that boot the universal example app
in a headless Chromium via `browser-commander` + Playwright, capture a
locale × theme matrix of screenshots into `docs/screenshots/example-app/`, and
commit any drift back to `main` with `[skip ci]`. Adds the matching
`npm run example:web:preview-images` script.
