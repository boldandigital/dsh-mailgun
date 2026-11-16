# Changelog

## 0.1.7

The settings page did not show the accounts that were already saved. The
connection route answered a read with the bare account list while every
other answer — the save, and the raw web route — used the `{ ok, value }`
envelope. The browser read the bare answer as a failure, so the list stayed
empty and the page said "No Mailgun account yet" while the accounts sat in
the store. The route now answers in the one envelope, and the browser
accepts a bare payload too, so a different shape can never empty the list
silently again. The list is also read back from the backend after every
action, instead of trusting the answer of the action.

An account is an accordion item now. The collapsed line carries the label,
the sending domain and the badges, and the form opens when the line is
clicked. Collapsed is the standard state, also for an account that was just
added.

## 0.1.6

The settings section saved nothing. Every control in it called a `useState`
pair as if it were the setter, which threw a TypeError inside the click
handler before any request left the browser: "Add Mailgun account" never
opened the form, and "Save" on an account card never sent anything — without
an error message, because the throw happened before the request was made.
The value and the setter are now two separate bindings.

"Test connection" reported zero sending domains: the backend answers a test
with the domain list beside the fresh account list, and the client read the
wrong half of that answer.

"Make default" failed with "An account needs at least a label or a sending
domain": the action names only the account id, and the backend read that as
an empty account. It now takes the stored account as the base, so the
account keeps its fields.

The add form also updates one field at a time now. Two edits before the next
render could overwrite each other with a stale copy of the draft, which lost
a typed value.

## 0.1.5

Added this changelog, and the repository now carries the CI check and the
publish workflow the other plugins have.

## 0.1.4

The account list keeps every account. Adding a second Mailgun account
replaced the first one when both carried the same label: the account id was
derived from the label, so a new account looked like the account that
already owned that label and the save overwrote it. The id is now only kept
when the browser names one, which is what tells an edited account apart from
a new one, and a new account never lands on an id that is already in use.

The **Add Mailgun account** form also had no API key field and closed after
each save, so adding a second account meant a round trip through the button.
It now takes the key, stays open after it saves, and clears the fields for
the next one.

## 0.1.3

The Settings page now shows the plugin's own artwork in the navigation, the
same mark the Plugin Manager shows for the plugin row.

## 0.1.2

The settings section appears at all. The client half called a React hook
from the plugin registration instead of from a component render, which React
rejects; the module then registered nothing, so neither the section nor its
icon was ever there. The hooks moved into the components.

The plugin also grew the display metadata the host reads — a title, a
description and the artwork — so the Plugin Manager row shows Mailgun
instead of the package name.

## 0.1.1

Declared compatibility with DSH 0.2.2-rc.3 and later
(`engines.dsh: ">=0.2.2-rc.3"`).
