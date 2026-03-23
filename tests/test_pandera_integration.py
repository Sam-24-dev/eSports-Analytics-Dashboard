import unittest
import pandas as pd

from src.etl.pipeline import validate


class TestPanderaIntegration(unittest.TestCase):
    def test_validate_fails_on_type_errors_with_pandera(self):
        df = pd.DataFrame({
            "total_teams": ["bad"],
            "total_players": [1],
            "total_prizes": [100.0],
            "countries_represented": [1],
            "active_competitions": [1],
            "average_age": [25.0],
            "international_competitions": [0],
            "national_competitions": [1],
        })
        raw = {"kpis": df}

        with self.assertRaises(SystemExit):
            validate(raw)


if __name__ == "__main__":
    unittest.main()
