"""
eSports Analytics Dashboard — Data Quality Validators
======================================================
Data integrity gates between the Extract and Transform phases.

Each validator function checks a DataFrame against business rules
(winrates 0-100 %, premios >= 0, valid roles, etc.). If any rule
is violated the pipeline will halt before producing a corrupted JSON.
"""

import logging
from typing import Any, Dict, List, Tuple

import pandas as pd

logger = logging.getLogger("etl_pipeline")

# ---------------------------------------------------------------------------
# Helper assertions
# ---------------------------------------------------------------------------

ValidationResult = Tuple[bool, List[str]]


def _check_not_null(df: pd.DataFrame, columns: List[str]) -> List[str]:
    """Return error messages for any unexpected NULL values."""
    errors: List[str] = []
    for col in columns:
        if col in df.columns and df[col].isnull().any():
            count = int(df[col].isnull().sum())
            errors.append(f"Column '{col}' has {count} NULL value(s)")
    return errors


def _check_range(df: pd.DataFrame, col: str, low: float, high: float) -> List[str]:
    """Return error messages for values outside [low, high]."""
    errors: List[str] = []
    if col not in df.columns:
        return errors
    series = pd.to_numeric(df[col], errors="coerce").dropna()
    mask = (series < low) | (series > high)
    if mask.any():
        bad = series[mask].tolist()
        errors.append(f"Column '{col}' has {len(bad)} value(s) outside [{low}, {high}]: {bad[:5]}")
    return errors


def _check_ge(df: pd.DataFrame, col: str, minimum: float) -> List[str]:
    """Return error messages for values below *minimum*."""
    errors: List[str] = []
    if col not in df.columns:
        return errors
    series = pd.to_numeric(df[col], errors="coerce").dropna()
    mask = series < minimum
    if mask.any():
        bad = series[mask].tolist()
        errors.append(f"Column '{col}' has {len(bad)} value(s) < {minimum}: {bad[:5]}")
    return errors


def _check_isin(df: pd.DataFrame, col: str, allowed: List[str]) -> List[str]:
    """Return error messages for values not in *allowed*."""
    errors: List[str] = []
    if col not in df.columns:
        return errors
    bad = df.loc[~df[col].isin(allowed), col].tolist()
    if bad:
        errors.append(f"Column '{col}' has {len(bad)} invalid value(s): {bad[:5]}")
    return errors


# ---------------------------------------------------------------------------
# Per-dataset validators
# ---------------------------------------------------------------------------

def _validate_kpis(df: pd.DataFrame) -> List[str]:
    """KPIs: all counts >= 0, age in [15, 50]."""
    errs: List[str] = []
    for col in ["total_equipos", "total_jugadores", "total_premios",
                "paises_representados", "competencias_activas",
                "competencias_internacionales", "competencias_nacionales"]:
        errs += _check_ge(df, col, 0)
    errs += _check_range(df, "promedio_edad", 15, 50)
    return errs


def _validate_ranking_paises(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["pais"])
    errs += _check_ge(df, "total_equipos", 1)
    errs += _check_ge(df, "premios_totales", 0)
    return errs


def _validate_top_jugadores(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["nombre", "nacionalidad", "tendencia"])
    errs += _check_range(df, "performance_2024", 0, 100)
    errs += _check_range(df, "performance_2025", 0, 100)
    errs += _check_isin(df, "tendencia",
                        ["Mejoró", "Empeoró", "Sin cambios", "Sin datos 2025"])
    return errs


def _validate_evolucion(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["nombre", "nacionalidad", "tendencia"])
    errs += _check_range(df, "performance_2024", 0, 100)
    errs += _check_range(df, "performance_2025", 0, 100)
    errs += _check_isin(df, "tendencia", ["Mejoró", "Empeoró", "Sin cambios"])
    return errs


def _validate_roles(df: pd.DataFrame) -> List[str]:
    errs = _check_isin(df, "rol", ["Titular", "Suplente"])
    errs += _check_ge(df, "total_participaciones", 0)
    errs += _check_ge(df, "jugadores_unicos", 0)
    errs += _check_range(df, "promedio_performance", 0, 100)
    return errs


def _validate_top_equipos(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["nombre", "pais"])
    errs += _check_ge(df, "competencias_participadas", 1)
    errs += _check_ge(df, "posicion_promedio", 1.0)
    errs += _check_ge(df, "premios_totales", 0)
    return errs


def _validate_competencias(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["nombre", "ubicacion"])
    errs += _check_isin(df, "tipo", ["Nacional", "Internacional"])
    errs += _check_ge(df, "equipos_participantes", 1)
    errs += _check_ge(df, "premio_total", 0)
    errs += _check_ge(df, "premio_promedio_por_equipo", 0)
    return errs


def _validate_veteranos(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["equipo", "pais", "jugador_veterano"])
    errs += _check_range(df, "edad", 15, 50)
    errs += _check_range(df, "performance_2024", 0, 100)
    return errs


def _validate_metricas(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, [
        "mejor_equipo_internacional", "mejor_jugador_2024",
        "mayor_mejora_2025", "pais_dominante", "competencia_mas_competitiva",
    ])
    errs += _check_range(df, "promedio_performance_general", 0, 100)
    errs += _check_ge(df, "total_premios_internacionales", 0)
    errs += _check_ge(df, "total_premios_nacionales", 0)
    return errs


# ---------------------------------------------------------------------------
# Registry — maps dataset keys to their validator functions
# ---------------------------------------------------------------------------

VALIDATOR_REGISTRY: Dict[str, Any] = {
    "kpis":           _validate_kpis,
    "ranking_paises": _validate_ranking_paises,
    "top_jugadores":  _validate_top_jugadores,
    "evolucion":      _validate_evolucion,
    "roles":          _validate_roles,
    "top_equipos":    _validate_top_equipos,
    "competencias":   _validate_competencias,
    "veteranos":      _validate_veteranos,
    "metricas":       _validate_metricas,
}
