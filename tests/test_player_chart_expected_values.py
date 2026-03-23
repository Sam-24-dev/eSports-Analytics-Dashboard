import unittest

from src.etl.player_chart_expected_values import (
    build_player_chart_view,
    build_player_module_tooltip_lines,
    generate_validation_markdown,
    load_dashboard_snapshot,
)


class TestPlayerChartExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_matches_evolution_mode(self):
        view = build_player_chart_view(self.snapshot)

        self.assertEqual(view["mode"], "evolution")
        self.assertEqual(view["title"], "Top 5 jugadores con mayor mejora 2024 -> 2025")
        self.assertEqual(view["table_title"], "Evolucion de jugadores")
        self.assertLessEqual(len(view["rows"]), 5)
        self.assertGreater(len(view["rows"]), 0)
        self.assertTrue(all((row.get("improvement_pct") or 0) > 0 for row in view["rows"]))

    def test_country_view_only_keeps_positive_improvements(self):
        country = "Chile"
        view = build_player_chart_view(self.snapshot, country=country)

        if view["mode"] == "evolution":
            self.assertTrue(all((row.get("improvement_pct") or 0) > 0 for row in view["rows"]))
        else:
            self.assertEqual(view["empty_state"]["message"], "Sin mejoras positivas 2024-2025")

    def test_competition_view_matches_single_year_mode(self):
        competition = self.snapshot["filter_ready"]["kpis_by_competition"][0]["competition_name"]
        view = build_player_chart_view(self.snapshot, competition=competition)

        self.assertEqual(view["mode"], "single-year")
        self.assertEqual(view["table_title"], "Detalle de rendimiento")
        self.assertIn(competition, view["title"])
        self.assertLessEqual(len(view["rows"]), 5)
        self.assertGreater(len(view["rows"]), 0)

    def test_country_competition_without_year_aligned_player_metrics_is_empty(self):
        view = build_player_chart_view(
            self.snapshot,
            country="Bolivia",
            competition="Masters Latam 2025",
        )

        self.assertEqual(view["mode"], "empty")
        self.assertEqual(view["empty_state"]["message"], "Sin rendimiento anual de jugadores para este filtro")

    def test_exact_comparable_player_returns_evolution_detail(self):
        comparable = next(
            row["name"]
            for row in self.snapshot["player_evolution"]
            if row.get("performance_2024") is not None and row.get("performance_2025") is not None
        )
        view = build_player_chart_view(self.snapshot, search=comparable)

        self.assertEqual(view["mode"], "evolution")
        self.assertEqual(len(view["rows"]), 1)
        self.assertIn(comparable, view["title"])
        tooltip = build_player_module_tooltip_lines(view, view["rows"][0])
        self.assertTrue(any(line.startswith("Rendimiento 2024:") for line in tooltip))
        self.assertTrue(any(line.startswith("Mejora %:") for line in tooltip))

    def test_exact_single_year_player_returns_single_year_detail(self):
        single_year = next(
            row["name"]
            for row in self.snapshot["player_evolution"]
            if (row.get("performance_2024") is None) != (row.get("performance_2025") is None)
        )
        view = build_player_chart_view(self.snapshot, search=single_year)

        self.assertEqual(view["mode"], "single-year")
        self.assertEqual(len(view["rows"]), 1)
        self.assertIn(single_year, view["title"])
        tooltip = build_player_module_tooltip_lines(view, view["rows"][0])
        self.assertTrue(any(line.startswith("Anio:") for line in tooltip))
        self.assertTrue(any(line.startswith("Rendimiento:") for line in tooltip))

    def test_markdown_contains_required_sections(self):
        markdown = generate_validation_markdown(self.snapshot)

        self.assertIn("# Validacion Player Chart vs Front", markdown)
        self.assertIn("## Estados por pais", markdown)
        self.assertIn("## Estados por competencia", markdown)
        self.assertIn("## Estados pais + competencia con datos", markdown)
        self.assertIn("## Combinaciones vacias documentadas", markdown)
        self.assertIn("## Casos de jugador exacto", markdown)


if __name__ == "__main__":
    unittest.main()
