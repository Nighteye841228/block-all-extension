import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Threads小兔子黑暗無限鎖",
    version: "0.1.0",
    version_name: "0.1.0-alpha",
    description: "批次封鎖 Threads 帳號，並以可分類標籤摺疊內容。",
    permissions: ["storage"],
    host_permissions: ["https://*.threads.com/*", "https://*.threads.net/*"],
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png",
    },
    action: {
      default_popup: "popup.html",
      default_icon: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "128": "icon/128.png",
      },
    },
    options_page: "options.html",
  },
  srcDir: ".",
});
