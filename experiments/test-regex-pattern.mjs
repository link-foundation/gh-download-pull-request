#!/usr/bin/env node

/**
 * Test script to verify the regex pattern handles all changeset types
 */

// Test cases for different changeset formats
const testCases = [
  {
    name: 'Patch Changes with commit hash',
    body: `### Patch Changes

- abc1234: Fix bug in authentication module`,
    expected: {
      changeType: 'Patch',
      commitHash: 'abc1234',
      description: 'Fix bug in authentication module',
    },
  },
  {
    name: 'Minor Changes with commit hash',
    body: `### Minor Changes

- 2bcef5f: Add support for google/gemini-3-pro model alias
  - Added 'google/gemini-3-pro' as an alias to 'gemini-3-pro-preview'
  - Updated README.md with Google Gemini usage examples`,
    expected: {
      changeType: 'Minor',
      commitHash: '2bcef5f',
      description: `Add support for google/gemini-3-pro model alias
  - Added 'google/gemini-3-pro' as an alias to 'gemini-3-pro-preview'
  - Updated README.md with Google Gemini usage examples`,
    },
  },
  {
    name: 'Major Changes with commit hash',
    body: `### Major Changes

- def5678: Breaking API changes for v2.0`,
    expected: {
      changeType: 'Major',
      commitHash: 'def5678',
      description: 'Breaking API changes for v2.0',
    },
  },
  {
    name: 'Patch Changes without commit hash',
    body: `### Patch Changes

- Small typo fix in documentation`,
    expected: {
      changeType: 'Patch',
      commitHash: null,
      description: 'Small typo fix in documentation',
    },
  },
  {
    name: 'Minor Changes without commit hash',
    body: `### Minor Changes

- Added new feature for user preferences`,
    expected: {
      changeType: 'Minor',
      commitHash: null,
      description: 'Added new feature for user preferences',
    },
  },
];

// The updated regex pattern from the fix
const changesPattern =
  /### (Major|Minor|Patch) Changes\s*\n\s*-\s+(?:([a-f0-9]+):\s+)?(.+?)$/s;

console.log('🧪 Testing regex pattern for changeset detection\n');

let passedTests = 0;
let failedTests = 0;

for (const testCase of testCases) {
  console.log(`Testing: ${testCase.name}`);

  const changesMatch = testCase.body.match(changesPattern);

  if (!changesMatch) {
    console.log(`  ❌ FAILED: Pattern did not match`);
    failedTests++;
    continue;
  }

  const [, changeType, commitHash, rawDescription] = changesMatch;

  // Handle case where commit hash might be in the description
  let finalCommitHash = commitHash;
  let finalDescription = rawDescription;

  if (!finalCommitHash && rawDescription) {
    const descWithHashMatch = rawDescription.match(/^([a-f0-9]+):\s+(.+)$/s);
    if (descWithHashMatch) {
      [, finalCommitHash, finalDescription] = descWithHashMatch;
    }
  }

  // Verify results
  const errors = [];

  if (changeType !== testCase.expected.changeType) {
    errors.push(
      `changeType: expected "${testCase.expected.changeType}", got "${changeType}"`
    );
  }

  // Compare commit hash (handle null vs undefined)
  const expectedHash = testCase.expected.commitHash;
  if ((finalCommitHash || null) !== (expectedHash || null)) {
    errors.push(
      `commitHash: expected "${expectedHash}", got "${finalCommitHash}"`
    );
  }

  if (finalDescription !== testCase.expected.description) {
    errors.push(
      `description: expected "${testCase.expected.description}", got "${finalDescription}"`
    );
  }

  if (errors.length > 0) {
    console.log(`  ❌ FAILED:`);
    errors.forEach((error) => console.log(`    - ${error}`));
    failedTests++;
  } else {
    console.log(`  ✅ PASSED`);
    passedTests++;
  }

  console.log();
}

console.log('━'.repeat(60));
console.log(`Results: ${passedTests} passed, ${failedTests} failed`);

if (failedTests > 0) {
  process.exit(1);
}
