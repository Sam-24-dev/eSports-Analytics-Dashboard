// ===== GLOBAL VARIABLES =====
let dashboardData = null;
let currentData = null;
let currentPlayerModuleView = null;
let currentSquadUsageView = null;
let currentTeamComparisonView = null;
let currentTeamExperienceView = null;
let currentAgePerformanceView = null;
let currentMLProjectionView = null;
let currentMLProjectionTableExpanded = false;
let currentMLProjectionFilterKey = '';
let charts = {};
const filtering = (typeof window !== 'undefined' && window.Filtering) ? window.Filtering : {};
const getEmptyData = filtering.getEmptyData;
const normalizeText = filtering.normalizeText;
const buildFilteredData = filtering.buildFilteredData;
let filterIndex = null;
let debouncedApplyFilters = null;
let initialApplyReason = 'filters-change';
// Country flag SVG mapping (ISO 3166-1 alpha-2 codes for flagcdn.com)
const countryIsoCodes = {
    'Ecuador': 'ec', 'Colombia': 'co', 'Chile': 'cl',
    'Bolivia': 'bo', 'Perú': 'pe', 'Argentina': 'ar',
    'Venezuela': 've', 'México': 'mx', 'Brasil': 'br',
    'Paraguay': 'py', 'Uruguay': 'uy'
};

// Returns an <img> SVG flag (20x15px) or empty string if unknown country
function countryFlag(name) {
    const code = countryIsoCodes[name];
    if (!code) return '';
    return `<img src="https://flagcdn.com/w40/${code}.png" width="20" height="15" alt="${name}" class="country-flag" loading="lazy">`;
}

// Backwards compat: keep countryFlags as a dict for chart labels (text-only contexts)
const countryFlags = {};
Object.keys(countryIsoCodes).forEach(name => {
    countryFlags[name] = name.substring(0, 2).toUpperCase();
});

const COUNTRY_CHART_BG_COLORS = [
    'rgba(0, 212, 255, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(16, 185, 129, 0.8)',
    'rgba(255, 215, 0, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(245, 158, 11, 0.8)',
    'rgba(236, 72, 153, 0.8)', 'rgba(99, 102, 241, 0.8)', 'rgba(14, 165, 233, 0.8)'
];
const COUNTRY_CHART_BORDER_COLORS = [
    'rgba(0, 212, 255, 1)', 'rgba(139, 92, 246, 1)', 'rgba(16, 185, 129, 1)',
    'rgba(255, 215, 0, 1)', 'rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)',
    'rgba(236, 72, 153, 1)', 'rgba(99, 102, 241, 1)', 'rgba(14, 165, 233, 1)'
];

const PLAYER_MODULE_COPY = Object.freeze({
    emptyState: {
        comparable: 'Sin comparables 2024-2025',
        positiveOnly: 'Sin mejoras positivas 2024-2025',
        comparableHint: 'Selecciona una competencia para ver ranking anual',
        noPlayerData: 'Jugador sin datos para este filtro',
        noMatches: 'No hay coincidencias en este contexto',
        noRows: 'Sin jugadores para este filtro',
        noSingleYearData: 'Sin rendimiento anual de jugadores para este filtro'
    },
    tableTitles: {
        evolution: 'Evolución de jugadores',
        singleYear: 'Detalle de rendimiento'
    },
    suggestionHeaders: {
        recommendations: 'Recomendados',
        matches: 'Coincidencias'
    }
});

const CONTEXTUAL_TABLE_COPY = Object.freeze({
    empty: {
        noTeams: 'Sin equipos para este filtro',
        noPlayerData: 'Jugador sin datos para este filtro',
        noSingleYearData: 'Sin rendimiento anual de jugadores para este filtro'
    },
    icons: {
        'teams-overview': 'fas fa-table',
        'teams-results': 'fas fa-shield-alt',
        'players-ranking': 'fas fa-list-ol',
        'player-detail': 'fas fa-id-card',
        'empty': 'fas fa-table'
    },
    sortMeta: {
        'teams-overview': { key: 'total_prizes', direction: 'desc', label: 'Premios' },
        'teams-results': { key: 'final_position', direction: 'asc', label: 'Pos.' },
        'players-ranking': { key: 'performance', direction: 'desc', label: 'Rendimiento' },
        'player-detail': { key: 'year', direction: 'asc', label: 'Año' },
        'empty': null
    }
});

const COMPETITION_SECTION_COPY = Object.freeze({
    titles: {
        global: 'Competencias',
        country: function (country) {
            return `Competencias donde participa ${country}`;
        },
        detail: function (competition) {
            return `Detalle de ${competition}`;
        },
        countryContext: function (country) {
            return `Con participación de ${country}`;
        }
    },
    empty: {
        catalog: 'Sin competencias para este filtro',
        detail: 'Sin detalle de competencia para este filtro',
        invalidParticipation: function (country) {
            return `Sin participación de ${country} en esta competencia`;
        }
    }
});

const GLOBAL_SUMMARY_COPY = Object.freeze({
    title: 'Resumen Global',
    subtitle: 'Lo más relevante a nivel global',
    emptyValue: 'Sin dato',
    items: [
        { key: 'best_international_team', label: 'Mejor equipo internacional', icon: 'fas fa-crown', tone: 'gold', valueType: 'text' },
        { key: 'best_player_2024', label: 'Mejor jugador 2024', icon: 'fas fa-star', tone: 'cyan', valueType: 'text' },
        { key: 'most_improved_2025', label: 'Mayor mejora 2025', icon: 'fas fa-chart-line', tone: 'green', valueType: 'text' },
        { key: 'most_competitive', label: 'Competencia con más equipos', icon: 'fas fa-users', tone: 'purple', valueType: 'text' },
        { key: 'total_international_prizes', label: 'Premios internacionales totales', icon: 'fas fa-globe-americas', tone: 'cyan', valueType: 'currency' },
        { key: 'total_national_prizes', label: 'Premios nacionales totales', icon: 'fas fa-map-marked-alt', tone: 'gold', valueType: 'currency' }
    ]
});

const SQUAD_USAGE_COPY = Object.freeze({
    title: 'Uso de Plantilla',
    subtitle: 'Cómo se reparten titulares y suplentes según el contexto',
    contextLabels: {
        global: 'Vista general de titulares y suplentes',
        country: function (country) {
            return `Así se reparte la plantilla de ${country}`;
        },
        competition: function (competition) {
            return `Así se repartió la plantilla en ${competition}`;
        },
        countryCompetition: function (country, competition) {
            return `Así repartió ${country} su plantilla en ${competition}`;
        }
    },
    summary: [
        { key: 'starter_share_pct', label: 'Participación titular', valueType: 'percent', tone: 'primary', icon: 'fas fa-user-shield' },
        { key: 'substitute_share_pct', label: 'Participación suplente', valueType: 'percent', tone: 'secondary', icon: 'fas fa-user-clock' },
        { key: 'starter_unique_players', label: 'Titulares únicos', valueType: 'number', tone: 'primary', icon: 'fas fa-users' },
        { key: 'substitute_unique_players', label: 'Suplentes únicos', valueType: 'number', tone: 'secondary', icon: 'fas fa-user-plus' }
    ],
    insight: {
        none: 'Sin uso de suplentes',
        low: 'Predominio titular',
        medium: 'Rotación moderada',
        high: 'Rotación alta',
        noSubstitutesBody: 'Todos los registros de plantilla fueron titulares.',
        missingComparison: 'No hay datos de rendimiento del año para comparar roles.'
    },
    chartTitle: 'Reparto titular vs suplente',
    roleLabels: {
        starter: 'Titular',
        substitute: 'Suplente'
    },
    tableTitles: {
        global: 'Equipos comparados',
        country: function (country) {
            return `Equipos de ${country}`;
        },
        competition: function (competition) {
            return `Equipos en ${competition}`;
        },
        countryCompetition: function (country, competition) {
            return `Equipos de ${country} en ${competition}`;
        }
    },
    tableColumns: {
        withCountry: [
            { key: 'team', label: 'Equipo' },
            { key: 'country', label: 'País' },
            { key: 'starterParticipationsLabel', label: 'Titulares' },
            { key: 'substituteParticipationsLabel', label: 'Suplentes' },
            { key: 'substituteShareLabel', label: '% suplentes' },
            { key: 'performanceGapLabel', label: 'Diferencia de rendimiento' }
        ],
        withoutCountry: [
            { key: 'team', label: 'Equipo' },
            { key: 'starterParticipationsLabel', label: 'Titulares' },
            { key: 'substituteParticipationsLabel', label: 'Suplentes' },
            { key: 'substituteShareLabel', label: '% suplentes' },
            { key: 'performanceGapLabel', label: 'Diferencia de rendimiento' }
        ]
    },
    empty: 'Sin datos de plantilla para este filtro',
    performanceNoData: 'Sin dato',
    noData: 'Sin comparación',
    singleCompetitionNote: 'Este país solo tiene registros en una competencia'
});

const TEAM_COMPARISON_COPY = Object.freeze({
    title: 'Comparativa de equipos',
    subtitle: 'Cómo compiten los equipos según el contexto',
    empty: 'Sin datos de equipos para este filtro',
    contextLabels: {
        global: 'Vista general de equipos',
        country: function (country) {
            return `Así compiten los equipos de ${country}`;
        },
        competition: function (competition) {
            return `Así compitieron los equipos en ${competition}`;
        },
        countryCompetition: function (country, competition) {
            return `Así compitió ${country} en ${competition}`;
        }
    },
    leaders: [
        { key: 'best_teamwork', label: 'Mayor trabajo en equipo', valueKey: 'best_teamwork_score', tone: 'primary', icon: 'fas fa-users' },
        { key: 'best_victory', label: 'Mejor % de victorias', valueKey: 'best_victory_rate_pct', tone: 'success', icon: 'fas fa-chart-line' },
        { key: 'best_results', label: 'Mejores resultados', valueKey: 'best_results_score', tone: 'warning', icon: 'fas fa-medal' },
        { key: 'best_prize', label: 'Mayor parte del premio total', valueKey: 'best_prize_share_pct', tone: 'secondary', icon: 'fas fa-coins' }
    ],
    profile: {
        title: 'Perfil del equipo',
        summary: 'Solo hay un equipo en este contexto.'
    },
    tableTitles: {
        global: 'Equipos comparados',
        country: function (country) {
            return `Equipos de ${country}`;
        },
        competition: function (competition) {
            return `Equipos en ${competition}`;
        },
        countryCompetition: function (country, competition) {
            return `Equipos de ${country} en ${competition}`;
        }
    },
    tableColumns: {
        global: [
            { key: 'team', label: 'Equipo' },
            { key: 'country', label: 'País' },
            { key: 'competitionsCountLabel', label: 'Competiciones' },
            { key: 'victoryRateLabel', label: '% de victorias' },
            { key: 'teamworkScoreLabel', label: 'Trabajo en equipo' },
            { key: 'positionLabel', label: 'Mejor puesto' },
            { key: 'prizeAmountLabel', label: 'Premios' }
        ],
        country: [
            { key: 'team', label: 'Equipo' },
            { key: 'competitionsCountLabel', label: 'Competiciones' },
            { key: 'victoryRateLabel', label: '% de victorias' },
            { key: 'teamworkScoreLabel', label: 'Trabajo en equipo' },
            { key: 'positionLabel', label: 'Mejor puesto' },
            { key: 'prizeAmountLabel', label: 'Premios' }
        ],
        competition: [
            { key: 'team', label: 'Equipo' },
            { key: 'country', label: 'País' },
            { key: 'victoryRateLabel', label: '% de victorias' },
            { key: 'teamworkScoreLabel', label: 'Trabajo en equipo' },
            { key: 'competitionResultLabel', label: 'Resultado en la competencia' },
            { key: 'prizeAmountLabel', label: 'Premios' }
        ],
        countryCompetition: [
            { key: 'team', label: 'Equipo' },
            { key: 'victoryRateLabel', label: '% de victorias' },
            { key: 'teamworkScoreLabel', label: 'Trabajo en equipo' },
            { key: 'competitionResultLabel', label: 'Resultado en la competencia' },
            { key: 'prizeAmountLabel', label: 'Premios' }
        ]
    },
    noData: 'Sin registro',
    noVictoryData: 'Sin registro de victorias',
    noPositionData: 'Sin puesto final registrado'
});

const TEAM_EXPERIENCE_COPY = Object.freeze({
    title: 'Experiencia del equipo',
    subtitle: 'Cómo se reparte la experiencia y el liderazgo dentro de cada equipo',
    empty: 'Sin datos de experiencia para este filtro',
    contextLabels: {
        global: 'Vista general de la experiencia de los equipos',
        country: function (country) {
            return `Así se reparte la experiencia en los equipos de ${country}`;
        },
        competition: function (competition) {
            return `Así se repartió la experiencia en ${competition}`;
        },
        countryCompetition: function (country, competition) {
            return `Así se repartió la experiencia de ${country} en ${competition}`;
        }
    },
    leaders: [
        { key: 'most_experienced', label: 'Equipo con mayor edad promedio', tone: 'primary', icon: 'fas fa-hourglass-half' },
        { key: 'best_veteran', label: 'Veterano con mejor rendimiento', tone: 'success', icon: 'fas fa-star' },
        { key: 'widest_gap', label: 'Mayor rango de edades', tone: 'warning', icon: 'fas fa-arrows-left-right' },
        { key: 'highest_advantage', label: 'Diferencia del veterano vs equipo', tone: 'secondary', icon: 'fas fa-chart-line' }
    ],
    roleInsightEyebrow: 'Rol del veterano',
    roleInsightTitles: {
        allStarter: 'Todos usan a su veterano como titular',
        allSubstitute: 'Todos usan a su veterano como suplente',
        mostlyStarter: 'Predominio de veteranos titulares',
        mostlySubstitute: 'Predominio de veteranos suplentes',
        mixed: 'Uso mixto del veterano'
    },
    roleLabels: {
        Titular: 'Titular',
        Suplente: 'Suplente',
        Mixto: 'Mixto',
        Unknown: 'Sin rol registrado'
    },
    chartTitle: 'Rango de edades por equipo',
    chartExplanation: 'La barra va del jugador más joven al más experimentado. Pasa el cursor o toca la barra para ver el menor, el promedio y el veterano.',
    profile: {
        title: 'Perfil de experiencia',
        summary: 'Solo hay un equipo en este contexto.'
    },
    tableTitles: {
        global: 'Experiencia comparada de equipos',
        country: function (country) {
            return `Experiencia de equipos de ${country}`;
        },
        competition: function (competition) {
            return `Experiencia en ${competition}`;
        },
        countryCompetition: function (country, competition) {
            return `Experiencia de ${country} en ${competition}`;
        }
    },
    tableColumns: {
        global: [
            { key: 'team', label: 'Equipo' },
            { key: 'country', label: 'País' },
            { key: 'veteranPlayer', label: 'Veterano' },
            { key: 'veteranRoleLabel', label: 'Rol' },
            { key: 'veteranAgeLabel', label: 'Edad del veterano' },
            { key: 'teamAvgAgeLabel', label: 'Edad promedio' },
            { key: 'ageSpanLabel', label: 'Rango de edades' },
            { key: 'veteranPerformanceLabel', label: 'Rendimiento del veterano' },
            { key: 'veteranGapLabel', label: 'Diferencia vs equipo' },
            { key: 'competitionsCountLabel', label: 'Competiciones' }
        ],
        country: [
            { key: 'team', label: 'Equipo' },
            { key: 'veteranPlayer', label: 'Veterano' },
            { key: 'veteranRoleLabel', label: 'Rol' },
            { key: 'veteranAgeLabel', label: 'Edad del veterano' },
            { key: 'teamAvgAgeLabel', label: 'Edad promedio' },
            { key: 'ageSpanLabel', label: 'Rango de edades' },
            { key: 'veteranPerformanceLabel', label: 'Rendimiento del veterano' },
            { key: 'veteranGapLabel', label: 'Diferencia vs equipo' },
            { key: 'competitionsCountLabel', label: 'Competiciones' }
        ],
        competition: [
            { key: 'team', label: 'Equipo' },
            { key: 'country', label: 'País' },
            { key: 'veteranPlayer', label: 'Veterano' },
            { key: 'veteranRoleLabel', label: 'Rol' },
            { key: 'veteranAgeLabel', label: 'Edad del veterano' },
            { key: 'teamAvgAgeLabel', label: 'Edad promedio' },
            { key: 'competitionResultLabel', label: 'Resultado en la competencia' },
            { key: 'veteranPerformanceLabel', label: 'Rendimiento del veterano' },
            { key: 'veteranGapLabel', label: 'Diferencia vs equipo' }
        ],
        countryCompetition: [
            { key: 'team', label: 'Equipo' },
            { key: 'veteranPlayer', label: 'Veterano' },
            { key: 'veteranRoleLabel', label: 'Rol' },
            { key: 'veteranAgeLabel', label: 'Edad del veterano' },
            { key: 'teamAvgAgeLabel', label: 'Edad promedio' },
            { key: 'competitionResultLabel', label: 'Resultado en la competencia' },
            { key: 'veteranPerformanceLabel', label: 'Rendimiento del veterano' },
            { key: 'veteranGapLabel', label: 'Diferencia vs equipo' }
        ]
    },
    noData: 'Sin registro',
    noPerformanceData: 'Sin registro de rendimiento',
    noPositionData: 'Sin puesto final registrado',
    noRoleData: 'Sin rol registrado'
});

const AGE_PERFORMANCE_COPY = Object.freeze({
    title: 'Edad vs rendimiento',
    subtitle: 'C\u00f3mo cambia el rendimiento seg\u00fan la edad en este contexto',
    emptyTitle: 'Sin datos de edad y rendimiento para este filtro',
    emptyHint: 'Solo se muestran jugadores con edad y rendimiento registrados en este contexto.',
    partialTitle: 'Hay jugadores registrados en este contexto, pero no hay rendimiento suficiente para compararlos.',
    insufficientSample: 'Muestra insuficiente',
    insufficientHint: 'Muestra insuficiente para inferir una relaci\u00f3n entre edad y rendimiento.',
    noPlayerMatch: 'El jugador buscado no aparece en este contexto.',
    contextLabels: {
        global: 'Vista general de jugadores por edad y rendimiento',
        country: function (country) {
            return `As\u00ed rinden los jugadores de equipos de ${country}`;
        },
        competition: function (competition) {
            return `As\u00ed rindieron los jugadores en ${competition}`;
        },
        countryCompetition: function (country, competition) {
            return `As\u00ed rindieron los jugadores de ${country} en ${competition}`;
        }
    },
    leaders: [
        { key: 'relationship', label: 'Relaci\u00f3n edad-rendimiento', tone: 'primary', icon: 'fas fa-wave-square' },
        { key: 'best_band', label: 'Mejor tramo de edad', tone: 'success', icon: 'fas fa-layer-group' },
        { key: 'young_standout', label: 'Joven destacado', tone: 'warning', icon: 'fas fa-bolt' },
        { key: 'veteran_standout', label: 'Veterano destacado', tone: 'secondary', icon: 'fas fa-medal' }
    ],
    bandTitle: 'Rendimiento por tramo de edad',
    bandInsightTop: 'Mejor tramo',
    bandInsightAbove: 'Sobre el promedio',
    bandInsightBelow: 'Bajo el promedio',
    bandInsightNoData: 'Sin rendimiento comparable',
    playersAnalyzed: function (count) {
        return `${count} jugadores analizados`;
    },
    comparablePlayers: function (count) {
        return `${count} ${Math.abs(count) === 1 ? 'jugador comparable' : 'jugadores comparables'}`;
    },
    playersInContext: function (count) {
        return `${count} ${Math.abs(count) === 1 ? 'jugador en el contexto' : 'jugadores en el contexto'}`;
    },
    partialHint: function (rawCount, validCount) {
        return `Se encontraron ${rawCount} ${Math.abs(rawCount) === 1 ? 'jugador con edad registrada' : 'jugadores con edad registrada'} y ${validCount} con rendimiento comparable.`;
    },
    limitedDescription: 'No hay suficiente muestra para inferir una relaci\u00f3n entre edad y rendimiento.',
    omissionNote: function (hiddenLeaders, hiddenBands) {
        const leadersCount = safeNumericValue(hiddenLeaders);
        const bandsCount = safeNumericValue(hiddenBands);
        if (leadersCount > 0 && bandsCount > 0) {
            return `Se omitieron ${leadersCount} ${leadersCount === 1 ? 'destacado' : 'destacados'} y ${bandsCount} ${bandsCount === 1 ? 'tramo' : 'tramos'} sin rendimiento comparable.`;
        }
        if (leadersCount > 0) {
            return `Se omit${leadersCount === 1 ? 'i\u00f3' : 'ieron'} ${leadersCount} ${leadersCount === 1 ? 'destacado' : 'destacados'} sin rendimiento comparable.`;
        }
        if (bandsCount > 0) {
            return `Se omit${bandsCount === 1 ? 'i\u00f3' : 'ieron'} ${bandsCount} ${bandsCount === 1 ? 'tramo' : 'tramos'} sin rendimiento comparable.`;
        }
        return '';
    },
    relationship: {
        none: 'Sin relaci\u00f3n clara',
        weak_positive: 'Relaci\u00f3n d\u00e9bil positiva',
        weak_negative: 'Relaci\u00f3n d\u00e9bil negativa',
        moderate_positive: 'Relaci\u00f3n moderada positiva',
        moderate_negative: 'Relaci\u00f3n moderada negativa',
        strong_positive: 'Relaci\u00f3n fuerte positiva',
        strong_negative: 'Relaci\u00f3n fuerte negativa'
    },
    relationshipDescriptions: {
        none: 'La edad no marca una diferencia clara en este contexto.',
        positive: 'El rendimiento tiende a subir con la edad en este contexto.',
        negative: 'El rendimiento tiende a bajar con la edad en este contexto.'
    },
    ageBands: ['20-21', '22-23', '24+'],
    noData: 'Sin registro',
    noPerformanceData: 'Sin registro de rendimiento'
});

const ML_PROJECTION_COPY = Object.freeze({
    title: 'Proyección 2026',
    subtitle: 'Cómo se perfila el rendimiento anual proyectado de cada jugador',
    emptyTitle: 'No hay proyecciones disponibles para este contexto.',
    emptyHint: 'La proyección anual solo muestra jugadores con base estadística suficiente para el modelo.',
    noSearchMatch: 'El jugador buscado no aparece en esta proyección anual.',
    competitionNote: 'La proyección 2026 es anual y no se segmenta por competencia.',
    contextLabels: {
        global: 'Vista general de la proyección anual de los jugadores',
        country: function (country) {
            return `Así proyectan los jugadores de equipos de ${country} en 2026`;
        }
    },
    insights: [
        { key: 'best_projected', label: 'Mejor proyección 2026', tone: 'primary', icon: 'fas fa-rocket' },
        { key: 'biggest_improvement', label: 'Mayor subida esperada', tone: 'success', icon: 'fas fa-arrow-trend-up' },
        { key: 'biggest_decline', label: 'Mayor baja vs actual', tone: 'warning', icon: 'fas fa-arrow-trend-down' },
        { key: 'best_team', label: 'Equipo con mejor promedio proyectado', tone: 'secondary', icon: 'fas fa-users' }
    ],
    aggregateTitleGlobal: 'Qué equipos y países proyectan mejor',
    aggregateTitleCountry: function (country) {
        return `Cómo proyecta ${country}`;
    },
    aggregateCountryDescription: 'Es el país con mejor promedio proyectado.',
    aggregateTeamDescription: 'Top de equipos por promedio proyectado.',
    featureTitle: 'Qué pesa más en el modelo global',
    watchTitle: 'Top proyección 2026',
    riskTitle: 'Riesgo de caída',
    tableTitle: 'Detalle de proyección anual',
    searchMatch: function (count) {
        return `${count} ${count === 1 ? 'coincidencia resaltada' : 'coincidencias resaltadas'} en este contexto.`;
    }
});

// Helper for proper casing names
function toProperCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function cloneList(value) {
    return Array.isArray(value) ? value.slice() : [];
}

function escapeCompetitionSectionText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildCountryColorMap(rows) {
    const colorMap = {};
    (Array.isArray(rows) ? rows : []).forEach((row, index) => {
        if (!row?.country || colorMap[row.country]) return;
        colorMap[row.country] = {
            backgroundColor: COUNTRY_CHART_BG_COLORS[index % COUNTRY_CHART_BG_COLORS.length],
            borderColor: COUNTRY_CHART_BORDER_COLORS[index % COUNTRY_CHART_BORDER_COLORS.length]
        };
    });
    return colorMap;
}

const chartEmptyStatePlugin = {
    id: 'chartEmptyState',
    afterDraw(chart) {
        const labels = chart.data && Array.isArray(chart.data.labels) ? chart.data.labels : [];
        const datasets = chart.data && Array.isArray(chart.data.datasets) ? chart.data.datasets : [];
        const hasData = labels.length > 0 && datasets.some(ds => Array.isArray(ds.data) && ds.data.length > 0);
        if (hasData) return;

        const message = chart.options?.plugins?.emptyState?.message || 'Sin datos para este filtro';
        const hint = chart.options?.plugins?.emptyState?.hint || '';
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px Inter';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(message, width / 2, height / 2 - (hint ? 10 : 0));
        if (hint) {
            ctx.font = '12px Inter';
            ctx.fillStyle = '#64748b';
            ctx.fillText(hint, width / 2, height / 2 + 12);
        }
        ctx.restore();
    }
};

const zeroPrizeAnnotationPlugin = {
    id: 'zeroPrizeAnnotation',
    afterDatasetsDraw(chart) {
        if (chart.config.type !== 'bar') return;
        if (!chart.options?.plugins?.zeroPrizeAnnotation?.enabled) return;

        const dataset = chart.data?.datasets?.[0];
        const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
        const meta = chart.getDatasetMeta(0);
        const xScale = chart.scales?.x;

        if (!meta?.data?.length || !xScale) return;

        const ctx = chart.ctx;
        const zeroX = xScale.getPixelForValue(0);

        ctx.save();
        ctx.font = '600 11px Inter';
        ctx.textBaseline = 'middle';

        rows.forEach((row, index) => {
            if (Number(row?.total_prizes || 0) !== 0) return;

            const bar = meta.data[index];
            if (!bar) return;

            const backgroundColor = Array.isArray(dataset.backgroundColor)
                ? dataset.backgroundColor[index]
                : dataset.backgroundColor;
            const y = bar.y;

            ctx.fillStyle = backgroundColor || '#f59e0b';
            ctx.fillRect(zeroX + 4, y - 3, 8, 6);

            ctx.fillStyle = '#f8fafc';
            ctx.fillText('Sin premio', zeroX + 18, y);
        });

        ctx.restore();
    }
};

const playerModuleConnectorPlugin = {
    id: 'playerModuleConnector',
    afterDatasetsDraw(chart) {
        if (chart.config.type !== 'scatter') return;

        const config = chart.options?.plugins?.playerModule || {};
        const mode = config.mode;
        const rows = Array.isArray(config.rows) ? config.rows : [];
        if (!rows.length) return;

        const ctx = chart.ctx;
        const xScale = chart.scales?.x;
        if (!xScale) return;

        ctx.save();

        if (mode === 'evolution') {
            const previousMeta = chart.getDatasetMeta(0);
            const currentMeta = chart.getDatasetMeta(1);
            if (!previousMeta?.data?.length || !currentMeta?.data?.length) {
                ctx.restore();
                return;
            }

            ctx.lineWidth = 3;
            rows.forEach(function (row, index) {
                const start = previousMeta.data[index];
                const end = currentMeta.data[index];
                if (!start || !end) return;
                ctx.strokeStyle = Number(row.improvement_pct || 0) >= 0
                    ? 'rgba(0, 212, 255, 0.45)'
                    : 'rgba(239, 68, 68, 0.45)';
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            });
        } else if (mode === 'single-year') {
            const dataset = chart.data?.datasets?.[0];
            const meta = chart.getDatasetMeta(0);
            if (!dataset || !meta?.data?.length) {
                ctx.restore();
                return;
            }

            const zeroX = xScale.getPixelForValue(0);
            ctx.lineWidth = 4;
            rows.forEach(function (row, index) {
                const point = meta.data[index];
                if (!point) return;
                const strokeColor = Array.isArray(dataset.pointBackgroundColor)
                    ? dataset.pointBackgroundColor[index]
                    : dataset.pointBackgroundColor;
                ctx.strokeStyle = strokeColor || 'rgba(0, 212, 255, 0.85)';
                ctx.beginPath();
                ctx.moveTo(zeroX, point.y);
                ctx.lineTo(point.x, point.y);
                ctx.stroke();
            });
        }

        ctx.restore();
    }
};

if (typeof Chart !== 'undefined' && Chart.register) {
    Chart.register(chartEmptyStatePlugin);
    Chart.register(zeroPrizeAnnotationPlugin);
    Chart.register(playerModuleConnectorPlugin);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

async function initializeApp() {
    try {
        // Show loading screen
        showLoadingScreen();

        // Load data
        await loadDashboardData();

        // Initialize dashboard
        await initializeDashboard();

        // Hide loading screen
        hideLoadingScreen();

    } catch (error) {
        console.error('Error initializing app:', error);
        hideLoadingScreen();
    }
}

function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.style.display = 'flex';
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const dashboard = document.getElementById('main-content');

    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            if (dashboard) dashboard.classList.add('loaded');
        }, 500);
    }, 2000);
}

// ===== DATA LOADING =====
async function loadDashboardData() {
    try {
        const response = await fetch('./assets/data/datos-dashboard.json?v=' + new Date().getTime());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        dashboardData = await response.json();
        if (!dashboardData.filter_ready && getEmptyData) {
            dashboardData.filter_ready = getEmptyData().filter_ready;
        }
        if (!dashboardData.predictions_2026) {
            dashboardData.predictions_2026 = [];
        }
        if (!dashboardData.ml_projection_2026_summary) {
            dashboardData.ml_projection_2026_summary = {};
        }
        if (!dashboardData.ml_projection_2026_players) {
            dashboardData.ml_projection_2026_players = [];
        }
        if (!dashboardData.ml_projection_2026_team_summary) {
            dashboardData.ml_projection_2026_team_summary = [];
        }
        if (!dashboardData.ml_projection_2026_country_summary) {
            dashboardData.ml_projection_2026_country_summary = [];
        }
        if (!dashboardData.ml_projection_2026_feature_importance) {
            dashboardData.ml_projection_2026_feature_importance = [];
        }
        if (!dashboardData.filter_ready.ml_projection_2026_summary_by_country) {
            dashboardData.filter_ready.ml_projection_2026_summary_by_country = [];
        }
        if (!dashboardData.filter_ready.ml_projection_2026_players_by_country) {
            dashboardData.filter_ready.ml_projection_2026_players_by_country = [];
        }
        if (!dashboardData.filter_ready.ml_projection_2026_team_summary_by_country) {
            dashboardData.filter_ready.ml_projection_2026_team_summary_by_country = [];
        }
        if (!dashboardData.filter_ready.ml_projection_2026_country_summary_by_country) {
            dashboardData.filter_ready.ml_projection_2026_country_summary_by_country = [];
        }
        currentData = dashboardData;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Fallback to empty data if fetch fails
        dashboardData = getEmptyData ? getEmptyData() : { main_kpis: {}, country_ranking: [] };
        currentData = dashboardData;
        showNoDataBanner();
    }
}

function showNoDataBanner() {
    const container = document.getElementById('main-content');
    if (!container || document.getElementById('no-data-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'no-data-banner';
    banner.className = 'alert alert-warning text-center m-3';
    banner.textContent = 'Sin datos: no se pudo cargar datos desde el JSON.';
    container.prepend(banner);
}

// ===== DASHBOARD INITIALIZATION =====
async function initializeDashboard() {
    // 1. Setup static components and filters
    initNavigation();

    // 2. Trigger the dynamic engine (KPIs, Charts, Tables, Titles)
    // This will use currentData (which is dashboardData initially)
    applyFilters({ reason: initialApplyReason });
    initialApplyReason = 'filters-change';

    // 3. Add animation classes
    addAnimations();
}

function buildFilterIndex(data) {
    const filterReady = data?.filter_ready || {};
    const pairs = filterReady.kpis_by_country_competition || [];
    const countries = new Set();
    const competitions = new Set();
    const competitionsByCountry = new Map();
    const countriesByCompetition = new Map();

    pairs.forEach(row => {
        if (!row) return;
        const country = row.country;
        const competition = row.competition_name;
        if (country) countries.add(country);
        if (competition) competitions.add(competition);
        if (country && competition) {
            if (!competitionsByCountry.has(country)) competitionsByCountry.set(country, new Set());
            competitionsByCountry.get(country).add(competition);
            if (!countriesByCompetition.has(competition)) countriesByCompetition.set(competition, new Set());
            countriesByCompetition.get(competition).add(country);
        }
    });

    if (countries.size === 0 && Array.isArray(data?.country_ranking)) {
        data.country_ranking.forEach(row => row?.country && countries.add(row.country));
    }
    if (competitions.size === 0 && Array.isArray(data?.competitions)) {
        data.competitions.forEach(row => row?.name && competitions.add(row.name));
    }

    return { countries, competitions, competitionsByCountry, countriesByCompetition };
}

function setSelectOptions(select, options, selectedValue, placeholder, formatLabel) {
    if (!select) return;
    const values = Array.from(options || []);
    values.sort();
    if (selectedValue && !values.includes(selectedValue)) {
        values.unshift(selectedValue);
    }
    select.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach(value => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = formatLabel ? formatLabel(value) : value;
        select.appendChild(opt);
    });
    if (selectedValue) select.value = selectedValue;
}

function refreshFilterOptions(country, competition) {
    if (!filterIndex) return;
    const countrySelect = document.getElementById('filter-country');
    const compSelect = document.getElementById('filter-competition');
    const countries = competition
        ? (filterIndex.countriesByCompetition.get(competition) || filterIndex.countries)
        : filterIndex.countries;
    const competitions = country
        ? (filterIndex.competitionsByCountry.get(country) || filterIndex.competitions)
        : filterIndex.competitions;

    setSelectOptions(
        countrySelect,
        countries,
        country,
        'Todos los países',
        value => `${countryFlags[value] || ''} ${value}`.trim()
    );
    setSelectOptions(compSelect, competitions, competition, 'Todas las competencias');
}

function updateFilterSummary(filters, data) {
    const summary = document.getElementById('filter-summary');
    if (!summary) return;
    const parts = [];
    if (filters.country) parts.push(`País: ${filters.country}`);
    if (filters.competition) parts.push(`Competencia: ${filters.competition}`);
    if (filters.search) parts.push(`Jugador: ${filters.search}`);

    const kpis = data?.main_kpis || {};
    const teams = Number(kpis.total_teams || 0).toLocaleString('es-ES');
    const players = Number(kpis.total_players || 0).toLocaleString('es-ES');
    const results = `Resultados: ${teams} equipos · ${players} jugadores`;
    summary.textContent = parts.length ? results : `Sin filtros activos · ${results}`;
    summary.title = parts.length ? parts.join(' | ') : 'Sin filtros activos';
    summary.classList.toggle('is-active', parts.length > 0);
}

function updateClearButtonState(filters) {
    const clearBtn = document.getElementById('clear-filters');
    if (!clearBtn) return;
    const hasFilters = Boolean(filters.country || filters.competition || filters.search);
    clearBtn.disabled = !hasFilters;
    clearBtn.classList.toggle('disabled', !hasFilters);
}

function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => fn.apply(this, args), wait);
    };
}

const COMPACT_FILTER_BREAKPOINT = 1024;
let filterSearchPanelOpen = false;

function isCompactFilterViewport() {
    return typeof window !== 'undefined' && window.innerWidth <= COMPACT_FILTER_BREAKPOINT;
}

function updateCompactFilterMetrics() {
    const root = document.documentElement;
    const filterBar = document.getElementById('filter-bar');

    if (!root || !filterBar) return;

    if (!isCompactFilterViewport()) {
        root.style.removeProperty('--compact-filter-bar-height');
        return;
    }

    const applyHeight = function () {
        const nextHeight = Math.ceil(filterBar.getBoundingClientRect().height || filterBar.offsetHeight || 0);
        if (nextHeight > 0) {
            root.style.setProperty('--compact-filter-bar-height', `${nextHeight}px`);
        }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(applyHeight);
        return;
    }

    applyHeight();
}

function setFilterSearchPanelOpen(shouldOpen, options = {}) {
    const filterBar = document.getElementById('filter-bar');
    const searchPanel = document.getElementById('filter-search-panel');
    const toggle = document.getElementById('toggle-search-panel');
    const suggestionsBox = document.getElementById('search-suggestions');

    if (!filterBar || !searchPanel || !toggle) return;

    const compactMode = isCompactFilterViewport();
    const forced = options.force === true;

    if (!compactMode) {
        filterBar.classList.remove('filter-bar--search-open');
        searchPanel.hidden = false;
        searchPanel.setAttribute('aria-hidden', 'false');
        toggle.hidden = true;
        toggle.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'true');
        updateCompactFilterMetrics();
        return;
    }

    const nextOpen = forced ? Boolean(shouldOpen) : Boolean(shouldOpen);
    filterSearchPanelOpen = nextOpen;
    filterBar.classList.toggle('filter-bar--search-open', nextOpen);
    searchPanel.hidden = !nextOpen;
    searchPanel.setAttribute('aria-hidden', String(!nextOpen));
    toggle.hidden = false;
    toggle.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', String(nextOpen));
    toggle.classList.toggle('active', nextOpen);

    if (!nextOpen && suggestionsBox) {
        suggestionsBox.classList.add('d-none');
    }

    updateCompactFilterMetrics();
}

function syncResponsiveFilterBar(options = {}) {
    const searchInput = document.getElementById('search-player');
    const hasSearchValue = Boolean((searchInput?.value || '').trim());
    const forcedState = Object.prototype.hasOwnProperty.call(options, 'open')
        ? Boolean(options.open)
        : (hasSearchValue || filterSearchPanelOpen);
    setFilterSearchPanelOpen(forcedState, { force: true });
}

function initResponsiveFilterBar() {
    const toggle = document.getElementById('toggle-search-panel');
    const searchInput = document.getElementById('search-player');

    if (toggle && !toggle.dataset.bound) {
        toggle.addEventListener('click', function () {
            const nextOpen = !(toggle.getAttribute('aria-expanded') === 'true');
            setFilterSearchPanelOpen(nextOpen, { force: true });
            if (nextOpen && searchInput) {
                window.setTimeout(function () {
                    searchInput.focus();
                }, 20);
            }
        });
        toggle.dataset.bound = 'true';
    }

    syncResponsiveFilterBar();
}

function getStickyChromeOffset() {
    let offset = 0;
    const navbar = document.getElementById('main-navbar');
    const filterBar = document.getElementById('filter-bar');
    const resolveComputedStyle = function (element) {
        if (!element) return null;
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            return window.getComputedStyle(element);
        }
        if (typeof getComputedStyle === 'function') {
            return getComputedStyle(element);
        }
        return { position: 'fixed' };
    };

    if (navbar) {
        const style = resolveComputedStyle(navbar);
        if (style.position === 'fixed' || style.position === 'sticky') {
            offset += navbar.getBoundingClientRect().height || 0;
        }
    }

    if (filterBar) {
        const style = resolveComputedStyle(filterBar);
        if (style.position === 'fixed' || style.position === 'sticky') {
            offset += filterBar.getBoundingClientRect().height || 0;
        }
    }

    return offset;
}

// ===== NAVIGATION, FILTERS & SEARCH =====
function initNavigation() {
    // --- Hamburger toggle ---
    const toggle = document.getElementById('navbar-toggle');
    const links = document.getElementById('navbar-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            links.classList.toggle('open');
            const icon = toggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
        // Close menu when a link is clicked (mobile)
        links.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                links.classList.remove('open');
                const icon = toggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        });
    }

    // --- Navbar scroll effect ---
    const navbar = document.getElementById('main-navbar');
    window.addEventListener('scroll', () => {
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }
    }, { passive: true });

    // --- Scrollspy ---
    const sections = document.querySelectorAll('section[id], header[id]');
    const navLinks = document.querySelectorAll('.navbar-links .nav-link');

    if (sections.length > 0 && navLinks.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navLinks.forEach(l => l.classList.remove('active'));
                    const active = document.querySelector(`.nav-link[data-section="${entry.target.id}"]`);
                    if (active) active.classList.add('active');
                }
            });
        }, { rootMargin: '-20% 0px -70% 0px' });

        sections.forEach(sec => observer.observe(sec));
    }

    // --- Populate filter dropdowns ---
    if (!filterIndex) filterIndex = buildFilterIndex(dashboardData || currentData);
    populateFilters();

    // --- Filter elements ---
    const countryFilter = document.getElementById('filter-country');
    const competitionFilter = document.getElementById('filter-competition');
    const searchInput = document.getElementById('search-player');
    const clearBtn = document.getElementById('clear-filters');

    // --- Read Deep Links ---
    const params = new URLSearchParams(window.location.search);
    if (params.get('country') && countryFilter) countryFilter.value = params.get('country');
    if (params.get('competition') && competitionFilter) competitionFilter.value = params.get('competition');
    if (params.get('search') && searchInput) searchInput.value = params.get('search');
    initialApplyReason = params.get('search') ? 'deep-link' : 'filters-change';

    initResponsiveFilterBar();
    initSmartSearch();

    if (!debouncedApplyFilters) {
        debouncedApplyFilters = debounce(function () {
            applyFilters({ reason: 'search-input' });
        }, 180);
    }
    if (countryFilter) {
        countryFilter.addEventListener('change', function () {
            applyFilters({ reason: 'filters-change' });
        });
    }
    if (competitionFilter) {
        competitionFilter.addEventListener('change', function () {
            applyFilters({ reason: 'filters-change' });
        });
    }
    if (searchInput) searchInput.addEventListener('input', debouncedApplyFilters);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);
}

function populateFilters() {
    if (!currentData) return;
    if (!filterIndex) filterIndex = buildFilterIndex(dashboardData || currentData);
    const currentCountry = document.getElementById('filter-country')?.value || '';
    const currentCompetition = document.getElementById('filter-competition')?.value || '';
    refreshFilterOptions(currentCountry, currentCompetition);
}

function initSmartSearch() {
    const searchInput = document.getElementById('search-player');
    const suggestionsBox = document.getElementById('search-suggestions');
    if (!searchInput || !suggestionsBox || !dashboardData || !normalizeText) return;

    let currentSuggestions = [];
    let activeSuggestionIndex = -1;
    let pointerSelectionInProgress = false;
    let lastSelectionAt = 0;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hideSuggestions() {
        activeSuggestionIndex = -1;
        suggestionsBox.classList.add('d-none');
    }

    function selectSuggestionByIndex(index) {
        const suggestion = currentSuggestions[index];
        if (!suggestion) return;
        lastSelectionAt = Date.now();
        searchInput.value = suggestion.name;
        hideSuggestions();
        applyFilters({ reason: 'search-select' });
    }

    function syncActiveSuggestion() {
        suggestionsBox.querySelectorAll('.search-suggestion-item').forEach(function (item, index) {
            item.classList.toggle('active', index === activeSuggestionIndex);
        });
    }

    function shouldOpenSuggestions(value) {
        return Boolean(String(value ?? '').trim());
    }

    function renderSuggestionView() {
        const suggestionView = buildPlayerModuleSuggestionView({
            country: document.getElementById('filter-country')?.value || '',
            competition: document.getElementById('filter-competition')?.value || '',
            search: searchInput.value
        });
        currentSuggestions = suggestionView.items || [];

        if (suggestionView.variant === 'empty') {
            activeSuggestionIndex = -1;
            suggestionsBox.innerHTML = `
                <div class="suggestion-header">${suggestionView.header}</div>
                <div class="search-suggestion-empty">${suggestionView.message}</div>
            `;
            return;
        }

        const headerIcon = suggestionView.variant === 'context'
            ? '<i class="fas fa-fire text-warning"></i> '
            : '';
        suggestionsBox.innerHTML = `
            <div class="suggestion-header">${headerIcon}${suggestionView.header}</div>
            ${currentSuggestions.map(function (suggestion, index) {
                return `
                    <div class="search-suggestion-item" data-index="${index}" data-name="${escapeHtml(suggestion.name)}">
                        <div class="search-suggestion-flag">${countryFlag(suggestion.nationality || '')}</div>
                        <div class="search-suggestion-copy">
                            <span class="search-suggestion-name">${escapeHtml(suggestion.displayName || suggestion.name)}</span>
                            <span class="search-suggestion-meta">${escapeHtml(suggestion.meta)}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
        activeSuggestionIndex = -1;

        const pointerSelectionEvent = typeof window !== 'undefined' && 'PointerEvent' in window
            ? 'pointerdown'
            : 'mousedown';

        suggestionsBox.querySelectorAll('.search-suggestion-item').forEach(function (item) {
            item.addEventListener('mouseenter', function () {
                activeSuggestionIndex = Number(item.dataset.index);
                syncActiveSuggestion();
            });
            item.addEventListener(pointerSelectionEvent, function (event) {
                event.preventDefault();
                pointerSelectionInProgress = true;
                selectSuggestionByIndex(Number(item.dataset.index));
                window.setTimeout(function () {
                    pointerSelectionInProgress = false;
                }, 180);
            });
            item.addEventListener('click', function () {
                if (Date.now() - lastSelectionAt < 250) {
                    return;
                }
                selectSuggestionByIndex(Number(item.dataset.index));
            });
        });
    }

    searchInput.addEventListener('focus', () => {
        syncResponsiveFilterBar({ open: true });
        if (!shouldOpenSuggestions(searchInput.value)) {
            hideSuggestions();
            return;
        }
        suggestionsBox.classList.remove('d-none');
        renderSuggestionView();
    });

    searchInput.addEventListener('input', (e) => {
        if (!shouldOpenSuggestions(e.target.value)) {
            hideSuggestions();
            return;
        }
        suggestionsBox.classList.remove('d-none');
        renderSuggestionView();
    });

    searchInput.addEventListener('blur', () => {
        window.setTimeout(function () {
            if (!pointerSelectionInProgress) {
                hideSuggestions();
            }
        }, 120);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            if (!currentSuggestions.length) return;
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1 + currentSuggestions.length) % currentSuggestions.length;
            syncActiveSuggestion();
            return;
        }

        if (e.key === 'ArrowUp') {
            if (!currentSuggestions.length) return;
            e.preventDefault();
            activeSuggestionIndex = activeSuggestionIndex <= 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1;
            syncActiveSuggestion();
            return;
        }

        if (e.key === 'Escape') {
            hideSuggestions();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
                selectSuggestionByIndex(activeSuggestionIndex);
                return;
            }
            hideSuggestions();
            const exactPlayerName = resolveExactPlayerName(searchInput.value, dashboardData);
            applyFilters({ reason: exactPlayerName ? 'search-enter' : 'search-input' });
            searchInput.blur();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            hideSuggestions();
        }
    });
}

function shouldAutoScrollToPlayerModule(options = {}) {
    const allowedReasons = new Set(['search-select', 'search-enter', 'deep-link']);
    const reason = options.reason || '';
    const playerView = options.playerView || null;
    return allowedReasons.has(reason) && Boolean(playerView?.selectedPlayer);
}

function scrollToPlayerModule() {
    const target = document.querySelector('.player-module-card');
    if (!target || typeof window === 'undefined') return;

    const currentOffset = window.pageYOffset || window.scrollY || 0;
    const targetTop = target.getBoundingClientRect().top + currentOffset;
    const top = Math.max(targetTop - getStickyChromeOffset() - 12, 0);

    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: top, behavior: 'smooth' });
        return;
    }

    if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function schedulePlayerModuleScroll() {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function () {
            setTimeout(scrollToPlayerModule, 0);
        });
        return;
    }

    setTimeout(scrollToPlayerModule, 0);
}

function applyFilters(options = {}) {
    const reason = options.reason || 'filters-change';
    const country = document.getElementById('filter-country')?.value || '';
    const competition = document.getElementById('filter-competition')?.value || '';
    const search = (document.getElementById('search-player')?.value || '').trim();
    document.getElementById('search-suggestions')?.classList.add('d-none');

    const filtered = buildFilteredData ? buildFilteredData(dashboardData, { country, competition, search }) : dashboardData;
    refreshFilterOptions(country, competition);

    // -- DYNAMIC TITLES --
    const countryTitleEl = document.getElementById('countryChartTitle');
    const prizesTitleEl = document.getElementById('prizesChartTitle');

    if (country && competition) {
        if (countryTitleEl) countryTitleEl.textContent = `Equipos de ${country} en ${competition}`;
        if (prizesTitleEl) prizesTitleEl.textContent = `Premios de ${country} en ${competition}`;
    } else if (country) {
        if (countryTitleEl) countryTitleEl.textContent = `Equipos en ${country}`;
        if (prizesTitleEl) prizesTitleEl.textContent = `Impacto de ${country} a Nivel Global`;
    } else if (competition) {
        if (countryTitleEl) countryTitleEl.textContent = `Equipos por País en ${competition}`;
        if (prizesTitleEl) prizesTitleEl.textContent = `Ranking de Premios en ${competition}`;
    } else {
        if (countryTitleEl) countryTitleEl.textContent = 'Distribución de equipos por país';
        if (prizesTitleEl) prizesTitleEl.textContent = 'Ranking de Premios';
    }

    currentData = filtered;
    currentPlayerModuleView = buildPlayerModuleViewModel({ country, competition, search });
    renderPlayerModuleTitle(currentPlayerModuleView);

    renderKPIs(currentData);
    populateTables();
    populateCompetitions();
    populateInsights({ country, competition, search });
    populateSquadUsageSection({ country, competition, search });
    populateTeamComparisonSection({ country, competition, search });
    populateTeamExperienceSection({ country, competition, search });
    populateAgePerformanceSection({ country, competition, search });
    populateMLProjectionSection({ country, competition, search });
    updateFilterSummary({ country, competition, search }, currentData);
    updateClearButtonState({ country, competition, search });
    refreshCharts();

    const params = new URLSearchParams();
    if (country) params.set('country', country);
    if (competition) params.set('competition', competition);
    if (search) params.set('search', search);

    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({ path: newUrl }, '', newUrl);

    if (shouldAutoScrollToPlayerModule({ reason: reason, playerView: currentPlayerModuleView })) {
        schedulePlayerModuleScroll();
    }
}

function highlightSearch(tableSelector, query, colIndex) {
    const tbody = document.querySelector(`${tableSelector} tbody`);
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(row => {
        const cell = row.cells[colIndex];
        if (!cell) return;
        const text = cell.textContent.toLowerCase();
        const match = text.includes(query);
        row.classList.toggle('search-highlight', match);
        // Hide non-matching rows when searching
        if (query && !row.classList.contains('filter-hidden')) {
            row.style.opacity = match ? '1' : '0.3';
        }
    });
}

function clearHighlights() {
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    document.querySelectorAll('.table tbody tr').forEach(row => row.style.opacity = '');
}

function clearFilters() {
    const countryFilter = document.getElementById('filter-country');
    const competitionFilter = document.getElementById('filter-competition');
    const searchInput = document.getElementById('search-player');

    if (countryFilter) countryFilter.value = '';
    if (competitionFilter) competitionFilter.value = '';
    if (searchInput) searchInput.value = '';
    filterSearchPanelOpen = false;
    syncResponsiveFilterBar({ open: false });

    // Delegate the entire resetting of KPIs, Charts, Titles, and Tables to the central engine
    applyFilters({ reason: 'clear' });
}

// ===== KPI CARDS =====
function renderKPIs(data) {
    const kpiContainer = document.getElementById('kpi-cards');
    kpiContainer.innerHTML = '';

    // Update Hero KPIs via datasets for animation
    const heroTeams = document.getElementById('hero-teams');
    const heroCountries = document.getElementById('hero-countries');
    const heroPrizes = document.getElementById('hero-prizes');

    if (heroTeams) heroTeams.dataset.counterTarget = data.main_kpis.total_teams || 0;
    if (heroCountries) heroCountries.dataset.counterTarget = data.main_kpis.countries_represented || 0;
    if (heroPrizes) heroPrizes.dataset.counterTarget = data.main_kpis.total_prizes || 0;

    const kpis = data.main_kpis;

    const kpiConfigs = [
        {
            key: 'total_teams',
            label: 'Equipos Totales',
            icon: 'fas fa-users',
            color: 'cyan',
            value: kpis.total_teams,
            rawValue: kpis.total_teams
        },
        {
            key: 'total_players',
            label: 'Jugadores Activos',
            icon: 'fas fa-user-friends',
            color: 'purple',
            value: kpis.total_players,
            rawValue: kpis.total_players
        },
        {
            key: 'total_prizes',
            label: 'Premios Totales',
            icon: 'fas fa-trophy',
            color: 'gold',
            value: `$${(kpis.total_prizes / 1000).toFixed(0)}K`,
            rawValue: (kpis.total_prizes / 1000).toFixed(0),
            prefix: '$',
            suffix: 'K'
        },
        {
            key: 'countries_represented',
            label: 'Países',
            icon: 'fas fa-globe-americas',
            color: 'green',
            value: kpis.countries_represented,
            rawValue: kpis.countries_represented
        },
        {
            key: 'active_competitions',
            label: 'Competencias',
            icon: 'fas fa-medal',
            color: 'cyan',
            value: kpis.active_competitions,
            rawValue: kpis.active_competitions
        },
        {
            key: 'average_age',
            label: 'Edad Promedio',
            icon: 'fas fa-birthday-cake',
            color: 'purple',
            value: `${kpis.average_age}`,
            rawValue: kpis.average_age,
            suffix: ''
        },
        {
            key: 'international_competitions',
            label: 'Internacionales',
            icon: 'fas fa-globe',
            color: 'gold',
            value: kpis.international_competitions,
            rawValue: kpis.international_competitions
        },
        {
            key: 'national_competitions',
            label: 'Nacionales',
            icon: 'fas fa-flag',
            color: 'green',
            value: kpis.national_competitions,
            rawValue: kpis.national_competitions
        }
    ];

    kpiContainer.innerHTML = kpiConfigs.map(kpi => `
        <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="kpi-card ${kpi.color} fade-in-up" role="status" aria-label="${kpi.label}: ${kpi.value}">
                <i class="${kpi.icon} kpi-icon" aria-hidden="true"></i>
                <span class="kpi-number" data-counter-target="${kpi.rawValue ?? ''}" data-counter-prefix="${kpi.prefix ?? ''}" data-counter-suffix="${kpi.suffix ?? ''}">${kpi.value}</span>
                <span class="kpi-label">${kpi.label}</span>
            </div>
        </div>
    `).join('');

    // Trigger counter animations
    animateCounters();
}

// ===== COUNTER ANIMATIONS =====
function animateCounters() {
    const counters = document.querySelectorAll('[data-counter-target]');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    counters.forEach(el => {
        const target = parseFloat(el.dataset.counterTarget);
        if (isNaN(target) || target === 0) return; // skip formatted values

        const prefix = el.dataset.counterPrefix || '';
        const suffix = el.dataset.counterSuffix || '';
        const isDecimal = String(target).includes('.');
        const duration = 1500; // ms

        if (prefersReducedMotion) {
            el.textContent = prefix + (isDecimal ? target.toFixed(1) : target) + suffix;
            return;
        }

        let start = null;
        el.textContent = prefix + '0' + suffix;

        function step(timestamp) {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * target;

            let displayVal = isDecimal ? current.toFixed(1) : Math.floor(current);
            if (el.dataset.counterFormat === 'currency' || el.dataset.counterFormat === 'number') {
                displayVal = Number(displayVal).toLocaleString('es-ES');
            }

            el.innerHTML = prefix + displayVal + suffix;
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}

// ===== CHARTS =====
function refreshCharts() {
    updateCountryChart();
    updatePrizesChart();
    updateEvolutionChart();
    updateSquadUsageChart();
}

function initializeCharts() {
    refreshCharts();
}

function buildCountryChartData(selectedCountry) {
    let labels = [];
    let data = [];
    let bgColors = [];
    let borderColors = [];
    const countries = Array.isArray(currentData?.country_ranking) ? currentData.country_ranking : [];
    const colorMap = buildCountryColorMap(countries);

    if (selectedCountry) {
        const countryRow = countries.find(c => c.country === selectedCountry);
        if (countryRow) {
            const colors = colorMap[selectedCountry] || {
                backgroundColor: COUNTRY_CHART_BG_COLORS[0],
                borderColor: COUNTRY_CHART_BORDER_COLORS[0]
            };
            labels = [`${countryFlags[selectedCountry] || ''} ${selectedCountry}`.trim()];
            data = [countryRow.total_teams || 0];
            bgColors = [colors.backgroundColor];
            borderColors = [colors.borderColor];
        }
    } else {
        labels = countries.map(c => `${countryFlags[c.country] || ''} ${c.country}`.trim());
        data = countries.map(c => c.total_teams);
        bgColors = countries.map(countryRow => colorMap[countryRow.country]?.backgroundColor || COUNTRY_CHART_BG_COLORS[0]);
        borderColors = countries.map(countryRow => colorMap[countryRow.country]?.borderColor || COUNTRY_CHART_BORDER_COLORS[0]);
    }

    return { labels, data, bgColors, borderColors };
}

function buildCountryTooltipLines(countryRow) {
    if (!countryRow) return [];

    const totalTeams = Number(countryRow.total_teams || 0).toLocaleString('es-ES');
    const totalPlayers = Number(countryRow.total_players || 0).toLocaleString('es-ES');

    return [
        `Equipos: ${totalTeams}`,
        `Jugadores: ${totalPlayers}`
    ];
}

function sortPrizeRows(rows) {
    return (Array.isArray(rows) ? rows : [])
        .map(row => ({
            country: row.country,
            total_teams: Number(row.total_teams || 0),
            total_players: Number(row.total_players || 0),
            total_prizes: Number(row.total_prizes || 0),
            average_age: Number(row.average_age || 0),
            average_prize_per_team: Number(row.average_prize_per_team || 0)
        }))
        .sort((left, right) => {
            if (right.total_prizes !== left.total_prizes) {
                return right.total_prizes - left.total_prizes;
            }
            return String(left.country || '').localeCompare(String(right.country || ''), 'es');
        });
}

function toPrizeChartModel(rows, rankLabels) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeRankLabels = Array.isArray(rankLabels) ? rankLabels : [];
    const activeRows = Array.isArray(currentData?.country_ranking) ? currentData.country_ranking : safeRows;
    const colorMap = buildCountryColorMap(activeRows);

    return {
        rows: safeRows,
        rankLabels: safeRankLabels,
        prizes: safeRows.map(row => row.total_prizes),
        countryNames: safeRows.map(row => `${countryFlags[row.country] || ''} ${row.country}`.trim()),
        backgroundColors: safeRows.map(row => colorMap[row.country]?.backgroundColor || COUNTRY_CHART_BG_COLORS[0]),
        borderColors: safeRows.map(row => colorMap[row.country]?.borderColor || COUNTRY_CHART_BORDER_COLORS[0])
    };
}

function buildPrizesTooltipLines(countryRow) {
    if (!countryRow) return [];

    const prizeValue = Number(countryRow.total_prizes || 0).toLocaleString('es-ES');
    const lines = [`Premios: $${prizeValue}`];

    if (Number(countryRow.total_prizes || 0) === 0) {
        lines.push('Sin premios en esta competencia');
    }

    return lines;
}

function buildPrizesChartModel(filters = {}) {
    const selectedCountry = filters.country !== undefined
        ? filters.country
        : (document.getElementById('filter-country')?.value || '');
    const selectedCompetition = filters.competition !== undefined
        ? filters.competition
        : (document.getElementById('filter-competition')?.value || '');

    const globalSource = Array.isArray(dashboardData?.country_ranking)
        ? dashboardData.country_ranking
        : (Array.isArray(currentData?.country_ranking) ? currentData.country_ranking : []);
    const globalRows = sortPrizeRows(globalSource);

    if (selectedCompetition) {
        const competitionSource = Array.isArray(dashboardData?.filter_ready?.country_ranking_by_competition)
            ? dashboardData.filter_ready.country_ranking_by_competition
                .filter(row => row.competition_name === selectedCompetition)
            : (Array.isArray(currentData?.country_ranking) ? currentData.country_ranking : []);
        const competitionRows = sortPrizeRows(competitionSource);

        if (selectedCountry) {
            const rankIndex = competitionRows.findIndex(row => row.country === selectedCountry);
            const selectedRows = rankIndex >= 0 ? [competitionRows[rankIndex]] : [];
            const rankLabels = rankIndex >= 0 ? [`#${rankIndex + 1}`] : [];
            return toPrizeChartModel(selectedRows, rankLabels);
        }

        const visibleRows = competitionRows.slice(0, 8);
        return toPrizeChartModel(
            visibleRows,
            visibleRows.map((_, index) => `#${index + 1}`)
        );
    }

    if (selectedCountry) {
        const rankIndex = globalRows.findIndex(row => row.country === selectedCountry);
        const selectedRows = rankIndex >= 0 ? [globalRows[rankIndex]] : [];
        const rankLabels = rankIndex >= 0 ? [`#${rankIndex + 1}`] : [];
        return toPrizeChartModel(selectedRows, rankLabels);
    }

    const visibleRows = globalRows.slice(0, 8);
    return toPrizeChartModel(
        visibleRows,
        visibleRows.map((_, index) => `#${index + 1}`)
    );
}

function formatPercentValue(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'N/A';
    }
    return `${Number(value).toFixed(digits)}%`;
}

function formatSignedPercentValue(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'N/A';
    }
    const numeric = Number(value);
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(digits)}%`;
}

function formatContextualVariationValue(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'Sin comparación';
    }
    return formatSignedPercentValue(value, digits);
}

function getContextualVariationTone(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 'not-comparable';
    }
    const numeric = Number(value);
    if (numeric > 0) return 'positive';
    if (numeric < 0) return 'negative';
    return 'neutral';
}

function formatCurrencyValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '$0';
    }
    return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function safeNumericValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return 0;
    }
    return Number(value);
}

function safeOptionalNumericValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return null;
    }
    return Number(value);
}

function buildTableCell(text, options = {}) {
    return {
        text: text === null || text === undefined ? '-' : String(text),
        tone: options.tone || null,
        align: options.align || 'left',
        value: options.value !== undefined ? options.value : text
    };
}

function truncatePlayerModuleLabel(label, limit) {
    if (!label) return '';
    if (!limit || label.length <= limit) return label;
    if (limit <= 3) return label.slice(0, limit);
    return `${label.slice(0, limit - 3).trimEnd()}...`;
}

function getPlayerModuleChartLabelLimit(width) {
    const numericWidth = Number(width || 0);
    if (numericWidth >= 1180) return 28;
    if (numericWidth >= 920) return 22;
    if (numericWidth >= 700) return 18;
    return 12;
}

function getPlayerModuleFilters(filters = {}) {
    return {
        country: filters.country !== undefined ? filters.country : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined ? filters.competition : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined ? filters.search : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function getPlayerModuleTableTitle(view) {
    return view?.mode === 'single-year'
        ? PLAYER_MODULE_COPY.tableTitles.singleYear
        : PLAYER_MODULE_COPY.tableTitles.evolution;
}

function getContextualTableFilters(filters = {}) {
    return {
        country: filters.country !== undefined ? filters.country : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined ? filters.competition : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined ? filters.search : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function getCompetitionSectionFilters(filters = {}) {
    return {
        country: filters.country !== undefined ? filters.country : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined ? filters.competition : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined ? filters.search : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function getGlobalSummaryFilters(filters = {}) {
    return {
        country: filters.country !== undefined ? filters.country : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined ? filters.competition : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined ? filters.search : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function getSquadUsageFilters(filters = {}) {
    return {
        country: filters.country !== undefined ? filters.country : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined ? filters.competition : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined ? filters.search : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function resolveSquadUsageContext(filters) {
    if (filters.country && filters.competition) return 'country_competition';
    if (filters.country) return 'country';
    if (filters.competition) return 'competition';
    return 'global';
}

function getSquadUsageContextLabel(context, filters) {
    if (context === 'country_competition') {
        return SQUAD_USAGE_COPY.contextLabels.countryCompetition(filters.country, filters.competition);
    }
    if (context === 'country') {
        return SQUAD_USAGE_COPY.contextLabels.country(filters.country);
    }
    if (context === 'competition') {
        return SQUAD_USAGE_COPY.contextLabels.competition(filters.competition);
    }
    return SQUAD_USAGE_COPY.contextLabels.global;
}

function getSquadUsageTableTitle(context, filters) {
    if (context === 'country_competition') {
        return SQUAD_USAGE_COPY.tableTitles.countryCompetition(filters.country, filters.competition);
    }
    if (context === 'country') {
        return SQUAD_USAGE_COPY.tableTitles.country(filters.country);
    }
    if (context === 'competition') {
        return SQUAD_USAGE_COPY.tableTitles.competition(filters.competition);
    }
    return SQUAD_USAGE_COPY.tableTitles.global;
}

function getSquadUsageTableColumns(context) {
    return cloneList(
        context === 'country' || context === 'country_competition'
            ? SQUAD_USAGE_COPY.tableColumns.withoutCountry
            : SQUAD_USAGE_COPY.tableColumns.withCountry
    );
}

function formatSquadUsageParticipationSentence(substituteParticipations, totalParticipations) {
    const safeSubstituteParticipations = safeNumericValue(substituteParticipations);
    const safeTotalParticipations = Math.max(safeNumericValue(totalParticipations), safeSubstituteParticipations);
    const verb = safeSubstituteParticipations === 1 ? 'fue' : 'fueron';
    const noun = safeSubstituteParticipations === 1 ? 'suplente' : 'suplentes';
    return `${safeSubstituteParticipations.toLocaleString('es-ES')} de ${safeTotalParticipations.toLocaleString('es-ES')} registros de plantilla ${verb} ${noun}.`;
}

function getSquadUsageCountryCompetitionCount(country) {
    const rows = Array.isArray(dashboardData?.filter_ready?.squad_usage_by_country_competition)
        ? dashboardData.filter_ready.squad_usage_by_country_competition
        : [];
    const competitions = new Set();
    rows.forEach(function (row) {
        if (row?.country === country && row?.competition_name) {
            competitions.add(row.competition_name);
        }
    });
    return competitions.size;
}

function buildSquadUsageContextMeta(summary, breakdown, context, filters) {
    const teamCount = Array.isArray(breakdown) ? breakdown.length : 0;
    const starterParticipations = safeNumericValue(summary?.starter_participations);
    const substituteParticipations = safeNumericValue(summary?.substitute_participations);
    const totalParticipations = starterParticipations + substituteParticipations;
    const teamLabel = `${teamCount.toLocaleString('es-ES')} ${teamCount === 1 ? 'equipo analizado' : 'equipos analizados'}`;
    const recordsLabel = `${totalParticipations.toLocaleString('es-ES')} registros de plantilla`;
    const hasFixedCountry = context === 'country' || context === 'country_competition';
    const singleCompetitionNote = hasFixedCountry && filters.country && getSquadUsageCountryCompetitionCount(filters.country) === 1
        ? SQUAD_USAGE_COPY.singleCompetitionNote
        : '';

    return {
        teamsLabel: teamLabel,
        recordsLabel: recordsLabel,
        singleCompetitionNote: singleCompetitionNote
    };
}

function hasSquadUsageData(summary, breakdown) {
    const starter = Number(summary?.starter_participations || 0);
    const substitute = Number(summary?.substitute_participations || 0);
    return Boolean(summary) && (starter + substitute > 0 || (Array.isArray(breakdown) && breakdown.length > 0));
}

function formatSquadUsageSummaryValue(valueType, value) {
    if (valueType === 'percent') {
        return formatPercentValue(value, 1);
    }
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '0';
    }
    return Number(value).toLocaleString('es-ES');
}

function buildSquadUsageInsight(summary) {
    const substituteShare = safeNumericValue(summary?.substitute_share_pct);
    const substituteParticipations = safeNumericValue(summary?.substitute_participations);
    const totalParticipations = safeNumericValue(summary?.starter_participations) + substituteParticipations;
    let title = SQUAD_USAGE_COPY.insight.high;

    if (substituteShare === 0) {
        title = SQUAD_USAGE_COPY.insight.none;
    } else if (substituteShare < 10) {
        title = SQUAD_USAGE_COPY.insight.low;
    } else if (substituteShare < 25) {
        title = SQUAD_USAGE_COPY.insight.medium;
    }

    let description = substituteParticipations === 0
        ? SQUAD_USAGE_COPY.insight.noSubstitutesBody
        : `${formatSquadUsageParticipationSentence(substituteParticipations, totalParticipations)} ${SQUAD_USAGE_COPY.insight.missingComparison}`;

    if (
        summary?.starter_avg_performance !== null
        && summary?.starter_avg_performance !== undefined
        && !Number.isNaN(Number(summary?.starter_avg_performance))
        && summary?.substitute_avg_performance !== null
        && summary?.substitute_avg_performance !== undefined
        && !Number.isNaN(Number(summary?.substitute_avg_performance))
    ) {
        description = `${formatSquadUsageParticipationSentence(substituteParticipations, totalParticipations)} Rendimiento promedio: titulares ${formatPercentValue(summary.starter_avg_performance, 1)} \u00B7 suplentes ${formatPercentValue(summary.substitute_avg_performance, 1)}.`;
    }

    return {
        title: title,
        description: description
    };
}

function buildSquadUsageChartModel(summary) {
    const starterShare = safeNumericValue(summary?.starter_share_pct);
    const substituteShare = safeNumericValue(summary?.substitute_share_pct);

    return {
        title: SQUAD_USAGE_COPY.chartTitle,
        ariaLabel: `${SQUAD_USAGE_COPY.roleLabels.starter} ${formatPercentValue(starterShare, 1)}; ${SQUAD_USAGE_COPY.roleLabels.substitute} ${formatPercentValue(substituteShare, 1)}`,
        segments: [
            {
                key: 'starter',
                label: SQUAD_USAGE_COPY.roleLabels.starter,
                value: starterShare,
                valueLabel: formatPercentValue(starterShare, 1),
                participations: safeNumericValue(summary?.starter_participations),
                uniquePlayers: safeNumericValue(summary?.starter_unique_players),
                averagePerformance: summary?.starter_avg_performance,
                tone: 'primary'
            },
            {
                key: 'substitute',
                label: SQUAD_USAGE_COPY.roleLabels.substitute,
                value: substituteShare,
                valueLabel: formatPercentValue(substituteShare, 1),
                participations: safeNumericValue(summary?.substitute_participations),
                uniquePlayers: safeNumericValue(summary?.substitute_unique_players),
                averagePerformance: summary?.substitute_avg_performance,
                tone: 'secondary'
            }
        ]
    };
}

function buildSquadUsageTableModel(rows, context, filters) {
    const safeRows = cloneList(rows).map(function (row) {
        const performanceGap = row?.performance_gap_pct;
        return {
            team: row?.team || '',
            country: row?.country || '',
            starterParticipations: safeNumericValue(row?.starter_participations),
            substituteParticipations: safeNumericValue(row?.substitute_participations),
            starterParticipationsLabel: String(safeNumericValue(row?.starter_participations)),
            substituteParticipationsLabel: String(safeNumericValue(row?.substitute_participations)),
            substituteSharePct: safeNumericValue(row?.substitute_share_pct),
            substituteShareLabel: formatPercentValue(row?.substitute_share_pct, 1),
            performanceGapValue: performanceGap,
            performanceGapLabel: performanceGap === null || performanceGap === undefined || Number.isNaN(Number(performanceGap))
                ? SQUAD_USAGE_COPY.noData
                : `${Number(performanceGap) > 0 ? '+' : ''}${Number(performanceGap).toFixed(1)} pts`,
            performanceGapTone: getContextualVariationTone(performanceGap)
        };
    }).sort(function (left, right) {
        if (right.substituteSharePct !== left.substituteSharePct) {
            return right.substituteSharePct - left.substituteSharePct;
        }
        if (right.substituteParticipations !== left.substituteParticipations) {
            return right.substituteParticipations - left.substituteParticipations;
        }
        return String(left.team || '').localeCompare(String(right.team || ''), 'es');
    });

    return {
        title: getSquadUsageTableTitle(context, filters),
        columns: getSquadUsageTableColumns(context),
        rows: safeRows
    };
}

function buildSquadUsageViewModel(filters = {}) {
    const resolvedFilters = getSquadUsageFilters(filters);
    const context = resolveSquadUsageContext(resolvedFilters);
    const summary = currentData?.squad_usage_summary || null;
    const breakdown = Array.isArray(currentData?.squad_usage_team_breakdown) ? currentData.squad_usage_team_breakdown : [];
    const hasData = hasSquadUsageData(summary, breakdown);

    if (!hasData) {
        return {
            visible: true,
            context: context,
            title: SQUAD_USAGE_COPY.title,
            subtitle: SQUAD_USAGE_COPY.subtitle,
            contextLabel: getSquadUsageContextLabel(context, resolvedFilters),
            contextMeta: {
                teamsLabel: '0 equipos analizados',
                recordsLabel: '0 registros de plantilla',
                singleCompetitionNote: ''
            },
            summary: [],
            insight: null,
            chartModel: null,
            tableModel: null,
            emptyState: {
                message: SQUAD_USAGE_COPY.empty
            }
        };
    }

    return {
        visible: true,
        context: context,
        title: SQUAD_USAGE_COPY.title,
        subtitle: SQUAD_USAGE_COPY.subtitle,
        contextLabel: getSquadUsageContextLabel(context, resolvedFilters),
        contextMeta: buildSquadUsageContextMeta(summary, breakdown, context, resolvedFilters),
        summary: SQUAD_USAGE_COPY.summary.map(function (item) {
            return {
                label: item.label,
                tone: item.tone,
                icon: item.icon,
                value: formatSquadUsageSummaryValue(item.valueType, summary?.[item.key])
            };
        }),
        insight: buildSquadUsageInsight(summary),
        chartModel: buildSquadUsageChartModel(summary),
        tableModel: buildSquadUsageTableModel(breakdown, context, resolvedFilters),
        emptyState: null
    };
}

function destroySquadUsageChart() {
    if (charts.squadUsageChart) {
        charts.squadUsageChart.destroy();
        delete charts.squadUsageChart;
    }
}

function formatSquadUsageSegmentPerformance(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return `Rendimiento: ${SQUAD_USAGE_COPY.performanceNoData}`;
    }
    return `Rendimiento: ${formatPercentValue(value, 1)}`;
}

function renderSquadUsageTableCell(row, column) {
    if (!column?.key) {
        return '<td></td>';
    }

    if (column.key === 'substituteShareLabel') {
        return `<td><span class="squad-usage-table-share">${escapeCompetitionSectionText(row.substituteShareLabel || formatPercentValue(row.substituteSharePct, 1))}</span></td>`;
    }

    if (column.key === 'performanceGapLabel') {
        return `
            <td>
                <span class="squad-usage-gap squad-usage-gap--${escapeCompetitionSectionText(row.performanceGapTone || 'not-comparable')}">
                    ${escapeCompetitionSectionText(row.performanceGapLabel || SQUAD_USAGE_COPY.noData)}
                </span>
            </td>
        `;
    }

    return `<td>${escapeCompetitionSectionText(row[column.key] ?? '')}</td>`;
}

function renderSquadUsageSection(viewModel) {
    const section = document.getElementById('plantilla-section');
    const titleEl = document.getElementById('plantilla-section-title');
    const subtitleEl = document.getElementById('plantilla-section-subtitle');
    const contextEl = document.getElementById('plantilla-section-context');
    const container = document.getElementById('plantilla-content');

    if (!section || !titleEl || !subtitleEl || !contextEl || !container) return;

    if (!viewModel?.visible) {
        section.hidden = true;
        container.innerHTML = '';
        destroySquadUsageChart();
        return;
    }

    section.hidden = false;
    titleEl.textContent = viewModel.title || SQUAD_USAGE_COPY.title;
    subtitleEl.textContent = viewModel.subtitle || SQUAD_USAGE_COPY.subtitle;
    contextEl.textContent = viewModel.contextLabel || SQUAD_USAGE_COPY.contextLabels.global;
    contextEl.hidden = !contextEl.textContent;

    if (viewModel.emptyState) {
        container.innerHTML = `
            <div class="table-card">
                <div class="card-body">
                    <div class="contextual-table-empty">
                        <i class="fas fa-users-slash" aria-hidden="true"></i>
                        <span>${escapeCompetitionSectionText(viewModel.emptyState.message || SQUAD_USAGE_COPY.empty)}</span>
                    </div>
                </div>
            </div>
        `;
        destroySquadUsageChart();
        return;
    }

    container.innerHTML = `
        <div class="squad-usage-summary-grid">
            ${(Array.isArray(viewModel.summary) ? viewModel.summary : []).map(function (item) {
                return `
                    <article class="squad-usage-summary-card squad-usage-summary-card--${escapeCompetitionSectionText(item.tone || 'primary')}">
                        <div class="squad-usage-summary-card__header">
                            <span class="squad-usage-summary-card__icon" aria-hidden="true">
                                <i class="${escapeCompetitionSectionText(item.icon || 'fas fa-chart-bar')}"></i>
                            </span>
                            <span class="squad-usage-summary-card__label">${escapeCompetitionSectionText(item.label || '')}</span>
                        </div>
                        <strong class="squad-usage-summary-card__value">${escapeCompetitionSectionText(item.value || '0')}</strong>
                    </article>
                `;
            }).join('')}
        </div>
        <div class="squad-usage-context-meta" aria-label="Resumen contextual de plantilla">
            <span class="squad-usage-context-meta__line">${escapeCompetitionSectionText([viewModel.contextMeta?.teamsLabel, viewModel.contextMeta?.recordsLabel].filter(Boolean).join(' \u00B7 '))}</span>
            ${viewModel.contextMeta?.singleCompetitionNote
                ? `<p class="squad-usage-context-meta__note">${escapeCompetitionSectionText(viewModel.contextMeta.singleCompetitionNote)}</p>`
                : ''}
        </div>
        <article class="squad-usage-insight">
            <strong class="squad-usage-insight__title">${escapeCompetitionSectionText(viewModel.insight?.title || '')}</strong>
            <p class="squad-usage-insight__description">${escapeCompetitionSectionText(viewModel.insight?.description || '')}</p>
        </article>
        <div class="squad-usage-main-grid">
            <div class="chart-card squad-usage-panel squad-usage-panel--chart">
                <div class="card-header">
                    <h3><i class="fas fa-chart-bar" aria-hidden="true"></i> ${escapeCompetitionSectionText(viewModel.chartModel?.title || SQUAD_USAGE_COPY.chartTitle)}</h3>
                </div>
                <div class="card-body">
                    <div class="squad-usage-repartition" role="img" aria-label="${escapeCompetitionSectionText(viewModel.chartModel?.ariaLabel || '')}">
                        <div class="squad-usage-repartition__track">
                            ${(Array.isArray(viewModel.chartModel?.segments) ? viewModel.chartModel.segments : []).map(function (segment) {
                                const width = Math.max(0, Math.min(100, Number(segment.value || 0)));
                                return `<span class="squad-usage-repartition__segment squad-usage-repartition__segment--${escapeCompetitionSectionText(segment.tone || 'primary')}" style="width:${width}%;"></span>`;
                            }).join('')}
                        </div>
                        <div class="squad-usage-repartition__legend">
                            ${(Array.isArray(viewModel.chartModel?.segments) ? viewModel.chartModel.segments : []).map(function (segment) {
                                return `
                                    <article class="squad-usage-repartition__item squad-usage-repartition__item--${escapeCompetitionSectionText(segment.tone || 'primary')}">
                                        <div class="squad-usage-repartition__item-head">
                                            <span class="squad-usage-repartition__swatch" aria-hidden="true"></span>
                                            <span class="squad-usage-repartition__item-label">${escapeCompetitionSectionText(segment.label || '')}</span>
                                            <strong class="squad-usage-repartition__item-value">${escapeCompetitionSectionText(segment.valueLabel || formatPercentValue(segment.value, 1))}</strong>
                                        </div>
                                        <p class="squad-usage-repartition__item-meta">${escapeCompetitionSectionText(`${Number(segment.participations || 0).toLocaleString('es-ES')} participaciones | ${Number(segment.uniquePlayers || 0).toLocaleString('es-ES')} jugadores`)}</p>
                                        <p class="squad-usage-repartition__item-meta squad-usage-repartition__item-meta--muted">${escapeCompetitionSectionText(formatSquadUsageSegmentPerformance(segment.averagePerformance))}</p>
                                    </article>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-card squad-usage-panel squad-usage-table-card">
                <div class="card-header">
                    <h3><i class="fas fa-list-ul" aria-hidden="true"></i> ${escapeCompetitionSectionText(viewModel.tableModel?.title || '')}</h3>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table ${viewModel.context === 'country' || viewModel.context === 'country_competition' ? 'plantilla-team-table--compact' : ''}" id="plantilla-team-table">
                            <thead>
                                <tr>
                                    ${(Array.isArray(viewModel.tableModel?.columns) ? viewModel.tableModel.columns : []).map(function (column) {
                                        return `<th>${escapeCompetitionSectionText(column.label || '')}</th>`;
                                    }).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${(Array.isArray(viewModel.tableModel?.rows) ? viewModel.tableModel.rows : []).map(function (row) {
                                    return `
                                        <tr>
                                            ${(Array.isArray(viewModel.tableModel?.columns) ? viewModel.tableModel.columns : []).map(function (column) {
                                                return renderSquadUsageTableCell(row, column);
                                            }).join('')}
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    destroySquadUsageChart();
}

function getGlobalSummaryMetrics() {
    return dashboardData?.summary_metrics
        || currentData?.summary_metrics
        || (typeof getEmptyData === 'function' ? getEmptyData().summary_metrics : {});
}

function formatGlobalSummaryValue(valueType, value) {
    if (valueType === 'currency') {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
            return GLOBAL_SUMMARY_COPY.emptyValue;
        }
        return formatCurrencyValue(value);
    }

    if (value === null || value === undefined || String(value).trim() === '') {
        return GLOBAL_SUMMARY_COPY.emptyValue;
    }

    return String(value);
}

function buildGlobalSummaryViewModel(filters = {}) {
    const resolvedFilters = getGlobalSummaryFilters(filters);
    const hasFilters = Boolean(resolvedFilters.country || resolvedFilters.competition || resolvedFilters.search);
    const metrics = getGlobalSummaryMetrics();

    return {
        visible: !hasFilters,
        title: GLOBAL_SUMMARY_COPY.title,
        subtitle: GLOBAL_SUMMARY_COPY.subtitle,
        items: hasFilters
            ? []
            : GLOBAL_SUMMARY_COPY.items.map(function (item) {
                return {
                    icon: item.icon,
                    label: item.label,
                    tone: item.tone,
                    value: formatGlobalSummaryValue(item.valueType, metrics?.[item.key])
                };
            })
    };
}

function renderGlobalSummary(viewModel) {
    const section = document.getElementById('insights-section');
    const titleEl = document.getElementById('global-summary-title');
    const subtitleEl = document.getElementById('global-summary-subtitle');
    const container = document.getElementById('global-summary-grid');

    if (!section || !titleEl || !subtitleEl || !container) return;

    if (!viewModel?.visible) {
        section.hidden = true;
        container.innerHTML = '';
        return;
    }

    section.hidden = false;
    titleEl.textContent = viewModel.title || GLOBAL_SUMMARY_COPY.title;
    subtitleEl.textContent = viewModel.subtitle || GLOBAL_SUMMARY_COPY.subtitle;

    container.innerHTML = (Array.isArray(viewModel.items) ? viewModel.items : []).map(function (item) {
        return `
            <article class="global-summary-card global-summary-card--${escapeCompetitionSectionText(item.tone || 'cyan')} fade-in-up">
                <div class="global-summary-card__header">
                    <i class="${escapeCompetitionSectionText(item.icon || 'fas fa-lightbulb')} global-summary-card__icon" aria-hidden="true"></i>
                    <span class="global-summary-card__label">${escapeCompetitionSectionText(item.label || '')}</span>
                </div>
                <strong class="global-summary-card__value">${escapeCompetitionSectionText(item.value || GLOBAL_SUMMARY_COPY.emptyValue)}</strong>
            </article>
        `;
    }).join('');
}

function normalizeCompetitionTypeClass(type) {
    const normalized = normalizeText ? normalizeText(type) : String(type || '').toLowerCase();
    return normalized || 'nacional';
}

function mapCompetitionCatalogItem(row) {
    return {
        name: row?.name || '',
        year: safeNumericValue(row?.year),
        type: row?.type || '',
        location: row?.location || 'Por definir',
        participatingTeams: safeNumericValue(row?.participating_teams),
        totalPrize: safeNumericValue(row?.total_prize)
    };
}

function mapCompetitionSpotlight(row) {
    return {
        name: row?.name || '',
        year: safeNumericValue(row?.year),
        type: row?.type || '',
        location: row?.location || 'Por definir',
        participatingTeams: safeNumericValue(row?.participating_teams),
        totalPlayers: safeNumericValue(row?.total_players),
        totalPrize: safeNumericValue(row?.total_prize),
        averageAge: row?.average_age === null || row?.average_age === undefined || Number.isNaN(Number(row?.average_age))
            ? null
            : Number(row.average_age)
    };
}

function resolveCompetitionCountryBestPosition(rows) {
    const validPositions = cloneList(rows)
        .map(function (row) {
            return safeNumericValue(row?.best_position || row?.average_position);
        })
        .filter(function (value) {
            return value > 0;
        });

    if (!validPositions.length) return null;
    return Math.min.apply(null, validPositions);
}

function buildCompetitionCountryParticipation(country) {
    if (!country) return null;

    const kpis = currentData?.main_kpis || {};
    const teams = safeNumericValue(kpis.total_teams);
    const players = safeNumericValue(kpis.total_players);
    const totalPrizes = safeNumericValue(kpis.total_prizes);
    const bestPosition = resolveCompetitionCountryBestPosition(currentData?.top_teams);

    if (teams <= 0 && players <= 0 && totalPrizes <= 0 && bestPosition === null) {
        return null;
    }

    return {
        country: country,
        teams: teams,
        players: players,
        totalPrizes: totalPrizes,
        bestPosition: bestPosition
    };
}

function buildCompetitionSectionEmptyView(options = {}) {
    return {
        mode: 'empty',
        title: options.title || COMPETITION_SECTION_COPY.titles.global,
        subtitle: options.subtitle || '',
        items: [],
        spotlight: null,
        countryParticipation: null,
        emptyState: {
            message: options.message || COMPETITION_SECTION_COPY.empty.catalog
        }
    };
}

function buildCompetitionSectionViewModel(filters = {}) {
    const resolvedFilters = getCompetitionSectionFilters(filters);
    const country = resolvedFilters.country;
    const competition = resolvedFilters.competition;
    const competitions = cloneList(currentData?.competitions);

    if (competition) {
        const spotlightSource = competitions.find(function (row) {
            return row?.name === competition;
        });

        if (!spotlightSource) {
            return buildCompetitionSectionEmptyView({
                title: COMPETITION_SECTION_COPY.titles.detail(competition),
                message: COMPETITION_SECTION_COPY.empty.detail
            });
        }

        const countryParticipation = country ? buildCompetitionCountryParticipation(country) : null;
        if (country && !countryParticipation) {
            return buildCompetitionSectionEmptyView({
                title: COMPETITION_SECTION_COPY.titles.detail(competition),
                subtitle: '',
                message: COMPETITION_SECTION_COPY.empty.invalidParticipation(country)
            });
        }

        return {
            mode: 'spotlight',
            title: COMPETITION_SECTION_COPY.titles.detail(competition),
            subtitle: country ? COMPETITION_SECTION_COPY.titles.countryContext(country) : '',
            items: [],
            spotlight: mapCompetitionSpotlight(spotlightSource),
            countryParticipation: countryParticipation,
            emptyState: null
        };
    }

    if (!competitions.length) {
        return buildCompetitionSectionEmptyView({
            title: COMPETITION_SECTION_COPY.titles.global,
            subtitle: '',
            message: COMPETITION_SECTION_COPY.empty.catalog
        });
    }

    return {
        mode: 'catalog',
        title: country ? COMPETITION_SECTION_COPY.titles.country(country) : COMPETITION_SECTION_COPY.titles.global,
        subtitle: '',
        items: competitions.map(mapCompetitionCatalogItem),
        spotlight: null,
        countryParticipation: null,
        emptyState: null
    };
}

function buildContextualTableEmptyView(title, message) {
    return {
        mode: 'empty',
        title: title,
        headers: [],
        rows: [],
        emptyState: { message: message },
        sortMeta: CONTEXTUAL_TABLE_COPY.sortMeta.empty
    };
}

function getCompetitionYearPerformance(row) {
    if (!row) return null;
    const year = Number(row.competition_year);
    if (year === 2024) return row.performance_2024;
    if (year === 2025) return row.performance_2025;
    if (row.performance_2025 !== null && row.performance_2025 !== undefined) return row.performance_2025;
    if (row.performance_2024 !== null && row.performance_2024 !== undefined) return row.performance_2024;
    return null;
}

function sortContextualTeamsOverviewRows(rows) {
    return cloneList(rows).sort(function (left, right) {
        const prizeDelta = safeNumericValue(right.total_prizes) - safeNumericValue(left.total_prizes);
        if (prizeDelta !== 0) return prizeDelta;

        const competitionsDelta = safeNumericValue(right.participating_competitions) - safeNumericValue(left.participating_competitions);
        if (competitionsDelta !== 0) return competitionsDelta;

        const leftBest = left.best_position === null || left.best_position === undefined ? Number.POSITIVE_INFINITY : safeNumericValue(left.best_position);
        const rightBest = right.best_position === null || right.best_position === undefined ? Number.POSITIVE_INFINITY : safeNumericValue(right.best_position);
        if (leftBest !== rightBest) return leftBest - rightBest;

        return String(left.name || '').localeCompare(String(right.name || ''), 'es');
    });
}

function sortContextualPlayerRankingRows(rows) {
    return cloneList(rows).sort(function (left, right) {
        const performanceDelta = safeNumericValue(getCompetitionYearPerformance(right)) - safeNumericValue(getCompetitionYearPerformance(left));
        if (performanceDelta !== 0) return performanceDelta;

        const improvementDelta = safeNumericValue(right.improvement_pct) - safeNumericValue(left.improvement_pct);
        if (improvementDelta !== 0) return improvementDelta;

        return String(left.name || '').localeCompare(String(right.name || ''), 'es');
    });
}

function sortContextualTeamResultsRows(rows) {
    return cloneList(rows).sort(function (left, right) {
        const leftPos = safeNumericValue(left.final_position);
        const rightPos = safeNumericValue(right.final_position);
        const leftEmpty = leftPos <= 0 ? 1 : 0;
        const rightEmpty = rightPos <= 0 ? 1 : 0;
        if (leftEmpty !== rightEmpty) return leftEmpty - rightEmpty;
        if (!leftEmpty && leftPos !== rightPos) return leftPos - rightPos;

        const prizeDelta = safeNumericValue(right.prize_obtained) - safeNumericValue(left.prize_obtained);
        if (prizeDelta !== 0) return prizeDelta;

        return String(left.team || '').localeCompare(String(right.team || ''), 'es');
    });
}

function buildContextualTeamsOverviewView(filters) {
    const country = filters.country;
    const sourceRows = cloneList(dashboardData?.teams_catalog);
    const rows = country
        ? sourceRows.filter(function (row) { return row.country === country; })
        : sourceRows;
    const sortedRows = sortContextualTeamsOverviewRows(rows);
    const headers = country
        ? ['Equipo', 'Competiciones', 'Jugadores', 'Premios', 'Mejor puesto']
        : ['Equipo', 'País', 'Competiciones', 'Jugadores', 'Premios', 'Mejor puesto'];

    return {
        mode: 'teams-overview',
        title: country ? `Equipos de ${country}` : 'Equipos destacados',
        headers: headers,
        rows: sortedRows.map(function (row) {
            const cells = [
                buildTableCell(row.name || '-', { value: row.name || '' }),
            ];
            if (!country) {
                cells.push(buildTableCell(row.country || '-', { value: row.country || '' }));
            }
            cells.push(buildTableCell(String(safeNumericValue(row.participating_competitions)), { align: 'center', value: safeNumericValue(row.participating_competitions) }));
            cells.push(buildTableCell(String(safeNumericValue(row.total_players)), { align: 'center', value: safeNumericValue(row.total_players) }));
            cells.push(buildTableCell(formatCurrencyValue(row.total_prizes), { align: 'right', value: safeNumericValue(row.total_prizes) }));
            cells.push(buildTableCell(
                row.best_position === null || row.best_position === undefined ? '-' : String(safeNumericValue(row.best_position)),
                { align: 'center', value: row.best_position === null || row.best_position === undefined ? null : safeNumericValue(row.best_position) }
            ));
            return {
                key: `${row.name || 'team'}-${row.country || 'country'}`,
                cells: cells
            };
        }),
        emptyState: rows.length ? null : { message: CONTEXTUAL_TABLE_COPY.empty.noTeams },
        sortMeta: CONTEXTUAL_TABLE_COPY.sortMeta['teams-overview']
    };
}

function buildContextualPlayersRankingView(filters) {
    const country = filters.country;
    const competition = filters.competition;
    const sourceRows = cloneList(dashboardData?.filter_ready?.player_evolution_by_competition).filter(function (row) {
        return row.competition_name === competition && (!country || row.nationality === country);
    });
    const validRows = sourceRows.filter(function (row) {
        return getCompetitionYearPerformance(row) !== null && getCompetitionYearPerformance(row) !== undefined;
    });
    const sortedRows = sortContextualPlayerRankingRows(validRows);
    const headers = country
        ? ['Pos.', 'Jugador', 'Equipo', 'Rendimiento', 'Variación anual']
        : ['Pos.', 'Jugador', 'Equipo', 'País', 'Rendimiento', 'Variación anual'];

    return {
        mode: 'players-ranking',
        title: country ? `Jugadores de ${country} en ${competition}` : `Jugadores destacados en ${competition}`,
        headers: headers,
        rows: sortedRows.map(function (row, index) {
            const cells = [
                buildTableCell(String(index + 1), { align: 'center', value: index + 1 }),
                buildTableCell(row.name || '-', { value: row.name || '' }),
                buildTableCell(row.team || '-', { value: row.team || '' })
            ];
            if (!country) {
                cells.push(buildTableCell(row.nationality || '-', { value: row.nationality || '' }));
            }
            cells.push(buildTableCell(formatPercentValue(getCompetitionYearPerformance(row)), { align: 'right', value: safeNumericValue(getCompetitionYearPerformance(row)) }));
            cells.push(buildTableCell(formatContextualVariationValue(row.improvement_pct, 1), {
                align: 'right',
                value: row.improvement_pct,
                tone: getContextualVariationTone(row.improvement_pct)
            }));
            return {
                key: `${row.competition_name || competition}-${row.name || index}`,
                cells: cells
            };
        }),
        emptyState: validRows.length ? null : { message: CONTEXTUAL_TABLE_COPY.empty.noSingleYearData },
        sortMeta: CONTEXTUAL_TABLE_COPY.sortMeta['players-ranking']
    };
}

function buildContextualTeamsResultsView(filters) {
    const country = filters.country;
    const competition = filters.competition;
    const sourceRows = cloneList(dashboardData?.filter_ready?.top_teams_by_competition).filter(function (row) {
        return row.competition_name === competition && (!country || row.country === country);
    });
    const sortedRows = sortContextualTeamResultsRows(sourceRows);
    const headers = country
        ? ['Pos.', 'Equipo', 'Jugadores', 'Premio']
        : ['Pos.', 'Equipo', 'País', 'Jugadores', 'Premio'];

    return {
        mode: 'teams-results',
        title: country ? `Equipos de ${country} en ${competition}` : `Resultados de equipos en ${competition}`,
        headers: headers,
        rows: sortedRows.map(function (row) {
            const cells = [
                buildTableCell(safeNumericValue(row.final_position) <= 0 ? '-' : String(safeNumericValue(row.final_position)), {
                    align: 'center',
                    value: safeNumericValue(row.final_position) <= 0 ? null : safeNumericValue(row.final_position)
                }),
                buildTableCell(row.team || '-', { value: row.team || '' })
            ];
            if (!country) {
                cells.push(buildTableCell(row.country || '-', { value: row.country || '' }));
            }
            cells.push(buildTableCell(String(safeNumericValue(row.total_players)), { align: 'center', value: safeNumericValue(row.total_players) }));
            cells.push(buildTableCell(formatCurrencyValue(row.prize_obtained), { align: 'right', value: safeNumericValue(row.prize_obtained) }));
            return {
                key: `${row.competition_name || competition}-${row.team || 'team'}`,
                cells: cells
            };
        }),
        emptyState: sourceRows.length ? null : { message: CONTEXTUAL_TABLE_COPY.empty.noTeams },
        sortMeta: CONTEXTUAL_TABLE_COPY.sortMeta['teams-results']
    };
}

function buildContextualPlayerDetailView(filters, exactPlayerName) {
    const country = filters.country;
    const competition = filters.competition;
    if (competition) {
        const rows = cloneList(dashboardData?.filter_ready?.player_evolution_by_competition).filter(function (row) {
            return row.competition_name === competition
                && row.name === exactPlayerName
                && (!country || row.nationality === country);
        });

        if (!rows.length) {
            return buildContextualTableEmptyView(`Detalle de ${exactPlayerName} en ${competition}`, CONTEXTUAL_TABLE_COPY.empty.noPlayerData);
        }

        const sortedRows = sortContextualPlayerRankingRows(rows);
        return {
            mode: 'player-detail',
            title: `Detalle de ${exactPlayerName} en ${competition}`,
            headers: ['Competencia', 'Año', 'Equipo', 'País', 'Rendimiento', 'Variación anual'],
            rows: sortedRows.map(function (row, index) {
                return {
                    key: `${row.competition_name || competition}-${row.name || index}`,
                    cells: [
                        buildTableCell(row.competition_name || competition, { value: row.competition_name || competition }),
                        buildTableCell(String(safeNumericValue(row.competition_year)), { align: 'center', value: safeNumericValue(row.competition_year) }),
                        buildTableCell(row.team || '-', { value: row.team || '' }),
                        buildTableCell(row.nationality || '-', { value: row.nationality || '' }),
                        buildTableCell(formatPercentValue(getCompetitionYearPerformance(row)), { align: 'right', value: safeNumericValue(getCompetitionYearPerformance(row)) }),
                        buildTableCell(formatContextualVariationValue(row.improvement_pct, 1), {
                            align: 'right',
                            value: row.improvement_pct,
                            tone: getContextualVariationTone(row.improvement_pct)
                        })
                    ]
                };
            }),
            emptyState: null,
            sortMeta: CONTEXTUAL_TABLE_COPY.sortMeta['player-detail']
        };
    }

    const row = cloneList(dashboardData?.player_evolution).find(function (item) {
        return item.name === exactPlayerName;
    });
    if (!row || (country && row.nationality !== country)) {
        return buildContextualTableEmptyView(`Detalle de ${exactPlayerName}`, CONTEXTUAL_TABLE_COPY.empty.noPlayerData);
    }

    const detailRows = [];
    if (row.performance_2024 !== null && row.performance_2024 !== undefined) {
        detailRows.push({
            key: `${row.name}-2024`,
            cells: [
                buildTableCell('2024', { align: 'center', value: 2024 }),
                buildTableCell(row.team_2024 || '-', { value: row.team_2024 || '' }),
                buildTableCell(row.nationality || '-', { value: row.nationality || '' }),
                buildTableCell(formatPercentValue(row.performance_2024), { align: 'right', value: safeNumericValue(row.performance_2024) }),
                buildTableCell('Sin comparación', { align: 'right', value: null, tone: 'not-comparable' })
            ]
        });
    }
    if (row.performance_2025 !== null && row.performance_2025 !== undefined) {
        detailRows.push({
            key: `${row.name}-2025`,
            cells: [
                buildTableCell('2025', { align: 'center', value: 2025 }),
                buildTableCell(row.team_2025 || '-', { value: row.team_2025 || '' }),
                buildTableCell(row.nationality || '-', { value: row.nationality || '' }),
                buildTableCell(formatPercentValue(row.performance_2025), { align: 'right', value: safeNumericValue(row.performance_2025) }),
                buildTableCell(formatContextualVariationValue(row.improvement_pct, 1), {
                    align: 'right',
                    value: row.improvement_pct,
                    tone: getContextualVariationTone(row.improvement_pct)
                })
            ]
        });
    }

    return {
        mode: 'player-detail',
        title: `Detalle de ${exactPlayerName}`,
        headers: ['Año', 'Equipo', 'País', 'Rendimiento', 'Variación anual'],
        rows: detailRows,
        emptyState: detailRows.length ? null : { message: CONTEXTUAL_TABLE_COPY.empty.noPlayerData },
        sortMeta: CONTEXTUAL_TABLE_COPY.sortMeta['player-detail']
    };
}

function buildContextualTableViewModel(filters = {}) {
    const resolvedFilters = getContextualTableFilters(filters);
    const exactPlayerName = resolveExactPlayerName(resolvedFilters.search, dashboardData);

    if (exactPlayerName) {
        return buildContextualPlayerDetailView(resolvedFilters, exactPlayerName);
    }

    if (resolvedFilters.competition) {
        const playerRows = cloneList(dashboardData?.filter_ready?.player_evolution_by_competition).filter(function (row) {
            return row.competition_name === resolvedFilters.competition
                && (!resolvedFilters.country || row.nationality === resolvedFilters.country)
                && getCompetitionYearPerformance(row) !== null
                && getCompetitionYearPerformance(row) !== undefined;
        });
        if (playerRows.length) {
            return buildContextualPlayersRankingView(resolvedFilters);
        }
        return buildContextualTeamsResultsView(resolvedFilters);
    }

    return buildContextualTeamsOverviewView(resolvedFilters);
}

function renderContextualTable(view = buildContextualTableViewModel()) {
    const titleEl = document.getElementById('contextual-table-title');
    const theadRow = document.querySelector('#contextual-table thead tr');
    const tbody = document.querySelector('#contextual-table tbody');
    if (!titleEl || !theadRow || !tbody) return;

    const iconClass = CONTEXTUAL_TABLE_COPY.icons[view?.mode] || CONTEXTUAL_TABLE_COPY.icons.empty;
    titleEl.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i> ${view?.title || 'Tabla contextual'}`;

    const escapeHtml = function (value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    theadRow.innerHTML = (view?.headers || []).map(function (header, index) {
        const classes = index === 0 ? ' class="contextual-table-col--primary"' : '';
        return `<th scope="col"${classes}>${escapeHtml(header)}</th>`;
    }).join('');

    if (!view?.rows?.length) {
        const colspan = (view?.headers?.length || 1);
        tbody.innerHTML = `<tr class="contextual-table-empty-row"><td colspan="${colspan}" class="contextual-table-empty text-center py-5 text-muted"><i class="fas fa-ghost fa-2x mb-3 d-block opacity-25" aria-hidden="true"></i><span class="small d-block">${escapeHtml(view?.emptyState?.message || 'Sin datos para este filtro')}</span></td></tr>`;
        return;
    }

    tbody.innerHTML = view.rows.map(function (row) {
        const cellsMarkup = row.cells.map(function (cell, index) {
            const header = view.headers[index];
            const classes = ['contextual-table-cell'];
            if (index === 0) classes.push('contextual-table-col--primary');
            if (cell.align) classes.push(`contextual-table-cell--${cell.align}`);
            if (cell.tone) classes.push(`contextual-table-cell--${cell.tone}`);

            let content = escapeHtml(cell.text);
            if (header === 'País' && cell.value && cell.value !== '-') {
                content = `${countryFlag(cell.value)} ${content}`;
            }
            if (header === 'Equipo' || header === 'Jugador') {
                content = `<strong>${content}</strong>`;
            }
            if (header === 'Variación anual') {
                content = `<span class="contextual-table-value contextual-table-value--${cell.tone || 'neutral'}">${content}</span>`;
            }
            return `<td class="${classes.join(' ')}">${content}</td>`;
        }).join('');
        return `<tr data-row-key="${escapeHtml(row.key || '')}">${cellsMarkup}</tr>`;
    }).join('');
}

function getPlayerModuleSearchCatalog(data) {
    const playersIndex = data?.filter_ready?.players_index || [];
    const uniqueByName = new Map();

    playersIndex.forEach(function (row) {
        if (!row?.name) return;
        const key = normalizeText(row.name);
        if (!key || uniqueByName.has(key)) return;
        uniqueByName.set(key, row.name);
    });

    if (uniqueByName.size === 0) {
        (data?.player_evolution || []).forEach(function (row) {
            if (!row?.name) return;
            const key = normalizeText(row.name);
            if (!key || uniqueByName.has(key)) return;
            uniqueByName.set(key, row.name);
        });
    }

    return uniqueByName;
}

function resolveExactPlayerName(rawSearch, data) {
    if (!rawSearch) return null;
    const normalized = normalizeText(rawSearch);
    if (!normalized) return null;

    const catalog = getPlayerModuleSearchCatalog(data);
    return catalog.get(normalized) || null;
}

function hasComparablePlayerYears(row) {
    return row?.performance_2024 !== null
        && row?.performance_2024 !== undefined
        && row?.performance_2025 !== null
        && row?.performance_2025 !== undefined;
}

function hasPositiveImprovement(row) {
    return hasComparablePlayerYears(row) && Number(row?.improvement_pct || 0) > 0;
}

function inferSingleYearFromRow(row) {
    if (!row) return null;
    if (row.competition_year !== null && row.competition_year !== undefined) {
        return Number(row.competition_year);
    }
    if (row.performance_2024 !== null && row.performance_2024 !== undefined
        && (row.performance_2025 === null || row.performance_2025 === undefined)) {
        return 2024;
    }
    if (row.performance_2025 !== null && row.performance_2025 !== undefined
        && (row.performance_2024 === null || row.performance_2024 === undefined)) {
        return 2025;
    }
    return null;
}

function getSingleYearPerformance(row) {
    const year = inferSingleYearFromRow(row);
    if (year === 2024) return row.performance_2024;
    if (year === 2025) return row.performance_2025;
    if (row.performance_2025 !== null && row.performance_2025 !== undefined) return row.performance_2025;
    if (row.performance_2024 !== null && row.performance_2024 !== undefined) return row.performance_2024;
    return null;
}

function getSingleYearTeam(row) {
    const year = inferSingleYearFromRow(row);
    if (year === 2024) return row.team || row.team_2024 || row.team_2025 || 'N/A';
    if (year === 2025) return row.team || row.team_2025 || row.team_2024 || 'N/A';
    return row.team || row.team_2025 || row.team_2024 || 'N/A';
}

function getPlayerModuleIndexByName(data = dashboardData) {
    const map = new Map();
    const playersIndex = data?.filter_ready?.players_index || [];

    playersIndex.forEach(function (row) {
        if (!row?.name) return;
        map.set(normalizeText(row.name), row);
    });

    return map;
}

function dedupePlayerModuleRowsByName(rows) {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter(function (row) {
        const key = normalizeText(row?.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function sortEvolutionRows(rows) {
    return cloneList(rows).sort(function (left, right) {
        const leftImprovement = Number(left.performance_2025 || 0) - Number(left.performance_2024 || 0);
        const rightImprovement = Number(right.performance_2025 || 0) - Number(right.performance_2024 || 0);
        if (rightImprovement !== leftImprovement) {
            return rightImprovement - leftImprovement;
        }

        const leftImprovementPct = Number(left.improvement_pct || 0);
        const rightImprovementPct = Number(right.improvement_pct || 0);
        if (rightImprovementPct !== leftImprovementPct) {
            return rightImprovementPct - leftImprovementPct;
        }

        const leftPerf2025 = Number(left.performance_2025 || 0);
        const rightPerf2025 = Number(right.performance_2025 || 0);
        if (rightPerf2025 !== leftPerf2025) {
            return rightPerf2025 - leftPerf2025;
        }

        return String(left.name || '').localeCompare(String(right.name || ''), 'es');
    });
}

function sortSingleYearRows(rows) {
    return cloneList(rows)
        .map(function (row) {
            return Object.assign({}, row, {
                single_year: inferSingleYearFromRow(row),
                single_year_performance: getSingleYearPerformance(row),
                single_year_team: getSingleYearTeam(row)
            });
        })
        .filter(function (row) {
            return row.single_year_performance !== null && row.single_year_performance !== undefined;
        })
        .sort(function (left, right) {
            const leftPerformance = Number(left.single_year_performance || 0);
            const rightPerformance = Number(right.single_year_performance || 0);
            if (rightPerformance !== leftPerformance) {
                return rightPerformance - leftPerformance;
            }
            return String(left.name || '').localeCompare(String(right.name || ''), 'es');
        });
}

function buildPlayerModuleEvolutionRows(rows, limit) {
    return sortEvolutionRows(rows)
        .slice(0, limit)
        .map(function (row) {
            return Object.assign({}, row, {
                display_name: toProperCase(row.name),
                improvement_pct: row.improvement_pct
            });
        });
}

function buildPlayerModuleSingleYearRows(rows, limit) {
    return sortSingleYearRows(rows)
        .slice(0, limit)
        .map(function (row, index) {
            return Object.assign({}, row, {
                display_name: toProperCase(row.name),
                performance_value: row.single_year_performance,
                display_team: row.single_year_team,
                competition_year: row.single_year || row.competition_year,
                rank: index + 1
            });
        });
}

function rankSearchableEvolutionRows(rows) {
    const comparableRows = sortEvolutionRows((Array.isArray(rows) ? rows : []).filter(hasComparablePlayerYears));
    const singleYearRows = sortSingleYearRows((Array.isArray(rows) ? rows : []).filter(function (row) {
        return !hasComparablePlayerYears(row);
    }));
    return dedupePlayerModuleRowsByName(comparableRows.concat(singleYearRows));
}

function buildPlayerModuleSuggestionItems(rows, mode, limit) {
    const indexByName = getPlayerModuleIndexByName(dashboardData);
    return cloneList(rows).slice(0, limit).map(function (row) {
        const indexRow = indexByName.get(normalizeText(row.name)) || {};
        const nationality = row.nationality || indexRow.nationality || '';
        const team = mode === 'single-year'
            ? (row.display_team || row.single_year_team || getSingleYearTeam(row) || indexRow.team || 'N/A')
            : (row.team_2025 || row.team_2024 || indexRow.team || getSingleYearTeam(row) || 'N/A');
        const contextLabel = mode === 'single-year'
            ? String(row.competition_year || row.single_year || inferSingleYearFromRow(row) || '')
            : (hasComparablePlayerYears(row) ? '2024-2025' : String(inferSingleYearFromRow(row) || ''));

        return {
            name: row.name,
            displayName: toProperCase(row.name),
            nationality: nationality,
            team: team,
            contextLabel: contextLabel,
            meta: [nationality || 'N/A', team || 'N/A', contextLabel || ''].filter(Boolean).join(' · ')
        };
    });
}

function buildPlayerModuleSuggestionView(filters = {}) {
    const resolvedFilters = getPlayerModuleFilters(filters);
    const query = normalizeText(resolvedFilters.search);
    const baseRows = cloneList(currentData?.player_evolution);
    const isSingleYearContext = Boolean(resolvedFilters.competition);
    const limit = 6;
    let rankedRows = [];

    if (query) {
        const pool = isSingleYearContext ? sortSingleYearRows(baseRows) : rankSearchableEvolutionRows(baseRows);
        rankedRows = pool.filter(function (row) {
            return normalizeText(row.name).includes(query);
        });
    } else {
        rankedRows = isSingleYearContext
            ? buildPlayerModuleSingleYearRows(baseRows, limit)
            : buildPlayerModuleEvolutionRows(baseRows.filter(hasPositiveImprovement), limit);
    }

    const items = buildPlayerModuleSuggestionItems(
        dedupePlayerModuleRowsByName(rankedRows),
        isSingleYearContext ? 'single-year' : 'evolution',
        limit
    );

    if (!items.length) {
        return {
            variant: 'empty',
            header: query ? PLAYER_MODULE_COPY.suggestionHeaders.matches : PLAYER_MODULE_COPY.suggestionHeaders.recommendations,
            items: [],
            message: (!query && !isSingleYearContext)
                ? PLAYER_MODULE_COPY.emptyState.positiveOnly
                : PLAYER_MODULE_COPY.emptyState.noMatches
        };
    }

    return {
        variant: query ? 'search' : 'context',
        header: query ? PLAYER_MODULE_COPY.suggestionHeaders.matches : PLAYER_MODULE_COPY.suggestionHeaders.recommendations,
        items: items,
        message: ''
    };
}

function computePlayerModuleAxisMax(rows, mode) {
    const values = (Array.isArray(rows) ? rows : []).map(function (row) {
        if (mode === 'evolution') {
            return Math.max(Number(row.performance_2024 || 0), Number(row.performance_2025 || 0));
        }
        return Number(row.performance_value || 0);
    });
    const maxValue = values.length ? Math.max.apply(null, values) : 0;
    return Math.max(100, Math.ceil((maxValue + 5) / 10) * 10);
}

function buildPlayerModuleTitle(view) {
    if (!view) return '<i class="fas fa-chart-line"></i> Top 5 jugadores con mayor mejora 2024 -> 2025';
    const iconClass = view.mode === 'single-year' ? 'fas fa-list-ol' : 'fas fa-chart-line';
    return `<i class="${iconClass}"></i> ${view.title}`;
}

function buildPlayerModuleTooltipLines(view, row) {
    if (!view || !row) return [];

    if (view.mode === 'evolution') {
        const lines = [`País: ${row.nationality || 'N/A'}`];
        if (row.team_2024 && row.team_2025 && normalizeText(row.team_2024) !== normalizeText(row.team_2025)) {
            lines.push(`Equipo 2024: ${row.team_2024}`);
            lines.push(`Equipo 2025: ${row.team_2025}`);
        } else {
            const team = row.team_2025 || row.team_2024;
            if (team) lines.push(`Equipo: ${team}`);
        }
        lines.push(`Rendimiento 2024: ${formatPercentValue(row.performance_2024)}`);
        lines.push(`Rendimiento 2025: ${formatPercentValue(row.performance_2025)}`);
        lines.push(`Mejora %: ${formatSignedPercentValue(row.improvement_pct)}`);
        return lines;
    }

    const singleYearLines = [
        `País: ${row.nationality || 'N/A'}`,
        `Equipo: ${row.display_team || row.team || 'N/A'}`
    ];
    if (row.competition_name) {
        singleYearLines.push(`Competencia: ${row.competition_name}`);
    }
    if (row.competition_year) {
        singleYearLines.push(`Año: ${row.competition_year}`);
    }
    singleYearLines.push(`Rendimiento: ${formatPercentValue(row.performance_value)}`);
    if (row.rank != null) {
        singleYearLines.push(`Posición del ranking: #${row.rank}`);
    }
    return singleYearLines;
}

function buildPlayerModuleChartModel(view) {
    const rows = Array.isArray(view?.rows) ? view.rows : [];
    const rowLabels = rows.map(function (row) {
        return row.display_name || toProperCase(row.name);
    });
    const axisMax = computePlayerModuleAxisMax(rows, view?.mode);

    if (!rows.length) {
        return {
            rowLabels: [],
            xMax: axisMax,
            datasets: []
        };
    }

    if (view.mode === 'evolution') {
        return {
            rowLabels: rowLabels,
            xMax: axisMax,
            hideRowLabels: rows.length === 1,
            datasets: [
                {
                    label: 'Rendimiento 2024',
                    data: rows.map(function (row, index) {
                        return { x: Number(row.performance_2024), y: index };
                    }),
                    rows: rows,
                    showLine: false,
                    pointRadius: 7,
                    pointHoverRadius: 8,
                    pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Rendimiento 2025',
                    data: rows.map(function (row, index) {
                        return { x: Number(row.performance_2025), y: index };
                    }),
                    rows: rows,
                    showLine: false,
                    pointRadius: 7,
                    pointHoverRadius: 8,
                    pointStyle: 'triangle',
                    pointBackgroundColor: 'rgba(0, 212, 255, 1)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }
            ]
        };
    }

    return {
        rowLabels: rowLabels,
        xMax: axisMax,
        hideRowLabels: rows.length === 1,
        datasets: [
            {
                label: 'Rendimiento',
                data: rows.map(function (row, index) {
                    return { x: Number(row.performance_value), y: index };
                }),
                rows: rows,
                showLine: false,
                pointRadius: 7,
                pointHoverRadius: 8,
                pointBackgroundColor: rows.map(function (row) {
                    return (row.rank === 1)
                        ? 'rgba(0, 212, 255, 1)'
                        : (row.rank === 2)
                            ? 'rgba(139, 92, 246, 1)'
                            : 'rgba(16, 185, 129, 1)';
                }),
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }
        ]
    };
}

function buildPlayerModuleTableModel(view) {
    if (!view || view.mode === 'empty') {
        return {
            headers: ['Jugador', 'Detalle'],
            rows: [],
            emptyState: view?.emptyState || { message: 'Sin datos para este filtro', hint: '' }
        };
    }

    if (view.mode === 'evolution') {
        return {
            headers: ['Jugador', '2024', '2025', 'Mejora %'],
            rows: view.rows.map(function (row) {
                return [
                    `<strong>${row.display_name}</strong>`,
                    formatPercentValue(row.performance_2024),
                    formatPercentValue(row.performance_2025),
                    `<span class="trend-indicator ${Number(row.improvement_pct || 0) >= 0 ? 'up' : 'down'}">${formatSignedPercentValue(row.improvement_pct)}</span>`
                ];
            }),
            emptyState: null
        };
    }

    return {
        headers: ['Jugador', 'País', 'Equipo', 'Rendimiento'],
        rows: view.rows.map(function (row) {
            return [
                `<strong>${row.display_name}</strong>`,
                `${countryFlag(row.nationality)} ${row.nationality || 'N/A'}`,
                row.display_team || row.team || 'N/A',
                formatPercentValue(row.performance_value)
            ];
        }),
        emptyState: null
    };
}

function buildPlayerModuleViewModel(filters = {}) {
    const resolvedFilters = getPlayerModuleFilters(filters);
    const baseRows = cloneList(currentData?.player_evolution);
    const exactPlayerName = resolveExactPlayerName(resolvedFilters.search, dashboardData);
    const contextExactRows = exactPlayerName
        ? baseRows.filter(function (row) {
            return normalizeText(row.name) === normalizeText(exactPlayerName);
        })
        : [];

    if (exactPlayerName && contextExactRows.length === 0) {
        return {
            mode: 'empty',
            title: `Rendimiento de ${toProperCase(exactPlayerName)}`,
            emptyState: {
                message: PLAYER_MODULE_COPY.emptyState.noPlayerData,
                hint: ''
            },
            rows: [],
            chartModel: { rowLabels: [], xMax: 100, datasets: [] },
            tableModel: null,
            tooltipMode: 'empty',
            selectedPlayer: exactPlayerName
        };
    }

    if (exactPlayerName && contextExactRows.length > 0) {
        const selectedRow = contextExactRows[0];
        if (!resolvedFilters.competition && hasComparablePlayerYears(selectedRow)) {
            const rows = buildPlayerModuleEvolutionRows([selectedRow], 1);
            const view = {
                mode: 'evolution',
                title: `Evolución de ${toProperCase(exactPlayerName)}: 2024 -> 2025`,
                emptyState: null,
                rows: rows,
                tooltipMode: 'evolution',
                selectedPlayer: exactPlayerName
            };
            view.chartModel = buildPlayerModuleChartModel(view);
            view.tableModel = buildPlayerModuleTableModel(view);
            return view;
        }

        const rows = buildPlayerModuleSingleYearRows([selectedRow], 1);
        const view = {
            mode: rows.length ? 'single-year' : 'empty',
            title: rows.length
                ? (resolvedFilters.competition
                    ? `Rendimiento de ${toProperCase(exactPlayerName)} en ${resolvedFilters.competition}`
                    : `Rendimiento disponible de ${toProperCase(exactPlayerName)}`)
                : `Rendimiento de ${toProperCase(exactPlayerName)}`,
            emptyState: rows.length ? null : {
                message: PLAYER_MODULE_COPY.emptyState.noPlayerData,
                hint: ''
            },
            rows: rows,
            tooltipMode: rows.length ? 'single-year' : 'empty',
            selectedPlayer: exactPlayerName
        };
        view.chartModel = buildPlayerModuleChartModel(view);
        view.tableModel = buildPlayerModuleTableModel(view);
        return view;
    }

    if (resolvedFilters.competition) {
        const rows = buildPlayerModuleSingleYearRows(baseRows, 5);
        const isSingleRowDetail = rows.length === 1;
        const view = {
            mode: rows.length ? 'single-year' : 'empty',
            title: rows.length
                ? (isSingleRowDetail
                    ? `Rendimiento de ${rows[0].display_name} en ${resolvedFilters.competition}`
                    : (resolvedFilters.country
                        ? `Top jugadores de ${resolvedFilters.country} en ${resolvedFilters.competition}`
                        : `Top 5 jugadores por rendimiento en ${resolvedFilters.competition}`))
                : (resolvedFilters.country
                    ? `Top jugadores de ${resolvedFilters.country} en ${resolvedFilters.competition}`
                    : `Top 5 jugadores por rendimiento en ${resolvedFilters.competition}`),
            emptyState: rows.length ? null : {
                message: PLAYER_MODULE_COPY.emptyState.noSingleYearData,
                hint: ''
            },
            rows: rows,
            tooltipMode: rows.length ? 'single-year' : 'empty',
            selectedPlayer: null
        };
        view.chartModel = buildPlayerModuleChartModel(view);
        view.tableModel = buildPlayerModuleTableModel(view);
        return view;
    }

    const comparableRows = baseRows.filter(hasComparablePlayerYears);
    const positiveRows = comparableRows.filter(hasPositiveImprovement);
    if (!comparableRows.length) {
        const view = {
            mode: 'empty',
            title: resolvedFilters.country
                ? `Top jugadores de ${resolvedFilters.country} con mayor mejora 2024 -> 2025`
                : 'Top 5 jugadores con mayor mejora 2024 -> 2025',
            emptyState: {
                message: PLAYER_MODULE_COPY.emptyState.comparable,
                hint: resolvedFilters.country ? PLAYER_MODULE_COPY.emptyState.comparableHint : ''
            },
            rows: [],
            tooltipMode: 'empty',
            selectedPlayer: null
        };
        view.chartModel = buildPlayerModuleChartModel(view);
        view.tableModel = buildPlayerModuleTableModel(view);
        return view;
    }

    if (!positiveRows.length) {
        const view = {
            mode: 'empty',
            title: resolvedFilters.country
                ? `Top jugadores de ${resolvedFilters.country} con mayor mejora 2024 -> 2025`
                : 'Top 5 jugadores con mayor mejora 2024 -> 2025',
            emptyState: {
                message: PLAYER_MODULE_COPY.emptyState.positiveOnly,
                hint: resolvedFilters.country ? PLAYER_MODULE_COPY.emptyState.comparableHint : ''
            },
            rows: [],
            tooltipMode: 'empty',
            selectedPlayer: null
        };
        view.chartModel = buildPlayerModuleChartModel(view);
        view.tableModel = buildPlayerModuleTableModel(view);
        return view;
    }

    const rows = buildPlayerModuleEvolutionRows(positiveRows, 5);
    const view = {
        mode: 'evolution',
        title: resolvedFilters.country
            ? `Top jugadores de ${resolvedFilters.country} con mayor mejora 2024 -> 2025`
            : 'Top 5 jugadores con mayor mejora 2024 -> 2025',
        emptyState: null,
        rows: rows,
        tooltipMode: 'evolution',
        selectedPlayer: null
    };
    view.chartModel = buildPlayerModuleChartModel(view);
    view.tableModel = buildPlayerModuleTableModel(view);
    return view;
}

function renderPlayerModuleTitle(view) {
    const chartTitleEl = document.getElementById('evolutionChartTitle');
    if (chartTitleEl) {
        chartTitleEl.innerHTML = buildPlayerModuleTitle(view);
    }
}

function updateCountryChart() {
    if (!charts.countryChart) {
        createCountryChart();
        return;
    }
    const selectedCountry = document.getElementById('filter-country')?.value || '';
    const { labels, data, bgColors, borderColors } = buildCountryChartData(selectedCountry);
    const chart = charts.countryChart;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = bgColors;
    chart.data.datasets[0].borderColor = borderColors;
    chart.update();
}

function createCountryChart() {
    const canvas = document.getElementById('countryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const selectedCountry = document.getElementById('filter-country')?.value || '';

    // Custom Plugin for Center Text
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: function (chart) {
            if (chart.config.type !== 'doughnut') return;
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);

            if (!meta.data.length) return;

            const centerX = meta.data[0].x;
            const centerY = meta.data[0].y;

            ctx.restore();
            const fontSize = (chart.height / 140).toFixed(2);
            ctx.font = `bold ${fontSize}em Inter`;
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#ffffff";

            const total = (currentData && currentData.main_kpis) ? currentData.main_kpis.total_teams : chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const text = total.toLocaleString('es-ES');
            const textWidth = ctx.measureText(text).width;

            ctx.fillText(text, centerX - (textWidth / 2), centerY - 10);

            ctx.font = `normal ${(fontSize * 0.35).toFixed(2)}em Inter`;
            ctx.fillStyle = "#94a3b8";
            const subtitle = "Equipos";
            const subWidth = ctx.measureText(subtitle).width;
            ctx.fillText(subtitle, centerX - (subWidth / 2), centerY + 20);

            ctx.save();
        }
    };

    const { labels, data, bgColors, borderColors } = buildCountryChartData(selectedCountry);

    charts.countryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        plugins: [centerTextPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                emptyState: {
                    message: 'Sin datos para este filtro'
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 20,
                        font: { family: 'Inter', size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#00d4ff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(139, 92, 246, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        title: function (tooltipItems) {
                            return tooltipItems[0]?.label || '';
                        },
                        label: function () {
                            return null;
                        },
                        afterBody: function (tooltipItems) {
                            const tooltipItem = tooltipItems[0];
                            const dataIndex = tooltipItem?.dataIndex ?? -1;
                            const countryRow = Array.isArray(currentData?.country_ranking)
                                ? currentData.country_ranking[dataIndex]
                                : null;
                            return buildCountryTooltipLines(countryRow);
                        }
                    }
                }
            }
        }
    });
}

function updatePrizesChart() {
    if (!charts.prizesChart) {
        createPrizesChart();
        return;
    }
    const chart = charts.prizesChart;
    const model = buildPrizesChartModel();

    chart.data.labels = model.rankLabels;
    chart.data.datasets[0].data = model.prizes;
    chart.data.datasets[0].backgroundColor = model.backgroundColors;
    chart.data.datasets[0].borderColor = model.borderColors;
    chart.data.datasets[0].countryNames = model.countryNames;
    chart.data.datasets[0].rows = model.rows;
    chart.update();
}

function createPrizesChart() {
    const canvas = document.getElementById('prizesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const model = buildPrizesChartModel();

    charts.prizesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: model.rankLabels,
            datasets: [{
                label: 'Premios Totales ($)',
                data: model.prizes,
                backgroundColor: model.backgroundColors,
                borderColor: model.borderColors,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                minBarLength: 6,
                countryNames: model.countryNames,
                rows: model.rows
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                emptyState: {
                    message: 'Sin datos de premios para este filtro'
                },
                zeroPrizeAnnotation: {
                    enabled: true
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#00d4ff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(139, 92, 246, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        title: function (tooltipItems) {
                            const chartDataset = tooltipItems[0].chart.data.datasets[tooltipItems[0].datasetIndex];
                            return chartDataset.countryNames[tooltipItems[0].dataIndex];
                        },
                        label: function () {
                            return null;
                        },
                        afterBody: function (tooltipItems) {
                            const tooltipItem = tooltipItems[0];
                            const chartDataset = tooltipItem.chart.data.datasets[tooltipItem.datasetIndex];
                            const countryRow = Array.isArray(chartDataset.rows)
                                ? chartDataset.rows[tooltipItem.dataIndex]
                                : null;
                            return buildPrizesTooltipLines(countryRow);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter' },
                        callback: function (value) {
                            return '$' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        autoSkip: false,
                        color: '#f8fafc',
                        font: { family: 'Inter', weight: 'bold' }
                    }
                }
            }
        }
    });
}

function updateEvolutionChart() {
    createEvolutionChart();
}

function createEvolutionChart() {
    const canvas = document.getElementById('evolutionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const view = currentPlayerModuleView || buildPlayerModuleViewModel();
    currentPlayerModuleView = view;

    if (charts.evolutionChart && typeof charts.evolutionChart.destroy === 'function') {
        charts.evolutionChart.destroy();
    }

    charts.evolutionChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            labels: view.chartModel.rowLabels,
            datasets: view.chartModel.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                emptyState: {
                    message: view.emptyState?.message || 'Sin datos para este filtro',
                    hint: view.emptyState?.hint || ''
                },
                playerModule: {
                    mode: view.mode,
                    rows: view.rows,
                    rowLabels: view.chartModel.rowLabels
                },
                legend: {
                    display: view.mode === 'evolution' && view.rows.length > 0,
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(0, 212, 255, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        title: function (context) {
                            const row = currentPlayerModuleView?.rows?.[context[0]?.dataIndex];
                            return row?.display_name || '';
                        },
                        label: function () {
                            return null;
                        },
                        afterBody: function (context) {
                            const row = currentPlayerModuleView?.rows?.[context[0]?.dataIndex];
                            return buildPlayerModuleTooltipLines(currentPlayerModuleView, row);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: view.chartModel.xMax,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function (value) {
                            return `${value}%`;
                        }
                    }
                },
                y: {
                    type: 'linear',
                    min: view.rows.length ? -0.5 : 0,
                    max: view.rows.length ? view.rows.length - 0.5 : 1,
                    reverse: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#f8fafc',
                        stepSize: 1,
                        autoSkip: false,
                        callback: function (value) {
                            const rounded = Math.round(value);
                            if (Math.abs(value - rounded) > 0.001) return '';
                            if (currentPlayerModuleView?.chartModel?.hideRowLabels) return '';
                            const label = currentPlayerModuleView?.chartModel?.rowLabels?.[rounded] || '';
                            return truncatePlayerModuleLabel(label, getPlayerModuleChartLabelLimit(this.chart?.width));
                        }
                    }
                }
            }
        }
    });
}

// ===== TABLES =====
function populateTables() {
    renderContextualTable(buildContextualTableViewModel());
}

function populateCountryRankingTable() {
    const tbody = document.querySelector('#country-ranking-table tbody');
    const countries = currentData.country_ranking;
    const maxPrize = Math.max(...countries.map(c => c.total_prizes));

    if (countries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted"><i class="fas fa-ghost fa-2x mb-3 d-block opacity-25"></i><span class="small">No se encontraron datos para estos filtros</span></td></tr>`;
        return;
    }

    tbody.innerHTML = countries.map(country => `
        <tr>
            <td>
                <strong>${countryFlag(country.country)} ${country.country}</strong>
            </td>
            <td>${country.total_teams}</td>
            <td>$${country.total_prizes.toLocaleString()}</td>
            <td>
                <div class="progress-bar-custom">
                    <div class="progress-fill" style="width: ${(country.total_prizes / maxPrize) * 100}%"></div>
                </div>
            </td>
        </tr>
    `).join('');
}

function populateTopTeamsTable() {
    const tbody = document.querySelector('#top-teams-table tbody');
    const teams = currentData.top_teams.slice(0, 5);

    if (teams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted"><i class="fas fa-ghost fa-2x mb-3 d-block opacity-25"></i><span class="small">No se encontraron datos para estos filtros</span></td></tr>`;
        return;
    }

    tbody.innerHTML = teams.map(team => {
        const position = Number(team.average_position || 0);
        const positionLabel = position > 0 ? `#${position}` : 'N/A';
        const badgeClass = position > 0 ? 'excellent' : 'neutral';
        return `
        <tr>
            <td><strong>${team.name}</strong></td>
            <td>${countryFlag(team.country)} ${team.country}</td>
            <td>$${team.total_prizes.toLocaleString()}</td>
            <td>
                <span class="performance-badge ${badgeClass}">${positionLabel}</span>
            </td>
        </tr>
    `;
    }).join('');
}

function populateTopPlayersTable() {
    const tbody = document.querySelector('#top-players-table tbody');
    const players = currentData.top_players_2024.slice(0, 5);

    if (players.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted"><i class="fas fa-ghost fa-2x mb-3 d-block opacity-25"></i><span class="small">No se encontraron datos para estos filtros</span></td></tr>`;
        return;
    }

    tbody.innerHTML = players.map(player => {
        const perf = player.performance_2024;
        const perfLabel = perf != null ? `${perf.toFixed(1)}%` : 'N/A';
        const perfBadge = perf != null
            ? `<span class="performance-badge ${getPerformanceBadgeClass(perf)}">${getPerformanceRating(perf)}</span>`
            : '<span class="trend-indicator neutral">N/A</span>';

        return `
        <tr>
            <td><strong>${player.name}</strong></td>
            <td>${countryFlag(player.nationality)} ${player.nationality}</td>
            <td>${perfLabel}</td>
            <td>${perfBadge}</td>
        </tr>
    `;
    }).join('');
}

function populatePlayerEvolutionTable() {
    const tbody = document.querySelector('#player-evolution-table tbody');
    const theadRow = document.querySelector('#player-evolution-table thead tr');
    const view = currentPlayerModuleView || buildPlayerModuleViewModel();
    currentPlayerModuleView = view;
    const tableModel = view.tableModel || buildPlayerModuleTableModel(view);

    if (theadRow) {
        theadRow.innerHTML = tableModel.headers.map(function (header) {
            return `<th>${header}</th>`;
        }).join('');
    }

    if (!tableModel.rows.length) {
        const hintMarkup = tableModel.emptyState?.hint
            ? `<span class="small d-block mt-2">${tableModel.emptyState.hint}</span>`
            : '';
        tbody.innerHTML = `<tr><td colspan="${tableModel.headers.length}" class="text-center py-5 text-muted"><i class="fas fa-ghost fa-2x mb-3 d-block opacity-25"></i><span class="small d-block">${tableModel.emptyState?.message || 'Sin datos para este filtro'}</span>${hintMarkup}</td></tr>`;
        return;
    }

    tbody.innerHTML = tableModel.rows.map(function (cells) {
        return `<tr>${cells.map(function (cell) {
            return `<td>${cell}</td>`;
        }).join('')}</tr>`;
    }).join('');
}

// ===== COMPETITIONS =====
function renderCompetitionSection(viewModel) {
    const titleEl = document.getElementById('competitions-section-title');
    const subtitleEl = document.getElementById('competitions-section-subtitle');
    const contentEl = document.getElementById('competitions-content');
    if (!contentEl) return;

    const view = viewModel || buildCompetitionSectionEmptyView();
    if (titleEl) titleEl.textContent = view.title || COMPETITION_SECTION_COPY.titles.global;
    if (subtitleEl) {
        subtitleEl.textContent = view.subtitle || '';
        subtitleEl.hidden = !view.subtitle;
    }

    if (view.mode === 'empty') {
        contentEl.innerHTML = `
            <div class="competition-card competitions-empty-state fade-in-up text-center py-5 text-muted">
                <i class="fas fa-ghost fa-2x mb-3 d-block opacity-25" aria-hidden="true"></i>
                <span class="small d-block">${escapeCompetitionSectionText(view.emptyState?.message || 'Sin datos para este filtro')}</span>
            </div>
        `;
        return;
    }

    if (view.mode === 'spotlight' && view.spotlight) {
        const spotlight = view.spotlight;
        const countryParticipation = view.countryParticipation;
        const averageAge = Number(spotlight.averageAge);
        const averageAgeLabel = spotlight.averageAge === null || spotlight.averageAge === undefined || Number.isNaN(averageAge)
            ? 'Sin dato'
            : `${escapeCompetitionSectionText(averageAge.toFixed(1))} a\u00f1os`;
        const bestPositionLabel = countryParticipation && countryParticipation.bestPosition !== null && countryParticipation.bestPosition !== undefined
            ? escapeCompetitionSectionText(String(safeNumericValue(countryParticipation.bestPosition)))
            : 'Sin clasificación final';

        contentEl.innerHTML = `
            <article class="competition-card competition-card--spotlight competition-spotlight-card fade-in-up">
                <div class="competition-header competition-header--spotlight">
                    <div class="competition-header__main">
                        <span class="competition-card__eyebrow">Competencia seleccionada</span>
                        <h4 class="competition-title">${escapeCompetitionSectionText(spotlight.name)}</h4>
                    </div>
                    <div class="competition-header__meta">
                        <span class="competition-badge ${normalizeCompetitionTypeClass(spotlight.type)}">${escapeCompetitionSectionText(spotlight.type)}</span>
                        <span class="competition-year">${escapeCompetitionSectionText(spotlight.year)}</span>
                    </div>
                </div>
                <div class="competition-context-row">
                    <div class="competition-detail competition-detail--spotlight">
                        <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                        <span>${escapeCompetitionSectionText(spotlight.location)}</span>
                    </div>
                </div>
                <div class="competition-spotlight-metrics competition-spotlight-metrics--primary">
                    <div class="competition-spotlight-stat">
                        <span class="competition-spotlight-label">Equipos</span>
                        <strong class="competition-spotlight-value">${escapeCompetitionSectionText(spotlight.participatingTeams)}</strong>
                    </div>
                    <div class="competition-spotlight-stat">
                        <span class="competition-spotlight-label">Jugadores</span>
                        <strong class="competition-spotlight-value">${escapeCompetitionSectionText(spotlight.totalPlayers)}</strong>
                    </div>
                    <div class="competition-spotlight-stat">
                        <span class="competition-spotlight-label">Premios</span>
                        <strong class="competition-spotlight-value">${escapeCompetitionSectionText(formatCurrencyValue(spotlight.totalPrize))}</strong>
                    </div>
                    <div class="competition-spotlight-stat">
                        <span class="competition-spotlight-label">Edad promedio</span>
                        <strong class="competition-spotlight-value">${averageAgeLabel}</strong>
                    </div>
                </div>
                ${countryParticipation ? `
                    <section class="competition-country-panel">
                        <div class="competition-country-panel__header">
                            <h5 class="competition-country-panel__title">Participación de ${escapeCompetitionSectionText(countryParticipation.country)}</h5>
                        </div>
                        <div class="competition-country-panel__metrics">
                            <div class="competition-spotlight-stat competition-country-panel__stat">
                                <span class="competition-spotlight-label">Equipos del país</span>
                                <strong class="competition-spotlight-value">${escapeCompetitionSectionText(String(safeNumericValue(countryParticipation.teams)))}</strong>
                            </div>
                            <div class="competition-spotlight-stat competition-country-panel__stat">
                                <span class="competition-spotlight-label">Jugadores del país</span>
                                <strong class="competition-spotlight-value">${escapeCompetitionSectionText(String(safeNumericValue(countryParticipation.players)))}</strong>
                            </div>
                            <div class="competition-spotlight-stat competition-country-panel__stat">
                                <span class="competition-spotlight-label">Premios del país</span>
                                <strong class="competition-spotlight-value">${escapeCompetitionSectionText(formatCurrencyValue(countryParticipation.totalPrizes))}</strong>
                            </div>
                            <div class="competition-spotlight-stat competition-country-panel__stat">
                                <span class="competition-spotlight-label">Mejor puesto</span>
                                <strong class="competition-spotlight-value">${bestPositionLabel}</strong>
                            </div>
                        </div>
                    </section>
                ` : ''}
            </article>
        `;
        return;
    }

    contentEl.innerHTML = `
        <div class="competitions-catalog-grid">
            ${view.items.map(function (item) {
                return `
                    <article class="competition-card competition-card--catalog fade-in-up">
                        <div class="competition-header">
                            <div class="competition-header__main">
                                <span class="competition-card__eyebrow">${escapeCompetitionSectionText(item.year)}</span>
                                <h4 class="competition-title">${escapeCompetitionSectionText(item.name)}</h4>
                            </div>
                            <span class="competition-badge ${normalizeCompetitionTypeClass(item.type)}">${escapeCompetitionSectionText(item.type)}</span>
                        </div>
                        <div class="competition-card__meta">
                            <div class="competition-detail">
                                <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                                <span>${escapeCompetitionSectionText(item.location)}</span>
                            </div>
                            <div class="competition-detail">
                                <i class="fas fa-users" aria-hidden="true"></i>
                                <span>${escapeCompetitionSectionText(item.participatingTeams)} equipos</span>
                            </div>
                        </div>
                        <div class="competition-card__footer">
                            <span class="competition-card__footer-label">Premios</span>
                            <span class="prize-amount">${escapeCompetitionSectionText(formatCurrencyValue(item.totalPrize))}</span>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function populateCompetitions(filters = {}) {
    renderCompetitionSection(buildCompetitionSectionViewModel(filters));
}

// ===== GLOBAL SUMMARY =====
function populateInsights(filters = {}) {
    renderGlobalSummary(buildGlobalSummaryViewModel(filters));
}

// ===== SQUAD USAGE SECTION =====
function populateSquadUsageSection(filters = {}) {
    currentSquadUsageView = buildSquadUsageViewModel(filters);
    renderSquadUsageSection(currentSquadUsageView);
}

function getActiveSquadUsageViewModel() {
    return currentSquadUsageView || buildSquadUsageViewModel(getSquadUsageFilters());
}

function updateSquadUsageChart() {
    destroySquadUsageChart();
}

function createSquadUsageChart() {
    destroySquadUsageChart();
}


// ===== TEAM COMPARISON SECTION =====
function getTeamComparisonFilters(filters = {}) {
    return {
        country: filters.country !== undefined
            ? filters.country
            : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined
            ? filters.competition
            : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined
            ? filters.search
            : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function resolveTeamComparisonContext(filters) {
    if (filters.country && filters.competition) return 'country_competition';
    if (filters.country) return 'country';
    if (filters.competition) return 'competition';
    return 'global';
}

function getTeamComparisonContextLabel(context, filters) {
    if (context === 'country') return TEAM_COMPARISON_COPY.contextLabels.country(filters.country);
    if (context === 'competition') return TEAM_COMPARISON_COPY.contextLabels.competition(filters.competition);
    if (context === 'country_competition') return TEAM_COMPARISON_COPY.contextLabels.countryCompetition(filters.country, filters.competition);
    return TEAM_COMPARISON_COPY.contextLabels.global;
}

function formatTeamComparisonPercentValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return TEAM_COMPARISON_COPY.noVictoryData;
    }
    return `${Number(value).toFixed(1)}%`;
}

function formatTeamComparisonPrizeShareValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return TEAM_COMPARISON_COPY.noData;
    }
    return `${Number(value).toFixed(1)}%`;
}

function formatTeamComparisonPlainValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return TEAM_COMPARISON_COPY.noData;
    }
    return Number(value).toFixed(1);
}

function formatTeamComparisonScoreValue(value) {
    const plainValue = formatTeamComparisonPlainValue(value);
    if (plainValue === TEAM_COMPARISON_COPY.noData) {
        return plainValue;
    }
    return `${plainValue} pts`;
}

function formatTeamComparisonPosition(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return TEAM_COMPARISON_COPY.noPositionData;
    }
    const numeric = Number(value);
    return Number.isInteger(numeric) ? `#${numeric}` : `#${numeric.toFixed(1)}`;
}

function getTeamComparisonLeaderLabel(itemKey, context) {
    if (itemKey === 'best_prize' && (context === 'country' || context === 'country_competition')) {
        return 'Equipo con más premios';
    }
    const matchedLeader = TEAM_COMPARISON_COPY.leaders.find(function (leader) {
        return leader.key === itemKey;
    });
    return matchedLeader ? matchedLeader.label : TEAM_COMPARISON_COPY.noData;
}

function buildTeamComparisonLeaderDescription(itemKey, context, formattedValue, filters = {}) {
    if (itemKey === 'best_teamwork') {
        return 'Puntaje promedio más alto del contexto';
    }
    if (itemKey === 'best_victory') {
        return formattedValue === TEAM_COMPARISON_COPY.noVictoryData
            ? 'No hay victorias registradas en este contexto'
            : 'Mayor porcentaje de victorias registrado';
    }
    if (itemKey === 'best_results') {
        if (formattedValue === TEAM_COMPARISON_COPY.noPositionData) {
            return 'No hay puesto final registrado en este contexto';
        }
        return context === 'competition' || context === 'country_competition'
            ? 'Mejor puesto final registrado'
            : 'Mejor puesto promedio en el contexto';
    }
    if (itemKey === 'best_prize') {
        return formattedValue === TEAM_COMPARISON_COPY.noData
            ? 'Sin premios registrados en este contexto'
            : context === 'competition'
                ? `Se llevó el ${formattedValue} del premio total de esta competencia`
                : context === 'country'
                    ? `Concentró el ${formattedValue} de los premios de ${filters.country}`
                    : context === 'country_competition'
                        ? `Concentró el ${formattedValue} de los premios de ${filters.country} en ${filters.competition}`
                        : `Se llevó el ${formattedValue} del premio total del contexto`;
    }
    return '';
}

function buildTeamComparisonLeaders(leaders, rows, context, filters = {}) {
    const source = leaders || {};
    const safeRows = Array.isArray(rows) ? rows : [];

    function findRow(team) {
        return safeRows.find(function (row) {
            return row.team === team;
        }) || null;
    }

    return TEAM_COMPARISON_COPY.leaders.map(function (item) {
        let team = TEAM_COMPARISON_COPY.noData;
        let rawValue = null;
        let formattedValue = TEAM_COMPARISON_COPY.noData;
        let matchedRow = null;

        if (item.key === 'best_teamwork') {
            team = source.best_teamwork_team || TEAM_COMPARISON_COPY.noData;
            rawValue = source.best_teamwork_score;
            matchedRow = findRow(team);
            formattedValue = matchedRow?.teamworkScoreLabel || formatTeamComparisonScoreValue(rawValue);
        } else if (item.key === 'best_victory') {
            team = source.best_victory_team || TEAM_COMPARISON_COPY.noData;
            rawValue = source.best_victory_rate_pct;
            matchedRow = findRow(team);
            formattedValue = matchedRow?.victoryRateLabel || formatTeamComparisonPercentValue(rawValue);
        } else if (item.key === 'best_results') {
            team = source.best_results_team || TEAM_COMPARISON_COPY.noData;
            rawValue = source.best_results_score;
            matchedRow = findRow(team);
            formattedValue = matchedRow
                ? ((context === 'competition' || context === 'country_competition') ? matchedRow.competitionResultLabel : matchedRow.positionLabel)
                : TEAM_COMPARISON_COPY.noPositionData;
        } else if (item.key === 'best_prize') {
            team = source.best_prize_team || TEAM_COMPARISON_COPY.noData;
            rawValue = source.best_prize_share_pct;
            matchedRow = findRow(team);
            formattedValue = matchedRow?.prizeShareLabel || formatTeamComparisonPrizeShareValue(rawValue);
        }

        return {
            label: getTeamComparisonLeaderLabel(item.key, context),
            team: team,
            value: formattedValue,
            description: buildTeamComparisonLeaderDescription(item.key, context, formattedValue, filters),
            tone: item.tone,
            icon: item.icon,
            rawValue: rawValue
        };
    });
}

function buildTeamComparisonRows(profiles) {
    return cloneList(profiles).map(function (row) {
        return {
            team: row?.team || '',
            country: row?.country || '',
            competitionsCount: safeNumericValue(row?.competitions_count),
            competitionsCountLabel: String(safeNumericValue(row?.competitions_count)),
            teamworkScore: safeNumericValue(row?.teamwork_score),
            teamworkScoreLabel: formatTeamComparisonScoreValue(row?.teamwork_score),
            victoryRatePct: safeOptionalNumericValue(row?.victory_rate_pct),
            victoryRateLabel: formatTeamComparisonPercentValue(row?.victory_rate_pct),
            positionMetric: safeOptionalNumericValue(row?.position_metric),
            positionLabel: formatTeamComparisonPosition(row?.position_metric),
            resultsScore: safeOptionalNumericValue(row?.results_score),
            prizeAmount: safeNumericValue(row?.prize_amount),
            prizeAmountLabel: formatCurrencyValue(row?.prize_amount),
            prizeSharePct: safeOptionalNumericValue(row?.prize_share_pct),
            prizeShareLabel: formatTeamComparisonPrizeShareValue(row?.prize_share_pct),
            competitionName: row?.competition_name || '',
            competitionResult: safeOptionalNumericValue(row?.competition_result),
            competitionResultLabel: formatTeamComparisonPosition(row?.competition_result),
            titlesCount: safeNumericValue(row?.titles_count),
            podiumCount: safeNumericValue(row?.podium_count),
            comparisonScore: safeNumericValue(row?.comparison_score)
        };
    }).sort(function (left, right) {
        if (right.comparisonScore !== left.comparisonScore) {
            return right.comparisonScore - left.comparisonScore;
        }
        return String(left.team || '').localeCompare(String(right.team || ''), 'es');
    });
}

function getTeamComparisonTableColumns(context) {
    if (context === 'country') return TEAM_COMPARISON_COPY.tableColumns.country;
    if (context === 'competition') return TEAM_COMPARISON_COPY.tableColumns.competition;
    if (context === 'country_competition') return TEAM_COMPARISON_COPY.tableColumns.countryCompetition;
    return TEAM_COMPARISON_COPY.tableColumns.global;
}

function getTeamComparisonTableTitle(context, filters) {
    if (context === 'country') return TEAM_COMPARISON_COPY.tableTitles.country(filters.country);
    if (context === 'competition') return TEAM_COMPARISON_COPY.tableTitles.competition(filters.competition);
    if (context === 'country_competition') return TEAM_COMPARISON_COPY.tableTitles.countryCompetition(filters.country, filters.competition);
    return TEAM_COMPARISON_COPY.tableTitles.global;
}

function buildTeamComparisonTableModel(rows, context, filters) {
    return {
        title: getTeamComparisonTableTitle(context, filters),
        columns: getTeamComparisonTableColumns(context),
        rows: rows
    };
}

function buildTeamComparisonProfileModel(row, context) {
    return {
        team: row.team,
        country: row.country,
        context: context,
        summary: TEAM_COMPARISON_COPY.profile.summary,
        metrics: context === 'competition' || context === 'country_competition'
            ? [
                { label: '% de victorias', value: row.victoryRateLabel },
                { label: 'Trabajo en equipo', value: row.teamworkScoreLabel },
                { label: 'Resultado en la competencia', value: row.competitionResultLabel },
                { label: 'Premios', value: row.prizeAmountLabel }
            ]
            : [
                { label: 'Competiciones', value: row.competitionsCountLabel },
                { label: '% de victorias', value: row.victoryRateLabel },
                { label: 'Trabajo en equipo', value: row.teamworkScoreLabel },
                { label: 'Mejor puesto', value: row.positionLabel },
                { label: 'Premios', value: row.prizeAmountLabel }
            ]
    };
}

function buildTeamComparisonViewModel(filters = {}) {
    const resolvedFilters = getTeamComparisonFilters(filters);
    const context = resolveTeamComparisonContext(resolvedFilters);
    const profiles = Array.isArray(currentData?.team_comparison_profiles) ? currentData.team_comparison_profiles : [];
    const rows = buildTeamComparisonRows(profiles);
    const leaders = buildTeamComparisonLeaders(currentData?.team_comparison_leaders || {}, rows, context, resolvedFilters);

    if (!rows.length) {
        return {
            visible: true,
            context: context,
            title: TEAM_COMPARISON_COPY.title,
            subtitle: TEAM_COMPARISON_COPY.subtitle,
            contextLabel: getTeamComparisonContextLabel(context, resolvedFilters),
            leaders: leaders,
            profileMode: null,
            compareMode: null,
            radarModel: null,
            tableModel: null,
            emptyState: {
                message: TEAM_COMPARISON_COPY.empty
            }
        };
    }

    const compareMode = rows.length >= 2 ? {
        teamCount: rows.length,
        selectedCount: Math.min(rows.length, 3)
    } : null;
    const profileMode = rows.length === 1 ? buildTeamComparisonProfileModel(rows[0], context) : null;

    return {
        visible: true,
        context: context,
        title: TEAM_COMPARISON_COPY.title,
        subtitle: TEAM_COMPARISON_COPY.subtitle,
        contextLabel: getTeamComparisonContextLabel(context, resolvedFilters),
        leaders: leaders,
        profileMode: profileMode,
        compareMode: compareMode,
        radarModel: null,
        tableModel: buildTeamComparisonTableModel(rows, context, resolvedFilters),
        emptyState: null
    };
}

function renderTeamComparisonTableCell(row, column) {
    if (!column?.key) return '<td></td>';

    const value = row[column.key];
    if (column.key === 'victoryRateLabel' || column.key === 'prizeShareLabel') {
        return `<td><span class="team-comparison-table-value team-comparison-table-value--accent">${escapeCompetitionSectionText(value ?? TEAM_COMPARISON_COPY.noData)}</span></td>`;
    }

    if (column.key === 'prizeAmountLabel') {
        return `<td><span class="team-comparison-table-value team-comparison-table-value--body">${escapeCompetitionSectionText(value ?? '$0')}</span></td>`;
    }

    return `<td>${escapeCompetitionSectionText(value ?? TEAM_COMPARISON_COPY.noData)}</td>`;
}

function renderTeamComparisonLeaders(leaders) {
    return `
        <div class="team-comparison-leaders-grid">
            ${(Array.isArray(leaders) ? leaders : []).map(function (leader) {
                return `
                    <article class="team-comparison-leader-card team-comparison-leader-card--${escapeCompetitionSectionText(leader.tone || 'primary')}">
                        <div class="team-comparison-leader-card__header">
                            <span class="team-comparison-leader-card__icon" aria-hidden="true">
                                <i class="${escapeCompetitionSectionText(leader.icon || 'fas fa-chart-line')}"></i>
                            </span>
                            <span class="team-comparison-leader-card__label">${escapeCompetitionSectionText(leader.label || '')}</span>
                        </div>
                        <strong class="team-comparison-leader-card__team">${escapeCompetitionSectionText(leader.team || TEAM_COMPARISON_COPY.noData)}</strong>
                        <span class="team-comparison-leader-card__value">${escapeCompetitionSectionText(leader.value || TEAM_COMPARISON_COPY.noData)}</span>
                        <span class="team-comparison-leader-card__description">${escapeCompetitionSectionText(leader.description || '')}</span>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderTeamComparisonCompareMode(viewModel) {
    return `
        <div class="team-comparison-main-grid team-comparison-main-grid--compare">
            <div class="table-card team-comparison-panel team-comparison-panel--table">
                <div class="card-header">
                    <h3><i class="fas fa-table" aria-hidden="true"></i> ${escapeCompetitionSectionText(viewModel.tableModel?.title || '')}</h3>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table team-comparison-table">
                            <thead>
                                <tr>
                                    ${(viewModel.tableModel?.columns || []).map(function (column) {
                                        return `<th>${escapeCompetitionSectionText(column.label || '')}</th>`;
                                    }).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${(viewModel.tableModel?.rows || []).map(function (row) {
                                    return `<tr>${(viewModel.tableModel?.columns || []).map(function (column) {
                                        return renderTeamComparisonTableCell(row, column);
                                    }).join('')}</tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTeamComparisonProfileMode(viewModel) {
    return `
        <div class="team-comparison-main-grid team-comparison-main-grid--profile">
            <article class="chart-card team-comparison-panel">
                <div class="card-header">
                    <h3><i class="fas fa-shield-alt" aria-hidden="true"></i> ${escapeCompetitionSectionText(TEAM_COMPARISON_COPY.profile.title)}</h3>
                </div>
                <div class="card-body">
                    <div class="team-comparison-profile">
                        <span class="team-comparison-profile__eyebrow">${escapeCompetitionSectionText(viewModel.profileMode?.country || '')}</span>
                        <strong class="team-comparison-profile__team">${escapeCompetitionSectionText(viewModel.profileMode?.team || TEAM_COMPARISON_COPY.noData)}</strong>
                        <p class="team-comparison-profile__summary">${escapeCompetitionSectionText(viewModel.profileMode?.summary || TEAM_COMPARISON_COPY.profile.summary)}</p>
                        <div class="team-comparison-profile__metrics">
                            ${(viewModel.profileMode?.metrics || []).map(function (item) {
                                return `
                                    <div class="team-comparison-profile__metric">
                                        <span class="team-comparison-profile__metric-label">${escapeCompetitionSectionText(item.label || '')}</span>
                                        <strong class="team-comparison-profile__metric-value">${escapeCompetitionSectionText(item.value || TEAM_COMPARISON_COPY.noData)}</strong>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </article>
            <div class="table-card team-comparison-panel">
                <div class="card-header">
                    <h3><i class="fas fa-table" aria-hidden="true"></i> ${escapeCompetitionSectionText(viewModel.tableModel?.title || '')}</h3>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table team-comparison-table">
                            <thead>
                                <tr>
                                    ${(viewModel.tableModel?.columns || []).map(function (column) {
                                        return `<th>${escapeCompetitionSectionText(column.label || '')}</th>`;
                                    }).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${(viewModel.tableModel?.rows || []).map(function (row) {
                                    return `<tr>${(viewModel.tableModel?.columns || []).map(function (column) {
                                        return renderTeamComparisonTableCell(row, column);
                                    }).join('')}</tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTeamComparisonSection(viewModel) {
    const section = document.getElementById('radar-section');
    const titleEl = document.getElementById('team-comparison-section-title');
    const subtitleEl = document.getElementById('team-comparison-section-subtitle');
    const contextEl = document.getElementById('team-comparison-section-context');
    const container = document.getElementById('team-comparison-content');

    if (!section || !titleEl || !subtitleEl || !contextEl || !container) return;

    if (!viewModel?.visible) {
        section.hidden = true;
        container.innerHTML = '';
        return;
    }

    section.hidden = false;
    titleEl.textContent = viewModel.title || TEAM_COMPARISON_COPY.title;
    subtitleEl.textContent = viewModel.subtitle || TEAM_COMPARISON_COPY.subtitle;
    contextEl.textContent = viewModel.contextLabel || TEAM_COMPARISON_COPY.contextLabels.global;
    contextEl.hidden = !contextEl.textContent;

    if (viewModel.emptyState) {
        container.innerHTML = `
            <div class="table-card">
                <div class="card-body">
                    <div class="contextual-table-empty">
                        <i class="fas fa-users-slash" aria-hidden="true"></i>
                        <span>${escapeCompetitionSectionText(viewModel.emptyState.message || TEAM_COMPARISON_COPY.empty)}</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        ${renderTeamComparisonLeaders(viewModel.leaders)}
        ${viewModel.compareMode ? renderTeamComparisonCompareMode(viewModel) : renderTeamComparisonProfileMode(viewModel)}
    `;
}

function populateTeamComparisonSection(filters = {}) {
    currentTeamComparisonView = buildTeamComparisonViewModel(filters);
    renderTeamComparisonSection(currentTeamComparisonView);
}

function getActiveTeamComparisonViewModel() {
    return currentTeamComparisonView || buildTeamComparisonViewModel(getTeamComparisonFilters());
}

// ===== TEAM EXPERIENCE =====
function getTeamExperienceFilters(filters = {}) {
    return {
        country: filters.country !== undefined ? filters.country : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined ? filters.competition : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined ? filters.search : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function resolveTeamExperienceContext(filters) {
    if (filters.country && filters.competition) return 'country_competition';
    if (filters.country) return 'country';
    if (filters.competition) return 'competition';
    return 'global';
}

function getTeamExperienceContextLabel(context, filters) {
    if (context === 'country_competition') {
        return TEAM_EXPERIENCE_COPY.contextLabels.countryCompetition(filters.country, filters.competition);
    }
    if (context === 'country') {
        return TEAM_EXPERIENCE_COPY.contextLabels.country(filters.country);
    }
    if (context === 'competition') {
        return TEAM_EXPERIENCE_COPY.contextLabels.competition(filters.competition);
    }
    return TEAM_EXPERIENCE_COPY.contextLabels.global;
}

function getTeamExperienceTableTitle(context, filters) {
    if (context === 'country_competition') {
        return TEAM_EXPERIENCE_COPY.tableTitles.countryCompetition(filters.country, filters.competition);
    }
    if (context === 'country') {
        return TEAM_EXPERIENCE_COPY.tableTitles.country(filters.country);
    }
    if (context === 'competition') {
        return TEAM_EXPERIENCE_COPY.tableTitles.competition(filters.competition);
    }
    return TEAM_EXPERIENCE_COPY.tableTitles.global;
}

function getTeamExperienceTableColumns(context) {
    if (context === 'country') return TEAM_EXPERIENCE_COPY.tableColumns.country;
    if (context === 'competition') return TEAM_EXPERIENCE_COPY.tableColumns.competition;
    if (context === 'country_competition') return TEAM_EXPERIENCE_COPY.tableColumns.countryCompetition;
    return TEAM_EXPERIENCE_COPY.tableColumns.global;
}

function formatYearsUnit(value) {
    return Math.abs(Number(value)) === 1 ? 'año' : 'años';
}

function formatTeamExperienceAgeValue(value, digits = 1) {
    const numeric = safeOptionalNumericValue(value);
    if (numeric === null) {
        return TEAM_EXPERIENCE_COPY.noData;
    }
    const label = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(digits);
    return `${label} ${formatYearsUnit(numeric)}`;
}

function formatTeamExperienceIntegerAgeValue(value) {
    const numeric = safeOptionalNumericValue(value);
    if (numeric === null) {
        return TEAM_EXPERIENCE_COPY.noData;
    }
    const rounded = Math.round(numeric);
    return `${rounded} ${formatYearsUnit(rounded)}`;
}

function formatTeamExperiencePerformanceValue(value) {
    const numeric = safeOptionalNumericValue(value);
    if (numeric === null) {
        return TEAM_EXPERIENCE_COPY.noPerformanceData;
    }
    return formatPercentValue(numeric, 1);
}

function formatTeamExperienceGapValue(value) {
    const numeric = safeOptionalNumericValue(value);
    if (numeric === null) {
        return TEAM_EXPERIENCE_COPY.noPerformanceData;
    }
    return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)} pts`;
}

function formatTeamExperienceRoleLabel(value) {
    if (value === 'Titular' || value === 'Suplente' || value === 'Mixto') {
        return value;
    }
    return TEAM_EXPERIENCE_COPY.noRoleData;
}

function getTeamExperienceRoleTone(value) {
    if (value === 'Titular') return 'starter';
    if (value === 'Suplente') return 'substitute';
    if (value === 'Mixto') return 'mixed';
    return 'unknown';
}

function formatTeamExperienceCountLabel(value) {
    return String(safeNumericValue(value));
}

function formatTeamExperiencePosition(value) {
    const numeric = safeOptionalNumericValue(value);
    if (numeric === null) {
        return TEAM_EXPERIENCE_COPY.noPositionData;
    }
    return Number.isInteger(numeric) ? `#${numeric}` : `#${numeric.toFixed(1)}`;
}

function buildTeamExperienceRows(profiles, context) {
    const safeProfiles = cloneList(profiles).map(function (row) {
        const veteranRoleLabel = formatTeamExperienceRoleLabel(row?.veteran_role);
        return {
            team: row?.team || '',
            country: row?.country || '',
            veteranPlayer: row?.veteran_player || TEAM_EXPERIENCE_COPY.noData,
            veteranRole: row?.veteran_role || '',
            veteranRoleLabel: veteranRoleLabel,
            veteranRoleTone: getTeamExperienceRoleTone(row?.veteran_role),
            veteranAge: safeOptionalNumericValue(row?.veteran_age),
            veteranAgeLabel: formatTeamExperienceIntegerAgeValue(row?.veteran_age),
            teamAvgAge: safeOptionalNumericValue(row?.team_avg_age),
            teamAvgAgeLabel: formatTeamExperienceAgeValue(row?.team_avg_age, 1),
            youngestAge: safeOptionalNumericValue(row?.youngest_age),
            youngestAgeLabel: formatTeamExperienceIntegerAgeValue(row?.youngest_age),
            oldestAge: safeOptionalNumericValue(row?.oldest_age),
            oldestAgeLabel: formatTeamExperienceIntegerAgeValue(row?.oldest_age),
            ageSpan: safeOptionalNumericValue(row?.age_span),
            ageSpanLabel: formatTeamExperienceIntegerAgeValue(row?.age_span),
            veteranPerformancePct: safeOptionalNumericValue(row?.veteran_performance_pct),
            veteranPerformanceLabel: formatTeamExperiencePerformanceValue(row?.veteran_performance_pct),
            teamAvgPerformancePct: safeOptionalNumericValue(row?.team_avg_performance_pct),
            teamAvgPerformanceLabel: formatTeamExperiencePerformanceValue(row?.team_avg_performance_pct),
            veteranVsTeamGapPct: safeOptionalNumericValue(row?.veteran_vs_team_gap_pct),
            veteranGapLabel: formatTeamExperienceGapValue(row?.veteran_vs_team_gap_pct),
            veteranGapTone: getContextualVariationTone(row?.veteran_vs_team_gap_pct),
            competitionsCount: safeNumericValue(row?.competitions_count),
            competitionsCountLabel: formatTeamExperienceCountLabel(row?.competitions_count),
            competitionName: row?.competition_name || '',
            competitionResult: safeOptionalNumericValue(row?.competition_result),
            competitionResultLabel: formatTeamExperiencePosition(row?.competition_result)
        };
    });

    safeProfiles.sort(function (left, right) {
        if (context === 'competition' || context === 'country_competition') {
            if (right.veteranAge !== left.veteranAge) {
                return safeNumericValue(right.veteranAge) - safeNumericValue(left.veteranAge);
            }
            if (right.teamAvgAge !== left.teamAvgAge) {
                return safeNumericValue(right.teamAvgAge) - safeNumericValue(left.teamAvgAge);
            }
            return String(left.team || '').localeCompare(String(right.team || ''), 'es');
        }
        if (right.teamAvgAge !== left.teamAvgAge) {
            return safeNumericValue(right.teamAvgAge) - safeNumericValue(left.teamAvgAge);
        }
        if (right.veteranAge !== left.veteranAge) {
            return safeNumericValue(right.veteranAge) - safeNumericValue(left.veteranAge);
        }
        return String(left.team || '').localeCompare(String(right.team || ''), 'es');
    });

    return safeProfiles;
}

function buildTeamExperienceRoleInsight(summary) {
    const teamsCount = safeNumericValue(summary?.teams_count);
    const starterCount = safeNumericValue(summary?.veteran_starters_count);
    const substituteCount = safeNumericValue(summary?.veteran_substitutes_count);
    const mixedCount = safeNumericValue(summary?.veteran_mixed_count);

    if (!teamsCount) {
        return null;
    }

    if (starterCount === teamsCount) {
        return {
            eyebrow: TEAM_EXPERIENCE_COPY.roleInsightEyebrow,
            title: TEAM_EXPERIENCE_COPY.roleInsightTitles.allStarter,
            description: `${starterCount} de ${teamsCount} equipos usan a su veterano como titular`,
            tone: 'primary'
        };
    }
    if (substituteCount === teamsCount) {
        return {
            eyebrow: TEAM_EXPERIENCE_COPY.roleInsightEyebrow,
            title: TEAM_EXPERIENCE_COPY.roleInsightTitles.allSubstitute,
            description: `${substituteCount} de ${teamsCount} equipos usan a su veterano como suplente`,
            tone: 'secondary'
        };
    }
    if ((starterCount > 0 && substituteCount > 0) || mixedCount === teamsCount || mixedCount >= Math.max(starterCount, substituteCount)) {
        const detail = mixedCount > 0
            ? `${mixedCount} de ${teamsCount} equipos usan a su veterano en roles mixtos`
            : `${starterCount} de ${teamsCount} equipos usan a su veterano como titular y ${substituteCount} como suplente`;
        return {
            eyebrow: TEAM_EXPERIENCE_COPY.roleInsightEyebrow,
            title: TEAM_EXPERIENCE_COPY.roleInsightTitles.mixed,
            description: detail,
            tone: 'warning'
        };
    }
    if (starterCount >= substituteCount) {
        return {
            eyebrow: TEAM_EXPERIENCE_COPY.roleInsightEyebrow,
            title: TEAM_EXPERIENCE_COPY.roleInsightTitles.mostlyStarter,
            description: `${starterCount} de ${teamsCount} equipos usan a su veterano como titular`,
            tone: 'primary'
        };
    }
    return {
        eyebrow: TEAM_EXPERIENCE_COPY.roleInsightEyebrow,
        title: TEAM_EXPERIENCE_COPY.roleInsightTitles.mostlySubstitute,
        description: `${substituteCount} de ${teamsCount} equipos usan a su veterano como suplente`,
        tone: 'secondary'
    };
}

function buildTeamExperienceLeaderDescription(itemKey, formattedValue, rawValue) {
    if (itemKey === 'most_experienced') {
        return 'Es el equipo con la edad promedio más alta del contexto.';
    }
    if (itemKey === 'best_veteran') {
        return formattedValue === TEAM_EXPERIENCE_COPY.noPerformanceData
            ? 'No hay rendimiento registrado para comparar a los veteranos.'
            : 'Es el jugador más experimentado que mejor rindió en este contexto.';
    }
    if (itemKey === 'widest_gap') {
        return 'Distancia entre el jugador más joven y el más experimentado del equipo.';
    }
    if (itemKey === 'highest_advantage') {
        const numeric = safeOptionalNumericValue(rawValue);
        if (numeric === null) {
            return 'No hay rendimiento registrado para comparar con el equipo.';
        }
        if (numeric > 0) {
            return `El veterano rinde ${numeric.toFixed(1)} pts por encima del promedio de su equipo.`;
        }
        if (numeric < 0) {
            return `El veterano rinde ${Math.abs(numeric).toFixed(1)} pts por debajo del promedio de su equipo.`;
        }
        return 'El veterano rinde igual que el promedio del equipo.';
    }
    return '';
}

function buildTeamExperienceLeaders(leaders, rows) {
    const source = leaders || {};
    const safeRows = Array.isArray(rows) ? rows : [];

    function findRow(team) {
        return safeRows.find(function (row) {
            return row.team === team;
        }) || null;
    }

    return TEAM_EXPERIENCE_COPY.leaders.map(function (item) {
        let subject = TEAM_EXPERIENCE_COPY.noData;
        let meta = '';
        let value = TEAM_EXPERIENCE_COPY.noData;
        let matchedRow = null;

        if (item.key === 'most_experienced') {
            subject = source.most_experienced_team || TEAM_EXPERIENCE_COPY.noData;
            matchedRow = findRow(subject);
            value = matchedRow?.teamAvgAgeLabel || formatTeamExperienceAgeValue(source.most_experienced_team_avg_age, 1);
        } else if (item.key === 'best_veteran') {
            subject = source.best_veteran_player || TEAM_EXPERIENCE_COPY.noData;
            meta = source.best_veteran_team || '';
            matchedRow = findRow(meta);
            value = matchedRow?.veteranPerformanceLabel || formatTeamExperiencePerformanceValue(source.best_veteran_performance_pct);
        } else if (item.key === 'widest_gap') {
            subject = source.widest_age_gap_team || TEAM_EXPERIENCE_COPY.noData;
            matchedRow = findRow(subject);
            value = matchedRow?.ageSpanLabel || formatTeamExperienceIntegerAgeValue(source.widest_age_gap_years);
        } else if (item.key === 'highest_advantage') {
            subject = source.highest_veteran_advantage_team || TEAM_EXPERIENCE_COPY.noData;
            matchedRow = findRow(subject);
            value = matchedRow?.veteranGapLabel || formatTeamExperienceGapValue(source.highest_veteran_advantage_pct);
        }

        return {
            label: item.label,
            subject: subject,
            meta: meta,
            value: value,
            description: buildTeamExperienceLeaderDescription(
                item.key,
                value,
                item.key === 'highest_advantage'
                    ? (matchedRow?.veteranVsTeamGapPct ?? source.highest_veteran_advantage_pct)
                    : null
            ),
            tone: item.tone,
            icon: item.icon
        };
    });
}

function buildTeamExperienceRangeChartModel(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (safeRows.length < 2) {
        return null;
    }

    const minAge = Math.min.apply(null, safeRows.map(function (row) {
        return safeNumericValue(row.youngestAge);
    }));
    const maxAge = Math.max.apply(null, safeRows.map(function (row) {
        return safeNumericValue(row.veteranAge);
    }));
    const span = Math.max(maxAge - minAge, 1);

    function toPercent(age) {
        const numeric = safeNumericValue(age);
        return Math.max(0, Math.min(100, ((numeric - minAge) / span) * 100));
    }

    return {
        title: TEAM_EXPERIENCE_COPY.chartTitle,
        explanation: TEAM_EXPERIENCE_COPY.chartExplanation,
        scaleMinLabel: formatTeamExperienceIntegerAgeValue(minAge),
        scaleMaxLabel: formatTeamExperienceIntegerAgeValue(maxAge),
        items: safeRows.map(function (row) {
            const startPercent = toPercent(row.youngestAge);
            const endPercent = toPercent(row.veteranAge);
            return {
                team: row.team,
                country: row.country,
                veteranPlayer: row.veteranPlayer,
                veteranRoleLabel: row.veteranRoleLabel,
                veteranRoleTone: row.veteranRoleTone,
                youngestAgeLabel: row.youngestAgeLabel,
                veteranAgeLabel: row.veteranAgeLabel,
                teamAverageAgeLabel: row.teamAvgAgeLabel,
                tooltipLabel: `Más joven: ${row.youngestAgeLabel} · Promedio: ${row.teamAvgAgeLabel} · Veterano: ${row.veteranAgeLabel}`,
                startPercent: startPercent,
                endPercent: endPercent,
                widthPercent: Math.max(endPercent - startPercent, 2),
                averagePercent: toPercent(row.teamAvgAge)
            };
        })
    };
}

function buildTeamExperienceTableModel(rows, context, filters) {
    return {
        title: getTeamExperienceTableTitle(context, filters),
        columns: getTeamExperienceTableColumns(context),
        rows: rows
    };
}

function buildTeamExperienceProfileModel(row, context) {
    const metrics = [
        { label: 'Veterano', value: row.veteranPlayer },
        { label: 'Rol', value: row.veteranRoleLabel, roleTone: row.veteranRoleTone },
        { label: 'Edad del veterano', value: row.veteranAgeLabel },
        { label: 'Edad promedio', value: row.teamAvgAgeLabel },
        { label: 'Rendimiento del veterano', value: row.veteranPerformanceLabel },
        { label: 'Diferencia vs equipo', value: row.veteranGapLabel, tone: row.veteranGapTone },
        { label: 'Rango de edades', value: row.ageSpanLabel }
    ];

    if (context === 'competition' || context === 'country_competition') {
        metrics.push({ label: 'Resultado en la competencia', value: row.competitionResultLabel });
    } else {
        metrics.push({ label: 'Competiciones', value: row.competitionsCountLabel });
    }

    return {
        team: row.team,
        country: row.country,
        veteranPlayer: row.veteranPlayer,
        roleLabel: row.veteranRoleLabel,
        roleTone: row.veteranRoleTone,
        summary: TEAM_EXPERIENCE_COPY.profile.summary,
        metrics: metrics
    };
}

function buildTeamExperienceViewModel(filters = {}) {
    const resolvedFilters = getTeamExperienceFilters(filters);
    const context = resolveTeamExperienceContext(resolvedFilters);
    const summary = currentData?.team_experience_summary || {};
    const profiles = Array.isArray(currentData?.team_experience_profiles) ? currentData.team_experience_profiles : [];
    const rows = buildTeamExperienceRows(profiles, context);
    const leaders = buildTeamExperienceLeaders(currentData?.team_experience_leaders || {}, rows);
    const roleInsight = buildTeamExperienceRoleInsight(summary);

    if (!rows.length) {
        return {
            visible: true,
            context: context,
            title: TEAM_EXPERIENCE_COPY.title,
            subtitle: TEAM_EXPERIENCE_COPY.subtitle,
            contextLabel: getTeamExperienceContextLabel(context, resolvedFilters),
            leaders: leaders,
            roleInsight: null,
            rangeChartModel: null,
            profileMode: null,
            compareMode: null,
            tableModel: null,
            emptyState: {
                message: TEAM_EXPERIENCE_COPY.empty
            }
        };
    }

    const compareMode = rows.length >= 2 ? { teamCount: rows.length } : null;
    const profileMode = rows.length === 1 ? buildTeamExperienceProfileModel(rows[0], context) : null;

    return {
        visible: true,
        context: context,
        title: TEAM_EXPERIENCE_COPY.title,
        subtitle: TEAM_EXPERIENCE_COPY.subtitle,
        contextLabel: getTeamExperienceContextLabel(context, resolvedFilters),
        leaders: leaders,
        roleInsight: roleInsight,
        rangeChartModel: compareMode ? buildTeamExperienceRangeChartModel(rows) : null,
        profileMode: profileMode,
        compareMode: compareMode,
        tableModel: compareMode ? buildTeamExperienceTableModel(rows, context, resolvedFilters) : null,
        emptyState: null
    };
}

function renderTeamExperienceRoleBadge(label, tone) {
    return `<span class="team-experience-role-badge team-experience-role-badge--${escapeCompetitionSectionText(tone || 'unknown')}">${escapeCompetitionSectionText(label || TEAM_EXPERIENCE_COPY.noRoleData)}</span>`;
}

function renderTeamExperienceTableCell(row, column) {
    if (!column?.key) return '<td></td>';
    const value = row[column.key];

    if (column.key === 'veteranRoleLabel') {
        return `<td>${renderTeamExperienceRoleBadge(row.veteranRoleLabel, row.veteranRoleTone)}</td>`;
    }
    if (column.key === 'veteranPerformanceLabel') {
        const toneClass = value === TEAM_EXPERIENCE_COPY.noPerformanceData ? 'team-experience-table-value--muted' : 'team-experience-table-value--accent';
        return `<td><span class="team-experience-table-value ${toneClass}">${escapeCompetitionSectionText(value || TEAM_EXPERIENCE_COPY.noPerformanceData)}</span></td>`;
    }
    if (column.key === 'veteranGapLabel') {
        const toneClass = row.veteranGapTone === 'positive'
            ? 'team-experience-table-value--positive'
            : row.veteranGapTone === 'negative'
                ? 'team-experience-table-value--negative'
                : 'team-experience-table-value--muted';
        return `<td><span class="team-experience-table-value ${toneClass}">${escapeCompetitionSectionText(value || TEAM_EXPERIENCE_COPY.noPerformanceData)}</span></td>`;
    }
    return `<td>${escapeCompetitionSectionText(value || TEAM_EXPERIENCE_COPY.noData)}</td>`;
}

function renderTeamExperienceLeaders(leaders) {
    return `
        <div class="team-experience-leaders-grid">
            ${(Array.isArray(leaders) ? leaders : []).map(function (leader) {
                return `
                    <article class="team-experience-leader-card team-experience-leader-card--${escapeCompetitionSectionText(leader.tone || 'primary')}">
                        <div class="team-experience-leader-card__header">
                            <span class="team-experience-leader-card__icon" aria-hidden="true">
                                <i class="${escapeCompetitionSectionText(leader.icon || 'fas fa-hourglass-half')}"></i>
                            </span>
                            <span class="team-experience-leader-card__label">${escapeCompetitionSectionText(leader.label || '')}</span>
                        </div>
                        <strong class="team-experience-leader-card__subject">${escapeCompetitionSectionText(leader.subject || TEAM_EXPERIENCE_COPY.noData)}</strong>
                        ${leader.meta ? `<span class="team-experience-leader-card__meta">${escapeCompetitionSectionText(leader.meta)}</span>` : ''}
                        <span class="team-experience-leader-card__value">${escapeCompetitionSectionText(leader.value || TEAM_EXPERIENCE_COPY.noData)}</span>
                        <span class="team-experience-leader-card__description">${escapeCompetitionSectionText(leader.description || '')}</span>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderTeamExperienceRoleInsight(roleInsight) {
    if (!roleInsight) return '';
    return `
        <article class="team-experience-role-insight team-experience-role-insight--${escapeCompetitionSectionText(roleInsight.tone || 'primary')}">
            <span class="team-experience-role-insight__eyebrow">${escapeCompetitionSectionText(roleInsight.eyebrow || TEAM_EXPERIENCE_COPY.roleInsightEyebrow)}</span>
            <strong class="team-experience-role-insight__title">${escapeCompetitionSectionText(roleInsight.title || '')}</strong>
            <p class="team-experience-role-insight__description">${escapeCompetitionSectionText(roleInsight.description || '')}</p>
        </article>
    `;
}

function renderTeamExperienceRangeChart(rangeChartModel) {
    if (!rangeChartModel) return '';
    return `
        <article class="chart-card team-experience-panel">
            <div class="card-header">
                <h3><i class="fas fa-sliders-h" aria-hidden="true"></i> ${escapeCompetitionSectionText(rangeChartModel.title || TEAM_EXPERIENCE_COPY.chartTitle)}</h3>
            </div>
            <div class="card-body">
                <div class="team-experience-range-map">
                    <p class="team-experience-range-map__explanation">${escapeCompetitionSectionText(rangeChartModel.explanation || TEAM_EXPERIENCE_COPY.chartExplanation)}</p>
                    <div class="team-experience-range-map__scale">
                        <span>${escapeCompetitionSectionText(rangeChartModel.scaleMinLabel || '')}</span>
                        <span>${escapeCompetitionSectionText(rangeChartModel.scaleMaxLabel || '')}</span>
                    </div>
                    <div class="team-experience-range-map__scroller">
                        ${(rangeChartModel.items || []).map(function (item) {
                            const startPercent = safeNumericValue(item.startPercent);
                            const widthPercent = Math.max(safeNumericValue(item.widthPercent), 2);
                            const averagePercent = safeNumericValue(item.averagePercent);
                            const tooltipLabel = escapeCompetitionSectionText(item.tooltipLabel || '');
                            return `
                                <div class="team-experience-range-map__row">
                                    <div class="team-experience-range-map__summary">
                                        <strong class="team-experience-range-map__team">${escapeCompetitionSectionText(item.team || '')}</strong>
                                        <span class="team-experience-range-map__player">${escapeCompetitionSectionText(item.veteranPlayer || '')}</span>
                                        ${renderTeamExperienceRoleBadge(item.veteranRoleLabel, item.veteranRoleTone)}
                                    </div>
                                    <div class="team-experience-range-map__visual">
                                        <div class="team-experience-range-map__track" tabindex="0" role="img" aria-label="${tooltipLabel}" data-tooltip="${tooltipLabel}" title="${tooltipLabel}">
                                            <div class="team-experience-range-map__fill" style="left:${startPercent.toFixed(2)}%; width:${widthPercent.toFixed(2)}%;"></div>
                                            <span class="team-experience-range-map__avg-marker" style="left:${averagePercent.toFixed(2)}%;" aria-hidden="true"></span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderTeamExperienceCompareMode(viewModel) {
    return `
        <div class="team-experience-main-grid team-experience-main-grid--compare">
            ${renderTeamExperienceRangeChart(viewModel.rangeChartModel)}
            <div class="table-card team-experience-panel">
                <div class="card-header">
                    <h3><i class="fas fa-table" aria-hidden="true"></i> ${escapeCompetitionSectionText(viewModel.tableModel?.title || '')}</h3>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table team-experience-table">
                            <thead>
                                <tr>
                                    ${(viewModel.tableModel?.columns || []).map(function (column) {
                                        return `<th>${escapeCompetitionSectionText(column.label || '')}</th>`;
                                    }).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${(viewModel.tableModel?.rows || []).map(function (row) {
                                    return `<tr>${(viewModel.tableModel?.columns || []).map(function (column) {
                                        return renderTeamExperienceTableCell(row, column);
                                    }).join('')}</tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTeamExperienceProfileMetric(item) {
    if (item?.roleTone) {
        return `
            <div class="team-experience-profile__metric">
                <span class="team-experience-profile__metric-label">${escapeCompetitionSectionText(item.label || '')}</span>
                ${renderTeamExperienceRoleBadge(item.value, item.roleTone)}
            </div>
        `;
    }
    const toneClass = item?.tone === 'positive'
        ? 'team-experience-profile__metric-value--positive'
        : item?.tone === 'negative'
            ? 'team-experience-profile__metric-value--negative'
            : item?.value === TEAM_EXPERIENCE_COPY.noPerformanceData
                ? 'team-experience-profile__metric-value--muted'
                : '';

    return `
        <div class="team-experience-profile__metric">
            <span class="team-experience-profile__metric-label">${escapeCompetitionSectionText(item.label || '')}</span>
            <strong class="team-experience-profile__metric-value ${toneClass}">${escapeCompetitionSectionText(item.value || TEAM_EXPERIENCE_COPY.noData)}</strong>
        </div>
    `;
}

function renderTeamExperienceProfileMode(viewModel) {
    return `
        <article class="chart-card team-experience-panel team-experience-panel--profile">
            <div class="card-header">
                <h3><i class="fas fa-medal" aria-hidden="true"></i> ${escapeCompetitionSectionText(TEAM_EXPERIENCE_COPY.profile.title)}</h3>
            </div>
            <div class="card-body">
                <div class="team-experience-profile">
                    <span class="team-experience-profile__eyebrow">${escapeCompetitionSectionText(viewModel.profileMode?.country || '')}</span>
                    <strong class="team-experience-profile__team">${escapeCompetitionSectionText(viewModel.profileMode?.team || TEAM_EXPERIENCE_COPY.noData)}</strong>
                    <strong class="team-experience-profile__player">${escapeCompetitionSectionText(viewModel.profileMode?.veteranPlayer || TEAM_EXPERIENCE_COPY.noData)}</strong>
                    <p class="team-experience-profile__summary">${escapeCompetitionSectionText(viewModel.profileMode?.summary || TEAM_EXPERIENCE_COPY.profile.summary)}</p>
                    <div class="team-experience-profile__metrics">
                        ${(viewModel.profileMode?.metrics || []).map(renderTeamExperienceProfileMetric).join('')}
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderTeamExperienceSection(viewModel) {
    const section = document.getElementById('team-experience-section');
    const titleEl = document.getElementById('team-experience-section-title');
    const subtitleEl = document.getElementById('team-experience-section-subtitle');
    const contextEl = document.getElementById('team-experience-section-context');
    const container = document.getElementById('team-experience-content');

    if (!section || !titleEl || !subtitleEl || !contextEl || !container) return;

    if (!viewModel?.visible) {
        section.hidden = true;
        container.innerHTML = '';
        return;
    }

    section.hidden = false;
    titleEl.textContent = viewModel.title || TEAM_EXPERIENCE_COPY.title;
    subtitleEl.textContent = viewModel.subtitle || TEAM_EXPERIENCE_COPY.subtitle;
    contextEl.textContent = viewModel.contextLabel || TEAM_EXPERIENCE_COPY.contextLabels.global;
    contextEl.hidden = !contextEl.textContent;

    if (viewModel.emptyState) {
        container.innerHTML = `
            <div class="table-card">
                <div class="card-body">
                    <div class="contextual-table-empty">
                        <i class="fas fa-user-clock" aria-hidden="true"></i>
                        <span>${escapeCompetitionSectionText(viewModel.emptyState.message || TEAM_EXPERIENCE_COPY.empty)}</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        ${renderTeamExperienceLeaders(viewModel.leaders)}
        ${renderTeamExperienceRoleInsight(viewModel.roleInsight)}
        ${viewModel.compareMode ? renderTeamExperienceCompareMode(viewModel) : renderTeamExperienceProfileMode(viewModel)}
    `;
}

function populateTeamExperienceSection(filters = {}) {
    currentTeamExperienceView = buildTeamExperienceViewModel(filters);
    renderTeamExperienceSection(currentTeamExperienceView);
}

function getActiveTeamExperienceViewModel() {
    return currentTeamExperienceView || buildTeamExperienceViewModel(getTeamExperienceFilters());
}

// ===== AGE VS PERFORMANCE =====
const AGE_PERFORMANCE_BAND_ORDER = Object.freeze({
    '20-21': 0,
    '22-23': 1,
    '24+': 2
});

function getAgePerformanceFilters(filters = {}) {
    return {
        country: filters.country !== undefined ? filters.country : (document.getElementById('filter-country')?.value || ''),
        competition: filters.competition !== undefined ? filters.competition : (document.getElementById('filter-competition')?.value || ''),
        search: filters.search !== undefined ? filters.search : ((document.getElementById('search-player')?.value || '').trim())
    };
}

function resolveAgePerformanceContext(filters) {
    if (filters.country && filters.competition) return 'country_competition';
    if (filters.country) return 'country';
    if (filters.competition) return 'competition';
    return 'global';
}

function getAgePerformanceContextLabel(context, filters) {
    if (context === 'country_competition') {
        return AGE_PERFORMANCE_COPY.contextLabels.countryCompetition(filters.country, filters.competition);
    }
    if (context === 'country') {
        return AGE_PERFORMANCE_COPY.contextLabels.country(filters.country);
    }
    if (context === 'competition') {
        return AGE_PERFORMANCE_COPY.contextLabels.competition(filters.competition);
    }
    return AGE_PERFORMANCE_COPY.contextLabels.global;
}

function resolveAgePerformanceBand(age) {
    const numeric = safeOptionalNumericValue(age);
    if (numeric === null) return '';
    if (numeric <= 21) return '20-21';
    if (numeric <= 23) return '22-23';
    return '24+';
}

function formatAgePerformanceBandLabel(band) {
    if (!band) return AGE_PERFORMANCE_COPY.noData;
    return band === '24+' ? '24+ a\u00f1os' : `${band} a\u00f1os`;
}

function formatAgePerformancePercentValue(value) {
    const numeric = safeOptionalNumericValue(value);
    if (numeric === null) {
        return AGE_PERFORMANCE_COPY.noPerformanceData;
    }
    return `${numeric.toFixed(1)}%`;
}

function formatAgePerformancePlayersLabel(count) {
    const numeric = safeNumericValue(count);
    return `${numeric} ${Math.abs(numeric) === 1 ? 'jugador' : 'jugadores'}`;
}

function buildAgePerformanceRows(points) {
    return cloneList(points).map(function (row) {
        const age = safeOptionalNumericValue(row?.age ?? row?.edad);
        const performancePct = safeOptionalNumericValue(row?.performance_pct ?? row?.performance ?? row?.performance_2024);
        return {
            playerName: row?.player_name || row?.name || '',
            team: row?.team || '',
            teamCountry: row?.team_country || row?.country || row?.nationality || '',
            playerNationality: row?.player_nationality || row?.nationality || '',
            age: age,
            ageLabel: age === null ? AGE_PERFORMANCE_COPY.noData : `${Number.isInteger(age) ? age : age.toFixed(1)} a\u00f1os`,
            performancePct: performancePct,
            performanceLabel: formatAgePerformancePercentValue(performancePct),
            ageBand: row?.age_band || resolveAgePerformanceBand(age),
            competitionsCount: safeNumericValue(row?.competitions_count),
            competitionName: row?.competition_name || '',
            searchKey: normalizeText(row?.player_name || row?.name || ''),
            matchKey: `${normalizeText(row?.player_name || row?.name || '')}|${normalizeText(row?.team || '')}`
        };
    }).filter(function (row) {
        return row.playerName && row.age !== null;
    }).sort(function (left, right) {
        if (left.age !== right.age) {
            return safeNumericValue(left.age) - safeNumericValue(right.age);
        }
        if (right.performancePct !== left.performancePct) {
            return safeNumericValue(right.performancePct) - safeNumericValue(left.performancePct);
        }
        return String(left.playerName || '').localeCompare(String(right.playerName || ''), 'es');
    });
}

function buildAgePerformancePoints(points) {
    return buildAgePerformanceRows(points).filter(function (row) {
        return row.performancePct !== null;
    });
}

function resolveAgePerformanceAnalysisState(rawPlayersCount, validPointsCount) {
    if (rawPlayersCount <= 0) return 'empty';
    if (validPointsCount <= 0) return 'partial';
    if (validPointsCount < 3) return 'limited';
    return 'complete';
}

function buildAgePerformanceRelationship(summary, points) {
    const sampleSize = Math.max(safeNumericValue(summary?.players_count), Array.isArray(points) ? points.length : 0);
    const strength = String(summary?.correlation_strength || '').toLowerCase();
    const direction = String(summary?.correlation_direction || '').toLowerCase();

    if (sampleSize < 3 || strength === 'insufficient') {
        return {
            label: AGE_PERFORMANCE_COPY.insufficientSample,
            description: AGE_PERFORMANCE_COPY.insufficientHint,
            tone: 'primary'
        };
    }

    if (strength === 'none' || direction === 'neutral' || !direction) {
        return {
            label: AGE_PERFORMANCE_COPY.relationship.none,
            description: AGE_PERFORMANCE_COPY.relationshipDescriptions.none,
            tone: 'primary'
        };
    }

    const labelKey = `${strength}_${direction}`;
    return {
        label: AGE_PERFORMANCE_COPY.relationship[labelKey] || AGE_PERFORMANCE_COPY.relationship.none,
        description: direction === 'negative'
            ? AGE_PERFORMANCE_COPY.relationshipDescriptions.negative
            : AGE_PERFORMANCE_COPY.relationshipDescriptions.positive,
        tone: direction === 'negative' ? 'secondary' : 'success'
    };
}

function buildAgePerformanceBandModel(summary, bands) {
    const overallAverage = safeOptionalNumericValue(summary?.overall_average_performance_pct);
    const bandLookup = {};

    cloneList(bands).forEach(function (row) {
        if (!row?.age_band) return;
        bandLookup[row.age_band] = {
            ageBand: row.age_band,
            playersCount: safeNumericValue(row.players_count),
            averagePerformancePct: safeOptionalNumericValue(row.average_performance_pct),
            topPlayerName: row.top_player_name || '',
            topPlayerTeam: row.top_player_team || '',
            topPlayerPerformancePct: safeOptionalNumericValue(row.top_player_performance_pct)
        };
    });

    let bestBand = summary?.best_age_band || '';
    if (!bestBand) {
        AGE_PERFORMANCE_COPY.ageBands.forEach(function (band) {
            const current = bandLookup[band];
            if (!current || current.averagePerformancePct === null) return;
            if (!bestBand) {
                bestBand = band;
                return;
            }
            const bestCurrent = bandLookup[bestBand];
            if (!bestCurrent || safeNumericValue(current.averagePerformancePct) > safeNumericValue(bestCurrent.averagePerformancePct)) {
                bestBand = band;
            }
        });
    }

    const hiddenItems = [];
    const visibleItems = AGE_PERFORMANCE_COPY.ageBands.map(function (band) {
        const row = bandLookup[band] || {};
        const average = safeOptionalNumericValue(row.averagePerformancePct);
        const count = safeNumericValue(row.playersCount);
        if (count > 0 && average === null) {
            hiddenItems.push(band);
            return null;
        }
        if (count <= 0) {
            return null;
        }

        let insight = AGE_PERFORMANCE_COPY.bandInsightBelow;
        if (band === bestBand) {
            insight = AGE_PERFORMANCE_COPY.bandInsightTop;
        } else if (overallAverage !== null && average !== null && average >= overallAverage) {
            insight = AGE_PERFORMANCE_COPY.bandInsightAbove;
        }

        const topPerformance = safeOptionalNumericValue(row.topPlayerPerformancePct);
        const hasComparableTop = average !== null && topPerformance !== null;

        return {
            ageBand: band,
            label: formatAgePerformanceBandLabel(band),
            playersCount: count,
            playersLabel: formatAgePerformancePlayersLabel(count),
            averagePerformancePct: average,
            averageLabel: formatAgePerformancePercentValue(average),
            insight: insight,
            topPlayerName: hasComparableTop ? (row.topPlayerName || '') : '',
            topPlayerTeam: hasComparableTop ? (row.topPlayerTeam || '') : '',
            topPlayerLabel: hasComparableTop && row.topPlayerName && row.topPlayerTeam ? `${row.topPlayerName} - ${row.topPlayerTeam}` : (hasComparableTop ? (row.topPlayerName || '') : ''),
            isBestBand: band === bestBand
        };
    }).filter(Boolean);

    const resolvedBestBand = visibleItems.find(function (item) {
        return item.ageBand === bestBand;
    })?.ageBand || visibleItems[0]?.ageBand || '';

    return {
        title: AGE_PERFORMANCE_COPY.bandTitle,
        bestBand: resolvedBestBand,
        items: visibleItems.map(function (item) {
            return Object.assign({}, item, {
                isBestBand: item.ageBand === resolvedBestBand
            });
        }),
        hiddenCount: hiddenItems.length
    };
}

function findAgePerformanceStandout(points, leaders, mode) {
    const safePoints = Array.isArray(points) ? points : [];
    const playerKey = mode === 'young' ? 'young_standout_player' : 'veteran_standout_player';
    const teamKey = mode === 'young' ? 'young_standout_team' : 'veteran_standout_team';
    const performanceKey = mode === 'young' ? 'young_standout_performance_pct' : 'veteran_standout_performance_pct';
    const explicitPlayer = leaders?.[playerKey];
    const explicitTeam = leaders?.[teamKey];

    if (explicitPlayer) {
        const explicitPerformance = safeOptionalNumericValue(leaders?.[performanceKey]);
        if (explicitPerformance === null) {
            return null;
        }
        const matched = safePoints.find(function (point) {
            return point.playerName === explicitPlayer && (!explicitTeam || point.team === explicitTeam);
        });
        if (matched) {
            return matched;
        }
        return {
            playerName: explicitPlayer,
            team: explicitTeam || '',
            performancePct: explicitPerformance,
            performanceLabel: formatAgePerformancePercentValue(explicitPerformance),
            ageBand: ''
        };
    }

    if (!safePoints.length) return null;

    let targetBand = null;
    safePoints.forEach(function (point) {
        if (!point.ageBand) return;
        if (targetBand === null) {
            targetBand = point.ageBand;
            return;
        }
        const currentRank = AGE_PERFORMANCE_BAND_ORDER[point.ageBand];
        const targetRank = AGE_PERFORMANCE_BAND_ORDER[targetBand];
        if (mode === 'young' ? currentRank < targetRank : currentRank > targetRank) {
            targetBand = point.ageBand;
        }
    });

    return safePoints.filter(function (point) {
        return point.ageBand === targetBand;
    }).sort(function (left, right) {
        if (right.performancePct !== left.performancePct) {
            return safeNumericValue(right.performancePct) - safeNumericValue(left.performancePct);
        }
        if (mode === 'young' && left.age !== right.age) {
            return safeNumericValue(left.age) - safeNumericValue(right.age);
        }
        if (mode === 'veteran' && left.age !== right.age) {
            return safeNumericValue(right.age) - safeNumericValue(left.age);
        }
        return String(left.playerName || '').localeCompare(String(right.playerName || ''), 'es');
    })[0] || null;
}

function buildAgePerformanceLeaders(analysisState, summaryRelationship, bandModel, leaders, points, playerCount, validPointsCount) {
    const youngStandout = findAgePerformanceStandout(points, leaders, 'young');
    const veteranStandout = findAgePerformanceStandout(points, leaders, 'veteran');
    const bestBand = bandModel?.items?.find(function (item) {
        return item.isBestBand;
    }) || bandModel?.items?.[0] || null;
    const items = [];
    let hiddenCount = 0;

    if (analysisState === 'limited') {
        items.push({
            label: 'Muestra limitada',
            subject: AGE_PERFORMANCE_COPY.comparablePlayers(validPointsCount),
            meta: AGE_PERFORMANCE_COPY.playersInContext(playerCount),
            value: '',
            description: AGE_PERFORMANCE_COPY.limitedDescription,
            tone: 'primary',
            icon: AGE_PERFORMANCE_COPY.leaders[0].icon
        });
    } else {
        items.push({
            label: AGE_PERFORMANCE_COPY.leaders[0].label,
            subject: summaryRelationship.label,
            meta: AGE_PERFORMANCE_COPY.playersAnalyzed(playerCount),
            value: '',
            description: summaryRelationship.description,
            tone: summaryRelationship.tone || AGE_PERFORMANCE_COPY.leaders[0].tone,
            icon: AGE_PERFORMANCE_COPY.leaders[0].icon
        });
    }

    if (bestBand) {
        items.push({
            label: AGE_PERFORMANCE_COPY.leaders[1].label,
            subject: bestBand.label,
            meta: bestBand.playersLabel || '',
            value: bestBand.averageLabel || '',
            description: 'Es el tramo con mejor % de victorias promedio.',
            tone: AGE_PERFORMANCE_COPY.leaders[1].tone,
            icon: AGE_PERFORMANCE_COPY.leaders[1].icon
        });
    }

    if (youngStandout?.performancePct !== null && youngStandout?.performancePct !== undefined) {
        items.push({
            label: AGE_PERFORMANCE_COPY.leaders[2].label,
            subject: youngStandout.playerName || AGE_PERFORMANCE_COPY.noData,
            meta: youngStandout.team || '',
            value: youngStandout.performanceLabel || '',
            description: 'Mejor rendimiento dentro del tramo joven.',
            tone: AGE_PERFORMANCE_COPY.leaders[2].tone,
            icon: AGE_PERFORMANCE_COPY.leaders[2].icon
        });
    } else if (leaders?.young_standout_player) {
        hiddenCount += 1;
    }

    if (veteranStandout?.performancePct !== null && veteranStandout?.performancePct !== undefined) {
        items.push({
            label: AGE_PERFORMANCE_COPY.leaders[3].label,
            subject: veteranStandout.playerName || AGE_PERFORMANCE_COPY.noData,
            meta: veteranStandout.team || '',
            value: veteranStandout.performanceLabel || '',
            description: 'Mejor rendimiento dentro del tramo veterano.',
            tone: AGE_PERFORMANCE_COPY.leaders[3].tone,
            icon: AGE_PERFORMANCE_COPY.leaders[3].icon
        });
    } else if (leaders?.veteran_standout_player) {
        hiddenCount += 1;
    }

    return {
        items: items,
        hiddenCount: hiddenCount
    };
}

function buildAgePerformanceSectionNotes(hiddenLeadersCount, hiddenBandsCount) {
    const note = AGE_PERFORMANCE_COPY.omissionNote(hiddenLeadersCount, hiddenBandsCount);
    return note ? [note] : [];
}

function getAgePerformanceGridCountClass(baseClass, count, maxCount = 4) {
    const safeCount = Math.max(1, Math.min(maxCount, safeNumericValue(count)));
    return `${baseClass} ${baseClass}--count-${safeCount}`;
}

function buildAgePerformanceSearchHighlight(points, rawSearch) {
    const query = (rawSearch || '').trim();
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return {
            query: '',
            normalizedQuery: '',
            matches: [],
            note: ''
        };
    }

    const matches = (Array.isArray(points) ? points : []).filter(function (point) {
        return point.searchKey.indexOf(normalizedQuery) !== -1;
    });

    if (!matches.length) {
        return {
            query: query,
            normalizedQuery: normalizedQuery,
            matches: [],
            note: AGE_PERFORMANCE_COPY.noPlayerMatch
        };
    }

    return {
        query: query,
        normalizedQuery: normalizedQuery,
        matches: matches,
        note: `${matches.length} ${matches.length === 1 ? 'coincidencia resaltada' : 'coincidencias resaltadas'} en este contexto.`
    };
}

function buildAgePerformanceTrendline(points) {
    const safePoints = Array.isArray(points) ? points : [];
    if (safePoints.length < 3) return [];

    const validPoints = safePoints.filter(function (point) {
        return point.age !== null && point.performancePct !== null;
    });
    if (validPoints.length < 3) return [];

    const count = validPoints.length;
    const meanX = validPoints.reduce(function (sum, point) { return sum + safeNumericValue(point.age); }, 0) / count;
    const meanY = validPoints.reduce(function (sum, point) { return sum + safeNumericValue(point.performancePct); }, 0) / count;
    const numerator = validPoints.reduce(function (sum, point) {
        return sum + ((safeNumericValue(point.age) - meanX) * (safeNumericValue(point.performancePct) - meanY));
    }, 0);
    const denominator = validPoints.reduce(function (sum, point) {
        const delta = safeNumericValue(point.age) - meanX;
        return sum + (delta * delta);
    }, 0);
    if (!denominator) return [];

    const slope = numerator / denominator;
    const intercept = meanY - (slope * meanX);
    const minAge = Math.min.apply(null, validPoints.map(function (point) { return safeNumericValue(point.age); }));
    const maxAge = Math.max.apply(null, validPoints.map(function (point) { return safeNumericValue(point.age); }));

    function project(age) {
        return Math.max(0, Math.min(100, intercept + (slope * age)));
    }

    return [
        { x: minAge, y: project(minAge) },
        { x: maxAge, y: project(maxAge) }
    ];
}

function buildAgePerformanceScatterModel(points, searchHighlight) {
    const safePoints = Array.isArray(points) ? points : [];
    const matches = Array.isArray(searchHighlight?.matches) ? searchHighlight.matches : [];
    const hasMatches = matches.length > 0;
    const matchKeys = new Set(matches.map(function (point) {
        return point.matchKey;
    }));

    return {
        title: AGE_PERFORMANCE_COPY.scatterTitle,
        hint: AGE_PERFORMANCE_COPY.scatterHint,
        showChart: safePoints.length >= 2,
        highlightedCount: hasMatches ? matches.length : 0,
        points: safePoints.map(function (point) {
            const isHighlighted = hasMatches ? matchKeys.has(point.matchKey) : false;
            return Object.assign({}, point, {
                isHighlighted: isHighlighted,
                isDimmed: hasMatches ? !isHighlighted : false
            });
        }),
        trendline: buildAgePerformanceTrendline(safePoints)
    };
}

function buildAgePerformanceViewModel(filters = {}) {
    const resolvedFilters = getAgePerformanceFilters(filters);
    const context = resolveAgePerformanceContext(resolvedFilters);
    const rawRows = buildAgePerformanceRows(currentData?.player_age_performance_points);
    const points = rawRows.filter(function (row) {
        return row.performancePct !== null;
    });
    const rawPlayersCount = Math.max(safeNumericValue(currentData?.player_age_performance_summary?.players_count), rawRows.length);
    const validPointsCount = points.length;
    const analysisState = resolveAgePerformanceAnalysisState(rawPlayersCount, validPointsCount);
    const summarySource = currentData?.player_age_performance_summary || {};
    const relationship = buildAgePerformanceRelationship(summarySource, points);
    const searchHighlight = buildAgePerformanceSearchHighlight(points, resolvedFilters.search);

    if (analysisState === 'empty') {
        return {
            visible: true,
            context: context,
            analysisState: analysisState,
            title: AGE_PERFORMANCE_COPY.title,
            subtitle: AGE_PERFORMANCE_COPY.subtitle,
            contextLabel: getAgePerformanceContextLabel(context, resolvedFilters),
            summary: {
                relationshipLabel: relationship.label,
                relationshipDescription: relationship.description,
                playersLabel: AGE_PERFORMANCE_COPY.playersAnalyzed(0)
            },
            validPointsCount: validPointsCount,
            rawPlayersCount: rawPlayersCount,
            hasComparablePerformance: false,
            hiddenLeadersCount: 0,
            hiddenBandsCount: 0,
            sectionNotes: [],
            leaders: [],
            bandModel: null,
            scatterModel: null,
            searchHighlight: searchHighlight,
            emptyState: {
                message: AGE_PERFORMANCE_COPY.emptyTitle,
                hint: AGE_PERFORMANCE_COPY.emptyHint
            }
        };
    }

    if (analysisState === 'partial') {
        return {
            visible: true,
            context: context,
            analysisState: analysisState,
            title: AGE_PERFORMANCE_COPY.title,
            subtitle: AGE_PERFORMANCE_COPY.subtitle,
            contextLabel: getAgePerformanceContextLabel(context, resolvedFilters),
            summary: {
                relationshipLabel: relationship.label,
                relationshipDescription: relationship.description,
                playersLabel: AGE_PERFORMANCE_COPY.playersAnalyzed(rawPlayersCount)
            },
            validPointsCount: validPointsCount,
            rawPlayersCount: rawPlayersCount,
            hasComparablePerformance: false,
            hiddenLeadersCount: 0,
            hiddenBandsCount: 0,
            sectionNotes: [],
            leaders: [],
            bandModel: null,
            scatterModel: null,
            searchHighlight: searchHighlight,
            emptyState: {
                message: AGE_PERFORMANCE_COPY.partialTitle,
                hint: AGE_PERFORMANCE_COPY.partialHint(rawPlayersCount, validPointsCount)
            }
        };
    }

    const bandModel = buildAgePerformanceBandModel(summarySource, currentData?.player_age_performance_bands || []);
    const playerCount = rawPlayersCount;
    const summary = {
        relationshipLabel: relationship.label,
        relationshipDescription: relationship.description,
        playersLabel: AGE_PERFORMANCE_COPY.playersAnalyzed(playerCount),
        bestAgeBandLabel: formatAgePerformanceBandLabel(bandModel.bestBand),
        bestAgeBandAverageLabel: formatAgePerformancePercentValue(summarySource?.best_age_band_average_performance_pct)
    };
    const leadersModel = buildAgePerformanceLeaders(
        analysisState,
        relationship,
        bandModel,
        currentData?.player_age_performance_leaders || {},
        points,
        playerCount,
        validPointsCount
    );
    const sectionNotes = buildAgePerformanceSectionNotes(leadersModel.hiddenCount, bandModel.hiddenCount);

    return {
        visible: true,
        context: context,
        analysisState: analysisState,
        title: AGE_PERFORMANCE_COPY.title,
        subtitle: AGE_PERFORMANCE_COPY.subtitle,
        contextLabel: getAgePerformanceContextLabel(context, resolvedFilters),
        summary: summary,
        validPointsCount: validPointsCount,
        rawPlayersCount: rawPlayersCount,
        hasComparablePerformance: validPointsCount > 0,
        hiddenLeadersCount: leadersModel.hiddenCount,
        hiddenBandsCount: bandModel.hiddenCount,
        sectionNotes: sectionNotes,
        leaders: leadersModel.items,
        bandModel: bandModel.items.length ? bandModel : null,
        scatterModel: null,
        searchHighlight: searchHighlight,
        emptyState: null
    };
}

function renderAgePerformanceLeaders(leaders) {
    const safeLeaders = cloneList(leaders).filter(Boolean);
    if (!safeLeaders.length) return '';
    const gridClass = getAgePerformanceGridCountClass('age-performance-leaders-grid', safeLeaders.length, 4);
    return `
        <div class="${gridClass}">
            ${safeLeaders.map(function (leader) {
                return `
                    <article class="age-performance-leader-card age-performance-leader-card--${escapeCompetitionSectionText(leader.tone || 'primary')}">
                        <div class="age-performance-leader-card__header">
                            <span class="age-performance-leader-card__icon" aria-hidden="true">
                                <i class="${escapeCompetitionSectionText(leader.icon || 'fas fa-braille')}"></i>
                            </span>
                            <span class="age-performance-leader-card__label">${escapeCompetitionSectionText(leader.label || '')}</span>
                        </div>
                        <strong class="age-performance-leader-card__subject">${escapeCompetitionSectionText(leader.subject || AGE_PERFORMANCE_COPY.noData)}</strong>
                        ${leader.meta ? `<span class="age-performance-leader-card__meta">${escapeCompetitionSectionText(leader.meta)}</span>` : ''}
                        ${leader.value ? `<span class="age-performance-leader-card__value">${escapeCompetitionSectionText(leader.value)}</span>` : ''}
                        <span class="age-performance-leader-card__description">${escapeCompetitionSectionText(leader.description || '')}</span>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderAgePerformanceSearchNote(searchHighlight) {
    if (!searchHighlight?.note) return '';
    const toneClass = searchHighlight.matches?.length ? 'age-performance-search-note--accent' : 'age-performance-search-note--muted';
    return `
        <div class="age-performance-search-note ${toneClass}">
            <i class="fas fa-search" aria-hidden="true"></i>
            <span>${escapeCompetitionSectionText(searchHighlight.note)}</span>
        </div>
    `;
}

function renderAgePerformanceSectionNotes(sectionNotes) {
    const note = cloneList(sectionNotes).filter(Boolean)[0];
    if (!note) return '';
    return `
        <div class="age-performance-section-notes">
            <p class="age-performance-status-note">${escapeCompetitionSectionText(note)}</p>
        </div>
    `;
}

function renderAgePerformanceBandSummary(summary, bandModel, searchHighlight) {
    if (!bandModel) return '';
    const safeItems = cloneList(bandModel?.items).filter(Boolean);
    const gridClass = getAgePerformanceGridCountClass('age-performance-band-grid', safeItems.length || 1, 3);
    const panelClass = safeItems.length < 3
        ? 'chart-card age-performance-summary-panel age-performance-summary-panel--compact'
        : 'chart-card age-performance-summary-panel';
    return `
        <article class="${panelClass}">
            <div class="card-header">
                <div>
                    <h3><i class="fas fa-layer-group" aria-hidden="true"></i> ${escapeCompetitionSectionText(bandModel?.title || AGE_PERFORMANCE_COPY.bandTitle)}</h3>
                    <span class="age-performance-summary-meta">${escapeCompetitionSectionText(summary?.playersLabel || '')}</span>
                </div>
            </div>
            <div class="card-body">
                ${renderAgePerformanceSearchNote(searchHighlight)}
                <div class="${gridClass}">
                    ${safeItems.map(function (item) {
                        return `
                            <article class="age-performance-band-card${item.isBestBand ? ' age-performance-band-card--best' : ''}">
                                <span class="age-performance-band-card__label">${escapeCompetitionSectionText(item.label || '')}</span>
                                <strong class="age-performance-band-card__value">${escapeCompetitionSectionText(item.averageLabel || AGE_PERFORMANCE_COPY.noPerformanceData)}</strong>
                                <span class="age-performance-band-card__meta">${escapeCompetitionSectionText(item.playersLabel || '')}</span>
                                ${item.topPlayerLabel ? `<span class="age-performance-band-card__top">${escapeCompetitionSectionText(`Destaca: ${item.topPlayerLabel}`)}</span>` : ''}
                                <span class="age-performance-band-card__insight">${escapeCompetitionSectionText(item.insight || '')}</span>
                            </article>
                        `;
                    }).join('')}
                </div>
            </div>
        </article>
    `;
}

function agePerformanceColorWithAlpha(color, alpha) {
    const safeColor = String(color || 'rgba(0, 212, 255, 0.8)');
    const match = safeColor.match(/^rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i);
    if (!match) return safeColor;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}

function destroyAgePerformanceChart() {
    if (charts.agePerformanceChart && typeof charts.agePerformanceChart.destroy === 'function') {
        charts.agePerformanceChart.destroy();
    }
    charts.agePerformanceChart = null;
}

function renderAgePerformanceChart(scatterModel) {
    if (!scatterModel?.showChart) {
        destroyAgePerformanceChart();
        return;
    }
    const canvas = document.getElementById('agePerformanceScatterChart');
    if (!canvas || typeof Chart === 'undefined') {
        destroyAgePerformanceChart();
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        destroyAgePerformanceChart();
        return;
    }

    const points = Array.isArray(scatterModel?.points) ? scatterModel.points : [];
    const colorMap = buildCountryColorMap(points.map(function (point) {
        return { country: point.teamCountry || 'Sin pa\u00eds' };
    }));

    function getPointColors(point) {
        const palette = colorMap[point.teamCountry] || {
            backgroundColor: 'rgba(0, 212, 255, 0.8)',
            borderColor: 'rgba(0, 212, 255, 1)'
        };
        if (point.isDimmed) {
            return {
                backgroundColor: agePerformanceColorWithAlpha(palette.backgroundColor, 0.18),
                borderColor: agePerformanceColorWithAlpha(palette.borderColor, 0.28)
            };
        }
        if (point.isHighlighted) {
            return {
                backgroundColor: agePerformanceColorWithAlpha(palette.backgroundColor, 0.95),
                borderColor: agePerformanceColorWithAlpha(palette.borderColor, 1)
            };
        }
        return {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor
        };
    }

    const datasets = [{
        label: 'Jugadores',
        data: points.map(function (point) {
            return {
                x: point.age,
                y: point.performancePct,
                playerName: point.playerName,
                team: point.team,
                teamCountry: point.teamCountry,
                ageLabel: point.ageLabel,
                performanceLabel: point.performanceLabel,
                isHighlighted: point.isHighlighted,
                isDimmed: point.isDimmed
            };
        }),
        backgroundColor: points.map(function (point) {
            return getPointColors(point).backgroundColor;
        }),
        borderColor: points.map(function (point) {
            return getPointColors(point).borderColor;
        }),
        borderWidth: 2,
        pointRadius: points.map(function (point) {
            return point.isHighlighted ? 7 : 5;
        }),
        pointHoverRadius: points.map(function (point) {
            return point.isHighlighted ? 9 : 7;
        })
    }];

    if (Array.isArray(scatterModel?.trendline) && scatterModel.trendline.length === 2) {
        datasets.push({
            type: 'line',
            label: 'Tendencia',
            data: scatterModel.trendline,
            parsing: false,
            borderColor: 'rgba(255, 215, 0, 0.85)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
            fill: false
        });
    }

    destroyAgePerformanceChart();
    charts.agePerformanceChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Edad (a\u00f1os)',
                        color: '#ffffff',
                        font: { family: 'Inter', size: 13, weight: '600' }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    ticks: { color: '#a1a1aa' },
                    suggestedMin: 18,
                    suggestedMax: 35
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: '% de victorias',
                        color: '#ffffff',
                        font: { family: 'Inter', size: 13, weight: '600' }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    ticks: {
                        color: '#a1a1aa',
                        callback: function (value) {
                            return `${value}%`;
                        }
                    },
                    beginAtZero: true,
                    suggestedMax: 100
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(0, 212, 255, 0.45)',
                    borderWidth: 1,
                    callbacks: {
                        title: function (items) {
                            const point = items?.[0]?.raw;
                            return point?.playerName || '';
                        },
                        label: function (context) {
                            const point = context.raw;
                            if (!point) return '';
                            return [
                                `Equipo: ${point.team}`,
                                `Pa\u00eds del equipo: ${point.teamCountry}`,
                                `Edad: ${point.ageLabel}`,
                                `% de victorias: ${point.performanceLabel}`
                            ];
                        }
                    }
                },
                emptyState: {
                    message: AGE_PERFORMANCE_COPY.emptyTitle,
                    hint: AGE_PERFORMANCE_COPY.emptyHint
                }
            }
        }
    });
}

function renderAgePerformanceStatePanel(emptyState, state) {
    const modifierClass = state === 'partial'
        ? 'age-performance-state-panel age-performance-state-panel--partial'
        : 'age-performance-state-panel age-performance-state-panel--empty';

    return `
        <div class="age-performance-state-wrap">
            <article class="table-card ${modifierClass}">
                <div class="card-body">
                    <div class="age-performance-state-content">
                        <i class="fas fa-braille" aria-hidden="true"></i>
                        <span>${escapeCompetitionSectionText(emptyState?.message || AGE_PERFORMANCE_COPY.emptyTitle)}</span>
                        ${emptyState?.hint ? `<small>${escapeCompetitionSectionText(emptyState.hint)}</small>` : ''}
                    </div>
                </div>
            </article>
        </div>
    `;
}

function renderAgePerformanceSection(viewModel) {
    const section = document.getElementById('scatter-section');
    const titleEl = document.getElementById('age-performance-section-title');
    const subtitleEl = document.getElementById('age-performance-section-subtitle');
    const contextEl = document.getElementById('age-performance-section-context');
    const container = document.getElementById('age-performance-content');

    if (!section || !titleEl || !subtitleEl || !contextEl || !container) return;

    if (!viewModel?.visible) {
        section.hidden = true;
        container.innerHTML = '';
        destroyAgePerformanceChart();
        return;
    }

    section.hidden = false;
    titleEl.textContent = viewModel.title || AGE_PERFORMANCE_COPY.title;
    subtitleEl.textContent = viewModel.subtitle || AGE_PERFORMANCE_COPY.subtitle;
    contextEl.textContent = viewModel.contextLabel || AGE_PERFORMANCE_COPY.contextLabels.global;
    contextEl.hidden = !contextEl.textContent;

    if (viewModel.emptyState) {
        container.innerHTML = renderAgePerformanceStatePanel(viewModel.emptyState, viewModel.analysisState);
        destroyAgePerformanceChart();
        return;
    }

    container.innerHTML = `
        ${renderAgePerformanceLeaders(viewModel.leaders)}
        ${renderAgePerformanceSectionNotes(viewModel.sectionNotes)}
        ${renderAgePerformanceBandSummary(viewModel.summary, viewModel.bandModel, viewModel.searchHighlight)}
    `;

    destroyAgePerformanceChart();
}

function populateAgePerformanceSection(filters = {}) {
    currentAgePerformanceView = buildAgePerformanceViewModel(filters);
    renderAgePerformanceSection(currentAgePerformanceView);
}

function getActiveAgePerformanceViewModel() {
    return currentAgePerformanceView || buildAgePerformanceViewModel(getAgePerformanceFilters());
}

// ===== ML PROJECTION =====
function getMLProjectionFilters() {
    return {
        country: document.getElementById('filter-country')?.value || '',
        competition: document.getElementById('filter-competition')?.value || '',
        search: (document.getElementById('search-player')?.value || '').trim()
    };
}

function formatMLProjectionPercentLabel(value) {
    return formatPercentValue(value, 1);
}

function formatMLProjectionDeltaLabel(value) {
    const numeric = safeOptionalNumericValue(value);
    if (numeric === null) return 'Sin dato';
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(1)} pts`;
}

function getMLProjectionGridCountClass(baseClass, count, maxCount = 4) {
    return getAgePerformanceGridCountClass(baseClass, count, maxCount);
}

function getMLProjectionRiskTone(riskBand) {
    const normalized = normalizeText(riskBand || '');
    if (normalized.includes('salto')) return 'positive';
    if (normalized.includes('caida')) return 'negative';
    if (normalized.includes('estable')) return 'neutral';
    return 'muted';
}

function buildMLProjectionSearchState(players, rawSearch) {
    const query = String(rawSearch || '').trim();
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return { query: '', normalizedQuery: '', matches: [], matchKeys: [], note: '' };
    }

    const matches = (Array.isArray(players) ? players : []).filter(function (row) {
        return normalizeText(row?.player_name || row?.playerName || '').includes(normalizedQuery);
    }).map(function (row) {
        return {
            player: row.player_name || row.playerName || '',
            team: row.team || ''
        };
    });

    return {
        query: query,
        normalizedQuery: normalizedQuery,
        matches: matches,
        matchKeys: matches.map(function (row) {
            return normalizeText(row.player);
        }),
        note: matches.length ? ML_PROJECTION_COPY.searchMatch(matches.length) : ML_PROJECTION_COPY.noSearchMatch
    };
}

function serializeMLProjectionFilters(filters) {
    return JSON.stringify({
        country: filters?.country || '',
        competition: filters?.competition || '',
        search: (filters?.search || '').trim().toLowerCase()
    });
}

function findMLProjectionPlayer(players, playerName) {
    const normalizedTarget = normalizeText(playerName || '');
    return cloneList(players).find(function (row) {
        return normalizeText(row?.player_name || '') === normalizedTarget;
    }) || null;
}

function findDistinctMLProjectionDecline(players, excludedName) {
    const normalizedExcluded = normalizeText(excludedName || '');
    return cloneList(players)
        .filter(function (row) {
            return safeOptionalNumericValue(row?.delta) !== null
                && safeNumericValue(row?.delta) < 0
                && normalizeText(row?.player_name || '') !== normalizedExcluded;
        })
        .sort(function (left, right) {
            return safeNumericValue(left?.delta) - safeNumericValue(right?.delta)
                || (safeNumericValue(right?.predicted_winrate) - safeNumericValue(left?.predicted_winrate))
                || String(left?.player_name || '').localeCompare(String(right?.player_name || ''));
        })[0] || null;
}

function buildMLProjectionInsights(summary, players, teamRows) {
    const safeSummary = summary && typeof summary === 'object' ? summary : {};
    const safePlayers = cloneList(players);
    const safeTeamRows = cloneList(teamRows);
    const insights = [];
    const bestProjectedRow = findMLProjectionPlayer(safePlayers, safeSummary.best_projected_player) || null;
    const biggestImprovementRow = findMLProjectionPlayer(safePlayers, safeSummary.biggest_improvement_player) || null;
    const biggestDeclineRow = findDistinctMLProjectionDecline(safePlayers, safeSummary.best_projected_player)
        || findMLProjectionPlayer(safePlayers, safeSummary.biggest_decline_player)
        || null;
    const bestTeamRow = safeTeamRows.slice().sort(function (left, right) {
        return (safeNumericValue(right?.projected_avg_winrate) - safeNumericValue(left?.projected_avg_winrate))
            || (safeNumericValue(right?.avg_delta) - safeNumericValue(left?.avg_delta))
            || (safeNumericValue(right?.players_count) - safeNumericValue(left?.players_count))
            || String(left?.team || '').localeCompare(String(right?.team || ''));
    })[0] || null;

    if (bestProjectedRow || (safeSummary.best_projected_player && safeSummary.best_projected_winrate != null)) {
        insights.push({
            key: 'best_projected',
            label: ML_PROJECTION_COPY.insights[0].label,
            subject: bestProjectedRow?.player_name || safeSummary.best_projected_player,
            value: formatMLProjectionPercentLabel(bestProjectedRow?.predicted_winrate ?? safeSummary.best_projected_winrate),
            description: 'Tiene la proyecci\u00f3n individual m\u00e1s alta del contexto.',
            tone: ML_PROJECTION_COPY.insights[0].tone
        });
    }

    if (biggestImprovementRow || (safeSummary.biggest_improvement_player && safeSummary.biggest_improvement_delta != null)) {
        insights.push({
            key: 'biggest_improvement',
            label: ML_PROJECTION_COPY.insights[1].label,
            subject: biggestImprovementRow?.player_name || safeSummary.biggest_improvement_player,
            value: formatMLProjectionDeltaLabel(biggestImprovementRow?.delta ?? safeSummary.biggest_improvement_delta),
            description: 'Es la subida proyectada m\u00e1s fuerte del contexto.',
            tone: ML_PROJECTION_COPY.insights[1].tone
        });
    }

    if (biggestDeclineRow || (safeSummary.biggest_decline_player && safeSummary.biggest_decline_delta != null
        && normalizeText(safeSummary.biggest_decline_player) !== normalizeText(safeSummary.best_projected_player))) {
        insights.push({
            key: 'biggest_decline',
            label: ML_PROJECTION_COPY.insights[2].label,
            subject: biggestDeclineRow?.player_name || safeSummary.biggest_decline_player,
            value: formatMLProjectionDeltaLabel(biggestDeclineRow?.delta ?? safeSummary.biggest_decline_delta),
            description: 'Es la ca\u00edda proyectada m\u00e1s marcada frente al rendimiento actual.',
            tone: ML_PROJECTION_COPY.insights[2].tone
        });
    }

    if (bestTeamRow || (safeSummary.best_projected_team && safeSummary.best_projected_team_avg_winrate != null)) {
        insights.push({
            key: 'best_team',
            label: ML_PROJECTION_COPY.insights[3].label,
            subject: bestTeamRow?.team || safeSummary.best_projected_team,
            value: formatMLProjectionPercentLabel(bestTeamRow?.projected_avg_winrate ?? safeSummary.best_projected_team_avg_winrate),
            description: 'Es el mejor promedio proyectado disponible para el contexto.',
            tone: ML_PROJECTION_COPY.insights[3].tone
        });
    }

    return insights;
}

function buildMLProjectionAggregatePanel(context, country, countryRows, teamRows) {
    const sortedCountryRows = cloneList(countryRows).sort(function (left, right) {
        return (safeNumericValue(right?.projected_avg_winrate) - safeNumericValue(left?.projected_avg_winrate))
            || (safeNumericValue(right?.avg_delta) - safeNumericValue(left?.avg_delta))
            || String(left?.country || '').localeCompare(String(right?.country || ''));
    });
    const sortedTeamRows = cloneList(teamRows).sort(function (left, right) {
        return (safeNumericValue(right?.projected_avg_winrate) - safeNumericValue(left?.projected_avg_winrate))
            || (safeNumericValue(right?.avg_delta) - safeNumericValue(left?.avg_delta))
            || String(left?.team || '').localeCompare(String(right?.team || ''));
    });

    let countrySpotlight = null;
    if (context === 'country') {
        const row = sortedCountryRows.find(function (entry) {
            return entry?.country === country;
        }) || sortedCountryRows[0] || null;
        if (row) {
            countrySpotlight = {
                country: row.country,
                value: formatMLProjectionPercentLabel(row.projected_avg_winrate),
                meta: `${safeNumericValue(row.players_count)} ${safeNumericValue(row.players_count) === 1 ? 'jugador' : 'jugadores'}`,
                description: 'Resume el promedio proyectado del pa\u00eds filtrado.'
            };
        }
    } else {
        const row = sortedCountryRows[0] || null;
        if (row) {
            countrySpotlight = {
                country: row.country,
                value: formatMLProjectionPercentLabel(row.projected_avg_winrate),
                meta: `${safeNumericValue(row.players_count)} ${safeNumericValue(row.players_count) === 1 ? 'jugador' : 'jugadores'}`,
                description: ML_PROJECTION_COPY.aggregateCountryDescription
            };
        }
    }

    return {
        title: context === 'country'
            ? ML_PROJECTION_COPY.aggregateTitleCountry(country)
            : ML_PROJECTION_COPY.aggregateTitleGlobal,
        countrySpotlight: countrySpotlight,
        teamRows: sortedTeamRows.slice(0, 4).map(function (row) {
            return {
                label: row.team,
                value: formatMLProjectionPercentLabel(row.projected_avg_winrate),
                meta: row.top_projected_player || '',
                deltaLabel: formatMLProjectionDeltaLabel(row.avg_delta)
            };
        })
    };
}

function buildMLProjectionFeaturePanel(featureRows, showGlobalNote) {
    const rows = cloneList(featureRows).sort(function (left, right) {
        return safeNumericValue(left?.rank) - safeNumericValue(right?.rank);
    }).slice(0, 5).map(function (row) {
        const widthPct = Math.max(8, Math.min(100, safeNumericValue(row.importance_pct)));
        return {
            label: row.feature_label || row.feature_key || '',
            valueLabel: formatMLProjectionPercentLabel(row.importance_pct),
            widthPct: widthPct
        };
    });

    return {
        title: ML_PROJECTION_COPY.featureTitle,
        rows: rows
    };
}

function buildMLProjectionWatchlists(players, highlightedKeys) {
    const safePlayers = cloneList(players);
    const watchRows = safePlayers
        .slice()
        .sort(function (left, right) {
            return (safeNumericValue(right?.predicted_winrate) - safeNumericValue(left?.predicted_winrate))
                || (safeNumericValue(right?.delta) - safeNumericValue(left?.delta))
                || String(left?.player_name || '').localeCompare(String(right?.player_name || ''));
        })
        .slice(0, 5)
        .map(function (row) {
            return {
                player: row.player_name,
                team: row.team,
                value: formatMLProjectionPercentLabel(row.predicted_winrate),
                tone: safeNumericValue(row.delta) >= 0 ? 'positive' : 'neutral',
                highlighted: highlightedKeys.has(normalizeText(row.player_name || ''))
            };
        });

    const riskRows = safePlayers
        .filter(function (row) {
            return safeOptionalNumericValue(row.delta) !== null && safeNumericValue(row.delta) < 0;
        })
        .sort(function (left, right) {
            return safeNumericValue(left?.delta) - safeNumericValue(right?.delta)
                || String(left?.player_name || '').localeCompare(String(right?.player_name || ''));
        })
        .slice(0, 5)
        .map(function (row) {
            return {
                player: row.player_name,
                team: row.team,
                value: formatMLProjectionDeltaLabel(row.delta),
                tone: 'negative',
                highlighted: highlightedKeys.has(normalizeText(row.player_name || ''))
            };
        });

    return {
        watchTitle: ML_PROJECTION_COPY.watchTitle,
        riskTitle: ML_PROJECTION_COPY.riskTitle,
        watch: watchRows,
        risk: riskRows
    };
}

function buildMLProjectionTableModel(players, highlightedKeys, options = {}) {
    const context = options?.context || 'global';
    const expanded = Boolean(options?.expanded);
    const orderedRows = cloneList(players).sort(function (left, right) {
        const leftHighlighted = highlightedKeys.has(normalizeText(left?.player_name || '')) ? 1 : 0;
        const rightHighlighted = highlightedKeys.has(normalizeText(right?.player_name || '')) ? 1 : 0;
        return rightHighlighted - leftHighlighted
            || safeNumericValue(left?.projected_rank) - safeNumericValue(right?.projected_rank)
            || String(left?.player_name || '').localeCompare(String(right?.player_name || ''));
    });
    const totalCount = orderedRows.length;
    const shouldCollapse = context === 'global' && totalCount > 10;
    const visibleRows = shouldCollapse && !expanded ? orderedRows.slice(0, 10) : orderedRows;

    return {
        title: ML_PROJECTION_COPY.tableTitle,
        helperNote: 'Mejora = cambio frente al valor actual. Consistencia modelo = estabilidad interna de la predicci\u00f3n (0-100).',
        columns: ['Jugador', 'Equipo', 'Pa\u00eds del equipo', 'Edad 2026', 'Actual', 'Predicho', 'Mejora', 'Consistencia modelo', 'Riesgo'],
        totalCount: totalCount,
        visibleCount: visibleRows.length,
        isCollapsed: Boolean(shouldCollapse && !expanded),
        showToggle: shouldCollapse,
        toggleLabel: shouldCollapse && !expanded ? 'Ver tabla completa' : 'Mostrar menos',
        rows: visibleRows.map(function (row) {
            return {
                player_name: row.player_name,
                team: row.team,
                team_country: row.team_country,
                age_2026: safeNumericValue(row.age_2026),
                actual_winrate_label: formatMLProjectionPercentLabel(row.actual_winrate),
                predicted_winrate_label: formatMLProjectionPercentLabel(row.predicted_winrate),
                delta_label: formatMLProjectionDeltaLabel(row.delta),
                delta_tone: safeNumericValue(row.delta) > 0 ? 'positive' : safeNumericValue(row.delta) < 0 ? 'negative' : 'neutral',
                confidence_band: row.confidence_band || 'Sin dato',
                confidence_label: row.confidence_band && row.confidence_score != null
                    ? `${row.confidence_band} \u00b7 ${Math.round(safeNumericValue(row.confidence_score))}`
                    : (row.confidence_band || 'Sin dato'),
                risk_band: row.risk_band || 'Sin dato',
                risk_tone: getMLProjectionRiskTone(row.risk_band),
                highlighted: highlightedKeys.has(normalizeText(row.player_name || ''))
            };
        })
    };
}

function buildMLProjectionViewModel(filters = {}) {
    const country = filters.country || '';
    const competition = filters.competition || '';
    const search = filters.search || '';
    const context = country ? 'country' : 'global';

    const summary = currentData?.ml_projection_2026_summary || {};
    const players = cloneList(currentData?.ml_projection_2026_players);
    const teamRows = cloneList(currentData?.ml_projection_2026_team_summary);
    const countryRows = cloneList(currentData?.ml_projection_2026_country_summary);
    const featureRows = cloneList(currentData?.ml_projection_2026_feature_importance);

    const searchState = {
        query: (search || '').trim(),
        normalizedQuery: normalizeText(search || ''),
        matches: [],
        matchKeys: [],
        note: ''
    };
    const highlightedKeys = new Set();
    const visiblePlayers = players;
    const annualNote = (competition || searchState.query) ? ML_PROJECTION_COPY.competitionNote : '';

    const playersCount = Math.max(safeNumericValue(summary?.players_count), players.length);
    const visible = Boolean(playersCount || teamRows.length || countryRows.length || featureRows.length || search);

    if (!visible || (!players.length && !playersCount)) {
        return {
            visible: true,
            context: context,
            title: ML_PROJECTION_COPY.title,
            subtitle: ML_PROJECTION_COPY.subtitle,
            contextLabel: context === 'country'
                ? ML_PROJECTION_COPY.contextLabels.country(country)
                : ML_PROJECTION_COPY.contextLabels.global,
            competitionNote: annualNote,
            searchState: searchState,
            insights: [],
            aggregatePanel: null,
            featurePanel: buildMLProjectionFeaturePanel(featureRows, Boolean(country || competition || searchState.query)),
            watchlists: { watchTitle: ML_PROJECTION_COPY.watchTitle, riskTitle: ML_PROJECTION_COPY.riskTitle, watch: [], risk: [] },
            tableModel: null,
            emptyState: {
                message: ML_PROJECTION_COPY.emptyTitle,
                hint: ML_PROJECTION_COPY.emptyHint
            }
        };
    }

    return {
        visible: true,
        context: context,
        title: ML_PROJECTION_COPY.title,
        subtitle: ML_PROJECTION_COPY.subtitle,
        contextLabel: context === 'country'
            ? ML_PROJECTION_COPY.contextLabels.country(country)
            : ML_PROJECTION_COPY.contextLabels.global,
        competitionNote: annualNote,
        searchState: searchState,
        insights: buildMLProjectionInsights(summary, visiblePlayers, teamRows),
        aggregatePanel: buildMLProjectionAggregatePanel(context, country, countryRows, teamRows),
        featurePanel: buildMLProjectionFeaturePanel(featureRows, Boolean(country || competition || searchState.query)),
        watchlists: buildMLProjectionWatchlists(visiblePlayers, highlightedKeys),
        tableModel: buildMLProjectionTableModel(visiblePlayers, highlightedKeys, {
            context: context,
            expanded: currentMLProjectionTableExpanded
        }),
        emptyState: null
    };
}

function renderMLProjectionInsights(insights) {
    const safeInsights = cloneList(insights);
    if (!safeInsights.length) return '';
    const gridClass = getMLProjectionGridCountClass('ml-projection-insights-grid', safeInsights.length, 4);
    return `
        <div class="${gridClass}">
            ${safeInsights.map(function (insight) {
                return `
                    <article class="table-card ml-projection-insight-card ml-projection-insight-card--${escapeCompetitionSectionText(insight.tone || 'primary')}">
                        <div class="card-body">
                            <div class="ml-projection-insight-card__header">
                                <span class="ml-projection-insight-card__label">${escapeCompetitionSectionText(insight.label || '')}</span>
                            </div>
                            <strong class="ml-projection-insight-card__subject">${escapeCompetitionSectionText(insight.subject || '')}</strong>
                            <span class="ml-projection-insight-card__value">${escapeCompetitionSectionText(insight.value || '')}</span>
                            <p class="ml-projection-insight-card__description">${escapeCompetitionSectionText(insight.description || '')}</p>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderMLProjectionAggregatePanel(panel) {
    if (!panel) return '';
    const teamRows = cloneList(panel.teamRows);
    return `
        <article class="table-card ml-projection-panel">
            <div class="card-header">
                <h3>${escapeCompetitionSectionText(panel.title || '')}</h3>
            </div>
            <div class="card-body ml-projection-aggregate-body">
                ${panel.countrySpotlight ? `
                    <div class="ml-projection-country-spotlight">
                        <span class="ml-projection-country-spotlight__eyebrow">Pa\u00eds destacado</span>
                        <strong class="ml-projection-country-spotlight__title">${escapeCompetitionSectionText(panel.countrySpotlight.country || '')}</strong>
                        <span class="ml-projection-country-spotlight__value">${escapeCompetitionSectionText(panel.countrySpotlight.value || '')}</span>
                        <span class="ml-projection-country-spotlight__meta">${escapeCompetitionSectionText(panel.countrySpotlight.meta || '')}</span>
                        <p class="ml-projection-country-spotlight__description">${escapeCompetitionSectionText(panel.countrySpotlight.description || '')}</p>
                    </div>
                ` : ''}
                <div class="ml-projection-ranking-list">
                    ${teamRows.length ? teamRows.map(function (row, index) {
                        return `
                            <div class="ml-projection-ranking-row">
                                <span class="ml-projection-ranking-row__index">${index + 1}</span>
                                <div class="ml-projection-ranking-row__copy">
                                    <strong>${escapeCompetitionSectionText(row.label || '')}</strong>
                                    <small>${escapeCompetitionSectionText(row.meta || '')}</small>
                                </div>
                                <div class="ml-projection-ranking-row__metrics">
                                    <span>${escapeCompetitionSectionText(row.value || '')}</span>
                                    <small>${escapeCompetitionSectionText(row.deltaLabel || '')}</small>
                                </div>
                            </div>
                        `;
                    }).join('') : `<p class="ml-projection-empty-copy">Sin agregados disponibles.</p>`}
                </div>
            </div>
        </article>
    `;
}

function renderMLProjectionFeaturePanel(panel) {
    if (!panel) return '';
    const rows = cloneList(panel.rows);
    return `
        <article class="table-card ml-projection-panel">
            <div class="card-header">
                <h3>${escapeCompetitionSectionText(panel.title || '')}</h3>
            </div>
            <div class="card-body ml-projection-feature-list">
                ${rows.length ? rows.map(function (row) {
                    return `
                        <div class="ml-projection-feature-row">
                            <div class="ml-projection-feature-row__copy">
                                <strong>${escapeCompetitionSectionText(row.label || '')}</strong>
                                <span>${escapeCompetitionSectionText(row.valueLabel || '')}</span>
                            </div>
                            <div class="ml-projection-feature-row__bar">
                                <span style="width: ${row.widthPct}%"></span>
                            </div>
                        </div>
                    `;
                }).join('') : `<p class="ml-projection-empty-copy">Sin pesos del modelo disponibles.</p>`}
            </div>
        </article>
    `;
}

function renderMLProjectionWatchlistItems(items) {
    const safeItems = cloneList(items);
    if (!safeItems.length) {
        return `<p class="ml-projection-empty-copy">Sin jugadores para este grupo.</p>`;
    }
    return safeItems.map(function (row) {
        return `
            <div class="ml-projection-watch-item${row.highlighted ? ' ml-projection-watch-item--highlighted' : ''}">
                <div class="ml-projection-watch-item__copy">
                    <strong>${escapeCompetitionSectionText(row.player || '')}</strong>
                    <small>${escapeCompetitionSectionText(row.team || '')}</small>
                </div>
                <span class="ml-projection-watch-item__value ml-projection-watch-item__value--${escapeCompetitionSectionText(row.tone || 'neutral')}">${escapeCompetitionSectionText(row.value || '')}</span>
            </div>
        `;
    }).join('');
}

function renderMLProjectionWatchlists(watchlists) {
    if (!watchlists) return '';
    return `
        <div class="ml-projection-watchlists">
            <article class="table-card ml-projection-panel">
                <div class="card-header">
                    <h3>${escapeCompetitionSectionText(watchlists.watchTitle || '')}</h3>
                </div>
                <div class="card-body ml-projection-watchlist-body">
                    ${renderMLProjectionWatchlistItems(watchlists.watch)}
                </div>
            </article>
            <article class="table-card ml-projection-panel">
                <div class="card-header">
                    <h3>${escapeCompetitionSectionText(watchlists.riskTitle || '')}</h3>
                </div>
                <div class="card-body ml-projection-watchlist-body">
                    ${renderMLProjectionWatchlistItems(watchlists.risk)}
                </div>
            </article>
        </div>
    `;
}

function renderMLProjectionTable(tableModel) {
    if (!tableModel) return '';
    const rows = cloneList(tableModel.rows);
    return `
        <article class="table-card ml-projection-panel">
            <div class="card-header">
                <div class="ml-projection-table-header">
                    <div class="ml-projection-table-header__copy">
                        <h3>${escapeCompetitionSectionText(tableModel.title || '')}</h3>
                        ${tableModel.showToggle ? `<small>${escapeCompetitionSectionText(`Mostrando ${tableModel.visibleCount} de ${tableModel.totalCount} proyecciones`)}</small>` : '' }
                        ${tableModel.helperNote ? `<small>${escapeCompetitionSectionText(tableModel.helperNote)}</small>` : '' }
                    </div>
                    ${tableModel.showToggle ? `
                        <button type="button" class="btn btn-secondary ml-projection-table-toggle" data-role="ml-projection-table-toggle">
                            ${escapeCompetitionSectionText(tableModel.toggleLabel || '')}
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive ml-projection-table-wrap">
                    <table class="table ml-projection-table" aria-label="${escapeCompetitionSectionText(tableModel.title || '')}">
                        <thead>
                            <tr>
                                ${cloneList(tableModel.columns).map(function (column) {
                                    return `<th>${escapeCompetitionSectionText(column)}</th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(function (row) {
                                return `
                                    <tr${row.highlighted ? ' class="ml-projection-table__row--highlighted"' : ''}>
                                        <td><strong>${escapeCompetitionSectionText(row.player_name || '')}</strong></td>
                                        <td>${escapeCompetitionSectionText(row.team || '')}</td>
                                        <td>${countryFlag(row.team_country || '')} ${escapeCompetitionSectionText(row.team_country || '')}</td>
                                        <td>${escapeCompetitionSectionText(String(row.age_2026 || ''))}</td>
                                        <td>${escapeCompetitionSectionText(row.actual_winrate_label || '')}</td>
                                        <td>${escapeCompetitionSectionText(row.predicted_winrate_label || '')}</td>
                                        <td class="ml-projection-table__delta ml-projection-table__delta--${escapeCompetitionSectionText(row.delta_tone || 'neutral')}">${escapeCompetitionSectionText(row.delta_label || '')}</td>
                                        <td>${escapeCompetitionSectionText(row.confidence_label || row.confidence_band || '')}</td>
                                        <td><span class="ml-projection-risk-badge ml-projection-risk-badge--${escapeCompetitionSectionText(row.risk_tone || 'muted')}">${escapeCompetitionSectionText(row.risk_band || '')}</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </article>
    `;
}

function renderMLProjectionStatePanel(emptyState) {
    return `
        <div class="ml-projection-state-wrap">
            <article class="table-card ml-projection-state-panel">
                <div class="card-body">
                    <div class="ml-projection-state-content">
                        <i class="fas fa-robot" aria-hidden="true"></i>
                        <span>${escapeCompetitionSectionText(emptyState?.message || ML_PROJECTION_COPY.emptyTitle)}</span>
                        ${emptyState?.hint ? `<small>${escapeCompetitionSectionText(emptyState.hint)}</small>` : ''}
                    </div>
                </div>
            </article>
        </div>
    `;
}

function renderMLProjectionNotes(viewModel) {
    const notes = [];
    if (viewModel?.competitionNote) {
        notes.push({ tone: 'muted', text: viewModel.competitionNote });
    }
    if (viewModel?.searchState?.note) {
        notes.push({ tone: viewModel.searchState.matches?.length ? 'accent' : 'muted', text: viewModel.searchState.note });
    }
    if (!notes.length) return '';
    return `
        <div class="ml-projection-notes">
            ${notes.map(function (note) {
                return `<p class="ml-projection-note ml-projection-note--${note.tone}">${escapeCompetitionSectionText(note.text || '')}</p>`;
            }).join('')}
        </div>
    `;
}

function renderMLProjectionSection(viewModel) {
    const section = document.getElementById('predictions-section');
    const titleEl = document.getElementById('ml-projection-section-title');
    const subtitleEl = document.getElementById('ml-projection-section-subtitle');
    const contextEl = document.getElementById('ml-projection-section-context');
    const container = document.getElementById('ml-projection-content');

    if (!section || !titleEl || !subtitleEl || !contextEl || !container) return;

    if (!viewModel?.visible) {
        section.hidden = true;
        container.innerHTML = '';
        return;
    }

    section.hidden = false;
    titleEl.textContent = viewModel.title || ML_PROJECTION_COPY.title;
    subtitleEl.textContent = viewModel.subtitle || ML_PROJECTION_COPY.subtitle;
    contextEl.textContent = viewModel.contextLabel || ML_PROJECTION_COPY.contextLabels.global;
    contextEl.hidden = !contextEl.textContent;

    if (viewModel.emptyState) {
        container.innerHTML = `${renderMLProjectionNotes(viewModel)}${renderMLProjectionStatePanel(viewModel.emptyState)}`;
        return;
    }

    container.innerHTML = `
        ${renderMLProjectionNotes(viewModel)}
        ${renderMLProjectionInsights(viewModel.insights)}
        <div class="ml-projection-panels-grid">
            ${renderMLProjectionAggregatePanel(viewModel.aggregatePanel)}
            ${renderMLProjectionFeaturePanel(viewModel.featurePanel)}
        </div>
        ${renderMLProjectionWatchlists(viewModel.watchlists)}
        ${renderMLProjectionTable(viewModel.tableModel)}
    `;

    const tableToggle = container.querySelector('[data-role="ml-projection-table-toggle"]');
    if (tableToggle) {
        tableToggle.addEventListener('click', function () {
            currentMLProjectionTableExpanded = !currentMLProjectionTableExpanded;
            populateMLProjectionSection(getMLProjectionFilters());
        });
    }
}

function populateMLProjectionSection(filters = {}) {
    const filterKey = serializeMLProjectionFilters(filters);
    if (filterKey !== currentMLProjectionFilterKey) {
        currentMLProjectionTableExpanded = false;
        currentMLProjectionFilterKey = filterKey;
    }
    currentMLProjectionView = buildMLProjectionViewModel(filters);
    renderMLProjectionSection(currentMLProjectionView);
}

function getActiveMLProjectionViewModel() {
    return currentMLProjectionView || buildMLProjectionViewModel(getMLProjectionFilters());
}

// ===== SCATTER CHART =====
function updateScatterChart() {
    if (!charts.scatterChart) {
        createScatterChart();
        return;
    }
    const chart = charts.scatterChart;
    const players = currentData.scatter_age_performance_new || [];
    if (!players.length) {
        chart.data.datasets = [];
        chart.update();
        return;
    }

    const nationalities = [...new Set(players.map(p => p.nationality))];
    const scatterColors = [
        'rgba(0, 212, 255, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(255, 215, 0, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(99, 102, 241, 0.8)'
    ];

    const datasets = nationalities.map((nat, i) => {
        const natPlayers = players.filter(p => p.nationality === nat);
        return {
            label: `${countryFlags[nat] || ''} ${nat}`.trim(),
            data: natPlayers.map(p => ({
                x: Number(p.age || p.edad),
                y: Number(p.performance || p.performance_2024),
                name: p.name,
                team: p.team
            })),
            backgroundColor: scatterColors[i % scatterColors.length],
            borderColor: scatterColors[i % scatterColors.length].replace('0.8', '1'),
            borderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 12
        };
    });

    chart.data.datasets = datasets;
    chart.update();
}

function createScatterChart() {
    const canvas = document.getElementById('scatterChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const players = currentData.scatter_age_performance_new || [];

    const nationalities = players.length ? [...new Set(players.map(p => p.nationality))] : [];
    const scatterColors = [
        'rgba(0, 212, 255, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(255, 215, 0, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(99, 102, 241, 0.8)'
    ];

    const datasets = nationalities.map((nat, i) => {
        const natPlayers = players.filter(p => p.nationality === nat);
        return {
            label: `${countryFlags[nat] || ''} ${nat}`.trim(),
            data: natPlayers.map(p => ({
                x: Number(p.age || p.edad),
                y: Number(p.performance || p.performance_2024),
                name: p.name,
                team: p.team
            })),
            backgroundColor: scatterColors[i % scatterColors.length],
            borderColor: scatterColors[i % scatterColors.length].replace('0.8', '1'),
            borderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 12
        };
    });

    charts.scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Edad (años)',
                        color: '#ffffff',
                        font: { family: 'Inter', size: 13, weight: '600' }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#a1a1aa' },
                    min: 18,
                    max: 35
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: '% de victorias',
                        color: '#ffffff',
                        font: { family: 'Inter', size: 13, weight: '600' }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        color: '#a1a1aa',
                        callback: v => v + '%'
                    },
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                emptyState: {
                    message: 'Sin datos para este filtro'
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 15,
                        font: { family: 'Inter', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(0, 212, 255, 0.5)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            const p = context.raw;
                            return [
                                `${p.name} (${p.team})`,
                                `Edad: ${p.x} años`,
                                `% de victorias: ${p.y.toFixed(1)}%`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// ===== UTILITY FUNCTIONS =====
function getPerformanceBadgeClass(performance) {
    if (performance >= 70) return 'excellent';
    if (performance >= 60) return 'good';
    return 'average';
}

function getPerformanceRating(performance) {
    if (performance >= 70) return 'Excelente';
    if (performance >= 60) return 'Bueno';
    return 'Promedio';
}

function getTrendIndicator(player) {
    if (player.performance_2025 == null) {
        return '<span class="trend-indicator neutral"><i class="fas fa-minus"></i> Sin datos</span>';
    }

    const change = player.performance_2025 - player.performance_2024;
    if (change > 0) {
        return `<span class="trend-indicator up"><i class="fas fa-arrow-up"></i> +${change.toFixed(1)}%</span>`;
    } else if (change < 0) {
        return `<span class="trend-indicator down"><i class="fas fa-arrow-down"></i> ${change.toFixed(1)}%</span>`;
    } else {
        return '<span class="trend-indicator neutral"><i class="fas fa-minus"></i> Sin cambio</span>';
    }
}

function addAnimations() {
    // Add fade-in-up class to elements that don't have it
    const elements = document.querySelectorAll('.kpi-card, .chart-card, .table-card, .competition-card, .global-summary-card');
    elements.forEach((element, index) => {
        if (!element.classList.contains('fade-in-up')) {
            element.classList.add('fade-in-up');
            element.style.animationDelay = `${(index % 8) * 0.1}s`;
        }
    });
}

// ===== RESPONSIVE CHART HANDLING =====
window.addEventListener('resize', function () {
    syncResponsiveFilterBar();
    Object.values(charts).forEach(chart => {
        if (chart) {
            chart.resize();
        }
    });
});

// ===== SMOOTH SCROLLING =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (target) {
            const targetTop = target.getBoundingClientRect().top + (window.pageYOffset || window.scrollY || 0);
            const top = Math.max(targetTop - getStickyChromeOffset() - 12, 0);
            window.scrollTo({
                top: top,
                behavior: 'smooth'
            });
        }
    });
});

// ===== PERFORMANCE OPTIMIZATION =====
// Lazy load charts when they come into view
const observerOptions = {
    threshold: 0.1,
    rootMargin: '50px'
};

const chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const chartId = entry.target.id;
            if (chartId && !charts[chartId] && currentData) {
                // Initialize chart only if data is loaded and not already created
                setTimeout(() => {
                    if (charts[chartId]) return; // avoid double-init
                    switch (chartId) {
                        case 'countryChart':
                            createCountryChart();
                            break;
                        case 'prizesChart':
                            createPrizesChart();
                            break;
                        case 'evolutionChart':
                            createEvolutionChart();
                            break;
                        case 'squadUsageChart':
                            createSquadUsageChart();
                            break;
                        case 'scatterChart':
                            createScatterChart();
                            break;
                    }
                }, 100);
            }
            chartObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe chart canvases
document.addEventListener('DOMContentLoaded', () => {
    const chartCanvases = document.querySelectorAll('canvas');
    chartCanvases.forEach(canvas => {
        chartObserver.observe(canvas);
    });
});
