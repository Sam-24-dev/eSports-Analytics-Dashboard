import unittest

from src.etl.competition_section_expected_values import (
    build_competition_section_view,
    generate_validation_markdown,
    list_valid_filters,
    load_dashboard_snapshot,
)


class TestCompetitionSectionExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_returns_catalog(self):
        view = build_competition_section_view(self.snapshot)

        self.assertEqual(view["mode"], "catalog")
        self.assertEqual(view["title"], "Competencias")
        self.assertEqual(view["subtitle"], "")
        self.assertTrue(view["items"])
        self.assertIsNone(view["spotlight"])

    def test_country_view_returns_catalog(self):
        view = build_competition_section_view(self.snapshot, country="Chile")

        self.assertEqual(view["mode"], "catalog")
        self.assertEqual(view["title"], "Competencias donde participa Chile")
        self.assertEqual(view["subtitle"], "")
        self.assertTrue(view["items"])

    def test_competition_view_returns_spotlight(self):
        view = build_competition_section_view(self.snapshot, competition="Challenger Sur 2025")

        self.assertEqual(view["mode"], "spotlight")
        self.assertEqual(view["title"], "Detalle de Challenger Sur 2025")
        self.assertEqual(view["subtitle"], "")
        self.assertEqual(view["spotlight"]["name"], "Challenger Sur 2025")
        self.assertIsNone(view["countryParticipation"])
        self.assertNotIn("averagePrizePerTeam", view["spotlight"])

    def test_country_competition_view_returns_spotlight_with_country_participation(self):
        view = build_competition_section_view(
            self.snapshot,
            country="Chile",
            competition="Challenger Sur 2025",
        )

        self.assertEqual(view["mode"], "spotlight")
        self.assertEqual(view["subtitle"], "Con participaci\u00f3n de Chile")
        self.assertEqual(view["spotlight"]["name"], "Challenger Sur 2025")
        self.assertEqual(
            view["countryParticipation"],
            {
                "country": "Chile",
                "teams": 1,
                "players": 2,
                "totalPrizes": 8000.0,
                "bestPosition": 3,
            },
        )

    def test_country_competition_zero_prize_without_final_position_keeps_null_best_position(self):
        view = build_competition_section_view(
            self.snapshot,
            country="Per\u00fa",
            competition="Challenger Sur 2025",
        )

        self.assertEqual(view["mode"], "spotlight")
        self.assertEqual(view["countryParticipation"]["totalPrizes"], 0.0)
        self.assertIsNone(view["countryParticipation"]["bestPosition"])

    def test_invalid_competition_returns_empty_detail(self):
        view = build_competition_section_view(
            self.snapshot,
            competition="Competencia Fantasma 2099",
        )

        self.assertEqual(view["mode"], "empty")
        self.assertEqual(view["title"], "Detalle de Competencia Fantasma 2099")
        self.assertEqual(view["emptyState"]["message"], "Sin detalle de competencia para este filtro")

    def test_invalid_country_competition_returns_empty_participation_state(self):
        view = build_competition_section_view(
            self.snapshot,
            country="Argentina",
            competition="Challenger Sur 2025",
        )

        self.assertEqual(view["mode"], "empty")
        self.assertEqual(view["title"], "Detalle de Challenger Sur 2025")
        self.assertEqual(view["subtitle"], "")
        self.assertEqual(
            view["emptyState"]["message"],
            "Sin participaci\u00f3n de Argentina en esta competencia",
        )

    def test_search_does_not_change_mode(self):
        baseline = build_competition_section_view(self.snapshot, country="Chile")
        searched = build_competition_section_view(self.snapshot, country="Chile", search="Mat\u00edas Rojas")

        self.assertEqual(searched["mode"], baseline["mode"])
        self.assertEqual(searched["title"], baseline["title"])
        self.assertEqual(searched["items"], baseline["items"])

    def test_list_valid_filters_contains_pairs(self):
        filters = list_valid_filters(self.snapshot)

        self.assertIn("Chile", filters["countries"])
        self.assertIn("Challenger Sur 2025", filters["competitions"])
        self.assertIn(("Chile", "Challenger Sur 2025"), filters["country_competition_pairs"])

    def test_markdown_contains_core_sections(self):
        markdown = generate_validation_markdown(self.snapshot)

        self.assertIn("# Validacion Competencias vs Front", markdown)
        self.assertIn("A\u00f1o", markdown)
        self.assertIn("Con participaci\u00f3n", markdown)
        self.assertIn("Participaci\u00f3n de Chile", markdown)
        self.assertIn("Premios del pa\u00eds", markdown)
        self.assertIn("$0", markdown)
        self.assertIn("Sin clasificaci\u00f3n final", markdown)
        self.assertIn("## Estado global", markdown)
        self.assertIn("## Estados por pais", markdown)
        self.assertIn("## Estados por competencia", markdown)
        self.assertIn("## Estados pais + competencia validos", markdown)
        self.assertIn("## Estado vacio controlado", markdown)
        self.assertIn("Competencia Fantasma 2099", markdown)


if __name__ == "__main__":
    unittest.main()
