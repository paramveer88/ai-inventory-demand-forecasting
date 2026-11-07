"""Cutoff-safe baseline evaluation with shared eligibility and immutable replay."""
from __future__ import annotations
from datetime import date, timedelta, datetime, timezone
from importlib.metadata import version
import csv
import json
import math
from pathlib import Path
import platform
import subprocess
import time
import uuid
from .artifacts import digest, file_digest, read_json, write_json
from .data import dates
from .forecasting import seasonal_naive, KNOWN





def score(predictions, actual, training, period=7):
    if not predictions or len(predictions) != len(actual):
        raise ValueError("Predictions and labels must be nonempty and aligned")
    if any(not math.isfinite(float(x)) or x < 0 for x in list(predictions)+list(actual)+list(training)):
        raise ValueError("Metrics require finite nonnegative quantities")
    errors = [p-y for p,y in zip(predictions, actual)]
    mae = sum(abs(e) for e in errors) / len(errors)
    bias = sum(errors) / len(errors)
    differences = [abs(training[i]-training[i-period]) for i in range(period, len(training))]
    scale = sum(differences)/len(differences) if differences else None
    return {"mae": mae, "bias_prediction_minus_actual": bias,
            "mase": mae/scale if scale is not None and scale > 0 else None,
            "mase_reason": None if scale is not None and scale > 0 else "ZERO_OR_UNAVAILABLE_TRAINING_SCALE",
            "training_seasonal_scale": scale,
            "cumulative_error": sum(errors), "absolute_cumulative_error": abs(sum(errors))}


def schedule(config, partition):
    start = date.fromisoformat(config[f"{partition}_start"])
    end = date.fromisoformat(config[f"{partition}_end"])
    horizon, stride = config["horizon"], config["stride"]
    origin = start - timedelta(days=1)
    while origin + timedelta(days=horizon) <= end:
        yield origin
        origin += timedelta(days=stride)


def origin_inputs(dataset, product, origin):
    config = dataset["config"]
    horizon = config["horizon"]
    window = config["training_window_days"]
    values = {row["date"]: row for row in dataset["series"][product]}
    train_dates = list(dates(origin-timedelta(days=window-1), origin))
    forecast_dates = list(dates(origin+timedelta(days=1), origin+timedelta(days=horizon)))
    missing = lambda d: {"date": d.isoformat(), "value": None, "coverage": "outside_dataset", "availability": "unknown"}
    training = [values.get(d.isoformat(), missing(d)) for d in train_dates]
    labels = [values.get(d.isoformat(), missing(d)) for d in forecast_dates]
    reasons = []
    if window < 7 or len(training) < 7:
        reasons.append("INSUFFICIENT_WEEKLY_CONTEXT")
    if any(row["value"] is None or row["coverage"] not in KNOWN for row in training):
        reasons.append("UNKNOWN_TRAINING_OBSERVATION")
    if any(row["value"] is None or row["coverage"] not in KNOWN for row in labels):
        reasons.append("UNKNOWN_EVALUATION_LABEL")
    return training, labels, reasons


def model_code_hash():
    return file_digest(Path(__file__).with_name("forecasting.py"))


def provenance():
    root = Path(__file__).resolve().parents[1]
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=root, text=True).strip()
    try:
        commit = git("rev-parse", "HEAD")
        dirty = bool(git("status", "--porcelain"))
    except (subprocess.CalledProcessError, FileNotFoundError):
        commit, dirty = None, None
    return {"git_commit": commit, "working_tree_dirty": dirty, "python": platform.python_version(),
            "platform": platform.platform(), "packages": {name: version(name) for name in ["pandas", "numpy", "openpyxl"]},
            "research_code_sha256": digest({p.name: file_digest(p) for p in sorted(Path(__file__).parent.glob('*.py'))}),
            "model_code_sha256": model_code_hash()}


def verify_dataset(directory: Path):
    manifest = read_json(directory / "manifest.json")
    if manifest.get("status") != "complete":
        raise ValueError("Dataset is not completely published")
    for name, expected in manifest["files"].items():
        if digest(read_json(directory / name)) != expected:
            raise ValueError(f"Dataset checksum mismatch: {name}")
    dataset = read_json(directory / "dataset.json")
    identity = dict(dataset)
    expected = identity.pop("dataset_sha256")
    if digest(identity) != expected or expected != manifest["dataset_sha256"]:
        raise ValueError("Dataset identity mismatch")
    return dataset


def evaluate(dataset_dir: Path, output: Path, partition="development"):
    # Final evaluation is intentionally unavailable until the full protocol is frozen.
    if partition != "development":
        raise ValueError("Final test scoring is locked until methods, cohort, coverage and aggregation are frozen")
    dataset = verify_dataset(dataset_dir)
    config = dataset["config"]
    if config["model"] != "weekly_seasonal_naive":
        raise ValueError("Only the declared first baseline is implemented")
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    directory = output / "runs" / run_id
    directory.mkdir(parents=True, exist_ok=False)
    manifest = {"schema": "evaluation-run-v1", "status": "running", "run_id": run_id,
                "partition": partition, "dataset_sha256": dataset["dataset_sha256"],
                "cohort_sha256": dataset["cohort_sha256"], "config": config,
                "provenance": provenance(), "files": {}}
    write_json(directory / "manifest.json", manifest)
    records = []
    try:
        for product in sorted(dataset["series"]):
            for origin in schedule(config, partition):
                training, labels, reasons = origin_inputs(dataset, product, origin)
                # Inputs and evaluation labels are distinct immutable artifacts.
                snapshot = {"schema": "forecast-input-v1", "product": product, "target": config["target"],
                            "calendar": config["calendar"], "origin": origin.isoformat(), "knowledge_cutoff": origin.isoformat(),
                            "dataset_sha256": dataset["dataset_sha256"], "training": training,
                            "horizon": config["horizon"], "period": config["seasonal_period"], "model": config["model"],
                            "availability_basis": "unknown; invoiced sales do not reveal stockouts",
                            "knowledge_basis": "historical workbook snapshot; no real received/applied revision history"}
                input_hash = digest(snapshot)
                label_snapshot = {"schema": "evaluation-labels-v1", "origin": origin.isoformat(), "product": product,
                                  "version": "published_workbook_observations", "labels": labels}
                label_hash = digest(label_snapshot)
                input_name = f'inputs/{input_hash}.json'
                label_name = f'labels/{label_hash}.json'
                write_json(directory / input_name, snapshot, immutable=True)
                write_json(directory / label_name, label_snapshot, immutable=True)
                manifest["files"][input_name] = input_hash
                manifest["files"][label_name] = label_hash
                result = {"product": product, "origin": origin.isoformat(), "input_sha256": input_hash,
                          "labels_sha256": label_hash, "input_file": input_name, "labels_file": label_name,
                          "status": "excluded" if any(r != 'UNKNOWN_EVALUATION_LABEL' for r in reasons) else "pending", "reasons": reasons}
                if not any(r != 'UNKNOWN_EVALUATION_LABEL' for r in reasons):
                    try:
                        start = time.perf_counter()
                        predictions = seasonal_naive(training, config["horizon"], config["seasonal_period"])
                        predict_ms = (time.perf_counter()-start)*1000
                        result.update(status="unscored" if reasons else "completed",
                                      predictions=[{"date": row["date"], "value": p} for row,p in zip(labels,predictions)],
                                      fit_ms=0.0, predict_ms=predict_ms,
                                      timing_note="no fitting; cold Python/import costs excluded")
                        if not reasons:
                            actual = [row["value"] for row in labels]
                            training_values = [row["value"] for row in training]
                            metrics = score(predictions, actual, training_values)
                            bands = {name: score(predictions[a:b], actual[a:b], training_values)
                                     for name,a,b in [("days_1_7",0,7),("days_8_14",7,14),("days_15_30",14,30)]}
                            result.update(metrics=metrics, horizon_bands=bands, actual_units=sum(actual))
                    except Exception as error:
                        result.update(status="failed", reasons=[type(error).__name__])
                records.append(result)
        summary = summarize(records)
        payload = {"schema": "predictions-v1", "records": records}
        write_json(directory / 'results.json', payload, immutable=True)
        write_json(directory / 'summary.json', summary, immutable=True)
        manifest["files"]["results.json"] = digest(payload)
        manifest["files"]["summary.json"] = digest(summary)
        table = directory / 'products.csv'
        pending_table = directory / '.products.csv.pending'
        with pending_table.open('w', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(summary['products'][0]) if summary['products'] else ['product','planned','completed','mae','bias','mase','mase_defined','label_units'])
            writer.writeheader()
            writer.writerows({k: ('undefined' if v is None else v) for k,v in row.items()} for row in summary['products'])
        pending_table.replace(table)
        manifest["files"]["products.csv"] = file_digest(table)
        manifest["prediction_sha256"] = digest([{k:r.get(k) for k in ['product','origin','status','reasons','input_sha256','labels_sha256','predictions','metrics']} for r in records])
        if not summary["completed"]:
            raise ValueError("No eligible scored forecasts; inspect saved coverage exclusions instead of relaxing rules silently")
        manifest["status"] = "completed_with_exclusions" if summary['excluded'] or summary['failed'] or summary['unscored'] else "completed"
        write_json(directory / 'manifest.json', manifest)
    except Exception as error:
        manifest.update(status="failed", error=str(error))
        write_json(directory / 'manifest.json', manifest)
        raise
    return directory


def summarize(records):
    completed = [r for r in records if r['status'] == 'completed']
    excluded = [r for r in records if r['status'] == 'excluded']
    failed = [r for r in records if r['status'] == 'failed']
    unscored = [r for r in records if r['status'] == 'unscored']
    reasons = {}
    for r in excluded+failed+unscored:
        for reason in r['reasons']:
            reasons[reason] = reasons.get(reason,0)+1
    by_product=[]
    for product in sorted({r['product'] for r in records}):
        rows=[r for r in completed if r['product']==product]
        planned=sum(r['product']==product for r in records)
        if not rows:
            by_product.append({'product':product,'planned':planned,'completed':0,'mae':None,'bias':None,'mase':None,'mase_defined':0,'label_units':0})
            continue
        valid_mase=[r['metrics']['mase'] for r in rows if r['metrics']['mase'] is not None]
        by_product.append({'product':product,'planned':planned,'completed':len(rows),
                           'mae':sum(r['metrics']['mae'] for r in rows)/len(rows),
                           'bias':sum(r['metrics']['bias_prediction_minus_actual'] for r in rows)/len(rows),
                           'mase':sum(valid_mase)/len(valid_mase) if valid_mase else None,'mase_defined':len(valid_mase),
                           'label_units':sum(r['actual_units'] for r in rows)})
    valid=[r for r in by_product if r['mae'] is not None]
    total_units=sum(r['label_units'] for r in valid)
    return {'model':'weekly_seasonal_naive','planned':len(records),'completed':len(completed),'excluded':len(excluded),'failed':len(failed),'unscored':len(unscored),
            'forecast_availability':(len(completed)+len(unscored))/len(records) if records else None,
            'scored_origin_fraction':len(completed)/len(records) if records else None,'exclusion_counts':reasons,'products':by_product,
            'macro_product_mae':sum(r['mae'] for r in valid)/len(valid) if valid else None,
            'macro_product_bias':sum(r['bias'] for r in valid)/len(valid) if valid else None,
            'macro_product_mase':sum(r['mase'] for r in valid if r['mase'] is not None)/sum(r['mase'] is not None for r in valid) if any(r['mase'] is not None for r in valid) else None,
            'volume_weighted_product_mae':sum(r['mae']*r['label_units'] for r in valid)/total_units if total_units else None,
            'volume_weighting':'product MAE weighted by scored label units; overlapping horizons count multiple times',
            'mase_undefined_origins':sum(r['metrics']['mase'] is None for r in completed),
            'mase_defined_products':sum(r['mase'] is not None for r in valid),
            'prediction_time_ms_total':sum(r['predict_ms'] for r in completed),
            'dependence_note':'weekly origins overlap; scores are descriptive, not independent significance tests'}


def verify_run(directory: Path):
    manifest=read_json(directory/'manifest.json')
    if manifest['status'] not in {'completed','completed_with_exclusions'}:
        raise ValueError('Cannot replay an incomplete run')
    if manifest['provenance']['model_code_sha256'] != model_code_hash():
        raise ValueError('Model code differs; restore the recorded implementation before exact replay')
    for name,expected in manifest['files'].items():
        actual = digest(read_json(directory/name)) if name.endswith('.json') else file_digest(directory/name)
        if actual != expected:
            raise ValueError(f'Run artifact checksum mismatch: {name}')
    results=read_json(directory/'results.json')['records']
    verified=0
    for result in results:
        if result['status'] not in {'completed','unscored'}:
            continue
        snapshot=read_json(directory/result['input_file'])
        labels=read_json(directory/result['labels_file'])['labels']
        predictions=seasonal_naive(snapshot['training'],snapshot['horizon'],snapshot['period'])
        if predictions != [r['value'] for r in result['predictions']]:
            raise ValueError('Prediction replay differs')
        if result['status']=='completed':
            metrics=score(predictions,[r['value'] for r in labels],[r['value'] for r in snapshot['training']])
            if metrics != result['metrics']:
                raise ValueError('Metric replay differs')
        verified+=1
    return {'run_id':manifest['run_id'],'verified_forecasts':verified,'prediction_sha256':manifest['prediction_sha256']}
