import unittest

from src.etl.team_comparison_expected_values import (
    build_team_comparison_view,
    generate_validation_markdown,
    list_valid_filters,
    load_dashboard_snapshot,
)


class TestTeamComparisonExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_returns_compare_mode_without_radar(self):
        view = build_team_comparison_view(self.snapshot)

        self.assertTrue(view["visible"])
        self.assertEqual(view["context"], "global")
        self.assertEqual(view["title"], "Comparativa de equipos")
        self.assertEqual(view["subtitle"], "C\u00f3mo compiten los equipos seg\u00fan el contexto")
        self.assertEqual(view["contextLabel"], "Vista general de equipos")
        self.assertEqual(len(view["leaders"]), 4)
        self.assertIsNotNone(view["compareMode"])
        self.assertIsNone(view["profileMode"])
        self.assertIsNone(view["radarModel"])
        self.assertEqual(view["leaders"][3]["label"], "Mayor parte del premio total")
        self.assertEqual(
            view["tableModel"]["columns"],
            ["Equipo", "Pa\u00eds", "Competiciones", "% de victorias", "Trabajo en equipo", "Mejor puesto", "Premios"],
        )

    def test_country_view_keeps_country_context_even_with_search(self):
        view = build_team_comparison_view(self.snapshot, country="Ecuador", search="Carlos Hernandez")

        self.assertEqual(view["context"], "country")
        self.assertEqual(view["contextLabel"], "As\u00ed compiten los equipos de Ecuador")
        self.assertIsNotNone(view["compareMode"])
        self.assertIsNone(view["profileMode"])
        self.assertEqual(
            view["tableModel"]["columns"],
            ["Equipo", "Competiciones", "% de victorias", "Trabajo en equipo", "Mejor puesto", "Premios"],
        )
        self.assertEqual(view["tableModel"]["rows"][0]["team"], "Guerreros Andinos")
        self.assertEqual(view["leaders"][0]["description"], "Puntaje promedio m\u00e1s alto del contexto")
        self.assertEqual(view["leaders"][3]["label"], "Equipo con m\u00e1s premios")
        self.assertEqual(view["leaders"][3]["description"], "Concentr\u00f3 el 40.9% de los premios de Ecuador")

    def test_competition_view_uses_competition_columns(self):
        view = build_team_comparison_view(self.snapshot, competition="Copa Andina 2024")

        self.assertEqual(view["context"], "competition")
        self.assertEqual(view["contextLabel"], "As\u00ed compitieron los equipos en Copa Andina 2024")
        self.assertIsNotNone(view["compareMode"])
        self.assertEqual(
            view["tableModel"]["columns"],
            ["Equipo", "Pa\u00eds", "% de victorias", "Trabajo en equipo", "Resultado en la competencia", "Premios"],
        )
        self.assertEqual(view["leaders"][2]["value"], "#1")
        self.assertEqual(view["leaders"][3]["label"], "Mayor parte del premio total")
        self.assertEqual(view["leaders"][3]["description"], "Se llev\u00f3 el 50.0% del premio total de esta competencia")
        self.assertIsNone(view["radarModel"])

    def test_country_competition_view_uses_profile_mode(self):
        view = build_team_comparison_view(
            self.snapshot,
            country="Bolivia",
            competition="Masters Latam 2025",
            search="Pedro Martinez",
        )

        self.assertEqual(view["context"], "country_competition")
        self.assertEqual(view["contextLabel"], "As\u00ed compiti\u00f3 Bolivia en Masters Latam 2025")
        self.assertIsNone(view["compareMode"])
        self.assertIsNotNone(view["profileMode"])
        self.assertEqual(view["profileMode"]["team"], "Cóndores Rojos")
        self.assertEqual(view["profileMode"]["summary"], "Solo hay un equipo en este contexto.")
        self.assertEqual(view["leaders"][3]["label"], "Equipo con m\u00e1s premios")
        self.assertEqual(
            view["leaders"][3]["description"],
            "Concentr\u00f3 el 100.0% de los premios de Bolivia en Masters Latam 2025",
        )
        self.assertEqual(
            view["tableModel"]["columns"],
            ["Equipo", "% de victorias", "Trabajo en equipo", "Resultado en la competencia", "Premios"],
        )
        self.assertEqual(view["profileMode"]["metrics"][2]["label"], "Resultado en la competencia")

    def test_bolivia_uses_readable_victory_fallback(self):
        view = build_team_comparison_view(self.snapshot, country="Bolivia")

        self.assertEqual(view["tableModel"]["rows"][0]["victoryRateLabel"], "Sin registro de victorias")
        self.assertEqual(view["profileMode"]["metrics"][1]["value"], "Sin registro de victorias")
        self.assertEqual(view["leaders"][3]["label"], "Equipo con m\u00e1s premios")
        self.assertEqual(view["leaders"][3]["description"], "Concentr\u00f3 el 100.0% de los premios de Bolivia")

    def test_competition_rows_use_readable_position_fallback(self):
        view = build_team_comparison_view(self.snapshot, country="Chile", competition="Torneo del Caribe 2024")

        self.assertEqual(view["tableModel"]["rows"][1]["competitionResultLabel"], "Sin puesto final registrado")

    def test_frontend_copy_avoids_legacy_technical_labels(self):
        markdown = generate_validation_markdown(self.snapshot)

        self.assertIn("Comparativa de equipos", markdown)
        self.assertIn("Trabajo en equipo", markdown)
        self.assertIn("% de victorias", markdown)
        self.assertIn("Sin registro de victorias", markdown)
        self.assertIn("Sin puesto final registrado", markdown)
        self.assertIn("Mayor parte del premio total", markdown)
        self.assertIn("Equipo con m\u00e1s premios", markdown)
        self.assertNotIn("Winrate", markdown)
        self.assertNotIn("Teamwork", markdown)
        self.assertNotIn("Plantel (norm.)", markdown)
        self.assertNotIn("Premios (norm.)", markdown)
        self.assertNotIn("Radar comparativo", markdown)

    def test_list_valid_filters_contains_expected_entries(self):
        filters = list_valid_filters(self.snapshot)

        self.assertIn("Bolivia", filters["countries"])
        self.assertIn("Copa Andina 2024", filters["competitions"])
        self.assertIn(("Bolivia", "Masters Latam 2025"), filters["country_competition_pairs"])

    def test_markdown_contains_required_sections(self):
        markdown = generate_validation_markdown(self.snapshot)

        self.assertIn("# Validacion Comparativa de equipos vs Front", markdown)
        self.assertIn("## Estado global", markdown)
        self.assertIn("## Estados por pais", markdown)
        self.assertIn("## Estados por competencia", markdown)
        self.assertIn("## Estados pais + competencia validos", markdown)
        self.assertIn("## Casos controlados", markdown)
        self.assertIn("## Estado vacio controlado", markdown)


if __name__ == "__main__":
    unittest.main()
