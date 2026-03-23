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
  buildTeamComparisonViewModel,
  renderTeamComparisonSection,
  populateTeamComparisonSection,
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
    Chart: undefined
  };

  elements['radar-section'] = { hidden: false };
  elements['team-comparison-section-title'] = { textContent: '', innerHTML: '' };
  elements['team-comparison-section-subtitle'] = { textContent: '', innerHTML: '', hidden: false };
  elements['team-comparison-section-context'] = { textContent: '', innerHTML: '', hidden: false };
  elements['team-comparison-content'] = { innerHTML: '' };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function buildCurrentData(overrides = {}) {
  return Object.assign({
    team_comparison_profiles: [
      {
        team: 'Team A',
        country: 'Chile',
        competitions_count: 2,
        teamwork_score: 82,
        victory_rate_pct: 70,
        position_metric: 1.5,
        results_score: 66.67,
        prize_amount: 300,
        prize_share_pct: 60,
        titles_count: 1,
        podium_count: 2,
        comparison_score: 72.58
      },
      {
        team: 'Team B',
        country: 'Mexico',
        competitions_count: 1,
        teamwork_score: 76,
        victory_rate_pct: 60,
        position_metric: 2,
        results_score: 50,
        prize_amount: 200,
        prize_share_pct: 40,
        titles_count: 0,
        podium_count: 1,
        comparison_score: 58
      }
    ],
    team_comparison_leaders: {
      best_teamwork_team: 'Team A',
      best_teamwork_score: 82,
      best_victory_team: 'Team A',
      best_victory_rate_pct: 70,
      best_results_team: 'Team A',
      best_results_score: 66.67,
      best_prize_team: 'Team A',
      best_prize_share_pct: 60
    }
  }, overrides);
}

(function testBuildTeamComparisonViewModelGlobalIgnoresSearchOnly() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData());

  const view = main.buildTeamComparisonViewModel({ country: '', competition: '', search: 'Jose Perez' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.context, 'global');
  assert.strictEqual(view.title, 'Comparativa de equipos');
  assert.strictEqual(view.subtitle, 'Cómo compiten los equipos según el contexto');
  assert.strictEqual(view.contextLabel, 'Vista general de equipos');
  assert.strictEqual(view.leaders.length, 4);
  assert.ok(view.compareMode);
  assert.strictEqual(view.profileMode, null);
  assert.strictEqual(view.radarModel, null);
  assert.strictEqual(view.leaders[3].label, 'Mayor parte del premio total');
  assert.strictEqual(view.leaders[3].description, 'Se llevó el 60.0% del premio total del contexto');
  assert.strictEqual(view.tableModel.columns[1].label, 'País');
  assert.strictEqual(view.tableModel.rows.length, 2);
})();

(function testBuildTeamComparisonViewModelKeepsCompareModeWithoutRadar() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_comparison_profiles: [
      {
        team: 'Team A',
        country: 'Chile',
        competitions_count: 2,
        teamwork_score: 82,
        victory_rate_pct: 70,
        position_metric: 1.5,
        results_score: 66.67,
        prize_amount: 300,
        prize_share_pct: 60,
        titles_count: 1,
        podium_count: 2,
        comparison_score: 72.58
      },
      {
        team: 'Team B',
        country: 'Mexico',
        competitions_count: 1,
        teamwork_score: 76,
        victory_rate_pct: 60,
        position_metric: 2,
        results_score: 50,
        prize_amount: 200,
        prize_share_pct: 40,
        titles_count: 0,
        podium_count: 1,
        comparison_score: 58
      },
      {
        team: 'Team C',
        country: 'Peru',
        competitions_count: 1,
        teamwork_score: 74,
        victory_rate_pct: 58,
        position_metric: 2.5,
        results_score: 40,
        prize_amount: 150,
        prize_share_pct: 30,
        titles_count: 0,
        podium_count: 1,
        comparison_score: 54
      },
      {
        team: 'Team D',
        country: 'Argentina',
        competitions_count: 1,
        teamwork_score: 70,
        victory_rate_pct: 50,
        position_metric: 3,
        results_score: 33.33,
        prize_amount: 100,
        prize_share_pct: 20,
        titles_count: 0,
        podium_count: 0,
        comparison_score: 44
      }
    ]
  }));

  const view = main.buildTeamComparisonViewModel({ country: '', competition: '', search: '' });

  assert.ok(view.compareMode);
  assert.strictEqual(view.compareMode.teamCount, 4);
  assert.strictEqual(view.radarModel, null);
})();

(function testBuildTeamComparisonViewModelCountryUsesProfileModeWithSingleTeam() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_comparison_profiles: [
      {
        team: 'Team A',
        country: 'Chile',
        competitions_count: 2,
        teamwork_score: 82,
        victory_rate_pct: 70,
        position_metric: 1.5,
        results_score: 66.67,
        prize_amount: 300,
        prize_share_pct: 100,
        titles_count: 1,
        podium_count: 2,
        comparison_score: 80.58
      }
    ],
    team_comparison_leaders: {
      country: 'Chile',
      best_teamwork_team: 'Team A',
      best_teamwork_score: 82,
      best_victory_team: 'Team A',
      best_victory_rate_pct: 70,
      best_results_team: 'Team A',
      best_results_score: 66.67,
      best_prize_team: 'Team A',
      best_prize_share_pct: 100
    }
  }));

  const view = main.buildTeamComparisonViewModel({ country: 'Chile', competition: '', search: 'Jose Perez' });

  assert.strictEqual(view.context, 'country');
  assert.strictEqual(view.contextLabel, 'Así compiten los equipos de Chile');
  assert.strictEqual(view.leaders[3].label, 'Equipo con más premios');
  assert.strictEqual(view.leaders[3].description, 'Concentró el 100.0% de los premios de Chile');
  assert.strictEqual(view.compareMode, null);
  assert.ok(view.profileMode);
  assert.strictEqual(view.profileMode.team, 'Team A');
  assert.strictEqual(JSON.stringify(view.tableModel.columns.map((column) => column.label)), JSON.stringify([
    'Equipo', 'Competiciones', '% de victorias', 'Trabajo en equipo', 'Mejor puesto', 'Premios'
  ]));
})();

(function testBuildTeamComparisonViewModelCountryUsesPrizeCopyInCompareMode() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_comparison_profiles: [
      {
        team: 'Team A',
        country: 'Ecuador',
        competitions_count: 2,
        teamwork_score: 82,
        victory_rate_pct: 67.1,
        position_metric: 1.5,
        results_score: 66.67,
        prize_amount: 45000,
        prize_share_pct: 40.9,
        titles_count: 1,
        podium_count: 2,
        comparison_score: 72.58
      },
      {
        team: 'Team B',
        country: 'Ecuador',
        competitions_count: 1,
        teamwork_score: 76,
        victory_rate_pct: 60,
        position_metric: 2,
        results_score: 50,
        prize_amount: 25000,
        prize_share_pct: 22.7,
        titles_count: 0,
        podium_count: 1,
        comparison_score: 58
      }
    ],
    team_comparison_leaders: {
      country: 'Ecuador',
      best_teamwork_team: 'Team A',
      best_teamwork_score: 82,
      best_victory_team: 'Team A',
      best_victory_rate_pct: 67.1,
      best_results_team: 'Team A',
      best_results_score: 66.67,
      best_prize_team: 'Team A',
      best_prize_share_pct: 40.9
    }
  }));

  const view = main.buildTeamComparisonViewModel({ country: 'Ecuador', competition: '', search: 'Carlos Hernandez' });

  assert.strictEqual(view.context, 'country');
  assert.ok(view.compareMode);
  assert.strictEqual(view.profileMode, null);
  assert.strictEqual(view.leaders[3].label, 'Equipo con más premios');
  assert.strictEqual(view.leaders[3].description, 'Concentró el 40.9% de los premios de Ecuador');
})();

(function testBuildTeamComparisonViewModelCompetitionUsesCompetitionColumns() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_comparison_profiles: [
      {
        competition_name: 'Comp 2025',
        team: 'Team A',
        country: 'Chile',
        competitions_count: 1,
        teamwork_score: 82,
        victory_rate_pct: 70,
        position_metric: 1,
        results_score: 100,
        prize_amount: 250,
        prize_share_pct: 50,
        titles_count: 1,
        podium_count: 1,
        competition_result: 1,
        comparison_score: 77.5
      },
      {
        competition_name: 'Comp 2025',
        team: 'Team B',
        country: 'Mexico',
        competitions_count: 1,
        teamwork_score: 76,
        victory_rate_pct: 60,
        position_metric: 2,
        results_score: 50,
        prize_amount: 250,
        prize_share_pct: 50,
        titles_count: 0,
        podium_count: 1,
        competition_result: 2,
        comparison_score: 60
      }
    ],
    team_comparison_leaders: {
      competition_name: 'Comp 2025',
      best_teamwork_team: 'Team A',
      best_teamwork_score: 82,
      best_victory_team: 'Team A',
      best_victory_rate_pct: 70,
      best_results_team: 'Team A',
      best_results_score: 100,
      best_prize_team: 'Team A',
      best_prize_share_pct: 50
    }
  }));

  const view = main.buildTeamComparisonViewModel({ country: '', competition: 'Comp 2025', search: '' });

  assert.strictEqual(view.context, 'competition');
  assert.strictEqual(view.contextLabel, 'Así compitieron los equipos en Comp 2025');
  assert.strictEqual(view.leaders[3].label, 'Mayor parte del premio total');
  assert.strictEqual(view.leaders[3].description, 'Se llevó el 50.0% del premio total de esta competencia');
  assert.ok(view.compareMode);
  assert.strictEqual(view.profileMode, null);
  assert.strictEqual(JSON.stringify(view.tableModel.columns.map((column) => column.label)), JSON.stringify([
    'Equipo', 'País', '% de victorias', 'Trabajo en equipo', 'Resultado en la competencia', 'Premios'
  ]));
})();

(function testBuildTeamComparisonViewModelCountryCompetitionUsesProfileMode() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_comparison_profiles: [
      {
        competition_name: 'Comp 2025',
        team: 'Team A',
        country: 'Chile',
        competitions_count: 1,
        teamwork_score: 82,
        victory_rate_pct: 70,
        position_metric: 1,
        results_score: 100,
        prize_amount: 250,
        prize_share_pct: 100,
        titles_count: 1,
        podium_count: 1,
        competition_result: 1,
        comparison_score: 87.5
      }
    ],
    team_comparison_leaders: {
      competition_name: 'Comp 2025',
      country: 'Chile',
      best_teamwork_team: 'Team A',
      best_teamwork_score: 82,
      best_victory_team: 'Team A',
      best_victory_rate_pct: 70,
      best_results_team: 'Team A',
      best_results_score: 100,
      best_prize_team: 'Team A',
      best_prize_share_pct: 100
    }
  }));

  const view = main.buildTeamComparisonViewModel({ country: 'Chile', competition: 'Comp 2025', search: '' });

  assert.strictEqual(view.context, 'country_competition');
  assert.strictEqual(view.contextLabel, 'Así compitió Chile en Comp 2025');
  assert.strictEqual(view.leaders[3].label, 'Equipo con más premios');
  assert.strictEqual(view.leaders[3].description, 'Concentró el 100.0% de los premios de Chile en Comp 2025');
  assert.strictEqual(view.compareMode, null);
  assert.ok(view.profileMode);
  assert.strictEqual(JSON.stringify(view.tableModel.columns.map((column) => column.label)), JSON.stringify([
    'Equipo', '% de victorias', 'Trabajo en equipo', 'Resultado en la competencia', 'Premios'
  ]));
})();

(function testBuildTeamComparisonViewModelUsesReadableFallbacks() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_comparison_profiles: [
      {
        team: 'Team A',
        country: 'Bolivia',
        competitions_count: 1,
        teamwork_score: 76.7,
        victory_rate_pct: null,
        position_metric: 2,
        results_score: 50,
        prize_amount: 35000,
        prize_share_pct: 100,
        titles_count: 0,
        podium_count: 1,
        competition_result: null,
        comparison_score: 40
      }
    ],
    team_comparison_leaders: {
      best_teamwork_team: 'Team A',
      best_teamwork_score: 76.7,
      best_victory_team: 'Team A',
      best_victory_rate_pct: null,
      best_results_team: 'Team A',
      best_results_score: null,
      best_prize_team: 'Team A',
      best_prize_share_pct: 100
    }
  }));

  const view = main.buildTeamComparisonViewModel({ country: 'Bolivia', competition: '', search: '' });

  assert.strictEqual(view.tableModel.rows[0].victoryRateLabel, 'Sin registro de victorias');
  assert.strictEqual(view.profileMode.metrics[1].value, 'Sin registro de victorias');
  assert.strictEqual(view.leaders[1].description, 'No hay victorias registradas en este contexto');
  assert.strictEqual(view.leaders[3].label, 'Equipo con más premios');
  assert.strictEqual(view.leaders[3].description, 'Concentró el 100.0% de los premios de Bolivia');
})();

(function testBuildTeamComparisonCompetitionUsesReadablePositionFallback() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_comparison_profiles: [
      {
        competition_name: 'Comp 2025',
        team: 'Team A',
        country: 'Chile',
        competitions_count: 1,
        teamwork_score: 82,
        victory_rate_pct: 70,
        position_metric: 1,
        results_score: 100,
        prize_amount: 250,
        prize_share_pct: 50,
        titles_count: 1,
        podium_count: 1,
        competition_result: 1,
        comparison_score: 77.5
      },
      {
        competition_name: 'Comp 2025',
        team: 'Team B',
        country: 'Mexico',
        competitions_count: 1,
        teamwork_score: 76,
        victory_rate_pct: 60,
        position_metric: null,
        results_score: null,
        prize_amount: 250,
        prize_share_pct: 50,
        titles_count: 0,
        podium_count: 1,
        competition_result: null,
        comparison_score: 60
      }
    ],
    team_comparison_leaders: {
      competition_name: 'Comp 2025',
      best_teamwork_team: 'Team A',
      best_teamwork_score: 82,
      best_victory_team: 'Team A',
      best_victory_rate_pct: 70,
      best_results_team: 'Team A',
      best_results_score: 100,
      best_prize_team: 'Team A',
      best_prize_share_pct: 50
    }
  }));

  const view = main.buildTeamComparisonViewModel({ country: '', competition: 'Comp 2025', search: '' });

  assert.strictEqual(view.tableModel.rows[1].competitionResultLabel, 'Sin puesto final registrado');
})();

(function testBuildTeamComparisonViewModelReturnsEmptyStateWithoutProfiles() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData({
    team_comparison_profiles: [],
    team_comparison_leaders: {}
  });

  const view = main.buildTeamComparisonViewModel({ country: '', competition: '', search: '' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.emptyState.message, 'Sin datos de equipos para este filtro');
})();

(function testRenderTeamComparisonSectionWritesCompareMarkup() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderTeamComparisonSection({
    visible: true,
    context: 'global',
    title: 'Comparativa de equipos',
    subtitle: 'Cómo compiten los equipos según el contexto',
    contextLabel: 'Vista general de equipos',
    leaders: [
      { label: 'Mayor trabajo en equipo', team: 'Team A', value: '82.0 pts', description: 'Puntaje promedio más alto del contexto' },
      { label: 'Mejor % de victorias', team: 'Team A', value: '70.0%', description: 'Mayor porcentaje de victorias registrado' },
      { label: 'Mejores resultados', team: 'Team A', value: '#1', description: 'Mejor puesto promedio en el contexto' },
      { label: 'Mayor parte del premio total', team: 'Team A', value: '60.0%', description: 'Se llevó el 60.0% del premio total del contexto' }
    ],
    compareMode: { teamCount: 2 },
    profileMode: null,
    radarModel: null,
    tableModel: {
      title: 'Equipos comparados',
      columns: [
        { key: 'team', label: 'Equipo' },
        { key: 'country', label: 'País' },
        { key: 'victoryRateLabel', label: '% de victorias' },
        { key: 'prizeAmountLabel', label: 'Premios' }
      ],
      rows: [
        { team: 'Team A', country: 'Chile', victoryRateLabel: '70.0%', prizeAmountLabel: '$300' }
      ]
    },
    emptyState: null
  });

  assert.strictEqual(elements['radar-section'].hidden, false);
  assert.strictEqual(elements['team-comparison-section-title'].textContent, 'Comparativa de equipos');
  assert.strictEqual(elements['team-comparison-section-context'].textContent, 'Vista general de equipos');
  assert.ok(elements['team-comparison-content'].innerHTML.includes('Mayor trabajo en equipo'));
  assert.ok(elements['team-comparison-content'].innerHTML.includes('Se llevó el 60.0% del premio total del contexto'));
  assert.ok(elements['team-comparison-content'].innerHTML.includes('team-comparison-panel--table'));
  assert.ok(elements['team-comparison-content'].innerHTML.includes('team-comparison-main-grid--compare'));
  assert.ok(elements['team-comparison-content'].innerHTML.includes('team-comparison-table-value--body'));
  assert.ok(elements['team-comparison-content'].innerHTML.includes('$300'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('Winrate'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('Teamwork'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('Plantel (norm.)'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('Premios (norm.)'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('Radar comparativo'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('team-comparison-radar'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('N/A'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('Sin dato'));
})();

(function testRenderTeamComparisonSectionWritesProfileMarkup() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderTeamComparisonSection({
    visible: true,
    context: 'country',
    title: 'Comparativa de equipos',
    subtitle: 'Cómo compiten los equipos según el contexto',
    contextLabel: 'Así compiten los equipos de Chile',
    leaders: [],
    compareMode: null,
    profileMode: {
      team: 'Team A',
      country: 'Chile',
      summary: 'Equipo unico en este contexto',
      metrics: [
        { label: 'Competiciones', value: '2' },
        { label: '% de victorias', value: '70.0%' }
      ]
    },
    radarModel: null,
    tableModel: {
      title: 'Equipos de Chile',
      columns: [{ key: 'team', label: 'Equipo' }],
      rows: [{ team: 'Team A' }]
    },
    emptyState: null
  });

  assert.ok(elements['team-comparison-content'].innerHTML.includes('Equipo unico en este contexto'));
  assert.ok(!elements['team-comparison-content'].innerHTML.includes('team-comparison-radar'));
})();

console.log('frontend_team_comparison_section tests passed');
