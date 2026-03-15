import type { SelectOption } from "@opentui/core";
/** @jsxImportSource @opentui/react */
import { useCallback, useState } from "react";
import { loadConfig, saveConfig } from "../../profile-config.js";

const C = {
  green: "#9ece6a",
  yellow: "#e0af68",
  dim: "#565f89",
  bgAlt: "#24283b",
  focused: "#7aa2f7",
};

interface TelemetryPanelProps {
  focused: boolean;
  height: number;
}

function setTelemetryEnabled(enabled: boolean): string {
  const cfg = loadConfig();
  cfg.telemetry = {
    ...(cfg.telemetry ?? {}),
    enabled,
    askedAt: cfg.telemetry?.askedAt ?? new Date().toISOString(),
  };
  saveConfig(cfg);
  return enabled
    ? "Telemetry enabled. Anonymous error reports will be sent."
    : "Telemetry disabled. No error reports will be sent.";
}

function resetTelemetryConsent(): string {
  const cfg = loadConfig();
  if (!cfg.telemetry) return "No telemetry consent to reset.";
  cfg.telemetry.askedAt = undefined;
  cfg.telemetry.enabled = false;
  saveConfig(cfg);
  return "Telemetry consent reset. You will be prompted on the next error.";
}

export function TelemetryPanel({ focused, height }: TelemetryPanelProps) {
  const [actionIndex, setActionIndex] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const config = loadConfig();
  const telemetry = config.telemetry;
  const envOverride = process.env.CLAUDISH_TELEMETRY;
  const envDisabled = envOverride === "0" || envOverride === "false" || envOverride === "off";
  const isEnabled = !envDisabled && telemetry?.enabled === true;

  const actionOptions = [
    {
      name: isEnabled ? "Disable telemetry" : "Enable telemetry",
      description: isEnabled
        ? "Stop sending anonymous error reports"
        : "Opt in to anonymous error reporting",
      value: isEnabled ? "off" : "on",
    },
    {
      name: "Reset consent",
      description: "Will prompt again on next error",
      value: "reset",
    },
  ];

  const handleSelect = useCallback((_idx: number, opt: SelectOption | null) => {
    if (!opt?.value) return;
    if (opt.value === "on") {
      setStatusMsg(setTelemetryEnabled(true));
    } else if (opt.value === "off") {
      setStatusMsg(setTelemetryEnabled(false));
    } else if (opt.value === "reset") {
      setStatusMsg(resetTelemetryConsent());
    }
  }, []);

  return (
    <box flexDirection="column" height={height} padding={1} gap={1}>
      <text>
        <span fg={C.dim}>Status: </span>
        {envDisabled ? (
          <span fg={C.yellow}>DISABLED (CLAUDISH_TELEMETRY env var override)</span>
        ) : !telemetry ? (
          <span fg={C.dim}>not configured (disabled until you opt in)</span>
        ) : telemetry.enabled ? (
          <span fg={C.green}>ENABLED</span>
        ) : (
          <span fg={C.yellow}>DISABLED</span>
        )}
      </text>

      {telemetry?.askedAt && (
        <text>
          <span fg={C.dim}>Configured: {telemetry.askedAt}</span>
        </text>
      )}

      <box paddingTop={1} flexDirection="column">
        <text>
          <span fg={C.dim}>When enabled, anonymous error reports include:</span>
        </text>
        <text>
          <span fg={C.dim}> - Claudish version, error type, provider name, model ID</span>
        </text>
        <text>
          <span fg={C.dim}> - Platform, runtime, install method</span>
        </text>
        <text>
          <span fg={C.dim}> - Sanitized error message (no paths, no credentials)</span>
        </text>
        <text>
          <span fg={C.dim}> - Ephemeral session ID (not stored, not correlatable)</span>
        </text>
      </box>

      <box paddingBottom={1}>
        <text>
          <span fg={C.dim}>
            Never collected: prompt content, AI responses, API keys, file paths.
          </span>
        </text>
      </box>

      <select
        options={actionOptions}
        focused={focused}
        height={Math.max(3, actionOptions.length + 1)}
        selectedIndex={actionIndex}
        onSelect={handleSelect}
        onChange={(idx) => setActionIndex(idx)}
        selectedBackgroundColor={C.bgAlt}
        selectedTextColor={C.focused}
      />

      {statusMsg && (
        <box paddingTop={1}>
          <text>
            <span fg={C.green}>{statusMsg}</span>
          </text>
        </box>
      )}
    </box>
  );
}
