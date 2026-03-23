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
  getSquadUsageFilters,
  buildSquadUsageViewModel,
  renderSquadUsageSection,
  populateSquadUsageSection,
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

  elements['plantilla-section'] = { hidden: false };
  elements['plantilla-section-title'] = { textContent: '', innerHTML: '' };
  elements['plantilla-section-subtitle'] = { textContent: '', innerHTML: '' };
  elements['plantilla-section-context'] = { textContent: '', innerHTML: '', hidden: false };
  elements['plantilla-content'] = { innerHTML: '' };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function buildCurrentData() {
  return {
    squad_usage_summary: {
      starter_participations: 7,
      substitute_participations: 1,
      starter_share_pct: 87.5,
      substitute_share_pct: 12.5,
      starter_unique_players: 6,
      substitute_unique_players: 1,
      starter_avg_performance: 68.5,
      substitute_avg_performance: 72.0,
      performance_gap_pct: 3.5,
      teams_with_substitutes: 1,
      teams_without_substitutes: 1
    },
    squad_usage_team_breakdown: [
      {
        team: 'Team B',
        country: 'Mexico',
        starter_participations: 3,
        substitute_participations: 0,
        starter_unique_players: 3,
        substitute_unique_players: 0,
        starter_avg_performance: 66,
        substitute_avg_performance: null,
        substitute_share_pct: 0,
        performance_gap_pct: null
      },
      {
        team: 'Team A',
        country: 'Chile',
        starter_participations: 4,
        substitute_participations: 1,
        starter_unique_players: 3,
        substitute_unique_players: 1,
        starter_avg_performance: 70,
        substitute_avg_performance: 72,
        substitute_share_pct: 20,
        performance_gap_pct: 2
      }
    ]
  };
}

(function testGetSquadUsageFiltersReadsDomValues() {
  const main = loadMainExports();
  const elements = main.__elements;
  elements['filter-country'] = { value: 'Chile' };
  elements['filter-competition'] = { value: 'Comp 2025' };
  elements['search-player'] = { value: 'Jose Perez' };

  const filters = main.getSquadUsageFilters();

  assert.strictEqual(JSON.stringify(filters), JSON.stringify({
    country: 'Chile',
    competition: 'Comp 2025',
    search: 'Jose Perez'
  }));
})();

(function testBuildSquadUsageViewModelGlobalIgnoresSearchOnly() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: { squad_usage_by_country_competition: [] } });
  main.setCurrentData(buildCurrentData());

  const view = main.buildSquadUsageViewModel({ country: '', competition: '', search: 'Jose Perez' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.context, 'global');
  assert.strictEqual(view.title, 'Uso de Plantilla');
  assert.strictEqual(view.subtitle, 'C\u00f3mo se reparten titulares y suplentes seg\u00fan el contexto');
  assert.strictEqual(view.contextLabel, 'Vista general de titulares y suplentes');
  assert.strictEqual(view.contextMeta.teamsLabel, '2 equipos analizados');
  assert.strictEqual(view.contextMeta.recordsLabel, '8 registros de plantilla');
  assert.strictEqual(view.contextMeta.singleCompetitionNote, '');
  assert.strictEqual(view.summary.length, 4);
  assert.ok(!Object.prototype.hasOwnProperty.call(view.insight, 'label'));
  assert.strictEqual(view.insight.title, 'Rotaci\u00f3n moderada');
  assert.strictEqual(view.insight.description, '1 de 8 registros de plantilla fue suplente. Rendimiento promedio: titulares 68.5% · suplentes 72.0%.');
  assert.strictEqual(view.chartModel.title, 'Reparto titular vs suplente');
  assert.strictEqual(view.chartModel.segments.length, 2);
  assert.strictEqual(view.chartModel.segments[0].label, 'Titular');
  assert.strictEqual(view.chartModel.segments[1].label, 'Suplente');
  assert.strictEqual(JSON.stringify(view.tableModel.columns.map((column) => column.label)), JSON.stringify(['Equipo', 'Pa\u00eds', 'Titulares', 'Suplentes', '% suplentes', 'Diferencia de rendimiento']));
  assert.strictEqual(view.tableModel.rows[0].team, 'Team A');
  assert.strictEqual(view.tableModel.rows[1].team, 'Team B');
})();

(function testBuildSquadUsageViewModelCountryUsesFriendlyCopyAndHidesCountryColumn() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: { squad_usage_by_country_competition: [{ country: 'Chile', competition_name: 'Copa Uno' }, { country: 'Chile', competition_name: 'Copa Dos' }] } });
  main.setCurrentData({
    squad_usage_summary: {
      country: 'Chile',
      starter_participations: 4,
      substitute_participations: 0,
      starter_share_pct: 100,
      substitute_share_pct: 0,
      starter_unique_players: 3,
      substitute_unique_players: 0,
      starter_avg_performance: 70,
      substitute_avg_performance: null,
      performance_gap_pct: null,
      teams_with_substitutes: 0,
      teams_without_substitutes: 1
    },
    squad_usage_team_breakdown: [
      {
        team: 'Team A',
        country: 'Chile',
        starter_participations: 4,
        substitute_participations: 0,
        starter_unique_players: 3,
        substitute_unique_players: 0,
        starter_avg_performance: 70,
        substitute_avg_performance: null,
        substitute_share_pct: 0,
        performance_gap_pct: null
      }
    ]
  });

  const view = main.buildSquadUsageViewModel({ country: 'Chile', competition: '', search: 'Jose Perez' });

  assert.strictEqual(view.context, 'country');
  assert.strictEqual(view.contextLabel, 'As\u00ed se reparte la plantilla de Chile');
  assert.strictEqual(view.contextMeta.teamsLabel, '1 equipo analizado');
  assert.strictEqual(view.contextMeta.recordsLabel, '4 registros de plantilla');
  assert.strictEqual(view.contextMeta.singleCompetitionNote, '');
  assert.strictEqual(view.insight.title, 'Sin uso de suplentes');
  assert.strictEqual(view.insight.description, 'Todos los registros de plantilla fueron titulares.');
  assert.strictEqual(JSON.stringify(view.tableModel.columns.map((column) => column.label)), JSON.stringify(['Equipo', 'Titulares', 'Suplentes', '% suplentes', 'Diferencia de rendimiento']));
})();

(function testBuildSquadUsageViewModelCompetitionUsesFriendlyCopyAndKeepsCountryColumn() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: { squad_usage_by_country_competition: [] } });
  main.setCurrentData({
    squad_usage_summary: {
      competition_name: 'Comp 2025',
      starter_participations: 4,
      substitute_participations: 1,
      starter_share_pct: 80,
      substitute_share_pct: 20,
      starter_unique_players: 4,
      substitute_unique_players: 1,
      starter_avg_performance: 68,
      substitute_avg_performance: 72,
      performance_gap_pct: 4,
      teams_with_substitutes: 1,
      teams_without_substitutes: 1
    },
    squad_usage_team_breakdown: [
      {
        competition_name: 'Comp 2025',
        team: 'Team B',
        country: 'Mexico',
        starter_participations: 3,
        substitute_participations: 0,
        starter_unique_players: 3,
        substitute_unique_players: 0,
        starter_avg_performance: 66,
        substitute_avg_performance: null,
        substitute_share_pct: 0,
        performance_gap_pct: null
      },
      {
        competition_name: 'Comp 2025',
        team: 'Team A',
        country: 'Chile',
        starter_participations: 1,
        substitute_participations: 1,
        starter_unique_players: 1,
        substitute_unique_players: 1,
        starter_avg_performance: 70,
        substitute_avg_performance: 72,
        substitute_share_pct: 50,
        performance_gap_pct: 2
      }
    ]
  });

  const view = main.buildSquadUsageViewModel({ country: '', competition: 'Comp 2025', search: 'Jose Perez' });

  assert.strictEqual(view.context, 'competition');
  assert.strictEqual(view.contextLabel, 'As\u00ed se reparti\u00f3 la plantilla en Comp 2025');
  assert.strictEqual(view.contextMeta.teamsLabel, '2 equipos analizados');
  assert.strictEqual(view.contextMeta.recordsLabel, '5 registros de plantilla');
  assert.strictEqual(JSON.stringify(view.tableModel.columns.map((column) => column.label)), JSON.stringify(['Equipo', 'Pa\u00eds', 'Titulares', 'Suplentes', '% suplentes', 'Diferencia de rendimiento']));
  assert.strictEqual(view.tableModel.rows[0].team, 'Team A');
})();

(function testBuildSquadUsageViewModelCountryCompetitionUsesFriendlyCopyAndNullGapFallback() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: { squad_usage_by_country_competition: [{ country: 'Chile', competition_name: 'Comp 2025' }, { country: 'Chile', competition_name: 'Comp 2026' }] } });
  main.setCurrentData({
    squad_usage_summary: {
      competition_name: 'Comp 2025',
      country: 'Chile',
      starter_participations: 4,
      substitute_participations: 0,
      starter_share_pct: 100,
      substitute_share_pct: 0,
      starter_unique_players: 3,
      substitute_unique_players: 0,
      starter_avg_performance: 70,
      substitute_avg_performance: null,
      performance_gap_pct: null,
      teams_with_substitutes: 0,
      teams_without_substitutes: 1
    },
    squad_usage_team_breakdown: [
      {
        competition_name: 'Comp 2025',
        team: 'Team A',
        country: 'Chile',
        starter_participations: 4,
        substitute_participations: 0,
        starter_unique_players: 3,
        substitute_unique_players: 0,
        starter_avg_performance: 70,
        substitute_avg_performance: null,
        substitute_share_pct: 0,
        performance_gap_pct: null
      }
    ]
  });

  const view = main.buildSquadUsageViewModel({ country: 'Chile', competition: 'Comp 2025', search: 'Jose Perez' });

  assert.strictEqual(view.context, 'country_competition');
  assert.strictEqual(view.contextLabel, 'As\u00ed reparti\u00f3 Chile su plantilla en Comp 2025');
  assert.strictEqual(view.contextMeta.teamsLabel, '1 equipo analizado');
  assert.strictEqual(view.contextMeta.recordsLabel, '4 registros de plantilla');
  assert.strictEqual(view.contextMeta.singleCompetitionNote, '');
  assert.strictEqual(view.tableModel.rows[0].performanceGapLabel, 'Sin comparaci\u00f3n');
  assert.strictEqual(JSON.stringify(view.tableModel.columns.map((column) => column.label)), JSON.stringify(['Equipo', 'Titulares', 'Suplentes', '% suplentes', 'Diferencia de rendimiento']));
})();

(function testBuildSquadUsageViewModelCountryWithSingleCompetitionShowsNoteAndSingularMissingComparisonCopy() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: { squad_usage_by_country_competition: [{ country: 'Bolivia', competition_name: 'Masters Latam 2025' }] } });
  main.setCurrentData({
    squad_usage_summary: {
      country: 'Bolivia',
      starter_participations: 2,
      substitute_participations: 1,
      starter_share_pct: 66.67,
      substitute_share_pct: 33.33,
      starter_unique_players: 2,
      substitute_unique_players: 1,
      starter_avg_performance: null,
      substitute_avg_performance: null,
      performance_gap_pct: null,
      teams_with_substitutes: 1,
      teams_without_substitutes: 0
    },
    squad_usage_team_breakdown: [
      {
        team: 'Condores Rojos',
        country: 'Bolivia',
        starter_participations: 2,
        substitute_participations: 1,
        starter_unique_players: 2,
        substitute_unique_players: 1,
        starter_avg_performance: null,
        substitute_avg_performance: null,
        substitute_share_pct: 33.33,
        performance_gap_pct: null
      }
    ]
  });

  const view = main.buildSquadUsageViewModel({ country: 'Bolivia', competition: '', search: '' });

  assert.strictEqual(view.contextMeta.teamsLabel, '1 equipo analizado');
  assert.strictEqual(view.contextMeta.recordsLabel, '3 registros de plantilla');
  assert.strictEqual(view.contextMeta.singleCompetitionNote, 'Este pa\u00eds solo tiene registros en una competencia');
  assert.strictEqual(view.insight.title, 'Rotaci\u00f3n alta');
  assert.strictEqual(view.insight.description, '1 de 3 registros de plantilla fue suplente. No hay datos de rendimiento del a\u00f1o para comparar roles.');
})();

(function testBuildSquadUsageViewModelCountryCompetitionPluralComparisonCopy() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: { squad_usage_by_country_competition: [{ country: 'Ecuador', competition_name: 'Comp 2025' }, { country: 'Ecuador', competition_name: 'Otra Comp' }] } });
  main.setCurrentData({
    squad_usage_summary: {
      competition_name: 'Comp 2025',
      country: 'Ecuador',
      starter_participations: 3,
      substitute_participations: 2,
      starter_share_pct: 60,
      substitute_share_pct: 40,
      starter_unique_players: 3,
      substitute_unique_players: 2,
      starter_avg_performance: 63.3,
      substitute_avg_performance: 75.0,
      performance_gap_pct: 11.7,
      teams_with_substitutes: 1,
      teams_without_substitutes: 0
    },
    squad_usage_team_breakdown: [
      {
        team: 'Guerreros Andinos',
        country: 'Ecuador',
        starter_participations: 3,
        substitute_participations: 2,
        starter_unique_players: 3,
        substitute_unique_players: 2,
        starter_avg_performance: 63.3,
        substitute_avg_performance: 75.0,
        substitute_share_pct: 40,
        performance_gap_pct: 11.7
      }
    ]
  });

  const view = main.buildSquadUsageViewModel({ country: 'Ecuador', competition: 'Comp 2025', search: '' });

  assert.strictEqual(view.contextMeta.teamsLabel, '1 equipo analizado');
  assert.strictEqual(view.contextMeta.recordsLabel, '5 registros de plantilla');
  assert.strictEqual(view.contextMeta.singleCompetitionNote, '');
  assert.strictEqual(view.insight.description, '2 de 5 registros de plantilla fueron suplentes. Rendimiento promedio: titulares 63.3% · suplentes 75.0%.');
})();

(function testBuildSquadUsageViewModelReturnsEmptyStateWithoutStructuralData() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: { squad_usage_by_country_competition: [] } });
  main.setCurrentData({
    squad_usage_summary: null,
    squad_usage_team_breakdown: []
  });

  const view = main.buildSquadUsageViewModel({ country: 'Chile', competition: '', search: '' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.context, 'country');
  assert.strictEqual(view.emptyState.message, 'Sin datos de plantilla para este filtro');
})();

(function testRenderSquadUsageSectionWritesContextMetaMarkup() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderSquadUsageSection({
    visible: true,
    context: 'global',
    title: 'Uso de Plantilla',
    subtitle: 'C\u00f3mo se reparten titulares y suplentes seg\u00fan el contexto',
    contextLabel: 'Vista general de titulares y suplentes',
    contextMeta: {
      teamsLabel: '2 equipos analizados',
      recordsLabel: '8 registros de plantilla',
      singleCompetitionNote: ''
    },
    summary: [
      { label: 'Participaci?n titular', value: '87.5%' },
      { label: 'Participaci?n suplente', value: '12.5%' },
      { label: 'Titulares ?nicos', value: '6' },
      { label: 'Suplentes ?nicos', value: '1' }
    ],
    insight: {
      title: 'Rotaci\u00f3n moderada',
      description: '1 de 8 registros de plantilla fue suplente. Rendimiento promedio: titulares 68.5% · suplentes 72.0%.'
    },
    chartModel: {
      title: 'Reparto titular vs suplente',
      ariaLabel: 'Titular 87.5%; Suplente 12.5%',
      segments: [
        { label: 'Titular', value: 87.5, valueLabel: '87.5%', participations: 7, uniquePlayers: 6, averagePerformance: 68.5, tone: 'primary' },
        { label: 'Suplente', value: 12.5, valueLabel: '12.5%', participations: 1, uniquePlayers: 1, averagePerformance: 72, tone: 'secondary' }
      ]
    },
    tableModel: {
      title: 'Equipos comparados',
      columns: [
        { key: 'team', label: 'Equipo' },
        { key: 'country', label: 'Pa\u00eds' },
        { key: 'starterParticipationsLabel', label: 'Titulares' },
        { key: 'substituteParticipationsLabel', label: 'Suplentes' },
        { key: 'substituteShareLabel', label: '% suplentes' },
        { key: 'performanceGapLabel', label: 'Diferencia de rendimiento' }
      ],
      rows: [
        {
          team: 'Team A',
          country: 'Chile',
          starterParticipationsLabel: '4',
          substituteParticipationsLabel: '1',
          substituteShareLabel: '20.0%',
          performanceGapLabel: '+2.0 pts',
          performanceGapTone: 'positive'
        }
      ]
    },
    emptyState: null
  });

  assert.strictEqual(elements['plantilla-section'].hidden, false);
  assert.strictEqual(elements['plantilla-section-title'].textContent, 'Uso de Plantilla');
  assert.strictEqual(elements['plantilla-section-context'].textContent, 'Vista general de titulares y suplentes');
  assert.ok(elements['plantilla-content'].innerHTML.includes('2 equipos analizados'));
  assert.ok(elements['plantilla-content'].innerHTML.includes('8 registros de plantilla'));
  assert.ok(elements['plantilla-content'].innerHTML.includes('squad-usage-repartition__track'));
  assert.ok(elements['plantilla-content'].innerHTML.includes('Diferencia de rendimiento'));
  assert.ok(!elements['plantilla-content'].innerHTML.includes('Lectura del contexto'));
  assert.ok(!elements['plantilla-content'].innerHTML.includes('Brecha rendimiento'));
  assert.ok(!elements['plantilla-content'].innerHTML.includes('squadUsageChart'));
})();

(function testRenderSquadUsageSectionCountryColumnsAndSingleCompetitionNote() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderSquadUsageSection({
    visible: true,
    context: 'country',
    title: 'Uso de Plantilla',
    subtitle: 'C\u00f3mo se reparten titulares y suplentes seg\u00fan el contexto',
    contextLabel: 'As\u00ed se reparte la plantilla de Chile',
    contextMeta: {
      teamsLabel: '1 equipo analizado',
      recordsLabel: '4 registros de plantilla',
      singleCompetitionNote: 'Este pa\u00eds solo tiene registros en una competencia'
    },
    summary: [],
    insight: { title: 'Sin uso de suplentes', description: 'Todos los registros de plantilla fueron titulares.' },
    chartModel: { title: 'Reparto titular vs suplente', ariaLabel: '', segments: [] },
    tableModel: {
      title: 'Equipos de Chile',
      columns: [
        { key: 'team', label: 'Equipo' },
        { key: 'starterParticipationsLabel', label: 'Titulares' },
        { key: 'substituteParticipationsLabel', label: 'Suplentes' },
        { key: 'substituteShareLabel', label: '% suplentes' },
        { key: 'performanceGapLabel', label: 'Diferencia de rendimiento' }
      ],
      rows: []
    },
    emptyState: null
  });

  assert.ok(!elements['plantilla-content'].innerHTML.includes('<th>Pa\u00eds</th>'));
  assert.ok(elements['plantilla-content'].innerHTML.includes('Este pa\u00eds solo tiene registros en una competencia'));
})();

console.log('frontend_squad_usage_section tests passed');

