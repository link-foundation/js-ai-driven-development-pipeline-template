---
'@link-foundation/example-package-name': patch
---

Load `command-stream` and `lino-arguments` through a shared use-m interop shim so the release scripts work on Node 24.

Node 22.12+ adds a synthetic `module.exports` named export to CommonJS namespaces whose names cannot be inferred, which stops use-m from unwrapping the callable default. Destructuring `$` off the result therefore yields `undefined` and every release script fails with `TypeError: $ is not a function` on the Node 24 runners the workflows request. `scripts/use-module.mjs` normalises the namespace, reports the HTTP status when `use.js` cannot be fetched, names the observed keys when no callable export is found, and traces the resolved shape under `CI_SCRIPTS_DEBUG=1`.
