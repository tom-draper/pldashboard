<script lang="ts">
  import { onMount } from 'svelte';
  import { ordinal } from '../../../lib/format';
  import {
    isCleanSheet,
    notScored,
    goalsScored,
    goalsConceded,
  } from '../../../lib/goals';
  import type { DashboardData } from '../../../lib/dashboard.types';

  function getStatsRank(
    seasonStats: Stats,
    attribute: string,
    team: string,
    reverse: boolean
  ): number {
    const sorted = Object.keys(seasonStats).sort(function (team1, team2) {
      return seasonStats[team2][attribute] - seasonStats[team1][attribute];
    });
    let rank = sorted.indexOf(team) + 1;
    if (reverse) {
      rank = 21 - rank;
    }
    return rank;
  }

  function getStatsRankings(seasonStats: Stats, team: string): StatsRank {
    const xGRank = getStatsRank(seasonStats, 'xG', team, false);
    // Reverse - lower rank the better
    const xCRank = getStatsRank(seasonStats, 'xC', team, true);
    const cleanSheetRatioRank = getStatsRank(
      seasonStats,
      'cleanSheetRatio',
      team,
      false
    );
    return {
      xG: `${xGRank}${ordinal(xGRank)}`,
      xC: `${xCRank}${ordinal(xCRank)}`,
      cleanSheetRatio: `${cleanSheetRatioRank}${ordinal(cleanSheetRatioRank)}`,
    };
  }

  function setStatsValues(seasonStats: Stats, team: string) {
    rank = getStatsRankings(seasonStats, team);

    // Keep ordinal values at the correct offset
    // Once rank values have updated, init positional offset for ordinal values
    // window.addEventListener("resize", setPositionalOffset);
  }

  function countOccurances(
    data: DashboardData,
    seasonStats: Stats,
    team: string,
    season: number
  ) {
    if (!(team in data.form)) {
      return;
    }

    for (const matchday of Object.keys(data.form[team][season])) {
      const score = data.form[team][season][matchday].score;
      if (score == null) {
        continue
      }
      const atHome = data.form[team][season][matchday].atHome;
      if (isCleanSheet(score.homeGoals, score.awayGoals, atHome)) {
        seasonStats[team].cleanSheetRatio += 1;
      }
      if (notScored(score.homeGoals, score.awayGoals, atHome)) {
        seasonStats[team].noGoalRatio += 1;
      }
      seasonStats[team].xG += goalsScored(
        score.homeGoals,
        score.awayGoals,
        atHome
      );
      seasonStats[team].xC += goalsConceded(
        score.homeGoals,
        score.awayGoals,
        atHome
      );
      seasonStats[team].played += 1;
    }
  }

  function buildStats(data: DashboardData): Stats {
    const stats = {};
    for (const team of Object.keys(data.standings)) {
      stats[team] = {
        cleanSheetRatio: 0,
        noGoalRatio: 0,
        xC: 0,
        xG: 0,
        played: 0,
      };

      countOccurances(data, stats as Stats, team, data._id);
      countOccurances(data, stats as Stats, team, data._id - 1);

      if (stats[team].played === 0) {
        continue;
      }
      stats[team].xG /= stats[team].played;
      stats[team].xC /= stats[team].played;
      stats[team].cleanSheetRatio /= stats[team].played;
      stats[team].noGoalRatio /= stats[team].played;
    }

    return stats as Stats;
  }

  function refreshStatsValues() {
    if (!setup) {
      return
    }
    setStatsValues(stats, team);
  }

  type Stats = {
    [teamName: string]: {
      played: number;
      xG: number;
      xC: number;
      cleanSheetRatio: number;
      noGoalRatio: number;
    };
  };

  type StatsRank = {
    xG: string;
    xC: string;
    cleanSheetRatio: string;
  };

  let stats: Stats;
  let rank: StatsRank = {
    xG: '',
    xC: '',
    cleanSheetRatio: '',
  };
  let setup = false;
  onMount(() => {
    stats = buildStats(data);
    stats;
    setStatsValues(stats, team);
    setup = true;
  });

  $: team && refreshStatsValues();

  export let data: DashboardData, team: string;
</script>

{#if stats != undefined}
  <div class="season-stats">
    <div class="season-stat goals-per-game">
      <div class="season-stat-value">
        <div class="season-stat-position hidden">
          {rank.xG}
        </div>
        <div class="season-stat-number">
          {stats[team].xG.toFixed(2)}
        </div>
        <div class="season-stat-position ssp-{rank.xG}">
          {rank.xG}
        </div>
      </div>
      <div class="season-stat-text">goals per game</div>
    </div>
    <div class="season-stat conceded-per-game">
      <div class="season-stat-value">
        <div class="season-stat-position hidden">
          {rank.xC}
        </div>
        <div class="season-stat-number">
          {stats[team].xC.toFixed(2)}
        </div>
        <div class="season-stat-position ssp-{rank.xC}">
          {rank.xC}
        </div>
      </div>
      <div class="season-stat-text">conceded per game</div>
    </div>
    <div class="season-stat clean-sheet-ratio">
      <div class="season-stat-value">
        <div class="season-stat-position hidden">
          {rank.cleanSheetRatio}
        </div>
        <div class="season-stat-number">
          {stats[team].cleanSheetRatio.toFixed(2)}
        </div>
        <div class="season-stat-position ssp-{rank.cleanSheetRatio}">
          {rank.cleanSheetRatio}
        </div>
      </div>
      <div class="season-stat-text">clean sheets</div>
    </div>
  </div>
{/if}

<style scoped>
  .ssp-1st {
    color: var(--green);
  }
  .ssp-2nd {
    color: #48f98f;
  }
  .ssp-3rd {
    color: #65f497;
  }
  .ssp-4th {
    color: #7aef9f;
  }
  .ssp-5th {
    color: #8ceaa7;
  }
  .ssp-6th {
    color: #9be4af;
  }
  .ssp-7th {
    color: #a9deb6;
  }
  .ssp-8th {
    color: #b6d9bd;
  }
  .ssp-9th {
    color: #c1d2c5;
  }
  .ssp-10th {
    color: #cccccc;
  }
  .ssp-11th {
    color: #cccccc;
  }
  .ssp-12th {
    color: #d7beb9;
  }
  .ssp-13th {
    color: #e0b0a6;
  }
  .ssp-14th {
    color: #e7a293;
  }
  .ssp-15th {
    color: #ed9380;
  }
  .ssp-16th {
    color: #f1836e;
  }
  .ssp-17th {
    color: #f4735c;
  }
  .ssp-18th {
    color: #f6604b;
  }
  .ssp-19th {
    color: #f84c39;
  }
  .ssp-20th {
    color: #f83027;
  }
  .season-stats {
    display: flex;
    font-size: 2.2em;
    width: 100%;
    letter-spacing: -0.06em;
  }

  .season-stat-value {
    font-size: 3.2em;
    line-height: 0.6em;
    font-weight: 700;
    width: fit-content;
    margin: 0 auto;
    position: relative;
    user-select: none;
    display: flex;
  }

  .season-stat-position {
    font-size: 0.3em;
    line-height: 0;
    margin-left: 0.2em;
  }
  .hidden {
    color: transparent;
  }

  .season-stat {
    flex: 1;
  }

  @media only screen and (max-width: 1400px) {
    .season-stat-value {
      font-size: 2.5em;
    }

    .season-stats-row {
      margin: 70px 0 10px;
    }

    .season-stat-text {
      font-size: 0.9em;
    }
  }

  @media only screen and (max-width: 800px) {
    .season-stats {
      flex-direction: column;
    }

    .season-stat-text {
      font-size: 0.9em;
    }
    .season-stat {
      margin: 0.5em 0 0.9em 0;
    }

    .season-stat-value {
      font-size: 2.5em;
    }

    .season-stat-text {
      font-size: 0.9em;
    }
  }

  @media only screen and (max-width: 550px) {
    .season-stat-value {
      font-size: 1.4em;
      letter-spacing: 0.01em;
    }

    .season-stat {
      margin: 0.25em 0 0.45em 0;
    }
    .season-stat-position {
      font-size: 0.5em;
      top: -0.5em;
    }
    .season-stat-text {
      letter-spacing: -0.04em;
      font-size: 0.7em;
    }
  }
</style>
