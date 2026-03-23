"""Expected values helper for the player module UI."""

from __future__ import annotations

import argparse
import json
import math
import unicodedata
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_player_chart_vs_front.md"

PLAYER_MODULE_COPY = {
    "empty_comparable": "Sin comparables 2024-2025",
    "empty_positive_only": "Sin mejoras positivas 2024-2025",
    "empty_comparable_hint": "Selecciona una competencia para ver ranking anual",
    "empty_no_player_data": "Jugador sin datos para este filtro",
    "empty_no_rows": "Sin jugadores para este filtro",
    "empty_no_single_year_data": "Sin rendimiento anual de jugadores para este filtro",
    "table_title_evolution": "Evolucion de jugadores",
    "table_title_single_year": "Detalle de rendimiento",
}


def load_dashboard_snapshot(path: Path = SNAPSHOT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_only.lower().strip().split())


def to_proper_case(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(chunk[:1].upper() + chunk[1:].lower() for chunk in str(value).split())


def clone_rows(rows: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [dict(row) for row in (rows or [])]


def has_comparable_player_years(row: dict[str, Any]) -> bool:
    return row.get("performance_2024") is not None and row.get("performance_2025") is not None


def has_positive_improvement(row: dict[str, Any]) -> bool:
    return has_comparable_player_years(row) and _safe_number(row.get("improvement_pct")) > 0


def infer_single_year_from_row(row: dict[str, Any] | None) -> int | None:
    if not row:
        return None
    if row.get("competition_year") is not None:
        return int(row["competition_year"])
    if row.get("performance_2024") is not None and row.get("performance_2025") is None:
        return 2024
    if row.get("performance_2025") is not None and row.get("performance_2024") is None:
        return 2025
    return None


def get_single_year_performance(row: dict[str, Any]) -> float | None:
    year = infer_single_year_from_row(row)
    if year == 2024:
        return row.get("performance_2024")
    if year == 2025:
        return row.get("performance_2025")
    if row.get("performance_2025") is not None:
        return row.get("performance_2025")
    if row.get("performance_2024") is not None:
        return row.get("performance_2024")
    return None


def get_single_year_team(row: dict[str, Any]) -> str:
    year = infer_single_year_from_row(row)
    if year == 2024:
        return str(row.get("team") or row.get("team_2024") or row.get("team_2025") or "N/A")
    if year == 2025:
        return str(row.get("team") or row.get("team_2025") or row.get("team_2024") or "N/A")
    return str(row.get("team") or row.get("team_2025") or row.get("team_2024") or "N/A")


def get_player_module_search_catalog(snapshot: dict[str, Any]) -> dict[str, str]:
    catalog: dict[str, str] = {}
    for row in snapshot.get("filter_ready", {}).get("players_index", []):
        name = row.get("name")
        if not name:
            continue
        key = normalize_text(name)
        if key and key not in catalog:
            catalog[key] = name
    if catalog:
        return catalog
    for row in snapshot.get("player_evolution", []):
        name = row.get("name")
        if not name:
            continue
        key = normalize_text(name)
        if key and key not in catalog:
            catalog[key] = name
    return catalog


def resolve_exact_player_name(raw_search: str, snapshot: dict[str, Any]) -> str | None:
    normalized = normalize_text(raw_search)
    if not normalized:
        return None
    return get_player_module_search_catalog(snapshot).get(normalized)


def _safe_number(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(numeric):
        return 0.0
    return numeric


def _name_sort_key(row: dict[str, Any]) -> str:
    return normalize_text(row.get("name", ""))


def sort_evolution_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        clone_rows(rows),
        key=lambda row: (
            -(_safe_number(row.get("performance_2025")) - _safe_number(row.get("performance_2024"))),
            -_safe_number(row.get("improvement_pct")),
            -_safe_number(row.get("performance_2025")),
            _name_sort_key(row),
        ),
    )


def sort_single_year_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for row in clone_rows(rows):
        performance = get_single_year_performance(row)
        if performance is None:
            continue
        row["single_year"] = infer_single_year_from_row(row)
        row["single_year_performance"] = performance
        row["single_year_team"] = get_single_year_team(row)
        enriched.append(row)
    return sorted(
        enriched,
        key=lambda row: (-_safe_number(row.get("single_year_performance")), _name_sort_key(row)),
    )


def build_player_module_evolution_rows(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for row in sort_evolution_rows(rows)[:limit]:
        item = dict(row)
        item["display_name"] = to_proper_case(row.get("name"))
        result.append(item)
    return result


def build_player_module_single_year_rows(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, row in enumerate(sort_single_year_rows(rows)[:limit], start=1):
        item = dict(row)
        item["display_name"] = to_proper_case(row.get("name"))
        item["performance_value"] = row.get("single_year_performance")
        item["display_team"] = row.get("single_year_team")
        item["competition_year"] = row.get("single_year") or row.get("competition_year")
        item["rank"] = index
        result.append(item)
    return result


def build_filtered_player_rows(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
) -> list[dict[str, Any]]:
    country = country.strip()
    competition = competition.strip()
    if competition:
        rows = []
        for row in snapshot.get("filter_ready", {}).get("player_evolution_by_competition", []):
            if row.get("competition_name") != competition:
                continue
            if country and row.get("nationality") != country:
                continue
            rows.append(
                {
                    "competition_name": row.get("competition_name"),
                    "competition_year": row.get("competition_year"),
                    "name": row.get("name"),
                    "nationality": row.get("nationality"),
                    "team": row.get("team"),
                    "performance_2024": row.get("performance_2024"),
                    "performance_2025": row.get("performance_2025"),
                    "trend": row.get("trend"),
                    "improvement": row.get("improvement"),
                    "improvement_pct": row.get("improvement_pct"),
                    "decline": row.get("decline"),
                }
            )
        return rows
    rows = clone_rows(snapshot.get("player_evolution", []))
    if country:
        rows = [row for row in rows if row.get("nationality") == country]
    return rows


def get_player_module_table_title(view: dict[str, Any]) -> str:
    if view.get("mode") == "single-year":
        return PLAYER_MODULE_COPY["table_title_single_year"]
    return PLAYER_MODULE_COPY["table_title_evolution"]


def build_player_module_tooltip_lines(view: dict[str, Any], row: dict[str, Any] | None) -> list[str]:
    if not view or not row:
        return []
    if view.get("mode") == "evolution":
        lines = [f"Pais: {row.get('nationality') or 'N/A'}"]
        team_2024 = row.get("team_2024")
        team_2025 = row.get("team_2025")
        if team_2024 and team_2025 and normalize_text(team_2024) != normalize_text(team_2025):
            lines.append(f"Equipo 2024: {team_2024}")
            lines.append(f"Equipo 2025: {team_2025}")
        else:
            team = team_2025 or team_2024
            if team:
                lines.append(f"Equipo: {team}")
        lines.append(f"Rendimiento 2024: {format_percent_value(row.get('performance_2024'))}")
        lines.append(f"Rendimiento 2025: {format_percent_value(row.get('performance_2025'))}")
        lines.append(f"Mejora %: {format_signed_percent_value(row.get('improvement_pct'))}")
        return lines

    lines = [
        f"Pais: {row.get('nationality') or 'N/A'}",
        f"Equipo: {row.get('display_team') or row.get('team') or 'N/A'}",
    ]
    if row.get("competition_name"):
        lines.append(f"Competencia: {row['competition_name']}")
    if row.get("competition_year"):
        lines.append(f"Anio: {row['competition_year']}")
    lines.append(f"Rendimiento: {format_percent_value(row.get('performance_value'))}")
    if row.get("rank"):
        lines.append(f"Posicion del ranking: #{row['rank']}")
    return lines


def build_player_chart_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
    search: str = "",
) -> dict[str, Any]:
    country = country.strip()
    competition = competition.strip()
    search = search.strip()
    base_rows = build_filtered_player_rows(snapshot, country=country, competition=competition)
    exact_player_name = resolve_exact_player_name(search, snapshot)
    context_exact_rows = (
        [row for row in base_rows if normalize_text(row.get("name")) == normalize_text(exact_player_name)]
        if exact_player_name
        else []
    )

    if exact_player_name and not context_exact_rows:
        return {
            "filters": {"country": country or None, "competition": competition or None, "search": exact_player_name},
            "mode": "empty",
            "title": f"Rendimiento de {to_proper_case(exact_player_name)}",
            "table_title": get_player_module_table_title({"mode": "empty"}),
            "empty_state": {"message": PLAYER_MODULE_COPY["empty_no_player_data"], "hint": ""},
            "rows": [],
            "selected_player": exact_player_name,
        }

    if exact_player_name and context_exact_rows:
        selected_row = context_exact_rows[0]
        if not competition and has_comparable_player_years(selected_row):
            rows = build_player_module_evolution_rows([selected_row], 1)
            view = {
                "filters": {"country": country or None, "competition": None, "search": exact_player_name},
                "mode": "evolution",
                "title": f"Evolucion de {to_proper_case(exact_player_name)}: 2024 -> 2025",
                "empty_state": None,
                "rows": rows,
                "selected_player": exact_player_name,
            }
            view["table_title"] = get_player_module_table_title(view)
            return view

        rows = build_player_module_single_year_rows([selected_row], 1)
        title = (
            f"Rendimiento de {to_proper_case(exact_player_name)} en {competition}"
            if competition
            else f"Rendimiento disponible de {to_proper_case(exact_player_name)}"
        )
        view = {
            "filters": {"country": country or None, "competition": competition or None, "search": exact_player_name},
            "mode": "single-year" if rows else "empty",
            "title": title if rows else f"Rendimiento de {to_proper_case(exact_player_name)}",
            "empty_state": None if rows else {"message": PLAYER_MODULE_COPY["empty_no_player_data"], "hint": ""},
            "rows": rows,
            "selected_player": exact_player_name,
        }
        view["table_title"] = get_player_module_table_title(view)
        return view

    if competition:
        rows = build_player_module_single_year_rows(base_rows, 5)
        is_single_row_detail = len(rows) == 1
        view = {
            "filters": {"country": country or None, "competition": competition, "search": None},
            "mode": "single-year" if rows else "empty",
            "title": (
                f"Rendimiento de {rows[0]['display_name']} en {competition}"
                if is_single_row_detail
                else (
                    f"Top jugadores de {country} en {competition}"
                    if country
                    else f"Top 5 jugadores por rendimiento en {competition}"
                )
            ) if rows else (
                f"Top jugadores de {country} en {competition}"
                if country
                else f"Top 5 jugadores por rendimiento en {competition}"
            ),
            "empty_state": None if rows else {"message": PLAYER_MODULE_COPY["empty_no_single_year_data"], "hint": ""},
            "rows": rows,
            "selected_player": None,
        }
        view["table_title"] = get_player_module_table_title(view)
        return view

    comparable_rows = [row for row in base_rows if has_comparable_player_years(row)]
    positive_rows = [row for row in comparable_rows if has_positive_improvement(row)]
    if not comparable_rows:
        view = {
            "filters": {"country": country or None, "competition": None, "search": None},
            "mode": "empty",
            "title": (
                f"Top jugadores de {country} con mayor mejora 2024 -> 2025"
                if country
                else "Top 5 jugadores con mayor mejora 2024 -> 2025"
            ),
            "empty_state": {
                "message": PLAYER_MODULE_COPY["empty_comparable"],
                "hint": PLAYER_MODULE_COPY["empty_comparable_hint"] if country else "",
            },
            "rows": [],
            "selected_player": None,
        }
        view["table_title"] = get_player_module_table_title(view)
        return view

    if not positive_rows:
        view = {
            "filters": {"country": country or None, "competition": None, "search": None},
            "mode": "empty",
            "title": (
                f"Top jugadores de {country} con mayor mejora 2024 -> 2025"
                if country
                else "Top 5 jugadores con mayor mejora 2024 -> 2025"
            ),
            "empty_state": {
                "message": PLAYER_MODULE_COPY["empty_positive_only"],
                "hint": PLAYER_MODULE_COPY["empty_comparable_hint"] if country else "",
            },
            "rows": [],
            "selected_player": None,
        }
        view["table_title"] = get_player_module_table_title(view)
        return view

    rows = build_player_module_evolution_rows(positive_rows, 5)
    view = {
        "filters": {"country": country or None, "competition": None, "search": None},
        "mode": "evolution",
        "title": (
            f"Top jugadores de {country} con mayor mejora 2024 -> 2025"
            if country
            else "Top 5 jugadores con mayor mejora 2024 -> 2025"
        ),
        "empty_state": None,
        "rows": rows,
        "selected_player": None,
    }
    view["table_title"] = get_player_module_table_title(view)
    return view


def format_percent_value(value: Any, digits: int = 1) -> str:
    if value is None:
        return "N/A"
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return "N/A"
    if math.isnan(numeric):
        return "N/A"
    return f"{numeric:.{digits}f}%"


def format_signed_percent_value(value: Any, digits: int = 2) -> str:
    if value is None:
        return "N/A"
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return "N/A"
    if math.isnan(numeric):
        return "N/A"
    sign = "+" if numeric > 0 else ""
    return f"{sign}{numeric:.{digits}f}%"


def _render_rows_table(view: dict[str, Any]) -> str:
    rows = view.get("rows", [])
    if not rows:
        return "_Sin filas para este estado_"
    if view.get("mode") == "evolution":
        lines = [
            "| # | Jugador | Pais | Equipo 2024 | Equipo 2025 | Rendimiento 2024 | Rendimiento 2025 | Mejora % |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for index, row in enumerate(rows, start=1):
            lines.append(
                "| "
                f"{index} | {row.get('display_name') or row.get('name')} | {row.get('nationality') or 'N/A'} | "
                f"{row.get('team_2024') or 'N/A'} | {row.get('team_2025') or 'N/A'} | "
                f"{format_percent_value(row.get('performance_2024'))} | {format_percent_value(row.get('performance_2025'))} | "
                f"{format_signed_percent_value(row.get('improvement_pct'))} |"
            )
        return "\n".join(lines)

    lines = [
        "| Rank | Jugador | Pais | Equipo | Anio | Rendimiento |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        lines.append(
            "| "
            f"{row.get('rank') or '-'} | {row.get('display_name') or row.get('name')} | {row.get('nationality') or 'N/A'} | "
            f"{row.get('display_team') or row.get('team') or 'N/A'} | {row.get('competition_year') or 'N/A'} | "
            f"{format_percent_value(row.get('performance_value'))} |"
        )
    return "\n".join(lines)


def _render_view_block(title: str, view: dict[str, Any]) -> str:
    lines = [f"### {title}", ""]
    lines.append(f"- `mode`: `{view['mode']}`")
    lines.append(f"- `title`: `{view['title']}`")
    lines.append(f"- `table_title`: `{view['table_title']}`")
    filters = view.get("filters", {})
    lines.append(
        f"- `filters`: country={filters.get('country')!r}, competition={filters.get('competition')!r}, search={filters.get('search')!r}"
    )
    if view.get("empty_state"):
        lines.append(f"- `empty_message`: `{view['empty_state']['message']}`")
        if view["empty_state"].get("hint"):
            lines.append(f"- `empty_hint`: `{view['empty_state']['hint']}`")
        lines.append("")
        return "\n".join(lines)

    lines.append("")
    lines.append(_render_rows_table(view))
    tooltip = build_player_module_tooltip_lines(view, view["rows"][0] if view.get("rows") else None)
    if tooltip:
        lines.append("")
        lines.append("Tooltip esperado de la fila #1:")
        for item in tooltip:
            lines.append(f"- `{item}`")
    lines.append("")
    return "\n".join(lines)


def _all_countries(snapshot: dict[str, Any]) -> list[str]:
    countries = {
        row.get("country")
        for row in snapshot.get("filter_ready", {}).get("kpis_by_country", [])
        if row.get("country")
    }
    return sorted(countries, key=normalize_text)


def _all_competitions(snapshot: dict[str, Any]) -> list[str]:
    competitions = {
        row.get("competition_name")
        for row in snapshot.get("filter_ready", {}).get("kpis_by_competition", [])
        if row.get("competition_name")
    }
    return sorted(competitions, key=normalize_text)


def _pick_example_players(snapshot: dict[str, Any]) -> dict[str, str]:
    global_view = build_player_chart_view(snapshot)
    comparable_name = global_view["rows"][0]["name"] if global_view.get("rows") else ""

    one_year_candidates = [
        row.get("name")
        for row in snapshot.get("player_evolution", [])
        if not has_comparable_player_years(row) and get_single_year_performance(row) is not None
    ]
    one_year_candidates = sorted({name for name in one_year_candidates if name}, key=normalize_text)
    one_year_name = one_year_candidates[0] if one_year_candidates else comparable_name

    competition_examples = sorted(
        snapshot.get("filter_ready", {}).get("player_evolution_by_competition", []),
        key=lambda row: (
            normalize_text(row.get("competition_name", "")),
            -_safe_number(get_single_year_performance(row)),
            normalize_text(row.get("name", "")),
        ),
    )
    competition_row = competition_examples[0] if competition_examples else {}
    return {
        "comparable_player": comparable_name,
        "single_year_player": one_year_name,
        "competition_player": competition_row.get("name", comparable_name),
        "competition_name": competition_row.get("competition_name", ""),
    }


def generate_validation_markdown(snapshot: dict[str, Any]) -> str:
    countries = _all_countries(snapshot)
    competitions = _all_competitions(snapshot)
    examples = _pick_example_players(snapshot)

    sections = [
        "# Validacion Player Chart vs Front",
        "",
        "Documento generado desde `datos-dashboard.json` usando la misma logica semantica del modulo de jugadores.",
        "",
        _render_view_block("Estado global", build_player_chart_view(snapshot)),
        "## Estados por pais",
        "",
    ]

    no_positive_countries = []
    for country in countries:
        view = build_player_chart_view(snapshot, country=country)
        sections.append(_render_view_block(f"Pais: {country}", view))
        if view["mode"] == "empty":
            no_positive_countries.append(country)

    if no_positive_countries:
        sections.append("Paises sin mejoras positivas 2024-2025 en el snapshot actual:")
        for country in no_positive_countries:
            sections.append(f"- {country}")
        sections.append("")
    else:
        sections.append("No hay paises sin mejoras positivas 2024-2025 en el snapshot actual.")
        sections.append("")

    sections.append("## Estados por competencia")
    sections.append("")
    for competition in competitions:
        sections.append(_render_view_block(f"Competencia: {competition}", build_player_chart_view(snapshot, competition=competition)))

    sections.append("## Estados pais + competencia con datos")
    sections.append("")
    data_combos = sorted(
        {
            (row.get("nationality"), row.get("competition_name"))
            for row in snapshot.get("filter_ready", {}).get("player_evolution_by_competition", [])
            if row.get("nationality") and row.get("competition_name")
        },
        key=lambda item: (normalize_text(item[0]), normalize_text(item[1])),
    )
    for country, competition in data_combos:
        sections.append(_render_view_block(f"{country} + {competition}", build_player_chart_view(snapshot, country=country, competition=competition)))

    sections.append("## Combinaciones vacias documentadas")
    sections.append("")
    empty_combos: list[tuple[str, str]] = []
    data_combo_set = set(data_combos)
    for country in countries:
        for competition in competitions:
            if (country, competition) in data_combo_set:
                continue
            empty_combos.append((country, competition))
    for country, competition in empty_combos[:2]:
        sections.append(_render_view_block(f"{country} + {competition}", build_player_chart_view(snapshot, country=country, competition=competition)))

    sections.append("## Casos de jugador exacto")
    sections.append("")
    sections.append(
        _render_view_block(
            f"Jugador comparable: {examples['comparable_player']}",
            build_player_chart_view(snapshot, search=examples["comparable_player"]),
        )
    )
    sections.append(
        _render_view_block(
            f"Jugador single-year: {examples['single_year_player']}",
            build_player_chart_view(snapshot, search=examples["single_year_player"]),
        )
    )
    if examples["competition_name"] and examples["competition_player"]:
        sections.append(
            _render_view_block(
                f"Jugador + competencia: {examples['competition_player']} en {examples['competition_name']}",
                build_player_chart_view(
                    snapshot,
                    competition=examples["competition_name"],
                    search=examples["competition_player"],
                ),
            )
        )

    return "\n".join(sections).strip() + "\n"


def write_validation_doc(snapshot: dict[str, Any], output_path: Path = DEFAULT_DOC_PATH) -> Path:
    output_path.write_text(generate_validation_markdown(snapshot), encoding="utf-8")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera valores esperados del modulo de jugadores.")
    parser.add_argument("--country", default="", help="Pais a validar")
    parser.add_argument("--competition", default="", help="Competencia a validar")
    parser.add_argument("--search", default="", help="Jugador exacto a validar")
    parser.add_argument("--write-doc", action="store_true", help="Escribe docs/validacion_player_chart_vs_front.md")
    args = parser.parse_args()

    snapshot = load_dashboard_snapshot()
    if args.write_doc:
        path = write_validation_doc(snapshot)
        print(f"Documento generado en: {path}")
        return

    view = build_player_chart_view(
        snapshot,
        country=args.country,
        competition=args.competition,
        search=args.search,
    )
    print(json.dumps(view, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
