# SmartERP AI: Revised Implementation Plan

Revision 3 — November 3, 2026. Incorporates the supplied review. This document defines the plan; initial implementation progress and limitations are recorded in `docs/reference-integration.md`. No provider compatibility is implied. This revision supersedes the previous delivery sequence.

## 1. Outcome and boundaries

Build a generic inventory analytics and forecasting platform that reads a business's existing digital records automatically and exposes reliable sales forecasts and appropriately qualified inventory insights.

The central evaluation question is: **How do forecasting methods and input-data quality affect inventory decisions?** Integration reliability supports this question; it must not consume the entire project.

Release one supports one authoritative external connection per business, one default location, unit-count products, read-only imported facts, historical backfill, scheduled updates, source-reported inventory, immutable forecast inputs, and reproducible forecasting/inventory experiments. Genericity comes from common semantics and replaceable adapters, not assumed compatibility with every provider.

Defer write-back, purchase-order execution, dual local/external operating modes, complete stock ledgers, multiple stock authorities, location-level optimization, unit conversion, advanced role hierarchies, new brokers, and additional model families. Keep existing synthetic activity isolated in a demo workspace.

## 2. Early provider feasibility gate

**Complete this assessment before accepting the first versioned canonical contract.** Provider investigation happens first; full adapter implementation happens later. No provider assessment has yet been performed under this plan.

Select one named candidate using legitimate test access or a cooperating business. Consult its current official API documentation and inspect authorized sample responses. Record the following in `docs/provider-capabilities.md`:

| Capability | Evidence and decision required |
| --- | --- |
| Access | Test-account availability, permissions, authentication, limits, and actual accessible endpoints |
| Product identity | Stable product/variant IDs, line IDs, SKU behavior, activity dates, locations |
| Sales target | Ordered versus fulfilled quantities, fulfillment timestamps, partial fulfillment, source statuses |
| Changes | Ordered revisions, updated-since behavior, timestamp precision, correction and deletion discovery |
| History | Accessible retention, pagination stability, backfill boundaries, permission limitations |
| Inventory | On-hand, available, reservations, backorders, timestamps, inbound supply and arrival dates |
| Delivery | Polling support, pagination, rate limits, optional webhook payloads and signature verification |
| Completeness | What successful queries establish; unsupported histories and deletion guarantees |

Label each capability verified, documented-only, unsupported, or unknown, with evidence/date. Do not infer absent inbound supply means zero. If access is blocked, mark real-source validation pending and keep the contract provisional; simulator progress is permitted but unsupported compatibility claims are not.

Use sanitized provider-shaped fixtures in the reference source, with explicit synthetic labels. Retain tests for unsupported capabilities instead of making the simulator unrealistically convenient.

**Gate:** a written capability matrix identifies a feasible initial target and stock-insight scope, or explicitly records the unresolved provider-access dependency.

## 3. Core business semantics

| Concern | Initial rule |
| --- | --- |
| Ownership | Provider owns imported operational facts; SmartERP owns mappings, synchronization history, forecasts, and policy configuration. |
| Identity | Business + connection + entity type + external ID. Never silently merge by name or SKU. |
| Imported writes | Read-only. Local order creation must not mutate imported facts or source-owned stock. |
| Sales target | Gross fulfilled units per product/business-local date when evidence supports it. |
| Alternative target | Ordered-sales or dated transaction-sales datasets use separate explicit target identifiers for experiments/connectors; never invent fulfillment dates or pool incompatible targets in one ranking. |
| Adjustments | Unfulfilled cancellations contribute no fulfillment; a later cancellation does not erase an actual shipment. Refund, physical return, and sellable restock are distinct facts. |
| Time | Preserve UTC event time, source update time, received time, and applied time separately. Aggregate completed days using a versioned IANA timezone. |
| Missing days | Zero only within verified coverage for an active product. Unknown/missing observations remain missing. |
| Availability | Historical stockout evidence is a separate flag. Current stock cannot reconstruct historical availability. Fulfilled sales are observed sales, not uncensored demand. |
| Stock | Store quantity meaning and source time. Do not subtract imported sales from stock snapshots that already include them. |
| Corrections | Revise canonical state and derived data; preserve original forecast inputs and outputs. |
| Demo data | Synthetic records/metrics never enter real-source results. |

A timezone change creates a new aggregation-policy version and rebuilds affected historical dates; old forecast datasets retain their original timezone. A mapping correction removes contributions from the old product/date and adds them to the new product/date, invalidating both scopes. Never rewrite identity silently.

## 4. Inventory insight and policy contract

Separate outputs by required evidence. One unsupported calculation does not hide every other useful insight.

| Output | Minimum inputs and limitations |
| --- | --- |
| Reported stock | Source quantity meaning, value, effective time; display freshness even if forecasting is blocked |
| Forecasted fulfilled sales | Eligible sales dataset and identified target/model; independent of current stock readiness |
| Estimated depletion with no replenishment | Fresh compatible sellable stock and future sales forecasts; explicitly assumes no inbound supply and no unmodeled commitments/returns |
| Periodic-review order suggestion | Complete, compatible stock/supply/commitment inputs, lead time, review interval, safety-stock policy, constraints, and a forecast covering the protection period |

For depletion, accumulate nonnegative daily forecasts until they reach the eligible stock. Report the crossing day; if none occurs, report “beyond forecast horizon,” not an invented unlimited runway. Zero stock is depleted now. Unknown stock blocks this output. A fulfilled-sales projection remains qualified where sales were censored by historical stockouts.

For the optional operational periodic-review policy, freeze these inputs in a versioned policy:

- Lead time `L` and review interval `R` in days; label configured versus observed values.
- On-hand quantity, outstanding inbound quantity, reservations/commitments and backorders, with an explicit non-overlapping accounting convention.
- Inbound arrival dates and whether receipts can arrive before projected shortages.
- Safety stock `SS`, initially a configured number of units, without an unsupported service-level guarantee.
- Pack size and minimum order quantity; default to one/zero only as explicit configuration.

Where accounting supports it, inventory position is `IP = onHand + onOrder - outstandingDemand`, with each reservation/backorder counted once. Available-to-sell is not automatically a substitute for IP. A known accounting bridge is required. For a simple periodic-review policy, `S = sum(forecast over L + R days) + SS`, and the unconstrained suggestion is `max(0, S - IP)`; positive quantities are rounded to supported pack/MOQ rules.

Do not emit an actionable quantity if inbound/commitments are unknown, timing contradicts the simple policy, constraints are unsupported, or forecasts do not cover `L + R`. Instead show the specific missing inputs and the qualified no-replenishment depletion insight where eligible. An explicit known-zero inbound value is different from unavailable inbound data. Store the exact input snapshot, assumptions, formula version, and output status. Purchases remain outside SmartERP.

**Gate:** unknown inbound cannot generate a confident order quantity; a refund alone cannot increase stock; the UI distinguishes depletion assumptions from order suggestions.

## 5. Runtime and incremental data model

Keep React/TypeScript, Express, Prisma/MongoDB, and FastAPI. Use a database-backed ingestion worker initially. A dedicated worker owns schedules; request handlers do not launch persistent schedulers. Verify installed Prisma/MongoDB transaction and conditional-update behavior, and test transactions against a replica-set test database. Current Vercel configuration is not evidence of an always-on worker deployment.

Build only the models required for each slice:

| First slice | Add when the workflow requires it |
| --- | --- |
| Business, authenticated membership, Connection | SyncRun, resource checkpoints, collected-window manifests |
| Product and stable ExternalMapping | Fulfillment corrections, adjustments, location mappings |
| Versioned fulfillment fact | DataIssue, scoped coverage records, reconciliation results |
| InventorySnapshot and read model | Background forecast jobs and Recommendation |
| IngestionRecord with identity/status/lease | Immutable ForecastDataset and dataset dependencies |
| Minimal readiness result | Expanded operational metrics and retention audit |

Reuse existing Product, Order/OrderItem, Inventory, ForecastRun, and Forecast where semantics fit; add business scope and provenance. Introduce Order records only when provider semantics require them, rather than forcing every dated sale into an invented order. ForecastDataset must be implemented before forecasts are introduced.

Apply additive transitions with dry runs, test copies, backup/rollback boundaries, and validated indexes. Keep existing records in a legacy demo business. Do not blindly create compound unique indexes over missing legacy external identifiers. Regenerate types and replace relevant `as any` usage.

## 6. Durable ingestion and executable coverage

Adapters expose capability discovery, connection testing, bounded/paginated fetches, normalization, source-version comparison, and optional webhook verification. A canonical envelope carries source identity, version, operation, event/update/receipt timestamps, schema version, and payload hash. Never compare opaque revision strings lexicographically.

Collection and application are separate:

1. A page is durably collected when its records and page manifest are persisted and its collection checkpoint is committed safely. Replaying a page must be harmless.
2. A window is collected when pagination reaches its declared boundary and every page is durable. A successful empty query is meaningful only under documented source coverage semantics.
3. A window is applied when each collected record has a valid terminal outcome: applied, verified duplicate, or verified older revision. Quarantined/failed/unresolved records are not successful application.
4. Readiness also requires mappings, relevant resource dependencies, active-product intervals, and freshness policy to pass. Apply counts alone cannot prove source completeness.

Coverage is scoped to business/connection/resource/time interval, narrowed to product where evidence permits. An unresolved known-product record blocks that product and affected dates, leaving unrelated products eligible. An unknown internal mapping with a known source product may be narrowed if all relevant products have disjoint stable mappings; otherwise block all possibly affected products for that interval. A record with unknown product/time conservatively blocks the smallest defensible broader window. Record that scope and reason rather than guessing.

Retry with bounded backoff/jitter. Atomic claims use expiring leases and fencing/ownership tokens. Canonical writes, version checks, dirty-scope marking, and applied status must commit consistently. Delivery is at least once; effects must be idempotent. An expired worker cannot overwrite a new owner's work.

Retain/minimize payloads for replay, excluding unnecessary personal/payment data. After expiry, expose `requires_refetch` or `unrecoverable` rather than offering a false retry guarantee. Reconstruction/replay depends on retained normalized facts, immutable datasets, or provider history. ForecastDataset retention is independent of ingestion-payload retention.

## 7. Corrections, immutable inputs, and publication safety

Every forecast references an immutable ForecastDataset containing the exact ordered dates/values, missing/coverage and availability flags, target, cutoff, timezone/version, applied-data generation, extraction time, and transformation version. Store the actual series plus a hash, not a hash alone. Experiments additionally freeze exact test observations and their evaluation version; distinguish as-observed labels from final corrected labels.

Define the correction lifecycle:

1. Commit the canonical correction and mark affected old/new product-date scopes dirty in the same consistency boundary. Immediately mark current insights updating/stale for that scope.
2. Rebuild those aggregates without deleting published historical inputs.
3. Publish a new aggregate/dataset generation after coverage checks; coalesce concurrent corrections safely.
4. Mark dependent current forecasts and recommendations stale, with reason and replacement linkage. A forecast whose training inputs changed differs from one whose evaluation labels changed; update evaluation versions separately.
5. Queue replacement forecasts for active operational products under refresh policy. Recompute stock-only changes without unnecessary retraining.
6. Publish a replacement as current only if dataset generation, policy/timezone version, readiness, and worker ownership still match at commit time. Otherwise retain it as historical/superseded and reschedule.

Track job input dependencies and a current-result pointer separately from immutable runs. Historical forecasts remain valid records of what was predicted at that time. A correction must not erase or retroactively improve them. Display last known result with stale reason and timestamps while replacements run; suppress actionable order quantities when inputs are invalid.

**Gate:** a correction during model execution prevents the old-generation job becoming current. Changing a mapping repairs both products. Original forecast inputs remain reproducible after payload expiry.

## 8. Revised delivery milestones

### Milestone 1 — Baseline and provider feasibility

Fix previously observed backend type errors; verify current frontend/backend checks. Remove fabricated comparison metrics and savings claims; label actual algorithms and unavailable models honestly. Isolate destructive/synthetic tooling and pin reproducible dependencies. Perform the provider assessment in section 2.

Keep changes small: define read-only query behavior now, but move full forecast-job infrastructure to the milestone that first generates forecasts.

**Acceptance:** honest UI/error states, passing baseline checks, provider capability evidence, and no destructive demo access to integrated data.

### Milestone 2 — Minimal contracts and schema

Implement only the source identity, ownership, authentication/business scope, one product, dated sales/fulfillment, stock snapshot, and ingestion models needed for the slice. Preserve explicit target compatibility and stock semantics. Use provider evidence to validate contracts through versioned contract acceptance.

**Acceptance:** schema validation passes, IDs are unique, source-owned writes are rejected, and authorization tests prevent cross-business access.

### Milestone 3 — First visible end-to-end slice

Run a separate HTTP reference source with persisted fixtures. Build the minimal adapter and worker: one product, one fulfillment, one snapshot through durable ingestion into canonical records and a visible readiness/status view. Include minimal duplicate protection immediately; do not postpone basic correctness.

**Acceptance:** no manual upload, no extra stock deduction, source identifiers/times visible, and an unresolved mapping produces an explicit incomplete state. This milestone precedes the full destination schema and polished dashboard.

### Milestone 4 — Recovery and corrections

Exercise repeated delivery, ordered revisions, ambiguous equal timestamps, mapping corrections, partial fulfillment/cancellation, worker crashes, and lease expiry. Re-fetch ambiguous source state rather than choosing arrival order. Implement dirty-scope lifecycle and scoped coverage. Full forecast publication races are tested when forecasting exists.

**Acceptance:** restart/replay matches uninterrupted state; old versions do not regress data; refund without restock does not add stock; unrelated eligible products remain usable.

### Milestone 5 — Backfill, incremental synchronization, reconciliation

Add resource-specific runs/manifests/checkpoints. Capture a backfill boundary, collect concurrent changes, and replay an overlap window to close races. Reconcile identities, revisions, quantities, and bounded totals; counts alone are insufficient. Do not infer deletion from a missing page entry. Publish retention/deletion blind spots and schedule broader scans where supported.

Start with configurable polling (provisional 30 minutes), daily reconciliation, explicit throttling/credential failure, and durable retries. Add webhooks only when they provide value; verify raw-body signatures and persist before acknowledgment.

CSV/Excel becomes a file adapter with the same rules. Stable IDs enable corrections. Legacy files without IDs have explicit append-only onboarding semantics and overlap review; identical-file detection is not general transaction deduplication.

**Acceptance:** partial failures cannot mark all data current; changes during backfill are recovered; old corrections are found within declared capabilities.

### Milestone 6 — Immutable forecasts and qualified inventory insights

Implement ForecastDataset, deduplicated jobs, read-only result GETs, and scheduled/manual generation. Introduce seasonal-naive and moving-average baselines before expanding models. Remove backward-filled lag leakage; fit transformations only on training data.

Use a genuine 30-day out-of-sample horizon and rolling origins. Recursive models cannot use holdout actuals as future inputs; direct/native multi-step models may use their appropriate method under the same information cutoff. Label one-step experiments separately. Report MAE/RMSE and scale-normalized metrics with explicit undefined cases; report fitting and prediction time separately.

An initial operational policy may require 60 consecutive complete days within a 90-day lookback. This is configurable and not sufficient evidence for every model or a universal experimental eligibility rule. Baselines, all-zero series, and intermittent products require explicit behavior. Persist missing-input/model failures rather than generating a fixed five-unit forecast.

Implement section 4 outputs according to actual source capabilities. Finalize Connections, Sync History, mapping review, forecast provenance, and readiness UI. Queue jobs through POST; GET reads stored state only.

**Acceptance:** holdout changes do not affect earlier-origin predictions; corrected inputs invalidate reuse; immutable inputs survive corrections; stale stock blocks only dependent insights; stale jobs cannot publish as current.

### Milestone 7 — Real adapter and operational verification

Implement the provider already investigated using the shared contract. Recheck current official documentation, permissions, and actual accessible data. Keep provider-specific auth/version/rate-limit logic inside its adapter. Verify setup, historical import, automatic updates, correction recovery, stock semantics, and disconnect/reconnect behavior against a legitimate account.

**Acceptance:** demonstrated end-to-end real-provider workflow with documented limitations. If unavailable, mark this milestone pending and describe results as reference integration only.

### Milestone 8 — Required forecasting and inventory evaluation

Freeze experiment configurations, seeds, dataset inputs/test labels, and software versions. Compare complete data against controlled missing, delayed, duplicate, reordered, and corrected records. Measure correctness, lag/recovery, forecast error, and downstream inventory outcomes on matching origins.

A small inventory simulator is mandatory. Compare at least a fixed reorder policy, a seasonal-naive forecast-driven policy, and one additional forecast-driven policy using the same replenishment formula/constraints for the two forecast methods. Use fixed lead time, daily review, explicit starting stock/pipeline, and a declared lost-sales or backlog convention. The simulator owns complete demand and stock states, including demand hidden by stockouts. Report unit fill rate, average on-hand stock, stockout days, and order frequency across products/seeds; monetary costs only if assumptions are explicit. Avoid comparing policies with different undisclosed safety buffers.

Report synthetic demand/policy results as simulation. Fulfilled-sales datasets do not reveal lost demand; any simulated demand reconstruction is an assumption. Evaluate real historical sales separately when appropriately licensed data is available; preserve target labels and do not claim real-world service improvements from simulated experiments. Separate model selection and final test periods, include negative results, and state uncertainty/variation.

**Acceptance:** a documented command reproduces result tables/plots and exact inputs, including a test showing later corrections do not leak into an as-observed forecast origin.

## 9. Security, operations, and deployment

Use adapter-specific allowlisted destinations. User-configurable HTTP connections must not reach private/link-local/metadata networks in deployed environments; validate destinations and redirects, handle DNS changes, and enforce outbound network restrictions. Permit the local reference service only in a controlled development profile. Encrypt secrets, rotate/revoke them, redact logs, authenticate mutations, and derive business scope server-side.

Show per-resource last collection/application time, coverage, source time, oldest queued record age, processing lag, retries, unresolved issues, and reconciliation discrepancies. Redact payloads in diagnostics. Define whether retries are possible after retention expiry.

Deploy API, worker, ML, and database with documented responsibilities. Test worker restarts, duplicate scheduler ownership, expired leases, and graceful shutdown separately from UI build checks. Add CI for meaningful unit, adapter contract, replica-set integration, ML evaluation, and a small browser workflow suite.

## 10. File map and completion evidence

| Area | Change |
| --- | --- |
| `backend/prisma/schema.prisma` | Incremental models, source identity, business scope, immutable datasets, dependencies |
| `backend/src/integrations/` | Contracts, provider/reference/file adapters, capability validation |
| `backend/src/services/sync/` and `workers/` | Collection, application, leases, correction lifecycle, reconciliation |
| `backend/src/middleware/` | Authentication, business ownership, destination restrictions, typed errors |
| Existing order/import/inventory services | Separate imported application from local stock mutation; snapshot-backed reads |
| Forecast/aggregation/readiness/policy services | Coverage, immutable input generation, publication checks, qualified calculations |
| Frontend API/components | Early visible slice, then connection/issues/jobs/provenance/readiness workflows |
| `ml-service/` | Honest model registry, causal preprocessing, baselines, appropriate multi-step evaluation |
| `reference-source/` | Provider-shaped synthetic fixtures and controlled faults |
| `experiments/` | Frozen inputs, inventory simulator, configs, metrics and report artifacts |
| `docs/` | Capability evidence, contracts, policy specification, transitions, retention and operating instructions |

Required regression cases include: duplicate effects, out-of-order updates, crash at commit/checkpoint boundaries, stale worker/job rejection, old/new mapping contributions, unknown-product coverage, timezone/DST changes, retention-expired retry, unknown inbound supply, partial fulfillments/refunds, missing versus zero sales, cross-business isolation, ML unavailability, and immutable input replay.

Completion is tracked separately: reference automation, demonstrated real-provider integration, and forecasting/inventory evidence. The first coding package is baseline cleanup and a provider feasibility dossier, followed immediately by the minimal visible ingestion slice. Schema growth and infrastructure follow observed needs. No university admission outcome is implied.

## Accepted experiment clarifications

Operational experiments preserve readiness rules and measure availability, blocked/stale duration and recovery. Separate robustness experiments use explicitly labeled imputation treatments and report error against complete-data results; they never relax operational readiness.

Materialize each experimental origin with its exact as-observed record values and revision identities. Later timestamps alone cannot reconstruct overwritten values. Freeze evaluation labels separately.

The inventory evaluator owns latent demand; policies see only past fulfilled sales and explicitly enabled availability flags. Future demand is never a policy input. Initially refresh forecasts at each daily review from available observations; report frozen-origin experiments separately.

Initial simulator accounting: positive integer lead time (zero unsupported); daily receipts → demand → fulfillment/lost-sales recording → review → order placement. Orders placed on day d arrive at the start of day d+L. Use a declared warm-up excluded from scoring; freeze policy settings before final test. A stockout day has positive unserved demand. Unit fill rate is total served units / total demand, and is undefined for zero-demand periods. At test end report outstanding pipeline separately without pretending it was received; initial experiments use lost sales, no backlog.

Keep the first suite small: one cohort, two baselines, one additional implemented method, and the specified inventory policies. Provider sample retrieval happens early when authorized access exists. Access is currently unavailable; documented-only assessment and the versioned reference contract can proceed without claiming real-provider verification.
