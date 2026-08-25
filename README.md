<p align="center">
  <img src="public/assets/logo-lockup.svg" alt="CLIQ" width="320">
</p>

# CLIQ

Self-custodial USD₮ payment terminal for merchants of all kinds, distributed as a P2P CLI via Pear, with a signed ledger synchronized over Hyperswarm, and local queries powered by QVAC.

Project for [Aleph Hackathon 2026](https://hacki.crecimiento.build/h/aleph-hackathon-2026).

## What it includes

- **USD₮ payments** with a self-custodial wallet (WDK): address, balance, fee quote, and transfer.
- **Invoices and charges**: create an invoice, quote the payment, confirm it (`--yes`), with explicit states (a payment that never happened is never simulated).
- **Signed ledger**: every payment generates a signed receipt (Ed25519) chained to the merchant's previous receipts; `receipt verify` detects any alteration.
- **P2P sync** between terminals via Hyperswarm, with conflict detection instead of silent overwriting.
- **Local assistant (QVAC)**: natural-language questions about your own sales, with no data sent to any server.
- **P2P distribution via Pear**, with automatic (OTA) updates, no app store, no central server.

## Documentation

- [`architecture.md`](architecture.md) — full technical architecture.
- [`brandkit.md`](brandkit.md) — palette, typography, logo, and voice guide for building presentations.
- [`deck.md`](deck.md) — pitch deck content, slide by slide.
- [`TESTING.md`](TESTING.md) — checklist of everything validated against real infrastructure (WDK, P2P sync, QVAC, Pear, Pear Track, WDK Track), command by command.
- [`pear-cli/README.md`](pear-cli/README.md) — the Pear Track submission: standalone CLI installable with `pear install` + real OTA.
- Further below, the ["WDK Track — agent with guardrails"](#wdk-track-tether--track-1-agent-with-guardrails-over-tethertowdk-cli--mcp) section: the WDK Track submission.

## Landing page

<p align="center">
  <a href="public/index.html">
    <img src="public/assets/landing-preview.png" alt="Preview of the CLIQ landing page" width="640">
  </a>
</p>

The project's presentation page lives at [`public/index.html`](public/index.html) — it's part of the repository, not a separate external link. To view it:

```bash
open public/index.html                 # macOS
xdg-open public/index.html              # Linux
# or spin up a simple static server:
npx serve public
```

It's a self-contained HTML file (no build, no project dependencies) meant to explain CLIQ to a merchant, not a developer. The mark (`public/assets/logo-mark.svg`, `logo-mark-dark.svg`, `logo-lockup.svg`) represents a signed-receipt seal with the USD₮ symbol, using the same color palette as the rest of the page. The page is bilingual (Spanish/English) with a small toggle in the header.

**Live receipt verifier:** the `#verificar` section of the landing is the only part of CLIQ that runs in the browser instead of the CLI — you paste the JSON of a signed receipt (for example, the output of `merchant receipt show <id>`) and it verifies the Ed25519 signature right there, with nothing sent to any server. It reimplements in plain JS the same logic as `src/ledger/canonical.js` and `src/ledger/events.js` (`verifyEvent`), using [tweetnacl.js](https://github.com/dchest/tweetnacl-js) (public domain, embedded inline, no CDN) for Ed25519 verification. By design it only verifies the signature — not the link to the previous event (`previousEventHash`), which needs the rest of the local ledger; for that you still need `merchant receipt verify` in the CLI.

## Problem

A small merchant needs to charge in USD₮, keep their books, and verify their receipts without depending on a central server or permanent connectivity.

## Tracks

1. **WDK** (primary) - wallet, balance, invoices, and transfers.
2. **Pears** (secondary) - CLI distribution and OTA installation.
3. **QVAC** - natural-language queries over the ledger (`ask`), and receipt reconciliation via OCR + local LLM (`reconcile`, QVAC Track 1).

## Current status

- [x] Phase 1 - CLI skeleton (`merchant help`, `merchant version`, `merchant init`)
- [x] Phase 2 - Wallet and balance (WDK): `wallet address`, `wallet balance`, `wallet generate-seed`
- [x] Phase 3 - Invoice and transfer: `invoice create`, `invoice show`, `pay`
- [x] Phase 4 - Signed ledger: `ledger`, `receipt show`, `receipt verify`
- [x] Phase 5 - P2P sync (Hyperswarm): `sync`, `peers`
- [x] Phase 6 - QVAC queries: `ask`
- [x] Phase 7 - Release and OTA with Pear (`stage`/`seed`/`dump` tested against the real network, see section below)
- [x] Pear Track - standalone CLI installable with `pear install` + real OTA update, see [`pear-cli/`](pear-cli/)
- [x] WDK Track (1/2) - agent with guardrails over `@tetherto/wdk-cli` + MCP, see section below
- [x] WDK Track (2/2, gasless) - real payment with no ETH, fee in USD₮ (ERC-4337 + Pimlico paymaster), see section below
- [x] QVAC Track (1/2, reconciliation) - local OCR + LLM to reconcile receipts against invoices, see section below

## Requirements

- [Node.js](https://nodejs.org) 18 or higher (used for `npm install`).
- [`bare`](https://www.npmjs.com/package/bare) installed globally to run the CLI in development: `npm install -g bare`.
- [`pear`](https://www.npmjs.com/package/pear) installed globally, only if you're going to try P2P distribution (Phase 7): `npm install -g pear`. Requires open network access to the DHT — see the "Release and OTA with Pear" section below.

## Installation

```bash
npm install
```

### Run with Bare (local runtime, no P2P network)

```bash
bare index.js help
bare index.js version
bare index.js init --network testnet
```

### Run with Pear

```bash
pear stage <link>          # <link> is generated by "pear touch"
pear dump <link> <folder>  # downloads the project into a folder, as another peer would
```

> Note: the version of the Pear CLI used here (3.2.0) changed compared to older versions: `pear run` was **removed** (that command no longer exists) and `pear stage <channel>` no longer accepts a channel name like "dev" — it now expects a `pear://...` link generated with `pear touch`. See the "Release and OTA with Pear" section below for the full detail, already tested against the real network (not a theoretical guide).

## Available commands

```bash
merchant init [--network testnet]        # Initializes the P2P identity and local store
merchant wallet generate-seed             # Generates a test seed phrase (dev/testnet only)
merchant wallet address [--index 0]       # Shows the account's EVM address (WDK)
merchant wallet balance [--index 0] [--token 0x...]  # Native and USD₮ balance
merchant invoice create --amount 12.50 [--currency USDT] [--memo "..."] [--index 0]  # Creates an invoice
merchant invoice show <id>                # Shows an invoice's detail
merchant pay <invoice-id> [--from-index 1] [--yes]  # Quotes (and with --yes, sends) the payment
merchant ledger                           # Lists the ledger's signed events
merchant receipt show <id>                # Shows a signed receipt's detail
merchant receipt verify <id>              # Verifies a receipt's signature and chain link
merchant sync --room <room> [--timeout 20000]   # Syncs the ledger with other terminals
merchant peers --room <room> [--timeout 8000]   # Lists the peers found in a room
merchant ask "<question>"                 # Queries the ledger in natural language (QVAC, local)
merchant version                          # Shows the installed version
merchant help                             # Shows help
```

### Charging flow (Phase 3)

```bash
bare index.js invoice create --amount 12.50 --memo "Sale #1042"
# -> Invoice ID: inv_xxxxxxxxxxxx

bare index.js invoice show inv_xxxxxxxxxxxx

bare index.js pay inv_xxxxxxxxxxxx
# Without --yes: only quotes (amount + network fee), sends nothing.

bare index.js pay inv_xxxxxxxxxxxx --yes
# With --yes: executes the real ERC-20 transfer from the --from-index account
# (defaults to 1, to simulate a "customer" distinct from the merchant using the same seed).
```

Invoices are stored in `.cliq/invoices.json`. Possible states: `pending` -> `submitted` (transaction broadcast, with `txHash`) or `failed` (with the error). `pay` never marks an invoice as paid unless WDK actually returned a real transaction hash; if the network fails, the invoice stays `pending`/`failed`, never `submitted`.

### Signed ledger (Phase 4)

Every successful `pay --yes` appends a signed `invoice_paid` event to `.cliq/ledger/events.json`, chained to the previous event (like a local, append-only mini-blockchain):

```bash
bare index.js ledger                        # Lists all events
bare index.js receipt show <receipt-id>      # Detail of a receipt
bare index.js receipt verify <receipt-id>    # Verifies signature + chain link
```

`receipt verify` checks:
1. **Signature** - the event was signed with the merchant's P2P identity private key (generated in `merchant init`, Ed25519 via `hypercore-crypto`) and it covers every field (amount, recipient, txHash, etc.), so altering any of them invalidates the signature.
2. **Chain link** - the event's `previousEventHash` field matches the hash of the immediately preceding event in the local store; if someone edits or reorders a previous event, the next one stops verifying.

I tested both cases by hand: a valid two-event chain, and then manually edited the amount of the first event in `events.json` to confirm that `receipt verify` detects the invalid signature on that event **and** the broken chain link on the next one (exit code 1 in both cases). No real RPC connection is needed for this — the signature and hash chain are 100% local, so this could be validated in full in this environment despite the network restriction.

**Note:** chaining (`previousEventId`/`previousEventHash`) is *per merchant*, not global to the file: each P2P identity only chains against its own previous events. This was a deliberate fix over the first version of Phase 4, necessary so that Phase 5 (several merchants writing to the same local store via sync) doesn't break anyone's chain.

### P2P synchronization (Phase 5)

```bash
# Terminal A
bare index.js sync --room demo-store

# Terminal B (another folder/another .cliq, shared test network)
bare index.js sync --room demo-store

# Only discover who's in the room, without exchanging events:
bare index.js peers --room demo-store
```

`sync` joins a P2P room via Hyperswarm (topic = hash of `cliq:ledger:<room>`, public DHT). When connecting to each peer, both sides send their full local ledger as a JSON message; every incoming event is verified (signature + per-merchant chain link) before being accepted, duplicates are skipped by `id`, and conflicts are listed at the end: same `invoiceId` with different `txHash` values across events from different merchants (a possible double record), flagged for manual review instead of being auto-resolved.

**Design simplification versus the original plan:** instead of each terminal keeping its own Hypercore (an append-only feed) and replicating them with each other by public key (the standard Hypercore/corestore pattern for multi-writer), I implemented a direct exchange of already-signed events (newline-delimited JSON) over the encrypted Hyperswarm connection. The security property that actually matters (nobody can forge or alter an event) already comes from the Ed25519 signature from Phase 4, which is transport-independent — a simpler protocol doesn't give any of that up. The result is easier to audit and covers Phase 5's core goal ("replicate events, not sync wallets"), and it's already been proven working end to end against the real DHT (see above). Migrating to a feed-per-peer Hypercore+corestore setup remains a valid next step if a reviewer specifically expects the canonical pattern.

**Network robustness:** `swarm.join(...).flushed()` and `swarm.destroy()` can hang indefinitely if the DHT bootstrap can't be reached (I confirmed this in this sandbox: without the fix, `merchant peers` would never finish). Because of that, neither call is awaited in a blocking way; every sync/peers invocation always finishes within its `--timeout` window plus a fixed cleanup margin, whether or not the network is available.

**Tested against the real network:** two independent merchant identities (two separate `.cliq` folders) running `sync --room` at the same time genuinely discovered each other over the DHT, exchanged their ledgers, and correctly flagged a deliberately induced conflict (same `invoiceId`, two different `txHash` values) instead of overwriting it. Discovery took ~60s, not the default 20s — this environment reports `firewalled: true` / `NAT type: consistent` on the DHT, something worth budgeting for in production too, not just here. Full detail in `TESTING.md`.

### QVAC queries (Phase 6)

```bash
bare index.js ask "which invoices are pending?"
bare index.js ask "how much did I sell in total?"
```

`ask` builds a text context out of the invoices and the local ledger (`src/ai/context.js`), and passes it to a local language model via `@qvac/sdk` (`loadModel` + `completion`, default model `LLAMA_3_2_1B_INST_Q4_0`, configurable with `QVAC_MODEL` in `.env`). Everything runs on the machine, with no data sent to an external server. QVAC is strictly a query bonus: **if it fails or isn't available, the rest of CLIQ (payments, ledger, sync) keeps working the same** — `ask` never blocks or gates any other command.

**Tested end to end against the real network:**
- Building the context (`src/ai/context.js`) is pure network-free logic: tested end-to-end with real invoices.
- Loading the addon and registering the plugin (`@qvac/sdk/plugins`, `@qvac/sdk/llamacpp-completion/plugin`) work (the native addon `@qvac/llm-llamacpp`, ~520MB, ships as a transitive dependency of `@qvac/sdk`).
- Downloading the model (773MB, distributed over the same P2P registry Hyperswarm uses) **completed** (~3 minutes with real connectivity) and `completion` returned a real answer based on the local data.
- **Real bug found and fixed while testing this:** without protection, `loadModel` would wait for the download forever if there's no network (confirmed hanging until killed by hand). A configurable timeout was added (`QVAC_LOAD_TIMEOUT_MS` in `.env`, default 120s) so `ask` always finishes with a clear message instead of hanging — and in practice it had to be raised above the default, because the real download took longer than 120s.
- If `ask` fails for any reason (no network, addon not installed, timeout), it prints the error plus the raw context it would have sent to the model, so the command stays useful even if the AI doesn't answer.
- **Note on answer quality:** with the default model (1B parameters, Q4 quantized), the answer to concrete questions about the ledger can be imprecise (e.g. not summing amounts correctly). This is a limitation of model size, not an integration bug — worth considering a bigger model if accuracy matters more than speed/size.

**Disk space notice:** `@qvac/sdk` (the "full" package, meant for Node/Expo) ships **all** of its native addons as dependencies — llm, whisper, ocr, tts, image diffusion, etc. — even though only one is used. In this environment, `npm install` with `@qvac/sdk` grew `node_modules` to **~6GB**. For the final CLI via Pear it's worth migrating to [`@qvac/bare-sdk`](https://www.npmjs.com/package/@qvac/bare-sdk) installing *only* `@qvac/llm-llamacpp` (the completion addon, ~520MB) and building a dedicated worker entry (`qvac/worker.pear.entry.mjs`, see `@qvac/bare-sdk` docs) — I kept `@qvac/sdk` for simplicity and because it also runs on Node (easier to test on your machine), but don't install it if disk space is limited.

## QVAC Track (Tether) — Track 1: receipt reconciliation (OCR + local LLM)

The flagship use case the QVAC brief asks for (local agents for back-office work: invoice reconciliation) maps directly onto the domain CLIQ already has — real invoices — so it was built on top of that, not as a separate generic demo.

```bash
bare index.js reconcile <invoice-id> <path-to-receipt-image> [--json]
```

What it does: takes a photo/scan of a payment receipt, runs local OCR on it (`@qvac/sdk` + `@qvac/ocr-ggml` addon, EasyOCR's `OCR_LATIN` model — CRAFT detector auto-derived by the registry), and compares the extracted text against the invoice already on file in CLIQ, flagging `MATCH` / `NO_MATCH` / `UNCERTAIN` with an explanation that's verifiable in five seconds. It doesn't change the invoice's status: it's an assisted read for a human to decide on, not an automatic payment.

**Key design decision, found by actually testing this:** in the first real run, the text model (`LLAMA_3_2_1B_INST_Q4_0`, the same one `ask` uses) *correctly* extracted the receipt's amount (`12`) but said `VERDICT: MATCH` against an invoice for `5` — a 1B model is good at extracting text but bad at comparing numbers. The fix wasn't "improve the prompt": the final verdict **never comes from the model**. `src/ai/qvac.js` (`computeVerdict`) takes the amount the model extracted and compares it against the invoice's amount *in code*, following the same "the guardrail lives in code, not in the prompt" principle already used in `agent.js` (WDK Track 1). The model's own verdict is kept separately (`modelVerdict`) only so a disagreement can be detected and shown (`modelDisagreed: true`), never to decide.

**Tested with synthetic receipts generated for this test** (no camera in this dev environment; documented as what it is, not presented as real photos):
- Clean receipt with the correct amount -> `MATCH`, the model extracts the amount correctly and it matches its own verdict.
- Same receipt rotated 3° + noise + blur simulating a poorly-lit photo -> OCR still reads the correct text (1 block instead of 4, but complete) -> `MATCH`.
- Receipt with an amount different from the invoice (`12` against an invoice for `5`) -> this is the case that exposed the bug above: the model said `MATCH`, the code-computed verdict says `NO_MATCH` (correct) and flags `modelDisagreed: true`.
- Blank image (no text) -> explicit failure ("no legible text detected"), doesn't invent an amount.
- Nonexistent invoice / nonexistent image file -> explicit failure before touching the model.

**Model and hardware:** `OCR_LATIN` (EasyOCR, auto-derived CRAFT detector, ~15MB + ~83MB) and `LLAMA_3_2_1B_INST_Q4_0` (1B parameters, Q4 quantized), both via `@qvac/sdk` over Bare, run on a 4-vCPU (AMD EPYC 9V74) / 15GB RAM container, no GPU. A full run (OCR + reconciliation, loading and unloading both models from memory on each call, no daemon) takes **~24s** on this hardware.

**Honest limitation:** the explanations the model gives are sometimes grammatically imprecise or mention minor incorrect details (e.g. "the amount isn't clear" in a case where it actually detected it correctly), even though the final verdict (computed in code, not by the model) is correct — this is a known limitation of a 1B model generating free-form text, not of the reconciliation pipeline itself. The verdict is what matters for the decision; the explanation is just a summary so a human can read it faster, always accompanied by the raw OCR text so it can be checked by hand.

**Permalinks to where QVAC inference runs** (replace `main` with the exact commit when pushing):
- [`src/ai/qvac.js`](https://github.com/Gabrululu/Cliq/blob/6ad6b1e81194d1fdff48ebaa10e8e88f862372d1/src/ai/qvac.js) — `ocrImage` (OCR) and `reconcileReceipt` + `computeVerdict` (LLM + code-level comparison guardrail).
- [`src/commands/reconcile.js`](https://github.com/Gabrululu/Cliq/blob/6ad6b1e81194d1fdff48ebaa10e8e88f862372d1/src/commands/reconcile.js) — the `merchant reconcile` command.

### Configuring the wallet (WDK)

1. Copy `.env.example` to `.env`.
2. Generate a test seed: `bare index.js wallet generate-seed` (or `pear run . -- wallet generate-seed`) and paste it into `MERCHANT_SEED_PHRASE`.
3. Set `WDK_RPC_URL` to your test EVM network's RPC endpoint (e.g. Sepolia).
4. Optional: `WDK_USDT_CONTRACT` with that test network's USD₮ contract address, and `WDK_USDT_DECIMALS` (default 6) if it differs.
5. `bare index.js wallet address` and `bare index.js wallet balance`.

The wallet uses `@tetherto/wdk` + `@tetherto/wdk-wallet-evm` (WDK's official EVM module). Address derivation (`wallet address`) is local and needs no network; `wallet balance` does need `WDK_RPC_URL` to be reachable.

## Data model

`merchant init` generates a P2P identity (an Ed25519 keypair) and creates a local store at `./.cliq/`. That identity signs the ledger events (`.cliq/ledger/events.json`), which `merchant sync` replicates between terminals via Hyperswarm. It's independent of the payment wallet (WDK), which derives its own accounts from `MERCHANT_SEED_PHRASE`.

Every ledger event follows this model:

```json
{
  "id": "receipt_...",
  "type": "invoice_paid",
  "merchant": "<merchant's P2P public key>",
  "invoiceId": "inv_...",
  "amount": "12500000",
  "currency": "USDT",
  "decimals": 6,
  "chain": "testnet",
  "payer": "0x...",
  "recipient": "0x...",
  "txHash": "0x...",
  "createdAt": "2026-08-22T21:16:18.504Z",
  "previousEventId": "<id of this same merchant's previous event, or null if it's the first one>",
  "previousEventHash": "<hex hash of the previous event, or null if it's the first one>",
  "signature": "<hex signature over everything above>"
}
```

Serialization is canonical JSON (keys sorted alphabetically, `src/ledger/canonical.js`) so the signature is deterministic regardless of the order fields were inserted in. `previousEventId` lets the referenced event be located without depending on storage order (important once the store mixes events from several merchants via sync); `previousEventHash` is the cryptographic property that actually protects the chain.

## Release and OTA with Pear (Phase 7)

**Tested against the real network** (not a theoretical guide): `pear stage`, `pear seed`, and `pear dump` all ran for real against the DHT. The Pear CLI available today (v3.2.0) changed quite a bit from what an earlier version of this file documented — the real flow differs in several points, detailed below.

### Real config in `package.json`

```json
"pear": {
  "name": "cliq",
  "stage": {
    "ignore": [".env", ".cliq", ".git"]
  }
}
```

`pear.stage.ignore` matters for security: `pear stage` doesn't respect `.gitignore`, it has its own exclusion list. Without this, `.env` (with the seed phrase) and `.cliq/` (with the P2P secret key) would be published as-is to the Pear link, which is public/DHT-distributed. Confirmed with `pear info --manifest` that neither one shows up in what's published.

### Real steps (Pear CLI v3.2.0)

```bash
# 1. Install the Pear CLI (bootstraps the first time it runs)
pnpm add -g pear

# 2. Generate a new link (replaces the old "channel" scheme like `pear stage dev`)
pear touch
# -> pear://<key>

# 3. Stage: syncs the current directory to that link
pear stage pear://<key>

# 4. Seed: makes the link available to other peers via the DHT
#    (has to keep running as long as someone wants to install/update)
pear seed pear://<key> --no-tty

# 5. Download the project into another folder/machine, as another peer would
#    ("pear run" was removed in this version of the CLI)
pear dump pear://<key> <destination-folder>
cd <destination-folder> && bare index.js help

# 6. Iterate: any change + running "pear stage pear://<key>" again (same link)
#    advances the version on the drive; peers that "pear dump" again
#    (or install via pear-cli/, see below) receive the change.
```

**Real differences found compared to older documentation:**
- `pear stage <channel>` (a channel name like "dev"/"production") **no longer exists** — it's now always `pear stage <link>`, with the link generated by `pear touch`.
- `pear run` **was removed entirely** from the CLI. The equivalent that does work is `pear dump <link> <folder>` (downloads the files) + running `bare index.js` there.
- `pear release` was also removed. The "production" model now is `pear provision` + `pear multisig` (quorum signing) — investigated but not implemented, see "Known limitations" below.

### Standalone CLI installable with `pear install` (Pear Track)

Beyond the above (which runs CLIQ via `bare index.js`, requiring `bare` to be installed), there's a separate submission at [`pear-cli/`](pear-cli/): the same CLI compiled as a **standalone binary**, installable with a single command and requiring no Node/Bare/Pear on the installing machine:

```bash
pear install pear://<pear-cli-key>
cliq-cli --version
```

With real OTA updates tested end to end (an installed copy updated itself in ~2 seconds after staging a new version). Full detail, including two real bugs found and fixed in the process, in [`pear-cli/README.md`](pear-cli/README.md) and in `TESTING.md` section 8.

## WDK Track (Tether) — Track 1: agent with guardrails over `@tetherto/wdk-cli` + MCP

A separate hackathon track, same sponsor as Pears (brief rule: "Pick one prize track and go deep" within WDK — both prizes were implemented anyway, see also the "Track 2" section below).

**WDK packages used** (installed version, see `package.json`):
- `@tetherto/wdk-cli` `1.0.0-beta.3` — the local CLI/wallet + native MCP server, the central piece of this submission.
- `@modelcontextprotocol/sdk` `1.30.0` — for the custom MCP server with the guardrails.
- (already present before) `@tetherto/wdk` `1.0.0-beta.16` + `@tetherto/wdk-wallet-evm` `1.0.0-beta.17` — CLIQ's original payment layer (`pay.js`), untouched.

**What was built**: a new command, `merchant agent settle <invoice-id> [--yes]`, that pays CLIQ invoices using `wdk-cli` (not the raw SDK `pay.js` already used), with guardrails **in code**:
1. Spend cap (`AGENT_SPEND_CAP_USDT` in `.env`) — rejects before touching the network if the invoice exceeds it.
2. The recipient is always the invoice's own — never a free parameter the agent (or whoever's talking to it) can choose.
3. Explicit confirmation — without `--yes` it only quotes via `wdk send --dry-run`.

Exposed to an AI agent via a dedicated MCP server, [`mcp/server.js`](mcp/server.js), with two tools: `quote_invoice_payment` and `confirm_invoice_payment` — neither accepts a free amount or address, only an `invoiceId`.

**Permalinks to where WDK is used** (replace `main` with the exact commit when pushing):
- [`src/commands/agent.js`](https://github.com/Gabrululu/Cliq/blob/6ad6b1e81194d1fdff48ebaa10e8e88f862372d1/src/commands/agent.js) — calls `wdk send`/`wdk get` via `bare-subprocess`, with the guardrails (Track 1).
- [`mcp/server.js`](https://github.com/Gabrululu/Cliq/blob/6ad6b1e81194d1fdff48ebaa10e8e88f862372d1/mcp/server.js) — the MCP server exposing the two tools (Track 1).
- [`src/commands/gasless.js`](https://github.com/Gabrululu/Cliq/blob/6ad6b1e81194d1fdff48ebaa10e8e88f862372d1/src/commands/gasless.js) — gasless payment via ERC-4337 + paymaster (Track 2).

### Setup from a clean clone

```bash
npm install    # or pnpm install — installs @tetherto/wdk-cli among other deps

# 1. Import the SAME seed CLIQ already uses (.env) into wdk-cli's own wallet
grep MERCHANT_SEED_PHRASE .env | cut -d= -f2- | \
  WDK_PASSPHRASE="pick-a-passphrase" ./node_modules/.bin/wdk wallet import --name cliq --seed-stdin

# 2. Unlock it (leaves a background daemon; ttl 0 = never expires)
WDK_PASSPHRASE="pick-a-passphrase" ./node_modules/.bin/wdk wallet unlock --name cliq --ttl 0

# 3. Register the test USD₮ token (wdk-cli's built-in "usdt" on Sepolia
#    points at the official contract, which we can't mint from — see TESTING.md #9)
./node_modules/.bin/wdk token add '{"network":"sepolia","token":"tpusdt","symbol":"tpUSDT","decimals":6,"isNative":false,"address":"0xc4dcc311c028e341fd8602d8eb89c5de94625927"}'

# 4. Try it out
bare index.js agent settle <invoice-id>          # quotes
bare index.js agent settle <invoice-id> --yes    # actually pays

# 5. Enable the MCP server for an agent (Claude Code already reads it via .mcp.json in this repo)
#    For Claude Desktop / OpenClaw, use wdk-cli's native setup for its own tools:
./node_modules/.bin/wdk mcp setup --ai-tool claude-code
```

**Network and tokens**: Sepolia (`chainId 11155111`). Test token: `ERC20Mock` at `0xc4dcc311c028e341fd8602d8eb89c5de94625927` (the same contract used in `TESTING.md` section 2, with a public `mint(address,uint256)` to self-fund).

**Validated end to end** (see `TESTING.md` section 9 for the full detail, with real output): the same wallet confirmed via `wdk get address`, a real balance read, quote and real payment (real `txHash`, receipt signed the same as `pay`), the spend cap guardrail rejecting a 50 USDT invoice with the cap at 10, and both tools tested through the real MCP protocol (not just via the CLI).

## WDK Track — Track 2: gasless payment (fee in USD₮, no ETH)

**Module used**: `@tetherto/wdk-wallet-evm-erc-4337` (ships as a dependency of `@tetherto/wdk-cli`) — ERC-4337 smart accounts with a paymaster, so whoever pays doesn't need to hold ETH: the network fee is charged in USD₮.

**What was built**: `merchant gasless pay <invoice-id> [--yes]` ([`src/commands/gasless.js`](https://github.com/Gabrululu/Cliq/blob/6ad6b1e81194d1fdff48ebaa10e8e88f862372d1/src/commands/gasless.js)) — the same pattern as `agent settle` (quotes without `--yes`, actually pays with `--yes`, generates the same signed receipt), but against a **smart account** instead of the regular EVM wallet. The smart account has a different address from the normal wallet (confirmed: `0x8469a1A3...` vs `0x86aCC9bc...` from the same seed) and never needed ETH to pay — Pimlico's paymaster charges the fee directly in USD₮.

### Setup (in addition to Track 1's)

```bash
# 1. Claim test USD₮ for the paymaster (Pimlico fixture, fixed oracle price of $1):
#    https://dashboard.pimlico.io -> Test Faucet -> USD₮ (Test) -> Sepolia -> your address
#    (the address from "wdk get address --network sepolia --index 1")

# 2. Get your API key: dashboard.pimlico.io -> API Keys -> Create API key
#    Save it in .env as PIMLICO_API_KEY=...

# 3. Find the real paymaster address for USD₮ on Sepolia (NOT a fixed value,
#    Pimlico returns it via API — don't copy it from anywhere else):
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"pimlico_getTokenQuotes","params":[{"tokens":["0xd077A400968890Eacc75cdc901F0356c943e4fDb"]},"0x0000000071727De22E5E9d8BAf0edAc6f37da032","0xaa36a7"]}' \
  "https://api.pimlico.io/v2/11155111/rpc?apikey=$PIMLICO_API_KEY"
# -> result.quotes[0].paymaster

# 4. Create the custom gasless network in wdk-cli (using the address from step 3):
./node_modules/.bin/wdk network create '{
  "network": "smart-account-sepolia-pimlico",
  "displayName": "Smart Account Sepolia (Pimlico)",
  "module": "@tetherto/wdk-wallet-evm-erc-4337",
  "nativeSymbol": "ETH",
  "decimals": 18,
  "testnet": true,
  "config": {
    "chainId": 11155111,
    "provider": "https://ethereum-sepolia-rpc.publicnode.com",
    "bundlerUrl": "https://api.pimlico.io/v2/11155111/rpc?apikey='"$PIMLICO_API_KEY"'",
    "paymasterUrl": "https://api.pimlico.io/v2/11155111/rpc?apikey='"$PIMLICO_API_KEY"'",
    "paymasterAddress": "<result from step 3>",
    "entryPointAddress": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    "safeModulesVersion": "0.3.0",
    "paymasterToken": { "address": "0xd077A400968890Eacc75cdc901F0356c943e4fDb" },
    "transferMaxFee": 1000000000
  }
}'
./node_modules/.bin/wdk token add '{"network":"smart-account-sepolia-pimlico","token":"eth","symbol":"ETH","decimals":18,"isNative":true}'
./node_modules/.bin/wdk token add '{"network":"smart-account-sepolia-pimlico","token":"usdt","symbol":"USD₮","decimals":6,"isNative":false,"address":"0xd077A400968890Eacc75cdc901F0356c943e4fDb"}'

# 5. Fund the smart account (its address differs from the normal wallet):
#    wdk get address --network smart-account-sepolia-pimlico --index 1
#    Transfer USD₮ to it from the normal wallet once (this step does need ETH):
./node_modules/.bin/wdk send --network sepolia --to <smart-account-address> --amount 100 --token usdt-official --index 1

# 6. IMPORTANT: restart the daemon so it picks up the new config
#    (wdk-cli caches network config when the background daemon starts)
./node_modules/.bin/wdk wallet lock --all
WDK_PASSPHRASE="..." ./node_modules/.bin/wdk wallet unlock --name cliq --ttl 0

# 7. Try it out
bare index.js gasless pay <invoice-id>          # quotes, no ETH
bare index.js gasless pay <invoice-id> --yes    # actually pays, fee in USD₮
```

**Validated end to end with real money on Sepolia** (full detail in `TESTING.md` section 10): the smart account's ETH balance confirmed at 0 the whole time, a real send with a real `txHash` and fee charged in USD₮, receipt signed and chained the same as every other payment method.

## Known limitations

This list reflects what **genuinely is still missing**, not what "couldn't be tested" — everything below has been tested against the real network (see `TESTING.md` for the full command-by-command detail):

- There's no default preloaded testnet USD₮ contract address: you need to set `WDK_USDT_CONTRACT` to whatever test token you use (this avoids assuming a wrong address in the demo). On Sepolia an `ERC20Mock` with a public `mint(address,uint256)` was used to self-fund with test tokens — see `TESTING.md` section 2.
- `pay` marks an invoice as `submitted` as soon as WDK broadcasts the transaction (`eth_sendRawTransaction`), it doesn't wait for on-chain confirmations; the ledger doesn't have a `confirmed` state yet either (it only records that it was broadcast, with its `txHash`).
- The default QVAC model (1B parameters, quantized) can give imprecise answers about numeric ledger data (see the note in the QVAC section above) — not a bug, a model-size limitation.
- The "production" flow with Pear multisig (`pear provision` + `pear multisig`) was investigated but not implemented — it was decided the release-governance complexity isn't worth it at the project's current size. Full detail in `TESTING.md` section 7.
- The `pear-cli/` (Pear Track) standalone CLI was built for **linux-x64** and **win32-x64** (Windows, validated 2026-08-24 against the real network — see `pear-cli/README.md`, "Windows (win32-x64)" section). **macOS** is still missing — a host on that platform (or CI) is needed to produce that binary. The Windows build was published to a different Pear link (`pear://mp8yxd4xro9apkxpsgp34upeuqhdyhem64r7wbtqigjuac9qqemo`) than the original linux-x64 build, because that link's private key isn't available on this machine — full detail in `pear-cli/README.md`.
- The `pear seed` for either link (landing/app or `pear-cli/`) needs to keep running on a machine that stays on during the judging period — an ephemeral dev sandbox isn't enough for that.
- The custom gasless network (`smart-account-sepolia-pimlico`) lives in `wdk-cli`'s local config (`~/.config/wdk-cli/config.json`), not in this repo — it needs to be recreated on every new machine following the "WDK Track — Track 2" steps (including your own Pimlico API key, which isn't shared).
- After any `wdk network create`/`wdk token add`, the `wdk-cli` daemon needs restarting (`wallet lock --all` + `wallet unlock`) for it to pick up the new config — it doesn't reread it on its own. Real bug found while implementing Track 2, documented in `TESTING.md` section 10.
- `merchant agent settle` (WDK Track 1) requires the `wdk-cli` wallet to be imported and unlocked by hand once (`wdk wallet import` + `wdk wallet unlock --ttl 0`, see the section above) before use — the command itself doesn't do it.
- `merchant reconcile` (QVAC Track 1) was tested with synthetic receipts generated for the test, not real photos of receipts under different camera conditions — the OCR pipeline is real and runs locally, but the variety of "dirty" inputs is limited by not having a camera in this dev environment.
- The `@qvac/ocr-ggml` addon (~500MB with its native binaries) adds to the already-heavy `@qvac/sdk` — same disk-space note as the `ask` section above.

## Security

- `.cliq/` (P2P identity) and `.env` (wallet seed phrase) contain sensitive material and are excluded from git via `.gitignore`. Never commit them.
- `wallet generate-seed` is for development/testnet only: never use that seed on mainnet or show it in a recorded demo.
- No real seed phrases are shown in the documentation or in demos.

## Project structure

```
index.js              Entry point (Bare or Pear)
src/
  cli.js               Command router
  commands/            One file per CLI command (init, wallet, invoice, pay, ledger, receipt, sync, peers, ask...)
  payments/wdk.js       WDK integration (wallet, balance, transfers)
  invoices/store.js      Local invoice store
  ledger/                Signed events (creation, verification, store)
  p2p/                    Sync via Hyperswarm (protocol, merge, swarm)
  ai/                     Context + QVAC integration for "merchant ask" and "merchant reconcile" (OCR + LLM)
  util/                   Shared helpers (flags, .env, amount formatting, paths)
  commands/agent.js       WDK Track 1: "agent settle", guardrails over @tetherto/wdk-cli
  commands/gasless.js     WDK Track 2: "gasless pay", fee in USD₮ via ERC-4337 + paymaster
  commands/reconcile.js   QVAC Track 1: "reconcile", receipt reconciliation via local OCR + LLM
mcp/
  server.js               WDK Track: MCP server (Node.js) with the quote/confirm_invoice_payment tools
public/
  index.html             Landing page (self-contained)
  assets/                 Logo and landing thumbnail
pear-cli/                Pear Track: standalone CLI installable with "pear install" + OTA (see its own README)
```

Full detail on every module, the data model, and the design decisions is in [`architecture.md`](architecture.md).

## License

MIT — see the `license` field in `package.json`.
