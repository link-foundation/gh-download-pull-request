# gh-download-pull-request

## 0.2.1

### Patch Changes

- 35d2646: Fix GitHub release formatting to remove incorrect section headers for major/minor/patch versions and properly link related pull requests

## 0.2.0

### Minor Changes

- cb5c989: Apply CI/CD template with GitHub Actions workflows, code quality tools (ESLint, Prettier, Husky), multi-runtime support (Node.js, Bun, Deno), and automated release management using changesets.

  This release includes:
  - Complete CI/CD pipeline with GitHub Actions (testing, linting, automated releases)
  - Multi-runtime testing across Node.js, Bun, and Deno on Ubuntu, macOS, and Windows
  - Code quality tools: ESLint, Prettier, Husky pre-commit hooks, file size validation
  - Changesets-based version management with npm OIDC trusted publishing
  - Fix Windows compatibility by replacing use-m with static imports
  - Fix Bun test discovery by renaming test files to .test.mjs extension
  - Add @octokit/rest, fs-extra, and yargs as regular dependencies

## 0.1.0

### Minor Changes

- Initial release with core functionality to download GitHub pull requests as markdown
