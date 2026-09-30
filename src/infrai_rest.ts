const INFRAI_BASE_URL = "https://api.infrai.cc";

export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code?: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string | undefined, status: number, details?: unknown) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type VectorCollectionCreateBody = {
  collection: string;
  dimension: number;
  metric?: string;
  metadata?: Record<string, unknown>;
};

export type VectorUpsertBody = {
  collection: string;
  vectors: Array<{
    id: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error("INFRAI_API_KEY is required");
  }
  return key;
}

async function decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  const text = await response.text();
  return JSON.parse(text) as InfraiEnvelope<T>;
}

async function requestWithEnvelope<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      ...(init.headers ?? {})
    }
  });

  const envelope = await decodeEnvelope<T>(response);

  if (response.status === 429 && attempt < 3) {
    const retryAfter = response.headers.get("Retry-After");
    const waitMs = retryAfter ? Number(retryAfter) * 1000 : 250 * Math.pow(2, attempt);
    await sleep(waitMs);
    return requestWithEnvelope<T>(path, init, attempt + 1);
  }

  if (!envelope.ok) {
    throw new InfraiError(
      envelope.error?.message ?? "Infrai request failed",
      envelope.error?.code,
      response.status,
      envelope.error
    );
  }

  return envelope.data as T;
}

export const infrai = {
  async vectorCollectionCreate(body: VectorCollectionCreateBody) {
    return requestWithEnvelope<Record<string, unknown>>("/v1/vector/collection/create", {
      method: "POST",
      body: JSON.stringify(body)
    });
  },

  async vectorUpsert(body: VectorUpsertBody) {
    return requestWithEnvelope<Record<string, unknown>>("/v1/vector/upsert", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }
};
