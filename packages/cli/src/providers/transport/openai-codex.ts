/**
 * OpenAI Codex ProviderTransport
 *
 * Extends OpenAI transport with OAuth token support for ChatGPT Plus/Pro subscriptions.
 *
 * On each request, checks for OAuth credentials (~/.claudish/codex-oauth.json).
 * If found, uses the OAuth access_token + ChatGPT-Account-ID header.
 * Falls back to API key (OPENAI_CODEX_API_KEY) if no OAuth credentials.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { log } from "../../logger.js";
import { OpenAIProviderTransport } from "./openai.js";

function buildOAuthHeaders(token: string, accountId?: string): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (accountId) {
    headers["ChatGPT-Account-ID"] = accountId;
  }
  return headers;
}

export class OpenAICodexTransport extends OpenAIProviderTransport {
  override async getHeaders(): Promise<Record<string, string>> {
    const oauthHeaders = await this.tryOAuthHeaders();
    if (oauthHeaders) return oauthHeaders;

    // Fall back to API key auth
    return super.getHeaders();
  }

  /**
   * Attempt to load OAuth credentials and return headers.
   * Returns null if no valid OAuth credentials are available.
   */
  private async tryOAuthHeaders(): Promise<Record<string, string> | null> {
    const credPath = join(homedir(), ".claudish", "codex-oauth.json");
    if (!existsSync(credPath)) return null;

    try {
      const creds = JSON.parse(readFileSync(credPath, "utf-8"));
      if (!creds.access_token || !creds.refresh_token) return null;

      // Check if token needs refresh
      const buffer = 5 * 60 * 1000;
      if (creds.expires_at && Date.now() > creds.expires_at - buffer) {
        const { CodexOAuth } = await import("../../auth/codex-oauth.js");
        const oauth = CodexOAuth.getInstance();
        const token = await oauth.getAccessToken();
        log("[OpenAI Codex] Using refreshed OAuth token");
        return buildOAuthHeaders(token, oauth.getAccountId());
      }

      // Token still valid
      log("[OpenAI Codex] Using OAuth token (subscription)");
      return buildOAuthHeaders(creds.access_token, creds.account_id);
    } catch (e) {
      log(`[OpenAI Codex] OAuth credential read failed: ${e}, falling back to API key`);
      return null;
    }
  }
}
