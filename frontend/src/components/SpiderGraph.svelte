<script lang="ts">
  import { onMount } from "svelte";

  function getTeamColor(team: string): string {
    let teamKey = team[0].toLowerCase() + team.slice(1);
    teamKey = teamKey.replace(/ /g, "-").toLowerCase();
    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(
      `--${teamKey}`
    );
    return teamColor;
  }

  function teamInSeason(form: Form, team: string, season: number): boolean {
    return team in form && form[team][season]['1'] != null
  }

  function addTeamComparison(team: string) {
    let teamColor = getTeamColor(team);

    let teamData = {
      name: team,
      type: "scatterpolar",
      r: [
        attack[team],
        defence[team],
        cleanSheets[team],
        consistency[team],
        winStreaks[team],
        vsBig6[team],
      ],
      theta: labels,
      fill: "toself",
      marker: { color: teamColor },
    };
    plotData.data.push(teamData);
    Plotly.redraw(plotDiv); // Redraw with teamName added
  }

  function addAvg() {
    let avg = avgScatterPlot();
    plotData.data.unshift(avg); // Add avg below the teamName spider plot
  }

  function removeTeamComparison(team: string) {
    // Remove spider plot for this teamName
    for (let i = 0; i < plotData.data.length; i++) {
      if (plotData.data[i].name == team) {
        plotData.data.splice(i, 1);
        break;
      }
    }

    // If removing only comparison teamName, re-insert the initial avg spider plot
    if (comparisonTeams.length == 1) {
      addAvg();
    }

    Plotly.redraw(plotDiv); // Redraw with teamName removed
  }

  function removeAllTeamComparisons() {
    for (let i = 0; i < comparisonTeams.length; i++) {
      // Remove spider plot for this teamName
      for (let i = 0; i < plotData.data.length; i++) {
        if (plotData.data[i].name == comparisonTeams[i]) {
          plotData.data.splice(i, 1);
          break;
        }
      }

      // If removing only comparison teamName, re-insert the initial avg spider plot
      if (comparisonTeams.length == 1) {
        addAvg();
      }
      removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams
    }

    Plotly.redraw(plotDiv); // Redraw with teamName removed
  }

  function resetTeamComparisonBtns() {
    let btns = document.getElementById("spider-opp-teams");
    for (let i = 0; i < btns.children.length; i++) {
      let btn: HTMLButtonElement = btns.children[i];
      if (btn.style.background != "") {
        btn.style.background = "";
        btn.style.color = "black";
      }
    }
  }

  function spiderBtnClick(btn: HTMLButtonElement) {
    let team = toName(btn.innerHTML);
    if (btn.style.background == "") {
      let teamKey = team.toLowerCase().replace(/ /g, "-");
      btn.style.background = `var(--${teamKey})`;
      btn.style.color = `var(--${teamKey}-secondary)`;
    } else {
      btn.style.background = "";
      btn.style.color = "black";
    }

    if (comparisonTeams.length == 0) {
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

  function goalsPerSeason(data: TeamData): [Attribute, [number, number]] {
    let attack = {};
    let maxGoals = Number.NEGATIVE_INFINITY;
    let minGoals = Number.POSITIVE_INFINITY;
    for (let team of data.teamNames) {
      let totalGoals = 0;
      let seasonsPlayed = 0;
      for (let year in data.standings[team]) {
        let goals = data.standings[team][year].gF;
        if (goals > 0) {
          totalGoals += goals;
          if (goals > maxGoals) {
            maxGoals = goals;
          } else if (goals < minGoals) {
            minGoals = goals;
          }
          seasonsPlayed += 1;
        }
      }

      let goalsPerSeason = null;
      if (seasonsPlayed > 0) {
        goalsPerSeason = totalGoals / seasonsPlayed;
      }

      attack[team] = goalsPerSeason;
    }
    return [attack as Attribute, [minGoals, maxGoals]];
  }

  function scaleAttack(attack: Attribute, range: [number, number]): Attribute {
    let [lower, upper] = range;
    for (let team in attack) {
      if (attack[team] == null) {
        attack[team] = 0;
      } else {
        attack[team] = ((attack[team] - lower) / (upper - lower)) * 100;
      }
    }
    return attack;
  }

  function attributeAvgScaled(attribute: Attribute, max: number): number {
    let total = 0;
    for (let team in attribute) {
      attribute[team] = (attribute[team] / max) * 100;
      total += attribute[team];
    }
    let avg = total / Object.keys(attribute).length;

    return avg;
  }

  function attributeAvg(attribute: Attribute): number {
    let total = 0;
    for (let team in attribute) {
      total += attribute[team];
    }
    let avg = total / Object.keys(attribute).length;

    return avg;
  }

  function getAttack(data: TeamData): Attribute {
    let [attack, maxGoals] = goalsPerSeason(data);
    attack = scaleAttack(attack, maxGoals);
    attack.avg = attributeAvg(attack);
    return attack;
  }

  function concededPerSeason(data: TeamData): [Attribute, [number, number]] {
    let defence = {};
    let maxConceded = Number.NEGATIVE_INFINITY;
    let minConceded = Number.POSITIVE_INFINITY;
    for (let team of data.teamNames) {
      let totalConceded = 0;
      let seasonsPlayed = 0;
      for (let year in data.standings[team]) {
        let goals = data.standings[team][year].gA;
        if (goals > 0) {
          totalConceded += goals;
          if (goals > maxConceded) {
            maxConceded = goals;
          } else if (goals < minConceded) {
            minConceded = goals;
          }
          seasonsPlayed += 1;
        }
      }

      let goalsPerSeason = null;
      if (seasonsPlayed > 0) {
        goalsPerSeason = totalConceded / seasonsPlayed;
      }

      defence[team] = goalsPerSeason;
    }

    return [defence as Attribute, [minConceded, maxConceded]];
  }

  function scaleDefence(
    defence: Attribute,
    range: [number, number]
  ): Attribute {
    let [lower, upper] = range;
    for (let team in defence) {
      if (defence[team] == null) {
        defence[team] = 0;
      } else {
        defence[team] = 100 - ((defence[team] - lower) / (upper - lower)) * 100;
      }
    }
    return defence;
  }

  function getDefence(data: TeamData) {
    let [defence, range] = concededPerSeason(data);
    defence = scaleDefence(defence, range);
    defence.avg = attributeAvg(defence);

    return defence;
  }

  function formCleanSheets(form: Form, team: string, season: number): number {
    let nCleanSheets = 0;
    for (let matchday in form[team][season]) {
      let match = form[team][season][matchday];
      if (match.score != null) {
        let [h, _, a] = match.score.split(" ");
        if (match.atHome && a == 0) {
          nCleanSheets += 1;
        } else if (!match.atHome && h == 0) {
          nCleanSheets += 1;
        }
      }
    }
    return nCleanSheets;
  }

  function getCleanSheets(data: TeamData): Attribute {
    let cleanSheets: Attribute = {};
    let maxCleanSheets = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let nCleanSheets = formCleanSheets(data.form, team, data._id);
      if (teamInSeason(data.form, team, data._id-1)) {
        nCleanSheets += formCleanSheets(data.form, team, data._id-1);
      }

      if (nCleanSheets > maxCleanSheets) {
        maxCleanSheets = nCleanSheets;
      }
      cleanSheets[team] = nCleanSheets;
    }

    cleanSheets.avg = attributeAvgScaled(cleanSheets, maxCleanSheets);

    return cleanSheets;
  }

  function formConsistency(form: Form, team: string, season: number): number {
    let backToBack = 0; // Counts pairs of back to back identical match results
    let prevResult = null;
    for (let matchday in form[team][season]) {
      let match = form[team][season][matchday];
      if (match.score != null) {
        let [h, _, a] = match.score.split(" ");
        let result: string;
        if ((match.atHome && h > a) || (!match.atHome && h < a)) {
          result = "win";
        } else if ((match.atHome && h < a) || (!match.atHome && h > a)) {
          result = "lost";
        } else {
          result = "draw";
        }
        if (prevResult != null && prevResult == result) {
          backToBack += 1;
        }
        prevResult = result;
      }
    }
    return backToBack;
  }

  function getConsistency(data: TeamData): Attribute {
    let consistency: Attribute = {};
    let maxConsistency = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let backToBack = formConsistency(data.form, team, data._id);
      if (teamInSeason(data.form, team, data._id-1)) {
        backToBack += formConsistency(data.form, team, data._id - 1);
      }

      if (backToBack > maxConsistency) {
        maxConsistency = backToBack;
      }

      consistency[team] = backToBack;
    }

    consistency.avg = attributeAvgScaled(consistency, maxConsistency);

    return consistency;
  }

  function formWinStreak(form: Form, team: string, season: number): number {
    let winStreak = 0;
    let tempWinStreak = 0;
    for (let matchday in form[team][season]) {
      let match = form[team][season][matchday];
      if (match.score != null) {
        let [h, _, a] = match.score.split(" ");
        if ((match.atHome && h > a) || (!match.atHome && h < a)) {
          tempWinStreak += 1;
          if (tempWinStreak > winStreak) {
            winStreak = tempWinStreak;
          }
        } else {
          tempWinStreak = 0;
        }
      }
    }
    return winStreak;
  }

  function getWinStreak(data: TeamData): Attribute {
    let winStreaks: Attribute = {};
    let maxWinStreaks = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let winStreak = formWinStreak(data.form, team, data._id);
      if (teamInSeason(data.form, team, data._id-1)) {
        winStreak += formWinStreak(data.form, team, data._id-1);
      }

      if (winStreak > maxWinStreaks) {
        maxWinStreaks = winStreak;
      }
      winStreaks[team] = winStreak;
    }

    winStreaks.avg = attributeAvgScaled(winStreaks, maxWinStreaks);

    return winStreaks;
  }

  function removeItem(arr: any[], value: any): any[] {
    let index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
  }

  function formWinsVsBig6(form: Form, team: string, season: number, big6: string[]): number {
    let winsVsBig6 = 0;
    for (let matchday in form[team][season]) {
      let match = form[team][season][matchday];
      if (match.score != null && big6.includes(match.team)) {
        let [h, _, a] = match.score.split(" ");
        if ((match.atHome && h > a) || (!match.atHome && h < a)) {
          winsVsBig6 += 1;
        }
      }
    }

    return winsVsBig6;
  }

  function getVsBig6(data: TeamData): Attribute {
    let vsBig6: Attribute = {};
    let maxWinsVsBig6 = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let big6 = [
        "Manchester United",
        "Liverpool",
        "Manchester City",
        "Arsenal",
        "Chelsea",
        "Tottenham Hotspur",
      ];
      big6 = removeItem(big6, team);

      let winsVsBig6 = formWinsVsBig6(data.form, team, data._id, big6);
      if (teamInSeason(data.form, team, data._id-1)) {
        winsVsBig6 += formWinsVsBig6(data.form, team, data._id-1, big6);
      }

      if (winsVsBig6 > maxWinsVsBig6) {
        maxWinsVsBig6 = winsVsBig6;
      }

      vsBig6[team] = winsVsBig6;
    }

    vsBig6.avg = attributeAvgScaled(vsBig6, maxWinsVsBig6);

    return vsBig6;
  }

  function scatterPlot(name: string, r: number[], color: string): any {
    return {
      name: name,
      type: "scatterpolar",
      r: r,
      theta: labels,
      fill: "toself",
      marker: { color: color },
      hovertemplate: `<b>${name}</b><br>%{theta}: %{r}<extra></extra>`,
      hoveron: "points",
    };
  }

  function avgScatterPlot(): any {
    return scatterPlot(
      "Avg",
      [
        attack.avg,
        defence.avg,
        cleanSheets.avg,
        consistency.avg,
        winStreaks.avg,
        vsBig6.avg,
      ],
      "#ADADAD"
    );
  }

  function getTeamData(team: string): any {
    let teamColor = getTeamColor(team);
    let teamData = scatterPlot(
      team,
      [
        attack[team],
        defence[team],
        cleanSheets[team],
        consistency[team],
        winStreaks[team],
        vsBig6[team],
      ],
      teamColor
    );
    return teamData;
  }

  function initSpiderPlots(team: string): [Attribute, Attribute] {
    let avgData = avgScatterPlot();
    let teamData = getTeamData(team);

    return [avgData, teamData];
  }

  function computePlotData(data: TeamData) {
    attack = getAttack(data);
    defence = getDefence(data);
    cleanSheets = getCleanSheets(data);
    consistency = getConsistency(data);
    winStreaks = getWinStreak(data);
    vsBig6 = getVsBig6(data);
  }

  function defaultLayout(): Object {
    return {
      height: 550,
      polar: {
        radialaxis: {
          visible: true,
          range: [0, 100],
        },
      },
      hover: "closest",
      margin: { t: 25, b: 25, l: 75, r: 75 },
      showlegend: false,
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      dragmode: false,
    };
  }

  function buildPlotData(data: TeamData, team: string): PlotData {
    computePlotData(data);

    let spiderPlots = initSpiderPlots(team);

    let plotData = {
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

  type Attribute = {
    _: number;
    avg: number;
  };

  let attack: Attribute,
    defence: Attribute,
    cleanSheets: Attribute,
    consistency: Attribute,
    winStreaks: Attribute,
    vsBig6: Attribute;
  let labels = [
    "Attack",
    "Defence",
    "Clean Sheets",
    "Consistency",
    "Win Streak",
    "Vs Big 6",
  ];

  let plotDiv: HTMLDivElement, plotData: PlotData;
  let comparisonTeams = [];
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  function genPlot() {
    plotData = buildPlotData(data, team);
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    ).then((plot) => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add("resizable-spider-chart");
    });

    // Add inner border radius to top and bottom teams
    document
      .getElementById("spider-opp-teams")
      .children[0].classList.add("top-spider-opp-team-btn");
    document
      .getElementById("spider-opp-teams")
      .children[18].classList.add("bottom-spider-opp-team-btn");
  }

  function emptyArray(arr: any[]) {
    let length = arr.length;
    for (let i = 0; i < length; i++) {
      arr.pop();
    }
  }

  function refreshPlot() {
    if (setup) {
      let spiderPlots = initSpiderPlots(team);
      // Remove all but two plots
      emptyArray(plotData.data);
      // Replace final two plots with defaults
      plotData.data.push(spiderPlots[0]); // Reset to avg
      plotData.data.push(spiderPlots[1]); // Reset to team data

      removeAllTeamComparisons();
      resetTeamComparisonBtns();
      setTimeout(() => {
        document
          .getElementById("spider-opp-teams")
          .children[0].classList.add("top-spider-opp-team-btn");
        document
          .getElementById("spider-opp-teams")
          .children[18].classList.add("bottom-spider-opp-team-btn");
      }, 0);
    }
  }

  $: team && refreshPlot();

  export let data: TeamData,
    team: string,
    teams: string[],
    toAlias: Function,
    toName: Function;
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
    border: none;
    padding: 4px 10px;
    font-size: 13px;
  }
  .spider-opp-team-btn:hover {
    filter: brightness(0.95);
  }
</style>
