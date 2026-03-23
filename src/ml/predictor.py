"""
eSports Analytics Dashboard - ML Predictor
==========================================

Trains a Random Forest regressor on historical player statistics and
produces a premium annual projection bundle for 2026 while preserving
the legacy `predictions_2026` output.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score

logger = logging.getLogger(__name__)

_FEATURES = [
    "edad",
    "trabajo_en_equipo",
    "partidos_jugados",
    "partidos_ganados",
    "minutos_jugados",
    "win_loss_ratio",
    "minutes_per_match",
]

_TARGET = "porcentaje_victorias"
_PREDICTION_YEAR = 2026

_FEATURE_LABELS = {
    "edad": "Edad",
    "trabajo_en_equipo": "Trabajo en equipo",
    "partidos_jugados": "Partidas jugadas",
    "partidos_ganados": "Partidas ganadas",
    "minutos_jugados": "Minutos jugados",
    "win_loss_ratio": "Ratio victorias/derrotas",
    "minutes_per_match": "Minutos por partida",
}

_SQL_TRAINING_DATA = """
    SELECT
        j.jugador_id,
        j.nombre,
        j.edad,
        j.trabajo_en_equipo,
        e.anio,
        e.partidos_jugados,
        e.partidos_ganados,
        e.minutos_jugados,
        e.porcentaje_victorias,
        eq.nombre AS equipo,
        pn.nombre AS nacionalidad,
        pt.nombre AS team_country
    FROM estadisticas_jugador e
    JOIN jugadores j ON e.jugador_id = j.jugador_id
    JOIN equipos eq ON j.equipo_id = eq.equipo_id
    JOIN paises pn ON j.nacionalidad_id = pn.pais_id
    JOIN paises pt ON eq.pais_id = pt.pais_id
    ORDER BY j.jugador_id, e.anio
"""


def _round_float(value: Any, digits: int = 1) -> float:
    return round(float(value), digits)


def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    losses = df["partidos_jugados"] - df["partidos_ganados"]
    df["win_loss_ratio"] = df["partidos_ganados"] / losses.replace(0, 1)
    df["minutes_per_match"] = df["minutos_jugados"] / df["partidos_jugados"].replace(0, 1)
    return df


def _build_prediction_features(df: pd.DataFrame) -> pd.DataFrame:
    latest = df.sort_values("anio").groupby("jugador_id").last().reset_index()
    year_gap = _PREDICTION_YEAR - latest["anio"]
    latest["edad"] = latest["edad"] + year_gap
    return latest


def _train_model(X_train: pd.DataFrame, y_train: pd.Series) -> RandomForestRegressor:
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=5,
        min_samples_split=3,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    cv = min(5, len(X_train))
    if cv >= 2:
        cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="r2")
        logger.info(
            "Cross-validation R² scores: %s | Mean: %.3f",
            [round(score, 3) for score in cv_scores],
            cv_scores.mean(),
        )

    model.fit(X_train, y_train)
    logger.info(
        "Feature importances: %s",
        sorted(zip(_FEATURES, model.feature_importances_), key=lambda item: item[1], reverse=True),
    )
    return model


def _normalize_confidence_scores(stds: np.ndarray) -> np.ndarray:
    if stds.size == 0:
        return np.array([], dtype=float)
    min_std = float(np.nanmin(stds))
    max_std = float(np.nanmax(stds))
    spread = max_std - min_std
    if spread <= 0:
        return np.full_like(stds, 100.0, dtype=float)
    normalized = 100.0 * (1.0 - ((stds - min_std) / spread))
    return np.clip(normalized, 0.0, 100.0)


def _classify_confidence_band(score: float) -> str:
    if score >= 70:
        return "Alta"
    if score >= 40:
        return "Media"
    return "Baja"


def _classify_risk_band(delta: float, confidence_score: float) -> str:
    if delta >= 3.0 and confidence_score >= 55:
        return "Salto esperado"
    if delta <= -3.0 and confidence_score >= 55:
        return "Riesgo de caída"
    if abs(delta) <= 1.5 and confidence_score >= 50:
        return "Estable"
    return "A observar"


def _classify_trend(delta: float) -> str:
    if delta > 2:
        return "Improved"
    if delta < -2:
        return "Declined"
    return "Stable"


def _build_feature_importance_rows(feature_importances: Dict[str, float]) -> List[Dict[str, Any]]:
    total = sum(max(float(value), 0.0) for value in feature_importances.values()) or 1.0
    rows = []
    for rank, (feature_key, importance) in enumerate(
        sorted(feature_importances.items(), key=lambda item: item[1], reverse=True),
        start=1,
    ):
        rows.append(
            {
                "feature_key": feature_key,
                "feature_label": _FEATURE_LABELS.get(feature_key, feature_key.replace("_", " ").title()),
                "importance_pct": round((max(float(importance), 0.0) / total) * 100.0, 1),
                "rank": rank,
            }
        )
    return rows


def _build_team_summary_rows(players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[tuple[str, str], List[Dict[str, Any]]] = {}
    for row in players:
        grouped.setdefault((row["team"], row["team_country"]), []).append(row)

    team_rows: List[Dict[str, Any]] = []
    for (team, country), members in grouped.items():
        improved = sum(1 for member in members if member["trend"] == "Improved")
        declined = sum(1 for member in members if member["trend"] == "Declined")
        top_player = max(members, key=lambda member: (member["predicted_winrate"], member["delta"], member["player_name"]))
        team_rows.append(
            {
                "team": team,
                "country": country,
                "players_count": len(members),
                "actual_avg_winrate": round(sum(member["actual_winrate"] for member in members) / len(members), 1),
                "projected_avg_winrate": round(sum(member["predicted_winrate"] for member in members) / len(members), 1),
                "avg_delta": round(sum(member["delta"] for member in members) / len(members), 1),
                "improved_players_count": improved,
                "declined_players_count": declined,
                "top_projected_player": top_player["player_name"],
                "top_projected_winrate": top_player["predicted_winrate"],
            }
        )

    team_rows.sort(key=lambda row: (-row["projected_avg_winrate"], -row["avg_delta"], row["team"]))
    return team_rows


def _build_country_summary_rows(players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for row in players:
        grouped.setdefault(row["team_country"], []).append(row)

    country_rows: List[Dict[str, Any]] = []
    for country, members in grouped.items():
        improved = sum(1 for member in members if member["trend"] == "Improved")
        declined = sum(1 for member in members if member["trend"] == "Declined")
        top_player = max(members, key=lambda member: (member["predicted_winrate"], member["delta"], member["player_name"]))
        country_rows.append(
            {
                "country": country,
                "players_count": len(members),
                "actual_avg_winrate": round(sum(member["actual_winrate"] for member in members) / len(members), 1),
                "projected_avg_winrate": round(sum(member["predicted_winrate"] for member in members) / len(members), 1),
                "avg_delta": round(sum(member["delta"] for member in members) / len(members), 1),
                "improved_players_count": improved,
                "declined_players_count": declined,
                "top_projected_player": top_player["player_name"],
                "top_projected_winrate": top_player["predicted_winrate"],
            }
        )

    country_rows.sort(key=lambda row: (-row["projected_avg_winrate"], -row["avg_delta"], row["country"]))
    return country_rows


def _build_summary_row(players: List[Dict[str, Any]], team_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not players:
        return {}

    best_projected = max(players, key=lambda row: (row["predicted_winrate"], row["delta"], row["player_name"]))
    biggest_improvement = max(players, key=lambda row: (row["delta"], row["predicted_winrate"], row["player_name"]))
    biggest_decline = min(players, key=lambda row: (row["delta"], -row["predicted_winrate"], row["player_name"]))
    best_team = (
        max(
            team_rows,
            key=lambda row: (row["projected_avg_winrate"], row["avg_delta"], row["players_count"], row["team"]),
        )
        if team_rows
        else None
    )

    return {
        "players_count": len(players),
        "improved_players_count": sum(1 for row in players if row["trend"] == "Improved"),
        "declined_players_count": sum(1 for row in players if row["trend"] == "Declined"),
        "stable_players_count": sum(1 for row in players if row["trend"] == "Stable"),
        "best_projected_player": best_projected["player_name"],
        "best_projected_winrate": best_projected["predicted_winrate"],
        "biggest_improvement_player": biggest_improvement["player_name"],
        "biggest_improvement_delta": biggest_improvement["delta"],
        "biggest_decline_player": biggest_decline["player_name"],
        "biggest_decline_delta": biggest_decline["delta"],
        "best_projected_team": best_team["team"] if best_team else "",
        "best_projected_team_avg_winrate": best_team["projected_avg_winrate"] if best_team else None,
    }


def _legacy_row(player: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": player["player_name"],
        "team": player["team"],
        "nationality": player["player_nationality"],
        "age_2026": player["age_2026"],
        "actual_winrate": player["actual_winrate"],
        "predicted_winrate": player["predicted_winrate"],
        "delta": player["delta"],
        "trend": player["trend"],
    }


def _build_projection_bundle_from_rows(
    rows: Iterable[Dict[str, Any]],
    feature_importances: Dict[str, float],
) -> Dict[str, Any]:
    players: List[Dict[str, Any]] = []
    for row in rows:
        player = dict(row)
        players.append(
            {
                "player_name": player["player_name"],
                "team": player["team"],
                "team_country": player["team_country"],
                "player_nationality": player["player_nationality"],
                "age_2026": int(player["age_2026"]),
                "actual_winrate": _round_float(player["actual_winrate"]),
                "predicted_winrate": _round_float(player["predicted_winrate"]),
                "delta": _round_float(player["delta"]),
                "trend": player["trend"],
                "confidence_score": _round_float(player["confidence_score"]),
                "confidence_band": player["confidence_band"],
                "risk_band": player["risk_band"],
                "projected_rank": 0,
            }
        )

    players.sort(key=lambda row: (-row["predicted_winrate"], -row["delta"], row["player_name"]))
    for index, player in enumerate(players, start=1):
        player["projected_rank"] = index

    team_rows = _build_team_summary_rows(players)
    country_rows = _build_country_summary_rows(players)
    summary = _build_summary_row(players, team_rows)
    feature_rows = _build_feature_importance_rows(feature_importances)

    summary_by_country: List[Dict[str, Any]] = []
    players_by_country: List[Dict[str, Any]] = []
    team_summary_by_country: List[Dict[str, Any]] = []
    country_summary_by_country: List[Dict[str, Any]] = []

    grouped_countries: Dict[str, List[Dict[str, Any]]] = {}
    for player in players:
        grouped_countries.setdefault(player["team_country"], []).append(player)

    for country, members in grouped_countries.items():
        filtered_team_rows = [row for row in team_rows if row["country"] == country]
        country_summary = _build_summary_row(members, filtered_team_rows)
        country_summary["country"] = country
        summary_by_country.append(country_summary)

        for player in members:
            players_by_country.append({"country": country, **player})

        for team_row in filtered_team_rows:
            team_summary_by_country.append({"country": country, **team_row})

        country_row = next((row for row in country_rows if row["country"] == country), None)
        if country_row:
            country_summary_by_country.append(dict(country_row))

    summary_by_country.sort(key=lambda row: row["country"])
    players_by_country.sort(key=lambda row: (row["country"], row["projected_rank"], row["player_name"]))
    team_summary_by_country.sort(key=lambda row: (row["country"], -row["projected_avg_winrate"], row["team"]))
    country_summary_by_country.sort(key=lambda row: row["country"])

    return {
        "predictions_2026": [_legacy_row(player) for player in players],
        "summary": summary,
        "players": players,
        "team_summary": team_rows,
        "country_summary": country_rows,
        "feature_importance": feature_rows,
        "filter_ready": {
            "ml_projection_2026_summary_by_country": summary_by_country,
            "ml_projection_2026_players_by_country": players_by_country,
            "ml_projection_2026_team_summary_by_country": team_summary_by_country,
            "ml_projection_2026_country_summary_by_country": country_summary_by_country,
        },
    }


def _build_player_projection_rows(
    pred_df: pd.DataFrame,
    predictions: np.ndarray,
    confidence_scores: np.ndarray,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for idx, row in pred_df.reset_index(drop=True).iterrows():
        actual = _round_float(row["porcentaje_victorias"])
        predicted = _round_float(predictions[idx])
        delta = _round_float(predicted - actual)
        confidence = _round_float(confidence_scores[idx])
        rows.append(
            {
                "player_name": row["nombre"],
                "team": row["equipo"],
                "team_country": row["team_country"],
                "player_nationality": row["nacionalidad"],
                "age_2026": int(row["edad"]),
                "actual_winrate": actual,
                "predicted_winrate": predicted,
                "delta": delta,
                "trend": _classify_trend(delta),
                "confidence_score": confidence,
                "confidence_band": _classify_confidence_band(confidence),
                "risk_band": _classify_risk_band(delta, confidence),
            }
        )
    return rows


def generate_ml_projection_bundle(conn: Any) -> Dict[str, Any]:
    logger.info("--- ML PREDICT phase started ---")
    df = pd.read_sql(_SQL_TRAINING_DATA, conn)
    logger.info("Extracted %d stat records for %d players.", len(df), df["jugador_id"].nunique())

    if df.empty:
        logger.warning("No data available for ML training. Skipping.")
        return {
            "predictions_2026": [],
            "ml_projection_2026_summary": {},
            "ml_projection_2026_players": [],
            "ml_projection_2026_team_summary": [],
            "ml_projection_2026_country_summary": [],
            "ml_projection_2026_feature_importance": [],
            "filter_ready": {
                "ml_projection_2026_summary_by_country": [],
                "ml_projection_2026_players_by_country": [],
                "ml_projection_2026_team_summary_by_country": [],
                "ml_projection_2026_country_summary_by_country": [],
            },
        }

    numeric_columns = [
        "edad",
        "trabajo_en_equipo",
        "partidos_jugados",
        "partidos_ganados",
        "minutos_jugados",
        "porcentaje_victorias",
    ]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=[_TARGET])
    if df.empty:
        logger.warning("No rows with target values available for ML training. Skipping.")
        return {
            "predictions_2026": [],
            "ml_projection_2026_summary": {},
            "ml_projection_2026_players": [],
            "ml_projection_2026_team_summary": [],
            "ml_projection_2026_country_summary": [],
            "ml_projection_2026_feature_importance": [],
            "filter_ready": {
                "ml_projection_2026_summary_by_country": [],
                "ml_projection_2026_players_by_country": [],
                "ml_projection_2026_team_summary_by_country": [],
                "ml_projection_2026_country_summary_by_country": [],
            },
        }

    engineered = _engineer_features(df)
    X_train = engineered[_FEATURES]
    y_train = engineered[_TARGET]
    model = _train_model(X_train, y_train)

    pred_df = _build_prediction_features(engineered)
    X_pred = pred_df[_FEATURES]
    raw_predictions = model.predict(X_pred)
    predictions = np.clip(raw_predictions, 0, 100)

    tree_predictions = np.asarray([estimator.predict(X_pred) for estimator in model.estimators_], dtype=float)
    prediction_stds = tree_predictions.std(axis=0) if tree_predictions.size else np.array([], dtype=float)
    confidence_scores = _normalize_confidence_scores(prediction_stds)

    feature_importances = dict(zip(_FEATURES, model.feature_importances_))
    player_rows = _build_player_projection_rows(pred_df, predictions, confidence_scores)
    bundle = _build_projection_bundle_from_rows(player_rows, feature_importances)

    logger.info("Generated %d premium ML projections for year %d.", len(bundle["predictions_2026"]), _PREDICTION_YEAR)
    logger.info("--- ML PREDICT phase completed ---")

    return {
        "predictions_2026": bundle["predictions_2026"],
        "ml_projection_2026_summary": bundle["summary"],
        "ml_projection_2026_players": bundle["players"],
        "ml_projection_2026_team_summary": bundle["team_summary"],
        "ml_projection_2026_country_summary": bundle["country_summary"],
        "ml_projection_2026_feature_importance": bundle["feature_importance"],
        "filter_ready": bundle["filter_ready"],
    }


def generate_predictions(conn: Any) -> List[Dict[str, Any]]:
    return generate_ml_projection_bundle(conn)["predictions_2026"]
