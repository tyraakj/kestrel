import { z } from "zod";
import dotenv from "dotenv";
import { KestrelError } from "./types.js";

// Load environment variables from .env if present
dotenv.config();

export const appConfigSchema = z.object({
  THE_GRAPH_API_KEY: z
    .string({
      required_error:
        "THE_GRAPH_API_KEY is required for live Subgraph Studio access. Please set it in your environment or .env file.",
    })
    .min(1, "THE_GRAPH_API_KEY cannot be empty"),
  ETH_RPC_URL: z.string().url("ETH_RPC_URL must be a valid URL").default("http://127.0.0.1:8545"),
  BASE_RPC_URL: z
    .string()
    .url("BASE_RPC_URL must be a valid URL")
    .default("https://mainnet.base.org"),
  X402_MODE: z.enum(["SIMULATED", "LIVE"]).default("SIMULATED"),
  LEDGER_TRANSPORT_MODE: z.enum(["USB", "VIRTUAL"]).default("VIRTUAL"),
  ANVIL_BIN_PATH: z.string().min(1).default("anvil"),
  DAILY_SPEND_LIMIT_USD: z.preprocess(
    (val) => (val === undefined || val === null || val === "" ? undefined : Number(val)),
    z
      .number({
        required_error:
          "DAILY_SPEND_LIMIT_USD is strictly required. No default spend leash is permitted; you must explicitly declare your autonomous daily spend ceiling (e.g. DAILY_SPEND_LIMIT_USD=10.00).",
        invalid_type_error: "DAILY_SPEND_LIMIT_USD must be a positive number",
      })
      .positive("DAILY_SPEND_LIMIT_USD must be greater than zero")
  ),
  TRANSACTION_FRESHNESS_TTL_SECONDS: z.preprocess(
    (val) => (val === undefined || val === null || val === "" ? 120 : Number(val)),
    z.number().positive("TRANSACTION_FRESHNESS_TTL_SECONDS must be a positive number").default(120)
  ),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = appConfigSchema.safeParse(env);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => {
      const field = err.path.join(".");
      return `  - [${field}]: ${err.message}`;
    });

    const formattedMessage = [
      "Configuration validation failed with the following errors:",
      ...errorDetails,
      "",
      "Kestrel halted startup to prevent unsafe or unconfigured autonomous execution.",
    ].join("\n");

    throw new KestrelError("CONFIG_VALIDATION_FAILED", formattedMessage, {
      errors: result.error.format(),
    });
  }

  return result.data;
}
