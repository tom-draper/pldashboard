<script>
  import { onMount } from "svelte";

  function getFormLine(data, playedMatchdays, team, isMainTeam) {
    let matchdays = Object.keys(data.form[data._id][team]); // Played matchdays

    let y = [];
    for (let matchday of matchdays) {
      let form = data.form[data._id][team][matchday].formRating5;
      y.push(form * 100);
    }

    let lineVal;
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = team[0].toLowerCase() + team.slice(1);
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
      name: team,
      mode: "lines",
      line: lineVal,
      text: matchdays,
      hovertemplate: `<b>${team}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
      showlegend: false,
    };
    return line;
  }

  function lines(data, team, playedMatchdays) {
    let lines = [];
    for (let i = 0; i < data.teamNames.length; i++) {
      if (data.teamNames[i] != team) {
        let line = getFormLine(data, playedMatchdays, data.teamNames[i], false);
        lines.push(line);
      }
    }

    // Add this team last to ensure it overlaps all other lines
    let line = getFormLine(data, playedMatchdays, team, true);
    lines.push(line);
    return lines;
  }

  function defaultLayout() {
    if (setup) {
      let layout = {
        yaxis: {
          title: { text: "Form Rating" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
          range: [0, 100],
          tickvals: Array.from(Array(11), (_, i) => i * 10),
        },
        margin: { r: 20, l: 60, t: 5, b: 40, pad: 5 },
      };
      Plotly.update(plotDiv, {}, layout);
    }
  }

  function mobileLayout() {
    if (setup) {
      let layout = {
        yaxis: {
          title: null,
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
          range: [0, 100],
          visible: false,
          tickvals: Array.from(Array(11), (_, i) => i * 10),
        },
        margin: { r: 20, l: 20, t: 5, b: 40, pad: 5 },
      };
      Plotly.update(plotDiv, {}, layout);
    }
  }

  function buildPlotData(data, team) {
    let yLabels = Array.from(Array(11), (_, i) => i * 10);

    let plotData = {
      data: lines(data, team, playedMatchdays),
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
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
          range: [
            playedMatchdays[0],
            playedMatchdays[playedMatchdays.length - 1],
          ],
        },
        dragmode: false,
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
      let newPlotData = buildPlotData(data, team);
      for (let i = 0; i < 20; i++) {
        plotData.data[i] = newPlotData.data[i];
      }
      Plotly.redraw(plotDiv);
      if (mobileView) {
        mobileLayout()
      }
    }
  }

  $: team && refreshPlot();
  $: !mobileView && defaultLayout();
  $: setup && mobileView && mobileLayout();

  export let data, team, playedMatchdays, mobileView;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
