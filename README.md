# STRATA — Atmospheric Atlas · Valencia

**A data-driven platform for exploring how air quality, meteorology, pollutant transport, and atmospheric events interact across space and time in Valencia.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Data: CC BY 4.0](https://img.shields.io/badge/Data-CC%20BY%204.0-lightgrey.svg)](https://opendata.vlci.valencia.es)
[![Pipeline: Python 3.12](https://img.shields.io/badge/Python-3.12-green.svg)](https://python.org)

🌐 **Live portfolio:** [aaronmartinez-env.github.io/STRATA/strata_portfolio.html](https://aaronmartinez-env.github.io/STRATA/strata_portfolio.html)

📄 **View portfolio file directly:** [strata_portfolio.html](strata_portfolio.html)

---

## What STRATA is

STRATA is an exploratory atmospheric interpretation framework — not a replacement for official AQI systems. It quantifies divergence between simplified public-facing air quality indices (typically PM10-only) and a custom multi-pollutant composite index (CMPI), applied to real observations from Valencia's RVVCCA monitoring network across multiple datasets and years.

The portfolio holds two parallel datasets:

| Dataset | Source | Resolution | Coverage | Key event |
|---------|--------|------------|----------|-----------|
| 2021–2022 | Open Data Valencia | Hourly | 160,076 station-hours · 12 stations | Saharan calima episodes |
| 2024 | Generalitat Valenciana | Daily averages | 2,541 station-days · 7 stations | October 29 DANA flood |

---

## Key findings

### 2021–2022 Hourly Dataset

| Finding | Value |
|---------|-------|
| Mean CMPI divergence | 4.22 index pts |
| Max single-hour gap | 50.72 index pts |
| Peak divergence hour | 06:00 (nocturnal NO₂ accumulation) |
| NO₂ correlation with divergence | r = 0.38 |
| Calima hours detected | 2,591 (1.62% of obs.) |
| Public over-reads during calima | 35.8% of calima hours |
| Max hourly PM10 | 460 µg/m³ at Valencia Olivereta |
| Mean ACI | 0.743 |

### 2024 Daily Dataset

| Finding | Value |
|---------|-------|
| Mean CMPI divergence | 9.89 index pts (daily resolution) |
| Max single-day gap | 23.97 index pts |
| Peak season | Summer |
| Primary correlate | PM2.5 (r = 0.56) |
| Calima days detected | 32 (25 unique dates) |
| DANA event days | 19 (Oct 29 – Dec 15 window) |
| Max daily PM10 | 162 µg/m³ at Centro |
| Mean ACI | 0.527 |

All values are pipeline-derived from real observational data. No values are manually hardcoded in the frontend.

---

## Research questions

> How accurately do public AQI representations reflect actual atmospheric conditions in Valencia?

> How does the representational gap differ between Saharan mineral dust (calima) and flood-derived terrestrial resuspension (DANA)?

---

## Data sources

| Dataset | Publisher | URL | Licence | Resolution |
|---------|-----------|-----|---------|------------|
| RVVCCA 2021–2022 hourly | Ajuntament de València | [opendata.vlci.valencia.es](https://opendata.vlci.valencia.es) | CC BY 4.0 | Hourly |
| RVVCCA 2024 daily | Generalitat Valenciana | [dadesobertes.gva.es](https://dadesobertes.gva.es) | CC BY 4.0 | Daily averages |

Data files are git-ignored. Download automatically by running the pipeline.

---

## Project structure

```
STRATA/
├── src/
│   ├── run_pipeline.py           # Main entry point — 9-step pipeline
│   ├── rvvcca_ingestion.py       # Downloads 2021-2022 hourly data
│   ├── rvvcca_ingestion_2024.py  # Downloads 2024 daily data (12 monthly CSVs)
│   ├── data_loader.py
│   ├── preprocessing.py
│   ├── aqi_model.py              # CMPI: PM2.5×0.4 + PM10×0.3 + NO₂×0.2 + O₃×0.1
│   ├── events.py                 # Calima + DANA event detection
│   ├── air_mass.py               # Regime classification
│   ├── attribution.py            # Source attribution scoring
│   ├── complexity.py             # Atmospheric Complexity Index (ACI)
│   ├── analysis.py               # Deep analysis → findings JSON
│   ├── inject_findings.py        # Injects findings into portfolio HTML
│   ├── spatial.py
│   ├── interpolation.py
│   ├── wind.py
│   ├── reporting.py
│   └── synthetic_data.py
├── data/
│   ├── raw/                      # Downloaded CSVs (git-ignored)
│   └── processed/                # Pipeline output (git-ignored)
├── outputs/
│   └── reports/                  # strata_findings.json · aeris_findings.json
├── strata_portfolio.html         # Two-tab interactive portfolio
├── requirements.txt
└── README.md
```

---

## Pipeline

```bash
# Download 2024 daily data and run full pipeline
python src/run_pipeline.py --fetch

# Run on cached data
python src/run_pipeline.py

# Inject findings into portfolio (run after pipeline)
python src/inject_findings.py --dataset 2024 --findings outputs/reports/strata_findings.json
python src/inject_findings.py --dataset 2122 --findings outputs/reports/aeris_findings.json

# Download 2024 data only (inspect before running pipeline)
python src/rvvcca_ingestion_2024.py
```

---

## Methodology notes

### CMPI weights

| Pollutant | Weight | Rationale |
|-----------|--------|-----------|
| PM2.5 | 40% | WHO 2021 relative emphasis |
| PM10 | 30% | Spanish regulatory monitoring emphasis |
| NO₂ | 20% | Urban combustion sources |
| O₃ | 10% | Secondary photochemical pollution |

### Calima detection (2021–2022 hourly)
```
Criterion 1: PM10 > (72-hour rolling station mean + 1.5σ)
Criterion 2: PM10 / PM2.5 ratio > 3.0
Both must be satisfied simultaneously per station-hour
```

### Calima detection (2024 daily)
```
Criterion 1: PM10 > (7-day rolling station mean + 1.5σ) OR PM10 > 50 µg/m³
Criterion 2: PM10 / PM2.5 ratio > 3.0
```

### DANA detection (2024 daily)
```
Window    : October 29 – December 15, 2024
Criterion 1: PM10 > 30 µg/m³ daily average
Criterion 2: PM10 / PM2.5 ratio > 2.5
Precedence: Calima classification takes priority when both fire simultaneously
```

### ACI
Shannon entropy over four source attribution scores, normalised by ln(4). Heuristic research construct — not calibrated against PMF or receptor modelling.

---

## Installation

```bash
git clone https://github.com/aaronmartinez-env/STRATA.git
cd STRATA
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python src/run_pipeline.py --fetch
```

---

## References

- European Parliament (2008). Directive 2008/50/EC. *Official Journal of the European Union.*
- WHO (2021). *Global Air Quality Guidelines.* Geneva: WHO.
- Rodríguez et al. (2001). *Atmospheric Environment, 35*(14), 2433–2447.
- Escudero et al. (2005). *Atmospheric Environment, 39*(26), 4796–4808.
- Millán et al. (2000). *Journal of Geophysical Research: Atmospheres, 105*(D6), 7209–7236.
- Shannon (1948). *Bell System Technical Journal, 27*(3), 379–423.
- EEA (2023). *Air Quality in Europe 2023.* Copenhagen: EEA.

---

## Reproducibility

Every scientific value in `strata_portfolio.html` flows from real observational data through the pipeline:

```
data/raw/ → pipeline → outputs/reports/strata_findings.json
         → inject_findings.py --dataset [2122|2024]
         → strata_portfolio.html
```

No scientific values are hardcoded in the frontend. The data block is timestamped on every pipeline run.

---

## Licence

- **Code:** MIT License
- **Data:** CC BY 4.0 — Ajuntament de València / Generalitat Valenciana
- **Portfolio:** free to view and share with attribution

---

*STRATA — Atmospheric Atlas · Aaron Martinez · Environmental Sciences, Universitat de València · CEAM–EUPHORE internship · 2026*
