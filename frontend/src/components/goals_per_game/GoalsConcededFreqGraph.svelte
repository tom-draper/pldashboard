<script lang="ts">
  import { onMount } from "svelte";

  function defaultLayout() {
    if (setup) {
      let update = {
        yaxis: getYAxisLayout(),
        margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
      };
      Plotly.update(plotDiv, {}, update);
    }
  }

  function mobileLayout() {
    if (setup) {
      let update = {
        yaxis: getYAxisLayout(),
        margin: { r: 20, l: 20, t: 15, b: 40, pad: 5 },
      };
      update.yaxis.visible = false;
      update.yaxis.title = null;
      Plotly.update(plotDiv, {}, update);
    }
  }

  function buildPlotData(): PlotData {
    let xLabels = getXLabels();
    let plotData = {
      data: getConcededBars(),
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
        hovermode: "closest",
        barmode: "overlay",
        bargap: 0,
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: getYAxisLayout(),
        xaxis: {
          title: { text: "Conceded" },
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
      plotData.data[1] = getConcededTeamBars();
      Plotly.relayout(plotDiv, {
        yaxis: getYAxisLayout(),
      });
      Plotly.redraw(plotDiv);
      if (mobileView) {
        mobileLayout();
      }
    }
  }

  let plotDiv: HTMLDivElement, plotData: PlotData;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  $: team && refreshPlot();
  $: !mobileView && defaultLayout();
  $: setup && mobileView && mobileLayout();

  export let team: string,
    getConcededBars: Function,
    getConcededTeamBars: Function,
    getXLabels: Function,
    getYAxisLayout: Function,
    mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
