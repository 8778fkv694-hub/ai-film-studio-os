import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 原子写文件：先写同目录下的临时文件，再 rename 覆盖目标。
 * rename 在同一文件系统上是原子操作，可避免进程在写入中途崩溃、
 * 或并发读取时读到被截断的半截内容（关键状态文件如 project.json
 * 若被写坏，下游 JSON.parse 失败会表现为“数据凭空丢失”）。
 */
export function writeFileAtomic(filePath: string, data: string | Buffer): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  try {
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, buf);
      fs.fsyncSync(fd); // 落盘后再 rename，避免崩溃后留下空文件
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

/** 原子写 JSON（2 空格缩进 + 末尾换行，与既有写法保持一致）。 */
export function writeJsonAtomic(filePath: string, value: unknown): void {
  writeFileAtomic(filePath, JSON.stringify(value, null, 2) + '\n');
}
