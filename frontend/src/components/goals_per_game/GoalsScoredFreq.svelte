<script>
  import { onMount } from "svelte";

  function buildPlotData() {
    let xLabels = getXLabels();

    let plotData = {
      data: getScoredBars(),
      layout: {
        title: false,
        autosize: true,
        margin: { r: 10, l: 60, t: 15, b: 40, pad: 5 },
        hovermode: "closest",
        barmode: "overlay",
        bargap: 0,
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: getYAxisLayout(),
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
  
  function genPlot() {
    plotData = buildPlotData();
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
      plotData.data[1] = getScoredTeamBars(); // Update team bars
      Plotly.relayout(plotDiv, {
        yaxis: getYAxisLayout(),
      });
      Plotly.redraw(plotDiv);
    }
  }

  let plotDiv, plotData;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  $: team && refreshPlot();

  export let team,
    getScoredBars,
    getScoredTeamBars,
    getXLabels,
    getYAxisLayout;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
