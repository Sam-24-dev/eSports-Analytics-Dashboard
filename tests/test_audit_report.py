import unittest

from src.etl.pipeline import _build_audit_report_content


class TestAuditReport(unittest.TestCase):
    def test_audit_report_includes_coverage_and_consistency(self):
        data = {
            "competitions": [{"name": "CompA"}],
            "filter_ready": {
                "kpis_by_country": [
                    {
                        "country": "Chile",
                        "total_teams": 1,
                        "total_players": 2,
                        "total_prizes": 100.0,
                        "average_age": 22.0,
                        "active_competitions": 1,
                        "international_competitions": 0,
                        "national_competitions": 1,
                    }
                ],
                "kpis_by_country_competition": [
                    {
                        "competition_name": "CompA",
                        "country": "Chile",
                        "type": "Nacional",
                        "year": 2024,
                        "total_teams": 1,
                        "total_players": 2,
                        "total_prizes": 100.0,
                        "average_age": 22.0,
                    }
                ],
                "country_ranking_by_competition": [
                    {
                        "competition_name": "CompA",
                        "country": "Chile",
                        "total_teams": 1,
                        "total_players": 2,
                        "total_prizes": 100.0,
                        "average_prize_per_team": 100.0,
                        "average_age": 22.0,
                    }
                ],
                "kpis_by_competition": [
                    {
                        "competition_name": "CompA",
                        "type": "Nacional",
                        "year": 2024,
                        "total_teams": 1,
                        "total_players": 2,
                        "total_prizes": 100.0,
                        "average_age": 22.0,
                        "countries_represented": 1,
                        "international_competitions": 0,
                        "national_competitions": 1,
                    }
                ],
                "players_index": [
                    {"name": "Jose", "nationality": "Chile", "team": "TeamA", "search_key": "jose"}
                ],
            },
        }
        consistency = {
            "competition_totals": [],
            "country_competition_match": ["Mismatch sample"],
            "filter_coverage": [],
        }

        content = _build_audit_report_content(data, consistency)

        self.assertIn("## Chile", content)
        self.assertIn("## Cobertura de filtros", content)
        self.assertIn("## Consistency checks", content)
        self.assertIn("country_competition_match: FAIL", content)


if __name__ == "__main__":
    unittest.main()
