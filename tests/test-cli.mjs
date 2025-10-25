#!/usr/bin/env sh
':' //# ; exec "$(command -v bun || command -v node)" "$0" "$@"

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.join(__dirname, '..', 'gh-download-pull-request.mjs')

console.log('🧪 Running CLI tests...\n')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passed++
  } catch (error) {
    console.log(`❌ ${name}`)
    console.log(`   Error: ${error.message}`)
    failed++
  }
}

// Test 1: Script is executable
test('Script should have shebang and be readable', () => {
  const { readFileSync } = require('fs')
  const content = readFileSync(scriptPath, 'utf8')
  if (!content.startsWith('#!/usr/bin/env sh')) {
    throw new Error('Missing or incorrect shebang')
  }
})

// Test 2: Help flag works
test('--help flag should display help', () => {
  try {
    const output = execSync(`"${scriptPath}" --help`, { encoding: 'utf8' })
    if (!output.includes('Usage:')) {
      throw new Error('Help output missing Usage section')
    }
  } catch (error) {
    if (error.stdout && error.stdout.includes('Usage:')) {
      // Help command exits with code 0, but execSync might treat it differently
      return
    }
    throw error
  }
})

// Test 3: Version flag works
test('--version flag should display version', () => {
  try {
    const output = execSync(`"${scriptPath}" --version`, { encoding: 'utf8' })
    if (!output.match(/\d+\.\d+\.\d+/)) {
      throw new Error('Version output missing version number')
    }
  } catch (error) {
    if (error.stdout && error.stdout.match(/\d+\.\d+\.\d+/)) {
      return
    }
    throw error
  }
})

// Test 4: Invalid PR format shows error
test('Invalid PR format should show helpful error', () => {
  try {
    execSync(`"${scriptPath}" "invalid-pr-format"`, { encoding: 'utf8', stdio: 'pipe' })
    throw new Error('Should have failed with invalid format')
  } catch (error) {
    if (error.stderr && error.stderr.includes('Invalid PR URL')) {
      return
    }
    if (error.stdout && error.stdout.includes('Invalid PR URL')) {
      return
    }
    throw new Error('Did not show expected error message for invalid format')
  }
})

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  process.exit(1)
}
