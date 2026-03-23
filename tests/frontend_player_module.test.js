const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Filtering = require('../src/frontend/assets/js/filtering.js');

function loadMainExports() {
  const sourcePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'js', 'main.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const wrapped = `${source}

module.exports = {
  buildPlayerModuleViewModel,
  buildPlayerModuleTooltipLines,
  buildPlayerModuleTableModel,
  buildPlayerModuleChartModel,
  buildPlayerModuleSuggestionView,
  getPlayerModuleTableTitle,
  truncatePlayerModuleLabel,
  setDashboardData: (value) => { dashboardData = value; },
  setCurrentData: (value) => { currentData = value; },
  setCurrentPlayerModuleView: (value) => { currentPlayerModuleView = value; }
};
`;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    window: {
      Filtering,
      addEventListener: () => {},
      history: { replaceState: () => {} },
      location: { search: '', pathname: '/index.html' },
      matchMedia: () => ({ matches: false })
    },
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null
    },
    IntersectionObserver: function () {
      return { observe: () => {}, disconnect: () => {} };
    },
    URLSearchParams,
    Chart: undefined
  };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  return sandbox.module.exports;
}

function buildSampleData() {
  return {
    player_evolution: [
      { name: 'Ana Ruiz', nationality: 'Chile', team_2024: 'Condores', team_2025: 'Fenix', performance_2024: 60, performance_2025: 84, trend: 'Improved', improvement: 24, improvement_pct: 40.0 },
      { name: 'Beto Lagos', nationality: 'Chile', team_2024: 'Condores', team_2025: 'Condores', performance_2024: 58, performance_2025: 70, trend: 'Improved', improvement: 12, improvement_pct: 20.69 },
      { name: 'Carla Vega', nationality: 'Peru', team_2024: 'Incas', team_2025: 'Incas', performance_2024: 50, performance_2025: 82, trend: 'Improved', improvement: 32, improvement_pct: 64.0 },
      { name: 'Diego Soto', nationality: 'Argentina', team_2024: 'Pampas', team_2025: null, performance_2024: 65, performance_2025: null, trend: 'No data 2025', improvement: null, improvement_pct: null },
      { name: 'Elena Marquez', nationality: 'Mexico', team_2024: null, team_2025: 'Aztecas', performance_2024: null, performance_2025: 75, trend: 'No data 2024', improvement: null, improvement_pct: null },
      { name: 'Fabio Leon', nationality: 'Bolivia', team_2024: 'Altiplano', team_2025: 'Altiplano', performance_2024: 45, performance_2025: 47, trend: 'Improved', improvement: 2, improvement_pct: 4.44 },
      { name: 'Gina Paz', nationality: 'Chile', team_2024: 'Fenix', team_2025: 'Fenix', performance_2024: 70, performance_2025: 71, trend: 'Improved', improvement: 1, improvement_pct: 1.43 },
      { name: 'Nora Quinteros', nationality: 'Chile', team_2024: 'Fenix', team_2025: 'Fenix', performance_2024: 72, performance_2025: 60, trend: 'Declined', improvement: -12, improvement_pct: -16.67 },
      { name: 'Hector Mora', nationality: 'Ecuador', team_2024: 'Lobos', team_2025: 'Lobos', performance_2024: 75, performance_2025: 75, trend: 'No change', improvement: 0, improvement_pct: 0.0 },
      { name: 'Iris Perez', nationality: 'Ecuador', team_2024: 'Lobos', team_2025: 'Lobos', performance_2024: 68, performance_2025: 31.3, trend: 'Declined', improvement: -36.7, improvement_pct: -53.97 }
    ],
    filter_ready: {
      players_index: [
        { name: 'Ana Ruiz', search_key: 'ana ruiz' },
        { name: 'Beto Lagos', search_key: 'beto lagos' },
        { name: 'Carla Vega', search_key: 'carla vega' },
        { name: 'Diego Soto', search_key: 'diego soto' },
        { name: 'Elena Marquez', search_key: 'elena marquez' },
        { name: 'Fabio Leon', search_key: 'fabio leon' },
        { name: 'Gina Paz', search_key: 'gina paz' },
      ],
      player_evolution_by_competition: [
        { competition_name: 'Comp 2025', competition_year: 2025, name: 'Ana Ruiz', nationality: 'Chile', team: 'Fenix', performance_2024: 60, performance_2025: 84, trend: 'Improved', improvement: 24, improvement_pct: 40.0 },
        { competition_name: 'Comp 2025', competition_year: 2025, name: 'Beto Lagos', nationality: 'Chile', team: 'Condores', performance_2024: 58, performance_2025: 70, trend: 'Improved', improvement: 12, improvement_pct: 20.69 },
        { competition_name: 'Comp 2025', competition_year: 2025, name: 'Carla Vega', nationality: 'Peru', team: 'Incas', performance_2024: 50, performance_2025: 82, trend: 'Improved', improvement: 32, improvement_pct: 64.0 },
        { competition_name: 'Comp 2025', competition_year: 2025, name: 'Elena Marquez', nationality: 'Mexico', team: 'Aztecas', performance_2024: null, performance_2025: 75, trend: 'No data 2024', improvement: null, improvement_pct: null },
        { competition_name: 'Comp 2025', competition_year: 2025, name: 'Fabio Leon', nationality: 'Bolivia', team: 'Altiplano', performance_2024: 45, performance_2025: 47, trend: 'Improved', improvement: 2, improvement_pct: 4.44 },
        { competition_name: 'Broken 2025', competition_year: 2025, name: 'Ivan Null', nationality: 'Bolivia', team: 'Altiplano', performance_2024: 55, performance_2025: null, trend: 'No data 2025', improvement: null, improvement_pct: null }
      ]
    }
  };
}

function buildView(main, filters) {
  const data = buildSampleData();
  const currentData = Filtering.buildFilteredData(data, filters);
  main.setDashboardData(data);
  main.setCurrentData(currentData);
  main.setCurrentPlayerModuleView(null);
  return main.buildPlayerModuleViewModel(filters);
}

(function testGlobalEvolutionModeUsesTopFiveComparableRows() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: '' });

  assert.strictEqual(view.mode, 'evolution');
  assert.strictEqual(view.rows.length, 5);
  assert.deepStrictEqual(view.rows.map((row) => row.name), [
    'Carla Vega',
    'Ana Ruiz',
    'Beto Lagos',
    'Fabio Leon',
    'Gina Paz'
  ]);
  assert.strictEqual(view.tableModel.rows.length, view.rows.length);
  assert.strictEqual(view.chartModel.datasets.length, 2);
})();

(function testCountryEvolutionModeKeepsOnlyComparableRows() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Chile', competition: '', search: '' });

  assert.strictEqual(view.mode, 'evolution');
  assert.deepStrictEqual(view.rows.map((row) => row.name), ['Ana Ruiz', 'Beto Lagos', 'Gina Paz']);
  assert.strictEqual(view.chartModel.hideRowLabels, false);
})();

(function testCountryWithoutPositiveImprovementsShowsGuidedEmptyState() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Ecuador', competition: '', search: '' });

  assert.strictEqual(view.mode, 'empty');
  assert.strictEqual(view.emptyState.message, 'Sin mejoras positivas 2024-2025');
  assert.strictEqual(view.emptyState.hint, 'Selecciona una competencia para ver ranking anual');
})();

(function testCompetitionUsesSingleYearRanking() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Comp 2025', search: '' });

  assert.strictEqual(view.mode, 'single-year');
  assert.deepStrictEqual(view.rows.map((row) => row.name), [
    'Ana Ruiz',
    'Carla Vega',
    'Elena Marquez',
    'Beto Lagos',
    'Fabio Leon'
  ]);
  assert.strictEqual(view.rows[0].performance_value, 84);
  assert.strictEqual(view.chartModel.datasets.length, 1);
})();

(function testCountryCompetitionUsesSingleYearRanking() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Chile', competition: 'Comp 2025', search: '' });

  assert.strictEqual(view.mode, 'single-year');
  assert.deepStrictEqual(view.rows.map((row) => row.name), ['Ana Ruiz', 'Beto Lagos']);
})();

(function testCompetitionWithoutYearAlignedPerformanceShowsSpecificEmptyState() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Bolivia', competition: 'Broken 2025', search: '' });

  assert.strictEqual(view.mode, 'empty');
  assert.strictEqual(view.emptyState.message, 'Sin rendimiento anual de jugadores para este filtro');
})();

(function testSingleYearOneRowUsesPlayerSpecificTitleAndHiddenRowLabels() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Mexico', competition: 'Comp 2025', search: '' });

  assert.strictEqual(view.mode, 'single-year');
  assert.strictEqual(view.rows.length, 1);
  assert.strictEqual(view.title, 'Rendimiento de Elena Marquez en Comp 2025');
  assert.strictEqual(view.chartModel.hideRowLabels, true);
})();

(function testCountryEvolutionSingleRowHidesYAxisLabel() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Bolivia', competition: '', search: '' });

  assert.strictEqual(view.mode, 'evolution');
  assert.strictEqual(view.rows.length, 1);
  assert.strictEqual(view.chartModel.hideRowLabels, true);
})();

(function testExactPlayerWithTwoYearsUsesEvolutionDetail() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: 'Ana Ruiz' });

  assert.strictEqual(view.mode, 'evolution');
  assert.strictEqual(view.rows.length, 1);
  assert.strictEqual(view.selectedPlayer, 'Ana Ruiz');
  assert.strictEqual(view.chartModel.hideRowLabels, true);
  assert.strictEqual(view.title, 'Evolución de Ana Ruiz: 2024 -> 2025');
})();

(function testExactPlayerWithOneYearUsesSingleYearDetail() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: 'Diego Soto' });

  assert.strictEqual(view.mode, 'single-year');
  assert.strictEqual(view.rows.length, 1);
  assert.strictEqual(view.rows[0].competition_year, 2024);
  assert.strictEqual(view.rows[0].display_team, 'Pampas');
})();

(function testPartialSearchDoesNotMutatePlayerModule() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: 'Ana' });

  assert.strictEqual(view.mode, 'evolution');
  assert.strictEqual(view.selectedPlayer, null);
  assert.strictEqual(view.rows.length, 5);
})();

(function testExactPlayerAndCompetitionUsesSingleYearDetail() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Comp 2025', search: 'Ana Ruiz' });

  assert.strictEqual(view.mode, 'single-year');
  assert.strictEqual(view.rows.length, 1);
  assert.strictEqual(view.title, 'Rendimiento de Ana Ruiz en Comp 2025');
})();

(function testTooltipLinesMatchMode() {
  const main = loadMainExports();
  const evolutionView = buildView(main, { country: '', competition: '', search: 'Ana Ruiz' });
  const evolutionTooltip = main.buildPlayerModuleTooltipLines(evolutionView, evolutionView.rows[0]);
  assert.strictEqual(JSON.stringify(evolutionTooltip), JSON.stringify([
    'País: Chile',
    'Equipo 2024: Condores',
    'Equipo 2025: Fenix',
    'Rendimiento 2024: 60.0%',
    'Rendimiento 2025: 84.0%',
    'Mejora %: +40.00%'
  ]));

  const singleYearView = buildView(main, { country: '', competition: 'Comp 2025', search: 'Ana Ruiz' });
  const singleYearTooltip = main.buildPlayerModuleTooltipLines(singleYearView, singleYearView.rows[0]);
  assert.strictEqual(JSON.stringify(singleYearTooltip), JSON.stringify([
    'País: Chile',
    'Equipo: Fenix',
    'Competencia: Comp 2025',
    'Año: 2025',
    'Rendimiento: 84.0%',
    'Posición del ranking: #1'
  ]));
})();

(function testTableTitleMatchesViewMode() {
  const main = loadMainExports();
  const evolutionView = buildView(main, { country: '', competition: '', search: '' });
  const singleYearView = buildView(main, { country: '', competition: 'Comp 2025', search: '' });

  assert.strictEqual(main.getPlayerModuleTableTitle(evolutionView), 'Evolución de jugadores');
  assert.strictEqual(main.getPlayerModuleTableTitle(singleYearView), 'Detalle de rendimiento');
})();

(function testContextualSuggestionsRespectEvolutionRankingAndMetadata() {
  const main = loadMainExports();
  const data = buildSampleData();
  const currentData = Filtering.buildFilteredData(data, { country: '', competition: '', search: '' });
  main.setDashboardData(data);
  main.setCurrentData(currentData);
  const suggestionView = main.buildPlayerModuleSuggestionView({ country: '', competition: '', search: '' });

  assert.strictEqual(suggestionView.variant, 'context');
  assert.strictEqual(JSON.stringify(suggestionView.items.map((item) => item.name)), JSON.stringify([
    'Carla Vega',
    'Ana Ruiz',
    'Beto Lagos',
    'Fabio Leon',
    'Gina Paz'
  ]));
  assert.strictEqual(suggestionView.items[0].meta, 'Peru · Incas · 2024-2025');
})();

(function testTypedSuggestionsStayInContextAndCanSurfaceSingleYearPlayers() {
  const main = loadMainExports();
  const data = buildSampleData();
  const currentData = Filtering.buildFilteredData(data, { country: '', competition: '', search: '' });
  main.setDashboardData(data);
  main.setCurrentData(currentData);

  const suggestionView = main.buildPlayerModuleSuggestionView({ country: '', competition: '', search: 'Diego' });

  assert.strictEqual(suggestionView.variant, 'search');
  assert.strictEqual(JSON.stringify(suggestionView.items.map((item) => item.name)), JSON.stringify(['Diego Soto']));
  assert.strictEqual(suggestionView.items[0].meta, 'Argentina · Pampas · 2024');
})();

(function testCompetitionSuggestionsRankBySingleYearPerformance() {
  const main = loadMainExports();
  const data = buildSampleData();
  const currentData = Filtering.buildFilteredData(data, { country: '', competition: 'Comp 2025', search: '' });
  main.setDashboardData(data);
  main.setCurrentData(currentData);

  const suggestionView = main.buildPlayerModuleSuggestionView({ country: '', competition: 'Comp 2025', search: '' });

  assert.strictEqual(suggestionView.variant, 'context');
  assert.strictEqual(JSON.stringify(suggestionView.items.map((item) => item.name)), JSON.stringify([
    'Ana Ruiz',
    'Carla Vega',
    'Elena Marquez',
    'Beto Lagos',
    'Fabio Leon'
  ]));
  assert.strictEqual(suggestionView.items[0].meta, 'Chile · Fenix · 2025');
})();

(function testContextualSuggestionsExposeEmptyStateWhenNothingMatches() {
  const main = loadMainExports();
  const data = buildSampleData();
  const currentData = Filtering.buildFilteredData(data, { country: 'Chile', competition: 'Comp 2025', search: '' });
  main.setDashboardData(data);
  main.setCurrentData(currentData);

  const suggestionView = main.buildPlayerModuleSuggestionView({ country: 'Chile', competition: 'Comp 2025', search: 'Zeta' });

  assert.strictEqual(suggestionView.variant, 'empty');
  assert.strictEqual(suggestionView.message, 'No hay coincidencias en este contexto');
})();

(function testChartLabelTruncationIsVisualOnly() {
  const main = loadMainExports();
  assert.strictEqual(main.truncatePlayerModuleLabel('Jugador Muy Largo de Prueba', 12), 'Jugador M...');
  assert.strictEqual(main.truncatePlayerModuleLabel('Ana Ruiz', 12), 'Ana Ruiz');
})();

console.log('frontend_player_module tests passed');
