# Issue 292 verification

Local validation uses native JavaScript and small loopback/process fixtures; no
Rust or application packaging build was run locally.

- Pre-fix focused run reproduced stale-path Husky success and the conditional
  cancellation policy mismatch.
- Candidate 36e2d1839de37560d99821192dfe3617c940ac85: 121 focused Node checks
  passed, with no skips or failures. Lint, format, duplication, changeset guard,
  pinned ShellCheck, tracked JavaScript syntax, workflow policy and all five
  status-gate inventories passed. The working tree was clean before its push.
- [Live link run](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/actions/runs/42639733399)
  installed the real lychee 0.24.2 release with the published checksum, scanned
  158 links and reported zero errors. Workflows and Security passed on the same
  SHA, including actionlint, ShellCheck, regular/pedantic zizmor, artifact
  roundtrip, both CodeQL languages, dependency review and all npm audits.

## First-batch CI investigation

Runs started 2026-11-09 14:57:21 UTC, after the candidate commit, with matching
head SHA 36e2d1839de37560d99821192dfe3617c940ac85. The runtime suite revealed
an additional old action-specific parser in tests/issue-228-regressions.test.js,
line 48. Its with.args regex returned null because the new workflow uses a run
step. Preserve every acceptance assertion and read the actual step instead.

Raw job logs are preserved locally under ci-logs/ (ignored .log files). Specific
errors before the follow-up:

| Log                     | Evidence                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| checks-129237672924.log | Ubuntu Node lines 2046–2050: TypeError, Cannot read properties of null (reading '1'), old parser line 48. |
| checks-129237672853.log | Ubuntu Bun lines 1750–1759: old args regex and TypeError: null is not an object.                          |
| checks-129237672938.log | Ubuntu Deno lines 2094–2104: same TypeError; 1197 passed, 1 failed, 2 ignored.                            |
| checks-129237672875.log | Windows Node lines 2040 onward: same input-selection assertion/parser.                                    |
| checks-129237672539.log | Windows Bun lines 808–817: same regex and null TypeError.                                                 |
| checks-129237673079.log | Windows Deno lines 2096–2106: same TypeError; 1098 passed, 1 failed, 101 ignored.                         |
| checks-129237673122.log | macOS Node lines 2030 onward: same parser failure.                                                        |
| checks-129237672999.log | macOS Deno lines 2077–2087: same TypeError; 1191 passed, 1 failed, 8 ignored.                             |
| checks-129237673150.log | macOS Bun lines 1690–1700: same regex and null TypeError.                                                 |
| checks-129241421623.log | Pipeline Status lines 259–262: Failed jobs: test; no cancelled jobs; correctly failed the run.            |

All nine runtime legs and the terminal gate completed before the next batch.
The complete run log is preserved as ci-logs/checks-42639733336.log. There were
no additional runtime failures. The other three same-revision workflows passed.

Focused follow-up: all 26 cases in issue-228-regressions, lychee-step and
lychee-install pass under Node and Bun. The existing hidden-file, extension,
no-glob, repository-root and exclusion assertions are preserved. The installer
also gains executable mode to match its documented command-line usage.
