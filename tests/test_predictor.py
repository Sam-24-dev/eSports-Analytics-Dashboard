import unittest
import pandas as pd
import numpy as np
from src.ml.predictor import (
    _engineer_features,
    _build_prediction_features,
    _classify_confidence_band,
    _classify_risk_band,
    _normalize_confidence_scores,
    _build_projection_bundle_from_rows,
)


class TestPredictor(unittest.TestCase):
    def test_engineer_features(self):
        df = pd.DataFrame({
            'partidos_jugados': [10, 20, 0],
            'partidos_ganados': [5, 15, 0],
            'minutos_jugados': [300, 600, 0],
        })

        engineered = _engineer_features(df)

        self.assertIn('win_loss_ratio', engineered.columns)
        self.assertIn('minutes_per_match', engineered.columns)
        self.assertEqual(engineered['win_loss_ratio'].iloc[0], 1.0)
        self.assertEqual(engineered['minutes_per_match'].iloc[0], 30.0)
        self.assertEqual(engineered['win_loss_ratio'].iloc[2], 0.0)
        self.assertEqual(engineered['minutes_per_match'].iloc[2], 0.0)

    def test_build_prediction_features(self):
        df = pd.DataFrame({
            'jugador_id': [1, 1, 2],
            'anio': [2024, 2025, 2024],
            'edad': [20, 21, 25],
        })

        pred_features = _build_prediction_features(df)

        self.assertEqual(len(pred_features), 2)
        p1 = pred_features[pred_features['jugador_id'] == 1].iloc[0]
        p2 = pred_features[pred_features['jugador_id'] == 2].iloc[0]
        self.assertEqual(p1['edad'], 22)
        self.assertEqual(p2['edad'], 27)

    def test_normalize_confidence_scores_prefers_lower_dispersion(self):
        stds = np.array([0.2, 0.5, 1.0])
        scores = _normalize_confidence_scores(stds)
        self.assertAlmostEqual(scores[0], 100.0)
        self.assertGreater(scores[1], scores[2])
        self.assertAlmostEqual(scores[2], 0.0)

    def test_confidence_and_risk_band_classification(self):
        self.assertEqual(_classify_confidence_band(82.0), 'Alta')
        self.assertEqual(_classify_confidence_band(55.0), 'Media')
        self.assertEqual(_classify_confidence_band(21.0), 'Baja')

        self.assertEqual(_classify_risk_band(4.2, 80.0), 'Salto esperado')
        self.assertEqual(_classify_risk_band(-4.0, 75.0), 'Riesgo de caída')
        self.assertEqual(_classify_risk_band(0.4, 60.0), 'Estable')
        self.assertEqual(_classify_risk_band(1.8, 35.0), 'A observar')

    def test_build_projection_bundle_from_rows_produces_aggregates(self):
        rows = [
            {
                'player_name': 'Carlos Hernandez',
                'team': 'Guerreros Andinos',
                'team_country': 'Ecuador',
                'player_nationality': 'Ecuador',
                'age_2026': 23,
                'actual_winrate': 75.0,
                'predicted_winrate': 78.1,
                'delta': 3.1,
                'trend': 'Improved',
                'confidence_score': 84.0,
                'confidence_band': 'Alta',
                'risk_band': 'Salto esperado',
            },
            {
                'player_name': 'Alejandro Cardenas',
                'team': 'Guerreros del Sol',
                'team_country': 'Ecuador',
                'player_nationality': 'Ecuador',
                'age_2026': 25,
                'actual_winrate': 75.0,
                'predicted_winrate': 77.8,
                'delta': 2.8,
                'trend': 'Improved',
                'confidence_score': 76.0,
                'confidence_band': 'Alta',
                'risk_band': 'Salto esperado',
            },
            {
                'player_name': 'Julian Torres',
                'team': 'Cóndores del Pacífico',
                'team_country': 'Perú',
                'player_nationality': 'Perú',
                'age_2026': 26,
                'actual_winrate': 90.0,
                'predicted_winrate': 79.0,
                'delta': -11.0,
                'trend': 'Declined',
                'confidence_score': 73.0,
                'confidence_band': 'Alta',
                'risk_band': 'Riesgo de caída',
            },
        ]
        feature_importances = {
            'trabajo_en_equipo': 0.4,
            'win_loss_ratio': 0.35,
            'minutes_per_match': 0.25,
        }

        bundle = _build_projection_bundle_from_rows(rows, feature_importances)

        self.assertEqual(bundle['summary']['players_count'], 3)
        self.assertEqual(bundle['summary']['best_projected_player'], 'Julian Torres')
        self.assertEqual(bundle['summary']['biggest_improvement_player'], 'Carlos Hernandez')
        self.assertEqual(bundle['summary']['biggest_decline_player'], 'Julian Torres')
        self.assertEqual(bundle['summary']['best_projected_team'], 'Cóndores del Pacífico')
        self.assertEqual(bundle['players'][0]['projected_rank'], 1)
        self.assertEqual(bundle['team_summary'][0]['team'], 'Cóndores del Pacífico')
        self.assertEqual(bundle['country_summary'][0]['country'], 'Perú')
        self.assertEqual(bundle['feature_importance'][0]['feature_label'], 'Trabajo en equipo')
        self.assertAlmostEqual(bundle['feature_importance'][0]['importance_pct'], 40.0)


if __name__ == '__main__':
    unittest.main()
