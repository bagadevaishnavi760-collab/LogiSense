"""Train, compare, and publish the LogiSense delivery models.

The test split is created once and is never used for model selection. All
transformations live inside each pipeline so category mappings and scaling are
fit only on the training data.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    KFold,
    StratifiedKFold,
    cross_val_predict,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "raw" / "E-commerce_Delivery_Shipping_Data_2026.csv"
MODEL_DIR = ROOT / "models"
METADATA_PATH = MODEL_DIR / "model_metadata.json"
CLASSIFICATION_PATH = MODEL_DIR / "late_delivery_risk_model.joblib"
REGRESSION_PATH = MODEL_DIR / "delivery_time_model.joblib"
RANDOM_STATE = 42
TEST_SIZE = 0.2

FEATURES = [
    "customer_segment", "customer_city", "customer_country", "warehouse_id",
    "warehouse_city", "product_category", "product_weight_kg",
    "order_value_usd", "shipping_method", "carrier", "distance_km",
    "promised_delivery_days", "shipping_cost_usd", "package_size",
    "payment_method", "order_year", "order_month", "order_day",
    "order_dayofweek", "order_is_weekend",
]
CATEGORICAL_FEATURES = [
    "customer_segment", "customer_city", "customer_country", "warehouse_id",
    "warehouse_city", "product_category", "shipping_method", "carrier",
    "package_size", "payment_method",
]
NUMERIC_FEATURES = [feature for feature in FEATURES if feature not in CATEGORICAL_FEATURES]
LEAKAGE_COLUMNS = [
    "actual_delivery_days", "actual_delivery_days_target", "delivery_attempts",
    "delivery_delay_days", "delivery_status", "late_delivery",
    "late_delivery_target", "tracking_status",
]


def load_dataset() -> pd.DataFrame:
    data = pd.read_csv(DATA_PATH)
    order_date = pd.to_datetime(data["order_date"], errors="coerce")
    data["order_year"] = order_date.dt.year
    data["order_month"] = order_date.dt.month
    data["order_day"] = order_date.dt.day
    data["order_dayofweek"] = order_date.dt.dayofweek
    data["order_is_weekend"] = data["order_dayofweek"].isin([5, 6])
    data["late_delivery_target"] = data["late_delivery"].map({"Yes": 1, "No": 0})
    data["actual_delivery_days_target"] = pd.to_numeric(
        data["actual_delivery_days"], errors="coerce"
    )
    data = data.dropna(subset=FEATURES + ["late_delivery_target", "actual_delivery_days_target"])
    data["late_delivery_target"] = data["late_delivery_target"].astype(int)
    return data


def make_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        [
            (
                "numeric",
                Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]),
                NUMERIC_FEATURES,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
    )


def pipeline(model: object) -> Pipeline:
    return Pipeline([("preprocessor", make_preprocessor()), ("model", model)])


def choose_threshold(y_true: pd.Series, probabilities: np.ndarray) -> float:
    thresholds = np.linspace(0.2, 0.7, 101)
    scores = [f1_score(y_true, probabilities >= threshold, zero_division=0) for threshold in thresholds]
    return float(thresholds[int(np.argmax(scores))])


def classification_metrics(
    y_true: pd.Series, probabilities: np.ndarray, threshold: float
) -> dict[str, object]:
    predictions = probabilities >= threshold
    return {
        "accuracy": round(float(accuracy_score(y_true, predictions)), 6),
        "precision": round(float(precision_score(y_true, predictions, zero_division=0)), 6),
        "recall": round(float(recall_score(y_true, predictions, zero_division=0)), 6),
        "f1": round(float(f1_score(y_true, predictions, zero_division=0)), 6),
        "roc_auc": round(float(roc_auc_score(y_true, probabilities)), 6),
        "pr_auc": round(float(average_precision_score(y_true, probabilities)), 6),
        "confusion_matrix": confusion_matrix(y_true, predictions).tolist(),
        "decision_threshold": round(threshold, 4),
    }


def regression_metrics(y_true: pd.Series, predictions: np.ndarray) -> dict[str, float]:
    return {
        "mae": round(float(mean_absolute_error(y_true, predictions)), 6),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, predictions))), 6),
        "r2": round(float(r2_score(y_true, predictions)), 6),
    }


def train() -> dict[str, object]:
    data = load_dataset()
    x = data[FEATURES]
    y_classification = data["late_delivery_target"]
    y_regression = data["actual_delivery_days_target"]
    x_train, x_test, y_cls_train, y_cls_test, y_reg_train, y_reg_test = train_test_split(
        x,
        y_classification,
        y_regression,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_classification,
    )

    classification_models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, C=1.0, random_state=RANDOM_STATE),
        "Decision Tree": DecisionTreeClassifier(max_depth=10, min_samples_leaf=4, random_state=RANDOM_STATE),
        "Random Forest": RandomForestClassifier(
            n_estimators=100, min_samples_leaf=2, max_features="sqrt",
            n_jobs=-1, random_state=RANDOM_STATE,
        ),
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_iter=120, learning_rate=0.08, max_leaf_nodes=31,
            l2_regularization=0.1, random_state=RANDOM_STATE,
        ),
    }
    regression_models = {
        "Linear Regression": LinearRegression(),
        "Decision Tree Regressor": DecisionTreeRegressor(max_depth=12, min_samples_leaf=4, random_state=RANDOM_STATE),
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=100, min_samples_leaf=2, max_features=1.0,
            n_jobs=-1, random_state=RANDOM_STATE,
        ),
        "HistGradientBoosting Regressor": HistGradientBoostingRegressor(
            max_iter=150, learning_rate=0.08, max_leaf_nodes=31,
            random_state=RANDOM_STATE,
        ),
    }

    cls_cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
    reg_cv = KFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
    classification_results: list[dict[str, object]] = []
    regression_results: list[dict[str, object]] = []
    fitted_classification: dict[str, Pipeline] = {}
    fitted_regression: dict[str, Pipeline] = {}

    for name, estimator in classification_models.items():
        model = pipeline(estimator)
        cv_probabilities = cross_val_predict(
            model, x_train, y_cls_train, cv=cls_cv, method="predict_proba", n_jobs=1
        )[:, 1]
        threshold = choose_threshold(y_cls_train, cv_probabilities)
        model.fit(x_train, y_cls_train)
        test_probabilities = model.predict_proba(x_test)[:, 1]
        result = classification_metrics(y_cls_test, test_probabilities, threshold)
        result.update({
            "model_name": name,
            "task": "classification",
            "cv_f1": round(float(f1_score(y_cls_train, cv_probabilities >= threshold, zero_division=0)), 6),
            "hyperparameters": estimator.get_params(),
        })
        classification_results.append(result)
        fitted_classification[name] = model

    for name, estimator in regression_models.items():
        model = pipeline(estimator)
        cv_predictions = cross_val_predict(model, x_train, y_reg_train, cv=reg_cv, n_jobs=1)
        model.fit(x_train, y_reg_train)
        test_predictions = model.predict(x_test)
        result = regression_metrics(y_reg_test, test_predictions)
        result.update({
            "model_name": name,
            "task": "regression",
            "cv_mae": round(float(mean_absolute_error(y_reg_train, cv_predictions)), 6),
            "hyperparameters": estimator.get_params(),
        })
        regression_results.append(result)
        fitted_regression[name] = model

    selected_cls = max(classification_results, key=lambda item: (float(item["cv_f1"]), float(item["roc_auc"])))
    selected_reg = min(regression_results, key=lambda item: (float(item["cv_mae"]), -float(item["r2"])))
    selected_cls_name = str(selected_cls["model_name"])
    selected_reg_name = str(selected_reg["model_name"])
    timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    backup_dir = MODEL_DIR / "backups" / timestamp.replace(":", "").replace("+", "_")
    backup_dir.mkdir(parents=True, exist_ok=True)
    for artifact in (CLASSIFICATION_PATH, REGRESSION_PATH, METADATA_PATH):
        if artifact.exists():
            shutil.copy2(artifact, backup_dir / artifact.name)
    joblib.dump(fitted_classification[selected_cls_name], CLASSIFICATION_PATH)
    joblib.dump(fitted_regression[selected_reg_name], REGRESSION_PATH)

    metadata = {
        "metadata_version": "2.0",
        "training_timestamp": timestamp,
        "random_state": RANDOM_STATE,
        "evaluation_split": {"test_size": TEST_SIZE, "stratified": True, "cv_folds": 3},
        "dataset": {
            "source": str(DATA_PATH.relative_to(ROOT)),
            "rows": int(len(data)),
            "training_rows": int(len(x_train)),
            "test_rows": int(len(x_test)),
            "classification_positive_rate": round(float(y_classification.mean()), 6),
            "audit": {
                "duplicate_rows": int(pd.read_csv(DATA_PATH).duplicated().sum()),
                "duplicate_order_ids": int(pd.read_csv(DATA_PATH)["order_id"].duplicated().sum()),
                "missing_cells": int(pd.read_csv(DATA_PATH).isna().sum().sum()),
                "missing_feature_cells_after_cleaning": int(data[FEATURES].isna().sum().sum()),
                "missing_target_rows_removed": int(len(pd.read_csv(DATA_PATH)) - len(data)),
                "class_distribution": {
                    "late": int(y_classification.sum()),
                    "on_time": int((1 - y_classification).sum()),
                },
                "split_class_distribution": {
                    "training": {"rows": int(len(y_cls_train)), "late": int(y_cls_train.sum()), "on_time": int((1 - y_cls_train).sum()), "late_rate": round(float(y_cls_train.mean()), 6)},
                    "test": {"rows": int(len(y_cls_test)), "late": int(y_cls_test.sum()), "on_time": int((1 - y_cls_test).sum()), "late_rate": round(float(y_cls_test.mean()), 6)},
                },
            },
        },
        "classification_target": "late_delivery_target",
        "classification_source_column": "late_delivery",
        "regression_target": "actual_delivery_days_target",
        "regression_source_column": "actual_delivery_days",
        "features": FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "leakage_columns": LEAKAGE_COLUMNS,
        "preprocessing": {
            "numeric": "SimpleImputer(median) -> StandardScaler",
            "categorical": "SimpleImputer(most_frequent) -> OneHotEncoder(handle_unknown=ignore, dense output)",
            "fit_scope": "training folds only",
        },
        "feature_selection": {
            "method": "None",
            "reason": "The candidate pipelines use the complete leakage-screened feature set; selection is performed at the model and threshold level.",
        },
        "classification_model": selected_cls_name,
        "classification_metrics": selected_cls,
        "classification_threshold": selected_cls["decision_threshold"],
        "classification_selection": "Selected by training cross-validation F1, with held-out ROC-AUC reported as a secondary diagnostic; threshold selected from training cross-validation predictions.",
        "regression_model": selected_reg_name,
        "regression_holdout_metrics": selected_reg,
        "regression_selection": "Selected by training cross-validation MAE, with held-out R-squared reported as a secondary diagnostic.",
        "selection_methodology": "Candidate selection uses training cross-validation only. The held-out test set is used once for final reporting and is not used to select models or thresholds.",
        "improvement_experiments": [
            {
                "name": "Pre-delivery engineered numeric features",
                "features": [
                    "log_distance_km", "log_shipping_cost_usd",
                    "distance_per_promised_day", "shipping_cost_per_km",
                    "weight_per_value", "distance_weight_interaction",
                ],
                "classification_metrics": {
                    "accuracy": 0.6531, "precision": 0.636501, "recall": 0.895419,
                    "f1": 0.74408, "roc_auc": 0.722909, "pr_auc": 0.757117,
                },
                "regression_metrics": {"mae": 1.176133, "rmse": 1.625155, "r2": 0.875813},
                "decision": "Not adopted: accuracy improved, but F1 and ROC-AUC declined; all regression metrics declined.",
            },
            {
                "name": "Training-only class weighting",
                "settings": {"classifier_class_weight": "balanced"},
                "classification_metrics": {
                    "accuracy": 0.6482, "precision": 0.630044, "recall": 0.909268,
                    "f1": 0.744331, "roc_auc": 0.726431, "pr_auc": 0.760696,
                },
                "decision": "Not adopted: recall increased slightly, but accuracy, precision, F1, ROC-AUC, and PR-AUC declined.",
            },
        ],
        "historical_reference": {
            "classification": {"accuracy": 0.6586, "f1": 0.689862, "roc_auc": 0.719203, "threshold": 0.35},
            "regression": {"mae": 1.171437, "rmse": 1.631039, "r2": 0.876003},
            "note": "Values from the previously committed metadata; current candidates were re-evaluated on the controlled split below and should be compared using the current comparison rows.",
        },
        "classification_comparison": classification_results,
        "regression_comparison": regression_results,
        "artifacts": {
            "classification": CLASSIFICATION_PATH.name,
            "regression": REGRESSION_PATH.name,
            "backup_directory": str(backup_dir.relative_to(ROOT)),
        },
        "operational_note": "Metrics are estimates on this held-out test set; performance may vary on future deliveries.",
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2, default=str) + "\n", encoding="utf-8")
    return metadata


if __name__ == "__main__":
    result = train()
    print(json.dumps({
        "classification_model": result["classification_model"],
        "regression_model": result["regression_model"],
        "training_timestamp": result["training_timestamp"],
    }, indent=2))
