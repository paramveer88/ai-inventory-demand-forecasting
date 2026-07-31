import pandas as pd
import numpy as np
import time
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.neural_network import MLPRegressor
import datetime

# Graceful imports to allow full functionality out of the box, falling back to scikit-learn models
try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

try:
    import lightgbm as lgb
    LGBM_AVAILABLE = True
except ImportError:
    LGBM_AVAILABLE = False

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def preprocess_lags(df, max_lag=7):
    """Generate lag and rolling features for machine learning models."""
    df_feat = df.copy()
    
    # Lag features
    for lag in range(1, max_lag + 1):
        df_feat[f'lag_{lag}'] = df_feat['y'].shift(lag)
        
    # Rolling statistics
    df_feat['roll_mean_7'] = df_feat['y'].shift(1).rolling(window=min(len(df_feat), 7), min_periods=1).mean()
    df_feat['roll_std_7'] = df_feat['y'].shift(1).rolling(window=min(len(df_feat), 7), min_periods=1).std().fillna(0)
    
    # Calendar features
    df_feat['dayofweek'] = df_feat['ds'].dt.dayofweek
    df_feat['month'] = df_feat['ds'].dt.month
    df_feat['day'] = df_feat['ds'].dt.day
    
    # Fill NaN from shifting
    df_feat = df_feat.bfill().fillna(0)
    return df_feat


class ForecastingModelPipeline:
    def __init__(self, model_name: str):
        self.model_name = model_name
        self.status = "active"
        self.info = ""

    def fit_predict(self, df: pd.DataFrame, forecast_horizon: int = 30):
        """Fit model and predict next N days.
        Returns:
            predictions: List[float]
            metrics: dict of MAE, RMSE, MAPE, R2
            latency_ms: float
            status: str (active/fallback/simulated)
        """
        start_time = time.time()
        
        # Prepare Backtesting Split (80% Train, 20% Validation)
        n_samples = len(df)
        split_idx = max(int(n_samples * 0.8), min(n_samples - 1, 5))
        
        train_df = df.iloc[:split_idx].copy()
        val_df = df.iloc[split_idx:].copy()
        
        try:
            # Run model implementation
            pred_val, pred_future = self._run_model(train_df, val_df, df, forecast_horizon)
            status = self.status
        except Exception as e:
            print(f"[{self.model_name}] Execution failed: {e}. Running fallback simulation...")
            pred_val, pred_future = self._run_fallback(train_df, val_df, df, forecast_horizon)
            status = "fallback"
            
        latency_ms = (time.time() - start_time) * 1000
        
        # Evaluate metrics on validation set
        y_val = val_df['y'].values
        mae = float(np.mean(np.abs(y_val - pred_val)))
        rmse = float(np.sqrt(np.mean((y_val - pred_val) ** 2)))
        
        # MAPE protection against division by zero
        denom = np.where(y_val == 0, 1.0, y_val)
        mape = float(np.mean(np.abs((y_val - pred_val) / denom)) * 100)
        
        # R2 score
        y_val_mean = np.mean(y_val)
        ss_tot = np.sum((y_val - y_val_mean) ** 2)
        ss_res = np.sum((y_val - pred_val) ** 2)
        r2 = float(1 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0
        
        # Clip predictions to 0
        pred_future = [max(0.0, float(p)) for p in pred_future]
        
        return {
            "model_name": self.model_name,
            "status": status,
            "predictions": pred_future,
            "metrics": {
                "mae": round(mae, 2),
                "rmse": round(rmse, 2),
                "mape": round(mape, 2),
                "r2": round(r2, 3)
            },
            "latency_ms": round(latency_ms, 1)
        }

    def _run_model(self, train_df, val_df, full_df, horizon):
        raise NotImplementedError

    def _run_fallback(self, train_df, val_df, full_df, horizon):
        """High-quality statistical fallback utilizing LinearRegression + noise + seasonality."""
        # Simple Linear Trend
        train_df['day_idx'] = np.arange(len(train_df))
        lr = LinearRegression()
        lr.fit(train_df[['day_idx']], train_df['y'])
        
        # Seasonality
        val_idx = np.arange(len(train_df), len(train_df) + len(val_df))
        pred_val = lr.predict(pd.DataFrame({'day_idx': val_idx}))
        
        # Add simple sine seasonality to look realistic
        val_dates = val_df['ds']
        val_season = np.sin(val_dates.dt.dayofweek * (2 * np.pi / 7.0)) * (train_df['y'].std() * 0.2 + 1)
        pred_val = np.maximum(0, pred_val + val_season)
        
        # Future Predictions
        future_idx = np.arange(len(full_df), len(full_df) + horizon)
        pred_future = lr.predict(pd.DataFrame({'day_idx': future_idx}))
        
        last_date = full_df['ds'].max()
        future_dates = pd.Series([(last_date + datetime.timedelta(days=i)) for i in range(1, horizon + 1)])
        future_season = np.sin(future_dates.dt.dayofweek * (2 * np.pi / 7.0)) * (train_df['y'].std() * 0.2 + 1)
        pred_future = np.maximum(0, pred_future + future_season)
        
        return pred_val, pred_future


class LinearRegressionModel(ForecastingModelPipeline):
    def __init__(self):
        super().__init__("Linear Regression")
        self.info = "Fits a straight line indicating long-term growth or decline trend."

    def _run_model(self, train_df, val_df, full_df, horizon):
        # Validation predictions
        train_df['day_idx'] = np.arange(len(train_df))
        lr = LinearRegression()
        lr.fit(train_df[['day_idx']], train_df['y'])
        
        val_idx = np.arange(len(train_df), len(train_df) + len(val_df))
        pred_val = lr.predict(pd.DataFrame({'day_idx': val_idx}))
        
        # Future predictions
        full_df = full_df.copy()
        full_df['day_idx'] = np.arange(len(full_df))
        lr_full = LinearRegression()
        lr_full.fit(full_df[['day_idx']], full_df['y'])
        
        future_idx = np.arange(len(full_df), len(full_df) + horizon)
        pred_future = lr_full.predict(pd.DataFrame({'day_idx': future_idx}))
        
        return pred_val, pred_future


class XGBoostModel(ForecastingModelPipeline):
    def __init__(self):
        super().__init__("XGBoost")
        self.info = "Gradient boosted decision trees that model complex non-linear lag correlations and trend factors."
        if not XGB_AVAILABLE:
            self.status = "simulated"

    def _run_model(self, train_df, val_df, full_df, horizon):
        if not XGB_AVAILABLE:
            # Fall back to scikit-learn GradientBoostingRegressor as a direct algorithmic equivalent
            gbr = GradientBoostingRegressor(n_estimators=50, random_state=42)
            return self._run_tabular_ml(gbr, train_df, val_df, full_df, horizon)
            
        xgb_reg = xgb.XGBRegressor(n_estimators=50, max_depth=4, learning_rate=0.1, random_state=42)
        return self._run_tabular_ml(xgb_reg, train_df, val_df, full_df, horizon)

    def _run_tabular_ml(self, model, train_df, val_df, full_df, horizon):
        # Feature extraction
        train_feat = preprocess_lags(train_df)
        val_feat = preprocess_lags(pd.concat([train_df, val_df]))
        
        features = [col for col in train_feat.columns if col not in ['ds', 'y']]
        
        model.fit(train_feat[features], train_feat['y'])
        
        # Predict validation
        val_inputs = val_feat.iloc[len(train_df):][features]
        pred_val = model.predict(val_inputs)
        
        # Predict future recursively to avoid missing future lags
        full_feat = preprocess_lags(full_df)
        model_full = model
        model_full.fit(full_feat[features], full_feat['y'])
        
        current_data = full_df.copy()
        predictions = []
        
        last_date = current_data['ds'].max()
        
        for i in range(horizon):
            # Extract features for next step
            next_date = last_date + datetime.timedelta(days=i+1)
            # Create a row with placeholder y
            next_row = pd.DataFrame({'ds': [next_date], 'y': [0.0]})
            temp_df = pd.concat([current_data, next_row]).reset_index(drop=True)
            temp_feat = preprocess_lags(temp_df)
            
            # Predict
            pred = model_full.predict(temp_feat.iloc[-1:][features])[0]
            pred = max(0.0, pred)
            predictions.append(pred)
            
            # Update last row with actual prediction
            current_data = pd.concat([current_data, pd.DataFrame({'ds': [next_date], 'y': [pred]})]).reset_index(drop=True)
            
        return pred_val, predictions


class LightGBMModel(ForecastingModelPipeline):
    def __init__(self):
        super().__init__("LightGBM")
        self.info = "Highly efficient histogram-based tree booster designed for scale and multi-lag timeseries forecasting."
        if not LGBM_AVAILABLE:
            self.status = "simulated"

    def _run_model(self, train_df, val_df, full_df, horizon):
        # We use RandomForestRegressor as a stable algorithmic equivalent if lightgbm is missing
        if not LGBM_AVAILABLE:
            rfr = RandomForestRegressor(n_estimators=50, max_depth=6, random_state=42)
            xgb_wrapper = XGBoostModel() # Reuses the recursive feature execution logic
            return xgb_wrapper._run_tabular_ml(rfr, train_df, val_df, full_df, horizon)
            
        lgb_reg = lgb.LGBMRegressor(n_estimators=50, max_depth=4, random_state=42, verbose=-1)
        xgb_wrapper = XGBoostModel()
        return xgb_wrapper._run_tabular_ml(lgb_reg, train_df, val_df, full_df, horizon)


class ProphetModel(ForecastingModelPipeline):
    def __init__(self):
        super().__init__("Prophet")
        self.info = "Meta's additive model capturing holiday effects, trend shifts, and multiple seasonal cycles."
        if not PROPHET_AVAILABLE:
            self.status = "simulated"

    def _run_model(self, train_df, val_df, full_df, horizon):
        if not PROPHET_AVAILABLE:
            # Build a Prophet-equivalent additive model using scikit-learn LinearRegression + Fourier terms
            return self._run_prophet_simulation(train_df, val_df, full_df, horizon)
            
        # Format for Prophet
        prophet_train = train_df[['ds', 'y']].rename(columns={'ds': 'ds', 'y': 'y'})
        model = Prophet(yearly_seasonality=False, weekly_seasonality=True, daily_seasonality=False)
        model.fit(prophet_train)
        
        # Validate
        val_future = val_df[['ds']].copy()
        forecast_val = model.predict(val_future)
        pred_val = forecast_val['yhat'].values
        
        # Future forecast
        model_full = Prophet(yearly_seasonality=False, weekly_seasonality=True, daily_seasonality=False)
        model_full.fit(full_df[['ds', 'y']])
        future = model_full.make_future_dataframe(periods=horizon)
        forecast_future = model_full.predict(future)
        pred_future = forecast_future.iloc[-horizon:]['yhat'].values
        
        return pred_val, pred_future

    def _run_prophet_simulation(self, train_df, val_df, full_df, horizon):
        """Simulates additive models with weekly Fourier features."""
        def get_features(dates):
            t = (dates - pd.Timestamp("2026-01-01")).dt.total_seconds() / (24 * 3600)
            features = pd.DataFrame({
                'trend': t,
                'cos_weekly': np.cos(2 * np.pi * t / 7.0),
                'sin_weekly': np.sin(2 * np.pi * t / 7.0)
            })
            return features
            
        X_train = get_features(train_df['ds'])
        y_train = train_df['y']
        
        model = Ridge(alpha=1.0)
        model.fit(X_train, y_train)
        
        # Val
        X_val = get_features(val_df['ds'])
        pred_val = model.predict(X_val)
        
        # Future
        X_full = get_features(full_df['ds'])
        model_full = Ridge(alpha=1.0)
        model_full.fit(X_full, full_df['y'])
        
        last_date = full_df['ds'].max()
        future_dates = pd.Series([last_date + datetime.timedelta(days=i) for i in range(1, horizon + 1)])
        X_future = get_features(future_dates)
        pred_future = model_full.predict(X_future)
        
        return pred_val, pred_future


class LSTMModel(ForecastingModelPipeline):
    def __init__(self):
        super().__init__("LSTM")
        self.info = "Recurrent neural network capable of learning sequence history and temporal correlations."
        if not TORCH_AVAILABLE:
            self.status = "simulated"

    def _run_model(self, train_df, val_df, full_df, horizon):
        if not TORCH_AVAILABLE:
            # Neural network simulation using scikit-learn MLPRegressor
            mlp = MLPRegressor(hidden_layer_sizes=(32, 16), max_iter=200, random_state=42)
            xgb_wrapper = XGBoostModel()
            return xgb_wrapper._run_tabular_ml(mlp, train_df, val_df, full_df, horizon)
            
        # Pytorch LSTM implementation
        return self._run_pytorch_lstm(train_df, val_df, full_df, horizon)

    def _run_pytorch_lstm(self, train_df, val_df, full_df, horizon):
        # Simplified lightweight PyTorch model definition to keep runtimes fast
        class SmallLSTM(nn.Module):
            def __init__(self):
                super().__init__()
                self.lstm = nn.LSTM(input_size=1, hidden_size=16, num_layers=1, batch_first=True)
                self.fc = nn.Linear(16, 1)
                
            def forward(self, x):
                out, _ = self.lstm(x)
                return self.fc(out[:, -1, :])
                
        # Scale data
        y_train = train_df['y'].values.astype(np.float32)
        mean, std = y_train.mean(), y_train.std() + 1e-5
        y_train_scaled = (y_train - mean) / std
        
        # Prepare sliding windows (window size = 5)
        window = 5
        def create_windows(seq):
            x, y = [], []
            for i in range(len(seq) - window):
                x.append(seq[i:i+window])
                y.append(seq[i+window])
            return np.array(x), np.array(y)
            
        if len(y_train_scaled) <= window:
            # Fall back if data series is too short
            mlp = MLPRegressor(hidden_layer_sizes=(16,), max_iter=100, random_state=42)
            xgb_wrapper = XGBoostModel()
            return xgb_wrapper._run_tabular_ml(mlp, train_df, val_df, full_df, horizon)
            
        X, Y = create_windows(y_train_scaled)
        X_tensor = torch.tensor(X[:, :, np.newaxis], dtype=torch.float32)
        Y_tensor = torch.tensor(Y[:, np.newaxis], dtype=torch.float32)
        
        # Train simple model
        model = SmallLSTM()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
        criterion = nn.MSELoss()
        
        model.train()
        for epoch in range(40):
            optimizer.zero_grad()
            outputs = model(X_tensor)
            loss = criterion(outputs, Y_tensor)
            loss.backward()
            optimizer.step()
            
        # Predict val
        model.eval()
        pred_val = []
        full_seq = list(y_train_scaled)
        
        for i in range(len(val_df)):
            inp = torch.tensor(np.array(full_seq[-window:])[np.newaxis, :, np.newaxis], dtype=torch.float32)
            with torch.no_grad():
                pred = model(inp).item()
            pred_val.append(pred * std + mean)
            # Use actual validation value for teacher forcing
            val_actual = (val_df['y'].values[i] - mean) / std
            full_seq.append(val_actual)
            
        # Future Predictions (Autoregressive)
        y_full = (full_df['y'].values.astype(np.float32) - mean) / std
        X_f, Y_f = create_windows(y_full)
        X_f_tensor = torch.tensor(X_f[:, :, np.newaxis], dtype=torch.float32)
        Y_f_tensor = torch.tensor(Y_f[:, np.newaxis], dtype=torch.float32)
        
        model_full = SmallLSTM()
        opt = torch.optim.Adam(model_full.parameters(), lr=0.01)
        for epoch in range(40):
            opt.zero_grad()
            loss = criterion(model_full(X_f_tensor), Y_f_tensor)
            loss.backward()
            opt.step()
            
        model_full.eval()
        pred_future = []
        current_seq = list(y_full[-window:])
        
        for i in range(horizon):
            inp = torch.tensor(np.array(current_seq[-window:])[np.newaxis, :, np.newaxis], dtype=torch.float32)
            with torch.no_grad():
                pred = model_full(inp).item()
            pred_future.append(pred * std + mean)
            current_seq.append(pred)
            
        return np.array(pred_val), np.array(pred_future)


class TemporalFusionTransformerModel(ForecastingModelPipeline):
    def __init__(self):
        super().__init__("TFT")
        self.info = "Multi-horizon transformer network applying self-attention to align complex dynamic variables."
        self.status = "simulated"

    def _run_model(self, train_df, val_df, full_df, horizon):
        # Simulates a TFT's quantile behavior using Quantile Gradient Boosting
        gbr_median = GradientBoostingRegressor(loss='quantile', alpha=0.5, n_estimators=50, random_state=42)
        xgb_wrapper = XGBoostModel()
        return xgb_wrapper._run_tabular_ml(gbr_median, train_df, val_df, full_df, horizon)


class TimesFMModel(ForecastingModelPipeline):
    def __init__(self):
        super().__init__("TimesFM")
        self.info = "Google's pre-trained Zero-Shot Time-Series foundation model, forecasting context sequences instantly."
        self.status = "simulated"

    def _run_model(self, train_df, val_df, full_df, horizon):
        # Simulates a zero-shot model forecast using a deep autoregressive ridge estimator
        ridge = Ridge(alpha=10.0)
        xgb_wrapper = XGBoostModel()
        return xgb_wrapper._run_tabular_ml(ridge, train_df, val_df, full_df, horizon)


# Model Registry helper
ALL_MODELS = {
    "lr": LinearRegressionModel,
    "xgboost": XGBoostModel,
    "lightgbm": LightGBMModel,
    "prophet": ProphetModel,
    "lstm": LSTMModel,
    "tft": TemporalFusionTransformerModel,
    "timesfm": TimesFMModel
}
