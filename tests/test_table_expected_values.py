import unittest

from src.etl.table_expected_values import (
    build_table_context_view,
    generate_validation_markdown,
    load_dashboard_snapshot,
)


class TestTableExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_uses_teams_catalog(self):
        view = build_table_context_view(self.snapshot)

        self.assertEqual(view["mode"], "teams-overview")
        self.assertEqual(view["title"], "Equipos destacados")
        self.assertEqual(
            view["headers"],
            ["Equipo", "País", "Competiciones", "Jugadores", "Premios", "Mejor puesto"],
        )
        self.assertGreater(len(view["rows"]), 5)

    def test_country_view_hides_country_column(self):
        view = build_table_context_view(self.snapshot, country="Chile")

        self.assertEqual(view["mode"], "teams-overview")
        self.assertEqual(view["title"], "Equipos de Chile")
        self.assertEqual(
            view["headers"],
            ["Equipo", "Competiciones", "Jugadores", "Premios", "Mejor puesto"],
        )

    def test_competition_view_uses_players_when_available(self):
        view = build_table_context_view(self.snapshot, competition="Challenger Sur 2025")

        self.assertEqual(view["mode"], "players-ranking")
        self.assertEqual(view["title"], "Jugadores destacados en Challenger Sur 2025")
        self.assertEqual(
            view["headers"],
            ["Pos.", "Jugador", "Equipo", "País", "Rendimiento", "Variación anual"],
        )
        self.assertGreater(len(view["rows"]), 0)

    def test_competition_view_uses_sin_comparacion_for_missing_variation(self):
        view = build_table_context_view(self.snapshot, competition="Challenger Sur 2025")
        cristian_row = next(row for row in view["rows"] if row["Jugador"] == "Cristian Méndez")

        self.assertEqual(cristian_row["Variación anual"], "Sin comparación")
        self.assertEqual(cristian_row["_variation_tone"], "not-comparable")

    def test_competition_view_falls_back_to_teams_when_players_missing(self):
        view = build_table_context_view(self.snapshot, competition="Masters Latam 2025", country="Bolivia")

        self.assertEqual(view["mode"], "teams-results")
        self.assertEqual(view["title"], "Equipos de Bolivia en Masters Latam 2025")
        self.assertEqual(
            view["headers"],
            ["Pos.", "Equipo", "Jugadores", "Premio"],
        )
        self.assertGreater(len(view["rows"]), 0)

    def test_exact_player_returns_player_detail(self):
        view = build_table_context_view(self.snapshot, search="Matías Rojas")

        self.assertEqual(view["mode"], "player-detail")
        self.assertIn("Matías Rojas", view["title"])
        self.assertEqual(
            view["headers"],
            ["Año", "Equipo", "País", "Rendimiento", "Variación anual"],
        )
        self.assertGreater(len(view["rows"]), 0)
        self.assertEqual(view["rows"][0]["Variación anual"], "Sin comparación")
        self.assertEqual(view["rows"][0]["_variation_tone"], "not-comparable")

    def test_exact_player_with_competition_returns_competition_detail(self):
        view = build_table_context_view(
            self.snapshot,
            search="Matías Rojas",
            competition="Challenger Sur 2025",
        )

        self.assertEqual(view["mode"], "player-detail")
        self.assertEqual(view["title"], "Detalle de Matías Rojas en Challenger Sur 2025")
        self.assertEqual(
            view["headers"],
            ["Competencia", "Año", "Equipo", "País", "Rendimiento", "Variación anual"],
        )
        self.assertEqual(len(view["rows"]), 1)

    def test_exact_player_without_context_data_returns_empty_detail(self):
        view = build_table_context_view(
            self.snapshot,
            search="Cristian Méndez",
            competition="Masters Latam 2025",
        )

        self.assertEqual(view["mode"], "empty")
        self.assertEqual(view["title"], "Detalle de Cristian Méndez en Masters Latam 2025")
        self.assertEqual(view["empty_state"]["message"], "Jugador sin datos para este filtro")

    def test_markdown_contains_required_sections(self):
        markdown = generate_validation_markdown(self.snapshot)
        comparable_player = next(
            row["name"]
            for row in self.snapshot["player_evolution"]
            if row.get("performance_2024") is not None and row.get("performance_2025") is not None
        )
        comparable_competition = next(
            row["competition_name"]
            for row in self.snapshot["filter_ready"]["player_evolution_by_competition"]
            if row.get("name") == comparable_player
        )
        single_year_player = next(
            row["name"]
            for row in self.snapshot["player_evolution"]
            if (row.get("performance_2024") is None) != (row.get("performance_2025") is None)
        )
        missing_competition = next(
            competition["competition_name"]
            for competition in self.snapshot["filter_ready"]["kpis_by_competition"]
            if not any(
                row.get("competition_name") == competition["competition_name"] and row.get("name") == single_year_player
                for row in self.snapshot["filter_ready"]["player_evolution_by_competition"]
            )
        )

        self.assertIn("# Validacion Tablas vs Front", markdown)
        self.assertIn("## Estado global", markdown)
        self.assertIn("## Estados por país", markdown)
        self.assertIn("## Estados por competencia", markdown)
        self.assertIn("## Estados país + competencia", markdown)
        self.assertIn("## Estados país + competencia vacíos", markdown)
        self.assertIn("## Casos de jugador exacto", markdown)
        self.assertIn(f"{comparable_player} en {comparable_competition}", markdown)
        self.assertIn(f"{single_year_player} sin datos en {missing_competition}", markdown)
        self.assertIn("País", markdown)
        self.assertIn("Variación anual", markdown)


if __name__ == "__main__":
    unittest.main()
