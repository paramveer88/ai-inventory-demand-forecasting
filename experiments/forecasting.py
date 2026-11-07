"""Pure cutoff-safe models shared by offline research and future application jobs."""
from datetime import date, timedelta
import math

KNOWN = {"observed", "assumed_zero_under_extract_coverage"}


def seasonal_naive(training, horizon=30, period=7):
    if period != 7 or horizon < 1:
        raise ValueError("v1 requires a weekly period and positive horizon")
    if len(training) < period:
        raise ValueError("Seven consecutive known calendar days are required")
    for previous, current in zip(training, training[1:]):
        if date.fromisoformat(current["date"]) - date.fromisoformat(previous["date"]) != timedelta(days=1):
            raise ValueError("Training observations must be consecutive calendar days")
    last_week = training[-period:]
    if any(row["value"] is None or row["coverage"] not in KNOWN for row in last_week):
        raise ValueError("Seven consecutive known calendar days are required")
    values = [float(row["value"]) for row in last_week]
    if any(not math.isfinite(value) or value < 0 for value in values):
        raise ValueError("Invalid sales quantity")
    return [values[i % period] for i in range(horizon)]

