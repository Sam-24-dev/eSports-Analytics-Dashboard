"""Expected values helper for the contextual table redesign."""

from __future__ import annotations

import argparse
import json
import math
import unicodedata
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_tablas_vs_front.md"


def load_dashboard_snapshot(path: Path = SNAPSHOT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_only.lower().strip().split())


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(numeric):
        return 0.0
    return numeric


def _display_text(value: Any) -> str:
    if value is None or value == "":
        return "-"
    return str(value)


def format_currency(value: Any) -> str:
    numeric = _safe_float(value)
    return f"${numeric:,.0f}"


def format_percent(value: Any) -> str:
    if value is None:
        return "-"
    return f"{_safe_float(value):.1f}%"


def format_signed_percent(value: Any) -> str:
    if value is None:
        return "-"
    numeric = _safe_float(value)
    if numeric > 0:
        return f"+{numeric:.1f}%"
    return f"{numeric:.1f}%"


def format_contextual_variation(value: Any) -> str:
    if value is None:
        return "Sin comparación"
    return format_signed_percent(value)


def _variation_tone(value: Any) -> str:
    if value is None:
        return "not-comparable"
    numeric = _safe_float(value)
    if numeric > 0:
        return "positive"
    if numeric < 0:
        return "negative"
    return "neutral"


def _resolve_exact_player_name(raw_search: str, snapshot: dict[str, Any]) -> str | None:
    normalized = normalize_text(raw_search)
    if not normalized:
        return None
    for row in snapshot.get("filter_ready", {}).get("players_index", []):
        if normalize_text(row.get("name")) == normalized:
            return row.get("name")
    for row in snapshot.get("player_evolution", []):
        if normalize_text(row.get("name")) == normalized:
            return row.get("name")
    return None


def _rows_for_competition_players(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
) -> list[dict[str, Any]]:
    rows = []
    for row in snapshot.get("filter_ready", {}).get("player_evolution_by_competition", []):
        if competition and row.get("competition_name") != competition:
            continue
        if country and row.get("nationality") != country:
            continue
        rows.append(dict(row))
    return rows


def _competition_year_performance(row: dict[str, Any]) -> float | None:
    year = row.get("competition_year")
    if year == 2024:
        return row.get("performance_2024")
    if year == 2025:
        return row.get("performance_2025")
    return row.get("performance_2025") if row.get("performance_2025") is not None else row.get("performance_2024")


def _sort_teams_overview(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            -_safe_float(row.get("total_prizes")),
            -_safe_float(row.get("participating_competitions")),
            1 if row.get("best_position") is None else 0,
            _safe_float(row.get("best_position")) if row.get("best_position") is not None else 10**9,
            normalize_text(row.get("name")),
        ),
    )


def _sort_players_ranking(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            -_safe_float(_competition_year_performance(row)),
            -_safe_float(row.get("improvement_pct")),
            normalize_text(row.get("name")),
        ),
    )


def _sort_team_results(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            1 if _safe_float(row.get("final_position")) <= 0 else 0,
            _safe_float(row.get("final_position")) if _safe_float(row.get("final_position")) > 0 else 10**9,
            -_safe_float(row.get("prize_obtained")),
            normalize_text(row.get("team")),
        ),
    )


def _build_empty_view(title: str, message: str) -> dict[str, Any]:
    return {
        "mode": "empty",
        "title": title,
        "headers": [],
        "rows": [],
        "empty_state": {"message": message},
    }


def _build_teams_overview_view(snapshot: dict[str, Any], *, country: str = "") -> dict[str, Any]:
    rows = [dict(row) for row in snapshot.get("teams_catalog", [])]
    if country:
        rows = [row for row in rows if row.get("country") == country]

    headers = ["Equipo", "Competiciones", "Jugadores", "Premios", "Mejor puesto"]
    if not country:
        headers = ["Equipo", "País", "Competiciones", "Jugadores", "Premios", "Mejor puesto"]

    built_rows = []
    for row in _sort_teams_overview(rows):
        item = {
            "Equipo": _display_text(row.get("name")),
            "Competiciones": int(_safe_float(row.get("participating_competitions"))),
            "Jugadores": int(_safe_float(row.get("total_players"))),
            "Premios": format_currency(row.get("total_prizes")),
            "Mejor puesto": "-" if row.get("best_position") is None else int(_safe_float(row.get("best_position"))),
        }
        if not country:
            item["País"] = _display_text(row.get("country"))
        built_rows.append(item)

    return {
        "mode": "teams-overview",
        "title": f"Equipos de {country}" if country else "Equipos destacados",
        "headers": headers,
        "rows": built_rows,
        "empty_state": {"message": "Sin equipos para este filtro"} if not built_rows else None,
    }


def _build_players_ranking_view(
    snapshot: dict[str, Any],
    *,
    competition: str,
    country: str = "",
) -> dict[str, Any]:
    rows = _rows_for_competition_players(snapshot, country=country, competition=competition)
    rows = [row for row in rows if _competition_year_performance(row) is not None]
    ranked_rows = []
    for index, row in enumerate(_sort_players_ranking(rows), start=1):
        item = {
            "Pos.": index,
            "Jugador": _display_text(row.get("name")),
            "Equipo": _display_text(row.get("team")),
            "Rendimiento": format_percent(_competition_year_performance(row)),
            "Variación anual": format_contextual_variation(row.get("improvement_pct")),
            "_variation_tone": _variation_tone(row.get("improvement_pct")),
        }
        if not country:
            item["País"] = _display_text(row.get("nationality"))
        ranked_rows.append(item)

    headers = ["Pos.", "Jugador", "Equipo", "Rendimiento", "Variación anual"]
    if not country:
        headers = ["Pos.", "Jugador", "Equipo", "País", "Rendimiento", "Variación anual"]

    title = f"Jugadores de {country} en {competition}" if country else f"Jugadores destacados en {competition}"
    return {
        "mode": "players-ranking",
        "title": title,
        "headers": headers,
        "rows": ranked_rows,
        "empty_state": {"message": "Sin rendimiento anual de jugadores para este filtro"} if not ranked_rows else None,
    }


def _build_team_results_view(
    snapshot: dict[str, Any],
    *,
    competition: str,
    country: str = "",
) -> dict[str, Any]:
    rows = []
    for row in snapshot.get("filter_ready", {}).get("top_teams_by_competition", []):
        if row.get("competition_name") != competition:
            continue
        if country and row.get("country") != country:
            continue
        rows.append(dict(row))

    built_rows = []
    for row in _sort_team_results(rows):
        item = {
            "Pos.": "-" if _safe_float(row.get("final_position")) <= 0 else int(_safe_float(row.get("final_position"))),
            "Equipo": _display_text(row.get("team")),
            "Jugadores": int(_safe_float(row.get("total_players"))),
            "Premio": format_currency(row.get("prize_obtained")),
        }
        if not country:
            item["País"] = _display_text(row.get("country"))
        built_rows.append(item)

    headers = ["Pos.", "Equipo", "Jugadores", "Premio"]
    if not country:
        headers = ["Pos.", "Equipo", "País", "Jugadores", "Premio"]

    title = f"Equipos de {country} en {competition}" if country else f"Resultados de equipos en {competition}"
    return {
        "mode": "teams-results",
        "title": title,
        "headers": headers,
        "rows": built_rows,
        "empty_state": {"message": "Sin equipos para este filtro"} if not built_rows else None,
    }


def _build_player_detail_view(
    snapshot: dict[str, Any],
    *,
    player_name: str,
    competition: str = "",
    country: str = "",
) -> dict[str, Any]:
    if competition:
        rows = [
            dict(row)
            for row in snapshot.get("filter_ready", {}).get("player_evolution_by_competition", [])
            if row.get("competition_name") == competition and row.get("name") == player_name
        ]
        if country:
            rows = [row for row in rows if row.get("nationality") == country]
        if not rows:
            title = f"Detalle de {player_name} en {competition}"
            return _build_empty_view(title, "Jugador sin datos para este filtro")

        detail_rows = []
        for row in _sort_players_ranking(rows):
            detail_rows.append(
                {
                    "Competencia": _display_text(row.get("competition_name")),
                    "Año": int(_safe_float(row.get("competition_year"))),
                    "Equipo": _display_text(row.get("team")),
                    "País": _display_text(row.get("nationality")),
                    "Rendimiento": format_percent(_competition_year_performance(row)),
                    "Variación anual": format_contextual_variation(row.get("improvement_pct")),
                    "_variation_tone": _variation_tone(row.get("improvement_pct")),
                }
            )

        return {
            "mode": "player-detail",
            "title": f"Detalle de {player_name} en {competition}",
            "headers": ["Competencia", "Año", "Equipo", "País", "Rendimiento", "Variación anual"],
            "rows": detail_rows,
            "empty_state": None,
        }

    row = next((dict(item) for item in snapshot.get("player_evolution", []) if item.get("name") == player_name), None)
    if row is None or (country and row.get("nationality") != country):
        return _build_empty_view(f"Detalle de {player_name}", "Jugador sin datos para este filtro")

    detail_rows = []
    if row.get("performance_2024") is not None:
        detail_rows.append(
            {
                "Año": 2024,
                "Equipo": _display_text(row.get("team_2024")),
                "País": _display_text(row.get("nationality")),
                "Rendimiento": format_percent(row.get("performance_2024")),
                "Variación anual": "Sin comparación",
                "_variation_tone": "not-comparable",
            }
        )
    if row.get("performance_2025") is not None:
        detail_rows.append(
            {
                "Año": 2025,
                "Equipo": _display_text(row.get("team_2025")),
                "País": _display_text(row.get("nationality")),
                "Rendimiento": format_percent(row.get("performance_2025")),
                "Variación anual": format_contextual_variation(row.get("improvement_pct")),
                "_variation_tone": _variation_tone(row.get("improvement_pct")),
            }
        )

    return {
        "mode": "player-detail",
        "title": f"Detalle de {player_name}",
        "headers": ["Año", "Equipo", "País", "Rendimiento", "Variación anual"],
        "rows": detail_rows,
        "empty_state": None if detail_rows else {"message": "Jugador sin datos para este filtro"},
    }


def build_table_context_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
    search: str = "",
) -> dict[str, Any]:
    country = (country or "").strip()
    competition = (competition or "").strip()
    exact_player = _resolve_exact_player_name(search, snapshot)

    if exact_player:
        return _build_player_detail_view(
            snapshot,
            player_name=exact_player,
            competition=competition,
            country=country,
        )

    if competition:
        player_rows = _rows_for_competition_players(snapshot, country=country, competition=competition)
        if player_rows:
            return _build_players_ranking_view(snapshot, competition=competition, country=country)
        return _build_team_results_view(snapshot, competition=competition, country=country)

    return _build_teams_overview_view(snapshot, country=country)


def _markdown_table(headers: list[str], rows: list[dict[str, Any]]) -> str:
    if not headers:
        return "- Sin columnas"
    header_line = "| " + " | ".join(headers) + " |"
    divider = "| " + " | ".join(["---"] * len(headers)) + " |"
    lines = [header_line, divider]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(header, "-")) for header in headers) + " |")
    return "\n".join(lines)


def _collect_empty_competition_country_pairs(snapshot: dict[str, Any], limit: int = 2) -> list[tuple[str, str]]:
    competitions = [row.get("competition_name") for row in snapshot.get("filter_ready", {}).get("kpis_by_competition", [])]
    countries = [row.get("country") for row in snapshot.get("filter_ready", {}).get("kpis_by_country", [])]
    results: list[tuple[str, str]] = []
    for country in countries:
        for competition in competitions:
            view = build_table_context_view(snapshot, country=country, competition=competition)
            if view["mode"] == "teams-results" and not view["rows"]:
                results.append((country, competition))
            if len(results) >= limit:
                return results
    return results


def generate_validation_markdown(snapshot: dict[str, Any]) -> str:
    countries = [row.get("country") for row in snapshot.get("filter_ready", {}).get("kpis_by_country", []) if row.get("country")]
    competitions = [
        row.get("competition_name")
        for row in snapshot.get("filter_ready", {}).get("kpis_by_competition", [])
        if row.get("competition_name")
    ]

    global_view = build_table_context_view(snapshot)
    comparable_player = next((row.get("name") for row in snapshot.get("player_evolution", []) if row.get("performance_2024") is not None and row.get("performance_2025") is not None), None)
    single_year_player = next((row.get("name") for row in snapshot.get("player_evolution", []) if (row.get("performance_2024") is None) != (row.get("performance_2025") is None)), None)

    lines = [
        "# Validacion Tablas vs Front",
        "",
        "## Estado global",
        "",
        f"- mode: `{global_view['mode']}`",
        f"- title: `{global_view['title']}`",
        "",
        _markdown_table(global_view["headers"], global_view["rows"][:10]),
        "",
        "## Estados por país",
        "",
    ]

    for country in countries:
        view = build_table_context_view(snapshot, country=country)
        lines.extend(
            [
                f"### {country}",
                "",
                f"- mode: `{view['mode']}`",
                f"- title: `{view['title']}`",
                "",
                _markdown_table(view["headers"], view["rows"][:10]),
                "",
            ]
        )

    lines.extend(["## Estados por competencia", ""])
    for competition in competitions:
        view = build_table_context_view(snapshot, competition=competition)
        lines.extend(
            [
                f"### {competition}",
                "",
                f"- mode: `{view['mode']}`",
                f"- title: `{view['title']}`",
                "",
                _markdown_table(view["headers"], view["rows"][:10]),
                "",
            ]
        )

    lines.extend(["## Estados país + competencia", ""])
    for country in countries:
        for competition in competitions:
            view = build_table_context_view(snapshot, country=country, competition=competition)
            if not view["rows"]:
                continue
            lines.extend(
                [
                    f"### {country} + {competition}",
                    "",
                    f"- mode: `{view['mode']}`",
                    f"- title: `{view['title']}`",
                    "",
                    _markdown_table(view["headers"], view["rows"][:10]),
                    "",
                ]
            )

    empty_pairs = _collect_empty_competition_country_pairs(snapshot)
    if empty_pairs:
        lines.extend(["## Estados país + competencia vacíos", ""])
        for country, competition in empty_pairs:
            view = build_table_context_view(snapshot, country=country, competition=competition)
            lines.extend(
                [
                    f"- `{country} + {competition}` -> `{view['empty_state']['message']}`",
                ]
            )
        lines.append("")

    lines.extend(["## Casos de jugador exacto", ""])
    if comparable_player:
        view = build_table_context_view(snapshot, search=comparable_player)
        lines.extend(
            [
                f"### {comparable_player}",
                "",
                f"- mode: `{view['mode']}`",
                f"- title: `{view['title']}`",
                "",
                _markdown_table(view["headers"], view["rows"]),
                "",
            ]
        )
        competition_view = next(
            (
                row.get("competition_name")
                for row in snapshot.get("filter_ready", {}).get("player_evolution_by_competition", [])
                if row.get("name") == comparable_player
            ),
            "",
        )
        if competition_view:
            view = build_table_context_view(snapshot, search=comparable_player, competition=competition_view)
            lines.extend(
                [
                    f"### {comparable_player} en {competition_view}",
                    "",
                    f"- mode: `{view['mode']}`",
                    f"- title: `{view['title']}`",
                    "",
                    _markdown_table(view["headers"], view["rows"]),
                    "",
                ]
            )
    if single_year_player:
        view = build_table_context_view(snapshot, search=single_year_player)
        lines.extend(
            [
                f"### {single_year_player}",
                "",
                f"- mode: `{view['mode']}`",
                f"- title: `{view['title']}`",
                "",
                _markdown_table(view["headers"], view["rows"]),
                "",
            ]
        )
        missing_competition = next(
            (
                competition
                for competition in competitions
                if not any(
                    row.get("competition_name") == competition and row.get("name") == single_year_player
                    for row in snapshot.get("filter_ready", {}).get("player_evolution_by_competition", [])
                )
            ),
            "",
        )
        if missing_competition:
            view = build_table_context_view(snapshot, search=single_year_player, competition=missing_competition)
            lines.extend(
                [
                    f"### {single_year_player} sin datos en {missing_competition}",
                    "",
                    f"- mode: `{view['mode']}`",
                    f"- title: `{view['title']}`",
                    "",
                    f"- empty_state: `{view['empty_state']['message']}`",
                    "",
                ]
            )

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera valores esperados para la tabla contextual.")
    parser.add_argument("--country", default="", help="País del contexto")
    parser.add_argument("--competition", default="", help="Competencia del contexto")
    parser.add_argument("--search", default="", help="Búsqueda exacta de jugador")
    parser.add_argument("--markdown", action="store_true", help="Imprime el reporte markdown completo")
    parser.add_argument("--output", default="", help="Ruta de salida para markdown")
    args = parser.parse_args()

    snapshot = load_dashboard_snapshot()
    if args.markdown:
        markdown = generate_validation_markdown(snapshot)
        if args.output:
            output = Path(args.output)
        else:
            output = DEFAULT_DOC_PATH
        output.write_text(markdown, encoding="utf-8")
        print(f"Markdown generado en {output}")
        return

    view = build_table_context_view(
        snapshot,
        country=args.country,
        competition=args.competition,
        search=args.search,
    )
    print(json.dumps(view, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
