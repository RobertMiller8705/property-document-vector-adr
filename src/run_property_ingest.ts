import { ingestPropertyDocument } from "./property_ingest_service";

async function main() {
  const sampleRequest = {
    collection: "property-records",
    propertyId: "prop_100",
    documentId: "insp_2026_03_01",
    documentType: "inspection_report",
    sourcePdf: "https://example.com/property/inspection-report.pdf",
    receivedAt: "2026-03-01T00:00:00.000Z",
    unitId: "unit_3b",
    title: "March safety inspection",
    followUpRequired: true,
    followUpWithinDays: 14
  };

  const result = await ingestPropertyDocument(sampleRequest);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
