# Issue 230 requirements and verification

Scope: [issue 230](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/230)
and [PR 231 feedback](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/pull/231#issuecomment-6588286507).
The issue has no comments or required sub-issues; all PR conversation comments,
inline comments and reviews were read. Router issue 759 is background context,
not an additional implementation request for this repository.

The original proposal is already implemented by merged PR 255. Preserve that
implementation and all its acceptance assertions while merging current main.
The later feedback requires using this gate only when the Rust CI/CD template
is applied at the same time. Standalone JavaScript CI must remain independent.

## Plan

1. Resolve the four conflicts using current main's complete implementation.
2. Reproduce the missing Rust integration condition with a focused regression.
3. Require an explicit boolean Rust template integration input, skip the gate
   when false, and configure the existing mixed-language caller in the same batch.
4. Document simultaneous template application and every Rust path's dependency.
5. Run focused native JavaScript tests, lint/format/duplication and repository
   guards for the committed candidate. Review the whole PR diff, then push once.
6. Collect every same-revision CI outcome and preserve failure logs before any
   correction batch. Update the PR description and mark ready after passing CI.

## Acceptance evidence map

| Requirement                                                                  | Implementation and verification                                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only with the Rust CI/CD template                                            | `rust-template-applied` caller contract; `tests/javascript-first-adoption.test.js`; contributor/example instructions                                |
| Real native JS, strict inventory, pinned deterministic translation           | Existing `examples/javascript-first` commands, pins and typed IR; `tests/javascript-first-gate.test.js`                                             |
| Failed/skipped JS or parity prevents every Rust path                         | Existing shell-step fixture covers six job conditions, missing/partial/carried entries and missing features; boolean opt-out skips the prerequisite |
| Drift and revision changes fail                                              | Existing regeneration, staged/unstaged/untracked and HEAD checks, exercised by the gate regression                                                  |
| Complete unchanged inventory allows exact tested SHA                         | Existing positive fixture and all six hosted Rust example jobs                                                                                      |
| Active writer survives superseded read-only checks                           | Shared job-level writer group, cancellation disabled, full queue; parsed YAML regression plus existing pipeline/writer tests                        |
| Bulk drafting, one pushing coordinator, exact candidate, collect CI failures | Root `AGENTS.md` and `docs/javascript-first.md`; this session has one coordinator and one push per validated batch                                  |
| Bounded resources, assertions and native adapters recorded                   | No Rust compilation locally; existing example refuses native adapters/unsupported source; no acceptance assertions removed                          |

No application port or translator expansion is needed. The mixed-language example
supports one complete integer-parity API; no missing/partial/carried behavior or
new native adapters are introduced. Existing production Rust integration remains
the adopting repository's responsibility, as specified by the original issue.

## Regression and integration record

- Merged `origin/main` at `a495fc1`, preserving the implemented gate, trust/cache
  protections, example and all prior documentation. The four conflicted files
  now retain main's complete implementations.
- Before the fix, the new adoption regression failed with
  `Expected undefined to be "boolean"`; the gate had no Rust integration input.
  Standalone JavaScript independence and writer isolation already passed.
- The new required boolean input skips the prerequisite when false. The reference
  caller opts in while retaining successful-gate dependencies and exact tested-SHA
  checkouts on all six Rust paths. It is an explicit caller declaration, not an
  automatic installer or proof of an external repository's template provenance.
- Existing missing/partial/carried inventory, skipped/failed native checks, drift,
  untracked files and revision-change assertions remain. Additional adapter and
  staged-drift fixtures prevent all downstream paths as well.
- A major changeset records the required-input caller migration. No package or
  application behavior changes, production publication or deployment are made.

Local logs are retained under `.git/issue-230-logs/`; hosted results and exact
candidate revision will be recorded in the PR description after CI completes.
