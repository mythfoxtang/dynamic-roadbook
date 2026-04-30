import { spawn } from "node:child_process";
import path from "node:path";

export function runHotelPriceProbe({ city, keyword, checkIn, checkOut }) {
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
