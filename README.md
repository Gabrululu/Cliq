<p align="center">
  <img src="public/assets/logo-lockup.svg" alt="CLIQ" width="320">
</p>

# CLIQ

Self-custodial USD₮ payment terminal for merchants, distributed as a P2P CLI. Payments run on Tether's WDK, the ledger syncs peer-to-peer over Hyperswarm via Pear, and an optional local assistant (QVAC) answers questions about your own sales — no server, anywhere, ever.

## What it includes

- **USD₮ payments** with a self-custodial wallet (WDK): address, balance, fee quote, and transfer.
- **Invoices and charges**: create an invoice, quote the payment, confirm it (`--yes`), with explicit states (a payment that never happened is never simulated).
- **Signed ledger**: every payment generates a signed receipt (Ed25519) chained to the merchant's previous receipts; `receipt verify` detects any alteration.
- **P2P sync** between terminals via Hyperswarm, with conflict detection instead of silent overwriting.
- **Local assistant (QVAC)**: natural-language questions about your own sales, with no data sent to any server.
- **P2P distribution via Pear**, with automatic (OTA) updates, no app store, no central server.
- **AI agent payments**: an MCP server exposes guardrailed invoice payment to AI agents, and a gasless mode lets anyone pay with zero ETH in their wallet.

## How the three pieces fit together

CLIQ is one product built on three independent building blocks, each solving a different problem:

- **WDK (Tether)** is the payment layer — a non-custodial EVM wallet that derives accounts from a seed phrase, quotes fees, and sends USD₮. Every command that touches money (`wallet`, `invoice`, `pay`, `agent settle`, `gasless pay`) goes through it.
- **Pear** is the distribution layer — the same CLI runs directly under `bare` for development, or gets staged to a `pear://` link and installed elsewhere with `pear install`, updating itself in place over P2P with no app store or release server. It's also what `sync`/`peers` use for discovering other terminals (Hyperswarm, the P2P stack Pear itself is built on).
- **QVAC** is the optional local-AI layer — a fully on-device LLM that answers questions about the merchant's own ledger (`ask`) and reconciles photographed receipts against invoices via OCR (`reconcile`). It never leaves the device, and if it's unavailable for any reason, every other part of CLIQ keeps working unaffected.

None of the three depends on a company-run server. See [`architecture.md`](architecture.md) for the full technical breakdown of how they're wired together.

## Documentation

- [`architecture.md`](architecture.md) — full technical architecture.
- [`brandkit.md`](brandkit.md) — palette, typography, logo, and voice guide for building presentations.
- [`deck.md`](deck.md) — pitch deck content, slide by slide.
- [`TESTING.md`](TESTING.md) — checklist of everything validated against real infrastructure, command by command.
- [`pear-cli/README.md`](pear-cli/README.md) — the standalone CLI build: installable with `pear install` + real OTA.
- Further below: ["AI agent payments"](#ai-agent-payments-mcp) and ["Gasless payments"](#gasless-payments-no-eth-needed).

## Landing page

<p align="center">
  <a href="public/index.html">
    <img src="public/assets/landing-preview.png?v=372bead" alt="Preview of the CLIQ landing page" width="640">
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

## Requirements

- [Node.js](https://nodejs.org) 18 or higher (used for `npm install`).
- [`bare`](https://www.npmjs.com/package/bare) installed globally to run the CLI in development: `npm install -g bare`.
- [`pear`](https://www.npmjs.com/package/pear) installed globally, only if you're going to try P2P distribution: `npm install -g pear`. Requires open network access to the DHT — see the "Release and OTA with Pear" section below.

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

> Note: the version of the Pear CLI used here (3.2.0) changed compared to older versions: `pear run` was **removed** (that command no longer exists) and `pear stage <channel>` no longer accepts a channel name like "dev" — it now expects a `pear://...` link generated with `pear touch`. See the "Release and OTA with Pear" section below for the full detail.

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

### Charging flow

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

### Signed ledger

Every successful `pay --yes` appends a signed `invoice_paid` event to `.cliq/ledger/events.json`, chained to the previous event (like a local, append-only mini-blockchain):

```bash
bare index.js ledger                        # Lists all events
bare index.js receipt show <receipt-id>      # Detail of a receipt
bare index.js receipt verify <receipt-id>    # Verifies signature + chain link
```

`receipt verify` checks:
1. **Signature** - the event was signed with the merchant's P2P identity private key (generated in `merchant init`, Ed25519 via `hypercore-crypto`) and it covers every field (amount, recipient, txHash, etc.), so altering any of them invalidates the signature.
2. **Chain link** - the event's `previousEventHash` field matches the hash of the immediately preceding event in the local store; if someone edits or reorders a previous event, the next one stops verifying.

**Note:** chaining (`previousEventId`/`previousEventHash`) is *per merchant*, not global to the file: each P2P identity only chains against its own previous events, so multiple merchants writing to the same local store via sync never break each other's chain.

### P2P synchronization

```bash
# Terminal A
bare index.js sync --room demo-store

# Terminal B (another folder/another .cliq, shared test network)
bare index.js sync --room demo-store

# Only discover who's in the room, without exchanging events:
bare index.js peers --room demo-store
```

`sync` joins a P2P room via Hyperswarm (topic = hash of `cliq:ledger:<room>`, public DHT). When connecting to each peer, both sides send their full local ledger as a JSON message; every incoming event is verified (signature + per-merchant chain link) before being accepted, duplicates are skipped by `id`, and conflicts are listed at the end: same `invoiceId` with different `txHash` values across events from different merchants (a possible double record), flagged for manual review instead of being auto-resolved.

**Design note:** instead of each terminal keeping its own Hypercore (an append-only feed) and replicating them with each other by public key (the standard Hypercore/corestore pattern for multi-writer), CLIQ does a direct exchange of already-signed events (newline-delimited JSON) over the encrypted Hyperswarm connection. The security property that actually matters (nobody can forge or alter an event) already comes from the Ed25519 signature, which is transport-independent — a simpler protocol doesn't give any of that up, and it's easier to audit. A feed-per-peer Hypercore+corestore setup remains a valid next step if the canonical pattern is ever needed (e.g. to replay a new peer's full history instead of just its current state).

**Network robustness:** `swarm.join(...).flushed()` and `swarm.destroy()` can hang indefinitely if the DHT bootstrap can't be reached, so neither call is awaited in a blocking way — every `sync`/`peers` invocation always finishes within its `--timeout` window plus a fixed cleanup margin, whether or not the network is available. On networks with restrictive NAT, discovery can take significantly longer than the default 20s timeout — worth budgeting for in production.

### QVAC queries

```bash
bare index.js ask "which invoices are pending?"
bare index.js ask "how much did I sell in total?"
```

`ask` builds a text context out of the invoices and the local ledger (`src/ai/context.js`), and passes it to a local language model via `@qvac/sdk` (`loadModel` + `completion`, default model `LLAMA_3_2_1B_INST_Q4_0`, configurable with `QVAC_MODEL` in `.env`). Everything runs on the machine, with no data sent to an external server. QVAC is strictly a query bonus: **if it fails or isn't available, the rest of CLIQ (payments, ledger, sync) keeps working the same** — `ask` never blocks or gates any other command.

The model download (773MB, distributed over the same P2P registry Hyperswarm uses) can take a few minutes on a fresh install; `QVAC_LOAD_TIMEOUT_MS` in `.env` controls how long `ask` waits before giving up with a clear error instead of hanging (default 120s — raise it if your connection is slow). If `ask` fails for any reason, it prints the error plus the raw context it would have sent to the model, so the command stays useful even if the AI doesn't answer.

**Note on answer quality:** with the default model (1B parameters, Q4 quantized), answers to concrete questions about the ledger can be imprecise (e.g. not summing amounts correctly). This is a limitation of model size, not an integration bug — consider a bigger model via `QVAC_MODEL` if accuracy matters more than speed/size.

**Disk space notice:** `@qvac/sdk` (the "full" package, meant for Node/Expo) ships **all** of its native addons as dependencies — llm, whisper, ocr, tts, image diffusion, etc. — even though CLIQ only uses two of them. A plain `npm install` can grow `node_modules` by several GB. For a leaner standalone build, consider migrating to [`@qvac/bare-sdk`](https://www.npmjs.com/package/@qvac/bare-sdk), installing *only* the addons actually used (`@qvac/llm-llamacpp` for `ask`, `@qvac/ocr-ggml` for `reconcile`) and building a dedicated worker entry — see `@qvac/bare-sdk`'s docs.

## Receipt reconciliation (OCR and local LLM)

```bash
bare index.js reconcile <invoice-id> <path-to-receipt-image> [--json]
```

Takes a photo/scan of a payment receipt, runs local OCR on it (`@qvac/sdk` + `@qvac/ocr-ggml` addon, EasyOCR's `OCR_LATIN` model), and compares the extracted text against the invoice already on file in CLIQ, flagging `MATCH` / `NO_MATCH` / `UNCERTAIN` with an explanation that's verifiable in five seconds. It doesn't change the invoice's status: it's an assisted read for a human to decide on, not an automatic payment.

**Key design decision:** the text model extracts the amount from the receipt correctly far more often than it compares it correctly — a small model is good at extraction, unreliable at arithmetic comparison. So the final verdict **never comes from the model**. `src/ai/qvac.js` (`computeVerdict`) takes the amount the model extracted and compares it against the invoice's amount *in code*. The model's own verdict is kept separately (`modelVerdict`) only so a disagreement can be detected and shown (`modelDisagreed: true`), never to decide — the same "guardrail in code, not in the prompt" principle used for agent payments below.

If no legible text is detected, or the invoice/image doesn't exist, `reconcile` fails explicitly rather than inventing an amount. Full test matrix (clean receipts, rotated/blurred, mismatched amounts, blank images) is in `TESTING.md`.

**Honest limitation:** the explanations the model gives are sometimes grammatically imprecise even when the final verdict (computed in code, not by the model) is correct — a known limitation of a 1B model generating free-form text, not of the reconciliation pipeline itself. The verdict is what matters for the decision; the explanation is just a summary, always accompanied by the raw OCR text so it can be checked by hand.

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

## Release and OTA with Pear

### Config in `package.json`

```json
"pear": {
  "name": "cliq",
  "stage": {
    "ignore": [".env", ".cliq", ".git"]
  }
}
```

`pear.stage.ignore` matters for security: `pear stage` doesn't respect `.gitignore`, it has its own exclusion list. Without this, `.env` (with the seed phrase) and `.cliq/` (with the P2P secret key) would be published as-is to the Pear link, which is public/DHT-distributed. Confirm with `pear info --manifest` that neither one shows up in what's published.

### Steps (Pear CLI v3.2.0)

```bash
# 1. Install the Pear CLI (bootstraps the first time it runs)
pnpm add -g pear

# 2. Generate a new link
pear touch
# -> pear://<key>

# 3. Stage: syncs the current directory to that link
pear stage pear://<key>

# 4. Seed: makes the link available to other peers via the DHT
#    (has to keep running as long as someone wants to install/update)
pear seed pear://<key> --no-tty

# 5. Download the project into another folder/machine, as another peer would
pear dump pear://<key> <destination-folder>
cd <destination-folder> && bare index.js help

# 6. Iterate: any change + running "pear stage pear://<key>" again (same link)
#    advances the version on the drive; peers that "pear dump" again
#    (or install via pear-cli/, see below) receive the change.
```

Compared to older Pear CLI documentation: `pear stage <channel>` (a channel name like "dev"/"production") no longer exists — it's always `pear stage <link>`, with the link generated by `pear touch`. `pear run` was removed entirely; the equivalent is `pear dump <link> <folder>` + running `bare index.js` there. `pear release` was also removed — the "production" model now is `pear provision` + `pear multisig` (quorum signing), not implemented here (see "Known limitations").

### Standalone installable CLI (`pear install`)

Beyond the above (which runs CLIQ via `bare index.js`, requiring `bare` to be installed), [`pear-cli/`](pear-cli/) has the same CLI compiled as a **standalone binary**, installable with a single command and requiring no Node/Bare/Pear on the installing machine:

```bash
pear install pear://<pear-cli-key>
cliq-cli --version
```

With OTA updates: an installed copy updates itself in place once a new version is staged to the same link, no user action needed. Full detail in [`pear-cli/README.md`](pear-cli/README.md).

## AI agent payments (MCP)

`merchant agent settle <invoice-id> [--yes]` pays a CLIQ invoice using `@tetherto/wdk-cli` (Tether's own CLI/wallet + MCP server), with guardrails **in code, not in a prompt**:

1. Spend cap (`AGENT_SPEND_CAP_USDT` in `.env`) — rejects before touching the network if the invoice exceeds it.
2. The recipient is always the invoice's own — never a free parameter the agent (or whoever's talking to it) can choose.
3. Explicit confirmation — without `--yes` it only quotes via `wdk send --dry-run`.

Exposed to an AI agent via a dedicated MCP server, [`mcp/server.js`](mcp/server.js), with two tools: `quote_invoice_payment` and `confirm_invoice_payment` — neither accepts a free amount or address, only an `invoiceId`. The idea: `pay` is meant to be run by a human at a terminal, where the human is the trust boundary; `agent settle` is meant to be called by something that isn't a human, so the guardrails have to live in code an agent can't talk its way around.

### Setup from a clean clone

```bash
npm install    # or pnpm install — installs @tetherto/wdk-cli among other deps

# 1. Import the SAME seed CLIQ already uses (.env) into wdk-cli's own wallet
grep MERCHANT_SEED_PHRASE .env | cut -d= -f2- | \
  WDK_PASSPHRASE="pick-a-passphrase" ./node_modules/.bin/wdk wallet import --name cliq --seed-stdin

# 2. Unlock it (leaves a background daemon; ttl 0 = never expires)
WDK_PASSPHRASE="pick-a-passphrase" ./node_modules/.bin/wdk wallet unlock --name cliq --ttl 0

# 3. Register your test USD₮ token (wdk-cli's built-in "usdt" on Sepolia
#    points at the official contract, which you likely can't mint from directly)
./node_modules/.bin/wdk token add '{"network":"sepolia","token":"tpusdt","symbol":"tpUSDT","decimals":6,"isNative":false,"address":"0xc4dcc311c028e341fd8602d8eb89c5de94625927"}'

# 4. Try it out
bare index.js agent settle <invoice-id>          # quotes
bare index.js agent settle <invoice-id> --yes    # actually pays

# 5. Enable the MCP server for an agent (Claude Code already reads it via .mcp.json in this repo)
#    For Claude Desktop / OpenClaw, use wdk-cli's native setup for its own tools:
./node_modules/.bin/wdk mcp setup --ai-tool claude-code
```

## Gasless payments (no ETH needed)

`merchant gasless pay <invoice-id> [--yes]` ([`src/commands/gasless.js`](src/commands/gasless.js)) uses `@tetherto/wdk-wallet-evm-erc-4337` — ERC-4337 smart accounts with a paymaster — so whoever pays never needs to hold ETH: the network fee is charged in USD₮ directly. Same pattern as `agent settle` (quotes without `--yes`, pays with `--yes`, generates the same signed receipt), but against a smart account instead of the regular EVM wallet — which has its own, different address derived from the same seed.

### Setup (in addition to the agent setup above)

```bash
# 1. Fund the paymaster's test USD₮ (via your paymaster provider's test faucet)
#    to the address from "wdk get address --network sepolia --index 1"

# 2. Get your paymaster provider's API key and save it in .env, e.g. PIMLICO_API_KEY=...

# 3. Find the real paymaster contract address for USD₮ on your network
#    (this is returned by the provider's API, e.g. Pimlico's pimlico_getTokenQuotes —
#    never a value you should hardcode from documentation)
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

## Known limitations

- There's no default preloaded testnet USD₮ contract address: set `WDK_USDT_CONTRACT` to whatever test token you use.
- `pay` marks an invoice as `submitted` as soon as WDK broadcasts the transaction (`eth_sendRawTransaction`); it doesn't wait for on-chain confirmations, and the ledger has no `confirmed` state yet — only that it was broadcast, with its `txHash`.
- The default QVAC model (1B parameters, quantized) can give imprecise answers about numeric ledger data — a model-size limitation, not a bug.
- "Production" release governance via Pear multisig (`pear provision` + `pear multisig`) isn't implemented — a single stable `stage`+`seed` link is enough at this project's size; see `TESTING.md` for what adopting multisig would require.
- The `pear-cli/` standalone CLI is built for **linux-x64** and **win32-x64**; **macOS** still needs a host on that platform (or CI) to produce that binary.
- The custom gasless network (`smart-account-sepolia-pimlico`) lives in `wdk-cli`'s local config, not in this repo — it needs to be recreated on every new machine (including your own paymaster API key).
- After any `wdk network create`/`wdk token add`, the `wdk-cli` daemon needs restarting (`wallet lock --all` + `wallet unlock`) to pick up the new config — it doesn't reread it on its own.
- `merchant agent settle` requires the `wdk-cli` wallet to be imported and unlocked by hand once before use — the command itself doesn't do it.
- `merchant reconcile` has been tested with synthetic receipts, not real photos across varied camera/lighting conditions — the OCR pipeline itself is real and runs locally.
- `@qvac/ocr-ggml` (~500MB with its native binaries) adds to the already-heavy `@qvac/sdk` — see the disk-space note in the QVAC section above.

Full validation detail and real transaction/command output for all of the above is in [`TESTING.md`](TESTING.md).

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
    agent.js            AI agent payments: "agent settle", guardrails over @tetherto/wdk-cli
    gasless.js           Gasless payments: "gasless pay", fee in USD₮ via ERC-4337 + paymaster
    reconcile.js          Receipt reconciliation: "reconcile", via local OCR + LLM
  payments/wdk.js       WDK integration (wallet, balance, transfers)
  invoices/store.js      Local invoice store
  ledger/                Signed events (creation, verification, store)
  p2p/                    Sync via Hyperswarm (protocol, merge, swarm)
  ai/                     Context + QVAC integration for "merchant ask" and "merchant reconcile" (OCR + LLM)
  util/                   Shared helpers (flags, .env, amount formatting, paths)
mcp/
  server.js               MCP server (Node.js) with the quote/confirm_invoice_payment tools
public/
  index.html             Landing page (self-contained)
  assets/                 Logo and landing thumbnail
pear-cli/                Standalone CLI installable with "pear install" + OTA (see its own README)
```

Full detail on every module, the data model, and the design decisions is in [`architecture.md`](architecture.md).

## License

MIT — see the `license` field in `package.json`.
