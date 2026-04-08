import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

function runProbe({ city, keyword, checkIn, checkOut }) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "ctrip-hotel-assistant.mjs");
    const child = spawn(
      process.execPath,
      [scriptPath, "--probe", "--keyword", keyword, "--city", city || "", "--checkin", checkIn || "", "--checkout", checkOut || ""],
      { cwd: process.cwd() }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Probe exited with code ${code}`));
        return;
      }

      const lines = stdout
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      const lastLine = lines[lines.length - 1] || "{}";

      try {
        resolve(JSON.parse(lastLine));
      } catch (error) {
        reject(new Error(`Failed to parse probe output: ${lastLine}\n${error.message}`));
      }
    });
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const city = String(body?.city || "");
    const keyword = String(body?.keyword || "");
    const checkIn = String(body?.checkIn || "");
    const checkOut = String(body?.checkOut || "");

    if (!keyword) {
      return NextResponse.json({ error: "缺少 keyword" }, { status: 400 });
    }

    const result = await runProbe({ city, keyword, checkIn, checkOut });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "酒店价格探针失败" }, { status: 500 });
  }
}
