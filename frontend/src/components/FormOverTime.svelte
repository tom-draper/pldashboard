<script>
  import { onMount } from "svelte";

  function getFormLine(data, playedMatchdays, teamName, isMainTeam) {
    let matchdays = Object.keys(data.form[data._id][teamName]); // Played matchdays

    let y = [];
    for (let matchday of matchdays) {
      let form = data.form[data._id][teamName][matchday].formRating5;
      y.push(form * 100);
    }

    let lineVal;
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = teamName[0].toLowerCase() + teamName.slice(1);
      teamKey = teamKey.replace(/ ([A-Z])/g, "-$1").toLowerCase();
      let lineColor = getComputedStyle(
        document.documentElement
      ).getPropertyValue(`--${teamKey}`);
      lineVal = { color: lineColor, width: 4 };
    } else {
      lineVal = { color: "#d3d3d3" };
    }

    let line = {
      x: playedMatchdays,
      y: y,
      name: teamName,
      mode: "lines",
      line: lineVal,
      text: matchdays,
      hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
      showlegend: false,
    };
    return line;
  }

  function lines(data, fullTeamName, playedMatchdays) {
    let lines = [];
    for (let i = 0; i < data.teamNames.length; i++) {
      if (data.teamNames[i] != fullTeamName) {
        let line = getFormLine(data, playedMatchdays, data.teamNames[i], false);
        lines.push(line);
      }
    }
  
    // Add this team last to ensure it overlaps all other lines
    let line = getFormLine(data, playedMatchdays, fullTeamName, true);
    lines.push(line);
    return lines;
  }

  function buildPlotData(data, fullTeamName) {
    let yLabels = Array.from(Array(11), (_, i) => i * 10);

    let plotData = {
      data: lines(data, fullTeamName, playedMatchdays),
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 50, t: 15, b: 40, pad: 5 },
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Form Rating" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
          ticktext: yLabels,
          tickvals: yLabels,
          range: [0, 100],
        },
        xaxis: {
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
          range: [playedMatchdays[0], playedMatchdays[playedMatchdays.length - 1]],
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
    plotData = buildPlotData(data, fullTeamName);
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
