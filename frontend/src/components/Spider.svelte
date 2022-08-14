<script>
  import { onMount } from "svelte";

  function getTeamColor(team) {
    let teamKey = team[0].toLowerCase() + team.slice(1);
    teamKey = teamKey.replace(/ /g, "-").toLowerCase();
    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(
      `--${teamKey}`
    );
    return teamColor;
  }

  function addTeamComparison(team) {
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

  function removeTeamComparison(team) {
    // Remove spider plot for this teamName
    for (let i = 0; i < plotData.data.length; i++) {
      if (plotData.data[i].name == team) {
        plotData.data.splice(i, 1);
        break;
      }
    }

    // If removing only comparison teamName, re-insert the initial avg spider plot
    if (comparisonTeams.length == 1) {
      addAvg(plotData.data);
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
        addAvg(plotData.data);
      }
      removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams
    }

    Plotly.redraw(plotDiv); // Redraw with teamName removed
  }

  function resetTeamComparisonBtns() {
    let btns = document.getElementById("spider-opp-teams");
    for (let i = 0; i < btns.children.length; i++) {
      let btn = btns.children[i];
      if (btn.style.background != "") {
        btn.style.background = "";
        btn.style.color = "black";
      }
    }

    document
      .getElementById("spider-opp-teams")
      .children[0].classList.add("top-spider-opp-team-btn");
    document
      .getElementById("spider-opp-teams")
      .children[18].classList.add("bottom-spider-opp-team-btn");
  }

  function spiderBtnClick(btn) {
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

  function goalsPerSeason(data) {
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
    return [attack, [minGoals, maxGoals]];
  }

  function scaleAttack(attack, range) {
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

  function formMetricAvgScaled(formMetric, max) {
    let total = 0;
    for (let team in formMetric) {
      formMetric[team] = (formMetric[team] / max) * 100;
      total += formMetric[team];
    }
    let avg = total / Object.keys(formMetric).length;

    return avg;
  }

  function formMetricAvg(formMetric) {
    let total = 0;
    for (let team in formMetric) {
      total += formMetric[team];
    }
    let avg = total / Object.keys(formMetric).length;

    return avg;
  }

  function getAttack(data) {
    let [attack, maxGoals] = goalsPerSeason(data);
    attack = scaleAttack(attack, maxGoals);
    attack.avg = formMetricAvg(attack);

    return attack;
  }

  function concededPerSeason(data) {
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

    return [defence, [minConceded, maxConceded]];
  }

  function scaleDefence(defence, range) {
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

  function getDefence(data) {
    let [defence, range] = concededPerSeason(data);
    defence = scaleDefence(defence, range);
    defence.avg = formMetricAvg(defence);

    return defence;
  }

  function formCleanSheets(form, team) {
    let nCleanSheets = 0;
    for (let matchday of Object.keys(form[team])) {
      let match = form[team][matchday];
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

  function getCleanSheets(data) {
    let cleanSheets = {};
    let maxCleanSheets = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let nCleanSheets = formCleanSheets(data.form[data._id], team);
      if (team in data.form[data._id - 1]) {
        nCleanSheets += formCleanSheets(data.form[data._id - 1], team);
      }

      if (nCleanSheets > maxCleanSheets) {
        maxCleanSheets = nCleanSheets;
      }
      cleanSheets[team] = nCleanSheets;
    }

    cleanSheets.avg = formMetricAvgScaled(cleanSheets, maxCleanSheets);

    return cleanSheets;
  }

  function formConsistency(form, team) {
    let backToBack = 0; // Counts pairs of back to back identical match results
    let prevResult = null;
    for (let matchday in form[team]) {
      let match = form[team][matchday];
      if (match.score != null) {
        let [h, _, a] = match.score.split(" ");
        let result;
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

  function getConsistency(data) {
    let consistency = {};
    let maxConsistency = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let backToBack = formConsistency(data.form[data._id], team);
      if (team in data.form[data._id - 1]) {
        backToBack += formConsistency(data.form[data._id - 1], team);
      }

      if (backToBack > maxConsistency) {
        maxConsistency = backToBack;
      }

      consistency[team] = backToBack;
    }

    consistency.avg = formMetricAvgScaled(consistency, maxConsistency);

    return consistency;
  }

  function formWinStreak(form, team) {
    let winStreak = 0;
    let tempWinStreak = 0;
    for (let matchday in form[team]) {
      let match = form[team][matchday];
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

  function getWinStreak(data) {
    let winStreaks = {};
    let maxWinStreaks = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let winStreak = formWinStreak(data.form[data._id], team);
      if (team in data.form[data._id - 1]) {
        winStreak += formWinStreak(data.form[data._id - 1], team);
      }

      if (winStreak > maxWinStreaks) {
        maxWinStreaks = winStreak;
      }
      winStreaks[team] = winStreak;
    }

    winStreaks.avg = formMetricAvgScaled(winStreaks, maxWinStreaks);

    return winStreaks;
  }

  function removeItem(arr, value) {
    let index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
  }

  function formWinsVsBig6(form, team, big6) {
    let winsVsBig6 = 0;
    for (let matchday in form[team]) {
      let match = form[team][matchday];
      if (match.score != null && big6.includes(match.team)) {
        let [h, _, a] = match.score.split(" ");
        if ((match.atHome && h > a) || (!match.atHome && h < a)) {
          winsVsBig6 += 1;
        }
      }
    }

    return winsVsBig6;
  }

  function getVsBig6(data) {
    let vsBig6 = {};
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

      let winsVsBig6 = formWinsVsBig6(data.form[data._id], team, big6);
      if (team in data.form[data._id - 1]) {
        winsVsBig6 += formWinsVsBig6(data.form[data._id - 1], team, big6);
      }

      if (winsVsBig6 > maxWinsVsBig6) {
        maxWinsVsBig6 = winsVsBig6;
      }

      vsBig6[team] = winsVsBig6;
    }

    vsBig6.avg = formMetricAvgScaled(vsBig6, maxWinsVsBig6);

    return vsBig6;
  }

  function scatterPlot(name, r, color) {
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

  function avgScatterPlot() {
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

  function getTeamData(team) {
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

  function initSpiderPlots(team) {
    let avgData = avgScatterPlot();
    let teamData = getTeamData(team);

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

  function buildPlotData(data, team) {
    computePlotData(data);

    let spiderPlots = initSpiderPlots(team);

    let plotData = {
      data: spiderPlots,
      layout: {
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
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return plotData;
  }

  let attack, defence, cleanSheets, consistency, winStreaks, vsBig6;
  let labels = [
    "Attack",
    "Defence",
    "Clean Sheets",
    "Consistency",
    "Win Streak",
    "Vs Big 6",
  ];

  let plotDiv, plotData;
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

  function emptyArray(arr) {
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
    }
  }

  $: team && refreshPlot();

  export let data, team, teams, toAlias, toName;
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
