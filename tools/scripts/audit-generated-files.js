import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir, projectRoot } = parseArgs();

console.log('🔍 Running Git tracked generated files audit...');

// Generated asset patterns relative to project root or projects
const generatedPatterns = [
  /projects\/[^/]+\/exports\/.+/,
  /projects\/[^/]+\/assets\/renders\/.+/,
  /projects\/[^/]+\/assets\/audio\/.+/,
  /projects\/[^/]+\/prompts\/.+/,
  /projects\/[^/]+\/reports\/check-all\.report\.json/,
  /projects\/[^/]+\/reports\/lint\.report\.json/,
  /projects\/[^/]+\/reports\/generated-assets-audit\.json/,
  /render\/public\/audio-.*\.mp3/,
  /render\/public\/keyframe-.*\.(jpg|jpeg|png|webp)/,
  /render\/public\/data\.json/,
  /render\/src\/manifest\.ts/,
];

try {
  // Get all tracked files from git
  const stdout = execFileSync('git', ['ls-files'], { cwd: projectRoot, encoding: 'utf-8' });
  const files = stdout.split('\n').map(f => f.trim()).filter(Boolean);

  const matchedFiles = files.filter(file => {
    return generatedPatterns.some(pattern => pattern.test(file));
  });

  const report = {
    generatedAt: new Date().toISOString(),
    projectDir: workDir,
    trackedGeneratedFilesCount: matchedFiles.length,
    trackedGeneratedFiles: matchedFiles
  };

  const reportsDir = path.join(workDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, 'generated-assets-audit.json'),
    JSON.stringify(report, null, 2)
  );

  if (matchedFiles.length > 0) {
    console.warn(`\n⚠️  Found ${matchedFiles.length} generated files currently tracked by Git:`);
    matchedFiles.slice(0, 15).forEach(f => {
      console.warn(`  - ${f}`);
    });
    if (matchedFiles.length > 15) {
      console.warn(`  ... and ${matchedFiles.length - 15} more files.`);
    }
    console.log('\n💡 To remove them from Git tracking without deleting them locally, review the report and run:');
    console.log(chalkCmd(`git rm --cached <file-path>`));
  } else {
    console.log('\n✅ No generated files are tracked by Git. Great!');
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Failed to run git audit:', error.message);
  process.exit(1);
}

function chalkCmd(cmd) {
  // Use ANSI color codes for cyan styling since we might not have chalk imported in simple scripts
  return `\x1b[36m${cmd}\x1b[0m`;
}
