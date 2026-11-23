#!/usr/bin/env bash
# Adds the language, footer, picture-zoom and recheck fixes as separate commits, then pushes.
# Safe to run again: steps already in your history are skipped.
set -e
cd "$(dirname "$0")/.."
[ -f index.html ] || { echo 'Put the _update folder inside the tindahan folder, next to index.html.'; exit 1; }
[ -d .git ] || { echo 'This folder is not a Git repository yet.'; exit 1; }
grep -qx '_update/' .git/info/exclude 2>/dev/null || echo '_update/' >> .git/info/exclude
if [ -n "$(git status --porcelain)" ]; then echo 'You have uncommitted changes. Commit or undo them first.'; git status --short; exit 1; fi
total=0
step() { if git log --format=%s | grep -Fxq -- "$2"; then echo "  skipped, already applied: $2"; return; fi; cp -R "_update/steps/$1/." .; git add -A; if git diff --cached --quiet; then echo "  skipped, already applied: $2"; else git commit -q -m "$2"; total=$((total+1)); echo "  [$total] $2"; fi; }
step 01 "fix(i18n): use one English glossary and match menu names to page titles"
step 02 "test(i18n): check for Filipino words in English and menu/title mismatches"
step 03 "fix(a11y): translate the skip link and page description"
step 04 "fix(layout): keep the footer at the bottom of every screen"
step 05 "feat(footer): show store status, quick links, members and backup reminder"
step 06 "style(footer): lay out the footer in columns that stack on phones"
step 07 "fix(modal): let only the top dialog react to Esc and Tab"
step 08 "feat(ui): add a picture viewer with a zoom button"
step 09 "feat(inventory): open product pictures large from the list and the form"
step 10 "feat(cashier): view shelf pictures large without adding to the basket"
step 11 "style(ui): bigger product thumbnails and a magnifier badge"
step 12 "fix(nav): fit every menu item on wide screens instead of cutting them off"
step 13 "fix(i18n): update the browser tab title when the language changes"
step 14 "docs(readme): add the language glossary and describe the new footer"
step 15 "docs(guide): explain picture zoom and English screen names"
step 16 "docs(simulation): match the English labels and add footer and zoom steps"
step 17 "docs(test-plan): add the translation tests and update the results"
step 18 "docs(architecture): add AppFooter and ImageViewer to the diagram"
step 19 "docs(screenshots): retake screenshots with the English labels"
step 20 "fix(modal): close open dialogs when the screen changes"
step 21 "fix(settings): keep the chosen language after loading demo data or resetting"
step 22 "feat(day): reopen today after closing and keep the earlier count"
step 23 "test(day): cover reopening today and the next closing"
step 24 "feat(dashboard): add a Reopen today button that asks for the owner PIN"
step 25 "feat(closing): mention on the day summary when the day was reopened"
step 26 "docs(guide): explain how to reopen today"
step 27 "docs(simulation): add reopen steps and update the test results"
step 28 "chore: bump version to 1.2.0"
echo
echo "Made $total new commits."
[ "$total" -eq 0 ] && { echo "Nothing new to push."; exit 0; }
echo "Pushing to GitHub..."
git push origin main && echo "Done. You can delete the _update folder now." || echo "Push failed. Run: git pull --rebase origin main, then git push origin main"
