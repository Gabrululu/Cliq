# Real-network validation checklist

This checklist gathers everything that needed validation against real infrastructure, feature by feature. Use `pnpm` instead of `npm` except where noted otherwise (the global `bare`/`pear` tools and the `bare`/`pear` commands themselves).

## 1. Clean install (never done from scratch on another machine)

```
git clone <your-repo>
cd CLIQ
pnpm add -g bare pear   # global tools, not in package.json
pnpm install
bare index.js help
```

- [x] Confirm no setup step is missing that was assumed by an already semi-configured environment. (2026-08-23: there was one undocumented extra step — `pnpm setup` to create `PNPM_HOME`, since `pnpm add -g` failed with `ERR_PNPM_NO_GLOBAL_BIN_DIR` without it).
- [x] Confirm disk space available for `@qvac/sdk` (or decide to migrate to `@qvac/bare-sdk`). (2026-08-23: `node_modules` ended up at 4.4GB, 15GB free after install — no need to migrate).

## 2. Real payments with WDK

Never tested against a real network before — the sandbox blocked all outbound RPC connections.

```
# .env with a real WDK_RPC_URL (e.g. Sepolia) and a funded testnet wallet
bare index.js wallet balance
bare index.js invoice create --amount 5.00
bare index.js pay <invoice-id>            # quote
bare index.js pay <invoice-id> --yes      # real send
```

Needed: a working testnet RPC, the `--from-index 1` wallet funded with test USDT and native token for gas, and `WDK_USDT_CONTRACT` pointing at that network's correct contract.

- [x] `wallet balance` doesn't break. (2026-08-23: real Sepolia via `https://ethereum-sepolia-rpc.publicnode.com`, test USDT contract `ERC20Mock` at `0xc4dcc311c028e341fd8602d8eb89c5de94625927`, minted 1000 USD₮ to account 1).
- [x] `pay --yes` returns a real `txHash`. (2026-08-23: `inv_64375ac6c4f9` → tx `0x636f6155235cbf825783a3970df8e138eeb13b2bb45d92360c691710752974bb`).
- [x] The `txHash` gets persisted on the invoice and on the signed receipt. (2026-08-23: confirmed with `invoice show` and `receipt verify` — signature and chain link OK).

Note: the second contract the user passed in (`0xd077A400968890Eacc75cdc901F0356c943e4fDb`, "Tether USD", `TransparentUpgradeableProxy`) wasn't used — it has no known public `mint`, while `0xc4dcc311c028e341fd8602d8eb89c5de94625927` is a verified `ERC20Mock` with an unrestricted `mint(address,uint256)`, ideal for self-funding with test tokens.

## 3. P2P synchronization — needs two machines or folders

```
# Terminal/machine A
bare index.js sync --room demo

# Terminal/machine B (with network access to the DHT)
bare index.js sync --room demo
```

- [x] Both terminals discover each other (not just that the command finishes without hanging, that's already tested). (2026-08-23: tested with two independent identities — two folders (`/tmp/tp-peer-a`, `/tmp/tp-peer-b`), each with its own `.cliq` via `merchant init` — running `sync --room demo` at the same time on the same host. **With `--timeout 25000` they didn't discover each other (0 peers)**; with **`--timeout 60000` they did** — "Peer connected" on both sides. This environment reports `firewalled true` / `NAT type consistent` on the DHT (seen in `pear`/`pear seed` logs), which likely explains why hole-punching takes longer than expected. Recommendation: if merchants in production are behind restrictive NATs, consider a longer timeout than the `sync` command's 20s default, or retries).
- [x] Events from one side show up in the other's ledger. (2026-08-23: each peer created a unique `invoice_paid` event — `inv_a_only` on A, `inv_b_only` on B — directly via `ledger.createEvent` (without going through a real payment, to isolate the sync/merge test from the WDK test already covered in #2). After `sync`, both ledgers ended up with all 4 receipts: their own 2 + the other merchant's 2, verified with `merchant ledger` on both sides).
- [x] Deliberately trigger a conflict (same `invoiceId`, two different `txHash` values from different merchants) and confirm `sync` reports it instead of silently overwriting it. (2026-08-23: both peers created an event with `invoiceId: inv_conflict_test` but a different `txHash`. After sync, **both sides correctly reported the conflict** in the "Conflicts detected" section with both `receipt_id`/`txHash`/merchant pairs facing off, and neither event got overwritten — both stayed stored in both peers' ledgers).

## 4. QVAC assistant

```
bare index.js ask "how much did I sell today?"
```

The model download (773MB, over the same P2P network) never finished in the sandbox. With real network access it should complete (may take a while depending on bandwidth) and return a coherent answer based on the merchant's own data. If it takes more than 120s, raise `QVAC_LOAD_TIMEOUT_MS` in `.env`.

- [x] The model download finishes. (2026-08-23: completed the 773MB over QVAC's P2P registry in ~3 minutes with real connectivity — longer than the original 120s timeout, which is why `QVAC_LOAD_TIMEOUT_MS` had to be raised to 600000 in `.env` before running it. The progress log confirms the download mechanism works (it climbed steadily from 0% to 100%), and then it loaded the model (`llama.cpp` logs repacking tensors) with no errors).
- [~] The answer is coherent with the real data. (2026-08-23: **partially** — the pipeline works (returned text in Spanish, no crash), but the content wasn't fully accurate: for the question "how much did I sell today?", with a real paid invoice (5 USDT, `inv_64375ac6c4f9`, status `submitted`) in the context passed to it, the model answered that it "has no information about the transactions" and described the invoice as "pending" when it was actually paid, without summing the amount. This is expected given it's a very small model (1B parameters, Q4 quantized) — worth deciding whether it's good enough for the use case or whether a bigger model/different prompt is warranted, but **this is not a bug in the QVAC integration itself** — the download, load, and inference worked correctly end to end).

## 5. Distribution with Pear — not a single `pear` command had been run

```
pear --version          # first check: does it even bootstrap?
pear stage dev
pear run pear://<key-printed-by-stage>   # from another folder/machine
```

Full "production" + OTA update flow:

```
pear stage production
pear release production
pear seed production
# change something small, repeat stage+seed, and confirm the peer that already installed receives the change
```

Important security check:

```
pear info --manifest
```

`pear.stage.ignore` is already configured to exclude `.env` and `.cliq/`, but this command had never been run to confirm it.

- [x] `pear --version` bootstraps correctly. (2026-08-23: it installed with just `pnpm add -g pear`; the first `pear -v` triggers Holepunch's own bootstrap. Note: the correct flag in this version (v3.2.0) is `-v`, not `--version`).
- [x] `pear stage dev` + `pear run pear://...` works from another folder/machine. (2026-08-23: **the Pear CLI changed in two ways compared to the original checklist**: (1) `pear stage dev` no longer accepts channel names, it wants a `<link>` generated with `pear touch`; (2) **`pear run` was removed** — the CLI returns "pear run has been removed. Use the pear-runtime module instead". The equivalent that does work to download+run the app like another peer is `pear dump <link> <dir>` followed by `bare index.js help` from that folder — tested in `/tmp/pear-run-test` (another folder, same host) and it worked: it brought `src/`, `node_modules/`, etc., without `.env` or `.cliq/`, and the CLI ran normally. Final link: `pear://dtb98ajx6wkg8cbw9zmpabd95ie4ipkj5dq18da3frk6o34ixczo`. Note: this was on the same machine, not tested across two different physical hosts — if the project keeps targeting desktop apps, worth checking whether `pear install` is a better fit than `dump` for that case).
- [~] The `stage` → `release` → `seed` production flow works. (2026-08-23: **`pear release` was removed entirely** in this version — `Unrecognized Argument`. The original checklist's "production channel" model no longer exists in that simple form: "production" is now handled with `pear provision <source-verlink> <target-link> <production-verlink>` + `pear multisig` (quorum cryptographic signing, requires configuring `multisig.publicKeys` / `namespace` / `quorum` in `pear.json`, which this project doesn't have). This is a flow change, not just a syntax one — it needs a product decision about whether setting up multisig is worth it for this project, or whether direct seed/dump over a single link is enough. `pear seed <link>` itself does work as-is (tested, see below) — what doesn't exist anymore is the intermediate "release" step).
- [x] A small change propagates via OTA to a peer that had already installed. (2026-08-23: bumped `package.json` version 0.0.1→0.0.2, re-staged the same link with `pear stage <link> --only package.json` — internal version went from 8498→8499 —, and from the peer folder (`/tmp/pear-run-test`, which already had the app) ran `pear dump <link> . --force`: it only resynced `/package.json` and the peer ended up on `0.0.2`. The version bump was reverted after the test).

**`pear seed` (tested separately):** `pear seed pear://dtb98ajx6wkg8cbw9zmpabd95ie4ipkj5dq18da3frk6o34ixczo --no-tty` runs, announces the link on the network, and stays serving blocks ("0 peers" because there was no other real node connecting, but the announcement and the `whoami`/`discovery key`/etc. logging worked with no errors).
- [x] `pear info --manifest` does NOT list `.env` or `.cliq/`. (2026-08-23: confirmed — the manifest only repeats the `pear.stage.ignore` config from `package.json`; the stage diff didn't show those files, only `.env.example`).

**Disk note:** this project's `pear stage` uploads the entire `node_modules/` (including `@qvac`'s native prebuilds for every platform) because Pear packages the dependencies to distribute the app running, not just the source code. This grew Pear's internal store (`~/.config/pear`) by ~3.4GB during staging. Free disk dropped from 15GB (post `pnpm install`) to **7.6GB** after this single `stage`. If several `stage`/`release`/`seed` cycles are planned, it's worth monitoring disk or considering a migration to `@qvac/bare-sdk` before continuing.

**⚠️ Don't move Pear's store (`~/.config/pear`) to another filesystem/device.** Relocating it to `/tmp` (a different device in this environment) was tried to free up space, and Pear detected it and broke the sidecar: `Error: Invalid device file, was modified` (it records a device identifier in its internal RocksDB and refuses to start if it detects it changed). That store had to be discarded (`rm -rf`, losing the already-staged link/version) and Pear had to be re-bootstrapped from scratch. **pnpm's store could be moved without issue** (`pnpm store status` confirmed integrity after the move) — the difference is by design: pnpm is purely content-addressable, Pear ties its storage to a physical device. If more space is needed for Pear, the only safe path is cleaning up with `pear gc cores <link>` (deletes orphaned cores for a specific link) or reducing what gets staged, not relocating the directory.

## 6. Already closed (no need to re-test)

- Full offline CLI (`init`, `wallet address`, `invoice create/show`, `ledger`, `receipt show/verify`) — tested live, including ledger tamper detection.
- All P2P merge logic (signature, dedupe, conflicts) — tested by simulating two identities directly.
- Landing responsiveness (320px to 1440px, light and dark) — tested with Playwright, zero overflow.

## 7. Multisig / production with Pear — future research (not implemented)

**Decision (2026-08-23): no multisig setup for now.** This is infrastructure meant for when several independent parties need to co-sign before a release reaches production (N-of-M quorum). At the project's current size, a single stable link via `stage`+`seed` is enough (already validated in section 5). Trade-off to keep in mind: without multisig, anyone with access to the staging link can publish an update that peers receive automatically via OTA, with no intermediate review. If more hands join the project in the future, or that control becomes necessary, here's what needs to be set up:

### How it's configured (Pear v3.2.0)

1. **Define the quorum in `pear.json`** (doesn't exist in this project yet):
   ```json
   {
     "multisig": {
       "publicKeys": ["<pubkey1>", "<pubkey2>", "<pubkey3>"],
       "namespace": "cliq",
       "quorum": 2
     }
   }
   ```
   With this, 2 of the 3 listed keys must sign for a release to be considered valid.

2. **Generate/manage signing keys**: `pear multisig keys <get|paths|list|add|remove>`. `get` initializes a local key if one doesn't exist; `paths` shows where it lives (public/private); each person co-signing needs their own, and their public key is what gets added to `publicKeys` in `pear.json`.

3. **Get the project's multisig link**: `pear multisig link` — derived from `publicKeys` + `quorum` + `namespace` in `pear.json` (supports `--vanity` for a chosen prefix). This is the "production" link end users will install/follow.

4. **Prepare a pre-production target**: `pear touch` generates a new link, and `pear provision <source-verlink> <target-link> <production-verlink>` syncs blocks from the staging link (versioned, e.g. `pear://0.8499.<key>`) to that target, leaving it ready to request signatures against the real production link.

5. **Signing cycle**:
   - `pear multisig request <verlink>` — creates a signing request to sync a versioned link to the project's multisig link. Returns a `<request>` to hand out to signers.
   - `pear multisig sign <request> [key-name=default]` — each signer runs this with their local key; returns a signature `response`.
   - `pear multisig verify <source-link> <request> [...responses]` — gathers the collected responses and dry-runs the commit to check the quorum is met before actually applying it.
   - `pear multisig commit <source-link> <request> [...responses]` — applies the signatures and enables real syncing from the staging link to the multisig link (only then does the change land "in production").

None of these commands were run in practice (only their `--help` was checked); if this gets adopted in the future, an end-to-end trial with 2+ real signing identities is still needed, similar to how P2P sync was tested in section 3.

## 8. Standalone installable CLI (`pear install` + real OTA)

A standalone CLI build, deployed with the Pear CLI and installable with `pear install`, with peer-to-peer OTA updates — starting from the official `hello-pear-bare` boilerplate. Lives in [`pear-cli/`](pear-cli/) (a subfolder of this same repo) — full detail in [`pear-cli/README.md`](pear-cli/README.md). This is different from section 5 (which tested `stage`/`seed`/`dump` for the "normal" app running under `bare`); here the hard requirement is a **real standalone binary**, installable without Node/Bare/Pear.

- [x] Starts from `hello-pear-bare`'s `variant/daemon` branch (meant for short git-like commands — CLIQ's real usage pattern), with the real CLI ported over (everything except `ask`/QVAC, excluded due to `@qvac/sdk`'s weight).
- [x] `bare-build` produces a standalone linux-x64 binary (~119MB) that runs with no `node_modules` alongside it — tested in an empty folder.
- [x] `pear install pear://<key>` really installs, via real P2P (with a `pear seed` running), straight to `~/.local/bin/`. (2026-08-23: confirmed with `pear install` downloading at ~45MB/s from the seed itself).
- [x] **Real OTA**: with a copy installed at `0.0.4`, `0.0.5` was staged on the same link, and the installed copy updated **itself** in ~2 seconds (`updating → updating-delta → updated → update-applied`, real log in `pear-cli/README.md`). Confirmed by running `--version` before and after.
- [x] **win32-x64 (Windows), 2026-08-24**: the same binary built and validated end to end on a native Windows host (no WSL) — `bare-build`, `pear install` (~65MB real over P2P at ~15-18MB/s), and a real OTA (update detected and applied in ~3.4s). A third real bug found along the way, distinct from the two below: `package.json`'s `"upgrade"` field gets baked into the binary when it's compiled, and the first Windows build mistakenly inherited the original linux-x64 link (whose private key isn't available outside the session it was generated in) — the internal updater would never find anything, with no visible error. Fixed by generating its own link (`pear touch`) and rebuilding with `"upgrade"` corrected *before* the build. Full detail, including the real logs, in `pear-cli/README.md`, "Windows (win32-x64)" section.

**Two real bugs found and fixed along the way** (documented in more detail in `pear-cli/README.md`):
1. `--update-window` is in **milliseconds**, not seconds — passing `90`/`180` (interpreted as 90-180*ms*) made the updater close before the swarm got a real chance to connect to anything, looking like "can't find peers" when it actually never had time to try.
2. `bin.mjs` built the binary's expected name using `pkg.productName` ("cliq"), but `pear install` builds that path using `pkg.name` ("cliq-cli") — a mismatch that threw `Error: update not found`. Fixed by using `pkg.name` consistently.

**Pending / known limitations:**
- **macOS** is still missing — a host on that platform (or CI) is needed to cross-compile with `bare-build`. linux-x64 and win32-x64 are already covered.
- The Windows build was published to a different Pear link (`pear://mp8yxd4xro9apkxpsgp34upeuqhdyhem64r7wbtqigjuac9qqemo`) than the original linux-x64 build (`pear://yfaoo...ixczo`), because that link's private key isn't available on the machine where the Windows build was done — see the note in `pear-cli/README.md`.
- Each link's `pear seed` needs to keep running on a machine that stays on — an ephemeral sandbox isn't enough for that.

## 9. AI agent payments — agent with guardrails over `@tetherto/wdk-cli` + MCP

Started with the CLI + MCP integration because it didn't depend on any new external service. Gasless payments were picked up afterward and also got resolved — see section 10.

**What was built**: `merchant agent settle <invoice-id> [--yes] [--json]` (`src/commands/agent.js`) — a new command that pays a CLIQ invoice using `@tetherto/wdk-cli` (not the raw `@tetherto/wdk` SDK `pay.js` already uses — this is a new, central piece, not a decorative wrapper), with guardrails **in code, not in a prompt**:
1. Spend cap (`AGENT_SPEND_CAP_USDT`) — rejected before calling `wdk send` if the invoice exceeds it.
2. Implicit allowlist — the recipient is always `invoice.recipient`, never a free parameter.
3. Explicit confirmation — without `--yes` it only quotes (`wdk send --dry-run`), same pattern as `pay <id>`/`pay <id> --yes`.

Exposed to an agent via a dedicated MCP server (`mcp/server.js`, Node.js — not Bare, for compatibility with `@modelcontextprotocol/sdk`) with two tools: `quote_invoice_payment` and `confirm_invoice_payment`. Each one only receives an `invoiceId`; the server doesn't reimplement any logic, it just invokes `bare index.js agent settle ...` and returns the result.

**Validated end to end (2026-08-23), against the real wallet already funded on Sepolia**:
- [x] `wdk wallet import --seed-stdin` with the same `MERCHANT_SEED_PHRASE` from `.env` → the exact same wallet confirmed (`wdk get address --index 1` returns `0x86aCC9bc...`, the one already in use).
- [x] `wdk get balance --token tpusdt --index 1` reads the real balance (990 tpUSDT, matches what was left after section 2's payments).
- [x] `agent settle <id>` without `--yes` quotes via `wdk send --dry-run` (amount + real estimated fee), sends nothing.
- [x] `agent settle <id> --yes` really sends — real `txHash`, receipt signed and chained the same as with `pay` (same `receipt verify` with signature and chain link OK).
- [x] Cap guardrail: a 50 USDT invoice (cap set at 10) gets rejected **before** invoking `wdk send`, with or without `--yes`.
- [x] Tested both via direct CLI and through the real MCP server (with a test MCP client: `listTools` returns both tools, `callTool` in both cases — quote and cap rejection — returns exactly the same result as the CLI).

**Finding (didn't block agent payments, did delay gasless payments until resolved)**: the "official" USD₮ token `wdk-cli` recognizes built-in for Sepolia (`0xd077A400968890Eacc75cdc901F0356c943e4fDb`, the same one Candide's public paymaster preconfigured on the `smart-account-sepolia` network requires) has its `mint` function restricted to a wallet we don't control (`Ownable: caller is not the owner`, verified with a direct `eth_call`). That's why `agent settle` uses our own `ERC20Mock` from section 2 under a custom symbol (`tpusdt`, added with `wdk token add`), not the built-in `usdt`. The real fix to get the official token was found and is documented in section 10.

**Real Windows bug found and fixed (2026-08-24)**: `agent settle` and `gasless pay` (section 10) invoke `wdk-cli` with `spawnSync(bin, args, ...)` pointing straight at `node_modules/.bin/wdk` — on Linux/macOS that file is a `#!/bin/sh` script, executable as-is, but on Windows it's the same POSIX script (not natively executable) and the real binary to invoke is `wdk.CMD`. Without this fix, both commands failed on Windows with `wdk exited with code null` (a silent spawn, no useful message). Fixed in `src/commands/agent.js` and `src/commands/gasless.js` by detecting the platform (`require('bare-os').platform()`) and using `wdk.CMD` on `win32`. The MCP server (`mcp/server.js`) had the same problem resolving the `bare` binary (it only looked via `$HOME`, a Unix pattern, and `spawnSync('bare', ...)` without `shell:true` fails on Windows with `ENOENT` because `.cmd` doesn't resolve without a shell) — fixed by adding `bare.cmd` as a candidate and `shell: true` on Windows. Validated end to end on native Windows (no WSL): cap guardrail, real payment via `agent settle --yes`, and both MCP server tools tested with a real MCP client — same results as on Linux.

## 10. Gasless payments (fee in USD₮, no ETH)

**The same finding from section 9 also blocked Pimlico, not just Candide**: confirmed by calling Pimlico's public RPC directly (`pimlico_getSupportedTokens` at `https://public.pimlico.io/v2/11155111/rpc`) that its Sepolia paymaster also requires the same official USD₮ (`0xd077A400968890Eacc75cdc901F0356c943e4fDb`) — switching paymaster providers didn't avoid the problem.

**How it was resolved**: Pimlico has a **test token faucet** for its paymaster (`Claim Test ERC20 Tokens`, with a fixed oracle price of $1 for testing) that the user found and used to claim 1000 test USD₮ directly to `0x86aCC9bc5AF6d963F72B65Ba51354E50A32F4504` (the account already in use). Confirmed with `wdk get balance --network sepolia --token usdt-official --index 1` → `1000 USDT`.

**Config put together (real, nothing guessed — researched in WDK and Pimlico's official docs before writing any value)**:
- Pimlico's URL format (bundler and paymaster share the same one): `https://api.pimlico.io/v2/{chainId}/rpc?apikey={API_KEY}` — confirmed at `docs.pimlico.io/guides/tutorials/tutorial-2`.
- The paymaster contract address **isn't a fixed value** — it's obtained with a real call to `pimlico_getTokenQuotes` (params: `[{tokens:[...]}, entryPointAddress, chainIdHex]`), which returned `0x777777777777AeC03fd955926DbF81597e66834C` for the official USD₮ on Sepolia.
- A custom network was created in `wdk-cli` (`wdk network create`) called `smart-account-sepolia-pimlico`, module `@tetherto/wdk-wallet-evm-erc-4337`, with those values — see the full JSON in the README, "Gasless payments" section.

**Real bug found**: raising `transferMaxFee` in the network's JSON **had no effect** across several attempts (same `Exceeded maximum fee cost for transfer operation` error even with an absurdly high cap). Real cause: `wdk-cli`'s background daemon (started by `wallet unlock`) **caches the network config on startup** and doesn't reread it on its own. Fix: `wdk wallet lock --all` + `wdk wallet unlock --name cliq --ttl 0` again after touching `wdk network create`/`wdk token add` — only then did it pick up the new value.

**Validated end to end, with real money on Sepolia**:
- [x] The smart account (ERC-4337) has a **different address** from the normal wallet derived from the same seed (`0x8469a1A3...` vs `0x86aCC9bc...` — confirmed, not an oversight).
- [x] 100 USD₮ were transferred from the normal wallet to the smart account (the only step that did cost ETH — the funds "onboarding" step).
- [x] The smart account's ETH balance confirmed at **0** at all times.
- [x] Quote (`--dry-run`) and real send (`wdk send`, and also `merchant gasless pay <id> --yes`) worked with no ETH, with the fee charged in USD₮ — real `txHash`, and the recipient's USD₮ balance went up by exactly the expected amount.
- [x] **`merchant gasless pay <invoice-id> [--yes]`** (`src/commands/gasless.js`, new product command, same pattern as `agent.js`): quotes and pays a real CLIQ invoice through this path, generating the same signed and chained receipt as `pay`/`agent settle` (`receipt verify` with signature and chain link OK).

## 11. Receipt reconciliation (OCR + local LLM)

Invoice reconciliation via OCR, built `merchant reconcile <invoice-id> <image-path> [--json]` on top of CLIQ's real domain (invoices), not as a standalone demo.

**What was built**: `src/ai/qvac.js` gained two new functions on top of the same QVAC runtime `ask` already used — `ocrImage(imagePath)` (loads `OCR_LATIN`/EasyOCR via the new `@qvac/ocr-ggml` addon, runs `sdk.ocr(...)`) and `reconcileReceipt(invoice, ocrText)` (loads the same `LLAMA_3_2_1B_INST_Q4_0` from `ask`, asks it to extract the amount from the OCR text and compare it against the invoice). `src/commands/reconcile.js` chains both steps and never changes the invoice's status — it's an assisted read for a human to decide on.

**Real reliability finding (found on the first run, not simulated)**: a synthetic receipt reading `Amount: 12 USDT` was passed against a `5 USDT` invoice. The model correctly extracted the amount (`AMOUNT_DETECTED: 12`) but declared `VERDICT: MATCH` — good at extraction, bad at comparison, exactly the kind of failure small models are known for. **Reliability fix, not a prompt fix**: `computeVerdict()` was added in `src/ai/qvac.js`, which ignores the model's verdict and computes `MATCH`/`NO_MATCH`/`UNCERTAIN` in code, comparing the extracted amount against `invoice.amount`. The model's own verdict is kept separately (`modelVerdict`) only to detect and expose disagreement (`modelDisagreed: true`), never to decide — same "guardrail in code, not in the prompt" principle as `agent.js` (section 9).

**Validated end to end (2026-08-23), with synthetic receipts generated for the test** (no camera in this dev environment — generated with PIL, rendered text, not a real photo; documented as what it is):
- [x] Clean receipt, correct amount (`5 USDT` vs a `5 USDT` invoice) → OCR detects 4 blocks, model extracts `5`, verdict `MATCH`, `modelDisagreed: false`.
- [x] Same receipt rotated 3° + noise + Gaussian blur (simulating a poorly-lit photo) → OCR still reads the full text (1 block instead of 4, but complete) → `MATCH`.
- [x] Receipt with a different amount (`12 USDT` vs a `5 USDT` invoice) → the bug from above: model says `MATCH`, code computes `NO_MATCH` (correct) and flags `modelDisagreed: true`.
- [x] Blank image (no text) → explicit failure ("no legible text detected"), 0 blocks, doesn't even invoke the text model.
- [x] Nonexistent `invoice-id` → fails before touching OCR. Nonexistent image path → fails before touching OCR.
- [x] Format retry: `reconcileReceipt` asks the model for 3 lines with fixed labels (`VERDICT`/`AMOUNT_DETECTED`/`EXPLANATION`) instead of free-form JSON (a 1B model often fails to generate valid JSON); if parsing fails it retries once with a stricter prompt before returning `UNCERTAIN` instead of inventing a result. In the 4 runs above, the model answered in the expected format on the first try (`modelAttempts: 1`).

**Model and hardware**: `OCR_LATIN` (EasyOCR, ~15MB CRAFT detector + ~83MB recognizer, resolved automatically by the registry) and `LLAMA_3_2_1B_INST_Q4_0` (1B, Q4), both via `@qvac/sdk` over Bare. 4-vCPU (AMD EPYC 9V74), 15GB RAM container, no GPU (`no usable GPU found`, confirmed in the `llama.cpp` log). A full run (load OCR, read image, unload both models from memory, load LLM, reconcile, unload from memory — no persistent daemon) took **~24s** measured with `time`.

**Honest limitation**: the Spanish explanations the model gives are sometimes imprecise even when the verdict (computed in code) is correct — e.g. it said "the amount isn't clear" in a run where it had actually extracted it correctly. It doesn't affect the decision (the verdict doesn't depend on the explanation), but it's a real limitation of the 1B model generating free-form text, documented as such rather than hidden.

## Suggested order

1. **#2 Payments** (WDK against the real network).
2. **#5 Pear** — the "newest" one, never run even once.
3. **#3 Sync** — save for last since it needs coordinating two machines at the same time.
