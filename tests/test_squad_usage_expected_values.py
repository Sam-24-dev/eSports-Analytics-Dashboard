import unittest

from src.etl.squad_usage_expected_values import (
    build_squad_usage_view,
    generate_validation_markdown,
    list_valid_filters,
    load_dashboard_snapshot,
)


class TestSquadUsageExpectedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_dashboard_snapshot()

    def test_global_view_returns_expected_shape(self):
        view = build_squad_usage_view(self.snapshot)

        self.assertTrue(view["visible"])
        self.assertEqual(view["context"], "global")
        self.assertEqual(view["title"], "Uso de Plantilla")
        self.assertEqual(view["subtitle"], "C\u00f3mo se reparten titulares y suplentes seg\u00fan el contexto")
        self.assertEqual(view["contextLabel"], "Vista general de titulares y suplentes")
        self.assertEqual(view["contextMeta"]["teamsLabel"], "15 equipos analizados")
        self.assertEqual(view["contextMeta"]["recordsLabel"], "45 registros de plantilla")
        self.assertEqual(view["contextMeta"]["singleCompetitionNote"], "")
        self.assertEqual(len(view["summary"]), 4)
        self.assertEqual(view["insight"]["title"], "Predominio titular")
        self.assertNotIn("label", view["insight"])
        self.assertEqual(
            view["insight"]["description"],
            "3 de 45 registros de plantilla fueron suplentes. Rendimiento promedio: titulares 62.0% \u00B7 suplentes 66.0%.",
        )
        self.assertEqual(view["chartModel"]["segments"][0]["label"], "Titular")
        self.assertEqual(view["chartModel"]["segments"][1]["label"], "Suplente")
        self.assertEqual(view["tableModel"]["columns"], ["Equipo", "Pa\u00eds", "Titulares", "Suplentes", "% suplentes", "Diferencia de rendimiento"])
        self.assertEqual(view["tableModel"]["rows"][0]["team"], "Cóndores Rojos")

    def test_country_view_keeps_country_context_even_with_search(self):
        view = build_squad_usage_view(self.snapshot, country="Chile", search="Carlos Hernandez")

        self.assertEqual(view["context"], "country")
        self.assertEqual(view["contextLabel"], "As\u00ed se reparte la plantilla de Chile")
        self.assertEqual(view["contextMeta"]["teamsLabel"], "3 equipos analizados")
        self.assertEqual(view["contextMeta"]["recordsLabel"], "9 registros de plantilla")
        self.assertEqual(view["contextMeta"]["singleCompetitionNote"], "")
        self.assertEqual(view["insight"]["title"], "Sin uso de suplentes")
        self.assertEqual(view["insight"]["description"], "Todos los registros de plantilla fueron titulares.")
        self.assertEqual(view["tableModel"]["columns"], ["Equipo", "Titulares", "Suplentes", "% suplentes", "Diferencia de rendimiento"])
        self.assertEqual(view["tableModel"]["rows"][0]["team"], "Dragones de Fuego")

    def test_competition_view_keeps_competition_context_even_with_search(self):
        view = build_squad_usage_view(
            self.snapshot,
            competition="Copa Andina 2024",
            search="Carlos Hernandez",
        )

        self.assertEqual(view["context"], "competition")
        self.assertEqual(view["contextLabel"], "As\u00ed se reparti\u00f3 la plantilla en Copa Andina 2024")
        self.assertEqual(view["contextMeta"]["teamsLabel"], "4 equipos analizados")
        self.assertEqual(view["contextMeta"]["recordsLabel"], "10 registros de plantilla")
        self.assertEqual(view["insight"]["title"], "Rotaci\u00f3n moderada")
        self.assertEqual(
            view["insight"]["description"],
            "1 de 10 registros de plantilla fue suplente. Rendimiento promedio: titulares 60.5% \u00B7 suplentes 75.0%.",
        )
        self.assertEqual(view["tableModel"]["columns"], ["Equipo", "Pa\u00eds", "Titulares", "Suplentes", "% suplentes", "Diferencia de rendimiento"])
        self.assertEqual(view["tableModel"]["rows"][0]["team"], "Guerreros Andinos")

    def test_country_competition_view_keeps_context_and_null_gap_label(self):
        view = build_squad_usage_view(
            self.snapshot,
            country="Chile",
            competition="Challenger Sur 2025",
            search="Fernando Lopez",
        )

        self.assertEqual(view["context"], "country_competition")
        self.assertEqual(view["contextLabel"], "As\u00ed reparti\u00f3 Chile su plantilla en Challenger Sur 2025")
        self.assertEqual(view["contextMeta"]["teamsLabel"], "1 equipo analizado")
        self.assertEqual(view["contextMeta"]["recordsLabel"], "2 registros de plantilla")
        self.assertEqual(view["insight"]["title"], "Sin uso de suplentes")
        self.assertEqual(view["insight"]["description"], "Todos los registros de plantilla fueron titulares.")
        self.assertEqual(view["tableModel"]["rows"][0]["performanceGapLabel"], "Sin comparaci\u00f3n")
        self.assertEqual(view["tableModel"]["rows"][0]["performanceGapTone"], "not-comparable")
        self.assertEqual(view["tableModel"]["columns"], ["Equipo", "Titulares", "Suplentes", "% suplentes", "Diferencia de rendimiento"])

    def test_country_with_single_competition_shows_note_and_missing_comparison_copy(self):
        view = build_squad_usage_view(self.snapshot, country="Bolivia")

        self.assertEqual(view["context"], "country")
        self.assertEqual(view["contextMeta"]["teamsLabel"], "1 equipo analizado")
        self.assertEqual(view["contextMeta"]["recordsLabel"], "3 registros de plantilla")
        self.assertEqual(view["contextMeta"]["singleCompetitionNote"], "Este pa\u00eds solo tiene registros en una competencia")
        self.assertEqual(view["insight"]["title"], "Rotaci\u00f3n alta")
        self.assertEqual(
            view["insight"]["description"],
            "1 de 3 registros de plantilla fue suplente. No hay datos de rendimiento del a\u00f1o para comparar roles.",
        )

    def test_country_competition_for_single_competition_country_keeps_note(self):
        view = build_squad_usage_view(
            self.snapshot,
            country="Bolivia",
            competition="Masters Latam 2025",
        )

        self.assertEqual(view["contextMeta"]["singleCompetitionNote"], "Este pa\u00eds solo tiene registros en una competencia")

    def test_country_with_multiple_competitions_does_not_show_note(self):
        view = build_squad_usage_view(self.snapshot, country="Ecuador")

        self.assertEqual(view["contextMeta"]["singleCompetitionNote"], "")

    def test_table_rows_are_sorted_by_substitute_share_desc(self):
        view = build_squad_usage_view(self.snapshot)
        rows = view["tableModel"]["rows"]

        self.assertGreaterEqual(rows[0]["substituteSharePct"], rows[1]["substituteSharePct"])
        self.assertEqual(rows[0]["team"], "Cóndores Rojos")
        self.assertEqual(rows[1]["team"], "Guerreros Andinos")

    def test_list_valid_filters_contains_expected_entries(self):
        filters = list_valid_filters(self.snapshot)

        self.assertIn("Chile", filters["countries"])
        self.assertIn("Copa Andina 2024", filters["competitions"])
        self.assertIn(("Ecuador", "Copa Andina 2024"), filters["country_competition_pairs"])

    def test_markdown_contains_required_sections_and_controlled_cases(self):
        markdown = generate_validation_markdown(self.snapshot)

        self.assertIn("# Validacion Plantilla vs Front", markdown)
        self.assertIn("## Estado global", markdown)
        self.assertIn("## Estados por pais", markdown)
        self.assertIn("## Estados por competencia", markdown)
        self.assertIn("## Estados pais + competencia validos", markdown)
        self.assertIn("## Caso controlado - Sin uso de suplentes", markdown)
        self.assertIn("## Caso controlado - Diferencia de rendimiento nula", markdown)
        self.assertIn("## Estado vacio controlado", markdown)
        self.assertIn("Sin uso de suplentes", markdown)
        self.assertIn("Sin comparaci\u00f3n", markdown)
        self.assertIn("Este pa\u00eds solo tiene registros en una competencia", markdown)
        self.assertIn("1 de 3 registros de plantilla fue suplente", markdown)
        self.assertIn("As\u00ed reparti\u00f3 Bolivia su plantilla en Masters Latam 2025", markdown)
        self.assertNotIn("Lectura del contexto", markdown)


if __name__ == "__main__":
    unittest.main()


