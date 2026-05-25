import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const { workDir, projectRoot, remainingArgs } = parseArgs();
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch(e) {
    throw new Error(`Failed to read JSON ${p}: ${e.message}`);
  }
}

function loadSchema(name) {
  // schema/ 是全局共享资源，优先从根目录读取
  const globalPath = path.join(projectRoot, 'schema', name);
  if (fs.existsSync(globalPath)) {
    const s = readJson(globalPath);
    ajv.addSchema(s, s.$id || name);
    return s;
  }
  // 回退到项目目录
  const p = path.join(workDir, 'schema', name);
  const s = readJson(p);
  ajv.addSchema(s, s.$id || name);
  return s;
}

const schemas = {
  style: loadSchema('style.schema.json'),
  scene: loadSchema('scene.schema.json'),
  character: loadSchema('character.schema.json'),
  prop: loadSchema('prop.schema.json'),
  shot: loadSchema('shot.schema.json'),
  state: loadSchema('state.schema.json'),
  render_history: loadSchema('render_history.schema.json'),
  fixup: loadSchema('fixup.schema.json'),
  project: loadSchema('project.schema.json')
};

function validateDir(dir, schemaId) {
  // styles/ 可以作为全局共享资源；其他项目资源必须校验当前工作项目目录。
  let abs = path.join(workDir, dir);
  if (!fs.existsSync(abs) && dir === 'styles') {
    abs = path.join(projectRoot, dir);
  }
  if (!fs.existsSync(abs)) return true;

  const files = fs.readdirSync(abs).filter(f => f.endsWith('.json'));
  const validate = ajv.getSchema(schemaId) || ajv.getSchema(schemaId + '.json');
  if (!validate) throw new Error('schema not found: ' + schemaId);

  let ok = true;
  for (const f of files) {
    const p = path.join(abs, f);
    if (fs.lstatSync(p).isDirectory()) continue; 
    
    const obj = readJson(p);
    const valid = validate(obj);
    if (!valid) {
      ok = false;
      console.error(`INVALID ${path.relative(workDir, p) || `${dir}/${f}`}`);
      console.error(validate.errors);
    }
  }
  return ok;
}

function validateFile(relPath, schemaId) {
  const abs = path.join(workDir, relPath);
  if (!fs.existsSync(abs)) {
    // Optional file logic could be handled here, but if called, usually expected.
    // We'll assume if it's missing it fails validation unless wrapped.
    // For project.json it's expected.
    return false; 
  }
  const validate = ajv.getSchema(schemaId) || ajv.getSchema(schemaId + '.json');
  if (!validate) throw new Error('schema not found: ' + schemaId);
  const obj = readJson(abs);
  const valid = validate(obj);
  if (!valid) {
    console.error(`INVALID ${relPath}`);
    console.error(validate.errors);
    return false;
  }
  return true;
}

const allOk = [
  validateDir('styles', 'style.schema.json'),
  validateDir('scenes', 'scene.schema.json'),
  validateDir('characters', 'character.schema.json'),
  validateDir('props', 'prop.schema.json'),
  validateDir('shots', 'shot.schema.json'),
  validateDir('states', 'state.schema.json'),
  validateDir('fixups', 'fixup.schema.json'),
  // Validate render histories
  (() => {
    const rendersDir = path.join(workDir, 'renders');
    if (!fs.existsSync(rendersDir)) return true;
    const shotDirs = fs.readdirSync(rendersDir).filter(d => fs.lstatSync(path.join(rendersDir, d)).isDirectory());
    let ok = true;
    for (const d of shotDirs) {
      const historyPath = path.join('renders', d, 'history.json');
      if (fs.existsSync(path.join(workDir, historyPath))) {
        if (!validateFile(historyPath, 'render_history.schema.json')) ok = false;
      }
    }
    return ok;
  })(),
  validateFile('project.json', 'project.schema.json')
].every(Boolean);

if (allOk) {
  console.log('validate: ok');
  process.exit(0);
} else {
  console.error('validate: failed');
  process.exit(2);
}
