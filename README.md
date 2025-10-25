# gh-download-pull-request

[![npm version](https://img.shields.io/npm/v/gh-download-pull-request)](https://www.npmjs.com/package/gh-download-pull-request)

Download GitHub pull request and convert it to markdown - perfect for AI review and analysis.

## Features

- Download any GitHub pull request as markdown
- Includes PR metadata, commits, files, reviews, and comments
- Support for both public and private repositories
- Multiple input formats for convenience
- GitHub CLI integration for seamless authentication
- Output to file or stdout

## Quick Start

```bash
# Download a PR and display as markdown
gh-download-pull-request https://github.com/owner/repo/pull/123

# Using shorthand format
gh-download-pull-request owner/repo#123

# Save to file
gh-download-pull-request owner/repo#123 -o pr.md

# Download private PR (uses gh CLI auth automatically)
gh-download-pull-request owner/private-repo#456
```

## Installation

### Global Installation (Recommended)

Install globally for system-wide access:

```bash
# Using bun
bun install -g gh-download-pull-request

# Using npm
npm install -g gh-download-pull-request

# After installation, use anywhere:
gh-download-pull-request --help
```

### Uninstall

Remove the global installation:

```bash
# Using bun
bun uninstall -g gh-download-pull-request

# Using npm
npm uninstall -g gh-download-pull-request
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/link-foundation/gh-download-pull-request.git
cd gh-download-pull-request

# Make the script executable
chmod +x gh-download-pull-request.mjs

# Run it
./gh-download-pull-request.mjs --help
```

## Usage

```
Usage: gh-download-pull-request <pr-url> [options]

Options:
  -t, --token    GitHub personal access token (optional for public PRs)
  -o, --output   Output file path (default: stdout)
  -h, --help     Show help
  --version      Show version number
```

## Input Formats

The tool supports multiple formats for specifying a pull request:

1. **Full URL**: `https://github.com/owner/repo/pull/123`
2. **Shorthand with #**: `owner/repo#123`
3. **Shorthand with /**: `owner/repo/123`

## Authentication

The tool supports multiple authentication methods for accessing private repositories:

### 1. GitHub CLI (Recommended)

If you have [GitHub CLI](https://cli.github.com/) installed and authenticated, the tool will automatically use your credentials:

```bash
# Authenticate with GitHub CLI (one-time setup)
gh auth login

# Tool automatically detects and uses gh CLI authentication
gh-download-pull-request owner/private-repo#123
```

### 2. Environment Variable

Set the `GITHUB_TOKEN` environment variable:

```bash
export GITHUB_TOKEN=ghp_your_token_here
gh-download-pull-request owner/repo#123
```

### 3. Command Line Token

Pass the token directly with `--token`:

```bash
gh-download-pull-request owner/repo#123 --token ghp_your_token_here
```

### Authentication Priority

The tool uses this fallback chain:
1. `--token` command line argument (highest priority)
2. `GITHUB_TOKEN` environment variable
3. GitHub CLI authentication (if `gh` is installed and authenticated)
4. No authentication (public PRs only)

## Output Format

The markdown output includes:

- **Header**: PR title
- **Metadata**: PR number, author, status, dates, branch info, stats
- **Description**: Full PR description/body
- **Commits**: List of all commits with links and authors
- **Files Changed**: All modified files with change stats
- **Reviews**: All PR reviews with approval status
- **Review Comments**: Inline code review comments with diff context
- **Comments**: General discussion comments

## Examples

```bash
# Basic usage - download and display PR
gh-download-pull-request https://github.com/facebook/react/pull/28000

# Using shorthand format
gh-download-pull-request facebook/react#28000

# Save to file
gh-download-pull-request facebook/react#28000 -o react-pr-28000.md

# Download private PR using gh CLI auth
gh-download-pull-request myorg/private-repo#42

# Download with explicit token
gh-download-pull-request myorg/repo#123 --token ghp_your_token_here

# Pipe to other tools (e.g., AI for review)
gh-download-pull-request owner/repo#123 | claude-analyze
```

## Requirements

- [Bun](https://bun.sh/) (>=1.2.0) or [Node.js](https://nodejs.org/) (>=22.17.0) runtime
- For private repositories (optional):
  - [GitHub CLI](https://cli.github.com/) (recommended) OR
  - GitHub personal access token (via `--token` or `GITHUB_TOKEN` env var)

## Use Cases

- **AI Code Review**: Download PRs as markdown for analysis by AI assistants
- **Documentation**: Archive important PRs for future reference
- **Offline Review**: Review PRs without internet connection
- **Custom Analysis**: Process PR data with custom scripts
- **Team Workflows**: Integrate PR data into custom review processes

## Testing

```bash
# Run all tests
./tests/test-all.mjs

# Run specific test
./tests/test-cli.mjs
```

## Development

```bash
# Clone the repository
git clone https://github.com/link-foundation/gh-download-pull-request.git
cd gh-download-pull-request

# Make executable
chmod +x gh-download-pull-request.mjs

# Test locally
./gh-download-pull-request.mjs owner/repo#123

# Bump version
./version.mjs patch  # or minor, major
```

## Related Projects

- [gh-pull-all](https://github.com/link-foundation/gh-pull-all) - Efficiently sync all repositories from a GitHub organization or user

## License

This project is released into the public domain under The Unlicense - see [LICENSE](LICENSE) file for details.
