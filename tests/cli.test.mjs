#!/usr/bin/env bun

/**
 * CLI tests for gh-load-pull-request
 *
 * Uses test-anywhere for Bun runtime
 *
 * Run with:
 *   bun test tests/cli.test.mjs
 */

import { describe, it, assert, setDefaultTimeout } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Set timeout to 20 seconds for slow tests on Windows
setDefaultTimeout(20000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(
  __dirname,
  '..',
  'src',
  'gh-load-pull-request.mjs'
);

/**
 * Command execution helper for Bun
 */
function execCommand(command, args) {
  try {
    const stdout = execSync(
      `${command} ${args.map((a) => `"${a}"`).join(' ')}`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
    return { stdout, stderr: '' };
  } catch (error) {
    const err = new Error(error.message);
    err.stdout = error.stdout || '';
    err.stderr = error.stderr || '';
    err.status = error.status;
    throw err;
  }
}

describe('gh-load-pull-request CLI', () => {
  it('Script should have shebang and be readable', () => {
    const content = readFileSync(scriptPath, 'utf8');
    assert.ok(
      content.startsWith('#!/usr/bin/env bun'),
      'Missing or incorrect shebang'
    );
  });

  it('--help flag should display help', () => {
    const args = ['run', scriptPath, '--help'];

    try {
      const result = execCommand('bun', args);
      // yargs --help should include "Usage:"
      assert.ok(
        result.stdout.includes('Usage:') || result.stderr.includes('Usage:'),
        'Help output missing Usage section'
      );
    } catch (error) {
      // yargs exits with code 0 for --help but may write to stdout or stderr
      const output = (error.stdout || '') + (error.stderr || '');
      assert.ok(
        output.includes('Usage:'),
        `Help output missing Usage section. Output: ${output}`
      );
    }
  });

  it('--version flag should display version', () => {
    const args = ['run', scriptPath, '--version'];

    try {
      const result = execCommand('bun', args);
      const output = result.stdout + result.stderr;
      assert.ok(
        output.match(/\d+\.\d+\.\d+/),
        'Version output missing version number'
      );
    } catch (error) {
      const output = (error.stdout || '') + (error.stderr || '');
      assert.ok(
        output.match(/\d+\.\d+\.\d+/),
        `Version output missing version number. Output: ${output}`
      );
    }
  });

  it('Invalid PR format should show helpful error', () => {
    const args = ['run', scriptPath, 'invalid-pr-format'];

    try {
      execCommand('bun', args);
      // If it doesn't throw, that's unexpected
      assert.ok(false, 'Should have failed with invalid format');
    } catch (error) {
      const output = (error.stdout || '') + (error.stderr || '');
      assert.ok(
        output.includes('Invalid PR URL') || output.includes('Invalid PR'),
        `Did not show expected error message for invalid format. Output: ${output}`
      );
    }
  });
});
