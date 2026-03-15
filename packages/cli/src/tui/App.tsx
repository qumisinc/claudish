import type { SelectOption } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
/** @jsxImportSource @opentui/react */
import { useCallback, useState } from "react";
import { ApiKeysPanel } from "./panels/ApiKeysPanel.js";
import { ConfigViewPanel } from "./panels/ConfigViewPanel.js";
import { ProfilesPanel } from "./panels/ProfilesPanel.js";
import { ProvidersPanel } from "./panels/ProvidersPanel.js";
import { RoutingPanel } from "./panels/RoutingPanel.js";
import { TelemetryPanel } from "./panels/TelemetryPanel.js";

// Tokyo Night palette
const C = {
  bg: "#1a1b26",
  bgAlt: "#24283b",
  borderDim: "#3b4261",
  borderFocused: "#7aa2f7",
  title: "#c0caf5",
  titleAlt: "#7aa2f7",
  green: "#9ece6a",
  red: "#f7768e",
  yellow: "#e0af68",
  cyan: "#7dcfff",
  dim: "#565f89",
  text: "#c0caf5",
};

type Section = "apikeys" | "providers" | "profiles" | "routing" | "telemetry" | "config";
type Panel = "menu" | "content";

const MENU_ITEMS: Array<{ label: string; section: Section; hint: string }> = [
  { label: "API Keys", section: "apikeys", hint: "Set up provider API keys" },
  { label: "Providers", section: "providers", hint: "Configure custom endpoints" },
  { label: "Profiles", section: "profiles", hint: "Manage model profiles" },
  { label: "Routing", section: "routing", hint: "Custom model routing rules" },
  { label: "Telemetry", section: "telemetry", hint: "Toggle anonymous error reporting" },
  { label: "View Config", section: "config", hint: "View current configuration" },
];

export function App() {
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const [activePanel, setActivePanel] = useState<Panel>("menu");
  const [activeSection, setActiveSection] = useState<Section>("apikeys");
  const [menuIndex, setMenuIndex] = useState(0);

  const quit = useCallback(() => {
    renderer.destroy();
  }, [renderer]);

  useKeyboard((key) => {
    // Global quit (only when menu panel is focused)
    if (key.name === "q" && activePanel === "menu") {
      quit();
      return;
    }
    if (key.ctrl && key.name === "c") {
      quit();
      return;
    }

    // Tab switches focus between menu and content
    if (key.name === "tab") {
      setActivePanel((p) => (p === "menu" ? "content" : "menu"));
      return;
    }
  });

  const handleMenuSelect = useCallback((_idx: number, opt: SelectOption | null) => {
    if (opt?.value) {
      setActiveSection(opt.value as Section);
      setActivePanel("content");
    }
  }, []);

  const menuWidth = 22;
  const topHeight = Math.max(10, height - 4);
  const contentHeight = topHeight - 2; // account for border

  const menuOptions = MENU_ITEMS.map((item) => ({
    name: (activeSection === item.section ? "> " : "  ") + item.label,
    description: item.hint,
    value: item.section,
  }));

  const contentTitle = MENU_ITEMS.find((m) => m.section === activeSection)?.label ?? "Content";

  return (
    <box width={width} height={height} flexDirection="column" backgroundColor={C.bg}>
      {/* Top row: menu + content */}
      <box flexDirection="row" height={topHeight}>
        {/* Sidebar menu */}
        <box
          border
          borderStyle="single"
          title=" Menu "
          borderColor={activePanel === "menu" ? C.borderFocused : C.borderDim}
          width={menuWidth}
          height={topHeight}
          flexDirection="column"
          backgroundColor={C.bg}
        >
          <select
            options={menuOptions}
            focused={activePanel === "menu"}
            height={topHeight - 2}
            selectedIndex={menuIndex}
            onSelect={handleMenuSelect}
            onChange={(idx) => {
              setMenuIndex(idx);
              const section = MENU_ITEMS[idx]?.section;
              if (section) setActiveSection(section);
            }}
            selectedBackgroundColor={C.bgAlt}
            selectedTextColor={C.borderFocused}
          />
        </box>

        {/* Content panel */}
        <box
          border
          borderStyle="single"
          title={` ${contentTitle} `}
          borderColor={activePanel === "content" ? C.borderFocused : C.borderDim}
          flexGrow={1}
          height={topHeight}
          backgroundColor={C.bg}
        >
          <ContentPanel
            section={activeSection}
            focused={activePanel === "content"}
            height={contentHeight}
            width={width - menuWidth - 4}
          />
        </box>
      </box>

      {/* Footer */}
      <box
        height={3}
        border
        borderStyle="single"
        borderColor={C.borderDim}
        flexDirection="row"
        alignItems="center"
        paddingX={2}
        backgroundColor={C.bg}
      >
        <text>
          <span fg={C.dim}>Tab</span>
          <span fg={C.text}> switch panel </span>
          <span fg={C.dim}>↑↓</span>
          <span fg={C.text}> navigate </span>
          <span fg={C.dim}>Enter</span>
          <span fg={C.text}> select </span>
          <span fg={C.dim}>q</span>
          <span fg={C.text}> quit</span>
        </text>
      </box>
    </box>
  );
}

interface ContentPanelProps {
  section: Section;
  focused: boolean;
  height: number;
  width: number;
}

function ContentPanel({ section, focused, height, width: _width }: ContentPanelProps) {
  switch (section) {
    case "apikeys":
      return <ApiKeysPanel focused={focused} height={height} />;
    case "providers":
      return <ProvidersPanel focused={focused} height={height} />;
    case "profiles":
      return <ProfilesPanel focused={focused} height={height} />;
    case "routing":
      return <RoutingPanel focused={focused} height={height} />;
    case "telemetry":
      return <TelemetryPanel focused={focused} height={height} />;
    case "config":
      return <ConfigViewPanel focused={focused} height={height} />;
    default:
      return null;
  }
}
