<script>
  import { onMount } from "svelte";

  function getLineConfig(teamName, isMainTeam) {
    let lineConfig;
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = teamName[0].toLowerCase() + teamName.slice(1);
      teamKey = teamKey.replace(/ ([A-Z])/g, "-$1").toLowerCase();
      let lineColor = getComputedStyle(
        document.documentElement
      ).getPropertyValue(`--${teamKey}`);
      lineConfig = { color: lineColor, width: 4 };
    } else {
      lineConfig = { color: "#d3d3d3" };
    }
    return lineConfig
  }

  function getLineY(data, matchdays) {
    let y = [];
    for (let matchday of matchdays) {
      let position = data.form[data._id][teamName][matchday].position;
      y.push(position);
    }
    return y
  }

  function getLine(data, x, teamName, isMainTeam) {
    let matchdays = Object.keys(data.form[data._id][teamName]);

    let y = getLineY(data, matchdays)

    let lineConfig = getLineConfig(teamName, isMainTeam);

    let line = {
      x: x,
      y: y,
      name: teamName,
      mode: "lines",
      line: lineConfig,
      text: matchdays,
      hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
      showlegend: false,
    };
    return line;
  }

  function lines(data, fullTeamName, playedMatchdays) {
    let lines = [];
    for (let i = 0; i < data.teamNames.length; i++) {
      if (data.teamNames[i] != fullTeamName) {
        let line = getLine(data, playedMatchdays, data.teamNames[i], false);
        lines.push(line);
      }
    }
  
    // Add this team last to ensure it overlaps all other lines
    let line = getLine(data, playedMatchdays, fullTeamName, true);
    lines.push(line);
    return lines;
  }

  function buildPlotData(data, fullTeamName) {
    let yLabels = Array.from(Array(20), (_, i) => i + 1);

    let graphData = {
      data: lines(data, fullTeamName, playedMatchdays),
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 50, t: 15, b: 40, pad: 5 },
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Position" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          autorange: "reversed",
          fixedrange: true,
          ticktext: yLabels,
          tickvals: yLabels,
        },
        xaxis: {
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
        },
        shapes: [
          {
            type: "rect",
            x0: playedMatchdays[0],
            y0: 4.5,
            x1: playedMatchdays[playedMatchdays.length - 1],
            y1: 0.5,
            line: {
              width: 0,
            },
            fillcolor: "#77DD77",
            opacity: 0.3,
            layer: "below",
          },
          {
            type: "rect",
            x0: playedMatchdays[0],
            y0: 6.5,
            x1: playedMatchdays[playedMatchdays.length - 1],
            y1: 4.5,
            line: {
              width: 0,
            },
            fillcolor: "#4CDEEE",
            opacity: 0.3,
            layer: "below",
          },
          {
            type: "rect",
            x0: playedMatchdays[0],
            y0: 20.5,
            x1: playedMatchdays[playedMatchdays.length - 1],
            y1: 17.5,
            line: {
              width: 0,
            },
            fillcolor: "#C23B22",
            opacity: 0.3,
            layer: "below",
          },
        ],
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return graphData;
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
    ).then(plot => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  }
  
  function refreshPlot() {
    if (setup) {
      let newPlotData = buildPlotData(data, fullTeamName);
      for (let i = 0; i < 20; i++) {
        plotData.data[i] = newPlotData.data[i];
      }
      Plotly.redraw(plotDiv);
    }
  }

  $: fullTeamName && refreshPlot();

  export let data, fullTeamName, playedMatchdays;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
