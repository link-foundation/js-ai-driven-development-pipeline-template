# Best Practices for AI-Driven Development

This document describes CI/CD best practices that significantly improve the quality and reliability of AI-driven development workflows. When properly configured, AI solvers are forced to iterate with CI/CD checks until all tests pass, ensuring code quality meets the highest standards.

## Why CI/CD Matters for AI Development

AI-driven development creates a powerful feedback loop:

1. **AI creates a solution** - The solver generates code based on issue requirements
2. **CI/CD validates the solution** - Automated checks verify code quality
3. **AI iterates until passing** - The solver fixes issues until all checks pass
4. **Quality is guaranteed** - No code merges without passing all gates

This approach ensures consistent quality regardless of whether the team consists of humans, AIs, or both.

## This Template's Best Practices

This template implements the following best practices from the [hive-mind](https://github.com/link-assistant/hive-mind) project:

### 1. File Size Limits

**Maximum of 1000 lines per code file** (enforced via ESLint `max-lines` rule).

This constraint benefits both AI and human developers:

- AI models can read and understand entire files within context windows
- Humans can navigate and comprehend files without cognitive overload
- Forces modular, well-organized code architecture

### 2. Automated Code Formatting

Consistent formatting eliminates style debates and reduces diff noise:

| Tool     | Purpose                      |
| -------- | ---------------------------- |
| ESLint   | Code quality and style rules |
| Prettier | Code formatting              |
| Husky    | Pre-commit hooks             |

### 3. Static Analysis & Linting

Catch bugs and enforce patterns before code reaches review:

- ESLint with strict rules
- Strict unused variables rule (no `_` prefix exceptions)
- Async/await best practices enforcement

### 4. Comprehensive Testing

Tests run across multiple dimensions:

- **Cross-runtime**: Node.js, Bun, and Deno
- **Cross-platform**: Ubuntu, macOS, and Windows
- **Test framework**: [test-anywhere](https://github.com/link-foundation/test-anywhere) for universal compatibility

### 5. Changeset-Based Versioning

The changeset system:

- **Eliminates merge conflicts** - Each PR creates an independent changeset file
- **Automates version bumps** - Highest bump type wins when merging
- **Generates changelogs** - Release notes are compiled automatically
- **Supports semantic versioning** - patch/minor/major bumps are explicit

### 6. Pre-commit Hooks

Local quality gates prevent broken commits from reaching CI:

1. Format check and auto-fix
2. Lint and static analysis
3. File size validation

### 7. Release Automation

Automated release workflows ensure:

- **No manual version management** - Versions update automatically
- **OIDC trusted publishing** - No API tokens needed in CI
- **Validated releases only** - All checks must pass before publishing
- **Dual trigger modes** - Both automatic (on merge) and manual (workflow dispatch)

### 8. CI/CD Pipeline Features

The workflow implements several critical features from hive-mind issues #1274 and #1278:

#### Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref == 'refs/heads/main' }}
```

This ensures:

- **Main branch**: Newer runs cancel older runs, preventing blocking
- **PR branches**: Runs are queued to preserve check history

#### Fresh Merge Simulation

Before running checks on PRs, the workflow:

1. Fetches the latest base branch
2. Attempts to merge it into the PR branch
3. Runs checks against the merged state

This prevents "stale merge preview" issues where checks pass on outdated code.

## Quality Enforcement Strategy

The template implements a defense-in-depth approach:

```
Developer Machine    ->    CI/CD Pipeline    ->    Release
├── Pre-commit hooks      ├── Format check        ├── All checks pass
├── Local tests           ├── Lint/analyze        ├── Version bump
└── IDE integration       ├── Full test suite     ├── Changelog update
                          ├── Build validation    └── Publish package
                          └── Changeset verify
```

Each layer catches different issues, ensuring no problematic code reaches production.

## References

- [Code Architecture Principles](https://github.com/link-foundation/code-architecture-principles)
- [hive-mind CI/CD Case Studies](https://github.com/link-assistant/hive-mind/tree/main/docs/case-studies)
- [Issue #1274 Analysis](./case-studies/issue-25/data/issue-1274-case-study.md) - Concurrency blocking
- [Issue #1278 Analysis](./case-studies/issue-25/data/issue-1278-case-study.md) - always() cancellation prevention
