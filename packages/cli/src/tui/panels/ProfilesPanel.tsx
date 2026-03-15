/** @jsxImportSource @opentui/react */
import { listAllProfiles } from "../../profile-config.js";

const C = {
  green: "#9ece6a",
  yellow: "#e0af68",
  cyan: "#7dcfff",
  dim: "#565f89",
  text: "#c0caf5",
  bgAlt: "#24283b",
  focused: "#7aa2f7",
};

interface ProfilesPanelProps {
  focused: boolean;
  height: number;
}

export function ProfilesPanel({ focused: _focused, height }: ProfilesPanelProps) {
  const profiles = listAllProfiles();

  if (profiles.length === 0) {
    return (
      <box flexDirection="column" height={height} padding={1}>
        <text>
          <span fg={C.dim}>No profiles configured.</span>
        </text>
        <text>
          <span fg={C.dim}>Run </span>
          <span fg={C.cyan}>claudish init</span>
          <span fg={C.dim}> to create a profile.</span>
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="column" height={height}>
      <box flexDirection="column" padding={1} gap={1}>
        {profiles.map((profile, i) => (
          <box
            key={`${profile.scope}-${profile.name}-${i}`}
            flexDirection="column"
            paddingBottom={1}
          >
            <box flexDirection="row" gap={2}>
              <text>
                <span fg={profile.isDefault ? C.cyan : C.text}>
                  <strong>{profile.name}</strong>
                </span>
                {profile.isDefault && <span fg={C.cyan}> (default)</span>}
                {profile.shadowed && <span fg={C.yellow}> [shadowed]</span>}
                <span fg={C.dim}> [{profile.scope}]</span>
              </text>
            </box>
            {profile.description && (
              <text>
                <span fg={C.dim}> {profile.description}</span>
              </text>
            )}
            <box flexDirection="column" paddingLeft={2}>
              {profile.models.opus && (
                <text>
                  <span fg={C.dim}>opus: </span>
                  <span fg={C.green}>{profile.models.opus}</span>
                </text>
              )}
              {profile.models.sonnet && (
                <text>
                  <span fg={C.dim}>sonnet: </span>
                  <span fg={C.green}>{profile.models.sonnet}</span>
                </text>
              )}
              {profile.models.haiku && (
                <text>
                  <span fg={C.dim}>haiku: </span>
                  <span fg={C.green}>{profile.models.haiku}</span>
                </text>
              )}
              {profile.models.subagent && (
                <text>
                  <span fg={C.dim}>subagent: </span>
                  <span fg={C.green}>{profile.models.subagent}</span>
                </text>
              )}
              {!profile.models.opus &&
                !profile.models.sonnet &&
                !profile.models.haiku &&
                !profile.models.subagent && (
                  <text>
                    <span fg={C.dim}>No model mappings (uses interactive selector)</span>
                  </text>
                )}
            </box>
          </box>
        ))}
      </box>
      <box paddingX={1} paddingTop={1}>
        <text>
          <span fg={C.dim}>Read-only view | claudish profile add/edit to manage</span>
        </text>
      </box>
    </box>
  );
}
