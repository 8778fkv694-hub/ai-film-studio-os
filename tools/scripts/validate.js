import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadSchema(name) {
  const p = path.join(ROOT, 'schema', name);
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
  project: loadSchema('project.schema.json')
};

function validateDir(dir, schemaId) {
  const abs = path.join(ROOT, dir);
  const files = fs.readdirSync(abs).filter(f => f.endsWith('.json'));
  const validate = ajv.getSchema(schemaId) || ajv.getSchema(schemaId + '.json');
  if (!validate) throw new Error('schema not found: ' + schemaId);

  let ok = true;
  for (const f of files) {
    const p = path.join(abs, f);
    const obj = readJson(p);
    const valid = validate(obj);
    if (!valid) {
      ok = false;
      console.error(`INVALID ${dir}/${f}`);
      console.error(validate.errors);
    }
  }
  return ok;
}

function validateFile(relPath, schemaId) {
  const abs = path.join(ROOT, relPath);
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
  validateFile('project.json', 'project.schema.json')
].every(Boolean);

if (allOk) {
  console.log('validate: ok');
  process.exit(0);
} else {
  console.error('validate: failed');
  process.exit(2);
}
