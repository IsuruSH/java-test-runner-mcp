import { spawn } from "node:child_process";
import { platform } from "node:os";
import { getEnvConfig } from "./env.js";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  elapsedMs: number;
  timedOut: boolean;
}

export interface ExecutionOptions {
  cwd: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  /** Max bytes to capture per stream before truncating (default 512KB) */
  maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const DEFAULT_MAX_OUTPUT = 512 * 1024; // 512 KB

function getDefaultTimeout(): number {
  return getEnvConfig().timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

/**
 * Spawn a child process, capture stdout/stderr, enforce a timeout,
 * and return structured results with elapsed time.
 */
export function execute(
  command: string[],
  options: ExecutionOptions,
): Promise<ExecutionResult> {
  const {
    cwd,
    env,
    timeoutMs = getDefaultTimeout(),
    maxOutputBytes = DEFAULT_MAX_OUTPUT,
  } = options;

  return new Promise((resolve) => {
    const startTime = Date.now();
    const [cmd, ...args] = command;

    const mergedEnv = { ...process.env, ...env };

    const isWindows = platform() === "win32";
    const child = spawn(cmd, args, {
      cwd,
      env: mergedEnv,
      shell: isWindows,
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutLen = 0;
    let stderrLen = 0;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5_000);
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutLen < maxOutputBytes) {
        stdoutChunks.push(chunk);
        stdoutLen += chunk.length;
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrLen < maxOutputBytes) {
        stderrChunks.push(chunk);
        stderrLen += chunk.length;
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        stdout: "",
        stderr: err.message,
        exitCode: null,
        elapsedMs: Date.now() - startTime,
        timedOut: false,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      let stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      let stderr = Buffer.concat(stderrChunks).toString("utf-8");

      if (stdoutLen > maxOutputBytes) {
        stdout += "\n... [stdout truncated]";
      }
      if (stderrLen > maxOutputBytes) {
        stderr += "\n... [stderr truncated]";
      }

      resolve({
        stdout,
        stderr,
        exitCode: code,
        elapsedMs: Date.now() - startTime,
        timedOut,
      });
    });
  });
}

/** Format an ExecutionResult into a human-readable text block for MCP tool responses. */
export function formatResult(result: ExecutionResult, label: string): string {
  const lines: string[] = [];
  lines.push(`=== ${label} ===`);
  lines.push(`Exit code: ${result.exitCode ?? "N/A"}`);
  lines.push(`Elapsed: ${(result.elapsedMs / 1000).toFixed(1)}s`);
  if (result.timedOut) {
    lines.push("*** TIMED OUT ***");
  }
  if (result.stdout.trim()) {
    lines.push("", "--- stdout ---", result.stdout.trim());
  }
  if (result.stderr.trim()) {
    lines.push("", "--- stderr ---", result.stderr.trim());
  }
  return lines.join("\n");
}

/**
 * Format an ExecutionResult concisely: header + last N lines of stdout + stderr.
 * Keeps the response small enough for inline display in MCP clients.
 */
export function formatResultCompact(
  result: ExecutionResult,
  label: string,
  tailCount: number = 60,
): string {
  const lines: string[] = [];
  lines.push(`=== ${label} ===`);
  lines.push(`Exit code: ${result.exitCode ?? "N/A"}`);
  lines.push(`Elapsed: ${(result.elapsedMs / 1000).toFixed(1)}s`);
  if (result.timedOut) {
    lines.push("*** TIMED OUT ***");
  }

  if (result.stdout.trim()) {
    const allLines = result.stdout.trim().split("\n");
    if (allLines.length > tailCount) {
      lines.push(
        "",
        `--- stdout (last ${tailCount} of ${allLines.length} lines) ---`,
        ...allLines.slice(-tailCount),
      );
    } else {
      lines.push("", "--- stdout ---", ...allLines);
    }
  }

  if (result.stderr.trim()) {
    const errLines = result.stderr.trim().split("\n");
    const errTail = errLines.length > 20 ? errLines.slice(-20) : errLines;
    lines.push("", "--- stderr ---", ...errTail);
  }

  return lines.join("\n");
}
