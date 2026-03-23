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
  buildAgePerformanceViewModel,
  renderAgePerformanceSection,
  populateAgePerformanceSection,
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

  elements['scatter-section'] = { hidden: false };
  elements['age-performance-section-title'] = { textContent: '', innerHTML: '' };
  elements['age-performance-section-subtitle'] = { textContent: '', innerHTML: '', hidden: false };
  elements['age-performance-section-context'] = { textContent: '', innerHTML: '', hidden: false };
  elements['age-performance-content'] = { innerHTML: '' };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function buildCurrentData(overrides = {}) {
  return Object.assign({
    player_age_performance_summary: {
      players_count: 6,
      overall_average_performance_pct: 64.2,
      correlation_value: 0.22,
      correlation_strength: 'weak',
      correlation_direction: 'positive',
      best_age_band: '22-23',
      best_age_band_average_performance_pct: 69.4
    },
    player_age_performance_bands: [
      {
        age_band: '20-21',
        players_count: 2,
        average_performance_pct: 58.2,
        top_player_name: 'Jose Perez',
        top_player_team: 'Team A',
        top_player_performance_pct: 61.3
      },
      {
        age_band: '22-23',
        players_count: 3,
        average_performance_pct: 69.4,
        top_player_name: 'Luis Mora',
        top_player_team: 'Team B',
        top_player_performance_pct: 74.8
      },
      {
        age_band: '24+',
        players_count: 1,
        average_performance_pct: 62.0,
        top_player_name: 'Carlos Diaz',
        top_player_team: 'Team C',
        top_player_performance_pct: 62.0
      }
    ],
    player_age_performance_points: [
      { player_name: 'Jose Perez', team: 'Team A', team_country: 'Chile', player_nationality: 'Chile', age: 20, performance_pct: 57.0, age_band: '20-21', competitions_count: 2 },
      { player_name: 'Pedro Gomez', team: 'Team A', team_country: 'Chile', player_nationality: 'Chile', age: 21, performance_pct: 61.3, age_band: '20-21', competitions_count: 1 },
      { player_name: 'Luis Mora', team: 'Team B', team_country: 'Chile', player_nationality: 'Peru', age: 22, performance_pct: 74.8, age_band: '22-23', competitions_count: 2 },
      { player_name: 'Ana Ruiz', team: 'Team B', team_country: 'Chile', player_nationality: 'Mexico', age: 23, performance_pct: 68.0, age_band: '22-23', competitions_count: 2 },
      { player_name: 'Mario Torres', team: 'Team C', team_country: 'Ecuador', player_nationality: 'Ecuador', age: 23, performance_pct: 65.4, age_band: '22-23', competitions_count: 1 },
      { player_name: 'Carlos Diaz', team: 'Team C', team_country: 'Ecuador', player_nationality: 'Ecuador', age: 24, performance_pct: 62.0, age_band: '24+', competitions_count: 1 }
    ],
    player_age_performance_leaders: {
      young_standout_player: 'Pedro Gomez',
      young_standout_team: 'Team A',
      young_standout_performance_pct: 61.3,
      veteran_standout_player: 'Carlos Diaz',
      veteran_standout_team: 'Team C',
      veteran_standout_performance_pct: 62.0
    }
  }, overrides);
}

(function testBuildAgePerformanceViewModelGlobal() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData());

  const view = main.buildAgePerformanceViewModel({ country: '', competition: '', search: '' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.context, 'global');
  assert.strictEqual(view.analysisState, 'complete');
  assert.strictEqual(view.title, 'Edad vs rendimiento');
  assert.strictEqual(view.subtitle, 'C\u00f3mo cambia el rendimiento seg\u00fan la edad en este contexto');
  assert.strictEqual(view.contextLabel, 'Vista general de jugadores por edad y rendimiento');
  assert.strictEqual(view.leaders.length, 4);
  assert.strictEqual(view.hiddenLeadersCount, 0);
  assert.strictEqual(view.hiddenBandsCount, 0);
  assert.strictEqual(view.summary.relationshipLabel, 'Relaci\u00f3n d\u00e9bil positiva');
  assert.strictEqual(view.bandModel.title, 'Rendimiento por tramo de edad');
  assert.strictEqual(view.bandModel.items.length, 3);
  assert.strictEqual(view.scatterModel, null);
  assert.strictEqual(view.searchHighlight.note, '');
  assert.strictEqual(view.emptyState, null);
})();

(function testBuildAgePerformanceViewModelCountrySearchHighlightsWithoutChangingContext() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    player_age_performance_summary: {
      country: 'Chile',
      players_count: 4,
      overall_average_performance_pct: 65.3,
      correlation_value: 0.28,
      correlation_strength: 'weak',
      correlation_direction: 'positive',
      best_age_band: '22-23',
      best_age_band_average_performance_pct: 71.4
    }
  }));

  const view = main.buildAgePerformanceViewModel({ country: 'Chile', competition: '', search: 'Luis Mora' });

  assert.strictEqual(view.context, 'country');
  assert.strictEqual(view.contextLabel, 'As\u00ed rinden los jugadores de equipos de Chile');
  assert.strictEqual(view.searchHighlight.query, 'Luis Mora');
  assert.strictEqual(view.searchHighlight.matches.length, 1);
  assert.strictEqual(view.scatterModel, null);
})();

(function testBuildAgePerformanceViewModelCountryCompetitionNoMatchKeepsSectionVisible() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    player_age_performance_summary: {
      country: 'Chile',
      competition_name: 'Torneo del Caribe 2024',
      players_count: 3,
      overall_average_performance_pct: 63.1,
      correlation_value: null,
      correlation_strength: 'insufficient',
      correlation_direction: null,
      best_age_band: '22-23',
      best_age_band_average_performance_pct: 66.2
    },
    player_age_performance_points: [
      { player_name: 'Pedro Gomez', team: 'Team A', team_country: 'Chile', player_nationality: 'Chile', age: 22, performance_pct: 66.2, age_band: '22-23', competition_name: 'Torneo del Caribe 2024' },
      { player_name: 'Luis Mora', team: 'Team B', team_country: 'Chile', player_nationality: 'Peru', age: 23, performance_pct: 64.1, age_band: '22-23', competition_name: 'Torneo del Caribe 2024' },
      { player_name: 'Carlos Diaz', team: 'Team C', team_country: 'Chile', player_nationality: 'Ecuador', age: 24, performance_pct: 59.0, age_band: '24+', competition_name: 'Torneo del Caribe 2024' }
    ]
  }));

  const view = main.buildAgePerformanceViewModel({
    country: 'Chile',
    competition: 'Torneo del Caribe 2024',
    search: 'Jugador Fantasma'
  });

  assert.strictEqual(view.context, 'country_competition');
  assert.strictEqual(view.summary.relationshipLabel, 'Muestra insuficiente');
  assert.strictEqual(view.searchHighlight.matches.length, 0);
  assert.strictEqual(view.searchHighlight.note, 'El jugador buscado no aparece en este contexto.');
  assert.strictEqual(view.emptyState, null);
})();

(function testBuildAgePerformanceViewModelPartialContextUsesPartialState() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    player_age_performance_summary: {
      country: 'Bolivia',
      players_count: 3,
      overall_average_performance_pct: null,
      correlation_value: null,
      correlation_strength: 'insufficient',
      correlation_direction: null,
      best_age_band: '20-21',
      best_age_band_average_performance_pct: null
    },
    player_age_performance_bands: [
      { age_band: '20-21', players_count: 1, average_performance_pct: null, top_player_name: 'Jose Castillo', top_player_team: 'Team A', top_player_performance_pct: null },
      { age_band: '22-23', players_count: 1, average_performance_pct: null, top_player_name: 'Antonio Benitez', top_player_team: 'Team A', top_player_performance_pct: null },
      { age_band: '24+', players_count: 1, average_performance_pct: null, top_player_name: 'Pedro Martinez', top_player_team: 'Team A', top_player_performance_pct: null }
    ],
    player_age_performance_points: [
      { player_name: 'Jose Castillo', team: 'Team A', team_country: 'Bolivia', age: 21, performance_pct: null, age_band: '20-21' },
      { player_name: 'Antonio Benitez', team: 'Team A', team_country: 'Bolivia', age: 22, performance_pct: null, age_band: '22-23' },
      { player_name: 'Pedro Martinez', team: 'Team A', team_country: 'Bolivia', age: 24, performance_pct: null, age_band: '24+' }
    ],
    player_age_performance_leaders: {
      young_standout_player: 'Jose Castillo',
      young_standout_team: 'Team A',
      young_standout_performance_pct: null,
      veteran_standout_player: 'Pedro Martinez',
      veteran_standout_team: 'Team A',
      veteran_standout_performance_pct: null
    }
  }));

  const view = main.buildAgePerformanceViewModel({ country: 'Bolivia', competition: '', search: '' });

  assert.strictEqual(view.analysisState, 'partial');
  assert.strictEqual(view.validPointsCount, 0);
  assert.strictEqual(view.rawPlayersCount, 3);
  assert.strictEqual(view.leaders.length, 0);
  assert.strictEqual(view.bandModel, null);
  assert.strictEqual(view.scatterModel, null);
  assert.strictEqual(
    view.emptyState.message,
    'Hay jugadores registrados en este contexto, pero no hay rendimiento suficiente para compararlos.'
  );
})();

(function testBuildAgePerformanceViewModelLimitedStateHidesNullLeaderAndScatter() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    player_age_performance_summary: {
      country: 'México',
      players_count: 2,
      overall_average_performance_pct: 70.0,
      correlation_value: null,
      correlation_strength: 'insufficient',
      correlation_direction: null,
      best_age_band: '20-21',
      best_age_band_average_performance_pct: 70.0
    },
    player_age_performance_bands: [
      { age_band: '20-21', players_count: 1, average_performance_pct: 70.0, top_player_name: 'Cristian Mendez', top_player_team: 'Jaguares Negros', top_player_performance_pct: 70.0 },
      { age_band: '24+', players_count: 1, average_performance_pct: null, top_player_name: 'Saulo Pena', top_player_team: 'Jaguares Negros', top_player_performance_pct: null }
    ],
    player_age_performance_points: [
      { player_name: 'Cristian Mendez', team: 'Jaguares Negros', team_country: 'México', age: 21, performance_pct: 70.0, age_band: '20-21' },
      { player_name: 'Saulo Pena', team: 'Jaguares Negros', team_country: 'México', age: 24, performance_pct: null, age_band: '24+' }
    ],
    player_age_performance_leaders: {
      young_standout_player: 'Cristian Mendez',
      young_standout_team: 'Jaguares Negros',
      young_standout_performance_pct: 70.0,
      veteran_standout_player: 'Saulo Pena',
      veteran_standout_team: 'Jaguares Negros',
      veteran_standout_performance_pct: null
    }
  }));

  const view = main.buildAgePerformanceViewModel({ country: 'México', competition: '', search: '' });

  assert.strictEqual(view.analysisState, 'limited');
  assert.strictEqual(view.validPointsCount, 1);
  assert.strictEqual(view.leaders[0].label, 'Muestra limitada');
  assert.strictEqual(view.leaders.some((leader) => leader.label === 'Veterano destacado'), false);
  assert.strictEqual(view.hiddenLeadersCount, 1);
  assert.strictEqual(view.bandModel.items.length, 1);
  assert.strictEqual(view.hiddenBandsCount, 1);
  assert.strictEqual(view.scatterModel, null);
  assert.strictEqual(view.sectionNotes.length, 1);
  assert.strictEqual(view.sectionNotes[0], 'Se omitieron 1 destacado y 1 tramo sin rendimiento comparable.');
})();

(function testRenderAgePerformanceSectionWritesContent() {
  const main = loadMainExports();
  const view = {
    visible: true,
    analysisState: 'partial',
    title: 'Edad vs rendimiento',
    subtitle: 'C\u00f3mo cambia el rendimiento seg\u00fan la edad en este contexto',
    contextLabel: 'Vista general de jugadores por edad y rendimiento',
    leaders: [],
    summary: { relationshipLabel: 'Sin relaci\u00f3n clara', relationshipDescription: 'En este contexto, la edad no explica claramente el rendimiento.', playersLabel: '6 jugadores analizados' },
    bandModel: null,
    scatterModel: null,
    sectionNotes: [],
    searchHighlight: { note: '' },
    emptyState: { message: 'Hay jugadores registrados en este contexto, pero no hay rendimiento suficiente para compararlos.', hint: 'Se encontraron 3 jugadores con edad registrada y 0 con rendimiento comparable.' }
  };

  main.renderAgePerformanceSection(view);

  const html = main.__elements['age-performance-content'].innerHTML;
  assert.match(html, /Hay jugadores registrados en este contexto/);
})();

(function testRenderAgePerformanceSectionLimitedStateOmitsScatterPanel() {
  const main = loadMainExports();
  const view = {
    visible: true,
    analysisState: 'limited',
    title: 'Edad vs rendimiento',
    subtitle: 'C\u00f3mo cambia el rendimiento seg\u00fan la edad en este contexto',
    contextLabel: 'Así rinden los jugadores de equipos de México',
    leaders: [
      { label: 'Muestra limitada', subject: '1 jugador comparable', meta: '2 jugadores en el contexto', value: '', description: 'No hay suficiente muestra para inferir una relación entre edad y rendimiento.', tone: 'primary', icon: 'fas fa-wave-square' }
    ],
    summary: { relationshipLabel: 'Muestra insuficiente', relationshipDescription: 'No hay suficiente muestra', playersLabel: '2 jugadores analizados' },
    bandModel: { title: 'Rendimiento por tramo de edad', items: [{ label: '20-21 años', averageLabel: '70.0%', playersLabel: '1 jugador', topPlayerLabel: 'Cristian Mendez - Jaguares Negros', insight: 'Mejor tramo', isBestBand: true }], note: '1 tramo adicional no tiene rendimiento comparable.' },
    scatterModel: null,
    sectionNotes: ['Se omitieron 1 destacado y 1 tramo sin rendimiento comparable.'],
    searchHighlight: { note: '' },
    emptyState: null
  };

  main.renderAgePerformanceSection(view);
  const html = main.__elements['age-performance-content'].innerHTML;
  assert.doesNotMatch(html, /agePerformanceScatterChart/);
  assert.match(html, /Se omitieron 1 destacado y 1 tramo sin rendimiento comparable/);
})();

console.log('frontend_age_performance_section tests passed');
