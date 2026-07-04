const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_PKG_PATH = path.join(ROOT_DIR, 'frontend', 'package.json');
const REMOTION_PKG_PATH = path.join(ROOT_DIR, 'remotion_engine', 'package.json');
const BACKEND_MAIN_PATH = path.join(ROOT_DIR, 'backend', 'main.py');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');

// Dry run option
const dryRun = process.argv.includes('--dry-run');

function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', cwd: ROOT_DIR }).trim();
  } catch (error) {
    return '';
  }
}

function getLatestTag() {
  const tags = runGitCommand('git tag --list "v*" --sort=-v:refname');
  if (!tags) return '';
  return tags.split('\n')[0];
}

function getCurrentVersion() {
  // Read version from frontend/package.json, fallback to 0.1.0 if not defined
  try {
    if (fs.existsSync(FRONTEND_PKG_PATH)) {
      const pkg = JSON.parse(fs.readFileSync(FRONTEND_PKG_PATH, 'utf8'));
      if (pkg.version) return pkg.version;
    }
  } catch (e) {
    // Ignore and fallback
  }
  return '0.1.0';
}

function getCommitsSinceTag(tag) {
  const gitCmd = tag ? `git log ${tag}..HEAD --oneline` : 'git log --oneline';
  const log = runGitCommand(gitCmd);
  if (!log) return [];
  return log.split('\n').map(line => {
    // Parse format: <hash> <message>
    const match = line.match(/^([a-f0-9]+)\s+(.*)$/);
    if (!match) return { hash: '', message: line };
    return { hash: match[1], message: match[2] };
  });
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  
  if (major === 0) {
    // Under major version zero, minor and patch are used
    if (type === 'minor' || type === 'major') {
      return `0.${minor + 1}.0`;
    }
    return `0.${minor}.${patch + 1}`;
  } else {
    // Standard SemVer
    if (type === 'major') return `${major + 1}.0.0`;
    if (type === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }
}

function parseCommits(commits) {
  const groups = {
    features: [],
    fixes: [],
    docs: [],
    performance: [],
    others: []
  };
  let bumpType = 'patch';

  commits.forEach(commit => {
    const msg = commit.message.trim();
    
    // Check for breaking changes
    if (msg.includes('BREAKING CHANGE:') || msg.match(/^[a-z]+(\([a-z0-9-]+\))?!:/)) {
      bumpType = 'minor'; // For 0.y.z, breaking is a minor bump
    }

    if (msg.startsWith('feat') && bumpType !== 'minor') {
      bumpType = 'minor';
    }

    // Categorize
    if (msg.match(/^feat(\(.*\))?:/)) {
      groups.features.push(msg);
    } else if (msg.match(/^fix(\(.*\))?:/)) {
      groups.fixes.push(msg);
    } else if (msg.match(/^docs(\(.*\))?:/)) {
      groups.docs.push(msg);
    } else if (msg.match(/^perf(\(.*\))?:/)) {
      groups.performance.push(msg);
    } else {
      groups.others.push(msg);
    }
  });

  return { groups, bumpType };
}

function generateChangelogEntry(version, groups) {
  const date = new Date().toISOString().split('T')[0];
  let markdown = `## [${version}] - ${date}\n\n`;

  if (groups.features.length > 0) {
    markdown += `### Features\n`;
    groups.features.forEach(msg => {
      markdown += `- ${msg}\n`;
    });
    markdown += `\n`;
  }

  if (groups.fixes.length > 0) {
    markdown += `### Bug Fixes\n`;
    groups.fixes.forEach(msg => {
      markdown += `- ${msg}\n`;
    });
    markdown += `\n`;
  }

  if (groups.performance.length > 0) {
    markdown += `### Performance Improvements\n`;
    groups.performance.forEach(msg => {
      markdown += `- ${msg}\n`;
    });
    markdown += `\n`;
  }

  if (groups.docs.length > 0) {
    markdown += `### Documentation\n`;
    groups.docs.forEach(msg => {
      markdown += `- ${msg}\n`;
    });
    markdown += `\n`;
  }

  if (groups.features.length === 0 && groups.fixes.length === 0 && groups.performance.length === 0 && groups.docs.length === 0) {
    markdown += `### Other Changes\n`;
    groups.others.slice(0, 10).forEach(msg => {
      markdown += `- ${msg}\n`;
    });
    markdown += `\n`;
  }

  return markdown;
}

function updatePackageJson(filePath, newVersion) {
  if (!fs.existsSync(filePath)) return;
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  pkg.version = newVersion;
  if (dryRun) {
    console.log(`[DRY RUN] Would write to ${path.relative(ROOT_DIR, filePath)}: version = "${newVersion}"`);
  } else {
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`Updated ${path.relative(ROOT_DIR, filePath)} to version ${newVersion}`);
  }
}

function updateBackendVersion(filePath, newVersion) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace version="X.Y.Z" in FastAPI instantiation
  const updatedContent = content.replace(
    /(app\s*=\s*FastAPI\([^)]*version\s*=\s*")([^"]+)("[^)]*\))/g,
    `$1${newVersion}$3`
  );
  
  if (content === updatedContent) {
    console.warn('Warning: Could not find FastAPI version string in backend/main.py to update!');
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would write to ${path.relative(ROOT_DIR, filePath)}: version = "${newVersion}"`);
  } else {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`Updated ${path.relative(ROOT_DIR, filePath)} to version ${newVersion}`);
  }
}

function updateChangelog(entry) {
  let content = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  if (fs.existsSync(CHANGELOG_PATH)) {
    const existing = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    // Remove the main header if it exists to prevent duplication
    content = existing.replace(/^# Changelog\s*\n*(All notable changes to this project will be documented in this file\.\s*\n*)?/, '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n');
    
    // Insert new entry after the header
    const headerEnd = content.indexOf('All notable changes to this project will be documented in this file.\n\n') + 'All notable changes to this project will be documented in this file.\n\n'.length;
    content = content.slice(0, headerEnd) + entry + content.slice(headerEnd);
  } else {
    content += entry;
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would write to CHANGELOG.md:\n${entry}`);
  } else {
    fs.writeFileSync(CHANGELOG_PATH, content, 'utf8');
    console.log('Updated CHANGELOG.md');
  }
}

function main() {
  console.log('--- Starting Yonru Release Script ---');
  const latestTag = getLatestTag();
  console.log(`Latest Git tag found: ${latestTag || 'None'}`);

  const currentVersion = getCurrentVersion();
  console.log(`Current synchronized version: ${currentVersion}`);

  const commits = getCommitsSinceTag(latestTag);
  console.log(`Found ${commits.length} commits since last tag.`);

  if (commits.length === 0) {
    console.log('No new commits since last tag. Nothing to release.');
    return;
  }

  const { groups, bumpType } = parseCommits(commits);
  const nextVersion = bumpVersion(currentVersion, bumpType);
  console.log(`Detected bump type: ${bumpType}`);
  console.log(`Next proposed version: ${nextVersion}`);

  const changelogEntry = generateChangelogEntry(nextVersion, groups);

  updatePackageJson(FRONTEND_PKG_PATH, nextVersion);
  updatePackageJson(REMOTION_PKG_PATH, nextVersion);
  updateBackendVersion(BACKEND_MAIN_PATH, nextVersion);
  updateChangelog(changelogEntry);

  if (dryRun) {
    console.log('\n[DRY RUN] Run without --dry-run to apply changes.');
  } else {
    console.log(`\nVersion successfully bumped to ${nextVersion}!`);
    console.log('Next Steps:');
    console.log(`1. Stage and commit the changed files: git commit -am "chore: release v${nextVersion}"`);
    console.log(`2. Tag the commit: git tag v${nextVersion}`);
  }
}

main();
