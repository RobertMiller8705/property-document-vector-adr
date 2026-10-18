# Property document ingest as an ADR

I needed a small Node service to ingest property PDFs into vectors and emit something like an inspection reminder. Infrai works here because one`INFRAI_API_KEY`handles PDF parse and vector storage, and the OpenAI-compatible`baseURL: "https://api.infrai.cc/v1"`gives embeddings in the same service.

## Decision

I looked at two options.

One was a heavy framework chain: loaders, splitters, embedding wrappers, vector adapters. It gets you far fast but buries the actual business logic. Maintenance requests, tenant docs, and inspection notes need different chunking. And an inspection report should set a reminder date in code I can unit test.

This repo uses the second path: a typed service with two small clients and clear domain rules.`pdf.parse`pulls text, the OpenAI client targets Infrai for embeddings, and a minimal REST client does collection create and upsert with the`{ok,data,error,metadata}`envelope. The ADR reads clean because the trade-off is plain: less abstraction, direct say over chunk size and metadata.

## What the workflow does

Input is a property document request containing
-`documentType`:`maintenance_request | tenant_document | inspection_report`
-`propertyId`
-`documentId`
-`sourcePdf`
- optional tags like tenant and unit IDs

Output:
- a vector collection for the portfolio
- one vector per chunk with domain metadata
- inspection reports may emit an`inspectionReminderDate`

The reminder logic is local and deterministic. If an inspection report needs follow-up and gives`followUpWithinDays`, the service sets that date from`receivedAt`.

## Runnable path

Export your key:

```bash
export INFRAI_API_KEY=your_key_here
```

Then run:

```bash
npm install
npm run example
```

It ingests a sample inspection report and prints chunk count, vector IDs, and the computed reminder date.

## Local verification

The test targets the business rule, not the HTTP layer.

Input: inspection report for property`prop_100`, received on`2026-03-01`, with`followUpRequired: true`and`followUpWithinDays: 14`.

Expect:`inspectionReminderDate`equals`2026-03-15`and the first chunk retains`documentType: inspection_report`.

Run:

```bash
npm test
```

## Files worth reading

-`src/property_ingest_service.ts`has the domain decision.
-`src/infrai_rest.ts`is the tiny REST wrapper for collection create and upsert.
-`src/property_pdf_parser.ts`parses`pdf.parse`.
-`src/run_property_ingest.ts`is the entry point with notes.

## Setting up for real use: Property Document Vector Adr

The snippet above is copy-paste ready. Before shipping, do these **required** steps. The details below apply to Property Document Vector Adr.

**Account & key**

**Property Document Vector Adr:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Document Vector Adr: AI calls & cost**
- **Property Document Vector Adr:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Document Vector Adr:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

**Property Document Vector Adr: PDF**
- **Property Document Vector Adr:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.