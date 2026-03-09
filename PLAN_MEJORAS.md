# 📋 Plan de Mejoras y Contexto para la IA - eSports Analytics Dashboard

Este documento contiene el roadmap oficial del proyecto y el contexto técnico para que la IA (Antigravity) asista eficientemente en el desarrollo.

---

## 🤖 Instrucciones y Contexto para la IA (Antigravity)

### 0. Metodología de Trabajo Estricta (Fase por Fase)
La IA **NUNCA** debe avanzar a la siguiente sección sin autorización del usuario. El flujo de trabajo innegociable es el siguiente:
1.  **Entender:** Leer los archivos necesarios y las instrucciones completas aplicables a la tarea actual.
2.  **Planificar:** Leer el `PLAN_MEJORAS.md` y generar el plan de implementación.
3.  **Implementar:** Codificar basándose estrictamente en las reglas (Skills ASH) instaladas.
4.  **Validar/Testear:** Levantar servidor, revisar outputs, depurar, correr tests correspondientes.
5.  **Entregar y Esperar:** Notificar al usuario que la tarea/fase finalizó y esperar su comando ("OK, siguiente fase") antes de continuar con otro punto del checklist.

### 1. Servidor MCP Configurado (`toolbox-db`)
Actualmente existe un servidor MCP configurado y funcionando que conecta directamente la IA con la base de datos MySQL local (`esportsespol`).

*   **Lo que está hecho:** El archivo `mcp_config.json` de Antigravity está configurado usando el transporte `--stdio` y `--prebuilt mysql` con las credenciales pasadas por variables de entorno.
*   **Cuándo usarlo:** La IA **DEBE** usar las herramientas de este MCP cada vez que se requiera interactuar con la base de datos durante el desarrollo de las mejoras (ej. verificar esquemas, probar las consultas del ETL, revisar índices antes de hacer el paso a Python).
*   **Herramientas Disponibles (6/6):**
    1.  `list_active_queries`: Lista queries activas.
    2.  `get_query_plan`: Analiza el plan de ejecución de un SQL (EXPLAIN).
    3.  `list_tables`: Muestra el esquema detallado de las tablas (columnas, tipos, constraints).
    4.  `list_tables_missing_unique_indexes`: Encuentra tablas sin primary/unique keys.
    5.  `list_table_fragmentation`: Analiza la fragmentación de las tablas.
    6.  `execute_sql`: Ejecuta consultas SQL en la base de datos real.

### 2. Servidor MCP Configurado (`github`)
También existe un segundo servidor MCP configurado que conecta a la IA directamente con la plataforma de GitHub.

*   **Lo que está hecho:** El archivo `mcp_config.json` incluye el binario oficial de GitHub MCP Server, autenticado con un PAT y con el toolset `default` habilitado (optimizando la cantidad de herramientas).
*   **Cuándo usarlo:** La IA **DEBE** usar las herramientas de este MCP para **automatizar el flujo de Git**.
*   **Casos de uso clave:**
    1.  **Repository Management:** Consultar código, ramas y estructura del repositorio.
    2.  **Branching & Commits:** Crear automáticamente las ramas definidas en el plan (`feat/data-pipeline`, `feat/dashboard-upgrade`) y realizar los commits de las mejoras.
    3.  **Pull Requests:** Abrir, actualizar y gestionar Pull Requests cuando una mejora o rama esté lista.

    3.  **Pull Requests:** Abrir, actualizar y gestionar Pull Requests cuando una mejora o rama esté lista.

### 3. Reglas de Senior Dev (Awesome Skills Hub - ASH)
El proyecto cuenta con comportamientos de IA preconfigurados en la carpeta `.agent/skills/` (y vinculados al resto de IDEs).
*   **Lo que está hecho:** Las reglas están inicializadas.
*   **Cuándo usarlo:** La IA **DEBE LEER SIEMPRE** las skills relevantes antes de programar en un área.
*   **Skills Instaladas:**
    *   `data-engineering`: Para todo desarrollo en Python y Pandera (ETL, Clean Code, Tipo de errores DB).
    *   `frontend-design`: Reglas para crear visuales llamativas (SVG, accesibilidad, CSS pro).
    *   `webapp-testing`: Reglas de validación y testeo web (Responsive, DOM checks).
    *   `ui-ux-pro-max`: Directrices del sistema de diseño inicial.

### 4. Extensiones Recomendadas (IDE)
Para facilitar el desarrollo y análisis, se deben tener instaladas y utilizar las siguientes extensiones en el entorno local (VS Code/Cursor):
*   **SQLTools:** Para la administración y consultas directas a MySQL de forma visual.
*   **DuckDB:** Para análisis analítico rápido, exploración de archivos planos (CSV, JSON, Parquet) y manipulación de datos off-memory.
*   *Nota para la IA:* Cuando propongas pasos de depuración manual o consultas ad-hoc, ten en cuenta que el usuario cuenta con estas dos potentes extensiones como apoyo.

---

## ✅ Acuerdos Finales — Checklist de Mejoras

### 📦 Estructura del Proyecto
- [x] Reorganizar carpetas a nivel profesional/industria: `src/frontend/`, `src/etl/`, `data/raw/`, `data/processed/`, `tests/`, `database/queries/`

### 🌿 Branching & Commits
- [x] **Rama 1**: `feat/data-pipeline` (mejoras 1-3 del backend/pipeline)
- [ ] **Rama 2**: `feat/dashboard-upgrade` (mejoras 4-8 del frontend/UI)
- [ ] Cada mejora = **1 commit** con mensajes profesionales en inglés (`feat:`, `fix:`, `refactor:`)
- [ ] Primero se mergea rama 1, después se trabaja rama 2

### 🔴 Mejoras Prioridad ALTA (Rama 1: `feat/data-pipeline`)
1. [x] **ETL Automatizado con Python** — Script que conecte MySQL → ejecute queries → genere `datos-dashboard.json`.
2. [x] **Data Quality Gates con Pandera** — Validación de datos antes del deploy (winrates 0-100%, premios no negativos, etc.).
3. [ ] **CI/CD con GitHub Actions** — Workflow automático: ETL → Validación → Deploy a GitHub Pages.

### 🟡 Mejoras Prioridad MEDIA (Rama 2: `feat/dashboard-upgrade`)
4. [ ] **Fix Bugs** — Links rotos del Author Section + KPIs responsive (no colapsen en columna).
5. [ ] **Nuevas Visualizaciones** — Radar chart (`trabajo_en_equipo`), gráfico roles (Titular vs Suplente), tabla veteranos, scatter plot (edad ↔ performance).
6. [ ] **Navegación + Filtros** — Navbar sticky con anclas, filtros por país/competencia, buscador de jugadores.
7. [ ] **Rediseño UI/UX** — Design system con skill `ui-ux-pro-max`, SVG flags en vez de emojis, counter animations en KPIs, accesibilidad (ARIA, keyboard nav).
8. [ ] **Predicciones ML** — Modelo Scikit-Learn para predecir winrate 2026, sección "Predicciones 2026" en el dashboard.

### 🔤 Idioma
- [ ] **Código** (variables, funciones, keys JSON, comentarios): Todo en **inglés** (el que ya está, se mantiene; lo nuevo, en inglés; migrar keys del JSON a inglés).
- [ ] **UI visible** (textos del dashboard, labels, títulos): En **español** porque es LATAM.
- [ ] **README**: En **español**.

### 📝 README
- [ ] Se actualiza **al final** de todas las mejoras, con la estructura definida.

### 💬 Comentarios del Código
- [ ] Están bien como están, no parecen IA, no se tocan.
