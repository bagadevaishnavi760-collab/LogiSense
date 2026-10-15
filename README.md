# LogiSense

### Intelligent Supply Chain & Delivery Analytics Platform

LogiSense is an end-to-end Data Warehousing and Mining platform designed to help logistics teams analyze delivery performance, explore warehouse data through OLAP operations, and predict delivery risks using machine learning.

---

## 🚀 Overview

LogiSense combines:

- Data Warehousing
- ETL pipelines
- Star Schema dimensional modeling
- OLAP analysis
- Data visualization
- Machine Learning
- Classification
- Regression
- Clustering
- Association Rule Mining
- Anomaly Detection
- Executive analytics
- Interactive React dashboard
- Flask ML/API backend

The platform uses a 50,000-row e-commerce delivery dataset to transform raw logistics data into actionable operational intelligence.

---

## 🎯 Key Objectives

LogiSense was built to answer practical supply-chain questions such as:

- Which deliveries are most likely to be late?
- Which carriers perform best?
- Which warehouses have operational issues?
- How does shipping method affect delivery performance?
- Which customer segments experience more delays?
- What factors influence delivery time?
- Are there unusual delivery patterns or anomalies?
- What combinations of logistics attributes frequently occur together?
- How can historical delivery data support operational decisions?

---

## 🏗️ System Architecture

```text
Raw E-Commerce Delivery Data
            │
            ▼
       Data Cleaning
            │
            ▼
        ETL Pipeline
            │
            ▼
      Star Schema DWH
            │
     ┌──────┴──────┐
     ▼             ▼
   OLAP           ML
 Analysis       Pipeline
     │             │
     ▼             ▼
Analytics      Predictions
     │             │
     └──────┬──────┘
            ▼
     Flask REST API
            │
            ▼
      React Dashboard
```

## Model evaluation

The production classification and regression artifacts are reproducibly trained
with [`ml/train_models.py`](./ml/train_models.py). The trainer uses one
stratified 80/20 holdout split, three-fold cross-validation on the training
partition, and preprocessing fitted inside each pipeline. Delivery outcomes
and post-delivery tracking fields are excluded from model inputs. Candidate
metrics, hyperparameters, dataset sizes, thresholds, confusion matrix, model
selection rationale, and the training timestamp are stored in
[`models/model_metadata.json`](./models/model_metadata.json) and served by
`GET /api/ml/metadata`.

The Model Monitoring page compares all evaluated candidates. Its metrics are
estimates on the held-out test set and may vary on future deliveries.

The current audit found 50,000 unique rows and order IDs, no missing model
features or targets, and 41,375 missing values only in the excluded
`return_reason` field. The late-delivery target contains 28,162 late and
21,838 on-time deliveries (56.324% positive), so class weighting was tested
only inside training folds. Pre-delivery engineered ratios and logarithmic
features were also tested, but were not adopted because they reduced F1,
ROC-AUC, or regression error trade-offs on the controlled holdout.
