import StellarSdk from "@stellar/stellar-sdk";

export type HorizonSelectionStrategy = "priority" | "round_robin";

export interface FeePayerAccount {
  secret: string;
  publicKey: string;
  keypair: any;
}

export interface Config {
  feePayerAccounts: FeePayerAccount[];
  baseFee: number;
  feeMultiplier: number;
  networkPassphrase: string;
  horizonUrl?: string;
  horizonUrls: string[];
  horizonSelectionStrategy: HorizonSelectionStrategy;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  allowedOrigins: string[];
}

function parseCommaSeparatedList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadConfig(): Config {
  const rawSecrets = process.env.FLUID_FEE_PAYER_SECRET;
  if (!rawSecrets) {
    throw new Error("FLUID_FEE_PAYER_SECRET environment variable is required");
  }

  const secrets = parseCommaSeparatedList(rawSecrets);
  if (secrets.length === 0) {
    throw new Error("FLUID_FEE_PAYER_SECRET must contain at least one secret");
  }

  const feePayerAccounts: FeePayerAccount[] = secrets.map((secret) => {
    const keypair = StellarSdk.Keypair.fromSecret(secret);
    return {
      secret,
      publicKey: keypair.publicKey(),
      keypair,
    };
  });

  const baseFee = parseInt(process.env.FLUID_BASE_FEE || "100", 10);
  const feeMultiplier = parseFloat(process.env.FLUID_FEE_MULTIPLIER || "2.0");
  const networkPassphrase =
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    "Test SDF Network ; September 2015";
  const configuredHorizonUrls = parseCommaSeparatedList(
    process.env.STELLAR_HORIZON_URLS
  );
  const legacyHorizonUrl = process.env.STELLAR_HORIZON_URL?.trim();
  const horizonUrls =
    configuredHorizonUrls.length > 0
      ? configuredHorizonUrls
      : legacyHorizonUrl
        ? [legacyHorizonUrl]
        : [];
  const horizonSelectionStrategy =
    process.env.FLUID_HORIZON_SELECTION === "round_robin"
      ? "round_robin"
      : "priority";
  const rateLimitWindowMs = parseInt(
    process.env.FLUID_RATE_LIMIT_WINDOW_MS || "60000",
    10
  );
  const rateLimitMax = parseInt(process.env.FLUID_RATE_LIMIT_MAX || "5", 10);
  const allowedOrigins = parseCommaSeparatedList(process.env.FLUID_ALLOWED_ORIGINS);

  return {
    feePayerAccounts,
    baseFee,
    feeMultiplier,
    networkPassphrase,
    horizonUrl: horizonUrls[0],
    horizonUrls,
    horizonSelectionStrategy,
    rateLimitWindowMs,
    rateLimitMax,
    allowedOrigins,
  };
}

let rrIndex = 0;

export function pickFeePayerAccount(config: Config): FeePayerAccount {
  const accounts = config.feePayerAccounts;
  const account = accounts[rrIndex % accounts.length];
  rrIndex = (rrIndex + 1) % accounts.length;
  return account;
}
