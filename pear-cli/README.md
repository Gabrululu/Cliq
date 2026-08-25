# CLIQ CLI — Pear Track submission

Submission for the "Pears" (Tether) track of Aleph Hackathon 2026: CLIQ's real CLI ([CLIQ](../README.md)) packaged as a standalone binary, P2P-installable with `pear install`, with OTA updates.

## Where it starts from

Starts from the official [`hello-pear-bare`](https://github.com/holepunchto/hello-pear-bare) boilerplate, **`variant/daemon`** branch — built for short git-like commands (the process runs and exits while a detached daemon checks for updates in the background), which is exactly CLIQ's usage pattern (`invoice create`, `pay`, etc.), unlike a long-lived TUI/service.

The boilerplate's update mechanism (`bin.mjs` / `app.js`, based on `pear-runtime` + `bare-daemon`) was kept intact. What was added is CLIQ's real CLI (`src/`, ported 1:1 from the repo root) wired up as the command that runs after the updater starts in the background.

## What it includes (and what it doesn't)

Includes all of CLIQ **except the `ask` assistant (QVAC)**:

- `init`, `wallet address/balance/generate-seed`
- `invoice create/show`, `pay`, `ledger`
- `receipt show/verify`
- `sync --room`, `peers --room`

`ask` was excluded because `@qvac/sdk` weighs ~6GB with native binaries for every platform — it's the biggest risk of the standalone build (`bare-build`) failing or taking too long under the hackathon's deadline, and it adds nothing to validating "installs + updates OTA", which is what this track asks for.

## How to install it (the same way a judge would)

```
pear install pear://mp8yxd4xro9apkxpsgp34upeuqhdyhem64r7wbtqigjuac9qqemo
```

This downloads the standalone binary (~119MB, no need for Node/Bare/Pear installed) directly from a peer and leaves it ready to use:

```
cliq-cli --version
cliq-cli --no-updates help
cliq-cli --no-updates wallet generate-seed
```

`--no-updates` is optional — without that flag, every run triggers an OTA update check against the same link in the background.

## Local build (to reproduce the binary)

```
cd pear-cli
pnpm install
# pnpm is strict about node_modules; bare-pack (used by bare-build) expects
# flat/npm-style resolution. That's why there's a .npmrc with shamefully-hoist=true.
# Also, 'ws' (a transitive dependency of @tetherto/wdk) optionally tries to require
# 'utf-8-validate' and 'bufferutil' (try/catch) — bare-pack still needs to
# resolve them statically. There are minimal stubs in
# node_modules/{utf-8-validate,bufferutil} that need to be recreated after every
# reinstall (they're not real npm packages, they're local shims).
npm run make:linux-x64   # or make:darwin-*/win32-* on the matching host
```

The resulting binary (`out/linux-x64/cliq`) gets copied to `deploy/by-arch/<host>/app/cliq-cli` — that's the folder structure `pear install` expects (`/by-arch/<platform>-<arch>/app/<name>`, with `<name>` = the `"name"` field from `deploy/package.json`). It gets staged from inside `deploy/` (which has its own `package.json`, separate from the dev one) so `node_modules`/`src` don't accidentally get uploaded to the drive — only the final binary.

**On Windows the final binary needs the `.exe` extension** (`deploy/by-arch/win32-x64/app/cliq-cli.exe`, not plain `cliq-cli`): `bin.mjs` builds the name the updater looks for on the drive with `isWindows ? pkg.name + '.exe' : pkg.name` (a line already present in the boilerplate, didn't need touching) — but if you forget the `.exe` when copying the built binary into `deploy/`, the updater won't find it.

## Platforms built

**linux-x64** and **win32-x64** (Windows) — the local `win32-x64` build was reproduced and validated end to end on 2026-08-24 against the real network: `pear stage`, `pear install` (real P2P download, ~65MB), and an OTA update (`--updater`, detected and applied a new update in ~3.4s), all run on native Windows, no WSL. **macOS** is still missing — a host on that platform (or CI with that runner) is needed to cross-compile with `bare-build`; to reproduce that or any other build, run `npm run make:darwin-arm64` / etc. from a host on that platform and copy the result into its own `by-arch/<host>/app/` folder.

**Note on this binary's link:** the Windows build was published to a new link (`pear://mp8yxd4xro9apkxpsgp34upeuqhdyhem64r7wbtqigjuac9qqemo`), different from the one originally used for the linux-x64 build. The session where the original link was generated (via `pear touch`) was ephemeral and its Pear private key isn't available on this machine, so publishing couldn't continue there — every `pear touch` generates a new identity/key, and only whoever generated it can keep staging to that link. If that original key is ever recovered, both builds (linux-x64 and win32-x64) can be re-staged together on a single link.

## OTA update status

**Validated end to end against a real install.** With `cliq-cli` installed via `pear install` at `0.0.4`, a new `0.0.5` was staged on the same link, and the update daemon was run against the installed copy (`cliq-cli --updater --storage <dir> --update-window 150000`). Real log:

```
info  [updater] getting new update
info  [updater] { op: 'add', key: '/by-arch/linux-x64/app/cliq-cli', bytesAdded: 119309064 }
info  [updater] update complete... applying
info  [updater] applied update, restart to run latest version
```

`cliq-cli --version` went from `0.0.4` to `0.0.5` on its own, in ~2 seconds once the check started — no real-network slowness at all.

Two real bugs showed up and got fixed along the way:

1. **`--update-window` is in milliseconds, not seconds** (as its own `--help` says). Passing `90`/`180` (i.e. 90-180*ms*) made the updater close almost instantly, before the swarm got the chance to connect to any peer — it looked like "can't find anything" but it actually never had time to try.
2. **`productName` vs `name` in `package.json`**: `bin.mjs` built the updater's name using `pkg.productName` ("cliq"), but `pear install` builds the binary's path on the drive using `pkg.name` ("cliq-cli") — the updater was looking for `/by-arch/linux-x64/app/cliq` when the real file lived at `/by-arch/linux-x64/app/cliq-cli`, throwing `Error: update not found`. Fixed by using `pkg.name` consistently in `bin.mjs`.

### Windows (win32-x64), validated 2026-08-24

The same flow (`pear install` → version bump → `pear stage` → `--updater`) reproduced on native Windows (no WSL), with a third real bug found along the way, distinct from the two above:

3. **`package.json`'s `"upgrade"` field gets baked into the binary when it's compiled** (`bin.mjs` imports `./package.json` at build time, and `bare-pack` bundles it whole). The first Windows build was done reusing the original `package.json` — which points at the linux-x64 link (`pear://yfaoo...ixczo`), whose private key isn't available on this machine (see the note in "Platforms built" above). Result: the binary installed fine, but its internal updater kept watching a link that was never going to change — with no visible error, it simply never found a new update, even with 90s windows. This isn't a bug in the boilerplate or in Pear: it's a direct consequence of generating a new link (`pear touch`) for this platform instead of inheriting the original one, and `"upgrade"` in `package.json` (the dev one, not just `deploy/package.json`) needs to be updated **before** compiling, not after.

With `"upgrade"` fixed and the binary rebuilt, the full validation worked end to end:

```
info  2026-08-25T02:17:42.121Z [updater] getting new update
info  2026-08-25T02:17:42.133Z [updater] { op: 'add', key: '/by-arch/win32-x64/app/cliq-cli.exe', bytesRemoved: 0, bytesAdded: 65084928 }
info  2026-08-25T02:17:45.161Z [updater] update complete... applying
info  2026-08-25T02:17:45.517Z [updater] applied update, restart to run latest version
```

Detection + download + full application in ~3.4s once the swarm connected to the seed (discovery itself, same as in the main README's "P2P synchronization" section, can take longer on networks with restrictive NAT). A clean `pear install` was also tested end to end: ~65MB downloaded at a real ~15-18MB/s from the seed, installed at `%LOCALAPPDATA%\Programs\cliq\cliq-cli.exe` and automatically added to the user's PATH.

**Note:** the string `cliq-cli --version` prints comes from `pkg.version` in the dev `package.json` (baked into the binary), not from `"version"` in `deploy/package.json` (which is what Pear's protocol actually uses to track drive revisions). These are two intentionally separate fields (one is cosmetic/informational, the other is what Pear actually compares to decide whether there's an update) — bumping one doesn't automatically bump the other.

## Keeping it seeded

While this track is being evaluated, a `pear seed` needs to keep running on a machine that stays on (this ephemeral sandbox isn't enough for that):

```
pear seed pear://mp8yxd4xro9apkxpsgp34upeuqhdyhem64r7wbtqigjuac9qqemo --no-tty
```
