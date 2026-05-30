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
