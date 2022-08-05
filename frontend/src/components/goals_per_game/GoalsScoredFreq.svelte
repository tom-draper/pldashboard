<script>
  import { onMount } from "svelte";

  function buildPlotData() {
    let xLabels = Object.keys(goalFreq);

    let plotData = {
      data: [
        {
          x: Object.keys(goalFreq),
          y: Object.values(goalFreq),
          type: "bar",
          name: "Avg",
          marker: { color: "#C6C6C6" },
          line: { width: 0 },
          hovertemplate: "%{x} goals in %{y} games<extra></extra>",
          hoverinfo: "x+y",
        },
        {
          x: Object.keys(teamScoredFreq),
          y: Object.values(teamScoredFreq),
          type: "bar",
          name: "Goals scored",
          marker: { color: "#77DD77" },
          line: { width: 0 },
          hovertemplate: "%{x} goals in %{y} games<extra></extra>",
          hoverinfo: "x+y",
          opacity: 0.6,
        },
      ],
      layout: {
        title: false,
        autosize: true,
        margin: { r: 0, l: 50, t: 15, b: 40, pad: 5 },
        hovermode: "closest",
        barmode: "overlay",
        bargap: 0,
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Frequency" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
          rangemode: 'nonnegative'
        },
        xaxis: {
          title: { text: "Goals Scored" },
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
          ticktext: xLabels,
          tickvals: xLabels,
        },
        legend: {
          x: 1,
          xanchor: "right",
          y: 0.95,
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
    plotData = buildPlotData();
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
      let newPlotData = buildPlotData();
      plotData.data[1] = newPlotData.data[1];
      Plotly.redraw(plotDiv);
    }
  }

  $: fullTeamName && refreshPlot();

  export let goalFreq, teamScoredFreq, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
