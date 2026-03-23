import json
import unittest
from pathlib import Path

from jsonschema import Draft7Validator


class TestContractSchema(unittest.TestCase):
    def test_team_experience_top_level_blocks_present(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        data = json.loads(data_path.read_text(encoding="utf-8"))

        self.assertIn("team_experience_summary", data, "Missing team_experience_summary block in JSON")
        self.assertIsInstance(data["team_experience_summary"], dict, "team_experience_summary must be an object")

        self.assertIn("team_experience_profiles", data, "Missing team_experience_profiles block in JSON")
        self.assertIsInstance(data["team_experience_profiles"], list, "team_experience_profiles must be a list")

        self.assertIn("team_experience_leaders", data, "Missing team_experience_leaders block in JSON")
        self.assertIsInstance(data["team_experience_leaders"], dict, "team_experience_leaders must be an object")

    def test_team_comparison_top_level_blocks_present(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        data = json.loads(data_path.read_text(encoding="utf-8"))

        self.assertIn("team_comparison_profiles", data, "Missing team_comparison_profiles block in JSON")
        self.assertIsInstance(data["team_comparison_profiles"], list, "team_comparison_profiles must be a list")

        self.assertIn("team_comparison_leaders", data, "Missing team_comparison_leaders block in JSON")
        self.assertIsInstance(data["team_comparison_leaders"], dict, "team_comparison_leaders must be an object")

    def test_player_age_performance_top_level_blocks_present(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        data = json.loads(data_path.read_text(encoding="utf-8"))

        self.assertIn("player_age_performance_summary", data, "Missing player_age_performance_summary block in JSON")
        self.assertIsInstance(data["player_age_performance_summary"], dict, "player_age_performance_summary must be an object")

        self.assertIn("player_age_performance_bands", data, "Missing player_age_performance_bands block in JSON")
        self.assertIsInstance(data["player_age_performance_bands"], list, "player_age_performance_bands must be a list")

        self.assertIn("player_age_performance_points", data, "Missing player_age_performance_points block in JSON")
        self.assertIsInstance(data["player_age_performance_points"], list, "player_age_performance_points must be a list")

        self.assertIn("player_age_performance_leaders", data, "Missing player_age_performance_leaders block in JSON")
        self.assertIsInstance(data["player_age_performance_leaders"], dict, "player_age_performance_leaders must be an object")

    def test_ml_projection_top_level_blocks_present(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        data = json.loads(data_path.read_text(encoding="utf-8"))

        self.assertIn("ml_projection_2026_summary", data, "Missing ml_projection_2026_summary block in JSON")
        self.assertIsInstance(data["ml_projection_2026_summary"], dict, "ml_projection_2026_summary must be an object")

        self.assertIn("ml_projection_2026_players", data, "Missing ml_projection_2026_players block in JSON")
        self.assertIsInstance(data["ml_projection_2026_players"], list, "ml_projection_2026_players must be a list")

        self.assertIn("ml_projection_2026_team_summary", data, "Missing ml_projection_2026_team_summary block in JSON")
        self.assertIsInstance(data["ml_projection_2026_team_summary"], list, "ml_projection_2026_team_summary must be a list")

        self.assertIn("ml_projection_2026_country_summary", data, "Missing ml_projection_2026_country_summary block in JSON")
        self.assertIsInstance(data["ml_projection_2026_country_summary"], list, "ml_projection_2026_country_summary must be a list")

        self.assertIn("ml_projection_2026_feature_importance", data, "Missing ml_projection_2026_feature_importance block in JSON")
        self.assertIsInstance(data["ml_projection_2026_feature_importance"], list, "ml_projection_2026_feature_importance must be a list")

    def test_squad_usage_top_level_blocks_present(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        data = json.loads(data_path.read_text(encoding="utf-8"))

        self.assertIn("squad_usage_summary", data, "Missing squad_usage_summary block in JSON")
        self.assertIsInstance(data["squad_usage_summary"], dict, "squad_usage_summary must be an object")

        self.assertIn(
            "squad_usage_team_breakdown",
            data,
            "Missing squad_usage_team_breakdown block in JSON",
        )
        self.assertIsInstance(
            data["squad_usage_team_breakdown"],
            list,
            "squad_usage_team_breakdown must be a list",
        )

    def test_filter_ready_block_present(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        data = json.loads(data_path.read_text(encoding="utf-8"))
        self.assertIn("filter_ready", data, "Missing filter_ready block in JSON")

        filter_ready = data["filter_ready"]
        expected_keys = [
            "kpis_by_country",
            "kpis_by_competition",
            "kpis_by_country_competition",
            "country_ranking_by_competition",
            "top_teams_by_competition",
            "top_players_by_competition",
            "player_evolution_by_competition",
            "role_analysis_by_competition",
            "squad_usage_by_country",
            "squad_usage_by_competition",
            "squad_usage_by_country_competition",
            "squad_usage_team_breakdown_by_country",
            "squad_usage_team_breakdown_by_competition",
            "squad_usage_team_breakdown_by_country_competition",
            "team_experience_summary_by_country",
            "team_experience_summary_by_competition",
            "team_experience_summary_by_country_competition",
            "team_experience_profiles_by_country",
            "team_experience_profiles_by_competition",
            "team_experience_profiles_by_country_competition",
            "team_experience_leaders_by_country",
            "team_experience_leaders_by_competition",
            "team_experience_leaders_by_country_competition",
            "team_comparison_profiles_by_country",
            "team_comparison_profiles_by_competition",
            "team_comparison_profiles_by_country_competition",
            "team_comparison_leaders_by_country",
            "team_comparison_leaders_by_competition",
            "team_comparison_leaders_by_country_competition",
            "player_age_performance_summary_by_country",
            "player_age_performance_summary_by_competition",
            "player_age_performance_summary_by_country_competition",
            "player_age_performance_bands_by_country",
            "player_age_performance_bands_by_competition",
            "player_age_performance_bands_by_country_competition",
            "player_age_performance_points_by_country",
            "player_age_performance_points_by_competition",
            "player_age_performance_points_by_country_competition",
            "player_age_performance_leaders_by_country",
            "player_age_performance_leaders_by_competition",
            "player_age_performance_leaders_by_country_competition",
            "ml_projection_2026_summary_by_country",
            "ml_projection_2026_players_by_country",
            "ml_projection_2026_team_summary_by_country",
            "ml_projection_2026_country_summary_by_country",
            "radar_teamwork_by_competition",
            "scatter_age_performance_by_competition",
            "veteran_players_by_competition",
            "players_index",
        ]

        for key in expected_keys:
            self.assertIn(key, filter_ready, f"Missing filter_ready.{key}")
            self.assertIsInstance(filter_ready[key], list, f"filter_ready.{key} must be a list")

    def test_teams_catalog_block_present(self):
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        data = json.loads(data_path.read_text(encoding="utf-8"))
        self.assertIn("teams_catalog", data, "Missing teams_catalog block in JSON")
        self.assertIsInstance(data["teams_catalog"], list, "teams_catalog must be a list")
        self.assertGreater(len(data["teams_catalog"]), 0, "teams_catalog should not be empty")

    def test_datos_dashboard_matches_schema(self):
        schema_path = Path("src/etl/data_contract.schema.json")
        data_path = Path("src/frontend/assets/data/datos-dashboard.json")

        self.assertTrue(schema_path.exists(), "Missing schema file: src/etl/data_contract.schema.json")
        self.assertTrue(data_path.exists(), "Missing data file: datos-dashboard.json")

        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        data = json.loads(data_path.read_text(encoding="utf-8"))

        validator = Draft7Validator(schema)
        errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
        if errors:
            messages = []
            for err in errors:
                loc = ".".join([str(p) for p in err.path]) or "<root>"
                messages.append(f"{loc}: {err.message}")
            self.fail("Schema validation errors:\\n" + "\\n".join(messages))


if __name__ == "__main__":
    unittest.main()
