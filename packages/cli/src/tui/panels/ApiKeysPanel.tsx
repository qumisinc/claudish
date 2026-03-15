import type { SelectOption } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
/** @jsxImportSource @opentui/react */
import { useCallback, useState } from "react";
import { loadConfig, removeApiKey, setApiKey } from "../../profile-config.js";
import { PROVIDERS, type ProviderDef, maskKey } from "../providers.js";

// Tokyo Night palette
const C = {
  green: "#9ece6a",
  red: "#f7768e",
  yellow: "#e0af68",
  cyan: "#7dcfff",
  dim: "#565f89",
  text: "#c0caf5",
  bg: "#1a1b26",
  bgAlt: "#24283b",
  focused: "#7aa2f7",
};

type Mode = "list" | "action" | "input";

interface ApiKeysPanelProps {
  focused: boolean;
  height: number;
}

export function ApiKeysPanel({ focused, height }: ApiKeysPanelProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const config = loadConfig();

  const getKeyStatus = (p: ProviderDef) => {
    const envSet = !!process.env[p.apiKeyEnvVar];
    const configSet = !!config.apiKeys?.[p.apiKeyEnvVar];
    return { envSet, configSet };
  };

  const selectedProvider = PROVIDERS[selectedProviderIndex];

  const getActionOptions = useCallback(() => {
    const p = selectedProvider;
    const cfg = loadConfig();
    const configSet = !!cfg.apiKeys?.[p.apiKeyEnvVar];
    const opts: Array<{ name: string; description: string; value: string }> = [
      {
        name: "Set API key",
        description: `Store ${p.apiKeyEnvVar} in ~/.claudish/config.json`,
        value: "set",
      },
    ];
    if (configSet) {
      opts.push({
        name: "Remove stored key",
        description: "Remove from config (env var unaffected)",
        value: "remove",
      });
    }
    opts.push({ name: "Back", description: "Return to provider list", value: "back" });
    return opts;
  }, [selectedProvider]);

  const handleListSelect = useCallback((_idx: number, opt: SelectOption | null) => {
    if (!opt?.value) return;
    const idx = PROVIDERS.findIndex((p) => p.name === opt.value);
    if (idx >= 0) {
      setSelectedProviderIndex(idx);
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
      if (opt.value === "set") {
        setInputValue("");
        setMode("input");
        return;
      }
      if (opt.value === "remove" && selectedProvider) {
        removeApiKey(selectedProvider.apiKeyEnvVar);
        setStatusMsg("Key removed from config.");
        setMode("list");
        return;
      }
    },
    [selectedProvider]
  );

  const handleInputConfirm = useCallback(() => {
    if (!selectedProvider) return;
    const val = inputValue.trim();
    if (!val) {
      setStatusMsg("No key entered.");
      setMode("action");
      return;
    }
    setApiKey(selectedProvider.apiKeyEnvVar, val);
    process.env[selectedProvider.apiKeyEnvVar] = val;
    setStatusMsg(`Key saved for ${selectedProvider.displayName}.`);
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
        setInputValue("");
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

  const listOptions = PROVIDERS.map((p) => {
    const { envSet, configSet } = getKeyStatus(p);
    let statusLabel: string;
    if (envSet && configSet) statusLabel = " set (env+cfg)";
    else if (envSet) statusLabel = " set (env)    ";
    else if (configSet) statusLabel = " set (config) ";
    else statusLabel = " not set      ";

    const icon = envSet || configSet ? "+" : "-";

    return {
      name: `${icon} ${p.displayName.padEnd(16)} ${statusLabel}`,
      description: p.description,
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
          selectedIndex={selectedProviderIndex}
          onSelect={handleListSelect}
          onChange={(idx) => setSelectedProviderIndex(idx)}
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
    const envKey = process.env[p.apiKeyEnvVar];
    const configKey = cfg.apiKeys?.[p.apiKeyEnvVar];
    const actionOptions = getActionOptions();

    return (
      <box flexDirection="column" height={height}>
        <box paddingX={1} paddingBottom={1}>
          <text>
            <span fg={C.cyan}>{p.displayName}</span>
            {"  "}
            <span fg={C.dim}>{p.description}</span>
          </text>
        </box>
        {envKey && (
          <box paddingX={1}>
            <text>
              <span fg={C.dim}>Env: </span>
              <span fg={C.green}>{maskKey(envKey)}</span>
            </text>
          </box>
        )}
        {configKey && (
          <box paddingX={1}>
            <text>
              <span fg={C.dim}>Config: </span>
              <span fg={C.green}>{maskKey(configKey)}</span>
            </text>
          </box>
        )}
        <box paddingX={1} paddingBottom={1}>
          <text>
            <span fg={C.dim}>Key URL: </span>
            <span fg={C.cyan}>{p.keyUrl}</span>
          </text>
        </box>
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
          <span fg={C.cyan}>Set API key for {selectedProvider.displayName}</span>
        </text>
      </box>
      <box paddingX={1} paddingBottom={1}>
        <text>
          <span fg={C.dim}>Env var: </span>
          <span fg={C.yellow}>{selectedProvider.apiKeyEnvVar}</span>
        </text>
      </box>
      <box paddingX={1} paddingBottom={1}>
        <text>
          <span fg={C.dim}>Get key at: </span>
          <span fg={C.cyan}>{selectedProvider.keyUrl}</span>
        </text>
      </box>
      <box paddingX={1} flexDirection="row" gap={1}>
        <text>
          <span fg={C.dim}>Key: </span>
        </text>
        <input
          value={inputValue}
          onChange={setInputValue}
          placeholder="Paste your API key here..."
          focused={focused}
          width={50}
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
