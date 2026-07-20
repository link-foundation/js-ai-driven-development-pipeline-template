---
'js-ai-driven-development-pipeline-template': patch
---

Build the Dockerfile on pull requests via a new `docker-build` job, so a broken image fails the pull request instead of only surfacing after the package is published. The build uses `push: false` with `load: true` (works for fork pull requests, which have no registry credentials) and the GHA layer cache. Repositories without a Dockerfile skip the job automatically.
