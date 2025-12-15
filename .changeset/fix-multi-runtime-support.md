---
'gh-download-pull-request': patch
---

Fix multi-runtime and Windows compatibility issues

- Replace use-m with static imports to fix Windows ESM path handling
- Add @octokit/rest, fs-extra, and yargs as regular dependencies
- Rename test files to match Bun naming convention (.test.mjs)
- Update package.json test script to use renamed files
- Update README with dependency installation instructions

This resolves CI failures on Windows (Node), Bun, and Deno runtimes by addressing:

1. Windows path handling: ESM imports now work correctly with file:// URLs
2. Bun test discovery: Test files now use .test.mjs extension
3. Deno test discovery: deno.json already configured for tests/ directory
