import unittest
import pandas as pd
from src.etl.validators import (
    _validate_kpis,
    _validate_roles,
    _validate_squad_usage_summary,
    _validate_squad_usage_team_breakdown,
    _validate_team_comparison_profiles,
    _check_range,
    _check_ge,
    _check_not_null,
)

class TestValidators(unittest.TestCase):
    def test_check_not_null(self):
        df = pd.DataFrame({'a': [1, None, 3], 'b': ['x', 'y', 'z']})
        errors = _check_not_null(df, ['a', 'b'])
        self.assertEqual(len(errors), 1)
        self.assertIn("Column 'a' has 1 NULL value(s)", errors[0])

    def test_check_range(self):
        df = pd.DataFrame({'age': [14, 25, 40, 55]})
        errors = _check_range(df, 'age', 15, 50)
        self.assertEqual(len(errors), 1)
        self.assertIn("Column 'age' has 2 value(s) outside", errors[0])

    def test_check_ge(self):
        df = pd.DataFrame({'prize': [1000, 0, -500, 2000]})
        errors = _check_ge(df, 'prize', 0)
        self.assertEqual(len(errors), 1)
        self.assertIn("Column 'prize' has 1 value(s) < 0", errors[0])

    def test_validate_roles_valid(self):
        df = pd.DataFrame({
            'role': ['Titular', 'Suplente'],
            'total_participations': [10, 5],
            'unique_players': [5, 5],
            'average_performance': [55.5, 45.0]
        })
        errors = _validate_roles(df)
        self.assertEqual(len(errors), 0)

    def test_validate_roles_invalid(self):
        df = pd.DataFrame({
            'role': ['InvalidRole', 'Substitute'],
            'total_participations': [-1, 5],
            'unique_players': [5, 5],
            'average_performance': [155.5, 45.0]
        })
        errors = _validate_roles(df)
        self.assertEqual(len(errors), 3) # Invalid role, total < 0, performance > 100

    def test_validate_kpis_valid(self):
        df = pd.DataFrame({
            'total_teams': [15],
            'total_players': [33],
            'total_prizes': [325000],
            'countries_represented': [8],
            'active_competitions': [5],
            'average_age': [23.2],
            'international_competitions': [2],
            'national_competitions': [3],
        })
        errors = _validate_kpis(df)
        self.assertEqual(len(errors), 0)

    def test_validate_squad_usage_summary_invalid(self):
        df = pd.DataFrame({
            'starter_participations': [5],
            'substitute_participations': [1],
            'starter_share_pct': [70.0],
            'substitute_share_pct': [20.0],
            'starter_unique_players': [4],
            'substitute_unique_players': [1],
            'starter_avg_performance': [60.0],
            'substitute_avg_performance': [55.0],
            'performance_gap_pct': [-2.0],
            'teams_with_substitutes': [1],
            'teams_without_substitutes': [2],
        })
        errors = _validate_squad_usage_summary(df)
        self.assertTrue(any("suman" in err.lower() or "sum" in err.lower() for err in errors))

    def test_validate_squad_usage_team_breakdown_invalid(self):
        df = pd.DataFrame({
            'team': ['Equipo A'],
            'country': ['Pais A'],
            'starter_participations': [2],
            'substitute_participations': [1],
            'starter_unique_players': [2],
            'substitute_unique_players': [1],
            'starter_avg_performance': [50.0],
            'substitute_avg_performance': [45.0],
            'substitute_share_pct': [150.0],
            'performance_gap_pct': [-5.0],
        })
        errors = _validate_squad_usage_team_breakdown(df)
        self.assertTrue(any("substitute_share_pct" in err for err in errors))

    def test_validate_team_comparison_profiles_invalid(self):
        df = pd.DataFrame({
            'team': ['Equipo A'],
            'country': ['Pais A'],
            'competitions_count': [1],
            'teamwork_score': [120.0],
            'victory_rate_pct': [60.0],
            'position_metric': [2.0],
            'results_score': [20.0],
            'prize_amount': [1000.0],
            'prize_share_pct': [120.0],
            'titles_count': [0],
            'podium_count': [1],
            'comparison_score': [10.0],
        })
        errors = _validate_team_comparison_profiles(df)
        self.assertTrue(any("teamwork_score" in err for err in errors))
        self.assertTrue(any("prize_share_pct" in err for err in errors))
        self.assertTrue(any("results_score" in err for err in errors))

if __name__ == '__main__':
    unittest.main()
