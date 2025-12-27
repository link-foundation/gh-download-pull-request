# gh-load-pull-request Requirements

## Goal

Download GitHub pull request data and convert it to a markdown document that mirrors what a user sees on the GitHub pull request page, making it available both as a command-line tool and a library. The output should be fully available offline in a self-contained folder with all referenced assets.

## Core Features

### 1. CLI Tool

The application must be available as a command-line tool that can be invoked with:

```bash
gh-load-pull-request <pr-url> [options]
```

**Required Options:**

- `-o, --output <dir>` - Output directory for PR data (creates `pr-<number>/` subfolder)
- `-t, --token <token>` - GitHub personal access token (optional for public PRs)
- `--format <format>` - Output format: `markdown` (default) or `json`
- `--download-images` - Download embedded images (default: true)
- `--include-reviews` - Include PR reviews (default: true)
- `-v, --verbose` - Enable verbose logging
- `-h, --help` - Show help
- `--version` - Show version number

### 2. Library Interface

The application must be importable as an ES module:

```javascript
import {
  loadPullRequest,
  parsePrUrl,
  convertToMarkdown,
} from 'gh-load-pull-request';

// Fetch PR data
const data = await loadPullRequest({
  owner: 'facebook',
  repo: 'react',
  prNumber: 28000,
  token: 'ghp_xxx', // optional for public PRs
  includeReviews: true,
});

// Convert to markdown
const { markdown, downloadedImages } = await convertToMarkdown(data, {
  downloadImagesFlag: true,
  imagesDir: './pr-28000-images',
});
```

### 3. Output Content Structure

The markdown output must include all data visible on a GitHub PR page, in the following order (matching the GitHub UI):

1. **Title** - PR title as heading
2. **Metadata Block**
   - Author with link
   - State (open/closed/merged)
   - Created/Updated/Merged/Closed dates
   - Base and head branch information
   - Labels (if any)
   - Assignees (if any)
   - Reviewers with approval status
   - Milestone (if any)
   - Linked issues (if any)
   - Stats (+additions/-deletions, changed files count)
3. **Description** - Full PR body/description
4. **Conversation Timeline** - Chronological list of:
   - Comments (issue comments)
   - Reviews with their comments
   - Review comments on specific lines
   - Commit events
   - Label changes
   - Milestone changes
   - Assignment changes
   - Branch events (merge, delete)
   - Cross-references from other PRs/issues
5. **Commits** - List of all commits with SHA, message, author, and link
6. **Files Changed** - List of changed files with status icon and stats

### 4. Offline Folder Structure

When saving to a directory, the output must be fully self-contained:

```
pr-<number>/
  pr-<number>.md          # Main markdown file
  pr-<number>.json        # JSON metadata file
  images/                 # Downloaded images
    image-1.png
    image-2.jpg
    ...
  diffs/                  # File diffs (optional, for full offline view)
    file-1.diff
    file-2.diff
    ...
```

All image URLs in markdown must be rewritten to use relative paths pointing to the `images/` folder.

### 5. Image Handling

- Automatically detect and download images from:
  - PR description
  - Comments
  - Reviews
  - Review comments
- Validate downloaded images using magic bytes
- Skip invalid/corrupted downloads with warning
- Support common formats: PNG, JPG, GIF, WebP, SVG, BMP, ICO

### 6. Authentication

Support multiple authentication methods (in priority order):

1. `--token` command line argument
2. `GITHUB_TOKEN` environment variable
3. GitHub CLI (`gh auth token`) if installed
4. No authentication (public PRs only)

## Quality Assurance

### Testing Requirements

1. **Unit Tests** - Test core functions:
   - URL parsing for all supported formats
   - Markdown conversion
   - Image extraction and validation
   - JSON output format

2. **Integration Tests** - Test with mock GitHub API responses

3. **E2E Tests** - Test against real GitHub PRs:
   - Simple PR with minimal content
   - Complex PR with images, reviews, and many comments
   - PR with code review comments on specific lines
   - Merged PR with full history
   - Cross-platform testing (Linux, macOS, Windows)

### Example PRs for Testing

The following PRs should be used for comprehensive testing:

1. **Simple PR**: `link-foundation/gh-load-pull-request#2` - Minimal content
2. **Complex PR with reviews**: `facebook/react#28000` - Multiple reviewers, comments
3. **Large PR with many files**: Find a suitable example with 10+ changed files
4. **PR with images**: Find an example with embedded screenshots

### CI Pipeline

- Run linting (ESLint)
- Run formatting check (Prettier)
- Run all tests on Ubuntu, macOS, and Windows
- Enforce changeset for version tracking

## Non-Functional Requirements

1. **Performance** - Handle PRs with hundreds of comments efficiently
2. **Error Handling** - Graceful degradation when:
   - Rate limits are hit
   - Images fail to download
   - Authentication fails
3. **Compatibility** - Work with Bun >= 1.2.0 runtime
4. **Output Quality** - Markdown should be:
   - Valid GitHub-flavored markdown
   - Readable without rendering (plain text)
   - Properly formatted with consistent spacing
