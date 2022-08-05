<script>
  import { onMount } from "svelte";

  function getTeamCleanSheets(data, team) {
    let notCleanSheets = [];
    let cleanSheets = [];
    for (let matchday of Object.keys(data.form[data._id][team])) {
      let [h, _, a] = data.form[data._id][team][matchday].score.split(" ");
      h = parseInt(h);
      a = parseInt(a);
      if (data.form[data._id][team][matchday].atHome) {
        if (a > 0) {
          notCleanSheets.push(1);
          cleanSheets.push(0);
        } else {
          cleanSheets.push(1);
          notCleanSheets.push(0);
        }
      } else {
        if (h > 0) {
          notCleanSheets.push(1);
          cleanSheets.push(0);
        } else {
          cleanSheets.push(1);
          notCleanSheets.push(0);
        }
      }
    }

    return [cleanSheets, notCleanSheets];
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

  function buildPlotData(data, fullTeamName) {
    let x = getMatchdayDates(data);

    let matchdays = Object.keys(data.form[data._id][fullTeamName]);

    let [cleanSheets, notCleanSheets] = getTeamCleanSheets(data, fullTeamName);

    let plotData = {
      data: [
        {
          name: "Clean sheets",
          type: "bar",
          x: x,
          y: cleanSheets,
          text: matchdays,
          marker: { color: "#77DD77" },
          hovertemplate: "<b>Clean sheet<extra></extra>",
          showlegend: false,
        },
        {
          name: "Conceded",
          type: "bar",
          x: x,
          y: notCleanSheets,
          text: matchdays,
          marker: { color: "C23B22" },
          hovertemplate: "<b>Goals conceded<extra></extra>",
          showlegend: false,
        },
      ],
      layout: {
        title: false,
        autosize: true,
        height: 60,
        margin: { r: 20, l: 50, t: 0, b: 40, pad: 5 },
        barmode: "stack",
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "" },
          showticklabels: false,
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
        },
        xaxis: {
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
        },
        shapes: [
          {
            type: "line",
            x0: x[0],
            y0: 0.5,
            x1: x[x.length - 1],
            y1: 0.5,
            layer: "below",
            line: {
              color: "#d3d3d3",
              width: 2,
            },
          },
        ],
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
    plotData = buildPlotData(data, fullTeamName);
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    );
  }

  function refreshPlot() {
    if (setup) {
      let newPlotData = buildPlotData(data, fullTeamName);
      plotData.data[0] = newPlotData.data[0];
      plotData.data[1] = newPlotData.data[1];
      Plotly.redraw(plotDiv);
    }
  }

  $: fullTeamName && refreshPlot();

  export let data, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
