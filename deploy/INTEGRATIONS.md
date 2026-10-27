# Optional service activation

The web release works without third-party credentials. Local capture, tasks,
recurrence, daily reviews, finance, prayer calculations, family spaces and native
widget tokens use the application server. Voice dictation uses the browser's speech
service after microphone permission and always returns an editable transcript.

Claude API usage and selling Dailgo Pro are independent. Payment collection remains
**disabled** unless the administrator explicitly sets `BILLING_ENABLED=true` and all
payment settings. No payment gateway is required to use your own Claude account.
When billing is disabled, sharing and advanced statistics remain available in beta.

## Preserve and check the existing installation

The existing release helper backs up SQLite before updating an installed release.
The new tables preserve the primary account and its workspace. Invited accounts use
separate workspaces and session cookies; family tasks live in separate shared spaces.
Personal JSON exports include finance and preferences, while family task exports are
separate. Full administrator SQLite backups include all accounts and server state.

Before enabling any integration, confirm the deployment job succeeded and open the
site with a hard refresh. Test on fixture records first. This repository does not
contain server credentials or perform a live service activation.

## Generate local encryption and Push keys

Review `server/provision.mjs` before running it in the existing root SSH/console
session. It accepts a regular environment file owned by the current administrator
with mode `0600`. It preserves existing values, refuses incomplete key pairs, keeps
a private backup and prints names/paths only, never key values.

```sh
/opt/dailgo/node/bin/node /srv/personal-os/current/server/provision.mjs /etc/personal-os.env --dry-run
# After reviewing the missing names:
/opt/dailgo/node/bin/node /srv/personal-os/current/server/provision.mjs /etc/personal-os.env
```

This generates `INTEGRATION_ENCRYPTION_KEY`, a matching VAPID key pair and a VAPID
subject using the configured HTTPS origin. It does not create provider accounts,
change SSH permissions, send notifications or enable billing. Keep the encryption
key with the private server configuration backup; replacing it prevents reading
existing encrypted Google credentials. Do not paste the environment file or private
keys into chat, CI logs or browser settings.

## Claude

Edit the existing `/etc/personal-os.env` in the server's private editor. Enter the
actual key and a model identifier enabled in your Anthropic account. Placeholders
below must not be used as credentials:

```dotenv
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
ASSISTANT_FREE_DAILY_LIMIT=20
ASSISTANT_PRO_DAILY_LIMIT=200
ASSISTANT_SERVER_DAILY_LIMIT=200
ASSISTANT_BUDGET_TIMEZONE=Africa/Cairo
ASSISTANT_MAX_TOKENS=4096
ASSISTANT_CONTEXT_CHAR_LIMIT=24000
```

You can change the personal allowance without a payment gateway. The server-wide
allowance caps all accounts together. Calls that reach the provider count toward
allowances even if the response cannot be used. Rate limits, output tokens and
context size are also bounded. Set an independent spend limit in Anthropic's console;
request limits cannot guarantee a currency amount across different model prices.

The browser asks for context-sharing consent. Only selected tasks, goals, events,
text memories and recent messages in the selected scope are sent. Attachments,
financial records, other accounts and family boards are excluded. Truncated context
is identified in the proposal. Provider request results are cached for up to 48 hours
for safe retries; full workspace replacement/permanent forgetting clears cached
response bodies while retaining temporary usage accounting.

Tool calls produce proposals only. Supported proposals create tasks/goals, decompose
an existing goal without replacing its earlier milestones, update task planning
fields and plan a day. Confirmation writes the proposal atomically; changed targets
block it. Undo refuses later edits and new dependent records. No model output can
run shell commands, send messages, charge a card or directly commit workspace data.

## Email

Use your chosen SMTP provider and its verified sender. Configure privately:

```dotenv
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

Port 587 requires STARTTLS; use port 465 and `SMTP_SECURE=true` for implicit TLS when
supported by your provider. Certificate verification remains enabled. Configure the
sender domain's SPF/DKIM as required by that provider. Save and verify the recipient
address from Life tools → Connections before enabling email reminders.

## Push

Use the generated VAPID keys. In Life tools → Connections, request notification
permission, register the device, enable the desired channels and save. On iPhone,
web Push requires installing the web app on the home screen using a supported iOS
version. The native Today widget companion does not register web Push.

Morning, evening, due/planned tasks and starting appointments can be selected. Task
and appointment alerts are capped separately at ten per day. Appointment alerts use
a fifteen-minute delivery window; reminders are checked once per minute while the
service is running. Lock-screen details are hidden by default. The explicit test
button sends one requested test notification; delivery must be checked on the device.

## Google Calendar

Create an OAuth web client in the intended Google project. Configure this exact
redirect URL for the current domain:

`https://dailgo.decoderz.dev/api/calendar/callback`

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Keep the generated INTEGRATION_ENCRYPTION_KEY unchanged.
```

Use Google's test-user/consent configuration until the OAuth application is approved
for your intended audience. The requested `calendar.events` scope supports the
explicit import/export features. OAuth uses a short-lived, one-use browser proof
cookie and validates the initiating session; normal login cookies remain Strict.
Refresh/access tokens are encrypted on the server and never returned to the browser.

Connect from Life tools → Connections. Import previews support pages and date ranges
up to 90 days. Existing imports update only with an explicit choice and revision
checks. Export confirms one appointment in the primary calendar, using a stable
Google event ID. Ambiguous/nonexistent daylight-saving times are rejected. Disconnect
revokes Google access; imported local records and previously exported Google events
remain independent copies. Automatic continuous synchronization is not enabled.

## Optional paid Pro

Leave this off until the owner chooses a supported payment provider and pricing.
A Stripe adapter is prepared, but creating accounts, legal/tax configuration and live
checkout verification have not been performed.

```dotenv
BILLING_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
```

If Stripe is chosen, configure a recurring fixed-amount price and the webhook URL
`https://dailgo.decoderz.dev/api/billing/webhook`. Subscribe to subscription
created/updated/deleted events. Start with Stripe test mode. Entitlement changes
require a verified webhook signature and a fresh provider subscription lookup;
client-side checkout parameters cannot grant Pro. Existing data export and access do
not depend on Pro. Paid activation gates new sharing and larger AI allowances; the
30-day analytics view is gated in the UI. Existing shared spaces remain accessible.
Pro still has explicit administrator cost limits and is not advertised as unlimited.

## Apply configuration and verify

After editing only this application's private environment file:

```sh
systemctl restart personal-os.service
systemctl is-active personal-os.service
```

Use the browser's integration status panels and provider dashboards to verify each
feature. Do not print `/etc/personal-os.env` or `systemctl show Environment` into logs.
No other hosted site's service, Nginx configuration or firewall is changed by this
setup. Account passwords and private SSH keys are not needed in chat.

## Native widgets and rollback

See `native/README.md` for Android and iOS build, signing and device steps. Linux
checks cannot validate Android/iOS SDK compilation or physical-device delivery.
The native CI jobs produce an Android debug APK and build an unsigned iOS simulator
application; store distribution needs the owner's signing accounts and profiles.

This release adds personal finance/prayer state keys and account tables. It reads
older data, but older application versions may reject the new state keys. Before a
manual downgrade, retain a fresh full database backup and decide how new work will
be preserved. Do not blindly restore an old database over new writes. Automatic
health rollback occurs before routine user use, and does not perform a destructive
data downgrade. The legacy account/table and owner cookie remain compatible; new
member cookies are never interpreted as owner sessions by an older release.
