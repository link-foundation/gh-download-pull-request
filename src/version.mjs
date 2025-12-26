#!/usr/bin/env sh
':'; // # ; exec "$(command -v bun || command -v node)" "$0" "$@"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Download use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

// Import semver for version management
const semver = await use('semver@7.7.2');

function updatePackageJson(newVersion) {
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function updateMainScript(newVersion) {
  const scriptPath = path.join(__dirname, 'gh-load-pull-request.mjs');
  const content = fs.readFileSync(scriptPath, 'utf8');
  const updatedContent = content.replace(
    /let version = '[^']+'/,
    `let version = '${newVersion}'`
  );
  fs.writeFileSync(scriptPath, updatedContent);
}

function runGitCommand(command, description) {
  try {
    console.log(`🔄 ${description}...`);
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(
      `❌ Failed to ${description.toLowerCase()}: ${error.message}`
    );
    process.exit(1);
  }
}

function main() {
  const versionType = process.argv[2];

  if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
    console.error('Usage: ./version.mjs <patch|minor|major>');
    console.error('Examples:');
    console.error('  ./version.mjs patch   # 0.1.0 → 0.1.1');
    console.error('  ./version.mjs minor   # 0.1.0 → 0.2.0');
    console.error('  ./version.mjs major   # 0.1.0 → 1.0.0');
    process.exit(1);
  }

  // Read current version from package.json
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;

  // Calculate new version using semver
  const newVersion = semver.inc(currentVersion, versionType);

  if (!newVersion) {
    console.error(
      `❌ Failed to calculate new ${versionType} version from ${currentVersion}`
    );
    process.exit(1);
  }

  console.log(`📦 Bumping version from ${currentVersion} to ${newVersion}`);

  try {
    // Update both files
    updatePackageJson(newVersion);
    updateMainScript(newVersion);

    console.log('✅ Version updated successfully!');
    console.log(`   📄 package.json: ${newVersion}`);
    console.log(`   📄 gh-load-pull-request.mjs: ${newVersion}`);
    console.log('');

    // Automatically commit and push changes
    runGitCommand('git add .', 'Adding changes to git');
    runGitCommand(`git commit -m "${newVersion}"`, 'Committing changes');
    runGitCommand('git push', 'Pushing to remote repository');

    console.log('🎉 Version bump completed and pushed!');
  } catch (error) {
    console.error('❌ Error updating files:', error.message);
    process.exit(1);
  }
}

main();
