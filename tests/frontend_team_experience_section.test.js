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
  buildTeamExperienceViewModel,
  renderTeamExperienceSection,
  populateTeamExperienceSection,
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

  elements['team-experience-section'] = { hidden: false };
  elements['team-experience-section-title'] = { textContent: '', innerHTML: '' };
  elements['team-experience-section-subtitle'] = { textContent: '', innerHTML: '', hidden: false };
  elements['team-experience-section-context'] = { textContent: '', innerHTML: '', hidden: false };
  elements['team-experience-content'] = { innerHTML: '' };

  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox, { filename: 'main.js' });
  sandbox.module.exports.__elements = elements;
  return sandbox.module.exports;
}

function buildCurrentData(overrides = {}) {
  return Object.assign({
    team_experience_summary: {
      teams_count: 2,
      veteran_starters_count: 2,
      veteran_substitutes_count: 0,
      veteran_mixed_count: 0,
      avg_team_age: 23.9,
      avg_veteran_age: 25,
      avg_age_span: 4
    },
    team_experience_profiles: [
      {
        team: 'Team A',
        country: 'Chile',
        veteran_player: 'Jose Perez',
        veteran_age: 28,
        veteran_role: 'Titular',
        veteran_performance_pct: 74,
        team_avg_age: 24.3,
        youngest_age: 21,
        oldest_age: 28,
        age_span: 7,
        team_avg_performance_pct: 68,
        veteran_vs_team_gap_pct: 6,
        competitions_count: 2
      },
      {
        team: 'Team B',
        country: 'Ecuador',
        veteran_player: 'Luis Quispe',
        veteran_age: 25,
        veteran_role: 'Titular',
        veteran_performance_pct: 70,
        team_avg_age: 23.5,
        youngest_age: 20,
        oldest_age: 25,
        age_span: 5,
        team_avg_performance_pct: 66,
        veteran_vs_team_gap_pct: 4,
        competitions_count: 1
      }
    ],
    team_experience_leaders: {
      most_experienced_team: 'Team A',
      most_experienced_team_avg_age: 24.3,
      best_veteran_player: 'Jose Perez',
      best_veteran_team: 'Team A',
      best_veteran_performance_pct: 74,
      widest_age_gap_team: 'Team A',
      widest_age_gap_years: 7,
      highest_veteran_advantage_team: 'Team A',
      highest_veteran_advantage_pct: 6
    }
  }, overrides);
}

(function testBuildTeamExperienceViewModelGlobalUsesCompareMode() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData());

  const view = main.buildTeamExperienceViewModel({ country: '', competition: '', search: 'Jose Perez' });

  assert.strictEqual(view.visible, true);
  assert.strictEqual(view.context, 'global');
  assert.strictEqual(view.title, 'Experiencia del equipo');
  assert.strictEqual(view.subtitle, 'Cómo se reparte la experiencia y el liderazgo dentro de cada equipo');
  assert.strictEqual(view.contextLabel, 'Vista general de la experiencia de los equipos');
  assert.strictEqual(view.leaders.length, 4);
  assert.ok(view.roleInsight);
  assert.strictEqual(view.roleInsight.eyebrow, 'Rol del veterano');
  assert.strictEqual(view.roleInsight.title, 'Todos usan a su veterano como titular');
  assert.strictEqual(view.roleInsight.description, '2 de 2 equipos usan a su veterano como titular');
  assert.ok(view.compareMode);
  assert.strictEqual(view.profileMode, null);
  assert.ok(view.rangeChartModel);
  assert.strictEqual(view.rangeChartModel.title, 'Rango de edades por equipo');
  assert.strictEqual(view.rangeChartModel.explanation, 'La barra va del jugador más joven al más experimentado. Pasa el cursor o toca la barra para ver el menor, el promedio y el veterano.');
  assert.strictEqual(view.rangeChartModel.items.length, 2);
  assert.strictEqual(
    view.rangeChartModel.items[0].tooltipLabel,
    'Más joven: 21 años · Promedio: 24.3 años · Veterano: 28 años'
  );
  assert.strictEqual(
    JSON.stringify(view.tableModel.columns.map((column) => column.label)),
    JSON.stringify([
      'Equipo', 'País', 'Veterano', 'Rol', 'Edad del veterano', 'Edad promedio',
      'Rango de edades', 'Rendimiento del veterano', 'Diferencia vs equipo', 'Competiciones'
    ])
  );
  assert.strictEqual(view.leaders[0].label, 'Equipo con mayor edad promedio');
  assert.strictEqual(view.leaders[2].label, 'Mayor rango de edades');
  assert.strictEqual(view.leaders[3].label, 'Diferencia del veterano vs equipo');
})();

(function testBuildTeamExperienceViewModelCountryKeepsContextWithSearch() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_experience_summary: {
      country: 'Ecuador',
      teams_count: 2,
      veteran_starters_count: 1,
      veteran_substitutes_count: 1,
      veteran_mixed_count: 0,
      avg_team_age: 24,
      avg_veteran_age: 25,
      avg_age_span: 4.5
    },
    team_experience_profiles: [
      {
        team: 'Team B',
        country: 'Ecuador',
        veteran_player: 'Luis Quispe',
        veteran_age: 25,
        veteran_role: 'Titular',
        veteran_performance_pct: 70,
        team_avg_age: 23.5,
        youngest_age: 20,
        oldest_age: 25,
        age_span: 5,
        team_avg_performance_pct: 66,
        veteran_vs_team_gap_pct: 4,
        competitions_count: 1
      },
      {
        team: 'Team C',
        country: 'Ecuador',
        veteran_player: 'Carlos Diaz',
        veteran_age: 24,
        veteran_role: 'Suplente',
        veteran_performance_pct: null,
        team_avg_age: 24.5,
        youngest_age: 21,
        oldest_age: 24,
        age_span: 3,
        team_avg_performance_pct: 64,
        veteran_vs_team_gap_pct: null,
        competitions_count: 2
      }
    ]
  }));

  const view = main.buildTeamExperienceViewModel({ country: 'Ecuador', competition: '', search: 'Carlos Hernandez' });

  assert.strictEqual(view.context, 'country');
  assert.strictEqual(view.contextLabel, 'Así se reparte la experiencia en los equipos de Ecuador');
  assert.ok(view.compareMode);
  assert.strictEqual(view.profileMode, null);
  assert.strictEqual(view.roleInsight.title, 'Uso mixto del veterano');
  assert.strictEqual(
    JSON.stringify(view.tableModel.columns.map((column) => column.label)),
    JSON.stringify([
      'Equipo', 'Veterano', 'Rol', 'Edad del veterano', 'Edad promedio',
      'Rango de edades', 'Rendimiento del veterano', 'Diferencia vs equipo', 'Competiciones'
    ])
  );
})();

(function testBuildTeamExperienceViewModelCountryCompetitionUsesProfileMode() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData(buildCurrentData({
    team_experience_summary: {
      country: 'Bolivia',
      competition_name: 'Masters Latam 2025',
      teams_count: 1,
      veteran_starters_count: 1,
      veteran_substitutes_count: 0,
      veteran_mixed_count: 0,
      avg_team_age: 22.3,
      avg_veteran_age: 24,
      avg_age_span: 3
    },
    team_experience_profiles: [
      {
        team: 'Condores Rojos',
        country: 'Bolivia',
        veteran_player: 'Pedro Martinez',
        veteran_age: 24,
        veteran_role: 'Titular',
        veteran_performance_pct: null,
        team_avg_age: 22.3,
        youngest_age: 21,
        oldest_age: 24,
        age_span: 3,
        team_avg_performance_pct: null,
        veteran_vs_team_gap_pct: null,
        competitions_count: 1,
        competition_name: 'Masters Latam 2025',
        competition_result: 2
      }
    ],
    team_experience_leaders: {
      country: 'Bolivia',
      competition_name: 'Masters Latam 2025',
      most_experienced_team: 'Condores Rojos',
      most_experienced_team_avg_age: 22.3,
      best_veteran_player: 'Pedro Martinez',
      best_veteran_team: 'Condores Rojos',
      best_veteran_performance_pct: null,
      widest_age_gap_team: 'Condores Rojos',
      widest_age_gap_years: 3,
      highest_veteran_advantage_team: 'Condores Rojos',
      highest_veteran_advantage_pct: null
    }
  }));

  const view = main.buildTeamExperienceViewModel({ country: 'Bolivia', competition: 'Masters Latam 2025', search: 'Pedro Martinez' });

  assert.strictEqual(view.context, 'country_competition');
  assert.strictEqual(view.contextLabel, 'Así se repartió la experiencia de Bolivia en Masters Latam 2025');
  assert.strictEqual(view.compareMode, null);
  assert.ok(view.profileMode);
  assert.strictEqual(view.profileMode.team, 'Condores Rojos');
  assert.strictEqual(view.profileMode.metrics[2].label, 'Edad del veterano');
  assert.strictEqual(view.profileMode.metrics[4].value, 'Sin registro de rendimiento');
  assert.strictEqual(view.profileMode.metrics[5].value, 'Sin registro de rendimiento');
  assert.strictEqual(view.tableModel, null);
})();

(function testBuildTeamExperienceViewModelEmptyState() {
  const main = loadMainExports();
  main.setDashboardData({ filter_ready: {} });
  main.setCurrentData({
    team_experience_summary: null,
    team_experience_profiles: [],
    team_experience_leaders: {}
  });

  const view = main.buildTeamExperienceViewModel({ country: '', competition: '', search: '' });

  assert.strictEqual(view.visible, true);
  assert.ok(view.emptyState);
  assert.strictEqual(view.emptyState.message, 'Sin datos de experiencia para este filtro');
})();

(function testRenderTeamExperienceSectionUsesNewPremiumCopy() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderTeamExperienceSection({
    visible: true,
    title: 'Experiencia del equipo',
    subtitle: 'Cómo se reparte la experiencia y el liderazgo dentro de cada equipo',
    contextLabel: 'Vista general de la experiencia de los equipos',
    leaders: [
      {
        label: 'Equipo con mayor edad promedio',
        team: 'Team A',
        value: '24.3 años',
        description: 'Es el equipo con la edad promedio más alta del contexto.',
        tone: 'primary',
        icon: 'fas fa-hourglass-half'
      }
    ],
    roleInsight: {
      eyebrow: 'Rol del veterano',
      title: 'Todos usan a su veterano como titular',
      description: '2 de 2 equipos usan a su veterano como titular'
    },
    compareMode: { teamCount: 2 },
    profileMode: null,
    rangeChartModel: {
      title: 'Rango de edades por equipo',
      explanation: 'La barra va del jugador más joven al más experimentado. Pasa el cursor o toca la barra para ver el menor, el promedio y el veterano.',
      items: [
        {
          team: 'Team A',
          country: 'Chile',
          veteranRoleLabel: 'Titular',
          veteranRoleTone: 'starter',
          youngestAgeLabel: '21 años',
          veteranAgeLabel: '28 años',
          teamAverageAgeLabel: '24.3 años',
          veteranPlayer: 'Jose Perez',
          tooltipLabel: 'Más joven: 21 años · Promedio: 24.3 años · Veterano: 28 años'
        }
      ]
    },
    tableModel: {
      title: 'Experiencia comparada',
      columns: [
        { key: 'team', label: 'Equipo' },
        { key: 'veteranPlayer', label: 'Veterano' },
        { key: 'veteranRoleLabel', label: 'Rol' }
      ],
      rows: [
        {
          team: 'Team A',
          veteranPlayer: 'Jose Perez',
          veteranRoleLabel: 'Titular'
        }
      ]
    },
    emptyState: null
  });

  assert.strictEqual(elements['team-experience-section'].hidden, false);
  assert.strictEqual(elements['team-experience-section-title'].textContent, 'Experiencia del equipo');
  assert.ok(elements['team-experience-content'].innerHTML.includes('Rango de edades por equipo'));
  assert.ok(elements['team-experience-content'].innerHTML.includes('Pasa el cursor o toca la barra para ver el menor, el promedio y el veterano.'));
  assert.ok(elements['team-experience-content'].innerHTML.includes('Todos usan a su veterano como titular'));
  assert.ok(elements['team-experience-content'].innerHTML.includes('data-tooltip=\"Más joven: 21 años · Promedio: 24.3 años · Veterano: 28 años\"'));
  assert.ok(elements['team-experience-content'].innerHTML.includes('años'));
  assert.ok(elements['team-experience-content'].innerHTML.includes('Titular'));
  assert.ok(!elements['team-experience-content'].innerHTML.includes('team-experience-range-map__labels'));
  assert.ok(!elements['team-experience-content'].innerHTML.includes('performance_2024'));
  assert.ok(!elements['team-experience-content'].innerHTML.includes('N/A'));
})();

(function testRenderTeamExperienceSectionProfileModeDoesNotDuplicateTable() {
  const main = loadMainExports();
  const elements = main.__elements;

  main.renderTeamExperienceSection({
    visible: true,
    title: 'Experiencia del equipo',
    subtitle: 'Cómo se reparte la experiencia y el liderazgo dentro de cada equipo',
    contextLabel: 'Así se reparte la experiencia en los equipos de Argentina',
    leaders: [],
    roleInsight: {
      eyebrow: 'Rol del veterano',
      title: 'Todos usan a su veterano como titular',
      description: '1 de 1 equipos usan a su veterano como titular'
    },
    compareMode: null,
    profileMode: {
      team: 'Águilas Celestes',
      country: 'Argentina',
      veteranPlayer: 'Luciano Córdoba',
      summary: 'Solo hay un equipo en este contexto.',
      metrics: [
        { label: 'Veterano', value: 'Luciano Córdoba' },
        { label: 'Rol', value: 'Titular', roleTone: 'starter' },
        { label: 'Edad del veterano', value: '24 años' }
      ]
    },
    rangeChartModel: null,
    tableModel: null,
    emptyState: null
  });

  assert.ok(elements['team-experience-content'].innerHTML.includes('Perfil de experiencia'));
  assert.ok(!elements['team-experience-content'].innerHTML.includes('<table'));
})();

console.log('frontend_team_experience_section tests passed');
