# Case D: Roster Export Automation

This project helps Mr. Ring and other Pomfret teachers get Canvas rosters into Google Docs for report comments. Its Sundial Helper fills grades and comments for the teacher to check and save; teachers make every click.

## How we work

- This is a standalone project repository. Paths start at its root. The old `Civic-AI-Github-Repository` monorepo is archived; do not edit it or use old `projects/` paths.
- Developers are high school students learning together. Prefer clear code over clever code. If you generate code the developer cannot explain, say so and explain it in plain English.
- Never push to `main`. Work on a branch, open a pull request (PR), and get at least one approving review before merging.
- Use `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>`: lowercase, hyphens, no spaces. Old case prefixes are retired.
- Make small, frequent commits with plain-English messages. Use `.github/pull_request_template.md` for PRs.
- For Git, branching, PRs and merge conflicts, use the club's [Developer Onboarding Guide](https://github.com/CivicAIClub/docs/blob/main/developer-onboarding.md) instead of guessing.

## Commit and PR messages

- Never add `Co-authored-by`, `Generated with`, `Made-with`, `Claude-Session`, or any other AI attribution line to a commit message or PR description.
- When squash merging, delete any such lines GitHub adds to the merge message.

## Stack and project rules

- Comment Docs uses Google Apps Script bound to a Google Sheet, with no server or Python. The repository is the source of truth; copy `.gs` and `.html` files into Apps Script and keep changes here.
- `Code.gs` handles the Canvas Tools menu; `CanvasAPI.gs` reads paginated Canvas courses and rosters with each teacher's own bearer token. `DocBuilder.gs` creates a folder and one Doc per class, with one tab per student; `DocReader.gs` reads comments.
- Keep the page-break fallback working when Google Docs tabs fail. `appsscript.json` must remain valid JSON; add OAuth scopes there when new Google services need them.
- The Sundial Helper in `sundial-helper/` is the approved exception to Apps Script only: a Manifest V3 Chrome extension, plain JavaScript, no build step, libraries or npm dependencies. Put all page layout details in `sundial-helper/src/page-adapter.js`.
- The Blackbaud SKY API approach is retired. Do not extend `SundialAPI.gs`, `SundialSetup.html`, `ExportDialog.html` or the Sundial Export menu, or build new work on SKY API.
- Grades come from Mr. Lake's grades tool. Do not calculate grades here or use Canvas's current score as a Sundial grade.
- Canvas tokens and Sundial/Blackbaud credentials belong in Apps Script User Properties through the dialogs, never in `.gs`, `.html`, Markdown or other committed files. Never hardcode the Canvas token; use `PropertiesService.getUserProperties()`.
- If a developer pastes a real credential into a file, stop and tell them.
- Phase 1 has not been tested with a teacher's real account. The team has no Sundial access; use `sundial-helper/practice/`. A teacher must provide layout details without student data. Sundial's name format is still unconfirmed.

## Sundial Helper safety rules

1. Never click, submit or press keys on the page: no `.click()`, mouse, pointer or keyboard events, `submit()` or `requestSubmit()`. The teacher clicks every Save.
2. Only set values of fields already on screen, then fire `input` and `change` events so the page notices.
3. No network requests: no `fetch`, `XMLHttpRequest`, `WebSocket` or `sendBeacon`. No background script.
4. No storage: no `chrome.storage`, `localStorage`, `sessionStorage`, IndexedDB or cookies. Pasted rows stay in memory; never log rows or student names to the console.
5. The manifest requests no permissions and matches only `http://localhost/*` and `http://127.0.0.1/*`. Tech office approval is required before adding Sundial's address, in its own PR.
6. Never guess: fill only when a name matches exactly one pasted row and a grade is one of the page's own options. Leave existing field values unless the teacher enables overwriting.
7. No AI or model calls inside the helper, and no AI browser tools.
8. Use made-up students only in code, tests, samples, screenshots, commits and PRs. Never save or copy a real Sundial page or include real names, grades or comments.

`sundial-helper/test/safety.test.js` enforces rules 1 through 5. Never weaken it to pass a change; stop and say so if a change requires that.

## Setup and use from the README

1. Open a Google Sheet, then Extensions > Apps Script.
2. Copy each `.gs` and `.html` file into the editor. Paste `appsscript.json` into the manifest using View > Show manifest file.
3. Save and reload the Sheet to see Canvas Tools.
4. Use Canvas Tools > Set Canvas API Token. Enter the Canvas URL and the teacher's token from Canvas > Account > Settings > New Access Token, through the dialog only.
5. Use Canvas Tools > Generate Comments Template, choose the grading period and classes, and get the Drive folder with one Doc per class.

The README provides no extension setup command. Do not invent one. The helper stays on the practice page until tech office approval; Phase 1 still needs teacher-account testing.

## Source disagreements

- `README.md:105` calls the whole project pure Apps Script. Follow `.cursor/rules/case-d-roster-export.mdc:18`, which explicitly approves the Sundial Helper extension as an exception.
- `README.md:54` says tests enforce the first four safety rules; `.cursor/rules/case-d-roster-export.mdc:33` says rules 1 through 5. Follow the project rule and preserve all five.

## Beginner quick start

Full guide: https://github.com/CivicAIClub/docs/blob/main/developer-onboarding.md

1. First time: check Git with `git --version`, set your Git name and GitHub email, accept the club invite, and sign in with GitHub Desktop or `gh auth login`. Clone only your project's repo, open its folder, and read its README setup steps.
2. Start each work session from the latest main, then make a branch:

```sh
git checkout main
git pull origin main
git checkout -b feature/short-description
# Make and check your changes before continuing.
git status
git add .
git commit -m "Describe your change"
git push --set-upstream origin feature/short-description
```

Use `feature/`, `fix/`, or `chore/` as appropriate, with lowercase names and hyphens. Commit small working pieces; do not edit or push main directly.
3. Open a PR on GitHub, fill in the template, and get someone else's approval and passing checks where CI exists. Push review fixes to the same branch. After it is merged, pull main again before starting another branch.
4. If stuck, ask in the case chat, then Keke, then Luke or Cayden. Ask before doing anything drastic.

## Sources

- `README.md`
- `.cursor/rules/case-d-roster-export.mdc`
- `.cursor/rules/civic-ai-workflow.mdc`
- `.cursor/rules/commit-messages.mdc`
- [Developer Onboarding Guide](https://github.com/CivicAIClub/docs/blob/main/developer-onboarding.md)
