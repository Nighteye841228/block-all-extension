# Block-All for Threads — Design Document

- **Status**: Draft (awaiting user approval)
- **Date**: 2026-05-25
- **Author**: brainstorming session
- **Target version**: v0.1.0 (MVP)

---

## 1. Goals & Non-Goals

### Goals

A Chrome extension (Manifest V3) that lets a user batch-block specific Threads accounts so their posts and comments are folded in the UI with a reason banner. Aimed at users who can accumulate large blocklists (potentially 10,000+ entries) and want to organise them with tags.

### Non-goals (v0.1)

- Firefox / Safari support
- Cross-device cloud sync (handled via JSON export/import)
- AI-based auto-tagging
- Wildcard / regex / rule-engine matching (exact username match only)
- Hiding reposts, quote-shares, mentions, or notification entries
- Blocking on profile pages, notification page, mobile web

These are deferred and noted in §10.

---

## 2. Functional Scope

### Pages where the extension activates

- Home feed (`/`)
- Single post detail page (`/@user/post/<id>`)
- Search results
- Hashtag pages

Profile pages and notifications are deliberately out of scope.

### Content folded when matched

- The blocked user's own posts
- The blocked user's comments (replies)

Reposts, quote-shares, and `@`-mentions of the blocked user are not folded.

### Folding behaviour

Default action is **fold** with a banner that includes:

- The blocked username
- Tag chips (e.g. `性別歧視`, `噁心`)
- The user-supplied note
- A "展開觀看" button to reveal the original content

Per-tag overrides allow some tags to fully hide (`display: none`) instead of folding. The setting `defaultActionWhenNoTag` chooses the fallback when an entry has no tags.

---

## 3. Architecture

### High-level layout

```
┌───────────────────────────────────────────────────────────────┐
│                         Chrome Browser                         │
│                                                                │
│   ┌─────────┐    ┌────────────────────┐    ┌──────────────┐  │
│   │  Popup  │    │   Content Script   │    │ Options Page │  │
│   │         │    │  (threads.com/net) │    │              │  │
│   └────┬────┘    └────────┬───────────┘    └──────┬───────┘  │
│        │                  │                       │           │
│        └──────────────────┼───────────────────────┘           │
│                           │                                   │
│                  ┌────────▼─────────┐                         │
│                  │ chrome.storage   │                         │
│                  │      .local      │                         │
│                  └──────────────────┘                         │
└────────────────────────────────────────────────────────────────┘
```

No background service worker for MVP. All three surfaces read/write `chrome.storage.local` directly and react to `chrome.storage.onChanged` for synchronisation.

### Module layout

```
src/
├── entrypoints/
│   ├── content.ts                # WXT content script entry
│   ├── popup/                    # toolbar popup
│   └── options/                  # options page
├── core/
│   ├── types.ts                  # BlockedUser, Tag, Settings, AppState
│   ├── storage.ts                # typed wrapper over chrome.storage.local
│   ├── matcher.ts                # username → BlockedUser | null
│   └── export.ts                 # JSON import/export
├── content/
│   ├── observer.ts               # MutationObserver + rAF queue
│   ├── extractor.ts              # DOM → username & node-type
│   ├── selectors.ts              # ALL Threads DOM selectors (single source)
│   ├── fold-ui.ts                # fold banner injection (Shadow DOM)
│   ├── block-button.ts           # per-post quick-block button
│   └── audit-modal.ts            # bulk-audit Shadow DOM modal
└── ui/
    ├── components/               # shared vanilla TS + lit-html bits
    └── styles/
```

`core/` has no DOM dependencies and is fully unit-testable in jsdom or pure Node.

`content/selectors.ts` is the single point that changes when Threads modifies its frontend.

---

## 4. Data Model

```typescript
export interface BlockedUser {
  username: string;        // normalised: lowercase, no '@', no whitespace
  tagIds: string[];
  note: string;
  addedAt: number;         // epoch ms (UTC)
  sourceUrl?: string;      // optional, for debugging
}

export interface Tag {
  id: string;              // 'sys:sexism' | 'user:<uuid>'
  name: string;
  color?: string;          // hex
  defaultAction: 'fold' | 'hide';
  builtin: boolean;
}

export interface Settings {
  enabled: boolean;
  defaultActionWhenNoTag: 'fold' | 'hide';
  showHiddenCountBadge: boolean;
  debugMode: boolean;
}

export interface AppState {
  schemaVersion: number;                     // 1
  blockedUsers: Record<string, BlockedUser>; // keyed by normalised username
  tags: Tag[];
  settings: Settings;
}
```

### Defaults

```typescript
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
```

### Storage layout

A single `chrome.storage.local` key, `block_all_state`, holds the entire serialised `AppState`. With 10K entries averaging ~150 bytes the payload is ~1.5 MB — comfortably under the 10 MB quota. Reading or writing the whole blob is <50 ms on modern hardware.

### Username normalisation

```typescript
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\s+/g, '');
}
```

Applied at every system boundary: DOM extraction, user textarea input, JSON import.

### JSON export/import schema

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-25T12:30:00.000Z",
  "appVersion": "0.1.0",
  "blockedUsers": [...],
  "tags": [...],
  "settings": {...}
}
```

Import defaults to **merge** (same username → import wins for tags/note; new entries are added). A **replace** option is exposed for power users. Custom tag id collisions are resolved by name comparison — equal names merge, differing names suffix the imported id with `_imported`.

---

## 5. Content Script — Detection & Action

### 5.1 Mutation processing pipeline

```
MutationObserver(document.body, {subtree:true, childList:true})
        │
        ▼  (records mutated nodes into Set, never processes inline)
   Mutation Queue (Set<HTMLElement>, deduped)
        │
        ▼  (requestIdleCallback / rAF, 50 nodes per frame max)
   Processor
        │
        ▼
   Extractor → matcher → fold-ui / hide
```

Already-processed nodes are tracked in a `WeakSet<HTMLElement>` plus a `data-block-all-handled` attribute as a second-line guard. The attribute makes state visible in DevTools.

An initial full-page scan runs once at `document_idle` so existing nodes (loaded before the observer attached) are also processed.

### 5.2 Selectors (Threads DOM)

Verified empirically against `context.md` (feed: 29 posts), `perpage.md` (profile: 44 posts), and `like.md` (likes modal):

```typescript
export const SELECTORS = {
  postContainer:    '[data-pressable-container="true"]', // ✅ verified 1:1 with posts
  authorPostLink:   'a[href*="/post/"]',                  // ✅ used to identify author
  anyUserLink:      'a[href^="/@"]',                      // ✅ generic profile link
  likesDialog:      '[role="dialog"]',                    // ✅ verified
  replyButton:      '[aria-label="回覆"]',               // ✅ verified (zh-Hant)
  likeButton:       '[aria-label="讚"]',
  repostButton:     '[aria-label="轉發"]',
  shareButton:      '[aria-label="分享"]',
  moreMenu:         '[aria-label="更多"]',
  // TBV in Phase 0: comment containers on single-post page; assumed to share postContainer
};
```

Localisation: ARIA labels are language-dependent. Phase 0 verifies whether to expand each label into a multi-language array (e.g. `['回覆', 'Reply']`).

### 5.3 Author extraction

Using the first `/post/` link inside a container avoids misidentifying `@`-mentions:

```typescript
export function extractAuthorUsername(container: HTMLElement): string | null {
  const link = container.querySelector<HTMLAnchorElement>('a[href*="/post/"]');
  if (!link) return null;
  const match = link.getAttribute('href')?.match(/^\/@([^/]+)\/post\//);
  return match ? normalizeUsername(match[1]) : null;
}
```

For the likes modal, every `a[href^="/@"]` inside `[role="dialog"]` whose `href` does **not** contain `/post/` is treated as a liker.

### 5.4 Fold action

Original DOM is moved into a sibling wrapper and hidden; the banner is injected into a Shadow DOM host so Threads' global CSS cannot bleed in.

```html
<div data-pressable-container="true" data-block-all-state="folded">
  <div data-block-all-banner>
    <!-- #shadow-root -->
    <style>/* isolated */</style>
    <div class="banner">
      <span class="icon">🚫</span>
      <div class="info">
        <div class="title">已封鎖 @spammer123</div>
        <div class="tags"><span class="tag" style="--color:#d946ef">性別歧視</span></div>
        <div class="note">「上次說了 XXX」</div>
      </div>
      <button class="expand">展開觀看 ▼</button>
    </div>
  </div>
  <div data-block-all-original hidden>
    <!-- original content -->
  </div>
</div>
```

Hide action is simpler: set `display: none` on the container, mark with `data-block-all-handled="hidden"`. No banner.

### 5.5 Bulk extraction triggers

- **Comments**: on a single-post page (URL `/@user/post/<id>`), inject a floating button "📋 擷取本頁留言者". Clicking gathers every `postContainer` whose author username differs from the page-URL author, dedupes them, and opens the audit modal.
- **Likers**: when `[role="dialog"]` containing the likes list appears (detected by the observer), inject a header button "📋 擷取按讚者". Clicking applies `extractLikersFromDialog()` to the modal contents.
- No auto-scrolling of the likes modal. The user scrolls manually to load more entries before clicking the button.

---

## 6. UI

### 6.1 Popup

Quick status and quick actions only. Layout:

- Toggle: master enable/disable
- Stats: blocklist count, "folded on this page" counts
- Quick actions: 「擷取本頁留言者」、「擷取本頁按讚者」 (enabled only on relevant pages)
- Footer: "開啟完整管理頁" link to options

Implemented in vanilla TypeScript (~150 lines, no framework).

### 6.2 Options Page

Tabbed layout: `黑名單` / `標籤` / `偏好設定` / `匯入 / 匯出`.

**黑名單 tab**: search box, tag filter, sort selector, virtualized list (using `@tanstack/virtual-core`, ~5 KB), inline edit (✏️) / soft delete (🗑 with 5-second undo), and a "批次新增 (貼上多個)" button that opens the audit modal pre-loaded with the pasted IDs.

**標籤 tab**: list of tags, edit colour/name/default-action inline. Built-in tags cannot be deleted (only renamed/recoloured/re-actioned). Deleting a custom tag warns about affected entries; entries are kept but lose that tag id.

**偏好設定 tab**: `defaultActionWhenNoTag`, `showHiddenCountBadge`, `debugMode`.

**匯入 / 匯出 tab**: download JSON, upload JSON with merge/replace mode and a diff preview.

Implemented with vanilla TypeScript plus `lit-html` (~5 KB) for list rendering and conditional templates.

### 6.3 Audit Modal

Reused in three contexts: comment extraction, liker extraction, batch-add from options.

```
┌──────────────────────────────────────────────────────────┐
│ 審核 — 擷取到 23 個 ID                            [×]    │
├──────────────────────────────────────────────────────────┤
│ ☑ 全選  |  套用到勾選: [性別歧視][暴力][噁心] [+自訂]    │
│         |  套用備註到勾選: [                        ]    │
│ ──────────────────────────────────────────────────────── │
│ ☑ @spammer123    [性別歧視][噁心]    備註:[          ]   │
│ ☑ @nft_guru      [業配廣告]          備註:[          ]   │
│ ☐ @random_user   ─                   備註:[          ]   │
│ ☑ @already_in_list ⚠ 已在黑名單     備註:[原本內容]    │
│ ──────────────────────────────────────────────────────── │
│        [儲存 18 筆]                  [取消]              │
└──────────────────────────────────────────────────────────┘
```

Behavioural rules:
- All rows pre-selected on open. Users typically deselect a few rather than select from empty.
- Already-blocked usernames are pre-selected and visually marked; saving updates the existing entry.
- "套用到勾選" applies the chosen tags / note to every checked row.
- Save button label reflects the number of rows to be written.
- ESC or clicking the backdrop cancels.

When opened from a Threads page, the modal is mounted in a Shadow DOM host with `position: fixed; z-index: 2147483647;` to outrank any Threads UI. When opened from the options page, the same component renders in the options DOM tree directly (no Shadow DOM needed there).

### 6.4 Fold Banner

See §5.4 for structure. Visual goals: keep banner ~60 px tall, tag chips coloured by CSS custom properties driven by `Tag.color`, "展開觀看" toggles between full and collapsed (single-line `@user — 收起`) views.

### 6.5 UI technology choices

| Surface     | Tech                                               |
| ----------- | -------------------------------------------------- |
| Popup       | Vanilla TS, template literals                      |
| Options     | Vanilla TS + `lit-html`                            |
| Audit Modal | Vanilla TS + `lit-html` (Shadow DOM when injected) |
| Fold Banner | Vanilla TS + Shadow DOM, no templating lib         |

No React/Vue/Svelte. Justifications: low interaction complexity, smaller per-entrypoint bundles, simpler debugging in extension context, and the user's stated goal of practising TypeScript fundamentals.

---

## 7. Manifest, Permissions, Build & Test

### 7.1 Manifest V3 (generated by WXT)

```json
{
  "manifest_version": 3,
  "name": "Block-All for Threads",
  "version": "0.1.0",
  "action": { "default_popup": "popup.html" },
  "options_page": "options.html",
  "content_scripts": [{
    "matches": ["https://*.threads.com/*", "https://*.threads.net/*"],
    "js": ["content-scripts/content.js"],
    "run_at": "document_idle"
  }],
  "permissions": ["storage"],
  "host_permissions": ["https://*.threads.com/*", "https://*.threads.net/*"]
}
```

Minimum-permission posture: no `activeTab`, no `tabs`, no `scripting`, no `webRequest`. Only `storage` plus `host_permissions` for the two Threads domains.

### 7.2 Project skeleton (WXT)

```
block-all-for-threads/
├── entrypoints/
│   ├── content.ts
│   ├── popup/{index.html,main.ts}
│   └── options/{index.html,main.ts}
├── src/{core,content,ui}/  (per §3)
├── test-fixtures/          (extracted from context.md, perpage.md, like.md)
├── wxt.config.ts
├── tsconfig.json
├── package.json
└── docs/
```

### 7.3 Build & dev workflow

```bash
npm install
npm run dev      # WXT: TS build + watch + auto-loaded Chrome profile + HMR
npm run build    # production output to .output/chrome-mv3/
npm run zip      # store-upload zip
npm test         # vitest
```

### 7.4 Test strategy

| Level      | Tool                 | Targets                                                    |
| ---------- | -------------------- | ---------------------------------------------------------- |
| Unit       | vitest + jsdom       | `core/` (normalise, matcher, exporter, storage wrapper)    |
| Component  | vitest + jsdom       | `extractor.ts`, `audit-modal.ts` against real DOM fixtures |
| Manual E2E | DevTools + checklist | Critical paths on live Threads                             |

`test-fixtures/` holds excerpts extracted from `context.md`, `perpage.md`, `like.md` to feed component tests, ensuring future Threads DOM drift surfaces in CI rather than in user reports.

A manual QA checklist (`docs/qa-checklist.md`) lists scenarios to run before each release: feed fold, comment fold, expand-to-view, bulk-audit save, master toggle round-trip, export-import round-trip.

---

## 8. Phase 0 Prerequisites

These must complete before any feature implementation begins:

1. Scaffold the project with `wxt init` (vanilla template).
2. Configure manifest and `wxt.config.ts` per §7.1–7.2; verify `npm run dev` loads the extension into a Chrome profile and the popup opens.
3. Open Threads, navigate to a single post page; verify whether comments use `[data-pressable-container="true"]`. Update `selectors.ts` and add an inline note recording the verification date.
4. Extract excerpts from `context.md`, `perpage.md`, `like.md` into `test-fixtures/` (feed-post, profile-post, likes-modal, and once obtained, single-post-page-comment).
5. Set up CI (GitHub Actions) running `tsc --noEmit` and `vitest`.

Only after these five steps does feature implementation begin.

---

## 9. Risk Register

| Risk                                     | Likelihood | Impact   | Mitigation                                                                                                                                       |
| ---------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Meta removes `data-pressable-container`  | Medium     | High     | Centralised `selectors.ts`; add fallback selectors; anomaly heuristic: if `postContainer` matches zero on a Threads URL for >5 s, log to console |
| ARIA labels switch language (English UI) | High       | Medium   | Per-label arrays of accepted strings (`['回覆','Reply']`)                                                                                        |
| URL structure changes (e.g. `/users/x`)  | Low        | High     | Same centralisation principle                                                                                                                    |
| User accidentally bulk-blocks too many   | Medium     | Medium   | Soft delete with undo; "last 30 days of blocks" view with one-click unblock                                                                      |
| `chrome.storage.local` corruption        | Low        | High     | Keep rolling backups (`block_all_state_backup_<ts>`, last 3) after each write                                                                    |
| Heavy folding bloats feed visually       | Medium     | Low (UX) | Deferred to v0.2: merge consecutive folds into "N posts folded (expand)"                                                                         |

---

## 10. Out of Scope

- Firefox / Safari builds
- Cloud sync (Google Drive / iCloud)
- AI-driven auto-tagging
- Crowdsourced / shared blocklists
- Mobile web (Threads mobile does not load extensions)
- Notification page coverage
- Reposts / quote-shares folding
- Profile-page folding
- Wildcard / regex / rule-engine matching (deferred to a future Rust + WASM iteration)

---

## 11. Open Questions

- **Comment container selector on single-post page**: assumed to be `[data-pressable-container="true"]`. Verified in Phase 0 step 3.
- **Distinguishing main post from comments**: working hypothesis is to compare each container's first `a[href*="/post/"]` against the page URL — the main post matches, comments do not. Verified in Phase 0.
- **English UI ARIA labels**: not yet captured. Will be added during Phase 0 step 3 if the user can switch interface language to confirm.
