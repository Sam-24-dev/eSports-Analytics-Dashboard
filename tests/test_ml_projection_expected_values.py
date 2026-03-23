import unittest

from src.etl.ml_projection_expected_values import build_ml_projection_view


class TestMLProjectionExpectedValues(unittest.TestCase):
    def _snapshot(self):
        return {
            "ml_projection_2026_summary": {
                "players_count": 12,
                "improved_players_count": 6,
                "declined_players_count": 2,
                "stable_players_count": 4,
                "best_projected_player": "Julian Torres",
                "best_projected_winrate": 79.0,
                "biggest_improvement_player": "Carlos Hernandez",
                "biggest_improvement_delta": 3.1,
                "biggest_decline_player": "Julian Torres",
                "biggest_decline_delta": -11.0,
                "best_projected_team": "Guerreros del Sol",
                "best_projected_team_avg_winrate": 59.2,
            },
            "ml_projection_2026_players": [
                {
                    "player_name": "Julian Torres",
                    "team": "Condores del Pacifico",
                    "team_country": "Peru",
                    "player_nationality": "Peru",
                    "age_2026": 26,
                    "actual_winrate": 90.0,
                    "predicted_winrate": 79.0,
                    "delta": -11.0,
                    "trend": "Declined",
                    "confidence_score": 21.0,
                    "confidence_band": "Baja",
                    "risk_band": "A observar",
                    "projected_rank": 1,
                },
                {
                    "player_name": "Carlos Hernandez",
                    "team": "Guerreros Andinos",
                    "team_country": "Ecuador",
                    "player_nationality": "Ecuador",
                    "age_2026": 23,
                    "actual_winrate": 75.0,
                    "predicted_winrate": 78.1,
                    "delta": 3.1,
                    "trend": "Improved",
                    "confidence_score": 20.0,
                    "confidence_band": "Baja",
                    "risk_band": "A observar",
                    "projected_rank": 2,
                },
                {
                    "player_name": "Mauricio Salazar",
                    "team": "Caimanes del Orinoco",
                    "team_country": "Venezuela",
                    "player_nationality": "Venezuela",
                    "age_2026": 24,
                    "actual_winrate": 44.0,
                    "predicted_winrate": 41.5,
                    "delta": -2.5,
                    "trend": "Declined",
                    "confidence_score": 55.0,
                    "confidence_band": "Media",
                    "risk_band": "A observar",
                    "projected_rank": 7,
                },
            ] + [
                {
                    "player_name": f"Jugador {index}",
                    "team": f"Equipo {index}",
                    "team_country": "Chile" if index % 2 == 0 else "Peru",
                    "player_nationality": "Chile" if index % 2 == 0 else "Peru",
                    "age_2026": 20 + index,
                    "actual_winrate": 60.0 - index,
                    "predicted_winrate": 59.0 - index,
                    "delta": 0.1,
                    "trend": "Stable",
                    "confidence_score": 50.0,
                    "confidence_band": "Media",
                    "risk_band": "Estable",
                    "projected_rank": index,
                }
                for index in range(4, 13)
            ],
            "ml_projection_2026_team_summary": [
                {
                    "team": "Condores del Pacifico",
                    "country": "Peru",
                    "players_count": 1,
                    "actual_avg_winrate": 90.0,
                    "projected_avg_winrate": 75.3,
                    "avg_delta": -5.3,
                    "improved_players_count": 0,
                    "declined_players_count": 1,
                    "top_projected_player": "Julian Torres",
                    "top_projected_winrate": 79.0,
                },
                {
                    "team": "Guerreros Andinos",
                    "country": "Ecuador",
                    "players_count": 1,
                    "actual_avg_winrate": 75.0,
                    "projected_avg_winrate": 68.2,
                    "avg_delta": 1.1,
                    "improved_players_count": 1,
                    "declined_players_count": 0,
                    "top_projected_player": "Carlos Hernandez",
                    "top_projected_winrate": 78.1,
                },
            ],
            "ml_projection_2026_country_summary": [
                {
                    "country": "Peru",
                    "players_count": 4,
                    "actual_avg_winrate": 67.5,
                    "projected_avg_winrate": 68.5,
                    "avg_delta": 1.0,
                    "improved_players_count": 3,
                    "declined_players_count": 1,
                    "top_projected_player": "Julian Torres",
                    "top_projected_winrate": 79.0,
                },
                {
                    "country": "Ecuador",
                    "players_count": 4,
                    "actual_avg_winrate": 68.0,
                    "projected_avg_winrate": 66.9,
                    "avg_delta": 0.8,
                    "improved_players_count": 3,
                    "declined_players_count": 0,
                    "top_projected_player": "Carlos Hernandez",
                    "top_projected_winrate": 78.1,
                },
            ],
            "ml_projection_2026_feature_importance": [
                {
                    "feature_key": "win_loss_ratio",
                    "feature_label": "Ratio victorias/derrotas",
                    "importance_pct": 93.7,
                    "rank": 1,
                }
            ],
            "filter_ready": {
                "ml_projection_2026_summary_by_country": [
                    {
                        "country": "Ecuador",
                        "players_count": 2,
                        "improved_players_count": 2,
                        "declined_players_count": 0,
                        "stable_players_count": 0,
                        "best_projected_player": "Carlos Hernandez",
                        "best_projected_winrate": 78.1,
                        "biggest_improvement_player": "Carlos Hernandez",
                        "biggest_improvement_delta": 3.1,
                        "biggest_decline_player": "",
                        "biggest_decline_delta": None,
                        "best_projected_team": "Guerreros Andinos",
                        "best_projected_team_avg_winrate": 78.1,
                    }
                ],
                "ml_projection_2026_players_by_country": [
                    {
                        "country": "Ecuador",
                        "player_name": "Carlos Hernandez",
                        "team": "Guerreros Andinos",
                        "team_country": "Ecuador",
                        "player_nationality": "Ecuador",
                        "age_2026": 23,
                        "actual_winrate": 75.0,
                        "predicted_winrate": 78.1,
                        "delta": 3.1,
                        "trend": "Improved",
                        "confidence_score": 20.0,
                        "confidence_band": "Baja",
                        "risk_band": "A observar",
                        "projected_rank": 1,
                    },
                    {
                        "country": "Ecuador",
                        "player_name": "Jugador Zebra",
                        "team": "Lobos Urbanos",
                        "team_country": "Ecuador",
                        "player_nationality": "Ecuador",
                        "age_2026": 24,
                        "actual_winrate": 60.0,
                        "predicted_winrate": 60.5,
                        "delta": 0.4,
                        "trend": "Stable",
                        "confidence_score": 50.0,
                        "confidence_band": "Media",
                        "risk_band": "Estable",
                        "projected_rank": 11,
                    },
                ],
                "ml_projection_2026_team_summary_by_country": [
                    {
                        "country": "Ecuador",
                        "team": "Guerreros Andinos",
                        "players_count": 1,
                        "actual_avg_winrate": 75.0,
                        "projected_avg_winrate": 78.1,
                        "avg_delta": 3.1,
                        "improved_players_count": 1,
                        "declined_players_count": 0,
                        "top_projected_player": "Carlos Hernandez",
                        "top_projected_winrate": 78.1,
                    }
                ],
                "ml_projection_2026_country_summary_by_country": [
                    {
                        "country": "Ecuador",
                        "players_count": 2,
                        "actual_avg_winrate": 67.0,
                        "projected_avg_winrate": 69.3,
                        "avg_delta": 1.8,
                        "improved_players_count": 1,
                        "declined_players_count": 0,
                        "top_projected_player": "Carlos Hernandez",
                        "top_projected_winrate": 78.1,
                    }
                ],
            },
        }

    def test_build_ml_projection_view_global(self):
        view = build_ml_projection_view(self._snapshot())

        self.assertTrue(view["visible"])
        self.assertEqual(view["context"], "global")
        self.assertEqual(view["insights"][0]["subject"], "Julian Torres")
        self.assertEqual(view["insights"][2]["label"], "Mayor baja vs actual")
        self.assertEqual(view["insights"][2]["subject"], "Mauricio Salazar")
        self.assertEqual(view["insights"][3]["subject"], "Condores del Pacifico")
        self.assertEqual(view["aggregatePanel"]["countrySpotlight"]["country"], "Peru")
        self.assertEqual(view["featurePanel"]["title"], "Qué pesa más en el modelo global")
        self.assertEqual(view["watchlists"]["watchTitle"], "Top proyección 2026")
        self.assertTrue(view["tableModel"]["showToggle"])
        self.assertEqual(view["tableModel"]["visibleCount"], 10)
        self.assertIn("Mejora", view["tableModel"]["columns"])
        self.assertIn("Consistencia modelo", view["tableModel"]["columns"])

    def test_build_ml_projection_view_country_with_competition_note(self):
        view = build_ml_projection_view(
            self._snapshot(),
            country="Ecuador",
            competition="Masters Latam 2025",
        )

        self.assertEqual(view["context"], "country")
        self.assertEqual(
            view["competitionNote"],
            "La proyección 2026 es anual y no se segmenta por competencia.",
        )
        self.assertEqual(view["contextLabel"], "Así proyectan los jugadores de equipos de Ecuador en 2026")
        self.assertFalse(view["tableModel"]["showToggle"])


if __name__ == "__main__":
    unittest.main()
