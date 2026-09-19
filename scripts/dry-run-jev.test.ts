import { test, expect } from "bun:test";

test("MODEL=jev without a TypeSafe key exits with a clear error", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "scripts/dry-run-jev.ts"],
    cwd: import.meta.dir + "/..",
    env: {
      ...process.env,
      MODEL: "jev",
      TYPESAFE_AI_API_KEY: "",
      TYPESAFE_API_KEY: "",
      PRIVATE_KEY: "",
      ALLOW_LIVE: "",
      DRY_RUN: "true",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, stdout, exit] = await Promise.all([
    new Response(proc.stderr).text(),
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  expect(exit).toBe(1);
  const text = stderr + stdout;
  expect(text).toContain("TYPESAFE_AI_API_KEY");
  expect(text).toContain("operator environment");
  expect(text).not.toContain("LIVE TRADING");
});
