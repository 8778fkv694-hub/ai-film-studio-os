import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');

function clean(value) {
  return String(value || '').trim();
}

function joinList(items) {
  return (items || []).map(clean).filter(Boolean).join(', ');
}

function joinSentences(items) {
  return (items || [])
    .flat()
    .map(clean)
    .filter(Boolean)
    .map(s => s.endsWith('.') ? s : `${s}.`)
    .join(' ');
}

/**
 * Load a prompt template from prompt_templates/
 * @param {string} templatePath - e.g. "cinematic/video"
 * @returns {object|null} template object
 */
export function loadTemplate(templatePath) {
  const filePath = path.join(ROOT, 'prompt_templates', `${templatePath}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Render a template with the given context
 * @param {object} template - loaded template with sections
 * @param {object} context - key-value map of variables
 * @returns {object} { video_prompt, negative_prompt, section_outputs }
 */
export function renderTemplate(template, context) {
  const sectionOutputs = {};

  for (const [sectionKey, lines] of Object.entries(template.sections)) {
    const rendered = lines
      .map(line => {
        let result = line;
        for (const [key, value] of Object.entries(context)) {
          const placeholder = `\${${key}}`;
          result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value ?? ''));
        }
        return clean(result);
      })
      .filter(Boolean);

    sectionOutputs[sectionKey] = rendered;
  }

  const prompt = joinSentences([
    ...(sectionOutputs.master || []),
    ...(sectionOutputs.scene || []),
    ...(sectionOutputs.characters || []),
    ...(sectionOutputs.props || []),
    ...(sectionOutputs.shot || [])
  ]);

  const negative = joinList([
    ...(sectionOutputs.negative || [])
  ]);

  return { prompt, negative, sectionOutputs };
}

/**
 * Load experience rules from prompt_experience/rules.json
 * @returns {object} rules document
 */
export function loadRules() {
  const rulesPath = path.join(ROOT, 'prompt_experience/rules.json');
  if (!fs.existsSync(rulesPath)) return { rules: [] };
  try {
    return JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
  } catch {
    return { rules: [] };
  }
}

/**
 * Apply experience rules to a shot context and return augmentation text
 * @param {object} rulesDoc - loaded rules document
 * @param {object} shotMeta - { has_context_refs: bool, has_props: bool, has_dialogue: bool, shot_index: number }
 * @returns {{ positiveAppend: string[], negativeAppend: string[] }}
 */
export function applyRules(rulesDoc, shotMeta) {
  const positiveAppend = [];
  const negativeAppend = [];

  for (const rule of rulesDoc.rules || []) {
    const applies = rule.apply === 'always'
      || (rule.apply === 'when_context_refs' && shotMeta.has_context_refs)
      || (rule.apply === 'when_props' && shotMeta.has_props)
      || (rule.apply === 'when_dialogue' && shotMeta.has_dialogue)
      || (rule.apply === 'not_first_shot' && shotMeta.shot_index > 0);

    if (!applies) continue;

    if (rule.target === 'positive_append') {
      positiveAppend.push(rule.value);
    } else if (rule.target === 'negative_append') {
      negativeAppend.push(rule.value);
    }
  }

  return { positiveAppend, negativeAppend };
}

export { clean, joinList, joinSentences };
