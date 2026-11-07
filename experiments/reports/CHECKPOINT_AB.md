# Deliveries A/B — first research checkpoint

Completed November 7, 2026 on the feature branch. This is a development-period baseline, not final evaluation or evidence of inventory improvement.

## What you can review

- **Workbook:** 1,067,371 rows across 2 worksheets, verified against the pinned UCI download checksum.
- **Overlap:** 8 overlapping dates and 22,523 duplicate-looking cross-sheet rows. The last worksheet owns each overlapping calendar date. Within-sheet duplicate-looking records are retained.
- **Cohort:** 20 products chosen from 2,490 eligible initial-training series, with five from each training zero-frequency quartile. No later zero-sales product was removed.
- **Dates:** initial training through November 30, 2010; scored development forecasts span December 2010–May 2011. The June–November 2011 final period has not been scored.
- **Forecasts:** 440 scored product/origin forecasts, each predicting 30 days, at 22 weekly origins per product. No model failures in this run.
- **Missingness:** this research target assumes the transaction extract is complete. Empty invoice dates are explicitly assumption-labeled zeros; they do not prove zero demand or stock availability. Pre-first-observation and explicit uncertainty are unknown. Training uses a fixed 84-day window, with no imputation.
- **Reproduction:** a second independent run produced the same prediction/metric checksum. Replay of saved inputs verified both runs. Future-value mutation checks passed for one eligible origin in each of the 20 products; fixture tests also exercise the cutoff boundary.

## Baseline results

| Metric | Development result |
| --- | ---: |
| Macro product MAE | 5.904015 units/day |
| Macro product signed bias | 0.237500 units/day |
| Macro product seasonal MASE | 1.362472 |
| Forecast availability under research coverage assumption | 100% |
| Scored origin fraction | 100% |
| MASE undefined origins | 70 |
| Products with defined aggregate MASE | 18 of 20 |

Undefined MASE cases are preserved rather than assigned a fictitious score. Product errors vary substantially; review `seasonal-naive-development-products.csv`. A mean across products and a volume-weighted mean answer different questions; both are recorded. Overlapping forecast horizons are not independent statistical samples.

These values establish a reproducible baseline only. They do not demonstrate that seasonal naive beats another method, that ML improves forecasting, or that any policy reduces inventory costs. Those comparisons are later deliveries.

## Exact artifacts

- Dataset: `6847ef8372a5df40f384695618c81593bb85824e4b67717d46d1976079c8b325`.
- Cohort: `b31e25d7200a128e4cd491886539c6faf96d7e2e9e67322c5f5728768ae0f6b5`.
- First run: `20261107T075302Z-880b05b1`.
- Repeat run: `20261107T075308Z-dc65dec9`.
- Prediction/metric checksum: `6e86f157fed3ac2f6199e2c956d98c5db13ae39f8873c9c1018a7aff1226bb9b`.
- Full local artifacts: `experiments/artifacts/`; raw workbook and full runs are intentionally excluded from Git.
- Review files: `workbook-audit-v1.json`, `cohort-v1.json`, `protocol-lock-v1.json`, `checkpoint-ab.json` and the product CSV.

Run **`bash run-research.sh`** from the repository root to recreate the checkpoint locally. Run `python -m unittest discover -s experiments/tests -v` with the research dependencies installed for the small fixture tests. The existing app continues to start with `bash start.sh`.

## Remaining work

Delivery C: moving average and lag-feature boosting under the same accepted information boundary, followed by a complete method/selection freeze before final testing. Delivery D: hand-checked inventory calendar plus shared-input and closed-loop policy experiments. Coverage/detection/recovery experiments, application research views and a live-provider demonstration have not been implemented by this checkpoint.

Source attribution: Chen, D. (2012), Online Retail II, UCI Machine Learning Repository, https://doi.org/10.24432/C5CG6D, CC BY 4.0. Dataset page: https://archive.ics.uci.edu/dataset/502/online%2Bretail%2Bii.
