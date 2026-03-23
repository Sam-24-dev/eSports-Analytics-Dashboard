import unittest
import pandas as pd

from src.etl.validators import validate_with_pandera


class TestPanderaValidators(unittest.TestCase):
    def test_pandera_kpis_rejects_invalid_values(self):
        df = pd.DataFrame({
            "total_teams": [1],
            "total_players": [2],
            "total_prizes": [-5],
            "countries_represented": [1],
            "active_competitions": [1],
            "average_age": [10],
            "international_competitions": [0],
            "national_competitions": [1],
        })

        issues = validate_with_pandera("kpis", df)

        self.assertTrue(any("total_prizes" in msg for msg in issues))
        self.assertTrue(any("average_age" in msg for msg in issues))

    def test_pandera_unknown_dataset_no_issues(self):
        df = pd.DataFrame({"a": [1]})

        issues = validate_with_pandera("unknown_dataset", df)

        self.assertEqual(issues, [])

    def test_pandera_squad_usage_summary_rejects_invalid_share_sum(self):
        df = pd.DataFrame({
            "starter_participations": [5],
            "substitute_participations": [1],
            "starter_share_pct": [70.0],
            "substitute_share_pct": [20.0],
            "starter_unique_players": [4],
            "substitute_unique_players": [1],
            "starter_avg_performance": [60.0],
            "substitute_avg_performance": [55.0],
            "performance_gap_pct": [-5.0],
            "teams_with_substitutes": [1],
            "teams_without_substitutes": [2],
        })

        issues = validate_with_pandera("squad_usage_summary", df)

        self.assertTrue(any("starter_share_pct" in msg or "substitute_share_pct" in msg for msg in issues))

    def test_pandera_team_comparison_profiles_rejects_invalid_comparison_score(self):
        df = pd.DataFrame({
            "team": ["Equipo A"],
            "country": ["Pais A"],
            "competitions_count": [1],
            "teamwork_score": [80.0],
            "victory_rate_pct": [60.0],
            "position_metric": [2.0],
            "results_score": [50.0],
            "prize_amount": [100.0],
            "prize_share_pct": [20.0],
            "titles_count": [0],
            "podium_count": [1],
            "comparison_score": [10.0],
        })

        issues = validate_with_pandera("team_comparison_profiles", df)

        self.assertTrue(any("comparison_score" in msg or "must match" in msg.lower() for msg in issues))


if __name__ == "__main__":
    unittest.main()
