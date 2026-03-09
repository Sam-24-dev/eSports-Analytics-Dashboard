# 🎮 eSports Analytics Dashboard

Dashboard interactivo para análisis de datos de eSports, con pipeline ETL automatizado y deploy continuo.

## 📁 Estructura del Proyecto

```
eSports-Analytics-Dashboard/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD: ETL → Validación → Deploy
├── database/
│   ├── schema.sql              # Schema MySQL + datos (9 tablas)
│   └── queries/
│       └── consultas_analiticas.sql  # Queries analíticas
├── src/
│   ├── etl/
│   │   ├── pipeline.py         # ETL: MySQL → JSON
│   │   ├── validators.py       # Data Quality Gates
│   │   ├── requirements.txt    # Dependencias Python
│   │   └── .env.example        # Template de credenciales
│   └── frontend/
│       ├── index.html          # Dashboard principal
│       └── assets/
│           ├── css/style.css
│           ├── js/main.js
│           └── data/
│               └── datos-dashboard.json  # Datos generados por ETL
├── data/
│   ├── raw/                    # Datos crudos (gitignored)
│   └── processed/              # Datos procesados (gitignored)
├── docs/
│   └── ARCHITECTURE.md         # Documentación técnica
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Requisitos
- Python 3.10+
- MySQL 8.0+
- Node.js (opcional, para servidor local)

### 1. Configurar Base de Datos
```bash
mysql -u root -p < database/schema.sql
```

### 2. Configurar Variables de Entorno
```bash
cd src/etl
cp .env.example .env
# Editar .env con tus credenciales MySQL
```

### 3. Instalar Dependencias
```bash
pip install -r src/etl/requirements.txt
```

### 4. Ejecutar ETL Pipeline
```bash
cd src/etl
python pipeline.py
```

Esto genera `src/frontend/assets/data/datos-dashboard.json`.

### 5. Ver Dashboard
Abrir `src/frontend/index.html` en el navegador, o usar:
```bash
cd src/frontend
python -m http.server 8000
```

## 🔄 Pipeline ETL

```
MySQL → EXTRACT (9 queries) → VALIDATE (Data Quality Gates) → TRANSFORM → LOAD (JSON)
```

### Data Quality Gates
El pipeline valida **antes** de generar el JSON:

| Validación | Regla |
|---|---|
| Win rates | 0% ≤ valor ≤ 100% |
| Premios | ≥ 0 (no negativos) |
| Roles | Solo "Titular" o "Suplente" |
| Edades | 15 ≤ edad ≤ 50 |
| Equipos | ≥ 1 por país |
| Competencias | Solo "Nacional" o "Internacional" |

Si alguna validación falla, el pipeline **se detiene** y muestra el error.

## 🔧 CI/CD (GitHub Actions)

Al hacer `push` a `main`, el workflow automáticamente:
1. Levanta MySQL temporal con los datos del `schema.sql`
2. Ejecuta el pipeline ETL completo
3. Valida la calidad de datos
4. Deploya el frontend a GitHub Pages

**URL del Dashboard:** [https://sam-24-dev.github.io/eSports-Analytics-Dashboard/](https://sam-24-dev.github.io/eSports-Analytics-Dashboard/)

## 🛠️ Tech Stack

| Componente | Tecnología |
|---|---|
| Base de Datos | MySQL 8.0 |
| ETL Pipeline | Python 3.12 + Pandas |
| Data Quality | Pandas Assertions |
| Frontend | HTML5 + CSS3 + Chart.js |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

## 📊 Datos Analizados

- **9 tablas MySQL**: países, equipos, jugadores, competencias, partidos, estadísticas
- **6 queries analíticas**: KPIs, rankings, tendencias, roles, veteranos, métricas
- **8 secciones del dashboard**: KPIs, ranking países, top jugadores, evolución, roles, equipos, competencias, veteranos
