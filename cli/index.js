#!/usr/bin/env node

/**
 * AI Film Studio OS - 统一命令行工具
 * 用法: afsos <command> [options]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(ROOT, 'tools/scripts');
const PROJECTS_FILE = path.join(ROOT, 'projects.json');
const PROJECTS_DIR = path.join(ROOT, 'projects');

// 中文消息
const MSG = {
  welcome: '🎬 AI 影视工作室 OS',
  version: '版本',
  commands: {
    status: '显示项目状态概览',
    check: '运行结构校验和逻辑检查',
    checkAll: '运行一键项目健康检查',
    split: '将剧本拆分为分镜草稿',
    build: '编译提示词 (Prompt)',
    tts: '生成对白语音 (TTS)',
    serve: '启动 Web UI 界面',
    init: '初始化新项目',
  },
  status: {
    checking: '正在检查项目状态...',
    projectName: '项目名称',
    projectId: '项目 ID',
    shots: '镜头数',
    drafts: '草稿数',
    scenes: '场景数',
    characters: '角色数',
    props: '道具数',
    noProject: '⚠️  未找到活动项目，请先在 Web UI 或 afsos init 初始化项目',
  },
  check: {
    running: '正在运行检查...',
    validate: '结构校验',
    lint: '逻辑检查',
    passed: '✅ 通过',
    failed: '❌ 失败',
    allPassed: '🎉 所有检查通过！可以继续下一步。',
    hasFailed: '⚠️  部分检查未通过，请修复后重试。',
  },
  split: {
    running: '正在拆分剧本...',
    notFound: '❌ 找不到剧本文件',
    hint: '💡 请将剧本放在 docs/script.txt',
    success: '✅ 成功拆分为 {count} 个镜头草稿',
    output: '📁 输出目录: shots_draft/',
    next: '💡 下一步: 检查草稿后运行 afsos check',
  },
  build: {
    running: '正在编译提示词...',
    success: '✅ 编译完成',
    output: '📁 输出目录: prompts/',
  },
  tts: {
    running: '正在生成语音...',
    success: '✅ 语音生成完成',
    output: '📁 输出目录: assets/audio/',
  },
  serve: {
    starting: '正在启动 Web UI...',
    ready: '✅ Web UI 已就绪',
    url: '🌐 访问地址',
  },
  error: {
    scriptNotFound: '❌ 工具脚本不存在: {path}',
    execFailed: '❌ 执行失败',
  }
};

// 辅助函数
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function resolveProjectDir(projectId) {
  if (!projectId || !/^[A-Za-z0-9_-]+$/.test(projectId)) return null;
  const projectDir = path.join(PROJECTS_DIR, projectId);
  return fs.existsSync(path.join(projectDir, 'project.json')) ? projectDir : null;
}

function resolveActiveProjectDir() {
  const projectsData = readJsonFile(PROJECTS_FILE);
  const activeDir = resolveProjectDir(projectsData?.activeProjectId);
  if (activeDir) return activeDir;

  for (const project of projectsData?.projects || []) {
    const projectDir = resolveProjectDir(project.id);
    if (projectDir) return projectDir;
  }

  return fs.existsSync(path.join(ROOT, 'project.json')) ? ROOT : null;
}

function getWorkDir() {
  const opts = program.opts();
  if (opts.projectDir) return path.resolve(process.cwd(), opts.projectDir);
  return resolveProjectDir(opts.projectId) || resolveActiveProjectDir();
}

function countFiles(dir, ext = '.json') {
  const workDir = getWorkDir();
  if (!workDir) return 0;
  const absDir = path.join(workDir, dir);
  if (!fs.existsSync(absDir)) return 0;
  return fs.readdirSync(absDir).filter(f => f.endsWith(ext)).length;
}

function readProjectJson() {
  const workDir = getWorkDir();
  if (!workDir) return null;
  return readJsonFile(path.join(workDir, 'project.json'));
}

function runScript(scriptName, args = []) {
  const scriptPath = path.join(TOOLS_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.error(chalk.red(MSG.error.scriptNotFound.replace('{path}', scriptPath)));
    process.exit(1);
  }
  try {
    const workDir = getWorkDir();
    const finalArgs = [scriptPath, ...args];
    if (workDir) finalArgs.push('--project-dir', workDir);
    const result = execFileSync('node', finalArgs, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return { success: true, output: result };
  } catch (e) {
    return { success: false, output: e.stdout || '', error: e.stderr || e.message };
  }
}

// 命令实现
const program = new Command();

program
  .name('afsos')
  .description(MSG.welcome)
  .option('--project-id <id>', '使用指定 projects/<id> 项目')
  .option('--project-dir <dir>', '使用指定项目目录')
  .version('1.0.0');

// status 命令
program
  .command('status')
  .description(MSG.commands.status)
  .action(() => {
    const spinner = ora(MSG.status.checking).start();

    const project = readProjectJson();
    spinner.stop();

    console.log();
    console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.cyan(`  ${MSG.welcome}`));
    console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();

    if (!project) {
      console.log(chalk.yellow(MSG.status.noProject));
      console.log(chalk.gray('  运行 afsos init 初始化项目'));
      return;
    }

    console.log(chalk.white(`  ${MSG.status.projectName}: `) + chalk.green(project.name || '-'));
    console.log(chalk.white(`  ${MSG.status.projectId}:   `) + chalk.gray(project.id || '-'));
    console.log(chalk.white('  项目目录:   ') + chalk.gray(getWorkDir()));
    console.log();

    const stats = [
      { label: MSG.status.shots, count: countFiles('shots'), color: 'blue' },
      { label: MSG.status.drafts, count: countFiles('shots_draft'), color: 'yellow' },
      { label: MSG.status.scenes, count: countFiles('scenes'), color: 'green' },
      { label: MSG.status.characters, count: countFiles('characters'), color: 'magenta' },
      { label: MSG.status.props, count: countFiles('props'), color: 'cyan' },
    ];

    console.log(chalk.bold('  📊 资源统计:'));
    stats.forEach(s => {
      const bar = '█'.repeat(Math.min(s.count, 20)) + '░'.repeat(Math.max(0, 20 - s.count));
      console.log(`     ${s.label.padEnd(8)} ${chalk[s.color](bar)} ${chalk.bold(s.count)}`);
    });

    console.log();
    console.log(chalk.gray('  💡 运行 afsos check 检查项目完整性'));
    console.log();
  });

// check 命令
program
  .command('check')
  .description(MSG.commands.check)
  .action(() => {
    console.log();
    console.log(chalk.bold.cyan(`  🔍 ${MSG.check.running}`));
    console.log();

    // Validate
    const spinnerV = ora(`  ${MSG.check.validate}...`).start();
    const validateResult = runScript('validate.js');
    if (validateResult.success && validateResult.output.includes('ok')) {
      spinnerV.succeed(chalk.green(`  ${MSG.check.validate}: ${MSG.check.passed}`));
    } else {
      spinnerV.fail(chalk.red(`  ${MSG.check.validate}: ${MSG.check.failed}`));
      if (validateResult.output) {
        console.log(chalk.gray(validateResult.output.split('\n').map(l => '     ' + l).join('\n')));
      }
    }

    // Lint
    const spinnerL = ora(`  ${MSG.check.lint}...`).start();
    const lintResult = runScript('lint.js');
    if (lintResult.success && lintResult.output.includes('ok')) {
      spinnerL.succeed(chalk.green(`  ${MSG.check.lint}: ${MSG.check.passed}`));
    } else {
      spinnerL.fail(chalk.red(`  ${MSG.check.lint}: ${MSG.check.failed}`));
      if (lintResult.output) {
        console.log(chalk.gray(lintResult.output.split('\n').map(l => '     ' + l).join('\n')));
      }
    }

    console.log();
    const allPassed = validateResult.success && lintResult.success;
    if (allPassed) {
      console.log(chalk.green.bold(`  ${MSG.check.allPassed}`));
    } else {
      console.log(chalk.yellow(`  ${MSG.check.hasFailed}`));
    }
    console.log();
  });

// check-all 命令
program
  .command('check-all')
  .description(MSG.commands.checkAll)
  .option('-q, --quick', '只运行快速检查步骤 (跳过 UI 和 Remotion 构建)')
  .action((options) => {
    const scriptPath = path.join(TOOLS_DIR, 'check-all.js');
    if (!fs.existsSync(scriptPath)) {
      console.error(chalk.red(MSG.error.scriptNotFound.replace('{path}', scriptPath)));
      process.exit(1);
    }
    try {
      const workDir = getWorkDir();
      const finalArgs = [scriptPath];
      if (options.quick) finalArgs.push('--quick');
      if (workDir) finalArgs.push('--project-dir', workDir);
      
      execFileSync('node', finalArgs, {
        cwd: ROOT,
        stdio: 'inherit'
      });
    } catch (e) {
      process.exit(e.status || 1);
    }
  });

// split 命令
program
  .command('split [script]')
  .description(MSG.commands.split)
  .action((script = 'docs/script.txt') => {
    const workDir = getWorkDir() || ROOT;
    const scriptPath = path.isAbsolute(script) ? script : path.join(workDir, script);

    if (!fs.existsSync(scriptPath)) {
      console.log(chalk.red(`  ${MSG.split.notFound}: ${script}`));
      console.log(chalk.gray(`  ${MSG.split.hint}`));
      return;
    }

    const spinner = ora(MSG.split.running).start();
    const result = runScript('script-split.js', [scriptPath]);

    if (result.success) {
      const match = result.output.match(/(\d+)/);
      const count = match ? match[1] : '?';
      spinner.succeed(chalk.green(MSG.split.success.replace('{count}', count)));
      console.log(chalk.gray(`  ${MSG.split.output}`));
      console.log(chalk.gray(`  ${MSG.split.next}`));
    } else {
      spinner.fail(chalk.red(MSG.error.execFailed));
      console.log(chalk.gray(result.error || result.output));
    }
  });

// build 命令
program
  .command('build')
  .description(MSG.commands.build)
  .action(() => {
    const spinner = ora(MSG.build.running).start();
    const result = runScript('build-prompts.js');

    if (result.success) {
      spinner.succeed(chalk.green(MSG.build.success));
      console.log(chalk.gray(`  ${MSG.build.output}`));
    } else {
      spinner.fail(chalk.red(MSG.error.execFailed));
      console.log(chalk.gray(result.error || result.output));
    }
  });

// tts 命令
program
  .command('tts')
  .description(MSG.commands.tts)
  .action(async () => {
    const spinner = ora(MSG.tts.running).start();
    const result = runScript('gen-tts.js');

    if (result.success) {
      spinner.succeed(chalk.green(MSG.tts.success));
      console.log(chalk.gray(`  ${MSG.tts.output}`));
    } else {
      spinner.fail(chalk.red(MSG.error.execFailed));
      console.log(chalk.gray(result.error || result.output));
    }
  });

// serve 命令
program
  .command('serve')
  .description(MSG.commands.serve)
  .option('-p, --port <port>', '端口号', '9527')
  .action((options) => {
    console.log(chalk.cyan(`  ${MSG.serve.starting}`));

    const uiDir = path.join(ROOT, 'ui');
    const child = spawn('npm', ['run', 'dev'], {
      cwd: uiDir,
      stdio: 'inherit',
      shell: true
    });

    child.on('error', (err) => {
      console.error(chalk.red(MSG.error.execFailed), err);
    });
  });

// init 命令
program
  .command('init [id]')
  .description(MSG.commands.init)
  .option('-n, --name <name>', '项目名称')
  .option('-d, --description <description>', '项目描述', '')
  .action((id = 'my_project', options) => {
    console.log(chalk.cyan('  🚀 初始化新项目...'));

    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      console.log(chalk.red('  ❌ Project ID 只能包含字母、数字、下划线和连字符'));
      return;
    }

    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    const projectDir = path.join(PROJECTS_DIR, id);
    if (fs.existsSync(projectDir)) {
      console.log(chalk.red(`  ❌ 项目已存在: ${projectDir}`));
      return;
    }
    fs.mkdirSync(projectDir, { recursive: true });

    // 创建基础目录
    const dirs = ['docs', 'shots', 'shots_draft', 'scenes', 'characters', 'props', 'assets/audio', 'prompts', 'renders', 'reports'];
    dirs.forEach(dir => {
      const absDir = path.join(projectDir, dir);
      fs.mkdirSync(absDir, { recursive: true });
      console.log(chalk.gray(`     创建目录: projects/${id}/${dir}/`));
    });

    // 创建示例 project.json
    const projectPath = path.join(projectDir, 'project.json');
    const template = {
      id,
      name: options.name || '我的新项目',
      description: options.description || '',
      default_style_ref: 'styles/cinematic_v1.json',
      defaults: {
        language: 'zh',
        fps: 24
      },
      inventory: {
        scenes: [],
        characters: [],
        props: []
      },
      timeline: []
    };
    fs.writeFileSync(projectPath, JSON.stringify(template, null, 2));
    console.log(chalk.gray(`     创建文件: projects/${id}/project.json`));

    const projectsData = readJsonFile(PROJECTS_FILE) || { projects: [], activeProjectId: null };
    const now = new Date().toISOString();
    projectsData.projects = (projectsData.projects || []).filter(project => project.id !== id);
    projectsData.projects.push({
      id,
      name: template.name,
      description: template.description,
      createdAt: now,
      updatedAt: now
    });
    projectsData.activeProjectId = id;
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsData, null, 2));

    console.log();
    console.log(chalk.green.bold('  ✅ 项目初始化完成！'));
    console.log();
    console.log(chalk.gray('  下一步:'));
    console.log(chalk.gray(`  1. 编辑 projects/${id}/project.json 设置项目信息`));
    console.log(chalk.gray(`  2. 将剧本放入 projects/${id}/docs/script.txt`));
    console.log(chalk.gray('  3. 运行 afsos split 拆分剧本'));
    console.log();
  });

program.parse();
