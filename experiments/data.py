"""Streaming workbook audit and training-only cohort preparation."""
from __future__ import annotations
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
import hashlib
import math
from pathlib import Path
import random
import re
import openpyxl
from .artifacts import digest, file_digest, write_json

ALIASES = {
    "invoice": "invoice", "invoiceno": "invoice", "stockcode": "product",
    "quantity": "quantity", "invoicedate": "occurred", "price": "price",
    "unitprice": "price", "customer id": "customer", "customerid": "customer",
    "country": "country", "description": "description",
}


def dates(start: str | date, end: str | date):
    day = date.fromisoformat(start) if isinstance(start, str) else start
    stop = date.fromisoformat(end) if isinstance(end, str) else end
    while day <= stop:
        yield day
        day += timedelta(days=1)


def text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def day_value(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value)).date()
    except (TypeError, ValueError):
        return None


def quantity_value(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(value)
        return int(n) if math.isfinite(n) and n.is_integer() else None
    except (ValueError, TypeError, OverflowError):
        return None


def audit_workbook(path: Path, config: dict, progress=print):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    source_hash = file_digest(path)
    sheets = []
    daily_by_sheet = []
    source_days_by_sheet = []
    seen = {}  # hashed full rows only, including sheet source; never output customer fields
    duplicate_rows = 0
    cross_sheet_duplicates = 0
    train_end = date.fromisoformat(config["train_end"])
    pattern = re.compile(config["stock_code_pattern"])
    try:
        for sheet_index, sheet in enumerate(workbook):
            progress(f"Auditing worksheet {sheet.title}…", flush=True)
            rows = sheet.iter_rows(values_only=True)
            header = next(rows)
            mapping = {ALIASES.get(text(k).lower(), text(k).lower()): i for i, k in enumerate(header)}
            if not {"invoice", "product", "quantity", "occurred"} <= mapping.keys():
                raise ValueError(f"Unsupported workbook columns in {sheet.title}")
            count = Counter()
            reasons = Counter()
            daily = defaultdict(Counter)
            source_days = Counter()
            first = {}
            dates_seen = []
            rejected_dates = set()
            for row_number, row in enumerate(rows, 2):
                count["rows"] += 1
                row_hash = hashlib.sha256(repr(row).encode()).digest()
                if row_hash in seen:
                    duplicate_rows += 1
                    if seen[row_hash] != sheet_index:
                        cross_sheet_duplicates += 1
                else:
                    seen[row_hash] = sheet_index
                def get(key):
                    index = mapping.get(key)
                    return row[index] if index is not None and index < len(row) else None
                d = day_value(get("occurred"))
                code = text(get("product")).upper()
                invoice = text(get("invoice")).upper()
                quantity = quantity_value(get("quantity"))
                if d:
                    source_days[d] += 1
                    dates_seen.append(d)
                if not text(get("customer")):
                    count["missing_customer_id"] += 1
                if invoice.startswith("C"):
                    count["cancellation_rows"] += 1
                if quantity is not None and quantity < 0:
                    count["negative_quantity_rows"] += 1
                price = get("price")
                if isinstance(price, (int, float)) and price == 0:
                    count["zero_price_rows"] += 1
                # Exclusive reasons make input = retained + excluded auditable.
                reason = None
                if not d:
                    reason = "invalid_date"
                elif not code or not pattern.fullmatch(code):
                    reason = "outside_declared_merchandise_code_pattern"
                elif not invoice:
                    reason = "missing_invoice"
                    rejected_dates.add(d)
                elif invoice.startswith("C"):
                    reason = "cancellation"
                elif quantity is None:
                    reason = "invalid_quantity"
                    rejected_dates.add(d)
                elif quantity <= 0:
                    reason = "nonpositive_quantity"
                if reason:
                    reasons[reason] += 1
                    continue
                count["eligible_rows_before_sheet_ownership"] += 1
                daily[code][d] += quantity
                if code not in first or d < first[code]:
                    first[code] = d
            sheets.append({"name": sheet.title, "headers": [text(k) for k in header], "counts": dict(count),
                           "exclusive_exclusions": dict(reasons), "date_min": min(dates_seen).isoformat(),
                           "date_max": max(dates_seen).isoformat(), "uncertain_quantity_dates": sorted(d.isoformat() for d in rejected_dates)})
            daily_by_sheet.append(daily)
            source_days_by_sheet.append(source_days)
    finally:
        workbook.close()
    # Latest worksheet owns a date, not an arbitrary subset of duplicate-looking rows.
    owner = {}
    overlap = set()
    for index, counts in enumerate(source_days_by_sheet):
        for day in counts:
            if day in owner:
                overlap.add(day)
            owner[day] = index
    combined = defaultdict(Counter)
    discarded_overlap_units = 0
    for index, daily in enumerate(daily_by_sheet):
        for code, values in daily.items():
            for day, value in values.items():
                if owner[day] == index:
                    combined[code][day] += value
                else:
                    discarded_overlap_units += value
    source_days = {day: source_days_by_sheet[index][day] for day, index in owner.items()}
    start = min(source_days)
    end = max(source_days)
    empty = [day for day in dates(start, end) if day not in source_days]
    training_days = list(dates(config["train_start"], config["train_end"]))
    # This historical research extract is explicitly assumed complete for the
    # gross-invoiced-units target. An empty date is not evidence of zero demand
    # or stock availability. Explicit audit uncertainty always overrides zero.
    unknown_days = set(date.fromisoformat(d) for d in config["uncertain_dates"])
    unknown_days.update([start, end])
    for index, metadata in enumerate(sheets):
        unknown_days.update(date.fromisoformat(d) for d in metadata["uncertain_quantity_dates"]
                            if owner.get(date.fromisoformat(d)) == index)
    audit = {
        "schema": "retail-audit-v1", "source_sha256": source_hash, "sheets": sheets,
        "rows": sum(s["counts"]["rows"] for s in sheets),
        "duplicate_looking_rows_retained_unless_sheet_ownership": duplicate_rows,
        "cross_sheet_duplicate_looking_rows": cross_sheet_duplicates,
        "overlapping_source_dates": sorted(d.isoformat() for d in overlap),
        "overlap_units_excluded_by_date_ownership": discarded_overlap_units,
        "date_min": start.isoformat(), "date_max": end.isoformat(),
        "source_wide_empty_dates": [d.isoformat() for d in empty],
        "unknown_dates": sorted(d.isoformat() for d in unknown_days),
        "merchandise_candidate_series": len(combined),
        "target": config["target"], "calendar": config["calendar"],
        "coverage_basis": "research_assumption_complete_extract; not verified demand or stock availability",
        "customer_fields": "used only for aggregate audit counts; not retained in prepared data",
    }
    audit["unscoped_invalid_date_rows"] = sum(s["exclusive_exclusions"].get("invalid_date",0) for s in sheets)
    return audit, combined, source_days, set(unknown_days)


def prepare(path: Path, config: dict, output: Path, progress=print):
    audit, combined, source_days, unknown_days = audit_workbook(path, config, progress)
    audit_path = output / "audits" / f"{digest(audit)}.json"
    write_json(audit_path, audit, immutable=True)
    if audit["unscoped_invalid_date_rows"]:
        raise ValueError(f"Unscoped invalid source dates block preparation; review {audit_path}")
    train_days = list(dates(config["train_start"], config["train_end"]))
    eligible = []
    first_seen = {}
    for code, values in combined.items():
        # First observation/cohort eligibility are based strictly on the initial training period.
        training_observed = [d for d in values if d <= date.fromisoformat(config["train_end"]) and d >= train_days[0]]
        if not training_observed:
            continue
        first = min(training_observed)
        if first > date.fromisoformat(config["cohort_first_observation_by"]):
            continue
        positive_days = sum(values.get(d, 0) > 0 for d in train_days)
        if positive_days < config["minimum_training_positive_days"]:
            continue
        usable = [d for d in train_days if d >= first and d not in unknown_days]
        if not usable:
            continue
        zero_fraction = sum(values.get(d, 0) == 0 for d in usable) / len(usable)
        eligible.append({"product": code, "first_observed": first.isoformat(), "training_positive_days": positive_days,
                         "training_units": sum(values.get(d, 0) for d in train_days), "training_zero_fraction": zero_fraction})
        first_seen[code] = first
    eligible.sort(key=lambda r: (r["training_zero_fraction"], r["product"]))
    buckets = [eligible[len(eligible)*i//4:len(eligible)*(i+1)//4] for i in range(4)]
    rng = random.Random(config["cohort_seed"])
    for bucket in buckets:
        rng.shuffle(bucket)
    selected = []
    while len(selected) < min(config["cohort_size"], len(eligible)):
        for i, bucket in enumerate(buckets):
            if bucket and len(selected) < config["cohort_size"]:
                row = dict(bucket.pop())
                row["training_zero_fraction_quartile"] = i + 1
                selected.append(row)
    if not selected:
        raise ValueError("No eligible cohort under declared training-only rules")
    calendar = list(dates(config["train_start"], config["test_end"]))
    series = {}
    for member in selected:
        code = member["product"]
        observations = []
        for day in calendar:
            value = combined[code].get(day, 0)
            if day < first_seen[code]:
                state, quantity = "pre_first_observation_unknown", None
            elif day in unknown_days:
                state, quantity = "audit_uncertain", None
            elif day in combined[code]:
                state, quantity = "observed", value
            else:
                state, quantity = "assumed_zero_under_extract_coverage", 0
            observations.append({"date": day.isoformat(), "value": quantity, "coverage": state,
                                 "availability": "unknown", "source_wide_empty": day not in source_days})
        series[code] = observations
    # Cohort selection identity must not depend on final-test values.
    cohort = {"schema": "retail-cohort-v1", "selection_training_end": config["train_end"],
              "seed": config["cohort_seed"], "eligible_count": len(eligible), "members": selected}
    cohort_hash = digest(cohort)
    cohort["cohort_sha256"] = cohort_hash
    prepared = {"schema": "retail-dataset-v1", "config": config, "source_sha256": audit["source_sha256"],
                "audit_sha256": digest(audit), "cohort_sha256": cohort_hash, "preparation_code_sha256": file_digest(Path(__file__)), "series": series}
    dataset_hash = digest(prepared)
    prepared["dataset_sha256"] = dataset_hash
    directory = output / "datasets" / dataset_hash
    # Manifest is the final publication point; partial files do not imply completion.
    write_json(directory / "audit.json", audit, immutable=True)
    write_json(directory / "cohort.json", cohort, immutable=True)
    write_json(directory / "dataset.json", prepared, immutable=True)
    write_json(directory / "manifest.json", {"schema": "dataset-manifest-v1", "status": "complete", "dataset_sha256": dataset_hash,
               "files": {"audit.json": digest(audit), "cohort.json": digest(cohort), "dataset.json": digest(prepared)}}, immutable=True)
    return directory
