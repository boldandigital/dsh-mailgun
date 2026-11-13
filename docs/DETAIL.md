# Mailgun

Send transactional email through the Mailgun HTTP API, with per-message open
and click tracking, and read back what happened to it.

## What it does

The plugin gives the agent four things, all against the Mailgun HTTP API:

- **Send** a message through a sending domain, with the tracking flags chosen
  per message: open tracking, click tracking, or both.
- **Read the events** for a message — delivered, opened, clicked, failed,
  complained — as the Mailgun event feed reports them.
- **List the sending domains** of an account, so the agent can find the domain
  it is allowed to send from.
- **Read the domain statistics**: the accepted, delivered, opened, clicked and
  failed counters per domain.

## The settings page

**Settings → Mailgun** holds one card per account. A card carries:

| Field | Meaning |
|---|---|
| Label | The name you give the account; the account id is derived from it |
| Sending domain | The domain Mailgun is allowed to send from |
| Region | `US` (`api.mailgun.net`) or `EU` (`api.eu.mailgun.net`) |
| From address | The sender the agent uses |
| Sender name | The display name that goes with it |
| API key | The Mailgun private API key |

**Add Mailgun account** opens a form for a new account. The form stays open
after it saves and the fields clear, so a second account — or a third — is one
more click away. Several accounts may carry the same label: each one still
gets its own id, its own key and its own card, and the agent can be told
which one to use by id or by label.

**Save** stores the account, **Test connection** checks the key against
Mailgun and lists the sending domains it can see, **Make default** marks the
account the agent sends from unless a tool names another one, and **Remove**
deletes the account and its key.

The API key is **write-only from the browser**: the page reports whether a key
is stored, never its value, so a key never sits in the page unless you just
typed it. Keys live in the harness credential store as the record
`dsh-mailgun/<id>`; the account list itself lives in
`~/.dsh/data/dsh-mailgun/accounts.json`.

## Limits

- **Send and track only.** Mailgun has no mailbox server, so there is nothing
  to read. Reading mailboxes is the job of the `dsh-email` plugin, which owns
  IMAP and SMTP.
- **One domain per account.** A Mailgun account may own several sending
  domains; the plugin sends from the one you name on the card.
- **The events feed is Mailgun's own.** It reports what Mailgun observed, so
  an event can lag behind the send by a few seconds.
