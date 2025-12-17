---
'my-package': patch
---

Fix GitHub release formatting to support Major/Minor/Patch changes

The release formatting script now correctly handles all changeset types (Major, Minor, Patch) instead of only Patch changes. This ensures that:

- Section headers are removed from release notes
- PR detection works for all release types
- NPM badges are added correctly
