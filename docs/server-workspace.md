# Connected workspace

Dailgo preserves its primary private account and SQLite workspace, and supports
invited accounts with separate workspaces. Family spaces share only their own tasks.
Goal links expose explicitly selected goal fields and can be revoked or expire.
Sign-in is required for private account APIs. Cross-tab account changes are rejected
before an old tab can write into another account.

Personal collections include tasks/subtasks, goals, projects, appointments, routines,
memories/attachments, conversations/proposals, focus sessions, plans/reviews, daily
preferences, financial records and optional prayer settings. JSON backup/export
covers that personal workspace. Family exports are separate; full server SQLite
backups include all accounts and integration state. See [optional activation and
rollback](../deploy/INTEGRATIONS.md) and [native widgets](../native/README.md).

## Run

Use Node 24 or newer:

```sh
npm ci
npm run build
npm run server
# In a second terminal for frontend development:
npm run dev -- --strictPort
```

The development app uses port 5173 and proxies `/api` to port 8787. The server also
serves the built app itself on port 8787. Both listeners bind to loopback. Run behind
the existing documented HTTPS reverse proxy for remote access; this change does not
deploy or expose the server. Runtime state stays in ignored `.local-data/` or the
configured `PERSONAL_OS_DB`. Existing accounts and databases remain compatible.

On an empty database, the user creates their own account (minimum password length
12). Production still requires the private setup token; do not automate creation of
real personal accounts. On first sign-in to an empty server workspace, choose either
an explicit import of the browser snapshot or a blank workspace. The local snapshot
is never overwritten or deleted by this migration. If the server already contains a
workspace, it opens directly without replacing it with device data. An old local
snapshot can subsequently be restored through a reviewed backup replacement.

## Persistence and conflicts

The server stores tasks, goals, entries, conversations, focus sessions and deleted
records in SQLite rows, isolated by account. Other workspace values have individual
rows. `PUT /api/workspace/changes` sends a validated record delta and commits it with
history and a workspace revision in one transaction. Unchanged large notes are not
sent again. The full snapshot endpoints remain available for compatible clients and
reviewed backup replacement.

Existing snapshot databases migrate lazily without resetting data. By default a
legacy snapshot projection is retained for safe rollback. Administrators can enable
`WORKSPACE_RECORDS_ONLY=true` after accepting the new release; see
[rollout and rollback](readability-rollout.md) before changing this setting.

Writes compare the observed workspace revision and reject stale online edits with
HTTP 409. Editor drafts remain visible on rejected saves. Authenticated SSE announces
revision changes without sending workspace contents. Focus/online events refresh the
view; a 60-second fallback runs only while the event stream is unavailable.

Offline editing is an explicit per-device opt-in in Settings. IndexedDB keeps a
private account-scoped copy and durable base/draft outbox. The app accepts queued
edits only after local persistence succeeds. Reconnection merges independent fields;
same-field changes and deletions require explicit choices against the current server
version. Family boards, external integrations, full replacement and permanent purge
are not queued. Logout is unavailable while changes remain pending. Expired sessions
retain the outbox for the original account without exposing it to another account.
This local copy is unencrypted; enable it only on a trusted device. Browser storage
can be cleared or evicted, so it is not a backup.

Without that opt-in, network failures reject writes. A lost response can mean the
server already committed; refresh before retrying. A 401 returns the user to sign-in.
The service worker caches application files only, never API responses. An opted-in
account with a cached shell can reopen its private copy offline.

Backup exports contain the active personal workspace and are unencrypted JSON.
Restore replaces that workspace after preview and revision checks. Exports and old
browser copies remain independent: server deletion cannot erase them. The server's
scheduled SQLite backups support optional authenticated encryption; see rollout
instructions. The live database itself still requires host/volume encryption.

## Daily cycle

Fresh blank workspaces start in Arabic without sample tasks. A skippable, three-step
wizard saves language, theme, wake/evening times and week start, then creates one
reviewed template/custom goal, two milestones and three linked tasks in one commit.
Existing workspaces retain their data and language; they can open the setup from Home.

Morning choices store up to three focus tasks and their execution days separately
from due dates. Evening reminders run inside the open app using the planning timezone.
Mood, notes and explicitly selected next-day rollovers persist on the server. Weekly
review saves three next-week results while preserving additional results and capacity.
The six-area radar counts recorded completions, routine check-ins and linked focus
sessions; it does not measure wellbeing or activity outside the app.

Quick capture understands supported date/time phrases and area hashtags with an editable
preview; ambiguous time remains in the title. `N`, `/` and `F` open a task, search, and
focus respectively. Single-key shortcuts ignore text editing; Ctrl/Cmd+K also works inside text fields. All shortcuts ignore open dialogs. Ctrl/Cmd+K opens the assistant and its change history. Task details are collapsed
by default. Expired linked focus sessions record elapsed timer time once and ask before
marking the task complete. Undo is available for twenty seconds after saved completion,
routine check-in or archive, and refuses to overwrite newer item revisions.

## HTTP API

All routes except health, account status, setup and login require the existing
HttpOnly session cookie. Writes require an accepted Origin and JSON content type.
Production additionally enforces the configured HTTPS host/proxy checks.

| Route                          | Methods            | Body / result                                                                                       |
| ------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| `/api/workspace`               | GET                | `{ revision, data }`; empty database returns `data: null`                                           |
| `/api/workspace`               | PUT                | `{ revision, data }`; explicit full replacement for migration/backups                               |
| `/api/workspace/commit`        | PUT                | `{ revision, data }`; validated and audited atomic commit; returns `{ version: 3, revision, data }` |
| `/api/records/:collection`     | GET, POST          | GET returns `{ revision, items }`; POST accepts `{ revision, item }`                                |
| `/api/records/:collection/:id` | GET, PATCH, DELETE | GET returns `{ revision, item }`; writes accept `{ revision, item? }`                               |
| `/api/state/:name`             | GET, PUT           | GET returns `{ revision, value }`; PUT accepts `{ revision, value }`                                |

Record collections: `tasks`, `goals`, `projects`, `events`, `routines`, `memories`
(notes, preferences, decisions and personal records), `conversations`, `sessions`.
State names: `language`, `theme` (boolean dark mode), `planning`, `focus`, `weeks`,
`reviews`, `suggestions`, `trial`. Data shapes match `src/lib/storageCore.ts`.
Record/state writes return the committed workspace. PATCH preserves record IDs and
server-owned audit fields. Deleting tasks, entries or conversations moves them into
recoverable Trash. Unknown resources return 404; unsupported methods return 405;
stale revisions return 409; invalid data returns 400 without a partial write.

The existing full replacement route deliberately preserves imported history rather
than generating new history for every restored item. Clients should use the audited
commit or record API for normal changes.

## Verify

```sh
npm test
npm run build
npm run test:server
npm run test:features
npm run test:browser
npm run test:production
npm run test:deploy
```

Browser tests use a temporary database, a dedicated Vite port (5187), and an ephemeral
backend port, with fixture accounts only. They do not use the real `.local-data`
account. Playwright uses `/usr/bin/chromium` when installed; otherwise run
`npx playwright install chromium`, or set `DAILGO_BROWSER_PATH` to an installed
compatible browser. SQLite tests cover authenticated CRUD, all entry kinds, planning,
conversations/sessions, audited atomic changes, stale writes and Trash.

Local capture remains rule-based. Optional Claude calls run on the server with
scope, context size and usage limits, returning proposals without direct writes.
SMTP, Push, Google OAuth and optional Pro billing are disabled until configured.
Background delivery is opt-in and cannot be verified through local fixture tests.
All accounts share the server's configured provider budget, while their workspace
content remains isolated. Shared family tasks never enter the assistant context.

Recurring completion generates one next occurrence in the same audited commit.
Undo removes an untouched generated occurrence and refuses a newer edit. Monthly
recurrence retains its original anchor day across shorter months. Goal templates
are available both during onboarding and later in My Life. Dates are stored as ISO
keys; display dates, times, counts and Arabic plural forms use the shared formatters.
Native date/number inputs retain browser-controlled editing formats.

A missing deployed lazy chunk triggers one guarded reload after pending writes are
acknowledged. Open dialogs or storage errors keep the manual recovery path. Production
browser tests run the packaged artifact and simulate this failure, separately from
Vite development-browser tests.
