import unittest

from src.etl.player_age_performance_expected_values import (
    build_age_performance_view,
    generate_validation_markdown,
    load_dashboard_snapshot,
)


class TestPlayerAgePerformanceExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_uses_new_module_copy(self):
        view = build_age_performance_view(self.snapshot)

        self.assertTrue(view["visible"])
        self.assertEqual(view["context"], "global")
        self.assertEqual(view["analysisState"], "complete")
        self.assertEqual(view["title"], "Edad vs rendimiento")
        self.assertEqual(
            view["subtitle"],
            "C\u00f3mo cambia el rendimiento seg\u00fan la edad en este contexto",
        )
        self.assertEqual(
            view["contextLabel"],
            "Vista general de jugadores por edad y rendimiento",
        )
        self.assertEqual(len(view["leaders"]), 4)
        self.assertEqual(view["hiddenLeadersCount"], 0)
        self.assertEqual(view["hiddenBandsCount"], 0)
        self.assertIn(
            view["summary"]["relationshipLabel"],
            {
                "Sin relaci\u00f3n clara",
                "Relaci\u00f3n d\u00e9bil positiva",
                "Relaci\u00f3n d\u00e9bil negativa",
                "Relaci\u00f3n moderada positiva",
                "Relaci\u00f3n moderada negativa",
                "Relaci\u00f3n fuerte positiva",
                "Relaci\u00f3n fuerte negativa",
                "Muestra insuficiente",
            },
        )
        self.assertIsNotNone(view["bandModel"])
        self.assertIsNone(view["scatterModel"])

    def test_country_search_highlight_does_not_change_context(self):
        view = build_age_performance_view(self.snapshot, country="Chile", search="Rodrigo P\u00e9rez")

        self.assertEqual(view["context"], "country")
        self.assertEqual(
            view["contextLabel"],
            "As\u00ed rinden los jugadores de equipos de Chile",
        )
        self.assertEqual(view["searchHighlight"]["query"], "Rodrigo P\u00e9rez")

    def test_partial_context_uses_partial_state(self):
        view = build_age_performance_view(self.snapshot, country="Bolivia")

        self.assertEqual(view["analysisState"], "partial")
        self.assertEqual(view["rawPlayersCount"], 3)
        self.assertEqual(view["validPointsCount"], 0)
        self.assertEqual(view["leaders"], [])
        self.assertIsNone(view["bandModel"])
        self.assertIsNone(view["scatterModel"])
        self.assertEqual(
            view["emptyState"]["message"],
            "Hay jugadores registrados en este contexto, pero no hay rendimiento suficiente para compararlos.",
        )

    def test_limited_context_hides_unreliable_leader_and_scatter(self):
        view = build_age_performance_view(self.snapshot, country="M\u00e9xico")

        self.assertEqual(view["analysisState"], "limited")
        self.assertEqual(view["validPointsCount"], 1)
        self.assertEqual(view["leaders"][0]["label"], "Muestra limitada")
        self.assertFalse(any(leader["label"] == "Veterano destacado" for leader in view["leaders"]))
        self.assertEqual(view["hiddenLeadersCount"], 1)
        self.assertEqual(view["hiddenBandsCount"], 1)
        self.assertIsNone(view["scatterModel"])
        self.assertEqual(view["sectionNotes"], ["Se omitieron 1 destacado y 1 tramo sin rendimiento comparable."])

    def test_complete_context_can_hide_null_band_and_leader_with_note(self):
        view = build_age_performance_view(self.snapshot, competition="Masters Latam 2025")

        self.assertEqual(view["analysisState"], "complete")
        self.assertTrue(view["validPointsCount"] >= 3)
        self.assertFalse(any(leader["label"] == "Joven destacado" and leader["value"] == "Sin registro de rendimiento" for leader in view["leaders"]))
        self.assertFalse(any(item["ageBand"] == "20-21" for item in view["bandModel"]["items"]))
        self.assertGreaterEqual(view["hiddenLeadersCount"], 1)
        self.assertGreaterEqual(view["hiddenBandsCount"], 1)

    def test_markdown_avoids_legacy_2024_copy(self):
        markdown = generate_validation_markdown(self.snapshot)

        self.assertIn("Edad vs rendimiento", markdown)
        self.assertIn("Rendimiento por tramo de edad", markdown)
        self.assertNotIn("Distribuci\u00f3n de jugadores", markdown)
        self.assertNotIn("performance_2024", markdown)
        self.assertNotIn("Pais", markdown)


if __name__ == "__main__":
    unittest.main()
