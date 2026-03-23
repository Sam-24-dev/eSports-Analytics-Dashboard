# eSports Analytics Dashboard LATAM

<div align="center">

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-Dashboard-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![ML](https://img.shields.io/badge/ML-Random_Forest-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)
![Data](https://img.shields.io/badge/Data-Contracts-6D28D9?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

<br>

<a href="https://sam-24-dev.github.io/eSports-Analytics-Dashboard/">
  <img src="https://img.shields.io/badge/Live_Demo-View_Dashboard-0078D4?style=for-the-badge&logo=github&logoColor=white" alt="Live Demo" />
</a>
<a href="https://github.com/Sam-24-dev/eSports-Analytics-Dashboard">
  <img src="https://img.shields.io/badge/GitHub-View_Code-181717?style=for-the-badge&logo=github&logoColor=white" alt="Repository" />
</a>

</div>

---

## Project Overview

| Challenge | Solution | Impact |
|---|---|---|
| eSports LATAM performance data is fragmented across teams, players, competitions, and match results. | A MySQL -> Python ETL -> JSON bridge -> web dashboard pipeline consolidates the data into a single analytical product. | Teams, players, competitions, squad usage, experience, age-performance, and ML projections are explored in one consistent dashboard. |
| Frontend modules can easily break when dataset shape changes. | Data contracts, validators, expected-value helpers, and automated tests protect the JSON bridge. | Safer iterations on UX and analytics without destabilizing the app. |
| Predictive views are often disconnected from operational analytics. | A Random Forest layer projects annual player performance for 2026 and feeds a premium ML module. | Historical analysis and forward-looking projections live in the same product experience. |

---

## Key Metrics (Latest Snapshot)

| Metric | Value |
|---|---:|
| Teams analyzed | 15 |
| Active players | 33 |
| Countries represented | 8 |
| Competitions tracked | 5 |
| Total prize pool | $325,000 |
| ML projections generated | 33 |
| Automated tests in suite | 126 |

---

## What the Dashboard Covers

- KPI overview for the whole LATAM ecosystem
- Team comparison and contextual ranking panels
- Competition catalog and prize distribution
- Squad usage split: starters vs substitutes
- Team experience and veteran role analysis
- Age vs performance contextual module
- ML premium module: annual player projection for 2026

---

## Pipeline Architecture

```text
MySQL 8.0
  -> SQL extraction queries
  -> Python / pandas transformations
  -> validators + data contracts
  -> Random Forest predictor (ML projection 2026)
  -> JSON bridge (src/frontend/assets/data/datos-dashboard.json)
  -> Vanilla JS + Chart.js dashboard
  -> GitHub Pages deployment
```

### Delivery Flow

| Stage | Responsibility |
|---|---|
| Extract | Pull operational data from the relational MySQL model |
| Validate | Enforce business rules, ranges, required fields, and contract compliance |
| Transform | Build frontend-ready analytical modules and filter-ready datasets |
| Predict | Generate player-level 2026 annual projections and ML aggregates |
| Publish | Ship the static dashboard to GitHub Pages |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Data Source | MySQL 8.0 |
| ETL | Python, pandas, python-dotenv |
| Data Quality | Pandera, JSON Schema validators |
| Machine Learning | scikit-learn (RandomForestRegressor) |
| Frontend | HTML, CSS, Vanilla JavaScript, Chart.js |
| Testing | Python `unittest`, frontend regression tests |
| Delivery | GitHub Actions, GitHub Pages |

---

## Quick Start

```bash
# clone
git clone https://github.com/Sam-24-dev/eSports-Analytics-Dashboard.git
cd eSports-Analytics-Dashboard

# install ETL requirements
pip install -r src/etl/requirements.txt
pip install scikit-learn

# generate the dashboard snapshot
python src/etl/pipeline.py

# run tests
python -m unittest discover tests

# serve the frontend locally
python -m http.server 8000 --directory src/frontend
```

Open `http://127.0.0.1:8000/index.html` in your browser.

### Optional shortcuts

```bash
make etl
make test
make check-js
make serve
```

---

## Automation

### GitHub Actions
- `deploy.yml`
  - boots MySQL 8.0 in CI
  - loads `database/schema.sql`
  - runs `src/etl/pipeline.py`
  - uploads the generated static frontend
  - deploys the dashboard to GitHub Pages

---

## Project Structure

```text
eSports-Analytics-Dashboard/
|- .github/workflows/            # CI + GitHub Pages deploy
|- database/                     # MySQL schema and seed source
|- docs/                         # Architecture, validation, and module rules
|- src/
|  |- etl/                       # Pipeline, validators, expected values, contracts
|  |- frontend/                  # Static dashboard (HTML/CSS/JS + generated JSON)
|  \\- ml/                       # Predictor logic for annual projections
|- tests/                        # Python + frontend regression coverage
\\- README.md
```

---

## Author

<div align="center">

**Samir Caizapasto**  
*Junior Data Engineer & Analyst*  
ESPOL - Guayaquil, Ecuador

<div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
  <a href="https://portafolio-samir-tau.vercel.app/">
    <img src="https://img.shields.io/badge/Portfolio-Visit_Website-success?style=for-the-badge&logo=vercel&logoColor=white" alt="Portfolio" />
  </a>
  <a href="https://www.linkedin.com/in/samir-caizapasto/">
    <img src="https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn" />
  </a>
  <a href="mailto:samir.leonardo.caizapasto04@gmail.com">
    <img src="https://img.shields.io/badge/Email-Contact_Me-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Email" />
  </a>
  <a href="https://github.com/Sam-24-dev">
    <img src="https://img.shields.io/badge/GitHub-View_Profile-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />
  </a>
</div>

</div>

---

If you find this project useful, consider giving the repository a star.
