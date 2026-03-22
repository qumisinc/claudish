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
 * PtyDiagRunner spawns a child process (Claude Code) inside a PTY using
 * Bun's native Bun.spawn({ terminal }) so its output flows through
 * file descriptor 1 directly (bypassing opentui's stdout interceptor),
 * while the diag split-panel renders in opentui's split area when needed.
 *
 * No native addons required — uses Bun's built-in PTY support.
 */
export class PtyDiagRunner {
  private renderer: CliRenderer | null = null;
  private bunProc: ReturnType<typeof Bun.spawn> | null = null;
  private messages: DiagMessage[] = [];
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private reactRoot: ReturnType<typeof createRoot> | null = null;
  private rawStdinHandler: ((chunk: Buffer | string) => void) | null = null;

  /**
   * Spawn the given command as a PTY child, wiring up the opentui renderer
   * to intercept stdout so the diag split-panel works.
   * Returns the exit code of the child process.
   */
  async run(command: string, args: string[], env: Record<string, string>): Promise<number> {
    // Create the opentui renderer with splitHeight=0 (no diag bar initially).
    // useAlternateScreen: false is REQUIRED — alternate screen would hide the
    // Claude Code TUI output and lose scroll history.
    this.renderer = await createCliRenderer({
      useAlternateScreen: false,
      experimental_splitHeight: 0,
      exitOnCtrlC: false,
      useMouse: false,
      useKittyKeyboard: null,
      targetFps: 10,
    });

    // Mount the DiagPanel React component into the renderer.
    // It starts hidden (splitHeight=0 means it's never painted).
    this.reactRoot = createRoot(this.renderer);
    this.renderDiagPanel();

    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    // Spawn Claude Code in a PTY using Bun's native terminal support.
    // The data callback fires when the PTY child writes output — we bypass
    // opentui's process.stdout.write interceptor and write directly to fd 1.
    // opentui patches process.stdout.write and silently drops output even
    // with splitHeight=0; writeSync(1, ...) bypasses that interception.
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

    // Wait for opentui's terminal capability probing to complete before
    // forwarding stdin to the PTY. Without this delay, tmux capability
    // response sequences (DCS, DA1, DECRPM) get forwarded to the PTY
    // and echo as visible garbage in Claude Code's TUI.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Forward raw stdin bytes to the PTY so Claude Code gets all keyboard input.
    // Filter out terminal capability response sequences that arrive late from
    // tmux/terminal — these start with ESC and match known response patterns.
    const isTerminalResponse = (data: string): boolean => {
      // DCS responses: \x1bP...
      if (data.startsWith("\x1bP")) return true;
      // CSI responses: cursor position, device attributes, mode reports
      if (/^\x1b\[\??[\d;]*[Rcyn]/.test(data)) return true;
      // DA1/DA2: \x1b[?64;... or \x1b[>...
      if (/^\x1b\[[\?>][\d;]*c/.test(data)) return true;
      return false;
    };

    this.rawStdinHandler = (chunk: Buffer | string) => {
      if (!this.bunProc?.terminal) return;
      const str = typeof chunk === "string" ? chunk : chunk.toString("binary");
      if (isTerminalResponse(str)) return; // drop capability responses
      this.bunProc.terminal.write(str);
    };
    process.stdin.on("data", this.rawStdinHandler);

    // Handle ESC key to dismiss the diag panel.
    if (this.renderer.prependInputHandler) {
      this.renderer.prependInputHandler((sequence: string) => {
        if (sequence === "\x1b" && this.renderer && this.renderer.experimental_splitHeight > 0) {
          this.hideDiag();
          return true; // consumed
        }
        return false; // pass through
      });
    }

    // Forward resize events to the PTY.
    this.renderer.on("resize", () => {
      if (this.bunProc?.terminal && this.renderer) {
        const newCols = this.renderer.terminalWidth || process.stdout.columns || 80;
        const newRows = Math.max(
          1,
          (this.renderer.terminalHeight || process.stdout.rows || 24) -
            this.renderer.experimental_splitHeight
        );
        try {
          this.bunProc.terminal.resize(newCols, newRows);
        } catch {
          // Resize errors are non-fatal
        }
      }
    });

    // Wait for the PTY child to exit.
    await this.bunProc.exited;
    const exitCode = this.bunProc.exitCode ?? 1;

    // Clean up renderer after the child exits.
    this.cleanup();

    return exitCode;
  }

  /**
   * Show the diagnostic bar with the given messages.
   * Sets splitHeight to 5 lines and re-renders.
   */
  showDiag(messages: DiagMessage[]): void {
    if (!this.renderer) return;

    this.messages = messages.slice(-4); // keep last 4 messages
    this.renderDiagPanel();

    if (this.renderer.experimental_splitHeight === 0) {
      this.renderer.experimental_splitHeight = 5;
    }

    // Reset auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
    this.autoHideTimer = setTimeout(() => {
      this.hideDiag();
    }, 10000);
  }

  /**
   * Hide the diagnostic bar (set splitHeight = 0).
   */
  hideDiag(): void {
    if (!this.renderer) return;
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    this.renderer.experimental_splitHeight = 0;
  }

  /**
   * Render/re-render the DiagPanel React component with current messages.
   */
  private renderDiagPanel(): void {
    if (!this.reactRoot) return;
    this.reactRoot.render(createElement(DiagPanel, { messages: this.messages }));
  }

  /**
   * Clean up: kill the process, destroy the renderer, remove event listeners.
   */
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
      try {
        this.bunProc.kill();
      } catch {
        // Already dead
      }
      if (this.bunProc.terminal) {
        try {
          this.bunProc.terminal.close();
        } catch {
          // Already closed
        }
      }
      this.bunProc = null;
    }

    if (this.renderer && !this.renderer.isDestroyed) {
      try {
        this.renderer.destroy();
      } catch {
        // Ignore destroy errors
      }
      this.renderer = null;
    }
  }
}

/**
 * Try to create a PtyDiagRunner. Returns null if Bun's terminal API
 * is not available (e.g., running under Node.js instead of Bun, or
 * on Windows where PTY is not supported).
 */
export async function tryCreatePtyRunner(): Promise<PtyDiagRunner | null> {
  try {
    // Verify Bun.spawn with terminal is available (POSIX only)
    if (typeof Bun === "undefined") return null;

    // Quick smoke test: spawn a trivial command to confirm PTY works
    const test = Bun.spawn(["true"], {
      terminal: { cols: 1, rows: 1 },
    });
    await test.exited;

    return new PtyDiagRunner();
  } catch {
    return null;
  }
}
