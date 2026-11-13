# Issue 299: requirement inventory and implementation plan

Read scope: parent #299, native sub-issues #294–#298, their complete bodies and
comments, and PR #300 conversation, inline comments and reviews. At initial
inspection all comment/review lists were empty; no additional sub-issues exist.
The five defects are reproducible in the starting revision, 34415b0 plus the
prepared task commit. None is being closed as already fixed.

| Requirement                                                                                 | Root cause and chosen solution                                                                                                                                                                                                                       | Verification                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #294: eliminate the recurring pipx PATH warning, retain pinned ShellCheck and hook coverage | Use Python's venv and the explicit shellcheck-py 0.11.0.1 binary in CI. Local staged checks retain pipx with its documented `--no-path-check`.                                                                                                       | `ci-issue-299.test.js`, `pipeline-requirements.test.js`; real ShellCheck in CI                                                                                                                                   |
| #295: quiet checkout in both JS-first workflows and prevent future omissions                | Set workflow-local `GIT_CONFIG_*` in the caller and reusable workflow; reusable workflows do not inherit caller env. Inventory every workflow using checkout in the regression test.                                                                 | `ci-issue-299.test.js`; existing JS-first integration tests                                                                                                                                                      |
| #296: run syntax checks for example-only edits                                              | Derive `js-changed` from all package paths covered by the syntax inventory, including nested examples and experiments, excluding historical data. Preserve their code/changeset exemptions.                                                          | `detect-code-changes.test.js`: push and PR, single and mixed-language roots, JS/CJS/MJS; existing syntax-check tests                                                                                             |
| #297.2: scan compressed tracked evidence, bound expansion and reject undecodable archives   | Git inventory, pinned secretlint, Node zlib with `maxOutputLength`, validated tar member iteration without extraction; shared 128 MiB expansion budget and nesting bound. Fail closed on unknown tar/PAX representations.                            | `compressed-secrets.test.js`: gzip/JSON gzip/tar.gz/tgz, multiple members, traversal names, GNU/PAX names, nested gzip, corrupt/truncated headers and small bounded expansion probe; real pinned secretlint scan |
| #297.3: prevent SARIF workflow command injection                                            | JSON-quote the complete diagnostic, including path and parse errors; escape modern `::` and legacy `##[` command delimiters. Retain rejection of every finding and warning/error diagnostic.                                                         | `codeql-results.test.js`: messages, rule IDs, severities, notification descriptors and locations; existing acceptance/refusal assertions                                                                         |
| #297.4: avoid PR-only Docker and link-cache writes                                          | Docker retains scoped cache reads but drops exports. Links use restore, with save only for a main push lacking an exact hit. Preserve daily restore keys.                                                                                            | `ci-issue-299.test.js`, `docker-build.test.js`                                                                                                                                                                   |
| #297.8: authenticate lychee independently of mutable release assets                         | Commit x86_64 and aarch64 GNU digest pins next to v0.24.2. Require archive, committed pin and published checksum agreement before extraction.                                                                                                        | `lychee-install.test.js`: real curl/tar loopback tests, including replacement archive plus matching checksum, missing pin, corruption and independent download retries                                           |
| #298.1: classify all three 413 spellings as permanent and print relevant guidance           | Extend nonretryable patterns, capture payload errors and choose size guidance separately from authentication. Preserve transient retries and post-publish verification.                                                                              | `ci-issue-299.test.js`, `publish-failure-classifier.test.js`, `publish-retry.test.js`                                                                                                                            |
| #298.2: gate compressed package size on PR files-list edits and before every publish        | Read npm's real dry-run pack report; enforce the 157 MiB project budget, reject invalid evidence, report ten largest unpacked entries. Run in PR lint and in the shared publisher used by automated and instant releases, after release preparation. | `ci-issue-299.test.js`: boundary, oversize, malformed evidence, npm invocation/package root, workflow wiring; real dry-run of this package                                                                       |
| #298.3: document scalable native packaging                                                  | Explain exact-version optional platform packages, platform metadata and launcher checks in CONTRIBUTING.                                                                                                                                             | Documentation validation and review                                                                                                                                                                              |
| #299: one PR, no deferred issues, complete closing block                                    | Implement all fixes in PR #300; preserve one positive closing keyword per parent/sub-issue.                                                                                                                                                          | PR description, full diff review, same-revision CI                                                                                                                                                               |

Alternatives considered: `pipx --no-path-check` is sufficient locally, while an
explicit CI venv also removes reliance on the runner's pipx version. Running
syntax checks unconditionally would work; aligning the detector preserves useful
skips and records the correct signal. External archive libraries such as
[node-tar](https://github.com/isaacs/node-tar) can support more formats; the chosen
bounded read-only parser reuses the downstream approach and rejects unsupported
formats explicitly, without adding install-time dependencies to the preinstall
secrets gate. Using a lychee action would still require independent asset trust;
committed digests preserve the existing retrying installer. `mode=min` would
reduce Docker cache pressure, but removing PR exports eliminates it for this job.

Existing components and primary sources consulted:

- [Downstream link-cli PR 174](https://github.com/link-foundation/link-cli/pull/174): compressed scanning, SARIF logging and cache policy; inspected the latest scanner source and adapted the pattern with bounded nested scanning and validated tar headers.
- [Downstream hive-mind PR 4051](https://github.com/link-assistant/hive-mind/pull/4051): payload classification, pack reports and platform package layout; inspected its full description and file inventory.
- [pipx CLI](https://pipx.pypa.io/stable/reference/cli.html): `--no-path-check` avoids the already-on-PATH probe.
- [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/): native dry-run and JSON output, avoiding a separate package-size library.
- [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/): optional dependencies and platform selectors.
- [GitHub cache restrictions](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching): PR merge-ref caches are inaccessible to the base branch.
- [Docker cache management](https://docs.docker.com/build/ci/github-actions/cache/): cache exports require cache write access.
- [Workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands) and [runner command parser](https://github.com/actions/runner/blob/main/src/Runner.Common/ActionCommand.cs): V2 commands require a leading delimiter after whitespace; legacy commands search within the line. Escaping both removes ambiguity.
- [Node zlib](https://nodejs.org/api/zlib.html): bounded synchronous inflation via `maxOutputLength`.
- [lychee v0.24.2](https://github.com/lycheeverse/lychee/releases/tag/lychee-v0.24.2): checked the published checksum files against the release asset API digests for both supported architectures.

No new Rust prerequisite is introduced for standalone JavaScript CI; the existing
Rust example and reusable gate retain all parity and readiness assertions.

Local draft evidence: 189 focused tests passed before the last annotation and
boundary cases were added; lint, formatting and duplication passed (7.74%, below
the existing 10% limit). The real compressed-scan experiment demonstrates that raw
secretlint accepts each compressed fixture while the fixed scanner rejects its
synthetic token in gzip, tar.gz and tgz. Run it with:

```sh
npx --yes -p secretlint@13.0.7 -p @secretlint/secretlint-rule-preset-recommend@13.0.7 node experiments/issue-299/verify-compressed-scan.mjs
```

Final revision checks and CI evidence are recorded in PR #300. Full runtime,
platform, CodeQL, Docker and Rust example builds are delegated to existing CI to
respect the local memory budget. No production publish, deployment or merge is
part of this change's validation.

The first candidate, `e48623e`, passed all five code/workflow suites, including
the nine runtime/OS combinations. The link checker alone failed: run
43334537809, log lines 225 and 245, reported HTTP 404 for the existing
`.changeset/README.md` link to `docs/common-questions.md`. The upstream contents
API confirms the replacement is `docs/faq.md`; the final batch updates that link
and retains the strict live-link assertion.
