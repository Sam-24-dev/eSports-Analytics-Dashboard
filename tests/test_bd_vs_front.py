import json
import math
import unittest
from decimal import Decimal
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from src.etl import pipeline as etl


NUMERIC_TOLERANCE = 0.01


def _to_number(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _normalize_missing(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def _index_rows(rows: Iterable[Dict], keys: Tuple[str, ...]) -> Dict[Tuple, Dict]:
    indexed: Dict[Tuple, Dict] = {}
    for row in rows:
        key = tuple(row.get(k) for k in keys)
        indexed[key] = row
    return indexed


def _derive_team_comparison_leaders(rows: List[Dict], context_keys: Tuple[str, ...]) -> List[Dict]:
    groups: Dict[Tuple, List[Dict]] = {}
    for row in rows:
        key = tuple(row.get(k) for k in context_keys)
        groups.setdefault(key, []).append(row)

    derived: List[Dict] = []
    metric_specs = [
        ("best_teamwork_team", "best_teamwork_score", "teamwork_score"),
        ("best_victory_team", "best_victory_rate_pct", "victory_rate_pct"),
        ("best_results_team", "best_results_score", "results_score"),
        ("best_prize_team", "best_prize_share_pct", "prize_share_pct"),
    ]

    def _sort_value(row: Dict, metric: str):
        numeric = _to_number(row.get(metric))
        return -1 if numeric is None else numeric

    for key, group_rows in groups.items():
        leader_row: Dict[str, object] = {}
        for index, context_key in enumerate(context_keys):
            leader_row[context_key] = key[index]

        for team_field, value_field, metric in metric_specs:
            winner = sorted(
                group_rows,
                key=lambda row: (
                    _sort_value(row, metric),
                    _to_number(row.get("comparison_score")) or 0,
                    _to_number(row.get("prize_amount")) or 0,
                    row.get("team") or "",
                ),
                reverse=True,
            )[0]
            leader_row[team_field] = winner.get("team")
            leader_row[value_field] = winner.get(metric)

        derived.append(leader_row)

    return derived


def _assert_row_matches(
    testcase: unittest.TestCase,
    expected: Dict,
    actual: Dict,
    numeric_cols: List[str],
    text_cols: List[str],
    *,
    tolerance: float = NUMERIC_TOLERANCE,
):
    for col in numeric_cols:
        if col not in actual:
            testcase.fail(f"Missing numeric column '{col}' in JSON row: {actual}")
        expected_val = _to_number(expected.get(col))
        actual_val = _to_number(actual.get(col))
        if expected_val is None or actual_val is None:
            testcase.assertEqual(
                _normalize_missing(actual.get(col)),
                _normalize_missing(expected.get(col)),
                f"Column '{col}' mismatch: expected={expected.get(col)} actual={actual.get(col)}",
            )
        else:
            testcase.assertTrue(
                math.isclose(actual_val, expected_val, abs_tol=tolerance),
                f"Column '{col}' mismatch: expected={expected_val} actual={actual_val}",
            )

    for col in text_cols:
        if col not in actual:
            testcase.fail(f"Missing text column '{col}' in JSON row: {actual}")
        testcase.assertEqual(
            _normalize_missing(actual.get(col)),
            _normalize_missing(expected.get(col)),
            f"Column '{col}' mismatch: expected={expected.get(col)} actual={actual.get(col)}",
        )


class TestBDVsFront(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        if not data_path.exists():
            raise unittest.SkipTest("Missing datos-dashboard.json")
        cls.dashboard_data = json.loads(data_path.read_text(encoding="utf-8"))

        try:
            cls.conn = etl._get_connection()
        except SystemExit:
            raise unittest.SkipTest("MySQL connection not available for BD vs Front test")

    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "conn", None):
            cls.conn.close()

    def _run_query(self, query: str):
        df = etl._run_query(self.conn, query)
        return df.to_dict(orient="records")

    def test_kpis_global_matches_db(self):
        db_rows = self._run_query(etl._SQL_KPIS)
        self.assertEqual(len(db_rows), 1)
        expected = db_rows[0]
        actual = self.dashboard_data.get("main_kpis", {})

        numeric_cols = [
            "total_teams",
            "total_players",
            "total_prizes",
            "countries_represented",
            "active_competitions",
            "average_age",
            "international_competitions",
            "national_competitions",
        ]
        _assert_row_matches(self, expected, actual, numeric_cols, [])

    def test_kpis_by_country_matches_db(self):
        db_rows = self._run_query(etl._SQL_KPIS_BY_COUNTRY)
        json_rows = self.dashboard_data.get("filter_ready", {}).get("kpis_by_country", [])
        db_index = _index_rows(db_rows, ("country",))
        json_index = _index_rows(json_rows, ("country",))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "total_teams",
            "total_players",
            "total_prizes",
            "active_competitions",
            "average_age",
            "international_competitions",
            "national_competitions",
            "countries_represented",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["country"])

    def test_kpis_by_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_KPIS_BY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get("kpis_by_competition", [])
        db_index = _index_rows(db_rows, ("competition_name",))
        json_index = _index_rows(json_rows, ("competition_name",))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "total_teams",
            "total_players",
            "total_prizes",
            "average_age",
            "countries_represented",
            "international_competitions",
            "national_competitions",
            "year",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "type"],
            )

    def test_kpis_by_country_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_KPIS_BY_COUNTRY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "kpis_by_country_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "country"))
        json_index = _index_rows(json_rows, ("competition_name", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "total_teams",
            "total_players",
            "total_prizes",
            "average_age",
            "year",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "country", "type"],
            )

    def test_competitions_dataset_matches_db(self):
        db_rows = self._run_query(etl._SQL_COMPETENCIAS)
        json_rows = self.dashboard_data.get("competitions", [])
        db_index = _index_rows(db_rows, ("name",))
        json_index = _index_rows(json_rows, ("name",))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "participating_teams",
            "total_players",
            "total_prize",
            "average_prize_per_team",
            "year",
            "average_age",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["name", "type", "location"],
            )

    def test_squad_usage_summary_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_SUMMARY)
        self.assertEqual(len(db_rows), 1)
        expected = db_rows[0]
        actual = self.dashboard_data.get("squad_usage_summary", {})

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_share_pct",
            "substitute_share_pct",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "performance_gap_pct",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ]
        _assert_row_matches(self, expected, actual, numeric_cols, [])

    def test_squad_usage_team_breakdown_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_TEAM_BREAKDOWN)
        json_rows = self.dashboard_data.get("squad_usage_team_breakdown", [])
        db_index = _index_rows(db_rows, ("team", "country"))
        json_index = _index_rows(json_rows, ("team", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "substitute_share_pct",
            "performance_gap_pct",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["team", "country"])

    def test_squad_usage_by_country_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_BY_COUNTRY)
        json_rows = self.dashboard_data.get("filter_ready", {}).get("squad_usage_by_country", [])
        db_index = _index_rows(db_rows, ("country",))
        json_index = _index_rows(json_rows, ("country",))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_share_pct",
            "substitute_share_pct",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "performance_gap_pct",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["country"])

    def test_squad_usage_by_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_BY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get("squad_usage_by_competition", [])
        db_index = _index_rows(db_rows, ("competition_name",))
        json_index = _index_rows(json_rows, ("competition_name",))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_share_pct",
            "substitute_share_pct",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "performance_gap_pct",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["competition_name"])

    def test_squad_usage_by_country_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_BY_COUNTRY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "squad_usage_by_country_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "country"))
        json_index = _index_rows(json_rows, ("competition_name", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_share_pct",
            "substitute_share_pct",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "performance_gap_pct",
            "teams_with_substitutes",
            "teams_without_substitutes",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "country"],
            )

    def test_squad_usage_team_breakdown_by_country_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COUNTRY)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "squad_usage_team_breakdown_by_country", []
        )
        db_index = _index_rows(db_rows, ("country", "team"))
        json_index = _index_rows(json_rows, ("country", "team"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "substitute_share_pct",
            "performance_gap_pct",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["country", "team"])

    def test_squad_usage_team_breakdown_by_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "squad_usage_team_breakdown_by_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "country", "team"))
        json_index = _index_rows(json_rows, ("competition_name", "country", "team"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "substitute_share_pct",
            "performance_gap_pct",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "country", "team"],
            )

    def test_squad_usage_team_breakdown_by_country_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_SQUAD_USAGE_TEAM_BREAKDOWN_BY_COUNTRY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "squad_usage_team_breakdown_by_country_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "country", "team"))
        json_index = _index_rows(json_rows, ("competition_name", "country", "team"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "starter_participations",
            "substitute_participations",
            "starter_unique_players",
            "substitute_unique_players",
            "starter_avg_performance",
            "substitute_avg_performance",
            "substitute_share_pct",
            "performance_gap_pct",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "country", "team"],
            )

    def test_country_ranking_matches_db(self):
        db_rows = self._run_query(etl._SQL_RANKING_PAISES)
        json_rows = self.dashboard_data.get("country_ranking", [])
        db_index = _index_rows(db_rows, ("country",))
        json_index = _index_rows(json_rows, ("country",))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "total_teams",
            "total_players",
            "total_prizes",
            "active_competitions",
            "average_age",
            "international_competitions",
            "national_competitions",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["country"])

    def test_country_ranking_by_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_COUNTRY_RANKING_BY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "country_ranking_by_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "country"))
        json_index = _index_rows(json_rows, ("competition_name", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "total_teams",
            "total_players",
            "total_prizes",
            "average_prize_per_team",
            "average_age",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "country"],
            )

    def test_teams_catalog_matches_db(self):
        db_rows = self._run_query(etl._SQL_TEAMS_CATALOG)
        json_rows = self.dashboard_data.get("teams_catalog", [])
        db_index = _index_rows(db_rows, ("name", "country"))
        json_index = _index_rows(json_rows, ("name", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "participating_competitions",
            "total_players",
            "best_position",
            "total_prizes",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["name", "country"],
            )

    def test_player_evolution_matches_db(self):
        db_rows = etl._add_evolution_deltas(self._run_query(etl._SQL_EVOLUCION_JUGADORES))
        json_rows = self.dashboard_data.get("player_evolution", [])
        db_index = _index_rows(db_rows, ("name",))
        json_index = _index_rows(json_rows, ("name",))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "performance_2024",
            "performance_2025",
            "improvement",
            "improvement_pct",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["name", "nationality", "team_2024", "team_2025", "trend"],
            )

    def test_top_teams_by_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_TOP_TEAMS_BY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "top_teams_by_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "team", "country"))
        json_index = _index_rows(json_rows, ("competition_name", "team", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "final_position",
            "prize_obtained",
            "total_players",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "team", "country"],
            )

    def test_player_evolution_by_competition_matches_db(self):
        db_rows = etl._filter_player_competition_rows_for_year(
            etl._add_evolution_deltas(self._run_query(etl._SQL_PLAYER_EVOLUTION_BY_COMPETITION))
        )
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "player_evolution_by_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "name"))
        json_index = _index_rows(json_rows, ("competition_name", "name"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "competition_year",
            "performance_2024",
            "performance_2025",
            "improvement",
            "improvement_pct",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "name", "nationality", "team", "trend"],
            )

    def test_player_evolution_by_competition_only_keeps_year_aligned_rows(self):
        rows = self.dashboard_data.get("filter_ready", {}).get(
            "player_evolution_by_competition", []
        )

        invalid_rows = [
            row for row in rows
            if (
                int(row["competition_year"]) == 2024 and row.get("performance_2024") is None
            ) or (
                int(row["competition_year"]) == 2025 and row.get("performance_2025") is None
            )
        ]

        self.assertEqual(
            invalid_rows,
            [],
            f"Found competition player rows without performance for their competition year: {invalid_rows[:5]}",
        )

    def test_team_comparison_profiles_matches_db(self):
        db_rows = self._run_query(etl._SQL_TEAM_COMPARISON_PROFILES)
        json_rows = self.dashboard_data.get("team_comparison_profiles", [])
        db_index = _index_rows(db_rows, ("team", "country"))
        json_index = _index_rows(json_rows, ("team", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "competitions_count",
            "teamwork_score",
            "victory_rate_pct",
            "position_metric",
            "results_score",
            "prize_amount",
            "prize_share_pct",
            "titles_count",
            "podium_count",
            "comparison_score",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["team", "country"])

    def test_team_comparison_profiles_by_country_matches_db(self):
        db_rows = self._run_query(etl._SQL_TEAM_COMPARISON_PROFILES_BY_COUNTRY)
        json_rows = self.dashboard_data.get("filter_ready", {}).get("team_comparison_profiles_by_country", [])
        db_index = _index_rows(db_rows, ("country", "team"))
        json_index = _index_rows(json_rows, ("country", "team"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "competitions_count",
            "teamwork_score",
            "victory_rate_pct",
            "position_metric",
            "results_score",
            "prize_amount",
            "prize_share_pct",
            "titles_count",
            "podium_count",
            "comparison_score",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(self, expected, actual, numeric_cols, ["country", "team"])

    def test_team_comparison_profiles_by_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_TEAM_COMPARISON_PROFILES_BY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get("team_comparison_profiles_by_competition", [])
        db_index = _index_rows(db_rows, ("competition_name", "team", "country"))
        json_index = _index_rows(json_rows, ("competition_name", "team", "country"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "competitions_count",
            "teamwork_score",
            "victory_rate_pct",
            "position_metric",
            "results_score",
            "prize_amount",
            "prize_share_pct",
            "titles_count",
            "podium_count",
            "comparison_score",
            "competition_result",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "team", "country"],
            )

    def test_team_comparison_profiles_by_country_competition_matches_db(self):
        db_rows = self._run_query(etl._SQL_TEAM_COMPARISON_PROFILES_BY_COUNTRY_COMPETITION)
        json_rows = self.dashboard_data.get("filter_ready", {}).get(
            "team_comparison_profiles_by_country_competition", []
        )
        db_index = _index_rows(db_rows, ("competition_name", "country", "team"))
        json_index = _index_rows(json_rows, ("competition_name", "country", "team"))

        self.assertEqual(set(db_index.keys()), set(json_index.keys()))

        numeric_cols = [
            "competitions_count",
            "teamwork_score",
            "victory_rate_pct",
            "position_metric",
            "results_score",
            "prize_amount",
            "prize_share_pct",
            "titles_count",
            "podium_count",
            "comparison_score",
            "competition_result",
        ]
        for key, expected in db_index.items():
            actual = json_index[key]
            _assert_row_matches(
                self,
                expected,
                actual,
                numeric_cols,
                ["competition_name", "country", "team"],
            )

    def test_team_comparison_leaders_matches_derived_profiles(self):
        db_rows = self._run_query(etl._SQL_TEAM_COMPARISON_PROFILES)
        expected_rows = _derive_team_comparison_leaders(db_rows, ())
        self.assertEqual(len(expected_rows), 1)
        expected = expected_rows[0]
        actual = self.dashboard_data.get("team_comparison_leaders", {})

        numeric_cols = [
            "best_teamwork_score",
            "best_victory_rate_pct",
            "best_results_score",
            "best_prize_share_pct",
        ]
        text_cols = [
            "best_teamwork_team",
            "best_victory_team",
            "best_results_team",
            "best_prize_team",
        ]
        _assert_row_matches(self, expected, actual, numeric_cols, text_cols)


if __name__ == "__main__":
    unittest.main()
