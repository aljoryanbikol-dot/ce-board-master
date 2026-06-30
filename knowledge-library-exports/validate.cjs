#!/usr/bin/env node
/**
 * validate.cjs — zero-dependency validator for CE Board Master Knowledge
 * Library export files. Checks a JSON file against schemas/knowledge-library.schema.json
 * (a hand-transcribed mirror of the live backend Zod validators).
 *
 * No npm install required — uses only Node's built-in `fs`/`path`.
 *
 * Usage:
 *   node validate.cjs <file.json> [--type=<kind>]
 *   node validate.cjs --all              # validate every file under examples/
 *
 * Kind is inferred from the filename (e.g. questions.json -> "questions") when
 * --type is omitted. Exit code 0 = every checked file is valid, 1 = otherwise.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schemas', 'knowledge-library.schema.json');
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const defs = schema['$defs'];

const KIND_TO_DEF = {
  'questions': 'QuestionsExport',
  'formulas': 'FormulasExport',
  'diagrams': 'DiagramsExport',
  'learning-objectives': 'LearningObjectivesExport',
  'concepts': 'ConceptsExport',
  'engineering-notes': 'EngineeringNotesExport',
  'engineering-tips': 'EngineeringTipsExport',
  'misconceptions': 'MisconceptionsExport',
  'review-notes': 'ReviewNotesExport',
  'flashcards': 'FlashcardsExport',
  'tutor-prompts': 'TutorPromptsExport',
  'mock-exam-templates': 'MockExamTemplatesExport',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URI_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+$/;

function resolveRef(ref) {
  const name = ref.split('/').pop();
  if (!defs[name]) throw new Error(`Unknown $ref: ${ref}`);
  return defs[name];
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number' && Number.isInteger(v)) return 'integer';
  return typeof v;
}

function typeMatches(declared, value) {
  const types = Array.isArray(declared) ? declared : [declared];
  return types.some((t) => {
    if (t === 'number') return typeof value === 'number';
    if (t === 'integer') return typeof value === 'number' && Number.isInteger(value);
    return t === typeOf(value);
  });
}

function validateNode(node, value, pathStr, errors) {
  if (node['$ref']) node = resolveRef(node['$ref']);
  if (value === undefined) return; // absence is handled by the parent's `required` check

  if (node.type && !typeMatches(node.type, value)) {
    errors.push(`${pathStr}: expected type ${Array.isArray(node.type) ? node.type.join('|') : node.type}, got ${typeOf(value)}`);
    return;
  }
  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${pathStr}: value '${value}' not in allowed set [${node.enum.join(', ')}]`);
  }
  if (typeof value === 'string') {
    if (node.minLength !== undefined && value.length < node.minLength) errors.push(`${pathStr}: length ${value.length} < minLength ${node.minLength}`);
    if (node.maxLength !== undefined && value.length > node.maxLength) errors.push(`${pathStr}: length ${value.length} > maxLength ${node.maxLength}`);
    if (node.pattern && !new RegExp(node.pattern).test(value)) errors.push(`${pathStr}: does not match pattern ${node.pattern}`);
    if (node.format === 'uuid' && !UUID_RE.test(value)) errors.push(`${pathStr}: not a valid UUID`);
    if (node.format === 'uri' && !URI_RE.test(value)) errors.push(`${pathStr}: not a valid URL`);
  }
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) errors.push(`${pathStr}: ${value} < minimum ${node.minimum}`);
    if (node.maximum !== undefined && value > node.maximum) errors.push(`${pathStr}: ${value} > maximum ${node.maximum}`);
  }
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) errors.push(`${pathStr}: ${value.length} items < minItems ${node.minItems}`);
    if (node.maxItems !== undefined && value.length > node.maxItems) errors.push(`${pathStr}: ${value.length} items > maxItems ${node.maxItems}`);
    if (node.items) value.forEach((item, i) => validateNode(node.items, item, `${pathStr}[${i}]`, errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && node.properties) {
    if (node.required) {
      for (const key of node.required) {
        if (value[key] === undefined) errors.push(`${pathStr}.${key}: required field is missing`);
      }
    }
    for (const [key, propNode] of Object.entries(node.properties)) {
      if (value[key] !== undefined) validateNode(propNode, value[key], `${pathStr}.${key}`, errors);
    }
  }
}

function arrayFor(kind, json) {
  const arr = json.items || json.questions || json.formulas || json.objectives;
  return Array.isArray(arr) ? arr : [];
}

function validateFile(filePath, kindOverride) {
  const kind = kindOverride || path.basename(filePath, '.json');
  const defName = KIND_TO_DEF[kind];
  if (!defName) return { ok: false, errors: [`Unknown content kind '${kind}'. Known kinds: ${Object.keys(KIND_TO_DEF).join(', ')}`] };

  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch (e) { return { ok: false, errors: [`Cannot read file: ${e.message}`] }; }
  let json;
  try { json = JSON.parse(raw); } catch (e) { return { ok: false, errors: [`Invalid JSON: ${e.message}`] }; }

  const errors = [];
  validateNode(defs[defName], json, kind, errors);

  // Formula rows need subjectId OR subjectCode (Zod .refine(), not expressible as plain JSON Schema here).
  if (kind === 'formulas' && Array.isArray(json.formulas)) {
    json.formulas.forEach((f, i) => {
      if (f && !f.subjectId && !f.subjectCode) errors.push(`formulas[${i}]: requires subjectId or subjectCode`);
    });
  }

  return { ok: errors.length === 0, errors, count: arrayFor(kind, json).length };
}

function report(label, res) {
  if (res.ok) console.log(`✔ ${label}: VALID (${res.count} item${res.count === 1 ? '' : 's'})`);
  else {
    console.log(`✘ ${label}: INVALID`);
    for (const e of res.errors) console.log(`    - ${e}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node validate.cjs <file.json> [--type=<kind>]');
    console.log('       node validate.cjs --all');
    process.exit(1);
  }

  if (args[0] === '--all') {
    const dir = path.join(__dirname, 'examples');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    let anyFail = false;
    for (const f of files) {
      const res = validateFile(path.join(dir, f));
      report(f, res);
      if (!res.ok) anyFail = true;
    }
    process.exit(anyFail ? 1 : 0);
  }

  const file = args.find((a) => !a.startsWith('--'));
  const typeArg = args.find((a) => a.startsWith('--type='));
  const res = validateFile(file, typeArg ? typeArg.split('=')[1] : undefined);
  report(path.basename(file), res);
  process.exit(res.ok ? 0 : 1);
}

main();
