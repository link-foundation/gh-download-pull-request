#!/usr/bin/env sh
':'; // # ; exec "$(command -v bun || command -v deno run -A || command -v node)" "$0" "$@"

/**
 * CLI tests for gh-load-pull-request
 *
 * Uses test-anywhere for multi-runtime support (Node.js, Bun, Deno)
 *
 * Run with:
 *   node --test tests/cli.test.mjs
 *   bun test tests/cli.test.mjs
 *   deno test --allow-read --allow-run tests/cli.test.mjs
 */

/* global TextDecoder */

import {
  describe,
  it,
  assert,
  getRuntime,
  setDefaultTimeout,
} from 'test-anywhere';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Cross-runtime command execution helper
 * Works in Node.js, Bun, and Deno
 */
async function execCommand(command, args) {
  const runtime = getRuntime();

  if (runtime === 'deno') {
    // Use Deno.Command for Deno runtime
    const cmd = new Deno.Command(command, {
      args,
      stdout: 'piped',
      stderr: 'piped',
    });
    const output = await cmd.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    if (!output.success) {
      const error = new Error(`Command failed with exit code ${output.code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.status = output.code;
      throw error;
    }

    return { stdout, stderr };
  } else {
    // Use child_process for Node.js and Bun
    const { execSync } = await import('node:child_process');
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
}

/**
 * Get the runtime command for executing JavaScript files
 */
function getRuntimeCommand() {
  const runtime = getRuntime();
  switch (runtime) {
    case 'deno':
      return 'deno';
    case 'bun':
      return 'bun';
    default:
      return 'node';
  }
}

/**
 * Get runtime-specific arguments for running a script
 */
function getRuntimeArgs(scriptPath) {
  const runtime = getRuntime();
  switch (runtime) {
    case 'deno':
      return [
        'run',
        '--allow-read',
        '--allow-net',
        '--allow-env',
        '--allow-run',
        '--no-check',
        scriptPath,
      ];
    case 'bun':
      return ['run', scriptPath];
    default:
      return [scriptPath];
  }
}

describe('gh-load-pull-request CLI', () => {
  it('Script should have shebang and be readable', () => {
    const content = readFileSync(scriptPath, 'utf8');
    assert.ok(
      content.startsWith('#!/usr/bin/env sh'),
      'Missing or incorrect shebang'
    );
  });

  it('--help flag should display help', async () => {
    const cmd = getRuntimeCommand();
    const baseArgs = getRuntimeArgs(scriptPath);
    const args = [...baseArgs, '--help'];

    try {
      const result = await execCommand(cmd, args);
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

  it('--version flag should display version', async () => {
    const cmd = getRuntimeCommand();
    const baseArgs = getRuntimeArgs(scriptPath);
    const args = [...baseArgs, '--version'];

    try {
      const result = await execCommand(cmd, args);
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

  it('Invalid PR format should show helpful error', async () => {
    const cmd = getRuntimeCommand();
    const baseArgs = getRuntimeArgs(scriptPath);
    const args = [...baseArgs, 'invalid-pr-format'];

    try {
      await execCommand(cmd, args);
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
