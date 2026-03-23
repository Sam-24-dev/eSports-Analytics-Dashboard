"""Expected values helper for the Plantilla / Uso de Plantilla section UI."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_plantilla_vs_front.md"

SQUAD_USAGE_COPY = {
    "title": "Uso de Plantilla",
    "subtitle": "Cómo se reparten titulares y suplentes según el contexto",
    "context_labels": {
        "global": "Vista general de titulares y suplentes",
        "country": lambda country: f"Así se reparte la plantilla de {country}",
        "competition": lambda competition: f"Así se repartió la plantilla en {competition}",
        "country_competition": lambda country, competition: f"Así repartió {country} su plantilla en {competition}",
    },
    "summary": [
        {"key": "starter_share_pct", "label": "Participación titular", "valueType": "percent", "tone": "primary"},
        {"key": "substitute_share_pct", "label": "Participación suplente", "valueType": "percent", "tone": "secondary"},
        {"key": "starter_unique_players", "label": "Titulares únicos", "valueType": "number", "tone": "primary"},
        {"key": "substitute_unique_players", "label": "Suplentes únicos", "valueType": "number", "tone": "secondary"},
    ],
    "insight": {
        "none": "Sin uso de suplentes",
        "low": "Predominio titular",
        "medium": "Rotación moderada",
        "high": "Rotación alta",
        "no_substitutes_body": "Todos los registros de plantilla fueron titulares.",
        "missing_comparison": "No hay datos de rendimiento del año para comparar roles.",
    },
    "chart_title": "Reparto titular vs suplente",
    "role_labels": {"starter": "Titular", "substitute": "Suplente"},
    "table_titles": {
        "global": "Equipos comparados",
        "country": lambda country: f"Equipos de {country}",
        "competition": lambda competition: f"Equipos en {competition}",
        "country_competition": lambda country, competition: f"Equipos de {country} en {competition}",
    },
    "table_columns": {
        "with_country": ["Equipo", "País", "Titulares", "Suplentes", "% suplentes", "Diferencia de rendimiento"],
        "without_country": ["Equipo", "Titulares", "Suplentes", "% suplentes", "Diferencia de rendimiento"],
    },
    "empty": "Sin datos de plantilla para este filtro",
    "performance_no_data": "Sin dato",
    "no_data": "Sin comparación",
    "single_competition_note": "Este país solo tiene registros en una competencia",
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
        return SQUAD_USAGE_COPY["context_labels"]["country_competition"](country, competition)
    if context == "country":
        return SQUAD_USAGE_COPY["context_labels"]["country"](country)
    if context == "competition":
        return SQUAD_USAGE_COPY["context_labels"]["competition"](competition)
    return SQUAD_USAGE_COPY["context_labels"]["global"]


def _table_title(context: str, *, country: str, competition: str) -> str:
    if context == "country_competition":
        return SQUAD_USAGE_COPY["table_titles"]["country_competition"](country, competition)
    if context == "country":
        return SQUAD_USAGE_COPY["table_titles"]["country"](country)
    if context == "competition":
        return SQUAD_USAGE_COPY["table_titles"]["competition"](competition)
    return SQUAD_USAGE_COPY["table_titles"]["global"]


def _format_percent(value: Any, digits: int = 1) -> str:
    return f"{_safe_number(value):.{digits}f}%"


def _format_number(value: Any) -> str:
    numeric = _safe_number(value)
    return str(int(numeric)) if float(numeric).is_integer() else str(numeric)


def _format_gap(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return SQUAD_USAGE_COPY["no_data"]
    prefix = "+" if numeric > 0 else ""
    return f"{prefix}{numeric:.1f} pts"


def _gap_tone(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return "not-comparable"
    if numeric > 0:
        return "positive"
    if numeric < 0:
        return "negative"
    return "neutral"


def _build_insight(summary: dict[str, Any] | None) -> dict[str, str]:
    substitute_share = _safe_number(summary.get("substitute_share_pct") if summary else None)
    substitute_participations = int(_safe_number(summary.get("substitute_participations") if summary else None))
    total_participations = int(_safe_number(summary.get("starter_participations") if summary else None)) + substitute_participations

    if substitute_share == 0:
        title = SQUAD_USAGE_COPY["insight"]["none"]
    elif substitute_share < 10:
        title = SQUAD_USAGE_COPY["insight"]["low"]
    elif substitute_share < 25:
        title = SQUAD_USAGE_COPY["insight"]["medium"]
    else:
        title = SQUAD_USAGE_COPY["insight"]["high"]

    starter_avg = _safe_optional_number(summary.get("starter_avg_performance") if summary else None)
    substitute_avg = _safe_optional_number(summary.get("substitute_avg_performance") if summary else None)
    if starter_avg is None or substitute_avg is None:
        if substitute_participations == 0:
            description = SQUAD_USAGE_COPY["insight"]["no_substitutes_body"]
        elif substitute_participations == 1:
            description = (
                f"1 de {total_participations} registros de plantilla fue suplente. "
                f"{SQUAD_USAGE_COPY['insight']['missing_comparison']}"
            )
        else:
            description = (
                f"{substitute_participations} de {total_participations} registros de plantilla fueron suplentes. "
                f"{SQUAD_USAGE_COPY['insight']['missing_comparison']}"
            )
    else:
        prefix = (
            f"1 de {total_participations} registros de plantilla fue suplente."
            if substitute_participations == 1
            else f"{substitute_participations} de {total_participations} registros de plantilla fueron suplentes."
        )
        description = (
            f"{prefix} Rendimiento promedio: titulares {_format_percent(starter_avg, 1)} \u00B7 "
            f"suplentes {_format_percent(substitute_avg, 1)}."
        )

    return {
        "title": title,
        "description": description,
    }


def _build_chart_model(summary: dict[str, Any] | None) -> dict[str, Any]:
    starter_share = _safe_number(summary.get("starter_share_pct") if summary else None)
    substitute_share = _safe_number(summary.get("substitute_share_pct") if summary else None)
    return {
        "title": SQUAD_USAGE_COPY["chart_title"],
        "ariaLabel": f"{SQUAD_USAGE_COPY['role_labels']['starter']} {_format_percent(starter_share, 1)}; {SQUAD_USAGE_COPY['role_labels']['substitute']} {_format_percent(substitute_share, 1)}",
        "segments": [
            {
                "key": "starter",
                "label": SQUAD_USAGE_COPY["role_labels"]["starter"],
                "value": starter_share,
                "valueLabel": _format_percent(starter_share, 1),
                "participations": int(_safe_number(summary.get("starter_participations") if summary else None)),
                "uniquePlayers": int(_safe_number(summary.get("starter_unique_players") if summary else None)),
                "averagePerformance": _safe_optional_number(summary.get("starter_avg_performance") if summary else None),
                "tone": "primary",
            },
            {
                "key": "substitute",
                "label": SQUAD_USAGE_COPY["role_labels"]["substitute"],
                "value": substitute_share,
                "valueLabel": _format_percent(substitute_share, 1),
                "participations": int(_safe_number(summary.get("substitute_participations") if summary else None)),
                "uniquePlayers": int(_safe_number(summary.get("substitute_unique_players") if summary else None)),
                "averagePerformance": _safe_optional_number(summary.get("substitute_avg_performance") if summary else None),
                "tone": "secondary",
            },
        ],
    }


def _build_summary_items(summary: dict[str, Any] | None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for item in SQUAD_USAGE_COPY["summary"]:
        raw_value = summary.get(item["key"]) if summary else None
        if item["valueType"] == "percent":
            formatted = _format_percent(raw_value, 1)
        else:
            formatted = _format_number(raw_value)
        items.append(
            {
                "label": item["label"],
                "tone": item["tone"],
                "value": formatted,
            }
        )
    return items


def _country_competition_count(snapshot: dict[str, Any], country: str) -> int:
    competitions = {
        row.get("competition_name")
        for row in snapshot.get("filter_ready", {}).get("squad_usage_by_country_competition", [])
        if row.get("country") == country and row.get("competition_name")
    }
    return len(competitions)


def _build_context_meta(
    snapshot: dict[str, Any],
    summary: dict[str, Any] | None,
    breakdown: list[dict[str, Any]],
    *,
    context: str,
    country: str,
) -> dict[str, str]:
    team_count = len(breakdown)
    total_participations = int(_safe_number(summary.get("starter_participations") if summary else None)) + int(
        _safe_number(summary.get("substitute_participations") if summary else None)
    )
    single_competition_note = (
        SQUAD_USAGE_COPY["single_competition_note"]
        if context in {"country", "country_competition"} and country and _country_competition_count(snapshot, country) == 1
        else ""
    )
    return {
        "teamsLabel": f"{team_count} {'equipo analizado' if team_count == 1 else 'equipos analizados'}",
        "recordsLabel": f"{total_participations} registros de plantilla",
        "singleCompetitionNote": single_competition_note,
    }


def _build_table_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for row in rows:
        gap_value = _safe_optional_number(row.get("performance_gap_pct"))
        normalized.append(
            {
                "team": row.get("team") or "",
                "country": row.get("country") or "",
                "starterParticipations": int(_safe_number(row.get("starter_participations"))),
                "substituteParticipations": int(_safe_number(row.get("substitute_participations"))),
                "starterParticipationsLabel": _format_number(row.get("starter_participations")),
                "substituteParticipationsLabel": _format_number(row.get("substitute_participations")),
                "substituteSharePct": _safe_number(row.get("substitute_share_pct")),
                "substituteShareLabel": _format_percent(row.get("substitute_share_pct"), 1),
                "performanceGapValue": gap_value,
                "performanceGapLabel": _format_gap(gap_value),
                "performanceGapTone": _gap_tone(gap_value),
            }
        )

    normalized.sort(
        key=lambda row: (
            -row["substituteSharePct"],
            -row["substituteParticipations"],
            str(row["team"]),
        )
    )
    return normalized


def _has_data(summary: dict[str, Any] | None, breakdown: list[dict[str, Any]]) -> bool:
    starter = int(_safe_number(summary.get("starter_participations") if summary else None))
    substitute = int(_safe_number(summary.get("substitute_participations") if summary else None))
    return bool(summary) and (starter + substitute > 0 or bool(breakdown))


def _find_summary(snapshot: dict[str, Any], *, country: str = "", competition: str = "") -> dict[str, Any] | None:
    if country and competition:
        return next(
            (
                row
                for row in snapshot.get("filter_ready", {}).get("squad_usage_by_country_competition", [])
                if row.get("country") == country and row.get("competition_name") == competition
            ),
            None,
        )
    if country:
        return next(
            (
                row
                for row in snapshot.get("filter_ready", {}).get("squad_usage_by_country", [])
                if row.get("country") == country
            ),
            None,
        )
    if competition:
        return next(
            (
                row
                for row in snapshot.get("filter_ready", {}).get("squad_usage_by_competition", [])
                if row.get("competition_name") == competition
            ),
            None,
        )
    return snapshot.get("squad_usage_summary") or None


def _find_breakdown(snapshot: dict[str, Any], *, country: str = "", competition: str = "") -> list[dict[str, Any]]:
    if country and competition:
        return [
            row
            for row in snapshot.get("filter_ready", {}).get("squad_usage_team_breakdown_by_country_competition", [])
            if row.get("country") == country and row.get("competition_name") == competition
        ]
    if country:
        return [
            row
            for row in snapshot.get("filter_ready", {}).get("squad_usage_team_breakdown_by_country", [])
            if row.get("country") == country
        ]
    if competition:
        return [
            row
            for row in snapshot.get("filter_ready", {}).get("squad_usage_team_breakdown_by_competition", [])
            if row.get("competition_name") == competition
        ]
    return list(snapshot.get("squad_usage_team_breakdown", []))


def build_squad_usage_view(
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
    summary = _find_summary(snapshot, country=country, competition=competition)
    breakdown = _find_breakdown(snapshot, country=country, competition=competition)

    if not _has_data(summary, breakdown):
        return {
            "filters": {
                "country": country or None,
                "competition": competition or None,
                "search": search or None,
            },
            "visible": True,
            "context": context,
            "title": SQUAD_USAGE_COPY["title"],
            "subtitle": SQUAD_USAGE_COPY["subtitle"],
            "contextLabel": _context_label(context, country=country, competition=competition),
            "contextMeta": {"teamsLabel": "0 equipos analizados", "recordsLabel": "0 registros de plantilla", "singleCompetitionNote": ""},
            "summary": [],
            "insight": None,
            "chartModel": None,
            "tableModel": None,
            "emptyState": {"message": SQUAD_USAGE_COPY["empty"]},
        }

    return {
        "filters": {
            "country": country or None,
            "competition": competition or None,
            "search": search or None,
        },
        "visible": True,
        "context": context,
        "title": SQUAD_USAGE_COPY["title"],
        "subtitle": SQUAD_USAGE_COPY["subtitle"],
        "contextLabel": _context_label(context, country=country, competition=competition),
        "contextMeta": _build_context_meta(snapshot, summary, breakdown, context=context, country=country),
        "summary": _build_summary_items(summary),
        "insight": _build_insight(summary),
        "chartModel": _build_chart_model(summary),
        "tableModel": {
            "title": _table_title(context, country=country, competition=competition),
            "columns": list(SQUAD_USAGE_COPY["table_columns"]["without_country" if context in {"country", "country_competition"} else "with_country"]),
            "rows": _build_table_rows(breakdown),
        },
        "emptyState": None,
    }


def list_valid_filters(snapshot: dict[str, Any]) -> dict[str, list[Any]]:
    filter_ready = snapshot.get("filter_ready", {})
    countries = sorted({row.get("country") for row in filter_ready.get("squad_usage_by_country", []) if row.get("country")})
    competitions = sorted(
        {row.get("competition_name") for row in filter_ready.get("squad_usage_by_competition", []) if row.get("competition_name")}
    )
    pairs = sorted(
        {
            (row.get("country"), row.get("competition_name"))
            for row in filter_ready.get("squad_usage_by_country_competition", [])
            if row.get("country") and row.get("competition_name")
        }
    )
    return {
        "countries": countries,
        "competitions": competitions,
        "country_competition_pairs": pairs,
    }


def _format_currency(value: Any) -> str:
    return f"${_safe_number(value):,.0f}"


def _summary_markdown_rows(summary_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    row: dict[str, Any] = {}
    for item in summary_items:
        row[item.get("label", "")] = item.get("value", "")
    return [row] if row else []


def _table_markdown_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    formatted = []
    for row in rows:
        formatted.append(
            {
                "Equipo": row.get("team", ""),
                "País": row.get("country", ""),
                "Titulares": row.get("starterParticipations", 0),
                "Suplentes": row.get("substituteParticipations", 0),
                "% suplentes": _format_percent(row.get("substituteSharePct"), 1),
                "Diferencia de rendimiento": row.get("performanceGapLabel", SQUAD_USAGE_COPY["no_data"]),
            }
        )
    return formatted


def _markdown_table(headers: list[str], rows: list[dict[str, Any]]) -> str:
    if not headers:
        return "- Sin columnas"
    header_line = "| " + " | ".join(headers) + " |"
    divider = "| " + " | ".join(["---"] * len(headers)) + " |"
    lines = [header_line, divider]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(header, "-")) for header in headers) + " |")
    return "\n".join(lines)


def _find_zero_substitute_case(snapshot: dict[str, Any]) -> tuple[str, str] | None:
    for row in snapshot.get("filter_ready", {}).get("squad_usage_by_country_competition", []):
        if _safe_number(row.get("substitute_share_pct")) == 0:
            return row.get("country"), row.get("competition_name")
    return None


def _find_null_gap_case(snapshot: dict[str, Any]) -> tuple[str, str, str] | None:
    for row in snapshot.get("filter_ready", {}).get("squad_usage_team_breakdown_by_country_competition", []):
        if row.get("performance_gap_pct") is None:
            return row.get("country"), row.get("competition_name"), row.get("team")
    return None


def generate_validation_markdown(snapshot: dict[str, Any]) -> str:
    valid = list_valid_filters(snapshot)
    global_view = build_squad_usage_view(snapshot)
    zero_sub_case = _find_zero_substitute_case(snapshot)
    null_gap_case = _find_null_gap_case(snapshot)

    lines = [
        "# Validacion Plantilla vs Front",
        "",
        "## Estado global",
        "",
        f"- visible: `{str(global_view['visible']).lower()}`",
        f"- context: `{global_view['context']}`",
        f"- title: `{global_view['title']}`",
        f"- subtitle: `{global_view['subtitle']}`",
        f"- contextLabel: `{global_view['contextLabel']}`",
        f"- contextMeta: `{global_view['contextMeta']['teamsLabel']} · {global_view['contextMeta']['recordsLabel']}`",
        f"- search cambia la seccion: `no`",
        "",
        "### Resumen",
        "",
        _markdown_table(
            [
                "Participación titular",
                "Participación suplente",
                "Titulares únicos",
                "Suplentes únicos",
            ],
            _summary_markdown_rows(global_view["summary"]),
        ),
        "",
        "### Insight",
        "",
        f"- title: `{global_view['insight']['title']}`",
        f"- description: `{global_view['insight']['description']}`",
        "",
        "### Tabla por equipo",
        "",
        _markdown_table(
            global_view["tableModel"]["columns"],
            _table_markdown_rows(global_view["tableModel"]["rows"]),
        ),
        "",
        "## Estados por pais",
        "",
    ]

    for country in valid["countries"]:
        view = build_squad_usage_view(snapshot, country=country)
        lines.extend(
            [
                f"### {country}",
                "",
                f"- context: `{view['context']}`",
                f"- contextLabel: `{view['contextLabel']}`",
                f"- contextMeta: `{view['contextMeta']['teamsLabel']} · {view['contextMeta']['recordsLabel']}`",
                *([f"- note: `{view['contextMeta']['singleCompetitionNote']}`"] if view["contextMeta"]["singleCompetitionNote"] else []),
                f"- insight: `{view['insight']['title'] if view['insight'] else ''}`",
                f"- description: `{view['insight']['description'] if view['insight'] else ''}`",
                "",
                _markdown_table(
                    [
                        "Participación titular",
                        "Participación suplente",
                        "Titulares únicos",
                        "Suplentes únicos",
                    ],
                    _summary_markdown_rows(view["summary"]),
                ),
                "",
            ]
        )

    lines.extend(["## Estados por competencia", ""])
    for competition in valid["competitions"]:
        view = build_squad_usage_view(snapshot, competition=competition)
        lines.extend(
            [
                f"### {competition}",
                "",
                f"- context: `{view['context']}`",
                f"- contextLabel: `{view['contextLabel']}`",
                f"- contextMeta: `{view['contextMeta']['teamsLabel']} · {view['contextMeta']['recordsLabel']}`",
                f"- insight: `{view['insight']['title'] if view['insight'] else ''}`",
                f"- description: `{view['insight']['description'] if view['insight'] else ''}`",
                "",
                _markdown_table(
                    [
                        "Participación titular",
                        "Participación suplente",
                        "Titulares únicos",
                        "Suplentes únicos",
                    ],
                    _summary_markdown_rows(view["summary"]),
                ),
                "",
            ]
        )

    lines.extend(["## Estados pais + competencia validos", ""])
    for country, competition in valid["country_competition_pairs"]:
        view = build_squad_usage_view(snapshot, country=country, competition=competition)
        lines.extend(
            [
                f"### {country} + {competition}",
                "",
                f"- context: `{view['context']}`",
                f"- contextLabel: `{view['contextLabel']}`",
                f"- contextMeta: `{view['contextMeta']['teamsLabel']} · {view['contextMeta']['recordsLabel']}`",
                *([f"- note: `{view['contextMeta']['singleCompetitionNote']}`"] if view["contextMeta"]["singleCompetitionNote"] else []),
                f"- insight: `{view['insight']['title'] if view['insight'] else ''}`",
                f"- description: `{view['insight']['description'] if view['insight'] else ''}`",
                "",
                _markdown_table(
                    [
                        "Participación titular",
                        "Participación suplente",
                        "Titulares únicos",
                        "Suplentes únicos",
                    ],
                    _summary_markdown_rows(view["summary"]),
                ),
                "",
                _markdown_table(
                    view["tableModel"]["columns"],
                    _table_markdown_rows(view["tableModel"]["rows"]),
                ),
                "",
            ]
        )

    if zero_sub_case:
        zero_sub_view = build_squad_usage_view(snapshot, country=zero_sub_case[0], competition=zero_sub_case[1])
        lines.extend(
            [
                "## Caso controlado - Sin uso de suplentes",
                "",
                f"- filtros: `country={zero_sub_case[0]}&competition={zero_sub_case[1]}`",
                f"- insight: `{zero_sub_view['insight']['title']}`",
                f"- description: `{zero_sub_view['insight']['description']}`",
                "",
            ]
        )

    if null_gap_case:
        null_gap_view = build_squad_usage_view(snapshot, country=null_gap_case[0], competition=null_gap_case[1])
        matched_row = next(
            (row for row in null_gap_view["tableModel"]["rows"] if row["team"] == null_gap_case[2]),
            None,
        )
        lines.extend(
            [
                "## Caso controlado - Diferencia de rendimiento nula",
                "",
                f"- filtros: `country={null_gap_case[0]}&competition={null_gap_case[1]}`",
                f"- equipo: `{null_gap_case[2]}`",
                f"- diferencia renderizada: `{matched_row['performanceGapLabel'] if matched_row else SQUAD_USAGE_COPY['no_data']}`",
                "",
            ]
        )

    empty_view = build_squad_usage_view(snapshot, country="País Fantasma", competition="Competencia Fantasma 2099")
    lines.extend(
        [
            "## Estado vacio controlado",
            "",
            "- filtros: `country=País Fantasma&competition=Competencia Fantasma 2099`",
            f"- context: `{empty_view['context']}`",
            f"- emptyState: `{empty_view['emptyState']['message']}`",
            "",
        ]
    )

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera valores esperados para la seccion Plantilla.")
    parser.add_argument("--country", default="", help="País del contexto")
    parser.add_argument("--competition", default="", help="Competencia del contexto")
    parser.add_argument("--search", default="", help="Busqueda de jugador; no cambia esta seccion")
    parser.add_argument("--list", action="store_true", help="Lista paises, competencias y pares validos")
    parser.add_argument("--markdown", action="store_true", help="Genera el reporte markdown completo")
    parser.add_argument("--output", default="", help="Ruta de salida para markdown")
    args = parser.parse_args()

    snapshot = load_dashboard_snapshot()
    if args.list:
        print(json.dumps(list_valid_filters(snapshot), ensure_ascii=False, indent=2))
        return

    if args.markdown:
        markdown = generate_validation_markdown(snapshot)
        output = Path(args.output) if args.output else DEFAULT_DOC_PATH
        output.write_text(markdown, encoding="utf-8")
        print(f"Markdown generado en {output}")
        return

    result = build_squad_usage_view(
        snapshot,
        country=args.country,
        competition=args.competition,
        search=args.search,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

