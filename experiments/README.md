# Research checkpoint: deliveries A and B

Run from the project root:

```bash
bash run-research.sh
```

This prepares the pinned UCI workbook if necessary, audits/prepares it, evaluates weekly seasonal naive on the **development period**, repeats the run independently, replays the saved inputs and checks that future values cannot change an earlier forecast. The app still starts with `bash start.sh`; this research command does not use a business database or alter any application screens.

The first download is approximately 44 MB and workbook parsing takes longer than subsequent cached runs. The launcher reuses an existing Python environment where possible, or creates `.research-venv`. Dependencies are in `experiments/requirements.txt`. Python 3.12+ is recommended. Raw data and full local results are ignored by Git; small review reports, the frozen cohort and source checksum are versioned.

## What is implemented

- Streaming workbook audit, source checksum verification and attribution.
- Explicit treatment of worksheet overlap, cancellation lines, merchandise-code eligibility and missing observations.
- A 20-product cohort selected using initial-training information only.
- Exact immutable training snapshots and separate evaluation labels for each origin.
- Weekly seasonal naive producing all 30 future days from its last observed week.
- Weekly development origins, common eligibility, MAE, signed bias, seasonal MASE, horizon bands and execution timing.
- JSON results, a product CSV, explicit exclusions/failures and integrity-checked manifests.
- Independent repeat, replay without reading the current workbook, and future-value invariance checks.
- Final-test evaluation intentionally blocked pending the complete protocol/model freeze.

Moving average, boosting, inventory simulation, data-quality/recovery experiments and application research views are not yet implemented. Existing application forecasting is a separate older workflow; its metrics are not this benchmark's results.

## Missingness contract

The target is `gross_invoiced_units`, not shipments or underlying demand. The historical extract is assumed complete for this research target. A product/date without qualifying invoice rows is an **assumption-labeled zero**, including source-wide empty dates, all of which are listed in the audit. This does not establish availability or why no sales were recorded.

Dates before a product's first observed training-period sale are unknown. Later no-sale dates remain zeros under the same assumption; no deactivation is inferred from full-workbook last-sale dates. Source boundary dates are unknown. Explicit uncertain dates override observed/zero quantities; an invalid quantity blocks its date, while unscoped invalid dates block preparation and preserve an audit for review.

The common input window is 84 consecutive calendar days. Every training value must be observed or an explicitly assumption-labeled zero. Seasonal naive needs the last seven consecutive days. Unknown training excludes the origin. Unknown labels preserve any valid forecast as **unscored**, excluding the entire 30-day origin from scores for every method. Forecast availability and scored-origin fraction are separate. No imputation is used in the operational eligibility rule.

Before the first scored run, a deliberately conservative preflight marked every source-empty date unknown. Because empty dates recur, it yielded no eligible origins. The accepted review explicitly allows observed zero under a stated extract-coverage assumption; that assumption was adopted and recorded before any scored baseline results were examined. This is a research assumption, not a claim that live synchronization gaps can be zero-filled.

## Files

- `sources/online_retail_ii.json`: original workbook checksum, official URL and license/citation.
- `configs/retail-v1.json`: exact preparation/evaluation rules.
- `reports/cohort-v1.json`: frozen training-only cohort and selection metadata.
- `reports/protocol-lock-v1.json`: accepted development dataset/config identity; final test remains locked.
- `reports/`: reviewable audit/checkpoint summary and product table.
- `artifacts/datasets/<hash>/`: complete dataset, audit, cohort and checksummed manifest.
- `artifacts/runs/<id>/`: exact origin inputs, separate labels, predictions, metrics, product table and manifest.

An origin's knowledge basis is the published historical workbook; the original real received/applied revision history is unavailable. These baseline runs are not evidence of real-time as-observed reconstruction. Later delivery/correction experiments must capture their own origin datasets or revisions.

## Focused commands

Use the Python environment chosen by the launcher (for this workspace, `ml-service/venv/bin/python`):

```bash
ml-service/venv/bin/python -m experiments.cli prepare
ml-service/venv/bin/python -m experiments.cli evaluate
ml-service/venv/bin/python -m experiments.cli verify --run experiments/artifacts/runs/<run-id>
ml-service/venv/bin/python -m experiments.cli check-invariance
ml-service/venv/bin/python -m unittest discover -s experiments/tests -v
```

`verify` uses the stored origin inputs and labels, without reopening the source workbook. Changing source records cannot rewrite those files. A changed model implementation must be restored before exact replay. Timings/run IDs are intentionally excluded from the deterministic prediction/metric hash; their raw values remain recorded separately.

## Source and limits

Chen, D. (2012). *Online Retail II* [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D. Official access: https://archive.ics.uci.edu/dataset/502/online%2Bretail%2Bii. License: CC BY 4.0; preserve attribution.

This first cohort represents a specific historical invoice dataset. Assumed zeros, intermittent/all-zero later sales and undocumented availability limit interpretation. Weekly forecast origins overlap; aggregate errors are descriptive and do not establish independent statistical significance. MASE is undefined when its training seasonal scale is zero. Final-test results, model improvements, inventory benefits and live-provider compatibility have not been established by A/B.
