"""Expected values helper for the Experiencia del equipo section UI."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SNAPSHOT_PATH = PROJECT_ROOT / "src" / "frontend" / "assets" / "data" / "datos-dashboard.json"
DEFAULT_DOC_PATH = PROJECT_ROOT / "docs" / "validacion_experiencia_equipo_vs_front.md"

TEAM_EXPERIENCE_COPY = {
    "title": "Experiencia del equipo",
    "subtitle": "Cómo se reparte la experiencia y el liderazgo dentro de cada equipo",
    "empty": "Sin datos de experiencia para este filtro",
    "context_labels": {
        "global": "Vista general de la experiencia de los equipos",
        "country": lambda country: f"Así se reparte la experiencia en los equipos de {country}",
        "competition": lambda competition: f"Así se repartió la experiencia en {competition}",
        "country_competition": lambda country, competition: f"Así se repartió la experiencia de {country} en {competition}",
    },
    "leaders": [
        {"key": "most_experienced", "label": "Equipo con mayor edad promedio"},
        {"key": "best_veteran", "label": "Veterano con mejor rendimiento"},
        {"key": "widest_gap", "label": "Mayor rango de edades"},
        {"key": "highest_advantage", "label": "Diferencia del veterano vs equipo"},
    ],
    "role_insight_eyebrow": "Rol del veterano",
    "role_insight_titles": {
        "all_starter": "Todos usan a su veterano como titular",
        "all_substitute": "Todos usan a su veterano como suplente",
        "mostly_starter": "Predominio de veteranos titulares",
        "mostly_substitute": "Predominio de veteranos suplentes",
        "mixed": "Uso mixto del veterano",
    },
    "profile": {
        "title": "Perfil de experiencia",
        "summary": "Solo hay un equipo en este contexto.",
    },
    "chart_title": "Rango de edades por equipo",
    "chart_explanation": "La barra va del jugador más joven al más experimentado. Pasa el cursor o toca la barra para ver el menor, el promedio y el veterano.",
    "table_titles": {
        "global": "Experiencia comparada de equipos",
        "country": lambda country: f"Experiencia de equipos de {country}",
        "competition": lambda competition: f"Experiencia en {competition}",
        "country_competition": lambda country, competition: f"Experiencia de {country} en {competition}",
    },
    "table_columns": {
        "global": ["Equipo", "País", "Veterano", "Rol", "Edad del veterano", "Edad promedio", "Rango de edades", "Rendimiento del veterano", "Diferencia vs equipo", "Competiciones"],
        "country": ["Equipo", "Veterano", "Rol", "Edad del veterano", "Edad promedio", "Rango de edades", "Rendimiento del veterano", "Diferencia vs equipo", "Competiciones"],
        "competition": ["Equipo", "País", "Veterano", "Rol", "Edad del veterano", "Edad promedio", "Resultado en la competencia", "Rendimiento del veterano", "Diferencia vs equipo"],
        "country_competition": ["Equipo", "Veterano", "Rol", "Edad del veterano", "Edad promedio", "Resultado en la competencia", "Rendimiento del veterano", "Diferencia vs equipo"],
    },
    "no_data": "Sin registro",
    "no_performance_data": "Sin registro de rendimiento",
    "no_position_data": "Sin puesto final registrado",
    "no_role_data": "Sin rol registrado",
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
        return TEAM_EXPERIENCE_COPY["context_labels"]["country_competition"](country, competition)
    if context == "country":
        return TEAM_EXPERIENCE_COPY["context_labels"]["country"](country)
    if context == "competition":
        return TEAM_EXPERIENCE_COPY["context_labels"]["competition"](competition)
    return TEAM_EXPERIENCE_COPY["context_labels"]["global"]


def _table_title(context: str, *, country: str, competition: str) -> str:
    if context == "country_competition":
        return TEAM_EXPERIENCE_COPY["table_titles"]["country_competition"](country, competition)
    if context == "country":
        return TEAM_EXPERIENCE_COPY["table_titles"]["country"](country)
    if context == "competition":
        return TEAM_EXPERIENCE_COPY["table_titles"]["competition"](competition)
    return TEAM_EXPERIENCE_COPY["table_titles"]["global"]


def _format_age(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_EXPERIENCE_COPY["no_data"]
    unit = "año" if abs(numeric) == 1 else "años"
    if float(numeric).is_integer():
        return f"{int(numeric)} {unit}"
    return f"{numeric:.1f} {unit}"


def _format_avg_age(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_EXPERIENCE_COPY["no_data"]
    unit = "año" if abs(numeric) == 1 else "años"
    if float(numeric).is_integer():
        return f"{int(numeric)} {unit}"
    return f"{numeric:.1f} {unit}"


def _format_count(value: Any) -> str:
    return str(int(_safe_number(value)))


def _format_percent(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_EXPERIENCE_COPY["no_performance_data"]
    return f"{numeric:.1f}%"


def _format_gap(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_EXPERIENCE_COPY["no_performance_data"]
    if numeric > 0:
        return f"+{numeric:.1f} pts"
    return f"{numeric:.1f} pts"


def _format_role(value: Any) -> str:
    text = str(value or "").strip()
    if text in {"Titular", "Suplente", "Mixto"}:
        return text
    return TEAM_EXPERIENCE_COPY["no_role_data"]


def _format_position(value: Any) -> str:
    numeric = _safe_optional_number(value)
    if numeric is None:
        return TEAM_EXPERIENCE_COPY["no_position_data"]
    if float(numeric).is_integer():
        return f"#{int(numeric)}"
    return f"#{numeric:.1f}"


def _build_rows(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in profiles:
        veteran_gap = _safe_optional_number(row.get("veteran_vs_team_gap_pct"))
        rows.append(
            {
                "team": row.get("team") or "",
                "country": row.get("country") or "",
                "veteranPlayer": row.get("veteran_player") or TEAM_EXPERIENCE_COPY["no_data"],
                "veteranRoleLabel": _format_role(row.get("veteran_role")),
                "veteranAge": _safe_optional_number(row.get("veteran_age")),
                "veteranAgeLabel": _format_age(row.get("veteran_age")),
                "teamAvgAge": _safe_optional_number(row.get("team_avg_age")),
                "teamAvgAgeLabel": _format_avg_age(row.get("team_avg_age")),
                "youngestAge": _safe_optional_number(row.get("youngest_age")),
                "youngestAgeLabel": _format_age(row.get("youngest_age")),
                "oldestAge": _safe_optional_number(row.get("oldest_age")),
                "veteranPerformanceLabel": _format_percent(row.get("veteran_performance_pct")),
                "veteranPerformancePct": _safe_optional_number(row.get("veteran_performance_pct")),
                "ageSpan": _safe_optional_number(row.get("age_span")),
                "ageSpanLabel": _format_age(row.get("age_span")),
                "veteranGapPct": veteran_gap,
                "veteranGapLabel": _format_gap(row.get("veteran_vs_team_gap_pct")),
                "veteranGapTone": "positive" if veteran_gap is not None and veteran_gap > 0 else "negative" if veteran_gap is not None and veteran_gap < 0 else "muted",
                "competitionsCount": int(_safe_number(row.get("competitions_count"))),
                "competitionsCountLabel": _format_count(row.get("competitions_count")),
                "competitionResultLabel": _format_position(row.get("competition_result")),
            }
        )

    rows.sort(
        key=lambda item: (
            -(_safe_optional_number(item.get("teamAvgAge")) or 0),
            -(_safe_optional_number(item.get("veteranAge")) or 0),
            item.get("team") or "",
        )
    )
    return rows


def _build_role_insight(summary: dict[str, Any]) -> dict[str, Any] | None:
    teams_count = int(_safe_number(summary.get("teams_count")))
    starter_count = int(_safe_number(summary.get("veteran_starters_count")))
    substitute_count = int(_safe_number(summary.get("veteran_substitutes_count")))
    mixed_count = int(_safe_number(summary.get("veteran_mixed_count")))
    if not teams_count:
        return None
    if starter_count == teams_count:
        return {
            "eyebrow": TEAM_EXPERIENCE_COPY["role_insight_eyebrow"],
            "title": TEAM_EXPERIENCE_COPY["role_insight_titles"]["all_starter"],
            "description": f"{starter_count} de {teams_count} equipos usan a su veterano como titular",
        }
    if substitute_count == teams_count:
        return {
            "eyebrow": TEAM_EXPERIENCE_COPY["role_insight_eyebrow"],
            "title": TEAM_EXPERIENCE_COPY["role_insight_titles"]["all_substitute"],
            "description": f"{substitute_count} de {teams_count} equipos usan a su veterano como suplente",
        }
    if starter_count > 0 and substitute_count > 0:
        detail = (
            f"{mixed_count} de {teams_count} equipos usan a su veterano en roles mixtos"
            if mixed_count > 0
            else f"{starter_count} de {teams_count} equipos usan a su veterano como titular y {substitute_count} como suplente"
        )
        return {
            "eyebrow": TEAM_EXPERIENCE_COPY["role_insight_eyebrow"],
            "title": TEAM_EXPERIENCE_COPY["role_insight_titles"]["mixed"],
            "description": detail,
        }
    if mixed_count == teams_count or mixed_count >= max(starter_count, substitute_count):
        return {
            "eyebrow": TEAM_EXPERIENCE_COPY["role_insight_eyebrow"],
            "title": TEAM_EXPERIENCE_COPY["role_insight_titles"]["mixed"],
            "description": f"{mixed_count} de {teams_count} equipos usan a su veterano en roles mixtos",
        }
    if starter_count >= substitute_count:
        return {
            "eyebrow": TEAM_EXPERIENCE_COPY["role_insight_eyebrow"],
            "title": TEAM_EXPERIENCE_COPY["role_insight_titles"]["mostly_starter"],
            "description": f"{starter_count} de {teams_count} equipos usan a su veterano como titular",
        }
    return {
        "eyebrow": TEAM_EXPERIENCE_COPY["role_insight_eyebrow"],
        "title": TEAM_EXPERIENCE_COPY["role_insight_titles"]["mostly_substitute"],
        "description": f"{substitute_count} de {teams_count} equipos usan a su veterano como suplente",
    }


def _build_leader_description(key: str, value: str, raw_value: Any = None) -> str:
    if key == "most_experienced":
        return "Es el equipo con la edad promedio más alta del contexto."
    if key == "best_veteran":
        if value == TEAM_EXPERIENCE_COPY["no_performance_data"]:
            return "No hay rendimiento registrado para comparar a los veteranos."
        return "Es el jugador más experimentado que mejor rindió en este contexto."
    if key == "widest_gap":
        return "Distancia entre el jugador más joven y el más experimentado del equipo."
    if key == "highest_advantage":
        numeric = _safe_optional_number(raw_value)
        if numeric is None:
            return "No hay rendimiento registrado para comparar con el equipo."
        if numeric > 0:
            return f"El veterano rinde {numeric:.1f} pts por encima del promedio de su equipo."
        if numeric < 0:
            return f"El veterano rinde {abs(numeric):.1f} pts por debajo del promedio de su equipo."
        return "El veterano rinde igual que el promedio del equipo."
    return ""


def _build_leaders(leaders: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for spec in TEAM_EXPERIENCE_COPY["leaders"]:
        subject = TEAM_EXPERIENCE_COPY["no_data"]
        value = TEAM_EXPERIENCE_COPY["no_data"]
        if spec["key"] == "most_experienced":
            subject = leaders.get("most_experienced_team") or TEAM_EXPERIENCE_COPY["no_data"]
            value = _format_avg_age(leaders.get("most_experienced_team_avg_age"))
        elif spec["key"] == "best_veteran":
            subject = leaders.get("best_veteran_player") or TEAM_EXPERIENCE_COPY["no_data"]
            team = leaders.get("best_veteran_team")
            if team:
                subject = f"{subject} - {team}"
            value = _format_percent(leaders.get("best_veteran_performance_pct"))
        elif spec["key"] == "widest_gap":
            subject = leaders.get("widest_age_gap_team") or TEAM_EXPERIENCE_COPY["no_data"]
            value = _format_age(leaders.get("widest_age_gap_years"))
        elif spec["key"] == "highest_advantage":
            subject = leaders.get("highest_veteran_advantage_team") or TEAM_EXPERIENCE_COPY["no_data"]
            value = _format_gap(leaders.get("highest_veteran_advantage_pct"))
        items.append(
            {
                "label": spec["label"],
                "subject": subject,
                "value": value,
                "description": _build_leader_description(
                    spec["key"],
                    value,
                    leaders.get("highest_veteran_advantage_pct") if spec["key"] == "highest_advantage" else None,
                ),
            }
        )
    return items


def _build_range_chart_model(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if len(rows) < 2:
        return None
    valid_youngest = [item["youngestAge"] for item in rows if item.get("youngestAge") is not None]
    valid_veteran = [item["veteranAge"] for item in rows if item.get("veteranAge") is not None]
    if not valid_youngest or not valid_veteran:
        return None
    min_age = min(valid_youngest)
    max_age = max(valid_veteran)
    span = max(max_age - min_age, 1)

    def to_percent(age: float | None) -> float:
        numeric = age if age is not None else min_age
        return max(0.0, min(100.0, ((numeric - min_age) / span) * 100))

    return {
        "title": TEAM_EXPERIENCE_COPY["chart_title"],
        "explanation": TEAM_EXPERIENCE_COPY["chart_explanation"],
        "scaleMinLabel": _format_age(min_age),
        "scaleMaxLabel": _format_age(max_age),
        "items": [
            {
                "team": row["team"],
                "country": row["country"],
                "veteranPlayer": row["veteranPlayer"],
                "veteranRoleLabel": row["veteranRoleLabel"],
                "youngestAgeLabel": row["youngestAgeLabel"],
                "teamAverageAgeLabel": row["teamAvgAgeLabel"],
                "veteranAgeLabel": row["veteranAgeLabel"],
                "tooltipLabel": f"Más joven: {row['youngestAgeLabel']} · Promedio: {row['teamAvgAgeLabel']} · Veterano: {row['veteranAgeLabel']}",
                "startPercent": to_percent(row.get("youngestAge")),
                "widthPercent": max(to_percent(row.get("veteranAge")) - to_percent(row.get("youngestAge")), 2.0),
                "averagePercent": to_percent(row.get("teamAvgAge")),
            }
            for row in rows
        ],
    }


def _build_profile_model(row: dict[str, Any], context: str) -> dict[str, Any]:
    metrics = [
        {"label": "Veterano", "value": row["veteranPlayer"]},
        {"label": "Rol", "value": row["veteranRoleLabel"]},
        {"label": "Edad del veterano", "value": row["veteranAgeLabel"]},
        {"label": "Edad promedio", "value": row["teamAvgAgeLabel"]},
        {"label": "Rendimiento del veterano", "value": row["veteranPerformanceLabel"]},
        {"label": "Diferencia vs equipo", "value": row["veteranGapLabel"]},
        {"label": "Rango de edades", "value": row["ageSpanLabel"]},
    ]
    if context in {"competition", "country_competition"}:
        metrics.append({"label": "Resultado en la competencia", "value": row["competitionResultLabel"]})
    else:
        metrics.append({"label": "Competiciones", "value": row["competitionsCountLabel"]})
    return {
        "team": row["team"],
        "country": row["country"],
        "veteranPlayer": row["veteranPlayer"],
        "roleLabel": row["veteranRoleLabel"],
        "summary": TEAM_EXPERIENCE_COPY["profile"]["summary"],
        "metrics": metrics,
    }


def build_team_experience_view(
    snapshot: dict[str, Any],
    *,
    country: str = "",
    competition: str = "",
    search: str = "",
) -> dict[str, Any]:
    filter_ready = snapshot.get("filter_ready", {})
    context = _resolve_context(country, competition)
    if context == "country_competition":
        summary_rows = filter_ready.get("team_experience_summary_by_country_competition", [])
        profile_rows = filter_ready.get("team_experience_profiles_by_country_competition", [])
        leader_rows = filter_ready.get("team_experience_leaders_by_country_competition", [])
        summary = next((row for row in summary_rows if row.get("country") == country and row.get("competition_name") == competition), None)
        profiles = [row for row in profile_rows if row.get("country") == country and row.get("competition_name") == competition]
        leaders = next((row for row in leader_rows if row.get("country") == country and row.get("competition_name") == competition), {})
    elif context == "country":
        summary_rows = filter_ready.get("team_experience_summary_by_country", [])
        profile_rows = filter_ready.get("team_experience_profiles_by_country", [])
        leader_rows = filter_ready.get("team_experience_leaders_by_country", [])
        summary = next((row for row in summary_rows if row.get("country") == country), None)
        profiles = [row for row in profile_rows if row.get("country") == country]
        leaders = next((row for row in leader_rows if row.get("country") == country), {})
    elif context == "competition":
        summary_rows = filter_ready.get("team_experience_summary_by_competition", [])
        profile_rows = filter_ready.get("team_experience_profiles_by_competition", [])
        leader_rows = filter_ready.get("team_experience_leaders_by_competition", [])
        summary = next((row for row in summary_rows if row.get("competition_name") == competition), None)
        profiles = [row for row in profile_rows if row.get("competition_name") == competition]
        leaders = next((row for row in leader_rows if row.get("competition_name") == competition), {})
    else:
        summary = snapshot.get("team_experience_summary") or None
        profiles = snapshot.get("team_experience_profiles", [])
        leaders = snapshot.get("team_experience_leaders", {})

    rows = _build_rows(profiles)
    if not rows:
        return {
            "visible": True,
            "context": context,
            "title": TEAM_EXPERIENCE_COPY["title"],
            "subtitle": TEAM_EXPERIENCE_COPY["subtitle"],
            "contextLabel": _context_label(context, country=country, competition=competition),
            "leaders": [],
            "roleInsight": None,
            "rangeChartModel": None,
            "profileMode": None,
            "compareMode": None,
            "tableModel": None,
            "emptyState": {"message": TEAM_EXPERIENCE_COPY["empty"]},
        }

    role_insight = _build_role_insight(summary or {})
    view = {
        "visible": True,
        "context": context,
        "title": TEAM_EXPERIENCE_COPY["title"],
        "subtitle": TEAM_EXPERIENCE_COPY["subtitle"],
        "contextLabel": _context_label(context, country=country, competition=competition),
        "leaders": _build_leaders(leaders or {}),
        "roleInsight": role_insight,
        "rangeChartModel": _build_range_chart_model(rows),
        "tableModel": None,
        "emptyState": None,
        "profileMode": None,
        "compareMode": None,
    }
    if len(rows) == 1:
        view["profileMode"] = _build_profile_model(rows[0], context)
    else:
        view["compareMode"] = {"teamCount": len(rows)}
        view["tableModel"] = {
            "title": _table_title(context, country=country, competition=competition),
            "columns": [{"label": label} for label in TEAM_EXPERIENCE_COPY["table_columns"][context]],
            "rows": rows,
        }
    return view


def generate_validation_markdown(snapshot: dict[str, Any]) -> str:
    cases = [
        ("Global", build_team_experience_view(snapshot)),
        ("Pais: Ecuador", build_team_experience_view(snapshot, country="Ecuador", search="Carlos Hernandez")),
        (
            "Pais + competencia: Bolivia / Masters Latam 2025",
            build_team_experience_view(snapshot, country="Bolivia", competition="Masters Latam 2025", search="Pedro Martinez"),
        ),
        (
            "Pais + competencia: Chile / Torneo del Caribe 2024",
            build_team_experience_view(snapshot, country="Chile", competition="Torneo del Caribe 2024"),
        ),
    ]

    lines = [
        "# Validacion - Experiencia del equipo vs Front",
        "",
        "Documento generado desde `src/etl/team_experience_expected_values.py`.",
        "",
    ]
    for title, view in cases:
        lines.extend([
            f"## {title}",
            f"- titulo: `{view['title']}`",
            f"- subtitulo: `{view['subtitle']}`",
            f"- contexto: `{view['contextLabel']}`",
            f"- modo: `{'profileMode' if view['profileMode'] else 'compareMode' if view['compareMode'] else 'emptyState'}`",
            f"- insight de rol: `{(view['roleInsight'] or {}).get('title', TEAM_EXPERIENCE_COPY['empty'])}`",
            f"- visual principal: `{(view['rangeChartModel'] or {}).get('title', TEAM_EXPERIENCE_COPY['profile']['title'])}`",
            "",
        ])
        if view["leaders"]:
            lines.append("### Leaders")
            for leader in view["leaders"]:
                lines.append(f"- {leader['label']}: {leader['subject']} -> {leader['value']} ({leader['description']})")
            lines.append("")
        if view["profileMode"]:
            lines.append("### Perfil")
            lines.append(f"- equipo: {view['profileMode']['team']}")
            lines.append(f"- veterano: {view['profileMode']['veteranPlayer']}")
            lines.append(f"- rol: {view['profileMode']['roleLabel']}")
            lines.append("")
        else:
            lines.append("### Tabla")
            lines.append(f"- filas: {len(view['tableModel']['rows']) if view['tableModel'] else 0}")
            lines.append(f"- columnas: {', '.join(column['label'] for column in (view['tableModel']['columns'] if view['tableModel'] else []))}")
            for row in (view["tableModel"]["rows"] if view["tableModel"] else [])[:2]:
                lines.append(
                    f"- fila: {row['team']} | {row['veteranPlayer']} | {row['veteranRoleLabel']} | "
                    f"{row['veteranPerformanceLabel']} | {row['competitionResultLabel']}"
                )
            lines.append("")

    return "\n".join(lines).strip() + "\n"


def write_validation_doc(snapshot: dict[str, Any], path: Path = DEFAULT_DOC_PATH) -> Path:
    markdown = generate_validation_markdown(snapshot)
    path.write_text(markdown, encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate expected values doc for team experience")
    parser.add_argument("--snapshot", type=Path, default=SNAPSHOT_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_DOC_PATH)
    args = parser.parse_args()

    snapshot = load_dashboard_snapshot(args.snapshot)
    target = write_validation_doc(snapshot, args.output)
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
