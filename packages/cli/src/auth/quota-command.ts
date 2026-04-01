/**
 * Quota/usage subcommand for OAuth providers.
 *
 * Usage:
 *   claudish quota [provider]   - Show quota usage for a provider
 *   claudish usage [provider]   - Alias for quota
 *
 * Currently supports: gemini (Code Assist quota via retrieveUserQuota API)
 */

import { hasOAuthCredentials } from "./oauth-registry.js";

// ANSI
const R = "\x1b[0m";
const B = "\x1b[1m";
const D = "\x1b[2m";
const I = "\x1b[3m";
const RED = "\x1b[31m";
const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const BLU = "\x1b[34m";
const MAG = "\x1b[35m";
const CYN = "\x1b[36m";
const WHT = "\x1b[37m";
const GRY = "\x1b[90m";

/** Capacity fallback chain (mirrors gemini-codeassist.ts) */
const FALLBACK_CHAIN = [
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

export async function quotaCommand(provider?: string): Promise<void> {
  const target = provider?.toLowerCase() || "gemini";

  if (target !== "gemini") {
    console.error(`Quota is currently only supported for: gemini`);
    console.error(`Usage: claudish quota gemini`);
    process.exit(1);
  }

  if (!hasOAuthCredentials("google") && !hasOAuthCredentials("gemini-codeassist")) {
    console.error(`${RED}Not logged in.${R} Run: ${B}claudish login gemini${R}`);
    process.exit(1);
  }

  try {
    const { getValidAccessToken, setupGeminiUser, retrieveUserQuota, getGeminiTierFullName } =
      await import("./gemini-oauth.js");

    const accessToken = await getValidAccessToken();
    const { projectId } = await setupGeminiUser(accessToken);
    const tierName = getGeminiTierFullName();

    const quota = await retrieveUserQuota(accessToken, projectId);
    if (!quota?.buckets?.length) {
      console.log(`\n  ${D}No quota data available.${R}\n`);
      process.exit(0);
    }

    const W = 58;

    // Header box
    console.log("");
    console.log(`  ${CYN}╭${"─".repeat(W)}╮${R}`);
    console.log(`  ${CYN}│${R} ${B}${WHT}Gemini Code Assist Quota${R}${" ".repeat(W - 25)}${CYN}│${R}`);
    console.log(`  ${CYN}├${"─".repeat(W)}┤${R}`);
    console.log(`  ${CYN}│${R} ${GRY}Tier${R}     ${WHT}${tierName}${R}${" ".repeat(Math.max(0, W - 10 - tierName.length))}${CYN}│${R}`);
    console.log(`  ${CYN}│${R} ${GRY}Project${R}  ${WHT}${projectId}${R}${" ".repeat(Math.max(0, W - 10 - projectId.length))}${CYN}│${R}`);
    console.log(`  ${CYN}╰${"─".repeat(W)}╯${R}`);

    const groups = groupByVersion(quota.buckets);

    // Overall summary
    const allBuckets = quota.buckets.filter((b: QuotaBucket) => typeof b.remainingFraction === "number");
    const avgRemaining = allBuckets.length > 0
      ? allBuckets.reduce((sum: number, b: QuotaBucket) => sum + (b.remainingFraction ?? 0), 0) / allBuckets.length
      : 1;
    const avgUsed = 1 - avgRemaining;
    const summaryColor = avgUsed < 0.5 ? GRN : avgUsed < 0.8 ? YEL : RED;

    console.log("");
    console.log(`  ${summaryColor}${B}${(avgUsed * 100).toFixed(1)}%${R} ${D}overall usage across ${allBuckets.length} models${R}`);
    console.log("");

    // Build a map of modelId → remaining for fallback chain display
    const remainingByModel = new Map<string, number>();
    for (const b of quota.buckets) {
      if (b.modelId && typeof b.remainingFraction === "number") {
        remainingByModel.set(b.modelId, b.remainingFraction);
      }
    }

    for (const group of groups) {
      console.log(`  ${MAG}${B}${group.title}${R}`);

      for (const bucket of group.buckets) {
        const model = bucket.modelId || "unknown";
        const remaining = typeof bucket.remainingFraction === "number" ? bucket.remainingFraction : null;
        const used = remaining !== null ? 1 - remaining : null;
        const reset = bucket.resetTime ? formatRelativeReset(bucket.resetTime) : "";

        const color = used === null ? GRY : used < 0.5 ? GRN : used < 0.8 ? YEL : RED;
        const bar = remaining !== null ? buildUsageBar(used!, color, 24) : `${GRY}${"·".repeat(24)}${R}`;
        const pct = used !== null ? `${(used * 100).toFixed(1)}%` : "?";

        const nameStr = `  ${GRY}│${R} ${WHT}${model}${R}`;
        const padLen = Math.max(1, 30 - model.length);

        console.log(`${nameStr}${" ".repeat(padLen)}${bar}  ${color}${pct.padStart(6)}${R}  ${GRY}${I}${reset}${R}`);
      }
      console.log("");
    }

    // Fallback chain with live quota status
    console.log(`  ${B}${CYN}Fallback Chain${R} ${D}(on capacity exhaustion)${R}`);
    const chainIdx = FALLBACK_CHAIN.findIndex((m) => remainingByModel.has(m));
    for (let i = 0; i < FALLBACK_CHAIN.length; i++) {
      const model = FALLBACK_CHAIN[i];
      const rem = remainingByModel.get(model);
      const pct = rem !== undefined ? `${((1 - rem) * 100).toFixed(0)}%` : "?";
      const color = rem === undefined ? GRY : rem > 0.5 ? GRN : rem > 0.2 ? YEL : RED;
      const arrow = i < FALLBACK_CHAIN.length - 1 ? ` ${GRY}→${R}` : "";
      const marker = i === 0 ? `${CYN}▸${R} ` : `  `;
      console.log(`  ${marker}${WHT}${model}${R} ${color}${pct}${R}${arrow}`);
    }
    console.log("");

    // Usage examples
    console.log(`  ${B}${CYN}Usage${R}`);
    console.log(`    ${WHT}claudish --model gemini-3.1-pro-preview${R}`);
    console.log(`    ${WHT}claudish --model gemini-2.5-flash${R}`);
    console.log("");

    // Legend
    console.log(`  ${GRN}█${R}${GRY} <50%${R}   ${YEL}█${R}${GRY} 50-80%${R}   ${RED}█${R}${GRY} >80%${R}   ${D}░ available${R}`);
    console.log("");
  } catch (err: any) {
    console.error(`Failed to fetch quota: ${err.message}`);
    process.exit(1);
  }
}

interface QuotaBucket {
  modelId?: string;
  remainingFraction?: number;
  remainingAmount?: string;
  resetTime?: string;
  tokenType?: string;
}

interface VersionGroup {
  title: string;
  version: string | undefined;
  buckets: QuotaBucket[];
}

function groupByVersion(buckets: QuotaBucket[]): VersionGroup[] {
  const groups = new Map<string, VersionGroup>();
  const sorted = [...buckets].sort((a, b) => (a.modelId || "").localeCompare(b.modelId || ""));

  for (const bucket of sorted) {
    const version = extractVersion(bucket.modelId || "");
    const key = version || "__other__";
    const existing = groups.get(key);
    if (existing) {
      existing.buckets.push(bucket);
    } else {
      groups.set(key, {
        title: version ? `Gemini ${version}` : "Other",
        version,
        buckets: [bucket],
      });
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.version && !b.version) return 0;
    if (!a.version) return 1;
    if (!b.version) return -1;
    return b.version.localeCompare(a.version);
  });
}

function extractVersion(modelId: string): string | undefined {
  const match = modelId.match(/^gemini-([0-9]+(?:\.[0-9]+)*)-/i);
  return match?.[1];
}

function buildUsageBar(usedFraction: number, color: string, width = 24): string {
  const clamped = Math.max(0, Math.min(1, usedFraction));
  const usedCols = clamped >= 1
    ? width
    : Math.max(clamped > 0.005 ? 1 : 0, Math.round(clamped * width));
  const freeCols = width - usedCols;
  const usedPart = usedCols > 0 ? `${color}${"█".repeat(usedCols)}${R}` : "";
  const freePart = freeCols > 0 ? `${D}${"░".repeat(freeCols)}${R}` : "";
  return usedPart + freePart;
}

function formatRelativeReset(resetTime: string): string {
  const resetAt = new Date(resetTime).getTime();
  if (Number.isNaN(resetAt)) return "";
  const diffMs = resetAt - Date.now();
  if (diffMs <= 0) return "resets now";
  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `resets ${hours}h ${minutes}m`;
  if (hours > 0) return `resets ${hours}h`;
  return `resets ${minutes}m`;
}
