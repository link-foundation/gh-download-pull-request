#!/usr/bin/env sh
':'; // # ; exec "$(command -v bun || command -v node)" "$0" "$@"

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧪 Running all tests...\n');

const tests = ['test-cli.mjs'];

let totalPassed = 0;
let totalFailed = 0;

for (const test of tests) {
  const testPath = path.join(__dirname, test);
  console.log(`Running ${test}...`);

  try {
    execSync(`node "${testPath}"`, { stdio: 'inherit' });
    totalPassed++;
  } catch (_error) {
    totalFailed++;
  }

  console.log('');
}

console.log(
  `📊 Overall Results: ${totalPassed}/${tests.length} test suites passed`
);

if (totalFailed > 0) {
  process.exit(1);
}
