/**
 * GLM (Zhipu AI) Model Adapter
 *
 * Handles GLM-specific quirks:
 * - Context window sizes per model variant
 * - Strips unsupported thinking params (GLM doesn't support explicit thinking API)
 * - Vision support detection
 */

import { BaseModelAdapter, AdapterResult } from "./base-adapter";
import { log } from "../logger";

/** GLM model context windows */
const GLM_CONTEXT_WINDOWS: Record<string, number> = {
  "glm-5": 128_000,
  "glm-4-plus": 128_000,
  "glm-4-long": 1_000_000,
  "glm-4-flash": 128_000,
  "glm-4": 128_000,
  "glm-3-turbo": 128_000,
};

/** GLM models that support vision */
const GLM_VISION_MODELS = ["glm-4v", "glm-4v-plus", "glm-5"];

export class GLMAdapter extends BaseModelAdapter {
  processTextContent(textContent: string, accumulatedText: string): AdapterResult {
    return {
      cleanedText: textContent,
      extractedToolCalls: [],
      wasTransformed: false,
    };
  }

  override prepareRequest(request: any, originalRequest: any): any {
    // GLM doesn't support thinking params via API
    if (originalRequest.thinking) {
      log(`[GLMAdapter] Stripping thinking object (not supported by GLM API)`);
      delete request.thinking;
    }

    return request;
  }

  shouldHandle(modelId: string): boolean {
    return modelId.includes("glm-") || modelId.includes("zhipu/");
  }

  getName(): string {
    return "GLMAdapter";
  }

  getContextWindow(): number {
    const lower = this.modelId.toLowerCase();
    for (const [pattern, size] of Object.entries(GLM_CONTEXT_WINDOWS)) {
      if (lower.includes(pattern)) return size;
    }
    return 128_000;
  }

  supportsVision(): boolean {
    const lower = this.modelId.toLowerCase();
    return GLM_VISION_MODELS.some((m) => lower.includes(m));
  }
}
