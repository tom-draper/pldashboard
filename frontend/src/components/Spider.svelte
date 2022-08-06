<script>
  import { onMount } from "svelte";

  function getTeamColor(teamName) {
    let teamKey = teamName[0].toLowerCase() + teamName.slice(1);
    teamKey = teamKey.replace(/ /g, "-").toLowerCase();
    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(
      `--${teamKey}`
    );
    return teamColor;
  }

  function addTeamComparison(teamName) {
    let teamColor = getTeamColor(teamName);

    let teamData = {
      name: teamName,
      type: "scatterpolar",
      r: [
        attack[teamName],
        defence[teamName],
        cleanSheets[teamName],
        consistency[teamName],
        winStreaks[teamName],
        vsBig6[teamName],
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

  function removeTeamComparison(teamName) {
    // Remove spider plot for this teamName
    for (let i = 0; i < plotData.data.length; i++) {
      if (plotData.data[i].name == teamName) {
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
  }

  function spiderBtnClick(btn) {
    let teamName = getName(btn.innerHTML);
    if (btn.style.background == "") {
      let teamKey = teamName.toLowerCase().replace(/ /g, "-");
      btn.style.background = `var(--${teamKey})`;
      btn.style.color = `var(--${teamKey}-secondary)`;
    } else {
      btn.style.background = "";
      btn.style.color = "black";
    }

    if (comparisonTeams.length == 0) {
      plotData.data.splice(0, 1); // Remove avg
    }

    if (comparisonTeams.includes(teamName)) {
      removeTeamComparison(teamName); // Remove from spider chart
      removeItem(comparisonTeams, teamName); // Remove from comparison teams
    } else {
      addTeamComparison(teamName); // Add teamName to spider chart
      comparisonTeams.push(teamName); // Add to comparison teams
    }
  }

  function goalsPerSeason(data) {
    let attack = {};
    let maxGoals = Number.NEGATIVE_INFINITY;
    let minGoals = Number.POSITIVE_INFINITY;
    for (let teamName of data.teamNames) {
      let totalGoals = 0;
      let seasonsPlayed = 0;
      for (let year in data.standings[teamName]) {
        let goals = data.standings[teamName][year].gF;
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

      attack[teamName] = goalsPerSeason;
    }
    return [attack, [minGoals, maxGoals]];
  }

  function scaleAttack(attack, range) {
    let [lower, upper] = range;
    for (let teamName in attack) {
      if (attack[teamName] == null) {
        attack[teamName] = 0;
      } else {
        attack[teamName] = ((attack[teamName] - lower) / (upper - lower)) * 100;
      }
    }
    return attack;
  }

  function formMetricAvgScaled(formMetric, max) {
    let total = 0;
    for (let teamName in formMetric) {
      formMetric[teamName] = (formMetric[teamName] / max) * 100;
      total += formMetric[teamName];
    }
    let avg = total / Object.keys(formMetric).length;

    return avg;
  }

  function formMetricAvg(formMetric) {
    let total = 0;
    for (let teamName in formMetric) {
      total += formMetric[teamName];
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
    for (let teamName of data.teamNames) {
      let totalConceded = 0;
      let seasonsPlayed = 0;
      for (let year in data.standings[teamName]) {
        let goals = data.standings[teamName][year].gA;
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

      defence[teamName] = goalsPerSeason;
    }

    return [defence, [minConceded, maxConceded]];
  }

  function scaleDefence(defence, range) {
    let [lower, upper] = range;
    for (let teamName in defence) {
      if (defence[teamName] == null) {
        defence[teamName] = 0;
      } else {
        defence[teamName] =
          100 - ((defence[teamName] - lower) / (upper - lower)) * 100;
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

  function formCleanSheets(form, teamName) {
    let nCleanSheets = 0;
    for (let matchday of Object.keys(form[teamName])) {
      let match = form[teamName][matchday];
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
    for (let teamName of data.teamNames) {
      let nCleanSheets = formCleanSheets(data.form[data._id], teamName);
      if (teamName in data.form[data._id - 1]) {
        nCleanSheets += formCleanSheets(data.form[data._id - 1], teamName);
      }

      if (nCleanSheets > maxCleanSheets) {
        maxCleanSheets = nCleanSheets;
      }
      cleanSheets[teamName] = nCleanSheets;
    }

    cleanSheets.avg = formMetricAvgScaled(cleanSheets, maxCleanSheets);

    return cleanSheets;
  }

  function formConsistency(form, teamName) {
    let backToBack = 0; // Counts pairs of back to back identical match results
    let prevResult = null;
    for (let matchday in form[teamName]) {
      let match = form[teamName][matchday];
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
    for (let teamName of data.teamNames) {
      let backToBack = formConsistency(data.form[data._id], teamName);
      if (teamName in data.form[data._id - 1]) {
        backToBack += formConsistency(data.form[data._id - 1], teamName);
      }

      if (backToBack > maxConsistency) {
        maxConsistency = backToBack;
      }

      consistency[teamName] = backToBack;
    }

    consistency.avg = formMetricAvgScaled(consistency, maxConsistency);

    return consistency;
  }

  function formWinStreak(form, teamName) {
    let winStreak = 0;
    let tempWinStreak = 0;
    for (let matchday in form[teamName]) {
      let match = form[teamName][matchday];
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
    for (let teamName of data.teamNames) {
      let winStreak = formWinStreak(data.form[data._id], teamName);
      if (teamName in data.form[data._id - 1]) {
        winStreak += formWinStreak(data.form[data._id - 1], teamName);
      }

      if (winStreak > maxWinStreaks) {
        maxWinStreaks = winStreak;
      }
      winStreaks[teamName] = winStreak;
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

  function formWinsVsBig6(form, teamName, big6) {
    let winsVsBig6 = 0;
    for (let matchday in form[teamName]) {
      let match = form[teamName][matchday];
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
    for (let teamName of data.teamNames) {
      let big6 = [
        "Manchester United",
        "Liverpool",
        "Manchester City",
        "Arsenal",
        "Chelsea",
        "Tottenham Hotspur",
      ];
      big6 = removeItem(big6, teamName);

      let winsVsBig6 = formWinsVsBig6(data.form[data._id], teamName, big6);
      if (teamName in data.form[data._id - 1]) {
        winsVsBig6 += formWinsVsBig6(data.form[data._id - 1], teamName, big6);
      }

      if (winsVsBig6 > maxWinsVsBig6) {
        maxWinsVsBig6 = winsVsBig6;
      }

      vsBig6[teamName] = winsVsBig6;
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

  function getTeamData(teamName) {
    let teamColor = getTeamColor(teamName);
    let teamData = scatterPlot(
      teamName,
      [
        attack[teamName],
        defence[teamName],
        cleanSheets[teamName],
        consistency[teamName],
        winStreaks[teamName],
        vsBig6[teamName],
      ],
      teamColor
    );
    return teamData;
  }

  function initSpiderPlots(teamName) {
    let avgData = avgScatterPlot();
    let teamData = getTeamData(teamName);

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

  function buildPlotData(data, teamName) {
    computePlotData(data);

    let spiderPlots = initSpiderPlots(teamName);

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
    plotData = buildPlotData(data, fullTeamName);
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    ).then(plot => {
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
      let spiderPlots = initSpiderPlots(fullTeamName);
      // Remove all but two plots
      emptyArray(plotData.data);
      // Replace final two plots with defaults
      plotData.data.push(spiderPlots[0])  // Reset to avg
      plotData.data.push(spiderPlots[1])  // Reset to team data
  
      removeAllTeamComparisons();
      resetTeamComparisonBtns();
    }
  }

  $: fullTeamName && refreshPlot();

  export let data, fullTeamName, getAlias, getName;
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
    {#each data.teamNames as teamName}
      {#if teamName != fullTeamName}
        <button
          class="spider-opp-team-btn"
          on:click={(e) => {
            spiderBtnClick(e.target);
          }}>{getAlias(teamName)}</button
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
