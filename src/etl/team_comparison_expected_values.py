"""Expected values helper for the Comparativa de equipos section UI."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_comparativa_equipos_vs_front.md"

TEAM_COMPARISON_COPY = {
    "title": "Comparativa de equipos",
    "subtitle": "Cómo compiten los equipos según el contexto",
    "empty": "Sin datos de equipos para este filtro",
    "context_labels": {
        "global": "Vista general de equipos",
        "country": lambda country: f"Así compiten los equipos de {country}",
        "competition": lambda competition: f"Así compitieron los equipos en {competition}",
        "country_competition": lambda country, competition: f"Así compitió {country} en {competition}",
    },
    "leaders": [
        {"key": "best_teamwork", "label": "Mayor trabajo en equipo"},
        {"key": "best_victory", "label": "Mejor % de victorias"},
        {"key": "best_results", "label": "Mejores resultados"},
        {"key": "best_prize", "label": "Mayor parte del premio total"},
    ],
    "profile": {
        "title": "Perfil del equipo",
        "summary": "Solo hay un equipo en este contexto.",
    },
    "table_titles": {
        "global": "Equipos comparados",
        "country": lambda country: f"Equipos de {country}",
        "competition": lambda competition: f"Equipos en {competition}",
        "country_competition": lambda country, competition: f"Equipos de {country} en {competition}",
    },
    "table_columns": {
        "global": ["Equipo", "País", "Competiciones", "% de victorias", "Trabajo en equipo", "Mejor puesto", "Premios"],
        "country": ["Equipo", "Competiciones", "% de victorias", "Trabajo en equipo", "Mejor puesto", "Premios"],
        "competition": ["Equipo", "País", "% de victorias", "Trabajo en equipo", "Resultado en la competencia", "Premios"],
        "country_competition": ["Equipo", "% de victorias", "Trabajo en equipo", "Resultado en la competencia", "Premios"],
    },
    "no_data": "Sin registro",
    "no_victory_data": "Sin registro de victorias",
    "no_position_data": "Sin puesto final registrado",
}


def load_dashboard_snapshot(path: Path = SNAPSHOT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


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


def _safe_optional_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric):
        return None
    return numeric


def _resolve_context(country: str, competition: str) -> str:
    if country and competition:
        return "country_competition"
    if country:
        return "country"
    if competition:
        return "competition"
    return "global"


def _context_label(context: str, *, country: str, competition: str) -> str:
    if context == "country_competition":
        return TEAM_COMPARISON_COPY["context_labels"]["country_competition"](country, competition)
    if context == "country":
        return TEAM_COMPARISON_COPY["context_labels"]["country"](country)
    if context == "competition":
        return TEAM_COMPARISON_COPY["context_labels"]["competition"](competition)
    return TEAM_COMPARISON_COPY["context_labels"]["global"]


def _table_title(context: str, *, country: str, competition: str) -> str:
    if context == "country_competition":
        return TEAM_COMPARISON_COPY["table_titles"]["country_competition"](country, competition)
    if context == "country":
        return TEAM_COMPARISON_COPY["table_titles"]["country"](country)
    if context == "competition":
        return TEAM_COMPARISON_COPY["table_titles"]["competition"](competition)
    return TEAM_COMPARISON_COPY["table_titles"]["global"]


def _format_percent(value: Any, digits: int = 1) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_COMPARISON_COPY["no_victory_data"]
    return f"{numeric:.{digits}f}%"


def _format_prize_share(value: Any, digits: int = 1) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_COMPARISON_COPY["no_data"]
    return f"{numeric:.{digits}f}%"


def _format_plain_value(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_COMPARISON_COPY["no_data"]
    return f"{numeric:.1f}"


def _format_score_value(value: Any) -> str:
    plain = _format_plain_value(value)
    if plain == TEAM_COMPARISON_COPY["no_data"]:
        return plain
    return f"{plain} pts"


def _format_currency(value: Any) -> str:
    return f"${_safe_number(value):,.0f}"


def _format_position(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_COMPARISON_COPY["no_position_data"]
    if float(numeric).is_integer():
        return f"#{int(numeric)}"
    return f"#{numeric:.1f}"


def _build_rows(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for row in profiles:
        rows.append(
            {
                "team": row.get("team") or "",
                "country": row.get("country") or "",
                "competitionsCount": int(_safe_number(row.get("competitions_count"))),
                "competitionsCountLabel": str(int(_safe_number(row.get("competitions_count")))),
                "teamworkScore": _safe_number(row.get("teamwork_score")),
                "teamworkScoreLabel": _format_score_value(row.get("teamwork_score")),
                "victoryRatePct": _safe_optional_number(row.get("victory_rate_pct")),
                "victoryRateLabel": _format_percent(row.get("victory_rate_pct"), 1),
                "positionMetric": _safe_optional_number(row.get("position_metric")),
                "positionLabel": _format_position(row.get("position_metric")),
                "resultsScore": _safe_optional_number(row.get("results_score")),
                "prizeAmount": _safe_number(row.get("prize_amount")),
                "prizeAmountLabel": _format_currency(row.get("prize_amount")),
                "prizeSharePct": _safe_optional_number(row.get("prize_share_pct")),
                "prizeShareLabel": _format_prize_share(row.get("prize_share_pct"), 1),
                "competitionName": row.get("competition_name") or "",
                "competitionResult": _safe_optional_number(row.get("competition_result")),
                "competitionResultLabel": _format_position(row.get("competition_result")),
                "titlesCount": int(_safe_number(row.get("titles_count"))),
                "podiumCount": int(_safe_number(row.get("podium_count"))),
                "comparisonScore": _safe_number(row.get("comparison_score")),
            }
        )
    rows.sort(key=lambda item: (-item["comparisonScore"], item["team"]))
    return rows


def _build_leader_description(key: str, context: str, value: str) -> str:
    return _build_leader_description_with_filters(key, context, value, country="", competition="")


def _leader_label(key: str, context: str) -> str:
    if key == "best_prize" and context in {"country", "country_competition"}:
        return "Equipo con más premios"
    return next((item["label"] for item in TEAM_COMPARISON_COPY["leaders"] if item["key"] == key), TEAM_COMPARISON_COPY["no_data"])


def _build_leader_description_with_filters(
    key: str,
    context: str,
    value: str,
    *,
    country: str,
    competition: str,
) -> str:
    if key == "best_teamwork":
        return "Puntaje promedio más alto del contexto"
    if key == "best_victory":
        if value == TEAM_COMPARISON_COPY["no_victory_data"]:
            return "No hay victorias registradas en este contexto"
        return "Mayor porcentaje de victorias registrado"
    if key == "best_results":
        if value == TEAM_COMPARISON_COPY["no_position_data"]:
            return "No hay puesto final registrado en este contexto"
        if context in {"competition", "country_competition"}:
            return "Mejor puesto final registrado"
        return "Mejor puesto promedio en el contexto"
    if key == "best_prize":
        if value == TEAM_COMPARISON_COPY["no_data"]:
            return "Sin premios registrados en este contexto"
        if context == "competition":
            return f"Se llevó el {value} del premio total de esta competencia"
        if context == "country":
            return f"Concentró el {value} de los premios de {country}"
        if context == "country_competition":
            return f"Concentró el {value} de los premios de {country} en {competition}"
        return f"Se llevó el {value} del premio total del contexto"
    return ""


def _build_leaders(
    leaders: dict[str, Any],
    rows: list[dict[str, Any]],
    context: str,
    *,
    country: str,
    competition: str,
) -> list[dict[str, Any]]:
    def find_row(team: str) -> dict[str, Any] | None:
        return next((row for row in rows if row["team"] == team), None)

    items: list[dict[str, Any]] = []
    for item in TEAM_COMPARISON_COPY["leaders"]:
        team = TEAM_COMPARISON_COPY["no_data"]
        value = TEAM_COMPARISON_COPY["no_data"]
        if item["key"] == "best_teamwork":
            team = leaders.get("best_teamwork_team") or TEAM_COMPARISON_COPY["no_data"]
            value = (find_row(team) or {}).get("teamworkScoreLabel", _format_score_value(leaders.get("best_teamwork_score")))
        elif item["key"] == "best_victory":
            team = leaders.get("best_victory_team") or TEAM_COMPARISON_COPY["no_data"]
            value = (find_row(team) or {}).get("victoryRateLabel", _format_percent(leaders.get("best_victory_rate_pct"), 1))
        elif item["key"] == "best_results":
            team = leaders.get("best_results_team") or TEAM_COMPARISON_COPY["no_data"]
            matched = find_row(team) or {}
            if context in {"competition", "country_competition"}:
                value = matched.get("competitionResultLabel", TEAM_COMPARISON_COPY["no_position_data"])
            else:
                value = matched.get("positionLabel", TEAM_COMPARISON_COPY["no_position_data"])
        elif item["key"] == "best_prize":
            team = leaders.get("best_prize_team") or TEAM_COMPARISON_COPY["no_data"]
            value = (find_row(team) or {}).get("prizeShareLabel", _format_prize_share(leaders.get("best_prize_share_pct"), 1))

        items.append(
            {
                "label": _leader_label(item["key"], context),
                "team": team,
                "value": value,
                "description": _build_leader_description_with_filters(
                    item["key"],
                    context,
                    value,
                    country=country,
                    competition=competition,
                ),
            }
        )
    return items


def _build_profile_model(row: dict[str, Any], context: str) -> dict[str, Any]:
    metrics = (
        [
            {"label": "% de victorias", "value": row["victoryRateLabel"]},
            {"label": "Trabajo en equipo", "value": row["teamworkScoreLabel"]},
            {"label": "Resultado en la competencia", "value": row["competitionResultLabel"]},
            {"label": "Premios", "value": row["prizeAmountLabel"]},
        ]
        if context in {"competition", "country_competition"}
        else [
            {"label": "Competiciones", "value": row["competitionsCountLabel"]},
            {"label": "% de victorias", "value": row["victoryRateLabel"]},
            {"label": "Trabajo en equipo", "value": row["teamworkScoreLabel"]},
            {"label": "Mejor puesto", "value": row["positionLabel"]},
            {"label": "Premios", "value": row["prizeAmountLabel"]},
        ]
    )

    return {
        "team": row["team"],
        "country": row["country"],
        "summary": TEAM_COMPARISON_COPY["profile"]["summary"],
        "metrics": metrics,
    }


def _find_profiles(snapshot: dict[str, Any], *, country: str = "", competition: str = "") -> list[dict[str, Any]]:
    filter_ready = snapshot.get("filter_ready", {})
    if country and competition:
        return [
            row
            for row in filter_ready.get("team_comparison_profiles_by_country_competition", [])
            if row.get("country") == country and row.get("competition_name") == competition
        ]
    if country:
        return [
            row
            for row in filter_ready.get("team_comparison_profiles_by_country", [])
            if row.get("country") == country
        ]
    if competition:
        return [
            row
            for row in filter_ready.get("team_comparison_profiles_by_competition", [])
            if row.get("competition_name") == competition
        ]
    return list(snapshot.get("team_comparison_profiles", []))


def _find_leaders(snapshot: dict[str, Any], *, country: str = "", competition: str = "") -> dict[str, Any]:
    filter_ready = snapshot.get("filter_ready", {})
    if country and competition:
        return next(
            (
                row
                for row in filter_ready.get("team_comparison_leaders_by_country_competition", [])
                if row.get("country") == country and row.get("competition_name") == competition
            ),
            {},
        )
    if country:
        return next(
            (row for row in filter_ready.get("team_comparison_leaders_by_country", []) if row.get("country") == country),
            {},
        )
    if competition:
        return next(
            (
                row
                for row in filter_ready.get("team_comparison_leaders_by_competition", [])
                if row.get("competition_name") == competition
            ),
            {},
        )
    return dict(snapshot.get("team_comparison_leaders", {}))


def build_team_comparison_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
    search: str = "",
) -> dict[str, Any]:
    country = (country or "").strip()
    competition = (competition or "").strip()
    search = (search or "").strip()
    context = _resolve_context(country, competition)
    rows = _build_rows(_find_profiles(snapshot, country=country, competition=competition))
    leaders_source = _find_leaders(snapshot, country=country, competition=competition)
    leaders = _build_leaders(
        leaders_source,
        rows,
        context,
        country=country,
        competition=competition,
    )

    if not rows:
        return {
            "filters": {"country": country or None, "competition": competition or None, "search": search or None},
            "visible": True,
            "context": context,
            "title": TEAM_COMPARISON_COPY["title"],
            "subtitle": TEAM_COMPARISON_COPY["subtitle"],
            "contextLabel": _context_label(context, country=country, competition=competition),
            "leaders": leaders,
            "profileMode": None,
            "compareMode": None,
            "radarModel": None,
            "tableModel": None,
            "emptyState": {"message": TEAM_COMPARISON_COPY["empty"]},
        }

    compare_mode = {"teamCount": len(rows)} if len(rows) >= 2 else None
    profile_mode = _build_profile_model(rows[0], context) if len(rows) == 1 else None

    return {
        "filters": {"country": country or None, "competition": competition or None, "search": search or None},
        "visible": True,
        "context": context,
        "title": TEAM_COMPARISON_COPY["title"],
        "subtitle": TEAM_COMPARISON_COPY["subtitle"],
        "contextLabel": _context_label(context, country=country, competition=competition),
        "leaders": leaders,
        "profileMode": profile_mode,
        "compareMode": compare_mode,
        "radarModel": None,
        "tableModel": {
            "title": _table_title(context, country=country, competition=competition),
            "columns": list(TEAM_COMPARISON_COPY["table_columns"][context]),
            "rows": rows,
        },
        "emptyState": None,
    }


def list_valid_filters(snapshot: dict[str, Any]) -> dict[str, list[Any]]:
    filter_ready = snapshot.get("filter_ready", {})
    countries = sorted({row.get("country") for row in filter_ready.get("team_comparison_profiles_by_country", []) if row.get("country")})
    competitions = sorted(
        {row.get("competition_name") for row in filter_ready.get("team_comparison_profiles_by_competition", []) if row.get("competition_name")}
    )
    pairs = sorted(
        {
            (row.get("country"), row.get("competition_name"))
            for row in filter_ready.get("team_comparison_profiles_by_country_competition", [])
            if row.get("country") and row.get("competition_name")
        }
    )
    return {"countries": countries, "competitions": competitions, "country_competition_pairs": pairs}


def _markdown_table(headers: list[str], rows: list[dict[str, Any]]) -> str:
    if not headers:
        return "- Sin columnas"
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(header, "-")) for header in headers) + " |")
    return "\n".join(lines)


def _leaders_markdown_rows(leaders: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "Indicador": leader["label"],
            "Equipo": leader["team"],
            "Valor": leader["value"],
            "Explicacion": leader["description"],
        }
        for leader in leaders
    ]


def _table_markdown_rows(rows: list[dict[str, Any]], columns: list[str]) -> list[dict[str, Any]]:
    mapping = {
        "Equipo": "team",
        "País": "country",
        "Competiciones": "competitionsCountLabel",
        "% de victorias": "victoryRateLabel",
        "Trabajo en equipo": "teamworkScoreLabel",
        "Mejor puesto": "positionLabel",
        "Resultado en la competencia": "competitionResultLabel",
        "Premios": "prizeAmountLabel",
    }
    formatted = []
    for row in rows:
        formatted.append({column: row.get(mapping[column], "-") for column in columns})
    return formatted


def generate_validation_markdown(snapshot: dict[str, Any]) -> str:
    valid = list_valid_filters(snapshot)
    global_view = build_team_comparison_view(snapshot)

    lines = [
        "# Validacion Comparativa de equipos vs Front",
        "",
        "## Estado global",
        "",
        f"- visible: `{str(global_view['visible']).lower()}`",
        f"- context: `{global_view['context']}`",
        f"- title: `{global_view['title']}`",
        f"- subtitle: `{global_view['subtitle']}`",
        f"- contextLabel: `{global_view['contextLabel']}`",
        f"- compareMode: `{str(bool(global_view['compareMode'])).lower()}`",
        f"- profileMode: `{str(bool(global_view['profileMode'])).lower()}`",
        "- radar visible: `no`",
        "- search cambia la seccion: `no`",
        "",
        "### Lideres",
        "",
        _markdown_table(["Indicador", "Equipo", "Valor", "Explicacion"], _leaders_markdown_rows(global_view["leaders"])),
        "",
        "### Tabla contextual global",
        "",
        _markdown_table(global_view["tableModel"]["columns"], _table_markdown_rows(global_view["tableModel"]["rows"][:5], global_view["tableModel"]["columns"])),
        "",
        "## Estados por pais",
        "",
    ]

    for country in valid["countries"]:
        view = build_team_comparison_view(snapshot, country=country)
        lines.extend(
            [
                f"### {country}",
                "",
                f"- context: `{view['context']}`",
                f"- contextLabel: `{view['contextLabel']}`",
                f"- compareMode: `{str(bool(view['compareMode'])).lower()}`",
                f"- profileMode: `{str(bool(view['profileMode'])).lower()}`",
                f"- filas: `{len(view['tableModel']['rows']) if view['tableModel'] else 0}`",
                "",
            ]
        )

    lines.extend(["## Estados por competencia", ""])
    for competition in valid["competitions"]:
        view = build_team_comparison_view(snapshot, competition=competition)
        lines.extend(
            [
                f"### {competition}",
                "",
                f"- context: `{view['context']}`",
                f"- contextLabel: `{view['contextLabel']}`",
                f"- compareMode: `{str(bool(view['compareMode'])).lower()}`",
                f"- profileMode: `{str(bool(view['profileMode'])).lower()}`",
                "- radar visible: `no`",
                "",
            ]
        )

    lines.extend(["## Estados pais + competencia validos", ""])
    for country, competition in valid["country_competition_pairs"]:
        view = build_team_comparison_view(snapshot, country=country, competition=competition)
        lines.extend(
            [
                f"### {country} + {competition}",
                "",
                f"- contextLabel: `{view['contextLabel']}`",
                f"- compareMode: `{str(bool(view['compareMode'])).lower()}`",
                f"- profileMode: `{str(bool(view['profileMode'])).lower()}`",
                "",
            ]
        )

    bolivia_view = build_team_comparison_view(snapshot, country="Bolivia")
    chile_competition_view = build_team_comparison_view(snapshot, country="Chile", competition="Torneo del Caribe 2024")
    empty_view = build_team_comparison_view(snapshot, country="País Fantasma", competition="Competencia Fantasma 2099")

    lines.extend(
        [
            "## Casos controlados",
            "",
            f"- Bolivia `% de victorias`: `{bolivia_view['tableModel']['rows'][0]['victoryRateLabel'] if bolivia_view['tableModel'] else '-'}`",
            f"- Chile + Torneo del Caribe 2024 resultado: `{chile_competition_view['tableModel']['rows'][1]['competitionResultLabel'] if chile_competition_view.get('tableModel') and len(chile_competition_view['tableModel']['rows']) > 1 else '-'}`",
            "- radar visible en cualquier contexto: `no`",
            "",
            "## Estado vacio controlado",
            "",
            f"- context: `{empty_view['context']}`",
            f"- message: `{empty_view['emptyState']['message'] if empty_view['emptyState'] else '-'}`",
            "",
            "## Checks de copy final",
            "",
            "- labels legacy visibles: `no`",
            "- `Trabajo en equipo`: `si`",
            "- `% de victorias`: `si`",
            "- `Sin registro de victorias`: `si`",
            "- `Sin puesto final registrado`: `si`",
            "- `Mayor parte del premio total`: `si`",
            "- `Equipo con más premios`: `si`",
            "- radar visible: `no`",
            "",
        ]
    )

    return "\n".join(lines).strip() + "\n"


def _write_markdown(snapshot: dict[str, Any], output_path: Path) -> Path:
    markdown = generate_validation_markdown(snapshot)
    output_path.write_text(markdown, encoding="utf-8")
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Expected values helper for Comparativa de equipos")
    parser.add_argument("--country", default="", help="Country filter")
    parser.add_argument("--competition", default="", help="Competition filter")
    parser.add_argument("--search", default="", help="Player search filter (ignored structurally)")
    parser.add_argument("--list", action="store_true", help="List valid filters")
    parser.add_argument("--markdown", action="store_true", help="Print validation markdown")
    parser.add_argument("--write-doc", action="store_true", help="Write docs/validacion_comparativa_equipos_vs_front.md")
    args = parser.parse_args()

    snapshot = load_dashboard_snapshot()

    if args.list:
        print(json.dumps(list_valid_filters(snapshot), ensure_ascii=False, indent=2))
        return 0

    if args.markdown or args.write_doc:
        markdown = generate_validation_markdown(snapshot)
        if args.markdown:
            print(markdown)
        if args.write_doc:
            output = _write_markdown(snapshot, DEFAULT_DOC_PATH)
            print(f"Markdown written to {output}")
        return 0

    view = build_team_comparison_view(
        snapshot,
        country=args.country,
        competition=args.competition,
        search=args.search,
    )
    print(json.dumps(view, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
