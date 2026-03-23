"""
eSports Analytics Dashboard - Data Quality Validators
=====================================================
Data integrity gates between the Extract and Transform phases.

Each validator function checks a DataFrame against business rules
(winrates 0-100, prizes >= 0, valid roles, etc.). If any rule
is violated the pipeline will halt before producing a corrupted JSON.
"""

import logging
from typing import Any, Dict, List, Tuple

import pandas as pd
import pandera as pa

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


def _check_isin(df: pd.DataFrame, col: str, allowed: List[Any]) -> List[str]:
    """Return error messages for values not in *allowed*."""
    errors: List[str] = []
    if col not in df.columns:
        return errors
    bad = df.loc[~df[col].isin(allowed), col].tolist()
    if bad:
        errors.append(f"Column '{col}' has {len(bad)} invalid value(s): {bad[:5]}")
    return errors


# ---------------------------------------------------------------------------
# Pandera schemas (formal data contracts)
# ---------------------------------------------------------------------------

def _col_int(
    minimum: float | None = None,
    maximum: float | None = None,
    *,
    nullable: bool = False,
) -> pa.Column:
    checks: List[pa.Check] = []
    if minimum is not None:
        checks.append(
            pa.Check(lambda s, m=minimum: s >= m, element_wise=False, ignore_na=True)
        )
    if maximum is not None:
        checks.append(
            pa.Check(lambda s, m=maximum: s <= m, element_wise=False, ignore_na=True)
        )
    return pa.Column(pa.Int64, checks=checks, nullable=nullable, coerce=True)


def _col_float(
    minimum: float | None = None,
    maximum: float | None = None,
    *,
    nullable: bool = False,
) -> pa.Column:
    checks: List[pa.Check] = []
    if minimum is not None:
        checks.append(
            pa.Check(lambda s, m=minimum: s >= m, element_wise=False, ignore_na=True)
        )
    if maximum is not None:
        checks.append(
            pa.Check(lambda s, m=maximum: s <= m, element_wise=False, ignore_na=True)
        )
    return pa.Column(pa.Float64, checks=checks, nullable=nullable, coerce=True)


def _col_str(
    allowed: List[str] | None = None,
    *,
    nullable: bool = False,
) -> pa.Column:
    checks: List[pa.Check] = []
    if allowed:
        checks.append(
            pa.Check(
                lambda s, opts=allowed: s.isin(opts),
                element_wise=False,
                ignore_na=True,
            )
        )
    return pa.Column(str, checks=checks, nullable=nullable)


def _check_required_when_present(
    df: pd.DataFrame,
    trigger_col: str,
    required_col: str,
) -> List[str]:
    errors: List[str] = []
    if trigger_col not in df.columns or required_col not in df.columns:
        return errors
    mask = df[trigger_col].notna() & df[required_col].isna()
    if mask.any():
        errors.append(
            f"Column '{required_col}' has {int(mask.sum())} NULL value(s) while '{trigger_col}' is present"
        )
    return errors


def _check_improvement_pct_formula(
    df: pd.DataFrame,
    perf_2024_col: str,
    perf_2025_col: str,
    pct_col: str,
    *,
    tolerance: float = 0.01,
) -> List[str]:
    errors: List[str] = []
    required_columns = {perf_2024_col, perf_2025_col, pct_col}
    if not required_columns.issubset(df.columns):
        return errors

    p24 = pd.to_numeric(df[perf_2024_col], errors="coerce")
    p25 = pd.to_numeric(df[perf_2025_col], errors="coerce")
    pct = pd.to_numeric(df[pct_col], errors="coerce")

    comparable = p24.notna() & p25.notna() & (p24 != 0)
    expected = (((p25 - p24) / p24) * 100).round(2)

    missing_pct = comparable & pct.isna()
    if missing_pct.any():
        errors.append(
            f"Column '{pct_col}' has {int(missing_pct.sum())} NULL value(s) for comparable 2024/2025 rows"
        )

    mismatch = comparable & pct.notna() & ((pct - expected).abs() > tolerance)
    if mismatch.any():
        failures = df.loc[mismatch, [perf_2024_col, perf_2025_col, pct_col]].head(5).to_dict("records")
        errors.append(f"Column '{pct_col}' mismatches derived percentage delta for {int(mismatch.sum())} row(s): {failures}")

    should_be_null = (~comparable) & pct.notna()
    if should_be_null.any():
        errors.append(
            f"Column '{pct_col}' has {int(should_be_null.sum())} value(s) where percentage delta should be NULL"
        )

    return errors


def _check_competition_year_performance(
    df: pd.DataFrame,
    year_col: str,
    perf_2024_col: str,
    perf_2025_col: str,
) -> List[str]:
    errors: List[str] = []
    required_columns = {year_col, perf_2024_col, perf_2025_col}
    if not required_columns.issubset(df.columns):
        return errors

    years = pd.to_numeric(df[year_col], errors="coerce")
    p24 = pd.to_numeric(df[perf_2024_col], errors="coerce")
    p25 = pd.to_numeric(df[perf_2025_col], errors="coerce")

    invalid_2024 = (years == 2024) & p24.isna()
    invalid_2025 = (years == 2025) & p25.isna()
    invalid = invalid_2024 | invalid_2025
    if invalid.any():
        failures = df.loc[invalid, [year_col, perf_2024_col, perf_2025_col]].head(5).to_dict("records")
        errors.append(
            f"Competition player rows must have performance aligned to competition year; found {int(invalid.sum())} invalid row(s): {failures}"
        )
    return errors


def _team_present_when_performance_exists(
    perf_col: str,
    team_col: str,
) -> pa.Check:
    return pa.Check(
        lambda df, p=perf_col, t=team_col: (~df[p].notna() | df[t].notna()).all(),
        error=f"{team_col} must be present whenever {perf_col} exists",
    )


def _improvement_pct_matches(
    perf_2024_col: str,
    perf_2025_col: str,
    pct_col: str,
    *,
    tolerance: float = 0.01,
) -> pa.Check:
    def _validator(df: pd.DataFrame, p24_col: str = perf_2024_col, p25_col: str = perf_2025_col, pct_name: str = pct_col) -> bool:
        p24 = pd.to_numeric(df[p24_col], errors="coerce")
        p25 = pd.to_numeric(df[p25_col], errors="coerce")
        pct = pd.to_numeric(df[pct_name], errors="coerce")
        comparable = p24.notna() & p25.notna() & (p24 != 0)
        expected = (((p25 - p24) / p24) * 100).round(2)
        valid_comparable = ~comparable | (pct.notna() & ((pct - expected).abs() <= tolerance))
        valid_non_comparable = comparable | pct.isna()
        return bool((valid_comparable & valid_non_comparable).all())

    return pa.Check(
        _validator,
        error=f"{pct_col} must match derived percentage delta and be NULL when comparison is not possible",
    )


def _competition_year_has_matching_performance(
    year_col: str,
    perf_2024_col: str,
    perf_2025_col: str,
) -> pa.Check:
    def _validator(
        df: pd.DataFrame,
        year_name: str = year_col,
        p24_col: str = perf_2024_col,
        p25_col: str = perf_2025_col,
    ) -> bool:
        years = pd.to_numeric(df[year_name], errors="coerce")
        p24 = pd.to_numeric(df[p24_col], errors="coerce")
        p25 = pd.to_numeric(df[p25_col], errors="coerce")
        valid_2024 = (years != 2024) | p24.notna()
        valid_2025 = (years != 2025) | p25.notna()
        return bool((valid_2024 & valid_2025).all())

    return pa.Check(
        _validator,
        error="competition_year rows must include performance for their own year",
    )


def _share_sum_matches(
    starter_col: str,
    substitute_col: str,
    *,
    tolerance: float = 0.01,
) -> pa.Check:
    def _validator(
        df: pd.DataFrame,
        starter_name: str = starter_col,
        substitute_name: str = substitute_col,
    ) -> bool:
        starter = pd.to_numeric(df[starter_name], errors="coerce").fillna(0)
        substitute = pd.to_numeric(df[substitute_name], errors="coerce").fillna(0)
        return bool(((starter + substitute - 100).abs() <= tolerance).all())

    return pa.Check(
        _validator,
        error=f"{starter_col} + {substitute_col} must sum to 100",
    )


def _performance_gap_matches(
    starter_col: str,
    substitute_col: str,
    gap_col: str,
    *,
    tolerance: float = 0.01,
) -> pa.Check:
    def _validator(
        df: pd.DataFrame,
        starter_name: str = starter_col,
        substitute_name: str = substitute_col,
        gap_name: str = gap_col,
    ) -> bool:
        starter = pd.to_numeric(df[starter_name], errors="coerce")
        substitute = pd.to_numeric(df[substitute_name], errors="coerce")
        gap = pd.to_numeric(df[gap_name], errors="coerce")
        comparable = starter.notna() & substitute.notna()
        expected = (substitute - starter).round(2)
        valid_comparable = ~comparable | (gap.notna() & ((gap - expected).abs() <= tolerance))
        valid_non_comparable = comparable | gap.isna()
        return bool((valid_comparable & valid_non_comparable).all())

    return pa.Check(
        _validator,
        error=f"{gap_col} must equal {substitute_col} - {starter_col} or be NULL when one average is missing",
    )


def _results_score_matches(
    position_col: str,
    results_col: str,
    *,
    tolerance: float = 0.01,
) -> pa.Check:
    def _validator(
        df: pd.DataFrame,
        position_name: str = position_col,
        results_name: str = results_col,
    ) -> bool:
        position = pd.to_numeric(df[position_name], errors="coerce")
        results = pd.to_numeric(df[results_name], errors="coerce")
        comparable = position.notna() & (position > 0)
        expected = (100.0 / position).round(2)
        valid_comparable = ~comparable | (results.notna() & ((results - expected).abs() <= tolerance))
        valid_non_comparable = comparable | results.isna()
        return bool((valid_comparable & valid_non_comparable).all())

    return pa.Check(
        _validator,
        error=f"{results_col} must equal ROUND(100 / {position_col}, 2) or be NULL when {position_col} is missing",
    )


def _comparison_score_matches(
    victory_col: str,
    teamwork_col: str,
    results_col: str,
    prize_share_col: str,
    score_col: str,
    *,
    tolerance: float = 0.011,
) -> pa.Check:
    def _validator(
        df: pd.DataFrame,
        victory_name: str = victory_col,
        teamwork_name: str = teamwork_col,
        results_name: str = results_col,
        prize_name: str = prize_share_col,
        score_name: str = score_col,
    ) -> bool:
        victory = pd.to_numeric(df[victory_name], errors="coerce").fillna(0)
        teamwork = pd.to_numeric(df[teamwork_name], errors="coerce").fillna(0)
        results = pd.to_numeric(df[results_name], errors="coerce").fillna(0)
        prize_share = pd.to_numeric(df[prize_name], errors="coerce").fillna(0)
        score = pd.to_numeric(df[score_name], errors="coerce")
        expected = (
            victory * 0.35 +
            teamwork * 0.25 +
            results * 0.20 +
            prize_share * 0.20
        ).round(2)
        return bool((score.notna() & ((score - expected).abs() <= tolerance)).all())

    return pa.Check(
        _validator,
        error=f"{score_col} must match the weighted comparison formula",
    )


def _build_squad_usage_summary_schema(context_columns: List[str]) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if "competition_name" in context_columns:
        fields["competition_name"] = _col_str()
    if "country" in context_columns:
        fields["country"] = _col_str()
    fields.update(
        {
            "starter_participations": _col_int(0),
            "substitute_participations": _col_int(0),
            "starter_share_pct": _col_float(0, 100),
            "substitute_share_pct": _col_float(0, 100),
            "starter_unique_players": _col_int(0),
            "substitute_unique_players": _col_int(0),
            "starter_avg_performance": _col_float(0, 100, nullable=True),
            "substitute_avg_performance": _col_float(0, 100, nullable=True),
            "performance_gap_pct": _col_float(-100, 100, nullable=True),
            "teams_with_substitutes": _col_int(0),
            "teams_without_substitutes": _col_int(0),
        }
    )
    return pa.DataFrameSchema(
        fields,
        checks=[
            _share_sum_matches("starter_share_pct", "substitute_share_pct"),
            _performance_gap_matches(
                "starter_avg_performance",
                "substitute_avg_performance",
                "performance_gap_pct",
            ),
        ],
        strict=False,
    )


def _build_squad_usage_team_breakdown_schema(include_competition: bool) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if include_competition:
        fields["competition_name"] = _col_str()
    fields.update(
        {
            "team": _col_str(),
            "country": _col_str(),
            "starter_participations": _col_int(0),
            "substitute_participations": _col_int(0),
            "starter_unique_players": _col_int(0),
            "substitute_unique_players": _col_int(0),
            "starter_avg_performance": _col_float(0, 100, nullable=True),
            "substitute_avg_performance": _col_float(0, 100, nullable=True),
            "substitute_share_pct": _col_float(0, 100),
            "performance_gap_pct": _col_float(-100, 100, nullable=True),
        }
    )
    return pa.DataFrameSchema(
        fields,
        checks=[
            _performance_gap_matches(
                "starter_avg_performance",
                "substitute_avg_performance",
                "performance_gap_pct",
            ),
        ],
        strict=False,
    )


def _build_team_comparison_profiles_schema(include_competition: bool) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if include_competition:
        fields["competition_name"] = _col_str()
    fields.update(
        {
            "team": _col_str(),
            "country": _col_str(),
            "competitions_count": _col_int(1),
            "teamwork_score": _col_float(0, 100, nullable=True),
            "victory_rate_pct": _col_float(0, 100, nullable=True),
            "position_metric": _col_float(1, 100, nullable=True),
            "results_score": _col_float(0, 100, nullable=True),
            "prize_amount": _col_float(0),
            "prize_share_pct": _col_float(0, 100),
            "titles_count": _col_int(0),
            "podium_count": _col_int(0),
            "comparison_score": _col_float(0, 100),
        }
    )
    if include_competition:
        fields["competition_result"] = _col_float(1, 100, nullable=True)
    return pa.DataFrameSchema(
        fields,
        checks=[
            _results_score_matches("position_metric", "results_score"),
            _comparison_score_matches(
                "victory_rate_pct",
                "teamwork_score",
                "results_score",
                "prize_share_pct",
                "comparison_score",
            ),
        ],
        strict=False,
    )


def _build_team_comparison_leaders_schema(context_columns: List[str]) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if "competition_name" in context_columns:
        fields["competition_name"] = _col_str()
    if "country" in context_columns:
        fields["country"] = _col_str()
    fields.update(
        {
            "best_teamwork_team": _col_str(),
            "best_teamwork_score": _col_float(0, 100, nullable=True),
            "best_victory_team": _col_str(),
            "best_victory_rate_pct": _col_float(0, 100, nullable=True),
            "best_results_team": _col_str(),
            "best_results_score": _col_float(0, 100, nullable=True),
            "best_prize_team": _col_str(),
            "best_prize_share_pct": _col_float(0, 100, nullable=True),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_team_experience_summary_schema(context_columns: List[str]) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if "competition_name" in context_columns:
        fields["competition_name"] = _col_str()
    if "country" in context_columns:
        fields["country"] = _col_str()
    fields.update(
        {
            "teams_count": _col_int(0),
            "veteran_starters_count": _col_int(0),
            "veteran_substitutes_count": _col_int(0),
            "veteran_mixed_count": _col_int(0),
            "avg_team_age": _col_float(15, 50, nullable=True),
            "avg_veteran_age": _col_float(15, 50, nullable=True),
            "avg_age_span": _col_float(0, 50, nullable=True),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_team_experience_profiles_schema(include_competition: bool) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if include_competition:
        fields["competition_name"] = _col_str()
    fields.update(
        {
            "team": _col_str(),
            "country": _col_str(),
            "veteran_player": _col_str(),
            "veteran_age": _col_float(15, 50, nullable=True),
            "veteran_role": _col_str(["Titular", "Suplente", "Mixto", "Sin rol registrado"]),
            "veteran_performance_pct": _col_float(0, 100, nullable=True),
            "team_avg_age": _col_float(15, 50, nullable=True),
            "youngest_age": _col_float(15, 50, nullable=True),
            "oldest_age": _col_float(15, 50, nullable=True),
            "age_span": _col_float(0, 50, nullable=True),
            "team_avg_performance_pct": _col_float(0, 100, nullable=True),
            "veteran_vs_team_gap_pct": _col_float(-100, 100, nullable=True),
            "competitions_count": _col_int(1),
        }
    )
    if include_competition:
        fields["competition_result"] = _col_float(1, 100, nullable=True)
    return pa.DataFrameSchema(fields, strict=False)


def _build_team_experience_leaders_schema(context_columns: List[str]) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if "competition_name" in context_columns:
        fields["competition_name"] = _col_str()
    if "country" in context_columns:
        fields["country"] = _col_str()
    fields.update(
        {
            "most_experienced_team": _col_str(),
            "most_experienced_team_avg_age": _col_float(15, 50, nullable=True),
            "best_veteran_player": _col_str(),
            "best_veteran_team": _col_str(),
            "best_veteran_performance_pct": _col_float(0, 100, nullable=True),
            "widest_age_gap_team": _col_str(),
            "widest_age_gap_years": _col_float(0, 50, nullable=True),
            "highest_veteran_advantage_team": _col_str(),
            "highest_veteran_advantage_pct": _col_float(-100, 100, nullable=True),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_player_age_performance_points_schema(include_competition: bool, include_country_context: bool) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if include_competition:
        fields["competition_name"] = _col_str()
    if include_country_context:
        fields["country"] = _col_str()
    fields.update(
        {
            "player_name": _col_str(),
            "team": _col_str(),
            "team_country": _col_str(),
            "player_nationality": _col_str(nullable=True),
            "age": _col_float(15, 50, nullable=True),
            "performance_pct": _col_float(0, 100, nullable=True),
            "age_band": _col_str(["20-21", "22-23", "24+"], nullable=True),
            "competitions_count": _col_int(0),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_player_age_performance_bands_schema(context_columns: List[str]) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if "competition_name" in context_columns:
        fields["competition_name"] = _col_str()
    if "country" in context_columns:
        fields["country"] = _col_str()
    fields.update(
        {
            "age_band": _col_str(["20-21", "22-23", "24+"]),
            "players_count": _col_int(0),
            "average_performance_pct": _col_float(0, 100, nullable=True),
            "top_player_name": _col_str(),
            "top_player_team": _col_str(),
            "top_player_performance_pct": _col_float(0, 100, nullable=True),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_player_age_performance_summary_schema(context_columns: List[str]) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if "competition_name" in context_columns:
        fields["competition_name"] = _col_str()
    if "country" in context_columns:
        fields["country"] = _col_str()
    fields.update(
        {
            "players_count": _col_int(0),
            "overall_average_performance_pct": _col_float(0, 100, nullable=True),
            "correlation_value": _col_float(-1, 1, nullable=True),
            "correlation_strength": _col_str(["none", "weak", "moderate", "strong", "insufficient"]),
            "correlation_direction": _col_str(["positive", "negative", "neutral"], nullable=True),
            "best_age_band": _col_str(["20-21", "22-23", "24+"], nullable=True),
            "best_age_band_average_performance_pct": _col_float(0, 100, nullable=True),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_player_age_performance_leaders_schema(context_columns: List[str]) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if "competition_name" in context_columns:
        fields["competition_name"] = _col_str()
    if "country" in context_columns:
        fields["country"] = _col_str()
    fields.update(
        {
            "young_standout_player": _col_str(nullable=True),
            "young_standout_team": _col_str(nullable=True),
            "young_standout_performance_pct": _col_float(0, 100, nullable=True),
            "veteran_standout_player": _col_str(nullable=True),
            "veteran_standout_team": _col_str(nullable=True),
            "veteran_standout_performance_pct": _col_float(0, 100, nullable=True),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_ml_projection_summary_schema(include_country_context: bool) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if include_country_context:
        fields["country"] = _col_str()
    fields.update(
        {
            "players_count": _col_int(0),
            "improved_players_count": _col_int(0),
            "declined_players_count": _col_int(0),
            "stable_players_count": _col_int(0),
            "best_projected_player": _col_str(nullable=True),
            "best_projected_winrate": _col_float(0, 100, nullable=True),
            "biggest_improvement_player": _col_str(nullable=True),
            "biggest_improvement_delta": _col_float(-100, 100, nullable=True),
            "biggest_decline_player": _col_str(nullable=True),
            "biggest_decline_delta": _col_float(-100, 100, nullable=True),
            "best_projected_team": _col_str(nullable=True),
            "best_projected_team_avg_winrate": _col_float(0, 100, nullable=True),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_ml_projection_players_schema(include_country_context: bool) -> pa.DataFrameSchema:
    fields: Dict[str, pa.Column] = {}
    if include_country_context:
        fields["country"] = _col_str()
    fields.update(
        {
            "player_name": _col_str(),
            "team": _col_str(),
            "team_country": _col_str(),
            "player_nationality": _col_str(),
            "age_2026": _col_int(15, 50),
            "actual_winrate": _col_float(0, 100),
            "predicted_winrate": _col_float(0, 100),
            "delta": _col_float(-100, 100),
            "trend": _col_str(["Improved", "Declined", "Stable"]),
            "confidence_score": _col_float(0, 100),
            "confidence_band": _col_str(["Alta", "Media", "Baja"]),
            "risk_band": _col_str(["Salto esperado", "Riesgo de caída", "Estable", "A observar"]),
            "projected_rank": _col_int(1),
        }
    )
    return pa.DataFrameSchema(fields, strict=False)


def _build_ml_projection_team_summary_schema() -> pa.DataFrameSchema:
    return pa.DataFrameSchema(
        {
            "team": _col_str(),
            "country": _col_str(),
            "players_count": _col_int(0),
            "actual_avg_winrate": _col_float(0, 100),
            "projected_avg_winrate": _col_float(0, 100),
            "avg_delta": _col_float(-100, 100),
            "improved_players_count": _col_int(0),
            "declined_players_count": _col_int(0),
            "top_projected_player": _col_str(nullable=True),
            "top_projected_winrate": _col_float(0, 100, nullable=True),
        },
        strict=False,
    )


def _build_ml_projection_country_summary_schema() -> pa.DataFrameSchema:
    return pa.DataFrameSchema(
        {
            "country": _col_str(),
            "players_count": _col_int(0),
            "actual_avg_winrate": _col_float(0, 100),
            "projected_avg_winrate": _col_float(0, 100),
            "avg_delta": _col_float(-100, 100),
            "improved_players_count": _col_int(0),
            "declined_players_count": _col_int(0),
            "top_projected_player": _col_str(nullable=True),
            "top_projected_winrate": _col_float(0, 100, nullable=True),
        },
        strict=False,
    )


def _build_ml_projection_feature_importance_schema() -> pa.DataFrameSchema:
    return pa.DataFrameSchema(
        {
            "feature_key": _col_str(),
            "feature_label": _col_str(),
            "importance_pct": _col_float(0, 100),
            "rank": _col_int(1),
        },
        strict=False,
    )


PANDERA_SCHEMAS: Dict[str, pa.DataFrameSchema] = {
    "kpis": pa.DataFrameSchema(
        {
            "total_teams": _col_int(0),
            "total_players": _col_int(0),
            "total_prizes": _col_float(0),
            "countries_represented": _col_int(0),
            "active_competitions": _col_int(0),
            "average_age": _col_float(15, 50),
            "international_competitions": _col_int(0),
            "national_competitions": _col_int(0),
        },
        strict=False,
    ),
    "country_ranking": pa.DataFrameSchema(
        {
            "country": _col_str(),
            "total_teams": _col_int(0),
            "total_players": _col_int(0),
            "total_prizes": _col_float(0),
            "active_competitions": _col_int(0),
            "average_age": _col_float(15, 50),
            "international_competitions": _col_int(0),
            "national_competitions": _col_int(0),
        },
        strict=False,
    ),
    "competitions": pa.DataFrameSchema(
        {
            "name": _col_str(),
            "type": _col_str(["Nacional", "Internacional"]),
            "location": _col_str(),
            "participating_teams": _col_int(1),
            "total_players": _col_int(0),
            "total_prize": _col_float(0),
            "average_prize_per_team": _col_float(0),
            "year": _col_int(0),
            "average_age": _col_float(15, 50),
        },
        strict=False,
    ),
    "teams_catalog": pa.DataFrameSchema(
        {
            "name": _col_str(),
            "country": _col_str(),
            "participating_competitions": _col_int(0),
            "total_players": _col_int(0),
            "best_position": _col_float(1, nullable=True),
            "total_prizes": _col_float(0),
        },
        strict=False,
    ),
    "top_jugadores": pa.DataFrameSchema(
        {
            "name": _col_str(),
            "nationality": _col_str(),
            "performance_2024": _col_float(0, 100, nullable=True),
            "performance_2025": _col_float(0, 100, nullable=True),
            "trend": _col_str(["No data 2025", "Improved", "Declined", "No change"]),
        },
        strict=False,
    ),
    "evolucion": pa.DataFrameSchema(
        {
            "name": _col_str(),
            "nationality": _col_str(),
            "team_2024": _col_str(nullable=True),
            "team_2025": _col_str(nullable=True),
            "performance_2024": _col_float(0, 100, nullable=True),
            "performance_2025": _col_float(0, 100, nullable=True),
            "trend": _col_str(["Improved", "Declined", "No change"]),
            "improvement": pa.Column(
                pa.Float64,
                checks=[
                    pa.Check(
                        lambda s: s >= -100, element_wise=False, ignore_na=True
                    ),
                    pa.Check(
                        lambda s: s <= 100, element_wise=False, ignore_na=True
                    ),
                ],
                nullable=True,
                required=False,
                coerce=True,
            ),
            "improvement_pct": pa.Column(
                pa.Float64,
                nullable=True,
                coerce=True,
            ),
            "decline": pa.Column(
                pa.Float64,
                checks=[
                    pa.Check(
                        lambda s: s >= -100, element_wise=False, ignore_na=True
                    ),
                    pa.Check(
                        lambda s: s <= 100, element_wise=False, ignore_na=True
                    ),
                ],
                nullable=True,
                required=False,
                coerce=True,
            ),
        },
        checks=[
            _team_present_when_performance_exists("performance_2024", "team_2024"),
            _team_present_when_performance_exists("performance_2025", "team_2025"),
            _improvement_pct_matches("performance_2024", "performance_2025", "improvement_pct"),
        ],
        strict=False,
    ),
    "kpis_by_country": pa.DataFrameSchema(
        {
            "country": _col_str(),
            "total_teams": _col_int(0),
            "total_players": _col_int(0),
            "total_prizes": _col_float(0),
            "active_competitions": _col_int(0),
            "average_age": _col_float(15, 50, nullable=True),
            "international_competitions": _col_int(0),
            "national_competitions": _col_int(0),
            "countries_represented": pa.Column(
                pa.Int64,
                checks=[
                    pa.Check(
                        lambda s: s == 1, element_wise=False, ignore_na=True
                    )
                ],
                nullable=False,
                coerce=True,
            ),
        },
        strict=False,
    ),
    "kpis_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "type": _col_str(["Nacional", "Internacional"]),
            "year": _col_int(0),
            "total_teams": _col_int(0),
            "total_players": _col_int(0),
            "total_prizes": _col_float(0),
            "average_age": _col_float(15, 50, nullable=True),
            "countries_represented": _col_int(0),
            "international_competitions": _col_int(0),
            "national_competitions": _col_int(0),
        },
        strict=False,
    ),
    "kpis_by_country_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "country": _col_str(),
            "type": _col_str(["Nacional", "Internacional"]),
            "year": _col_int(0),
            "total_teams": _col_int(0),
            "total_players": _col_int(0),
            "total_prizes": _col_float(0),
            "average_age": _col_float(15, 50, nullable=True),
        },
        strict=False,
    ),
    "country_ranking_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "country": _col_str(),
            "total_teams": _col_int(0),
            "total_players": _col_int(0),
            "total_prizes": _col_float(0),
            "average_prize_per_team": _col_float(0),
            "average_age": _col_float(15, 50, nullable=True),
        },
        strict=False,
    ),
    "top_teams_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "team": _col_str(),
            "country": _col_str(),
            "final_position": _col_float(0),
            "prize_obtained": _col_float(0),
            "total_players": _col_int(0),
        },
        strict=False,
    ),
    "top_players_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "name": _col_str(),
            "nationality": _col_str(),
            "performance_2024": _col_float(0, 100, nullable=True),
            "performance_2025": _col_float(0, 100, nullable=True),
            "trend": _col_str(["No data 2025", "Improved", "Declined", "No change"]),
        },
        strict=False,
    ),
    "player_evolution_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "competition_year": _col_int(0),
            "name": _col_str(),
            "nationality": _col_str(),
            "team": _col_str(),
            "performance_2024": _col_float(0, 100, nullable=True),
            "performance_2025": _col_float(0, 100, nullable=True),
            "trend": _col_str(["Improved", "Declined", "No change"]),
            "improvement": pa.Column(
                pa.Float64,
                checks=[
                    pa.Check(
                        lambda s: s >= -100, element_wise=False, ignore_na=True
                    ),
                    pa.Check(
                        lambda s: s <= 100, element_wise=False, ignore_na=True
                    ),
                ],
                nullable=True,
                required=False,
                coerce=True,
            ),
            "improvement_pct": pa.Column(
                pa.Float64,
                nullable=True,
                coerce=True,
            ),
            "decline": pa.Column(
                pa.Float64,
                checks=[
                    pa.Check(
                        lambda s: s >= -100, element_wise=False, ignore_na=True
                    ),
                    pa.Check(
                        lambda s: s <= 100, element_wise=False, ignore_na=True
                    ),
                ],
                nullable=True,
                required=False,
                coerce=True,
            ),
        },
        checks=[
            _improvement_pct_matches("performance_2024", "performance_2025", "improvement_pct"),
            _competition_year_has_matching_performance(
                "competition_year",
                "performance_2024",
                "performance_2025",
            ),
        ],
        strict=False,
    ),
    "role_analysis_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "role": _col_str(["Titular", "Suplente"]),
            "total_participations": _col_int(0),
            "unique_players": _col_int(0),
            "average_performance": _col_float(0, 100),
        },
        strict=False,
    ),
    "squad_usage_summary": _build_squad_usage_summary_schema([]),
    "squad_usage_team_breakdown": _build_squad_usage_team_breakdown_schema(False),
    "squad_usage_by_country": _build_squad_usage_summary_schema(["country"]),
    "squad_usage_by_competition": _build_squad_usage_summary_schema(["competition_name"]),
    "squad_usage_by_country_competition": _build_squad_usage_summary_schema(["competition_name", "country"]),
    "squad_usage_team_breakdown_by_country": _build_squad_usage_team_breakdown_schema(False),
    "squad_usage_team_breakdown_by_competition": _build_squad_usage_team_breakdown_schema(True),
    "squad_usage_team_breakdown_by_country_competition": _build_squad_usage_team_breakdown_schema(True),
    "team_experience_summary": _build_team_experience_summary_schema([]),
    "team_experience_summary_by_country": _build_team_experience_summary_schema(["country"]),
    "team_experience_summary_by_competition": _build_team_experience_summary_schema(["competition_name"]),
    "team_experience_summary_by_country_competition": _build_team_experience_summary_schema(["competition_name", "country"]),
    "team_experience_profiles": _build_team_experience_profiles_schema(False),
    "team_experience_profiles_by_country": _build_team_experience_profiles_schema(False),
    "team_experience_profiles_by_competition": _build_team_experience_profiles_schema(True),
    "team_experience_profiles_by_country_competition": _build_team_experience_profiles_schema(True),
    "team_experience_leaders": _build_team_experience_leaders_schema([]),
    "team_experience_leaders_by_country": _build_team_experience_leaders_schema(["country"]),
    "team_experience_leaders_by_competition": _build_team_experience_leaders_schema(["competition_name"]),
    "team_experience_leaders_by_country_competition": _build_team_experience_leaders_schema(["competition_name", "country"]),
    "player_age_performance_points": _build_player_age_performance_points_schema(False, False),
    "player_age_performance_points_by_country": _build_player_age_performance_points_schema(False, True),
    "player_age_performance_points_by_competition": _build_player_age_performance_points_schema(True, False),
    "player_age_performance_points_by_country_competition": _build_player_age_performance_points_schema(True, True),
    "player_age_performance_bands": _build_player_age_performance_bands_schema([]),
    "player_age_performance_bands_by_country": _build_player_age_performance_bands_schema(["country"]),
    "player_age_performance_bands_by_competition": _build_player_age_performance_bands_schema(["competition_name"]),
    "player_age_performance_bands_by_country_competition": _build_player_age_performance_bands_schema(["competition_name", "country"]),
    "player_age_performance_summary": _build_player_age_performance_summary_schema([]),
    "player_age_performance_summary_by_country": _build_player_age_performance_summary_schema(["country"]),
    "player_age_performance_summary_by_competition": _build_player_age_performance_summary_schema(["competition_name"]),
    "player_age_performance_summary_by_country_competition": _build_player_age_performance_summary_schema(["competition_name", "country"]),
    "player_age_performance_leaders": _build_player_age_performance_leaders_schema([]),
    "player_age_performance_leaders_by_country": _build_player_age_performance_leaders_schema(["country"]),
    "player_age_performance_leaders_by_competition": _build_player_age_performance_leaders_schema(["competition_name"]),
    "player_age_performance_leaders_by_country_competition": _build_player_age_performance_leaders_schema(["competition_name", "country"]),
    "ml_projection_2026_summary": _build_ml_projection_summary_schema(False),
    "ml_projection_2026_players": _build_ml_projection_players_schema(False),
    "ml_projection_2026_team_summary": _build_ml_projection_team_summary_schema(),
    "ml_projection_2026_country_summary": _build_ml_projection_country_summary_schema(),
    "ml_projection_2026_feature_importance": _build_ml_projection_feature_importance_schema(),
    "ml_projection_2026_summary_by_country": _build_ml_projection_summary_schema(True),
    "ml_projection_2026_players_by_country": _build_ml_projection_players_schema(True),
    "ml_projection_2026_team_summary_by_country": _build_ml_projection_team_summary_schema(),
    "ml_projection_2026_country_summary_by_country": _build_ml_projection_country_summary_schema(),
    "team_comparison_profiles": _build_team_comparison_profiles_schema(False),
    "team_comparison_profiles_by_country": _build_team_comparison_profiles_schema(False),
    "team_comparison_profiles_by_competition": _build_team_comparison_profiles_schema(True),
    "team_comparison_profiles_by_country_competition": _build_team_comparison_profiles_schema(True),
    "team_comparison_leaders": _build_team_comparison_leaders_schema([]),
    "team_comparison_leaders_by_country": _build_team_comparison_leaders_schema(["country"]),
    "team_comparison_leaders_by_competition": _build_team_comparison_leaders_schema(["competition_name"]),
    "team_comparison_leaders_by_country_competition": _build_team_comparison_leaders_schema(["competition_name", "country"]),
    "radar_teamwork_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "team": _col_str(),
            "country": _col_str(),
            "avg_teamwork": _col_float(0, 100),
            "avg_winrate": _col_float(0, 100),
            "total_players": _col_int(0),
            "total_prizes": _col_float(0),
        },
        strict=False,
    ),
    "scatter_age_performance_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "name": _col_str(),
            "nationality": _col_str(),
            "team": _col_str(),
            "age": _col_int(15, 50, nullable=True),
            "performance": _col_float(0, 100, nullable=True),
        },
        strict=False,
    ),
    "veteran_players_by_competition": pa.DataFrameSchema(
        {
            "competition_name": _col_str(),
            "team": _col_str(),
            "country": _col_str(),
            "veteran_player": _col_str(),
            "age": _col_int(15, 50, nullable=True),
            "performance_2024": _col_float(0, 100, nullable=True),
        },
        strict=False,
    ),
    "players_index": pa.DataFrameSchema(
        {
            "name": _col_str(),
            "nationality": _col_str(),
            "team": _col_str(),
            "search_key": pa.Column(str, nullable=True, required=False),
        },
        strict=False,
    ),
}


def _format_pandera_issues(dataset: str, exc: Exception) -> List[str]:
    """Format Pandera errors into readable strings."""
    issues: List[str] = []
    if isinstance(exc, pa.errors.SchemaErrors):
        failure_cases = exc.failure_cases
        for _, row in failure_cases.iterrows():
            column = row.get("column") or "<dataframe>"
            check = row.get("check") or "check"
            failure = row.get("failure_case")
            issues.append(
                f"[pandera] {dataset}.{column} failed {check}: {failure}"
            )
        return issues
    issues.append(f"[pandera] {dataset}: {exc}")
    return issues


def validate_with_pandera(dataset: str, df: pd.DataFrame) -> List[str]:
    """Validate a dataset with Pandera schema if configured."""
    schema = PANDERA_SCHEMAS.get(dataset)
    if schema is None:
        return []
    try:
        schema.validate(df, lazy=True)
        return []
    except (pa.errors.SchemaError, pa.errors.SchemaErrors) as exc:
        return _format_pandera_issues(dataset, exc)


# ---------------------------------------------------------------------------
# Per-dataset validators (English contract)
# ---------------------------------------------------------------------------


def _validate_kpis(df: pd.DataFrame) -> List[str]:
    """KPIs: counts >= 0, age in [15, 50]."""
    errs: List[str] = []
    for col in [
        "total_teams",
        "total_players",
        "total_prizes",
        "countries_represented",
        "active_competitions",
        "international_competitions",
        "national_competitions",
    ]:
        errs += _check_ge(df, col, 0)
    errs += _check_range(df, "average_age", 15, 50)
    return errs


def _validate_country_ranking(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["country"])
    errs += _check_ge(df, "total_teams", 0)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prizes", 0)
    errs += _check_ge(df, "active_competitions", 0)
    errs += _check_range(df, "average_age", 15, 50)
    return errs


def _validate_top_players(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["name", "nationality", "trend"])
    errs += _check_range(df, "performance_2024", 0, 100)
    errs += _check_range(df, "performance_2025", 0, 100)
    errs += _check_isin(df, "trend", ["No data 2025", "Improved", "Declined", "No change"])
    return errs


def _validate_player_evolution(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["name", "nationality", "trend"])
    errs += _check_range(df, "performance_2024", 0, 100)
    errs += _check_range(df, "performance_2025", 0, 100)
    errs += _check_isin(df, "trend", ["Improved", "Declined", "No change"])
    errs += _check_range(df, "improvement", -100, 100)
    errs += _check_required_when_present(df, "performance_2024", "team_2024")
    errs += _check_required_when_present(df, "performance_2025", "team_2025")
    errs += _check_improvement_pct_formula(df, "performance_2024", "performance_2025", "improvement_pct")
    errs += _check_range(df, "decline", -100, 100)
    return errs


def _validate_roles(df: pd.DataFrame) -> List[str]:
    errs = _check_isin(df, "role", ["Titular", "Suplente"])
    errs += _check_ge(df, "total_participations", 0)
    errs += _check_ge(df, "unique_players", 0)
    errs += _check_range(df, "average_performance", 0, 100)
    return errs


def _validate_top_teams(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["name", "country"])
    errs += _check_ge(df, "participating_competitions", 1)
    errs += _check_ge(df, "average_position", 1)
    errs += _check_ge(df, "total_prizes", 0)
    return errs


def _validate_teams_catalog(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["name", "country"])
    errs += _check_ge(df, "participating_competitions", 0)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "best_position", 1)
    errs += _check_ge(df, "total_prizes", 0)
    return errs


def _validate_competitions(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["name", "type"])
    errs += _check_isin(df, "type", ["Nacional", "Internacional"])
    errs += _check_ge(df, "participating_teams", 1)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prize", 0)
    errs += _check_ge(df, "average_prize_per_team", 0)
    errs += _check_range(df, "average_age", 15, 50)
    return errs


def _validate_veteran_players(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["team", "country", "veteran_player"])
    errs += _check_range(df, "age", 15, 50)
    errs += _check_range(df, "performance_2024", 0, 100)
    return errs


def _validate_summary_metrics(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, [
        "best_international_team",
        "best_player_2024",
        "most_improved_2025",
        "dominant_country",
        "most_competitive",
    ])
    errs += _check_range(df, "overall_average_performance", 0, 100)
    errs += _check_ge(df, "total_international_prizes", 0)
    errs += _check_ge(df, "total_national_prizes", 0)
    return errs


def _validate_radar_teamwork(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["team", "country"])
    errs += _check_range(df, "avg_teamwork", 0, 100)
    errs += _check_range(df, "avg_winrate", 0, 100)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prizes", 0)
    return errs


def _validate_scatter_age_performance(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["name", "nationality", "team"])
    errs += _check_range(df, "age", 15, 50)
    errs += _check_range(df, "performance", 0, 100)
    return errs


def _validate_competition_cross_filter(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "country"])
    errs += _check_ge(df, "teams_count", 0)
    errs += _check_ge(df, "players_count", 0)
    errs += _check_ge(df, "country_prize", 0)
    errs += _check_ge(df, "average_prize_per_team", 0)
    errs += _check_range(df, "average_age", 15, 50)
    errs += _check_isin(df, "type", ["Nacional", "Internacional"])
    errs += _check_ge(df, "year", 0)
    return errs


def _validate_player_competition_mapping(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "player_name", "team_name"])
    return errs


def _validate_kpis_by_country(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["country"])
    errs += _check_ge(df, "total_teams", 0)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prizes", 0)
    errs += _check_ge(df, "active_competitions", 0)
    errs += _check_range(df, "average_age", 15, 50)
    errs += _check_ge(df, "international_competitions", 0)
    errs += _check_ge(df, "national_competitions", 0)
    errs += _check_isin(df, "countries_represented", [1])
    return errs


def _validate_kpis_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "type", "year"])
    errs += _check_isin(df, "type", ["Nacional", "Internacional"])
    errs += _check_ge(df, "total_teams", 0)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prizes", 0)
    errs += _check_range(df, "average_age", 15, 50)
    errs += _check_ge(df, "countries_represented", 0)
    errs += _check_ge(df, "international_competitions", 0)
    errs += _check_ge(df, "national_competitions", 0)
    return errs


def _validate_kpis_by_country_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "country", "type", "year"])
    errs += _check_isin(df, "type", ["Nacional", "Internacional"])
    errs += _check_ge(df, "total_teams", 0)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prizes", 0)
    errs += _check_range(df, "average_age", 15, 50)
    return errs


def _validate_country_ranking_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "country"])
    errs += _check_ge(df, "total_teams", 0)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prizes", 0)
    errs += _check_ge(df, "average_prize_per_team", 0)
    errs += _check_range(df, "average_age", 15, 50)
    return errs


def _validate_top_teams_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "team", "country"])
    errs += _check_ge(df, "final_position", 0)
    errs += _check_ge(df, "prize_obtained", 0)
    errs += _check_ge(df, "total_players", 0)
    return errs


def _validate_top_players_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "name", "nationality", "trend"])
    errs += _check_range(df, "performance_2024", 0, 100)
    errs += _check_range(df, "performance_2025", 0, 100)
    errs += _check_isin(df, "trend", ["No data 2025", "Improved", "Declined", "No change"])
    return errs


def _validate_player_evolution_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "competition_year", "name", "nationality", "team", "trend"])
    errs += _check_range(df, "performance_2024", 0, 100)
    errs += _check_range(df, "performance_2025", 0, 100)
    errs += _check_isin(df, "trend", ["Improved", "Declined", "No change"])
    errs += _check_range(df, "improvement", -100, 100)
    errs += _check_ge(df, "competition_year", 0)
    errs += _check_improvement_pct_formula(df, "performance_2024", "performance_2025", "improvement_pct")
    errs += _check_competition_year_performance(
        df,
        "competition_year",
        "performance_2024",
        "performance_2025",
    )
    errs += _check_range(df, "decline", -100, 100)
    return errs


def _validate_role_analysis_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "role"])
    errs += _check_isin(df, "role", ["Titular", "Suplente"])
    errs += _check_ge(df, "total_participations", 0)
    errs += _check_ge(df, "unique_players", 0)
    errs += _check_range(df, "average_performance", 0, 100)
    return errs


def _check_share_sum(
    df: pd.DataFrame,
    starter_col: str,
    substitute_col: str,
    *,
    tolerance: float = 0.01,
) -> List[str]:
    errors: List[str] = []
    required = {starter_col, substitute_col}
    if not required.issubset(df.columns):
        return errors

    starter = pd.to_numeric(df[starter_col], errors="coerce")
    substitute = pd.to_numeric(df[substitute_col], errors="coerce")
    invalid = starter.notna() & substitute.notna() & ((starter + substitute - 100).abs() > tolerance)
    if invalid.any():
        failures = df.loc[invalid, [starter_col, substitute_col]].head(5).to_dict("records")
        errors.append(
            f"Columns '{starter_col}' and '{substitute_col}' must sum to 100; found {int(invalid.sum())} invalid row(s): {failures}"
        )
    return errors


def _check_performance_gap(
    df: pd.DataFrame,
    starter_col: str,
    substitute_col: str,
    gap_col: str,
    *,
    tolerance: float = 0.01,
) -> List[str]:
    errors: List[str] = []
    required = {starter_col, substitute_col, gap_col}
    if not required.issubset(df.columns):
        return errors

    starter = pd.to_numeric(df[starter_col], errors="coerce")
    substitute = pd.to_numeric(df[substitute_col], errors="coerce")
    gap = pd.to_numeric(df[gap_col], errors="coerce")
    comparable = starter.notna() & substitute.notna()
    expected = (substitute - starter).round(2)

    missing_gap = comparable & gap.isna()
    if missing_gap.any():
        errors.append(
            f"Column '{gap_col}' has {int(missing_gap.sum())} NULL value(s) where both role averages are present"
        )

    mismatch = comparable & gap.notna() & ((gap - expected).abs() > tolerance)
    if mismatch.any():
        failures = df.loc[mismatch, [starter_col, substitute_col, gap_col]].head(5).to_dict("records")
        errors.append(
            f"Column '{gap_col}' mismatches {substitute_col} - {starter_col} for {int(mismatch.sum())} row(s): {failures}"
        )

    should_be_null = (~comparable) & gap.notna()
    if should_be_null.any():
        errors.append(
            f"Column '{gap_col}' has {int(should_be_null.sum())} value(s) where one role average is missing and gap should be NULL"
        )
    return errors


def _validate_squad_usage_summary(df: pd.DataFrame) -> List[str]:
    required_context = [col for col in ["country", "competition_name"] if col in df.columns]
    errs = _check_not_null(df, required_context)
    errs += _check_ge(df, "starter_participations", 0)
    errs += _check_ge(df, "substitute_participations", 0)
    errs += _check_range(df, "starter_share_pct", 0, 100)
    errs += _check_range(df, "substitute_share_pct", 0, 100)
    errs += _check_share_sum(df, "starter_share_pct", "substitute_share_pct")
    errs += _check_ge(df, "starter_unique_players", 0)
    errs += _check_ge(df, "substitute_unique_players", 0)
    errs += _check_range(df, "starter_avg_performance", 0, 100)
    errs += _check_range(df, "substitute_avg_performance", 0, 100)
    errs += _check_range(df, "performance_gap_pct", -100, 100)
    errs += _check_performance_gap(
        df,
        "starter_avg_performance",
        "substitute_avg_performance",
        "performance_gap_pct",
    )
    errs += _check_ge(df, "teams_with_substitutes", 0)
    errs += _check_ge(df, "teams_without_substitutes", 0)
    return errs


def _validate_squad_usage_team_breakdown(df: pd.DataFrame) -> List[str]:
    required_context = [col for col in ["competition_name", "team", "country"] if col in df.columns]
    errs = _check_not_null(df, required_context)
    errs += _check_ge(df, "starter_participations", 0)
    errs += _check_ge(df, "substitute_participations", 0)
    errs += _check_ge(df, "starter_unique_players", 0)
    errs += _check_ge(df, "substitute_unique_players", 0)
    errs += _check_range(df, "starter_avg_performance", 0, 100)
    errs += _check_range(df, "substitute_avg_performance", 0, 100)
    errs += _check_range(df, "substitute_share_pct", 0, 100)
    errs += _check_range(df, "performance_gap_pct", -100, 100)
    errs += _check_performance_gap(
        df,
        "starter_avg_performance",
        "substitute_avg_performance",
        "performance_gap_pct",
    )
    return errs


def _check_results_score(
    df: pd.DataFrame,
    position_col: str,
    results_col: str,
    *,
    tolerance: float = 0.01,
) -> List[str]:
    errors: List[str] = []
    required = {position_col, results_col}
    if not required.issubset(df.columns):
        return errors

    position = pd.to_numeric(df[position_col], errors="coerce")
    results = pd.to_numeric(df[results_col], errors="coerce")
    comparable = position.notna() & (position > 0)
    expected = (100.0 / position).round(2)

    missing_results = comparable & results.isna()
    if missing_results.any():
        errors.append(
            f"Column '{results_col}' has {int(missing_results.sum())} NULL value(s) where {position_col} is present"
        )

    mismatch = comparable & results.notna() & ((results - expected).abs() > tolerance)
    if mismatch.any():
        failures = df.loc[mismatch, [position_col, results_col]].head(5).to_dict("records")
        errors.append(
            f"Column '{results_col}' must match ROUND(100 / {position_col}, 2) for {int(mismatch.sum())} row(s): {failures}"
        )

    should_be_null = (~comparable) & results.notna()
    if should_be_null.any():
        errors.append(
            f"Column '{results_col}' has {int(should_be_null.sum())} value(s) where {position_col} is missing and results should be NULL"
        )
    return errors


def _check_comparison_score(
    df: pd.DataFrame,
    victory_col: str,
    teamwork_col: str,
    results_col: str,
    prize_share_col: str,
    score_col: str,
    *,
    tolerance: float = 0.011,
) -> List[str]:
    errors: List[str] = []
    required = {victory_col, teamwork_col, results_col, prize_share_col, score_col}
    if not required.issubset(df.columns):
        return errors

    victory = pd.to_numeric(df[victory_col], errors="coerce").fillna(0)
    teamwork = pd.to_numeric(df[teamwork_col], errors="coerce").fillna(0)
    results = pd.to_numeric(df[results_col], errors="coerce").fillna(0)
    prize_share = pd.to_numeric(df[prize_share_col], errors="coerce").fillna(0)
    score = pd.to_numeric(df[score_col], errors="coerce")
    expected = (
        victory * 0.35 +
        teamwork * 0.25 +
        results * 0.20 +
        prize_share * 0.20
    ).round(2)

    missing_score = score.isna()
    if missing_score.any():
        errors.append(f"Column '{score_col}' has {int(missing_score.sum())} NULL value(s)")

    mismatch = score.notna() & ((score - expected).abs() > tolerance)
    if mismatch.any():
        failures = df.loc[
            mismatch,
            [victory_col, teamwork_col, results_col, prize_share_col, score_col],
        ].head(5).to_dict("records")
        errors.append(
            f"Column '{score_col}' must match the weighted comparison formula for {int(mismatch.sum())} row(s): {failures}"
        )
    return errors


def _validate_team_experience_summary(df: pd.DataFrame) -> List[str]:
    required_context = [col for col in ["competition_name", "country"] if col in df.columns]
    errs = _check_not_null(df, required_context)
    errs += _check_ge(df, "teams_count", 0)
    errs += _check_ge(df, "veteran_starters_count", 0)
    errs += _check_ge(df, "veteran_substitutes_count", 0)
    errs += _check_ge(df, "veteran_mixed_count", 0)
    errs += _check_range(df, "avg_team_age", 15, 50)
    errs += _check_range(df, "avg_veteran_age", 15, 50)
    errs += _check_range(df, "avg_age_span", 0, 50)
    required = {"teams_count", "veteran_starters_count", "veteran_substitutes_count", "veteran_mixed_count"}
    if required.issubset(df.columns):
        total = (
            pd.to_numeric(df["veteran_starters_count"], errors="coerce").fillna(0)
            + pd.to_numeric(df["veteran_substitutes_count"], errors="coerce").fillna(0)
            + pd.to_numeric(df["veteran_mixed_count"], errors="coerce").fillna(0)
        )
        teams = pd.to_numeric(df["teams_count"], errors="coerce").fillna(0)
        invalid = total > teams
        if invalid.any():
            errs.append(
                f"Veteran role counts exceed teams_count for {int(invalid.sum())} row(s)"
            )
    return errs


def _validate_team_experience_profiles(df: pd.DataFrame) -> List[str]:
    required_context = [col for col in ["competition_name", "team", "country", "veteran_player", "veteran_role"] if col in df.columns]
    errs = _check_not_null(df, required_context)
    errs += _check_range(df, "veteran_age", 15, 50)
    errs += _check_range(df, "team_avg_age", 15, 50)
    errs += _check_range(df, "youngest_age", 15, 50)
    errs += _check_range(df, "oldest_age", 15, 50)
    errs += _check_range(df, "age_span", 0, 50)
    errs += _check_range(df, "veteran_performance_pct", 0, 100)
    errs += _check_range(df, "team_avg_performance_pct", 0, 100)
    errs += _check_range(df, "veteran_vs_team_gap_pct", -100, 100)
    errs += _check_ge(df, "competitions_count", 1)
    errs += _check_isin(df, "veteran_role", ["Titular", "Suplente", "Mixto", "Sin rol registrado"])
    if "competition_result" in df.columns:
        errs += _check_range(df, "competition_result", 1, 100)

    required_age_columns = {"youngest_age", "oldest_age", "age_span"}
    if required_age_columns.issubset(df.columns):
        youngest = pd.to_numeric(df["youngest_age"], errors="coerce")
        oldest = pd.to_numeric(df["oldest_age"], errors="coerce")
        span = pd.to_numeric(df["age_span"], errors="coerce")
        comparable = youngest.notna() & oldest.notna()
        invalid_order = comparable & (oldest < youngest)
        if invalid_order.any():
            errs.append(f"'oldest_age' is below 'youngest_age' for {int(invalid_order.sum())} row(s)")
        expected_span = (oldest - youngest).round(2)
        span_mismatch = comparable & span.notna() & ((span - expected_span).abs() > 0.01)
        if span_mismatch.any():
            errs.append(f"'age_span' does not match oldest_age - youngest_age for {int(span_mismatch.sum())} row(s)")

    if {"veteran_age", "oldest_age"}.issubset(df.columns):
        veteran_age = pd.to_numeric(df["veteran_age"], errors="coerce")
        oldest_age = pd.to_numeric(df["oldest_age"], errors="coerce")
        mismatch = veteran_age.notna() & oldest_age.notna() & ((veteran_age - oldest_age).abs() > 0.01)
        if mismatch.any():
            errs.append(f"'veteran_age' must match 'oldest_age' for {int(mismatch.sum())} row(s)")

    if {"veteran_performance_pct", "team_avg_performance_pct", "veteran_vs_team_gap_pct"}.issubset(df.columns):
        veteran = pd.to_numeric(df["veteran_performance_pct"], errors="coerce")
        team_avg = pd.to_numeric(df["team_avg_performance_pct"], errors="coerce")
        gap = pd.to_numeric(df["veteran_vs_team_gap_pct"], errors="coerce")
        comparable = veteran.notna() & team_avg.notna()
        expected_gap = (veteran - team_avg).round(2)
        mismatch = comparable & gap.notna() & ((gap - expected_gap).abs() > 0.01)
        if mismatch.any():
            errs.append(
                f"'veteran_vs_team_gap_pct' does not match veteran_performance_pct - team_avg_performance_pct for {int(mismatch.sum())} row(s)"
            )
        should_be_null = (~comparable) & gap.notna()
        if should_be_null.any():
            errs.append(
                f"'veteran_vs_team_gap_pct' should be NULL when one of the compared performance values is missing ({int(should_be_null.sum())} row(s))"
            )
    return errs


def _validate_team_experience_leaders(df: pd.DataFrame) -> List[str]:
    required = [
        col
        for col in [
            "competition_name",
            "country",
            "most_experienced_team",
            "best_veteran_player",
            "best_veteran_team",
            "widest_age_gap_team",
            "highest_veteran_advantage_team",
        ]
        if col in df.columns
    ]
    errs = _check_not_null(df, required)
    errs += _check_range(df, "most_experienced_team_avg_age", 15, 50)
    errs += _check_range(df, "best_veteran_performance_pct", 0, 100)
    errs += _check_range(df, "widest_age_gap_years", 0, 50)
    errs += _check_range(df, "highest_veteran_advantage_pct", -100, 100)
    return errs


def _validate_team_comparison_profiles(df: pd.DataFrame) -> List[str]:
    required_context = [col for col in ["competition_name", "team", "country"] if col in df.columns]
    errs = _check_not_null(df, required_context)
    errs += _check_ge(df, "competitions_count", 1)
    errs += _check_range(df, "teamwork_score", 0, 100)
    errs += _check_range(df, "victory_rate_pct", 0, 100)
    errs += _check_range(df, "position_metric", 1, 100)
    errs += _check_range(df, "results_score", 0, 100)
    errs += _check_results_score(df, "position_metric", "results_score")
    errs += _check_ge(df, "prize_amount", 0)
    errs += _check_range(df, "prize_share_pct", 0, 100)
    errs += _check_ge(df, "titles_count", 0)
    errs += _check_ge(df, "podium_count", 0)
    errs += _check_range(df, "comparison_score", 0, 100)
    errs += _check_comparison_score(
        df,
        "victory_rate_pct",
        "teamwork_score",
        "results_score",
        "prize_share_pct",
        "comparison_score",
    )
    if {"titles_count", "podium_count"}.issubset(df.columns):
        titles = pd.to_numeric(df["titles_count"], errors="coerce")
        podiums = pd.to_numeric(df["podium_count"], errors="coerce")
        invalid = titles.notna() & podiums.notna() & (podiums < titles)
        if invalid.any():
            errs.append(
                f"Column 'podium_count' has {int(invalid.sum())} row(s) below 'titles_count'"
            )
    if "competition_result" in df.columns:
        errs += _check_range(df, "competition_result", 1, 100)
    return errs


def _validate_team_comparison_leaders(df: pd.DataFrame) -> List[str]:
    required = [
        col
        for col in [
            "competition_name",
            "country",
            "best_teamwork_team",
            "best_victory_team",
            "best_results_team",
            "best_prize_team",
        ]
        if col in df.columns
    ]
    errs = _check_not_null(df, required)
    errs += _check_range(df, "best_teamwork_score", 0, 100)
    errs += _check_range(df, "best_victory_rate_pct", 0, 100)
    errs += _check_range(df, "best_results_score", 0, 100)
    errs += _check_range(df, "best_prize_share_pct", 0, 100)
    return errs


def _validate_player_age_performance_points(df: pd.DataFrame) -> List[str]:
    required = [col for col in ["competition_name", "country", "player_name", "team", "team_country"] if col in df.columns]
    errs = _check_not_null(df, required)
    errs += _check_range(df, "age", 15, 50)
    errs += _check_range(df, "performance_pct", 0, 100)
    errs += _check_isin(df, "age_band", ["20-21", "22-23", "24+"])
    errs += _check_ge(df, "competitions_count", 0)
    return errs


def _validate_player_age_performance_bands(df: pd.DataFrame) -> List[str]:
    required = [col for col in ["competition_name", "country", "age_band", "top_player_name", "top_player_team"] if col in df.columns]
    errs = _check_not_null(df, required)
    errs += _check_isin(df, "age_band", ["20-21", "22-23", "24+"])
    errs += _check_ge(df, "players_count", 0)
    errs += _check_range(df, "average_performance_pct", 0, 100)
    errs += _check_range(df, "top_player_performance_pct", 0, 100)
    return errs


def _validate_player_age_performance_summary(df: pd.DataFrame) -> List[str]:
    required = [col for col in ["competition_name", "country"] if col in df.columns]
    errs = _check_not_null(df, required)
    errs += _check_ge(df, "players_count", 0)
    errs += _check_range(df, "overall_average_performance_pct", 0, 100)
    errs += _check_range(df, "correlation_value", -1, 1)
    errs += _check_isin(df, "correlation_strength", ["none", "weak", "moderate", "strong", "insufficient"])
    if "correlation_direction" in df.columns:
        direction_series = df["correlation_direction"]
        valid_direction_mask = direction_series.isin(["positive", "negative", "neutral"])
        insufficient_mask = (
            df["correlation_strength"].eq("insufficient")
            if "correlation_strength" in df.columns
            else pd.Series(False, index=df.index)
        )
        allowed_null_mask = direction_series.isnull() & insufficient_mask
        invalid_values = direction_series[~(valid_direction_mask | allowed_null_mask)].tolist()
        if invalid_values:
            errs.append(
                f"Column 'correlation_direction' has {len(invalid_values)} invalid value(s): {invalid_values[:5]}"
            )
    errs += _check_isin(df, "best_age_band", ["20-21", "22-23", "24+"])
    errs += _check_range(df, "best_age_band_average_performance_pct", 0, 100)
    return errs


def _validate_player_age_performance_leaders(df: pd.DataFrame) -> List[str]:
    required = [col for col in ["competition_name", "country"] if col in df.columns]
    errs = _check_not_null(df, required)
    errs += _check_range(df, "young_standout_performance_pct", 0, 100)
    errs += _check_range(df, "veteran_standout_performance_pct", 0, 100)
    return errs


def _validate_ml_projection_summary(df: pd.DataFrame) -> List[str]:
    required = [col for col in ["country"] if col in df.columns]
    errs = _check_not_null(df, required)
    errs += _check_ge(df, "players_count", 0)
    errs += _check_ge(df, "improved_players_count", 0)
    errs += _check_ge(df, "declined_players_count", 0)
    errs += _check_ge(df, "stable_players_count", 0)
    errs += _check_range(df, "best_projected_winrate", 0, 100)
    errs += _check_range(df, "biggest_improvement_delta", -100, 100)
    errs += _check_range(df, "biggest_decline_delta", -100, 100)
    errs += _check_range(df, "best_projected_team_avg_winrate", 0, 100)
    required_counts = {"players_count", "improved_players_count", "declined_players_count", "stable_players_count"}
    if required_counts.issubset(df.columns):
        total = (
            pd.to_numeric(df["improved_players_count"], errors="coerce").fillna(0)
            + pd.to_numeric(df["declined_players_count"], errors="coerce").fillna(0)
            + pd.to_numeric(df["stable_players_count"], errors="coerce").fillna(0)
        )
        players = pd.to_numeric(df["players_count"], errors="coerce").fillna(0)
        mismatch = total != players
        if mismatch.any():
            errs.append("ML summary counts must add up to players_count")
    return errs


def _validate_ml_projection_players(df: pd.DataFrame) -> List[str]:
    required = [col for col in ["country", "player_name", "team", "team_country", "player_nationality", "trend", "confidence_band", "risk_band"] if col in df.columns]
    errs = _check_not_null(df, required)
    errs += _check_range(df, "age_2026", 15, 50)
    errs += _check_range(df, "actual_winrate", 0, 100)
    errs += _check_range(df, "predicted_winrate", 0, 100)
    errs += _check_range(df, "delta", -100, 100)
    errs += _check_range(df, "confidence_score", 0, 100)
    errs += _check_ge(df, "projected_rank", 1)
    errs += _check_isin(df, "trend", ["Improved", "Declined", "Stable"])
    errs += _check_isin(df, "confidence_band", ["Alta", "Media", "Baja"])
    errs += _check_isin(df, "risk_band", ["Salto esperado", "Riesgo de caída", "Estable", "A observar"])
    return errs


def _validate_ml_projection_team_summary(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["team", "country"])
    errs += _check_ge(df, "players_count", 0)
    errs += _check_range(df, "actual_avg_winrate", 0, 100)
    errs += _check_range(df, "projected_avg_winrate", 0, 100)
    errs += _check_range(df, "avg_delta", -100, 100)
    errs += _check_ge(df, "improved_players_count", 0)
    errs += _check_ge(df, "declined_players_count", 0)
    errs += _check_range(df, "top_projected_winrate", 0, 100)
    return errs


def _validate_ml_projection_country_summary(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["country"])
    errs += _check_ge(df, "players_count", 0)
    errs += _check_range(df, "actual_avg_winrate", 0, 100)
    errs += _check_range(df, "projected_avg_winrate", 0, 100)
    errs += _check_range(df, "avg_delta", -100, 100)
    errs += _check_ge(df, "improved_players_count", 0)
    errs += _check_ge(df, "declined_players_count", 0)
    errs += _check_range(df, "top_projected_winrate", 0, 100)
    return errs


def _validate_ml_projection_feature_importance(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["feature_key", "feature_label"])
    errs += _check_range(df, "importance_pct", 0, 100)
    errs += _check_ge(df, "rank", 1)
    if "importance_pct" in df.columns:
        total = pd.to_numeric(df["importance_pct"], errors="coerce").fillna(0).sum()
        if not (95 <= total <= 105):
            errs.append("ML feature importances should sum close to 100")
    return errs


def _validate_radar_teamwork_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "team", "country"])
    errs += _check_range(df, "avg_teamwork", 0, 100)
    errs += _check_range(df, "avg_winrate", 0, 100)
    errs += _check_ge(df, "total_players", 0)
    errs += _check_ge(df, "total_prizes", 0)
    return errs


def _validate_scatter_age_performance_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "name", "nationality", "team"])
    errs += _check_range(df, "age", 15, 50)
    errs += _check_range(df, "performance", 0, 100)
    return errs


def _validate_veteran_players_by_competition(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["competition_name", "team", "country", "veteran_player"])
    errs += _check_range(df, "age", 15, 50)
    errs += _check_range(df, "performance_2024", 0, 100)
    return errs


def _validate_players_index(df: pd.DataFrame) -> List[str]:
    errs = _check_not_null(df, ["name", "nationality", "team", "search_key"])
    return errs


# ---------------------------------------------------------------------------
# Registry - maps dataset keys to their validator functions
# ---------------------------------------------------------------------------

VALIDATOR_REGISTRY: Dict[str, Any] = {
    "kpis": _validate_kpis,
    "country_ranking": _validate_country_ranking,
    "top_jugadores": _validate_top_players,
    "evolucion": _validate_player_evolution,
    "roles": _validate_roles,
    "top_teams": _validate_top_teams,
    "teams_catalog": _validate_teams_catalog,
    "competitions": _validate_competitions,
    "veteranos": _validate_veteran_players,
    "metricas": _validate_summary_metrics,
    "radar_teamwork": _validate_radar_teamwork,
    "scatter_age_performance": _validate_scatter_age_performance,
    "competition_cross_filter": _validate_competition_cross_filter,
    "player_competition_mapping": _validate_player_competition_mapping,
    "kpis_by_country": _validate_kpis_by_country,
    "kpis_by_competition": _validate_kpis_by_competition,
    "kpis_by_country_competition": _validate_kpis_by_country_competition,
    "country_ranking_by_competition": _validate_country_ranking_by_competition,
    "top_teams_by_competition": _validate_top_teams_by_competition,
    "top_players_by_competition": _validate_top_players_by_competition,
    "player_evolution_by_competition": _validate_player_evolution_by_competition,
    "role_analysis_by_competition": _validate_role_analysis_by_competition,
    "squad_usage_summary": _validate_squad_usage_summary,
    "squad_usage_team_breakdown": _validate_squad_usage_team_breakdown,
    "squad_usage_by_country": _validate_squad_usage_summary,
    "squad_usage_by_competition": _validate_squad_usage_summary,
    "squad_usage_by_country_competition": _validate_squad_usage_summary,
    "squad_usage_team_breakdown_by_country": _validate_squad_usage_team_breakdown,
    "squad_usage_team_breakdown_by_competition": _validate_squad_usage_team_breakdown,
    "squad_usage_team_breakdown_by_country_competition": _validate_squad_usage_team_breakdown,
    "team_experience_summary": _validate_team_experience_summary,
    "team_experience_summary_by_country": _validate_team_experience_summary,
    "team_experience_summary_by_competition": _validate_team_experience_summary,
    "team_experience_summary_by_country_competition": _validate_team_experience_summary,
    "team_experience_profiles": _validate_team_experience_profiles,
    "team_experience_profiles_by_country": _validate_team_experience_profiles,
    "team_experience_profiles_by_competition": _validate_team_experience_profiles,
    "team_experience_profiles_by_country_competition": _validate_team_experience_profiles,
    "team_experience_leaders": _validate_team_experience_leaders,
    "team_experience_leaders_by_country": _validate_team_experience_leaders,
    "team_experience_leaders_by_competition": _validate_team_experience_leaders,
    "team_experience_leaders_by_country_competition": _validate_team_experience_leaders,
    "player_age_performance_points": _validate_player_age_performance_points,
    "player_age_performance_points_by_country": _validate_player_age_performance_points,
    "player_age_performance_points_by_competition": _validate_player_age_performance_points,
    "player_age_performance_points_by_country_competition": _validate_player_age_performance_points,
    "player_age_performance_bands": _validate_player_age_performance_bands,
    "player_age_performance_bands_by_country": _validate_player_age_performance_bands,
    "player_age_performance_bands_by_competition": _validate_player_age_performance_bands,
    "player_age_performance_bands_by_country_competition": _validate_player_age_performance_bands,
    "player_age_performance_summary": _validate_player_age_performance_summary,
    "player_age_performance_summary_by_country": _validate_player_age_performance_summary,
    "player_age_performance_summary_by_competition": _validate_player_age_performance_summary,
    "player_age_performance_summary_by_country_competition": _validate_player_age_performance_summary,
    "player_age_performance_leaders": _validate_player_age_performance_leaders,
    "player_age_performance_leaders_by_country": _validate_player_age_performance_leaders,
    "player_age_performance_leaders_by_competition": _validate_player_age_performance_leaders,
    "player_age_performance_leaders_by_country_competition": _validate_player_age_performance_leaders,
    "ml_projection_2026_summary": _validate_ml_projection_summary,
    "ml_projection_2026_players": _validate_ml_projection_players,
    "ml_projection_2026_team_summary": _validate_ml_projection_team_summary,
    "ml_projection_2026_country_summary": _validate_ml_projection_country_summary,
    "ml_projection_2026_feature_importance": _validate_ml_projection_feature_importance,
    "ml_projection_2026_summary_by_country": _validate_ml_projection_summary,
    "ml_projection_2026_players_by_country": _validate_ml_projection_players,
    "ml_projection_2026_team_summary_by_country": _validate_ml_projection_team_summary,
    "ml_projection_2026_country_summary_by_country": _validate_ml_projection_country_summary,
    "team_comparison_profiles": _validate_team_comparison_profiles,
    "team_comparison_profiles_by_country": _validate_team_comparison_profiles,
    "team_comparison_profiles_by_competition": _validate_team_comparison_profiles,
    "team_comparison_profiles_by_country_competition": _validate_team_comparison_profiles,
    "team_comparison_leaders": _validate_team_comparison_leaders,
    "team_comparison_leaders_by_country": _validate_team_comparison_leaders,
    "team_comparison_leaders_by_competition": _validate_team_comparison_leaders,
    "team_comparison_leaders_by_country_competition": _validate_team_comparison_leaders,
    "radar_teamwork_by_competition": _validate_radar_teamwork_by_competition,
    "scatter_age_performance_by_competition": _validate_scatter_age_performance_by_competition,
    "veteran_players_by_competition": _validate_veteran_players_by_competition,
    "players_index": _validate_players_index,
}
