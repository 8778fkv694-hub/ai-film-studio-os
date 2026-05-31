import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);
const MAX_IMPORT_BYTES = 500 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 5000;
const ALLOWED_IMPORT_ROOTS = new Set([
  'assets',
  'characters',
  'docs',
  'fixups',
  'prompt_experience',
  'prompt_templates',
  'prompts',
  'props',
  'renders',
  'reports',
  'schema',
  'scenes',
  'shots',
  'shots_draft',
  'states',
  'styles'
]);

const MAX_DECOMPRESSED_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_EXTENSIONS = new Set([
  '.json', '.md', '.txt', '.jpg', '.jpeg', '.png', '.webp',
  '.mp4', '.mov', '.wav', '.mp3', '.srt', '.vtt', '.csv'
]);

function isInsideDir(filePath: string, parentDir: string) {
  const relative = path.relative(parentDir, filePath);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function normalizeZipEntry(raw: string) {
  const entry = raw.replace(/\r$/, '');
  const withoutTrailingSlash = entry.replace(/\/+$/, '');

  if (
    !withoutTrailingSlash ||
    withoutTrailingSlash.includes('\0') ||
    withoutTrailingSlash.includes('\\') ||
    withoutTrailingSlash.startsWith('/') ||
    /^[A-Za-z]:/.test(withoutTrailingSlash)
  ) {
    return null;
  }

  const segments = withoutTrailingSlash.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  const normalized = path.posix.normalize(withoutTrailingSlash);
  if (normalized !== withoutTrailingSlash || normalized === '..' || normalized.startsWith('../')) {
    return null;
  }

  return normalized;
}

function shouldSkipImportEntry(entry: string) {
  return entry === '.DS_Store' || entry.startsWith('__MACOSX/') || entry.split('/').includes('.DS_Store');
}

function isAllowedImportEntry(entry: string) {
  if (entry === 'project.json') return true;

  const segments = entry.split('/');
  if (segments[0] === 'render') {
    return segments[1] === 'output' && segments.length > 2;
  }

  return ALLOWED_IMPORT_ROOTS.has(segments[0]) && segments.length > 1;
}

async function listZipEntries(zipPath: string) {
  const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath], {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024
  });
  return stdout.split(/\n/).filter(Boolean);
}

function readZipEntry(zipPath: string, entry: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile('unzip', ['-p', zipPath, entry], {
      encoding: 'buffer',
      maxBuffer: MAX_IMPORT_BYTES
    } as any, (error, stdout, stderr) => {
      if (error) {
        const detail = Buffer.isBuffer(stderr) ? stderr.toString('utf-8') : String(stderr || error.message);
        reject(new Error(detail || error.message));
        return;
      }
      resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
    });
  });
}

export async function POST(request: Request) {
  let zipPath = '';
  const projectRoot = path.resolve(process.cwd(), '..');
  const workDir = getCurrentProjectPath() || projectRoot;
  const localDir = path.join(projectRoot, '.local');
  const backupId = crypto.randomUUID();
  const backupDir = path.join(localDir, 'backups', backupId);
  const overwrittenFiles: string[] = [];
  const createdFiles: string[] = [];

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '未找到上传的 ZIP 文件' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: '仅支持 ZIP 项目包' }, { status: 400 });
    }

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: 'ZIP 文件过大' }, { status: 413 });
    }
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return NextResponse.json({ error: '文件内容不是有效 ZIP' }, { status: 400 });
    }

    zipPath = path.join(localDir, `project_import_${crypto.randomUUID()}.zip`);
    fs.writeFileSync(zipPath, bytes);

    const rawEntries = await listZipEntries(zipPath);
    if (rawEntries.length > MAX_IMPORT_ENTRIES) {
      return NextResponse.json({ error: 'ZIP 条目过多' }, { status: 400 });
    }

    const filesToImport: string[] = [];
    for (const rawEntry of rawEntries) {
      const entry = normalizeZipEntry(rawEntry);
      if (!entry) {
        return NextResponse.json({ error: `ZIP 包含非法路径: ${rawEntry}` }, { status: 400 });
      }
      if (shouldSkipImportEntry(entry) || rawEntry.endsWith('/')) continue;
      if (!isAllowedImportEntry(entry)) {
        return NextResponse.json({ error: `ZIP 包含不允许导入的路径: ${entry}` }, { status: 400 });
      }

      // Check file extension whitelist
      const ext = path.extname(entry).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json({ error: `ZIP 包含不支持的文件类型: ${entry}` }, { status: 400 });
      }

      filesToImport.push(entry);
    }

    if (filesToImport.length === 0) {
      return NextResponse.json({ error: 'ZIP 中没有可导入的项目文件' }, { status: 400 });
    }

    // Phase 1: Pre-check, generate report and backup existing files
    const precheckReport = {
      timestamp: new Date().toISOString(),
      backup_id: backupId,
      total_files: filesToImport.length,
      to_overwrite: [] as string[],
      to_create: [] as string[]
    };

    for (const entry of filesToImport) {
      const targetPath = path.resolve(workDir, entry);
      if (!isInsideDir(targetPath, workDir)) {
        return NextResponse.json({ error: `ZIP 包含越界路径: ${entry}` }, { status: 400 });
      }

      if (fs.existsSync(targetPath)) {
        overwrittenFiles.push(entry);
        precheckReport.to_overwrite.push(entry);
        // Backup existing file
        const backupPath = path.join(backupDir, entry);
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(targetPath, backupPath);
      } else {
        createdFiles.push(entry);
        precheckReport.to_create.push(entry);
      }
    }

    // Write precheck report to reports dir
    const reportsDir = path.resolve(workDir, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(reportsDir, 'import-precheck.json'),
      JSON.stringify(precheckReport, null, 2),
      'utf-8'
    );

    // Phase 2: Read, check cumulative size, and write files
    let totalDecompressedBytes = 0;
    for (const entry of filesToImport) {
      const targetPath = path.resolve(workDir, entry);
      const content = await readZipEntry(zipPath, entry);
      totalDecompressedBytes += content.length;
      if (totalDecompressedBytes > MAX_DECOMPRESSED_TOTAL_BYTES) {
        throw new Error(`累计解压大小超出限制 (${MAX_DECOMPRESSED_TOTAL_BYTES / (1024 * 1024)} MB)`);
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content);
    }

    return NextResponse.json({ success: true, message: `项目导入成功，已导入 ${filesToImport.length} 个文件` });
  } catch (e: any) {
    // Phase 3: Rollback on error
    console.error(`Import failed, triggering rollback... Reason: ${e.message}`);

    // 1. Delete newly created files
    for (const file of createdFiles) {
      const targetPath = path.resolve(workDir, file);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    }

    // 2. Restore overwritten files from backup
    for (const file of overwrittenFiles) {
      const backupPath = path.join(backupDir, file);
      const targetPath = path.resolve(workDir, file);
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, targetPath);
      }
    }

    return NextResponse.json({ error: `导入失败，已自动回滚。原因: ${e.message}` }, { status: 500 });
  } finally {
    // Phase 4: Clean up temporary files
    if (zipPath && fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  }
}
