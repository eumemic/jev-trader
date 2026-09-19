/**
 * Bounded dry-run of the trader loop against the live Kuru L2 book. Never signs, never sends.
 *
 * Forces DRY_RUN=true and drops PRIVATE_KEY / ALLOW_LIVE so live cannot trip.
 * Default MODEL=jev (needs TYPESAFE_AI_API_KEY or TYPESAFE_API_KEY in operator env).
 * No-key smoke: MODEL=mock bun run scripts/dry-run-jev.ts --blocks 15
 *
 * Stops after --blocks N (default 120) or --seconds S (default 45), whichever first.
 */
process.env.DRY_RUN = "true";
delete process.env.PRIVATE_KEY;
delete process.env.ALLOW_LIVE;
if (!process.env.MODEL) process.env.MODEL = "jev";

const typesafeKey = (process.env.TYPESAFE_AI_API_KEY ?? process.env.TYPESAFE_API_KEY ?? "").trim();
if (typesafeKey && !process.env.TYPESAFE_AI_API_KEY?.trim()) {
  process.env.TYPESAFE_AI_API_KEY = typesafeKey;
}

if (process.env.MODEL === "jev" && !typesafeKey) {
  console.error("MODEL=jev needs TYPESAFE_AI_API_KEY or TYPESAFE_API_KEY in the operator environment.");
  console.error("Put the key in a local gitignored .env. Do not commit it.");
  console.error("No-key smoke: MODEL=mock bun run scripts/dry-run-jev.ts --blocks 15");
  process.exit(1);
}

function argNum(flag: string, envName: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i >= 0) {
    const v = Number(process.argv[i + 1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  const fromEnv = Number(process.env[envName]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return fallback;
}

const maxBlocks = argNum("--blocks", "DRY_RUN_BLOCKS", 120);
const maxSeconds = argNum("--seconds", "DRY_RUN_SECONDS", 45);

const { config } = await import("../src/config");
const { Market } = await import("../src/market");
const { createModel } = await import("../src/model");
const { Trader } = await import("../src/trader");
const { startBlockFeed } = await import("../src/chain");
const { log10 } = await import("../src/book");

if (!config.dryRun || config.privateKey) {
  console.error("refusing to run: not a dry run (ALLOW_LIVE is still required for live)");
  process.exit(1);
}

const market = new Market();
await market.init();
if (market.address !== null || market.wallet !== null) {
  console.error("refusing to run: a wallet was constructed");
  process.exit(1);
}

const book0 = await market.readBook();
const model = createModel();
let decided = 0;
let stopped = false;

const stop = (reason: string) => {
  if (stopped) return;
  stopped = true;
  const last = trader.history.at(-1);
  console.log(
    `done reason=${reason} blocks=${trader.history.length} decisions=${decided}` +
      ` dryRun=${config.dryRun} wallet=${market.address}` +
      (last ? ` lastMid=${last.mid.toFixed(6)} lastBid=${last.bestBid.toFixed(6)} lastAsk=${last.bestAsk.toFixed(6)}` : ""),
  );
  process.exit(0);
};

const trader = new Trader(
  market,
  model,
  (e, t) => {
    const book = `mid=${e.mid.toFixed(6)} bid=${e.bestBid.toFixed(6)} ask=${e.bestAsk.toFixed(6)} spread=${e.spreadBps.toFixed(2)}bps`;
    if (e.decision && !e.decision.late) {
      decided++;
      const p = e.decision.probabilities;
      const q = e.quote;
      const quote = !q
        ? " NO QUOTE"
        : ` ${q.side.toUpperCase()} ${q.size} @ ${q.price.toFixed(6)}${q.capped ? " capped" : ""}${q.status === "sim" ? " (sim)" : ""}`;
      console.log(
        `#${e.block} ${book} action=${e.decision.action} b${(p.buy * 100).toFixed(0)} s${(p.sell * 100).toFixed(0)}` +
          ` ${e.decision.latencyMs}ms${quote} dryRun=${config.dryRun} wallet=null` +
          (t ? ` read=${t.readMs}ms loop=${t.loopMs}ms` : ""),
      );
    } else {
      console.log(`#${e.block} ${book} action=late dryRun=${config.dryRun} wallet=null`);
    }
    if (trader.history.length >= maxBlocks) stop(`${trader.history.length} blocks`);
  },
  (block, fill) => {
    console.log(`#${block} FILL ${fill.side} ${fill.size} @ ${fill.price.toFixed(6)}${fill.simulated ? " (sim)" : ""}`);
  },
);

trader.attachTradeFeed(log10(market.params.sizePrecision));

console.log(
  `dry-run-jev model=${model.name} dryRun=${config.dryRun} wallet=${market.address}` +
    ` market=${config.market} getL2Book=true read=${config.readRpcUrl}` +
    ` maxBlocks=${maxBlocks} maxSeconds=${maxSeconds}`,
);
console.log(
  `l2 bookBlock=${book0.block} mid=${book0.mid.toFixed(6)} bid=${book0.bid.toFixed(6)} ask=${book0.ask.toFixed(6)}` +
    ` spread=${book0.spreadBps.toFixed(2)}bps`,
);

startBlockFeed((block) => {
  if (!stopped) void trader.onBlock(block);
});
setTimeout(() => stop(`${maxSeconds}s elapsed`), maxSeconds * 1000);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
