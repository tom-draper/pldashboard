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
    spiderPlots.push(teamData);
    Plotly.redraw(plotDiv); // Redraw with teamName added
  }

  function addAvg() {
    let avg = avgScatterPlot();
    spiderPlots.unshift(avg); // Add avg below the teamName spider plot
  }

  function removeTeamComparison(teamName) {
    // Remove spider plot for this teamName
    for (let i = 0; i < spiderPlots.length; i++) {
      if (spiderPlots[i].name == teamName) {
        spiderPlots.splice(i, 1);
        break;
      }
    }

    // If removing only comparison teamName, re-insert the initial avg spider plot
    if (comparisonTeams.length == 1) {
      addAvg();
    }

    Plotly.redraw(plotDiv); // Redraw with teamName removed
  }

  function spiderBtnClick(btn) {
    let teamName = btn.innerHTML;
    if (btn.style.background == "") {
      let teamKey = teamName.toLowerCase().replace(/ /g, "-");
      btn.style.background = `var(--${teamKey})`;
      btn.style.color = `var(--${teamKey}-secondary)`;
    } else {
      btn.style.background = "";
      btn.style.color = "black";
    }

    if (comparisonTeams.length == 0) {
      spiderPlots.splice(0, 1); // Remove avg
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

      let goalsPerSeason = 0
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
      attack[teamName] = ((attack[teamName] - lower) / (upper - lower)) * 100;
    }
    return attack;
  }

  function insertAvgAttack(attack) {
    let totalAttack = 0;
    for (let teamName in attack) {
      totalAttack += attack[teamName];
    }
    attack.avg = totalAttack / Object.keys(attack).length;
  }

  function getAttack(data) {
    let [attack, maxGoals] = goalsPerSeason(data);
    attack = scaleAttack(attack, maxGoals);
    insertAvgAttack(attack);

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
      
      let goalsPerSeason = 0;
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
      defence[teamName] = 100 - ((defence[teamName] - lower) / (upper - lower)) * 100;
    }
    return defence;
  }

  function insertAvgDefence(defence) {
    let totalDefence = 0;
    console.log(defence);
    for (let teamName in defence) {
      console.log(defence[teamName])
      totalDefence += defence[teamName];
    }
    defence.avg = totalDefence / Object.keys(defence).length;
  }

  function getDefence(data) {
    let [defence, range] = concededPerSeason(data);
    defence = scaleDefence(defence, range);
    insertAvgDefence(defence);

    return defence;
  }

  function getCleanSheets(data) {
    let cleanSheets = {};
    let maxCleanSheets = Number.NEGATIVE_INFINITY;
    for (let teamName of data.teamNames) {
      let nCleanSheets = 0;
      for (let matchday of Object.keys(data.form[teamName])) {
        let match = data.form[teamName][matchday];
        if (match.score != null) {
          let [h, _, a] = match.score.split(" ");
          if (match.atHome && a == 0) {
            nCleanSheets += 1;
          } else if (!match.atHome && h == 0) {
            nCleanSheets += 1;
          }
        }
      }
      
      if (teamName in data.prevForm) {
        for (let matchday of Object.keys(data.prevForm[teamName])) {
          let match = data.prevForm[teamName][matchday];
          if (match.score != null) {
            let [h, _, a] = match.score.split(" ");
            if (match.atHome && a == 0) {
              nCleanSheets += 1;
            } else if (!match.atHome && h == 0) {
              nCleanSheets += 1;
            }
          }
        }
      }

      if (nCleanSheets > maxCleanSheets) {
        maxCleanSheets = nCleanSheets;
      }
      cleanSheets[teamName] = nCleanSheets;
    }

    let totalCleanSheets = 0;
    for (let teamName of Object.keys(cleanSheets)) {
      cleanSheets[teamName] = (cleanSheets[teamName] / maxCleanSheets) * 100;
      totalCleanSheets += cleanSheets[teamName];
    }
    cleanSheets.avg = totalCleanSheets / Object.keys(cleanSheets).length;

    return cleanSheets;
  }

  function getConsistency(data) {
    let consistency = {};
    let maxConsistency = Number.NEGATIVE_INFINITY;
    for (let teamName of data.teamNames) {
      let backToBack = 0;
      let prevResult = null;
      for (let matchday of Object.keys(data.form[teamName])) {
        let match = data.form[teamName][matchday];
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

      if (teamName in data.prevForm) {
        for (let matchday of Object.keys(data.prevForm[teamName])) {
          let match = data.prevForm[teamName][matchday];
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
      }

      if (backToBack > maxConsistency) {
        maxConsistency = backToBack;
      }

      consistency[teamName] = backToBack;
    }

    let totalConsistency = 0;
    for (let teamName of Object.keys(consistency)) {
      consistency[teamName] = (consistency[teamName] / maxConsistency) * 100;
      totalConsistency += consistency[teamName];
    }
    consistency.avg = totalConsistency / Object.keys(consistency).length;

    return consistency;
  }

  function getWinStreak(data) {
    let winStreaks = {};
    let maxWinStreaks = Number.NEGATIVE_INFINITY;
    for (let teamName of data.teamNames) {
      let winStreak = 0;
      let tempWinStreak = 0;
      for (let matchday of Object.keys(data.form[teamName])) {
        let match = data.form[teamName][matchday];
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

      if (teamName in data.prevForm) {
        for (let matchday of Object.keys(data.prevForm[teamName])) {
          let match = data.prevForm[teamName][matchday];
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
      }

      if (winStreak > maxWinStreaks) {
        maxWinStreaks = winStreak;
      }
      winStreaks[teamName] = winStreak;
    }

    let totalWinStreaks = 0;
    for (let teamName of Object.keys(winStreaks)) {
      winStreaks[teamName] = (winStreaks[teamName] / maxWinStreaks) * 100;
      totalWinStreaks += winStreaks[teamName];
    }
    winStreaks.avg = totalWinStreaks / Object.keys(winStreaks).length;

    return winStreaks;
  }

  function removeItem(arr, value) {
    let index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
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

      let winsVsBig6 = 0;
      for (let matchday of Object.keys(data.form[teamName])) {
        let match = data.form[teamName][matchday];
        if (match.score != null && big6.includes(match.team)) {
          let [h, _, a] = match.score.split(" ");
          if ((match.atHome && h > a) || (!match.atHome && h < a)) {
            winsVsBig6 += 1;
          }
        }
      }

      if (teamName in data.prevForm) {
        for (let matchday of Object.keys(data.prevForm[teamName])) {
          let match = data.prevForm[teamName][matchday];
          if (match.score != null && big6.includes(match.team)) {
            let [h, _, a] = match.score.split(" ");
            if ((match.atHome && h > a) || (!match.atHome && h < a)) {
              winsVsBig6 += 1;
            }
          }
        }
      }

      if (winsVsBig6 > maxWinsVsBig6) {
        maxWinsVsBig6 = winsVsBig6;
      }

      vsBig6[teamName] = winsVsBig6;
    }

    let totalVsBig6 = 0;
    for (let teamName of Object.keys(vsBig6)) {
      vsBig6[teamName] = (vsBig6[teamName] / maxWinsVsBig6) * 100;
      totalVsBig6 += vsBig6[teamName];
    }
    vsBig6.avg = totalVsBig6 / Object.keys(vsBig6).length;

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

  function initSpiderPlots(teamName) {
    let teamColor = getTeamColor(teamName);

    let avgData = avgScatterPlot();
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

  function getGraphData(data, teamName) {
    computePlotData(data);

    spiderPlots = initSpiderPlots(teamName);

    let graphData = {
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
    return graphData;
  }

  let labels = [
    "Attack",
    "Defence",
    "Clean Sheets",
    "Consistency",
    "Win Streak",
    "vs Big 6",
  ];
  let attack;
  let defence;
  let cleanSheets;
  let consistency;
  let winStreaks;
  let vsBig6;

  let plotDiv;
  let spiderPlots;
  let comparisonTeams = [];
  let graphData;
  onMount(() => {
    graphData = getGraphData(data, fullTeamName);
    let Plot = new Plotly.newPlot(
      plotDiv,
      graphData.data,
      graphData.layout,
      graphData.config
    );
    Plot.then((plot) => {
      plot.children[0].children[0].classList.add("resizable-spider-chart");
    });
    
    // Add inner border radius to top and bottom teams
    document.getElementById('spider-opp-teams').children[0].classList.add('top-spider-opp-team-btn');
    document.getElementById('spider-opp-teams').children[18].classList.add('bottom-spider-opp-team-btn');
  });

  export let data, fullTeamName;
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
          }}>{teamName}</button
        >
      {/if}
    {/each}
  </div>
</div>

<style>
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
  border: 3px solid black;
}
.spider-opp-team-btn {
  cursor: pointer;
  border: none;
  padding: 4px 10px;
}
.spider-opp-team-btn:hover {
  filter: brightness(0.95)
}
</style>