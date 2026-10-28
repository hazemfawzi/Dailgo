# Dailgo — Personal AI Operating System

A React + TypeScript + Vite application with a primary private account, invited family accounts and separate shared spaces backed by a loopback-only Node/SQLite server. Sign-in opens the server workspace; changes save automatically with revision conflict protection. Existing browser data can be imported explicitly without deleting its local copy. See [Connected workspace](docs/server-workspace.md) for architecture, API routes, migration and tests. Branding is centralized in `src/config/branding.ts`; the temporary product name is not a company identity. Arabic RTL, English LTR, light/dark themes, mobile navigation and desktop navigation are supported.

## Run and verify

```powershell
npm ci
npm run build
npm run server
# In another terminal:
npm run dev -- --strictPort
# Validation:
npm test
npm run test:server
npm run test:features
npm run test:browser
npm run test:production
npm run test:deploy
```

Open http://127.0.0.1:5173/. Vite serves browser-history routes during development. Production hosting must route unknown paths to index.html. Automated verification includes domain tests, isolated server/API tests and Playwright browser workflows. See the connected workspace guide for details.

## Current release

[Product checklist](docs/PRODUCT_PLAN.md) covers the daily journey and review fixes.
[Optional integrations](deploy/INTEGRATIONS.md) explains server-side Claude, verified
SMTP, Push, encrypted Google Calendar OAuth and the deliberately disabled Pro payment
adapter. Claude usage does not require selling a subscription. All provider changes
are opt-in; tool proposals require confirmation. [Native widgets](native/README.md)
include Android and iOS companion sources and separate CI builds.

## Implemented flows

- Home: My day with date navigation, planned steps and goal links, atomic task/focus start, editable dated result notes with explicit completion, daily/weekly result summaries, three explained next steps, hide a suggestion for today, daily agenda, review-due waiting work, routines, goals, task-linked focus sessions, daily reflection, and a voluntary week-long trial with self-reported measurements. Mobile places next steps above the large briefing.
- Tasks: create/edit, subtasks, tags, estimates, priorities, pinning, duplication, filters, list/board, bulk actions, archive/restore, recoverable deletion. States are todo, doing, waiting, blocked, deferred, cancelled and done. Optional reason, waiting party and review date. Waiting, blocked and deferred tasks do not reserve flexible work time or move automatically. Cancelled tasks are excluded from progress and overdue counts.
- Goals and projects: distinct record types. Projects optionally serve a goal. A task can belong to a project and its parent goal without making duplicate records. Changing a project's parent updates its task links atomically. Goals retain milestones. Task completion percentage is separate from manually assessed outcome achievement and success criteria.
- Planner: task dates distinguish execution from deadlines. Weekly results have editable completion criteria and a configurable count. Per-day total capacity and reserve, workload warnings, appointment overlap detection, union of occupied appointment time, and midnight crossings. Old event durations remain explicitly estimated. Rollover previews let users choose each new date or leave the task behind, with projected load. Old weekly notes remain accessible after changing week-start preference.
- Calendar and routines: local event CRUD, date/time/duration editing, overlap warnings, and optional weekday repetition for routines. Optional server reminders require configured email or Push services and explicit opt-in.
- Capture: shared plus button, multi-item Arabic/English rule-based suggestions, editable previews, required appointment date/time, source provenance and atomic idempotent confirmation. Clear unsupported language is kept for user review rather than fabricated understanding. Drafts are in-memory and do not survive reload.
- Memory: notes/preferences/decisions/personal information, source, explicit/inferred/unspecified basis, context, expiry, decision alternatives and rationale. Expired memories are omitted from new summaries. Potential contradictions require equal title, kind, life area and context; they are flagged for review, never automatically merged.
- Action center: searchable requests from active and archived conversations, status/date filters, details and direct conversation links. Undo previews protect edited, linked and legacy records; confirmation rechecks the preview and atomically moves unchanged targets to recoverable Trash. Partial undo and its counts remain in the conversation. No permanent deletion occurs in this flow.
- Assistant: compound Arabic/English requests produce editable per-item previews (type, area, title, date/time and details), with item exclusions and whole-batch confirmation/cancellation. Required appointment details block the entire batch. Stable IDs, latest-preview checks, atomic confirmation and source provenance prevent duplicate or stale execution. Local mode uses rules; optional Claude mode uses scoped server-side tool proposals with confirmation and protected undo. Also includes scripted local responses, area/context selection, reply timestamps, source-record references, editable action previews, explicit missing-date/time questions, confirmation/cancellation, persistent conversations and recoverable deletion. An action and its confirmation are committed in the same snapshot. Old messages with no timestamp are labelled accordingly. External model calls require server configuration and user consent; proposed workspace changes still require confirmation.
- Search: shared top-bar search across tasks, goals, projects, appointments, routines, memories, archived records and captured source text.

## Data protection

The authoritative store is the authenticated SQLite server workspace, with per-record tables and atomic revision-protected delta commits. SSE announces changes from other devices. A legacy snapshot projection is retained by default for rollback. The legacy browser store is `personal-os.workspace.v3`. The following browser migration/recovery details describe that preserved legacy copy. Existing known LocalStorage keys migrate without resetting records. Legacy keys remain historical recovery material until a permanent purge clears them; they are not read after the authoritative snapshot exists.

Writes validate data and retain the last saved snapshot when storage fails. Corrupt JSON/data blocks normal writes instead of silently overwriting it with defaults. The data dialog offers a raw recovery download. Supported browsers use Web Locks to serialize writes, and storage events refresh open tabs. Per-item revisions reject stale task/entry/goal editor saves and keep their draft visible on failure. On browsers without Web Locks, revision checks alone cannot guarantee protection against precisely simultaneous writes. Text fields with immediate autosave are not a collaborative text editor.

Backups are versioned JSON and include settings, all workspace collections, history, archives, focus sessions, daily reviews, trial measurements and recoverable deletions. Import validates the file, previews replacement and rejects changes made since preview. Restore writes the complete snapshot once. Backup files are unencrypted and must be kept privately; backup downloads are manual, not automatic cloud backups.

Task and entry histories record changed fields and before/after values. Legacy creation times are not invented. Deletion moves records into Recently deleted in the data dialog. Restore preserves IDs, links and previous history. A separate explicit permanent-delete confirmation removes the recovery record, tracked direct references, associated capture-source/history copies and source action/summary messages. Shared capture sources may be cleared from related records. It also clears legacy storage keys. Independent copies manually typed elsewhere and previously downloaded backup files cannot be identified or erased automatically. History and recovery storage count against browser storage capacity; export a backup before major changes.

Planning settings choose Saturday/Sunday/Monday, total daily minutes, reserve and timezone. Appointment times are wall-clock values in the chosen zone: changing the zone reinterprets existing times rather than converting them. Date-only arithmetic preserves calendar days. This is not a timezone conversion service or a DST ambiguity resolver.

## Recommendation coverage and remaining work

The local reliability, capture, task lifecycle, daily/weekly review, scheduling, provenance, explainable ordering, memory correction, recoverable deletion and measurement portions of the supplied development analysis are implemented as prototype features. Tests cover domain calculations, persistence failures and corruption, stale editors, backups/restores, duplicate prevention, history/recovery, forgetting, projects, calendar conflicts and memory context boundaries.

Manual UI checks covered Arabic mobile/desktop rendering, waiting-state editing and source links, focus session logging and daily review persistence after reload, global search, assistant preview edits and confirmation after reload, deletion and restoration, appointment overlap warnings, and project creation with a linked goal and task.

Optional services (Claude, email, Push, Google Calendar and billing) require administrator configuration; tests use mocked providers and do not establish live vendor delivery. Billing remains disabled by default and is independent of Claude. Native widgets have companion sources and CI build definitions; signing and physical-device acceptance remain separate release gates. Personal offline editing is an explicit trusted-device opt-in; Notion integration remains outside this release.

New accounts start without seeded sample goals. Goal templates create records only after explicit confirmation. A real full-week trial remains necessary to assess usefulness with actual commitments.

## Source organization

`src/features/` contains home, tasks, life, planner, assistant, memory, capture, review and settings. Shared UI primitives live in `src/components/ui`; persistence, validation, audit and forgetting live in `src/lib`. Routes load lazily. Local styling uses shared CSS/Tailwind and existing Radix/shadcn-style components, with Lucide icons.

## New local capabilities

- Keyboard skip link, render-error recovery, narrower mobile header and a collapsible home briefing.
- Drag/drop task states and weekly execution dates, retaining select controls for keyboard/touch use.
- Finite daily/weekly/monthly copies of saved tasks and appointments. Each copy is independent; creation requires preview and confirmation. Monthly dates clamp without drifting. No background recurring automation is enabled.
- Memory tags, HTTP(S) reference links and up to three local PNG/JPEG/PDF/plain-text attachments (200 KB each). Files enter backups and consume browser storage. Duplicate merge requires matching title/type/area/context; originals are archived and task references are relinked after confirmation.
- Scripted assistant edits with exact-title matching and before/after previews: rename task, move execution date, edit memory details, archive and restore. Ambiguous targets are rejected. Undo restores prior values only when no later edit occurred; creation undo continues using recoverable Trash.
- Production manifest, generated icons, cached application shell and an install/offline information dialog. Service worker never caches API responses. Updates require an explicit reload action. Offline installation and browser behavior still need manual acceptance testing.

## Connected server workspace

The Node 24 server is required for normal application use. Start it with `npm run server`; use Vite at port 5173 during development, or the built frontend served by the application server at port 8787. Both frontend origins access the same server account and workspace. Sign-in uses HttpOnly SameSite cookies; sessions retain the existing password and origin protections.

All existing feature data saves through the shared server adapter. First use offers explicit migration of browser data or an empty server workspace; setup does not create a personal account. Other devices refresh through SSE and on window focus. Stale online writes are rejected. Opt-in offline edits persist in an account-scoped IndexedDB outbox; reconnection merges independent changes and requires explicit choices for conflicts. Family boards remain online-only.

JSON backup restore replaces the active server workspace after preview and revision checks. SQLite files stay in ignored `.local-data/`, unencrypted at rest. See [Connected workspace](docs/server-workspace.md) for the CRUD/state API, failure behavior, account management and isolated tests.

## External launch gates

Provider-backed AI, external tool connections and public deployment remain disabled pending explicit provider/tool/hosting choices and credentials. Do not put API keys in browser storage or Vite environment variables. A public deployment additionally needs HTTPS, hardened account recovery/session policy, managed secrets, tested backups/restoration, user consent scopes and a completed browser/accessibility/security review. The server deliberately binds only to 127.0.0.1.

## VPS deployment (Node 24)

Production preparation is included in `deploy/VPS.md`: Nginx HTTPS configuration, a restricted systemd service, private SQLite storage, a protected first-account setup token, password reset through protected stdin, and online SQLite backups with a daily timer. Runtime domain validators are generated at `server/domain.mjs`; private databases remain in `.local-data/` locally or the configured absolute path on the VPS.

Build the frontend and server validators before running `node scripts/package-vps.mjs ABSOLUTE_EMPTY_OUTPUT_DIRECTORY`. The resulting package has no runtime npm dependencies. Deployment has not been executed on a remote VPS. Hostname, SSH user, domain and operating system must be confirmed first. AI and external integrations remain disabled; the connected app saves automatically to the server workspace.

## GitHub deployment

[GitHub → VPS setup](deploy/GITHUB.md) documents CI, a dedicated deployment account,
verified release packages, backups and rollback for `dailgo.decoderz.dev`. Deployment
is disabled until repository/environment settings and the existing VPS are prepared.
`npm run test:deploy` validates the deployment controller without changing system services.

## Readability and core-flow release

The Home screen prioritizes quick capture, three next steps and today's agenda.
Planning, focus and reviews remain available in collapsed sections. Mobile navigation
has five destinations; Settings holds appearance and account data controls. Typography
uses shared tokens with a 13px minimum, and keyed Arabic/English catalogs live in
`src/i18n/`. Backend account/workspace routes, authentication, events and record
storage have separate modules.

Run `npm run lint`, `npm run format:check`, `npm run test:core` and
`npm run test:components` alongside the existing build, domain, server, feature,
browser, production and deployment suites. Formatting is isolated in its own commit.
[Rollout, compatibility and remaining server configuration](docs/readability-rollout.md)
describes offline privacy, migration, backups and Claude activation.
