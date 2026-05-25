import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir, projectRoot, projectId } = parseArgs();
const args = process.argv.slice(2);
const isQuick = args.includes('--quick');

console.log('\n🩺 ' + chalkCyan('AI Film Studio OS - 一键健康检查 (check-all)'));
console.log(`📂 工作项目目录: ${workDir}`);
console.log(`模式: ${isQuick ? chalkYellow('快速检查 (Quick)') : chalkMagenta('完整检查 (Full)')}\n`);

// Prepare common arguments to child scripts
const subArgs = [];
if (projectId) {
  subArgs.push('--project-id', projectId);
} else {
  subArgs.push('--project-dir', workDir);
}

const steps = [
  {
    name: 'Validate JSON structures',
    cmd: 'node',
    args: ['tools/scripts/validate.js', ...subArgs],
    cwd: projectRoot,
  },
  {
    name: 'Business logic linting',
    cmd: 'node',
    args: ['tools/scripts/lint.js', ...subArgs],
    cwd: projectRoot,
  },
  {
    name: 'Build image prompts',
    cmd: 'node',
    args: ['tools/scripts/build-image-prompts.js', ...subArgs],
    cwd: projectRoot,
  },
  {
    name: 'Build video prompts',
    cmd: 'node',
    args: ['tools/scripts/build-prompts.js', ...subArgs],
    cwd: projectRoot,
  }
];

if (!isQuick) {
  steps.push(
    {
      name: 'Remotion data preparation',
      cmd: 'npm',
      args: ['--prefix', 'render', 'run', 'prepare', '--', ...subArgs],
      cwd: projectRoot,
    },
    {
      name: 'Remotion type checking',
      cmd: 'npx',
      args: ['tsc', '--noEmit'],
      cwd: path.join(projectRoot, 'render'),
    },
    {
      name: 'UI production build',
      cmd: 'npm',
      args: ['--prefix', 'ui', 'run', 'build'],
      cwd: projectRoot,
    }
  );
}

const results = [];
let allPassed = true;
const startedAt = new Date().toISOString();

for (const step of steps) {
  console.log(`🏃 正在运行: ${chalkBold(step.name)}...`);
  console.log(`   命令: ${step.cmd} ${step.args.join(' ')}`);

  const startTime = Date.now();
  const run = spawnSync(step.cmd, step.args, {
    cwd: step.cwd,
    encoding: 'utf-8',
    shell: true
  });
  const durationMs = Date.now() - startTime;

  const passed = run.status === 0;
  
  if (passed) {
    console.log(`✅ ${chalkGreen('通过')} (${durationMs}ms)\n`);
    results.push({
      name: step.name,
      command: `${step.cmd} ${step.args.join(' ')}`,
      status: 'passed',
      duration_ms: durationMs
    });
  } else {
    console.log(`❌ ${chalkRed('失败')} (${durationMs}ms)`);
    if (run.stdout) console.log(run.stdout);
    if (run.stderr) console.error(run.stderr);
    console.log();

    results.push({
      name: step.name,
      command: `${step.cmd} ${step.args.join(' ')}`,
      status: 'failed',
      duration_ms: durationMs,
      error: (run.stdout + '\n' + run.stderr).trim()
    });

    allPassed = false;
    break; // Halted on failure
  }
}

const finishedAt = new Date().toISOString();

// Write report to active project
const report = {
  project_dir: workDir,
  project_id: projectId || path.basename(workDir),
  mode: isQuick ? 'quick' : 'full',
  started_at: startedAt,
  finished_at: finishedAt,
  status: allPassed ? 'passed' : 'failed',
  steps: results
};

const reportsDir = path.join(workDir, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(
  path.join(reportsDir, 'check-all.report.json'),
  JSON.stringify(report, null, 2)
);

console.log(chalkCyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
if (allPassed) {
  console.log(`🎉 ${chalkGreen('检查全部通过！项目状态健康。')}`);
  console.log(`报告写入: ${path.relative(projectRoot, path.join(reportsDir, 'check-all.report.json'))}`);
  console.log(chalkCyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  process.exit(0);
} else {
  console.error(`⚠️  ${chalkRed('项目健康检查未通过！请修复上方错误。')}`);
  console.log(`报告写入: ${path.relative(projectRoot, path.join(reportsDir, 'check-all.report.json'))}`);
  console.error(chalkCyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  process.exit(2);
}

// Helpers for color output
function chalkCyan(str) { return `\x1b[36m${str}\x1b[0m`; }
function chalkYellow(str) { return `\x1b[33m${str}\x1b[0m`; }
function chalkMagenta(str) { return `\x1b[35m${str}\x1b[0m`; }
function chalkGreen(str) { return `\x1b[32m${str}\x1b[0m`; }
function chalkRed(str) { return `\x1b[31m${str}\x1b[0m`; }
function chalkBold(str) { return `\x1b[1m${str}\x1b[22m`; }
