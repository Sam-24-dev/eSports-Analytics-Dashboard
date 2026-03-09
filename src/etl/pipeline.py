"""
eSports Analytics Dashboard — ETL Pipeline
===========================================
Extracts data from MySQL (esportsespol), transforms it into
dashboard-ready aggregations, and loads a JSON file consumed
by the frontend.

Usage:
    python pipeline.py
"""

import json
import logging
import os
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

import mysql.connector
import pandas as pd
from dotenv import load_dotenv
from mysql.connector import Error as MySQLError

# Ensure validators module is importable regardless of working directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validators import VALIDATOR_REGISTRY

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Resolve paths relative to this script
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent.parent
_OUTPUT_PATH = _PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
_ENV_PATH = _SCRIPT_DIR / ".env"

# Load environment variables
load_dotenv(_ENV_PATH)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("etl_pipeline")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class DecimalEncoder(json.JSONEncoder):
    """Encode ``Decimal`` and ``datetime`` objects for JSON serialisation."""

    def default(self, obj: object) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def _get_connection() -> mysql.connector.MySQLConnection:
    """Create and return a MySQL connection using env-var credentials.

    Returns:
        Active ``MySQLConnection`` instance.

    Raises:
        SystemExit: If the connection cannot be established.
    """
    try:
        conn = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "127.0.0.1"),
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
            database=os.getenv("MYSQL_DATABASE", "esportsespol"),
        )
        logger.info("Connected to MySQL database '%s'.", conn.database)
        return conn
    except MySQLError as exc:
        logger.error("Failed to connect to MySQL: %s", exc)
        sys.exit(1)


def _run_query(conn: mysql.connector.MySQLConnection, query: str) -> pd.DataFrame:
    """Execute *query* and return results as a ``DataFrame``.

    Args:
        conn: Active MySQL connection.
        query: SQL query string.

    Returns:
        DataFrame with query results.
    """
    df = pd.read_sql(query, conn)
    logger.info("Query returned %d rows, %d columns.", len(df), len(df.columns))
    return df


# ---------------------------------------------------------------------------
# EXTRACT — SQL Queries
# ---------------------------------------------------------------------------

_SQL_KPIS = """
SELECT
    (SELECT COUNT(*) FROM equipos)                              AS total_equipos,
    (SELECT COUNT(*) FROM jugadores)                            AS total_jugadores,
    (SELECT COALESCE(SUM(premio_obtenido), 0)
     FROM competencia_equipos)                                  AS total_premios,
    (SELECT COUNT(*) FROM paises)                               AS paises_representados,
    (SELECT COUNT(*) FROM competencias)                         AS competencias_activas,
    (SELECT ROUND(AVG(edad), 1) FROM jugadores)                 AS promedio_edad,
    (SELECT COUNT(*) FROM competencias
     WHERE tipo = 'Internacional')                              AS competencias_internacionales,
    (SELECT COUNT(*) FROM competencias
     WHERE tipo = 'Nacional')                                   AS competencias_nacionales
"""

_SQL_RANKING_PAISES = """
SELECT
    p.nombre                                   AS pais,
    COUNT(DISTINCT e.equipo_id)                AS total_equipos,
    COALESCE(SUM(ce.premio_obtenido), 0)       AS premios_totales,
    ROUND(AVG(ce.premio_obtenido), 2)          AS promedio_por_equipo
FROM paises p
LEFT JOIN equipos e            ON p.pais_id  = e.pais_id
LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
GROUP BY p.nombre
ORDER BY premios_totales DESC
"""

_SQL_TOP_JUGADORES_2024 = """
SELECT
    j.nombre,
    p.nombre                       AS nacionalidad,
    e2024.porcentaje_victorias     AS performance_2024,
    e2025.porcentaje_victorias     AS performance_2025,
    CASE
        WHEN e2025.porcentaje_victorias IS NULL THEN 'Sin datos 2025'
        WHEN e2025.porcentaje_victorias > e2024.porcentaje_victorias THEN 'Mejoró'
        WHEN e2025.porcentaje_victorias < e2024.porcentaje_victorias THEN 'Empeoró'
        ELSE 'Sin cambios'
    END AS tendencia
FROM jugadores j
LEFT JOIN paises p                 ON j.nacionalidad_id = p.pais_id
LEFT JOIN estadisticas_jugador e2024
    ON j.jugador_id = e2024.jugador_id AND e2024.anio = 2024
LEFT JOIN estadisticas_jugador e2025
    ON j.jugador_id = e2025.jugador_id AND e2025.anio = 2025
WHERE e2024.porcentaje_victorias IS NOT NULL
ORDER BY e2024.porcentaje_victorias DESC
LIMIT 5
"""

_SQL_EVOLUCION_JUGADORES = """
SELECT
    j.nombre,
    p.nombre                       AS nacionalidad,
    e2024.porcentaje_victorias     AS performance_2024,
    e2025.porcentaje_victorias     AS performance_2025,
    CASE
        WHEN e2025.porcentaje_victorias > e2024.porcentaje_victorias THEN 'Mejoró'
        WHEN e2025.porcentaje_victorias < e2024.porcentaje_victorias THEN 'Empeoró'
        ELSE 'Sin cambios'
    END AS tendencia
FROM jugadores j
LEFT JOIN paises p                 ON j.nacionalidad_id = p.pais_id
LEFT JOIN estadisticas_jugador e2024
    ON j.jugador_id = e2024.jugador_id AND e2024.anio = 2024
LEFT JOIN estadisticas_jugador e2025
    ON j.jugador_id = e2025.jugador_id AND e2025.anio = 2025
WHERE e2024.porcentaje_victorias IS NOT NULL
  AND e2025.porcentaje_victorias IS NOT NULL
ORDER BY (e2025.porcentaje_victorias - e2024.porcentaje_victorias) DESC
LIMIT 5
"""

_SQL_ANALISIS_ROLES = """
SELECT
    r.rol,
    COUNT(*)                                   AS total_participaciones,
    COUNT(DISTINCT r.jugador_id)               AS jugadores_unicos,
    ROUND(AVG(ej.porcentaje_victorias), 2)     AS promedio_performance
FROM rosters r
JOIN estadisticas_jugador ej ON r.jugador_id = ej.jugador_id
WHERE ej.anio = 2024
GROUP BY r.rol
ORDER BY promedio_performance DESC
"""

_SQL_TOP_EQUIPOS = """
SELECT
    e.nombre,
    p.nombre                                   AS pais,
    COUNT(ce.competencia_id)                   AS competencias_participadas,
    ROUND(AVG(ce.posicion_final), 2)           AS posicion_promedio,
    SUM(ce.premio_obtenido)                    AS premios_totales
FROM equipos e
JOIN paises p                ON e.pais_id    = p.pais_id
JOIN competencia_equipos ce  ON e.equipo_id  = ce.equipo_id
GROUP BY e.equipo_id, e.nombre, p.nombre
HAVING competencias_participadas >= 1
ORDER BY posicion_promedio ASC, premios_totales DESC
LIMIT 5
"""

_SQL_COMPETENCIAS = """
SELECT
    c.nombre,
    c.tipo,
    c.ubicacion,
    COUNT(ce.equipo_id)                                        AS equipos_participantes,
    c.premio_total,
    ROUND(c.premio_total / COUNT(ce.equipo_id), 2)             AS premio_promedio_por_equipo
FROM competencias c
JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
GROUP BY c.competencia_id
ORDER BY equipos_participantes DESC, premio_total DESC
"""

_SQL_VETERANOS = """
SELECT
    e.nombre    AS equipo,
    p.nombre    AS pais,
    j.nombre    AS jugador_veterano,
    j.edad,
    ej.porcentaje_victorias AS performance_2024
FROM equipos e
JOIN paises p              ON e.pais_id    = p.pais_id
JOIN jugadores j           ON e.equipo_id  = j.equipo_id
LEFT JOIN estadisticas_jugador ej
    ON j.jugador_id = ej.jugador_id AND ej.anio = 2024
WHERE j.edad = (
    SELECT MAX(j2.edad)
    FROM jugadores j2
    WHERE j2.equipo_id = e.equipo_id
)
ORDER BY j.edad DESC
LIMIT 5
"""

_SQL_METRICAS = """
SELECT
    (SELECT e.nombre
     FROM competencia_equipos ce
     JOIN competencias c ON ce.competencia_id = c.competencia_id
     JOIN equipos e      ON ce.equipo_id      = e.equipo_id
     WHERE c.tipo = 'Internacional'
     GROUP BY e.nombre
     ORDER BY SUM(ce.premio_obtenido) DESC
     LIMIT 1)                                              AS mejor_equipo_internacional,

    (SELECT j.nombre
     FROM jugadores j
     JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id
     WHERE ej.anio = 2024
     ORDER BY ej.porcentaje_victorias DESC
     LIMIT 1)                                              AS mejor_jugador_2024,

    (SELECT j.nombre
     FROM jugadores j
     JOIN estadisticas_jugador e24 ON j.jugador_id = e24.jugador_id AND e24.anio = 2024
     JOIN estadisticas_jugador e25 ON j.jugador_id = e25.jugador_id AND e25.anio = 2025
     ORDER BY (e25.porcentaje_victorias - e24.porcentaje_victorias) DESC
     LIMIT 1)                                              AS mayor_mejora_2025,

    (SELECT p.nombre
     FROM paises p
     LEFT JOIN equipos e            ON p.pais_id  = e.pais_id
     LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
     GROUP BY p.nombre
     ORDER BY COALESCE(SUM(ce.premio_obtenido), 0) DESC
     LIMIT 1)                                              AS pais_dominante,

    (SELECT c.nombre
     FROM competencias c
     JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
     GROUP BY c.competencia_id
     ORDER BY COUNT(ce.equipo_id) DESC, c.premio_total DESC
     LIMIT 1)                                              AS competencia_mas_competitiva,

    (SELECT ROUND(AVG(ej.porcentaje_victorias), 2)
     FROM rosters r
     JOIN estadisticas_jugador ej ON r.jugador_id = ej.jugador_id
     WHERE ej.anio = 2024)                                 AS promedio_performance_general,

    (SELECT COALESCE(SUM(ce.premio_obtenido), 0)
     FROM competencia_equipos ce
     JOIN competencias c ON ce.competencia_id = c.competencia_id
     WHERE c.tipo = 'Internacional')                       AS total_premios_internacionales,

    (SELECT COALESCE(SUM(ce.premio_obtenido), 0)
     FROM competencia_equipos ce
     JOIN competencias c ON ce.competencia_id = c.competencia_id
     WHERE c.tipo = 'Nacional')                            AS total_premios_nacionales
"""


# ---------------------------------------------------------------------------
# EXTRACT
# ---------------------------------------------------------------------------

def extract(conn: mysql.connector.MySQLConnection) -> Dict[str, pd.DataFrame]:
    """Run all analytical queries and return raw DataFrames.

    Args:
        conn: Active MySQL connection.

    Returns:
        Dictionary mapping section names to their raw DataFrames.
    """
    logger.info("--- EXTRACT phase started ---")
    data: Dict[str, pd.DataFrame] = {
        "kpis":            _run_query(conn, _SQL_KPIS),
        "ranking_paises":  _run_query(conn, _SQL_RANKING_PAISES),
        "top_jugadores":   _run_query(conn, _SQL_TOP_JUGADORES_2024),
        "evolucion":       _run_query(conn, _SQL_EVOLUCION_JUGADORES),
        "roles":           _run_query(conn, _SQL_ANALISIS_ROLES),
        "top_equipos":     _run_query(conn, _SQL_TOP_EQUIPOS),
        "competencias":    _run_query(conn, _SQL_COMPETENCIAS),
        "veteranos":       _run_query(conn, _SQL_VETERANOS),
        "metricas":        _run_query(conn, _SQL_METRICAS),
    }
    logger.info("--- EXTRACT phase completed: %d datasets ---", len(data))
    return data


# ---------------------------------------------------------------------------
# VALIDATE (Data Quality Gates)
# ---------------------------------------------------------------------------

def _cast_decimals(raw: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """Cast ``Decimal`` columns to ``float`` before validation and export.

    MySQL returns monetary and percentage columns as ``Decimal``, which are
    converted to ``float`` for consistent handling by the validator registry
    and for JSON serialization.

    Args:
        raw: Dictionary of section-name → DataFrame.

    Returns:
        The same dictionary with Decimal columns cast to float.
    """
    for key, df in raw.items():
        for col in df.columns:
            if df[col].dtype == object and len(df) > 0:
                sample = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
                if isinstance(sample, Decimal):
                    raw[key][col] = df[col].astype(float)
    return raw


def validate(raw: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """Run data quality checks on every extracted DataFrame.

    If any check fails, the pipeline halts before producing
    a corrupted JSON.

    Args:
        raw: Dictionary of section-name → DataFrame.

    Returns:
        The same dictionary (validated in-place).

    Raises:
        SystemExit: If a validation error is detected.
    """
    logger.info("--- VALIDATE phase started (Data Quality Gates) ---")

    # Cast MySQL Decimal → float before checks
    raw = _cast_decimals(raw)

    errors_found = 0

    for key, df in raw.items():
        validator_fn = VALIDATOR_REGISTRY.get(key)
        if validator_fn is None:
            logger.warning("No validator defined for dataset '%s'. Skipping.", key)
            continue

        issues = validator_fn(df)
        if issues:
            errors_found += 1
            logger.error("  ✘ [%s] FAILED validation:", key)
            for msg in issues:
                logger.error("    %s", msg)
        else:
            logger.info("  ✔ [%s] passed (%d rows)", key, len(df))

    if errors_found:
        logger.error(
            "PIPELINE HALTED: %d dataset(s) failed validation. "
            "Fix the data before deploying.",
            errors_found,
        )
        sys.exit(1)

    logger.info("--- VALIDATE phase completed: all datasets passed ---")
    return raw


# ---------------------------------------------------------------------------
# TRANSFORM
# ---------------------------------------------------------------------------

def _to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Convert a DataFrame to a list of dicts, replacing NaN with ``None``.

    Args:
        df: Source DataFrame.

    Returns:
        List of dictionaries ready for JSON serialisation.
    """
    return json.loads(df.to_json(orient="records", default_handler=str))


def _add_evolution_deltas(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Add ``mejora`` or ``perdida`` keys based on performance trend.

    Args:
        records: Dicts with ``performance_2024``, ``performance_2025``, and ``tendencia``.

    Returns:
        The same list with added delta keys.
    """
    for rec in records:
        p24 = rec.get("performance_2024") or 0
        p25 = rec.get("performance_2025") or 0
        delta = round(p25 - p24, 1)
        if rec.get("tendencia") == "Mejoró":
            rec["mejora"] = delta
        elif rec.get("tendencia") == "Empeoró":
            rec["perdida"] = delta
    return records


def transform(raw: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
    """Transform raw DataFrames into the final JSON-ready dictionary.

    Args:
        raw: Dictionary of section-name → DataFrame from the extract phase.

    Returns:
        Final nested dictionary matching ``datos-dashboard.json`` schema.
    """
    logger.info("--- TRANSFORM phase started ---")

    # KPIs — single row → dict
    kpis_row = raw["kpis"].iloc[0]
    kpis = {
        "total_equipos":                int(kpis_row["total_equipos"]),
        "total_jugadores":              int(kpis_row["total_jugadores"]),
        "total_premios":                float(kpis_row["total_premios"]),
        "paises_representados":         int(kpis_row["paises_representados"]),
        "competencias_activas":         int(kpis_row["competencias_activas"]),
        "promedio_edad":                float(kpis_row["promedio_edad"]),
        "competencias_internacionales": int(kpis_row["competencias_internacionales"]),
        "competencias_nacionales":      int(kpis_row["competencias_nacionales"]),
    }

    # Table sections → list of records
    ranking_paises    = _to_records(raw["ranking_paises"])
    top_jugadores     = _to_records(raw["top_jugadores"])
    evolucion_raw     = _to_records(raw["evolucion"])
    evolucion         = _add_evolution_deltas(evolucion_raw)
    analisis_roles    = _to_records(raw["roles"])
    top_equipos       = _to_records(raw["top_equipos"])
    competencias      = _to_records(raw["competencias"])
    veteranos         = _to_records(raw["veteranos"])

    # Métricas resumen — single row → dict
    metricas_row = raw["metricas"].iloc[0]
    metricas = {
        "mejor_equipo_internacional":     metricas_row["mejor_equipo_internacional"],
        "mejor_jugador_2024":             metricas_row["mejor_jugador_2024"],
        "mayor_mejora_2025":              metricas_row["mayor_mejora_2025"],
        "pais_dominante":                 metricas_row["pais_dominante"],
        "competencia_mas_competitiva":    metricas_row["competencia_mas_competitiva"],
        "promedio_performance_general":   float(metricas_row["promedio_performance_general"]),
        "total_premios_internacionales":  float(metricas_row["total_premios_internacionales"]),
        "total_premios_nacionales":       float(metricas_row["total_premios_nacionales"]),
    }

    result = {
        "kpis_principales":      kpis,
        "ranking_paises":        ranking_paises,
        "top_jugadores_2024":    top_jugadores,
        "evolucion_jugadores":   evolucion,
        "analisis_roles":        analisis_roles,
        "top_equipos":           top_equipos,
        "competencias":          competencias,
        "jugadores_veteranos":   veteranos,
        "metricas_resumen":      metricas,
    }

    logger.info("--- TRANSFORM phase completed: %d sections ---", len(result))
    return result


# ---------------------------------------------------------------------------
# LOAD
# ---------------------------------------------------------------------------

def load(data: Dict[str, Any], output_path: Optional[Path] = None) -> None:
    """Write the final JSON to disk.

    Args:
        data: Transformed dictionary.
        output_path: Destination file path. Defaults to the frontend data dir.
    """
    logger.info("--- LOAD phase started ---")
    target = output_path or _OUTPUT_PATH
    target.parent.mkdir(parents=True, exist_ok=True)

    with open(target, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2, cls=DecimalEncoder)

    size_kb = target.stat().st_size / 1024
    logger.info("Wrote %s (%.1f KB)", target, size_kb)
    logger.info("--- LOAD phase completed ---")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Orchestrate the full ETL pipeline: Extract → Validate → Transform → Load."""
    logger.info("=" * 60)
    logger.info("eSports ETL Pipeline — started")
    logger.info("=" * 60)

    conn = _get_connection()
    try:
        raw_data = extract(conn)
        validate(raw_data)
        dashboard = transform(raw_data)
        load(dashboard)
    finally:
        conn.close()
        logger.info("MySQL connection closed.")

    logger.info("=" * 60)
    logger.info("eSports ETL Pipeline — finished successfully")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
