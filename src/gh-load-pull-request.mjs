#!/usr/bin/env bun

// Import built-in Node.js modules
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

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
  // Use node:fs for Deno compatibility (fs-extra has issues with Deno)
  const { readFileSync, existsSync } = await import('node:fs');
  if (existsSync(packagePath)) {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
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

// Verbose logging flag (set by CLI option)
let verboseMode = false;

const log = (color, message) =>
  console.error(`${colors[color]}${message}${colors.reset}`);

const verboseLog = (color, message) => {
  if (verboseMode) {
    log(color, message);
  }
};

// Helper function to check if gh CLI is installed
async function isGhInstalled() {
  try {
    const { execSync } = await import('node:child_process');
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

    const { execSync } = await import('node:child_process');
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

// Image magic bytes for validation
const imageMagicBytes = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header for WebP
  bmp: [0x42, 0x4d],
  ico: [0x00, 0x00, 0x01, 0x00],
  svg: [0x3c, 0x3f, 0x78, 0x6d, 0x6c], // <?xml for SVG (though SVG can also start with <svg)
};

// Validate image by checking magic bytes
function validateImageBuffer(buffer, url) {
  if (!buffer || buffer.length < 4) {
    return { valid: false, reason: 'Buffer too small' };
  }

  const bytes = [...buffer.slice(0, 8)];

  // Check for HTML error page (starts with <!DOCTYPE or <html or <!)
  const htmlMarkers = [
    [0x3c, 0x21], // <!
    [0x3c, 0x68, 0x74, 0x6d, 0x6c], // <html
    [0x3c, 0x48, 0x54, 0x4d, 0x4c], // <HTML
  ];

  for (const marker of htmlMarkers) {
    if (marker.every((byte, i) => bytes[i] === byte)) {
      return {
        valid: false,
        reason: 'Downloaded file is HTML (likely error page)',
      };
    }
  }

  // Check for valid image formats
  for (const [format, magic] of Object.entries(imageMagicBytes)) {
    if (magic.every((byte, i) => bytes[i] === byte)) {
      return { valid: true, format };
    }
  }

  // Special check for SVG (can start with <svg directly)
  const svgMarker = [0x3c, 0x73, 0x76, 0x67]; // <svg
  if (svgMarker.every((byte, i) => bytes[i] === byte)) {
    return { valid: true, format: 'svg' };
  }

  // If we can't identify it but it's not HTML, give it the benefit of the doubt
  // Some images might have unusual headers
  verboseLog(
    'yellow',
    `⚠️ Unknown image format for ${url}, bytes: [${bytes
      .slice(0, 8)
      .map((b) => `0x${b.toString(16)}`)
      .join(', ')}]`
  );
  return { valid: true, format: 'unknown' };
}

// Get file extension from format or URL
function getExtensionFromFormat(format, url) {
  const formatExtensions = {
    png: '.png',
    jpg: '.jpg',
    gif: '.gif',
    webp: '.webp',
    bmp: '.bmp',
    ico: '.ico',
    svg: '.svg',
  };

  if (format && formatExtensions[format]) {
    return formatExtensions[format];
  }

  // Try to get from URL
  try {
    const urlPath = new globalThis.URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    if (
      ext &&
      [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.bmp',
        '.ico',
        '.svg',
      ].includes(ext)
    ) {
      return ext === '.jpeg' ? '.jpg' : ext;
    }
  } catch (_e) {
    // Ignore URL parsing errors
  }

  return '.png'; // Default fallback
}

// Download a file with redirect support
function downloadFile(url, token, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const parsedUrl = new globalThis.URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': 'gh-load-pull-request',
    };

    // Add auth for GitHub URLs
    if (token && parsedUrl.hostname.includes('github')) {
      headers['Authorization'] = `token ${token}`;
    }

    const req = protocol.get(url, { headers }, (res) => {
      // Handle redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        verboseLog(
          'dim',
          `  ↳ Redirecting to: ${res.headers.location.substring(0, 80)}...`
        );
        resolve(downloadFile(res.headers.location, token, maxRedirects - 1));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Extract image URLs from markdown content
function extractMarkdownImageUrls(content) {
  if (!content) {
    return [];
  }

  const urls = [];

  // Match markdown images: ![alt](url) or ![alt](url "title")
  const mdImageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = mdImageRegex.exec(content)) !== null) {
    urls.push({ url: match[2], alt: match[1] });
  }

  // Match HTML images: <img src="url" /> or <img src='url'>
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlImageRegex.exec(content)) !== null) {
    urls.push({ url: match[1], alt: '' });
  }

  return urls;
}

// Download all images from content and update the markdown
async function downloadImages(content, imagesDir, token, _prNumber) {
  if (!content) {
    return { content, downloadedImages: [] };
  }

  const images = extractMarkdownImageUrls(content);
  if (images.length === 0) {
    return { content, downloadedImages: [] };
  }

  const downloadedImages = [];
  let updatedContent = content;
  let imageCounter = 1;

  // Ensure images directory exists
  await fs.ensureDir(imagesDir);

  for (const { url } of images) {
    try {
      verboseLog('dim', `  📥 Downloading: ${url.substring(0, 60)}...`);

      const buffer = await downloadFile(url, token);
      const validation = validateImageBuffer(buffer, url);

      if (!validation.valid) {
        log('yellow', `  ⚠️ Skipping invalid image: ${validation.reason}`);
        continue;
      }

      const ext = getExtensionFromFormat(validation.format, url);
      const filename = `image-${imageCounter}${ext}`;
      const localPath = path.join(imagesDir, filename);
      const relativePath = `./${path.basename(imagesDir)}/${filename}`;

      await fs.writeFile(localPath, buffer);
      downloadedImages.push({
        originalUrl: url,
        localPath,
        relativePath,
        format: validation.format,
      });

      // Replace URL in content
      updatedContent = updatedContent.split(url).join(relativePath);
      imageCounter++;

      verboseLog('green', `  ✅ Saved: ${filename} (${validation.format})`);
    } catch (error) {
      log('yellow', `  ⚠️ Failed to download image: ${error.message}`);
      verboseLog('dim', `     URL: ${url}`);
    }
  }

  return { content: updatedContent, downloadedImages };
}

// Fetch pull request data from GitHub API
async function fetchPullRequest(owner, repo, prNumber, token, options = {}) {
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

    // Fetch PR reviews (only if includeReviews is true)
    let reviews = [];
    if (options.includeReviews !== false) {
      const { data: reviewsData } = await octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      });
      reviews = reviewsData;
    }

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

// Process content and download images if enabled
function processContent(
  content,
  imagesDir,
  token,
  prNumber,
  downloadImagesFlag
) {
  if (!downloadImagesFlag) {
    return Promise.resolve({ content, downloadedImages: [] });
  }
  return downloadImages(content, imagesDir, token, prNumber);
}

// Convert PR data to markdown
async function convertToMarkdown(data, options = {}) {
  const { pr, files, comments, reviewComments, reviews, commits } = data;
  const {
    downloadImagesFlag = true,
    imagesDir = '',
    token = '',
    prNumber = 0,
  } = options;

  let markdown = '';
  let allDownloadedImages = [];

  // Process PR body for images
  let prBody = pr.body || '';
  if (downloadImagesFlag && prBody) {
    log('blue', '🖼️ Processing images in PR description...');
    const result = await processContent(
      prBody,
      imagesDir,
      token,
      prNumber,
      downloadImagesFlag
    );
    prBody = result.content;
    allDownloadedImages = [...allDownloadedImages, ...result.downloadedImages];
  }

  // Header
  markdown += `# ${pr.title}\n\n`;

  // Metadata
  markdown += `**Author:** @${pr.user.login}\n`;
  markdown += `**Created:** ${pr.created_at}\n`;
  markdown += `**State:** ${pr.state}\n`;
  markdown += `**Branch:** ${pr.head.ref} → ${pr.base.ref}\n`;

  // Labels
  if (pr.labels && pr.labels.length > 0) {
    markdown += `**Labels:** ${pr.labels.map((l) => l.name).join(', ')}\n`;
  }

  markdown += '\n## Description\n\n';
  markdown += prBody ? `${prBody}\n\n` : '_No description provided._\n\n';

  markdown += '---\n\n';

  // Comments
  if (comments.length > 0) {
    markdown += `## Comments\n\n`;
    for (const comment of comments) {
      let commentBody = comment.body || '';
      if (downloadImagesFlag && commentBody) {
        verboseLog(
          'blue',
          `Processing images in comment by @${comment.user.login}...`
        );
        const result = await processContent(
          commentBody,
          imagesDir,
          token,
          prNumber,
          downloadImagesFlag
        );
        commentBody = result.content;
        allDownloadedImages = [
          ...allDownloadedImages,
          ...result.downloadedImages,
        ];
      }

      markdown += `### Comment by @${comment.user.login} (${comment.created_at})\n\n`;
      markdown += `${commentBody}\n\n`;
      markdown += '---\n\n';
    }
  }

  // Reviews
  if (reviews.length > 0) {
    markdown += `## Reviews\n\n`;
    for (const review of reviews) {
      let reviewBody = review.body || '';
      if (downloadImagesFlag && reviewBody) {
        verboseLog(
          'blue',
          `Processing images in review by @${review.user.login}...`
        );
        const result = await processContent(
          reviewBody,
          imagesDir,
          token,
          prNumber,
          downloadImagesFlag
        );
        reviewBody = result.content;
        allDownloadedImages = [
          ...allDownloadedImages,
          ...result.downloadedImages,
        ];
      }

      markdown += `### Review by @${review.user.login} (${review.submitted_at})\n`;
      markdown += `**State:** ${review.state}\n\n`;

      if (reviewBody) {
        markdown += `${reviewBody}\n\n`;
      }

      // Add review comments for this review
      const reviewReviewComments = reviewComments.filter(
        (rc) => rc.pull_request_review_id === review.id
      );
      if (reviewReviewComments.length > 0) {
        markdown += `#### Review Comments\n\n`;
        for (const rc of reviewReviewComments) {
          let rcBody = rc.body || '';
          if (downloadImagesFlag && rcBody) {
            const result = await processContent(
              rcBody,
              imagesDir,
              token,
              prNumber,
              downloadImagesFlag
            );
            rcBody = result.content;
            allDownloadedImages = [
              ...allDownloadedImages,
              ...result.downloadedImages,
            ];
          }

          const lineInfo = rc.line ? `:${rc.line}` : '';
          markdown += `**File:** ${rc.path}${lineInfo}\n`;
          markdown += `${rcBody}\n\n`;
        }
      }

      markdown += '---\n\n';
    }
  }

  // Standalone review comments (not associated with a review)
  const standaloneReviewComments = reviewComments.filter(
    (rc) => !rc.pull_request_review_id
  );
  if (standaloneReviewComments.length > 0) {
    markdown += `## Review Comments\n\n`;
    for (const comment of standaloneReviewComments) {
      let commentBody = comment.body || '';
      if (downloadImagesFlag && commentBody) {
        const result = await processContent(
          commentBody,
          imagesDir,
          token,
          prNumber,
          downloadImagesFlag
        );
        commentBody = result.content;
        allDownloadedImages = [
          ...allDownloadedImages,
          ...result.downloadedImages,
        ];
      }

      markdown += `**@${comment.user.login}** commented on \`${comment.path}\``;
      if (comment.line) {
        markdown += ` (line ${comment.line})`;
      }
      markdown += `:\n`;
      markdown += `*${comment.created_at}*\n\n`;
      markdown += `${commentBody}\n\n`;
      if (comment.diff_hunk) {
        markdown += '```diff\n';
        markdown += `${comment.diff_hunk}\n`;
        markdown += '```\n\n';
      }
    }
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

  return { markdown, downloadedImages: allDownloadedImages };
}

// Convert PR data to JSON format
function convertToJson(data, downloadedImages = []) {
  const { pr, files, comments, reviewComments, reviews, commits } = data;

  return JSON.stringify(
    {
      pullRequest: {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        base: pr.base.ref,
        head: pr.head.ref,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        labels: pr.labels?.map((l) => l.name) || [],
        body: pr.body,
      },
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.author?.login || 'unknown',
        url: c.html_url,
      })),
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        previousFilename: f.previous_filename,
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
    describe: 'Output directory (default: current directory)',
  })
  .option('download-images', {
    type: 'boolean',
    describe: 'Download embedded images',
    default: true,
  })
  .option('include-reviews', {
    type: 'boolean',
    describe: 'Include PR reviews',
    default: true,
  })
  .option('format', {
    type: 'string',
    describe: 'Output format: markdown, json',
    default: 'markdown',
    choices: ['markdown', 'json'],
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    describe: 'Enable verbose logging',
    default: false,
  })
  .help('h')
  .alias('h', 'help')
  .example('$0 https://github.com/owner/repo/pull/123', 'Download PR #123')
  .example('$0 owner/repo#123', 'Download PR using shorthand format')
  .example('$0 owner/repo#123 -o ./output', 'Save to output directory')
  .example('$0 owner/repo#123 --format json', 'Output as JSON')
  .example('$0 owner/repo#123 --no-download-images', 'Skip image download')
  .example(
    '$0 https://github.com/owner/repo/pull/123 --token ghp_xxx',
    'Download private PR'
  ).argv;

async function main() {
  const {
    pr: prInput,
    token: tokenArg,
    output,
    'download-images': downloadImagesFlag,
    'include-reviews': includeReviews,
    format,
    verbose,
  } = argv;

  // Set verbose mode
  verboseMode = verbose;

  // Parse PR input first (before potentially slow gh CLI token fetch)
  const prInfo = parsePrUrl(prInput);
  if (!prInfo) {
    log('red', `❌ Invalid PR URL or format: ${prInput}`);
    log('yellow', '💡 Supported formats:');
    log('yellow', '   - https://github.com/owner/repo/pull/123');
    log('yellow', '   - owner/repo#123');
    log('yellow', '   - owner/repo/123');
    process.exit(1);
  }

  let token = tokenArg;

  // If no token provided, try to get it from gh CLI
  if (!token || token === undefined) {
    const ghToken = await getGhToken();
    if (ghToken) {
      token = ghToken;
      log('cyan', '🔑 Using GitHub token from gh CLI');
    }
  }

  const { owner, repo, prNumber } = prInfo;

  // Fetch PR data
  const data = await fetchPullRequest(owner, repo, prNumber, token, {
    includeReviews,
  });

  // Determine output paths
  const outputDir = output || process.cwd();
  const imagesDir = path.join(outputDir, `pr-${prNumber}-images`);
  const mdOutputPath = path.join(outputDir, `pr-${prNumber}.md`);
  const jsonOutputPath = path.join(outputDir, `pr-${prNumber}.json`);

  // Convert to appropriate format
  log('blue', `📝 Converting to ${format}...`);

  let outputContent;
  let downloadedImages = [];

  if (format === 'json') {
    // For JSON, we might still want to download images
    if (downloadImagesFlag) {
      log('blue', '🖼️ Processing images...');
      // Process all content for images
      const allContent = [
        data.pr.body || '',
        ...data.comments.map((c) => c.body || ''),
        ...data.reviews.map((r) => r.body || ''),
        ...data.reviewComments.map((rc) => rc.body || ''),
      ].join('\n\n');

      const result = await downloadImages(
        allContent,
        imagesDir,
        token,
        prNumber
      );
      downloadedImages = result.downloadedImages;
    }
    outputContent = convertToJson(data, downloadedImages);
  } else {
    // Markdown format with image processing
    const result = await convertToMarkdown(data, {
      downloadImagesFlag,
      imagesDir,
      token,
      prNumber,
    });
    outputContent = result.markdown;
    downloadedImages = result.downloadedImages;
  }

  // Output
  if (output) {
    await fs.ensureDir(outputDir);
    const outputPath = format === 'json' ? jsonOutputPath : mdOutputPath;
    await fs.writeFile(outputPath, outputContent, 'utf8');
    log('green', `✅ Saved to ${outputPath}`);

    if (downloadedImages.length > 0) {
      log(
        'green',
        `📁 Downloaded ${downloadedImages.length} image(s) to ${imagesDir}`
      );
    }
  } else {
    console.log(outputContent);
  }

  log('blue', '🎉 Done!');
}

main().catch((error) => {
  log('red', `💥 Script failed: ${error.message}`);
  if (verboseMode) {
    console.error(error.stack);
  }
  process.exit(1);
});
