---
'@link-foundation/example-package-name': patch
---

Fail the web archive check on lychee errors that have no http(s) URL

`scripts/check-web-archive.mjs` only extracted `http(s)` links from the lychee
report, so errors such as a missing local file or an unresolvable root-relative
link were silently dropped. When those were the only errors the script printed
"No broken URLs found" and set `all_archived=true`, masking a failing lychee
run. The parser now matches the status marker instead of the URL and splits the
results into archivable URLs and links the Wayback Machine cannot answer; the
latter are annotated as errors and force `all_archived=false` with exit code 1.
Adds regression tests over a captured lychee report fixture.
