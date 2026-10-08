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
