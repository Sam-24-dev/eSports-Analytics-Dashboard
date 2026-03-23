import json
import unittest
from pathlib import Path

from jsonschema import Draft7Validator


class TestPlayerModuleContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads(Path("src/etl/data_contract.schema.json").read_text(encoding="utf-8"))
        cls.data = json.loads(Path("src/frontend/assets/data/datos-dashboard.json").read_text(encoding="utf-8"))

    def test_phase2_snapshot_emits_required_fields(self):
        self.assertTrue(self.data["player_evolution"], "Expected player_evolution sample data")
        self.assertTrue(
            self.data["filter_ready"]["player_evolution_by_competition"],
            "Expected filter_ready.player_evolution_by_competition sample data",
        )

        player_row = self.data["player_evolution"][0]
        competition_row = self.data["filter_ready"]["player_evolution_by_competition"][0]

        for field in ("team_2024", "team_2025", "improvement_pct"):
            self.assertIn(field, player_row)

        for field in ("team", "competition_year", "improvement_pct"):
            self.assertIn(field, competition_row)

        errors = sorted(Draft7Validator(self.schema).iter_errors(self.data), key=lambda e: list(e.path))
        if errors:
            messages = []
            for err in errors:
                loc = ".".join([str(p) for p in err.path]) or "<root>"
                messages.append(f"{loc}: {err.message}")
            self.fail("Schema should accept Phase 2 player module snapshot:\\n" + "\\n".join(messages))

    def test_phase2_fields_are_required_in_schema(self):
        player_props = self.schema["properties"]["player_evolution"]["items"]
        comp_props = self.schema["properties"]["filter_ready"]["properties"]["player_evolution_by_competition"]["items"]

        for field in ("team_2024", "team_2025", "improvement_pct"):
            self.assertIn(field, player_props["properties"])
            self.assertIn(field, player_props["required"])

        for field in ("team", "competition_year", "improvement_pct"):
            self.assertIn(field, comp_props["properties"])
            self.assertIn(field, comp_props["required"])

    def test_player_module_snapshot_locks_phase2_decisions(self):
        players_index = self.data["filter_ready"]["players_index"]
        self.assertTrue(players_index, "Expected players_index entries for player search suggestions")

        player_index_row = players_index[0]
        for field in ("name", "nationality", "team", "search_key"):
            self.assertIn(field, player_index_row)

        competition_rows = self.data["filter_ready"]["player_evolution_by_competition"]
        self.assertTrue(competition_rows, "Expected competition-scoped player evolution rows")
        self.assertIn("competition_year", competition_rows[0])


if __name__ == "__main__":
    unittest.main()
