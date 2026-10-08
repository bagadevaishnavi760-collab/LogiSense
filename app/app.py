import csv
import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash

from .ml_predict import predict, predict_duration


app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("LOGISENSE_SECRET_KEY", "dev-only-change-this-secret")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
ROOT_DIR = Path(__file__).resolve().parent.parent
FACT_DELIVERY_PATH = ROOT_DIR / "data" / "processed" / "fact_delivery.csv"
MODEL_METADATA_PATH = ROOT_DIR / "models" / "model_metadata.json"
MODEL_PATHS = (
    ROOT_DIR / "models" / "late_delivery_risk_model.joblib",
    ROOT_DIR / "models" / "delivery_time_model.joblib",
)

# Demo identities are intentionally isolated from production identity storage.
# Replace this in production with the deployment's identity provider.
DEMO_USERS = {
    "admin@logisense.local": {
        "id": "admin-demo",
        "role": "ADMIN",
        "email": "admin@logisense.local",
        "password_hash": "scrypt:32768:8:1$VBY6pP8vUbSX4f9g$8fedc422b4c68eb01a91cc61b4e4b8769efb196325a58170ba259a6117025499784a8861342e8dd97b50661f73f4f3ad3ad7baf3cbd38ffb8cb02e0dd43ffe72",
    },
    "customer@logisense.local": {
        "id": "customer-demo",
        "role": "CUSTOMER",
        "email": "customer@logisense.local",
        "customer_id": "CUS-000001",
        "password_hash": "scrypt:32768:8:1$KbYGPIKNi1cnqynJ$bae2ca8e52f8e09ffa03cd7f4cfd677b73b90021082c14a6d72cfa301b71c010c1fd60ac72efdfa8191b4606ef828f7fee5951756cc5a4e65f03d62f20200f81",
    },
}


def public_user(user):
    return {key: value for key, value in user.items() if key not in {"password_hash"}}


@app.get("/api/auth/session")
def auth_session():
    user = session.get("user")
    return jsonify({"user": user})


@app.post("/api/auth/login")
def auth_login():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    identifier = str(payload.get("identifier", "")).strip().lower()
    password = payload.get("password")
    if not identifier or not isinstance(password, str):
        return jsonify({"error": "Email or username and password are required."}), 400
    user = DEMO_USERS.get(identifier)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials."}), 401
    safe_user = public_user(user)
    session["user"] = safe_user
    return jsonify({"user": safe_user})


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"user": None})


@app.get("/api/health")
def health():
    warehouse_available = FACT_DELIVERY_PATH.is_file()
    rows = 0
    if warehouse_available:
        with FACT_DELIVERY_PATH.open("r", encoding="utf-8", newline="") as handle:
            rows = max(sum(1 for _ in csv.reader(handle)) - 1, 0)
    models_available = int(all(path.is_file() for path in MODEL_PATHS))
    metadata_available = MODEL_METADATA_PATH.is_file()
    return jsonify({
        "status": "ok" if warehouse_available and models_available and metadata_available else "degraded",
        "version": "backend",
        "warehouse": "available" if warehouse_available else "unavailable",
        "rows": rows,
        "models": models_available * len(MODEL_PATHS),
    })


@app.post("/api/ml/predict")
@app.post("/ml/predict")
def ml_prediction():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    try:
        return jsonify(predict(payload))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except FileNotFoundError:
        return jsonify({"error": "The persisted classification model is unavailable."}), 503
    except Exception:
        app.logger.exception("Saved model inference failed")
        return jsonify({
            "error": "The classification model could not produce a prediction.",
            "code": "classification_inference_failed",
            "details": "Check the backend logs for the underlying inference exception.",
        }), 500


@app.post("/api/ml/predict/duration")
@app.post("/ml/predict/duration")
def ml_duration_prediction():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    try:
        return jsonify(predict_duration(payload))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except FileNotFoundError:
        return jsonify({"error": "The persisted regression model is unavailable."}), 503
    except Exception:
        app.logger.exception("Saved delivery-time model inference failed")
        return jsonify({
            "error": "The delivery-time model could not produce a forecast.",
            "code": "regression_inference_failed",
            "details": "Check the backend logs for the underlying inference exception.",
        }), 500


@app.route("/")
def dashboard():
    return render_template("dashboard.html")


@app.route("/analytics")
def analytics():
    return render_template("analytics.html")


@app.route("/prediction")
def prediction():
    return render_template("prediction.html")


@app.route("/olap")
def olap():
    return render_template("olap.html")


@app.route("/admin")
def admin():
    return render_template("admin.html")


if __name__ == "__main__":
    app.run(debug=True)
    