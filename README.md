# js-ai-driven-development-pipeline-template

A comprehensive template for AI-driven JavaScript/TypeScript development with full CI/CD pipeline support.

## Features

- **Multi-runtime support**: Works with Bun, Node.js, and Deno
- **Universal testing**: Uses [test-anywhere](https://github.com/link-foundation/test-anywhere) for cross-runtime tests
- **Automated releases**: Changesets-based versioning with GitHub Actions
- **Code quality**: ESLint + Prettier with pre-commit hooks via Husky
- **Package manager agnostic**: Works with bun, npm, yarn, pnpm, and deno

## Quick Start

### Using This Template

1. Click "Use this template" on GitHub to create a new repository
2. Clone your new repository
3. Update `package.json` with your package name and description
4. Update the `PACKAGE_NAME` constant in these scripts:
   - `scripts/validate-changeset.mjs`
   - `scripts/merge-changesets.mjs`
   - `scripts/publish-to-npm.mjs`
   - `scripts/format-release-notes.mjs`
   - `scripts/create-manual-changeset.mjs`
5. Install dependencies: `bun install`
6. Start developing!

### Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Or with other runtimes:
npm test
deno test --allow-read

# Lint code
bun run lint

# Format code
bun run format

# Check all (lint + format + file size)
bun run check
```

## Project Structure

```
.
├── .changeset/           # Changeset configuration
├── .github/workflows/    # GitHub Actions CI/CD
├── .husky/               # Git hooks (pre-commit)
├── examples/             # Usage examples
├── scripts/              # Build and release scripts
├── src/                  # Source code
│   ├── index.js          # Main entry point
│   └── index.d.ts        # TypeScript definitions
├── tests/                # Test files
├── .eslintrc.js          # ESLint configuration
├── .prettierrc           # Prettier configuration
├── bunfig.toml           # Bun configuration
├── deno.json             # Deno configuration
└── package.json          # Node.js package manifest
```

## Design Choices

### Multi-Runtime Support

This template is designed to work seamlessly with all major JavaScript runtimes:

- **Bun**: Primary runtime with highest performance, uses native test support (`bun test`)
- **Node.js**: Alternative runtime, uses built-in test runner (`node --test`)
- **Deno**: Secure runtime with built-in TypeScript support (`deno test`)

The [test-anywhere](https://github.com/link-foundation/test-anywhere) framework provides a unified testing API that works identically across all runtimes.

### Package Manager Agnostic

While `package.json` is the source of truth for dependencies, the template supports:

- **bun**: Primary choice, uses `bun.lockb`
- **npm**: Uses `package-lock.json`
- **yarn**: Uses `yarn.lock`
- **pnpm**: Uses `pnpm-lock.yaml`
- **deno**: Uses `deno.json` for configuration

Note: `package-lock.json` is not committed by default to allow any package manager.

### Code Quality

- **ESLint**: Configured with recommended rules + Prettier integration
- **Prettier**: Consistent code formatting
- **Husky + lint-staged**: Pre-commit hooks ensure code quality
- **File size limit**: Scripts must stay under 1000 lines for maintainability

### Release Workflow

The release workflow uses [Changesets](https://github.com/changesets/changesets) for version management:

1. **Creating a changeset**: Run `bun run changeset` to document changes
2. **PR validation**: CI checks for valid changeset in each PR
3. **Automated versioning**: Merging to `main` triggers version bump
4. **npm publishing**: Automated via OIDC trusted publishing (no tokens needed)
5. **GitHub releases**: Auto-created with formatted release notes

#### Manual Releases

Two manual release modes are available via GitHub Actions:

- **Instant release**: Immediately bump version and publish
- **Changeset PR**: Create a PR with changeset for review

### CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/release.yml`) provides:

1. **Changeset check**: Validates PR has exactly one changeset (added by that PR)
2. **Lint & format**: Ensures code quality standards
3. **Test matrix**: 3 runtimes × 3 OS = 9 test combinations
4. **Changeset merge**: Combines multiple pending changesets at release time
5. **Release**: Automated versioning and npm publishing

#### Robust Changeset Handling

The CI/CD pipeline is designed to handle concurrent PRs gracefully:

- **PR Validation**: Only validates changesets **added by the current PR**, not pre-existing ones from other merged PRs. This prevents false failures when multiple PRs merge before a release cycle completes.

- **Release-time Merging**: If multiple changesets exist when releasing, they are automatically merged into a single changeset with:
  - The highest version bump type (major > minor > patch)
  - All descriptions preserved in chronological order

This design decouples PR validation from the need to pull changes from the default branch, reducing conflicts and ensuring that even if CI/CD fails, all unpublished changesets will still get published when the error is resolved.

## Configuration

### Updating Package Name

After creating a repository from this template, update the package name in:

1. `package.json`: `"name": "your-package-name"`
2. `.changeset/config.json`: Package references
3. Scripts that reference the package name (see Quick Start)

### ESLint Rules

Customize ESLint in `eslint.config.js`. Current configuration:

- ES Modules support
- Prettier integration
- No console restrictions (common in CLI tools)
- Strict equality enforcement
- Async/await best practices
- **Strict unused variables rule**: No exceptions - all unused variables, arguments, and caught errors must be removed (no `_` prefix exceptions)

### Prettier Options

Configured in `.prettierrc`:

- Single quotes
- Semicolons
- 2-space indentation
- 80-character line width
- ES5 trailing commas
- LF line endings

## Scripts Reference

| Script                 | Description                             |
| ---------------------- | --------------------------------------- |
| `bun test`             | Run tests with Bun                      |
| `bun run lint`         | Check code with ESLint                  |
| `bun run lint:fix`     | Fix ESLint issues automatically         |
| `bun run format`       | Format code with Prettier               |
| `bun run format:check` | Check formatting without changing files |
| `bun run check`        | Run all checks (lint + format)          |
| `bun run changeset`    | Create a new changeset                  |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Create a changeset: `bun run changeset`
5. Commit your changes (pre-commit hooks will run automatically)
6. Push and create a Pull Request

## License

[Unlicense](LICENSE) - Public Domain
