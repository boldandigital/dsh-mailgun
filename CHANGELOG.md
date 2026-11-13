# Changelog

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
