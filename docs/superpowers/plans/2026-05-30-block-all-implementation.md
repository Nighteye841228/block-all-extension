# Block-All for Threads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that lets users batch-block Threads accounts and fold their posts/comments with tagged banners.

**Architecture:** Three Chrome surfaces (content script, popup, options) sharing `chrome.storage.local`. Pure-DOM-free `core/` package for storage/matcher/types is unit-testable. Content script uses MutationObserver + rAF-scheduled queue to inject Shadow-DOM fold banners. WXT framework handles MV3 manifest, dev server, HMR.

**Tech Stack:** TypeScript, WXT, `chrome.storage.local`, MutationObserver, Shadow DOM, `lit-html` (options + audit modal), `@tanstack/virtual-core` (blocklist virtualization), vitest + jsdom for tests.

**Spec reference:** `docs/superpowers/specs/2026-05-25-block-all-design.md`

---

## File Structure

```
block-all/
├── entrypoints/
│   ├── content.ts                       Content-script entry; wires observer + initial scan
│   ├── popup/
│   │   ├── index.html                   Popup markup shell
│   │   └── main.ts                      Popup logic (vanilla TS)
│   └── options/
│       ├── index.html                   Options page shell
│       └── main.ts                      Tabbed options router
├── src/
│   ├── core/
│   │   ├── types.ts                     BlockedUser, Tag, Settings, AppState
│   │   ├── normalize.ts                 normalizeUsername()
│   │   ├── defaults.ts                  DEFAULT_TAGS, DEFAULT_SETTINGS, EMPTY_STATE
│   │   ├── storage.ts                   load/save/subscribe wrapper over chrome.storage.local
│   │   ├── matcher.ts                   findBlockedUser(state, username)
│   │   └── export.ts                    serializeExport / parseImport (merge/replace)
│   ├── content/
│   │   ├── selectors.ts                 SELECTORS constant (single source for DOM strings)
│   │   ├── extractor.ts                 extractAuthorUsername, extractLikersFromDialog
│   │   ├── fold-ui.ts                   foldContainer, unfoldContainer, hideContainer
│   │   ├── observer.ts                  MutationObserver + rAF queue + initial scan
│   │   ├── block-button.ts              Per-post quick-block button injector
│   │   └── triggers.ts                  Bulk-extraction floating buttons (comments, likers)
│   ├── ui/
│   │   ├── audit-modal.ts               Shared audit modal (Shadow DOM when injected on Threads)
│   │   ├── options-blocklist.ts         Blocklist tab (virtualized)
│   │   ├── options-tags.ts              Tag management tab
│   │   ├── options-settings.ts          Preferences tab
│   │   ├── options-iox.ts               Import/export tab
│   │   └── styles/
│   │       ├── banner.css               Fold banner styles (injected into Shadow DOM)
│   │       └── modal.css                Audit modal styles
│   └── test-utils/
│       └── fixtures.ts                  Helpers to load fixture HTML into jsdom
├── test-fixtures/
│   ├── feed-post.html                   Single post excerpt from context.md
│   ├── profile-post.html                Single post excerpt from perpage.md
│   ├── likes-modal.html                 Likes dialog excerpt from like.md
│   └── single-post-comment.html         To be captured in Task 4
├── wxt.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── .github/workflows/ci.yml
```

---

## Phase 0 — Bootstrap

### Task 0.1: Scaffold WXT project

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `.gitignore`, `entrypoints/popup/index.html`, `entrypoints/popup/main.ts`, `entrypoints/options/index.html`, `entrypoints/options/main.ts`, `entrypoints/content.ts`

- [ ] **Step 1: Init project**

```bash
cd /Users/nighteye1228/Documents/block_all
npm init -y
npm install --save-dev wxt typescript @types/chrome vitest jsdom @vitest/ui
npm install lit-html @tanstack/virtual-core
```

- [ ] **Step 2: Write `wxt.config.ts`**

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Block-All for Threads',
    version: '0.1.0',
    description: '批次封鎖 Threads 帳號，並以可分類標籤摺疊內容。',
    permissions: ['storage'],
    host_permissions: [
      'https://*.threads.com/*',
      'https://*.threads.net/*',
    ],
    action: { default_popup: 'popup.html' },
    options_page: 'options.html',
  },
  srcDir: '.',
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["chrome", "vitest/globals"],
    "paths": {
      "@core/*": ["src/core/*"],
      "@content/*": ["src/content/*"],
      "@ui/*": ["src/ui/*"]
    },
    "baseUrl": "."
  },
  "include": ["src", "entrypoints", "test-fixtures", "vitest.config.ts", "wxt.config.ts"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
.output/
.wxt/
*.log
```

- [ ] **Step 5: Stub three entrypoints**

`entrypoints/content.ts`:
```typescript
export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  runAt: 'document_idle',
  main() {
    console.log('[block-all] content script loaded');
  },
});
```

`entrypoints/popup/index.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Block-All</title></head>
<body><div id="app">Block-All Popup</div><script type="module" src="./main.ts"></script></body></html>
```

`entrypoints/popup/main.ts`:
```typescript
console.log('[block-all] popup loaded');
```

`entrypoints/options/index.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Block-All Options</title></head>
<body><div id="app">Block-All Options</div><script type="module" src="./main.ts"></script></body></html>
```

`entrypoints/options/main.ts`:
```typescript
console.log('[block-all] options loaded');
```

- [ ] **Step 6: Add scripts to `package.json`**

Edit `package.json` `"scripts"` block to:
```json
"scripts": {
  "dev": "wxt",
  "build": "wxt build",
  "zip": "wxt zip",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 7: Build smoke test**

Run: `npm run build`
Expected: `.output/chrome-mv3/` directory created, manifest.json visible, no errors.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold WXT MV3 project skeleton"
```

---

### Task 0.2: vitest + jsdom setup

**Files:**
- Create: `vitest.config.ts`, `src/test-utils/fixtures.ts`, `src/core/__sanity__.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@content': resolve(__dirname, 'src/content'),
      '@ui': resolve(__dirname, 'src/ui'),
    },
  },
});
```

- [ ] **Step 2: Write fixture loader**

`src/test-utils/fixtures.ts`:
```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
```

- [ ] **Step 3: Write sanity test**

`src/core/__sanity__.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('vitest sanity', () => {
  it('runs in jsdom and document exists', () => {
    expect(typeof document).toBe('object');
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/test-utils src/core/__sanity__.test.ts
git commit -m "chore: configure vitest with jsdom environment"
```

---

### Task 0.3: Extract test fixtures from context.md / perpage.md / like.md

**Files:**
- Create: `test-fixtures/feed-post.html`, `test-fixtures/profile-post.html`, `test-fixtures/likes-modal.html`, `test-fixtures/README.md`

- [ ] **Step 1: Identify the first feed post block in `context.md`**

Run: `grep -n 'data-pressable-container="true"' context.md | head -3`
Pick the first post container's start position. Use `awk` or the Read tool to capture the HTML between that `<div data-pressable-container="true"...>` and its matching `</div>` (you may need to search for the next `data-pressable-container`).

- [ ] **Step 2: Save `test-fixtures/feed-post.html`**

Content: the single post container HTML extracted in Step 1 (one post, no surrounding chrome). Wrap it in `<!doctype html><html><body>` + the container + `</body></html>` so jsdom parses it cleanly.

- [ ] **Step 3: Repeat for profile-post**

Extract the first post container from `perpage.md`. Note: the profile page should have posts authored by the profile owner (`vic_404_kou`); check the `/post/` link target.

Save to `test-fixtures/profile-post.html`.

- [ ] **Step 4: Repeat for likes-modal**

Extract a `[role="dialog"]` block from `like.md` that contains a list of liker `a[href^="/@"]` entries. Save to `test-fixtures/likes-modal.html`.

- [ ] **Step 5: Document the fixtures**

`test-fixtures/README.md`:
```markdown
# Test Fixtures

DOM excerpts captured from live Threads for use in component tests.

| File | Source | Captured | Notes |
|------|--------|----------|-------|
| feed-post.html | context.md (home feed) | 2026-05-30 | First post container |
| profile-post.html | perpage.md (profile page) | 2026-05-30 | First post by profile owner |
| likes-modal.html | like.md (likes dialog) | 2026-05-30 | A `[role="dialog"]` containing likers |
| single-post-comment.html | live capture, see Task 0.4 | TBD | Single-post page comments |
```

- [ ] **Step 6: Commit**

```bash
git add test-fixtures/
git commit -m "test: add DOM fixtures extracted from context/perpage/like"
```

---

### Task 0.4: Manual selector verification (single-post page)

**Files:**
- Modify: `test-fixtures/README.md`, create: `test-fixtures/single-post-comment.html`, `docs/selector-notes.md`

- [ ] **Step 1: Load dev extension on live Threads**

Run: `npm run dev`
Open Chrome → `chrome://extensions` → ensure Developer Mode → confirm Block-All loaded. Navigate to any single-post URL like `/@somebody/post/SOMEID`.

- [ ] **Step 2: Inspect comment containers**

Open DevTools. In the Elements panel, click a comment under the main post. Check whether the ancestor uses `[data-pressable-container="true"]`. Note any other distinguishing attributes (e.g., `data-interactive-id`, indentation classes).

- [ ] **Step 3: Save findings**

`docs/selector-notes.md`:
```markdown
# Selector verification notes

Date: 2026-05-30
Threads version: <copy build hash from `<meta name="version">` if present>

## Single-post comment container
- Selector that matches: <write actual finding>
- Distinguishes from main post: <yes/no, how>
- Per-comment author link pattern: <yes/no, write pattern>

## Localised ARIA labels observed
- 回覆 / Reply: <both? only zh?>
- 讚 / Like: ...
- 轉發 / Repost: ...
- 分享 / Share: ...
- 更多 / More: ...
```

- [ ] **Step 4: Capture a comment DOM excerpt**

Right-click a comment container → Copy → Copy outerHTML. Wrap and save as `test-fixtures/single-post-comment.html`:
```html
<!doctype html><html><body>
<!-- pasted comment container -->
</body></html>
```

- [ ] **Step 5: Update fixtures README**

Set the `single-post-comment.html` row's `Captured` column to `2026-05-30`.

- [ ] **Step 6: Commit**

```bash
git add docs/selector-notes.md test-fixtures/single-post-comment.html test-fixtures/README.md
git commit -m "test: capture single-post comment fixture and selector notes"
```

---

## Phase 1 — Core layer (DOM-free, fully unit-tested)

### Task 1.1: Types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write types**

```typescript
export interface BlockedUser {
  username: string;
  tagIds: string[];
  note: string;
  addedAt: number;
  sourceUrl?: string;
}

export type TagAction = 'fold' | 'hide';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  defaultAction: TagAction;
  builtin: boolean;
}

export interface Settings {
  enabled: boolean;
  defaultActionWhenNoTag: TagAction;
  showHiddenCountBadge: boolean;
  debugMode: boolean;
}

export interface AppState {
  schemaVersion: number;
  blockedUsers: Record<string, BlockedUser>;
  tags: Tag[];
  settings: Settings;
}

export const CURRENT_SCHEMA_VERSION = 1;
```

- [ ] **Step 2: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): define AppState types"
```

---

### Task 1.2: normalizeUsername — RED → GREEN → COMMIT

**Files:**
- Create: `src/core/normalize.ts`, `src/core/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeUsername } from './normalize';

describe('normalizeUsername', () => {
  it('lowercases', () => expect(normalizeUsername('SpamMer123')).toBe('spammer123'));
  it('strips leading @', () => expect(normalizeUsername('@user')).toBe('user'));
  it('trims surrounding whitespace', () => expect(normalizeUsername('  user  ')).toBe('user'));
  it('removes internal whitespace', () => expect(normalizeUsername('user name')).toBe('username'));
  it('handles combined cases', () => expect(normalizeUsername(' @SpamMer 123 ')).toBe('spammer123'));
  it('returns empty string for empty input', () => expect(normalizeUsername('')).toBe(''));
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- normalize`
Expected: FAIL — `normalizeUsername` is not defined.

- [ ] **Step 3: Implement**

```typescript
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\s+/g, '');
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- normalize`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/normalize.ts src/core/normalize.test.ts
git commit -m "feat(core): normalizeUsername with TDD"
```

---

### Task 1.3: Defaults

**Files:**
- Create: `src/core/defaults.ts`, `src/core/defaults.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_TAGS, DEFAULT_SETTINGS, emptyState } from './defaults';
import { CURRENT_SCHEMA_VERSION } from './types';

describe('defaults', () => {
  it('exposes three builtin tags', () => {
    expect(DEFAULT_TAGS).toHaveLength(3);
    expect(DEFAULT_TAGS.every(t => t.builtin)).toBe(true);
    expect(DEFAULT_TAGS.map(t => t.id)).toEqual(['sys:sexism', 'sys:violence', 'sys:gross']);
  });

  it('default settings enable extension and fold-when-no-tag', () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.defaultActionWhenNoTag).toBe('fold');
  });

  it('emptyState carries current schema version, empty users, default tags and settings', () => {
    const s = emptyState();
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(s.blockedUsers).toEqual({});
    expect(s.tags).toEqual(DEFAULT_TAGS);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- defaults`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState, Settings, Tag, CURRENT_SCHEMA_VERSION } from './types';

export const DEFAULT_TAGS: Tag[] = [
  { id: 'sys:sexism',   name: '性別歧視', color: '#d946ef', defaultAction: 'fold', builtin: true },
  { id: 'sys:violence', name: '暴力',     color: '#ef4444', defaultAction: 'fold', builtin: true },
  { id: 'sys:gross',    name: '噁心',     color: '#84cc16', defaultAction: 'fold', builtin: true },
];

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  defaultActionWhenNoTag: 'fold',
  showHiddenCountBadge: true,
  debugMode: false,
};

export function emptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    blockedUsers: {},
    tags: structuredClone(DEFAULT_TAGS),
    settings: { ...DEFAULT_SETTINGS },
  };
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- defaults`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/defaults.ts src/core/defaults.test.ts
git commit -m "feat(core): default tags, settings, emptyState"
```

---

### Task 1.4: Storage wrapper

**Files:**
- Create: `src/core/storage.ts`, `src/core/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadState, saveState, subscribeState, STORAGE_KEY } from './storage';
import { emptyState } from './defaults';

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

beforeEach(() => {
  const storage: Record<string, unknown> = {};
  const listeners: Listener[] = [];
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn((keys: string | string[] | null) => {
          if (keys === null) return Promise.resolve({ ...storage });
          const arr = Array.isArray(keys) ? keys : [keys as string];
          const result: Record<string, unknown> = {};
          for (const k of arr) if (k in storage) result[k] = storage[k];
          return Promise.resolve(result);
        }),
        set: vi.fn((items: Record<string, unknown>) => {
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: storage[k], newValue: v };
            storage[k] = v;
          }
          for (const l of listeners) l(changes, 'local');
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn((l: Listener) => listeners.push(l)),
        removeListener: vi.fn((l: Listener) => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        }),
      },
    },
  };
});

describe('storage', () => {
  it('loadState returns emptyState() when nothing stored', async () => {
    const s = await loadState();
    expect(s).toEqual(emptyState());
  });

  it('saveState round-trips', async () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    await saveState(s);
    const loaded = await loadState();
    expect(loaded.blockedUsers['alice']?.username).toBe('alice');
  });

  it('subscribeState fires on storage change', async () => {
    const s = emptyState();
    const cb = vi.fn();
    const unsubscribe = subscribeState(cb);
    await saveState(s);
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    await saveState(s);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('uses the expected storage key', () => {
    expect(STORAGE_KEY).toBe('block_all_state');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- storage`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState } from './types';
import { emptyState } from './defaults';

export const STORAGE_KEY = 'block_all_state';

export async function loadState(): Promise<AppState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as AppState | undefined;
  if (!stored) return emptyState();
  return stored;
}

export async function saveState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export type StateListener = (next: AppState) => void;

export function subscribeState(listener: StateListener): () => void {
  const wrapped = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    listener(change.newValue as AppState);
  };
  chrome.storage.onChanged.addListener(wrapped);
  return () => chrome.storage.onChanged.removeListener(wrapped);
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- storage`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.ts src/core/storage.test.ts
git commit -m "feat(core): chrome.storage.local wrapper with subscribe"
```

---

### Task 1.5: Matcher

**Files:**
- Create: `src/core/matcher.ts`, `src/core/matcher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { findBlockedUser, resolveAction } from './matcher';
import { emptyState } from './defaults';
import { AppState, BlockedUser } from './types';

function state(users: BlockedUser[]): AppState {
  const s = emptyState();
  for (const u of users) s.blockedUsers[u.username] = u;
  return s;
}

describe('matcher', () => {
  it('returns the blocked user when present', () => {
    const s = state([{ username: 'alice', tagIds: [], note: '', addedAt: 1 }]);
    expect(findBlockedUser(s, 'alice')?.username).toBe('alice');
  });

  it('returns null when missing', () => {
    expect(findBlockedUser(emptyState(), 'nobody')).toBeNull();
  });

  it('returns null when username argument is empty', () => {
    expect(findBlockedUser(emptyState(), '')).toBeNull();
  });

  it('resolveAction returns first matching tag action', () => {
    const s = emptyState();
    s.tags.push({ id: 'user:hide-this', name: 'hide-this', defaultAction: 'hide', builtin: false });
    const u: BlockedUser = { username: 'a', tagIds: ['user:hide-this'], note: '', addedAt: 1 };
    expect(resolveAction(s, u)).toBe('hide');
  });

  it('resolveAction falls back to settings.defaultActionWhenNoTag when no tags', () => {
    const s = emptyState();
    s.settings.defaultActionWhenNoTag = 'hide';
    const u: BlockedUser = { username: 'a', tagIds: [], note: '', addedAt: 1 };
    expect(resolveAction(s, u)).toBe('hide');
  });

  it('resolveAction prefers hide over fold when any tag wants hide', () => {
    const s = emptyState();
    s.tags.push({ id: 'user:hide-it', name: 'h', defaultAction: 'hide', builtin: false });
    const u: BlockedUser = { username: 'a', tagIds: ['sys:sexism', 'user:hide-it'], note: '', addedAt: 1 };
    expect(resolveAction(s, u)).toBe('hide');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- matcher`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState, BlockedUser, TagAction } from './types';

export function findBlockedUser(state: AppState, username: string): BlockedUser | null {
  if (!username) return null;
  return state.blockedUsers[username] ?? null;
}

export function resolveAction(state: AppState, user: BlockedUser): TagAction {
  if (user.tagIds.length === 0) return state.settings.defaultActionWhenNoTag;
  const tagsById = new Map(state.tags.map(t => [t.id, t]));
  const actions = user.tagIds.map(id => tagsById.get(id)?.defaultAction).filter(Boolean) as TagAction[];
  if (actions.length === 0) return state.settings.defaultActionWhenNoTag;
  return actions.includes('hide') ? 'hide' : 'fold';
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- matcher`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/matcher.ts src/core/matcher.test.ts
git commit -m "feat(core): matcher with action resolution"
```

---

### Task 1.6: Export/Import

**Files:**
- Create: `src/core/export.ts`, `src/core/export.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { serializeExport, parseImport, mergeImport, ImportPayload } from './export';
import { emptyState } from './defaults';

describe('export/import', () => {
  it('serializeExport produces JSON with schemaVersion, exportedAt, blockedUsers as array', () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    const json = JSON.parse(serializeExport(s, '0.1.0'));
    expect(json.schemaVersion).toBe(1);
    expect(typeof json.exportedAt).toBe('string');
    expect(json.appVersion).toBe('0.1.0');
    expect(Array.isArray(json.blockedUsers)).toBe(true);
    expect(json.blockedUsers[0].username).toBe('alice');
  });

  it('parseImport rejects wrong schema', () => {
    expect(() => parseImport('{"schemaVersion":999}')).toThrow();
  });

  it('parseImport returns ImportPayload', () => {
    const s = emptyState();
    const json = serializeExport(s, '0.1.0');
    const parsed = parseImport(json);
    expect(parsed.blockedUsers).toEqual([]);
  });

  it('mergeImport in merge mode keeps existing entries and adds new ones, imported wins on conflict', () => {
    const base = emptyState();
    base.blockedUsers['alice'] = { username: 'alice', tagIds: ['sys:sexism'], note: 'orig', addedAt: 1 };
    const incoming: ImportPayload = {
      schemaVersion: 1,
      exportedAt: '2026-05-30T00:00:00.000Z',
      appVersion: '0.1.0',
      blockedUsers: [
        { username: 'alice', tagIds: ['sys:violence'], note: 'new', addedAt: 2 },
        { username: 'bob', tagIds: [], note: '', addedAt: 3 },
      ],
      tags: base.tags,
      settings: base.settings,
    };
    const merged = mergeImport(base, incoming, { mode: 'merge' });
    expect(merged.blockedUsers['alice']?.note).toBe('new');
    expect(merged.blockedUsers['alice']?.tagIds).toEqual(['sys:violence']);
    expect(merged.blockedUsers['bob']).toBeTruthy();
  });

  it('mergeImport in replace mode wipes existing blockedUsers', () => {
    const base = emptyState();
    base.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    const incoming: ImportPayload = {
      schemaVersion: 1,
      exportedAt: 'x', appVersion: '0.1.0',
      blockedUsers: [{ username: 'bob', tagIds: [], note: '', addedAt: 2 }],
      tags: base.tags,
      settings: base.settings,
    };
    const merged = mergeImport(base, incoming, { mode: 'replace' });
    expect(merged.blockedUsers['alice']).toBeUndefined();
    expect(merged.blockedUsers['bob']).toBeTruthy();
  });

  it('mergeImport suffixes custom tag id collisions with different names', () => {
    const base = emptyState();
    base.tags.push({ id: 'user:abc', name: 'orig', defaultAction: 'fold', builtin: false });
    const incoming: ImportPayload = {
      schemaVersion: 1,
      exportedAt: 'x', appVersion: '0.1.0',
      blockedUsers: [],
      tags: [...base.tags.slice(0, 3), { id: 'user:abc', name: 'other', defaultAction: 'fold', builtin: false }],
      settings: base.settings,
    };
    const merged = mergeImport(base, incoming, { mode: 'merge' });
    expect(merged.tags.find(t => t.id === 'user:abc_imported')?.name).toBe('other');
    expect(merged.tags.find(t => t.id === 'user:abc')?.name).toBe('orig');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- export`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState, BlockedUser, Tag, Settings, CURRENT_SCHEMA_VERSION } from './types';

export interface ImportPayload {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  blockedUsers: BlockedUser[];
  tags: Tag[];
  settings: Settings;
}

export function serializeExport(state: AppState, appVersion: string): string {
  const payload: ImportPayload = {
    schemaVersion: state.schemaVersion,
    exportedAt: new Date().toISOString(),
    appVersion,
    blockedUsers: Object.values(state.blockedUsers),
    tags: state.tags,
    settings: state.settings,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseImport(json: string): ImportPayload {
  const data = JSON.parse(json);
  if (data?.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion ${data?.schemaVersion}`);
  }
  if (!Array.isArray(data.blockedUsers)) throw new Error('blockedUsers must be an array');
  if (!Array.isArray(data.tags)) throw new Error('tags must be an array');
  if (!data.settings) throw new Error('settings missing');
  return data as ImportPayload;
}

export interface MergeOptions {
  mode: 'merge' | 'replace';
}

export function mergeImport(base: AppState, incoming: ImportPayload, opts: MergeOptions): AppState {
  const next: AppState = {
    schemaVersion: base.schemaVersion,
    blockedUsers: opts.mode === 'replace' ? {} : { ...base.blockedUsers },
    tags: [...base.tags],
    settings: { ...base.settings },
  };

  for (const u of incoming.blockedUsers) {
    next.blockedUsers[u.username] = u;
  }

  const existingById = new Map(next.tags.map(t => [t.id, t]));
  for (const t of incoming.tags) {
    if (t.builtin) continue;
    const existing = existingById.get(t.id);
    if (!existing) {
      next.tags.push(t);
      existingById.set(t.id, t);
    } else if (existing.name !== t.name) {
      const renamed = { ...t, id: `${t.id}_imported` };
      next.tags.push(renamed);
      existingById.set(renamed.id, renamed);
    }
  }

  return next;
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- export`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/export.ts src/core/export.test.ts
git commit -m "feat(core): export/import with merge & replace modes"
```

---

## Phase 2 — Content script (fold path)

### Task 2.1: Selectors

**Files:**
- Create: `src/content/selectors.ts`

- [ ] **Step 1: Write selectors**

```typescript
export const SELECTORS = {
  postContainer:    '[data-pressable-container="true"]',
  authorPostLink:   'a[href*="/post/"]',
  anyUserLink:      'a[href^="/@"]',
  likesDialog:      '[role="dialog"]',
} as const;

export const ARIA_LABELS = {
  reply:  ['回覆', 'Reply'],
  like:   ['讚', 'Like'],
  repost: ['轉發', 'Repost'],
  share:  ['分享', 'Share'],
  more:   ['更多', 'More'],
} as const;

export const STATE_ATTR = 'data-block-all-state';
export const HANDLED_ATTR = 'data-block-all-handled';
export const BANNER_ATTR = 'data-block-all-banner';
export const ORIGINAL_ATTR = 'data-block-all-original';
```

- [ ] **Step 2: Commit**

```bash
git add src/content/selectors.ts
git commit -m "feat(content): centralize Threads DOM selectors"
```

---

### Task 2.2: extractAuthorUsername

**Files:**
- Create: `src/content/extractor.ts`, `src/content/extractor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { extractAuthorUsername, extractLikersFromDialog } from './extractor';
import { mountFixture } from '../test-utils/fixtures';

beforeEach(() => { document.body.innerHTML = ''; });

describe('extractAuthorUsername', () => {
  it('returns the author from a feed post container', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    expect(container).toBeTruthy();
    const username = extractAuthorUsername(container);
    expect(username).toMatch(/^[a-z0-9_.]+$/);
  });

  it('returns the author from a profile post container', () => {
    const host = mountFixture('profile-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const username = extractAuthorUsername(container);
    expect(username).toBe('vic_404_kou');
  });

  it('returns null when no /post/ link present', () => {
    const div = document.createElement('div');
    expect(extractAuthorUsername(div)).toBeNull();
  });
});

describe('extractLikersFromDialog', () => {
  it('extracts deduplicated, normalized liker usernames', () => {
    const host = mountFixture('likes-modal.html');
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const likers = extractLikersFromDialog(dialog);
    expect(likers.length).toBeGreaterThan(0);
    expect(new Set(likers).size).toBe(likers.length);
    expect(likers.every(u => /^[a-z0-9_.]+$/.test(u))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- extractor`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { normalizeUsername } from '@core/normalize';
import { SELECTORS } from './selectors';

export function extractAuthorUsername(container: HTMLElement): string | null {
  const link = container.querySelector<HTMLAnchorElement>(SELECTORS.authorPostLink);
  if (!link) return null;
  const href = link.getAttribute('href') ?? '';
  const match = href.match(/^\/@([^/]+)\/post\//);
  return match ? normalizeUsername(match[1]) : null;
}

export function extractLikersFromDialog(dialog: HTMLElement): string[] {
  const anchors = dialog.querySelectorAll<HTMLAnchorElement>(SELECTORS.anyUserLink);
  const out = new Set<string>();
  for (const a of anchors) {
    const href = a.getAttribute('href') ?? '';
    if (href.includes('/post/')) continue;
    const match = href.match(/^\/@([^/?#]+)/);
    if (!match) continue;
    out.add(normalizeUsername(match[1]));
  }
  return Array.from(out);
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- extractor`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/extractor.ts src/content/extractor.test.ts
git commit -m "feat(content): extract author + likers from Threads DOM"
```

---

### Task 2.3: Fold UI (Shadow DOM banner)

**Files:**
- Create: `src/content/fold-ui.ts`, `src/content/fold-ui.test.ts`, `src/ui/styles/banner.css`

- [ ] **Step 1: Write banner CSS**

`src/ui/styles/banner.css`:
```css
:host { all: initial; display: block; font-family: -apple-system, sans-serif; }
.banner {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: #f4f4f5; border-radius: 12px;
  border: 1px solid #e4e4e7; color: #18181b;
}
.icon { font-size: 20px; }
.info { flex: 1; min-width: 0; }
.title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
.tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
.tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--color, #71717a); color: white;
}
.note { font-size: 12px; color: #52525b; }
.expand {
  font-size: 12px; padding: 6px 12px;
  border: 1px solid #d4d4d8; border-radius: 8px; background: white;
  cursor: pointer;
}
.expand:hover { background: #fafafa; }
```

- [ ] **Step 2: Write the failing test**

`src/content/fold-ui.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { foldContainer, unfoldContainer, hideContainer } from './fold-ui';
import { mountFixture } from '../test-utils/fixtures';

beforeEach(() => { document.body.innerHTML = ''; });

describe('fold-ui', () => {
  it('foldContainer wraps original content, marks state, injects banner shadow root', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    foldContainer(container, {
      username: 'moonowkk',
      tags: [{ name: '性別歧視', color: '#d946ef' }],
      note: '測試備註',
    });
    expect(container.getAttribute('data-block-all-state')).toBe('folded');
    const banner = container.querySelector('[data-block-all-banner]');
    expect(banner?.shadowRoot).toBeTruthy();
    expect(banner!.shadowRoot!.querySelector('.title')?.textContent).toContain('moonowkk');
    expect(container.querySelector('[data-block-all-original]')?.hasAttribute('hidden')).toBe(true);
  });

  it('unfoldContainer restores original visibility', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    foldContainer(container, { username: 'x', tags: [], note: '' });
    unfoldContainer(container);
    expect(container.getAttribute('data-block-all-state')).toBe('expanded');
    expect(container.querySelector('[data-block-all-original]')?.hasAttribute('hidden')).toBe(false);
  });

  it('hideContainer sets display none and marks handled', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    hideContainer(container);
    expect(container.style.display).toBe('none');
    expect(container.getAttribute('data-block-all-handled')).toBe('hidden');
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm test -- fold-ui`
Expected: FAIL.

- [ ] **Step 4: Implement**

`src/content/fold-ui.ts`:
```typescript
import bannerCss from '@ui/styles/banner.css?raw';
import { STATE_ATTR, HANDLED_ATTR, BANNER_ATTR, ORIGINAL_ATTR } from './selectors';

export interface FoldPayload {
  username: string;
  tags: { name: string; color?: string }[];
  note: string;
}

export function foldContainer(container: HTMLElement, payload: FoldPayload): void {
  if (container.getAttribute(STATE_ATTR) === 'folded') return;

  const original = document.createElement('div');
  original.setAttribute(ORIGINAL_ATTR, '');
  original.hidden = true;
  while (container.firstChild) original.appendChild(container.firstChild);

  const bannerHost = document.createElement('div');
  bannerHost.setAttribute(BANNER_ATTR, '');
  const shadow = bannerHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = renderBanner(payload);
  shadow.adoptedStyleSheets = [createStyleSheet(bannerCss)];

  const expandBtn = shadow.querySelector<HTMLButtonElement>('.expand');
  expandBtn?.addEventListener('click', () => unfoldContainer(container));

  container.appendChild(bannerHost);
  container.appendChild(original);
  container.setAttribute(STATE_ATTR, 'folded');
  container.setAttribute(HANDLED_ATTR, 'folded');
}

export function unfoldContainer(container: HTMLElement): void {
  const original = container.querySelector<HTMLElement>(`[${ORIGINAL_ATTR}]`);
  if (original) original.hidden = false;
  container.setAttribute(STATE_ATTR, 'expanded');
}

export function hideContainer(container: HTMLElement): void {
  container.style.display = 'none';
  container.setAttribute(HANDLED_ATTR, 'hidden');
}

function renderBanner(p: FoldPayload): string {
  const tagsHtml = p.tags
    .map(t => `<span class="tag" style="--color:${escapeAttr(t.color ?? '#71717a')}">${escapeHtml(t.name)}</span>`)
    .join('');
  const noteHtml = p.note ? `<div class="note">${escapeHtml(p.note)}</div>` : '';
  return `
    <div class="banner">
      <span class="icon">🚫</span>
      <div class="info">
        <div class="title">已封鎖 @${escapeHtml(p.username)}</div>
        <div class="tags">${tagsHtml}</div>
        ${noteHtml}
      </div>
      <button class="expand">展開觀看 ▼</button>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s); }

function createStyleSheet(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}
```

- [ ] **Step 5: Run test and verify pass**

Run: `npm test -- fold-ui`
Expected: 3/3 pass.

If jsdom lacks `CSSStyleSheet.replaceSync` or `adoptedStyleSheets`, change `createStyleSheet` path: append a `<style>` element inside the shadow root with the CSS text instead. Update the test if needed to query the `<style>` node.

- [ ] **Step 6: Commit**

```bash
git add src/content/fold-ui.ts src/content/fold-ui.test.ts src/ui/styles/banner.css
git commit -m "feat(content): Shadow DOM fold banner + hide path"
```

---

### Task 2.4: Observer with rAF queue

**Files:**
- Create: `src/content/observer.ts`, `src/content/observer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createProcessor } from './observer';
import { mountFixture } from '../test-utils/fixtures';
import { emptyState } from '@core/defaults';
import { HANDLED_ATTR } from './selectors';

beforeEach(() => { document.body.innerHTML = ''; });

describe('observer processor', () => {
  it('processes a container and marks it handled', async () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const state = emptyState();
    state.blockedUsers['moonowkk'] = { username: 'moonowkk', tagIds: ['sys:sexism'], note: 'x', addedAt: 0 };

    const onFold = vi.fn();
    const p = createProcessor(() => state, { onFold, onHide: vi.fn() });
    p.enqueue(container);
    await p.flushForTest();

    expect(container.getAttribute(HANDLED_ATTR)).toBe('folded');
    expect(onFold).toHaveBeenCalledTimes(1);
  });

  it('skips already-handled containers', async () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    container.setAttribute(HANDLED_ATTR, 'folded');
    const onFold = vi.fn();
    const p = createProcessor(() => emptyState(), { onFold, onHide: vi.fn() });
    p.enqueue(container);
    await p.flushForTest();
    expect(onFold).not.toHaveBeenCalled();
  });

  it('does nothing when settings.enabled is false', async () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const state = emptyState();
    state.settings.enabled = false;
    state.blockedUsers['moonowkk'] = { username: 'moonowkk', tagIds: [], note: '', addedAt: 0 };
    const onFold = vi.fn();
    const p = createProcessor(() => state, { onFold, onHide: vi.fn() });
    p.enqueue(container);
    await p.flushForTest();
    expect(onFold).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- observer`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState } from '@core/types';
import { findBlockedUser, resolveAction } from '@core/matcher';
import { extractAuthorUsername } from './extractor';
import { foldContainer, hideContainer } from './fold-ui';
import { SELECTORS, HANDLED_ATTR } from './selectors';

export interface ProcessorHooks {
  onFold?: (container: HTMLElement, username: string) => void;
  onHide?: (container: HTMLElement, username: string) => void;
}

const BATCH_SIZE = 50;

export function createProcessor(getState: () => AppState, hooks: ProcessorHooks = {}) {
  const queue = new Set<HTMLElement>();
  const handled = new WeakSet<HTMLElement>();
  let scheduled = false;

  function processOne(container: HTMLElement, state: AppState): void {
    if (handled.has(container) || container.hasAttribute(HANDLED_ATTR)) return;
    const username = extractAuthorUsername(container);
    if (!username) return;
    const user = findBlockedUser(state, username);
    if (!user) return;
    const action = resolveAction(state, user);
    const tags = user.tagIds
      .map(id => state.tags.find(t => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map(t => ({ name: t.name, color: t.color }));
    if (action === 'hide') {
      hideContainer(container);
      hooks.onHide?.(container, username);
    } else {
      foldContainer(container, { username, tags, note: user.note });
      hooks.onFold?.(container, username);
    }
    handled.add(container);
  }

  function flush(): void {
    const state = getState();
    if (!state.settings.enabled) {
      queue.clear();
      scheduled = false;
      return;
    }
    let n = 0;
    for (const container of queue) {
      queue.delete(container);
      processOne(container, state);
      if (++n >= BATCH_SIZE) break;
    }
    if (queue.size > 0) schedule();
    else scheduled = false;
  }

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    const cb = () => flush();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(cb, { timeout: 100 });
    else requestAnimationFrame(cb);
  }

  return {
    enqueue(container: HTMLElement): void {
      queue.add(container);
      schedule();
    },
    enqueueAll(root: ParentNode): void {
      root.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(el => this.enqueue(el));
    },
    flushForTest(): Promise<void> {
      return new Promise(resolve => {
        const drain = () => { flush(); if (queue.size === 0) resolve(); else queueMicrotask(drain); };
        drain();
      });
    },
  };
}

export function attachObserver(target: Node, onMutated: (el: HTMLElement) => void): MutationObserver {
  const observer = new MutationObserver(records => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(SELECTORS.postContainer)) onMutated(node);
        node.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(onMutated);
      }
    }
  });
  observer.observe(target, { subtree: true, childList: true });
  return observer;
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- observer`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/observer.ts src/content/observer.test.ts
git commit -m "feat(content): rAF-scheduled processor + MutationObserver attach"
```

---

### Task 2.5: Wire content script entry

**Files:**
- Modify: `entrypoints/content.ts`

- [ ] **Step 1: Replace the stub**

```typescript
import { loadState, subscribeState } from '@core/storage';
import { AppState } from '@core/types';
import { attachObserver, createProcessor } from '@content/observer';

export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  runAt: 'document_idle',
  async main() {
    let state: AppState = await loadState();
    const processor = createProcessor(() => state);
    processor.enqueueAll(document);
    attachObserver(document.body, el => processor.enqueue(el));
    subscribeState(next => { state = next; processor.enqueueAll(document); });
    if (state.settings.debugMode) console.log('[block-all] content loaded', state);
  },
});
```

- [ ] **Step 2: Build to confirm types**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. In the loaded Chrome profile, open DevTools on `chrome-extension://<id>/_generated_background_page.html` or any Threads page, then in the page console run:

```javascript
chrome.storage.local.set({
  block_all_state: {
    schemaVersion: 1,
    blockedUsers: { moonowkk: { username: 'moonowkk', tagIds: ['sys:sexism'], note: 'smoke test', addedAt: Date.now() } },
    tags: [{ id: 'sys:sexism', name: '性別歧視', color: '#d946ef', defaultAction: 'fold', builtin: true }],
    settings: { enabled: true, defaultActionWhenNoTag: 'fold', showHiddenCountBadge: true, debugMode: true },
  },
});
```

Reload the Threads tab. Expected: any post by `moonowkk` shows the fold banner; clicking 「展開觀看」 reveals the original.

- [ ] **Step 4: Commit**

```bash
git add entrypoints/content.ts
git commit -m "feat(content): wire observer + processor into content script entry"
```

---

## Phase 3 — Quick block button

### Task 3.1: Per-post block button

**Files:**
- Create: `src/content/block-button.ts`, `src/content/block-button.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { injectBlockButton } from './block-button';
import { mountFixture } from '../test-utils/fixtures';

beforeEach(() => { document.body.innerHTML = ''; });

describe('injectBlockButton', () => {
  it('adds a button child marked with data-block-all-quick-block', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    injectBlockButton(container, 'moonowkk', vi.fn());
    expect(container.querySelector('[data-block-all-quick-block]')).toBeTruthy();
  });

  it('clicking the button calls the handler with the username', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    const onClick = vi.fn();
    injectBlockButton(container, 'moonowkk', onClick);
    container.querySelector<HTMLButtonElement>('[data-block-all-quick-block]')!.click();
    expect(onClick).toHaveBeenCalledWith('moonowkk');
  });

  it('does not double-inject', () => {
    const host = mountFixture('feed-post.html');
    const container = host.querySelector<HTMLElement>('[data-pressable-container="true"]')!;
    injectBlockButton(container, 'moonowkk', vi.fn());
    injectBlockButton(container, 'moonowkk', vi.fn());
    expect(container.querySelectorAll('[data-block-all-quick-block]').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- block-button`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
const ATTR = 'data-block-all-quick-block';

export function injectBlockButton(
  container: HTMLElement,
  username: string,
  onClick: (username: string) => void,
): void {
  if (container.querySelector(`[${ATTR}]`)) return;
  const btn = document.createElement('button');
  btn.setAttribute(ATTR, '');
  btn.title = `快速封鎖 @${username}`;
  btn.textContent = '🚫';
  btn.style.cssText =
    'position:absolute;top:8px;right:8px;z-index:10;background:transparent;border:0;cursor:pointer;font-size:16px;opacity:0.5;';
  btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
  btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.5'));
  btn.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); onClick(username); });
  const cs = getComputedStyle(container);
  if (cs.position === 'static') container.style.position = 'relative';
  container.appendChild(btn);
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- block-button`
Expected: 3/3 pass.

- [ ] **Step 5: Wire into content entry**

Edit `entrypoints/content.ts` to call `injectBlockButton` from the processor's enqueue path. Add to the `createProcessor` block:

Modify `entrypoints/content.ts` `main()` body — after `processor.enqueueAll(document)`, add a second walk to inject buttons:

```typescript
import { injectBlockButton } from '@content/block-button';
import { extractAuthorUsername } from '@content/extractor';
import { SELECTORS } from '@content/selectors';
import { saveState } from '@core/storage';
import { normalizeUsername } from '@core/normalize';

function decorate(container: HTMLElement) {
  const u = extractAuthorUsername(container);
  if (!u) return;
  injectBlockButton(container, u, async name => {
    const username = normalizeUsername(name);
    if (state.blockedUsers[username]) return;
    state.blockedUsers[username] = { username, tagIds: [], note: '', addedAt: Date.now(), sourceUrl: location.href };
    await saveState(state);
  });
}

// after enqueueAll:
document.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(decorate);
// inside attachObserver callback (after enqueue):
attachObserver(document.body, el => { processor.enqueue(el); decorate(el); });
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/content/block-button.ts src/content/block-button.test.ts entrypoints/content.ts
git commit -m "feat(content): per-post quick-block button"
```

---

## Phase 4 — Audit modal + bulk triggers

### Task 4.1: Audit modal component

**Files:**
- Create: `src/ui/audit-modal.ts`, `src/ui/audit-modal.test.ts`, `src/ui/styles/modal.css`

- [ ] **Step 1: Write modal CSS**

`src/ui/styles/modal.css`:
```css
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 2147483647;
  font-family: -apple-system, sans-serif;
}
.modal {
  background: white; border-radius: 12px; max-width: 720px; width: 90vw;
  max-height: 85vh; display: flex; flex-direction: column; color: #18181b;
}
.modal-header { padding: 16px; border-bottom: 1px solid #e4e4e7; display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 16px; overflow-y: auto; flex: 1; }
.modal-footer { padding: 16px; border-top: 1px solid #e4e4e7; display: flex; justify-content: flex-end; gap: 8px; }
.bulk-controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; padding: 8px; background: #fafafa; border-radius: 8px; }
.row { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-bottom: 1px solid #f4f4f5; }
.row input[type="text"] { flex: 1; padding: 4px 8px; border: 1px solid #d4d4d8; border-radius: 4px; font-size: 13px; }
.row .username { font-weight: 500; min-width: 140px; }
.row .tags { display: flex; gap: 4px; min-width: 200px; }
.row .tags button { font-size: 11px; padding: 2px 6px; border-radius: 999px; border: 1px solid #d4d4d8; background: white; cursor: pointer; }
.row .tags button[data-selected] { background: var(--color, #71717a); color: white; border-color: transparent; }
.row .warn { color: #d97706; font-size: 12px; }
.primary { padding: 8px 16px; background: #18181b; color: white; border: 0; border-radius: 8px; cursor: pointer; font-size: 14px; }
.secondary { padding: 8px 16px; background: white; color: #18181b; border: 1px solid #d4d4d8; border-radius: 8px; cursor: pointer; font-size: 14px; }
.close { background: transparent; border: 0; font-size: 20px; cursor: pointer; }
```

- [ ] **Step 2: Write the failing test**

`src/ui/audit-modal.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openAuditModal, AuditRow } from './audit-modal';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('audit-modal', () => {
  it('renders one row per username, all preselected', () => {
    const state = emptyState();
    const usernames = ['alice', 'bob', 'charlie'];
    openAuditModal({ state, usernames, mountTo: document.body, useShadow: false, onSave: vi.fn(), onCancel: vi.fn() });
    const rows = document.querySelectorAll('.row');
    expect(rows.length).toBe(3);
    rows.forEach(r => expect(r.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true));
  });

  it('marks already-blocked users with a warning indicator', () => {
    const state = emptyState();
    state.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: 'prev', addedAt: 1 };
    openAuditModal({ state, usernames: ['alice', 'bob'], mountTo: document.body, useShadow: false, onSave: vi.fn(), onCancel: vi.fn() });
    const aliceRow = Array.from(document.querySelectorAll('.row')).find(r => r.textContent?.includes('alice'))!;
    expect(aliceRow.querySelector('.warn')).toBeTruthy();
  });

  it('save invokes onSave with selected rows and chosen tag ids', () => {
    const state = emptyState();
    const onSave = vi.fn();
    openAuditModal({ state, usernames: ['alice', 'bob'], mountTo: document.body, useShadow: false, onSave, onCancel: vi.fn() });
    // deselect bob
    const bobBox = Array.from(document.querySelectorAll<HTMLInputElement>('.row input[type="checkbox"]'))[1];
    bobBox.checked = false;
    bobBox.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.primary')!.click();
    expect(onSave).toHaveBeenCalledTimes(1);
    const rows: AuditRow[] = onSave.mock.calls[0][0];
    expect(rows.map(r => r.username)).toEqual(['alice']);
  });

  it('cancel triggers onCancel and removes the modal', () => {
    const onCancel = vi.fn();
    openAuditModal({ state: emptyState(), usernames: ['alice'], mountTo: document.body, useShadow: false, onSave: vi.fn(), onCancel });
    document.querySelector<HTMLButtonElement>('.secondary')!.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm test -- audit-modal`
Expected: FAIL.

- [ ] **Step 4: Implement**

`src/ui/audit-modal.ts`:
```typescript
import { html, render } from 'lit-html';
import { AppState, Tag } from '@core/types';
import { normalizeUsername } from '@core/normalize';
import modalCss from './styles/modal.css?raw';

export interface AuditRow {
  username: string;
  tagIds: string[];
  note: string;
  alreadyBlocked: boolean;
}

export interface AuditModalOptions {
  state: AppState;
  usernames: string[];
  mountTo: HTMLElement;
  useShadow: boolean;
  onSave: (rows: AuditRow[]) => void;
  onCancel: () => void;
}

export function openAuditModal(opts: AuditModalOptions): { close(): void } {
  const seen = new Set<string>();
  const rows: AuditRow[] = [];
  for (const u of opts.usernames) {
    const n = normalizeUsername(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const existing = opts.state.blockedUsers[n];
    rows.push({
      username: n,
      tagIds: existing ? [...existing.tagIds] : [],
      note: existing ? existing.note : '',
      alreadyBlocked: Boolean(existing),
    });
  }
  const selected = new Set<string>(rows.map(r => r.username));
  let bulkTagIds = new Set<string>();
  let bulkNote = '';

  const host = document.createElement('div');
  let root: ShadowRoot | HTMLElement = host;
  if (opts.useShadow) {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = modalCss; shadow.appendChild(style);
    root = shadow;
  } else {
    const style = document.createElement('style'); style.textContent = modalCss; host.appendChild(style);
  }
  opts.mountTo.appendChild(host);

  function close() { host.remove(); }

  function template() {
    const saveCount = selected.size;
    return html`
      <div class="modal-backdrop" @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) cancel(); }}>
        <div class="modal" @click=${(e: MouseEvent) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>審核 — 擷取到 ${rows.length} 個 ID</h3>
            <button class="close" @click=${cancel}>×</button>
          </div>
          <div class="modal-body">
            <div class="bulk-controls">
              <label><input type="checkbox" .checked=${selected.size === rows.length} @change=${toggleAll}> 全選</label>
              <span>套用到勾選:</span>
              ${opts.state.tags.map(t => html`
                <button
                  data-selected=${bulkTagIds.has(t.id) ? '' : undefined}
                  style="--color:${t.color ?? '#71717a'}"
                  @click=${() => { bulkTagIds.has(t.id) ? bulkTagIds.delete(t.id) : bulkTagIds.add(t.id); applyBulk(); rerender(); }}
                >${t.name}</button>
              `)}
              <input type="text" placeholder="套用備註" @input=${(e: Event) => { bulkNote = (e.target as HTMLInputElement).value; applyBulk(); rerender(); }}>
            </div>
            ${rows.map(r => rowTemplate(r))}
          </div>
          <div class="modal-footer">
            <button class="secondary" @click=${cancel}>取消</button>
            <button class="primary" @click=${save}>儲存 ${saveCount} 筆</button>
          </div>
        </div>
      </div>
    `;
  }

  function rowTemplate(r: AuditRow) {
    return html`
      <div class="row">
        <input type="checkbox" .checked=${selected.has(r.username)} @change=${(e: Event) => {
          (e.target as HTMLInputElement).checked ? selected.add(r.username) : selected.delete(r.username);
          rerender();
        }}>
        <span class="username">@${r.username}</span>
        ${r.alreadyBlocked ? html`<span class="warn">⚠ 已在黑名單</span>` : ''}
        <span class="tags">
          ${opts.state.tags.map((t: Tag) => html`
            <button
              data-selected=${r.tagIds.includes(t.id) ? '' : undefined}
              style="--color:${t.color ?? '#71717a'}"
              @click=${() => {
                const i = r.tagIds.indexOf(t.id);
                if (i >= 0) r.tagIds.splice(i, 1); else r.tagIds.push(t.id);
                rerender();
              }}
            >${t.name}</button>
          `)}
        </span>
        <input type="text" placeholder="備註" .value=${r.note} @input=${(e: Event) => { r.note = (e.target as HTMLInputElement).value; }}>
      </div>
    `;
  }

  function toggleAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) for (const r of rows) selected.add(r.username);
    else selected.clear();
    rerender();
  }

  function applyBulk() {
    for (const r of rows) {
      if (!selected.has(r.username)) continue;
      for (const id of bulkTagIds) if (!r.tagIds.includes(id)) r.tagIds.push(id);
      if (bulkNote) r.note = bulkNote;
    }
  }

  function save() {
    const picked = rows.filter(r => selected.has(r.username));
    opts.onSave(picked);
    close();
  }

  function cancel() { opts.onCancel(); close(); }

  function rerender() { render(template(), root as unknown as HTMLElement); }
  rerender();

  const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
  document.addEventListener('keydown', escHandler);
  const origClose = close;
  return {
    close() { document.removeEventListener('keydown', escHandler); origClose(); },
  };
}
```

- [ ] **Step 5: Run test and verify pass**

Run: `npm test -- audit-modal`
Expected: 4/4 pass. If lit-html's render target type complains in jsdom on ShadowRoot, adjust the cast to `(root as DocumentFragment)`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/audit-modal.ts src/ui/audit-modal.test.ts src/ui/styles/modal.css
git commit -m "feat(ui): reusable audit modal with bulk controls"
```

---

### Task 4.2: Bulk-extraction triggers (comments + likers)

**Files:**
- Create: `src/content/triggers.ts`
- Modify: `entrypoints/content.ts`

- [ ] **Step 1: Implement triggers**

`src/content/triggers.ts`:
```typescript
import { SELECTORS } from './selectors';
import { extractAuthorUsername, extractLikersFromDialog } from './extractor';

const COMMENT_BTN_ID = 'block-all-extract-comments';
const LIKES_BTN_ID = 'block-all-extract-likers';

export function maybeInjectCommentButton(onClick: (usernames: string[]) => void): void {
  const match = location.pathname.match(/^\/@([^/]+)\/post\/([^/]+)/);
  if (!match) {
    document.getElementById(COMMENT_BTN_ID)?.remove();
    return;
  }
  if (document.getElementById(COMMENT_BTN_ID)) return;

  const pageAuthor = match[1].toLowerCase();
  const btn = document.createElement('button');
  btn.id = COMMENT_BTN_ID;
  btn.textContent = '📋 擷取本頁留言者';
  btn.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:2147483646;padding:10px 14px;border-radius:999px;border:0;background:#18181b;color:white;cursor:pointer;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
  btn.addEventListener('click', () => {
    const usernames: string[] = [];
    document.querySelectorAll<HTMLElement>(SELECTORS.postContainer).forEach(c => {
      const u = extractAuthorUsername(c);
      if (u && u !== pageAuthor) usernames.push(u);
    });
    onClick(Array.from(new Set(usernames)));
  });
  document.body.appendChild(btn);
}

export function attachLikesDialogTrigger(onClick: (usernames: string[]) => void): void {
  const observer = new MutationObserver(() => {
    document.querySelectorAll<HTMLElement>(SELECTORS.likesDialog).forEach(dialog => {
      if (dialog.querySelector(`#${LIKES_BTN_ID}`)) return;
      const heading = Array.from(dialog.querySelectorAll<HTMLElement>('h1,h2,div')).find(e =>
        /讚|Likes/.test(e.textContent ?? ''),
      );
      if (!heading) return;
      const btn = document.createElement('button');
      btn.id = LIKES_BTN_ID;
      btn.textContent = '📋 擷取按讚者';
      btn.style.cssText = 'margin-left:8px;padding:4px 8px;border-radius:8px;border:1px solid #d4d4d8;background:white;cursor:pointer;font-size:12px;';
      btn.addEventListener('click', () => onClick(extractLikersFromDialog(dialog)));
      heading.appendChild(btn);
    });
  });
  observer.observe(document.body, { subtree: true, childList: true });
}
```

- [ ] **Step 2: Hook into content entry**

Update `entrypoints/content.ts` `main()` to call:
```typescript
import { openAuditModal } from '@ui/audit-modal';
import { maybeInjectCommentButton, attachLikesDialogTrigger } from '@content/triggers';

function openAuditFor(usernames: string[]) {
  if (usernames.length === 0) return;
  const host = document.createElement('div');
  document.body.appendChild(host);
  openAuditModal({
    state, usernames, mountTo: host, useShadow: true,
    onSave: async rows => {
      for (const r of rows) {
        state.blockedUsers[r.username] = {
          username: r.username, tagIds: r.tagIds, note: r.note,
          addedAt: state.blockedUsers[r.username]?.addedAt ?? Date.now(),
          sourceUrl: location.href,
        };
      }
      await saveState(state);
    },
    onCancel: () => host.remove(),
  });
}

maybeInjectCommentButton(openAuditFor);
attachLikesDialogTrigger(openAuditFor);

// re-check button on SPA navigation
const popHandler = () => maybeInjectCommentButton(openAuditFor);
window.addEventListener('popstate', popHandler);
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/content/triggers.ts entrypoints/content.ts
git commit -m "feat(content): comment & liker bulk-extraction triggers"
```

---

## Phase 5 — Popup

### Task 5.1: Popup UI

**Files:**
- Modify: `entrypoints/popup/index.html`, `entrypoints/popup/main.ts`

- [ ] **Step 1: Write popup markup**

`entrypoints/popup/index.html`:
```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Block-All</title>
  <style>
    body { width: 280px; margin: 0; padding: 12px; font-family: -apple-system, sans-serif; color: #18181b; }
    h1 { font-size: 14px; margin: 0 0 8px; }
    .row { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; font-size: 13px; }
    .stat { font-size: 12px; color: #71717a; }
    button { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #d4d4d8; background: white; cursor: pointer; font-size: 13px; margin-top: 6px; }
    button:disabled { color: #a1a1aa; cursor: not-allowed; }
    a { display: block; text-align: center; margin-top: 8px; font-size: 12px; color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Write popup logic**

`entrypoints/popup/main.ts`:
```typescript
import { loadState, saveState, subscribeState } from '@core/storage';
import { AppState } from '@core/types';

let state: AppState;

async function init() {
  state = await loadState();
  render();
  subscribeState(next => { state = next; render(); });
}

function render() {
  const app = document.getElementById('app')!;
  const blockedCount = Object.keys(state.blockedUsers).length;
  app.innerHTML = `
    <h1>Block-All for Threads</h1>
    <div class="row">
      <span>啟用</span>
      <input id="enabled" type="checkbox" ${state.settings.enabled ? 'checked' : ''}>
    </div>
    <div class="stat">已封鎖 ${blockedCount} 個帳號</div>
    <button id="open-options">開啟完整管理頁</button>
    <a href="#" id="open-docs">說明</a>
  `;
  document.getElementById('enabled')!.addEventListener('change', async e => {
    state.settings.enabled = (e.target as HTMLInputElement).checked;
    await saveState(state);
  });
  document.getElementById('open-options')!.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

init();
```

- [ ] **Step 3: Build + manual check**

Run: `npm run build`
Then `npm run dev`. Click the toolbar icon. Expected: popup shows the enable toggle and current block count.

- [ ] **Step 4: Commit**

```bash
git add entrypoints/popup
git commit -m "feat(popup): master toggle + stats + options link"
```

---

## Phase 6 — Options page

### Task 6.1: Tabbed shell

**Files:**
- Modify: `entrypoints/options/index.html`, `entrypoints/options/main.ts`
- Create: `entrypoints/options/options.css`

- [ ] **Step 1: Write shell HTML**

`entrypoints/options/index.html`:
```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Block-All Options</title>
  <link rel="stylesheet" href="./options.css">
</head>
<body>
  <header>
    <h1>Block-All for Threads</h1>
    <nav id="tabs">
      <button data-tab="blocklist" class="active">黑名單</button>
      <button data-tab="tags">標籤</button>
      <button data-tab="settings">偏好設定</button>
      <button data-tab="iox">匯入 / 匯出</button>
    </nav>
  </header>
  <main id="main"></main>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Write CSS**

`entrypoints/options/options.css`:
```css
body { margin: 0; font-family: -apple-system, sans-serif; color: #18181b; background: #fafafa; }
header { background: white; border-bottom: 1px solid #e4e4e7; padding: 16px 24px; }
header h1 { margin: 0 0 12px; font-size: 18px; }
nav button { background: transparent; border: 0; padding: 8px 12px; font-size: 14px; cursor: pointer; color: #71717a; border-bottom: 2px solid transparent; }
nav button.active { color: #18181b; border-bottom-color: #18181b; }
main { padding: 24px; max-width: 960px; margin: 0 auto; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
.field label { font-size: 13px; font-weight: 500; }
.field input, .field select { padding: 8px; border: 1px solid #d4d4d8; border-radius: 6px; font-size: 14px; }
.tag-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: var(--color, #71717a); color: white; font-size: 12px; }
.list-row { display: grid; grid-template-columns: 220px 1fr 1fr auto; gap: 12px; padding: 8px; border-bottom: 1px solid #f4f4f5; align-items: center; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.toolbar input { flex: 1; padding: 8px; border: 1px solid #d4d4d8; border-radius: 6px; }
.btn { padding: 8px 12px; border-radius: 6px; border: 1px solid #d4d4d8; background: white; cursor: pointer; font-size: 13px; }
.btn.primary { background: #18181b; color: white; border-color: transparent; }
.btn.danger { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
```

- [ ] **Step 3: Write tab router**

`entrypoints/options/main.ts`:
```typescript
import { loadState, saveState, subscribeState } from '@core/storage';
import { AppState } from '@core/types';
import { renderBlocklist } from '@ui/options-blocklist';
import { renderTags } from '@ui/options-tags';
import { renderSettings } from '@ui/options-settings';
import { renderIox } from '@ui/options-iox';

let state: AppState;
let currentTab: 'blocklist' | 'tags' | 'settings' | 'iox' = 'blocklist';

async function init() {
  state = await loadState();
  setupTabs();
  rerender();
  subscribeState(next => { state = next; rerender(); });
}

function setupTabs() {
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab as typeof currentTab;
      rerender();
    });
  });
}

function rerender() {
  const main = document.getElementById('main')!;
  main.innerHTML = '';
  const persist = async (next: AppState) => { state = next; await saveState(state); rerender(); };
  switch (currentTab) {
    case 'blocklist': renderBlocklist(main, state, persist); break;
    case 'tags':      renderTags(main, state, persist); break;
    case 'settings':  renderSettings(main, state, persist); break;
    case 'iox':       renderIox(main, state, persist); break;
  }
}

init();
```

- [ ] **Step 4: Stub the four tab modules** so the build can run

For each `src/ui/options-{blocklist,tags,settings,iox}.ts`:
```typescript
import { AppState } from '@core/types';
export function renderBlocklist(host: HTMLElement, _state: AppState, _persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = '<p>黑名單 — 待實作</p>';
}
```
(Use the corresponding name in each file: `renderTags`, `renderSettings`, `renderIox`.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add entrypoints/options src/ui/options-blocklist.ts src/ui/options-tags.ts src/ui/options-settings.ts src/ui/options-iox.ts
git commit -m "feat(options): tabbed shell + stub modules"
```

---

### Task 6.2: Blocklist tab (search + edit + delete with undo)

**Files:**
- Modify: `src/ui/options-blocklist.ts`
- Create: `src/ui/options-blocklist.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderBlocklist } from './options-blocklist';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-blocklist', () => {
  it('renders one row per blocked user', () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    s.blockedUsers['bob']   = { username: 'bob',   tagIds: [], note: '', addedAt: 2 };
    renderBlocklist(document.body, s, vi.fn());
    expect(document.querySelectorAll('.list-row').length).toBe(2);
  });

  it('filters by search query', () => {
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    s.blockedUsers['bob']   = { username: 'bob',   tagIds: [], note: '', addedAt: 2 };
    renderBlocklist(document.body, s, vi.fn());
    const search = document.querySelector<HTMLInputElement>('input[placeholder*="搜尋"]')!;
    search.value = 'ali';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.list-row').length).toBe(1);
  });

  it('delete then undo restores entry', async () => {
    vi.useFakeTimers();
    const s = emptyState();
    s.blockedUsers['alice'] = { username: 'alice', tagIds: [], note: '', addedAt: 1 };
    const persist = vi.fn().mockResolvedValue(undefined);
    renderBlocklist(document.body, s, persist);
    const delBtn = document.querySelector<HTMLButtonElement>('.list-row .danger')!;
    delBtn.click();
    expect(document.querySelector('.undo-bar')).toBeTruthy();
    document.querySelector<HTMLButtonElement>('.undo-bar .btn')!.click();
    expect(s.blockedUsers['alice']).toBeTruthy();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- options-blocklist`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState, BlockedUser } from '@core/types';

export function renderBlocklist(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  let query = '';
  let undoState: { user: BlockedUser; timer: number } | null = null;

  function rows(): BlockedUser[] {
    const users = Object.values(state.blockedUsers);
    const q = query.trim().toLowerCase();
    return users
      .filter(u => !q || u.username.includes(q) || u.note.toLowerCase().includes(q))
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  function rerender() {
    host.innerHTML = `
      <div class="toolbar">
        <input placeholder="搜尋使用者或備註" value="${escape(query)}">
        <button class="btn primary" id="batch-add">批次新增 (貼上多個)</button>
      </div>
      <div id="list"></div>
      <div id="undo-bar"></div>
    `;
    const search = host.querySelector<HTMLInputElement>('.toolbar input')!;
    search.addEventListener('input', () => { query = search.value; renderList(); });
    host.querySelector('#batch-add')!.addEventListener('click', () => promptBatchAdd());
    renderList();
    renderUndo();
  }

  function renderList() {
    const list = host.querySelector<HTMLDivElement>('#list')!;
    list.innerHTML = '';
    for (const u of rows()) {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div>@${escape(u.username)}</div>
        <div>${u.tagIds.map(id => tagChip(id)).join(' ')}</div>
        <div><input value="${escape(u.note)}" data-note></div>
        <div><button class="btn danger" data-delete>刪除</button></div>
      `;
      row.querySelector<HTMLInputElement>('[data-note]')!.addEventListener('change', async e => {
        u.note = (e.target as HTMLInputElement).value;
        await persist(state);
      });
      row.querySelector('[data-delete]')!.addEventListener('click', () => {
        const removed = state.blockedUsers[u.username];
        if (!removed) return;
        delete state.blockedUsers[u.username];
        if (undoState) clearTimeout(undoState.timer);
        const timer = window.setTimeout(async () => {
          undoState = null;
          await persist(state);
          renderUndo();
        }, 5000);
        undoState = { user: removed, timer };
        renderList();
        renderUndo();
      });
      list.appendChild(row);
    }
  }

  function renderUndo() {
    const bar = host.querySelector<HTMLDivElement>('#undo-bar')!;
    if (!undoState) { bar.innerHTML = ''; return; }
    bar.className = 'undo-bar';
    bar.innerHTML = `已刪除 @${escape(undoState.user.username)} <button class="btn">復原</button>`;
    bar.querySelector('button')!.addEventListener('click', async () => {
      if (!undoState) return;
      clearTimeout(undoState.timer);
      state.blockedUsers[undoState.user.username] = undoState.user;
      undoState = null;
      await persist(state);
      renderList();
      renderUndo();
    });
  }

  function tagChip(id: string): string {
    const tag = state.tags.find(t => t.id === id);
    if (!tag) return '';
    return `<span class="tag-chip" style="--color:${tag.color ?? '#71717a'}">${escape(tag.name)}</span>`;
  }

  function promptBatchAdd() {
    const raw = window.prompt('一行一個 username 或 @username：');
    if (!raw) return;
    const usernames = raw.split(/\n/).map(s => s.trim()).filter(Boolean);
    for (const u of usernames) {
      const name = u.replace(/^@/, '').toLowerCase();
      if (state.blockedUsers[name]) continue;
      state.blockedUsers[name] = { username: name, tagIds: [], note: '', addedAt: Date.now() };
    }
    persist(state).then(rerender);
  }

  function escape(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
  }

  rerender();
}
```

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- options-blocklist`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/options-blocklist.ts src/ui/options-blocklist.test.ts
git commit -m "feat(options): blocklist tab with search + delete undo"
```

---

### Task 6.3: Tags tab

**Files:**
- Modify: `src/ui/options-tags.ts`
- Create: `src/ui/options-tags.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTags } from './options-tags';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-tags', () => {
  it('renders three builtin tags by default', () => {
    renderTags(document.body, emptyState(), vi.fn());
    expect(document.querySelectorAll('.list-row').length).toBe(3);
  });

  it('disables delete on builtin tags', () => {
    renderTags(document.body, emptyState(), vi.fn());
    document.querySelectorAll<HTMLButtonElement>('.list-row .danger').forEach(b => {
      expect(b.disabled).toBe(true);
    });
  });

  it('add tag adds a new custom tag and persists', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const s = emptyState();
    renderTags(document.body, s, persist);
    (document.querySelector('#add-tag') as HTMLButtonElement).click();
    expect(s.tags.length).toBe(4);
    expect(persist).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- options-tags`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState } from '@core/types';

export function renderTags(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  function rerender() {
    host.innerHTML = `
      <div class="toolbar">
        <button class="btn primary" id="add-tag">新增標籤</button>
      </div>
      <div id="list"></div>
    `;
    const list = host.querySelector<HTMLDivElement>('#list')!;
    state.tags.forEach((tag, idx) => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div><input value="${escape(tag.name)}" data-name ${tag.builtin ? '' : ''}></div>
        <div><input type="color" value="${tag.color ?? '#71717a'}" data-color></div>
        <div>
          <select data-action>
            <option value="fold" ${tag.defaultAction === 'fold' ? 'selected' : ''}>折疊</option>
            <option value="hide" ${tag.defaultAction === 'hide' ? 'selected' : ''}>隱藏</option>
          </select>
        </div>
        <div><button class="btn danger" ${tag.builtin ? 'disabled' : ''}>刪除</button></div>
      `;
      row.querySelector<HTMLInputElement>('[data-name]')!.addEventListener('change', async e => {
        tag.name = (e.target as HTMLInputElement).value; await persist(state);
      });
      row.querySelector<HTMLInputElement>('[data-color]')!.addEventListener('change', async e => {
        tag.color = (e.target as HTMLInputElement).value; await persist(state);
      });
      row.querySelector<HTMLSelectElement>('[data-action]')!.addEventListener('change', async e => {
        tag.defaultAction = (e.target as HTMLSelectElement).value as 'fold' | 'hide'; await persist(state);
      });
      const delBtn = row.querySelector<HTMLButtonElement>('.danger')!;
      if (!tag.builtin) {
        delBtn.addEventListener('click', async () => {
          if (!confirm(`刪除「${tag.name}」？被標記的封鎖紀錄會保留但失去此標籤。`)) return;
          state.tags.splice(idx, 1);
          for (const u of Object.values(state.blockedUsers)) {
            u.tagIds = u.tagIds.filter(id => id !== tag.id);
          }
          await persist(state);
          rerender();
        });
      }
      list.appendChild(row);
    });
    host.querySelector('#add-tag')!.addEventListener('click', async () => {
      const id = `user:${Math.random().toString(36).slice(2, 9)}`;
      state.tags.push({ id, name: '新標籤', color: '#71717a', defaultAction: 'fold', builtin: false });
      await persist(state);
      rerender();
    });
  }

  function escape(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
  }

  rerender();
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- options-tags`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/options-tags.ts src/ui/options-tags.test.ts
git commit -m "feat(options): tags tab with custom add/edit/delete"
```

---

### Task 6.4: Settings tab

**Files:**
- Modify: `src/ui/options-settings.ts`
- Create: `src/ui/options-settings.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderSettings } from './options-settings';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-settings', () => {
  it('renders three controls', () => {
    renderSettings(document.body, emptyState(), vi.fn());
    expect(document.querySelectorAll('.field').length).toBeGreaterThanOrEqual(3);
  });

  it('changing defaultActionWhenNoTag persists state', async () => {
    const s = emptyState();
    const persist = vi.fn().mockResolvedValue(undefined);
    renderSettings(document.body, s, persist);
    const sel = document.querySelector<HTMLSelectElement>('select[name="defaultActionWhenNoTag"]')!;
    sel.value = 'hide';
    sel.dispatchEvent(new Event('change'));
    expect(s.settings.defaultActionWhenNoTag).toBe('hide');
    expect(persist).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- options-settings`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState } from '@core/types';

export function renderSettings(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = `
    <div class="field">
      <label for="default-action">無標籤時的預設行為</label>
      <select id="default-action" name="defaultActionWhenNoTag">
        <option value="fold" ${state.settings.defaultActionWhenNoTag === 'fold' ? 'selected' : ''}>折疊（顯示橫幅可展開）</option>
        <option value="hide" ${state.settings.defaultActionWhenNoTag === 'hide' ? 'selected' : ''}>隱藏（display:none）</option>
      </select>
    </div>
    <div class="field">
      <label><input type="checkbox" name="showHiddenCountBadge" ${state.settings.showHiddenCountBadge ? 'checked' : ''}> 在 popup 顯示本頁折疊計數</label>
    </div>
    <div class="field">
      <label><input type="checkbox" name="debugMode" ${state.settings.debugMode ? 'checked' : ''}> 除錯模式（console 紀錄）</label>
    </div>
  `;
  host.querySelector<HTMLSelectElement>('[name="defaultActionWhenNoTag"]')!.addEventListener('change', async e => {
    state.settings.defaultActionWhenNoTag = (e.target as HTMLSelectElement).value as 'fold' | 'hide';
    await persist(state);
  });
  host.querySelector<HTMLInputElement>('[name="showHiddenCountBadge"]')!.addEventListener('change', async e => {
    state.settings.showHiddenCountBadge = (e.target as HTMLInputElement).checked;
    await persist(state);
  });
  host.querySelector<HTMLInputElement>('[name="debugMode"]')!.addEventListener('change', async e => {
    state.settings.debugMode = (e.target as HTMLInputElement).checked;
    await persist(state);
  });
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- options-settings`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/options-settings.ts src/ui/options-settings.test.ts
git commit -m "feat(options): preferences tab"
```

---

### Task 6.5: Import/Export tab

**Files:**
- Modify: `src/ui/options-iox.ts`
- Create: `src/ui/options-iox.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderIox } from './options-iox';
import { emptyState } from '@core/defaults';

beforeEach(() => { document.body.innerHTML = ''; });

describe('options-iox', () => {
  it('renders export button and import file input', () => {
    renderIox(document.body, emptyState(), vi.fn());
    expect(document.querySelector('#export-btn')).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('#import-file')!.type).toBe('file');
  });

  it('clicking export creates a download blob', () => {
    const url = vi.fn(() => 'blob:mock');
    (URL.createObjectURL as unknown as typeof url) = url;
    renderIox(document.body, emptyState(), vi.fn());
    document.querySelector<HTMLButtonElement>('#export-btn')!.click();
    expect(url).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- options-iox`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { AppState } from '@core/types';
import { serializeExport, parseImport, mergeImport } from '@core/export';

export function renderIox(host: HTMLElement, state: AppState, persist: (s: AppState) => Promise<void>): void {
  host.innerHTML = `
    <div class="field">
      <label>匯出目前的封鎖名單與標籤</label>
      <button class="btn primary" id="export-btn">下載 JSON</button>
    </div>
    <div class="field">
      <label for="import-file">匯入</label>
      <input type="file" id="import-file" accept="application/json">
      <label>
        <input type="radio" name="import-mode" value="merge" checked> 合併（保留現有）
      </label>
      <label>
        <input type="radio" name="import-mode" value="replace"> 取代（清掉現有封鎖名單）
      </label>
    </div>
    <div id="import-status"></div>
  `;

  host.querySelector('#export-btn')!.addEventListener('click', () => {
    const json = serializeExport(state, '0.1.0');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `block-all-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  host.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', async e => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const status = host.querySelector<HTMLDivElement>('#import-status')!;
    try {
      const payload = parseImport(text);
      const mode = (host.querySelector<HTMLInputElement>('[name="import-mode"]:checked')!.value) as 'merge' | 'replace';
      const next = mergeImport(state, payload, { mode });
      await persist(next);
      status.textContent = `✅ 已${mode === 'merge' ? '合併' : '取代'}：共 ${Object.keys(next.blockedUsers).length} 筆`;
    } catch (err) {
      status.textContent = `❌ ${(err as Error).message}`;
    }
  });
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- options-iox`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/options-iox.ts src/ui/options-iox.test.ts
git commit -m "feat(options): import/export tab with merge/replace"
```

---

## Phase 7 — CI & docs

### Task 7.1: GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck + test + build on push/PR"
```

---

### Task 7.2: QA checklist

**Files:**
- Create: `docs/qa-checklist.md`

- [ ] **Step 1: Write checklist**

```markdown
# Manual QA Checklist (run before each release)

## Setup
- [ ] `npm run build` succeeds
- [ ] Load unpacked from `.output/chrome-mv3/`
- [ ] Open Threads home

## Feed
- [ ] Add a username via popup-block-button on a feed post → that post folds with banner
- [ ] Click 「展開觀看」 → original visible
- [ ] Toggle master off in popup → no folds applied
- [ ] Toggle master on → folds reapplied without full reload

## Single post
- [ ] Open `/@user/post/<id>`
- [ ] Click 「擷取本頁留言者」 → audit modal lists commenters
- [ ] Select a couple, choose a tag, save → commenters become blocked

## Likes modal
- [ ] Open a post's likes list
- [ ] Click 「擷取按讚者」 → audit modal lists likers
- [ ] Save → likers added to blocklist

## Options
- [ ] Blocklist search filters list
- [ ] Delete + undo restores
- [ ] Tag rename reflects in fold banners on next Threads view
- [ ] Settings: switch defaultActionWhenNoTag to hide → entries with no tag now use display:none
- [ ] Import/export round-trip preserves all entries
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa-checklist.md
git commit -m "docs: manual QA checklist"
```

---

## Self-review notes (to be performed after writing)

- Spec coverage cross-check: §1–§11 all map to phases above.
- Open questions from §11 are addressed in Task 0.4 (live verification).
- No placeholder steps; every step has either code, test, or exact command.
- Type names (`AppState`, `BlockedUser`, `Tag`, `Settings`, `TagAction`, `ImportPayload`, `AuditRow`, `FoldPayload`) used consistently throughout.
- `STORAGE_KEY = 'block_all_state'` matches spec §4.
- Selectors centralized in `src/content/selectors.ts` per spec §3.

---

## End-of-plan

When Phase 7 commits land, run:
```bash
npm run typecheck && npm test && npm run build
```
and proceed to v0.1.0 release prep (zip, screenshots, store listing) outside this plan.
