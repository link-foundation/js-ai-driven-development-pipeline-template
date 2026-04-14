---
'my-package': patch
---

fix: npm upgrade fallbacks and Node.js 24.x upgrade for CI/CD

- Upgrade Node.js from 20.x to 24.x in all workflow files (avoids broken npm in Node.js 22.22.2)
- Add 4-strategy fallback chain to setup-npm.mjs (standard, curl tarball, npx, corepack)
- Update GitHub Actions to latest versions (checkout v6, setup-node v6, create-pull-request v8)
- Add case study documentation for issue #33
