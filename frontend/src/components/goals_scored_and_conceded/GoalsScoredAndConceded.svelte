<script>
  import { onMount } from "svelte";

  function getAvgGoalsPerGame(data) {
    let avgGoals = {};

    for (let team of data.teamNames) {
      for (let matchday of Object.keys(data.form[data._id][team])) {
        let score = data.form[data._id][team][matchday].score;
        if (score != null) {
          let [h, _, a] = score.split(" ");
          h = parseInt(h);
          a = parseInt(a);
          if (matchday in avgGoals) {
            avgGoals[matchday] += h + a;
          } else {
            avgGoals[matchday] = h + a;
          }
        }
      }
    }

    // Divide by number of teams to get avg goals per gameweek
    for (let matchday of Object.keys(avgGoals)) {
      avgGoals[matchday] /= 20;
    }

    return avgGoals;
  }

  function getTeamGoalsPerGame(data, team) {
    let scored = {};
    let conceded = {};
    for (let matchday of Object.keys(data.form[data._id][team])) {
      let score = data.form[data._id][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        h = parseInt(h);
        a = parseInt(a);
        if (data.form[data._id][team][matchday].atHome) {
          scored[matchday] = h;
          conceded[matchday] = a;
        } else {
          scored[matchday] = a;
          conceded[matchday] = h;
        }
      }
    }

    return [scored, conceded];
  }

  function avgLine(playedMatchdays, avgGoals, matchdays) {
    return {
      name: "Avg",
      type: "line",
      x: playedMatchdays,
      y: Object.values(avgGoals),
      text: matchdays,
      hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals<extra></extra>",
      line: { color: "#0080FF", width: 2 },
    };
  }

  function teamScoredBar(playedMatchdays, teamScored, matchdays) {
    return {
      name: "Scored",
      type: "bar",
      x: playedMatchdays,
      y: Object.values(teamScored),
      text: matchdays,
      marker: { color: "#77DD77" },
      hovertemplate:
        "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>",
    };
  }

  function teamConcededBar(playedMatchdays, teamConceded, matchdays) {
    return {
      name: "Conceded",
      type: "bar",
      x: playedMatchdays,
      y: Object.values(teamConceded),
      text: matchdays,
      marker: { color: "C23B22" },
      hovertemplate:
        "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>",
    };
  }

  function buildPlotData(data, team) {
    // let x = getMatchdayDates(data, fullTeamName);
    let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
    let avgGoals = getAvgGoalsPerGame(data);
    let matchdays = Object.keys(avgGoals);

    let scoredBar = teamScoredBar(playedMatchdays, teamScored, matchdays);
    let concededBar = teamConcededBar(playedMatchdays, teamConceded, matchdays);
    let line = avgLine(playedMatchdays, avgGoals, matchdays);

    let plotData = {
      data: [scoredBar, concededBar, line],
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 50, t: 15, b: 15, pad: 5 },
        barmode: "stack",
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Goals Scored" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
          rangemode: "nonnegative",
        },
        xaxis: {
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
          showticklabels: false,
        },
        legend: {
          x: 1,
          xanchor: "right",
          y: 1,
        },
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return plotData;
  }

  let plotDiv, plotData;
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
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  }

  function refreshPlot() {
    if (setup) {
      let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
      let avgGoals = getAvgGoalsPerGame(data);
      let matchdays = Object.keys(avgGoals);

      let scoredBar = teamScoredBar(playedMatchdays, teamScored, matchdays);
      let concededBar = teamConcededBar(playedMatchdays, teamConceded, matchdays);
      
      plotData.data[0] = scoredBar;
      plotData.data[1] = concededBar;
      Plotly.redraw(plotDiv);
    }
  }

  $: team && refreshPlot();

  export let data, team, playedMatchdays;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
