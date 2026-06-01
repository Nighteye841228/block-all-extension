import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Block-All for Threads',
    version: '0.1.0',
    version_name: '0.1.0-alpha',
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
