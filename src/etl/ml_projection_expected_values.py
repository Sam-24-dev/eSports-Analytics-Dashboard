"""Expected values helper for the premium ML projection section."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_ml_proyeccion_vs_front.md"

ML_PROJECTION_COPY = {
    "title": "Proyección 2026",
    "subtitle": "Cómo se perfila el rendimiento anual proyectado de cada jugador",
    "context_labels": {
        "global": "Vista general de la proyección anual de los jugadores",
        "country": lambda country: f"Así proyectan los jugadores de equipos de {country} en 2026",
    },
    "competition_note": "La proyección 2026 es anual y no se segmenta por competencia.",
    "empty_title": "No hay proyecciones disponibles para este contexto.",
    "empty_hint": "La proyección anual solo muestra jugadores con base estadística suficiente para el modelo.",
    "no_search_match": "El jugador buscado no aparece en esta proyección anual.",
    "aggregate_title_global": "Qué equipos y países proyectan mejor",
    "aggregate_title_country": lambda country: f"Cómo proyecta {country}",
    "feature_title": "Qué pesa más en el modelo global",
    "watch_title": "Top proyección 2026",
    "risk_title": "Riesgo de caída",
    "table_title": "Detalle de proyección anual",
}


def load_dashboard_snapshot(path: Path = SNAPSHOT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _safe_number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _safe_optional_number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _format_percent(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return "Sin dato"
    return f"{numeric:.1f}%"


def _format_delta(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return "Sin dato"
    sign = "+" if numeric > 0 else ""
    return f"{sign}{numeric:.1f} pts"


def _country_context(snapshot: dict[str, Any], country: str) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    filter_ready = snapshot.get("filter_ready", {})
    summary = next(
        (row for row in filter_ready.get("ml_projection_2026_summary_by_country", []) if row.get("country") == country),
        {},
    )
    players = [row for row in filter_ready.get("ml_projection_2026_players_by_country", []) if row.get("country") == country]
    team_rows = [row for row in filter_ready.get("ml_projection_2026_team_summary_by_country", []) if row.get("country") == country]
    country_rows = [row for row in filter_ready.get("ml_projection_2026_country_summary_by_country", []) if row.get("country") == country]
    return summary, players, team_rows, country_rows


def _find_player(players: list[dict[str, Any]], player_name: str) -> dict[str, Any] | None:
    target = _normalize_text(player_name)
    return next((row for row in players if _normalize_text(row.get("player_name")) == target), None)


def _find_distinct_decline(players: list[dict[str, Any]], excluded_name: str) -> dict[str, Any] | None:
    excluded = _normalize_text(excluded_name)
    candidates = [
        row
        for row in players
        if _safe_optional_number(row.get("delta")) is not None
        and _safe_number(row.get("delta")) < 0
        and _normalize_text(row.get("player_name")) != excluded
    ]
    candidates.sort(
        key=lambda row: (
            _safe_number(row.get("delta")),
            -_safe_number(row.get("predicted_winrate")),
            str(row.get("player_name", "")),
        )
    )
    return candidates[0] if candidates else None


def _build_insights(summary: dict[str, Any], players: list[dict[str, Any]], team_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    insights: list[dict[str, Any]] = []
    best_projected_row = _find_player(players, summary.get("best_projected_player", ""))
    biggest_improvement_row = _find_player(players, summary.get("biggest_improvement_player", ""))
    biggest_decline_row = _find_distinct_decline(players, summary.get("best_projected_player", "")) or _find_player(
        players, summary.get("biggest_decline_player", "")
    )
    best_team_row = max(
        team_rows,
        key=lambda row: (
            _safe_number(row.get("projected_avg_winrate")),
            _safe_number(row.get("avg_delta")),
            _safe_number(row.get("players_count")),
            str(row.get("team", "")),
        ),
        default=None,
    )

    if best_projected_row or (summary.get("best_projected_player") and summary.get("best_projected_winrate") is not None):
        insights.append(
            {
                "key": "best_projected",
                "label": "Mejor proyección 2026",
                "subject": (best_projected_row or {}).get("player_name", summary.get("best_projected_player", "")),
                "value": _format_percent((best_projected_row or {}).get("predicted_winrate", summary.get("best_projected_winrate"))),
                "description": "Tiene la proyección individual más alta del contexto.",
            }
        )

    if biggest_improvement_row or (summary.get("biggest_improvement_player") and summary.get("biggest_improvement_delta") is not None):
        insights.append(
            {
                "key": "biggest_improvement",
                "label": "Mayor subida esperada",
                "subject": (biggest_improvement_row or {}).get("player_name", summary.get("biggest_improvement_player", "")),
                "value": _format_delta((biggest_improvement_row or {}).get("delta", summary.get("biggest_improvement_delta"))),
                "description": "Es la subida proyectada más fuerte del contexto.",
            }
        )

    if biggest_decline_row or (
        summary.get("biggest_decline_player")
        and summary.get("biggest_decline_delta") is not None
        and _normalize_text(summary.get("biggest_decline_player")) != _normalize_text(summary.get("best_projected_player"))
    ):
        insights.append(
            {
                "key": "biggest_decline",
                "label": "Mayor baja vs actual",
                "subject": (biggest_decline_row or {}).get("player_name", summary.get("biggest_decline_player", "")),
                "value": _format_delta((biggest_decline_row or {}).get("delta", summary.get("biggest_decline_delta"))),
                "description": "Es la caída proyectada más marcada frente al rendimiento actual.",
            }
        )

    if best_team_row or (summary.get("best_projected_team") and summary.get("best_projected_team_avg_winrate") is not None):
        insights.append(
            {
                "key": "best_team",
                "label": "Equipo con mejor promedio proyectado",
                "subject": (best_team_row or {}).get("team", summary.get("best_projected_team", "")),
                "value": _format_percent((best_team_row or {}).get("projected_avg_winrate", summary.get("best_projected_team_avg_winrate"))),
                "description": "Es el mejor promedio proyectado disponible para el contexto.",
            }
        )

    return insights


def _build_table_rows(players: list[dict[str, Any]], normalized_search: str, *, context: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    ordered_players = sorted(
        players,
        key=lambda row: (
            0 if normalized_search and normalized_search in _normalize_text(row.get("player_name")) else 1,
            _safe_number(row.get("projected_rank")),
            str(row.get("player_name", "")),
        ),
    )
    show_toggle = context == "global" and len(ordered_players) > 10
    visible_players = ordered_players[:10] if show_toggle else ordered_players
    rows = [
        {
            "player_name": row.get("player_name"),
            "team": row.get("team"),
            "team_country": row.get("team_country"),
            "age_2026": int(_safe_number(row.get("age_2026"))),
            "actual_winrate_label": _format_percent(row.get("actual_winrate")),
            "predicted_winrate_label": _format_percent(row.get("predicted_winrate")),
            "delta_label": _format_delta(row.get("delta")),
            "confidence_label": (
                f"{row.get('confidence_band')} · {round(_safe_number(row.get('confidence_score')))}"
                if row.get("confidence_band") and row.get("confidence_score") is not None
                else (row.get("confidence_band") or "Sin dato")
            ),
            "risk_band": row.get("risk_band"),
            "highlighted": bool(normalized_search and normalized_search in _normalize_text(row.get("player_name"))),
        }
        for row in visible_players
    ]
    return rows, {
        "showToggle": show_toggle,
        "toggleLabel": "Ver tabla completa" if show_toggle else "",
        "visibleCount": len(visible_players),
        "totalCount": len(ordered_players),
    }


def build_ml_projection_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
    search: str = "",
) -> dict[str, Any]:
    context = "country" if country else "global"
    if context == "country":
        summary, players, team_rows, country_rows = _country_context(snapshot, country)
    else:
        summary = snapshot.get("ml_projection_2026_summary", {})
        players = snapshot.get("ml_projection_2026_players", [])
        team_rows = snapshot.get("ml_projection_2026_team_summary", [])
        country_rows = snapshot.get("ml_projection_2026_country_summary", [])

    feature_rows = snapshot.get("ml_projection_2026_feature_importance", [])
    normalized_search = _normalize_text(search)
    matches: list[dict[str, Any]] = []
    search_state = {
        "query": search.strip(),
        "matches": matches,
        "note": "",
    }

    if not players and not summary:
        return {
            "visible": True,
            "context": context,
            "title": ML_PROJECTION_COPY["title"],
            "subtitle": ML_PROJECTION_COPY["subtitle"],
            "contextLabel": ML_PROJECTION_COPY["context_labels"]["country"](country)
            if context == "country"
            else ML_PROJECTION_COPY["context_labels"]["global"],
            "competitionNote": ML_PROJECTION_COPY["competition_note"] if (competition or search) else "",
            "searchState": search_state,
            "insights": [],
            "aggregatePanel": None,
            "featurePanel": {
                "title": ML_PROJECTION_COPY["feature_title"],
                "rows": [],
            },
            "watchlists": {"watchTitle": ML_PROJECTION_COPY["watch_title"], "riskTitle": ML_PROJECTION_COPY["risk_title"], "watch": [], "risk": []},
            "tableModel": None,
            "emptyState": {"message": ML_PROJECTION_COPY["empty_title"], "hint": ML_PROJECTION_COPY["empty_hint"]},
        }

    sorted_country_rows = sorted(
        country_rows,
        key=lambda row: (
            -_safe_number(row.get("projected_avg_winrate")),
            -_safe_number(row.get("avg_delta")),
            str(row.get("country", "")),
        ),
    )
    sorted_team_rows = sorted(
        team_rows,
        key=lambda row: (
            -_safe_number(row.get("projected_avg_winrate")),
            -_safe_number(row.get("avg_delta")),
            str(row.get("team", "")),
        ),
    )

    country_spotlight = None
    if context == "country":
        row = next((entry for entry in sorted_country_rows if entry.get("country") == country), None) or (sorted_country_rows[0] if sorted_country_rows else None)
        if row:
            country_spotlight = {
                "country": row.get("country"),
                "value": _format_percent(row.get("projected_avg_winrate")),
                "meta": f"{int(_safe_number(row.get('players_count')))} {'jugador' if _safe_number(row.get('players_count')) == 1 else 'jugadores'}",
                "description": "Resume el promedio proyectado del país filtrado.",
            }
    elif sorted_country_rows:
        row = sorted_country_rows[0]
        country_spotlight = {
            "country": row.get("country"),
            "value": _format_percent(row.get("projected_avg_winrate")),
            "meta": f"{int(_safe_number(row.get('players_count')))} {'jugador' if _safe_number(row.get('players_count')) == 1 else 'jugadores'}",
            "description": "Es el país con mejor promedio proyectado.",
        }

    table_rows, table_meta = _build_table_rows(players, "", context=context)
    prioritized_players = sorted(
        players,
        key=lambda row: (
            -_safe_number(row.get("predicted_winrate")),
            -_safe_number(row.get("delta")),
            str(row.get("player_name", "")),
        ),
    )
    risk_players = [
        row
        for row in sorted(players, key=lambda row: (_safe_number(row.get("delta")), str(row.get("player_name", ""))))
        if _safe_number(row.get("delta")) < 0
    ]

    return {
        "visible": True,
        "context": context,
        "title": ML_PROJECTION_COPY["title"],
        "subtitle": ML_PROJECTION_COPY["subtitle"],
        "contextLabel": ML_PROJECTION_COPY["context_labels"]["country"](country)
        if context == "country"
        else ML_PROJECTION_COPY["context_labels"]["global"],
        "competitionNote": ML_PROJECTION_COPY["competition_note"] if (competition or search) else "",
        "searchState": search_state,
        "insights": _build_insights(summary, players, team_rows),
        "aggregatePanel": {
            "title": ML_PROJECTION_COPY["aggregate_title_country"](country)
            if context == "country"
            else ML_PROJECTION_COPY["aggregate_title_global"],
            "countrySpotlight": country_spotlight,
            "teamRows": [
                {
                    "label": row.get("team"),
                    "value": _format_percent(row.get("projected_avg_winrate")),
                    "meta": row.get("top_projected_player") or "",
                    "deltaLabel": _format_delta(row.get("avg_delta")),
                }
                for row in sorted_team_rows[:4]
            ],
        },
        "featurePanel": {
            "title": ML_PROJECTION_COPY["feature_title"],
            "rows": [
                {
                    "label": row.get("feature_label"),
                    "valueLabel": _format_percent(row.get("importance_pct")),
                    "widthPct": max(8.0, min(100.0, _safe_number(row.get("importance_pct")))),
                }
                for row in sorted(feature_rows, key=lambda row: _safe_number(row.get("rank")))[:5]
            ],
        },
        "watchlists": {
            "watchTitle": ML_PROJECTION_COPY["watch_title"],
            "riskTitle": ML_PROJECTION_COPY["risk_title"],
            "watch": prioritized_players[:5],
            "risk": risk_players[:5],
        },
        "tableModel": {
            "title": ML_PROJECTION_COPY["table_title"],
            "helperNote": "Mejora = cambio frente al valor actual. Consistencia modelo = estabilidad interna de la predicción (0-100).",
            "columns": ["Jugador", "Equipo", "País del equipo", "Edad 2026", "Actual", "Predicho", "Mejora", "Consistencia modelo", "Riesgo"],
            "rows": table_rows,
            **table_meta,
        },
        "emptyState": None,
    }


def _build_validation_markdown(view: dict[str, Any], *, country: str, competition: str, search: str) -> str:
    return "\n".join(
        [
            "# Validación esperada — ML premium",
            "",
            f"- Contexto: `{view['context']}`",
            f"- País: `{country or 'global'}`",
            f"- Competencia: `{competition or 'sin competencia'}`",
            f"- Search: `{search or 'sin búsqueda'}`",
            f"- Título: `{view['title']}`",
            f"- Context label: `{view['contextLabel']}`",
            f"- Competition note: `{view['competitionNote'] or 'sin nota'}`",
            f"- Insights visibles: `{len(view.get('insights', []))}`",
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Render expected values for the premium ML projection section.")
    parser.add_argument("--snapshot", type=Path, default=SNAPSHOT_PATH)
    parser.add_argument("--country", default="")
    parser.add_argument("--competition", default="")
    parser.add_argument("--search", default="")
    parser.add_argument("--output", type=Path, default=DEFAULT_DOC_PATH)
    args = parser.parse_args()

    snapshot = load_dashboard_snapshot(args.snapshot)
    view = build_ml_projection_view(snapshot, country=args.country, competition=args.competition, search=args.search)
    args.output.write_text(_build_validation_markdown(view, country=args.country, competition=args.competition, search=args.search), encoding="utf-8")


if __name__ == "__main__":
    main()
