import { test, expect } from "bun:test";
import { config, resolveTradingMode } from "./config";

test("imported config defaults to dry-run with no key", () => {
  expect(config.dryRun).toBe(true);
  expect(config.privateKey).toBeUndefined();
  expect(config.model).toBe("mock");
});

test("empty env is dry-run and does not honor a key", () => {
  const mode = resolveTradingMode({});
  expect(mode.dryRun).toBe(true);
  expect(mode.privateKey).toBeUndefined();
  expect(mode.allowLive).toBe(false);
  expect(mode.ignoredPrivateKey).toBe(false);
});

test("PRIVATE_KEY alone is ignored", () => {
  const mode = resolveTradingMode({ PRIVATE_KEY: "0xabc" });
  expect(mode.dryRun).toBe(true);
  expect(mode.privateKey).toBeUndefined();
  expect(mode.ignoredPrivateKey).toBe(true);
});

test("empty and whitespace PRIVATE_KEY count as unset", () => {
  expect(resolveTradingMode({ PRIVATE_KEY: "", ALLOW_LIVE: "true" }).dryRun).toBe(true);
  expect(resolveTradingMode({ PRIVATE_KEY: "   ", ALLOW_LIVE: "true" }).privateKey).toBeUndefined();
});

test("DRY_RUN=false + PRIVATE_KEY still dry-run without ALLOW_LIVE", () => {
  const mode = resolveTradingMode({ PRIVATE_KEY: "0xabc", DRY_RUN: "false" });
  expect(mode.dryRun).toBe(true);
  expect(mode.privateKey).toBeUndefined();
  expect(mode.ignoredPrivateKey).toBe(true);
});

test("ALLOW_LIVE must be the exact string true", () => {
  for (const allow of ["1", "yes", "TRUE", "True"]) {
    const mode = resolveTradingMode({ PRIVATE_KEY: "0xabc", ALLOW_LIVE: allow });
    expect(mode.dryRun).toBe(true);
    expect(mode.privateKey).toBeUndefined();
  }
});

test("ALLOW_LIVE=true without a key stays dry-run", () => {
  const mode = resolveTradingMode({ ALLOW_LIVE: "true" });
  expect(mode.dryRun).toBe(true);
  expect(mode.privateKey).toBeUndefined();
});

test("ALLOW_LIVE=true + PRIVATE_KEY enables live when DRY_RUN is not true", () => {
  const mode = resolveTradingMode({ PRIVATE_KEY: "0xabc", ALLOW_LIVE: "true" });
  expect(mode.dryRun).toBe(false);
  expect(mode.privateKey).toBe("0xabc");
  expect(mode.ignoredPrivateKey).toBe(false);
});

test("DRY_RUN=true vetoes live even with ALLOW_LIVE and a key", () => {
  const mode = resolveTradingMode({
    PRIVATE_KEY: "0xabc",
    ALLOW_LIVE: "true",
    DRY_RUN: "true",
  });
  expect(mode.dryRun).toBe(true);
  expect(mode.privateKey).toBeUndefined();
  expect(mode.ignoredPrivateKey).toBe(true);
});
