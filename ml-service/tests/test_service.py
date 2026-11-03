import unittest
from datetime import date, timedelta
from unittest.mock import patch
from pydantic import ValidationError
from fastapi import HTTPException
import app
import models

class ForecastTests(unittest.TestCase):
    def request(self):
        return app.ForecastRequest(productId='synthetic-test', salesData=[app.SalesEntry(date=date(2026, 1, 1)+timedelta(days=i), quantity=10+i//7) for i in range(61)])

    def test_empty_and_negative_sales_rejected(self):
        with self.assertRaises(ValidationError):
            app.ForecastRequest(productId='p', salesData=[])
        with self.assertRaises(ValidationError):
            app.SalesEntry(date=date(2026,1,1),quantity=-1)

    def test_missing_dates_are_not_fabricated(self):
        req=self.request(); req.salesData.pop(5)
        with self.assertRaises(HTTPException): app.post_forecast(req)

    def test_forecast_requires_real_inputs_and_returns_thirty_days(self):
        result=app.post_forecast(self.request())
        self.assertEqual(len(result['daily_predictions']),30)
        self.assertTrue(all(x['value']>=0 for x in result['daily_predictions']))
        self.assertEqual(result['daily_predictions'][0]['date'],'2026-03-03')

    def test_native_failure_is_not_replaced_by_simulation(self):
        with patch.object(models,'XGB_AVAILABLE',False):
            with self.assertRaises(RuntimeError): models.XGBoostModel().fit_predict(app.frame(self.request()))
        with patch.dict(app.ALL_MODELS, {'xgboost': lambda: models.XGBoostModel()}, clear=True), patch.object(models,'XGB_AVAILABLE',False):
            result=app.compare_models(self.request())
            self.assertEqual(result['models'],[])
            self.assertEqual(result['unavailable_models'][0]['status'],'unavailable')

    def test_fake_transformer_entries_removed(self):
        self.assertNotIn('tft',models.ALL_MODELS)
        self.assertNotIn('timesfm',models.ALL_MODELS)

    def test_early_lags_do_not_use_future_observations(self):
        frame=app.frame(self.request())
        features=models.preprocess_lags(frame)
        self.assertEqual(features.index[0],7)
        self.assertEqual(features.iloc[0]['lag_7'],frame.iloc[0]['y'])

if __name__ == '__main__': unittest.main()
