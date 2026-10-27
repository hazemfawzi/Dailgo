# Release validation boundaries

Branch: `codex/consistent-arabic-workflow`.

The local release checks use disposable accounts, databases and mocked external
providers. They do not modify the live VPS or call paid APIs.

- Domain: 108 tests (planning, lifecycle, backup, recovery, daily journeys).
- Server: 20 tests (authentication, account snapshots, persistence and deployment contracts).
- Extended features: 21 tests (recurrence, locale formatting, assistant proposals/undo/budgets,
  sharing and isolation, provider protocols, encryption, readonly tokens and key provisioning).
- Browser: 28 scenarios, including Arabic mobile, keyboard shortcuts, account changes,
  recurrent tasks, family task export/import, finance and provider-unavailable states.
- Packaged production: one browser scenario exercises the deployable bundle and one-time
  stale-chunk recovery while preserving saved work.
- Deployment helpers: 12 tests. Production dependency audit: zero reported vulnerabilities
  at implementation time; this is not a guarantee against future advisories.

Android and iOS builds are defined in `native-widgets.yml`; they were not compiled in
this Linux workspace because the native SDKs are unavailable. CI, signing and physical
device acceptance are still required. Browser speech support and notification delivery
also require a supported real device.

No live Claude, SMTP, Push, Google OAuth or Stripe transaction was verified. Configure
selected services privately using [INTEGRATIONS.md](../deploy/INTEGRATIONS.md), then run
their explicit tests. Billing stays disabled; Claude does not require paid subscriptions.

Pushing a branch is not merging or deploying it. Existing CI results and the currently
served release must be checked separately after review. Preserve the deployment helper's
SQLite backup before updating the VPS, which hosts other projects.
