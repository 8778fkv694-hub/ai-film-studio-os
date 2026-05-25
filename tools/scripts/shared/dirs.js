import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 项目根目录（tools/scripts/shared/ 的上三级）
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');

// 解析 --project-dir 参数，返回实际工作目录
function parseArgs() {
  const args = process.argv.slice(2);
  let projectDir = null;
  const remainingArgs = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-dir' && i + 1 < args.length) {
      projectDir = args[i + 1];
      i++;
    } else {
      remainingArgs.push(args[i]);
    }
  }

  return {
    workDir: projectDir || ROOT,
    projectRoot: ROOT,
    remainingArgs
  };
}

export { parseArgs, ROOT };