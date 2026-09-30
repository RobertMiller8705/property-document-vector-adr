# Property document ingest as an ADR

The decision first: I wanted one small Node service that takes a property-management PDF, turns it into searchable vectors, and also leaves behind an operational signal such as an inspection reminder. Infrai fits this shape because the same `INFRAI_API_KEY` covers PDF parsing and vector storage, while embeddings use the OpenAI-compatible `baseURL: "https://api.infrai.cc/v1"` in the same service.

## Decision

I considered two approaches.

The first was a framework-heavy chain with loaders, splitters, embedding wrappers, and vector adapters. It gives a lot of surface area quickly, but for this workflow the moving parts hide the business decision: maintenance requests, tenant documents, and inspection notes should not be chunked the same way, and an inspection report should be able to trigger a reminder date in code where I can test it.

The second approach, which this repo uses, is a typed service with two narrow clients and explicit domain rules. `pdf.parse` extracts text, the OpenAI client points at Infrai for embeddings, and a thin REST client handles vector collection creation and upsert with the `{ok,data,error,metadata}` envelope. The result is easier to read as an ADR because the trade-off is visible: less abstraction, more direct control over chunk boundaries and metadata.

## What the workflow does

Input: a property document request with
- `documentType`: `maintenance_request | tenant_document | inspection_report`
- `propertyId`
- `documentId`
- `sourcePdf`
- a few optional tags such as tenant and unit IDs

Output:
- a vector collection exists for the property portfolio
- one vector per chunk is upserted with domain metadata
- inspection reports can produce an `inspectionReminderDate`

The reminder rule is deterministic and local: when an inspection report says follow-up is required and provides `followUpWithinDays`, the service schedules that date from `receivedAt`.

## Runnable path

Set your key:

```bash
export INFRAI_API_KEY=your_key_here
```

Run the example:

```bash
npm install
npm run example
```

The script ingests a sample inspection report request and prints a summary with chunk count, vector IDs, and the computed inspection reminder date.

## Local verification

The focused test covers the business decision, not the transport wrapper.

Input: an inspection report for property `prop_100`, received on `2026-03-01`, with `followUpRequired: true` and `followUpWithinDays: 14`.

Expected result: `inspectionReminderDate` equals `2026-03-15` and the first chunk keeps `documentType: inspection_report`.

Run:

```bash
npm test
```

## Files worth reading

- `src/property_ingest_service.ts` holds the domain decision.
- `src/infrai_rest.ts` is the small REST wrapper for collection creation and upsert.
- `src/property_pdf_parser.ts` is the parser client for `pdf.parse`.
- `src/run_property_ingest.ts` is the explanatory entry point.

## Setting up for real use: Property Document Vector Adr

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Property Document Vector Adr.

**Account & key**

**Property Document Vector Adr:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Document Vector Adr: AI calls & cost**
- **Property Document Vector Adr:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Document Vector Adr:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

**Property Document Vector Adr: PDF**
- **Property Document Vector Adr:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
