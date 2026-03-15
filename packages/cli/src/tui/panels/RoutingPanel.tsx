import type { SelectOption } from "@opentui/core";
/** @jsxImportSource @opentui/react */
import { useKeyboard } from "@opentui/react";
import { useCallback, useState } from "react";
import { loadConfig, saveConfig } from "../../profile-config.js";

const C = {
  green: "#9ece6a",
  red: "#f7768e",
  yellow: "#e0af68",
  cyan: "#7dcfff",
  dim: "#565f89",
  text: "#c0caf5",
  bgAlt: "#24283b",
  focused: "#7aa2f7",
};

type Mode = "list" | "add-pattern" | "add-chain" | "confirm-remove" | "confirm-clear";

interface RoutingPanelProps {
  focused: boolean;
  height: number;
}

function addRule(pattern: string, chain: string): void {
  const cfg = loadConfig();
  if (!cfg.routing) cfg.routing = {};
  cfg.routing[pattern] = chain
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  saveConfig(cfg);
}

function removeRule(pattern: string): void {
  const cfg = loadConfig();
  if (!cfg.routing) return;
  delete cfg.routing[pattern];
  if (Object.keys(cfg.routing).length === 0) cfg.routing = undefined;
  saveConfig(cfg);
}

function clearAllRules(): void {
  const cfg = loadConfig();
  cfg.routing = undefined;
  saveConfig(cfg);
}

export function RoutingPanel({ focused, height }: RoutingPanelProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [actionIndex, setActionIndex] = useState(0);
  const [ruleIndex, setRuleIndex] = useState(0);
  const [patternInput, setPatternInput] = useState("");
  const [chainInput, setChainInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmIndex, setConfirmIndex] = useState(0);

  const config = loadConfig();
  const rules = config.routing ?? {};
  const ruleEntries = Object.entries(rules);
  const ruleCount = ruleEntries.length;

  const actionOptions: Array<{ name: string; description: string; value: string }> = [
    { name: "Add routing rule", description: "Add pattern → provider chain", value: "add" },
    ...(ruleCount > 0
      ? [
          { name: "Remove a rule", description: "Delete a specific routing rule", value: "remove" },
          {
            name: "Clear all rules",
            description: `Remove all ${ruleCount} rule(s)`,
            value: "clear",
          },
        ]
      : []),
  ];

  const handleActionSelect = useCallback(
    (_idx: number, opt: SelectOption | null) => {
      if (!opt?.value) return;
      if (opt.value === "add") {
        setPatternInput("");
        setChainInput("");
        setMode("add-pattern");
      } else if (opt.value === "remove" && ruleCount > 0) {
        setRuleIndex(0);
        setMode("confirm-remove");
      } else if (opt.value === "clear" && ruleCount > 0) {
        setConfirmIndex(0);
        setMode("confirm-clear");
      }
    },
    [ruleCount]
  );

  const handleRemoveSelect = useCallback(
    (_idx: number, opt: SelectOption | null) => {
      if (!opt?.value) return;
      if (opt.value === "back") {
        setMode("list");
        return;
      }
      const idx = Number(opt.value);
      if (!Number.isNaN(idx)) {
        const pattern = ruleEntries[idx]?.[0];
        if (pattern) {
          removeRule(pattern);
          setStatusMsg(`Rule "${pattern}" removed.`);
        }
        setMode("list");
      }
    },
    [ruleEntries]
  );

  const handleConfirmClearSelect = useCallback((_idx: number, opt: SelectOption | null) => {
    if (!opt?.value) return;
    if (opt.value === "yes") {
      clearAllRules();
      setStatusMsg("All routing rules cleared.");
    }
    setMode("list");
  }, []);

  const handlePatternKey = useCallback(
    (keyName: string) => {
      if (keyName === "return" || keyName === "enter") {
        if (patternInput.trim()) setMode("add-chain");
      } else if (keyName === "escape") {
        setMode("list");
        setStatusMsg(null);
      }
    },
    [patternInput]
  );

  const handleChainKey = useCallback(
    (keyName: string) => {
      if (keyName === "return" || keyName === "enter") {
        const pattern = patternInput.trim();
        const chain = chainInput.trim();
        if (pattern && chain) {
          addRule(pattern, chain);
          setStatusMsg(`Rule added: ${pattern}`);
          setPatternInput("");
          setChainInput("");
          setMode("list");
        }
      } else if (keyName === "escape") {
        setMode("add-pattern");
      }
    },
    [patternInput, chainInput]
  );

  useKeyboard((key) => {
    if (!focused) return;
    if (mode === "add-pattern") {
      handlePatternKey(key.name);
    } else if (mode === "add-chain") {
      handleChainKey(key.name);
    } else if (mode === "list" && (key.name === "escape" || key.name === "q")) {
      setStatusMsg(null);
    }
  });

  const listHeight = Math.max(4, height - 8);

  if (mode === "add-pattern") {
    return (
      <box flexDirection="column" height={height} padding={1} gap={1}>
        <text>
          <span fg={C.cyan}>Add Routing Rule — Step 1: Pattern</span>
        </text>
        <text>
          <span fg={C.dim}>Model name pattern (e.g. </span>
          <span fg={C.yellow}>kimi-*</span>
          <span fg={C.dim}>, </span>
          <span fg={C.yellow}>gpt-4o</span>
          <span fg={C.dim}>, </span>
          <span fg={C.yellow}>*</span>
          <span fg={C.dim}>):</span>
        </text>
        <box flexDirection="row" gap={1}>
          <text>
            <span fg={C.dim}>Pattern: </span>
          </text>
          <input
            value={patternInput}
            onChange={setPatternInput}
            placeholder="kimi-*"
            focused={focused}
            width={40}
            backgroundColor={C.bgAlt}
            textColor={C.text}
            cursorColor={C.focused}
            placeholderColor={C.dim}
          />
        </box>
        <text>
          <span fg={C.dim}>Enter confirm Esc cancel</span>
        </text>
      </box>
    );
  }

  if (mode === "add-chain") {
    return (
      <box flexDirection="column" height={height} padding={1} gap={1}>
        <text>
          <span fg={C.cyan}>Add Routing Rule — Step 2: Chain</span>
        </text>
        <text>
          <span fg={C.dim}>Pattern: </span>
          <span fg={C.yellow}>{patternInput}</span>
        </text>
        <text>
          <span fg={C.dim}>Routing chain, comma-separated:</span>
        </text>
        <text>
          <span fg={C.dim}>Example: </span>
          <span fg={C.yellow}>kimi@kimi-k2,openrouter@kimi/kimi-k2</span>
        </text>
        <box flexDirection="row" gap={1}>
          <text>
            <span fg={C.dim}>Chain: </span>
          </text>
          <input
            value={chainInput}
            onChange={setChainInput}
            placeholder="provider@model,fallback@model"
            focused={focused}
            width={45}
            backgroundColor={C.bgAlt}
            textColor={C.text}
            cursorColor={C.focused}
            placeholderColor={C.dim}
          />
        </box>
        <text>
          <span fg={C.dim}>Enter confirm Esc back to pattern</span>
        </text>
      </box>
    );
  }

  if (mode === "confirm-remove") {
    const removeOptions: Array<{ name: string; description: string; value: string }> = [
      ...ruleEntries.map(([pattern, chain], i) => ({
        name: `${pattern} → ${chain.join(" | ")}`,
        description: "Select to remove this rule",
        value: String(i),
      })),
      { name: "Back", description: "Return without removing", value: "back" },
    ];

    return (
      <box flexDirection="column" height={height}>
        <box paddingX={1} paddingBottom={1}>
          <text>
            <span fg={C.yellow}>Select a rule to remove:</span>
          </text>
        </box>
        <select
          options={removeOptions}
          focused={focused}
          height={listHeight}
          selectedIndex={ruleIndex}
          onSelect={handleRemoveSelect}
          onChange={(idx) => setRuleIndex(idx)}
          selectedBackgroundColor={C.bgAlt}
          selectedTextColor={C.focused}
        />
        <box paddingX={1} paddingTop={1}>
          <text>
            <span fg={C.dim}>Enter remove Esc back</span>
          </text>
        </box>
      </box>
    );
  }

  if (mode === "confirm-clear") {
    return (
      <box flexDirection="column" height={height} padding={1} gap={1}>
        <text>
          <span fg={C.red}>Clear all {ruleCount} routing rule(s)?</span>
        </text>
        <select
          options={[
            { name: "No, keep rules", description: "Return without clearing", value: "no" },
            { name: "Yes, clear all", description: "Remove all routing rules", value: "yes" },
          ]}
          focused={focused}
          height={4}
          selectedIndex={confirmIndex}
          onSelect={handleConfirmClearSelect}
          onChange={(idx) => setConfirmIndex(idx)}
          selectedBackgroundColor={C.bgAlt}
          selectedTextColor={C.focused}
        />
      </box>
    );
  }

  // mode === "list"
  return (
    <box flexDirection="column" height={height}>
      {ruleCount > 0 ? (
        <box flexDirection="column" padding={1} gap={0}>
          <text>
            <span fg={C.dim}>{ruleCount} rule(s) defined:</span>
          </text>
          {ruleEntries.map(([pattern, chain]) => (
            <text key={`rule-${pattern}`}>
              {"  "}
              <span fg={C.cyan}>{pattern}</span>
              <span fg={C.dim}> → </span>
              <span fg={C.text}>{chain.join(" | ")}</span>
            </text>
          ))}
        </box>
      ) : (
        <box padding={1}>
          <text>
            <span fg={C.dim}>No custom routing rules configured.</span>
          </text>
        </box>
      )}
      <box paddingX={1} paddingBottom={1}>
        <text>
          <span fg={C.dim}>Format: pattern → provider[@model], fallback chain comma-separated</span>
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
      {statusMsg && (
        <box paddingX={1} paddingTop={1}>
          <text>
            <span fg={C.green}>{statusMsg}</span>
          </text>
        </box>
      )}
      <box paddingX={1} paddingTop={1}>
        <text>
          <span fg={C.dim}>Enter select Tab switch panel</span>
        </text>
      </box>
    </box>
  );
}
