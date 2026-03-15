/** @jsxImportSource @opentui/react */
import { loadConfig } from "../../profile-config.js";
import { PROVIDERS, maskKey } from "../providers.js";

const C = {
  green: "#9ece6a",
  yellow: "#e0af68",
  cyan: "#7dcfff",
  dim: "#565f89",
  text: "#c0caf5",
  bgAlt: "#24283b",
  focused: "#7aa2f7",
};

interface ConfigViewPanelProps {
  focused: boolean;
  height: number;
}

interface KeyRow {
  name: string;
  keyStr: string;
  source: string;
}

interface EndpointRow {
  name: string;
  url: string;
  source: string;
}

function buildApiKeyRows(config: ReturnType<typeof loadConfig>): KeyRow[] {
  const rows: KeyRow[] = [];
  for (const p of PROVIDERS) {
    const envVal = process.env[p.apiKeyEnvVar];
    const configVal = config.apiKeys?.[p.apiKeyEnvVar];
    if (!envVal && !configVal) continue;
    if (envVal && configVal) {
      rows.push({ name: p.displayName, keyStr: maskKey(envVal), source: "env+config" });
    } else if (envVal) {
      rows.push({ name: p.displayName, keyStr: maskKey(envVal), source: "env" });
    } else if (configVal) {
      rows.push({ name: p.displayName, keyStr: maskKey(configVal), source: "config" });
    }
  }
  return rows;
}

function buildEndpointRows(config: ReturnType<typeof loadConfig>): EndpointRow[] {
  const rows: EndpointRow[] = [];
  for (const [k, v] of Object.entries(config.endpoints ?? {})) {
    const p = PROVIDERS.find((pr) => pr.endpointEnvVar === k);
    rows.push({ name: p?.displayName ?? k, url: v, source: "config" });
  }
  for (const p of PROVIDERS) {
    if (p.endpointEnvVar) {
      const envVal = process.env[p.endpointEnvVar];
      if (envVal && !config.endpoints?.[p.endpointEnvVar]) {
        rows.push({ name: p.displayName, url: envVal, source: "env" });
      }
    }
  }
  return rows;
}

export function ConfigViewPanel({ focused: _focused, height }: ConfigViewPanelProps) {
  const config = loadConfig();
  const profileCount = Object.keys(config.profiles).length;
  const apiKeyRows = buildApiKeyRows(config);
  const endpointRows = buildEndpointRows(config);
  const ruleEntries = Object.entries(config.routing ?? {});
  const telemetry = config.telemetry;
  const telemetryStatus = !telemetry
    ? "not configured"
    : telemetry.enabled
      ? "enabled"
      : "disabled";
  const telemetryColor = !telemetry ? C.dim : telemetry.enabled ? C.green : C.yellow;

  return (
    <scrollbox focused height={height}>
      <box flexDirection="column" padding={1} gap={1}>
        <text>
          <span fg={C.dim}>Default profile: </span>
          <span fg={C.cyan}>{config.defaultProfile}</span>
          <span fg={C.dim}>
            {" "}
            ({profileCount} profile{profileCount !== 1 ? "s" : ""} total)
          </span>
        </text>

        <text>
          <strong>API Keys</strong>
          <span fg={C.dim}> (env var → source)</span>
        </text>
        {apiKeyRows.length === 0 ? (
          <text>
            <span fg={C.dim}> No API keys configured.</span>
          </text>
        ) : (
          apiKeyRows.map((row) => (
            <text key={`key-${row.name}`}>
              {"  "}
              <span fg={C.text}>{row.name.padEnd(16)}</span>
              {"  "}
              <span fg={C.green}>{row.keyStr}</span>
              {"  "}
              <span fg={C.dim}>({row.source})</span>
            </text>
          ))
        )}

        {endpointRows.length > 0 && (
          <>
            <text>
              <strong>Custom Endpoints</strong>
            </text>
            {endpointRows.map((row) => (
              <text key={`ep-${row.name}`}>
                {"  "}
                <span fg={C.text}>{row.name.padEnd(16)}</span>
                {"  "}
                <span fg={C.green}>{row.url}</span>
                {"  "}
                <span fg={C.dim}>({row.source})</span>
              </text>
            ))}
          </>
        )}

        {ruleEntries.length > 0 && (
          <>
            <text>
              <strong>Routing Rules</strong>
            </text>
            {ruleEntries.map(([pattern, chain]) => (
              <text key={`rule-${pattern}`}>
                {"  "}
                <span fg={C.cyan}>{pattern}</span>
                <span fg={C.dim}> → </span>
                <span fg={C.text}>{chain.join(" | ")}</span>
              </text>
            ))}
          </>
        )}

        <text>
          <strong>Telemetry: </strong>
          <span fg={telemetryColor}>{telemetryStatus}</span>
        </text>

        <text>
          <span fg={C.dim}>Config file: ~/.claudish/config.json</span>
        </text>
      </box>
    </scrollbox>
  );
}
