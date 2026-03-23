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
  buildContextualTableViewModel,
  renderContextualTable,
  setDashboardData: (value) => { dashboardData = value; },
  setCurrentData: (value) => { currentData = value; },
  setCurrentPlayerModuleView: (value) => { currentPlayerModuleView = value; }
};
`;

  const elements = {};
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
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
      querySelector: (selector) => {
        if (selector === '#contextual-table thead tr') return elements.contextualTableHeadRow || null;
        if (selector === '#contextual-table tbody') return elements.contextualTableBody || null;
        return null;
      }
    },
    IntersectionObserver: function () {
      return { observe: () => {}, disconnect: () => {} };
    },
    URLSearchParams,
    Chart: undefined
  };

  elements.contextualTableTitle = { innerHTML: '', textContent: '' };
  elements.contextualTableBody = { innerHTML: '' };
  elements.contextualTableHeadRow = { innerHTML: '' };
  elements['contextual-table-title'] = elements.contextualTableTitle;
  elements['contextual-table'] = {};

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function buildSampleData() {
  return {
    teams_catalog: [
      { name: 'Lobos Urbanos', country: 'Ecuador', participating_competitions: 1, total_players: 2, best_position: 1, total_prizes: 45000 },
      { name: 'Leones', country: 'Colombia', participating_competitions: 2, total_players: 3, best_position: 1, total_prizes: 35000 },
      { name: 'Condores Rojos', country: 'Bolivia', participating_competitions: 1, total_players: 3, best_position: 2, total_prizes: 35000 },
      { name: 'Halcones del Sur', country: 'Chile', participating_competitions: 1, total_players: 2, best_position: 1, total_prizes: 25000 }
    ],
    player_evolution: [
      { name: 'Matias Rojas', nationality: 'Peru', team_2024: 'Condores del Pacifico', team_2025: 'Condores del Pacifico', performance_2024: 55, performance_2025: 71.4, trend: 'Improved', improvement: 16.4, improvement_pct: 29.82 },
      { name: 'Cristian Mendez', nationality: 'Mexico', team_2024: null, team_2025: 'Jaguares Negros', performance_2024: null, performance_2025: 70, trend: 'No change', improvement: null, improvement_pct: null }
    ],
    filter_ready: {
      players_index: [
        { name: 'Matias Rojas', nationality: 'Peru', team: 'Condores del Pacifico', search_key: 'matias rojas' },
        { name: 'Cristian Mendez', nationality: 'Mexico', team: 'Jaguares Negros', search_key: 'cristian mendez' }
      ],
      kpis_by_country: [
        { country: 'Chile' },
        { country: 'Bolivia' }
      ],
      kpis_by_competition: [
        { competition_name: 'Challenger Sur 2025' },
        { competition_name: 'Masters Latam 2025' }
      ],
      player_evolution_by_competition: [
        { competition_name: 'Challenger Sur 2025', competition_year: 2025, name: 'Cristian Mendez', nationality: 'Mexico', team: 'Jaguares Negros', performance_2024: null, performance_2025: 70, trend: 'No change', improvement: null, improvement_pct: null },
        { competition_name: 'Challenger Sur 2025', competition_year: 2025, name: 'Matias Rojas', nationality: 'Peru', team: 'Condores del Pacifico', performance_2024: 55, performance_2025: 71.4, trend: 'Improved', improvement: 16.4, improvement_pct: 29.82 }
      ],
      top_teams_by_competition: [
        { competition_name: 'Masters Latam 2025', team: 'Condores Rojos', country: 'Bolivia', final_position: 2, prize_obtained: 35000, total_players: 3 },
        { competition_name: 'Masters Latam 2025', team: 'Lobos Urbanos', country: 'Ecuador', final_position: 1, prize_obtained: 45000, total_players: 2 }
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
  return main.buildContextualTableViewModel(filters);
}

(function testGlobalUsesTeamsOverview() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: '' });

  assert.strictEqual(view.mode, 'teams-overview');
  assert.strictEqual(view.title, 'Equipos destacados');
  assert.strictEqual(JSON.stringify(view.headers), JSON.stringify(['Equipo', 'País', 'Competiciones', 'Jugadores', 'Premios', 'Mejor puesto']));
  assert.strictEqual(view.sortMeta.key, 'total_prizes');
  assert.strictEqual(view.rows[0].cells[0].text, 'Lobos Urbanos');
})();

(function testCountryHidesCountryColumn() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Chile', competition: '', search: '' });

  assert.strictEqual(view.mode, 'teams-overview');
  assert.strictEqual(view.title, 'Equipos de Chile');
  assert.strictEqual(JSON.stringify(view.headers), JSON.stringify(['Equipo', 'Competiciones', 'Jugadores', 'Premios', 'Mejor puesto']));
})();

(function testCompetitionWithPlayersUsesPlayersRanking() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Challenger Sur 2025', search: '' });

  assert.strictEqual(view.mode, 'players-ranking');
  assert.strictEqual(view.title, 'Jugadores destacados en Challenger Sur 2025');
  assert.strictEqual(JSON.stringify(view.headers), JSON.stringify(['Pos.', 'Jugador', 'Equipo', 'País', 'Rendimiento', 'Variación anual']));
  assert.strictEqual(view.sortMeta.key, 'performance');
  assert.strictEqual(view.rows[0].cells[1].text, 'Matias Rojas');
})();

(function testCompetitionWithoutComparableVariationUsesSinComparacion() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Challenger Sur 2025', search: '' });
  const variationCell = view.rows[1].cells[5];

  assert.strictEqual(variationCell.text, 'Sin comparación');
  assert.strictEqual(variationCell.tone, 'not-comparable');
})();

(function testCompetitionWithoutPlayersFallsBackToTeams() {
  const main = loadMainExports();
  const view = buildView(main, { country: 'Bolivia', competition: 'Masters Latam 2025', search: '' });

  assert.strictEqual(view.mode, 'teams-results');
  assert.strictEqual(view.title, 'Equipos de Bolivia en Masters Latam 2025');
  assert.strictEqual(JSON.stringify(view.headers), JSON.stringify(['Pos.', 'Equipo', 'Jugadores', 'Premio']));
  assert.strictEqual(view.rows[0].cells[1].text, 'Condores Rojos');
})();

(function testExactPlayerUsesPlayerDetail() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: 'Matias Rojas' });

  assert.strictEqual(view.mode, 'player-detail');
  assert.strictEqual(view.title, 'Detalle de Matias Rojas');
  assert.strictEqual(JSON.stringify(view.headers), JSON.stringify(['Año', 'Equipo', 'País', 'Rendimiento', 'Variación anual']));
  assert.strictEqual(view.rows.length, 2);
  assert.strictEqual(view.rows[0].cells[4].text, 'Sin comparación');
  assert.strictEqual(view.rows[0].cells[4].tone, 'not-comparable');
})();

(function testExactPlayerWithoutContextDataShowsSpecificEmptyState() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Masters Latam 2025', search: 'Cristian Mendez' });

  assert.strictEqual(view.mode, 'empty');
  assert.strictEqual(view.title, 'Detalle de Cristian Mendez en Masters Latam 2025');
  assert.strictEqual(view.emptyState.message, 'Jugador sin datos para este filtro');
})();

(function testPartialSearchDoesNotChangeMode() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: 'Matias' });

  assert.strictEqual(view.mode, 'teams-overview');
})();

(function testVariationToneIsExposed() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Challenger Sur 2025', search: '' });
  const variationCell = view.rows[0].cells[5];

  assert.strictEqual(variationCell.tone, 'positive');
  assert.strictEqual(variationCell.text, '+29.8%');
})();

(function testZeroVariationStaysNeutralAndDoesNotBecomeSinComparacion() {
  const main = loadMainExports();
  const data = buildSampleData();
  data.filter_ready.player_evolution_by_competition.push({
    competition_name: 'Challenger Sur 2025',
    competition_year: 2025,
    name: 'Alejandro Cardenas',
    nationality: 'Ecuador',
    team: 'Guerreros del Sol',
    performance_2024: 75,
    performance_2025: 75,
    trend: 'No change',
    improvement: 0,
    improvement_pct: 0
  });
  const currentData = Filtering.buildFilteredData(data, { country: '', competition: 'Challenger Sur 2025', search: '' });
  main.setDashboardData(data);
  main.setCurrentData(currentData);
  main.setCurrentPlayerModuleView(null);

  const view = main.buildContextualTableViewModel({ country: '', competition: 'Challenger Sur 2025', search: '' });
  const zeroRow = view.rows.find((row) => row.cells[1].text === 'Alejandro Cardenas');

  assert.ok(zeroRow, 'expected zero-variation row to be present');
  assert.strictEqual(zeroRow.cells[5].text, '0.0%');
  assert.strictEqual(zeroRow.cells[5].tone, 'neutral');
})();

(function testRenderContextualTablePaintsStructuredRows() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: '', search: '' });
  main.renderContextualTable(view);

  assert.ok(main.__elements.contextualTableHeadRow.innerHTML.includes('País'));
  assert.ok(main.__elements.contextualTableBody.innerHTML.includes('Lobos Urbanos'));
})();

(function testRenderContextualTableWrapsVariationWithToneClass() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Challenger Sur 2025', search: '' });
  main.renderContextualTable(view);

  assert.ok(main.__elements.contextualTableBody.innerHTML.includes('contextual-table-value--positive'));
})();

(function testRenderContextualTableUsesSubtleMarkupForSinComparacion() {
  const main = loadMainExports();
  const view = buildView(main, { country: '', competition: 'Challenger Sur 2025', search: '' });
  main.renderContextualTable(view);

  assert.ok(main.__elements.contextualTableBody.innerHTML.includes('Sin comparación'));
  assert.ok(main.__elements.contextualTableBody.innerHTML.includes('contextual-table-value--not-comparable'));
})();

console.log('frontend_contextual_table tests passed');
