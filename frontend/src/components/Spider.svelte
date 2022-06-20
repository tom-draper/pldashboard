<script>
  import { onMount } from "svelte";

  function goalsPerSeason(data) {
    let attack = {};
    let maxGoals = null;
    for (let team of data.teamNames) {
      let totalGoals = 0;
      let seasonsPlayed = 0;
      for (let year in data.standings[team]) {
        let goals = data.standings[team][year].gF;
        if (goals > 0) {
          totalGoals += goals;
          if (goals > maxGoals) {
            maxGoals = goals;
          }
          seasonsPlayed += 1;
        }
      }
      let goalsPerSeason = totalGoals / seasonsPlayed;
      attack[team] = goalsPerSeason;
    }
    return [attack, maxGoals];
  }

  function scaleAttack(attack, upperLimit) {
    for (let team in attack) {
      attack[team] = (attack[team] / upperLimit) * 100
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
    let maxConceded = null;
    for (let team of data.teamNames) {
      let totalGoals = 0;
      let seasonsPlayed = 0;
      for (let year in data.standings[team]) {
        let goals = data.standings[team][year].gA;
        if (goals > 0) {
          totalGoals += goals;
          if (goals > maxConceded) {
            maxConceded = goals;
          }
          seasonsPlayed += 1
        }
      }
      let goalsPerSeason = totalGoals / seasonsPlayed;
      defence[team] = goalsPerSeason;
    }
    return [defence, maxConceded];
  }

  function scaleDefence(defence, upperLimit) {
    for (let team in defence) {
      defence[team] = 100 - ((defence[team] / upperLimit) * 100)
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
    let [defence, maxConceded] = concededPerSeason(data);
    defence = scaleDefence(defence, maxConceded);
    insertAvgDefence(defence);

    return defence;
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
      "Vs Big 6",
    ];

    let attack = getAttack(data);
    console.log(attack);

    let defence = getDefence(data);
    console.log(defence);

    let graphData = {
      data: [
        {
          type: "scatterpolar",
          r: [attack.avg, defence.avg, 10, 20, 60, 60],
          theta: labels,
          fill: "toself",
          marker: { color: "#d3d3d3" },
        },
        {
          type: "scatterpolar",
          r: [attack[team], defence[team], 8, 60, 100, 60, 50],
          theta: labels,
          fill: "toself",
          marker: { color: teamColor },
          lineclose: true,
          // opacity: 0.4,
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

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
