# Dailgo — Personal AI Operating System

A single-user React + TypeScript + Vite application with browser-local storage and an optional, loopback-only Node/SQLite prototype server. Branding is centralized in `src/config/branding.ts`; the temporary product name is not a company identity. Arabic RTL, English LTR, light/dark themes, mobile navigation and desktop navigation are supported.

## Run and verify

```powershell
npm install
npm run dev
npm test
npm run build
```

Open http://127.0.0.1:5173/. Vite serves browser-history routes during development. Production hosting must route unknown paths to index.html. Automated verification currently contains 88 domain tests and 5 isolated server tests in `scripts/test.mjs`.

## Implemented flows

- Home: My day with date navigation, planned steps and goal links, atomic task/focus start, editable dated result notes with explicit completion, daily/weekly result summaries, three explained next steps, hide a suggestion for today, daily agenda, review-due waiting work, routines, goals, task-linked focus sessions, daily reflection, and a voluntary week-long trial with self-reported measurements. Mobile places next steps above the large briefing.
- Tasks: create/edit, subtasks, tags, estimates, priorities, pinning, duplication, filters, list/board, bulk actions, archive/restore, recoverable deletion. States are todo, doing, waiting, blocked, deferred, cancelled and done. Optional reason, waiting party and review date. Waiting, blocked and deferred tasks do not reserve flexible work time or move automatically. Cancelled tasks are excluded from progress and overdue counts.
- Goals and projects: distinct record types. Projects optionally serve a goal. A task can belong to a project and its parent goal without making duplicate records. Changing a project's parent updates its task links atomically. Goals retain milestones. Task completion percentage is separate from manually assessed outcome achievement and success criteria.
- Planner: task dates distinguish execution from deadlines. Weekly results have editable completion criteria and a configurable count. Per-day total capacity and reserve, workload warnings, appointment overlap detection, union of occupied appointment time, and midnight crossings. Old event durations remain explicitly estimated. Rollover previews let users choose each new date or leave the task behind, with projected load. Old weekly notes remain accessible after changing week-start preference.
- Calendar and routines: local event CRUD, date/time/duration editing, overlap warnings, and optional weekday repetition for routines. No actual notifications are sent.
- Capture: shared plus button, multi-item Arabic/English rule-based suggestions, editable previews, required appointment date/time, source provenance and atomic idempotent confirmation. Clear unsupported language is kept for user review rather than fabricated understanding. Drafts are in-memory and do not survive reload.
- Memory: notes/preferences/decisions/personal information, source, explicit/inferred/unspecified basis, context, expiry, decision alternatives and rationale. Expired memories are omitted from new summaries. Potential contradictions require equal title, kind, life area and context; they are flagged for review, never automatically merged.
- Action center: searchable requests from active and archived conversations, status/date filters, details and direct conversation links. Undo previews protect edited, linked and legacy records; confirmation rechecks the preview and atomically moves unchanged targets to recoverable Trash. Partial undo and its counts remain in the conversation. No permanent deletion occurs in this flow.
- Assistant: compound Arabic/English requests produce editable per-item previews (type, area, title, date/time and details), with item exclusions and whole-batch confirmation/cancellation. Required appointment details block the entire batch. Stable IDs, latest-preview checks, atomic confirmation and source provenance prevent duplicate or stale execution. These use local rules, not language-model understanding. Also includes scripted local responses, area/context selection, reply timestamps, source-record references, editable action previews, explicit missing-date/time questions, confirmation/cancellation, persistent conversations and recoverable deletion. An action and its confirmation are committed in the same snapshot. Old messages with no timestamp are labelled accordingly. There are no model calls or external actions.
- Search: shared top-bar search across tasks, goals, projects, appointments, routines, memories, archived records and captured source text.

## Data protection

The authoritative store is `personal-os.workspace.v3`: one validated snapshot with a revision. Existing known LocalStorage keys migrate without resetting records. Legacy keys remain historical recovery material until a permanent purge clears them; they are not read after the authoritative snapshot exists.

Writes validate data and retain the last saved snapshot when storage fails. Corrupt JSON/data blocks normal writes instead of silently overwriting it with defaults. The data dialog offers a raw recovery download. Supported browsers use Web Locks to serialize writes, and storage events refresh open tabs. Per-item revisions reject stale task/entry/goal editor saves and keep their draft visible on failure. On browsers without Web Locks, revision checks alone cannot guarantee protection against precisely simultaneous writes. Text fields with immediate autosave are not a collaborative text editor.

Backups are versioned JSON and include settings, all workspace collections, history, archives, focus sessions, daily reviews, trial measurements and recoverable deletions. Import validates the file, previews replacement and rejects changes made since preview. Restore writes the complete snapshot once. Backup files are unencrypted and must be kept privately; backup downloads are manual, not automatic cloud backups.

Task and entry histories record changed fields and before/after values. Legacy creation times are not invented. Deletion moves records into Recently deleted in the data dialog. Restore preserves IDs, links and previous history. A separate explicit permanent-delete confirmation removes the recovery record, tracked direct references, associated capture-source/history copies and source action/summary messages. Shared capture sources may be cleared from related records. It also clears legacy storage keys. Independent copies manually typed elsewhere and previously downloaded backup files cannot be identified or erased automatically. History and recovery storage count against browser storage capacity; export a backup before major changes.

Planning settings choose Saturday/Sunday/Monday, total daily minutes, reserve and timezone. Appointment times are wall-clock values in the chosen zone: changing the zone reinterprets existing times rather than converting them. Date-only arithmetic preserves calendar days. This is not a timezone conversion service or a DST ambiguity resolver.

## Recommendation coverage and remaining work

The local reliability, capture, task lifecycle, daily/weekly review, scheduling, provenance, explainable ordering, memory correction, recoverable deletion and measurement portions of the supplied development analysis are implemented as prototype features. Tests cover domain calculations, persistence failures and corruption, stale editors, backups/restores, duplicate prevention, history/recovery, forgetting, projects, calendar conflicts and memory context boundaries.

Manual UI checks covered Arabic mobile/desktop rendering, waiting-state editing and source links, focus session logging and daily review persistence after reload, global search, assistant preview edits and confirmation after reload, deletion and restoration, appointment overlap warnings, and project creation with a linked goal and task.

Intentionally deferred under the user's standalone-prototype direction:

- Real language-model understanding, secure server-side credentials, provider permissions, usage/cost limits and model-specific evaluation.
- External calendar/mail/Notion integrations and all external execution.
- Accounts, encrypted server storage, cross-device sync, background push reminders and native applications.
- A real full-week acceptance trial with the user's actual commitments. The trial screen records self-reported observations; sample data, passing tests and time logs do not establish personal productivity gains or production/security readiness.

No external service is necessary to use the implemented prototype. The eight seeded life goals are illustrative suggestions; only the product-building goal is grounded in the user's stated project.

## Source organization

`src/features/` contains home, tasks, life, planner, assistant, memory, capture, review and settings. Shared UI primitives live in `src/components/ui`; persistence, validation, audit and forgetting live in `src/lib`. Routes load lazily. Local styling uses shared CSS/Tailwind and existing Radix/shadcn-style components, with Lucide icons.







## New local capabilities

- Keyboard skip link, render-error recovery, narrower mobile header and a collapsible home briefing.
- Drag/drop task states and weekly execution dates, retaining select controls for keyboard/touch use.
- Finite daily/weekly/monthly copies of saved tasks and appointments. Each copy is independent; creation requires preview and confirmation. Monthly dates clamp without drifting. No background recurring automation is enabled.
- Memory tags, HTTP(S) reference links and up to three local PNG/JPEG/PDF/plain-text attachments (200 KB each). Files enter backups and consume browser storage. Duplicate merge requires matching title/type/area/context; originals are archived and task references are relinked after confirmation.
- Scripted assistant edits with exact-title matching and before/after previews: rename task, move execution date, edit memory details, archive and restore. Ambiguous targets are rejected. Undo restores prior values only when no later edit occurred; creation undo continues using recoverable Trash.
- Production manifest, generated icons, cached application shell and an install/offline information dialog. Service worker never caches API responses. Updates require an explicit reload action. Offline installation and browser behavior still need manual acceptance testing.

## Optional local server

Tested with Node 24 and its built-in SQLite module. Start with:

```powershell
npm run build
npm run server
```

Open http://127.0.0.1:8787/ for the production build, or continue using Vite at port 5173 (API requests proxy to the local server). The production origin has separate browser storage; it does not automatically inherit the Vite browser records.

Open Data and backup, check the local server, and create the single local account yourself. No personal account is created by setup scripts. Passwords are hashed with scrypt; sessions use HttpOnly SameSite cookies, with login throttling and origin checks. SQLite records are not encrypted at rest. Runtime files live in `.local-data/`, excluded from source control and release packages. This is a local prototype, not a public authentication deployment.

Transfers are manual full snapshots with a confirmation preview. Saving replaces the separate server copy; loading replaces browser records and settings. Both directions check revisions and reject stale previews. Export a backup before replacement. No automatic merge, synchronization, real AI or external integration is enabled.

```powershell
npm test
npm run test:server
npm run preview
```

Domain tests use in-memory data; server tests create isolated fixture databases in the project `.local-data/tests/` directory. They do not sign into or modify the user's live local account.

## External launch gates

Provider-backed AI, external tool connections and public deployment remain disabled pending explicit provider/tool/hosting choices and credentials. Do not put API keys in browser storage or Vite environment variables. A public deployment additionally needs HTTPS, hardened account recovery/session policy, managed secrets, tested backups/restoration, user consent scopes and a completed browser/accessibility/security review. The server deliberately binds only to 127.0.0.1.


## VPS deployment (Node 24)

Production preparation is included in `deploy/VPS.md`: Nginx HTTPS configuration, a restricted systemd service, private SQLite storage, a protected first-account setup token, password reset through protected stdin, and online SQLite backups with a daily timer. Runtime domain validators are generated at `server/domain.mjs`; private databases remain in `.local-data/` locally or the configured absolute path on the VPS.

Build the frontend and server validators before running `node scripts/package-vps.mjs ABSOLUTE_EMPTY_OUTPUT_DIRECTORY`. The resulting package has no runtime npm dependencies. Deployment has not been executed on a remote VPS. Hostname, SSH user, domain and operating system must be confirmed first. AI and external integrations remain disabled; server snapshot transfers are manual.
