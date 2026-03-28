import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import type { PluginDefaultsDoc, ModelDoc, CapabilityFlags } from "./schema.js";

// ─────────────────────────────────────────────────────────────
// Alias resolution helpers
// ─────────────────────────────────────────────────────────────

function resolveAlias(value: string, aliases: Record<string, string>): string {
  return aliases[value] ?? value;
}

function resolveRoles(
  roles: PluginDefaultsDoc["roles"],
  aliases: Record<string, string>
): PluginDefaultsDoc["roles"] {
  const resolved: PluginDefaultsDoc["roles"] = {};
  for (const [roleName, roleConfig] of Object.entries(roles)) {
    resolved[roleName] = {
      modelId: resolveAlias(roleConfig.modelId, aliases),
      ...(roleConfig.fallback !== undefined && {
        fallback: resolveAlias(roleConfig.fallback, aliases),
      }),
    };
  }
  return resolved;
}

function resolveTeams(
  teams: PluginDefaultsDoc["teams"],
  aliases: Record<string, string>
): PluginDefaultsDoc["teams"] {
  const resolved: PluginDefaultsDoc["teams"] = {};
  for (const [teamName, members] of Object.entries(teams)) {
    resolved[teamName] = members.map(member =>
      member === "internal" ? member : resolveAlias(member, aliases)
    );
  }
  return resolved;
}

// ─────────────────────────────────────────────────────────────
// Collect all unique model IDs referenced in the config
// "internal" is a sentinel — exclude it from lookup
// ─────────────────────────────────────────────────────────────

function collectModelIds(doc: PluginDefaultsDoc): Set<string> {
  const ids = new Set<string>();
  const { shortAliases } = doc;

  // Alias target values (the full model IDs)
  for (const modelId of Object.values(shortAliases)) {
    ids.add(modelId);
  }

  // Role modelId and fallback — resolve aliases first
  for (const roleConfig of Object.values(doc.roles)) {
    ids.add(resolveAlias(roleConfig.modelId, shortAliases));
    if (roleConfig.fallback !== undefined) {
      ids.add(resolveAlias(roleConfig.fallback, shortAliases));
    }
  }

  // Team members — resolve aliases, skip "internal"
  for (const members of Object.values(doc.teams)) {
    for (const member of members) {
      if (member !== "internal") {
        ids.add(resolveAlias(member, shortAliases));
      }
    }
  }

  return ids;
}

// ─────────────────────────────────────────────────────────────
// knownModels response shape
// ─────────────────────────────────────────────────────────────

interface KnownModelEntry {
  displayName: string;
  provider: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  status: string;
  capabilities: Pick<CapabilityFlags, "vision" | "thinking" | "tools" | "streaming">;
}

// ─────────────────────────────────────────────────────────────
// Batch-fetch model metadata from the models collection
// ─────────────────────────────────────────────────────────────

async function fetchKnownModels(
  modelIds: Set<string>
): Promise<Record<string, KnownModelEntry>> {
  if (modelIds.size === 0) return {};

  const db = getFirestore();
  // Model IDs containing "/" can't be Firestore document IDs (e.g. "openrouter/polaris-alpha")
  const ids = Array.from(modelIds).filter(id => !id.includes("/"));

  if (ids.length === 0) return {};

  // Firestore getAll supports up to 500 docs at once — well within our range
  const docRefs = ids.map(id => db.collection("models").doc(id));
  const snaps = await db.getAll(...docRefs);

  const knownModels: Record<string, KnownModelEntry> = {};
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const m = snap.data() as ModelDoc;
    knownModels[snap.id] = {
      displayName: m.displayName,
      provider: m.provider,
      ...(m.contextWindow !== undefined && { contextWindow: m.contextWindow }),
      ...(m.maxOutputTokens !== undefined && { maxOutputTokens: m.maxOutputTokens }),
      status: m.status,
      capabilities: {
        vision: m.capabilities.vision ?? false,
        thinking: m.capabilities.thinking ?? false,
        tools: m.capabilities.tools ?? false,
        streaming: m.capabilities.streaming ?? false,
      },
    };
  }
  return knownModels;
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────

export async function handlePluginDefaults(req: Request, res: Response): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const db = getFirestore();
    const snap = await db.collection("config").doc("plugin-defaults").get();

    if (!snap.exists) {
      res.status(404).json({ error: "Plugin defaults not configured" });
      return;
    }

    const doc = snap.data() as PluginDefaultsDoc;
    const shouldResolve = req.query.resolve === "true";

    const roles = shouldResolve
      ? resolveRoles(doc.roles, doc.shortAliases)
      : doc.roles;

    const teams = shouldResolve
      ? resolveTeams(doc.teams, doc.shortAliases)
      : doc.teams;

    const modelIds = collectModelIds(doc);
    const knownModels = await fetchKnownModels(modelIds);

    res.set("Cache-Control", "public, max-age=300");
    res.status(200).json({
      version: doc.version,
      generatedAt: new Date().toISOString(),
      shortAliases: doc.shortAliases,
      roles,
      teams,
      knownModels,
    });
  } catch (err) {
    console.error("[plugin-defaults] Firestore read failed:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
