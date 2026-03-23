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
  getCompetitionSectionFilters,
  buildCompetitionSectionViewModel,
  renderCompetitionSection,
  populateCompetitions,
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

  elements.competitionsSectionTitle = { textContent: '', innerHTML: '' };
  elements.competitionsSectionSubtitle = { textContent: '', innerHTML: '', hidden: false };
  elements.competitionsContent = { innerHTML: '' };
  elements['competitions-section-title'] = elements.competitionsSectionTitle;
  elements['competitions-section-subtitle'] = elements.competitionsSectionSubtitle;
  elements['competitions-content'] = elements.competitionsContent;

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function buildCompetitionData() {
  return {
    main_kpis: {
      total_teams: 0,
      total_players: 0,
      total_prizes: 0
    },
    top_teams: [],
    competitions: [
      {
        name: 'Copa Andina 2024',
        type: 'Nacional',
        location: 'Quito',
        participating_teams: 4,
        total_players: 9,
        total_prize: 50000,
        average_prize_per_team: 12500,
        year: 2024,
        average_age: 22.8
      },
      {
        name: 'Liga del Pac\u00edfico 2024',
        type: 'Internacional',
        location: 'Lima',
        participating_teams: 4,
        total_players: 9,
        total_prize: 75000,
        average_prize_per_team: 18750,
        year: 2024,
        average_age: 23.3
      }
    ]
  };
}

(function testGetCompetitionSectionFiltersReadsDomValues() {
  const main = loadMainExports();
  const elements = main.__elements;
  elements['filter-country'] = { value: 'Chile' };
  elements['filter-competition'] = { value: 'Copa Andina 2024' };
  elements['search-player'] = { value: 'Mat\u00edas Rojas' };

  const filters = main.getCompetitionSectionFilters();

  assert.strictEqual(JSON.stringify(filters), JSON.stringify({
    country: 'Chile',
    competition: 'Copa Andina 2024',
    search: 'Mat\u00edas Rojas'
  }));
})();

(function testBuildCompetitionSectionViewModelGlobalUsesCatalog() {
  const main = loadMainExports();
  main.setCurrentData(buildCompetitionData());

  const view = main.buildCompetitionSectionViewModel({ country: '', competition: '', search: '' });

  assert.strictEqual(view.mode, 'catalog');
  assert.strictEqual(view.title, 'Competencias');
  assert.strictEqual(view.subtitle, '');
  assert.strictEqual(view.items.length, 2);
  assert.strictEqual(view.spotlight, null);
})();

(function testBuildCompetitionSectionViewModelCountryUsesCatalog() {
  const main = loadMainExports();
  main.setCurrentData(buildCompetitionData());

  const view = main.buildCompetitionSectionViewModel({ country: 'Chile', competition: '', search: '' });

  assert.strictEqual(view.mode, 'catalog');
  assert.strictEqual(view.title, 'Competencias donde participa Chile');
  assert.strictEqual(view.items.length, 2);
})();

(function testBuildCompetitionSectionViewModelCompetitionUsesSpotlight() {
  const main = loadMainExports();
  main.setCurrentData(buildCompetitionData());

  const view = main.buildCompetitionSectionViewModel({ country: '', competition: 'Liga del Pac\u00edfico 2024', search: '' });

  assert.strictEqual(view.mode, 'spotlight');
  assert.strictEqual(view.title, 'Detalle de Liga del Pac\u00edfico 2024');
  assert.strictEqual(view.subtitle, '');
  assert.strictEqual(view.items.length, 0);
  assert.strictEqual(view.spotlight.name, 'Liga del Pac\u00edfico 2024');
})();

(function testBuildCompetitionSectionViewModelCountryCompetitionUsesSpotlightSubtitle() {
  const main = loadMainExports();
  const data = buildCompetitionData();
  data.main_kpis = {
    total_teams: 1,
    total_players: 2,
    total_prizes: 25000
  };
  data.top_teams = [
    {
      name: 'Águilas Celestes',
      country: 'Argentina',
      total_prizes: 25000,
      average_position: 2,
      best_position: 2
    }
  ];
  main.setCurrentData(data);

  const view = main.buildCompetitionSectionViewModel({ country: 'Argentina', competition: 'Copa Andina 2024', search: '' });

  assert.strictEqual(view.mode, 'spotlight');
  assert.strictEqual(view.title, 'Detalle de Copa Andina 2024');
  assert.strictEqual(view.subtitle, 'Con participaci\u00f3n de Argentina');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(view.countryParticipation)), {
    country: 'Argentina',
    teams: 1,
    players: 2,
    totalPrizes: 25000,
    bestPosition: 2
  });
})();

(function testSearchDoesNotChangeStructuralMode() {
  const main = loadMainExports();
  main.setCurrentData(buildCompetitionData());

  const view = main.buildCompetitionSectionViewModel({ country: '', competition: '', search: 'Mat\u00edas Rojas' });

  assert.strictEqual(view.mode, 'catalog');
  assert.strictEqual(view.title, 'Competencias');
  assert.strictEqual(view.items.length, 2);
})();

(function testMissingCompetitionReturnsDetailEmptyState() {
  const main = loadMainExports();
  main.setCurrentData({ competitions: [] });

  const view = main.buildCompetitionSectionViewModel({ country: '', competition: 'Masters Latam 2025', search: '' });

  assert.strictEqual(view.mode, 'empty');
  assert.strictEqual(view.title, 'Detalle de Masters Latam 2025');
  assert.strictEqual(view.emptyState.message, 'Sin detalle de competencia para este filtro');
})();

(function testMissingCountryRowsReturnsCatalogEmptyState() {
  const main = loadMainExports();
  main.setCurrentData({ competitions: [] });

  const view = main.buildCompetitionSectionViewModel({ country: 'Chile', competition: '', search: '' });

  assert.strictEqual(view.mode, 'empty');
  assert.strictEqual(view.title, 'Competencias');
  assert.strictEqual(view.emptyState.message, 'Sin competencias para este filtro');
})();

(function testInvalidCountryCompetitionReturnsParticipationEmptyState() {
  const main = loadMainExports();
  const data = buildCompetitionData();
  data.main_kpis = {
    total_teams: 0,
    total_players: 0,
    total_prizes: 0
  };
  data.top_teams = [];
  main.setCurrentData(data);

  const view = main.buildCompetitionSectionViewModel({
    country: 'Chile',
    competition: 'Liga del Pac\u00edfico 2024',
    search: ''
  });

  assert.strictEqual(view.mode, 'empty');
  assert.strictEqual(view.title, 'Detalle de Liga del Pac\u00edfico 2024');
  assert.strictEqual(view.subtitle, '');
  assert.strictEqual(view.emptyState.message, 'Sin participaci\u00f3n de Chile en esta competencia');
})();

(function testRenderCompetitionSectionUpdatesHeaderAndCatalogMarkup() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderCompetitionSection({
    mode: 'catalog',
    title: 'Competencias',
    subtitle: '',
    items: [
      {
        name: 'Copa Andina 2024',
        year: 2024,
        type: 'Nacional',
        location: 'Quito',
        participatingTeams: 4,
        totalPrize: 50000
      }
    ],
    spotlight: null,
    emptyState: null
  });

  assert.strictEqual(elements.competitionsSectionTitle.textContent, 'Competencias');
  assert.strictEqual(elements.competitionsSectionSubtitle.textContent, '');
  assert.strictEqual(elements.competitionsSectionSubtitle.hidden, true);
  assert.ok(elements.competitionsContent.innerHTML.includes('competition-card--catalog'));
  assert.ok(elements.competitionsContent.innerHTML.includes('competition-card__eyebrow'));
  assert.ok(elements.competitionsContent.innerHTML.includes('competition-card__footer'));
  assert.ok(elements.competitionsContent.innerHTML.includes('competition-card'));
  assert.ok(!elements.competitionsContent.innerHTML.includes('competition-spotlight-card'));
})();

(function testRenderCompetitionSectionUpdatesSpotlightMarkup() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderCompetitionSection({
    mode: 'spotlight',
    title: 'Detalle de Challenger Sur 2025',
    subtitle: 'Con participaci\u00f3n de Chile',
    items: [],
    spotlight: {
      name: 'Challenger Sur 2025',
      year: 2025,
      type: 'Nacional',
      location: 'Santiago',
      participatingTeams: 4,
      totalPlayers: 8,
      totalPrize: 40000,
      averageAge: 23.4
    },
    countryParticipation: {
      country: 'Chile',
      teams: 1,
      players: 2,
      totalPrizes: 8000,
      bestPosition: 3
    },
    emptyState: null
  });

  assert.strictEqual(elements.competitionsSectionTitle.textContent, 'Detalle de Challenger Sur 2025');
  assert.strictEqual(elements.competitionsSectionSubtitle.textContent, 'Con participaci\u00f3n de Chile');
  assert.strictEqual(elements.competitionsSectionSubtitle.hidden, false);
  assert.ok(elements.competitionsContent.innerHTML.includes('competition-spotlight-card'));
  assert.ok(elements.competitionsContent.innerHTML.includes('competition-card--spotlight'));
  assert.ok(elements.competitionsContent.innerHTML.includes('competition-spotlight-metrics--primary'));
  assert.ok(elements.competitionsContent.innerHTML.includes('23.4 a\u00f1os'));
  assert.ok(elements.competitionsContent.innerHTML.includes('Participaci\u00f3n de Chile'));
  assert.ok(elements.competitionsContent.innerHTML.includes('Premios del pa\u00eds'));
  assert.ok(elements.competitionsContent.innerHTML.includes('$8,000'));
  assert.ok(elements.competitionsContent.innerHTML.includes('Mejor puesto'));
  assert.ok(!elements.competitionsContent.innerHTML.includes('Promedio por equipo'));
  assert.ok(!elements.competitionsContent.innerHTML.includes('competitions-catalog-grid'));
})();

(function testRenderCompetitionSectionUsesSinDatoForNullAverageAge() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderCompetitionSection({
    mode: 'spotlight',
    title: 'Detalle de Challenger Sur 2025',
    subtitle: '',
    items: [],
    spotlight: {
      name: 'Challenger Sur 2025',
      year: 2025,
      type: 'Nacional',
      location: 'Santiago',
      participatingTeams: 4,
      totalPlayers: 8,
      totalPrize: 40000,
      averageAge: null
    },
    countryParticipation: null,
    emptyState: null
  });

  assert.ok(elements.competitionsContent.innerHTML.includes('Sin dato'));
})();

(function testRenderCompetitionSectionShowsCountryPrizeZeroAsCurrency() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderCompetitionSection({
    mode: 'spotlight',
    title: 'Detalle de Challenger Sur 2025',
    subtitle: 'Con participaci\u00f3n de Per\u00fa',
    items: [],
    spotlight: {
      name: 'Challenger Sur 2025',
      year: 2025,
      type: 'Nacional',
      location: 'Santiago',
      participatingTeams: 4,
      totalPlayers: 8,
      totalPrize: 40000,
      averageAge: 23.4
    },
    countryParticipation: {
      country: 'Per\u00fa',
      teams: 1,
      players: 2,
      totalPrizes: 0,
      bestPosition: null
    },
    emptyState: null
  });

  assert.ok(elements.competitionsContent.innerHTML.includes('Participaci\u00f3n de Per\u00fa'));
  assert.ok(elements.competitionsContent.innerHTML.includes('$0'));
  assert.ok(elements.competitionsContent.innerHTML.includes('Sin clasificaci\u00f3n final'));
})();

(function testRenderCompetitionSectionEmptyStateKeepsSubtitleHidden() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderCompetitionSection({
    mode: 'empty',
    title: 'Competencias',
    subtitle: '',
    items: [],
    spotlight: null,
    emptyState: { message: 'Sin competencias para este filtro' }
  });

  assert.strictEqual(elements.competitionsSectionSubtitle.hidden, true);
  assert.ok(elements.competitionsContent.innerHTML.includes('competitions-empty-state'));
})();
