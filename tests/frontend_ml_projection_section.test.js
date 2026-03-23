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
  buildMLProjectionViewModel,
  renderMLProjectionSection,
  populateMLProjectionSection,
  getActiveMLProjectionViewModel,
  setCurrentData: (value) => { currentData = value; },
  setDashboardData: (value) => { dashboardData = value; }
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
      querySelector: () => null
    },
    IntersectionObserver: function () {
      return { observe: () => {}, disconnect: () => {} };
    },
    URLSearchParams,
    Chart: function () {
      return {
        data: { datasets: [] },
        options: {},
        update: () => {},
        destroy: () => {},
        resize: () => {}
      };
    }
  };

  elements['predictions-section'] = { hidden: false };
  elements['ml-projection-section-title'] = { textContent: '', innerHTML: '' };
  elements['ml-projection-section-subtitle'] = { textContent: '', innerHTML: '', hidden: false };
  elements['ml-projection-section-context'] = { textContent: '', innerHTML: '', hidden: false };
  elements['ml-projection-content'] = { innerHTML: '', querySelector: () => null };
  elements['filter-country'] = { value: '' };
  elements['filter-competition'] = { value: '' };
  elements['search-player'] = { value: '' };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function makePlayer(index, overrides = {}) {
  return Object.assign({
    player_name: `Jugador ${index}`,
    team: `Equipo ${index}`,
    team_country: index % 2 === 0 ? 'Chile' : 'Peru',
    player_nationality: index % 2 === 0 ? 'Chile' : 'Peru',
    age_2026: 20 + (index % 7),
    actual_winrate: 70 - index,
    predicted_winrate: 69 - index,
    delta: -1,
    trend: 'Stable',
    confidence_score: 50 + index,
    confidence_band: 'Media',
    risk_band: 'Estable',
    projected_rank: index
  }, overrides);
}

function buildCurrentData() {
  const players = [
    makePlayer(1, {
      player_name: 'Julian Torres',
      team: 'Condores del Pacifico',
      team_country: 'Peru',
      player_nationality: 'Peru',
      actual_winrate: 90,
      predicted_winrate: 79,
      delta: -11,
      trend: 'Declined',
      confidence_score: 21,
      confidence_band: 'Baja',
      risk_band: 'A observar',
      projected_rank: 1
    }),
    makePlayer(2, {
      player_name: 'Carlos Hernandez',
      team: 'Guerreros Andinos',
      team_country: 'Ecuador',
      player_nationality: 'Ecuador',
      actual_winrate: 75,
      predicted_winrate: 78.1,
      delta: 3.1,
      trend: 'Improved',
      confidence_score: 20,
      confidence_band: 'Baja',
      risk_band: 'A observar',
      projected_rank: 2
    }),
    makePlayer(3, {
      player_name: 'Alejandro Cardenas',
      team: 'Guerreros del Sol',
      team_country: 'Ecuador',
      player_nationality: 'Ecuador',
      actual_winrate: 75,
      predicted_winrate: 77.8,
      delta: 2.8,
      trend: 'Improved',
      confidence_score: 26,
      confidence_band: 'Baja',
      risk_band: 'A observar',
      projected_rank: 3
    }),
    makePlayer(4, {
      player_name: 'Fernando Lopez',
      team: 'Dragones de Fuego',
      team_country: 'Chile',
      predicted_winrate: 75,
      delta: 1,
      projected_rank: 4
    }),
    makePlayer(5, {
      player_name: 'Ricardo Flores',
      team: 'Leones',
      team_country: 'Colombia',
      predicted_winrate: 73.6,
      delta: 0.3,
      projected_rank: 5
    }),
    makePlayer(6, {
      player_name: 'Rafael Oliveira',
      team: 'Caimanes del Orinoco',
      team_country: 'Venezuela',
      predicted_winrate: 72.9,
      delta: 0.7,
      projected_rank: 6
    }),
    makePlayer(7, {
      player_name: 'Mauricio Salazar',
      team: 'Caimanes del Orinoco',
      team_country: 'Venezuela',
      actual_winrate: 44,
      predicted_winrate: 41.5,
      delta: -2.5,
      trend: 'Declined',
      projected_rank: 7
    }),
    makePlayer(8, { projected_rank: 8, predicted_winrate: 68.5, delta: 0.2 }),
    makePlayer(9, { projected_rank: 9, predicted_winrate: 67.5, delta: 0.1 }),
    makePlayer(10, { projected_rank: 10, predicted_winrate: 66.5, delta: 0.1 }),
    makePlayer(11, {
      player_name: 'Jugador Zebra',
      team: 'Lobos Urbanos',
      team_country: 'Ecuador',
      predicted_winrate: 60.5,
      delta: 0.4,
      projected_rank: 11
    }),
    makePlayer(12, { projected_rank: 12, predicted_winrate: 59.5, delta: 0.1 })
  ];

  return {
    ml_projection_2026_summary: {
      players_count: 12,
      improved_players_count: 6,
      declined_players_count: 2,
      stable_players_count: 4,
      best_projected_player: 'Julian Torres',
      best_projected_winrate: 79,
      biggest_improvement_player: 'Carlos Hernandez',
      biggest_improvement_delta: 3.1,
      biggest_decline_player: 'Julian Torres',
      biggest_decline_delta: -11,
      best_projected_team: 'Guerreros del Sol',
      best_projected_team_avg_winrate: 59.2
    },
    ml_projection_2026_players: players,
    ml_projection_2026_team_summary: [
      {
        team: 'Condores del Pacifico',
        country: 'Peru',
        players_count: 1,
        actual_avg_winrate: 90,
        projected_avg_winrate: 75.3,
        avg_delta: -5.3,
        improved_players_count: 0,
        declined_players_count: 1,
        top_projected_player: 'Julian Torres',
        top_projected_winrate: 79
      },
      {
        team: 'Guerreros Andinos',
        country: 'Ecuador',
        players_count: 1,
        actual_avg_winrate: 75,
        projected_avg_winrate: 68.2,
        avg_delta: 1.1,
        improved_players_count: 1,
        declined_players_count: 0,
        top_projected_player: 'Carlos Hernandez',
        top_projected_winrate: 78.1
      },
      {
        team: 'Aguilas Celestes',
        country: 'Argentina',
        players_count: 1,
        actual_avg_winrate: 70,
        projected_avg_winrate: 67.7,
        avg_delta: -0.1,
        improved_players_count: 0,
        declined_players_count: 1,
        top_projected_player: 'Sebastian Valdes',
        top_projected_winrate: 67.7
      }
    ],
    ml_projection_2026_country_summary: [
      {
        country: 'Peru',
        players_count: 4,
        actual_avg_winrate: 67.5,
        projected_avg_winrate: 68.5,
        avg_delta: 1.0,
        improved_players_count: 3,
        declined_players_count: 1,
        top_projected_player: 'Julian Torres',
        top_projected_winrate: 79
      },
      {
        country: 'Ecuador',
        players_count: 4,
        actual_avg_winrate: 68.0,
        projected_avg_winrate: 66.9,
        avg_delta: 0.8,
        improved_players_count: 3,
        declined_players_count: 0,
        top_projected_player: 'Carlos Hernandez',
        top_projected_winrate: 78.1
      }
    ],
    ml_projection_2026_feature_importance: [
      { feature_key: 'win_loss_ratio', feature_label: 'Ratio victorias/derrotas', importance_pct: 93.7, rank: 1 },
      { feature_key: 'partidas_ganadas', feature_label: 'Partidas ganadas', importance_pct: 4.5, rank: 2 },
      { feature_key: 'minutes_per_match', feature_label: 'Minutos por partida', importance_pct: 0.5, rank: 3 }
    ]
  };
}

(function testBuildMLProjectionViewModelGlobalResolvesDuplicateInsightsAndCollapsesTable() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData());

  const view = main.buildMLProjectionViewModel({ country: '', competition: '', search: '' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.context, 'global');
  assert.strictEqual(view.insights.length, 4);
  assert.strictEqual(view.insights[0].subject, 'Julian Torres');
  assert.strictEqual(view.insights[2].label, 'Mayor baja vs actual');
  assert.strictEqual(view.insights[2].subject, 'Mauricio Salazar');
  assert.strictEqual(view.insights[3].subject, 'Condores del Pacifico');
  assert.strictEqual(view.aggregatePanel.teamRows[0].label, 'Condores del Pacifico');
  assert.match(view.watchlists.watchTitle, /Top proyecci/i);
  assert.strictEqual(view.tableModel.showToggle, true);
  assert.strictEqual(view.tableModel.visibleCount, 10);
  assert.strictEqual(view.tableModel.totalCount, 12);
  assert.strictEqual(view.tableModel.rows.length, 10);
})();

(function testBuildMLProjectionViewModelCountryShowsGlobalFeatureNoteAndCompetitionNote() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData({
    ml_projection_2026_summary: {
      country: 'Ecuador',
      players_count: 2,
      improved_players_count: 2,
      declined_players_count: 0,
      stable_players_count: 0,
      best_projected_player: 'Carlos Hernandez',
      best_projected_winrate: 78.1,
      biggest_improvement_player: 'Carlos Hernandez',
      biggest_improvement_delta: 3.1,
      biggest_decline_player: '',
      biggest_decline_delta: null,
      best_projected_team: 'Guerreros Andinos',
      best_projected_team_avg_winrate: 78.1
    },
    ml_projection_2026_players: [
      makePlayer(1, { player_name: 'Carlos Hernandez', team: 'Guerreros Andinos', team_country: 'Ecuador', predicted_winrate: 78.1, delta: 3.1, projected_rank: 1 }),
      makePlayer(2, { player_name: 'Alejandro Cardenas', team: 'Guerreros del Sol', team_country: 'Ecuador', predicted_winrate: 77.8, delta: 2.8, projected_rank: 2 })
    ],
    ml_projection_2026_team_summary: [
      { team: 'Guerreros Andinos', country: 'Ecuador', players_count: 1, actual_avg_winrate: 75, projected_avg_winrate: 78.1, avg_delta: 3.1, improved_players_count: 1, declined_players_count: 0, top_projected_player: 'Carlos Hernandez', top_projected_winrate: 78.1 }
    ],
    ml_projection_2026_country_summary: [
      { country: 'Ecuador', players_count: 2, actual_avg_winrate: 75, projected_avg_winrate: 77.95, avg_delta: 2.95, improved_players_count: 2, declined_players_count: 0, top_projected_player: 'Carlos Hernandez', top_projected_winrate: 78.1 }
    ],
    ml_projection_2026_feature_importance: buildCurrentData().ml_projection_2026_feature_importance
  });

  const view = main.buildMLProjectionViewModel({ country: 'Ecuador', competition: 'Masters Latam 2025', search: '' });

  assert.strictEqual(view.context, 'country');
  assert.match(view.contextLabel, /Ecuador/);
  assert.match(view.competitionNote, /anual/i);
  assert.strictEqual(view.tableModel.showToggle, false);
})();

(function testBuildMLProjectionViewModelSearchDoesNotSegmentML() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData());

  const view = main.buildMLProjectionViewModel({ country: '', competition: '', search: 'Zebra' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.searchState.matches.length, 0);
  assert.strictEqual(view.tableModel.rows[0].player_name, 'Julian Torres');
  assert.strictEqual(view.tableModel.visibleCount, 10);
  assert.match(view.competitionNote, /anual/i);
})();

(function testBuildMLProjectionViewModelSearchKeepsModuleVisible() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData());

  const view = main.buildMLProjectionViewModel({ country: '', competition: '', search: 'Jugador Fantasma' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.searchState.matches.length, 0);
  assert.strictEqual(view.searchState.note, '');
  assert.match(view.competitionNote, /anual/i);
  assert.strictEqual(view.emptyState, null);
})();

(function testRenderMLProjectionSectionWritesUpdatedPremiumPanels() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData());
  const view = main.buildMLProjectionViewModel({ country: '', competition: 'Torneo del Caribe 2024', search: '' });
  main.renderMLProjectionSection(view);

  const html = main.__elements['ml-projection-content'].innerHTML;
  assert.match(html, /modelo global/i);
  assert.match(html, /Top 10|Mostrando 10 de 12/i);
  assert.match(html, /Ver tabla completa/i);
  assert.match(html, /Top proyecci/i);
  assert.match(html, /Mayor baja vs actual/i);
  assert.match(html, /Mejora = cambio frente al valor actual/i);
  assert.match(html, /Consistencia modelo/i);
  assert.doesNotMatch(html, /Jugadores a seguir/i);
  assert.doesNotMatch(html, /no cambian por filtro/i);
})();

console.log('frontend_ml_projection_section tests passed');
