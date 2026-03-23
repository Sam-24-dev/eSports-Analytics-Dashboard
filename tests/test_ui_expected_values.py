import unittest

from src.etl.ui_expected_values import (
    compute_expected_view,
    load_dashboard_snapshot,
)


class TestUIExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_uses_main_kpis(self):
        view = compute_expected_view(self.snapshot)

        self.assertEqual(view["kpis"]["total_teams"], 15)
        self.assertEqual(view["kpis"]["total_players"], 33)
        self.assertEqual(view["status"], "with_data")
        self.assertEqual(len(view["donut_bar_rows"]), 8)

    def test_country_view_returns_single_country_row(self):
        view = compute_expected_view(self.snapshot, country="Chile")

        self.assertEqual(view["kpis"]["total_teams"], 3)
        self.assertEqual(view["kpis"]["total_players"], 6)
        self.assertEqual(len(view["donut_bar_rows"]), 1)
        self.assertEqual(view["donut_bar_rows"][0]["country"], "Chile")
        self.assertEqual(view["donut_bar_rows"][0]["total_prizes"], 43000.0)

    def test_competition_view_returns_competition_breakdown(self):
        view = compute_expected_view(self.snapshot, competition="Torneo del Caribe 2024")

        self.assertEqual(view["kpis"]["total_teams"], 4)
        self.assertEqual(view["kpis"]["total_players"], 8)
        self.assertEqual(len(view["donut_bar_rows"]), 3)
        self.assertEqual(
            [row["country"] for row in view["donut_bar_rows"]],
            ["Chile", "Ecuador", "Colombia"],
        )

    def test_country_competition_with_data_returns_exact_row(self):
        view = compute_expected_view(
            self.snapshot,
            country="Chile",
            competition="Torneo del Caribe 2024",
        )

        self.assertEqual(view["status"], "with_data")
        self.assertEqual(view["kpis"]["total_teams"], 2)
        self.assertEqual(view["kpis"]["total_players"], 4)
        self.assertEqual(len(view["donut_bar_rows"]), 1)
        self.assertEqual(view["donut_bar_rows"][0]["country"], "Chile")
        self.assertEqual(view["donut_bar_rows"][0]["total_teams"], 2)

    def test_country_competition_without_data_returns_empty_state(self):
        view = compute_expected_view(
            self.snapshot,
            country="Argentina",
            competition="Copa Andina 2024",
        )

        self.assertEqual(view["status"], "empty")
        self.assertEqual(view["kpis"]["total_teams"], 0)
        self.assertEqual(view["kpis"]["total_players"], 0)
        self.assertEqual(view["donut_bar_rows"], [])


if __name__ == "__main__":
    unittest.main()
