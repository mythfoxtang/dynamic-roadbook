import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./flight-monitor.mjs", import.meta.url));

test("手动记录同一来源的两次报价并显示降幅", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flight-monitor-test-"));
  const store = path.join(directory, "snapshots.json");
  const common = [scriptPath, "--date", "2026-11-14", "--adults", "1", "--source", "携程", "--store", store];
  try {
    const first = execFileSync(process.execPath, [...common, "--price", "680"], { encoding: "utf8" });
    const second = execFileSync(process.execPath, [...common, "--price", "610"], { encoding: "utf8" });
    const history = JSON.parse(fs.readFileSync(store, "utf8"));
    assert.match(first, /manual:携程/);
    assert.match(first, /首次记录/);
    assert.match(second, /-70\.00/);
    assert.deepEqual(history["2026-11-14|1|manual:携程"].map((item) => item.lowestAmount), [680, 610]);
  } finally {
    if (fs.existsSync(store)) fs.unlinkSync(store);
    fs.rmdirSync(directory);
  }
});
