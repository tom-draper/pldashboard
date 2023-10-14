<script lang="ts">
  import { onMount } from 'svelte';
  import type { FantasyData, Page, Position } from '../../lib/fantasy.types';

  const positionColours: { [position: Position]: string } = {
    Forward: '#c600d8',
    Midfielder: '#00fe87',
    Defender: '#2dbaff',
    Goalkeeper: '#280936',
  } as const;

  function lines(data: FantasyData) {
    const teams: string[] = [];
    const points: number[] = [];
    const price: number[] = [];
    const minutes: number[] = [];
    const colours: string[] = [];
    let maxMinutes = 0;
    for (const team of Object.keys(data)) {
      if (team === '_id') {
        continue;
      }
      teams.push(team);
      points.push(data[team].totalPoints === null ? 0 : data[team].totalPoints);
      price.push(data[team].price == null ? 0 : data[team].price / 10);
      minutes.push(data[team].minutes == null ? 0 : data[team].minutes / 2);
      if (minutes[minutes.length - 1] > maxMinutes) {
        maxMinutes = minutes[minutes.length - 1];
      }
      colours.push(positionColours[data[team].position]);
    }

    const sizes = minutes.slice(0);
    for (let i = 0; i < sizes.length; i++) {
      sizes[i] /= maxMinutes * 0.02;
    }

    const playtimes = minutes.map((x) => ((x / maxMinutes) * 100).toFixed(1));

    const markers = {
      x: points,
      y: price,
      name: 'test',
      mode: 'markers',
      type: 'scatter',
      marker: {
        size: sizes,
        opacity: 0.75,
        color: colours,
      },
      customdata: playtimes,
      text: teams,
      hovertemplate: `<b>%{text}</b><br><b>£%{y}m</b><br><b>%{x} points</b><br>%{customdata}% playtime<extra></extra>`,
      showlegend: false,
    };

    // Add this team last to ensure it overlaps all other lines
    return [markers];
  }

  function defaultLayout() {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
      hovermode: 'closest',
      plot_bgcolor: 'transparent',
      paper_bgcolor: 'transparent',
      height: 700,
      yaxis: {
        title: { text: 'Price' },
        gridcolor: 'gray',
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
        visible: true,
      },
      xaxis: {
        title: { text: 'Points' },
        linecolor: 'black',
        showgrid: false,
        showline: false,
        fixedrange: true,
      },
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (!setup) {
      return;
    }
    const layoutUpdate = {
      'yaxis.title': { text: 'Position' },
      'yaxis.visible': true,
      'yaxis.tickvals': Array.from(Array(20), (_, i) => i + 1),
      'margin.l': 60,
      'margin.t': 15,
    };
    //@ts-ignore
    Plotly.update(plotDiv, {}, layoutUpdate, 0);
  }

  function setMobileLayout() {
    if (!setup) {
      return;
    }
    const layoutUpdate = {
      'yaxis.title': null,
      'yaxis.visible': false,
      'yaxis.tickvals': Array.from(Array(10), (_, i) => i + 2),
      'margin.l': 20,
      'margin.t': 5,
    };

    const sizes = plotData.data[0].marker.size;
    for (let i = 0; i < sizes.length; i++) {
      sizes[i] = Math.round(sizes[i] / 2);
    }
    const dataUpdate = {
      marker: {
        size: sizes,
        color: plotData.data[0].marker.color,
        opacity: 0.75,
      },
    };

    plotData.data[0].marker.size = sizes;

    //@ts-ignore
    Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
  }

  function buildPlotData(data: FantasyData): PlotData {
    const plotData = {
      data: lines(data),
      layout: defaultLayout(),
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return plotData;
  }

  let plotDiv: HTMLDivElement, plotData: PlotData;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  function genPlot() {
    plotData = buildPlotData(data);
    //@ts-ignore
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    ).then((plot: HTMLDivElement) => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add('resizable-graph');
      plot.children[0].children[0].classList.add('tall-graph');
    });
  }

  function refreshPlot() {
    if (!setup) {
      return;
    }
    const newPlotData = buildPlotData(data);
    plotData.data[0] = newPlotData.data[0];

    //@ts-ignore
    Plotly.redraw(plotDiv);
    if (mobileView) {
      setMobileLayout();
    }
  }

  $: page && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: FantasyData, page: Page, mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
