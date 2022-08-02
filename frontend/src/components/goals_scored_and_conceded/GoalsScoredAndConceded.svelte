<script>
  import { onMount } from "svelte";

  function getAvgGoalsPerGame(data) {
    let avgGoals = {};

    for (let team of data.teamNames) {
      for (let matchday of Object.keys(data.form[data.currentSeason][team])) {
        let [h, _, a] = data.form[data.currentSeason][team][matchday].score.split(" ");
        h = parseInt(h);
        a = parseInt(a);
        if (matchday in avgGoals) {
          avgGoals[matchday] += h + a;
        } else {
          avgGoals[matchday] = h + a;
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
    for (let matchday of Object.keys(data.form[data.currentSeason][team])) {
      let [h, _, a] = data.form[data.currentSeason][team][matchday].score.split(" ");
      h = parseInt(h);
      a = parseInt(a);
      if (data.form[data.currentSeason][team][matchday].atHome) {
        scored[matchday] = h;
        conceded[matchday] = a;
      } else {
        scored[matchday] = a;
        conceded[matchday] = h;
      }
    }

    return [scored, conceded];
  }

  function getMatchdayDates(data) {
    // Find median matchday date across all teams for each matchday
    let x = [];
    for (let i = 1; i <= 38; i++) {
      let matchdayDates = [];
      for (let team of data.teamNames) {
        matchdayDates.push(data.fixtures[team][i].date);
      }
      matchdayDates = matchdayDates.map((val) => {
        return new Date(val);
      });
      matchdayDates = matchdayDates.sort();
      x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
    }
    x.sort(function (a, b) {
      return a - b;
    });
    return x;
  }

  function getGraphData(data, fullTeamName) {
    let avgGoals = getAvgGoalsPerGame(data);
    let x = getMatchdayDates(data);

    let matchdays = Object.keys(avgGoals);

    let [teamScored, teamConceded] = getTeamGoalsPerGame(data, fullTeamName);

    let graphData = {
      data: [
        {
          name: "Scored",
          type: "bar",
          x: x,
          y: Object.values(teamScored),
          text: matchdays,
          marker: { color: "#77DD77" },
          hovertemplate:
            "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>",
        },
        {
          name: "Conceded",
          type: "bar",
          x: x,
          y: Object.values(teamConceded),
          text: matchdays,
          marker: { color: "C23B22" },
          hovertemplate:
            "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>",
        },
        {
          name: "Avg",
          type: "line",
          x: x,
          y: Object.values(avgGoals),
          text: matchdays,
          hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals<extra></extra>",
          line: { color: "#0080FF", width: 2 },
        },
      ],
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
          rangemode: 'nonnegative'
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
    // Once plot generated, add resizable attribute to it to shorten height for mobile view
    Plot.then((plot) => {
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  });

  export let data, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
