import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

function resolve(name) {
  return path.join(DATA_DIR, name);
}

export async function readJson(name, fallback = null) {
  try {
    const raw = await fs.readFile(resolve(name), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(name, data) {
  const target = resolve(name);
  const tmp = `${target}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

export const FILES = {
  CV_BASE: 'cv_base.json',
  LATEST_RESULT: 'latest_result.json',
};
