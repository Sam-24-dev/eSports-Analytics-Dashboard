import unittest
import pandas as pd
from decimal import Decimal

from src.etl.pipeline import (
    _add_evolution_deltas,
    _cast_decimals,
    _filter_player_competition_rows_for_year,
    _to_records,
)

class TestPipeline(unittest.TestCase):
    def test_cast_decimals(self):
        df = pd.DataFrame({'value': [Decimal('10.5'), Decimal('20.0')]})
        raw = {'test_section': df}
        casted_raw = _cast_decimals(raw)
        
        self.assertEqual(casted_raw['test_section']['value'].dtype, 'float64')
        self.assertEqual(casted_raw['test_section']['value'].iloc[0], 10.5)

    def test_add_evolution_deltas(self):
        records = [
            {'performance_2024': 40.0, 'performance_2025': 50.0, 'trend': 'Improved'},
            {'performance_2024': 60.0, 'performance_2025': 45.0, 'trend': 'Declined'},
            {'performance_2024': 50.0, 'performance_2025': 50.0, 'trend': 'No change'},
            {'performance_2024': 0.0, 'performance_2025': 35.0, 'trend': 'Improved'},
            {'performance_2024': None, 'performance_2025': 35.0, 'trend': 'No change'},
        ]
        
        updated_records = _add_evolution_deltas(records)
        
        self.assertEqual(updated_records[0]['improvement'], 10.0)
        self.assertEqual(updated_records[0]['improvement_pct'], 25.0)
        self.assertNotIn('decline', updated_records[0])
        
        self.assertEqual(updated_records[1]['decline'], -15.0)
        self.assertEqual(updated_records[1]['improvement_pct'], -25.0)
        self.assertNotIn('improvement', updated_records[1])
        
        self.assertNotIn('improvement', updated_records[2])
        self.assertNotIn('decline', updated_records[2])
        self.assertEqual(updated_records[2]['improvement_pct'], 0.0)

        self.assertIsNone(updated_records[3]['improvement_pct'])
        self.assertIsNone(updated_records[4]['improvement_pct'])

    def test_to_records(self):
        df = pd.DataFrame({'a': [1, 2], 'b': ['x', 'y']})
        records = _to_records(df)
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]['a'], 1)
        self.assertEqual(records[1]['b'], 'y')

    def test_filter_player_competition_rows_for_year(self):
        records = [
            {
                'competition_name': 'Masters Latam 2025',
                'competition_year': 2025,
                'name': 'Pedro',
                'performance_2024': 55.0,
                'performance_2025': None,
            },
            {
                'competition_name': 'Masters Latam 2025',
                'competition_year': 2025,
                'name': 'Rafael',
                'performance_2024': 50.0,
                'performance_2025': 72.2,
            },
            {
                'competition_name': 'Copa Andina 2024',
                'competition_year': 2024,
                'name': 'Alejandro',
                'performance_2024': 75.0,
                'performance_2025': 75.0,
            },
        ]

        filtered = _filter_player_competition_rows_for_year(records)

        self.assertEqual(
            [(row['competition_name'], row['name']) for row in filtered],
            [('Masters Latam 2025', 'Rafael'), ('Copa Andina 2024', 'Alejandro')]
        )

if __name__ == '__main__':
    unittest.main()
