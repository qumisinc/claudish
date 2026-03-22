/** @jsxImportSource @opentui/react */
import { useTerminalDimensions } from "@opentui/react";
import type { DiagMessage } from "../pty-diag-runner.js";

/**
 * Color constants for diagnostic severity levels.
 * These map to ANSI terminal colors used inside opentui text nodes.
 */
const LEVEL_COLORS: Record<DiagMessage["level"], string> = {
  error: "#ff5555",
  warn: "#ffb86c",
  info: "#8be9fd",
};

const LEVEL_PREFIX: Record<DiagMessage["level"], string> = {
  error: "[ERROR]",
  warn: "[WARN] ",
  info: "[INFO] ",
};

/**
 * DiagPanel renders in the opentui experimental_splitHeight bottom area.
 * Shows the last N diagnostic messages with severity coloring.
 * The last line is a dismiss hint.
 *
 * This component is mounted once into the renderer; messages are updated
 * by re-rendering via createRoot.render() in PtyDiagRunner.
 */
export function DiagPanel({ messages }: { messages: DiagMessage[] }) {
  const { width } = useTerminalDimensions();
  const panelWidth = Math.max(1, width);

  // Separator line
  const separator = "─".repeat(panelWidth);

  return (
    <box x={0} y={0} width={panelWidth} height={5} backgroundColor="#1a1a2e">
      {/* Top separator */}
      <text x={0} y={0} content={separator} color="#44475a" />

      {/* Up to 3 message lines */}
      {messages.slice(-3).map((msg, i) => {
        const prefix = LEVEL_PREFIX[msg.level];
        const color = LEVEL_COLORS[msg.level];
        // Truncate message to fit terminal width
        const maxTextLen = Math.max(1, panelWidth - prefix.length - 1);
        const truncated =
          msg.text.length > maxTextLen ? `${msg.text.slice(0, maxTextLen - 1)}…` : msg.text;

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list of max 3 diagnostic messages
          <text key={`msg-${i}`} x={0} y={i + 1} content={`${prefix} ${truncated}`} color={color} />
        );
      })}

      {/* Fill empty lines if fewer than 3 messages */}
      {messages.length < 3 &&
        Array.from({ length: 3 - messages.length }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static empty placeholder lines
          <text key={`empty-${i}`} x={0} y={messages.length + i + 1} content="" />
        ))}

      {/* Dismiss hint */}
      <text x={0} y={4} content="Press ESC to dismiss" color="#6272a4" />
    </box>
  );
}
