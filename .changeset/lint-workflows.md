---
'@link-foundation/example-package-name': patch
---

Lint the workflows themselves: a new `workflows` check runs `actionlint` (from the Docker image that bundles shellcheck) and `zizmor`, and the findings they reported are fixed — the manifest digest list is built as an array, the packaging retry logs its attempt number, the npm wait passes the release version through the environment, and third-party actions are pinned to commit hashes.
