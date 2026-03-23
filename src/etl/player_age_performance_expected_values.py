"""Expected values helper for the Edad vs rendimiento section UI."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_edad_rendimiento_vs_front.md"

AGE_PERFORMANCE_COPY = {
    "title": "Edad vs rendimiento",
    "subtitle": "C\u00f3mo cambia el rendimiento seg\u00fan la edad en este contexto",
    "empty_title": "Sin datos de edad y rendimiento para este filtro",
    "empty_hint": "Solo se muestran jugadores con edad y rendimiento registrados en este contexto.",
    "partial_title": "Hay jugadores registrados en este contexto, pero no hay rendimiento suficiente para compararlos.",
    "insufficient": "Muestra insuficiente",
    "insufficient_hint": "Muestra insuficiente para inferir una relaci\u00f3n entre edad y rendimiento.",
    "no_player_match": "El jugador buscado no aparece en este contexto.",
    "context_labels": {
        "global": "Vista general de jugadores por edad y rendimiento",
        "country": lambda country: f"As\u00ed rinden los jugadores de equipos de {country}",
        "competition": lambda competition: f"As\u00ed rindieron los jugadores en {competition}",
        "country_competition": lambda country, competition: f"As\u00ed rindieron los jugadores de {country} en {competition}",
    },
    "age_bands": ["20-21", "22-23", "24+"],
    "relationships": {
        "none": "Sin relaci\u00f3n clara",
        "weak_positive": "Relaci\u00f3n d\u00e9bil positiva",
        "weak_negative": "Relaci\u00f3n d\u00e9bil negativa",
        "moderate_positive": "Relaci\u00f3n moderada positiva",
        "moderate_negative": "Relaci\u00f3n moderada negativa",
        "strong_positive": "Relaci\u00f3n fuerte positiva",
        "strong_negative": "Relaci\u00f3n fuerte negativa",
    },
    "band_title": "Rendimiento por tramo de edad",
    "limited_description": "No hay suficiente muestra para inferir una relaci\u00f3n entre edad y rendimiento.",
    "band_insight_top": "Mejor tramo",
    "band_insight_above": "Sobre el promedio",
    "band_insight_below": "Bajo el promedio",
}

AGE_BAND_ORDER = {"20-21": 0, "22-23": 1, "24+": 2}


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
        return AGE_PERFORMANCE_COPY["context_labels"]["country_competition"](country, competition)
    if context == "country":
        return AGE_PERFORMANCE_COPY["context_labels"]["country"](country)
    if context == "competition":
        return AGE_PERFORMANCE_COPY["context_labels"]["competition"](competition)
    return AGE_PERFORMANCE_COPY["context_labels"]["global"]


def _format_percent(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return "Sin registro de rendimiento"
    return f"{numeric:.1f}%"


def _format_band_label(band: str) -> str:
    if not band:
        return "Sin registro"
    return "24+ a\u00f1os" if band == "24+" else f"{band} a\u00f1os"


def _players_label(count: int) -> str:
    return f"{count} {'jugador' if abs(count) == 1 else 'jugadores'} analizados"


def _comparable_players_label(count: int) -> str:
    return f"{count} {'jugador comparable' if abs(count) == 1 else 'jugadores comparables'}"


def _players_in_context_label(count: int) -> str:
    return f"{count} {'jugador en el contexto' if abs(count) == 1 else 'jugadores en el contexto'}"


def _partial_hint(raw_count: int, valid_count: int) -> str:
    raw_label = "jugador con edad registrada" if abs(raw_count) == 1 else "jugadores con edad registrada"
    return f"Se encontraron {raw_count} {raw_label} y {valid_count} con rendimiento comparable."


def _omission_note(hidden_leaders: int, hidden_bands: int) -> str:
    if hidden_leaders > 0 and hidden_bands > 0:
        return (
            f"Se omitieron {hidden_leaders} "
            f"{'destacado' if hidden_leaders == 1 else 'destacados'} y {hidden_bands} "
            f"{'tramo' if hidden_bands == 1 else 'tramos'} sin rendimiento comparable."
        )
    if hidden_leaders > 0:
        return (
            f"Se omit{'i\u00f3' if hidden_leaders == 1 else 'ieron'} {hidden_leaders} "
            f"{'destacado' if hidden_leaders == 1 else 'destacados'} sin rendimiento comparable."
        )
    if hidden_bands > 0:
        return (
            f"Se omit{'i\u00f3' if hidden_bands == 1 else 'ieron'} {hidden_bands} "
            f"{'tramo' if hidden_bands == 1 else 'tramos'} sin rendimiento comparable."
        )
    return ""


def _build_rows(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in points:
        age = _safe_optional_number(row.get("age"))
        performance_pct = _safe_optional_number(row.get("performance_pct"))
        if age is None:
            continue
        rows.append(
            {
                "playerName": row.get("player_name") or row.get("name") or "",
                "team": row.get("team") or "",
                "teamCountry": row.get("team_country") or row.get("country") or row.get("nationality") or "",
                "age": age,
                "performancePct": performance_pct,
                "performanceLabel": _format_percent(performance_pct),
                "ageBand": row.get("age_band") or ("20-21" if age <= 21 else "22-23" if age <= 23 else "24+"),
                "searchKey": (row.get("player_name") or row.get("name") or "").lower(),
            }
        )
    rows.sort(key=lambda item: (item["age"], -_safe_number(item["performancePct"]), item["playerName"]))
    return rows


def _build_points(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in _build_rows(points) if row["performancePct"] is not None]


def _resolve_analysis_state(raw_count: int, valid_count: int) -> str:
    if raw_count <= 0:
        return "empty"
    if valid_count <= 0:
        return "partial"
    if valid_count < 3:
        return "limited"
    return "complete"


def _build_relationship(summary: dict[str, Any], points: list[dict[str, Any]]) -> dict[str, str]:
    sample_size = max(int(_safe_number(summary.get("players_count"))), len(points))
    strength = str(summary.get("correlation_strength") or "").lower()
    direction = str(summary.get("correlation_direction") or "").lower()
    if sample_size < 3 or strength == "insufficient":
        return {
            "label": AGE_PERFORMANCE_COPY["insufficient"],
            "description": AGE_PERFORMANCE_COPY["insufficient_hint"],
        }
    if strength == "none" or direction == "neutral" or not direction:
        return {
            "label": AGE_PERFORMANCE_COPY["relationships"]["none"],
            "description": "La edad no marca una diferencia clara en este contexto.",
        }
    key = f"{strength}_{direction}"
    return {
        "label": AGE_PERFORMANCE_COPY["relationships"].get(key, AGE_PERFORMANCE_COPY["relationships"]["none"]),
        "description": "El rendimiento tiende a bajar con la edad en este contexto."
        if direction == "negative"
        else "El rendimiento tiende a subir con la edad en este contexto.",
    }


def _build_band_model(summary: dict[str, Any], bands: list[dict[str, Any]]) -> dict[str, Any]:
    lookup = {row["age_band"]: row for row in bands if row.get("age_band")}
    best_band = str(summary.get("best_age_band") or "")
    if not best_band and lookup:
        best_band = max(
            lookup.values(),
            key=lambda row: _safe_number(row.get("average_performance_pct")),
        )["age_band"]
    overall_average = _safe_optional_number(summary.get("overall_average_performance_pct"))
    visible_items: list[dict[str, Any]] = []
    hidden_count = 0
    for band in AGE_PERFORMANCE_COPY["age_bands"]:
        row = lookup.get(band) or {}
        players_count = int(_safe_number(row.get("players_count")))
        average = _safe_optional_number(row.get("average_performance_pct"))
        if players_count <= 0:
            continue
        if average is None:
            hidden_count += 1
            continue
        insight = AGE_PERFORMANCE_COPY["band_insight_below"]
        if band == best_band:
            insight = AGE_PERFORMANCE_COPY["band_insight_top"]
        elif overall_average is not None and average >= overall_average:
            insight = AGE_PERFORMANCE_COPY["band_insight_above"]
        visible_items.append(
            {
                "ageBand": band,
                "label": _format_band_label(band),
                "playersCount": players_count,
                "playersLabel": f"{players_count} {'jugador' if abs(players_count) == 1 else 'jugadores'}",
                "averageLabel": _format_percent(average),
                "topPlayerLabel": (
                    f"{row.get('top_player_name')} - {row.get('top_player_team')}"
                    if row.get("top_player_name") and row.get("top_player_team") and _safe_optional_number(row.get("top_player_performance_pct")) is not None
                    else ""
                ),
                "insight": insight,
                "isBestBand": band == best_band,
            }
        )
    resolved_best_band = next((item["ageBand"] for item in visible_items if item["isBestBand"]), "")
    if not resolved_best_band and visible_items:
        resolved_best_band = visible_items[0]["ageBand"]
    for item in visible_items:
        item["isBestBand"] = item["ageBand"] == resolved_best_band
    return {
        "title": AGE_PERFORMANCE_COPY["band_title"],
        "bestBand": resolved_best_band,
        "items": visible_items,
        "hiddenCount": hidden_count,
    }


def _find_standout(points: list[dict[str, Any]], leaders: dict[str, Any], mode: str) -> dict[str, Any] | None:
    player_key = "young_standout_player" if mode == "young" else "veteran_standout_player"
    team_key = "young_standout_team" if mode == "young" else "veteran_standout_team"
    performance_key = "young_standout_performance_pct" if mode == "young" else "veteran_standout_performance_pct"
    explicit_player = leaders.get(player_key)
    explicit_team = leaders.get(team_key)
    explicit_performance = _safe_optional_number(leaders.get(performance_key))
    if explicit_player:
        if explicit_performance is None:
            return None
        matched = next((point for point in points if point["playerName"] == explicit_player and (not explicit_team or point["team"] == explicit_team)), None)
        if matched:
            return matched
        return {
            "playerName": explicit_player,
            "team": explicit_team or "",
            "performancePct": explicit_performance,
            "performanceLabel": _format_percent(explicit_performance),
            "ageBand": "",
        }
    if not points:
        return None
    band_rank = min if mode == "young" else max
    target_rank = band_rank(AGE_BAND_ORDER.get(point["ageBand"], 99) for point in points)
    target_band = next(
        band for band, rank in AGE_BAND_ORDER.items() if rank == target_rank
    )
    candidates = [point for point in points if point["ageBand"] == target_band]
    candidates.sort(key=lambda item: (-item["performancePct"], item["age"] if mode == "young" else -item["age"], item["playerName"]))
    return candidates[0] if candidates else None


def build_age_performance_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
    search: str = "",
) -> dict[str, Any]:
    context = _resolve_context(country, competition)
    filter_ready = snapshot.get("filter_ready", {})
    if context == "country_competition":
        summary = next((row for row in filter_ready.get("player_age_performance_summary_by_country_competition", []) if row.get("country") == country and row.get("competition_name") == competition), {})
        bands = [row for row in filter_ready.get("player_age_performance_bands_by_country_competition", []) if row.get("country") == country and row.get("competition_name") == competition]
        points = [row for row in filter_ready.get("player_age_performance_points_by_country_competition", []) if row.get("country") == country and row.get("competition_name") == competition]
        leaders = next((row for row in filter_ready.get("player_age_performance_leaders_by_country_competition", []) if row.get("country") == country and row.get("competition_name") == competition), {})
    elif context == "country":
        summary = next((row for row in filter_ready.get("player_age_performance_summary_by_country", []) if row.get("country") == country), {})
        bands = [row for row in filter_ready.get("player_age_performance_bands_by_country", []) if row.get("country") == country]
        points = [row for row in filter_ready.get("player_age_performance_points_by_country", []) if row.get("country") == country]
        leaders = next((row for row in filter_ready.get("player_age_performance_leaders_by_country", []) if row.get("country") == country), {})
    elif context == "competition":
        summary = next((row for row in filter_ready.get("player_age_performance_summary_by_competition", []) if row.get("competition_name") == competition), {})
        bands = [row for row in filter_ready.get("player_age_performance_bands_by_competition", []) if row.get("competition_name") == competition]
        points = [row for row in filter_ready.get("player_age_performance_points_by_competition", []) if row.get("competition_name") == competition]
        leaders = next((row for row in filter_ready.get("player_age_performance_leaders_by_competition", []) if row.get("competition_name") == competition), {})
    else:
        summary = snapshot.get("player_age_performance_summary", {})
        bands = snapshot.get("player_age_performance_bands", [])
        points = snapshot.get("player_age_performance_points", [])
        leaders = snapshot.get("player_age_performance_leaders", {})

    raw_rows = _build_rows(points)
    normalized_points = [row for row in raw_rows if row["performancePct"] is not None]
    raw_count = max(int(_safe_number(summary.get("players_count"))), len(raw_rows))
    valid_count = len(normalized_points)
    analysis_state = _resolve_analysis_state(raw_count, valid_count)
    relationship = _build_relationship(summary, normalized_points)

    if analysis_state == "empty":
        return {
            "visible": True,
            "context": context,
            "analysisState": analysis_state,
            "title": AGE_PERFORMANCE_COPY["title"],
            "subtitle": AGE_PERFORMANCE_COPY["subtitle"],
            "contextLabel": _context_label(context, country=country, competition=competition),
            "summary": {
                "relationshipLabel": relationship["label"],
                "relationshipDescription": relationship["description"],
                "playersLabel": _players_label(0),
            },
            "validPointsCount": valid_count,
            "rawPlayersCount": raw_count,
            "hasComparablePerformance": False,
            "hiddenLeadersCount": 0,
            "hiddenBandsCount": 0,
            "sectionNotes": [],
            "leaders": [],
            "bandModel": None,
            "scatterModel": None,
            "searchHighlight": {"query": search, "matches": [], "note": AGE_PERFORMANCE_COPY["no_player_match"] if search else ""},
            "emptyState": {
                "message": AGE_PERFORMANCE_COPY["empty_title"],
                "hint": AGE_PERFORMANCE_COPY["empty_hint"],
            },
        }

    if analysis_state == "partial":
        return {
            "visible": True,
            "context": context,
            "analysisState": analysis_state,
            "title": AGE_PERFORMANCE_COPY["title"],
            "subtitle": AGE_PERFORMANCE_COPY["subtitle"],
            "contextLabel": _context_label(context, country=country, competition=competition),
            "summary": {
                "relationshipLabel": relationship["label"],
                "relationshipDescription": relationship["description"],
                "playersLabel": _players_label(raw_count),
            },
            "validPointsCount": valid_count,
            "rawPlayersCount": raw_count,
            "hasComparablePerformance": False,
            "hiddenLeadersCount": 0,
            "hiddenBandsCount": 0,
            "sectionNotes": [],
            "leaders": [],
            "bandModel": None,
            "scatterModel": None,
            "searchHighlight": {"query": search, "matches": [], "note": ""},
            "emptyState": {
                "message": AGE_PERFORMANCE_COPY["partial_title"],
                "hint": _partial_hint(raw_count, valid_count),
            },
        }

    band_model = _build_band_model(summary, bands)
    player_count = raw_count
    query = search.strip()
    matches = [point for point in normalized_points if query.lower() in point["searchKey"]] if query else []
    search_note = ""
    if query and not matches:
        search_note = AGE_PERFORMANCE_COPY["no_player_match"]
    elif matches:
        search_note = f"{len(matches)} {'coincidencia resaltada' if len(matches) == 1 else 'coincidencias resaltadas'} en este contexto."

    young = _find_standout(normalized_points, leaders, "young")
    veteran = _find_standout(normalized_points, leaders, "veteran")
    best_band_item = next((item for item in band_model["items"] if item["ageBand"] == band_model["bestBand"]), None)

    leaders_out = []
    hidden_leaders = 0

    if analysis_state == "limited":
        leaders_out.append(
            {
                "label": "Muestra limitada",
                "subject": _comparable_players_label(valid_count),
                "meta": _players_in_context_label(player_count),
                "value": "",
                "description": AGE_PERFORMANCE_COPY["limited_description"],
            }
        )
    else:
        leaders_out.append(
            {
                "label": "Relaci\u00f3n edad-rendimiento",
                "subject": relationship["label"],
                "meta": _players_label(player_count),
                "value": "",
                "description": relationship["description"],
            }
        )

    if best_band_item:
        leaders_out.append(
            {
                "label": "Mejor tramo de edad",
                "subject": best_band_item.get("label", "Sin registro"),
                "meta": best_band_item.get("playersLabel", ""),
                "value": best_band_item.get("averageLabel", "Sin registro de rendimiento"),
                "description": "Es el tramo con mejor % de victorias promedio.",
            }
        )

    if young is not None and young.get("performancePct") is not None:
        leaders_out.append(
            {
                "label": "Joven destacado",
                "subject": young.get("playerName", "Sin registro"),
                "meta": young.get("team", ""),
                "value": young.get("performanceLabel", "Sin registro de rendimiento"),
                "description": "Mejor rendimiento dentro del tramo joven.",
            }
        )
    elif leaders.get("young_standout_player"):
        hidden_leaders += 1

    if veteran is not None and veteran.get("performancePct") is not None:
        leaders_out.append(
            {
                "label": "Veterano destacado",
                "subject": veteran.get("playerName", "Sin registro"),
                "meta": veteran.get("team", ""),
                "value": veteran.get("performanceLabel", "Sin registro de rendimiento"),
                "description": "Mejor rendimiento dentro del tramo veterano.",
            }
        )
    elif leaders.get("veteran_standout_player"):
        hidden_leaders += 1

    omission_note = _omission_note(hidden_leaders, band_model["hiddenCount"])
    section_notes = [omission_note] if omission_note else []

    return {
        "visible": True,
        "context": context,
        "analysisState": analysis_state,
        "title": AGE_PERFORMANCE_COPY["title"],
        "subtitle": AGE_PERFORMANCE_COPY["subtitle"],
        "contextLabel": _context_label(context, country=country, competition=competition),
        "summary": {
            "relationshipLabel": relationship["label"],
            "relationshipDescription": relationship["description"],
            "playersLabel": _players_label(player_count),
        },
        "validPointsCount": valid_count,
        "rawPlayersCount": raw_count,
        "hasComparablePerformance": valid_count > 0,
        "hiddenLeadersCount": hidden_leaders,
        "hiddenBandsCount": band_model["hiddenCount"],
        "sectionNotes": section_notes,
        "leaders": leaders_out,
        "bandModel": band_model if band_model["items"] else None,
        "scatterModel": None,
        "searchHighlight": {
            "query": search,
            "matches": matches,
            "note": search_note,
        },
        "emptyState": None,
    }


def generate_validation_markdown(snapshot: dict[str, Any]) -> str:
    view = build_age_performance_view(snapshot)
    filter_ready = snapshot.get("filter_ready", {})
    lines = [
        "# Validaci\u00f3n - Edad vs rendimiento",
        "",
        f"- T\u00edtulo: {view['title']}",
        f"- Subt\u00edtulo: {view['subtitle']}",
        f"- Contexto: {view['contextLabel']}",
        f"- Relaci\u00f3n: {view['summary']['relationshipLabel']}",
        f"- Muestra global: {view['summary']['playersLabel']}",
        "- Bloques premium:",
        "  - Insights del contexto",
        "  - Rendimiento por tramo de edad",
        "",
        "## Cobertura de filtros",
        f"- Global: {len(snapshot.get('player_age_performance_points', []))} puntos",
        f"- Pa\u00eds: {len(filter_ready.get('player_age_performance_points_by_country', []))} filas contextualizadas",
        f"- Competencia: {len(filter_ready.get('player_age_performance_points_by_competition', []))} filas contextualizadas",
        f"- Pa\u00eds + competencia: {len(filter_ready.get('player_age_performance_points_by_country_competition', []))} filas contextualizadas",
        "",
        "## Reglas verificadas",
        "- `Pa\u00eds` se interpreta como pa\u00eds del equipo.",
        "- `search` solo resalta jugadores dentro del contexto activo.",
        "- El m\u00f3dulo ya no muestra el scatter de distribuci\u00f3n.",
        "- El copy visible ya no usa referencias legacy al rendimiento fijo de 2024.",
        f"- Estado global actual: {view.get('analysisState', 'complete')}.",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate validation markdown for Edad vs rendimiento.")
    parser.add_argument("--output", type=Path, default=DEFAULT_DOC_PATH)
    args = parser.parse_args()
    snapshot = load_dashboard_snapshot()
    args.output.write_text(generate_validation_markdown(snapshot), encoding="utf-8")


if __name__ == "__main__":
    main()
