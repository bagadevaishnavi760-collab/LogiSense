"""Safe inference wrapper for the persisted late-delivery classifier."""

import json
from pathlib import Path
from functools import lru_cache
from typing import Any

import joblib
import pandas as pd


MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
CLASSIFICATION_MODEL_PATH = MODEL_DIR / "late_delivery_risk_model.joblib"
REGRESSION_MODEL_PATH = MODEL_DIR / "delivery_time_model.joblib"
MODEL_METADATA_PATH = MODEL_DIR / "model_metadata.json"

FEATURES = [
    "customer_segment",
    "customer_city",
    "customer_country",
    "warehouse_id",
    "warehouse_city",
    "product_category",
    "product_weight_kg",
    "order_value_usd",
    "shipping_method",
    "carrier",
    "distance_km",
    "promised_delivery_days",
    "shipping_cost_usd",
    "package_size",
    "payment_method",
    "order_year",
    "order_month",
    "order_day",
    "order_dayofweek",
    "order_is_weekend",
]

CATEGORICAL_FEATURES = {
    "customer_segment",
    "customer_city",
    "customer_country",
    "warehouse_id",
    "warehouse_city",
    "product_category",
    "shipping_method",
    "carrier",
    "package_size",
    "payment_method",
}

NUMERIC_RANGES = {
    "product_weight_kg": (0.1, 52.2),
    "order_value_usd": (10, 3530.7),
    "distance_km": (40, 9553.6),
    "promised_delivery_days": (0, 15),
    "shipping_cost_usd": (4, 500),
    "order_year": (2000, 2100),
    "order_month": (1, 12),
    "order_day": (1, 31),
    "order_dayofweek": (0, 6),
}

_models: dict[str, Any] = {}


@lru_cache(maxsize=1)
def _metadata() -> dict[str, Any]:
    with MODEL_METADATA_PATH.open("r", encoding="utf-8") as handle:
        metadata = json.load(handle)
    if not isinstance(metadata, dict):
        raise ValueError("Model metadata must be a JSON object.")
    return metadata


def _load_model(kind: str) -> Any:
    if kind not in _models:
        path = CLASSIFICATION_MODEL_PATH if kind == "classification" else REGRESSION_MODEL_PATH
        _models[kind] = joblib.load(path)
    return _models[kind]


def _validated_frame(payload: dict[str, Any]) -> tuple[pd.DataFrame, dict[str, Any]]:
    received = set(payload)
    expected = set(FEATURES)
    missing = sorted(expected - received)
    unknown = sorted(received - expected)
    if missing:
        raise ValueError(f"Missing model inputs: {', '.join(missing)}")
    if unknown:
        raise ValueError(f"Unsupported model inputs: {', '.join(unknown)}")

    row: dict[str, Any] = {}
    for feature in FEATURES:
        value = payload[feature]
        if feature in CATEGORICAL_FEATURES:
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{feature} must be a non-empty string")
            row[feature] = value
        elif feature == "order_is_weekend":
            if not isinstance(value, bool):
                raise ValueError("order_is_weekend must be boolean")
            row[feature] = value
        else:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{feature} must be numeric")
            lower, upper = NUMERIC_RANGES[feature]
            if not lower <= float(value) <= upper:
                raise ValueError(f"{feature} must be between {lower} and {upper}")
            row[feature] = float(value)

    return pd.DataFrame([row], columns=FEATURES), row


def predict(payload: dict[str, Any]) -> dict[str, Any]:
    frame, row = _validated_frame(payload)
    model = _load_model("classification")
    threshold = float(_metadata()["classification_threshold"])
    probability = float(model.predict_proba(frame)[0][1])
    flagged = probability >= threshold
    if probability >= 0.68:
        risk_level = "Critical"
    elif probability >= 0.55:
        risk_level = "High"
    elif flagged:
        risk_level = "Moderate"
    else:
        risk_level = "Low"

    return {
        "probability": round(probability, 6),
        "late_probability": round(probability * 100, 2),
        "predicted_late": flagged,
        "risk_level": risk_level,
        "threshold": threshold,
        "confidence": round(max(probability, 1 - probability) * 100, 2),
        "model": "Late Delivery Risk Classifier",
        "features": row,
    }


def predict_duration(payload: dict[str, Any]) -> dict[str, Any]:
    frame, row = _validated_frame(payload)
    model = _load_model("regression")
    regression_metrics = _metadata().get("regression_holdout_metrics", {})
    mae = float(regression_metrics["MAE"])
    predicted_days = max(0.0, float(model.predict(frame)[0]))
    return {
        "predicted_days": round(predicted_days, 2),
        "mae": round(mae, 4),
        "low_days": round(max(0.0, predicted_days - mae), 2),
        "high_days": round(predicted_days + mae, 2),
        "model": "Delivery Time Estimator",
        "features": row,
    }