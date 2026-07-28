from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
from sklearn.linear_model import LinearRegression
import numpy as np
import requests
import datetime
import os

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
        # Fallback to simulation if no data provided
        dates = pd.date_range(end=datetime.datetime.now(), periods=60)
        sales = [10 + (i * 0.1) + np.random.randint(-2, 3) for i in range(60)]
        df = pd.DataFrame({'ds': dates, 'y': sales})
    else:
        df = pd.DataFrame([{"ds": s.date, "y": s.quantity} for s in request.salesData])
        df['ds'] = pd.to_datetime(df['ds'])
        df = df.sort_values('ds')
    
    df['day_index'] = np.arange(len(df))

    # Train Model
    model = LinearRegression()
    X = df[['day_index']]
    y = df['y']
    model.fit(X, y)

    # Predict next 30 days
    last_index = df['day_index'].max()
    future_indices = pd.DataFrame({'day_index': np.arange(last_index + 1, last_index + 31)})
    predictions = model.predict(future_indices)
    predictions = [max(0.0, float(p)) for p in predictions]


    # Generate dates for predictions
    last_date = df['ds'].max()
    future_dates = [(last_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 31)]

    return {
        "productId": request.productId,
        "next_30_days": sum(predictions),
        "daily_predictions": [
            {"date": d, "value": v} for d, v in zip(future_dates, predictions)
        ],
        "trend": "increasing" if model.coef_[0] > 0 else "decreasing"
    }

@app.get("/forecast")
def get_forecast(productId: str = Query(...)):
    # ... existing simulation for backward compatibility ...
    dates = pd.date_range(end=datetime.datetime.now(), periods=60)
    sales = [10 + (i * 0.1) + np.random.randint(-2, 3) for i in range(60)]
    df = pd.DataFrame({'ds': dates, 'y': sales})
    df['day_index'] = np.arange(len(df))
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
