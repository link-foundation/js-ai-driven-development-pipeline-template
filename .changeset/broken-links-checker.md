---
'my-package': minor
---

Add automated broken link checker with Web Archive fallback suggestions

- Add `.github/workflows/links.yml` with lychee-action for link checking in Markdown and HTML files
- Add `scripts/check-web-archive.mjs` to check broken links against the Wayback Machine API
- Add `.lycheeignore` for excluding known false-positive URLs (localhost, example.com, etc.)
- Update `README.md` to document the broken link checker feature
- Scheduled weekly check (Mondays at 09:00 UTC) to catch links that break over time
- On PRs, broken links with no Web Archive fallback will fail the check
- For broken links that have archived versions, provides actionable replacement suggestions
- On scheduled runs, automatically creates a GitHub Issue with the full broken links report

Fixes #27
