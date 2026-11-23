@echo off
setlocal
rem Adds the language, footer, picture-zoom and recheck fixes as separate commits, then pushes.
rem Safe to run again: steps that are already in your history are skipped.
cd /d "%~dp0.."
if not exist index.html ( echo Put the _update folder inside the tindahan folder, next to index.html. & pause & exit /b 1 )
if not exist .git ( echo This folder is not a Git repository yet. Run commit-history.bat first. & pause & exit /b 1 )
where git >nul 2>nul || ( echo Git is not installed. Get it from https://git-scm.com & pause & exit /b 1 )
findstr /x /c:"_update/" .git\info\exclude >nul 2>nul || echo _update/>> .git\info\exclude
set "dirty="
for /f %%i in ('git status --porcelain') do set dirty=1
if defined dirty ( echo You have uncommitted changes. Commit or undo them first, then run this again. & git status --short & pause & exit /b 1 )
set total=0
call :step 01 "fix(i18n): use one English glossary and match menu names to page titles"
call :step 02 "test(i18n): check for Filipino words in English and menu/title mismatches"
call :step 03 "fix(a11y): translate the skip link and page description"
call :step 04 "fix(layout): keep the footer at the bottom of every screen"
call :step 05 "feat(footer): show store status, quick links, members and backup reminder"
call :step 06 "style(footer): lay out the footer in columns that stack on phones"
call :step 07 "fix(modal): let only the top dialog react to Esc and Tab"
call :step 08 "feat(ui): add a picture viewer with a zoom button"
call :step 09 "feat(inventory): open product pictures large from the list and the form"
call :step 10 "feat(cashier): view shelf pictures large without adding to the basket"
call :step 11 "style(ui): bigger product thumbnails and a magnifier badge"
call :step 12 "fix(nav): fit every menu item on wide screens instead of cutting them off"
call :step 13 "fix(i18n): update the browser tab title when the language changes"
call :step 14 "docs(readme): add the language glossary and describe the new footer"
call :step 15 "docs(guide): explain picture zoom and English screen names"
call :step 16 "docs(simulation): match the English labels and add footer and zoom steps"
call :step 17 "docs(test-plan): add the translation tests and update the results"
call :step 18 "docs(architecture): add AppFooter and ImageViewer to the diagram"
call :step 19 "docs(screenshots): retake screenshots with the English labels"
call :step 20 "fix(modal): close open dialogs when the screen changes"
call :step 21 "fix(settings): keep the chosen language after loading demo data or resetting"
call :step 22 "feat(day): reopen today after closing and keep the earlier count"
call :step 23 "test(day): cover reopening today and the next closing"
call :step 24 "feat(dashboard): add a Reopen today button that asks for the owner PIN"
call :step 25 "feat(closing): mention on the day summary when the day was reopened"
call :step 26 "docs(guide): explain how to reopen today"
call :step 27 "docs(simulation): add reopen steps and update the test results"
call :step 28 "chore: bump version to 1.2.0"
echo.
echo Made %total% new commits.
if %total%==0 ( echo Nothing new to push. & pause & exit /b 0 )
echo Pushing to GitHub...
git push origin main
if errorlevel 1 ( echo. & echo Push failed. Run: git pull --rebase origin main   then: git push origin main ) else ( echo Done. You can delete the _update folder now. )
pause
exit /b 0

:step
git log --format=%%s | findstr /x /l /c:"%~2" >nul && goto stepskip
xcopy "_update\steps\%~1\*" . /e /y /q >nul
git add -A
git diff --cached --quiet
if %errorlevel%==0 goto stepskip
git commit -q -m "%~2"
set /a total+=1
echo   [%total%] %~2
exit /b 0
:stepskip
echo   skipped, already applied: %~2
exit /b 0
