# dsh-mailgun

Mailgun HTTP API tools for DeepSeek Harness: send a message with per-message
open and click tracking, read the delivery and engagement events, list the
sending domains and read the domain counters.

This plugin is **send-and-track only**. Reading mailboxes is the job of the
`dsh-email` plugin, which owns IMAP and SMTP. Mailgun has no mailbox server of
its own, so there is nothing here to read — and the separation keeps a
send-only sending service out of the account list that `dsh-email` manages.

## Several Mailgun accounts

One Mailgun account is one API key and one sending domain, so the plugin
holds a list of accounts rather than a single one. Add them on the harness
**Settings → Mailgun** page: one card per account, each with a label, the
sending domain, the region, the From address and the API key.

The **Add Mailgun account** form stays open after it saves, so a second
account is one more click away instead of another trip through the button.
Several accounts may carry the same label — each one still gets its own id,
its own key and its own place in the list.

Where each piece lives:

| What | Where |
|---|---|
| The account list (label, domain, region, From) | `~/.dsh/data/dsh-mailgun/accounts.json` |
| Each account's API key | the credential store, as the record `dsh-mailgun/<id>` |

The account list is this plugin's own file rather than a section of the
harness settings document, on purpose: the harness settings API is the one
part of DSH whose shape differs between host releases — one exposes a
namespace-registration API (`ctx.settings.register`), another a per-entry form
API (`ctx.settings.update`) — and a plugin bound to either breaks on the
other. The API keys are in the credential store regardless, because that is
where a secret belongs.

The key is **write-only from the browser**: the settings backend reports
whether a key is stored, never its value, so the page never holds a key it
did not just type. The account id is derived from the label
(`Bold & Digital` → `bold-digital`), and it is the id the credential record
is keyed by.

One account is the default; the agent sends from it unless a tool names
another one.

## Install

The plugin is a local package in this workspace. It is registered in the
`desktop` profile as a bundle:

```yaml
# ~/.dsh/profiles/desktop/package.json
"dependencies": {
  "dsh-mailgun": "link:/Users/lars/Documents/deepseek-harness/default-workspace/dsh-mailgun"
},
"dsh": { "profile": { "bundles": [ ..., "dsh-mailgun" ] } }
```

Then link it into the profile:

```bash
cd ~/.dsh/profiles/desktop && pnpm install
```

## Configure

The bundle patch carries only the fallbacks for an install that keeps one
account in the patch rather than on the settings page:

```yaml
- insert:
    - id: mailgun
      name: 'dsh-mailgun'
      config:
        domain: ''            # fallback sending domain
        region: us            # us | eu
        from: ''              # fallback From address
        apiKeyRef: MAILGUN_API_KEY
```

A single-account install may also read its key from the plugin-level
reference instead of the settings page:

```yaml
# ~/.dsh/.credentials.yaml
refs:
  MAILGUN_API_KEY: "key-..."
```

## Tools

| Tool | What it does |
|---|---|
| `mailgun_send` | Send one message. `o:tracking`, `o:tracking-opens` and `o:tracking-clicks` are set on the send itself, so the dashboard toggle does not matter. Returns the Mailgun message id. |
| `mailgun_events` | The event feed: delivered, opened, clicked, failed, complained, unsubscribed. Filter by event name and recipient. |
| `mailgun_domains` | The sending domains on the account with their state. |
| `mailgun_stats` | The aggregate counters for the domain: sent, delivered, opened, clicked, failed. |

Every tool takes an optional `account` (id or label) to choose which
configured Mailgun account to use; it defaults to the default account.

`mailgun_send` takes `to`, `subject`, `text` or `html`, plus optional `cc`,
`bcc`, `from`, `domain`, `tag`, `tracking` (default true) and `testMode`
(validate without delivering).

## Why the HTTP API rather than SMTP

Over plain SMTP, Mailgun cannot set the per-message tracking flags — the
`o:tracking*` options exist only on the HTTP API's `POST /v3/{domain}/messages`
call. SMTP sends therefore arrive with no open or click tracking at all, and
the dashboard-side tracking endpoints do not help either. The HTTP API is the
only path that gives you both the send and its engagement counters.

This is also why the plugin does not reuse `dsh-email` for Mailgun: that
plugin requires every account to carry an IMAP endpoint, which a send-only
sending service does not have.

## Notes

- The API base is `https://api.mailgun.net/v3` for the `us` region and
  `https://api.eu.mailgun.net/v3` for `eu`. The region is per account.
- The key and the sending domain must belong to the same Mailgun account.
- Tracking flags per message: `o:tracking=yes`, `o:tracking-opens=yes`,
  `o:tracking-clicks=htmlonly`.
- The raw web route `/_dsh/dsh-mailgun/settings` is localhost-only, because
  it carries API keys. The browser half uses the connection channel route
  `/api/dsh-mailgun/settings` instead.
- The plugin depends on no harness settings service, so it loads on every
  host release.
- The plugin's own icon is `assets/icon.svg`, exported as `./icon` and read
  by the Plugin Manager for the plugin row. The settings navigation uses the
  same artwork, so the row and the section show one mark.
- The section's visible strings go through the Client locale service under
  the `dsh-mailgun.settings` namespace, in English and Chinese.

## Test

```bash
cd dsh-mailgun && npm test
```

The test loads the browser bundle the way the browser does and checks that
`apply` registers both the `settings.section` and the `settings.section.icon`
contribution. A React hook called from `apply` throws there ("Invalid hook
call") and the settings section disappears without any error in the page —
the test is what catches it.

