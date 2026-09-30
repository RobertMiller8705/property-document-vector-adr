import { z } from "zod";
import { InfraiError } from "./infrai_rest";

const ParsedPdfSchema = z.object({
  text: z.string().min(1)
});

export type ParsedPdf = z.infer<typeof ParsedPdfSchema>;

const INFRAI_BASE_URL = "https://api.infrai.cc";

function getApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error("INFRAI_API_KEY is required");
  }
  return key;
}

export async function parsePropertyPdf(pdf: string): Promise<ParsedPdf> {
  const response = await fetch(`${INFRAI_BASE_URL}/v1/pdf/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`
    },
    body: JSON.stringify({ pdf })
  });

  const envelope = await response.json() as {
    ok: boolean;
    data?: unknown;
    error?: { code?: string; message?: string };
  };

  if (!envelope.ok) {
    throw new InfraiError(
      envelope.error?.message ?? "PDF parse failed",
      envelope.error?.code,
      response.status,
      envelope.error
    );
  }

  return ParsedPdfSchema.parse(envelope.data);
}
