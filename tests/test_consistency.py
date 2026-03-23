import json
import unittest
from pathlib import Path

from src.etl.consistency import (
    check_competition_totals,
    check_country_competition_match,
    check_filter_coverage,
    run_consistency_checks,
)


class TestConsistencyChecks(unittest.TestCase):
    def test_competition_totals_detects_mismatch(self):
        ranking = [
            {
                "competition_name": "CompA",
                "country": "Chile",
                "total_teams": 2,
                "total_players": 5,
                "total_prizes": 100.0,
            }
        ]
        kpis = [
            {
                "competition_name": "CompA",
                "total_teams": 3,
                "total_players": 5,
                "total_prizes": 100.0,
            }
        ]

        issues = check_competition_totals(ranking, kpis, tolerance=0.0)

        self.assertTrue(any("CompA" in msg for msg in issues))

    def test_country_competition_match_detects_missing_row(self):
        ranking = [
            {
                "competition_name": "CompA",
                "country": "Chile",
                "total_teams": 1,
                "total_players": 2,
                "total_prizes": 100.0,
                "average_age": 22.0,
            }
        ]
        kpis = []

        issues = check_country_competition_match(ranking, kpis, tolerance=0.01)

        self.assertTrue(any("missing" in msg.lower() for msg in issues))

    def test_filter_coverage_detects_search_key_mismatch(self):
        competitions = [{"name": "CompA"}]
        filter_ready = {
            "kpis_by_competition": [{"competition_name": "CompA"}],
            "country_ranking_by_competition": [{"competition_name": "CompA"}],
            "kpis_by_country": [{"country": "Chile"}],
            "kpis_by_country_competition": [{"country": "Chile", "competition_name": "CompA"}],
            "players_index": [{"name": "José", "search_key": "josee"}],
        }

        issues = check_filter_coverage(filter_ready, competitions)

        self.assertTrue(any("search_key" in msg for msg in issues))

    def test_run_consistency_checks_on_dashboard_data(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")
        data = json.loads(data_path.read_text(encoding="utf-8"))

        results = run_consistency_checks(
            filter_ready=data["filter_ready"],
            competitions=data["competitions"],
        )

        for name, issues in results.items():
            self.assertEqual(issues, [], f"{name} reported issues: {issues}")


if __name__ == "__main__":
    unittest.main()
