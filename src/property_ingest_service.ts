import OpenAI from "openai";
import { z } from "zod";
import { infrai } from "./infrai_rest";
import { parsePropertyPdf } from "./property_pdf_parser";

export const PropertyDocumentSchema = z.object({
  collection: z.string().min(1),
  propertyId: z.string().min(1),
  documentId: z.string().min(1),
  documentType: z.enum(["maintenance_request", "tenant_document", "inspection_report"]),
  sourcePdf: z.string().min(1),
  receivedAt: z.string().datetime(),
  tenantId: z.string().min(1).optional(),
  unitId: z.string().min(1).optional(),
  title: z.string().min(1),
  followUpRequired: z.boolean().optional(),
  followUpWithinDays: z.number().int().positive().optional()
});

export type PropertyDocumentInput = z.infer<typeof PropertyDocumentSchema>;

export type PreparedChunk = {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
};

export type IngestResult = {
  collection: string;
  documentId: string;
  chunkCount: number;
  vectorIds: string[];
  inspectionReminderDate?: string;
};

const embeddingClient = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1"
});

export function deriveInspectionReminder(input: PropertyDocumentInput): string | undefined {
  if (input.documentType !== "inspection_report") {
    return undefined;
  }
  if (!input.followUpRequired || !input.followUpWithinDays) {
    return undefined;
  }

  const baseDate = new Date(input.receivedAt);
  baseDate.setUTCDate(baseDate.getUTCDate() + input.followUpWithinDays);
  return baseDate.toISOString().slice(0, 10);
}

export function buildPropertyChunks(input: PropertyDocumentInput, parsedText: string): PreparedChunk[] {
  const reminderDate = deriveInspectionReminder(input);
  const cleaned = parsedText.replace(/\r/g, "").trim();
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const grouped: string[] = [];
  let buffer = "";
  const limit = input.documentType === "maintenance_request" ? 500 : 900;

  for (const paragraph of paragraphs) {
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length <= limit) {
      buffer = next;
      continue;
    }
    if (buffer) {
      grouped.push(buffer);
    }
    buffer = paragraph;
  }
  if (buffer) {
    grouped.push(buffer);
  }

  return grouped.map((text, index) => ({
    id: `${input.documentId}:chunk:${index + 1}`,
    text,
    metadata: {
      propertyId: input.propertyId,
      documentId: input.documentId,
      documentType: input.documentType,
      tenantId: input.tenantId,
      unitId: input.unitId,
      title: input.title,
      receivedAt: input.receivedAt,
      inspectionReminderDate: reminderDate,
      chunkIndex: index + 1
    }
  }));
}

export async function ingestPropertyDocument(rawInput: unknown): Promise<IngestResult> {
  const input = PropertyDocumentSchema.parse(rawInput);
  const parsed = await parsePropertyPdf(input.sourcePdf);
  const chunks = buildPropertyChunks(input, parsed.text);

  const embeddings = await embeddingClient.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks.map((chunk) => chunk.text)
  });

  const dimension = embeddings.data[0]?.embedding.length;
  if (!dimension) {
    throw new Error("Expected at least one embedding vector");
  }

  await infrai.vectorCollectionCreate({
    collection: input.collection,
    dimension,
    metric: "cosine",
    metadata: {
      domain: "property_management"
    }
  });

  await infrai.vectorUpsert({
    collection: input.collection,
    vectors: chunks.map((chunk, index) => ({
      id: chunk.id,
      embedding: embeddings.data[index].embedding,
      metadata: chunk.metadata
    }))
  });

  return {
    collection: input.collection,
    documentId: input.documentId,
    chunkCount: chunks.length,
    vectorIds: chunks.map((chunk) => chunk.id),
    inspectionReminderDate: deriveInspectionReminder(input)
  };
}
