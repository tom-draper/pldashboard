<script lang="ts">
  import { onMount } from 'svelte';
  import { toAlias, toName, toHyphenatedName, teamColor } from '../../lib/team';
  import type { DashboardData } from '../../lib/dashboard.types';

  function addTeamComparison(team: string) {
    const teamData = {
      name: team,
      type: 'scatterpolar',
      r: [
        attack[team],
        defence[team],
        cleanSheets[team],
        consistency[team],
        winStreaks[team],
        vsBig6[team],
      ],
      theta: labels,
      fill: 'toself',
      marker: { color: teamColor(team) },
    };
    plotData.data.push(teamData);
    //@ts-ignore
    Plotly.redraw(plotDiv); // Redraw with teamName added
  }

  function addAvg() {
    const avg = avgScatterPlot();
    plotData.data.unshift(avg); // Add avg below the teamName spider plot
  }

  function removeTeamComparison(team: string) {
    // Remove spider plot for this teamName
    for (let i = 0; i < plotData.data.length; i++) {
      if (plotData.data[i].name === team) {
        plotData.data.splice(i, 1);
        break;
      }
    }

    // If removing only comparison teamName, re-insert the initial avg spider plot
    if (comparisonTeams.length === 1) {
      addAvg();
    }

    //@ts-ignore
    Plotly.redraw(plotDiv); // Redraw with teamName removed
  }

  function removeAllTeamComparisons() {
    for (let i = 0; i < comparisonTeams.length; i++) {
      // Remove spider plot for this teamName
      for (let i = 0; i < plotData.data.length; i++) {
        if (
          plotData.data[i].name === comparisonTeams[i] &&
          comparisonTeams[i] != team
        ) {
          plotData.data.splice(i, 1);
          break;
        }
      }

      // If removing only comparison teamName, re-insert the initial avg spider plot
      if (comparisonTeams.length === 1) {
        addAvg();
      }
      removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams
    }

    //@ts-ignore
    Plotly.redraw(plotDiv); // Redraw with teamName removed
  }

  function resetTeamComparisonBtns() {
    const btns = document.getElementById('spider-opp-teams');
    for (let i = 0; i < btns.children.length; i++) {
      //@ts-ignore
      const btn: HTMLButtonElement = btns.children[i];
      if (btn.style.background === '') {
        continue;
      }
      btn.style.background = '';
      btn.style.color = 'black';
    }
  }

  function spiderBtnClick(btn: HTMLButtonElement) {
    const team = toName(btn.innerHTML);
    if (btn.style.background === '') {
      const teamKey = toHyphenatedName(team);
      btn.style.background = `var(--${teamKey})`;
      btn.style.color = `var(--${teamKey}-secondary)`;
    } else {
      btn.style.background = '';
      btn.style.color = 'black';
    }

    if (comparisonTeams.length === 0) {
      plotData.data.splice(0, 1); // Remove avg
    }

    if (comparisonTeams.includes(team)) {
      removeTeamComparison(team); // Remove from spider chart
      removeItem(comparisonTeams, team); // Remove from comparison teams
    } else {
      addTeamComparison(team); // Add teamName to spider chart
      comparisonTeams.push(team); // Add to comparison teams
    }
  }

  function goalsPerGame(
    data: DashboardData
  ): [SpiderAttribute, [number, number]] {
    const attack = {};
    let maxGoalsPerSeason = Number.NEGATIVE_INFINITY;
    let minGoalsPerSeason = Number.POSITIVE_INFINITY;
    for (const team of Object.keys(data.standings)) {
      let totalGoals = 0;
      let gamesPlayed = 0;
      for (const season in data.standings[team]) {
        const goals = data.standings[team][season].gF;
        const played = data.standings[team][season].played;
        if (goals > 0) {
          totalGoals += goals;
          gamesPlayed += played;
        }
        // If season completed, check if team's attacking performance is most extreme yet
        if (played < 38) {
          continue;
        }
        const seasonGoalsPerGame = goals / played;
        if (seasonGoalsPerGame > maxGoalsPerSeason) {
          maxGoalsPerSeason = seasonGoalsPerGame;
        } else if (seasonGoalsPerGame < minGoalsPerSeason) {
          minGoalsPerSeason = seasonGoalsPerGame;
        }
      }

      // Get team's overall goals per game across multiple seasons
      let goalsPerGame = null;
      if (gamesPlayed > 0) {
        goalsPerGame = totalGoals / gamesPlayed;
      }
      attack[team] = goalsPerGame;
    }
    return [attack as SpiderAttribute, [minGoalsPerSeason, maxGoalsPerSeason]];
  }

  function scaleAttack(
    attack: SpiderAttribute,
    range: [number, number]
  ): SpiderAttribute {
    const [lower, upper] = range;
    for (const team in attack) {
      if (attack[team] === null) {
        attack[team] = 0;
      } else {
        attack[team] = ((attack[team] - lower) / (upper - lower)) * 100;
      }
    }
    return attack;
  }

  function attributeAvgScaled(attribute: SpiderAttribute, max: number): number {
    let total = 0;
    for (const team in attribute) {
      attribute[team] = (attribute[team] / max) * 100;
      total += attribute[team];
    }
    const avg = total / Object.keys(attribute).length;

    return avg;
  }

  function attributeAvg(attribute: SpiderAttribute): number {
    let total = 0;
    for (const team in attribute) {
      total += attribute[team];
    }
    const avg = total / Object.keys(attribute).length;

    return avg;
  }

  function getAttack(data: DashboardData): SpiderAttribute {
    let [attack, extremes] = goalsPerGame(data);
    attack = scaleAttack(attack, extremes);
    attack.avg = attributeAvg(attack);
    return attack;
  }

  function concededPerSeason(
    data: DashboardData
  ): [SpiderAttribute, [number, number]] {
    const defence = {};
    let maxConcededPerSeason = Number.NEGATIVE_INFINITY;
    let minConcededPerSeason = Number.POSITIVE_INFINITY;
    for (const team of Object.keys(data.standings)) {
      let totalConceded = 0;
      let gamesPlayed = 0;
      for (const season in data.standings[team]) {
        const conceded = data.standings[team][season].gA;
        const played = data.standings[team][season].played;
        if (conceded > 0) {
          totalConceded += conceded;
          gamesPlayed += played;
        }
        // If season completed, check if team's defensive performance is most extreme yet
        if (played < 38) {
          continue;
        }
        const seasonConcededPerGame = conceded / played;
        if (seasonConcededPerGame > maxConcededPerSeason) {
          maxConcededPerSeason = seasonConcededPerGame;
        } else if (seasonConcededPerGame < minConcededPerSeason) {
          minConcededPerSeason = seasonConcededPerGame;
        }
      }

      let goalsPerGame = null;
      if (gamesPlayed > 0) {
        goalsPerGame = totalConceded / gamesPlayed;
      }
      defence[team] = goalsPerGame;
    }

    return [
      defence as SpiderAttribute,
      [minConcededPerSeason, maxConcededPerSeason],
    ];
  }

  function scaleDefence(
    defence: SpiderAttribute,
    range: [number, number]
  ): SpiderAttribute {
    const [lower, upper] = range;
    for (const team in defence) {
      if (defence[team] === null) {
        defence[team] = 0;
      } else {
        defence[team] = 100 - ((defence[team] - lower) / (upper - lower)) * 100;
      }
    }
    return defence;
  }

  function getDefence(data: DashboardData) {
    let [defence, range] = concededPerSeason(data);
    defence = scaleDefence(defence, range);
    defence.avg = attributeAvg(defence);

    return defence;
  }

  function formCleanSheets(form: Form, team: string, season: number): number {
    let nCleanSheets = 0;
    for (const matchday in form[team][season]) {
      const match = form[team][season][matchday];
      if (match.score == null) {
        continue;
      }
      if (match.atHome && match.score.awayGoals === 0) {
        nCleanSheets += 1;
      } else if (!match.atHome && match.score.homeGoals === 0) {
        nCleanSheets += 1;
      }
    }
    return nCleanSheets;
  }

  function getCleanSheets(data: DashboardData): SpiderAttribute {
    const cleanSheets = {} as SpiderAttribute;
    let maxSeasonCleanSheets = Number.NEGATIVE_INFINITY;
    for (const team of Object.keys(data.standings)) {
      let totalCleanSheetsCount = 0;
      for (let i = 0; i < numSeasons; i++) {
        const seasonCleanSheets = formCleanSheets(
          data.form,
          team,
          data._id - i
        );
        // If season completed, check if season clean sheets is highest yet
        if (
          seasonComplete(data, team, data._id - i) &&
          seasonCleanSheets > maxSeasonCleanSheets
        ) {
          maxSeasonCleanSheets = seasonCleanSheets;
        }
        totalCleanSheetsCount += seasonCleanSheets;
      }
      cleanSheets[team] = totalCleanSheetsCount;
    }

    cleanSheets.avg = attributeAvgScaled(
      cleanSheets,
      maxSeasonCleanSheets * numSeasons
    );

    return cleanSheets;
  }

  function formConsistency(form: Form, team: string, season: number): number {
    let backToBack = 0; // Counts pairs of back to back identical match results
    let prevResult = null;
    for (const matchday in form[team][season]) {
      const match = form[team][season][matchday];
      if (match.score == null) {
        continue;
      }
      let result: 'win' | 'lost' | 'draw';
      if (
        (match.atHome && match.score.homeGoals > match.score.awayGoals) ||
        (!match.atHome && match.score.homeGoals < match.score.awayGoals)
      ) {
        result = 'win';
      } else if (
        (match.atHome && match.score.homeGoals < match.score.awayGoals) ||
        (!match.atHome && match.score.homeGoals > match.score.awayGoals)
      ) {
        result = 'lost';
      } else {
        result = 'draw';
      }
      if (prevResult != null && prevResult === result) {
        backToBack += 1;
      }
      prevResult = result;
    }
    return backToBack;
  }

  function getConsistency(data: DashboardData): SpiderAttribute {
    const consistency = {} as SpiderAttribute;
    let maxSeasonBackToBack = Number.NEGATIVE_INFINITY;
    for (const team of Object.keys(data.standings)) {
      let totalBackToBack = 0;
      for (let i = 0; i < numSeasons; i++) {
        const seasonBackToBack = formConsistency(data.form, team, data._id - i);
        // If season completed, check if season consistency is highest yet
        if (
          seasonComplete(data, team, data._id - i) &&
          seasonBackToBack > maxSeasonBackToBack
        ) {
          maxSeasonBackToBack = seasonBackToBack;
        }
        totalBackToBack += seasonBackToBack;
      }

      consistency[team] = totalBackToBack;
    }

    consistency.avg = attributeAvgScaled(
      consistency,
      maxSeasonBackToBack * numSeasons
    );
    return consistency;
  }

  function formWinStreak(form: Form, team: string, season: number): number {
    let winStreak = 0;
    let tempWinStreak = 0;
    for (const matchday in form[team][season]) {
      const match = form[team][season][matchday];
      if (match.score == null) {
        continue;
      }
      if (
        (match.atHome && match.score.homeGoals > match.score.awayGoals) ||
        (!match.atHome && match.score.homeGoals < match.score.awayGoals)
      ) {
        tempWinStreak += 1;
        if (tempWinStreak > winStreak) {
          winStreak = tempWinStreak;
        }
      } else {
        tempWinStreak = 0;
      }
    }
    return winStreak;
  }

  function getWinStreak(data: DashboardData): SpiderAttribute {
    const winStreaks = {} as SpiderAttribute;
    let maxSeasonWinStreak = Number.NEGATIVE_INFINITY;
    for (const team of Object.keys(data.standings)) {
      let totalWinStreak = 0;
      for (let i = 0; i < numSeasons; i++) {
        const seasonWinSteak = formWinStreak(data.form, team, data._id - i);
        // If season completed, check if season consistency is highest yet
        if (
          seasonComplete(data, team, data._id - i) &&
          seasonWinSteak > maxSeasonWinStreak
        ) {
          maxSeasonWinStreak = seasonWinSteak;
        }
        totalWinStreak += seasonWinSteak;
      }

      winStreaks[team] = totalWinStreak;
    }

    winStreaks.avg = attributeAvgScaled(
      winStreaks,
      maxSeasonWinStreak * numSeasons
    );
    return winStreaks;
  }

  function seasonComplete(
    data: DashboardData,
    team: string,
    season: number
  ): boolean {
    return data.standings[team][season].played === 38;
  }

  function removeItem(arr, value) {
    const index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
  }

  function formWinsVsBig6(
    form: Form,
    team: string,
    season: number,
    big6: string[]
  ): [number, number] {
    let pointsVsBig6 = 0;
    let numPlayed = 0;
    for (const matchday in form[team][season]) {
      const match = form[team][season][matchday];
      if (match.score == null || big6.includes(match.team)) {
        continue;
      }
      if (
        (match.atHome && match.score.homeGoals > match.score.awayGoals) ||
        (!match.atHome && match.score.homeGoals < match.score.awayGoals)
      ) {
        pointsVsBig6 += 3;
      } else if (match.score.homeGoals === match.score.awayGoals) {
        pointsVsBig6 += 1;
      }
      numPlayed += 1;
    }

    return [pointsVsBig6, numPlayed];
  }

  function getVsBig6(data): SpiderAttribute {
    //@ts-ignore
    const vsBig6: SpiderAttribute = {};
    let maxAvgSeasonPointsVsBig6 = Number.NEGATIVE_INFINITY;
    for (const team of Object.keys(data.standings)) {
      let totalPointsVsBig6 = 0;
      let totalPlayedVsBig6 = 0;
      for (let i = 0; i < numSeasons; i++) {
        const [seasonPointsVsBig6, seasonPlayedVsBig6] = formWinsVsBig6(
          data.form,
          team,
          data._id - i,
          removeItem(big6, team)
        );
        if (seasonPlayedVsBig6 === 0) {
          continue;
        }
        const avgSeasonPointsVsBig6 = seasonPlayedVsBig6 / seasonPlayedVsBig6;
        // If season completed, check if season consistency is highest yet
        if (
          seasonComplete(data, team, data._id - i) &&
          avgSeasonPointsVsBig6 > maxAvgSeasonPointsVsBig6
        ) {
          maxAvgSeasonPointsVsBig6 = avgSeasonPointsVsBig6;
        }
        totalPointsVsBig6 += seasonPointsVsBig6;
        totalPlayedVsBig6 += seasonPlayedVsBig6;
      }

      let totalAvgPointsVsBig = 0;
      if (totalPlayedVsBig6 > 0) {
        totalAvgPointsVsBig = totalPointsVsBig6 / totalPlayedVsBig6;
      }
      vsBig6[team] = totalAvgPointsVsBig;
    }

    vsBig6.avg = attributeAvgScaled(
      vsBig6,
      maxAvgSeasonPointsVsBig6 * numSeasons
    );
    return vsBig6;
  }

  function scatterPlot(name: string, r: number[], color: string) {
    return {
      name: name,
      type: 'scatterpolar',
      r: r,
      theta: labels,
      fill: 'toself',
      marker: { color: color },
      hovertemplate: `<b>${name}</b><br>%{theta}: %{r}<extra></extra>`,
      hoveron: 'points',
    };
  }

  function avgScatterPlot() {
    return scatterPlot(
      'Avg',
      [
        attack.avg,
        defence.avg,
        cleanSheets.avg,
        consistency.avg,
        winStreaks.avg,
        vsBig6.avg,
      ],
      '#ADADAD'
    );
  }

  function getTeamData(team: string) {
    const teamData = scatterPlot(
      team,
      [
        attack[team],
        defence[team],
        cleanSheets[team],
        consistency[team],
        winStreaks[team],
        vsBig6[team],
      ],
      teamColor(team)
    );
    return teamData;
  }

  function initSpiderPlots(team: string): [SpiderAttribute, SpiderAttribute] {
    const avgData = avgScatterPlot();
    const teamData = getTeamData(team);
    return [avgData, teamData];
  }

  function computePlotData(data) {
    attack = getAttack(data);
    defence = getDefence(data);
    cleanSheets = getCleanSheets(data);
    consistency = getConsistency(data);
    winStreaks = getWinStreak(data);
    vsBig6 = getVsBig6(data);
  }

  function defaultLayout() {
    return {
      height: 550,
      polar: {
        radialaxis: {
          visible: true,
          range: [0, 100],
        },
      },
      hover: 'closest',
      margin: { t: 25, b: 25, l: 75, r: 75 },
      showlegend: false,
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#fafafa',
      dragmode: false,
    };
  }

  function buildPlotData(data, team: string): PlotData {
    computePlotData(data);

    const spiderPlots = initSpiderPlots(team);

    const plotData = {
      data: spiderPlots,
      layout: defaultLayout(),
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return plotData;
  }

  const numSeasons = 3;
  let attack: SpiderAttribute,
    defence: SpiderAttribute,
    cleanSheets: SpiderAttribute,
    consistency: SpiderAttribute,
    winStreaks: SpiderAttribute,
    vsBig6: SpiderAttribute;
  const labels = [
    'Attack',
    'Defence',
    'Clean sheets',
    'Consistency',
    'Win streak',
    'Vs big 6',
  ];
  const big6 = [
    'Manchester United',
    'Liverpool',
    'Manchester City',
    'Arsenal',
    'Chelsea',
    'Tottenham Hotspur',
  ];

  let plotDiv: HTMLDivElement, plotData: PlotData;
  const comparisonTeams = [];
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  function genPlot() {
    plotData = buildPlotData(data, team);
    //@ts-ignore
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    ).then((plot) => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add('resizable-spider-chart');
    });

    // Add inner border radius to top and bottom teams
    document
      .getElementById('spider-opp-teams')
      .children[0].classList.add('top-spider-opp-team-btn');
    document
      .getElementById('spider-opp-teams')
      .children[18].classList.add('bottom-spider-opp-team-btn');
  }

  function emptyArray(arr) {
    const length = arr.length;
    for (let i = 0; i < length; i++) {
      arr.pop();
    }
  }

  function refreshPlot() {
    if (!setup) {
      return;
    }
    const spiderPlots = initSpiderPlots(team);
    // Remove all but two plots
    emptyArray(plotData.data);
    // Replace final two plots with defaults
    plotData.data.push(spiderPlots[0]); // Reset to avg
    plotData.data.push(spiderPlots[1]); // Reset to team data

    removeAllTeamComparisons();
    resetTeamComparisonBtns();
    setTimeout(() => {
      document
        .getElementById('spider-opp-teams')
        .children[0].classList.add('top-spider-opp-team-btn');
      document
        .getElementById('spider-opp-teams')
        .children[18].classList.add('bottom-spider-opp-team-btn');
    }, 0);
  }

  $: team && refreshPlot();

  export let data, team: string, teams: string[];
</script>

<div class="spider-chart">
  <div id="plotly">
    <div id="plotDiv" bind:this={plotDiv}>
      <!-- Plotly chart will be drawn inside this DIV -->
    </div>
  </div>
</div>
<div class="spider-opp-team-selector">
  <div class="spider-opp-team-btns" id="spider-opp-teams">
    {#each teams as _team}
      {#if _team != team}
        <button
          class="spider-opp-team-btn"
          on:click={(e) => {
            //@ts-ignore
            spiderBtnClick(e.target);
          }}>{toAlias(_team)}</button
        >
      {/if}
    {/each}
  </div>
</div>

<style scoped>
  .spider-chart {
    position: relative;
  }
  .spider-opp-team-selector {
    display: flex;
    flex-direction: column;
    margin: auto;
  }
  .spider-opp-team-btns {
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    border: 3px solid #333333;
    color: #333333;
    width: 180px;
  }
  .spider-opp-team-btn {
    cursor: pointer;
    color: #333333;
    border: none;
    font-size: 13px;
    padding: 4px 10px;
  }
  button {
    margin: 0 !important;
    padding: 4 10px !important;
  }
  .spider-opp-team-btn:hover {
    filter: brightness(0.95);
  }
</style>
