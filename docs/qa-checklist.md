# Manual QA Checklist (run before each release)

## Setup
- [ ] `npm run build` succeeds
- [ ] Load unpacked from `.output/chrome-mv3/`
- [ ] Open Threads home

## Feed
- [ ] Add a username via popup-block-button on a feed post → that post folds with banner  ==> 有，但是希望點擊封鎖時一樣給使用者選擇標籤與輸入備註的框
- [ ] Click 「展開觀看」 → original visible ==> 可觀看但是因為點擊框框又直接連進去文章會跳掉，應該是click時同時bubble浮起進入文章的事件
- [ ] Toggle master off in popup → no folds applied ==> 不懂你的意思
- [ ] Toggle master on → folds reapplied without full reload ==> 不懂你的意思

## Single post
- [ ] Open `/@user/post/<id>`
- [ ] Click 「擷取本頁留言者」 → audit modal lists commenters
- [ ] Select a couple, choose a tag, save → commenters become blocked ==> 有成功，但沒有馬上fold，要重新整理

## Likes modal
- [ ] Open a post's likes list
- [ ] Click 「擷取按讚者」 → audit modal lists likers
- [ ] Save → likers added to blocklist ==> 不確定，因為你給的blocklist管理頁面太小，而且我希望點擊附加元件按鈕後直接浮在上面，而不是還要到管理夜觀看

## Options
- [ ] Blocklist search filters list ==> 有，但是沒有顯示標籤
- [ ] Delete + undo restores ==>有
- [ ] Tag rename reflects in fold banners on next Threads view ==> 有
- [ ] Settings: switch defaultActionWhenNoTag to hide → entries with no tag now use display:none ==> 有
- [ ] Import/export round-trip preserves all entries ==>尚未測試

其他問題：
- 封鎖按鈕的位置跟右上角三個點的位置太接近，可以考慮放在"發文者id 分鐘數"的分鐘數後面
- 批量新增時無法刪除或編輯個別id的標籤（或是當初我們spec沒說好？）
