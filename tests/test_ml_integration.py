import unittest

from app.app import app
from app.ml_predict import FEATURES, predict, predict_duration


VALID_PAYLOAD = {
    "customer_segment": "Consumer",
    "customer_city": "New York",
    "customer_country": "United States",
    "warehouse_id": "WH-001",
    "warehouse_city": "New York",
    "product_category": "Electronics",
    "product_weight_kg": 2.5,
    "order_value_usd": 250.0,
    "shipping_method": "Standard",
    "carrier": "EagleCourier",
    "distance_km": 800.0,
    "promised_delivery_days": 5,
    "shipping_cost_usd": 35.0,
    "package_size": "Medium",
    "payment_method": "Credit Card",
    "order_year": 2026,
    "order_month": 6,
    "order_day": 15,
    "order_dayofweek": 1,
    "order_is_weekend": False,
}


class ModelIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        cls.client = app.test_client()

    def test_metadata_endpoint_exposes_evaluated_models(self):
        response = self.client.get("/api/ml/metadata")

        self.assertEqual(response.status_code, 200)
        metadata = response.get_json()
        self.assertIsInstance(metadata, dict)
        self.assertIn("classification_comparison", metadata)
        self.assertIn("regression_comparison", metadata)
        self.assertGreaterEqual(len(metadata["classification_comparison"]), 4)
        self.assertGreaterEqual(len(metadata["regression_comparison"]), 4)
        self.assertEqual(
            max(metadata["classification_comparison"], key=lambda item: item["cv_f1"])["model_name"],
            "HistGradientBoosting",
        )
        self.assertEqual(
            min(metadata["regression_comparison"], key=lambda item: item["cv_mae"])["model_name"],
            "HistGradientBoosting Regressor",
        )

    def test_predictions_are_consistent_with_persisted_models(self):
        classification_one = predict(VALID_PAYLOAD)
        classification_two = predict(dict(VALID_PAYLOAD))
        duration_one = predict_duration(VALID_PAYLOAD)
        duration_two = predict_duration(dict(VALID_PAYLOAD))

        self.assertEqual(classification_one, classification_two)
        self.assertEqual(duration_one, duration_two)
        self.assertEqual(set(classification_one["features"]), set(FEATURES))
        self.assertEqual(set(duration_one["features"]), set(FEATURES))
        self.assertGreaterEqual(classification_one["probability"], 0)
        self.assertLessEqual(classification_one["probability"], 1)
        self.assertGreaterEqual(duration_one["predicted_days"], 0)

    def test_prediction_endpoints_reject_invalid_payloads(self):
        missing = dict(VALID_PAYLOAD)
        missing.pop("carrier")

        response = self.client.post("/api/ml/predict", json=missing)
        duration_response = self.client.post(
            "/api/ml/predict/duration",
            json={"not_a_feature": "invalid"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("carrier", response.get_json()["error"])
        self.assertEqual(duration_response.status_code, 400)

    def test_prediction_endpoints_return_model_outputs(self):
        response = self.client.post("/api/ml/predict", json=VALID_PAYLOAD)
        duration_response = self.client.post(
            "/api/ml/predict/duration",
            json=VALID_PAYLOAD,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(duration_response.status_code, 200)
        self.assertIn("predicted_late", response.get_json())
        self.assertIn("predicted_days", duration_response.get_json())


if __name__ == "__main__":
    unittest.main()
