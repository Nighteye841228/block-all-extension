export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  runAt: 'document_idle',
  main() {
    console.log('[block-all] content script loaded');
  },
});
