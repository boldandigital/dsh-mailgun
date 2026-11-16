# Where this plugin is published

Three channels, all reachable today. This file records what each one needs,
so nothing has to be rediscovered later.

## 1. npm — the install path

The package is published as [`dsh-mailgun`](https://www.npmjs.com/package/dsh-mailgun).

```sh
dsh plugin --profile web add dsh-mailgun
```

npm is the channel the harness itself resolves: `dsh plugin add <name>` looks
a package name up in the registry, and the plugin market index format's
`source: { "type": "npm" }` points at a registry version with its publish time
and its `engines.dsh`. A Git-only plugin cannot be installed with one command
on another machine.

| | |
|---|---|
| Package name | `dsh-mailgun` |
| Registry owner | the npm account that published it (`larsvonhierblau`) |
| Author field | `boldandigital (https://github.com/boldandigital)` |
| Versions | `0.1.2` … `0.1.8` |

The npm **name** is permanent: npm only allows an unpublish within 72 hours
of a release, and the name stays reserved afterwards. Publishing `0.1.9` and
later is the only way forward.

## 2. The plugin market index — the Discover tab

The index is its own repository, published with GitHub Pages:

```text
https://boldandigital.github.io/dsh-plugin-index/index.json
```

Add it under **Plugins → Discover → Manage index sources**, then the plugin
appears in the Discover tab with its icon, its description and its detail
document, and one click installs it.

The index follows the market format version 1 and is validated with
`@deepseek-ai/dsh-plugin-market-index`, the same validator the harness uses.
A daily workflow rebuilds it from the npm registry, so it never names a version
the registry does not have.

There is also a **local** index in this workspace,
`~/Documents/deepseek-harness/default-workspace/dsh-plugin-index-local`, which
serves `http://127.0.0.1:8787/index.json` from a launch agent. It keeps a
hand-checked curated list of repositories and rebuilds `index.json` from them
with `build-index.mjs`.

## 3. dsh-plugin.org — the community hub

A third-party hub, not affiliated with DeepSeek. It has no submission form and
no public listing repository: **the crawler finds plugins by GitHub topic**.

- The repository carries the `dsh-plugin` topic.
- The root `package.json` names the package and points `repository` at this
  owner/repo, which is what binds the npm package to the listing.
- The README carries the install command.
- The submission issue asks a human for the category and flips the entry from
  *unconfirmed* to *verified*.

The entry appears on the site once the crawler has run. The badge
`[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/boldandigital/dsh-mailgun)`
is added to this README at that point — the badge file itself is served for
every URL, so adding it earlier would claim a listing that does not exist.

## 4. The first-party route

`github.com/deepseek-ai/deepseek-harness` holds the **format** and a
**reference generator** for plugin market indexes — it does not carry a
curated list of third-party plugins, and the shipped harness configures **no
index source at all**. A pull request there would therefore mean vendoring the
plugin into the first-party monorepo (TypeScript, their build, their
conventions), which is a different thing from listing a third-party plugin.

## Releasing a new version

The version in `package.json` is what npm publishes, and a release is a tag:

```sh
npm version patch     # 0.1.8 -> 0.1.9
git tag v0.1.9 && git push origin main --tags
```

The workflow in `.github/workflows/publish.yml` publishes the tagged version
with OIDC, so no long-lived token is stored in the repository. It also skips
the publish when that version is already on the registry, so re-pushing a tag
is harmless.

The trusted publisher is configured for this package at
<https://www.npmjs.com/package/dsh-mailgun/settings> with the repository
`boldandigital/dsh-mailgun`, the workflow file `publish.yml` and the
`npm publish` allowed action.
