# Trade desk notes (eumemic / Q*memic)

This repo is a dry-run-only research fork of [jarrodwatts/jev-trader](https://github.com/jarrodwatts/jev-trader). Keep it close to upstream. Use it to study block-paced on-chain market making, not as a live desk.

## What this is

Monad posts a new block about every 300 ms. This bot reads the Kuru MON-USDC on-chain order book each block, asks a TypeSafe Jev model (or the `mock` stand-in) buy or sell, and posts one post-only limit order on that side, one tick inside the touch.

That is on-chain market making at block pace. It is not equity HFT, not a broker DMA loop, and not a millisecond collocated stack. Latency here is "did we fit inside this 300 ms block", not "did we win the NASDAQ queue".

The upstream demo is built to send real orders from a real wallet. This fork defaults the other way: simulate fills against the live book, never sign, never send.

Alpaca paper (or any equity/paper broker sleeve) is a separate track. Do not wire it into this process.

## Three modes

1. **Mock dry-run (default, what this PR smokes).** `MODEL=mock` (or unset). No TypeSafe key. No `PRIVATE_KEY`. Real book, mock decisions, simulated fills. This is the first-run path.

2. **Jev dry-run (operator local only).** `MODEL=jev` plus `TYPESAFE_AI_API_KEY` in a local `.env` (gitignored). Still no `PRIVATE_KEY`. Still `DRY_RUN=true` / `ALLOW_LIVE` not `true`. Real book, real Jev decisions, simulated fills. Do not put that key in the repo, in a PR, or in chat. Cloud agents and CI should not expect it.

3. **Live (out of scope for this PR).** Only if `ALLOW_LIVE=true` AND a `PRIVATE_KEY` AND `DRY_RUN` is not `true`. Signs and sends a real `batchUpdate` every block. Spends gas and margin. Do not enable this here.

`PRIVATE_KEY` alone does not go live. A leftover wallet key is ignored unless you also set `ALLOW_LIVE=true`.

Do not commit wallet keys, TypeSafe keys, funded wallets, or a `.env` with secrets.

## Env vars

Copy `.env.example` to `.env`. Bun loads `.env` automatically.

Required for mode 1 (mock dry-run smoke): nothing. Defaults are dry-run + `MODEL=mock`.

| Var | Default | Notes |
| --- | --- | --- |
| `DRY_RUN` | `true` in `.env.example` | If `true`, live is vetoed even with a key and `ALLOW_LIVE`. |
| `ALLOW_LIVE` | unset / `false` | Must be the exact string `true` to honor `PRIVATE_KEY`. |
| `PRIVATE_KEY` | unset | Ignored unless live is fully opted in. |
| `MODEL` | `mock` | `mock` is a local momentum heuristic (mode 1). `jev` is mode 2. |
| `TYPESAFE_AI_API_KEY` / `TYPESAFE_API_KEY` | unset | Operator env only, for mode 2. Either name works. Never commit or paste into a PR. |
| `JEV_MODEL_ID` | `jev-latest` | Used when `MODEL=jev`. |
| `RPC_URL` / `READ_RPC_URL` | `https://rpc.monad.xyz` | Public Monad RPC. Fine for dry-run. |
| `WS_URL` | unset unless in `.env` | Optional newHeads. Polling always runs. |
| `PORT` | `3000` | Snapshot at `GET /`. |
| `TRADE_SIZE_MON` | `200` | Kuru MON-USDC minimum. |
| `QUOTE_INSIDE_TICKS` | `1` | Ticks inside the touch. Never crosses. |
| `HORIZON_BLOCKS` | `100` | Model question horizon (~30 s). |

See `.env.example` for margin, gas, and bankroll knobs. Those matter for live only.

## How to run (Bun)

Mode 1, mock dry-run (no TypeSafe key, no wallet key):

```
cp .env.example .env
bun install
MODEL=mock bun run start
```

Leave `PRIVATE_KEY` unset. Confirm `GET /` reports `"dryRun": true`. Block events should appear on `GET /events` (SSE) and in stdout about every 300 ms.

Bounded dry-run script (no server, forces `DRY_RUN=true`, drops `PRIVATE_KEY` and `ALLOW_LIVE`, exits cleanly). Prints live `getL2Book` mid/bid/ask plus the decision each block:

```
MODEL=mock bun run dry-run-jev -- --blocks 15
```

Mode 2, Jev dry-run, on the operator machine only: copy `.env.example` to `.env`, set `MODEL=jev`, and put `TYPESAFE_AI_API_KEY` or `TYPESAFE_API_KEY` in that local file. Keep `PRIVATE_KEY` empty and `ALLOW_LIVE` not `true`. Then `bun run dry-run-jev` (or `bun run start`). The key stays in `.env` (gitignored). Do not export it in the PR or a ticket. Missing key exits with a clear error.

Mode 3 is live trading. Out of scope for this PR. See the checklist below only if a later change deliberately opts in.

`bun test` covers the live/dry-run gate and the missing-TypeSafe-key path on `scripts/dry-run-jev.ts`. `bun run scripts/dry-encode.ts` signs a throwaway tx locally and never broadcasts.

## Live checklist (out of scope for this PR)

Do not do this in the research default. Only if a later change explicitly wants real orders:

1. Funded Monad wallet and Kuru margin, not committed anywhere.
2. `ALLOW_LIVE=true`
3. `DRY_RUN` unset or `false`
4. `PRIVATE_KEY` in the process environment only
5. Prefer a dedicated RPC, not the public endpoint

Startup prints `LIVE TRADING ENABLED` if this path is taken. If you see `PRIVATE_KEY is set but ignored`, you are still in dry-run.

## Desk split

- This repo: Monad + Kuru MON-USDC, block-paced MM research, dry-run first.
- Alpaca paper sleeve: separate process, separate config, separate risk. Not started from `bun run start` here.
