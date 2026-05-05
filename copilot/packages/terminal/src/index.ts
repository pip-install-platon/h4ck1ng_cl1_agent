import type { TerminalSessionRecord } from "@pentest-copilot/contracts";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { platform } from "node:os";

export type TerminalSessionSpec = {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
};

export interface TerminalPort {
  run(spec: TerminalSessionSpec): Promise<TerminalSessionRecord>;
}

function truncateUtf8(
  s: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  const enc = new TextEncoder();
  if (maxBytes <= 0) return { text: "", truncated: s.length > 0 };
  const total = enc.encode(s).length;
  if (total <= maxBytes) return { text: s, truncated: false };

  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (enc.encode(s.slice(0, mid)).length <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return { text: s.slice(0, lo), truncated: true };
}

function collectStream(
  stream: NodeJS.ReadableStream | null,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    if (!stream) {
      resolve({ text: "", truncated: false });
      return;
    }
    let acc = "";
    let truncated = false;
    stream.on("data", (chunk: Buffer) => {
      if (truncated) return;
      acc += chunk.toString("utf8");
      const tr = truncateUtf8(acc, maxBytes);
      acc = tr.text;
      truncated = tr.truncated;
    });
    stream.on("error", reject);
    stream.on("end", () => resolve({ text: acc, truncated }));
  });
}

function spawnShell(
  command: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs: number;
    maxStdoutBytes: number;
    maxStderrBytes: number;
  },
): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
  signal: NodeJS.Signals | null;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      windowsHide: true,
    });

    const stdoutP = collectStream(child.stdout, options.maxStdoutBytes);
    const stderrP = collectStream(child.stderr, options.maxStderrBytes);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", async (code, signal) => {
      clearTimeout(timer);
      const [so, se] = await Promise.all([stdoutP, stderrP]);
      resolve({
        exitCode: code,
        stdout: so.text,
        stderr: se.text + (timedOut ? "\n[terminal: timeout]" : ""),
        stdoutTruncated: so.truncated,
        stderrTruncated: se.truncated,
        timedOut,
        signal: signal ?? null,
      });
    });
  });
}

function spawnExec(
  file: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs: number;
    maxStdoutBytes: number;
    maxStderrBytes: number;
  },
): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
  signal: NodeJS.Signals | null;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      windowsHide: true,
    });

    const stdoutP = collectStream(child.stdout, options.maxStdoutBytes);
    const stderrP = collectStream(child.stderr, options.maxStderrBytes);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", async (code, signal) => {
      clearTimeout(timer);
      const [so, se] = await Promise.all([stdoutP, stderrP]);
      resolve({
        exitCode: code,
        stdout: so.text,
        stderr: se.text + (timedOut ? "\n[terminal: timeout]" : ""),
        stdoutTruncated: so.truncated,
        stderrTruncated: se.truncated,
        timedOut,
        signal: signal ?? null,
      });
    });
  });
}

/**
 * Локальный shell для разработки контрактов на Windows или POSIX.
 */
export class LocalStubTerminal implements TerminalPort {
  async run(spec: TerminalSessionSpec): Promise<TerminalSessionRecord> {
    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();

    try {
      const r = await spawnShell(spec.command, {
        cwd: spec.cwd,
        env: spec.env,
        timeoutMs: spec.timeoutMs,
        maxStdoutBytes: spec.maxStdoutBytes,
        maxStderrBytes: spec.maxStderrBytes,
      });

      const endedAt = new Date().toISOString();
      return {
        sessionId,
        command: spec.command,
        cwd: spec.cwd,
        exitCode: r.timedOut ? null : r.exitCode,
        stdout: r.stdout,
        stderr: r.stderr,
        truncated: r.stdoutTruncated || r.stderrTruncated,
        startedAt,
        endedAt,
      };
    } catch (err) {
      const endedAt = new Date().toISOString();
      return {
        sessionId,
        command: spec.command,
        cwd: spec.cwd,
        exitCode: null,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        truncated: false,
        startedAt,
        endedAt,
      };
    }
  }
}

export type SshKaliConfig = {
  host: string;
  user: string;
  keyPath?: string;
  remoteWorkdir: string;
  strictHostKeyChecking?: boolean;
};

/**
 * Выполнение команды на удалённой Kali через `ssh` (OpenSSH).
 * Команда формируется как `cd <remoteWorkdir> && <command>` — вход должен быть доверенным (Team-Lead).
 */
export class SshKaliTerminal implements TerminalPort {
  constructor(private readonly config: SshKaliConfig | null) {}

  async run(spec: TerminalSessionSpec): Promise<TerminalSessionRecord> {
    if (!this.config?.host || !this.config.user) {
      throw new Error(
        "SshKaliTerminal: задайте KALI_SSH_HOST и KALI_SSH_USER (см. README «Kali VM»).",
      );
    }

    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();
    const cfg = this.config;

    const strict =
      cfg.strictHostKeyChecking === false ? "no" : "accept-new";
    const remote = `cd ${cfg.remoteWorkdir} && ${spec.command}`;
    const sshExecutable = platform() === "win32" ? "ssh.exe" : "ssh";
    const args = ["-o", "BatchMode=yes", "-o", `StrictHostKeyChecking=${strict}`];
    if (cfg.keyPath) args.push("-i", cfg.keyPath);
    args.push(`${cfg.user}@${cfg.host}`, remote);

    try {
      const r = await spawnExec(sshExecutable, args, {
        env: spec.env,
        timeoutMs: spec.timeoutMs,
        maxStdoutBytes: spec.maxStdoutBytes,
        maxStderrBytes: spec.maxStderrBytes,
      });

      return {
        sessionId,
        command: spec.command,
        cwd: cfg.remoteWorkdir,
        exitCode: r.timedOut ? null : r.exitCode,
        stdout: r.stdout,
        stderr: r.stderr,
        truncated: r.stdoutTruncated || r.stderrTruncated,
        startedAt,
        endedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        sessionId,
        command: spec.command,
        cwd: cfg.remoteWorkdir,
        exitCode: null,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        truncated: false,
        startedAt,
        endedAt: new Date().toISOString(),
      };
    }
  }
}

export function sshKaliConfigFromEnv(): SshKaliConfig | null {
  const host = process.env["KALI_SSH_HOST"];
  const user = process.env["KALI_SSH_USER"];
  if (!(host && user)) return null;
  return {
    host,
    user,
    keyPath: process.env["KALI_SSH_KEY_PATH"],
    remoteWorkdir: process.env["KALI_REMOTE_WORKDIR"] ?? "/home/copilot-runner",
    strictHostKeyChecking: process.env["KALI_SSH_STRICT"] !== "false",
  };
}
