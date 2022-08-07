<script>
  import { onMount } from "svelte";

  function ordinal(n) {
    let ord = [, "st", "nd", "rd"];
    let a = n % 100;
    return n + (ord[a > 20 ? a % 10 : a] || "th");
  }

  function getStatsRank(seasonStats, attribute, team, reverse) {
    let sorted = Object.keys(seasonStats).sort(function (team1, team2) {
      return seasonStats[team2][attribute] - seasonStats[team1][attribute];
    });
    let rank = sorted.indexOf(team) + 1;
    if (reverse) {
      rank = 21 - rank;
    }
    return rank;
  }

  function getStatsRankings(seasonStats, team) {
    let xGRank = ordinal(getStatsRank(seasonStats, "xG", team, false));
    // Reverse - lower rank the better
    let xCRank = ordinal(getStatsRank(seasonStats, "xC", team, true));
    let cleanSheetRatioRank = ordinal(
      getStatsRank(seasonStats, "cleanSheetRatio", team, false)
    );
    return { xG: xGRank, xC: xCRank, cleanSheetRatio: cleanSheetRatioRank };
  }

  function setPositionalOffset() {
    document.documentElement.style.setProperty(
      "--ssp1-offset",
      -ssp1.clientWidth / 2 + "px"
    );
    document.documentElement.style.setProperty(
      "--ssp2-offset",
      -ssp2.clientWidth / 2 + "px"
    );
    document.documentElement.style.setProperty(
      "--ssp3-offset",
      -ssp3.clientWidth / 2 + "px"
    );
  }

  function setStatsValues(seasonStats, team) {
    rank = getStatsRankings(seasonStats, team);

    // Keep ordinal values at the correct offset
    // Once rank values have updated, init positional offset for ordinal values
    window.addEventListener("resize", setPositionalOffset);
    // setTimeout(function () {
    //   setPositionalOffset();
    // }, 0);
  }

  function isCleanSheet(h, a, atHome) {
    return (a == 0 && atHome) || (h == 0 && !atHome)
  }

  function goalsScored(h, a, atHome) {
    if (atHome) {
      return h
    } else {
      return a
    }
  }

  function goalsConceded(h, a, atHome) {
    if (atHome) {
      return a
    } else {
      return h
    }
  }

  function notScored(h, a, atHome) {
    return (h == 0 && atHome) || (a == 0 && !atHome)
  }

  function countOccurances(data, seasonStats, team, season) {
    if (!(team in data.form[season])) {
      return
    }

    for (let matchday of Object.keys(data.form[season][team])) {
      let score = data.form[season][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(' ');
        h = parseInt(h);
        a = parseInt(a);
        let atHome = data.form[season][team][matchday].atHome;
        if (isCleanSheet(h, a, atHome)) {
          seasonStats[team].cleanSheetRatio += 1
        }
        if (notScored(h, a, atHome)) {
          seasonStats[team].noGoalRatio += 1
        }
        seasonStats[team].xG += goalsScored(h, a, atHome)
        seasonStats[team].xC += goalsConceded(h, a, atHome)
        seasonStats[team].played += 1
      }
    }
  }
  
  function buildSeasonStats(data) {
    let seasonStats = {}
    for (let team of data.teamNames) {
      seasonStats[team] = {cleanSheetRatio: 0, noGoalRatio: 0, xC: 0, xG: 0, played: 0}

      countOccurances(data, seasonStats, team, data._id)
      countOccurances(data, seasonStats, team, data._id-1)

      if (seasonStats[team].played > 0) {
        seasonStats[team].xG /= seasonStats[team].played
        seasonStats[team].xC /= seasonStats[team].played
        seasonStats[team].cleanSheetRatio /= seasonStats[team].played
        seasonStats[team].noGoalRatio /= seasonStats[team].played
      }
    }

    return seasonStats;
  }

  function refreshStatsValues() {
    if (setup) {
      // seasonStats = buildSeasonStats(data)
      setStatsValues(seasonStats, team);
    }
  }

  let seasonStats;
  let ssp1, ssp2, ssp3;
  let rank = {
    xG: "",
    xC: "",
    cleanSheetRatio: "",
  };
  let setup = false;
  onMount(() => {
    seasonStats = buildSeasonStats(data);
    setStatsValues(seasonStats, team);
    setup = true;
  });

  $: team && refreshStatsValues();

  export let data, team;
</script>

{#if seasonStats != undefined}
  <div class="season-stats">
    <div class="season-stat goals-per-game">
      <div class="season-stat-value">
        {seasonStats[team].xG.toFixed(2)}
        <div
          class="season-stat-position ssp-{rank.xG}"
          id="ssp1"
          bind:this={ssp1}
        >
          {rank.xG}
        </div>
      </div>
      <div class="season-stat-text">goals per game</div>
    </div>
    <div class="season-stat conceded-per-game">
      <div class="season-stat-value">
        {seasonStats[team].xC.toFixed(2)}
        <div
          class="season-stat-position ssp-{rank.xC}"
          id="ssp2"
          bind:this={ssp2}
        >
          {rank.xC}
        </div>
      </div>
      <div class="season-stat-text">conceded per game</div>
    </div>
    <div class="season-stat clean-sheet-ratio">
      <div class="season-stat-value">
        {seasonStats[team].cleanSheetRatio.toFixed(2)}
        <div
          class="season-stat-position ssp-{rank.cleanSheetRatio}"
          id="ssp3"
          bind:this={ssp3}
        >
          {rank.cleanSheetRatio}
        </div>
      </div>
      <div class="season-stat-text">clean sheets</div>
    </div>
  </div>
{/if}

<style scoped>
  #ssp1 {
    right: calc(var(--ssp1-offset) - 1.2em);
  }
  #ssp2 {
    right: calc(var(--ssp2-offset) - 1.2em);
  }
  #ssp3 {
    right: calc(var(--ssp3-offset) - 1.2em);
  }
  .ssp-1st {
    color: #6cff68;
  }
  .ssp-2nd {
    color: #78f570;
  }
  .ssp-3rd {
    color: #81eb78;
  }
  .ssp-4th {
    color: #89e07f;
  }
  .ssp-5th {
    color: #8fd686;
  }
  .ssp-6th {
    color: #95cc8c;
  }
  .ssp-7th {
    color: #99c192;
  }
  .ssp-8th {
    color: #9db797;
  }
  .ssp-9th {
    color: #a0ad9d;
  }
  .ssp-10th {
    color: #a2a2a2;
  }
  .ssp-11th {
    color: #a2a2a2;
  }
  .ssp-12th {
    color: #af9d9b;
  }
  .ssp-13th {
    color: #bc9895;
  }
  .ssp-14th {
    color: #c7928e;
  }
  .ssp-15th {
    color: #d18d88;
  }
  .ssp-16th {
    color: #db8681;
  }
  .ssp-17th {
    color: #e5807b;
  }
  .ssp-18th {
    color: #ee7975;
  }
  .ssp-19th {
    color: #f7716e;
  }
  .ssp-20th {
    color: #ff6868;
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
  }

  .season-stat-position {
    font-size: 0.3em;
    position: absolute;
    top: -1em;
    letter-spacing: -0.07em;
  }

  .season-stat {
    flex: 1;
  }

  @media only screen and (max-width: 1400px) {
    .season-stat-value {
      font-size: 2.5em;
    }

    /* .season-stat {
    margin: 0.4em 0 1em 0;
  } */

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
