import { defineSecret } from "firebase-functions/params";
import { BaseCollector } from "../base-collector.js";
import type { CollectorResult, RawModel } from "../../schema.js";

const XAI_API_KEY = defineSecret("XAI_API_KEY");

interface XAIModel {
  id: string;
  created: number;
  owned_by: string;
  input_modalities?: string[];
  output_modalities?: string[];
  prompt_text_token_price?: number;      // nano-dollars per token
  cached_prompt_text_token_price?: number;
  completion_text_token_price?: number;   // nano-dollars per token
  aliases?: string[];
}

interface XAIListResponse {
  models: XAIModel[];
}

export class XAICollector extends BaseCollector {
  readonly collectorId = "xai-api";

  async collect(): Promise<CollectorResult> {
    const models: RawModel[] = [];

    try {
      const resp = await fetch("https://api.x.ai/v1/language-models", {
        headers: {
          Authorization: `Bearer ${XAI_API_KEY.value()}`,
          Accept: "application/json",
        },
      });

      if (!resp.ok) {
        throw new Error(`xAI API ${resp.status}: ${await resp.text()}`);
      }

      const data = await resp.json() as XAIListResponse;

      for (const m of data.models ?? []) {
        // Convert xAI price units to USD per million tokens.
        // xAI API returns prices in units where value / 10000 = USD per 1M tokens.
        // e.g. 20000 → $2.00/1M, 60000 → $6.00/1M, 2000 → $0.20/1M
        const inputPrice = m.prompt_text_token_price != null
          ? m.prompt_text_token_price / 10000
          : undefined;
        const outputPrice = m.completion_text_token_price != null
          ? m.completion_text_token_price / 10000
          : undefined;
        const cachedRead = m.cached_prompt_text_token_price != null
          ? m.cached_prompt_text_token_price / 10000
          : undefined;

        const releaseDate = m.created
          ? new Date(m.created * 1000).toISOString().split("T")[0]
          : undefined;

        const hasVision = m.input_modalities?.includes("image") ?? false;
        const isReasoning = m.id.includes("reasoning") || m.id.includes("thinking");

        // Resolve canonical ID to match OpenRouter convention (the ecosystem standard).
        // xAI API uses versioned IDs like "grok-4-1-fast-reasoning" with aliases.
        // OpenRouter uses dot-notation: "grok-4.1-fast", "grok-4.20".
        // Strategy: find the alias that matches OpenRouter, or convert to dot-notation.
        const cleanAliases = m.aliases
          ?.filter(a => !a.includes("beta") && !a.includes("experimental") && !a.includes("latest"));
        // Prefer alias that already has dot-notation version (e.g. "grok-4.20")
        const dotAlias = cleanAliases?.find(a => /\d\.\d/.test(a));
        const shortestAlias = cleanAliases?.sort((a, b) => a.length - b.length)[0];
        let canonicalId = dotAlias ?? shortestAlias ?? m.id;
        // If no dot alias found, convert "grok-N-M" pattern to "grok-N.M" to match OpenRouter
        // e.g. "grok-4-1-fast" → "grok-4.1-fast"
        if (!dotAlias && canonicalId.startsWith("grok-")) {
          canonicalId = canonicalId.replace(/^(grok-)(\d+)-(\d+)/, "$1$2.$3");
        }

        models.push({
          collectorId: this.collectorId,
          confidence: "api_official",
          sourceUrl: "https://api.x.ai/v1/language-models",
          externalId: m.id,
          canonicalId,
          displayName: canonicalId,
          provider: "x-ai",
          pricing:
            inputPrice !== undefined && outputPrice !== undefined
              ? {
                  input: inputPrice,
                  output: outputPrice,
                  ...(cachedRead !== undefined ? { cachedRead } : {}),
                }
              : undefined,
          releaseDate,
          aliases: m.aliases,
          capabilities: {
            vision: hasVision,
            tools: true,  // all xAI chat models support function calling
            streaming: true,
            thinking: isReasoning,
            jsonMode: true,
            structuredOutput: true,
            batchApi: false,
            citations: false,
            codeExecution: false,
            pdfInput: false,
            fineTuning: false,
          },
          status: "active",
        });
      }

      return this.makeResult(models);
    } catch (err) {
      return this.makeResult([], String(err));
    }
  }
}
