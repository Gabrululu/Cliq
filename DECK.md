# TiendaPay — Pitch Deck

Slide-by-slide content for the Aleph Hackathon 2026 pitch. Written to be
copied straight into slides — each slide lists the on-screen content, the
suggested visual, and (where useful) a speaker note. Palette, type, and logo
references are in [`brandkit.md`](brandkit.md); technical detail behind any
claim here is in [`architecture.md`](architecture.md) and [`README.md`](README.md).

Target length: 8 slides, ~4 minutes talk time — typical hackathon pitch slot.
Trim to 5 slides (1, 2, 3, 5, 8) if the slot is shorter.

---

## Slide 1 — Title

**On screen:**
- `logo-lockup.svg`, centered
- *A payment terminal for merchants, not for the cloud.*
- "Aleph Hackathon 2026"

**Visual:** `public/assets/logo-lockup.svg` on a plain `sand` background.

**Speaker note:** State the name once, clearly, and move on — don't spend
time on the title slide.

---

## Slide 2 — The problem

**On screen:**
- Getting paid is the easy part. Everything else is what wears a small
  business down:
  1. Keeping track of who paid, who's running a tab, and what today's total
     sales were — by hand or from memory.
  2. Trusting a paper notebook that can be lost, damaged, or quietly altered.
  3. Depending on internet access or a bank just to record a sale.

**Visual:** plain text, three lines, generous whitespace — no stock photo.

**Speaker note:** This is deliberately not "crypto adoption is hard." The
problem is bookkeeping and trust for a business that may not have reliable
internet or banking access — payments are the mechanism, not the pitch.

---

## Slide 3 — The solution

**On screen:**
- **TiendaPay**: a command-line payment terminal that
  - accepts **USD₮** directly into a wallet the merchant controls,
  - turns every sale into a **cryptographically signed receipt** nobody can
    alter after the fact,
  - keeps working **without internet**, and syncs automatically once a
    connection (or another terminal) is available,
  - lets the merchant **ask their own sales data questions** in plain
    language, answered by a model that runs entirely on-device.

**Visual:** the receipt visual from the landing page hero
(`public/assets/landing-preview.png`, cropped to the receipt card) or a live
screenshot of `merchant pay ... --yes` output.

---

## Slide 4 — How it works

**On screen (four steps, numbered — this is a real sequence, not decoration):**
1. **Create the charge** — `merchant invoice create --amount 12.50`
2. **Customer pays** — from their own wallet, in USD₮; fee is quoted before sending
3. **A signed receipt is created** — `merchant pay <id> --yes`, chained to the merchant's own prior receipts
4. **It syncs on its own** — `merchant sync --room <name>`, over encrypted peer-to-peer connections

**Visual:** a terminal screenshot or screen recording of the four commands
running in sequence. This is the strongest demo moment — use a live terminal
if presenting in person.

**Speaker note:** If doing a live demo, run these four commands against a
funded testnet wallet ahead of time so the pitch doesn't depend on live
network conditions during the talk.

---

## Slide 5 — Built on

**On screen (three tracks, in priority order):**
- **WDK** (Tether Wallet Development Kit) — non-custodial wallet, balance,
  fee quoting, and USD₮ transfers. The payment core.
- **Pear** — peer-to-peer app distribution and over-the-air updates; no app
  store, no central release server. A standalone version of the CLI installs
  with one command (`pear install pear://<key>`, no Node/Bare/Pear needed on
  the receiving machine) and updates itself in place — proven live, not just
  described.
- **QVAC** — fully local LLM inference for the natural-language sales
  assistant; no data leaves the device.

**Visual:** three simple labeled blocks, `ink`-on-`sand`, no logos borrowed
from the track sponsors unless their brand guidelines explicitly allow it.

**Speaker note:** Name the priority order explicitly if asked: payments
first, distribution second, AI assistant as a bonus on top — the product
works fully with QVAC turned off.

---

## Slide 6 — What's real today

**On screen:**
- 7 of 7 planned phases implemented **and verified against real
  infrastructure** — not just written and assumed correct:
  - A real payment on Sepolia: `pay --yes` broadcast a real transfer, real
    `txHash`, persisted in the signed receipt.
  - Two independent terminals discovered each other over the DHT, synced
    their ledgers, and correctly flagged a deliberately staged conflict
    instead of silently overwriting it.
  - The local AI assistant downloaded its model (773MB, peer-to-peer) and
    answered a real question about the merchant's own sales data.
  - The CLI installs with a single `pear install pear://<key>` — a
    standalone binary, no Node/Bare/Pear required on the receiving machine
    — and a live update reached that installed copy automatically.
  - Both WDK Track prizes, done and verified with real transactions: an
    `agent settle` command (`@tetherto/wdk-cli` + a custom MCP server) that
    pays an invoice only inside code-enforced guardrails — spend cap, fixed
    recipient, quote-then-confirm — and a `gasless pay` command that settles
    an invoice with zero ETH in the wallet, fee paid entirely in USD₮ via an
    ERC-4337 smart account and a Pimlico paymaster.
- Two real bugs were found and fixed by actually running this against live
  networks, not just reading the code: a P2P hang with no DHT bootstrap, and
  an updater silently looking in the wrong place for its own binary.

**Visual:** the phase checklist from `README.md`, or a simple 7/7 progress
indicator.

**Speaker note:** This slide exists to pre-empt the obvious judge question
("did you actually test this?") with a direct, honest answer instead of
letting it surface as a gotcha during Q&A. Every claim above has a command
transcript in `TESTING.md` if someone wants to check.

---

## Slide 7 — Why this design

Pick 1–2 of these to speak to, don't read all of them as bullets:

- **Self-custody by construction.** The payment wallet and the ledger-signing
  identity are two separate keys; TiendaPay itself never holds funds.
- **Signature over transport.** The security property that matters — nobody
  can forge a receipt — comes from an Ed25519 signature covering every field
  of the record, independent of however the record gets to another device.
  That's what let sync stay simple.
- **Never invents state.** A payment is only ever marked "sent" once a real
  transaction hash comes back — never simulated, never assumed, and a
  network failure never gets silently upgraded to a success.

**Visual:** none needed — this is a talking slide.

---

## Slide 8 — Closing

**On screen:**
- `logo-lockup.svg`
- *Built for the counter, not the cloud.*
- Repository: `github.com/gabrululu/TiendaPay`
- (Team / contact — fill in before presenting)

**Visual:** same title-slide treatment as Slide 1, for symmetry.

**Speaker note:** End on the repository link and an explicit ask if there is
one (feedback, a specific track prize, a follow-up conversation) — a hackathon
pitch should not fade out without a concrete next step for the audience.

---

## Demo script (if presenting live instead of screenshots)

Run in order, in a terminal with a large font:

```bash
bare index.js wallet address
bare index.js invoice create --amount 12.50 --memo "Demo sale"
bare index.js pay <invoice-id> --yes
bare index.js ledger
bare index.js receipt verify <receipt-id>
bare index.js ask "how much did I sell today?"
```

Have a funded testnet wallet and a working `WDK_RPC_URL` configured in `.env`
*before* going on stage — see the "Configure the wallet" section of
`README.md`. Do not use a real seed phrase or show `.env` on screen.

### Pear Track add-on: install + live OTA update

If pitching the Pear Track specifically, this is the strongest moment in the
whole demo — it's provably not a screenshot:

```bash
# On a second machine (or a clean folder), with the seed running elsewhere:
pear install pear://<pear-cli-key>
tiendapay-cli --version

# Meanwhile, on the dev machine: bump the version, rebuild, re-stage
# ... (see pear-cli/README.md for the exact build steps)

# Back on the installed copy, a few seconds later, unattended:
tiendapay-cli --version   # now shows the new version — nobody touched this machine
```

Keep `pear seed pear://<pear-cli-key> --no-tty` running the whole time, on a
machine that stays on — see `pear-cli/README.md`.
