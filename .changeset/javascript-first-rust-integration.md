---
'@link-foundation/example-package-name': major
---

Require the reusable JavaScript-first gate's boolean `rust-template-applied`
input. Apply or update the Rust CI/CD template and all gate dependencies together,
then pass `true`; `false` skips the prerequisite and downstream Rust jobs.
Standalone JavaScript CI remains independent. Existing gate callers must add the
new input when updating to this version.
