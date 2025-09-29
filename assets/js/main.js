// ===== GLOBAL VARIABLES =====
let dashboardData = null;
let charts = {};

// Country flag emojis mapping
const countryFlags = {
    'Ecuador': '🇪🇨',
    'Colombia': '🇨🇴',
    'Chile': '🇨🇱',
    'Bolivia': '🇧🇴',
    'Perú': '🇵🇪',
    'Argentina': '🇦🇷',
    'Venezuela': '🇻🇪',
    'México': '🇲🇽'
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
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
    const dashboard = document.getElementById('dashboard');
    
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            dashboard.classList.add('loaded');
        }, 500);
    }, 2000);
}

// ===== DATA LOADING =====
async function loadDashboardData() {
    try {
        const response = await fetch('./assets/data/datos-dashboard.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        dashboardData = await response.json();
        console.log('Dashboard data loaded successfully:', dashboardData);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Fallback to inline data if fetch fails
        dashboardData = getInlineData();
    }
}

function getInlineData() {
    // Fallback data in case JSON file is not accessible
    return {
        "kpis_principales": {
            "total_equipos": 15,
            "total_jugadores": 33,
            "total_premios": 325000,
            "paises_representados": 8,
            "competencias_activas": 5,
            "promedio_edad": 23.2,
            "competencias_internacionales": 2,
            "competencias_nacionales": 3
        },
        "ranking_paises": [
            {"pais": "Ecuador", "total_equipos": 4, "premios_totales": 110000, "promedio_por_equipo": 27500},
            {"pais": "Colombia", "total_equipos": 2, "premios_totales": 50000, "promedio_por_equipo": 25000},
            {"pais": "Chile", "total_equipos": 3, "premios_totales": 43000, "promedio_por_equipo": 14333.33}
        ],
        "top_jugadores_2024": [
            {"nombre": "Carlos Hernández", "nacionalidad": "Ecuador", "performance_2024": 75.0},
            {"nombre": "Alejandro Cárdenas", "nacionalidad": "Ecuador", "performance_2024": 75.0}
        ],
        "evolucion_jugadores": [
            {"nombre": "Julián Torres", "nacionalidad": "Perú", "performance_2024": 58.3, "performance_2025": 90.0, "mejora": 31.7}
        ],
        "top_equipos": [
            {"nombre": "Lobos Urbanos", "pais": "Ecuador", "premios_totales": 45000, "posicion_promedio": 1.0}
        ],
        "competencias": [
            {"nombre": "Masters Latam 2025", "tipo": "Internacional", "ubicacion": "Buenos Aires", "premio_total": 100000}
        ],
        "metricas_resumen": {
            "mejor_equipo_internacional": "Lobos Urbanos",
            "mejor_jugador_2024": "Carlos Hernández",
            "mayor_mejora_2025": "Julián Torres",
            "pais_dominante": "Ecuador"
        }
    };
}

// ===== DASHBOARD INITIALIZATION =====
async function initializeDashboard() {
    // Populate all sections
    populateKPIs();
    populateTables();
    populateCompetitions();
    populateInsights();
    
    // Initialize charts after a short delay to ensure DOM is ready
    setTimeout(() => {
        initializeCharts();
    }, 500);
    
    // Add animation classes
    addAnimations();
}

// ===== KPI CARDS =====
function populateKPIs() {
    const kpiContainer = document.getElementById('kpi-cards');
    const kpis = dashboardData.kpis_principales;
    
    const kpiConfigs = [
        {
            key: 'total_equipos',
            label: 'Equipos Totales',
            icon: 'fas fa-users',
            color: 'cyan',
            value: kpis.total_equipos
        },
        {
            key: 'total_jugadores',
            label: 'Jugadores Activos',
            icon: 'fas fa-user-friends',
            color: 'purple',
            value: kpis.total_jugadores
        },
        {
            key: 'total_premios',
            label: 'Premios Totales',
            icon: 'fas fa-trophy',
            color: 'gold',
            value: `$${(kpis.total_premios / 1000).toFixed(0)}K`
        },
        {
            key: 'paises_representados',
            label: 'Países',
            icon: 'fas fa-globe-americas',
            color: 'green',
            value: kpis.paises_representados
        },
        {
            key: 'competencias_activas',
            label: 'Competencias',
            icon: 'fas fa-medal',
            color: 'cyan',
            value: kpis.competencias_activas
        },
        {
            key: 'promedio_edad',
            label: 'Edad Promedio',
            icon: 'fas fa-birthday-cake',
            color: 'purple',
            value: `${kpis.promedio_edad} años`
        },
        {
            key: 'competencias_internacionales',
            label: 'Internacionales',
            icon: 'fas fa-globe',
            color: 'gold',
            value: kpis.competencias_internacionales
        },
        {
            key: 'competencias_nacionales',
            label: 'Nacionales',
            icon: 'fas fa-flag',
            color: 'green',
            value: kpis.competencias_nacionales
        }
    ];
    
    kpiContainer.innerHTML = kpiConfigs.map(kpi => `
        <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="kpi-card ${kpi.color} fade-in-up">
                <i class="${kpi.icon} kpi-icon"></i>
                <span class="kpi-number">${kpi.value}</span>
                <span class="kpi-label">${kpi.label}</span>
            </div>
        </div>
    `).join('');
}

// ===== CHARTS =====
function initializeCharts() {
    createCountryChart();
    createPrizesChart();
    createEvolutionChart();
}

function createCountryChart() {
    const ctx = document.getElementById('countryChart').getContext('2d');
    const countries = dashboardData.ranking_paises.slice(0, 6); // Top 6 countries
    
    charts.countryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: countries.map(c => `${countryFlags[c.pais] || ''} ${c.pais}`),
            datasets: [{
                data: countries.map(c => c.total_equipos),
                backgroundColor: [
                    'rgba(0, 212, 255, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(255, 215, 0, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderColor: [
                    'rgba(0, 212, 255, 1)',
                    'rgba(139, 92, 246, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(255, 215, 0, 1)',
                    'rgba(239, 68, 68, 1)',
                    'rgba(245, 158, 11, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        padding: 20,
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(0, 212, 255, 0.5)',
                    borderWidth: 1
                }
            }
        }
    });
}

function createPrizesChart() {
    const ctx = document.getElementById('prizesChart').getContext('2d');
    const countries = dashboardData.ranking_paises.slice(0, 8);
    
    charts.prizesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countries.map(c => `${countryFlags[c.pais] || ''} ${c.pais}`),
            datasets: [{
                label: 'Premios Totales ($)',
                data: countries.map(c => c.premios_totales),
                backgroundColor: 'rgba(0, 212, 255, 0.8)',
                borderColor: 'rgba(0, 212, 255, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(0, 212, 255, 0.5)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.x.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a1a1aa',
                        callback: function(value) {
                            return '$' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a1a1aa'
                    }
                }
            }
        }
    });
}

function createEvolutionChart() {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    const players = dashboardData.evolucion_jugadores;
    
    charts.evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: players.map(p => p.nombre),
            datasets: [
                {
                    label: 'Performance 2024',
                    data: players.map(p => p.performance_2024),
                    borderColor: 'rgba(139, 92, 246, 1)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                },
                {
                    label: 'Performance 2025',
                    data: players.map(p => p.performance_2025),
                    borderColor: 'rgba(0, 212, 255, 1)',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(0, 212, 255, 1)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(0, 212, 255, 0.5)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a1a1aa',
                        maxRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a1a1aa',
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// ===== TABLES =====
function populateTables() {
    populateCountryRankingTable();
    populateTopTeamsTable();
    populateTopPlayersTable();
    populatePlayerEvolutionTable();
}

function populateCountryRankingTable() {
    const tbody = document.querySelector('#country-ranking-table tbody');
    const countries = dashboardData.ranking_paises;
    const maxPrize = Math.max(...countries.map(c => c.premios_totales));
    
    tbody.innerHTML = countries.map(country => `
        <tr>
            <td>
                <strong>${countryFlags[country.pais] || ''} ${country.pais}</strong>
            </td>
            <td>${country.total_equipos}</td>
            <td>$${country.premios_totales.toLocaleString()}</td>
            <td>
                <div class="progress-bar-custom">
                    <div class="progress-fill" style="width: ${(country.premios_totales / maxPrize) * 100}%"></div>
                </div>
            </td>
        </tr>
    `).join('');
}

function populateTopTeamsTable() {
    const tbody = document.querySelector('#top-teams-table tbody');
    const teams = dashboardData.top_equipos.slice(0, 5);
    
    tbody.innerHTML = teams.map(team => `
        <tr>
            <td><strong>${team.nombre}</strong></td>
            <td>${countryFlags[team.pais] || ''} ${team.pais}</td>
            <td>$${team.premios_totales.toLocaleString()}</td>
            <td>
                <span class="performance-badge excellent">#${team.posicion_promedio}</span>
            </td>
        </tr>
    `).join('');
}

function populateTopPlayersTable() {
    const tbody = document.querySelector('#top-players-table tbody');
    const players = dashboardData.top_jugadores_2024.slice(0, 5);
    
    tbody.innerHTML = players.map(player => `
        <tr>
            <td><strong>${player.nombre}</strong></td>
            <td>${countryFlags[player.nacionalidad] || ''} ${player.nacionalidad}</td>
            <td>${player.performance_2024.toFixed(1)}%</td>
            <td>
                <span class="performance-badge ${getPerformanceBadgeClass(player.performance_2024)}">
                    ${getPerformanceRating(player.performance_2024)}
                </span>
            </td>
        </tr>
    `).join('');
}

function populatePlayerEvolutionTable() {
    const tbody = document.querySelector('#player-evolution-table tbody');
    const players = dashboardData.evolucion_jugadores.slice(0, 5);
    
    tbody.innerHTML = players.map(player => `
        <tr>
            <td><strong>${player.nombre}</strong></td>
            <td>${player.performance_2024.toFixed(1)}%</td>
            <td>${player.performance_2025 ? player.performance_2025.toFixed(1) + '%' : 'N/A'}</td>
            <td>
                ${getTrendIndicator(player)}
            </td>
        </tr>
    `).join('');
}

// ===== COMPETITIONS =====
function populateCompetitions() {
    const container = document.getElementById('competitions-grid');
    const competitions = dashboardData.competencias;
    
    container.innerHTML = competitions.map(comp => `
        <div class="col-lg-4 col-md-6">
            <div class="competition-card fade-in-up">
                <div class="competition-header">
                    <h4 class="competition-title">${comp.nombre}</h4>
                    <span class="competition-badge ${comp.tipo.toLowerCase()}">${comp.tipo}</span>
                </div>
                <div class="competition-info">
                    <div class="competition-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${comp.ubicacion}</span>
                    </div>
                    <div class="competition-detail">
                        <i class="fas fa-users"></i>
                        <span>${comp.equipos_participantes} equipos</span>
                    </div>
                    <div class="competition-detail">
                        <i class="fas fa-trophy"></i>
                        <span class="prize-amount">$${comp.premio_total.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== INSIGHTS =====
function populateInsights() {
    const container = document.getElementById('insights-grid');
    const metrics = dashboardData.metricas_resumen;
    
    const insights = [
        {
            icon: 'fas fa-crown',
            title: 'Mejor Equipo Internacional',
            value: metrics.mejor_equipo_internacional,
            description: 'Líder en competencias internacionales',
            color: 'gold'
        },
        {
            icon: 'fas fa-star',
            title: 'Mejor Jugador 2024',
            value: metrics.mejor_jugador_2024,
            description: 'Mayor performance del año',
            color: 'cyan'
        },
        {
            icon: 'fas fa-chart-line',
            title: 'Mayor Mejora 2025',
            value: metrics.mayor_mejora_2025,
            description: 'Evolución más destacada',
            color: 'green'
        },
        {
            icon: 'fas fa-flag',
            title: 'País Dominante',
            value: `${countryFlags[metrics.pais_dominante] || ''} ${metrics.pais_dominante}`,
            description: 'Líder regional en eSports',
            color: 'purple'
        }
    ];
    
    container.innerHTML = insights.map(insight => `
        <div class="col-lg-3 col-md-6">
            <div class="insight-card ${insight.color} fade-in-up">
                <i class="${insight.icon} insight-icon"></i>
                <h4 class="insight-title">${insight.title}</h4>
                <span class="insight-value">${insight.value}</span>
                <p class="insight-description">${insight.description}</p>
            </div>
        </div>
    `).join('');
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
    if (!player.performance_2025) {
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
    const elements = document.querySelectorAll('.kpi-card, .chart-card, .table-card, .competition-card, .insight-card');
    elements.forEach((element, index) => {
        if (!element.classList.contains('fade-in-up')) {
            element.classList.add('fade-in-up');
            element.style.animationDelay = `${(index % 8) * 0.1}s`;
        }
    });
}

// ===== RESPONSIVE CHART HANDLING =====
window.addEventListener('resize', function() {
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
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
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
            if (chartId && !charts[chartId]) {
                // Initialize chart if not already done
                setTimeout(() => {
                    switch(chartId) {
                        case 'countryChart':
                            createCountryChart();
                            break;
                        case 'prizesChart':
                            createPrizesChart();
                            break;
                        case 'evolutionChart':
                            createEvolutionChart();
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