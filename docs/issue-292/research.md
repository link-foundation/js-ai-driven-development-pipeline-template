# Issue 292 research and component decisions

Research checked on 2026-11-09 against upstream sources and recent merged PRs
288, 282 and 276. Each scoped issue was reproducible in the starting code.

- [GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
  specifies cancellation within a group and supports queue: max with false
  cancellation. Use existing job groups and queue support. Workflow-level
  cancellation could interrupt writers; keeping the old conditional wastes main
  runners. No cancellation action or API client is necessary.
- [Husky 9.1.7 installation source](https://github.com/typicode/husky/blob/v9.1.7/index.js)
  returns diagnostic strings for Git/config errors and an empty string on success.
  Use its installed API and inspect both message and configuration. Replacing
  Husky or clearing the user's existing Git configuration is unnecessary.
- [lychee-action 2.9.0 source](https://github.com/lycheeverse/lychee-action/blob/v2.9.0/action.yml)
  downloads once with curl -sfLO. Its
  [entrypoint](https://github.com/lycheeverse/lychee-action/blob/v2.9.0/entrypoint.sh)
  supplies task mode, Markdown, outputs, summary and empty-scan handling that a
  replacement must retain. [Upstream issue 348](https://github.com/lycheeverse/lychee-action/issues/348)
  remains open at inspection, so relying on an upstream release would defer scope.
- [hive-mind PR 4026](https://github.com/link-assistant/hive-mind/pull/4026)
  offers an existing installer, adapted here with explicit download budgets. The
  [pinned release assets](https://github.com/lycheeverse/lychee/releases/tag/lychee-v0.24.2)
  include GNU/Linux archives and adjacent SHA-256 files for x86_64 and aarch64.
  This preserves the version previously selected by the action. The checksum
  guards corruption; it is fetched from the same release service, not an
  independent signature authority.
- [curl retry documentation](https://curl.se/docs/manpage.html#--retry-all-errors)
  supports retrying errors while saving downloads to explicit files. Each asset
  gets at most five retries, 20-second connection and 60-second transfer budgets,
  with a 180-second retry-start budget. Tests use one retry and a loopback server.
  Retrying the entire action/job would repeat link checks and obscure which phase
  failed; downloading a release binary avoids local Rust compilation.

Existing components retained: Husky, curl, tar, sha256sum, GitHub job concurrency,
lychee, yaml and test-anywhere. No dependency or runtime installation was added to
production scripts. Installer tracing stays off unless LYCHEE_INSTALL_DEBUG=1.

Initial native regression run reproduced the Husky false success and conditional
concurrency failures before production edits. Existing assertions rejecting
unknown cancellation expressions, unsafe cancellation of writers, real broken
links and absent report evidence remain covered. A positive Total count is
required even when lychee returns success, so an empty scan cannot turn green.
