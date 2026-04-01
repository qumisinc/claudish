/**
 * Unified login/logout subcommands for OAuth providers.
 *
 * Usage:
 *   claudish login [provider]   - Interactive selection or direct login
 *   claudish logout [provider]  - Interactive selection or direct logout
 *
 * Replaces the old per-provider flags (--gemini-login, --kimi-login, etc.)
 */

import { select } from "@inquirer/prompts";
import { hasOAuthCredentials } from "./oauth-registry.js";

/**
 * Metadata for an OAuth-capable provider.
 */
interface OAuthProvider {
  /** Canonical name used on the CLI (e.g. "gemini", "kimi") */
  name: string;
  /** Pretty display name */
  displayName: string;
  /** claudish model prefix(es) */
  prefix: string;
  /** Dynamic import path for the OAuth class (relative to this file) */
  module: string;
  /** Exported class name inside the module */
  className: string;
  /** Keys in OAUTH_PROVIDERS that share this credential file */
  registryKeys: string[];
}

const AUTH_PROVIDERS: OAuthProvider[] = [
  {
    name: "gemini",
    displayName: "Gemini Code Assist",
    prefix: "go@",
    module: "./gemini-oauth.js",
    className: "GeminiOAuth",
    registryKeys: ["google", "gemini-codeassist"],
  },
  {
    name: "kimi",
    displayName: "Kimi / Moonshot AI",
    prefix: "kc@, kimi@",
    module: "./kimi-oauth.js",
    className: "KimiOAuth",
    registryKeys: ["kimi", "kimi-coding"],
  },
  {
    name: "codex",
    displayName: "OpenAI Codex (ChatGPT Plus/Pro)",
    prefix: "cx@",
    module: "./codex-oauth.js",
    className: "CodexOAuth",
    registryKeys: ["openai-codex"],
  },
];

function getAuthStatus(provider: OAuthProvider): string {
  const hasCredentials = provider.registryKeys.some((k) => hasOAuthCredentials(k));
  return hasCredentials ? "logged in" : "not logged in";
}

async function selectProvider(action: string): Promise<OAuthProvider> {
  const choices = AUTH_PROVIDERS.map((p) => ({
    name: `${p.displayName} (${p.prefix}) - ${getAuthStatus(p)}`,
    value: p,
  }));

  return select({
    message: `Select provider to ${action}:`,
    choices,
  });
}

function findProvider(name: string): OAuthProvider | null {
  const lower = name.toLowerCase();
  return (
    AUTH_PROVIDERS.find(
      (p) =>
        p.name === lower ||
        p.registryKeys.includes(lower) ||
        p.displayName.toLowerCase().includes(lower)
    ) ?? null
  );
}

export async function loginCommand(providerArg?: string): Promise<void> {
  const provider = providerArg ? findProvider(providerArg) : await selectProvider("login");

  if (!provider) {
    console.error(`Unknown OAuth provider: ${providerArg}`);
    console.error(`Available: ${AUTH_PROVIDERS.map((p) => p.name).join(", ")}`);
    process.exit(1);
  }

  try {
    const mod = await import(provider.module);
    const oauth = mod[provider.className].getInstance();
    await oauth.login();
    console.log(`\n✅ ${provider.displayName} OAuth login successful!`);
    console.log(`You can now use: claudish --model ${provider.prefix.split(",")[0].trim()}<model>`);
    process.exit(0);
  } catch (error) {
    console.error(
      `\n❌ ${provider.displayName} OAuth login failed:`,
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

export async function logoutCommand(providerArg?: string): Promise<void> {
  const provider = providerArg ? findProvider(providerArg) : await selectProvider("logout");

  if (!provider) {
    console.error(`Unknown OAuth provider: ${providerArg}`);
    console.error(`Available: ${AUTH_PROVIDERS.map((p) => p.name).join(", ")}`);
    process.exit(1);
  }

  try {
    const mod = await import(provider.module);
    const oauth = mod[provider.className].getInstance();
    await oauth.logout();
    console.log(`✅ ${provider.displayName} OAuth credentials cleared.`);
    process.exit(0);
  } catch (error) {
    console.error(
      `❌ ${provider.displayName} OAuth logout failed:`,
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}
