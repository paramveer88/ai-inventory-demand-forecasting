from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
import numpy as np
import datetime
import os
from models import ALL_MODELS

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000/api")

class SalesEntry(BaseModel):
    date: str
    quantity: int

class ForecastRequest(BaseModel):
    productId: str
    salesData: List[SalesEntry]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ml/forecast")
def post_forecast(request: ForecastRequest):
    if not request.salesData:
        dates = pd.date_range(end=datetime.datetime.now(), periods=60)
        sales = [10 + (i * 0.1) + np.random.randint(-2, 3) for i in range(60)]
        df = pd.DataFrame({'ds': dates, 'y': sales})
    else:
        df = pd.DataFrame([{"ds": s.date, "y": s.quantity} for s in request.salesData])
        df['ds'] = pd.to_datetime(df['ds'])
        df = df.sort_values('ds')
    
    # Train Linear Regression model using our pipeline wrapper to keep behaviors consistent
    lr_model = ALL_MODELS["lr"]()
    result = lr_model.fit_predict(df, 30)
    
    # Format dates
    last_date = df['ds'].max()
    future_dates = [(last_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 31)]
    
    # Calculate trend slope manually
    df['day_index'] = np.arange(len(df))
    from sklearn.linear_model import LinearRegression
    lr = LinearRegression()
    lr.fit(df[['day_index']], df['y'])
    trend = "increasing" if lr.coef_[0] > 0 else "decreasing"

    return {
        "productId": request.productId,
        "next_30_days": sum(result["predictions"]),
        "daily_predictions": [
            {"date": d, "value": v} for d, v in zip(future_dates, result["predictions"])
        ],
        "trend": trend
    }

@app.post("/ml/compare")
def compare_models(request: ForecastRequest):
    if not request.salesData:
        dates = pd.date_range(end=datetime.datetime.now(), periods=60)
        sales = [10 + (i * 0.1) + np.random.randint(-2, 3) for i in range(60)]
        df = pd.DataFrame({'ds': dates, 'y': sales})
    else:
        df = pd.DataFrame([{"ds": s.date, "y": s.quantity} for s in request.salesData])
        df['ds'] = pd.to_datetime(df['ds'])
        df = df.sort_values('ds')

    last_date = df['ds'].max()
    future_dates = [(last_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 31)]

    model_results = []
    for model_key, model_cls in ALL_MODELS.items():
        model_instance = model_cls()
        res = model_instance.fit_predict(df, 30)
        
        # Calculate trend based on direction of final forecasts
        preds = res["predictions"]
        trend = "increasing" if len(preds) > 1 and preds[-1] >= preds[0] else "decreasing"
        
        model_results.append({
            "model_key": model_key,
            "model_name": res["model_name"],
            "status": res["status"],
            "info": model_instance.info,
            "next_30_days": sum(preds),
            "daily_predictions": [
                {"date": d, "value": v} for d, v in zip(future_dates, preds)
            ],
            "metrics": res["metrics"],
            "latency_ms": res["latency_ms"],
            "trend": trend
        })

    # Prepare historical sales to send back to client
    historical_sales = [{"date": s.date, "quantity": s.quantity} for s in request.salesData]

    return {
        "productId": request.productId,
        "historical_sales": historical_sales,
        "models": model_results
    }

@app.get("/forecast")
def get_forecast(productId: str = Query(...)):
    dates = pd.date_range(end=datetime.datetime.now(), periods=60)
    sales = [10 + (i * 0.1) + np.random.randint(-2, 3) for i in range(60)]
    df = pd.DataFrame({'ds': dates, 'y': sales})
    df['day_index'] = np.arange(len(df))
    from sklearn.linear_model import LinearRegression
    model = LinearRegression()
    X = df[['day_index']]
    y = df['y']
    model.fit(X, y)
    future_indices = pd.DataFrame({'day_index': np.arange(60, 90)})
    predictions = model.predict(future_indices)
    predictions = [max(0.0, float(p)) for p in predictions]

    return {
        "productId": productId,
        "next_30_days": sum(predictions),
        "daily_predictions": predictions,
        "trend": "increasing" if model.coef_[0] > 0 else "decreasing"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
