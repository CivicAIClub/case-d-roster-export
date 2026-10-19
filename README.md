# Case D: Roster Export Automation

## What this is

Mr. Ring, a teacher at Pomfret, wanted a faster way to get through report comments. Every midterm and term end, teachers copy class rosters out of Canvas by hand, clean them up in Google Sheets, move the names into a Google Doc to write comments, and then enter every letter grade and paste every comment into Sundial, one student at a time.

Phase 1, a Google Apps Script inside a Google Sheet, pulls each roster from Canvas and makes one Google Doc per class with a tab for each student, ready for comments. It is built but has not been tested with a teacher's real Canvas account yet.

The Sundial step is the part every teacher still does by hand. The original Phase 2 plan was to push comments in through Blackbaud's SKY API, but nobody at Pomfret has SKY API access, including the tech office, so that plan is retired. The new plan is the **Sundial Helper**: a Chrome extension that fills each student's grade and comment into the Sundial grading page the teacher already has open, so the teacher only checks each one and clicks Save. It never clicks anything itself. It is being built on a practice page with made-up students and will not run on the real Sundial until the school's tech office approves it.

## Client
Mr. Ring (teacher, Pomfret School). The goal is a tool any of Pomfret's ~90 teachers could use. Mr. Lake (faculty advisor) built the grades tool that calculates each class's letter grades from Canvas; this project works alongside it.

## Problem
Canvas lacks a clean, one-click export for class rosters. Every midterm and finals, teachers manually copy rosters out of Canvas, paste-special them into Google Sheets to strip hyperlinks, move names into a Google Doc to write comments, then copy those comments into Sundial (Blackbaud MySchoolApp), export a PDF, and email it to their department head.

## Goal
1. Pull the roster from Canvas automatically (done)
2. Generate a clean Google Doc per class for writing comments (done)
3. Get each student's grade and comment into Sundial without copy and paste: grades from Mr. Lake's grades tool, comments from the comment Docs, filled in by the Sundial Helper for the teacher to check and save

## Solution Architecture
- **Comment Docs** (built): Google Apps Script bound to a Google Sheet, no server. It reads rosters from the Canvas REST API with each teacher's own token and makes a Drive folder with one Google Doc per class, one tab per student. `DocReader.gs` can read the finished comments back out.
- **Grades** (not this repo): Mr. Lake's grades tool calculates letter grades from Canvas outcomes. This repo does not calculate grades, and Canvas's own current score is not the Sundial grade.
- **Sundial Helper** (in progress): a Chrome extension in `sundial-helper/` (Manifest V3, plain JavaScript, no build step). The teacher pastes rows (student, grade, comment) from a Google Sheet; the helper fills the matching fields on the open Sundial page and highlights them. The teacher checks each one and clicks Save.

```
Drive Folder: "Comments — Fall Midterm"
├── Doc: "Hum 2 — Fall Midterm"
│     ├── Tab: "Adams, John"       → comment area
│     ├── Tab: "Baker, Sarah"      → comment area
│     └── Tab: "Chen, Michael"     → comment area
└── Doc: "Adv Writing — Fall Midterm"
      ├── Tab: "Garcia, Ana"       → comment area
      └── Tab: "Kim, David"        → comment area
```

## Files
| File | Purpose |
|------|---------|
| `Code.gs` | Menu setup, orchestration, main flow |
| `CanvasAPI.gs` | Canvas REST API wrapper (courses + rosters, paginated) |
| `DocBuilder.gs` | Creates Drive folder, one doc per class, tabs per student |
| `DocReader.gs` | Reads finished comments back out of the comment Docs |
| `SundialAPI.gs` | Retired SKY API placeholder (being removed) |
| `TokenDialog.html` | Canvas API token setup UI |
| `CourseSelector.html` | Course picker + results display |
| `SundialSetup.html` | Retired SKY API setup UI (being removed) |
| `ExportDialog.html` | Retired SKY API export UI (being removed) |
| `appsscript.json` | Apps Script manifest + OAuth scopes |

## Sundial Helper rules

These do not bend. The helper's tests enforce the first four.

- It never clicks anything, never submits a form, and never presses keys on the page. The teacher makes every click, including every Save.
- It makes no network requests. Pasted rows never leave the teacher's computer.
- It stores nothing. Pasted rows live in memory and are gone when the page reloads, and they are never written to the console.
- It runs only on the pages listed in its manifest. Until the tech office approves, that means the practice page only.
- It never guesses. A student is filled only if their name matches exactly one pasted row, and a grade only if it is one of the page's own options. It leaves fields that already have a value alone unless the teacher says otherwise.
- There is no AI inside the helper. It is plain code that does the same thing every time.
- Made-up students only, in code, tests, sample data, screenshots and pull requests. Never save or copy a real Sundial page.

## Setup (Teacher Instructions)
1. Open a Google Sheet → **Extensions → Apps Script**
2. Copy each `.gs` and `.html` file into the Apps Script editor
3. Paste `appsscript.json` into the manifest (View → Show manifest file)
4. Save, reload the Google Sheet — the **"Canvas Tools"** menu will appear
5. **Canvas Tools → Set Canvas API Token**
   - Canvas URL (e.g., `https://pomfret.instructure.com`)
   - Token from Canvas → Account → Settings → New Access Token
6. **Canvas Tools → Generate Comments Template** — pick grading period + classes → get a Drive folder with one doc per class

## Technical Challenges
- **Google Docs tabs via API**: tab support is new (2024). The code uses the documented `batchUpdate` requests `addDocumentTab` and `updateDocumentTabProperties`, and reads tabs with `documents.get` plus `includeTabsContent: true` (without it, `document.tabs` comes back empty). Built a fallback to page breaks per student if tabs fail; the fallback starts over in a fresh doc and trashes the half-built one.
- **No Sundial API**: Blackbaud's SKY API is not turned on for anyone at Pomfret, including the tech office, and the school prefers that teachers enter grades themselves. Earlier attempts to automate Sundial entry (a school project, an independent study, an IT staff member) were dropped. So the helper works only on the page the teacher is looking at, and every value it fills stays on screen for the teacher to check.
- **No Sundial access for the team**: students can't see the teacher grading page. The helper is built against a practice page. The real page's layout (how a grade is chosen, the comment box, which buttons save or finalize, whether comments save automatically as you type) has to come from a teacher, without any student data.
- **Name matching**: Canvas uses `sortable_name` ("Last, First"); Sundial's format is still to be confirmed. The helper fills a student only on an exact match after small clean-ups (capital letters, spaces, periods, "Last, First" versus "First Last") and skips everything else with a reason.

## Status
🟢 **Phase 1 built**: Canvas to Google Docs generation. Not yet tested with a teacher's account.
🔴 **SKY API plan retired** (Sept 2026): no API access at Pomfret.
🟡 **Sundial Helper**: prototype on a practice page in progress (Oct 2026). Needs tech office approval before any use on real Sundial.

## Next Steps
1. Meet Mr. Ring: does Mr. Lake's grades tool cover his need to see grades while writing, and where does he still lose time?
2. Build the Sundial Helper prototype on a practice page with made-up students, and remove the old SKY API placeholder.
3. Learn the real Sundial grading page's layout from Mr. Lake, with no student data, and ask the tech office to approve testing on a teacher's own account.
4. Test Phase 1 with Mr. Ring's Canvas account.
5. Later: a step that prepares the helper's rows by combining comments from the comment Docs with grades from Mr. Lake's tool.
6. Survey other departments' comment formats, then package everything for all ~90 teachers.

## Contributors

- **Keke Li:** developer; wrote most of the code
- **Cayden Auyang:** club lead; also contributed code
- **James Lake:** developer
- **Magnus Songhurst:** developer
- **Richard Luo:** developer
- **Sasha Khan:** developer
- **Jay Youm:** alumni advisor

## Working on this repo

There is nothing to install: this project is pure Google Apps Script. Edit the `.gs` and `.html` files here, then copy them into the Apps Script editor (see Setup above) to test. Keep the repo as the source of truth and paste changes back here.

- Branch from `main` as `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>` (lowercase, hyphens).
- Every change goes through a pull request with at least one approval. `main` cannot be pushed to directly.
- Never commit secrets. Canvas tokens and Sundial keys live in Apps Script **User Properties** at runtime (set through the dialogs), never in code.
- Cursor rules for this project are committed in `.cursor/rules/`. You do not need to paste anything into your IDE settings.
- The full Git walkthrough for beginners is the club's **[Developer Onboarding Guide](https://github.com/CivicAIClub/docs/blob/main/developer-onboarding.md)**.

## History

This repository was split out of the club monorepo (`CivicAIClub/Civic-AI-Github-Repository`, `projects/case-d-roster-export/`) on 2026-09-18 with full history preserved.
