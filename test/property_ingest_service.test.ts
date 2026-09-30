import { describe, expect, it } from "vitest";
import { buildPropertyChunks, deriveInspectionReminder, type PropertyDocumentInput } from "../src/property_ingest_service";

describe("property ingest decision", () => {
  it("schedules an inspection reminder and preserves inspection metadata in chunks", () => {
    const input: PropertyDocumentInput = {
      collection: "property-records",
      propertyId: "prop_100",
      documentId: "insp_2026_03_01",
      documentType: "inspection_report",
      sourcePdf: "https://example.com/property/inspection-report.pdf",
      receivedAt: "2026-03-01T00:00:00.000Z",
      title: "March safety inspection",
      followUpRequired: true,
      followUpWithinDays: 14
    };

    const reminderDate = deriveInspectionReminder(input);
    const chunks = buildPropertyChunks(
      input,
      "Front stair rail is loose.\n\nEmergency lighting passed.\n\nFollow-up inspection required within two weeks."
    );

    expect(reminderDate).toBe("2026-03-15");
    expect(chunks[0].metadata.documentType).toBe("inspection_report");
    expect(chunks[0].metadata.inspectionReminderDate).toBe("2026-03-15");
  });
});
