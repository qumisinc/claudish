import type { SelectOption } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
/** @jsxImportSource @opentui/react */
import { useCallback, useState } from "react";
import { loadConfig, removeEndpoint, setEndpoint } from "../../profile-config.js";
import { PROVIDERS, type ProviderDef } from "../providers.js";

const C = {
  green: "#9ece6a",
  yellow: "#e0af68",
  cyan: "#7dcfff",
  dim: "#565f89",
  text: "#c0caf5",
  bg: "#1a1b26",
  bgAlt: "#24283b",
  focused: "#7aa2f7",
};

const CONFIGURABLE = PROVIDERS.filter((p) => p.endpointEnvVar);

type Mode = "list" | "action" | "input";

interface ProvidersPanelProps {
  focused: boolean;
  height: number;
}

export function ProvidersPanel({ focused, height }: ProvidersPanelProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const selectedProvider = CONFIGURABLE[selectedIndex];

  const getActionOptions = useCallback(() => {
    if (!selectedProvider) return [];
    const cfg = loadConfig();
    const p = selectedProvider;
    const configVal = p.endpointEnvVar ? cfg.endpoints?.[p.endpointEnvVar] : undefined;
    const opts: Array<{ name: string; description: string; value: string }> = [
      {
        name: "Set custom endpoint URL",
        description: p.endpointEnvVar ? `Store ${p.endpointEnvVar} in config` : "Set endpoint",
        value: "set",
      },
    ];
    if (configVal) {
      opts.push({
        name: "Reset to default (remove stored)",
        description: `Revert to ${p.defaultEndpoint || "none"}`,
        value: "remove",
      });
    }
    opts.push({ name: "Back", description: "Return to provider list", value: "back" });
    return opts;
  }, [selectedProvider]);

  const handleListSelect = useCallback((_idx: number, opt: SelectOption | null) => {
    if (!opt?.value) return;
    const idx = CONFIGURABLE.findIndex((p) => p.name === opt.value);
    if (idx >= 0) {
      setSelectedIndex(idx);
      setActionIndex(0);
      setMode("action");
      setStatusMsg(null);
    }
  }, []);

  const handleActionSelect = useCallback(
    (_idx: number, opt: SelectOption | null) => {
      if (!opt?.value) return;
      if (opt.value === "back") {
        setMode("list");
        setStatusMsg(null);
        return;
      }
      if (opt.value === "set" && selectedProvider) {
        const cfg = loadConfig();
        const p = selectedProvider;
        const existing =
          (p.endpointEnvVar ? cfg.endpoints?.[p.endpointEnvVar] : undefined) ||
          (p.endpointEnvVar ? process.env[p.endpointEnvVar] : undefined) ||
          p.defaultEndpoint ||
          "";
        setInputValue(existing);
        setMode("input");
        return;
      }
      if (opt.value === "remove" && selectedProvider?.endpointEnvVar) {
        removeEndpoint(selectedProvider.endpointEnvVar);
        setStatusMsg("Endpoint reset to default.");
        setMode("list");
        return;
      }
    },
    [selectedProvider]
  );

  const handleInputConfirm = useCallback(() => {
    if (!selectedProvider?.endpointEnvVar) return;
    const val = inputValue.trim();
    if (!val) {
      setStatusMsg("No URL entered.");
      setMode("action");
      return;
    }
    setEndpoint(selectedProvider.endpointEnvVar, val);
    process.env[selectedProvider.endpointEnvVar] = val;
    setStatusMsg(`Endpoint saved for ${selectedProvider.displayName}.`);
    setInputValue("");
    setMode("list");
  }, [inputValue, selectedProvider]);

  useKeyboard((key) => {
    if (!focused) return;

    if (mode === "input") {
      if (key.name === "return" || key.name === "enter") {
        handleInputConfirm();
      } else if (key.name === "escape") {
        setMode("action");
      }
      return;
    }

    if (key.name === "escape" || key.name === "q") {
      if (mode === "action") {
        setMode("list");
        setStatusMsg(null);
      }
    }
  });

  const getEndpointStatus = (p: ProviderDef) => {
    if (!p.endpointEnvVar) return "no endpoint    ";
    const cfg = loadConfig();
    const envVar = p.endpointEnvVar;
    const configVal = cfg.endpoints?.[envVar];
    const envVal = process.env[envVar];
    if (envVal && configVal) return "custom (env+cfg)";
    if (envVal) return "custom (env)   ";
    if (configVal) {
      const short = configVal.length > 20 ? `${configVal.slice(0, 17)}...` : configVal.padEnd(20);
      return short;
    }
    return "default        ";
  };

  const listOptions = CONFIGURABLE.map((p) => {
    const status = getEndpointStatus(p);
    const hasCustom = p.endpointEnvVar
      ? !!(loadConfig().endpoints?.[p.endpointEnvVar] || process.env[p.endpointEnvVar])
      : false;
    const icon = hasCustom ? "+" : " ";
    return {
      name: `${icon} ${p.displayName.padEnd(16)} ${status}`,
      description: `${p.endpointEnvVar}${p.defaultEndpoint ? ` (default: ${p.defaultEndpoint})` : ""}`,
      value: p.name,
    };
  });

  const listHeight = Math.max(4, height - 6);

  if (mode === "list") {
    return (
      <box flexDirection="column" height={height}>
        <select
          options={listOptions}
          focused={focused}
          height={listHeight}
          selectedIndex={selectedIndex}
          onSelect={handleListSelect}
          onChange={(idx) => setSelectedIndex(idx)}
          showScrollIndicator
          selectedBackgroundColor={C.bgAlt}
          selectedTextColor={C.focused}
        />
        {statusMsg && (
          <box paddingX={1}>
            <text>
              <span fg={C.green}>{statusMsg}</span>
            </text>
          </box>
        )}
        <box paddingX={1} paddingTop={1}>
          <text>
            <span fg={C.dim}>Enter select Esc/q back Tab switch panel</span>
          </text>
        </box>
      </box>
    );
  }

  if (mode === "action") {
    const cfg = loadConfig();
    const p = selectedProvider;
    if (!p) return null;
    const envVal = p.endpointEnvVar ? process.env[p.endpointEnvVar] : undefined;
    const configVal = p.endpointEnvVar ? cfg.endpoints?.[p.endpointEnvVar] : undefined;
    const actionOptions = getActionOptions();

    return (
      <box flexDirection="column" height={height}>
        <box paddingX={1} paddingBottom={1}>
          <text>
            <span fg={C.cyan}>{p.displayName}</span>
            {"  "}
            <span fg={C.dim}>{p.endpointEnvVar}</span>
          </text>
        </box>
        {p.defaultEndpoint && (
          <box paddingX={1}>
            <text>
              <span fg={C.dim}>Default: </span>
              <span fg={C.dim}>{p.defaultEndpoint}</span>
            </text>
          </box>
        )}
        {envVal && (
          <box paddingX={1}>
            <text>
              <span fg={C.dim}>Env: </span>
              <span fg={C.green}>{envVal}</span>
            </text>
          </box>
        )}
        {configVal && (
          <box paddingX={1} paddingBottom={1}>
            <text>
              <span fg={C.dim}>Config: </span>
              <span fg={C.green}>{configVal}</span>
            </text>
          </box>
        )}
        <select
          options={actionOptions}
          focused={focused}
          height={Math.max(3, actionOptions.length + 1)}
          selectedIndex={actionIndex}
          onSelect={handleActionSelect}
          onChange={(idx) => setActionIndex(idx)}
          selectedBackgroundColor={C.bgAlt}
          selectedTextColor={C.focused}
        />
        <box paddingX={1} paddingTop={1}>
          <text>
            <span fg={C.dim}>Enter select Esc back</span>
          </text>
        </box>
      </box>
    );
  }

  // mode === "input"
  if (!selectedProvider) return null;
  return (
    <box flexDirection="column" height={height}>
      <box paddingX={1} paddingBottom={1}>
        <text>
          <span fg={C.cyan}>Set endpoint for {selectedProvider.displayName}</span>
        </text>
      </box>
      <box paddingX={1} paddingBottom={1}>
        <text>
          <span fg={C.dim}>Env var: </span>
          <span fg={C.yellow}>{selectedProvider.endpointEnvVar}</span>
        </text>
      </box>
      {selectedProvider.defaultEndpoint && (
        <box paddingX={1} paddingBottom={1}>
          <text>
            <span fg={C.dim}>Default: </span>
            <span fg={C.dim}>{selectedProvider.defaultEndpoint}</span>
          </text>
        </box>
      )}
      <box paddingX={1} flexDirection="row" gap={1}>
        <text>
          <span fg={C.dim}>URL: </span>
        </text>
        <input
          value={inputValue}
          onChange={setInputValue}
          placeholder="https://..."
          focused={focused}
          width={52}
          backgroundColor={C.bgAlt}
          textColor={C.text}
          cursorColor={C.focused}
          placeholderColor={C.dim}
        />
      </box>
      <box paddingX={1} paddingTop={1}>
        <text>
          <span fg={C.dim}>Enter confirm Esc cancel</span>
        </text>
      </box>
    </box>
  );
}
