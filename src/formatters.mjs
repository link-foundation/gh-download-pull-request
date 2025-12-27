/**
 * Formatters for gh-load-pull-request
 * Contains functions for converting PR data to markdown and JSON formats
 */

/**
 * Format a date string for display
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr) {
  if (!dateStr) {
    return '';
  }
  const date = new Date(dateStr);
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

/**
 * Convert PR data to JSON format
 * @param {Object} data - PR data from loadPullRequest
 * @param {Array} downloadedImages - Array of downloaded image info
 * @returns {string} JSON string
 */
export function convertToJson(data, downloadedImages = []) {
  const { pr, files, comments, reviewComments, reviews, commits } = data;

  return JSON.stringify(
    {
      pullRequest: {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        merged: pr.merged,
        url: pr.html_url,
        author: {
          login: pr.user.login,
          url: `https://github.com/${pr.user.login}`,
        },
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        mergedBy: pr.merged_by
          ? {
              login: pr.merged_by.login,
              url: `https://github.com/${pr.merged_by.login}`,
            }
          : null,
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha,
        },
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha,
        },
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        labels: pr.labels?.map((l) => ({ name: l.name, color: l.color })) || [],
        assignees:
          pr.assignees?.map((a) => ({
            login: a.login,
            url: `https://github.com/${a.login}`,
          })) || [],
        requestedReviewers:
          pr.requested_reviewers?.map((r) => ({
            login: r.login,
            url: `https://github.com/${r.login}`,
          })) || [],
        milestone: pr.milestone
          ? { title: pr.milestone.title, number: pr.milestone.number }
          : null,
        body: pr.body,
      },
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.author?.login || c.commit.author?.name || 'unknown',
        url: c.html_url,
        date: c.commit.author?.date,
      })),
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        previousFilename: f.previous_filename,
        patch: f.patch,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        author: r.user.login,
        state: r.state,
        body: r.body,
        submittedAt: r.submitted_at,
      })),
      reviewComments: reviewComments.map((c) => ({
        id: c.id,
        author: c.user.login,
        body: c.body,
        path: c.path,
        line: c.line,
        createdAt: c.created_at,
        diffHunk: c.diff_hunk,
        reviewId: c.pull_request_review_id,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        author: c.user.login,
        body: c.body,
        createdAt: c.created_at,
      })),
      downloadedImages: downloadedImages.map((img) => ({
        originalUrl: img.originalUrl,
        localPath: img.relativePath,
        format: img.format,
      })),
    },
    null,
    2
  );
}

/**
 * Generate markdown for metadata section
 * @param {Object} pr - Pull request data
 * @returns {string} Markdown content
 */
export function generateMetadataMarkdown(pr) {
  let markdown = `## Metadata\n\n`;

  markdown += `| Field | Value |\n`;
  markdown += `|-------|-------|\n`;
  markdown += `| **Number** | #${pr.number} |\n`;
  markdown += `| **URL** | ${pr.html_url} |\n`;
  markdown += `| **Author** | [@${pr.user.login}](https://github.com/${pr.user.login}) |\n`;
  markdown += `| **State** | ${pr.state}${pr.merged ? ' (merged)' : pr.draft ? ' (draft)' : ''} |\n`;
  markdown += `| **Created** | ${formatDate(pr.created_at)} |\n`;
  markdown += `| **Updated** | ${formatDate(pr.updated_at)} |\n`;

  if (pr.merged_at) {
    markdown += `| **Merged** | ${formatDate(pr.merged_at)} |\n`;
    if (pr.merged_by) {
      markdown += `| **Merged by** | [@${pr.merged_by.login}](https://github.com/${pr.merged_by.login}) |\n`;
    }
  }
  if (pr.closed_at && !pr.merged_at) {
    markdown += `| **Closed** | ${formatDate(pr.closed_at)} |\n`;
  }

  markdown += `| **Base** | \`${pr.base.ref}\` |\n`;
  markdown += `| **Head** | \`${pr.head.ref}\` |\n`;
  markdown += `| **Additions** | +${pr.additions} |\n`;
  markdown += `| **Deletions** | -${pr.deletions} |\n`;
  markdown += `| **Changed Files** | ${pr.changed_files} |\n`;
  markdown += '\n';

  if (pr.labels && pr.labels.length > 0) {
    markdown += `**Labels:** ${pr.labels.map((l) => `\`${l.name}\``).join(', ')}\n\n`;
  }

  if (pr.assignees && pr.assignees.length > 0) {
    markdown += `**Assignees:** ${pr.assignees.map((a) => `[@${a.login}](https://github.com/${a.login})`).join(', ')}\n\n`;
  }

  if (pr.requested_reviewers && pr.requested_reviewers.length > 0) {
    markdown += `**Requested Reviewers:** ${pr.requested_reviewers.map((r) => `[@${r.login}](https://github.com/${r.login})`).join(', ')}\n\n`;
  }

  if (pr.milestone) {
    markdown += `**Milestone:** ${pr.milestone.title}\n\n`;
  }

  return markdown;
}

/**
 * Generate markdown for commits section
 * @param {Array} commits - Array of commit data
 * @returns {string} Markdown content
 */
export function generateCommitsMarkdown(commits) {
  if (commits.length === 0) {
    return '';
  }

  let markdown = `## Commits (${commits.length})\n\n`;

  for (const commit of commits) {
    const message = commit.commit.message.split('\n')[0];
    const sha = commit.sha.substring(0, 7);
    const author =
      commit.author?.login || commit.commit.author?.name || 'unknown';
    const authorLink = commit.author
      ? `[@${author}](https://github.com/${author})`
      : author;
    markdown += `- [\`${sha}\`](${commit.html_url}) ${message} — ${authorLink}\n`;
  }

  markdown += '\n';
  return markdown;
}

/**
 * Generate markdown for files changed section
 * @param {Array} files - Array of file data
 * @returns {string} Markdown content
 */
export function generateFilesMarkdown(files) {
  if (files.length === 0) {
    return '';
  }

  let markdown = `## Files Changed (${files.length})\n\n`;
  markdown += `| Status | File | Changes |\n`;
  markdown += `|--------|------|--------:|\n`;

  for (const file of files) {
    const statusIcon =
      file.status === 'added'
        ? '🆕 Added'
        : file.status === 'removed'
          ? '🗑️ Removed'
          : file.status === 'modified'
            ? '✏️ Modified'
            : file.status === 'renamed'
              ? '📝 Renamed'
              : `📄 ${file.status}`;
    const changes = `+${file.additions} -${file.deletions}`;
    let filename = file.filename;
    if (file.status === 'renamed' && file.previous_filename) {
      filename = `${file.previous_filename} → ${file.filename}`;
    }
    markdown += `| ${statusIcon} | \`${filename}\` | ${changes} |\n`;
  }

  markdown += '\n';
  return markdown;
}
