---
'@link-foundation/example-package-name': patch
---

Recognise npm's E409 "Cannot publish over previously staged version" wording as an already-published conflict in `publish-retry`, so a release that reached the registry verifies instead of failing the job.
