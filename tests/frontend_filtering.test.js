const assert = require('assert');

const { buildFilteredData, normalizeText, getEmptyData } = require('../src/frontend/assets/js/filtering.js');

function buildSampleData() {
  return {
    main_kpis: {
      total_teams: 10,
      total_players: 20,
      total_prizes: 1000,
      countries_represented: 2,
      active_competitions: 2,
      average_age: 24,
      international_competitions: 1,
      national_competitions: 1
    },
    country_ranking: [
      { country: 'Chile', total_teams: 3, total_players: 5, total_prizes: 300 },
      { country: 'Mexico', total_teams: 2, total_players: 5, total_prizes: 200 }
    ],
    top_teams: [
      { name: 'Team A', country: 'Chile', total_prizes: 100, average_position: 1 },
      { name: 'Team B', country: 'Mexico', total_prizes: 90, average_position: 2 }
    ],
    top_players_2024: [
      { name: 'Jose Perez', nationality: 'Chile', performance_2024: 70 },
      { name: 'Ana Ruiz', nationality: 'Mexico', performance_2024: 60 }
    ],
    player_evolution: [
      { name: 'Jose Perez', nationality: 'Chile', team_2024: 'Team A', team_2025: 'Team A', performance_2024: 70, performance_2025: 80, trend: 'Improved', improvement: 10, improvement_pct: 14.29 },
      { name: 'Diego Soto', nationality: 'Chile', team_2024: 'Team A', team_2025: null, performance_2024: 65, performance_2025: null, trend: 'No data 2025', improvement: null, improvement_pct: null }
    ],
    veteran_players: [
      { team: 'Team A', country: 'Chile', veteran_player: 'Jose Perez', age: 28, performance_2024: 70 }
    ],
    radar_teamwork: [
      { team: 'Team A', country: 'Chile', avg_teamwork: 80, total_players: 5, avg_winrate: 70, total_prizes: 100 }
    ],
    scatter_age_performance_new: [
      { name: 'Jose Perez', age: 28, performance: 70, nationality: 'Chile', team: 'Team A' }
    ],
    competitions: [
      { name: 'Comp 2025', type: 'Internacional', year: 2025, location: 'Lima', participating_teams: 2, total_players: 10, total_prize: 500, average_prize_per_team: 250, average_age: 24 }
    ],
    summary_metrics: {
      best_international_team: 'Team A',
      best_player_2024: 'Jose Perez',
      most_improved_2025: 'Jose Perez',
      dominant_country: 'Chile',
      most_competitive: 'Comp 2025',
      overall_average_performance: 65,
      total_international_prizes: 600,
      total_national_prizes: 400
    },
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
      },
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
      }
    ],
    team_experience_summary: {
      teams_count: 2,
      veteran_starters_count: 1,
      veteran_substitutes_count: 1,
      veteran_mixed_count: 0,
      avg_team_age: 24,
      avg_veteran_age: 26.5,
      avg_age_span: 5
    },
    team_experience_profiles: [
      {
        team: 'Team A',
        country: 'Chile',
        veteran_player: 'Jose Perez',
        veteran_age: 28,
        veteran_role: 'Titular',
        veteran_performance_pct: 70,
        team_avg_age: 24,
        youngest_age: 21,
        oldest_age: 28,
        age_span: 7,
        team_avg_performance_pct: 65,
        veteran_vs_team_gap_pct: 5,
        competitions_count: 2
      },
      {
        team: 'Team B',
        country: 'Mexico',
        veteran_player: 'Ana Ruiz',
        veteran_age: 25,
        veteran_role: 'Suplente',
        veteran_performance_pct: null,
        team_avg_age: 24,
        youngest_age: 22,
        oldest_age: 25,
        age_span: 3,
        team_avg_performance_pct: 60,
        veteran_vs_team_gap_pct: null,
        competitions_count: 1
      }
    ],
    team_experience_leaders: {
      most_experienced_team: 'Team A',
      most_experienced_team_avg_age: 24,
      best_veteran_player: 'Jose Perez',
      best_veteran_team: 'Team A',
      best_veteran_performance_pct: 70,
      widest_age_gap_team: 'Team A',
      widest_age_gap_years: 7,
      highest_veteran_advantage_team: 'Team A',
      highest_veteran_advantage_pct: 5
    },
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
    },
    player_age_performance_summary: {
      players_count: 4,
      overall_average_performance_pct: 64.5,
      correlation_value: 0.22,
      correlation_strength: 'weak',
      correlation_direction: 'positive',
      best_age_band: '22-23',
      best_age_band_average_performance_pct: 69
    },
    player_age_performance_bands: [
      {
        age_band: '20-21',
        players_count: 1,
        average_performance_pct: 60,
        top_player_name: 'Jose Perez',
        top_player_team: 'Team A',
        top_player_performance_pct: 60
      },
      {
        age_band: '22-23',
        players_count: 2,
        average_performance_pct: 69,
        top_player_name: 'Ana Ruiz',
        top_player_team: 'Team B',
        top_player_performance_pct: 72
      },
      {
        age_band: '24+',
        players_count: 1,
        average_performance_pct: 63,
        top_player_name: 'Luis Mora',
        top_player_team: 'Team A',
        top_player_performance_pct: 63
      }
    ],
    player_age_performance_points: [
      {
        player_name: 'Jose Perez',
        team: 'Team A',
        team_country: 'Chile',
        player_nationality: 'Chile',
        age: 21,
        performance_pct: 60,
        age_band: '20-21',
        competitions_count: 2
      },
      {
        player_name: 'Ana Ruiz',
        team: 'Team B',
        team_country: 'Mexico',
        player_nationality: 'Mexico',
        age: 22,
        performance_pct: 72,
        age_band: '22-23',
        competitions_count: 1
      }
    ],
    player_age_performance_leaders: {
      young_standout_player: 'Jose Perez',
      young_standout_team: 'Team A',
      young_standout_performance_pct: 60,
      veteran_standout_player: 'Luis Mora',
      veteran_standout_team: 'Team A',
      veteran_standout_performance_pct: 63
    },
    role_analysis: [
      { role: 'Titular', total_participations: 3, unique_players: 3, average_performance: 70 }
    ],
    predictions_2026: [
      { name: 'Jose Perez', team: 'Team A', nationality: 'Chile', age_2026: 29, actual_winrate: 75, predicted_winrate: 77, delta: 2, trend: 'Improved' },
      { name: 'Ana Ruiz', team: 'Team B', nationality: 'Mexico', age_2026: 25, actual_winrate: 65, predicted_winrate: 64, delta: -1, trend: 'Declined' }
    ],
    ml_projection_2026_summary: {
      players_count: 2,
      improved_players_count: 1,
      declined_players_count: 1,
      stable_players_count: 0,
      best_projected_player: 'Jose Perez',
      best_projected_winrate: 77,
      biggest_improvement_player: 'Jose Perez',
      biggest_improvement_delta: 2,
      biggest_decline_player: 'Ana Ruiz',
      biggest_decline_delta: -1,
      best_projected_team: 'Team A',
      best_projected_team_avg_winrate: 77
    },
    ml_projection_2026_players: [
      {
        player_name: 'Jose Perez',
        team: 'Team A',
        team_country: 'Chile',
        player_nationality: 'Chile',
        age_2026: 29,
        actual_winrate: 75,
        predicted_winrate: 77,
        delta: 2,
        trend: 'Improved',
        confidence_score: 82,
        confidence_band: 'Alta',
        risk_band: 'Salto esperado',
        projected_rank: 1
      },
      {
        player_name: 'Ana Ruiz',
        team: 'Team B',
        team_country: 'Mexico',
        player_nationality: 'Mexico',
        age_2026: 25,
        actual_winrate: 65,
        predicted_winrate: 64,
        delta: -1,
        trend: 'Declined',
        confidence_score: 56,
        confidence_band: 'Media',
        risk_band: 'A observar',
        projected_rank: 2
      }
    ],
    ml_projection_2026_team_summary: [
      {
        team: 'Team A',
        country: 'Chile',
        players_count: 1,
        actual_avg_winrate: 75,
        projected_avg_winrate: 77,
        avg_delta: 2,
        improved_players_count: 1,
        declined_players_count: 0,
        top_projected_player: 'Jose Perez',
        top_projected_winrate: 77
      },
      {
        team: 'Team B',
        country: 'Mexico',
        players_count: 1,
        actual_avg_winrate: 65,
        projected_avg_winrate: 64,
        avg_delta: -1,
        improved_players_count: 0,
        declined_players_count: 1,
        top_projected_player: 'Ana Ruiz',
        top_projected_winrate: 64
      }
    ],
    ml_projection_2026_country_summary: [
      {
        country: 'Chile',
        players_count: 1,
        actual_avg_winrate: 75,
        projected_avg_winrate: 77,
        avg_delta: 2,
        improved_players_count: 1,
        declined_players_count: 0,
        top_projected_player: 'Jose Perez',
        top_projected_winrate: 77
      },
      {
        country: 'Mexico',
        players_count: 1,
        actual_avg_winrate: 65,
        projected_avg_winrate: 64,
        avg_delta: -1,
        improved_players_count: 0,
        declined_players_count: 1,
        top_projected_player: 'Ana Ruiz',
        top_projected_winrate: 64
      }
    ],
    ml_projection_2026_feature_importance: [
      { feature_key: 'trabajo_en_equipo', feature_label: 'Trabajo en equipo', importance_pct: 40, rank: 1 },
      { feature_key: 'win_loss_ratio', feature_label: 'Ratio victorias/derrotas', importance_pct: 35, rank: 2 }
    ],
    filter_ready: {
      kpis_by_country: [
        { country: 'Chile', total_teams: 3, total_players: 5, total_prizes: 300, average_age: 24, active_competitions: 1, international_competitions: 1, national_competitions: 0, countries_represented: 1 },
        { country: 'Mexico', total_teams: 2, total_players: 5, total_prizes: 200, average_age: 25, active_competitions: 1, international_competitions: 0, national_competitions: 1, countries_represented: 1 }
      ],
      kpis_by_competition: [
        { competition_name: 'Comp 2025', type: 'Internacional', year: 2025, total_teams: 2, total_players: 10, total_prizes: 500, average_age: 24, countries_represented: 2, international_competitions: 1, national_competitions: 0 }
      ],
      kpis_by_country_competition: [
        { competition_name: 'Comp 2025', country: 'Chile', type: 'Internacional', year: 2025, total_teams: 1, total_players: 5, total_prizes: 250, average_age: 24 }
      ],
      country_ranking_by_competition: [
        { competition_name: 'Comp 2025', country: 'Chile', total_teams: 1, total_players: 5, total_prizes: 250, average_prize_per_team: 250, average_age: 24 },
        { competition_name: 'Comp 2025', country: 'Mexico', total_teams: 1, total_players: 5, total_prizes: 250, average_prize_per_team: 250, average_age: 24 }
      ],
      top_teams_by_competition: [
        { competition_name: 'Comp 2025', team: 'Team A', country: 'Chile', final_position: 1, prize_obtained: 250 }
      ],
      top_players_by_competition: [
        { competition_name: 'Comp 2025', name: 'Jose Perez', nationality: 'Chile', performance_2024: 70, performance_2025: 80, trend: 'Improved' }
      ],
      player_evolution_by_competition: [
        { competition_name: 'Comp 2025', competition_year: 2025, name: 'Jose Perez', nationality: 'Chile', team: 'Team A', performance_2024: 70, performance_2025: 80, trend: 'Improved', improvement: 10, improvement_pct: 14.29, decline: 0 }
      ],
      role_analysis_by_competition: [
        { competition_name: 'Comp 2025', role: 'Titular', total_participations: 3, unique_players: 3, average_performance: 70 }
      ],
      squad_usage_by_country: [
        {
          country: 'Chile',
          starter_participations: 4,
          substitute_participations: 1,
          starter_share_pct: 80,
          substitute_share_pct: 20,
          starter_unique_players: 3,
          substitute_unique_players: 1,
          starter_avg_performance: 70,
          substitute_avg_performance: 72,
          performance_gap_pct: 2,
          teams_with_substitutes: 1,
          teams_without_substitutes: 0
        }
      ],
      squad_usage_by_competition: [
        {
          competition_name: 'Comp 2025',
          starter_participations: 6,
          substitute_participations: 1,
          starter_share_pct: 85.71,
          substitute_share_pct: 14.29,
          starter_unique_players: 5,
          substitute_unique_players: 1,
          starter_avg_performance: 69,
          substitute_avg_performance: 72,
          performance_gap_pct: 3,
          teams_with_substitutes: 1,
          teams_without_substitutes: 1
        }
      ],
      squad_usage_by_country_competition: [
        {
          competition_name: 'Comp 2025',
          country: 'Chile',
          starter_participations: 4,
          substitute_participations: 1,
          starter_share_pct: 80,
          substitute_share_pct: 20,
          starter_unique_players: 3,
          substitute_unique_players: 1,
          starter_avg_performance: 70,
          substitute_avg_performance: 72,
          performance_gap_pct: 2,
          teams_with_substitutes: 1,
          teams_without_substitutes: 0
        }
      ],
      squad_usage_team_breakdown_by_country: [
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
      ],
      squad_usage_team_breakdown_by_competition: [
        {
          competition_name: 'Comp 2025',
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
        },
        {
          competition_name: 'Comp 2025',
          team: 'Team B',
          country: 'Mexico',
          starter_participations: 2,
          substitute_participations: 0,
          starter_unique_players: 2,
          substitute_unique_players: 0,
          starter_avg_performance: 65,
          substitute_avg_performance: null,
          substitute_share_pct: 0,
          performance_gap_pct: null
        }
      ],
      squad_usage_team_breakdown_by_country_competition: [
        {
          competition_name: 'Comp 2025',
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
      ],
      team_experience_summary_by_country: [
        {
          country: 'Chile',
          teams_count: 1,
          veteran_starters_count: 1,
          veteran_substitutes_count: 0,
          veteran_mixed_count: 0,
          avg_team_age: 24,
          avg_veteran_age: 28,
          avg_age_span: 7
        }
      ],
      team_experience_summary_by_competition: [
        {
          competition_name: 'Comp 2025',
          teams_count: 2,
          veteran_starters_count: 1,
          veteran_substitutes_count: 1,
          veteran_mixed_count: 0,
          avg_team_age: 24,
          avg_veteran_age: 26.5,
          avg_age_span: 5
        }
      ],
      team_experience_summary_by_country_competition: [
        {
          competition_name: 'Comp 2025',
          country: 'Chile',
          teams_count: 1,
          veteran_starters_count: 1,
          veteran_substitutes_count: 0,
          veteran_mixed_count: 0,
          avg_team_age: 24,
          avg_veteran_age: 28,
          avg_age_span: 7
        }
      ],
      team_experience_profiles_by_country: [
        {
          team: 'Team A',
          country: 'Chile',
          veteran_player: 'Jose Perez',
          veteran_age: 28,
          veteran_role: 'Titular',
          veteran_performance_pct: 70,
          team_avg_age: 24,
          youngest_age: 21,
          oldest_age: 28,
          age_span: 7,
          team_avg_performance_pct: 65,
          veteran_vs_team_gap_pct: 5,
          competitions_count: 2
        }
      ],
      team_experience_profiles_by_competition: [
        {
          competition_name: 'Comp 2025',
          team: 'Team A',
          country: 'Chile',
          veteran_player: 'Jose Perez',
          veteran_age: 28,
          veteran_role: 'Titular',
          veteran_performance_pct: 70,
          team_avg_age: 24,
          youngest_age: 21,
          oldest_age: 28,
          age_span: 7,
          team_avg_performance_pct: 65,
          veteran_vs_team_gap_pct: 5,
          competitions_count: 1,
          competition_result: 1
        },
        {
          competition_name: 'Comp 2025',
          team: 'Team B',
          country: 'Mexico',
          veteran_player: 'Ana Ruiz',
          veteran_age: 25,
          veteran_role: 'Suplente',
          veteran_performance_pct: null,
          team_avg_age: 24,
          youngest_age: 22,
          oldest_age: 25,
          age_span: 3,
          team_avg_performance_pct: 60,
          veteran_vs_team_gap_pct: null,
          competitions_count: 1,
          competition_result: 2
        }
      ],
      team_experience_profiles_by_country_competition: [
        {
          competition_name: 'Comp 2025',
          team: 'Team A',
          country: 'Chile',
          veteran_player: 'Jose Perez',
          veteran_age: 28,
          veteran_role: 'Titular',
          veteran_performance_pct: 70,
          team_avg_age: 24,
          youngest_age: 21,
          oldest_age: 28,
          age_span: 7,
          team_avg_performance_pct: 65,
          veteran_vs_team_gap_pct: 5,
          competitions_count: 1,
          competition_result: 1
        }
      ],
      team_experience_leaders_by_country: [
        {
          country: 'Chile',
          most_experienced_team: 'Team A',
          most_experienced_team_avg_age: 24,
          best_veteran_player: 'Jose Perez',
          best_veteran_team: 'Team A',
          best_veteran_performance_pct: 70,
          widest_age_gap_team: 'Team A',
          widest_age_gap_years: 7,
          highest_veteran_advantage_team: 'Team A',
          highest_veteran_advantage_pct: 5
        }
      ],
      team_experience_leaders_by_competition: [
        {
          competition_name: 'Comp 2025',
          most_experienced_team: 'Team A',
          most_experienced_team_avg_age: 24,
          best_veteran_player: 'Jose Perez',
          best_veteran_team: 'Team A',
          best_veteran_performance_pct: 70,
          widest_age_gap_team: 'Team A',
          widest_age_gap_years: 7,
          highest_veteran_advantage_team: 'Team A',
          highest_veteran_advantage_pct: 5
        }
      ],
      team_experience_leaders_by_country_competition: [
        {
          competition_name: 'Comp 2025',
          country: 'Chile',
          most_experienced_team: 'Team A',
          most_experienced_team_avg_age: 24,
          best_veteran_player: 'Jose Perez',
          best_veteran_team: 'Team A',
          best_veteran_performance_pct: 70,
          widest_age_gap_team: 'Team A',
          widest_age_gap_years: 7,
          highest_veteran_advantage_team: 'Team A',
          highest_veteran_advantage_pct: 5
        }
      ],
      team_comparison_profiles_by_country: [
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
      team_comparison_profiles_by_competition: [
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
      team_comparison_profiles_by_country_competition: [
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
      team_comparison_leaders_by_country: [
        {
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
      ],
      team_comparison_leaders_by_competition: [
        {
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
      ],
      team_comparison_leaders_by_country_competition: [
        {
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
      ],
      player_age_performance_summary_by_country: [
        {
          country: 'Chile',
          players_count: 2,
          overall_average_performance_pct: 61.5,
          correlation_value: 0.18,
          correlation_strength: 'weak',
          correlation_direction: 'positive',
          best_age_band: '20-21',
          best_age_band_average_performance_pct: 62
        }
      ],
      player_age_performance_summary_by_competition: [
        {
          competition_name: 'Comp 2025',
          players_count: 3,
          overall_average_performance_pct: 66,
          correlation_value: -0.1,
          correlation_strength: 'none',
          correlation_direction: 'neutral',
          best_age_band: '22-23',
          best_age_band_average_performance_pct: 70
        }
      ],
      player_age_performance_summary_by_country_competition: [
        {
          competition_name: 'Comp 2025',
          country: 'Chile',
          players_count: 2,
          overall_average_performance_pct: 65,
          correlation_value: 0.25,
          correlation_strength: 'weak',
          correlation_direction: 'positive',
          best_age_band: '22-23',
          best_age_band_average_performance_pct: 68
        }
      ],
      player_age_performance_bands_by_country: [
        {
          country: 'Chile',
          age_band: '20-21',
          players_count: 1,
          average_performance_pct: 60,
          top_player_name: 'Jose Perez',
          top_player_team: 'Team A',
          top_player_performance_pct: 60
        }
      ],
      player_age_performance_bands_by_competition: [
        {
          competition_name: 'Comp 2025',
          age_band: '22-23',
          players_count: 2,
          average_performance_pct: 70,
          top_player_name: 'Jose Perez',
          top_player_team: 'Team A',
          top_player_performance_pct: 70
        }
      ],
      player_age_performance_bands_by_country_competition: [
        {
          competition_name: 'Comp 2025',
          country: 'Chile',
          age_band: '22-23',
          players_count: 1,
          average_performance_pct: 68,
          top_player_name: 'Jose Perez',
          top_player_team: 'Team A',
          top_player_performance_pct: 68
        }
      ],
      player_age_performance_points_by_country: [
        {
          player_name: 'Jose Perez',
          team: 'Team A',
          team_country: 'Chile',
          player_nationality: 'Chile',
          age: 21,
          performance_pct: 60,
          age_band: '20-21',
          competitions_count: 2,
          country: 'Chile'
        }
      ],
      player_age_performance_points_by_competition: [
        {
          player_name: 'Jose Perez',
          team: 'Team A',
          team_country: 'Chile',
          player_nationality: 'Chile',
          age: 22,
          performance_pct: 70,
          age_band: '22-23',
          competition_name: 'Comp 2025'
        },
        {
          player_name: 'Ana Ruiz',
          team: 'Team B',
          team_country: 'Mexico',
          player_nationality: 'Mexico',
          age: 23,
          performance_pct: 62,
          age_band: '22-23',
          competition_name: 'Comp 2025'
        }
      ],
      player_age_performance_points_by_country_competition: [
        {
          player_name: 'Jose Perez',
          team: 'Team A',
          team_country: 'Chile',
          player_nationality: 'Chile',
          age: 22,
          performance_pct: 68,
          age_band: '22-23',
          competition_name: 'Comp 2025',
          country: 'Chile'
        }
      ],
      player_age_performance_leaders_by_country: [
        {
          country: 'Chile',
          young_standout_player: 'Jose Perez',
          young_standout_team: 'Team A',
          young_standout_performance_pct: 60,
          veteran_standout_player: 'Luis Mora',
          veteran_standout_team: 'Team A',
          veteran_standout_performance_pct: 63
        }
      ],
      player_age_performance_leaders_by_competition: [
        {
          competition_name: 'Comp 2025',
          young_standout_player: 'Jose Perez',
          young_standout_team: 'Team A',
          young_standout_performance_pct: 70,
          veteran_standout_player: 'Ana Ruiz',
          veteran_standout_team: 'Team B',
          veteran_standout_performance_pct: 62
        }
      ],
      player_age_performance_leaders_by_country_competition: [
        {
          competition_name: 'Comp 2025',
          country: 'Chile',
          young_standout_player: 'Jose Perez',
          young_standout_team: 'Team A',
          young_standout_performance_pct: 68,
          veteran_standout_player: 'Jose Perez',
          veteran_standout_team: 'Team A',
          veteran_standout_performance_pct: 68
        }
      ],
      ml_projection_2026_summary_by_country: [
        {
          country: 'Chile',
          players_count: 1,
          improved_players_count: 1,
          declined_players_count: 0,
          stable_players_count: 0,
          best_projected_player: 'Jose Perez',
          best_projected_winrate: 77,
          biggest_improvement_player: 'Jose Perez',
          biggest_improvement_delta: 2,
          biggest_decline_player: '',
          biggest_decline_delta: null,
          best_projected_team: 'Team A',
          best_projected_team_avg_winrate: 77
        },
        {
          country: 'Mexico',
          players_count: 1,
          improved_players_count: 0,
          declined_players_count: 1,
          stable_players_count: 0,
          best_projected_player: 'Ana Ruiz',
          best_projected_winrate: 64,
          biggest_improvement_player: '',
          biggest_improvement_delta: null,
          biggest_decline_player: 'Ana Ruiz',
          biggest_decline_delta: -1,
          best_projected_team: 'Team B',
          best_projected_team_avg_winrate: 64
        }
      ],
      ml_projection_2026_players_by_country: [
        {
          country: 'Chile',
          player_name: 'Jose Perez',
          team: 'Team A',
          team_country: 'Chile',
          player_nationality: 'Chile',
          age_2026: 29,
          actual_winrate: 75,
          predicted_winrate: 77,
          delta: 2,
          trend: 'Improved',
          confidence_score: 82,
          confidence_band: 'Alta',
          risk_band: 'Salto esperado',
          projected_rank: 1
        },
        {
          country: 'Mexico',
          player_name: 'Ana Ruiz',
          team: 'Team B',
          team_country: 'Mexico',
          player_nationality: 'Mexico',
          age_2026: 25,
          actual_winrate: 65,
          predicted_winrate: 64,
          delta: -1,
          trend: 'Declined',
          confidence_score: 56,
          confidence_band: 'Media',
          risk_band: 'A observar',
          projected_rank: 1
        }
      ],
      ml_projection_2026_team_summary_by_country: [
        {
          country: 'Chile',
          team: 'Team A',
          players_count: 1,
          actual_avg_winrate: 75,
          projected_avg_winrate: 77,
          avg_delta: 2,
          improved_players_count: 1,
          declined_players_count: 0,
          top_projected_player: 'Jose Perez',
          top_projected_winrate: 77
        },
        {
          country: 'Mexico',
          team: 'Team B',
          players_count: 1,
          actual_avg_winrate: 65,
          projected_avg_winrate: 64,
          avg_delta: -1,
          improved_players_count: 0,
          declined_players_count: 1,
          top_projected_player: 'Ana Ruiz',
          top_projected_winrate: 64
        }
      ],
      ml_projection_2026_country_summary_by_country: [
        {
          country: 'Chile',
          players_count: 1,
          actual_avg_winrate: 75,
          projected_avg_winrate: 77,
          avg_delta: 2,
          improved_players_count: 1,
          declined_players_count: 0,
          top_projected_player: 'Jose Perez',
          top_projected_winrate: 77
        },
        {
          country: 'Mexico',
          players_count: 1,
          actual_avg_winrate: 65,
          projected_avg_winrate: 64,
          avg_delta: -1,
          improved_players_count: 0,
          declined_players_count: 1,
          top_projected_player: 'Ana Ruiz',
          top_projected_winrate: 64
        }
      ],
      radar_teamwork_by_competition: [
        { competition_name: 'Comp 2025', team: 'Team A', country: 'Chile', avg_teamwork: 80, total_players: 5, avg_winrate: 70, total_prizes: 250 }
      ],
      scatter_age_performance_by_competition: [
        { competition_name: 'Comp 2025', name: 'Jose Perez', age: 28, performance: 70, nationality: 'Chile', team: 'Team A' }
      ],
      veteran_players_by_competition: [
        { competition_name: 'Comp 2025', team: 'Team A', country: 'Chile', veteran_player: 'Jose Perez', age: 28, performance_2024: 70 }
      ],
      players_index: [
        { name: 'Jose Perez', nationality: 'Chile', team: 'Team A', search_key: 'jose perez' },
        { name: 'Ana Ruiz', nationality: 'Mexico', team: 'Team B', search_key: 'ana ruiz' }
      ]
    }
  };
}

(function testNormalizeText() {
  assert.strictEqual(normalizeText('Jos\u00e9 P\u00e9rez'), 'jose perez');
})();

(function testEmptyData() {
  const empty = getEmptyData();
  assert.ok(empty.main_kpis);
  assert.deepStrictEqual(empty.filter_ready.players_index, []);
  assert.ok(Object.prototype.hasOwnProperty.call(empty, 'squad_usage_summary'));
  assert.deepStrictEqual(empty.filter_ready.squad_usage_by_country, []);
  assert.deepStrictEqual(empty.team_experience_profiles, []);
  assert.deepStrictEqual(empty.team_experience_leaders, {});
  assert.deepStrictEqual(empty.team_comparison_profiles, []);
  assert.deepStrictEqual(empty.team_comparison_leaders, {});
  assert.deepStrictEqual(empty.player_age_performance_summary, {});
  assert.deepStrictEqual(empty.player_age_performance_bands, []);
  assert.deepStrictEqual(empty.player_age_performance_points, []);
  assert.deepStrictEqual(empty.player_age_performance_leaders, {});
  assert.deepStrictEqual(empty.ml_projection_2026_summary, {});
  assert.deepStrictEqual(empty.ml_projection_2026_players, []);
  assert.deepStrictEqual(empty.ml_projection_2026_team_summary, []);
  assert.deepStrictEqual(empty.ml_projection_2026_country_summary, []);
  assert.deepStrictEqual(empty.ml_projection_2026_feature_importance, []);
  assert.deepStrictEqual(empty.filter_ready.ml_projection_2026_summary_by_country, []);
})();

(function testNoFilters() {
  const data = buildSampleData();
  const result = buildFilteredData(data, { country: '', competition: '', search: '' });
  assert.strictEqual(result.main_kpis.total_teams, data.main_kpis.total_teams);
  assert.strictEqual(result.top_teams.length, data.top_teams.length);
  assert.strictEqual(result.squad_usage_summary.starter_participations, 7);
  assert.strictEqual(result.squad_usage_team_breakdown.length, 2);
  assert.strictEqual(result.team_experience_profiles.length, 2);
  assert.strictEqual(result.team_experience_leaders.best_veteran_player, 'Jose Perez');
  assert.strictEqual(result.team_comparison_profiles.length, 2);
  assert.strictEqual(result.team_comparison_leaders.best_teamwork_team, 'Team A');
  assert.strictEqual(result.player_age_performance_summary.players_count, 4);
  assert.strictEqual(result.player_age_performance_bands.length, 3);
  assert.strictEqual(result.player_age_performance_points.length, 2);
  assert.strictEqual(result.player_age_performance_leaders.young_standout_player, 'Jose Perez');
  assert.strictEqual(result.ml_projection_2026_summary.players_count, 2);
  assert.strictEqual(result.ml_projection_2026_players.length, 2);
})();

(function testCountryOnly() {
  const data = buildSampleData();
  const result = buildFilteredData(data, { country: 'Chile', competition: '', search: '' });
  assert.strictEqual(result.main_kpis.total_teams, 3);
  assert.strictEqual(result.country_ranking.length, 1);
  assert.strictEqual(result.country_ranking[0].country, 'Chile');
  assert.strictEqual(result.role_analysis.length, 0);
  assert.strictEqual(result.squad_usage_summary.country, 'Chile');
  assert.strictEqual(result.squad_usage_summary.substitute_share_pct, 20);
  assert.strictEqual(result.squad_usage_team_breakdown.length, 1);
  assert.strictEqual(result.squad_usage_team_breakdown[0].team, 'Team A');
  assert.strictEqual(result.team_experience_profiles.length, 1);
  assert.strictEqual(result.team_experience_profiles[0].country, 'Chile');
  assert.strictEqual(result.team_experience_leaders.country, 'Chile');
  assert.strictEqual(result.team_comparison_profiles.length, 1);
  assert.strictEqual(result.team_comparison_profiles[0].country, 'Chile');
  assert.strictEqual(result.team_comparison_leaders.country, 'Chile');
  assert.strictEqual(result.player_age_performance_summary.country, 'Chile');
  assert.strictEqual(result.player_age_performance_bands.length, 1);
  assert.strictEqual(result.player_age_performance_points.length, 1);
  assert.strictEqual(result.player_age_performance_points[0].team_country, 'Chile');
  assert.strictEqual(result.player_age_performance_leaders.country, 'Chile');
  assert.strictEqual(result.ml_projection_2026_summary.country, 'Chile');
  assert.strictEqual(result.ml_projection_2026_players.length, 1);
  assert.strictEqual(result.ml_projection_2026_players[0].team_country, 'Chile');
})();

(function testCompetitionOnly() {
  const data = buildSampleData();
  const result = buildFilteredData(data, { country: '', competition: 'Comp 2025', search: '' });
  assert.strictEqual(result.main_kpis.total_teams, 2);
  assert.strictEqual(result.country_ranking.length, 2);
  assert.strictEqual(result.role_analysis.length, 1);
  assert.strictEqual(result.squad_usage_summary.competition_name, 'Comp 2025');
  assert.strictEqual(result.squad_usage_summary.starter_unique_players, 5);
  assert.strictEqual(result.squad_usage_team_breakdown.length, 2);
  assert.strictEqual(result.team_experience_profiles.length, 2);
  assert.strictEqual(result.team_experience_profiles[0].competition_name, 'Comp 2025');
  assert.strictEqual(result.team_experience_leaders.competition_name, 'Comp 2025');
  assert.strictEqual(result.team_comparison_profiles.length, 2);
  assert.strictEqual(result.team_comparison_profiles[0].competition_name, 'Comp 2025');
  assert.strictEqual(result.team_comparison_leaders.competition_name, 'Comp 2025');
  assert.strictEqual(result.player_age_performance_summary.competition_name, 'Comp 2025');
  assert.strictEqual(result.player_age_performance_bands.length, 1);
  assert.strictEqual(result.player_age_performance_points.length, 2);
  assert.strictEqual(result.player_age_performance_points[0].competition_name, 'Comp 2025');
  assert.strictEqual(result.player_age_performance_leaders.competition_name, 'Comp 2025');
  assert.strictEqual(result.ml_projection_2026_summary.players_count, 2);
  assert.strictEqual(result.ml_projection_2026_players.length, 2);
})();

(function testCountryAndCompetition() {
  const data = buildSampleData();
  const result = buildFilteredData(data, { country: 'Chile', competition: 'Comp 2025', search: '' });
  assert.strictEqual(result.main_kpis.total_players, 5);
  assert.strictEqual(result.country_ranking.length, 1);
  assert.strictEqual(result.role_analysis.length, 0);
  assert.strictEqual(result.squad_usage_summary.country, 'Chile');
  assert.strictEqual(result.squad_usage_summary.competition_name, 'Comp 2025');
  assert.strictEqual(result.squad_usage_team_breakdown.length, 1);
  assert.strictEqual(result.team_experience_profiles.length, 1);
  assert.strictEqual(result.team_experience_profiles[0].competition_name, 'Comp 2025');
  assert.strictEqual(result.team_experience_leaders.country, 'Chile');
  assert.strictEqual(result.team_comparison_profiles.length, 1);
  assert.strictEqual(result.team_comparison_profiles[0].competition_name, 'Comp 2025');
  assert.strictEqual(result.team_comparison_leaders.country, 'Chile');
  assert.strictEqual(result.player_age_performance_summary.country, 'Chile');
  assert.strictEqual(result.player_age_performance_summary.competition_name, 'Comp 2025');
  assert.strictEqual(result.player_age_performance_bands.length, 1);
  assert.strictEqual(result.player_age_performance_points.length, 1);
  assert.strictEqual(result.player_age_performance_points[0].competition_name, 'Comp 2025');
  assert.strictEqual(result.player_age_performance_leaders.country, 'Chile');
  assert.strictEqual(result.ml_projection_2026_summary.country, 'Chile');
  assert.strictEqual(result.ml_projection_2026_players.length, 1);
  assert.strictEqual(result.ml_projection_2026_players[0].team_country, 'Chile');
})();

(function testSearchFiltersPlayersOnly() {
  const data = buildSampleData();
  const result = buildFilteredData(data, { country: '', competition: '', search: 'Jose' });
  assert.strictEqual(result.main_kpis.total_teams, data.main_kpis.total_teams);
  assert.strictEqual(result.top_players_2024.length, 1);
  assert.strictEqual(result.predictions_2026.length, 1);
  assert.strictEqual(result.player_evolution.length, data.player_evolution.length);
  assert.strictEqual(result.squad_usage_summary.starter_participations, 7);
  assert.strictEqual(result.squad_usage_team_breakdown.length, 2);
  assert.strictEqual(result.team_experience_profiles.length, 2);
  assert.strictEqual(result.team_experience_leaders.best_veteran_player, 'Jose Perez');
  assert.strictEqual(result.team_comparison_profiles.length, 2);
  assert.strictEqual(result.team_comparison_leaders.best_teamwork_team, 'Team A');
  assert.strictEqual(result.player_age_performance_points.length, 2);
  assert.strictEqual(result.player_age_performance_bands.length, 3);
  assert.strictEqual(result.player_age_performance_summary.players_count, 4);
})();

(function testCompetitionEvolutionRowsKeepPhase2Fields() {
  const data = buildSampleData();
  const result = buildFilteredData(data, { country: '', competition: 'Comp 2025', search: '' });
  assert.strictEqual(result.player_evolution.length, 1);
  assert.strictEqual(result.player_evolution[0].competition_year, 2025);
  assert.strictEqual(result.player_evolution[0].team, 'Team A');
  assert.strictEqual(result.player_evolution[0].improvement_pct, 14.29);
})();

console.log('frontend_filtering tests passed');
