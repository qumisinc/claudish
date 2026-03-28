/**
 * Seed script: writes the initial config/plugin-defaults document to Firestore.
 *
 * Usage (from firebase/functions directory):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   FIREBASE_PROJECT_ID=your-project-id \
 *   npx tsx src/seed-plugin-defaults.ts
 *
 * Or with Application Default Credentials already configured:
 *   FIREBASE_PROJECT_ID=your-project-id npx tsx src/seed-plugin-defaults.ts
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = process.env["FIREBASE_PROJECT_ID"];
if (!projectId) {
  console.error("Error: FIREBASE_PROJECT_ID environment variable is required.");
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();

const INITIAL_DEFAULTS = {
  version: "1.0.0",
  updatedAt: Timestamp.now(),
  updatedBy: "seed-script",

  shortAliases: {
    "grok": "grok-4.20-beta",
    "gemini": "gemini-3.1-pro-preview",
    "gpt": "gpt-5.4",
    "gpt-5": "gpt-5.4",
    "deepseek": "deepseek-v3.2",
    "minimax": "minimax-m2.7",
    "glm": "glm-5-turbo",
    "kimi": "kimi-k2.5",
    "qwen": "qwen3-235b-a22b-2507",
    "mimo": "mimo-v2-pro",
  },

  roles: {
    "fast_coding": { modelId: "grok-code-fast-1", fallback: "minimax-m2.5" },
    "reasoning": { modelId: "gemini", fallback: "glm-5" },
    "reasoning_premium": { modelId: "gpt-5.3-codex" },
    "vision": { modelId: "qwen3.5-plus-02-15" },
    "image_generation": { modelId: "gemini-3.1-flash-image-preview", fallback: "gemini-3-pro-image-preview" },
    "image_generation_fast": { modelId: "gemini-3.1-flash-image-preview" },
    "browser_use_anthropic": { modelId: "claude-sonnet-4-6" },
    "browser_use_bedrock": { modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0" },
    "browser_use_openai": { modelId: "gpt-4o" },
    "coaching_classifier": { modelId: "claude-sonnet-4-20250514" },
    "research_primary": { modelId: "gemini" },
    "designer_review": { modelId: "gemini-3-pro-preview" },
    "free_tier": { modelId: "openrouter/polaris-alpha" },
  },

  teams: {
    "review": ["internal", "grok", "gemini", "gpt", "deepseek", "minimax", "glm", "kimi"],
    "research": ["internal", "gemini", "glm", "mimo"],
    "architecture": ["internal", "gemini", "gpt", "glm"],
    "code": ["internal", "minimax", "grok-code-fast-1", "gemini-3.1-pro-preview", "gpt"],
  },
};

async function seed(): Promise<void> {
  const docRef = db.collection("config").doc("plugin-defaults");
  const existing = await docRef.get();

  if (existing.exists) {
    console.log("Document config/plugin-defaults already exists.");
    console.log("Existing version:", (existing.data() as { version: string }).version);
    console.log("Use --force to overwrite (edit this script to add that flag).");
    process.exit(0);
  }

  await docRef.set(INITIAL_DEFAULTS);
  console.log("Successfully seeded config/plugin-defaults with version", INITIAL_DEFAULTS.version);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
