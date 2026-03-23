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
  buildGlobalSummaryViewModel,
  renderGlobalSummary,
  populateInsights,
  setDashboardData: (value) => { dashboardData = value; },
  setCurrentData: (value) => { currentData = value; }
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

  elements['insights-section'] = { hidden: false };
  elements['global-summary-title'] = { textContent: '', innerHTML: '' };
  elements['global-summary-subtitle'] = { textContent: '', innerHTML: '' };
  elements['global-summary-grid'] = { innerHTML: '' };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function buildDashboardData() {
  return {
    summary_metrics: {
      best_international_team: 'Lobos Urbanos',
      best_player_2024: 'Carlos Hern\u00e1ndez',
      most_improved_2025: 'Julian Torres',
      dominant_country: 'Ecuador',
      most_competitive: 'Masters Latam 2025',
      overall_average_performance: 60.02,
      total_international_prizes: 175000,
      total_national_prizes: 150000
    }
  };
}

(function testBuildGlobalSummaryViewModelUsesGlobalMetricsAndLabels() {
  const main = loadMainExports();
  main.setDashboardData(buildDashboardData());
  main.setCurrentData({
    summary_metrics: {
      best_international_team: 'Filtered Team',
      best_player_2024: 'Filtered Player',
      most_improved_2025: 'Filtered Improvement',
      dominant_country: 'Filtered Country',
      most_competitive: 'Filtered Competition',
      overall_average_performance: 0,
      total_international_prizes: 1,
      total_national_prizes: 2
    }
  });

  const view = main.buildGlobalSummaryViewModel({ country: '', competition: '', search: '' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.title, 'Resumen Global');
  assert.strictEqual(view.subtitle, 'Lo más relevante a nivel global');
  assert.strictEqual(view.items.length, 6);
  assert.strictEqual(JSON.stringify(view.items.map((item) => item.label)), JSON.stringify([
    'Mejor equipo internacional',
    'Mejor jugador 2024',
    'Mayor mejora 2025',
    'Competencia con más equipos',
    'Premios internacionales totales',
    'Premios nacionales totales'
  ]));
  assert.strictEqual(view.items[0].value, 'Lobos Urbanos');
  assert.strictEqual(view.items[3].value, 'Masters Latam 2025');
  assert.strictEqual(view.items[4].value, '$175,000');
  assert.strictEqual(view.items[5].value, '$150,000');
})();

(function testRenderGlobalSummaryWritesCardsAndHidesLegacyCopy() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderGlobalSummary({
    visible: true,
    title: 'Resumen Global',
    subtitle: 'Lo más relevante a nivel global',
    items: [
      { icon: 'fas fa-crown', label: 'Mejor equipo internacional', value: 'Lobos Urbanos', tone: 'gold' },
      { icon: 'fas fa-star', label: 'Mejor jugador 2024', value: 'Carlos Hern\u00e1ndez', tone: 'cyan' },
      { icon: 'fas fa-chart-line', label: 'Mayor mejora 2025', value: 'Julian Torres', tone: 'green' },
      { icon: 'fas fa-users', label: 'Competencia con más equipos', value: 'Masters Latam 2025', tone: 'purple' },
      { icon: 'fas fa-globe-americas', label: 'Premios internacionales totales', value: '$175,000', tone: 'cyan' },
      { icon: 'fas fa-map-marked-alt', label: 'Premios nacionales totales', value: '$150,000', tone: 'gold' }
    ]
  });

  assert.strictEqual(elements['insights-section'].hidden, false);
  assert.strictEqual(elements['global-summary-title'].textContent, 'Resumen Global');
  assert.strictEqual(elements['global-summary-subtitle'].textContent, 'Lo más relevante a nivel global');
  assert.ok(elements['global-summary-grid'].innerHTML.includes('Mejor equipo internacional'));
  assert.ok(elements['global-summary-grid'].innerHTML.includes('Premios internacionales totales'));
  assert.ok(!elements['global-summary-grid'].innerHTML.includes('País dominante'));
  assert.ok(!elements['global-summary-grid'].innerHTML.includes('Insights clave'));
})();

(function testPopulateInsightsHidesSectionWhenFiltersAreActive() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.setDashboardData(buildDashboardData());
  main.setCurrentData(buildDashboardData());

  main.populateInsights({ country: 'Chile', competition: '', search: '' });

  assert.strictEqual(elements['insights-section'].hidden, true);
  assert.strictEqual(elements['global-summary-grid'].innerHTML, '');
})();

(function testPopulateInsightsAlsoHidesOnCompetitionOrSearch() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.setDashboardData(buildDashboardData());
  main.setCurrentData(buildDashboardData());

  main.populateInsights({ country: '', competition: 'Masters Latam 2025', search: '' });
  assert.strictEqual(elements['insights-section'].hidden, true);

  main.populateInsights({ country: '', competition: '', search: 'Carlos' });
  assert.strictEqual(elements['insights-section'].hidden, true);
})();
