<script lang="ts">
  import { onMount } from 'svelte';
  import { toHyphenatedName } from '../../lib/team';
  import type { DashboardData, Team } from '../../lib/dashboard.types';

  function getLineConfig(team: string, isMainTeam: boolean) {
    let lineConfig;
    if (isMainTeam) {
      // Get team primary colour from css variable
      const teamKey = toHyphenatedName(team);
      const lineColor = getComputedStyle(
        document.documentElement
      ).getPropertyValue(`--${teamKey}`);
      lineConfig = { color: lineColor, width: 4 };
    } else {
      lineConfig = { color: '#d3d3d3' };
    }
    return lineConfig;
  }

  function getCumulativePoints(
    data: DashboardData,
    team: Team,
    matchdays: string[]
  ): number[] {
    const y = [];
    for (const matchday of matchdays) {
      const points = data.form[team][data._id][matchday].cumPoints;
      y.push(points);
    }
    return y;
  }

  function getMatchdayDates(
    data: DashboardData,
    team: Team,
    matchdays: string[]
  ): Date[] {
    const dates = [];
    for (let i = 0; i < matchdays.length; i++) {
      const date = data.form[team][data._id][matchdays[i]].date;
      dates.push(date);
    }
    return dates;
  }

  function getLine(data: DashboardData, team: Team, isMainTeam: boolean) {
    const matchdays = Object.keys(data.form[team][data._id]);
    const dates = getMatchdayDates(data, team, matchdays);
    const y = getCumulativePoints(data, team, matchdays);
    const lineConfig = getLineConfig(team, isMainTeam);

    const line = {
      x: matchdays,
      y: y,
      name: team,
      mode: 'lines',
      line: lineConfig,
      text: dates,
      hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
      showlegend: false,
    };
    return line;
  }

  function lines(data: DashboardData, team: Team) {
    const lines = [];
    const teams = Object.keys(data.standings) as Team[];
    for (let i = 0; i < teams.length; i++) {
      if (teams[i] === team) {
        continue;
      }
      const line = getLine(data, teams[i], false);
      lines.push(line);
    }

    // Add this team last to ensure it overlaps all other lines
    const line = getLine(data, team, true);
    lines.push(line);
    return lines;
  }

  function defaultLayout() {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#fafafa',
      yaxis: {
        title: { text: 'Points' },
        gridcolor: 'gray',
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
        visible: true,
      },
      xaxis: {
        title: { text: 'Matchday' },
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
    Plotly.update(plotDiv, {}, layoutUpdate);
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
    //@ts-ignore
    Plotly.update(plotDiv, {}, layoutUpdate);
  }

  function buildPlotData(data: DashboardData, team: Team): PlotData {
    const plotData = {
      data: lines(data, team),
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
    plotData = buildPlotData(data, team);
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
    const newPlotData = buildPlotData(data, team);
    for (let i = 0; i < 20; i++) {
      plotData.data[i] = newPlotData.data[i];
    }

    //@ts-ignore
    Plotly.redraw(plotDiv);
    if (mobileView) {
      setMobileLayout();
    }
  }

  $: team && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: DashboardData, team: Team, mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
