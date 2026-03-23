"""CLI helper for live UI validation against the dashboard snapshot."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"

EMPTY_KPIS = {
    "total_teams": 0,
    "total_players": 0,
    "total_prizes": 0,
    "countries_represented": 0,
    "active_competitions": 0,
    "average_age": 0,
    "international_competitions": 0,
    "national_competitions": 0,
}


def load_dashboard_snapshot(path: Path = SNAPSHOT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _sort_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(rows, key=lambda row: (-float(row.get("total_prizes", 0) or 0), row.get("country", "")))


def _find_by_key(rows: list[dict[str, Any]], key: str, value: str) -> dict[str, Any] | None:
    return next((row for row in rows if row.get(key) == value), None)


def compute_expected_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
) -> dict[str, Any]:
    filter_ready = snapshot.get("filter_ready", {})
    kpis_by_country = filter_ready.get("kpis_by_country", [])
    kpis_by_competition = filter_ready.get("kpis_by_competition", [])
    kpis_by_country_competition = filter_ready.get("kpis_by_country_competition", [])
    ranking_by_competition = filter_ready.get("country_ranking_by_competition", [])
    global_ranking = snapshot.get("country_ranking", [])

    status = "with_data"
    if country and competition:
        kpi_row = next(
            (
                row
                for row in kpis_by_country_competition
                if row.get("country") == country and row.get("competition_name") == competition
            ),
            None,
        )
        if kpi_row:
            kpis = {
                "total_teams": kpi_row.get("total_teams", 0),
                "total_players": kpi_row.get("total_players", 0),
                "total_prizes": kpi_row.get("total_prizes", 0),
                "countries_represented": 1,
                "active_competitions": 1,
                "average_age": kpi_row.get("average_age", 0),
                "international_competitions": 1 if kpi_row.get("type") == "Internacional" else 0,
                "national_competitions": 0 if kpi_row.get("type") == "Internacional" else 1,
            }
            rows = [
                {
                    "country": country,
                    "total_teams": kpi_row.get("total_teams", 0),
                    "total_players": kpi_row.get("total_players", 0),
                    "total_prizes": kpi_row.get("total_prizes", 0),
                    "average_age": kpi_row.get("average_age", 0),
                }
            ]
        else:
            kpis = dict(EMPTY_KPIS)
            rows = []
            status = "empty"
    elif country:
        kpi_row = _find_by_key(kpis_by_country, "country", country)
        if kpi_row:
            kpis = {
                key: kpi_row.get(key, 0)
                for key in EMPTY_KPIS
            }
            rows = [
                {
                    "country": country,
                    "total_teams": kpi_row.get("total_teams", 0),
                    "total_players": kpi_row.get("total_players", 0),
                    "total_prizes": kpi_row.get("total_prizes", 0),
                    "average_age": kpi_row.get("average_age", 0),
                }
            ]
        else:
            kpis = dict(EMPTY_KPIS)
            rows = []
            status = "empty"
    elif competition:
        kpi_row = _find_by_key(kpis_by_competition, "competition_name", competition)
        if kpi_row:
            kpis = {
                "total_teams": kpi_row.get("total_teams", 0),
                "total_players": kpi_row.get("total_players", 0),
                "total_prizes": kpi_row.get("total_prizes", 0),
                "countries_represented": kpi_row.get("countries_represented", 0),
                "active_competitions": 1,
                "average_age": kpi_row.get("average_age", 0),
                "international_competitions": kpi_row.get("international_competitions", 0),
                "national_competitions": kpi_row.get("national_competitions", 0),
            }
            rows = [
                {
                    "country": row.get("country"),
                    "total_teams": row.get("total_teams", 0),
                    "total_players": row.get("total_players", 0),
                    "total_prizes": row.get("total_prizes", 0),
                    "average_age": row.get("average_age", 0),
                }
                for row in ranking_by_competition
                if row.get("competition_name") == competition
            ]
        else:
            kpis = dict(EMPTY_KPIS)
            rows = []
            status = "empty"
    else:
        kpis = snapshot.get("main_kpis", dict(EMPTY_KPIS))
        rows = [
            {
                "country": row.get("country"),
                "total_teams": row.get("total_teams", 0),
                "total_players": row.get("total_players", 0),
                "total_prizes": row.get("total_prizes", 0),
                "average_age": row.get("average_age", 0),
            }
            for row in global_ranking
        ]

    rows = _sort_rows(rows)
    return {
        "filters": {"country": country or None, "competition": competition or None},
        "status": status,
        "kpis": kpis,
        "donut_bar_rows": rows,
    }


def _format_number(value: Any) -> str:
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:.1f}"
    return str(value)


def _print_kpis(kpis: dict[str, Any]) -> None:
    print("KPIs esperados")
    for key, value in kpis.items():
        print(f"- {key}: {_format_number(value)}")


def _print_rows(rows: list[dict[str, Any]]) -> None:
    print("Donut / Barra esperados")
    if not rows:
        print("- Sin datos para este filtro")
        return
    for row in rows:
        print(
            "- "
            f"{row['country']}: "
            f"teams={_format_number(row['total_teams'])}, "
            f"players={_format_number(row['total_players'])}, "
            f"prizes={_format_number(row['total_prizes'])}, "
            f"avg_age={_format_number(row['average_age'])}"
        )


def _print_lists(snapshot: dict[str, Any]) -> None:
    filter_ready = snapshot.get("filter_ready", {})
    countries = sorted(row.get("country") for row in filter_ready.get("kpis_by_country", []) if row.get("country"))
    competitions = sorted(
        row.get("competition_name")
        for row in filter_ready.get("kpis_by_competition", [])
        if row.get("competition_name")
    )
    print("Paises validos")
    for item in countries:
        print(f"- {item}")
    print("Competencias validas")
    for item in competitions:
        print(f"- {item}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Muestra los datos esperados del front para comparar en vivo.")
    parser.add_argument("--country", default="", help="Pais a validar")
    parser.add_argument("--competition", default="", help="Competencia a validar")
    parser.add_argument("--list", action="store_true", help="Lista paises y competencias validas")
    args = parser.parse_args()

    snapshot = load_dashboard_snapshot()
    if args.list:
        _print_lists(snapshot)
        return

    result = compute_expected_view(
        snapshot,
        country=args.country.strip(),
        competition=args.competition.strip(),
    )
    print(f"Filtros: country={result['filters']['country']} competition={result['filters']['competition']}")
    print(f"Estado esperado: {result['status']}")
    _print_kpis(result["kpis"])
    _print_rows(result["donut_bar_rows"])


if __name__ == "__main__":
    main()
