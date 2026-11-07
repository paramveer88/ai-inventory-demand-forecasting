# SmartERP AI — Forecasting and Inventory Evaluation Implementation Plan

**Status:** Deliveries A/B first checkpoint implemented; final evaluation remains locked. See `experiments/reports/CHECKPOINT_AB.md`.  
**Prepared:** November 7, 2026.  
**Scope:** Research-quality forecasting, inventory simulation, controlled data-quality experiments, and inspection of recorded results inside the existing application.

This is the detailed follow-on plan to `IMPLEMENTATION_PLAN.md`. It changes the priority of the remaining work: first establish a reproducible benchmark and inventory evidence, then extend recovery experiments and complete real-provider validation when authorized access exists. It does not claim the earlier integration milestones are all complete.

The implementation starts as an offline CLI with isolated local artifacts. Existing application UI and business databases are outside deliveries A/B.

## 1. Objective and constraints

Investigate:

> How do forecasting methods and imperfect input data affect replenishment outcomes under explicitly defined inventory policies?

The initial study uses one real dataset, a small fixed product cohort, three forecasting methods, three inventory policies, and a bounded set of data-quality scenarios. Results may favor simple baselines; no improvement percentage or preferred winner is assumed.

### Application experience

- Preserve the original landing animation, dashboard, Products, Vendors, Inventory, Orders, Forecasting Lab, Connections, and existing navigation.
- Keep `bash start.sh` as normal application startup.
- Extend Forecasting Lab with an explicit research-data context and saved evaluation results.
- Add an explicitly labeled simulation view within Inventory.
- Do not replace live stock, product records, or operational forecasts with benchmark data.
- Experiments run only after an explicit request; opening a dashboard must not launch a benchmark.
- Keep the first research workflow local. Reuse the existing local workspace context; do not introduce another entry screen or require a new login to open the normal application.

### Out of scope

New model families beyond the initial three, a new message broker, accounting/CRM, purchasing execution, multiple providers, optimization across warehouses, and claims of real-business savings from simulated results.

## 2. Current implementation and gaps

| Existing component | Current behavior | Required evolution |
| --- | --- | --- |
| `ml-service/models.py` | 80/20 chronological split; tree and LSTM validation use preceding actual validation observations | Explicit cutoff-based 30-day evaluation, reusable model interface, separate evaluation protocol |
| `ml-service/app.py` | Validates daily inputs and exposes immediate forecast/comparison calls | Preserve compatibility initially; add shared functions usable by CLI and later background jobs |
| `backend/src/services/inventory.service.ts` | Roughly 60-day lookback, zero filling, time-only forecast reuse, rule-based stock recommendations | Do not use these behaviors as the research protocol; later consume validated, versioned inputs/results |
| Existing ForecastRun/Forecast models | Store predictions and limited run metadata | Exact dataset snapshots, predictions, evaluation labels, configuration, timing, status and provenance |
| Forecast Lab and Dashboard | Request computation while fetching data | Add explicit experiment execution and read saved results; stage the migration of existing operational reads separately |
| Reference ingestion | Durable inbox, source revisions and synthetic stock; no certified historical coverage | Add only the scoped coverage/replay behavior required for operational quality experiments |
| Existing tests | Input validation and ingestion correctness checks | Forecast cutoff invariants, evaluation arithmetic, immutable replay and inventory accounting |

Do not relabel current holdout metrics as 30-day benchmark results. Do not claim reconciliation effectiveness before implementing a defined reconciliation mechanism.

## 3. Dataset and target specification

### Proposed dataset

Use UCI Online Retail II as the first candidate: a real transaction dataset covering December 2009–December 2011. Confirm the downloaded workbook and its field layout before accepting the preparation protocol. The UCI page documents invoice quantities/dates, cancellations, and CC BY 4.0 licensing.

Source: https://archive.ics.uci.edu/dataset/502/online%2Bretail%2Bii  
Citation DOI: https://doi.org/10.24432/C5CG6D

Dataset retrieval and analysis have not been performed as part of writing this plan. Proposed dates and cohort size below are implementation defaults subject to a documented source audit, not measured dataset findings.

### Target

Use `gross_invoiced_units`, aggregated by product and source calendar date. Invoice records do not establish physical fulfillment or unconstrained demand. Keep this target separate from the reference integration's fulfilled-sales target. Do not pool their scores into one leaderboard.

### Preparation rules

1. Preserve the original workbook and record source URL, retrieval time, license attribution, file checksum and worksheet identifiers.
2. Normalize actual workbook column aliases and types through a versioned schema mapping.
3. Assign stable source-row identity using workbook checksum, worksheet and row position. Identical field values alone do not prove duplicate business transactions.
4. Require usable product identifiers, dates and quantities. Retain an audit of rejected rows and reasons.
5. Separate cancellation-coded invoices and nonpositive quantities from the positive-sales target. Preserve their counts for the data-quality report; do not subtract future returns from an earlier gross-sales observation.
6. Exclude non-merchandise/accounting codes through a documented rule list established from development data. Do not remove poor final-test performers.
7. Customer identifiers are unnecessary for forecasting. Missing customer IDs must not automatically remove otherwise valid sales.
8. Price is not an initial feature. Zero-price rows must receive an explicit treatment based on target semantics, not an undocumented blanket filter.
9. Treat source timestamps as documented source-local times. If the file has no timezone, record the calendar-date assumption rather than inventing UTC timestamps.
10. Fill missing product dates with zero only within the research coverage assumption recorded in the dataset card. An assumption based on a historical transaction extract does not certify operational synchronization completeness.

Audit source-wide empty days, missing dates, cancellation volumes, invalid quantities, non-merchandise rows, worksheet overlaps and duplicate-looking records. If the audit contradicts completeness assumptions, record affected days as uncertain and revise the protocol before final evaluation.

### Cohort

- Start with at most 20 product series for a tractable first run.
- Determine eligibility and selection from the initial training period only.
- Include a reproducibly selected mix of regular and intermittent sales, using recorded training-only summaries and a fixed selection seed.
- Freeze `cohort.json` before validation/model selection.
- Do not exclude a product because its later sales become zero, its test error is large, or its evaluation metric is undefined.
- Report the eligible population, selected cohort and exclusions. Dataset-specific product selection is not evidence of broad business generality.

**Gate A:** identical source bytes and preparation configuration reproduce identical series, cohort IDs, exclusion counts and checksums.

## 4. Immutable artifacts and record contracts

Separate source data, prepared data, forecast-origin inputs, evaluation labels and results. Large workbooks and output arrays belong in configured artifact storage. The first CLI checkpoint stores metadata in local checksummed manifests; later application integration can index references in the existing MongoDB-backed research/integration store. No database migration is required for A/B.

| Record | Required contents |
| --- | --- |
| DatasetVersion | Source checksum, target, time/calendar assumptions, preparation version/configuration, coverage basis, cohort and immutable artifact reference |
| ForecastDataset | Exact ordered training dates/values/flags, product ID, origin, knowledge cutoff, dataset version and input checksum |
| EvaluationRun | Protocol version, cohort, periods, stride/horizon, method configurations, seeds, dependency/code versions, hardware/thread settings and status |
| ForecastResult | Method, product, origin, all forecast dates/values, actual implementation, fit/predict timings and failure reason where applicable |
| EvaluationLabels | Exact evaluation observations, label version and whether as-observed or final-corrected |
| SimulationRun | Dataset/generator reference, demand seed, policy settings, information boundary, initial state, warm-up, horizon and status |
| ScenarioRun | Base run, event schedule, corruption/treatment parameters, knowledge cutoffs and recovery configuration |

Write artifacts to a temporary location, validate and hash them, then atomically publish the run manifest. A run is not complete merely because a job exited. Do not publish missing/partial files as successful output. Keep failed attempts with explicit status; retries create linked attempts rather than silently rewriting recorded results.

A dataset hash cannot reconstruct overwritten data. Store the exact series for every forecast origin. For correction/delay experiments, capture each origin when it occurs; retain event revisions or materialized origin datasets and keep later corrected labels separately.

**Gate B:** a forecast's original inputs and configuration remain retrievable and reproducible after the source observations are corrected.

## 5. Forecasting protocol

### Initial methods

| Method | Initial definition |
| --- | --- |
| Weekly seasonal naive | Repeat the last observed seven-day pattern across the 30-day horizon |
| Moving average | Repeat the mean of a configured recent window; choose among a small declared set, such as 7 and 28 days, using development results only |
| Lag-feature gradient boosting | Native scikit-learn HistGradientBoostingRegressor, using causal demand lags/rolling statistics and known calendar features |

Use one shared interface: fit on an explicit training snapshot, then predict a requested future calendar. Evaluation must not be hidden inside model fitting. The CLI and application must call the same forecasting functions.

For boosting, begin with a small fixed feature set: lags 1, 7, 14 and 28; shifted rolling mean/std over 7 and 28 days; day of week and month. Drop rows without required historical lags; never backfill them from future observations. Use recursive prediction initially, with a bounded development-only hyperparameter grid and declared training window.

Clip negative unit predictions consistently for all eligible methods before evaluation. Preserve floating point forecasts for scoring; apply integer rounding only in the ordering policy. No automatic substitution when an implementation fails.

### Proposed chronological periods

| Period | Purpose |
| --- | --- |
| 2009-12-01 through 2010-11-30 | Initial training and cohort selection |
| 2010-12-01 through 2011-05-31 | Development, window/model configuration and policy selection |
| 2011-06-01 through 2011-11-30 | Final out-of-sample evaluation |
| Partial terminal December | Excluded from this first protocol |

Audit these boundaries against the actual workbook before freezing the protocol. Do not silently move them after viewing final-test performance.

### Origins and information cutoff

- Forecast horizon: 30 completed future calendar days.
- Evaluation stride: seven days, anchored to the first eligible origin in each evaluation period.
- At each origin, all training observations precede the first forecast date.
- Require every forecast date to fall within that evaluation period.
- Use the same origin schedule and declared training window for all methods. The initial executable protocol uses the last 84 consecutive calendar days, chosen before the first scored development run; no missing training values are imputed. This bounded common window also supports the planned lag features. Expanding-window variants are separate later configurations.
- Earlier test observations may become training data at a later test origin, as in a real rolling deployment; model/hyperparameter selection remains frozen.
- Recursive future lags use predictions, never actual values from that origin's forecast horizon.
- Direct/native multi-step implementations may be added later under the same cutoff rule; recursion is not a universal requirement.

### Metrics and reporting

Define daily error as `prediction - actual`:

- MAE: mean absolute daily error.
- Bias: mean signed daily error; positive means overprediction.
- Seasonal MASE: MAE divided by the mean absolute seven-day seasonal difference in the origin's training observations.
- Report zero-denominator MASE as undefined with counts and reasons; do not replace the denominator by one.
- Report horizon bands 1–7, 8–14 and 15–30, plus cumulative 30-day error and the chosen inventory protection-period error.
- Record fitting and prediction time separately; distinguish cold import/setup costs from model execution where measured.
- Summarize equally across products and separately with volume weighting. State each aggregation rule.
- Report planned origins, eligible origins, produced forecasts, failures and metric-undefined cases.
- Show paired comparisons on common successful origins alongside full-method failure/availability counts.
- Weekly origins overlap at a 30-day horizon. Do not apply significance tests that assume independent daily errors. Initially show paired product-level differences and variation; use justified blocked/clustered uncertainty estimates only if added.

Reference methodology: https://otexts.com/fpp3/toolbox.html#time-series-cross-validation and https://otexts.com/fpp3/toolbox.html#evaluating-point-forecast-accuracy

**Gate C:** the first seasonal-naive run saves correct predictions/labels/metrics. Modifying any observation after an origin cannot change that origin's predictions. Adding moving average and boosting must preserve this invariant.

## 6. Inventory simulator specification

The simulator evaluates decisions, rather than presenting the existing reorder formula as an optimization result. It must not read or modify live inventory.

### Demand and information boundary

Use an explicitly synthetic complete-demand process for the primary inventory experiment, with parameters fixed from training-only summaries and documented regular/intermittent behavior. Preserve the generated demand path and seed. Real sales replay can be a later, explicitly labeled demand-proxy experiment; historical invoices do not reveal actual lost demand or inventory availability.

All policies receive the same underlying demand path, starting state and allowed information. The evaluator knows full daily demand. The policy sees past fulfilled sales and only those availability flags enabled by the configuration. Future demand is never a policy feature.

Provide the same initial historical sales context to each policy; record the initial unconstrained-sales assumption. After simulation begins, policies learn from their own observable sales, including censoring caused by stockouts. Do not update their history with evaluator-only lost demand.

### Initial accounting

| Item | Definition |
| --- | --- |
| Daily sequence | Receipts, demand, fulfillment/lost-sales recording, review, order placement |
| Lead time | Main experiment 7 days; positive integers only; zero unsupported initially |
| Review interval | Daily |
| Receipt timing | An order placed on day d arrives at the beginning of day d + lead time |
| Shortages | Lost sales; no backlog in the initial suite |
| Starting inventory/pipeline | Same explicit starting state for all policies; no hidden inbound supply |
| Constraints | Pack size 1, minimum order quantity 0; explicit simulation settings |
| Warm-up | Initial 28 simulated days, excluded from scored outcomes; do not reset stock when scoring begins |
| Scored duration | Initial 180 days following warm-up |
| Final pipeline | Report outstanding quantities/arrival dates separately; do not pretend they were received |
| Forecast refresh | At daily review from that policy's available observations; fitting schedule fixed in configuration |

Initial stock and fixed policy thresholds are derived from the initial training context, not final-test outcomes. Fix these choices during development and record them. Use an identical predeclared fitting/window schedule for forecast-driven methods and record its cost.

### Policies

1. Fixed `(s, S)` baseline with training-derived thresholds, frozen before final simulation.
2. Seasonal-naive periodic-review policy.
3. Gradient-boosting periodic-review policy.

The two forecast-driven policies share:

```text
inventoryPosition = onHand + outstandingOrders   # no backlog in this suite
target = sum(forecast for dates d+1 through d+leadTime+reviewInterval-1) + safetyStock
orderQuantity = ceil(max(0, target - inventoryPosition))
```

Use matching safety-stock/constraint conventions. Compare seasonal-naive versus boosting to isolate the forecasting-method change. Differences against `(s, S)` also reflect the policy structure and must be described accordingly.

Start with one declared safety-stock setting derived from training mean sales, then a small predeclared buffer sensitivity grid. Do not announce a better forecasting model because it achieves service improvement solely by holding more inventory. Report service/inventory trade-offs together.

### Outcomes

- Unit fill rate = total served units / total demand; undefined if total demand is zero.
- Stockout day = a day with positive unserved demand.
- Average end-of-day on-hand stock over scored days, with sampling convention fixed.
- Order frequency, total ordered units and end-of-run pipeline.
- No monetary savings without explicit, justified cost assumptions.

Use the same demand seeds across policies for paired comparisons. Start with three seeds and report variation, not only the best seed. Report the generator assumptions and synthetic status alongside every inventory result.

**Gate D:** daily conservation holds: opening stock + receipts = fulfilled units + closing stock. A hand-calculated example matches the engine. Policies cannot access future or hidden lost demand. Replaying the same configuration reproduces results.

## 7. Data-quality and recovery experiments

Implement after the clean benchmark and simulator are reproducible.

### Scenario schedule

| Scenario | Initial treatment | Expected correctness condition |
| --- | --- | --- |
| Duplicate delivery | Replay a defined subset of source events | Canonical data and downstream forecasts remain unchanged when deduplication succeeds |
| Out-of-order update | Deliver an older revision after a newer one | Canonical state does not regress |
| Delay | Deliver selected observations 1 or 7 days late | Each origin uses only received/applied information; recovery is measurable |
| Missing records | Withhold a seeded 5% sample or a declared multi-day outage | Missingness remains explicit; readiness reacts according to the scoped contract |
| Correction | Change a quantity at a later knowledge time | Earlier inputs/results stay preserved; later eligible results use the corrected version |

Freeze exact event identities, times and affected scopes before running. Test scenarios individually before combinations. Injection percentages and durations are experimental settings, not estimates of typical business failures.

### Separate tracks

**Operational track:** preserve readiness rules. A forecast may be blocked. Report availability, time blocked, stale-result duration, processing lag and recovery. Predeclare the inventory fallback during a blocked forecast: use the last valid result for at most one review interval, then suspend new orders while showing the blocked state. Compare this declared behavior consistently; do not remove blocked periods from inventory scoring.

**Robustness track:** explicitly label the missing-data treatment. Begin with prior same-weekday imputation when sufficient past data exists; otherwise mark the treatment unavailable. Never impute from future values. Report error only where a forecast exists and report availability separately. Include a clearly labeled naive zero-fill ablation only as an experimental comparison, never as the operational default.

### Integration with current ingestion

The present reference contract emits fulfilled-sales records, while the real dataset contains invoices. Do not rename invoice records as fulfillments. For end-to-end ingestion experiments, first use synthetic fulfillment observations from the inventory simulation under the existing target semantics. Real-invoice corruption experiments can run through the research preparation/replay path with their own target identifier.

Add scoped coverage manifests/readiness only as needed to determine which product/dates are complete. Retain exact origin inputs. Reuse the inbox/worker revision behavior rather than constructing a second incompatible deduplication algorithm.

Current periodic recollection is not complete reconciliation. Before a reconciliation comparison, implement a bounded identity/revision/quantity check with declared source-history limitations and report polling-only and reconciliation-enabled recovery separately.

**Gate E:** repeated event schedules yield identical as-observed snapshots. Duplicates and older revisions act as negative controls. No recovery metric is attributed to a mechanism that was not executed.

## 8. Application and API integration

Build a CLI vertical slice first; add UI once saved results exist. Research preparation never calls the legacy destructive simulation endpoint.

### User flow

1. Open the app normally and enter the dashboard.
2. Open Forecasting Lab and explicitly select a research dataset.
3. Select an approved configuration and start an evaluation, or open an existing run.
4. Inspect methods, predictions, errors, failures and exact run inputs.
5. Open the Inventory simulation view linked to that research context.

Keep business data and research context visibly labeled. A dataset selection must not globally replace the business catalog. Keep existing business forecasting available while the new workflow is accepted; migrate operational calls separately after regression testing.

### Proposed endpoints

| Operation | Behavior |
| --- | --- |
| `POST /api/research/evaluations` | Validate approved config/dataset; enqueue and return run ID |
| `GET /api/research/evaluations/:id` | Status, provenance, result summary and failure information |
| `GET /api/research/evaluations/:id/products` | Paginated product/origin results |
| `POST /api/research/simulations` | Start an isolated simulation from explicit policy/demand config |
| `GET /api/research/simulations/:id` | Assumptions, trajectories and policy metrics |
| `GET /api/research/runs/:id/export` | Permitted result tables/configuration/manifest export |

Use the existing local job/worker approach where practical, with deduplication, explicit statuses, cancellation behavior and atomic publication. Do not send a full benchmark as a long-running synchronous page request. Reuse existing workspace authorization/context without exposing credentials in URLs or adding a new app entry gate.

Required UI states: queued, running, completed, completed-with-failures, failed, cancelled, and obsolete input version. Show missing coverage and undefined metrics with reasons. Every displayed number links to a recorded run and dataset version.

**Gate F:** a browser test can open the original dashboard, run/view an evaluation, inspect its dataset, and open a simulation without altering original product/stock records. Refreshing a results page does not retrain models.

## 9. Proposed files and ownership

| Area | Planned responsibility |
| --- | --- |
| `ml-service/forecasting/base.py` | Shared fit/predict interface and model identity |
| `ml-service/forecasting/baselines.py` | Seasonal naive and moving average |
| `ml-service/forecasting/boosting.py` | Initial scikit-learn model and causal recursive features |
| `ml-service/evaluation/` | Origin generation, metrics and timing |
| `experiments/data/` | Source retrieval, preparation, audits and dataset cards |
| `experiments/configs/` | Versioned cohort, split, method, policy and scenario settings |
| `experiments/inventory/` | Demand generation, accounting engine and policies |
| `experiments/scenarios/` | Event schedules and as-observed materialization |
| Backend research services/models | Artifact references, run metadata, job lifecycle and scope |
| Forecast Lab and Inventory components | Explicit context selection and stored result inspection |
| `docs/research/` | Protocol, methodology, results, limitations and reproducibility guide |

These are proposed paths, not implemented files. Prefer a thin extension of existing services over a second application stack. Add a spreadsheet reader dependency for the workbook and pin it; keep optional deep-learning dependencies outside the initial required benchmark profile.

## 10. Tests and acceptance evidence

| Test | Failure it prevents |
| --- | --- |
| Manual seasonal-naive example across more than seven future days | Incorrect repeated-week indexing |
| Training cutoff/lag inspection and future-value mutation | Hidden use of holdout observations |
| Scaled metric with constant/all-zero training | Invented finite MASE scores |
| Fixed source/config snapshot replay | Irreproducible preprocessing/cohort selection |
| Source correction after saved origin | Retroactively changing historical predictions |
| Model failure and matched-origin reporting | Leaderboards improved by silently dropping failures |
| Hand-calculated receipt/order example | Off-by-one lead time and impossible stock balances |
| Hidden demand access test | Giving policies information unavailable in practice |
| Zero-demand period and terminal pipeline | Misleading service rates/end-state accounting |
| Duplicate/out-of-order negative controls | False forecasting degradation from a correct ingestion path |
| Original UI and data regression | Replacing the existing project with a research-only screen |

Run small deterministic fixtures in CI. Full dataset experiments run through a documented command with pinned dependencies, a frozen config and exported manifests. Compare numerical metrics within stated tolerances where hardware/library differences prevent byte-identical floating point results.

## 11. Delivery sequence

| Delivery | Work package | Reviewable result |
| --- | --- | --- |
| A | Dataset audit, target, preparation and immutable artifacts | Dataset card, cohort, audit and reproducible snapshot |
| B | Seasonal naive, rolling origins and metrics | First saved correct 30-day evaluation |
| C | Moving average and boosting; frozen model selection | Three-method tables, timing, failures and product analysis |
| D | Inventory accounting, policies and information boundary | Reproducible service/inventory comparisons |
| E | Controlled scenarios, readiness and bounded recovery comparison | Availability, error, recovery and policy consequences |
| F | Application inspection views and job endpoints | Evidence accessible through the familiar app |
| G | Technical report and short demonstration | Reproduction instructions and defensible conclusions |

Start with A and B as the first implementation package. Do not implement the entire destination schema or polished UI first. Each delivery must pass its acceptance gate before relying on it in the next one. A real-provider sample/demo proceeds when authorized access exists and does not block the offline benchmark.

## 12. Final deliverables and review checkpoints

- One documented command reproduces data preparation, saved forecasts and benchmark tables from approved dataset-access instructions.
- A separate declared simulation config reproduces inventory trajectories and trade-offs.
- Scenario manifests recreate incomplete/as-observed inputs and their recovery outcomes.
- The report states the question, related methodology, target, selection, methods, experiments, negative results, limitations and personal contribution.
- A three-to-five-minute demonstration shows the existing app, evidence inspection and one source update.
- External technical feedback is recorded when actually obtained, with ensuing changes documented.

Before implementation begins, review the following defaults explicitly: UCI Online Retail II as the first candidate; gross invoiced units as its target; the training/development/test boundaries; the cohort selection rules; the synthetic nature of inventory demand; the three policy definitions; and the blocked-forecast fallback. These are the decisions that determine what the eventual results can legitimately claim.

The benchmark is successful when its findings are reproducible and defensible, including cases where the ML method loses. Simulator gains are conditional findings under recorded assumptions, not measured savings for a real business.

## 13. Accepted review clarifications — November 7, 2026

These tighten implementation details without rewriting the delivery sequence.

### 13.1 Missing observations and common eligibility

The historical target is observed gross invoiced units under a stated complete-extract research assumption. An ordinary product date with no qualifying rows is zero under that assumption. This does not establish zero demand, product activity, or availability. Source-wide empty dates are individually listed by the audit and explicitly labeled assumption-based zeros; they are not silently certified as operationally complete. Dates explicitly flagged uncertain by audit/configuration override any zero, and invalid dated quantities block that date. Invalid dates whose affected period is unknowable conservatively block all research origins until reviewed.

Pre-first-training-observation days remain unknown. After a last sale, continue the declared coverage assumption; never infer deactivation using the full workbook's last sale. The initial training-only cohort and selection rules are frozen before any scored development run. The implementation's 84-day common training window must contain known values (observed or assumption-labeled zero). Seasonal naive additionally requires seven consecutive known calendar days. If training is unknown, exclude the origin and record why. If training is eligible but any of the 30 evaluation labels is unknown, preserve the predictions as **unscored** and exclude the entire origin from every method's score. Forecast availability and scored-origin fraction are separate outcomes. Zero-denominator MASE remains undefined.

Before final evaluation, freeze the cohort, coverage assumptions, windows, score aggregation and all model selection choices. Final-test scoring is intentionally unavailable in deliveries A/B. The first development run is a baseline checkpoint, not a final performance claim.

### 13.2 Exact simulator calendar

Review occurs after demand on day d. Today's order with lead time L arrives before demand on d+L; the next review occurs on d+R, whose order arrives before demand on d+R+L. The target's enumerated dates are therefore d+1 through d+L+R-1. For L=7 and R=1, these are exactly seven days, not eight.

Hand-worked prerequisite: at the end of day 0, on-hand is 3, pipeline is 0, safety stock is 0 and forecast is 1 per day. The seven-day target is 7 and today's order is 4, arriving before day-7 demand. Days 1–3 use the opening 3 units; days 4–6 lose one unit each before the first receipt; day 7 receives 4 and serves one. Reviews and later orders cannot repair those earlier losses. Inventory position alone does not prove supply arrives in time. Test both the date list and this pre-receipt shortage before implementing policy comparisons.

### 13.3 Two distinct inventory questions

Keep two separately labeled experiments. In the **shared-input comparison**, both forecasting methods receive the same predeclared reference sales history at each cutoff, with identical ordering formula, safety stock, initial state and demand path. Generate/freeze that common observable history using a reference policy; do not expose hidden lost demand or future values. This isolates the forecaster substitution under shared inputs. In the **closed-loop comparison**, each method learns from its own fulfilled sales and permitted availability flags. This measures the full system with feedback/censoring. Report them separately; neither substitutes for the other.

### 13.4 Detection, repair and fallback

Separate detectable gaps (failed pages, incomplete manifests or other verifiable coverage evidence) from silent omissions in valid responses. Silent omissions do not automatically make the operational system mark a gap; only an independent comparison can expose them. The harness may know the omission for scoring but must not give that knowledge to readiness checks. Record fault time, detection time (possibly never), repair time, blocked/stale duration and the evidence used to discover it. Polling success is not proof that silent omissions were reconciled.

One-review-interval fallback uses the last valid forecast's **remaining calendar dates**, not a restarted prediction vector. Check that those exact dates cover the current protection period. Insufficient remaining horizon means no eligible fallback. Keep its stale status explicit.

### 13.5 Release scope

The first complete showcase release is A–D plus G's reproducibility report: real-data benchmark, controlled and closed-loop inventory comparisons, and reproducible evidence. Add one delayed-record or correction experiment next. Full fault matrices, application job endpoints and a real-provider demonstration follow. The immediate checkpoint remains one audit, one frozen cohort, one saved seasonal-naive run, an independent repeat and a future-observation invariance check.
