### Repository
https://github.com/boldandigital/dsh-mailgun

### One-line value
Send email through the Mailgun HTTP API with per-message open and click tracking, and read the delivery and engagement events back — several sending domains side by side, with the API keys in the harness credential store.

### Category
Integrations & Connections

### Install command
dsh plugin --profile web add dsh-mailgun

### Compatibility
DSH 0.2.2-rc.3, macOS / Linux / Windows, Node 22+.

### License
MIT

### Screenshots / demo
The plugin adds a "Mailgun" section to the harness Settings page. Each configured account is an accordion item: a collapsed line with the label, the sending domain and the badges, opening into the form when it is clicked. The same operations are exposed to the agent as four tools (mailgun_send, mailgun_events, mailgun_domains, mailgun_stats), so the agent can send and then read the delivery counters back. The repository README describes the settings layout and the tool contract.

### Notes
This plugin is send-and-track only. Reading mailboxes is the job of the separate dsh-email plugin, which owns IMAP and SMTP — Mailgun has no mailbox server of its own, and keeping the two apart stops a send-only sending service from appearing in the account list dsh-email manages.

The plugin uses the Mailgun HTTP API rather than SMTP on purpose: the per-message tracking flags (o:tracking, o:tracking-opens, o:tracking-clicks) exist only on the HTTP API's POST /v3/{domain}/messages call, so an SMTP send arrives with no open or click tracking at all.

Several Mailgun accounts are supported, because one Mailgun account is one credential and one sending domain. The account list (label, domain, region, From address) lives in ~/.dsh/data/dsh-mailgun/accounts.json, and each account's API key lives in the harness credential store as the record dsh-mailgun/<id>. The key is write-only from the browser: the settings backend reports only whether a key is present, never its value, so the page never holds a key it did not just type.

Network access is limited to the Mailgun API host named by the account's region (api.mailgun.net or api.eu.mailgun.net). The plugin renders one entry in the settings.section slot and writes no files of its own beyond the account list in the harness home directory.

### Pre-submission checklist
- [x] Repository is public
- [x] GitHub topic `dsh-plugin` added
- [x] README includes the install command
- [x] Plugin exports an `apply(ctx)` module
- [x] Repository root includes a `package.json`
