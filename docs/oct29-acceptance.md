# October 29 acceptance and remaining server work

## Application changes

Assistant settings (mode, scope, consent and command help) open from its gear button.
Unavailable-provider and configuration information stays in that dialog. Typing,
suggestions and message history remain visible. Sending a Claude request without
consent opens settings; selecting a mode never grants consent automatically.

Week cards show their load and reserve as text; daily overrides open only on demand.
Home disclosures have one shared border, expansion arrows and evening-review status.
The duplicate Home task button is hidden on small screens; the global capture action
and keyboard shortcut remain available. Normal prose/form labels use the body scale.

Arabic date fields accept local day/month/year digits or ISO input and provide a
calendar with localized month/day names, configured week start and min/max bounds.
Arabic time fields use 24-hour text. Callbacks retain ISO date/24-hour time values.
English controls retain native browser editing. Browser mobile emulation is useful
but is not physical Android/iOS/Safari acceptance; test those devices separately.

Frequently edited assistant, week, Home and undo strings now have semantic keys.
Existing hash keys remain for incremental migration and old persisted content.

## Concurrent saves and performance

Online workspace-revision conflicts retry at most twice after a three-way merge.
Independent edits merge; overlapping fields still require review. A stale **record**
revision is not automatically upgraded. Backup replacement/purge do not use that
retry path. Offline conflict review remains explicit.

The delta route validates changed records and collection envelopes, including ID
uniqueness, then validates generated audit/recurrence changes. Whole imports and
legacy full writes retain full validation. Unchanged collections skip audit work.
Prepared SQLite statements are reused per connection instead of per row.

The server still assembles a workspace for dependency checks and delta responses.
Date indexes are not yet the primary client read path. This release does not claim
constant-time record writes or eliminate all workspace reads. That next optimization
requires dedicated indexed read endpoints and dependency-aware transaction design.

## Claude activation when VPS access returns

No live key or SSH access is available in the cloud task. In the existing private
VPS console, edit `/etc/personal-os.env` using `sudoedit`. Preserve all existing
settings and other hosted projects. Set the real Anthropic key and a model enabled
in your Anthropic account privately, following [Integrations](../deploy/INTEGRATIONS.md#claude).
Never paste secrets into this chat or terminal output.

For the first acceptance test, use small limits, for example:

```dotenv
ASSISTANT_FREE_DAILY_LIMIT=5
ASSISTANT_PRO_DAILY_LIMIT=5
ASSISTANT_SERVER_DAILY_LIMIT=10
ASSISTANT_MAX_TOKENS=2048
ASSISTANT_BUDGET_TIMEZONE=Africa/Cairo
```

Set an independent monetary spend limit in the Anthropic console; message limits
alone are not a currency budget. After saving the private settings, restart only
`personal-os.service` and check `systemctl is-active personal-os.service`. In a real
signed-in account, open Assistant settings, verify availability and review the
selected scope before consenting. Test “عايز أذاكر بكرة الساعة 8”: no task should
exist before confirmation; confirm once, verify its area/date/time and test Undo.
Check that a second account/family board does not appear in the supplied context.
A configured status without a successful real request does not prove activation.

## Records-only activation gate

Keep compatibility projections enabled until the deployed release, account data,
backup/restore and concurrent writes pass acceptance. Take a verified SQLite backup
with the existing backup service, and retain the previous release. Then the VPS
administrator can set `WORKSPACE_RECORDS_ONLY=true` in the same private environment
and restart only Dailgo. This task does not change that server setting remotely.

Before a downgrade, stop writes and project records with the new release's
maintenance program as described in [rollout](readability-rollout.md#database-compatibility).
Do not roll back a records-only database after an ungraceful stop without refreshing
its legacy projection. Disk encryption and Anthropic console settings remain host/
account administration work.

## One-week user trial

Use the existing trial/review screens without adding third-party tracking. Each
participant records daily returns and completed focus steps (0–3), plus one friction
point. Review after seven days: days used, returns per day, average completed focus
steps and repeated obstacles. Keep the participant's notes private; aggregate only
what they agree to share. A trial is not complete until real users finish the week.
