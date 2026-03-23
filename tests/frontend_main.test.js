const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMainExports(overrides = {}) {
  const sourcePath = path.join(__dirname, '..', 'src', 'frontend', 'assets', 'js', 'main.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const wrapped = `${source}

module.exports = {
  buildCountryChartData,
  buildCountryTooltipLines,
  createCountryChart,
  buildPrizesChartModel,
  buildPrizesTooltipLines,
  createPrizesChart,
  setDashboardData: (value) => { dashboardData = value; },
  setCurrentData: (value) => { currentData = value; },
  setCountryFlags: (value) => {
    Object.keys(countryFlags).forEach((key) => delete countryFlags[key]);
    Object.assign(countryFlags, value);
  }
};
`;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    window: {
      Filtering: {
        getEmptyData: () => ({}),
        normalizeText: (value) => value,
        buildFilteredData: () => ({})
      },
      addEventListener: () => {},
      history: { replaceState: () => {} },
      location: { search: '', pathname: '/index.html' },
      matchMedia: () => ({ matches: false })
    },
    document: {
      addEventListener: () => {},
      getElementById: (id) => (overrides.elements && overrides.elements[id]) || null,
      querySelectorAll: () => [],
      querySelector: () => null
    },
    IntersectionObserver: function () {
      return { observe: () => {}, disconnect: () => {} };
    },
    URLSearchParams,
    Chart: overrides.Chart
  };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  return sandbox.module.exports;
}

(function testCountryChartDataDoesNotFallbackToDifferentCountry() {
  const main = loadMainExports();
  main.setCountryFlags({ Argentina: 'AR' });
  main.setCurrentData({
    country_ranking: [
      { country: 'Ecuador', total_teams: 1 }
    ]
  });

  const result = main.buildCountryChartData('Argentina');

  assert.strictEqual(JSON.stringify(result.labels), JSON.stringify([]));
  assert.strictEqual(JSON.stringify(result.data), JSON.stringify([]));
  assert.strictEqual(JSON.stringify(result.bgColors), JSON.stringify([]));
  assert.strictEqual(JSON.stringify(result.borderColors), JSON.stringify([]));
})();

(function testCountryTooltipLinesExposeTeamsAndPlayers() {
  const main = loadMainExports();

  const lines = main.buildCountryTooltipLines({
    total_teams: 2,
    total_players: 4
  });

  assert.strictEqual(JSON.stringify(lines), JSON.stringify([
    'Equipos: 2',
    'Jugadores: 4'
  ]));
})();

(function testCountryChartTooltipCallbacksUseCurrentFilteredData() {
  let capturedConfig = null;
  const fakeCanvas = {
    getContext: () => ({})
  };

  function FakeChart(ctx, config) {
    capturedConfig = config;
    this.ctx = ctx;
    this.config = config;
    this.data = config.data;
    this.update = () => {};
  }

  const main = loadMainExports({
    Chart: FakeChart,
    elements: {
      countryChart: fakeCanvas,
      'filter-country': { value: 'Chile' }
    }
  });

  main.setCountryFlags({ Chile: 'CH' });
  main.setCurrentData({
    main_kpis: { total_teams: 2 },
    country_ranking: [
      { country: 'Chile', total_teams: 2, total_players: 4 }
    ]
  });

  main.createCountryChart();

  const tooltip = capturedConfig.options.plugins.tooltip.callbacks;
  assert.strictEqual(tooltip.title([{ label: 'CH Chile' }]), 'CH Chile');
  assert.strictEqual(JSON.stringify(tooltip.afterBody([{ dataIndex: 0 }])), JSON.stringify([
    'Equipos: 2',
    'Jugadores: 4'
  ]));
})();

(function testPrizesChartModelUsesGlobalRankForCountryOnlyFilter() {
  const main = loadMainExports();
  main.setCountryFlags({ Chile: 'CH', Bolivia: 'BO', Argentina: 'AR' });
  main.setDashboardData({
    country_ranking: [
      { country: 'Chile', total_prizes: 45000, total_players: 6, total_teams: 3 },
      { country: 'Bolivia', total_prizes: 35000, total_players: 2, total_teams: 1 },
      { country: 'Argentina', total_prizes: 25000, total_players: 2, total_teams: 1 }
    ],
    filter_ready: {
      country_ranking_by_competition: []
    }
  });

  const model = main.buildPrizesChartModel({ country: 'Argentina' });

  assert.strictEqual(JSON.stringify(model.rankLabels), JSON.stringify(['#3']));
  assert.strictEqual(JSON.stringify(model.countryNames), JSON.stringify(['AR Argentina']));
  assert.strictEqual(JSON.stringify(model.prizes), JSON.stringify([25000]));
})();

(function testPrizesChartModelSortsCompetitionRowsAndLeavesZeroPrizeLast() {
  const main = loadMainExports();
  main.setCountryFlags({ Ecuador: 'EC', Mexico: 'ME', Chile: 'CH', Peru: 'PE' });
  main.setCurrentData({
    country_ranking: [
      { country: 'Ecuador', total_prizes: 20000 },
      { country: 'Peru', total_prizes: 0 },
      { country: 'Chile', total_prizes: 8000 },
      { country: 'Mexico', total_prizes: 12000 }
    ]
  });
  main.setDashboardData({
    country_ranking: [],
    filter_ready: {
      country_ranking_by_competition: [
        { competition_name: 'Challenger Sur 2025', country: 'Peru', total_prizes: 0, total_players: 2, total_teams: 1 },
        { competition_name: 'Challenger Sur 2025', country: 'Chile', total_prizes: 8000, total_players: 2, total_teams: 1 },
        { competition_name: 'Challenger Sur 2025', country: 'Ecuador', total_prizes: 20000, total_players: 2, total_teams: 1 },
        { competition_name: 'Challenger Sur 2025', country: 'Mexico', total_prizes: 12000, total_players: 2, total_teams: 1 }
      ]
    }
  });

  const model = main.buildPrizesChartModel({ competition: 'Challenger Sur 2025' });

  assert.strictEqual(JSON.stringify(model.rankLabels), JSON.stringify(['#1', '#2', '#3', '#4']));
  assert.strictEqual(JSON.stringify(model.countryNames), JSON.stringify(['EC Ecuador', 'ME Mexico', 'CH Chile', 'PE Peru']));
  assert.strictEqual(JSON.stringify(model.prizes), JSON.stringify([20000, 12000, 8000, 0]));
  assert.strictEqual(JSON.stringify(model.backgroundColors), JSON.stringify([
    'rgba(0, 212, 255, 0.8)',
    'rgba(255, 215, 0, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(139, 92, 246, 0.8)'
  ]));
})();

(function testPrizesChartModelKeepsCompetitionRankForCountryCompetitionFilter() {
  const main = loadMainExports();
  main.setCountryFlags({ Chile: 'CH', Ecuador: 'EC', Colombia: 'CO' });
  main.setDashboardData({
    country_ranking: [],
    filter_ready: {
      country_ranking_by_competition: [
        { competition_name: 'Torneo del Caribe 2024', country: 'Chile', total_prizes: 25000, total_players: 4, total_teams: 2 },
        { competition_name: 'Torneo del Caribe 2024', country: 'Ecuador', total_prizes: 20000, total_players: 2, total_teams: 1 },
        { competition_name: 'Torneo del Caribe 2024', country: 'Colombia', total_prizes: 15000, total_players: 2, total_teams: 1 }
      ]
    }
  });

  const model = main.buildPrizesChartModel({
    country: 'Colombia',
    competition: 'Torneo del Caribe 2024'
  });

  assert.strictEqual(JSON.stringify(model.rankLabels), JSON.stringify(['#3']));
  assert.strictEqual(JSON.stringify(model.countryNames), JSON.stringify(['CO Colombia']));
  assert.strictEqual(JSON.stringify(model.prizes), JSON.stringify([15000]));
})();

(function testPrizesTooltipLinesExplainZeroPrizeRows() {
  const main = loadMainExports();

  const lines = main.buildPrizesTooltipLines({
    total_prizes: 0
  });

  assert.strictEqual(JSON.stringify(lines), JSON.stringify([
    'Premios: $0',
    'Sin premios en esta competencia'
  ]));
})();

(function testCreatePrizesChartEnablesZeroPrizeVisibilityOptions() {
  let capturedConfig = null;
  const fakeCanvas = {
    getContext: () => ({})
  };

  function FakeChart(ctx, config) {
    capturedConfig = config;
    this.ctx = ctx;
    this.config = config;
    this.data = config.data;
    this.update = () => {};
  }

  const main = loadMainExports({
    Chart: FakeChart,
    elements: {
      prizesChart: fakeCanvas,
      'filter-country': { value: '' },
      'filter-competition': { value: 'Challenger Sur 2025' }
    }
  });

  main.setCountryFlags({ Ecuador: 'EC', Mexico: 'ME', Chile: 'CH', Peru: 'PE' });
  main.setCurrentData({
    country_ranking: [
      { country: 'Ecuador', total_prizes: 20000 },
      { country: 'Peru', total_prizes: 0 },
      { country: 'Chile', total_prizes: 8000 },
      { country: 'Mexico', total_prizes: 12000 }
    ]
  });
  main.setDashboardData({
    country_ranking: [],
    filter_ready: {
      country_ranking_by_competition: [
        { competition_name: 'Challenger Sur 2025', country: 'Peru', total_prizes: 0, total_players: 2, total_teams: 1 },
        { competition_name: 'Challenger Sur 2025', country: 'Chile', total_prizes: 8000, total_players: 2, total_teams: 1 },
        { competition_name: 'Challenger Sur 2025', country: 'Ecuador', total_prizes: 20000, total_players: 2, total_teams: 1 },
        { competition_name: 'Challenger Sur 2025', country: 'Mexico', total_prizes: 12000, total_players: 2, total_teams: 1 }
      ]
    }
  });

  main.createPrizesChart();

  assert.strictEqual(capturedConfig.data.datasets[0].minBarLength, 6);
  assert.strictEqual(capturedConfig.options.plugins.zeroPrizeAnnotation.enabled, true);
})();

console.log('frontend_main tests passed');
