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
import math
import os
import sys
import unicodedata
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

import mysql.connector
import pandas as pd
from dotenv import load_dotenv
from mysql.connector import Error as MySQLError
from mysql.connector.abstracts import MySQLConnectionAbstract
from mysql.connector.pooling import PooledMySQLConnection

# Ensure modules are importable regardless of working directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from consistency import run_consistency_checks
from validators import VALIDATOR_REGISTRY, validate_with_pandera

# Initialize logger early so module-level warnings work.
logger = logging.getLogger("etl_pipeline")

# Try importing predictor for ML
_ML_AVAILABLE = False
try:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ml.predictor import generate_ml_projection_bundle, generate_predictions
    _ML_AVAILABLE = True
except ImportError as e:
    logger.warning("ML module not available: %s", e)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Resolve paths relative to this script
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent.parent
_OUTPUT_PATH = _PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
_AUDIT_PATH = _PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "auditoria_datos_full.md"
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


def _get_connection() -> MySQLConnectionAbstract | PooledMySQLConnection:
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


def _run_query(conn: MySQLConnectionAbstract | PooledMySQLConnection, query: str) -> pd.DataFrame:
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


def _empty_ml_projection_bundle() -> Dict[str, Any]:
    return {
        "predictions_2026": [],
        "ml_projection_2026_summary": {},
        "ml_projection_2026_players": [],
        "ml_projection_2026_team_summary": [],
        "ml_projection_2026_country_summary": [],
        "ml_projection_2026_feature_importance": [],
        "filter_ready": {
            "ml_projection_2026_summary_by_country": [],
            "ml_projection_2026_players_by_country": [],
            "ml_projection_2026_team_summary_by_country": [],
            "ml_projection_2026_country_summary_by_country": [],
        },
    }


# ---------------------------------------------------------------------------

# EXTRACT - SQL Queries
# ---------------------------------------------------------------------------


_SQL_KPIS = """
SELECT
    (SELECT COUNT(*) FROM equipos)                              AS total_teams,
    (SELECT COUNT(*) FROM jugadores)                            AS total_players,
    (SELECT COALESCE(SUM(premio_obtenido), 0)
     FROM competencia_equipos)                                  AS total_prizes,
    (SELECT COUNT(*) FROM paises)                               AS countries_represented,
    (SELECT COUNT(*) FROM competencias)                         AS active_competitions,
    (SELECT ROUND(AVG(edad), 1) FROM jugadores)                 AS average_age,
    (SELECT COUNT(*) FROM competencias
     WHERE tipo = 'Internacional')                              AS international_competitions,
    (SELECT COUNT(*) FROM competencias
     WHERE tipo = 'Nacional')                                   AS national_competitions
"""

_SQL_RANKING_PAISES = """
SELECT
    p.nombre                                   AS country,
    COUNT(DISTINCT e.equipo_id)                AS total_teams,
    (SELECT COUNT(DISTINCT r2.jugador_id) 
     FROM rosters r2 
     JOIN equipos e2 ON r2.equipo_id = e2.equipo_id 
     WHERE e2.pais_id = p.pais_id)             AS total_players,
    COALESCE(SUM(ce.premio_obtenido), 0)       AS total_prizes,
    COUNT(DISTINCT ce.competencia_id)          AS active_competitions,
    (SELECT ROUND(AVG(j2.edad), 1) 
     FROM jugadores j2 
     WHERE j2.jugador_id IN (
         SELECT DISTINCT r3.jugador_id 
         FROM rosters r3 
         JOIN equipos e3 ON r3.equipo_id = e3.equipo_id 
         WHERE e3.pais_id = p.pais_id
     ))                                        AS average_age,
    COUNT(DISTINCT CASE WHEN c.tipo = 'Internacional' THEN c.competencia_id END) AS international_competitions,
    COUNT(DISTINCT CASE WHEN c.tipo = 'Nacional' THEN c.competencia_id END)      AS national_competitions
FROM paises p
LEFT JOIN equipos e            ON p.pais_id  = e.pais_id
LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
LEFT JOIN competencias c       ON ce.competencia_id = c.competencia_id
GROUP BY p.pais_id, p.nombre
ORDER BY total_prizes DESC
"""

_SQL_TOP_JUGADORES_2024 = """
SELECT
    j.nombre AS name,
    p.nombre                       AS nationality,
    e2024.porcentaje_victorias     AS performance_2024,
    e2025.porcentaje_victorias     AS performance_2025,
    CASE
        WHEN e2025.porcentaje_victorias IS NULL THEN 'No data 2025'
        WHEN e2025.porcentaje_victorias > e2024.porcentaje_victorias THEN 'Improved'
        WHEN e2025.porcentaje_victorias < e2024.porcentaje_victorias THEN 'Declined'
        ELSE 'No change'
    END AS trend
FROM jugadores j
LEFT JOIN paises p                 ON j.nacionalidad_id = p.pais_id
LEFT JOIN estadisticas_jugador e2024
    ON j.jugador_id = e2024.jugador_id AND e2024.anio = 2024
LEFT JOIN estadisticas_jugador e2025
    ON j.jugador_id = e2025.jugador_id AND e2025.anio = 2025
WHERE e2024.porcentaje_victorias IS NOT NULL OR e2025.porcentaje_victorias IS NOT NULL
ORDER BY e2024.porcentaje_victorias DESC
LIMIT 5
"""

_SQL_EVOLUCION_JUGADORES = """
SELECT
    j.nombre AS name,
    p.nombre                       AS nationality,
    CASE
        WHEN e2024.porcentaje_victorias IS NOT NULL THEN COALESCE(team_2024.team_name, current_team.nombre)
        ELSE NULL
    END AS team_2024,
    CASE
        WHEN e2025.porcentaje_victorias IS NOT NULL THEN COALESCE(team_2025.team_name, current_team.nombre)
        ELSE NULL
    END AS team_2025,
    e2024.porcentaje_victorias     AS performance_2024,
    e2025.porcentaje_victorias     AS performance_2025,
    CASE
        WHEN e2025.porcentaje_victorias > e2024.porcentaje_victorias THEN 'Improved'
        WHEN e2025.porcentaje_victorias < e2024.porcentaje_victorias THEN 'Declined'
        ELSE 'No change'
    END AS trend,
    (e2025.porcentaje_victorias - e2024.porcentaje_victorias) AS improvement,
    CASE
        WHEN e2024.porcentaje_victorias IS NULL
          OR e2025.porcentaje_victorias IS NULL
          OR e2024.porcentaje_victorias = 0
        THEN NULL
        ELSE ROUND(
            ((e2025.porcentaje_victorias - e2024.porcentaje_victorias) / e2024.porcentaje_victorias) * 100,
            2
        )
    END AS improvement_pct
FROM jugadores j
LEFT JOIN paises p                 ON j.nacionalidad_id = p.pais_id
LEFT JOIN equipos current_team     ON j.equipo_id = current_team.equipo_id
LEFT JOIN estadisticas_jugador e2024
    ON j.jugador_id = e2024.jugador_id AND e2024.anio = 2024
LEFT JOIN estadisticas_jugador e2025
    ON j.jugador_id = e2025.jugador_id AND e2025.anio = 2025
LEFT JOIN (
    SELECT
        r.jugador_id,
        MAX(e.nombre) AS team_name
    FROM rosters r
    JOIN competencias c ON r.competencia_id = c.competencia_id
    JOIN equipos e ON r.equipo_id = e.equipo_id
    WHERE YEAR(c.fecha_inicio) = 2024
    GROUP BY r.jugador_id
) team_2024
    ON team_2024.jugador_id = j.jugador_id
LEFT JOIN (
    SELECT
        r.jugador_id,
        MAX(e.nombre) AS team_name
    FROM rosters r
    JOIN competencias c ON r.competencia_id = c.competencia_id
    JOIN equipos e ON r.equipo_id = e.equipo_id
    WHERE YEAR(c.fecha_inicio) = 2025
    GROUP BY r.jugador_id
) team_2025
    ON team_2025.jugador_id = j.jugador_id
WHERE e2024.porcentaje_victorias IS NOT NULL OR e2025.porcentaje_victorias IS NOT NULL
ORDER BY improvement DESC
"""

_SQL_ANALISIS_ROLES = """
SELECT
    r.rol AS role,
    COUNT(*)                                   AS total_participations,
    COUNT(DISTINCT r.jugador_id)               AS unique_players,
    ROUND(AVG(ej.porcentaje_victorias), 2)     AS average_performance
FROM rosters r
JOIN estadisticas_jugador ej ON r.jugador_id = ej.jugador_id
WHERE ej.anio = 2024
GROUP BY r.rol
ORDER BY average_performance DESC
"""


def _ordered_unique(values: List[str]) -> List[str]:
    """Return values preserving order and removing duplicates."""
    seen = set()
    ordered: List[str] = []
    for value in values:
        if value not in seen:
            ordered.append(value)
            seen.add(value)
    return ordered


def _sql_columns_block(columns: List[str], *, indent: str = "    ") -> str:
    """Render SQL column lines with a trailing comma per line."""
    if not columns:
        return ""
    return "".join(f"{indent}{column},\n" for column in columns)


def _build_squad_usage_base_cte() -> str:
    """Base CTE for aligned squad usage analytics."""
    return """
WITH squad_usage AS (
    SELECT
        c.nombre AS competition_name,
        p.nombre AS country,
        e.nombre AS team,
        r.rol AS role,
        r.jugador_id AS player_id,
        ej.porcentaje_victorias AS performance
    FROM rosters r
    JOIN competencias c ON r.competencia_id = c.competencia_id
    JOIN equipos e ON r.equipo_id = e.equipo_id
    JOIN paises p ON e.pais_id = p.pais_id
    LEFT JOIN estadisticas_jugador ej
        ON r.jugador_id = ej.jugador_id
       AND ej.anio = YEAR(c.fecha_inicio)
)
""".strip()


def _build_squad_usage_summary_sql(context_columns: List[str]) -> str:
    """Build squad usage summary SQL for the requested context dimensions."""
    context_columns = _ordered_unique(context_columns)
    context_select = _sql_columns_block(context_columns)
    team_rollup_columns = _ordered_unique([*context_columns, "team", "country"])
    team_rollup_select = _sql_columns_block(team_rollup_columns, indent="        ")
    team_counts_select = _sql_columns_block(context_columns, indent="        ")
    context_group = ", ".join(context_columns)
    team_rollup_group = ", ".join(team_rollup_columns)
    team_counts_group_clause = f"\n    GROUP BY {context_group}" if context_columns else ""
    summary_group_clause = f"\nGROUP BY {context_group}" if context_columns else ""
    order_clause = f"\nORDER BY {context_group}" if context_columns else ""
    join_clause = f"USING ({context_group})" if context_columns else "ON 1=1"

    return f"""
{_build_squad_usage_base_cte()},
team_rollup AS (
    SELECT
{team_rollup_select}        SUM(CASE WHEN role = 'Titular' THEN 1 ELSE 0 END) AS starter_participations,
        SUM(CASE WHEN role = 'Suplente' THEN 1 ELSE 0 END) AS substitute_participations
    FROM squad_usage
    GROUP BY {team_rollup_group}
),
team_counts AS (
    SELECT
{team_counts_select}        SUM(CASE WHEN substitute_participations > 0 THEN 1 ELSE 0 END) AS teams_with_substitutes,
        SUM(CASE WHEN substitute_participations = 0 THEN 1 ELSE 0 END) AS teams_without_substitutes
    FROM team_rollup{team_counts_group_clause}
)
SELECT
{context_select}    SUM(CASE WHEN role = 'Titular' THEN 1 ELSE 0 END) AS starter_participations,
    SUM(CASE WHEN role = 'Suplente' THEN 1 ELSE 0 END) AS substitute_participations,
    ROUND(SUM(CASE WHEN role = 'Titular' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS starter_share_pct,
    ROUND(SUM(CASE WHEN role = 'Suplente' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS substitute_share_pct,
    COUNT(DISTINCT CASE WHEN role = 'Titular' THEN player_id END) AS starter_unique_players,
    COUNT(DISTINCT CASE WHEN role = 'Suplente' THEN player_id END) AS substitute_unique_players,
    ROUND(AVG(CASE WHEN role = 'Titular' THEN performance END), 2) AS starter_avg_performance,
    ROUND(AVG(CASE WHEN role = 'Suplente' THEN performance END), 2) AS substitute_avg_performance,
    CASE
        WHEN AVG(CASE WHEN role = 'Titular' THEN performance END) IS NULL
          OR AVG(CASE WHEN role = 'Suplente' THEN performance END) IS NULL
        THEN NULL
        ELSE ROUND(
            AVG(CASE WHEN role = 'Suplente' THEN performance END) -
            AVG(CASE WHEN role = 'Titular' THEN performance END),
            2
        )
    END AS performance_gap_pct,
    COALESCE(MAX(team_counts.teams_with_substitutes), 0) AS teams_with_substitutes,
    COALESCE(MAX(team_counts.teams_without_substitutes), 0) AS teams_without_substitutes
FROM squad_usage
LEFT JOIN team_counts {join_clause}{summary_group_clause}{order_clause}
""".strip()


def _build_squad_usage_team_breakdown_sql(context_columns: List[str]) -> str:
    """Build squad usage team breakdown SQL for the requested context dimensions."""
    context_columns = _ordered_unique(context_columns)
    group_columns = _ordered_unique([*context_columns, "team", "country"])

    output_columns: List[str] = []
    if "competition_name" in context_columns:
        output_columns.append("competition_name")
    output_columns.extend(["team", "country"])

    output_select = _sql_columns_block(output_columns)
    group_clause = ", ".join(group_columns)

    return f"""
{_build_squad_usage_base_cte()}
SELECT
{output_select}    SUM(CASE WHEN role = 'Titular' THEN 1 ELSE 0 END) AS starter_participations,
    SUM(CASE WHEN role = 'Suplente' THEN 1 ELSE 0 END) AS substitute_participations,
    COUNT(DISTINCT CASE WHEN role = 'Titular' THEN player_id END) AS starter_unique_players,
    COUNT(DISTINCT CASE WHEN role = 'Suplente' THEN player_id END) AS substitute_unique_players,
    ROUND(AVG(CASE WHEN role = 'Titular' THEN performance END), 2) AS starter_avg_performance,
    ROUND(AVG(CASE WHEN role = 'Suplente' THEN performance END), 2) AS substitute_avg_performance,
    ROUND(SUM(CASE WHEN role = 'Suplente' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS substitute_share_pct,
    CASE
        WHEN AVG(CASE WHEN role = 'Titular' THEN performance END) IS NULL
          OR AVG(CASE WHEN role = 'Suplente' THEN performance END) IS NULL
        THEN NULL
        ELSE ROUND(
            AVG(CASE WHEN role = 'Suplente' THEN performance END) -
            AVG(CASE WHEN role = 'Titular' THEN performance END),
            2
        )
    END AS performance_gap_pct
FROM squad_usage
GROUP BY {group_clause}
ORDER BY substitute_share_pct DESC, substitute_participations DESC, team ASC
""".strip()


_SQL_SQUAD_USAGE_SUMMARY = _build_squad_usage_summary_sql([])
_SQL_SQUAD_USAGE_TEAM_BREAKDOWN = _build_squad_usage_team_breakdown_sql([])
_SQL_SQUAD_USAGE_BY_COUNTRY = _build_squad_usage_summary_sql(["country"])
_SQL_SQUAD_USAGE_BY_COMPETITION = _build_squad_usage_summary_sql(["competition_name"])
_SQL_SQUAD_USAGE_BY_COUNTRY_COMPETITION = _build_squad_usage_summary_sql(["competition_name", "country"])
_SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COUNTRY = _build_squad_usage_team_breakdown_sql(["country"])
_SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COMPETITION = _build_squad_usage_team_breakdown_sql(["competition_name"])
_SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COUNTRY_COMPETITION = _build_squad_usage_team_breakdown_sql(["competition_name", "country"])


def _build_team_comparison_base_cte() -> str:
    """Base CTE for contextual team comparison analytics."""
    return """
WITH team_context_rows AS (
    SELECT
        c.nombre AS competition_name,
        YEAR(c.fecha_inicio) AS competition_year,
        e.nombre AS team,
        p.nombre AS country,
        CASE WHEN ce.posicion_final > 0 THEN ce.posicion_final ELSE NULL END AS valid_position,
        ce.posicion_final AS competition_result,
        COALESCE(ce.premio_obtenido, 0) AS prize_amount,
        r.jugador_id AS player_id,
        j.trabajo_en_equipo AS teamwork_value,
        ej.porcentaje_victorias AS victory_rate_value
    FROM competencia_equipos ce
    JOIN competencias c ON ce.competencia_id = c.competencia_id
    JOIN equipos e ON ce.equipo_id = e.equipo_id
    JOIN paises p ON e.pais_id = p.pais_id
    LEFT JOIN rosters r
        ON r.competencia_id = ce.competencia_id
       AND r.equipo_id = ce.equipo_id
    LEFT JOIN jugadores j ON r.jugador_id = j.jugador_id
    LEFT JOIN estadisticas_jugador ej
        ON r.jugador_id = ej.jugador_id
       AND ej.anio = YEAR(c.fecha_inicio)
),
team_results AS (
    SELECT DISTINCT
        competition_name,
        competition_year,
        team,
        country,
        valid_position,
        competition_result,
        prize_amount
    FROM team_context_rows
)
""".strip()


def _build_team_comparison_profiles_sql(context_columns: List[str]) -> str:
    """Build contextual team comparison profiles SQL."""
    context_columns = _ordered_unique(context_columns)
    include_competition = "competition_name" in context_columns

    entity_columns = _ordered_unique([*context_columns, "team", "country"])
    entity_select = _sql_columns_block(entity_columns)
    entity_group = ", ".join(entity_columns)
    join_keys = ", ".join(entity_columns)

    context_select = _sql_columns_block(context_columns, indent="        ")
    context_group_clause = f"\n    GROUP BY {', '.join(context_columns)}" if context_columns else ""
    context_join_clause = f"USING ({', '.join(context_columns)})" if context_columns else "ON 1=1"

    position_expr = (
        "MAX(valid_position) AS position_metric,"
        if include_competition
        else "ROUND(AVG(valid_position), 2) AS position_metric,"
    )
    competition_result_select = (
        "    result_metrics.competition_result AS competition_result,\n"
        if include_competition
        else ""
    )
    competition_result_rollup = (
        "        MAX(valid_position) AS competition_result\n"
        if include_competition
        else ""
    )
    podium_line = (
        "        SUM(CASE WHEN competition_result BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS podium_count,\n"
        if include_competition
        else "        SUM(CASE WHEN competition_result BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS podium_count\n"
    )

    return f"""
{_build_team_comparison_base_cte()},
profile_metrics AS (
    SELECT
{entity_select}        COUNT(DISTINCT competition_name) AS competitions_count,
        ROUND(AVG(teamwork_value) * 10, 2) AS teamwork_score,
        ROUND(AVG(victory_rate_value), 2) AS victory_rate_pct
    FROM team_context_rows
    GROUP BY {entity_group}
),
result_metrics AS (
    SELECT
{entity_select}        {position_expr}
        ROUND(SUM(prize_amount), 2) AS prize_amount,
        SUM(CASE WHEN competition_result = 1 THEN 1 ELSE 0 END) AS titles_count,
{podium_line}{competition_result_rollup}
    FROM team_results
    GROUP BY {entity_group}
),
context_prize_totals AS (
    SELECT
{context_select}        ROUND(COALESCE(SUM(prize_amount), 0), 2) AS total_context_prizes
    FROM result_metrics{context_group_clause}
),
scored_profiles AS (
    SELECT
{entity_select}        profile_metrics.competitions_count,
        profile_metrics.teamwork_score,
        profile_metrics.victory_rate_pct,
        result_metrics.position_metric,
        CASE
            WHEN result_metrics.position_metric IS NULL OR result_metrics.position_metric <= 0 THEN NULL
            ELSE ROUND(100.0 / result_metrics.position_metric, 2)
        END AS results_score,
        result_metrics.prize_amount,
        CASE
            WHEN COALESCE(context_prize_totals.total_context_prizes, 0) = 0 THEN 0
            ELSE ROUND(result_metrics.prize_amount * 100.0 / context_prize_totals.total_context_prizes, 2)
        END AS prize_share_pct,
        result_metrics.titles_count,
        result_metrics.podium_count,
{competition_result_select}        ROUND(
            COALESCE(profile_metrics.victory_rate_pct, 0) * 0.35 +
            COALESCE(profile_metrics.teamwork_score, 0) * 0.25 +
            COALESCE(
                CASE
                    WHEN result_metrics.position_metric IS NULL OR result_metrics.position_metric <= 0 THEN NULL
                    ELSE ROUND(100.0 / result_metrics.position_metric, 2)
                END,
                0
            ) * 0.20 +
            COALESCE(
                CASE
                    WHEN COALESCE(context_prize_totals.total_context_prizes, 0) = 0 THEN 0
                    ELSE ROUND(result_metrics.prize_amount * 100.0 / context_prize_totals.total_context_prizes, 2)
                END,
                0
            ) * 0.20,
            2
        ) AS comparison_score
    FROM profile_metrics
    JOIN result_metrics USING ({join_keys})
    LEFT JOIN context_prize_totals {context_join_clause}
)
SELECT *
FROM scored_profiles
ORDER BY comparison_score DESC, prize_amount DESC, team ASC
""".strip()


_SQL_TEAM_COMPARISON_PROFILES = _build_team_comparison_profiles_sql([])
_SQL_TEAM_COMPARISON_PROFILES_BY_COUNTRY = _build_team_comparison_profiles_sql(["country"])
_SQL_TEAM_COMPARISON_PROFILES_BY_COMPETITION = _build_team_comparison_profiles_sql(["competition_name"])
_SQL_TEAM_COMPARISON_PROFILES_BY_COUNTRY_COMPETITION = _build_team_comparison_profiles_sql(["competition_name", "country"])

_SQL_TOP_EQUIPOS = """
SELECT
    e.nombre AS name,
    p.nombre                                   AS country,
    COUNT(ce.competencia_id)                   AS participating_competitions,
    ROUND(AVG(ce.posicion_final), 2)           AS average_position,
    SUM(ce.premio_obtenido)                    AS total_prizes
FROM equipos e
JOIN paises p                ON e.pais_id    = p.pais_id
JOIN competencia_equipos ce  ON e.equipo_id  = ce.equipo_id
GROUP BY e.equipo_id, e.nombre, p.nombre
HAVING participating_competitions >= 1
ORDER BY average_position ASC, total_prizes DESC
LIMIT 5
"""

_SQL_TEAMS_CATALOG = """
SELECT
    e.nombre AS name,
    p.nombre AS country,
    (
        SELECT COUNT(DISTINCT ce2.competencia_id)
        FROM competencia_equipos ce2
        WHERE ce2.equipo_id = e.equipo_id
    ) AS participating_competitions,
    (
        SELECT COUNT(DISTINCT r.jugador_id)
        FROM rosters r
        WHERE r.equipo_id = e.equipo_id
    ) AS total_players,
    (
        SELECT MIN(ce3.posicion_final)
        FROM competencia_equipos ce3
        WHERE ce3.equipo_id = e.equipo_id
          AND ce3.posicion_final > 0
    ) AS best_position,
    (
        SELECT COALESCE(SUM(ce4.premio_obtenido), 0)
        FROM competencia_equipos ce4
        WHERE ce4.equipo_id = e.equipo_id
    ) AS total_prizes
FROM equipos e
JOIN paises p ON e.pais_id = p.pais_id
ORDER BY
    total_prizes DESC,
    participating_competitions DESC,
    CASE WHEN best_position IS NULL THEN 1 ELSE 0 END ASC,
    best_position ASC,
    name ASC
"""

_SQL_COMPETITION_CROSS_FILTER = """
SELECT 
    c.nombre AS competition_name,
    p.nombre AS country,
    COUNT(DISTINCT e.equipo_id) AS teams_count,
    COALESCE(SUM(ce.premio_obtenido), 0) AS country_prize,
    (COALESCE(SUM(ce.premio_obtenido), 0) / NULLIF(COUNT(DISTINCT e.equipo_id), 0)) AS average_prize_per_team,
    (SELECT COUNT(DISTINCT r2.jugador_id) 
     FROM rosters r2 
     WHERE r2.competencia_id = c.competencia_id 
       AND r2.equipo_id IN (SELECT e2.equipo_id FROM equipos e2 WHERE e2.pais_id = p.pais_id)) AS players_count,
    (SELECT ROUND(AVG(j2.edad), 1) 
     FROM jugadores j2 
     WHERE j2.jugador_id IN (
         SELECT DISTINCT r3.jugador_id 
         FROM rosters r3 
         WHERE r3.competencia_id = c.competencia_id 
           AND r3.equipo_id IN (SELECT e3.equipo_id FROM equipos e3 WHERE e3.pais_id = p.pais_id)
     )) AS average_age
    ,c.tipo AS type,
    YEAR(c.fecha_inicio) AS year
FROM competencias c
JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
JOIN equipos e ON ce.equipo_id = e.equipo_id
JOIN paises p ON e.pais_id = p.pais_id
GROUP BY c.competencia_id, c.nombre, p.pais_id, p.nombre
"""

_SQL_VETERANOS = """
SELECT
    e.nombre    AS team,
    p.nombre    AS country,
    j.nombre    AS veteran_player,
    j.edad AS age,
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

_SQL_TEAM_EXPERIENCE_ROWS = """
SELECT
    c.nombre AS competition_name,
    YEAR(c.fecha_inicio) AS competition_year,
    e.nombre AS team,
    p.nombre AS country,
    pn.nombre AS player_nationality,
    CASE
        WHEN ce.posicion_final > 0 THEN ce.posicion_final
        ELSE NULL
    END AS competition_result,
    COALESCE(ce.premio_obtenido, 0) AS prize_amount,
    r.jugador_id AS player_id,
    j.nombre AS player_name,
    j.edad AS player_age,
    r.rol AS role,
    ej.porcentaje_victorias AS performance_pct
FROM rosters r
JOIN competencias c
    ON r.competencia_id = c.competencia_id
JOIN equipos e
    ON r.equipo_id = e.equipo_id
JOIN paises p
    ON e.pais_id = p.pais_id
LEFT JOIN jugadores j
    ON r.jugador_id = j.jugador_id
LEFT JOIN paises pn
    ON j.nacionalidad_id = pn.pais_id
LEFT JOIN competencia_equipos ce
    ON ce.competencia_id = r.competencia_id
   AND ce.equipo_id = r.equipo_id
LEFT JOIN estadisticas_jugador ej
    ON r.jugador_id = ej.jugador_id
   AND ej.anio = YEAR(c.fecha_inicio)
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
     LIMIT 1)                                              AS best_international_team,

    (SELECT j.nombre
     FROM jugadores j
     JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id
     WHERE ej.anio = 2024
     ORDER BY ej.porcentaje_victorias DESC
     LIMIT 1)                                              AS best_player_2024,

    (SELECT j.nombre
     FROM jugadores j
     JOIN estadisticas_jugador e24 ON j.jugador_id = e24.jugador_id AND e24.anio = 2024
     JOIN estadisticas_jugador e25 ON j.jugador_id = e25.jugador_id AND e25.anio = 2025
     ORDER BY (e25.porcentaje_victorias - e24.porcentaje_victorias) DESC
     LIMIT 1)                                              AS most_improved_2025,

    (SELECT p.nombre
     FROM paises p
     LEFT JOIN equipos e            ON p.pais_id  = e.pais_id
     LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
     GROUP BY p.nombre
     ORDER BY COALESCE(SUM(ce.premio_obtenido), 0) DESC
     LIMIT 1)                                              AS dominant_country,

    (SELECT c.nombre
     FROM competencias c
     JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
     GROUP BY c.competencia_id
     ORDER BY COUNT(ce.equipo_id) DESC, c.premio_total DESC
     LIMIT 1)                                              AS most_competitive,

    (SELECT ROUND(AVG(ej.porcentaje_victorias), 2)
     FROM rosters r
     JOIN estadisticas_jugador ej ON r.jugador_id = ej.jugador_id
     WHERE ej.anio = 2024)                                 AS overall_average_performance,

    (SELECT COALESCE(SUM(ce.premio_obtenido), 0)
     FROM competencia_equipos ce
     JOIN competencias c ON ce.competencia_id = c.competencia_id
     WHERE c.tipo = 'Internacional')                       AS total_international_prizes,

    (SELECT COALESCE(SUM(ce.premio_obtenido), 0)
     FROM competencia_equipos ce
     JOIN competencias c ON ce.competencia_id = c.competencia_id
     WHERE c.tipo = 'Nacional')                            AS total_national_prizes
"""


# ---------------------------------------------------------------------------

_SQL_RADAR_TEAMWORK = """
  SELECT 
      e.nombre AS team,
      p.nombre AS country,
      COALESCE(AVG(j.trabajo_en_equipo), 80) AS avg_teamwork,
      COUNT(j.jugador_id) AS total_players,
      COALESCE(AVG(ej.porcentaje_victorias), 50.0) AS avg_winrate,
      COALESCE(SUM(ce.premio_obtenido), 0) AS total_prizes
  FROM equipos e
  JOIN paises p ON e.pais_id = p.pais_id
  JOIN jugadores j ON e.equipo_id = j.equipo_id
  LEFT JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id AND ej.anio = 2024
  LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
  GROUP BY e.equipo_id, e.nombre, p.nombre
  ORDER BY avg_teamwork DESC
  LIMIT 5;
"""


_SQL_SCATTER_AGE_PERFORMANCE = """
  SELECT 
      j.nombre AS name,
      j.edad AS age,
      ej.porcentaje_victorias AS performance,
      p.nombre AS nationality,
      e.nombre AS team
  FROM jugadores j
  JOIN paises p ON j.nacionalidad_id = p.pais_id
  LEFT JOIN equipos e ON j.equipo_id = e.equipo_id
  JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id AND ej.anio = 2024
  WHERE j.edad IS NOT NULL AND ej.porcentaje_victorias IS NOT NULL;
"""

_SQL_PLAYER_COMPETITION_MAPPING = """
SELECT 
    c.nombre AS competition_name,
    j.nombre AS player_name,
    e.nombre AS team_name
FROM competencia_equipos ce
JOIN competencias c ON ce.competencia_id = c.competencia_id
JOIN equipos e ON ce.equipo_id = e.equipo_id
JOIN jugadores j ON e.equipo_id = j.equipo_id
"""

_SQL_COMPETENCIAS = """
SELECT 
    c.nombre AS name,
    c.tipo AS type,
    c.ubicacion AS location,
    COUNT(DISTINCT ce.equipo_id) AS participating_teams,
    (SELECT COUNT(DISTINCT r2.jugador_id) FROM rosters r2 WHERE r2.competencia_id = c.competencia_id) AS total_players,
    c.premio_total AS total_prize,
    (c.premio_total / NULLIF(COUNT(DISTINCT ce.equipo_id), 0)) AS average_prize_per_team,
    YEAR(c.fecha_inicio) AS year,
    (SELECT ROUND(AVG(j2.edad), 1) 
     FROM jugadores j2 
     WHERE j2.jugador_id IN (SELECT r3.jugador_id FROM rosters r3 WHERE r3.competencia_id = c.competencia_id)) AS average_age
FROM competencias c
LEFT JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
GROUP BY c.competencia_id, c.nombre, c.tipo, c.ubicacion, c.premio_total, c.fecha_inicio
"""

# ---------------------------------------------------------------------------
# FILTER-READY QUERIES
# ---------------------------------------------------------------------------

_SQL_KPIS_BY_COUNTRY = """
SELECT
    p.nombre                                   AS country,
    COUNT(DISTINCT e.equipo_id)                AS total_teams,
    (SELECT COUNT(DISTINCT r2.jugador_id)
     FROM rosters r2
     JOIN equipos e2 ON r2.equipo_id = e2.equipo_id
     WHERE e2.pais_id = p.pais_id)             AS total_players,
    COALESCE(SUM(ce.premio_obtenido), 0)       AS total_prizes,
    COUNT(DISTINCT ce.competencia_id)          AS active_competitions,
    (SELECT ROUND(AVG(j2.edad), 1)
     FROM jugadores j2
     WHERE j2.jugador_id IN (
         SELECT DISTINCT r3.jugador_id
         FROM rosters r3
         JOIN equipos e3 ON r3.equipo_id = e3.equipo_id
         WHERE e3.pais_id = p.pais_id
     ))                                        AS average_age,
    COUNT(DISTINCT CASE WHEN c.tipo = 'Internacional' THEN c.competencia_id END) AS international_competitions,
    COUNT(DISTINCT CASE WHEN c.tipo = 'Nacional' THEN c.competencia_id END)      AS national_competitions,
    1                                          AS countries_represented
FROM paises p
LEFT JOIN equipos e              ON p.pais_id  = e.pais_id
LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
LEFT JOIN competencias c         ON ce.competencia_id = c.competencia_id
GROUP BY p.pais_id, p.nombre
ORDER BY total_prizes DESC
"""

_SQL_KPIS_BY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    c.tipo AS type,
    YEAR(c.fecha_inicio) AS year,
    COUNT(DISTINCT ce.equipo_id) AS total_teams,
    (SELECT COUNT(DISTINCT r2.jugador_id)
     FROM rosters r2
     JOIN competencia_equipos ce2
       ON ce2.competencia_id = r2.competencia_id
      AND ce2.equipo_id = r2.equipo_id
     WHERE r2.competencia_id = c.competencia_id) AS total_players,
    COALESCE(SUM(ce.premio_obtenido), 0) AS total_prizes,
    (SELECT ROUND(AVG(j2.edad), 1)
     FROM jugadores j2
     WHERE j2.jugador_id IN (
         SELECT r3.jugador_id
         FROM rosters r3
         JOIN competencia_equipos ce3
           ON ce3.competencia_id = r3.competencia_id
          AND ce3.equipo_id = r3.equipo_id
         WHERE r3.competencia_id = c.competencia_id
     )) AS average_age,
    (SELECT COUNT(DISTINCT e2.pais_id)
     FROM equipos e2
     WHERE e2.equipo_id IN (
         SELECT ce2.equipo_id
         FROM competencia_equipos ce2
         WHERE ce2.competencia_id = c.competencia_id
     )) AS countries_represented,
    CASE WHEN c.tipo = 'Internacional' THEN 1 ELSE 0 END AS international_competitions,
    CASE WHEN c.tipo = 'Nacional' THEN 1 ELSE 0 END AS national_competitions
FROM competencias c
LEFT JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
GROUP BY c.competencia_id, c.nombre, c.tipo, c.fecha_inicio
"""

_SQL_KPIS_BY_COUNTRY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    p.nombre AS country,
    c.tipo AS type,
    YEAR(c.fecha_inicio) AS year,
    COUNT(DISTINCT e.equipo_id) AS total_teams,
    (SELECT COUNT(DISTINCT r2.jugador_id)
     FROM rosters r2
     JOIN competencia_equipos ce2
       ON ce2.competencia_id = r2.competencia_id
      AND ce2.equipo_id = r2.equipo_id
     JOIN equipos e2 ON r2.equipo_id = e2.equipo_id
     WHERE r2.competencia_id = c.competencia_id
       AND e2.pais_id = p.pais_id) AS total_players,
    COALESCE(SUM(ce.premio_obtenido), 0) AS total_prizes,
    (SELECT ROUND(AVG(j2.edad), 1)
     FROM jugadores j2
     WHERE j2.jugador_id IN (
         SELECT DISTINCT r3.jugador_id
         FROM rosters r3
         JOIN competencia_equipos ce3
           ON ce3.competencia_id = r3.competencia_id
          AND ce3.equipo_id = r3.equipo_id
         JOIN equipos e3 ON r3.equipo_id = e3.equipo_id
         WHERE r3.competencia_id = c.competencia_id
           AND e3.pais_id = p.pais_id
     )) AS average_age
FROM competencias c
JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
JOIN equipos e ON ce.equipo_id = e.equipo_id
JOIN paises p ON e.pais_id = p.pais_id
GROUP BY c.competencia_id, c.nombre, c.tipo, c.fecha_inicio, p.pais_id, p.nombre
"""

_SQL_COUNTRY_RANKING_BY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    p.nombre AS country,
    COUNT(DISTINCT e.equipo_id) AS total_teams,
    (SELECT COUNT(DISTINCT r2.jugador_id)
     FROM rosters r2
     JOIN competencia_equipos ce2
       ON ce2.competencia_id = r2.competencia_id
      AND ce2.equipo_id = r2.equipo_id
     JOIN equipos e2 ON r2.equipo_id = e2.equipo_id
     WHERE r2.competencia_id = c.competencia_id
       AND e2.pais_id = p.pais_id) AS total_players,
    COALESCE(SUM(ce.premio_obtenido), 0) AS total_prizes,
    (COALESCE(SUM(ce.premio_obtenido), 0) / NULLIF(COUNT(DISTINCT e.equipo_id), 0)) AS average_prize_per_team,
    (SELECT ROUND(AVG(j2.edad), 1)
     FROM jugadores j2
     WHERE j2.jugador_id IN (
         SELECT DISTINCT r3.jugador_id
         FROM rosters r3
         JOIN competencia_equipos ce3
           ON ce3.competencia_id = r3.competencia_id
          AND ce3.equipo_id = r3.equipo_id
         JOIN equipos e3 ON r3.equipo_id = e3.equipo_id
         WHERE r3.competencia_id = c.competencia_id
           AND e3.pais_id = p.pais_id
     )) AS average_age
FROM competencias c
JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
JOIN equipos e ON ce.equipo_id = e.equipo_id
JOIN paises p ON e.pais_id = p.pais_id
GROUP BY c.competencia_id, c.nombre, p.pais_id, p.nombre
"""

_SQL_TOP_TEAMS_BY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    e.nombre AS team,
    p.nombre AS country,
    COALESCE(ce.posicion_final, 0) AS final_position,
    ce.premio_obtenido AS prize_obtained,
    COUNT(DISTINCT r.jugador_id) AS total_players
FROM competencia_equipos ce
JOIN competencias c ON ce.competencia_id = c.competencia_id
JOIN equipos e ON ce.equipo_id = e.equipo_id
JOIN paises p ON e.pais_id = p.pais_id
LEFT JOIN rosters r
    ON r.competencia_id = ce.competencia_id
   AND r.equipo_id = ce.equipo_id
GROUP BY
    c.competencia_id,
    c.nombre,
    e.equipo_id,
    e.nombre,
    p.nombre,
    ce.posicion_final,
    ce.premio_obtenido
"""

_SQL_TOP_PLAYERS_BY_COMPETITION = """
SELECT DISTINCT
    c.nombre AS competition_name,
    j.nombre AS name,
    p.nombre AS nationality,
    e2024.porcentaje_victorias AS performance_2024,
    e2025.porcentaje_victorias AS performance_2025,
    CASE
        WHEN e2025.porcentaje_victorias IS NULL THEN 'No data 2025'
        WHEN e2025.porcentaje_victorias > e2024.porcentaje_victorias THEN 'Improved'
        WHEN e2025.porcentaje_victorias < e2024.porcentaje_victorias THEN 'Declined'
        ELSE 'No change'
    END AS trend
FROM rosters r
JOIN competencias c ON r.competencia_id = c.competencia_id
JOIN jugadores j ON r.jugador_id = j.jugador_id
LEFT JOIN paises p ON j.nacionalidad_id = p.pais_id
LEFT JOIN estadisticas_jugador e2024
    ON j.jugador_id = e2024.jugador_id AND e2024.anio = 2024
LEFT JOIN estadisticas_jugador e2025
    ON j.jugador_id = e2025.jugador_id AND e2025.anio = 2025
WHERE e2024.porcentaje_victorias IS NOT NULL OR e2025.porcentaje_victorias IS NOT NULL
"""

_SQL_PLAYER_EVOLUTION_BY_COMPETITION = """
SELECT DISTINCT
    c.nombre AS competition_name,
    YEAR(c.fecha_inicio) AS competition_year,
    j.nombre AS name,
    p.nombre AS nationality,
    e.nombre AS team,
    e2024.porcentaje_victorias AS performance_2024,
    e2025.porcentaje_victorias AS performance_2025,
    CASE
        WHEN e2025.porcentaje_victorias > e2024.porcentaje_victorias THEN 'Improved'
        WHEN e2025.porcentaje_victorias < e2024.porcentaje_victorias THEN 'Declined'
        ELSE 'No change'
    END AS trend,
    (e2025.porcentaje_victorias - e2024.porcentaje_victorias) AS improvement,
    CASE
        WHEN e2024.porcentaje_victorias IS NULL
          OR e2025.porcentaje_victorias IS NULL
          OR e2024.porcentaje_victorias = 0
        THEN NULL
        ELSE ROUND(
            ((e2025.porcentaje_victorias - e2024.porcentaje_victorias) / e2024.porcentaje_victorias) * 100,
            2
        )
    END AS improvement_pct
FROM rosters r
JOIN competencias c ON r.competencia_id = c.competencia_id
JOIN jugadores j ON r.jugador_id = j.jugador_id
LEFT JOIN paises p ON j.nacionalidad_id = p.pais_id
LEFT JOIN equipos e ON r.equipo_id = e.equipo_id
LEFT JOIN estadisticas_jugador e2024
    ON j.jugador_id = e2024.jugador_id AND e2024.anio = 2024
LEFT JOIN estadisticas_jugador e2025
    ON j.jugador_id = e2025.jugador_id AND e2025.anio = 2025
WHERE (
    YEAR(c.fecha_inicio) = 2024 AND e2024.porcentaje_victorias IS NOT NULL
) OR (
    YEAR(c.fecha_inicio) = 2025 AND e2025.porcentaje_victorias IS NOT NULL
)
"""

_SQL_ROLE_ANALYSIS_BY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    r.rol AS role,
    COUNT(*) AS total_participations,
    COUNT(DISTINCT r.jugador_id) AS unique_players,
    ROUND(AVG(ej.porcentaje_victorias), 2) AS average_performance
FROM rosters r
JOIN competencias c ON r.competencia_id = c.competencia_id
JOIN estadisticas_jugador ej ON r.jugador_id = ej.jugador_id
WHERE ej.anio = 2024
GROUP BY c.competencia_id, c.nombre, r.rol
"""

_SQL_RADAR_TEAMWORK_BY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    e.nombre AS team,
    p.nombre AS country,
    COALESCE(AVG(j.trabajo_en_equipo), 80) AS avg_teamwork,
    COUNT(DISTINCT r.jugador_id) AS total_players,
    COALESCE(AVG(ej.porcentaje_victorias), 50.0) AS avg_winrate,
    COALESCE(MAX(ce.premio_obtenido), 0) AS total_prizes
FROM competencias c
JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
JOIN equipos e ON ce.equipo_id = e.equipo_id
JOIN paises p ON e.pais_id = p.pais_id
LEFT JOIN rosters r ON r.competencia_id = c.competencia_id AND r.equipo_id = e.equipo_id
LEFT JOIN jugadores j ON r.jugador_id = j.jugador_id
LEFT JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id AND ej.anio = 2024
GROUP BY c.competencia_id, c.nombre, e.equipo_id, e.nombre, p.nombre
"""

_SQL_SCATTER_AGE_PERFORMANCE_BY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    j.nombre AS name,
    j.edad AS age,
    ej.porcentaje_victorias AS performance,
    p.nombre AS nationality,
    e.nombre AS team
FROM rosters r
JOIN competencias c ON r.competencia_id = c.competencia_id
JOIN jugadores j ON r.jugador_id = j.jugador_id
JOIN paises p ON j.nacionalidad_id = p.pais_id
LEFT JOIN equipos e ON r.equipo_id = e.equipo_id
JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id AND ej.anio = 2024
WHERE j.edad IS NOT NULL AND ej.porcentaje_victorias IS NOT NULL
"""

_SQL_VETERAN_PLAYERS_BY_COMPETITION = """
SELECT
    c.nombre AS competition_name,
    e.nombre AS team,
    p.nombre AS country,
    j.nombre AS veteran_player,
    j.edad AS age,
    ej.porcentaje_victorias AS performance_2024
FROM competencias c
JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
JOIN equipos e ON ce.equipo_id = e.equipo_id
JOIN paises p ON e.pais_id = p.pais_id
JOIN rosters r ON r.competencia_id = c.competencia_id AND r.equipo_id = e.equipo_id
JOIN jugadores j ON r.jugador_id = j.jugador_id
LEFT JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id AND ej.anio = 2024
WHERE j.edad = (
    SELECT MAX(j2.edad)
    FROM jugadores j2
    JOIN rosters r2 ON r2.jugador_id = j2.jugador_id
    WHERE r2.competencia_id = c.competencia_id AND r2.equipo_id = e.equipo_id
)
"""

_SQL_PLAYERS_INDEX = """
SELECT
    j.nombre AS name,
    p.nombre AS nationality,
    e.nombre AS team
FROM jugadores j
LEFT JOIN paises p ON j.nacionalidad_id = p.pais_id
LEFT JOIN equipos e ON j.equipo_id = e.equipo_id
"""


_TEAM_COMPARISON_LEADER_SPECS = [
    ("best_teamwork_team", "best_teamwork_score", "teamwork_score"),
    ("best_victory_team", "best_victory_rate_pct", "victory_rate_pct"),
    ("best_results_team", "best_results_score", "results_score"),
    ("best_prize_team", "best_prize_share_pct", "prize_share_pct"),
]

_TEAM_EXPERIENCE_ROLE_ORDER = {
    "Titular": 2,
    "Mixto": 1,
    "Suplente": 0,
    "Sin rol registrado": -1,
}

_AGE_BAND_ORDER = {
    "20-21": 0,
    "22-23": 1,
    "24+": 2,
}


def _numeric_or_none(value: Any) -> Optional[float]:
    """Return a float when *value* is numeric; otherwise ``None``."""
    if value is None or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_optional_string(value: Any) -> Optional[str]:
    """Return a stripped string or ``None`` when *value* is empty."""
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _resolve_veteran_role(roles: List[Any]) -> str:
    """Classify the veteran role within the current context."""
    distinct_roles = {
        role
        for role in (_clean_optional_string(value) for value in roles)
        if role is not None
    }
    if not distinct_roles:
        return "Sin rol registrado"
    if distinct_roles == {"Titular"}:
        return "Titular"
    if distinct_roles == {"Suplente"}:
        return "Suplente"
    return "Mixto"


def _build_team_experience_profiles_columns(context_columns: List[str]) -> List[str]:
    """Return ordered columns for contextual team experience profiles."""
    columns = _ordered_unique([*context_columns, "team", "country"])
    columns.extend(
        [
            "veteran_player",
            "veteran_age",
            "veteran_role",
            "veteran_performance_pct",
            "team_avg_age",
            "youngest_age",
            "oldest_age",
            "age_span",
            "team_avg_performance_pct",
            "veteran_vs_team_gap_pct",
            "competitions_count",
        ]
    )
    if "competition_name" in context_columns:
        columns.append("competition_result")
    return columns


def _build_team_experience_profiles_df(
    rows_df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Derive team experience profiles for the requested context."""
    context_columns = _ordered_unique(context_columns)
    output_columns = _build_team_experience_profiles_columns(context_columns)
    if rows_df.empty:
        return pd.DataFrame(columns=output_columns)

    entity_columns = _ordered_unique([*context_columns, "team", "country"])
    player_columns = [*entity_columns, "player_id", "player_name", "player_age"]
    safe_rows = rows_df.copy()
    safe_rows["player_age"] = pd.to_numeric(safe_rows["player_age"], errors="coerce")
    safe_rows["performance_pct"] = pd.to_numeric(safe_rows["performance_pct"], errors="coerce")
    safe_rows["competition_result"] = pd.to_numeric(safe_rows["competition_result"], errors="coerce")
    safe_rows["competition_year"] = pd.to_numeric(safe_rows["competition_year"], errors="coerce")

    player_groups = safe_rows.groupby(player_columns, dropna=False)
    player_rows: List[Dict[str, Any]] = []
    for key, group in player_groups:
        entry = {column: key[index] for index, column in enumerate(player_columns)}
        performance_values = [value for value in group["performance_pct"].tolist() if pd.notna(value)]
        entry["player_avg_performance_pct"] = (
            round(sum(performance_values) / len(performance_values), 2)
            if performance_values
            else None
        )
        entry["player_role"] = _resolve_veteran_role(group["role"].tolist())
        player_rows.append(entry)

    players_df = pd.DataFrame(player_rows)
    if players_df.empty:
        return pd.DataFrame(columns=output_columns)

    context_rows: List[Dict[str, Any]] = []
    team_groups = players_df.groupby(entity_columns, dropna=False)
    for key, player_group in team_groups:
        context_row = {column: key[index] for index, column in enumerate(entity_columns)}
        source_mask = pd.Series(True, index=safe_rows.index)
        for column in entity_columns:
            group_value = context_row[column]
            if pd.isna(group_value):
                source_mask &= safe_rows[column].isna()
            else:
                source_mask &= safe_rows[column] == group_value
        source_rows = safe_rows[source_mask]

        competitions_count = int(source_rows["competition_name"].dropna().nunique())
        valid_ages = player_group["player_age"].dropna().astype(float)
        youngest_age = round(valid_ages.min(), 2) if not valid_ages.empty else None
        oldest_age = round(valid_ages.max(), 2) if not valid_ages.empty else None
        team_avg_age = round(valid_ages.mean(), 2) if not valid_ages.empty else None
        age_span = round(oldest_age - youngest_age, 2) if youngest_age is not None and oldest_age is not None else None

        valid_team_performance = player_group["player_avg_performance_pct"].dropna().astype(float)
        team_avg_performance_pct = (
            round(valid_team_performance.mean(), 2)
            if not valid_team_performance.empty
            else None
        )

        veteran_candidates = player_group.copy()
        veteran_candidates["sort_age"] = veteran_candidates["player_age"].fillna(-1)
        veteran_candidates["sort_performance"] = veteran_candidates["player_avg_performance_pct"].fillna(-1)
        veteran_candidates["sort_name"] = veteran_candidates["player_name"].fillna("")
        veteran_candidates = veteran_candidates.sort_values(
            by=["sort_age", "sort_performance", "sort_name"],
            ascending=[False, False, True],
            kind="mergesort",
        )
        veteran = veteran_candidates.iloc[0]
        veteran_performance_pct = _numeric_or_none(veteran.get("player_avg_performance_pct"))
        veteran_vs_team_gap_pct = (
            round(veteran_performance_pct - team_avg_performance_pct, 2)
            if veteran_performance_pct is not None and team_avg_performance_pct is not None
            else None
        )

        context_row.update(
            {
                "veteran_player": veteran.get("player_name"),
                "veteran_age": _numeric_or_none(veteran.get("player_age")),
                "veteran_role": veteran.get("player_role") or "Sin rol registrado",
                "veteran_performance_pct": veteran_performance_pct,
                "team_avg_age": team_avg_age,
                "youngest_age": youngest_age,
                "oldest_age": oldest_age,
                "age_span": age_span,
                "team_avg_performance_pct": team_avg_performance_pct,
                "veteran_vs_team_gap_pct": veteran_vs_team_gap_pct,
                "competitions_count": competitions_count,
            }
        )
        if "competition_name" in context_columns:
            valid_results = [value for value in source_rows["competition_result"].tolist() if pd.notna(value)]
            context_row["competition_result"] = valid_results[0] if valid_results else None
        context_rows.append(context_row)

    profiles_df = pd.DataFrame(context_rows, columns=output_columns)
    sort_columns = [*context_columns, "team", "country"]
    ascending = [True] * len(context_columns) + [True, True]
    return profiles_df.sort_values(by=sort_columns, ascending=ascending, kind="mergesort").reset_index(drop=True)


def _derive_team_experience_summary_df(
    profiles_df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Derive contextual summaries from team experience profiles."""
    context_columns = _ordered_unique(context_columns)
    output_columns = [
        *context_columns,
        "teams_count",
        "veteran_starters_count",
        "veteran_substitutes_count",
        "veteran_mixed_count",
        "avg_team_age",
        "avg_veteran_age",
        "avg_age_span",
    ]
    if profiles_df.empty:
        return pd.DataFrame(columns=output_columns)

    rows = profiles_df.to_dict("records")
    groups: Dict[tuple, List[Dict[str, Any]]] = {}
    for row in rows:
        key = tuple(row.get(column) for column in context_columns)
        groups.setdefault(key, []).append(row)

    summary_rows: List[Dict[str, Any]] = []
    for key, group_rows in groups.items():
        summary_row = {column: key[index] for index, column in enumerate(context_columns)}
        summary_row["teams_count"] = len(group_rows)
        summary_row["veteran_starters_count"] = sum(1 for row in group_rows if row.get("veteran_role") == "Titular")
        summary_row["veteran_substitutes_count"] = sum(1 for row in group_rows if row.get("veteran_role") == "Suplente")
        summary_row["veteran_mixed_count"] = sum(1 for row in group_rows if row.get("veteran_role") == "Mixto")

        def _avg(field: str) -> Optional[float]:
            values = [_numeric_or_none(row.get(field)) for row in group_rows]
            valid_values = [value for value in values if value is not None]
            if not valid_values:
                return None
            return round(sum(valid_values) / len(valid_values), 2)

        summary_row["avg_team_age"] = _avg("team_avg_age")
        summary_row["avg_veteran_age"] = _avg("veteran_age")
        summary_row["avg_age_span"] = _avg("age_span")
        summary_rows.append(summary_row)

    return pd.DataFrame(summary_rows, columns=output_columns)


def _derive_team_experience_leaders_df(
    profiles_df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Derive contextual leaders from team experience profiles."""
    context_columns = _ordered_unique(context_columns)
    output_columns = [
        *context_columns,
        "most_experienced_team",
        "most_experienced_team_avg_age",
        "best_veteran_player",
        "best_veteran_team",
        "best_veteran_performance_pct",
        "widest_age_gap_team",
        "widest_age_gap_years",
        "highest_veteran_advantage_team",
        "highest_veteran_advantage_pct",
    ]
    if profiles_df.empty:
        return pd.DataFrame(columns=output_columns)

    rows = profiles_df.to_dict("records")
    groups: Dict[tuple, List[Dict[str, Any]]] = {}
    for row in rows:
        key = tuple(row.get(column) for column in context_columns)
        groups.setdefault(key, []).append(row)

    def _metric_sort_value(row: Dict[str, Any], metric: str) -> float:
        numeric = _numeric_or_none(row.get(metric))
        return -1 if numeric is None else numeric

    leaders_rows: List[Dict[str, Any]] = []
    for key, group_rows in groups.items():
        leader_row = {column: key[index] for index, column in enumerate(context_columns)}

        most_experienced = sorted(
            group_rows,
            key=lambda row: (
                _metric_sort_value(row, "team_avg_age"),
                _metric_sort_value(row, "veteran_age"),
                row.get("team") or "",
            ),
            reverse=True,
        )[0]
        best_veteran = sorted(
            group_rows,
            key=lambda row: (
                _metric_sort_value(row, "veteran_performance_pct"),
                _metric_sort_value(row, "team_avg_age"),
                row.get("veteran_player") or "",
                row.get("team") or "",
            ),
            reverse=True,
        )[0]
        widest_gap = sorted(
            group_rows,
            key=lambda row: (
                _metric_sort_value(row, "age_span"),
                _metric_sort_value(row, "team_avg_age"),
                row.get("team") or "",
            ),
            reverse=True,
        )[0]
        highest_advantage = sorted(
            group_rows,
            key=lambda row: (
                _metric_sort_value(row, "veteran_vs_team_gap_pct"),
                _metric_sort_value(row, "veteran_performance_pct"),
                row.get("team") or "",
            ),
            reverse=True,
        )[0]

        leader_row.update(
            {
                "most_experienced_team": most_experienced.get("team"),
                "most_experienced_team_avg_age": most_experienced.get("team_avg_age"),
                "best_veteran_player": best_veteran.get("veteran_player"),
                "best_veteran_team": best_veteran.get("team"),
                "best_veteran_performance_pct": best_veteran.get("veteran_performance_pct"),
                "widest_age_gap_team": widest_gap.get("team"),
                "widest_age_gap_years": widest_gap.get("age_span"),
                "highest_veteran_advantage_team": highest_advantage.get("team"),
                "highest_veteran_advantage_pct": highest_advantage.get("veteran_vs_team_gap_pct"),
            }
        )
        leaders_rows.append(leader_row)

    return pd.DataFrame(leaders_rows, columns=output_columns)


def _derive_team_comparison_leaders_df(
    df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Derive context leaders from team comparison profile rows."""
    context_columns = _ordered_unique(context_columns)
    output_columns = [
        *context_columns,
        "best_teamwork_team",
        "best_teamwork_score",
        "best_victory_team",
        "best_victory_rate_pct",
        "best_results_team",
        "best_results_score",
        "best_prize_team",
        "best_prize_share_pct",
    ]
    if df.empty:
        return pd.DataFrame(columns=output_columns)

    rows = df.to_dict("records")
    groups: Dict[tuple, List[Dict[str, Any]]] = {}
    for row in rows:
        key = tuple(row.get(column) for column in context_columns)
        groups.setdefault(key, []).append(row)

    def _metric_sort_value(row: Dict[str, Any], metric: str) -> float:
        numeric = _numeric_or_none(row.get(metric))
        return -1 if numeric is None else numeric

    derived_rows: List[Dict[str, Any]] = []
    for key, group_rows in groups.items():
        leader_row: Dict[str, Any] = {}
        for index, context_key in enumerate(context_columns):
            leader_row[context_key] = key[index]

        for team_field, value_field, metric in _TEAM_COMPARISON_LEADER_SPECS:
            winner = sorted(
                group_rows,
                key=lambda row: (
                    _metric_sort_value(row, metric),
                    _numeric_or_none(row.get("comparison_score")) or 0,
                    _numeric_or_none(row.get("prize_amount")) or 0,
                    row.get("team") or "",
                ),
                reverse=True,
            )[0]
            leader_row[team_field] = winner.get("team")
            leader_row[value_field] = winner.get(metric)
        derived_rows.append(leader_row)

    return pd.DataFrame(derived_rows, columns=output_columns)


def _resolve_age_band(age: Any) -> Optional[str]:
    """Return the configured age band for a numeric age."""
    numeric = _numeric_or_none(age)
    if numeric is None:
        return None
    if numeric <= 21:
        return "20-21"
    if numeric <= 23:
        return "22-23"
    return "24+"


def _pearson_correlation(values_x: List[float], values_y: List[float]) -> Optional[float]:
    """Compute Pearson correlation for paired numeric lists."""
    if len(values_x) < 2 or len(values_y) < 2 or len(values_x) != len(values_y):
        return None
    mean_x = sum(values_x) / len(values_x)
    mean_y = sum(values_y) / len(values_y)
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(values_x, values_y))
    var_x = sum((x - mean_x) ** 2 for x in values_x)
    var_y = sum((y - mean_y) ** 2 for y in values_y)
    if var_x <= 0 or var_y <= 0:
        return None
    return round(cov / math.sqrt(var_x * var_y), 4)


def _classify_age_performance_correlation(
    value: Optional[float],
    sample_size: int,
) -> tuple[Optional[float], str, Optional[str]]:
    """Return normalized correlation value, strength, and direction codes."""
    if sample_size < 3 or value is None:
        return None, "insufficient", None
    absolute = abs(value)
    if absolute < 0.15:
        return round(value, 4), "none", "neutral"
    if absolute < 0.35:
        return round(value, 4), "weak", "positive" if value > 0 else "negative"
    if absolute < 0.60:
        return round(value, 4), "moderate", "positive" if value > 0 else "negative"
    return round(value, 4), "strong", "positive" if value > 0 else "negative"


def _build_age_performance_points_columns(context_columns: List[str]) -> List[str]:
    """Return ordered columns for player age-performance points."""
    columns = _ordered_unique([*context_columns])
    columns.extend(
        [
            "player_name",
            "team",
            "team_country",
            "player_nationality",
            "age",
            "performance_pct",
            "age_band",
            "competitions_count",
        ]
    )
    return columns


def _build_player_age_performance_points_df(
    rows_df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Derive contextual player points for age-performance analysis."""
    context_columns = _ordered_unique(context_columns)
    output_columns = _build_age_performance_points_columns(context_columns)
    if rows_df.empty:
        return pd.DataFrame(columns=output_columns)

    safe_rows = rows_df.copy()
    safe_rows["player_age"] = pd.to_numeric(safe_rows["player_age"], errors="coerce")
    safe_rows["performance_pct"] = pd.to_numeric(safe_rows["performance_pct"], errors="coerce")
    safe_rows["competition_year"] = pd.to_numeric(safe_rows["competition_year"], errors="coerce")
    safe_rows["competition_result"] = pd.to_numeric(safe_rows["competition_result"], errors="coerce")

    grouping_columns = [*context_columns, "player_id", "player_name", "team", "country", "player_nationality", "player_age"]
    grouped_rows: List[Dict[str, Any]] = []
    for key, group in safe_rows.groupby(grouping_columns, dropna=False):
        row = {column: key[index] for index, column in enumerate(grouping_columns)}
        performance_values = [value for value in group["performance_pct"].tolist() if pd.notna(value)]
        row["performance_pct"] = round(sum(performance_values) / len(performance_values), 2) if performance_values else None
        row["age_band"] = _resolve_age_band(row.get("player_age"))
        row["competitions_count"] = int(group["competition_name"].dropna().nunique()) if "competition_name" in group else 0
        row["team_country"] = row.get("country")
        if "country" not in context_columns:
            row.pop("country", None)
        row.pop("player_id", None)
        row["age"] = _numeric_or_none(row.pop("player_age", None))
        grouped_rows.append(row)

    points_df = pd.DataFrame(grouped_rows)
    if points_df.empty:
        return pd.DataFrame(columns=output_columns)

    for column in context_columns:
        if column not in points_df.columns:
            points_df[column] = None
    if "competitions_count" not in points_df.columns:
        points_df["competitions_count"] = 0
    if "competition_name" in context_columns and "competition_name" not in points_df.columns:
        points_df["competition_name"] = None

    points_df = points_df[output_columns]
    points_df["competitions_count"] = points_df["competitions_count"].fillna(0).astype(int)
    sort_columns = [*context_columns, "team_country", "team", "player_name"]
    ascending = [True] * len(context_columns) + [True, True, True]
    return points_df.sort_values(by=sort_columns, ascending=ascending, kind="mergesort").reset_index(drop=True)


def _build_player_age_performance_bands_df(
    points_df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Aggregate contextual rows into age bands."""
    context_columns = _ordered_unique(context_columns)
    output_columns = [
        *context_columns,
        "age_band",
        "players_count",
        "average_performance_pct",
        "top_player_name",
        "top_player_team",
        "top_player_performance_pct",
    ]
    if points_df.empty:
        return pd.DataFrame(columns=output_columns)

    rows = points_df.to_dict("records")
    groups: Dict[tuple, List[Dict[str, Any]]] = {}
    for row in rows:
        key = tuple([*(row.get(column) for column in context_columns), row.get("age_band")])
        groups.setdefault(key, []).append(row)

    band_rows: List[Dict[str, Any]] = []
    for key, group_rows in groups.items():
        band_row = {column: key[index] for index, column in enumerate(context_columns)}
        age_band = key[len(context_columns)]
        band_row["age_band"] = age_band
        band_row["players_count"] = len(group_rows)
        valid_performance = [_numeric_or_none(row.get("performance_pct")) for row in group_rows]
        valid_performance = [value for value in valid_performance if value is not None]
        band_row["average_performance_pct"] = (
            round(sum(valid_performance) / len(valid_performance), 2) if valid_performance else None
        )
        top_player = sorted(
            group_rows,
            key=lambda row: (
                _numeric_or_none(row.get("performance_pct")) or -1,
                -(_numeric_or_none(row.get("age")) or 0),
                row.get("player_name") or "",
            ),
            reverse=True,
        )[0]
        band_row["top_player_name"] = top_player.get("player_name")
        band_row["top_player_team"] = top_player.get("team")
        band_row["top_player_performance_pct"] = top_player.get("performance_pct")
        band_rows.append(band_row)

    bands_df = pd.DataFrame(band_rows, columns=output_columns)
    sort_columns = [*context_columns, "age_band"]
    return bands_df.sort_values(
        by=sort_columns,
        key=lambda series: series.map(_AGE_BAND_ORDER) if series.name == "age_band" else series,
        kind="mergesort",
    ).reset_index(drop=True)


def _derive_player_age_performance_summary_df(
    points_df: pd.DataFrame,
    bands_df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Derive summary metrics for age-performance analysis."""
    context_columns = _ordered_unique(context_columns)
    output_columns = [
        *context_columns,
        "players_count",
        "overall_average_performance_pct",
        "correlation_value",
        "correlation_strength",
        "correlation_direction",
        "best_age_band",
        "best_age_band_average_performance_pct",
    ]
    if points_df.empty:
        return pd.DataFrame(columns=output_columns)

    point_rows = points_df.to_dict("records")
    band_rows = bands_df.to_dict("records")
    point_groups: Dict[tuple, List[Dict[str, Any]]] = {}
    band_groups: Dict[tuple, List[Dict[str, Any]]] = {}
    for row in point_rows:
        key = tuple(row.get(column) for column in context_columns)
        point_groups.setdefault(key, []).append(row)
    for row in band_rows:
        key = tuple(row.get(column) for column in context_columns)
        band_groups.setdefault(key, []).append(row)

    summary_rows: List[Dict[str, Any]] = []
    for key, group_rows in point_groups.items():
        summary_row = {column: key[index] for index, column in enumerate(context_columns)}
        summary_row["players_count"] = len(group_rows)
        performance_values = [_numeric_or_none(row.get("performance_pct")) for row in group_rows]
        performance_values = [value for value in performance_values if value is not None]
        summary_row["overall_average_performance_pct"] = (
            round(sum(performance_values) / len(performance_values), 2) if performance_values else None
        )
        age_values = []
        paired_performance = []
        for row in group_rows:
            age_value = _numeric_or_none(row.get("age"))
            performance_value = _numeric_or_none(row.get("performance_pct"))
            if age_value is None or performance_value is None:
                continue
            age_values.append(age_value)
            paired_performance.append(performance_value)
        raw_correlation = _pearson_correlation(age_values, paired_performance)
        correlation_value, correlation_strength, correlation_direction = _classify_age_performance_correlation(
            raw_correlation,
            len(age_values),
        )
        summary_row["correlation_value"] = correlation_value
        summary_row["correlation_strength"] = correlation_strength
        summary_row["correlation_direction"] = correlation_direction

        group_bands = band_groups.get(key, [])
        if group_bands:
            best_band = sorted(
                group_bands,
                key=lambda row: (
                    _numeric_or_none(row.get("average_performance_pct")) or -1,
                    _numeric_or_none(row.get("players_count")) or 0,
                    -_AGE_BAND_ORDER.get(row.get("age_band"), 99),
                ),
                reverse=True,
            )[0]
            summary_row["best_age_band"] = best_band.get("age_band")
            summary_row["best_age_band_average_performance_pct"] = best_band.get("average_performance_pct")
        else:
            summary_row["best_age_band"] = None
            summary_row["best_age_band_average_performance_pct"] = None

        summary_rows.append(summary_row)

    return pd.DataFrame(summary_rows, columns=output_columns)


def _derive_player_age_performance_leaders_df(
    points_df: pd.DataFrame,
    context_columns: List[str],
) -> pd.DataFrame:
    """Derive standout young and veteran players per context."""
    context_columns = _ordered_unique(context_columns)
    output_columns = [
        *context_columns,
        "young_standout_player",
        "young_standout_team",
        "young_standout_performance_pct",
        "veteran_standout_player",
        "veteran_standout_team",
        "veteran_standout_performance_pct",
    ]
    if points_df.empty:
        return pd.DataFrame(columns=output_columns)

    rows = points_df.to_dict("records")
    groups: Dict[tuple, List[Dict[str, Any]]] = {}
    for row in rows:
        key = tuple(row.get(column) for column in context_columns)
        groups.setdefault(key, []).append(row)

    derived_rows: List[Dict[str, Any]] = []
    for key, group_rows in groups.items():
        leader_row = {column: key[index] for index, column in enumerate(context_columns)}
        present_bands = sorted(
            {row.get("age_band") for row in group_rows if row.get("age_band") in _AGE_BAND_ORDER},
            key=lambda band: _AGE_BAND_ORDER.get(band, 99),
        )
        youngest_band = present_bands[0] if present_bands else None
        veteran_band = present_bands[-1] if present_bands else None

        def _pick_standout(target_band: Optional[str]) -> Optional[Dict[str, Any]]:
            candidates = [row for row in group_rows if row.get("age_band") == target_band]
            if not candidates:
                return None
            return sorted(
                candidates,
                key=lambda row: (
                    _numeric_or_none(row.get("performance_pct")) or -1,
                    -(_numeric_or_none(row.get("age")) or 0),
                    row.get("player_name") or "",
                ),
                reverse=True,
            )[0]

        young_standout = _pick_standout(youngest_band)
        veteran_standout = _pick_standout(veteran_band)
        leader_row.update(
            {
                "young_standout_player": young_standout.get("player_name") if young_standout else None,
                "young_standout_team": young_standout.get("team") if young_standout else None,
                "young_standout_performance_pct": young_standout.get("performance_pct") if young_standout else None,
                "veteran_standout_player": veteran_standout.get("player_name") if veteran_standout else None,
                "veteran_standout_team": veteran_standout.get("team") if veteran_standout else None,
                "veteran_standout_performance_pct": veteran_standout.get("performance_pct") if veteran_standout else None,
            }
        )
        derived_rows.append(leader_row)

    return pd.DataFrame(derived_rows, columns=output_columns)

# EXTRACT
# ---------------------------------------------------------------------------

def extract(conn: MySQLConnectionAbstract | PooledMySQLConnection) -> Dict[str, pd.DataFrame]:
    """Run all analytical queries and return raw DataFrames.

    Args:
        conn: Active MySQL connection.

    Returns:
        Dictionary mapping section names to their raw DataFrames.
    """
    logger.info("--- EXTRACT phase started ---")
    team_comparison_profiles = _run_query(conn, _SQL_TEAM_COMPARISON_PROFILES)
    team_comparison_profiles_by_country = _run_query(conn, _SQL_TEAM_COMPARISON_PROFILES_BY_COUNTRY)
    team_comparison_profiles_by_competition = _run_query(conn, _SQL_TEAM_COMPARISON_PROFILES_BY_COMPETITION)
    team_comparison_profiles_by_country_competition = _run_query(
        conn, _SQL_TEAM_COMPARISON_PROFILES_BY_COUNTRY_COMPETITION
    )
    team_experience_rows = _run_query(conn, _SQL_TEAM_EXPERIENCE_ROWS)
    team_experience_profiles = _build_team_experience_profiles_df(team_experience_rows, [])
    team_experience_profiles_by_country = _build_team_experience_profiles_df(team_experience_rows, ["country"])
    team_experience_profiles_by_competition = _build_team_experience_profiles_df(
        team_experience_rows,
        ["competition_name"],
    )
    team_experience_profiles_by_country_competition = _build_team_experience_profiles_df(
        team_experience_rows,
        ["competition_name", "country"],
    )
    player_age_performance_points = _build_player_age_performance_points_df(team_experience_rows, [])
    player_age_performance_points_by_country = _build_player_age_performance_points_df(
        team_experience_rows,
        ["country"],
    )
    player_age_performance_points_by_competition = _build_player_age_performance_points_df(
        team_experience_rows,
        ["competition_name"],
    )
    player_age_performance_points_by_country_competition = _build_player_age_performance_points_df(
        team_experience_rows,
        ["competition_name", "country"],
    )
    player_age_performance_bands = _build_player_age_performance_bands_df(
        player_age_performance_points,
        [],
    )
    player_age_performance_bands_by_country = _build_player_age_performance_bands_df(
        player_age_performance_points_by_country,
        ["country"],
    )
    player_age_performance_bands_by_competition = _build_player_age_performance_bands_df(
        player_age_performance_points_by_competition,
        ["competition_name"],
    )
    player_age_performance_bands_by_country_competition = _build_player_age_performance_bands_df(
        player_age_performance_points_by_country_competition,
        ["competition_name", "country"],
    )

    data: Dict[str, pd.DataFrame] = {
        "kpis":            _run_query(conn, _SQL_KPIS),
        "country_ranking":  _run_query(conn, _SQL_RANKING_PAISES),
        "top_jugadores":   _run_query(conn, _SQL_TOP_JUGADORES_2024),
        "evolucion":       _run_query(conn, _SQL_EVOLUCION_JUGADORES),
        "roles":           _run_query(conn, _SQL_ANALISIS_ROLES),
        "squad_usage_summary": _run_query(conn, _SQL_SQUAD_USAGE_SUMMARY),
        "squad_usage_team_breakdown": _run_query(conn, _SQL_SQUAD_USAGE_TEAM_BREAKDOWN),
        "team_comparison_profiles": team_comparison_profiles,
        "top_teams":     _run_query(conn, _SQL_TOP_EQUIPOS),
        "teams_catalog": _run_query(conn, _SQL_TEAMS_CATALOG),
        "competitions":    _run_query(conn, _SQL_COMPETENCIAS),
        "veteranos":       _run_query(conn, _SQL_VETERANOS),
        "metricas":        _run_query(conn, _SQL_METRICAS),
        "radar_teamwork":  _run_query(conn, _SQL_RADAR_TEAMWORK),
        "scatter_age_performance": _run_query(conn, _SQL_SCATTER_AGE_PERFORMANCE),
        "competition_cross_filter": _run_query(conn, _SQL_COMPETITION_CROSS_FILTER),
        "player_competition_mapping": _run_query(conn, _SQL_PLAYER_COMPETITION_MAPPING),
        "kpis_by_country": _run_query(conn, _SQL_KPIS_BY_COUNTRY),
        "kpis_by_competition": _run_query(conn, _SQL_KPIS_BY_COMPETITION),
        "kpis_by_country_competition": _run_query(conn, _SQL_KPIS_BY_COUNTRY_COMPETITION),
        "country_ranking_by_competition": _run_query(conn, _SQL_COUNTRY_RANKING_BY_COMPETITION),
        "top_teams_by_competition": _run_query(conn, _SQL_TOP_TEAMS_BY_COMPETITION),
        "top_players_by_competition": _run_query(conn, _SQL_TOP_PLAYERS_BY_COMPETITION),
        "player_evolution_by_competition": _run_query(conn, _SQL_PLAYER_EVOLUTION_BY_COMPETITION),
        "role_analysis_by_competition": _run_query(conn, _SQL_ROLE_ANALYSIS_BY_COMPETITION),
        "squad_usage_by_country": _run_query(conn, _SQL_SQUAD_USAGE_BY_COUNTRY),
        "squad_usage_by_competition": _run_query(conn, _SQL_SQUAD_USAGE_BY_COMPETITION),
        "squad_usage_by_country_competition": _run_query(conn, _SQL_SQUAD_USAGE_BY_COUNTRY_COMPETITION),
        "squad_usage_team_breakdown_by_country": _run_query(conn, _SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COUNTRY),
        "squad_usage_team_breakdown_by_competition": _run_query(conn, _SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COMPETITION),
        "squad_usage_team_breakdown_by_country_competition": _run_query(conn, _SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COUNTRY_COMPETITION),
        "team_comparison_profiles_by_country": team_comparison_profiles_by_country,
        "team_comparison_profiles_by_competition": team_comparison_profiles_by_competition,
        "team_comparison_profiles_by_country_competition": team_comparison_profiles_by_country_competition,
        "team_experience_summary": _derive_team_experience_summary_df(
            team_experience_profiles,
            [],
        ),
        "team_experience_profiles": team_experience_profiles,
        "team_experience_summary_by_country": _derive_team_experience_summary_df(
            team_experience_profiles_by_country,
            ["country"],
        ),
        "team_experience_profiles_by_country": team_experience_profiles_by_country,
        "team_experience_summary_by_competition": _derive_team_experience_summary_df(
            team_experience_profiles_by_competition,
            ["competition_name"],
        ),
        "team_experience_profiles_by_competition": team_experience_profiles_by_competition,
        "team_experience_summary_by_country_competition": _derive_team_experience_summary_df(
            team_experience_profiles_by_country_competition,
            ["competition_name", "country"],
        ),
        "team_experience_profiles_by_country_competition": team_experience_profiles_by_country_competition,
        "player_age_performance_points": player_age_performance_points,
        "player_age_performance_points_by_country": player_age_performance_points_by_country,
        "player_age_performance_points_by_competition": player_age_performance_points_by_competition,
        "player_age_performance_points_by_country_competition": player_age_performance_points_by_country_competition,
        "player_age_performance_bands": player_age_performance_bands,
        "player_age_performance_bands_by_country": player_age_performance_bands_by_country,
        "player_age_performance_bands_by_competition": player_age_performance_bands_by_competition,
        "player_age_performance_bands_by_country_competition": player_age_performance_bands_by_country_competition,
        "radar_teamwork_by_competition": _run_query(conn, _SQL_RADAR_TEAMWORK_BY_COMPETITION),
        "scatter_age_performance_by_competition": _run_query(conn, _SQL_SCATTER_AGE_PERFORMANCE_BY_COMPETITION),
        "veteran_players_by_competition": _run_query(conn, _SQL_VETERAN_PLAYERS_BY_COMPETITION),
        "players_index": _run_query(conn, _SQL_PLAYERS_INDEX),
    }
    data["team_comparison_leaders"] = _derive_team_comparison_leaders_df(
        data["team_comparison_profiles"],
        [],
    )
    data["team_comparison_leaders_by_country"] = _derive_team_comparison_leaders_df(
        data["team_comparison_profiles_by_country"],
        ["country"],
    )
    data["team_comparison_leaders_by_competition"] = _derive_team_comparison_leaders_df(
        data["team_comparison_profiles_by_competition"],
        ["competition_name"],
    )
    data["team_comparison_leaders_by_country_competition"] = _derive_team_comparison_leaders_df(
        data["team_comparison_profiles_by_country_competition"],
        ["competition_name", "country"],
    )
    data["team_experience_leaders"] = _derive_team_experience_leaders_df(
        data["team_experience_profiles"],
        [],
    )
    data["team_experience_leaders_by_country"] = _derive_team_experience_leaders_df(
        data["team_experience_profiles_by_country"],
        ["country"],
    )
    data["team_experience_leaders_by_competition"] = _derive_team_experience_leaders_df(
        data["team_experience_profiles_by_competition"],
        ["competition_name"],
    )
    data["team_experience_leaders_by_country_competition"] = _derive_team_experience_leaders_df(
        data["team_experience_profiles_by_country_competition"],
        ["competition_name", "country"],
    )
    data["player_age_performance_summary"] = _derive_player_age_performance_summary_df(
        data["player_age_performance_points"],
        data["player_age_performance_bands"],
        [],
    )
    data["player_age_performance_summary_by_country"] = _derive_player_age_performance_summary_df(
        data["player_age_performance_points_by_country"],
        data["player_age_performance_bands_by_country"],
        ["country"],
    )
    data["player_age_performance_summary_by_competition"] = _derive_player_age_performance_summary_df(
        data["player_age_performance_points_by_competition"],
        data["player_age_performance_bands_by_competition"],
        ["competition_name"],
    )
    data["player_age_performance_summary_by_country_competition"] = _derive_player_age_performance_summary_df(
        data["player_age_performance_points_by_country_competition"],
        data["player_age_performance_bands_by_country_competition"],
        ["competition_name", "country"],
    )
    data["player_age_performance_leaders"] = _derive_player_age_performance_leaders_df(
        data["player_age_performance_points"],
        [],
    )
    data["player_age_performance_leaders_by_country"] = _derive_player_age_performance_leaders_df(
        data["player_age_performance_points_by_country"],
        ["country"],
    )
    data["player_age_performance_leaders_by_competition"] = _derive_player_age_performance_leaders_df(
        data["player_age_performance_points_by_competition"],
        ["competition_name"],
    )
    data["player_age_performance_leaders_by_country_competition"] = _derive_player_age_performance_leaders_df(
        data["player_age_performance_points_by_country_competition"],
        ["competition_name", "country"],
    )
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
        pandera_issues = validate_with_pandera(key, df)
        if pandera_issues:
            errors_found += 1
            logger.error("  ✘ [pandera:%s] FAILED validation:", key)
            for msg in pandera_issues:
                logger.error("    %s", msg)

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


def validate_consistency(
    data: Dict[str, Any],
    *,
    tolerance: float = 0.01,
    raise_on_error: bool = True,
) -> Dict[str, List[str]]:
    """Run filter-ready consistency checks after transform.

    Args:
        data: Transformed dashboard dictionary.
        tolerance: Numeric tolerance for comparisons.

    Returns:
        Mapping of check name to list of issues.

    Raises:
        SystemExit: If any consistency check fails.
    """
    logger.info("--- CONSISTENCY phase started ---")
    filter_ready = data.get("filter_ready", {})
    competitions = data.get("competitions", [])
    results = run_consistency_checks(
        filter_ready=filter_ready,
        competitions=competitions,
        tolerance=tolerance,
    )

    errors_found = 0
    for name, issues in results.items():
        if issues:
            errors_found += 1
            logger.error("  ✘ [consistency:%s] FAILED (%d issue(s))", name, len(issues))
            for issue in issues:
                logger.error("    %s", issue)
        else:
            logger.info("  ✔ [consistency:%s] passed", name)

    if errors_found and raise_on_error:
        logger.error(
            "PIPELINE HALTED: %d consistency check(s) failed. Fix the data before deploying.",
            errors_found,
        )
        sys.exit(1)

    if errors_found == 0:
        logger.info("--- CONSISTENCY phase completed: all checks passed ---")
    return results


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
        p24 = rec.get("performance_2024")
        p25 = rec.get("performance_2025")
        if p24 is not None and p25 is not None:
            delta = round(p25 - p24, 1)
        else:
            delta = None
        if rec.get("trend") == "Improved":
            rec["improvement"] = delta
        elif rec.get("trend") == "Declined":
            rec["decline"] = delta
        if p24 is None or p25 is None or p24 == 0:
            rec["improvement_pct"] = None
        else:
            rec["improvement_pct"] = round(((p25 - p24) / p24) * 100, 2)
    return records


def _row_has_competition_year_performance(record: Dict[str, Any]) -> bool:
    """Return True when a competition row has player performance for its own year."""
    year = record.get("competition_year")
    if year is None:
        return False
    if int(year) == 2024:
        return record.get("performance_2024") is not None
    if int(year) == 2025:
        return record.get("performance_2025") is not None
    return False


def _filter_player_competition_rows_for_year(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep only competition player rows with annual performance aligned to competition year."""
    return [record for record in records if _row_has_competition_year_performance(record)]


def _normalize_text(value: Optional[str]) -> str:
    """Normalize text for case- and accent-insensitive search."""
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()


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
        "total_teams":                int(kpis_row["total_teams"]),
        "total_players":              int(kpis_row["total_players"]),
        "total_prizes":                float(kpis_row["total_prizes"]),
        "countries_represented":         int(kpis_row["countries_represented"]),
        "active_competitions":         int(kpis_row["active_competitions"]),
        "average_age":                float(kpis_row["average_age"]),
        "international_competitions": int(kpis_row["international_competitions"]),
        "national_competitions":      int(kpis_row["national_competitions"]),
    }

    # Table sections → list of records
    raw["country_ranking"]["total_prizes"] = raw["country_ranking"]["total_prizes"].astype(float)
    raw["country_ranking"]["average_age"] = raw["country_ranking"]["average_age"].astype(float)
    ranking_paises    = _to_records(raw["country_ranking"])

    raw["top_jugadores"]["performance_2024"] = raw["top_jugadores"]["performance_2024"].astype(float)
    top_jugadores     = _to_records(raw["top_jugadores"])

    raw["evolucion"]["performance_2024"] = raw["evolucion"]["performance_2024"].astype(float)
    raw["evolucion"]["performance_2025"] = raw["evolucion"]["performance_2025"].astype(float)
    evolucion_raw     = _to_records(raw["evolucion"])
    evolucion         = _add_evolution_deltas(evolucion_raw)

    raw["radar_teamwork"]["avg_teamwork"] = raw["radar_teamwork"]["avg_teamwork"].astype(float)
    raw["radar_teamwork"]["avg_winrate"]  = raw["radar_teamwork"]["avg_winrate"].astype(float)
    raw["radar_teamwork"]["total_prizes"] = raw["radar_teamwork"]["total_prizes"].astype(float)
    radar_teamwork    = _to_records(raw["radar_teamwork"])

    raw["scatter_age_performance"]["performance"] = raw["scatter_age_performance"]["performance"].astype(float)
    scatter_age       = _to_records(raw["scatter_age_performance"])

    raw["roles"]["average_performance"] = raw["roles"]["average_performance"].astype(float)
    analisis_roles    = _to_records(raw["roles"])

    raw["top_teams"]["total_prizes"] = raw["top_teams"]["total_prizes"].astype(float)
    raw["top_teams"]["average_position"] = raw["top_teams"]["average_position"].astype(float)
    top_equipos       = _to_records(raw["top_teams"])

    raw["teams_catalog"]["total_prizes"] = raw["teams_catalog"]["total_prizes"].astype(float)
    raw["teams_catalog"]["best_position"] = raw["teams_catalog"]["best_position"].astype(float)
    teams_catalog = _to_records(raw["teams_catalog"])

    raw["competitions"]["total_prize"] = raw["competitions"]["total_prize"].astype(float)
    raw["competitions"]["average_age"] = raw["competitions"]["average_age"].astype(float)
    competencias      = _to_records(raw["competitions"])

    raw["veteranos"]["performance_2024"] = raw["veteranos"]["performance_2024"].astype(float)
    veteranos         = _to_records(raw["veteranos"])

    # Métricas resumen — single row → dict
    metricas_row = raw["metricas"].iloc[0]
    metricas = {
        "best_international_team":     metricas_row["best_international_team"],
        "best_player_2024":             metricas_row["best_player_2024"],
        "most_improved_2025":              metricas_row["most_improved_2025"],
        "dominant_country":                 metricas_row["dominant_country"],
        "most_competitive":    metricas_row["most_competitive"],
        "overall_average_performance":   float(metricas_row["overall_average_performance"]),
        "total_international_prizes":  float(metricas_row["total_international_prizes"]),
        "total_national_prizes":       float(metricas_row["total_national_prizes"]),
    }

    raw["competition_cross_filter"]["country_prize"] = raw["competition_cross_filter"]["country_prize"].astype(float)
    raw["competition_cross_filter"]["average_prize_per_team"] = raw["competition_cross_filter"]["average_prize_per_team"].astype(float)
    raw["competition_cross_filter"]["average_age"] = raw["competition_cross_filter"]["average_age"].astype(float)
    competencias_cross = _to_records(raw["competition_cross_filter"])

    # Filter-ready datasets
    raw["kpis_by_country"]["total_prizes"] = raw["kpis_by_country"]["total_prizes"].astype(float)
    raw["kpis_by_country"]["average_age"] = raw["kpis_by_country"]["average_age"].astype(float)
    kpis_by_country = _to_records(raw["kpis_by_country"])

    raw["kpis_by_competition"]["total_prizes"] = raw["kpis_by_competition"]["total_prizes"].astype(float)
    raw["kpis_by_competition"]["average_age"] = raw["kpis_by_competition"]["average_age"].astype(float)
    kpis_by_competition = _to_records(raw["kpis_by_competition"])

    raw["kpis_by_country_competition"]["total_prizes"] = raw["kpis_by_country_competition"]["total_prizes"].astype(float)
    raw["kpis_by_country_competition"]["average_age"] = raw["kpis_by_country_competition"]["average_age"].astype(float)
    kpis_by_country_competition = _to_records(raw["kpis_by_country_competition"])

    raw["country_ranking_by_competition"]["total_prizes"] = raw["country_ranking_by_competition"]["total_prizes"].astype(float)
    raw["country_ranking_by_competition"]["average_prize_per_team"] = raw["country_ranking_by_competition"]["average_prize_per_team"].astype(float)
    raw["country_ranking_by_competition"]["average_age"] = raw["country_ranking_by_competition"]["average_age"].astype(float)
    country_ranking_by_competition = _to_records(raw["country_ranking_by_competition"])

    raw["top_teams_by_competition"]["prize_obtained"] = raw["top_teams_by_competition"]["prize_obtained"].astype(float)
    raw["top_teams_by_competition"]["final_position"] = raw["top_teams_by_competition"]["final_position"].astype(float)
    raw["top_teams_by_competition"]["total_players"] = raw["top_teams_by_competition"]["total_players"].astype(int)
    top_teams_by_competition = _to_records(raw["top_teams_by_competition"])

    raw["top_players_by_competition"]["performance_2024"] = raw["top_players_by_competition"]["performance_2024"].astype(float)
    raw["top_players_by_competition"]["performance_2025"] = raw["top_players_by_competition"]["performance_2025"].astype(float)
    top_players_by_competition = _to_records(raw["top_players_by_competition"])

    raw["player_evolution_by_competition"]["performance_2024"] = raw["player_evolution_by_competition"]["performance_2024"].astype(float)
    raw["player_evolution_by_competition"]["performance_2025"] = raw["player_evolution_by_competition"]["performance_2025"].astype(float)
    evolucion_competition_raw = _to_records(raw["player_evolution_by_competition"])
    player_evolution_by_competition = _filter_player_competition_rows_for_year(
        _add_evolution_deltas(evolucion_competition_raw)
    )

    raw["role_analysis_by_competition"]["average_performance"] = raw["role_analysis_by_competition"]["average_performance"].astype(float)
    role_analysis_by_competition = _to_records(raw["role_analysis_by_competition"])

    squad_usage_int_columns = {
        "squad_usage_summary": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ],
        "squad_usage_team_breakdown": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
        ],
        "squad_usage_by_country": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ],
        "squad_usage_by_competition": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ],
        "squad_usage_by_country_competition": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ],
        "squad_usage_team_breakdown_by_country": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
        ],
        "squad_usage_team_breakdown_by_competition": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
        ],
        "squad_usage_team_breakdown_by_country_competition": [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
        ],
    }
    for dataset, columns in squad_usage_int_columns.items():
        for column in columns:
            raw[dataset][column] = raw[dataset][column].astype(int)

    squad_usage_summary_rows = _to_records(raw["squad_usage_summary"])
    squad_usage_summary = squad_usage_summary_rows[0] if squad_usage_summary_rows else {}
    squad_usage_team_breakdown = _to_records(raw["squad_usage_team_breakdown"])
    squad_usage_by_country = _to_records(raw["squad_usage_by_country"])
    squad_usage_by_competition = _to_records(raw["squad_usage_by_competition"])
    squad_usage_by_country_competition = _to_records(raw["squad_usage_by_country_competition"])
    squad_usage_team_breakdown_by_country = _to_records(raw["squad_usage_team_breakdown_by_country"])
    squad_usage_team_breakdown_by_competition = _to_records(raw["squad_usage_team_breakdown_by_competition"])
    squad_usage_team_breakdown_by_country_competition = _to_records(
        raw["squad_usage_team_breakdown_by_country_competition"]
    )

    team_experience_int_columns = {
        "team_experience_summary": [
            "teams_count",
            "veteran_starters_count",
            "veteran_substitutes_count",
            "veteran_mixed_count",
        ],
        "team_experience_summary_by_country": [
            "teams_count",
            "veteran_starters_count",
            "veteran_substitutes_count",
            "veteran_mixed_count",
        ],
        "team_experience_summary_by_competition": [
            "teams_count",
            "veteran_starters_count",
            "veteran_substitutes_count",
            "veteran_mixed_count",
        ],
        "team_experience_summary_by_country_competition": [
            "teams_count",
            "veteran_starters_count",
            "veteran_substitutes_count",
            "veteran_mixed_count",
        ],
        "team_experience_profiles": ["competitions_count"],
        "team_experience_profiles_by_country": ["competitions_count"],
        "team_experience_profiles_by_competition": ["competitions_count"],
        "team_experience_profiles_by_country_competition": ["competitions_count"],
    }
    for dataset, columns in team_experience_int_columns.items():
        for column in columns:
            raw[dataset][column] = raw[dataset][column].fillna(0).astype(int)

    team_experience_summary_rows = _to_records(raw["team_experience_summary"])
    team_experience_summary = team_experience_summary_rows[0] if team_experience_summary_rows else {}
    team_experience_profiles = _to_records(raw["team_experience_profiles"])
    team_experience_leaders_rows = _to_records(raw["team_experience_leaders"])
    team_experience_leaders = team_experience_leaders_rows[0] if team_experience_leaders_rows else {}
    team_experience_summary_by_country = _to_records(raw["team_experience_summary_by_country"])
    team_experience_summary_by_competition = _to_records(raw["team_experience_summary_by_competition"])
    team_experience_summary_by_country_competition = _to_records(raw["team_experience_summary_by_country_competition"])
    team_experience_profiles_by_country = _to_records(raw["team_experience_profiles_by_country"])
    team_experience_profiles_by_competition = _to_records(raw["team_experience_profiles_by_competition"])
    team_experience_profiles_by_country_competition = _to_records(
        raw["team_experience_profiles_by_country_competition"]
    )
    team_experience_leaders_by_country = _to_records(raw["team_experience_leaders_by_country"])
    team_experience_leaders_by_competition = _to_records(raw["team_experience_leaders_by_competition"])
    team_experience_leaders_by_country_competition = _to_records(
        raw["team_experience_leaders_by_country_competition"]
    )

    team_comparison_int_columns = {
        "team_comparison_profiles": ["competitions_count", "titles_count", "podium_count"],
        "team_comparison_profiles_by_country": ["competitions_count", "titles_count", "podium_count"],
        "team_comparison_profiles_by_competition": ["competitions_count", "titles_count", "podium_count"],
        "team_comparison_profiles_by_country_competition": ["competitions_count", "titles_count", "podium_count"],
    }
    for dataset, columns in team_comparison_int_columns.items():
        for column in columns:
            raw[dataset][column] = raw[dataset][column].astype(int)

    team_comparison_profiles = _to_records(raw["team_comparison_profiles"])
    team_comparison_profiles_by_country = _to_records(raw["team_comparison_profiles_by_country"])
    team_comparison_profiles_by_competition = _to_records(raw["team_comparison_profiles_by_competition"])
    team_comparison_profiles_by_country_competition = _to_records(
        raw["team_comparison_profiles_by_country_competition"]
    )

    team_comparison_leaders_rows = _to_records(raw["team_comparison_leaders"])
    team_comparison_leaders = team_comparison_leaders_rows[0] if team_comparison_leaders_rows else {}
    team_comparison_leaders_by_country = _to_records(raw["team_comparison_leaders_by_country"])
    team_comparison_leaders_by_competition = _to_records(raw["team_comparison_leaders_by_competition"])
    team_comparison_leaders_by_country_competition = _to_records(
        raw["team_comparison_leaders_by_country_competition"]
    )

    player_age_performance_int_columns = {
        "player_age_performance_summary": ["players_count"],
        "player_age_performance_summary_by_country": ["players_count"],
        "player_age_performance_summary_by_competition": ["players_count"],
        "player_age_performance_summary_by_country_competition": ["players_count"],
        "player_age_performance_bands": ["players_count"],
        "player_age_performance_bands_by_country": ["players_count"],
        "player_age_performance_bands_by_competition": ["players_count"],
        "player_age_performance_bands_by_country_competition": ["players_count"],
        "player_age_performance_points": ["competitions_count"],
        "player_age_performance_points_by_country": ["competitions_count"],
        "player_age_performance_points_by_competition": [],
        "player_age_performance_points_by_country_competition": [],
    }
    for dataset, columns in player_age_performance_int_columns.items():
        for column in columns:
            raw[dataset][column] = raw[dataset][column].fillna(0).astype(int)

    raw["player_age_performance_points"]["age"] = raw["player_age_performance_points"]["age"].astype(int)
    raw["player_age_performance_points_by_country"]["age"] = raw["player_age_performance_points_by_country"]["age"].astype(int)
    raw["player_age_performance_points_by_competition"]["age"] = raw["player_age_performance_points_by_competition"]["age"].astype(int)
    raw["player_age_performance_points_by_country_competition"]["age"] = raw["player_age_performance_points_by_country_competition"]["age"].astype(int)

    player_age_performance_summary_rows = _to_records(raw["player_age_performance_summary"])
    player_age_performance_summary = (
        player_age_performance_summary_rows[0] if player_age_performance_summary_rows else {}
    )
    player_age_performance_summary_by_country = _to_records(raw["player_age_performance_summary_by_country"])
    player_age_performance_summary_by_competition = _to_records(raw["player_age_performance_summary_by_competition"])
    player_age_performance_summary_by_country_competition = _to_records(
        raw["player_age_performance_summary_by_country_competition"]
    )
    player_age_performance_bands = _to_records(raw["player_age_performance_bands"])
    player_age_performance_bands_by_country = _to_records(raw["player_age_performance_bands_by_country"])
    player_age_performance_bands_by_competition = _to_records(raw["player_age_performance_bands_by_competition"])
    player_age_performance_bands_by_country_competition = _to_records(
        raw["player_age_performance_bands_by_country_competition"]
    )
    player_age_performance_points = _to_records(raw["player_age_performance_points"])
    player_age_performance_points_by_country = _to_records(raw["player_age_performance_points_by_country"])
    player_age_performance_points_by_competition = _to_records(raw["player_age_performance_points_by_competition"])
    player_age_performance_points_by_country_competition = _to_records(
        raw["player_age_performance_points_by_country_competition"]
    )
    player_age_performance_leaders_rows = _to_records(raw["player_age_performance_leaders"])
    player_age_performance_leaders = (
        player_age_performance_leaders_rows[0] if player_age_performance_leaders_rows else {}
    )
    player_age_performance_leaders_by_country = _to_records(raw["player_age_performance_leaders_by_country"])
    player_age_performance_leaders_by_competition = _to_records(raw["player_age_performance_leaders_by_competition"])
    player_age_performance_leaders_by_country_competition = _to_records(
        raw["player_age_performance_leaders_by_country_competition"]
    )

    raw["radar_teamwork_by_competition"]["avg_teamwork"] = raw["radar_teamwork_by_competition"]["avg_teamwork"].astype(float)
    raw["radar_teamwork_by_competition"]["avg_winrate"] = raw["radar_teamwork_by_competition"]["avg_winrate"].astype(float)
    raw["radar_teamwork_by_competition"]["total_prizes"] = raw["radar_teamwork_by_competition"]["total_prizes"].astype(float)
    radar_teamwork_by_competition = _to_records(raw["radar_teamwork_by_competition"])

    raw["scatter_age_performance_by_competition"]["performance"] = raw["scatter_age_performance_by_competition"]["performance"].astype(float)
    scatter_age_by_competition = _to_records(raw["scatter_age_performance_by_competition"])

    raw["veteran_players_by_competition"]["performance_2024"] = raw["veteran_players_by_competition"]["performance_2024"].astype(float)
    veteran_players_by_competition = _to_records(raw["veteran_players_by_competition"])

    players_index_df = raw["players_index"].copy()
    players_index_df["search_key"] = players_index_df["name"].map(_normalize_text)
    players_index = _to_records(players_index_df)

    result = {
        "main_kpis":      kpis,
        "country_ranking":        ranking_paises,
        "top_players_2024":    top_jugadores,
        "player_evolution":   evolucion,
        "radar_teamwork": radar_teamwork,
        "scatter_age_performance_new": scatter_age,
        "role_analysis":        analisis_roles,
        "squad_usage_summary": squad_usage_summary,
        "squad_usage_team_breakdown": squad_usage_team_breakdown,
        "team_experience_summary": team_experience_summary,
        "team_experience_profiles": team_experience_profiles,
        "team_experience_leaders": team_experience_leaders,
        "team_comparison_profiles": team_comparison_profiles,
        "team_comparison_leaders": team_comparison_leaders,
        "player_age_performance_summary": player_age_performance_summary,
        "player_age_performance_bands": player_age_performance_bands,
        "player_age_performance_points": player_age_performance_points,
        "player_age_performance_leaders": player_age_performance_leaders,
        "top_teams":           top_equipos,
        "teams_catalog": teams_catalog,
        "competitions":          competencias,
        "veteran_players":         veteranos,
        "summary_metrics":          metricas,
        "competition_cross_filter": competencias_cross,
        "player_competition_mapping": _to_records(raw["player_competition_mapping"]),
        "filter_ready": {
            "kpis_by_country": kpis_by_country,
            "kpis_by_competition": kpis_by_competition,
            "kpis_by_country_competition": kpis_by_country_competition,
            "country_ranking_by_competition": country_ranking_by_competition,
            "top_teams_by_competition": top_teams_by_competition,
            "top_players_by_competition": top_players_by_competition,
            "player_evolution_by_competition": player_evolution_by_competition,
            "role_analysis_by_competition": role_analysis_by_competition,
            "squad_usage_by_country": squad_usage_by_country,
            "squad_usage_by_competition": squad_usage_by_competition,
            "squad_usage_by_country_competition": squad_usage_by_country_competition,
            "squad_usage_team_breakdown_by_country": squad_usage_team_breakdown_by_country,
            "squad_usage_team_breakdown_by_competition": squad_usage_team_breakdown_by_competition,
            "squad_usage_team_breakdown_by_country_competition": squad_usage_team_breakdown_by_country_competition,
            "team_experience_summary_by_country": team_experience_summary_by_country,
            "team_experience_summary_by_competition": team_experience_summary_by_competition,
            "team_experience_summary_by_country_competition": team_experience_summary_by_country_competition,
            "team_experience_profiles_by_country": team_experience_profiles_by_country,
            "team_experience_profiles_by_competition": team_experience_profiles_by_competition,
            "team_experience_profiles_by_country_competition": team_experience_profiles_by_country_competition,
            "team_experience_leaders_by_country": team_experience_leaders_by_country,
            "team_experience_leaders_by_competition": team_experience_leaders_by_competition,
            "team_experience_leaders_by_country_competition": team_experience_leaders_by_country_competition,
            "team_comparison_profiles_by_country": team_comparison_profiles_by_country,
            "team_comparison_profiles_by_competition": team_comparison_profiles_by_competition,
            "team_comparison_profiles_by_country_competition": team_comparison_profiles_by_country_competition,
            "team_comparison_leaders_by_country": team_comparison_leaders_by_country,
            "team_comparison_leaders_by_competition": team_comparison_leaders_by_competition,
            "team_comparison_leaders_by_country_competition": team_comparison_leaders_by_country_competition,
            "player_age_performance_summary_by_country": player_age_performance_summary_by_country,
            "player_age_performance_summary_by_competition": player_age_performance_summary_by_competition,
            "player_age_performance_summary_by_country_competition": player_age_performance_summary_by_country_competition,
            "player_age_performance_bands_by_country": player_age_performance_bands_by_country,
            "player_age_performance_bands_by_competition": player_age_performance_bands_by_competition,
            "player_age_performance_bands_by_country_competition": player_age_performance_bands_by_country_competition,
            "player_age_performance_points_by_country": player_age_performance_points_by_country,
            "player_age_performance_points_by_competition": player_age_performance_points_by_competition,
            "player_age_performance_points_by_country_competition": player_age_performance_points_by_country_competition,
            "player_age_performance_leaders_by_country": player_age_performance_leaders_by_country,
            "player_age_performance_leaders_by_competition": player_age_performance_leaders_by_competition,
            "player_age_performance_leaders_by_country_competition": player_age_performance_leaders_by_country_competition,
            "radar_teamwork_by_competition": radar_teamwork_by_competition,
            "scatter_age_performance_by_competition": scatter_age_by_competition,
            "veteran_players_by_competition": veteran_players_by_competition,
            "players_index": players_index,
        },
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


def _format_markdown_table(headers: List[str], rows: List[List[Any]]) -> str:
    """Render a Markdown table with the provided headers and rows."""
    header_line = "| " + " | ".join(headers) + " |"
    divider = "| " + " | ".join(["---"] * len(headers)) + " |"
    lines = [header_line, divider]
    for row in rows:
        lines.append("| " + " | ".join(str(value) for value in row) + " |")
    return "\n".join(lines)


def _build_audit_report_content(
    data: Dict[str, Any],
    consistency_results: Optional[Dict[str, List[str]]] = None,
) -> str:
    """Build the audit report content as Markdown."""
    filter_ready = data.get("filter_ready", {})
    kpis_by_country = filter_ready.get("kpis_by_country", [])
    kpis_by_country_competition = filter_ready.get("kpis_by_country_competition", [])
    ranking_by_competition = filter_ready.get("country_ranking_by_competition", [])
    kpis_by_competition = filter_ready.get("kpis_by_competition", [])
    players_index = filter_ready.get("players_index", [])
    competitions = data.get("competitions", [])

    if consistency_results is None:
        consistency_results = run_consistency_checks(
            filter_ready=filter_ready,
            competitions=competitions,
        )

    def fmt(value: Any) -> str:
        if value is None:
            return "N/A"
        if isinstance(value, float):
            return f"{value:.2f}"
        return str(value)

    def render_country_section(country_value: str) -> List[str]:
        lines: List[str] = [f"## {country_value}"]
        kpi = next((row for row in kpis_by_country if row.get("country") == country_value), None)
        if not kpi:
            lines.append("_No data for this country._")
            return lines

        kpi_rows = [
            ["total_teams", fmt(kpi.get("total_teams"))],
            ["total_players", fmt(kpi.get("total_players"))],
            ["total_prizes", fmt(kpi.get("total_prizes"))],
            ["average_age", fmt(kpi.get("average_age"))],
            ["active_competitions", fmt(kpi.get("active_competitions"))],
            ["international_competitions", fmt(kpi.get("international_competitions"))],
            ["national_competitions", fmt(kpi.get("national_competitions"))],
        ]
        lines.append("### KPIs del pais")
        lines.append(_format_markdown_table(["kpi", "value"], kpi_rows))

        comp_rows = [
            row for row in kpis_by_country_competition
            if row.get("country") == country_value
        ]
        comp_rows = sorted(comp_rows, key=lambda r: r.get("total_prizes") or 0, reverse=True)[:3]
        if comp_rows:
            lines.append("### KPIs por competencia relevante (top 3 por premios)")
            table_rows = [
                [
                    row.get("competition_name"),
                    row.get("type"),
                    row.get("year"),
                    fmt(row.get("total_teams")),
                    fmt(row.get("total_players")),
                    fmt(row.get("total_prizes")),
                    fmt(row.get("average_age")),
                ]
                for row in comp_rows
            ]
            lines.append(_format_markdown_table(
                ["competition", "type", "year", "teams", "players", "prizes", "avg_age"],
                table_rows,
            ))
        else:
            lines.append("### KPIs por competencia relevante")
            lines.append("_No competition data._")

        ranking_rows = [
            row for row in ranking_by_competition
            if row.get("country") == country_value
        ]
        ranking_rows = sorted(ranking_rows, key=lambda r: r.get("total_prizes") or 0, reverse=True)[:3]
        if ranking_rows:
            lines.append("### Ranking por competencia (top 3 por premios)")
            table_rows = [
                [
                    row.get("competition_name"),
                    fmt(row.get("total_teams")),
                    fmt(row.get("total_players")),
                    fmt(row.get("total_prizes")),
                    fmt(row.get("average_prize_per_team")),
                    fmt(row.get("average_age")),
                ]
                for row in ranking_rows
            ]
            lines.append(_format_markdown_table(
                ["competition", "teams", "players", "prizes", "avg_prize_team", "avg_age"],
                table_rows,
            ))
        else:
            lines.append("### Ranking por competencia")
            lines.append("_No ranking data._")

        return lines

    competition_names = {row.get("name") for row in competitions if row.get("name")}
    kpis_competitions = {row.get("competition_name") for row in kpis_by_competition if row.get("competition_name")}
    ranking_competitions = {row.get("competition_name") for row in ranking_by_competition if row.get("competition_name")}
    country_names = {row.get("country") for row in kpis_by_country if row.get("country")}
    country_comp_names = {row.get("country") for row in kpis_by_country_competition if row.get("country")}
    missing_comp_kpis = sorted(competition_names - kpis_competitions)
    missing_comp_ranking = sorted(competition_names - ranking_competitions)
    missing_countries = sorted(country_names - country_comp_names)

    players_total = len(players_index)
    players_valid = sum(
        1
        for row in players_index
        if row.get("name") and row.get("search_key") == _normalize_text(row.get("name"))
    )

    coverage_rows = [
        ["competencias_catalogo", len(competition_names)],
        ["competencias_con_kpis", len(kpis_competitions)],
        ["competencias_con_ranking", len(ranking_competitions)],
        ["paises_con_kpis", len(country_names)],
        ["paises_con_kpis_pais_competencia", len(country_comp_names)],
        ["players_index_validos", f"{players_valid}/{players_total}"],
    ]

    content: List[str] = [
        "# Auditoria de datos (Caja Blanca)",
        "",
        "Este reporte valida que los KPIs y rankings provienen del ETL (Caja Blanca).",
        "",
        "## Cobertura de filtros",
        _format_markdown_table(["dimension", "cobertura"], coverage_rows),
    ]

    if missing_comp_kpis:
        content.append(f"Competencias sin KPIs: {', '.join(missing_comp_kpis)}")
    if missing_comp_ranking:
        content.append(f"Competencias sin ranking: {', '.join(missing_comp_ranking)}")
    if missing_countries:
        content.append(f"Paises sin KPIs por competencia: {', '.join(missing_countries)}")

    content.append("")
    content.append("## Consistency checks")
    for name, issues in consistency_results.items():
        status = "PASS" if not issues else "FAIL"
        content.append(f"- {name}: {status} ({len(issues)} issue(s))")
    for name, issues in consistency_results.items():
        if issues:
            content.append(f"### {name} issues")
            content.extend([f"- {issue}" for issue in issues])

    content.append("")
    for row in sorted(kpis_by_country, key=lambda r: r.get("total_prizes") or 0, reverse=True):
        country = row.get("country")
        if not country:
            continue
        content.extend(render_country_section(country))
        content.append("")

    content.append("## SQL base (trazabilidad)")
    content.append("### KPIs por pais y competencia")
    content.append("```sql")
    content.append(_SQL_KPIS_BY_COUNTRY_COMPETITION.strip())
    content.append("```")
    content.append("")
    content.append("### Ranking por competencia")
    content.append("```sql")
    content.append(_SQL_COUNTRY_RANKING_BY_COMPETITION.strip())
    content.append("```")

    return "\n".join(content).strip() + "\n"


def _write_audit_report(
    data: Dict[str, Any],
    output_path: Optional[Path] = None,
    *,
    consistency_results: Optional[Dict[str, List[str]]] = None,
) -> None:
    """Write audit report for all countries using filter-ready datasets."""
    target = output_path or _AUDIT_PATH
    target.parent.mkdir(parents=True, exist_ok=True)

    content = _build_audit_report_content(data, consistency_results)
    target.write_text(content, encoding="utf-8")
    logger.info("Wrote audit report: %s", target)

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
        
        ml_bundle = _empty_ml_projection_bundle()
        if _ML_AVAILABLE:
            try:
                ml_bundle = generate_ml_projection_bundle(conn)
            except Exception as e:
                logger.error("ML projection failed: %s", e)

        dashboard["predictions_2026"] = ml_bundle.get("predictions_2026", [])
        dashboard["ml_projection_2026_summary"] = ml_bundle.get("ml_projection_2026_summary", {})
        dashboard["ml_projection_2026_players"] = ml_bundle.get("ml_projection_2026_players", [])
        dashboard["ml_projection_2026_team_summary"] = ml_bundle.get("ml_projection_2026_team_summary", [])
        dashboard["ml_projection_2026_country_summary"] = ml_bundle.get("ml_projection_2026_country_summary", [])
        dashboard["ml_projection_2026_feature_importance"] = ml_bundle.get("ml_projection_2026_feature_importance", [])
        dashboard.setdefault("filter_ready", {})
        dashboard["filter_ready"]["ml_projection_2026_summary_by_country"] = (
            ml_bundle.get("filter_ready", {}).get("ml_projection_2026_summary_by_country", [])
        )
        dashboard["filter_ready"]["ml_projection_2026_players_by_country"] = (
            ml_bundle.get("filter_ready", {}).get("ml_projection_2026_players_by_country", [])
        )
        dashboard["filter_ready"]["ml_projection_2026_team_summary_by_country"] = (
            ml_bundle.get("filter_ready", {}).get("ml_projection_2026_team_summary_by_country", [])
        )
        dashboard["filter_ready"]["ml_projection_2026_country_summary_by_country"] = (
            ml_bundle.get("filter_ready", {}).get("ml_projection_2026_country_summary_by_country", [])
        )

        consistency_results = validate_consistency(dashboard, raise_on_error=False)
        _write_audit_report(dashboard, consistency_results=consistency_results)
        if any(consistency_results.values()):
            logger.error(
                "PIPELINE HALTED: consistency checks failed. Fix the data before deploying."
            )
            sys.exit(1)

        load(dashboard)
    finally:
        conn.close()
        logger.info("MySQL connection closed.")

    logger.info("=" * 60)
    logger.info("eSports ETL Pipeline — finished successfully")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
