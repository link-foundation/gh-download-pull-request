#!/usr/bin/env sh
':'; // # ; exec "$(command -v bun || command -v node)" "$0" "$@"

// Import built-in Node.js modules
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import npm dependencies
import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Get version from package.json or fallback
let version = '0.1.0'; // Fallback version

try {
  const packagePath = path.join(__dirname, 'package.json');
  if (await fs.pathExists(packagePath)) {
    const packageJson = await fs.readJson(packagePath);
    version = packageJson.version;
  }
} catch (_error) {
  // Use fallback version if package.json can't be read
}

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const log = (color, message) =>
  console.log(`${colors[color]}${message}${colors.reset}`);

// Helper function to check if gh CLI is installed
async function isGhInstalled() {
  try {
    const { execSync } = await import('child_process');
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch (_error) {
    return false;
  }
}

// Helper function to get GitHub token from gh CLI if available
async function getGhToken() {
  try {
    if (!(await isGhInstalled())) {
      return null;
    }

    const { execSync } = await import('child_process');
    const token = execSync('gh auth token', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    return token;
  } catch (_error) {
    return null;
  }
}

// Parse PR URL to extract owner, repo, and PR number
function parsePrUrl(url) {
  // Support multiple formats:
  // https://github.com/owner/repo/pull/123
  // owner/repo#123
  // owner/repo/123

  // Try full URL format
  const urlMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      prNumber: parseInt(urlMatch[3], 10),
    };
  }

  // Try shorthand format: owner/repo#123
  const shortMatch = url.match(/^([^/]+)\/([^#/]+)#(\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      prNumber: parseInt(shortMatch[3], 10),
    };
  }

  // Try alternative format: owner/repo/123
  const altMatch = url.match(/^([^/]+)\/([^/]+)\/(\d+)$/);
  if (altMatch) {
    return {
      owner: altMatch[1],
      repo: altMatch[2],
      prNumber: parseInt(altMatch[3], 10),
    };
  }

  return null;
}

// Fetch pull request data from GitHub API
async function fetchPullRequest(owner, repo, prNumber, token) {
  try {
    log('blue', `🔍 Fetching pull request ${owner}/${repo}#${prNumber}...`);

    const octokit = new Octokit({
      auth: token,
      baseUrl: 'https://api.github.com',
    });

    // Fetch PR data
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Fetch PR files
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Fetch PR comments
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Fetch PR review comments
    const { data: reviewComments } =
      await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
      });

    // Fetch PR reviews
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Fetch PR commits
    const { data: commits } = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
    });

    log('green', `✅ Successfully fetched PR data`);

    return {
      pr,
      files,
      comments,
      reviewComments,
      reviews,
      commits,
    };
  } catch (error) {
    if (error.status === 404) {
      log('red', `❌ Pull request not found: ${owner}/${repo}#${prNumber}`);
    } else if (error.status === 401) {
      log(
        'red',
        `❌ Authentication failed. Please provide a valid GitHub token`
      );
    } else {
      log('red', `❌ Failed to fetch pull request: ${error.message}`);
    }
    process.exit(1);
  }
}

// Convert PR data to markdown
function convertToMarkdown(data) {
  const { pr, files, comments, reviewComments, reviews, commits } = data;

  let markdown = '';

  // Header
  markdown += `# ${pr.title}\n\n`;

  // Metadata
  markdown += `**Pull Request:** [#${pr.number}](${pr.html_url})\n`;
  markdown += `**Author:** [@${pr.user.login}](${pr.user.html_url})\n`;
  markdown += `**Status:** ${pr.state}\n`;
  markdown += `**Created:** ${new Date(pr.created_at).toLocaleString()}\n`;
  markdown += `**Updated:** ${new Date(pr.updated_at).toLocaleString()}\n`;
  if (pr.merged_at) {
    markdown += `**Merged:** ${new Date(pr.merged_at).toLocaleString()}\n`;
  }
  if (pr.closed_at) {
    markdown += `**Closed:** ${new Date(pr.closed_at).toLocaleString()}\n`;
  }
  markdown += `**Base:** \`${pr.base.ref}\`\n`;
  markdown += `**Head:** \`${pr.head.ref}\`\n`;
  markdown += `**Additions:** +${pr.additions}\n`;
  markdown += `**Deletions:** -${pr.deletions}\n`;
  markdown += `**Changed Files:** ${pr.changed_files}\n`;

  // Labels
  if (pr.labels && pr.labels.length > 0) {
    markdown += `**Labels:** ${pr.labels.map((l) => `\`${l.name}\``).join(', ')}\n`;
  }

  // Assignees
  if (pr.assignees && pr.assignees.length > 0) {
    markdown += `**Assignees:** ${pr.assignees.map((a) => `@${a.login}`).join(', ')}\n`;
  }

  // Reviewers
  if (pr.requested_reviewers && pr.requested_reviewers.length > 0) {
    markdown += `**Requested Reviewers:** ${pr.requested_reviewers.map((r) => `@${r.login}`).join(', ')}\n`;
  }

  markdown += '\n---\n\n';

  // Description
  if (pr.body) {
    markdown += `## Description\n\n${pr.body}\n\n`;
  }

  // Commits
  if (commits.length > 0) {
    markdown += `## Commits (${commits.length})\n\n`;
    for (const commit of commits) {
      const message = commit.commit.message.split('\n')[0]; // First line only
      const sha = commit.sha.substring(0, 7);
      markdown += `- [\`${sha}\`](${commit.html_url}) ${message} - @${commit.author?.login || 'unknown'}\n`;
    }
    markdown += '\n';
  }

  // Files changed
  if (files.length > 0) {
    markdown += `## Files Changed (${files.length})\n\n`;
    for (const file of files) {
      const statusIcon =
        file.status === 'added'
          ? '🆕'
          : file.status === 'removed'
            ? '🗑️'
            : file.status === 'modified'
              ? '✏️'
              : file.status === 'renamed'
                ? '📝'
                : '📄';
      markdown += `${statusIcon} **${file.filename}** (+${file.additions} -${file.deletions})\n`;
      if (file.status === 'renamed') {
        markdown += `  - Renamed from: \`${file.previous_filename}\`\n`;
      }
    }
    markdown += '\n';
  }

  // Reviews
  if (reviews.length > 0) {
    markdown += `## Reviews (${reviews.length})\n\n`;
    for (const review of reviews) {
      const stateIcon =
        review.state === 'APPROVED'
          ? '✅'
          : review.state === 'CHANGES_REQUESTED'
            ? '❌'
            : review.state === 'COMMENTED'
              ? '💬'
              : '❓';
      markdown += `${stateIcon} **@${review.user.login}** - ${review.state}\n`;
      markdown += `*${new Date(review.submitted_at).toLocaleString()}*\n\n`;
      if (review.body) {
        markdown += `${review.body}\n\n`;
      }
    }
  }

  // Review comments (inline code comments)
  if (reviewComments.length > 0) {
    markdown += `## Review Comments (${reviewComments.length})\n\n`;
    for (const comment of reviewComments) {
      markdown += `**@${comment.user.login}** commented on \`${comment.path}\``;
      if (comment.line) {
        markdown += ` (line ${comment.line})`;
      }
      markdown += `:\n`;
      markdown += `*${new Date(comment.created_at).toLocaleString()}*\n\n`;
      markdown += `${comment.body}\n\n`;
      if (comment.diff_hunk) {
        markdown += '```diff\n';
        markdown += `${comment.diff_hunk}\n`;
        markdown += '```\n\n';
      }
    }
  }

  // General comments
  if (comments.length > 0) {
    markdown += `## Comments (${comments.length})\n\n`;
    for (const comment of comments) {
      markdown += `**@${comment.user.login}** commented:\n`;
      markdown += `*${new Date(comment.created_at).toLocaleString()}*\n\n`;
      markdown += `${comment.body}\n\n`;
      markdown += '---\n\n';
    }
  }

  return markdown;
}

// Configure CLI arguments
const scriptName = path.basename(process.argv[1]);
const argv = yargs(hideBin(process.argv))
  .scriptName(scriptName)
  .version(version)
  .usage('Usage: $0 <pr-url> [options]')
  .command(
    '$0 <pr>',
    'Download a GitHub pull request and convert it to markdown',
    (yargs) => {
      yargs.positional('pr', {
        describe:
          'Pull request URL or shorthand (e.g., https://github.com/owner/repo/pull/123 or owner/repo#123)',
        type: 'string',
      });
    }
  )
  .option('token', {
    alias: 't',
    type: 'string',
    describe: 'GitHub personal access token (optional for public PRs)',
    default: process.env.GITHUB_TOKEN,
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    describe: 'Output file path (default: stdout)',
  })
  .help('h')
  .alias('h', 'help')
  .example('$0 https://github.com/owner/repo/pull/123', 'Download PR #123')
  .example('$0 owner/repo#123', 'Download PR using shorthand format')
  .example('$0 owner/repo#123 -o pr.md', 'Save to file')
  .example(
    '$0 https://github.com/owner/repo/pull/123 --token ghp_xxx',
    'Download private PR'
  ).argv;

async function main() {
  const { pr: prInput, token: tokenArg, output } = argv;
  let token = tokenArg;

  // If no token provided, try to get it from gh CLI
  if (!token || token === undefined) {
    const ghToken = await getGhToken();
    if (ghToken) {
      token = ghToken;
      log('cyan', '🔑 Using GitHub token from gh CLI');
    }
  }

  // Parse PR input
  const prInfo = parsePrUrl(prInput);
  if (!prInfo) {
    log('red', `❌ Invalid PR URL or format: ${prInput}`);
    log('yellow', '💡 Supported formats:');
    log('yellow', '   - https://github.com/owner/repo/pull/123');
    log('yellow', '   - owner/repo#123');
    log('yellow', '   - owner/repo/123');
    process.exit(1);
  }

  const { owner, repo, prNumber } = prInfo;

  // Fetch PR data
  const data = await fetchPullRequest(owner, repo, prNumber, token);

  // Convert to markdown
  log('blue', '📝 Converting to markdown...');
  const markdown = convertToMarkdown(data);

  // Output
  if (output) {
    await fs.writeFile(output, markdown, 'utf8');
    log('green', `✅ Saved to ${output}`);
  } else {
    console.log(`\n${markdown}`);
  }

  log('blue', '🎉 Done!');
}

main().catch((error) => {
  log('red', `💥 Script failed: ${error.message}`);
  process.exit(1);
});
