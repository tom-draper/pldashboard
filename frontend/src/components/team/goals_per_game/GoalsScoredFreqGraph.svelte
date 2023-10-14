<script lang="ts">
  import { onMount } from 'svelte';

  function defaultLayout() {
    const xLabels = getXLabels();
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
      hovermode: 'closest',
      barmode: 'overlay',
      bargap: 0,
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#fafafa',
      yaxis: getYAxisLayout(),
      xaxis: {
        title: { text: 'Scored' },
        linecolor: 'black',
        showgrid: false,
        showline: false,
        fixedrange: true,
        ticktext: xLabels,
        tickvals: xLabels,
      },
      legend: {
        x: 1,
        xanchor: 'right',
        y: 0.95,
      },
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (!setup) {
      return;
    }
    const layoutUpdate = {
      'yaxis.title': { text: 'Scored' },
      'yaxis.visible': true,
      'margin.l': 60,
    };
    //@ts-ignore
    Plotly.update(plotDiv, {}, layoutUpdate);
  }

  function setMobileLayout() {
    if (!setup) {
      return;
    }
    const layoutUpdate = {
      'yaxis.title': null,
      'yaxis.visible': false,
      'margin.l': 20,
    };
    //@ts-ignore
    Plotly.update(plotDiv, {}, layoutUpdate);
  }

  function buildPlotData(): PlotData {
    const plotData = {
      data: getScoredBars(),
      layout: defaultLayout(),
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
    //@ts-ignore
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    ).then((plot) => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add('resizable-graph');
    });
  }

  function refreshPlot() {
    if (!setup) {
      return;
    }
    plotData.data[1] = getScoredTeamBars(); // Update team bars
    //@ts-ignore
    Plotly.relayout(plotDiv, {
      yaxis: getYAxisLayout(),
    });
    //@ts-ignore
    Plotly.redraw(plotDiv);
    if (mobileView) {
      setMobileLayout();
    }
  }

  let plotDiv: HTMLDivElement, plotData: PlotData;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  $: team && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let team: string,
    getScoredBars: () => any,
    getScoredTeamBars: () => any,
    getXLabels: () => any,
    getYAxisLayout: () => any,
    mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
