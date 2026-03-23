"""Expected values helper for the competition section UI."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_competencias_vs_front.md"

COMPETITION_SECTION_COPY = {
    "titles": {
        "global": "Competencias",
        "country": lambda country: f"Competencias donde participa {country}",
        "detail": lambda competition: f"Detalle de {competition}",
        "country_context": lambda country: f"Con participaci\u00f3n de {country}",
        "country_participation": lambda country: f"Participaci\u00f3n de {country}",
    },
    "empty": {
        "catalog": "Sin competencias para este filtro",
        "detail": "Sin detalle de competencia para este filtro",
        "invalid_participation": lambda country: f"Sin participaci\u00f3n de {country} en esta competencia",
    },
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


def _clean_age(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric):
        return None
    return numeric


def _map_catalog_item(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": row.get("name") or "",
        "year": int(_safe_number(row.get("year"))),
        "type": row.get("type") or "",
        "location": row.get("location") or "Por definir",
        "participatingTeams": int(_safe_number(row.get("participating_teams"))),
        "totalPrize": _safe_number(row.get("total_prize")),
    }


def _map_spotlight(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": row.get("name") or "",
        "year": int(_safe_number(row.get("year"))),
        "type": row.get("type") or "",
        "location": row.get("location") or "Por definir",
        "participatingTeams": int(_safe_number(row.get("participating_teams"))),
        "totalPlayers": int(_safe_number(row.get("total_players"))),
        "totalPrize": _safe_number(row.get("total_prize")),
        "averageAge": _clean_age(row.get("average_age")),
    }


def _build_empty_view(title: str, message: str, subtitle: str = "") -> dict[str, Any]:
    return {
        "mode": "empty",
        "title": title,
        "subtitle": subtitle,
        "items": [],
        "spotlight": None,
        "countryParticipation": None,
        "emptyState": {"message": message},
    }


def _build_filtered_competitions(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
) -> list[dict[str, Any]]:
    competitions = list(snapshot.get("competitions", []))
    filter_ready = snapshot.get("filter_ready", {})

    if competition:
        return [row for row in competitions if row.get("name") == competition]

    if country:
        valid_names = {
            row.get("competition_name")
            for row in filter_ready.get("kpis_by_country_competition", [])
            if row.get("country") == country and row.get("competition_name")
        }
        return [row for row in competitions if row.get("name") in valid_names]

    return competitions


def _country_competition_row(snapshot: dict[str, Any], country: str, competition: str) -> dict[str, Any] | None:
    filter_ready = snapshot.get("filter_ready", {})
    return next(
        (
            row
            for row in filter_ready.get("kpis_by_country_competition", [])
            if row.get("country") == country and row.get("competition_name") == competition
        ),
        None,
    )


def _country_competition_best_position(snapshot: dict[str, Any], country: str, competition: str) -> int | None:
    filter_ready = snapshot.get("filter_ready", {})
    positions = [
        int(_safe_number(row.get("final_position")))
        for row in filter_ready.get("top_teams_by_competition", [])
        if row.get("country") == country
        and row.get("competition_name") == competition
        and _safe_number(row.get("final_position")) > 0
    ]
    return min(positions) if positions else None


def _build_country_participation(snapshot: dict[str, Any], country: str, competition: str) -> dict[str, Any] | None:
    kpi_row = _country_competition_row(snapshot, country, competition)
    if not kpi_row:
        return None

    teams = int(_safe_number(kpi_row.get("total_teams")))
    players = int(_safe_number(kpi_row.get("total_players")))
    total_prizes = _safe_number(kpi_row.get("total_prizes"))
    best_position = _country_competition_best_position(snapshot, country, competition)

    if teams <= 0 and players <= 0 and total_prizes <= 0 and best_position is None:
        return None

    return {
        "country": country,
        "teams": teams,
        "players": players,
        "totalPrizes": total_prizes,
        "bestPosition": best_position,
    }


def build_competition_section_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
    search: str = "",
) -> dict[str, Any]:
    country = (country or "").strip()
    competition = (competition or "").strip()
    search = (search or "").strip()

    competitions = _build_filtered_competitions(
        snapshot,
        country=country,
        competition=competition,
    )

    if competition:
        spotlight_source = next(
            (row for row in competitions if row.get("name") == competition),
            None,
        )
        if not spotlight_source:
            return {
                "filters": {
                    "country": country or None,
                    "competition": competition or None,
                    "search": search or None,
                },
                **_build_empty_view(
                    COMPETITION_SECTION_COPY["titles"]["detail"](competition),
                    COMPETITION_SECTION_COPY["empty"]["detail"],
                ),
            }

        country_participation = _build_country_participation(snapshot, country, competition) if country else None
        if country and not country_participation:
            return {
                "filters": {
                    "country": country or None,
                    "competition": competition or None,
                    "search": search or None,
                },
                **_build_empty_view(
                    COMPETITION_SECTION_COPY["titles"]["detail"](competition),
                    COMPETITION_SECTION_COPY["empty"]["invalid_participation"](country),
                ),
            }

        return {
            "filters": {
                "country": country or None,
                "competition": competition or None,
                "search": search or None,
            },
            "mode": "spotlight",
            "title": COMPETITION_SECTION_COPY["titles"]["detail"](competition),
            "subtitle": COMPETITION_SECTION_COPY["titles"]["country_context"](country) if country else "",
            "items": [],
            "spotlight": _map_spotlight(spotlight_source),
            "countryParticipation": country_participation,
            "emptyState": None,
        }

    if not competitions:
        return {
            "filters": {
                "country": country or None,
                "competition": competition or None,
                "search": search or None,
            },
            **_build_empty_view(
                COMPETITION_SECTION_COPY["titles"]["global"],
                COMPETITION_SECTION_COPY["empty"]["catalog"],
            ),
        }

    return {
        "filters": {
            "country": country or None,
            "competition": competition or None,
            "search": search or None,
        },
        "mode": "catalog",
        "title": COMPETITION_SECTION_COPY["titles"]["country"](country) if country else COMPETITION_SECTION_COPY["titles"]["global"],
        "subtitle": "",
        "items": [_map_catalog_item(row) for row in competitions],
        "spotlight": None,
        "countryParticipation": None,
        "emptyState": None,
    }


def list_valid_filters(snapshot: dict[str, Any]) -> dict[str, list[Any]]:
    filter_ready = snapshot.get("filter_ready", {})
    countries = sorted(
        row.get("country")
        for row in filter_ready.get("kpis_by_country", [])
        if row.get("country")
    )
    competitions = sorted(
        row.get("competition_name")
        for row in filter_ready.get("kpis_by_competition", [])
        if row.get("competition_name")
    )
    pairs = sorted(
        {
            (row.get("country"), row.get("competition_name"))
            for row in filter_ready.get("kpis_by_country_competition", [])
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


def _format_average_age(value: Any) -> str:
    if value is None:
        return "Sin dato"
    return f"{float(value):.1f} a\u00f1os"


def _format_best_position(value: Any) -> str:
    if value is None:
        return "Sin clasificación final"
    return str(int(_safe_number(value)))


def _markdown_table(headers: list[str], rows: list[dict[str, Any]]) -> str:
    if not headers:
        return "- Sin columnas"
    header_line = "| " + " | ".join(headers) + " |"
    divider = "| " + " | ".join(["---"] * len(headers)) + " |"
    lines = [header_line, divider]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(header, "-")) for header in headers) + " |")
    return "\n".join(lines)


def _catalog_markdown_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "Competencia": item.get("name", ""),
            "A\u00f1o": item.get("year", ""),
            "Tipo": item.get("type", ""),
            "Sede": item.get("location", ""),
            "Equipos": item.get("participatingTeams", 0),
            "Premios": _format_currency(item.get("totalPrize")),
        }
        for item in items
    ]


def _spotlight_markdown_rows(spotlight: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not spotlight:
        return []
    return [
        {
            "Competencia": spotlight.get("name", ""),
            "A\u00f1o": spotlight.get("year", ""),
            "Tipo": spotlight.get("type", ""),
            "Sede": spotlight.get("location", ""),
            "Equipos": spotlight.get("participatingTeams", 0),
            "Jugadores": spotlight.get("totalPlayers", 0),
            "Premios": _format_currency(spotlight.get("totalPrize")),
            "Edad promedio": _format_average_age(spotlight.get("averageAge")),
        }
    ]


def _country_participation_markdown_rows(country_participation: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not country_participation:
        return []
    return [
        {
            "Pa\u00eds": country_participation.get("country", ""),
            "Equipos del pa\u00eds": country_participation.get("teams", 0),
            "Jugadores del pa\u00eds": country_participation.get("players", 0),
            "Premios del pa\u00eds": _format_currency(country_participation.get("totalPrizes")),
            "Mejor puesto": _format_best_position(country_participation.get("bestPosition")),
        }
    ]


def generate_validation_markdown(snapshot: dict[str, Any]) -> str:
    filters_catalog = list_valid_filters(snapshot)
    countries = filters_catalog["countries"]
    competitions = filters_catalog["competitions"]
    valid_pairs = filters_catalog["country_competition_pairs"]

    global_view = build_competition_section_view(snapshot)
    lines = [
        "# Validacion Competencias vs Front",
        "",
        "## Estado global",
        "",
        f"- mode: `{global_view['mode']}`",
        f"- title: `{global_view['title']}`",
        f"- subtitle: `{global_view['subtitle']}`",
        f"- search cambia la seccion: `no`",
        "",
        _markdown_table(
            ["Competencia", "A\u00f1o", "Tipo", "Sede", "Equipos", "Premios"],
            _catalog_markdown_rows(global_view["items"]),
        ),
        "",
        "## Estados por pais",
        "",
    ]

    for country in countries:
        view = build_competition_section_view(snapshot, country=country)
        lines.extend(
            [
                f"### {country}",
                "",
                f"- mode: `{view['mode']}`",
                f"- title: `{view['title']}`",
                f"- subtitle: `{view['subtitle']}`",
                "",
                _markdown_table(
                    ["Competencia", "A\u00f1o", "Tipo", "Sede", "Equipos", "Premios"],
                    _catalog_markdown_rows(view["items"]),
                ),
                "",
            ]
        )

    lines.extend(["## Estados por competencia", ""])
    for competition in competitions:
        view = build_competition_section_view(snapshot, competition=competition)
        lines.extend(
            [
                f"### {competition}",
                "",
                f"- mode: `{view['mode']}`",
                f"- title: `{view['title']}`",
                f"- subtitle: `{view['subtitle']}`",
                "",
                _markdown_table(
                    [
                        "Competencia",
                        "A\u00f1o",
                        "Tipo",
                        "Sede",
                        "Equipos",
                        "Jugadores",
                        "Premios",
                        "Edad promedio",
                    ],
                    _spotlight_markdown_rows(view["spotlight"]),
                ),
                "",
            ]
        )

    lines.extend(["## Estados pais + competencia validos", ""])
    for country, competition in valid_pairs:
        view = build_competition_section_view(snapshot, country=country, competition=competition)
        lines.extend(
            [
                f"### {country} + {competition}",
                "",
                f"- mode: `{view['mode']}`",
                f"- title: `{view['title']}`",
                f"- subtitle: `{view['subtitle']}`",
                "",
                "#### Bloque global de competencia",
                "",
                _markdown_table(
                    [
                        "Competencia",
                        "A\u00f1o",
                        "Tipo",
                        "Sede",
                        "Equipos",
                        "Jugadores",
                        "Premios",
                        "Edad promedio",
                    ],
                    _spotlight_markdown_rows(view["spotlight"]),
                ),
                "",
                f"#### {COMPETITION_SECTION_COPY['titles']['country_participation'](country)}",
                "",
                _markdown_table(
                    [
                        "Pa\u00eds",
                        "Equipos del pa\u00eds",
                        "Jugadores del pa\u00eds",
                        "Premios del pa\u00eds",
                        "Mejor puesto",
                    ],
                    _country_participation_markdown_rows(view["countryParticipation"]),
                ),
                "",
            ]
        )

    empty_view = build_competition_section_view(snapshot, competition="Competencia Fantasma 2099")
    invalid_pair_view = build_competition_section_view(snapshot, country="Argentina", competition="Challenger Sur 2025")
    lines.extend(
        [
            "## Estado vacio controlado",
            "",
            "- filtros: `competition=Competencia Fantasma 2099`",
            f"- mode: `{empty_view['mode']}`",
            f"- title: `{empty_view['title']}`",
            f"- emptyState: `{empty_view['emptyState']['message']}`",
            "",
            "## Estado vacio por participacion invalida",
            "",
            "- filtros: `country=Argentina&competition=Challenger Sur 2025`",
            f"- mode: `{invalid_pair_view['mode']}`",
            f"- title: `{invalid_pair_view['title']}`",
            f"- emptyState: `{invalid_pair_view['emptyState']['message']}`",
            "",
        ]
    )

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera valores esperados para la seccion Competencias.")
    parser.add_argument("--country", default="", help="Pais del contexto")
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

    result = build_competition_section_view(
        snapshot,
        country=args.country,
        competition=args.competition,
        search=args.search,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
