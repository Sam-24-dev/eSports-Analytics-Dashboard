/* eslint-disable no-var */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.Filtering = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function normalizeText(value) {
        if (!value) return '';
        return value
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getEmptyData() {
        return {
            main_kpis: {
                total_teams: 0,
                total_players: 0,
                total_prizes: 0,
                countries_represented: 0,
                active_competitions: 0,
                average_age: 0,
                international_competitions: 0,
                national_competitions: 0
            },
            country_ranking: [],
            teams_catalog: [],
            top_players_2024: [],
            player_evolution: [],
            top_teams: [],
            competitions: [],
            summary_metrics: {
                best_international_team: 'N/A',
                best_player_2024: 'N/A',
                most_improved_2025: 'N/A',
                dominant_country: 'N/A',
                most_competitive: 'N/A',
                overall_average_performance: 0,
                total_international_prizes: 0,
                total_national_prizes: 0
            },
            squad_usage_summary: {
                starter_participations: 0,
                substitute_participations: 0,
                starter_share_pct: 0,
                substitute_share_pct: 0,
                starter_unique_players: 0,
                substitute_unique_players: 0,
                starter_avg_performance: null,
                substitute_avg_performance: null,
                performance_gap_pct: null,
                teams_with_substitutes: 0,
                teams_without_substitutes: 0
            },
            squad_usage_team_breakdown: [],
            team_experience_summary: {},
            team_experience_profiles: [],
            team_experience_leaders: {},
            team_comparison_profiles: [],
            team_comparison_leaders: {},
            player_age_performance_summary: {},
            player_age_performance_bands: [],
            player_age_performance_points: [],
            player_age_performance_leaders: {},
            ml_projection_2026_summary: {},
            ml_projection_2026_players: [],
            ml_projection_2026_team_summary: [],
            ml_projection_2026_country_summary: [],
            ml_projection_2026_feature_importance: [],
            role_analysis: [],
            veteran_players: [],
            radar_teamwork: [],
            scatter_age_performance_new: [],
            predictions_2026: [],
            competition_cross_filter: [],
            player_competition_mapping: [],
            filter_ready: {
                kpis_by_country: [],
                kpis_by_competition: [],
                kpis_by_country_competition: [],
                country_ranking_by_competition: [],
                top_teams_by_competition: [],
                top_players_by_competition: [],
                player_evolution_by_competition: [],
                role_analysis_by_competition: [],
                squad_usage_by_country: [],
                squad_usage_by_competition: [],
                squad_usage_by_country_competition: [],
                squad_usage_team_breakdown_by_country: [],
                squad_usage_team_breakdown_by_competition: [],
                squad_usage_team_breakdown_by_country_competition: [],
                team_experience_summary_by_country: [],
                team_experience_summary_by_competition: [],
                team_experience_summary_by_country_competition: [],
                team_experience_profiles_by_country: [],
                team_experience_profiles_by_competition: [],
                team_experience_profiles_by_country_competition: [],
                team_experience_leaders_by_country: [],
                team_experience_leaders_by_competition: [],
                team_experience_leaders_by_country_competition: [],
                team_comparison_profiles_by_country: [],
                team_comparison_profiles_by_competition: [],
                team_comparison_profiles_by_country_competition: [],
                team_comparison_leaders_by_country: [],
                team_comparison_leaders_by_competition: [],
                team_comparison_leaders_by_country_competition: [],
                player_age_performance_summary_by_country: [],
                player_age_performance_summary_by_competition: [],
                player_age_performance_summary_by_country_competition: [],
                player_age_performance_bands_by_country: [],
                player_age_performance_bands_by_competition: [],
                player_age_performance_bands_by_country_competition: [],
                player_age_performance_points_by_country: [],
                player_age_performance_points_by_competition: [],
                player_age_performance_points_by_country_competition: [],
                player_age_performance_leaders_by_country: [],
                player_age_performance_leaders_by_competition: [],
                player_age_performance_leaders_by_country_competition: [],
                ml_projection_2026_summary_by_country: [],
                ml_projection_2026_players_by_country: [],
                ml_projection_2026_team_summary_by_country: [],
                ml_projection_2026_country_summary_by_country: [],
                radar_teamwork_by_competition: [],
                scatter_age_performance_by_competition: [],
                veteran_players_by_competition: [],
                players_index: []
            }
        };
    }

    function cloneArray(value) {
        return Array.isArray(value) ? value.slice() : [];
    }

    function cloneRecord(value) {
        return value && typeof value === 'object' ? Object.assign({}, value) : null;
    }

    function emptyKpis() {
        return {
            total_teams: 0,
            total_players: 0,
            total_prizes: 0,
            countries_represented: 0,
            active_competitions: 0,
            average_age: 0,
            international_competitions: 0,
            national_competitions: 0
        };
    }

    function isInternational(type) {
        return normalizeText(type) === 'internacional';
    }

    function buildFilteredData(dashboardData, filters) {
        var source = dashboardData || getEmptyData();
        var filterReady = source.filter_ready || {};
        var country = (filters && filters.country) ? filters.country : '';
        var competition = (filters && filters.competition) ? filters.competition : '';
        var rawSearch = (filters && filters.search) ? filters.search : '';
        var search = normalizeText(rawSearch);
        var hasCountry = Boolean(country);
        var hasCompetition = Boolean(competition);

        var result = {
            main_kpis: Object.assign({}, source.main_kpis || emptyKpis()),
            country_ranking: cloneArray(source.country_ranking),
            teams_catalog: cloneArray(source.teams_catalog),
            top_teams: cloneArray(source.top_teams),
            top_players_2024: cloneArray(source.top_players_2024),
            player_evolution: cloneArray(source.player_evolution),
            veteran_players: cloneArray(source.veteran_players),
            radar_teamwork: cloneArray(source.radar_teamwork),
            scatter_age_performance_new: cloneArray(source.scatter_age_performance_new),
            competitions: cloneArray(source.competitions),
            summary_metrics: Object.assign({}, source.summary_metrics || getEmptyData().summary_metrics),
            squad_usage_summary: cloneRecord(source.squad_usage_summary),
            squad_usage_team_breakdown: cloneArray(source.squad_usage_team_breakdown),
            team_experience_summary: cloneRecord(source.team_experience_summary) || {},
            team_experience_profiles: cloneArray(source.team_experience_profiles),
            team_experience_leaders: cloneRecord(source.team_experience_leaders) || {},
            team_comparison_profiles: cloneArray(source.team_comparison_profiles),
            team_comparison_leaders: cloneRecord(source.team_comparison_leaders) || {},
            player_age_performance_summary: cloneRecord(source.player_age_performance_summary) || {},
            player_age_performance_bands: cloneArray(source.player_age_performance_bands),
            player_age_performance_points: cloneArray(source.player_age_performance_points),
            player_age_performance_leaders: cloneRecord(source.player_age_performance_leaders) || {},
            ml_projection_2026_summary: cloneRecord(source.ml_projection_2026_summary) || {},
            ml_projection_2026_players: cloneArray(source.ml_projection_2026_players),
            ml_projection_2026_team_summary: cloneArray(source.ml_projection_2026_team_summary),
            ml_projection_2026_country_summary: cloneArray(source.ml_projection_2026_country_summary),
            ml_projection_2026_feature_importance: cloneArray(source.ml_projection_2026_feature_importance),
            role_analysis: cloneArray(source.role_analysis),
            predictions_2026: cloneArray(source.predictions_2026),
            activeCompetitionYear: ''
        };

        if (hasCountry && hasCompetition) {
            var kpiRowCC = (filterReady.kpis_by_country_competition || []).find(function (row) {
                return row.country === country && row.competition_name === competition;
            });
            if (kpiRowCC) {
                result.main_kpis = {
                    total_teams: kpiRowCC.total_teams || 0,
                    total_players: kpiRowCC.total_players || 0,
                    total_prizes: kpiRowCC.total_prizes || 0,
                    countries_represented: 1,
                    active_competitions: 1,
                    average_age: kpiRowCC.average_age || 0,
                    international_competitions: isInternational(kpiRowCC.type) ? 1 : 0,
                    national_competitions: isInternational(kpiRowCC.type) ? 0 : 1
                };
            } else {
                result.main_kpis = emptyKpis();
            }
        } else if (hasCountry) {
            var kpiRowCountry = (filterReady.kpis_by_country || []).find(function (row) {
                return row.country === country;
            });
            if (kpiRowCountry) {
                result.main_kpis = {
                    total_teams: kpiRowCountry.total_teams || 0,
                    total_players: kpiRowCountry.total_players || 0,
                    total_prizes: kpiRowCountry.total_prizes || 0,
                    countries_represented: kpiRowCountry.countries_represented || 1,
                    active_competitions: kpiRowCountry.active_competitions || 0,
                    average_age: kpiRowCountry.average_age || 0,
                    international_competitions: kpiRowCountry.international_competitions || 0,
                    national_competitions: kpiRowCountry.national_competitions || 0
                };
            } else {
                result.main_kpis = emptyKpis();
            }
        } else if (hasCompetition) {
            var kpiRowComp = (filterReady.kpis_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            });
            if (kpiRowComp) {
                result.main_kpis = {
                    total_teams: kpiRowComp.total_teams || 0,
                    total_players: kpiRowComp.total_players || 0,
                    total_prizes: kpiRowComp.total_prizes || 0,
                    countries_represented: kpiRowComp.countries_represented || 0,
                    active_competitions: 1,
                    average_age: kpiRowComp.average_age || 0,
                    international_competitions: kpiRowComp.international_competitions || 0,
                    national_competitions: kpiRowComp.national_competitions || 0
                };
            } else {
                result.main_kpis = emptyKpis();
            }
        }

        if (hasCompetition) {
            var rankingRows = (filterReady.country_ranking_by_competition || []).filter(function (row) {
                return row.competition_name === competition;
            });
            if (hasCountry) {
                rankingRows = rankingRows.filter(function (row) {
                    return row.country === country;
                });
            }
            result.country_ranking = rankingRows.map(function (row) {
                return {
                    country: row.country,
                    total_teams: row.total_teams || 0,
                    total_players: row.total_players || 0,
                    total_prizes: row.total_prizes || 0,
                    average_prize_per_team: row.average_prize_per_team || 0,
                    average_age: row.average_age
                };
            });
        } else if (hasCountry) {
            var rankingCountry = (filterReady.kpis_by_country || []).find(function (row) {
                return row.country === country;
            });
            result.country_ranking = rankingCountry ? [{
                country: rankingCountry.country,
                total_teams: rankingCountry.total_teams || 0,
                total_players: rankingCountry.total_players || 0,
                total_prizes: rankingCountry.total_prizes || 0,
                average_prize_per_team: 0,
                average_age: rankingCountry.average_age
            }] : [];
        }

        if (hasCompetition) {
            var teamsByComp = (filterReady.top_teams_by_competition || []).filter(function (row) {
                return row.competition_name === competition && (!hasCountry || row.country === country);
            });
            result.top_teams = teamsByComp.map(function (row) {
                return {
                    name: row.team,
                    country: row.country,
                    total_prizes: row.prize_obtained || 0,
                    average_position: row.final_position || 0,
                    best_position: row.final_position || 0
                };
            });
        } else if (hasCountry) {
            result.top_teams = cloneArray(source.top_teams).filter(function (row) {
                return row.country === country;
            });
        }

        if (hasCompetition) {
            var playersByComp = (filterReady.top_players_by_competition || []).filter(function (row) {
                return row.competition_name === competition && (!hasCountry || row.nationality === country);
            });
            result.top_players_2024 = playersByComp.map(function (row) {
                return {
                    name: row.name,
                    nationality: row.nationality,
                    performance_2024: row.performance_2024,
                    performance_2025: row.performance_2025,
                    trend: row.trend
                };
            });
        } else if (hasCountry) {
            result.top_players_2024 = cloneArray(source.top_players_2024).filter(function (row) {
                return row.nationality === country;
            });
        }

        if (hasCompetition) {
            var evolutionByComp = (filterReady.player_evolution_by_competition || []).filter(function (row) {
                return row.competition_name === competition && (!hasCountry || row.nationality === country);
            });
            result.player_evolution = evolutionByComp.map(function (row) {
                return {
                    competition_name: row.competition_name,
                    competition_year: row.competition_year,
                    name: row.name,
                    nationality: row.nationality,
                    team: row.team,
                    performance_2024: row.performance_2024,
                    performance_2025: row.performance_2025,
                    trend: row.trend,
                    improvement: row.improvement,
                    improvement_pct: row.improvement_pct,
                    decline: row.decline
                };
            });
        } else if (hasCountry) {
            result.player_evolution = cloneArray(source.player_evolution).filter(function (row) {
                return row.nationality === country;
            });
        }

        if (hasCompetition) {
            var veteransByComp = (filterReady.veteran_players_by_competition || []).filter(function (row) {
                return row.competition_name === competition && (!hasCountry || row.country === country);
            });
            result.veteran_players = veteransByComp.map(function (row) {
                return {
                    team: row.team,
                    country: row.country,
                    veteran_player: row.veteran_player,
                    age: row.age,
                    performance_2024: row.performance_2024
                };
            });
        } else if (hasCountry) {
            result.veteran_players = cloneArray(source.veteran_players).filter(function (row) {
                return row.country === country;
            });
        }

        if (hasCompetition) {
            var radarByComp = (filterReady.radar_teamwork_by_competition || []).filter(function (row) {
                return row.competition_name === competition && (!hasCountry || row.country === country);
            });
            result.radar_teamwork = radarByComp.map(function (row) {
                return {
                    team: row.team,
                    country: row.country,
                    avg_teamwork: row.avg_teamwork,
                    total_players: row.total_players,
                    avg_winrate: row.avg_winrate,
                    total_prizes: row.total_prizes
                };
            });
        } else if (hasCountry) {
            result.radar_teamwork = cloneArray(source.radar_teamwork).filter(function (row) {
                return row.country === country;
            });
        }

        if (hasCompetition) {
            var scatterByComp = (filterReady.scatter_age_performance_by_competition || []).filter(function (row) {
                return row.competition_name === competition && (!hasCountry || row.nationality === country);
            });
            result.scatter_age_performance_new = scatterByComp.map(function (row) {
                return {
                    name: row.name,
                    age: row.age,
                    performance: row.performance,
                    nationality: row.nationality,
                    team: row.team
                };
            });
        } else if (hasCountry) {
            result.scatter_age_performance_new = cloneArray(source.scatter_age_performance_new).filter(function (row) {
                return row.nationality === country;
            });
        }

        if (hasCompetition && !hasCountry) {
            var rolesByComp = (filterReady.role_analysis_by_competition || []).filter(function (row) {
                return row.competition_name === competition;
            });
            result.role_analysis = rolesByComp.map(function (row) {
                return {
                    role: row.role,
                    total_participations: row.total_participations,
                    unique_players: row.unique_players,
                    average_performance: row.average_performance
                };
            });
        } else if (hasCountry) {
            result.role_analysis = [];
        }

        if (hasCountry && hasCompetition) {
            result.squad_usage_summary = cloneRecord((filterReady.squad_usage_by_country_competition || []).find(function (row) {
                return row.country === country && row.competition_name === competition;
            }));
            result.squad_usage_team_breakdown = (filterReady.squad_usage_team_breakdown_by_country_competition || []).filter(function (row) {
                return row.country === country && row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
        } else if (hasCountry) {
            result.squad_usage_summary = cloneRecord((filterReady.squad_usage_by_country || []).find(function (row) {
                return row.country === country;
            }));
            result.squad_usage_team_breakdown = (filterReady.squad_usage_team_breakdown_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
        } else if (hasCompetition) {
            result.squad_usage_summary = cloneRecord((filterReady.squad_usage_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            }));
            result.squad_usage_team_breakdown = (filterReady.squad_usage_team_breakdown_by_competition || []).filter(function (row) {
                return row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
        }

        if (hasCountry && hasCompetition) {
            result.team_experience_summary = cloneRecord((filterReady.team_experience_summary_by_country_competition || []).find(function (row) {
                return row.country === country && row.competition_name === competition;
            })) || {};
            result.team_experience_profiles = (filterReady.team_experience_profiles_by_country_competition || []).filter(function (row) {
                return row.country === country && row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.team_experience_leaders = cloneRecord((filterReady.team_experience_leaders_by_country_competition || []).find(function (row) {
                return row.country === country && row.competition_name === competition;
            })) || {};
        } else if (hasCountry) {
            result.team_experience_summary = cloneRecord((filterReady.team_experience_summary_by_country || []).find(function (row) {
                return row.country === country;
            })) || {};
            result.team_experience_profiles = (filterReady.team_experience_profiles_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.team_experience_leaders = cloneRecord((filterReady.team_experience_leaders_by_country || []).find(function (row) {
                return row.country === country;
            })) || {};
        } else if (hasCompetition) {
            result.team_experience_summary = cloneRecord((filterReady.team_experience_summary_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            })) || {};
            result.team_experience_profiles = (filterReady.team_experience_profiles_by_competition || []).filter(function (row) {
                return row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.team_experience_leaders = cloneRecord((filterReady.team_experience_leaders_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            })) || {};
        }

        if (hasCountry && hasCompetition) {
            result.team_comparison_profiles = (filterReady.team_comparison_profiles_by_country_competition || []).filter(function (row) {
                return row.country === country && row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.team_comparison_leaders = cloneRecord((filterReady.team_comparison_leaders_by_country_competition || []).find(function (row) {
                return row.country === country && row.competition_name === competition;
            })) || {};
        } else if (hasCountry) {
            result.team_comparison_profiles = (filterReady.team_comparison_profiles_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.team_comparison_leaders = cloneRecord((filterReady.team_comparison_leaders_by_country || []).find(function (row) {
                return row.country === country;
            })) || {};
        } else if (hasCompetition) {
            result.team_comparison_profiles = (filterReady.team_comparison_profiles_by_competition || []).filter(function (row) {
                return row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.team_comparison_leaders = cloneRecord((filterReady.team_comparison_leaders_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            })) || {};
        }

        if (hasCountry && hasCompetition) {
            result.player_age_performance_summary = cloneRecord((filterReady.player_age_performance_summary_by_country_competition || []).find(function (row) {
                return row.country === country && row.competition_name === competition;
            })) || {};
            result.player_age_performance_bands = (filterReady.player_age_performance_bands_by_country_competition || []).filter(function (row) {
                return row.country === country && row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.player_age_performance_points = (filterReady.player_age_performance_points_by_country_competition || []).filter(function (row) {
                return row.country === country && row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.player_age_performance_leaders = cloneRecord((filterReady.player_age_performance_leaders_by_country_competition || []).find(function (row) {
                return row.country === country && row.competition_name === competition;
            })) || {};
        } else if (hasCountry) {
            result.player_age_performance_summary = cloneRecord((filterReady.player_age_performance_summary_by_country || []).find(function (row) {
                return row.country === country;
            })) || {};
            result.player_age_performance_bands = (filterReady.player_age_performance_bands_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.player_age_performance_points = (filterReady.player_age_performance_points_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.player_age_performance_leaders = cloneRecord((filterReady.player_age_performance_leaders_by_country || []).find(function (row) {
                return row.country === country;
            })) || {};
        } else if (hasCompetition) {
            result.player_age_performance_summary = cloneRecord((filterReady.player_age_performance_summary_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            })) || {};
            result.player_age_performance_bands = (filterReady.player_age_performance_bands_by_competition || []).filter(function (row) {
                return row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.player_age_performance_points = (filterReady.player_age_performance_points_by_competition || []).filter(function (row) {
                return row.competition_name === competition;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.player_age_performance_leaders = cloneRecord((filterReady.player_age_performance_leaders_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            })) || {};
        }

        if (hasCountry) {
            result.ml_projection_2026_summary = cloneRecord((filterReady.ml_projection_2026_summary_by_country || []).find(function (row) {
                return row.country === country;
            })) || {};
            result.ml_projection_2026_players = (filterReady.ml_projection_2026_players_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.ml_projection_2026_team_summary = (filterReady.ml_projection_2026_team_summary_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
            result.ml_projection_2026_country_summary = (filterReady.ml_projection_2026_country_summary_by_country || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return Object.assign({}, row);
            });
        }

        if (hasCompetition) {
            result.competitions = cloneArray(source.competitions).filter(function (row) {
                return row.name === competition;
            });
        } else if (hasCountry) {
            var compNames = new Set((filterReady.kpis_by_country_competition || []).filter(function (row) {
                return row.country === country;
            }).map(function (row) {
                return row.competition_name;
            }));
            result.competitions = cloneArray(source.competitions).filter(function (row) {
                return compNames.has(row.name);
            });
        }

        var compYearSource = null;
        if (hasCompetition) {
            compYearSource = (filterReady.kpis_by_competition || []).find(function (row) {
                return row.competition_name === competition;
            }) || (filterReady.kpis_by_country_competition || []).find(function (row) {
                return row.competition_name === competition && (!hasCountry || row.country === country);
            }) || (source.competitions || []).find(function (row) {
                return row.name === competition;
            });
        }
        if (compYearSource && compYearSource.year) {
            result.activeCompetitionYear = compYearSource.year;
        }

        var indexEntries = filterReady.players_index || [];
        var indexMatches = indexEntries.filter(function (row) {
            var key = row.search_key ? row.search_key : normalizeText(row.name);
            return search && key && key.indexOf(search) !== -1;
        });
        var normalizedMatchNames = new Set(indexMatches.map(function (row) {
            return normalizeText(row.name);
        }));
        var hasIndexMatches = normalizedMatchNames.size > 0;

        function matchesSearch(name) {
            if (!search) return true;
            var normalized = normalizeText(name);
            if (hasIndexMatches) return normalizedMatchNames.has(normalized);
            return normalized.indexOf(search) !== -1;
        }

        if (search) {
            result.top_players_2024 = result.top_players_2024.filter(function (row) {
                return matchesSearch(row.name);
            });
            result.veteran_players = result.veteran_players.filter(function (row) {
                return matchesSearch(row.veteran_player || row.name);
            });
            result.scatter_age_performance_new = result.scatter_age_performance_new.filter(function (row) {
                return matchesSearch(row.name);
            });
            result.predictions_2026 = result.predictions_2026.filter(function (row) {
                return matchesSearch(row.name);
            });
        }

        if (hasCountry) {
            result.predictions_2026 = result.predictions_2026.filter(function (row) {
                return row.nationality === country;
            });
        }

        return result;
    }

    return {
        normalizeText: normalizeText,
        getEmptyData: getEmptyData,
        buildFilteredData: buildFilteredData
    };
}));
