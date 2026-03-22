/** @jsxImportSource @opentui/react */
import { createCliRenderer } from "@opentui/core";
import type { CliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createElement } from "react";
import { writeSync } from "node:fs";
import { DiagPanel } from "./tui/DiagPanel.js";

/**
 * A diagnostic message with severity level.
 */
export interface DiagMessage {
  text: string;
  level: "error" | "warn" | "info";
}

/**
 * PtyDiagRunner spawns Claude Code inside a PTY using Bun's native
 * Bun.spawn({ terminal }). Output goes directly to fd 1 via writeSync,
 * giving Claude Code clean, uninterrupted terminal rendering.
 *
 * The opentui renderer is NOT created at startup — it's lazily initialized
 * only when the first diagnostic message needs to be shown. This prevents
 * opentui from interfering with Claude Code's ink TUI during normal operation.
 */
export class PtyDiagRunner {
  private renderer: CliRenderer | null = null;
  private bunProc: ReturnType<typeof Bun.spawn> | null = null;
  private messages: DiagMessage[] = [];
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private reactRoot: ReturnType<typeof createRoot> | null = null;
  private rawStdinHandler: ((chunk: Buffer | string) => void) | null = null;
  private rendererInitializing = false;

  /**
   * Spawn the given command as a PTY child.
   * Pure passthrough — no opentui, no interference.
   * opentui is only initialized lazily when showDiag() is called.
   */
  async run(command: string, args: string[], env: Record<string, string>): Promise<number> {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    // Spawn Claude Code in a PTY. Output goes directly to fd 1,
    // completely bypassing any stdout interception.
    this.bunProc = Bun.spawn([command, ...args], {
      terminal: {
        cols,
        rows,
        data: (_terminal: unknown, data: Buffer | string) => {
          const buf = typeof data === "string" ? Buffer.from(data, "binary") : data;
          writeSync(1, buf);
        },
      },
      cwd: process.cwd(),
      env,
    });

    // Forward raw stdin to the PTY. During the first 2 seconds, drop ALL
    // escape sequences — these are terminal capability responses from tmux
    // (DCS, DA1, DECRPM) triggered by Claude Code's ink startup probing.
    // If forwarded to the PTY, they echo as visible garbage in the prompt.
    // After the grace period, forward everything (escape sequences are then
    // user input like arrow keys, function keys, etc.).
    const startTime = Date.now();
    const GRACE_PERIOD_MS = 2000;

    this.rawStdinHandler = (chunk: Buffer | string) => {
      if (!this.bunProc?.terminal) return;
      const str = typeof chunk === "string" ? chunk : chunk.toString("binary");

      // During grace period: drop any chunk containing ESC sequences
      // (terminal responses arrive as ESC + control sequences)
      if (Date.now() - startTime < GRACE_PERIOD_MS) {
        if (str.includes("\x1b")) return; // drop all escape sequences during startup
        // Non-escape input passes through (rare during startup, but safe)
      }

      this.bunProc.terminal.write(str);
    };
    process.stdin.on("data", this.rawStdinHandler);

    // Handle terminal resize
    const resizeHandler = () => {
      if (this.bunProc?.terminal) {
        try {
          this.bunProc.terminal.resize(
            process.stdout.columns || 80,
            process.stdout.rows || 24
          );
        } catch {
          // non-fatal
        }
      }
    };
    process.on("SIGWINCH", resizeHandler);

    // Wait for the PTY child to exit
    await this.bunProc.exited;
    const exitCode = this.bunProc.exitCode ?? 1;

    process.removeListener("SIGWINCH", resizeHandler);
    this.cleanup();

    return exitCode;
  }

  /**
   * Show the diagnostic bar. Lazily initializes opentui renderer on first call.
   * During normal operation, no opentui renderer exists — zero interference
   * with Claude Code's ink TUI.
   */
  async showDiag(messages: DiagMessage[]): Promise<void> {
    this.messages = messages.slice(-4);

    // Lazy init: create opentui renderer only when first needed
    if (!this.renderer && !this.rendererInitializing) {
      this.rendererInitializing = true;
      try {
        this.renderer = await createCliRenderer({
          useAlternateScreen: false,
          experimental_splitHeight: 5,
          exitOnCtrlC: false,
          useMouse: false,
          useKittyKeyboard: null,
          targetFps: 10,
        });

        this.reactRoot = createRoot(this.renderer);
        this.renderDiagPanel();
      } catch {
        this.rendererInitializing = false;
        return;
      }
      this.rendererInitializing = false;
    } else if (this.renderer) {
      if (this.renderer.experimental_splitHeight === 0) {
        this.renderer.experimental_splitHeight = 5;
      }
      this.renderDiagPanel();
    }

    // Reset auto-hide timer
    if (this.autoHideTimer) clearTimeout(this.autoHideTimer);
    this.autoHideTimer = setTimeout(() => this.hideDiag(), 10000);
  }

  hideDiag(): void {
    if (!this.renderer) return;
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    this.renderer.experimental_splitHeight = 0;
  }

  private renderDiagPanel(): void {
    if (!this.reactRoot) return;
    this.reactRoot.render(createElement(DiagPanel, { messages: this.messages }));
  }

  cleanup(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    if (this.rawStdinHandler) {
      process.stdin.removeListener("data", this.rawStdinHandler);
      this.rawStdinHandler = null;
    }
    if (this.bunProc) {
      try { this.bunProc.kill(); } catch {}
      try { this.bunProc.terminal?.close(); } catch {}
      this.bunProc = null;
    }
    if (this.renderer && !this.renderer.isDestroyed) {
      try { this.renderer.destroy(); } catch {}
      this.renderer = null;
    }
  }
}

/**
 * Try to create a PtyDiagRunner. Returns null if Bun's terminal API
 * is not available (e.g., running under Node.js, or on Windows).
 */
export async function tryCreatePtyRunner(): Promise<PtyDiagRunner | null> {
  try {
    if (typeof Bun === "undefined") return null;
    const test = Bun.spawn(["true"], { terminal: { cols: 1, rows: 1 } });
    await test.exited;
    return new PtyDiagRunner();
  } catch {
    return null;
  }
}
