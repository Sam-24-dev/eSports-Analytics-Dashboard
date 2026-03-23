import unittest

from src.etl.team_experience_expected_values import (
    build_team_experience_view,
    generate_validation_markdown,
    load_dashboard_snapshot,
)


class TestTeamExperienceExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_uses_compare_mode(self):
        view = build_team_experience_view(self.snapshot)

        self.assertTrue(view["visible"])
        self.assertEqual(view["context"], "global")
        self.assertEqual(view["title"], "Experiencia del equipo")
        self.assertEqual(
            view["subtitle"],
            "Cómo se reparte la experiencia y el liderazgo dentro de cada equipo",
        )
        self.assertEqual(
            view["contextLabel"],
            "Vista general de la experiencia de los equipos",
        )
        self.assertIsNotNone(view["compareMode"])
        self.assertIsNone(view["profileMode"])
        self.assertIsNotNone(view["roleInsight"])
        self.assertIsNotNone(view["rangeChartModel"])
        self.assertEqual(view["rangeChartModel"]["title"], "Rango de edades por equipo")
        self.assertEqual(
            view["rangeChartModel"]["explanation"],
            "La barra va del jugador más joven al más experimentado. Pasa el cursor o toca la barra para ver el menor, el promedio y el veterano.",
        )
        self.assertIn("Más joven:", view["rangeChartModel"]["items"][0]["tooltipLabel"])
        self.assertEqual(view["leaders"][2]["label"], "Mayor rango de edades")
        self.assertEqual(view["leaders"][3]["label"], "Diferencia del veterano vs equipo")

    def test_country_view_keeps_context_even_with_search(self):
        view = build_team_experience_view(self.snapshot, country="Ecuador", search="Carlos Hernandez")

        self.assertEqual(view["context"], "country")
        self.assertEqual(
            view["contextLabel"],
            "Así se reparte la experiencia en los equipos de Ecuador",
        )
        self.assertIn(view["roleInsight"]["title"], {
            "Todos usan a su veterano como titular",
            "Todos usan a su veterano como suplente",
            "Predominio de veteranos titulares",
            "Predominio de veteranos suplentes",
            "Uso mixto del veterano",
        })

    def test_country_competition_profile_mode_exists(self):
        view = build_team_experience_view(
            self.snapshot,
            country="Bolivia",
            competition="Masters Latam 2025",
            search="Pedro Martinez",
        )

        self.assertEqual(view["context"], "country_competition")
        self.assertIsNone(view["compareMode"])
        self.assertIsNotNone(view["profileMode"])
        self.assertEqual(view["profileMode"]["roleLabel"], "Titular")
        self.assertIsNone(view["tableModel"])

    def test_copy_avoids_legacy_terms(self):
        markdown = generate_validation_markdown(self.snapshot)

        self.assertIn("Experiencia del equipo", markdown)
        self.assertIn("Rango de edades por equipo", markdown)
        self.assertIn("Perfil de experiencia", markdown)
        self.assertIn("Sin registro de rendimiento", markdown)
        self.assertIn("Sin puesto final registrado", markdown)
        self.assertIn("años", markdown)
        self.assertIn("Mayor rango de edades", markdown)
        self.assertIn("Diferencia del veterano vs equipo", markdown)
        self.assertNotIn("performance_2024", markdown)
        self.assertNotIn("veteran_players", markdown)
        self.assertNotIn("N/A", markdown)
        self.assertNotIn("Sin dato", markdown)
        self.assertNotIn("anios", markdown)


if __name__ == "__main__":
    unittest.main()
