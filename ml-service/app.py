from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
from datetime import date, timedelta
import pandas as pd
from models import ALL_MODELS

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=[], allow_methods=["POST", "GET"], allow_headers=["*"])

class SalesEntry(BaseModel):
    date: date
    quantity: int = Field(ge=0)

class ForecastRequest(BaseModel):
    productId: str = Field(min_length=1)
    salesData: List[SalesEntry] = Field(min_length=16, max_length=3660)

def frame(request):
    df = pd.DataFrame([{"ds": pd.Timestamp(s.date), "y": s.quantity} for s in request.salesData]).sort_values("ds")
    if df["ds"].duplicated().any():
        raise HTTPException(422, "Duplicate sales dates")
    if not df["ds"].diff().dropna().eq(pd.Timedelta(days=1)).all():
        raise HTTPException(422, "Supply a complete daily series; missing days are not silently zero-filled")
    return df.reset_index(drop=True)

def format_result(df, result):
    dates = [(df["ds"].max() + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 31)]
    preds = result["predictions"]
    return {"next_30_days": sum(preds), "daily_predictions": [{"date": d, "value": v} for d, v in zip(dates, preds)],
            "trend": "increasing" if preds[-1] > preds[0] else "decreasing" if preds[-1] < preds[0] else "stable"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ml/forecast")
def post_forecast(request: ForecastRequest):
    df = frame(request)
    try:
        result = ALL_MODELS["lr"]().fit_predict(df, 30)
    except Exception as exc:
        raise HTTPException(503, "Forecast computation unavailable") from exc
    return {"productId": request.productId, "model_name": "Linear Regression", **format_result(df, result)}

@app.post("/ml/compare")
def compare_models(request: ForecastRequest):
    df = frame(request)
    results, unavailable = [], []
    for key, cls in ALL_MODELS.items():
        model = cls()
        try:
            result = model.fit_predict(df, 30)
        except Exception:
            unavailable.append({"model_key": key, "model_name": model.model_name, "status": "unavailable"})
            continue
        results.append({"model_key": key, "model_name": result["model_name"], "status": result["status"], "info": model.info,
                        **format_result(df, result), "metrics": result["metrics"], "latency_ms": result["latency_ms"]})
    return {"productId": request.productId, "historical_sales": [{"date": s.date.isoformat(), "quantity": s.quantity} for s in request.salesData],
            "models": results, "unavailable_models": unavailable,
            "evaluation_protocol": "legacy_chronological_holdout; lag/LSTM validation uses observed prior validation values; not a 30-day recursive benchmark"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
