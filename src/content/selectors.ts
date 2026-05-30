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
