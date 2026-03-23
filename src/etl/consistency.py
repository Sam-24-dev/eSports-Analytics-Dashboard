"""
Consistency checks for filter-ready datasets.

These checks validate that filter-ready aggregations stay aligned with
global totals and that filter coverage is complete across countries,
competitions, and players.
"""

from __future__ import annotations

import unicodedata
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Sequence

import pandas as pd

Record = Dict[str, Any]
DatasetLike = pd.DataFrame | Sequence[Mapping[str, Any]]
FilterReadyLike = Mapping[str, DatasetLike]


def _to_records(dataset: DatasetLike | None) -> List[Record]:
    """Return a list of dict records from a DataFrame or list-like dataset."""
    if dataset is None:
        return []
    if isinstance(dataset, pd.DataFrame):
        return dataset.to_dict(orient="records")
    return [dict(row) for row in dataset]


def _as_number(value: Any) -> float | None:
    """Convert value to float if possible; return None when not numeric."""
    if value is None:
        return None
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_text(value: str | None) -> str:
    """Normalize text for case- and accent-insensitive search."""
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()


def _compare_numeric(
    *,
    label: str,
    expected: Any,
    actual: Any,
    tolerance: float,
    issues: List[str],
) -> None:
    """Compare numeric values and append issue if diff exceeds tolerance."""
    expected_num = _as_number(expected)
    actual_num = _as_number(actual)
    if expected_num is None or actual_num is None:
        issues.append(
            f"{label} has non-numeric value(s): expected={expected}, actual={actual}"
        )
        return
    if abs(actual_num - expected_num) > tolerance:
        issues.append(
            f"{label} mismatch: expected={expected_num:.2f}, actual={actual_num:.2f}"
        )


def check_competition_totals(
    country_ranking_by_competition: DatasetLike | None,
    kpis_by_competition: DatasetLike | None,
    *,
    tolerance: float = 0.01,
) -> List[str]:
    """Ensure per-competition totals match sum of country-level rows."""
    issues: List[str] = []
    ranking_records = _to_records(country_ranking_by_competition)
    kpis_records = _to_records(kpis_by_competition)

    totals: MutableMapping[str, Dict[str, float]] = {}
    for row in ranking_records:
        competition = row.get("competition_name")
        if not competition:
            continue
        totals.setdefault(
            competition, {"total_teams": 0.0, "total_players": 0.0, "total_prizes": 0.0}
        )
        totals[competition]["total_teams"] += _as_number(row.get("total_teams")) or 0.0
        totals[competition]["total_players"] += _as_number(row.get("total_players")) or 0.0
        totals[competition]["total_prizes"] += _as_number(row.get("total_prizes")) or 0.0

    for row in kpis_records:
        competition = row.get("competition_name")
        if not competition:
            continue
        if competition not in totals:
            issues.append(
                f"[competition_totals] Missing competition '{competition}' in country_ranking_by_competition"
            )
            continue
        for metric in ("total_teams", "total_players", "total_prizes"):
            _compare_numeric(
                label=f"[competition_totals] {competition} {metric}",
                expected=row.get(metric),
                actual=totals[competition].get(metric),
                tolerance=tolerance,
                issues=issues,
            )

    ranking_only = set(totals) - {row.get("competition_name") for row in kpis_records}
    for competition in sorted(name for name in ranking_only if name):
        issues.append(
            f"[competition_totals] Competition '{competition}' missing in kpis_by_competition"
        )

    return issues


def check_country_competition_match(
    country_ranking_by_competition: DatasetLike | None,
    kpis_by_country_competition: DatasetLike | None,
    *,
    tolerance: float = 0.01,
) -> List[str]:
    """Ensure country ranking rows match the country+competition KPIs."""
    issues: List[str] = []
    ranking_records = _to_records(country_ranking_by_competition)
    kpis_records = _to_records(kpis_by_country_competition)

    aggregates: Dict[tuple[str, str], Dict[str, float]] = {}
    for row in kpis_records:
        competition = row.get("competition_name")
        country = row.get("country")
        if not competition or not country:
            continue
        key = (competition, country)
        aggregates.setdefault(
            key,
            {
                "total_teams": 0.0,
                "total_players": 0.0,
                "total_prizes": 0.0,
                "age_weighted_sum": 0.0,
                "age_weight": 0.0,
            },
        )
        aggregates[key]["total_teams"] += _as_number(row.get("total_teams")) or 0.0
        aggregates[key]["total_players"] += _as_number(row.get("total_players")) or 0.0
        aggregates[key]["total_prizes"] += _as_number(row.get("total_prizes")) or 0.0
        avg_age = _as_number(row.get("average_age"))
        weight = _as_number(row.get("total_players")) or 0.0
        if avg_age is not None:
            aggregates[key]["age_weighted_sum"] += avg_age * (weight or 1.0)
            aggregates[key]["age_weight"] += weight or 1.0

    for row in ranking_records:
        competition = row.get("competition_name")
        country = row.get("country")
        if not competition or not country:
            continue
        key = (competition, country)
        if key not in aggregates:
            issues.append(
                f"[country_competition_match] Missing KPI row for {competition} / {country}"
            )
            continue
        expected = aggregates[key]
        for metric in ("total_teams", "total_players", "total_prizes"):
            _compare_numeric(
                label=f"[country_competition_match] {competition} {country} {metric}",
                expected=expected.get(metric),
                actual=row.get(metric),
                tolerance=tolerance,
                issues=issues,
            )
        if expected["age_weight"] > 0:
            expected_age = expected["age_weighted_sum"] / expected["age_weight"]
            _compare_numeric(
                label=f"[country_competition_match] {competition} {country} average_age",
                expected=expected_age,
                actual=row.get("average_age"),
                tolerance=tolerance,
                issues=issues,
            )

    return issues


def check_filter_coverage(
    filter_ready: FilterReadyLike,
    competitions: DatasetLike | None,
) -> List[str]:
    """Validate that filter-ready datasets cover expected countries/competitions."""
    issues: List[str] = []
    competitions_records = _to_records(competitions)
    competition_names = {
        row.get("name") for row in competitions_records if row.get("name")
    }

    kpis_by_competition = _to_records(filter_ready.get("kpis_by_competition"))
    ranking_by_competition = _to_records(
        filter_ready.get("country_ranking_by_competition")
    )
    kpis_by_country = _to_records(filter_ready.get("kpis_by_country"))
    kpis_by_country_competition = _to_records(
        filter_ready.get("kpis_by_country_competition")
    )
    players_index = _to_records(filter_ready.get("players_index"))

    kpis_competitions = {
        row.get("competition_name") for row in kpis_by_competition if row.get("competition_name")
    }
    ranking_competitions = {
        row.get("competition_name")
        for row in ranking_by_competition
        if row.get("competition_name")
    }

    missing_in_kpis = competition_names - kpis_competitions
    missing_in_ranking = competition_names - ranking_competitions
    if missing_in_kpis:
        issues.append(
            "[filter_coverage] Competitions missing in kpis_by_competition: "
            + ", ".join(sorted(missing_in_kpis))
        )
    if missing_in_ranking:
        issues.append(
            "[filter_coverage] Competitions missing in country_ranking_by_competition: "
            + ", ".join(sorted(missing_in_ranking))
        )

    countries = {row.get("country") for row in kpis_by_country if row.get("country")}
    countries_in_cross = {
        row.get("country")
        for row in kpis_by_country_competition
        if row.get("country")
    }
    missing_countries = countries - countries_in_cross
    if missing_countries:
        issues.append(
            "[filter_coverage] Countries missing in kpis_by_country_competition: "
            + ", ".join(sorted(missing_countries))
        )

    for row in players_index:
        name = row.get("name")
        expected = _normalize_text(name)
        actual = row.get("search_key")
        if actual is None:
            issues.append(
                f"[filter_coverage] players_index search_key missing for name '{name}'"
            )
            continue
        if expected != actual:
            issues.append(
                f"[filter_coverage] players_index search_key mismatch for '{name}': "
                f"expected '{expected}', got '{actual}'"
            )

    return issues


def run_consistency_checks(
    *,
    filter_ready: FilterReadyLike,
    competitions: DatasetLike | None,
    tolerance: float = 0.01,
) -> Dict[str, List[str]]:
    """Run all consistency checks and return issues grouped by check name."""
    return {
        "competition_totals": check_competition_totals(
            filter_ready.get("country_ranking_by_competition"),
            filter_ready.get("kpis_by_competition"),
            tolerance=tolerance,
        ),
        "country_competition_match": check_country_competition_match(
            filter_ready.get("country_ranking_by_competition"),
            filter_ready.get("kpis_by_country_competition"),
            tolerance=tolerance,
        ),
        "filter_coverage": check_filter_coverage(filter_ready, competitions),
    }
