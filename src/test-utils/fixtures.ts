import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../test-fixtures');

export function loadFixture(name: string): string {
  return readFileSync(resolve(ROOT, name), 'utf-8');
}

export function mountFixture(name: string): HTMLElement {
  const html = loadFixture(name);
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}
