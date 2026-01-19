---
'my-package': minor
---

Add fresh merge simulation to CI/CD to prevent stale merge preview issues

- Add "Simulate fresh merge with base branch" step to lint and test jobs
- This ensures PR CI validates the actual merge result, not a stale snapshot
- Prevents CI failures on main branch after merging PRs that sat open for days
- Add case study documentation for issue #23 with root cause analysis
- Add ignore patterns for case study data files in ESLint and Prettier

See docs/case-studies/issue-23 for detailed analysis of the stale merge preview problem.

Fixes #23
