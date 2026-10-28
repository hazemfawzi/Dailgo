# Readability and core-flow rollout

This release changes application code. Local and mocked-provider tests do not prove
that CI passed, a VPS deployed, or Claude/email/Push delivered live requests.

## Database compatibility

Take a verified backup before deployment. Existing personal and family snapshots
migrate to account-scoped SQLite rows on first access. Normal saves change only the
rows that differ; the default also refreshes a legacy JSON projection for downgrade
compatibility. No records are discarded or replaced with sample data.

After acceptance, `WORKSPACE_RECORDS_ONLY=true` stops per-write legacy snapshot
rewrites. This is an administrator choice, not enabled by the application release.
Graceful shutdown projects current records for rollback. Before any downgrade,
stop writes and use the **new release's** maintenance program with the existing
private environment loaded:

```sh
/opt/dailgo/node/bin/node /srv/personal-os/current/server/maintenance.mjs project-legacy
```

Then verify the projection/backup before switching releases. A crash without a fresh
projection in records-only mode requires running that command first. Older releases
cannot read normalized rows. Old-release edits are detected and reimported when the
new version returns. Keep the database and environment outside release directories.

## Event stream and offline access

Nginx must allow long-lived `/api/workspace/events` responses. The server sends
`X-Accel-Buffering: no` and heartbeats; avoid proxy buffering and short read timeouts.
The stream contains only revision/family signals and remains account authenticated.
If unavailable, the client uses a slower 60-second fallback.

Offline editing is off by default. Enable it only on a private device. IndexedDB
contains unencrypted personal records and pending edits; no password or session token
is saved there. A cached app shell is required for offline reload. Browser eviction,
manual site-data deletion and shared-device access remain limitations. Sync requires
the original account and explicit choices for overlapping changes. Family data and
external actions are not part of the offline outbox. Export is still available, but
full restore, permanent purge and logout wait until pending edits are resolved.

## Backup encryption

`BACKUP_ENCRYPTION_KEY` is an optional 32-byte hexadecimal secret. Set it only in the
existing private server environment; never put it in Git, chat, command arguments or
client bundles. `server/provision.mjs --backup-key` supports explicit provisioning;
review its dry run before running it on the VPS. This release does not run provisioning.

The maintenance `backup` command then writes `.sqlite.enc` using AES-256-GCM and
verifies decryption and SQLite integrity before deleting its temporary plaintext.
`decrypt-backup SOURCE NEW_DESTINATION` uses the privately loaded environment and
refuses an existing destination. Store a separate secure copy of the key; losing it
loses encrypted backups. Existing plaintext backups and manual JSON exports are not
retroactively encrypted. Securely manage their retention separately.

Live SQLite encryption requires encrypted host storage/volumes and a maintenance
plan. No disk conversion is performed by this release, especially on a VPS shared
with other projects.

## Claude and account sessions

The Home capture entry opens the assistant. Provider requests require browser consent;
tool proposals still require explicit confirmation and offer protected undo. The
server key and an enabled model are configured privately as described in
[Integrations](../deploy/INTEGRATIONS.md#claude). Start with a small server-wide daily
allowance and an Anthropic console spend limit, then test a preview before accepting
changes. No real provider call or private VPS configuration is part of local tests.

Login derives a password hash even for unknown usernames. Sessions slide with use;
normal sessions have a 12-hour idle window and seven-day absolute limit. Remember me
uses 30 days idle and 90 days absolute. Old sessions keep their original expiry.
Unexpected server errors return 500 with a request identifier and redacted structured
logs; expected input errors remain 4xx. Logs must still follow host retention policy.

The existing Dailgo name remains in use; final public branding is a product decision.
