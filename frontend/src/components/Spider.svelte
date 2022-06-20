<script>
  import { onMount } from "svelte";

  function spiderBtnClick(btn) {
    if (btn.style.background == '') {
      let team = btn.innerHTML.toLowerCase().replace(/ /g, '-');
      btn.style.background = `var(--${team})`;
      btn.style.color = `var(--${team}-secondary)`;

    } else {
      btn.style.background = '';
      btn.style.color = 'black';
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
      let goalsPerSeason = totalGoals / seasonsPlayed;
      attack[team] = goalsPerSeason;
    }
    return [attack, [minGoals, maxGoals]];
  }

  function scaleAttack(attack, range) {
    let [lower, upper] = range;
    for (let team in attack) {
      attack[team] = ((attack[team] - lower) / (upper - lower)) * 100;
    }
    return attack;
  }

  function insertAvgAttack(attack) {
    let totalAttack = 0;
    for (let team in attack) {
      totalAttack += attack[team];
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
    for (let team of data.teamNames) {
      let totalGoals = 0;
      let seasonsPlayed = 0;
      for (let year in data.standings[team]) {
        let goals = data.standings[team][year].gA;
        if (goals > 0) {
          totalGoals += goals;
          if (goals > maxConceded) {
            maxConceded = goals;
          } else if (goals < minConceded) {
            minConceded = goals;
          }
          seasonsPlayed += 1;
        }
      }
      let goalsPerSeason = totalGoals / seasonsPlayed;
      defence[team] = goalsPerSeason;
    }
    return [defence, [minConceded, maxConceded]];
  }

  function scaleDefence(defence, range) {
    let [lower, upper] = range;
    for (let team in defence) {
      defence[team] = 100 - ((defence[team] - lower) / (upper - lower)) * 100;
    }
    return defence;
  }

  function insertAvgDefence(defence) {
    let totalAttack = 0;
    for (let team in defence) {
      totalAttack += defence[team];
    }
    defence.avg = totalAttack / Object.keys(defence).length;
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
    for (let team of data.teamNames) {
      let nCleanSheets = 0;
      for (let matchday of Object.keys(data.form[team])) {
        let match = data.form[team][matchday];
        if (match.score != "None - None") {
          let [h, _, a] = match.score.split(" ");
          if (match.atHome && a == 0) {
            nCleanSheets += 1;
          } else if (!match.atHome && h == 0) {
            nCleanSheets += 1;
          }
        }
      }
      if (nCleanSheets > maxCleanSheets) {
        maxCleanSheets = nCleanSheets;
      }
      cleanSheets[team] = nCleanSheets;
    }

    let totalCleanSheets = 0;
    for (let team of Object.keys(cleanSheets)) {
      cleanSheets[team] = (cleanSheets[team] / maxCleanSheets) * 100;
      totalCleanSheets += cleanSheets[team];
    }
    cleanSheets.avg = totalCleanSheets / Object.keys(cleanSheets).length;

    return cleanSheets;
  }

  function getConsistency(data) {
    let consistency = {};
    let maxConsistency = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let backToBack = 0;
      let prevResult = null;
      for (let matchday of Object.keys(data.form[team])) {
        let match = data.form[team][matchday];
        if (match.score != "None - None") {
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
      if (backToBack > maxConsistency) {
        maxConsistency = backToBack;
      }
      consistency[team] = backToBack;
    }

    let totalConsistency = 0;
    for (let team of Object.keys(consistency)) {
      consistency[team] = (consistency[team] / maxConsistency) * 100;
      totalConsistency += consistency[team];
    }
    consistency.avg = totalConsistency / Object.keys(consistency).length;

    return consistency;
  }

  function getWinStreak(data) {
    let winStreaks = {};
    let maxWinStreaks = Number.NEGATIVE_INFINITY;
    for (let team of data.teamNames) {
      let winStreak = 0;
      let tempWinStreak = 0;
      for (let matchday of Object.keys(data.form[team])) {
        let match = data.form[team][matchday];
        if (match.score != "None - None") {
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
      if (winStreak > maxWinStreaks) {
        maxWinStreaks = winStreak;
      }
      winStreaks[team] = winStreak;
    }

    let totalWinStreaks = 0;
    for (let team of Object.keys(winStreaks)) {
      winStreaks[team] = (winStreaks[team] / maxWinStreaks) * 100;
      totalWinStreaks += winStreaks[team];
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
    for (let team of data.teamNames) {
      let big6 = [
        "Manchester United FC",
        "Liverpool FC",
        "Manchester City FC",
        "Arsenal FC",
        "Chelsea FC",
        "Tottenham Hotspurs FC",
      ];
      big6 = removeItem(big6, team);

      let winsVsBig6 = 0;
      for (let matchday of Object.keys(data.form[team])) {
        let match = data.form[team][matchday];
        if (match.score != "None - None" && big6.includes(match.team)) {
          let [h, _, a] = match.score.split(" ");
          if ((match.atHome && h > a) || (!match.atHome && h < a)) {
            winsVsBig6 += 1;
          }
        }
      }
      if (winsVsBig6 > maxWinsVsBig6) {
        maxWinsVsBig6 = winsVsBig6;
      }
      vsBig6[team] = winsVsBig6;
    }

    let totalVsBig6 = 0;
    for (let team of Object.keys(vsBig6)) {
      vsBig6[team] = (vsBig6[team] / maxWinsVsBig6) * 100;
      totalVsBig6 += vsBig6[team];
    }
    vsBig6.avg = totalVsBig6 / Object.keys(vsBig6).length;

    return vsBig6;
  }

  function getGraphData(data, team) {
    let teamKey = team.replace(" FC", "");
    teamKey = teamKey[0].toLowerCase() + teamKey.slice(1);
    teamKey = teamKey.replace(/ ([A-Z])/g, "-$1").toLowerCase();
    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(
      `--${teamKey}`
    );

    let labels = [
      "Attack",
      "Defence",
      "Clean Sheets",
      "Consistency",
      "Win Streak",
      "vs Big 6",
    ];

    let attack = getAttack(data);
    let defence = getDefence(data);
    let cleanSheets = getCleanSheets(data);
    let consistency = getConsistency(data);
    let winStreaks = getWinStreak(data);
    let vsBig6 = getVsBig6(data);

    let graphData = {
      data: [
        {
          type: "scatterpolar",
          r: [
            attack.avg,
            defence.avg,
            cleanSheets.avg,
            consistency.avg,
            winStreaks.avg,
            vsBig6.avg,
          ],
          theta: labels,
          fill: "toself",
          marker: { color: "#d3d3d3" },
        },
        {
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
        },
      ],
      layout: {
        height: 550,
        polar: {
          radialaxis: {
            visible: true,
            range: [0, 100],
          },
        },
        hover: "closest",
        margin: { t: 25, b: 25, l: 100, r: 100 },
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

  let plotDiv;
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
  });

  export let data, fullTeamName;
</script>

<div class="spider-chart full-row-graph">
  <div id="plotly">
    <div id="plotDiv" bind:this={plotDiv}>
      <!-- Plotly chart will be drawn inside this DIV -->
    </div>
  </div>
</div>
<div class="spider-opp-team-selector">
  <div class="spider-opp-team-title">Select team comparison</div>
  <div class="spider-opp-team-btns">
    {#each data.teamNames as teamName}
      {#if teamName != fullTeamName}
        <button
          class="spider-opp-team-btn"
          on:click={(e) => {
            spiderBtnClick(e.target);
          }}
        >
          {teamName.replace(" FC", "")}
        </button>
        <!-- style="background: var(--{teamName.replace(" FC", "").toLowerCase().replace(/ /g, "-")}); color: var(--{teamName.replace(" FC", "").toLowerCase().replace(/ /g, "-")}-secondary)" -->
      {/if}
    {/each}
  </div>
</div>
