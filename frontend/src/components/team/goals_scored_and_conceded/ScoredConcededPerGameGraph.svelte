<script lang="ts">
  import { onMount } from 'svelte';
  import type { DashboardData, Team } from '../../../lib/dashboard.types';

  function getAvgGoalsPerGame(data: DashboardData): Counter {
    const avgGoals: Counter = {};

    for (const team of Object.keys(data.standings)) {
      for (const matchday of Object.keys(data.form[team][data._id])) {
        const score = data.form[team][data._id][matchday].score;
        if (score == null) {
          continue;
        }
        if (matchday in avgGoals) {
          avgGoals[matchday] += score.homeGoals + score.awayGoals;
        } else {
          avgGoals[matchday] = score.homeGoals + score.awayGoals;
        }
      }
    }

    // Divide by number of teams to get avg goals per matchday
    for (const matchday of Object.keys(avgGoals)) {
      avgGoals[matchday] /= 20;
    }

    return avgGoals;
  }

  function getTeamGoalsPerGame(
    data: DashboardData,
    team: Team
  ): [Counter, Counter] {
    const scored: Counter = {};
    const conceded: Counter = {};
    for (const matchday of Object.keys(data.form[team][data._id])) {
      const score = data.form[team][data._id][matchday].score;
      if (score == null) {
        continue
      }
      if (data.form[team][data._id][matchday].atHome) {
        scored[matchday] = score.homeGoals;
        conceded[matchday] = score.awayGoals;
      } else {
        scored[matchday] = score.awayGoals;
        conceded[matchday] = score.homeGoals;
      }
    }

    return [scored, conceded];
  }

  function avgLine(
    playedDates: Date[],
    avgGoals: Counter,
    matchdays: string[]
  ) {
    return {
      name: 'Avg',
      type: 'line',
      x: playedDates,
      y: Object.values(avgGoals),
      text: matchdays,
      line: { color: '#0080FF', width: 2 },
      hovertemplate: '<b>Matchday %{text}</b><br>%{y:.1f} goals<extra></extra>',
    };
  }

  function teamScoredBar(
    playedDates: Date[],
    teamScored: Counter,
    matchdays: string[]
  ) {
    return {
      name: 'Scored',
      type: 'bar',
      x: playedDates,
      y: Object.values(teamScored),
      text: matchdays,
      marker: { color: '#00fe87' },
      hovertemplate:
        '<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>',
    };
  }

  function teamConcededBar(
    playedDates: Date[],
    teamConceded: Counter,
    matchdays: string[]
  ) {
    return {
      name: 'Conceded',
      type: 'bar',
      x: playedDates,
      y: Object.values(teamConceded),
      text: matchdays,
      marker: { color: '#f83027' },
      hovertemplate:
        '<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>',
    };
  }

  function defaultLayout() {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 15, b: 15, pad: 5 },
      barmode: 'stack',
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#fafafa',
      yaxis: {
        title: { text: 'Goals' },
        gridcolor: 'gray',
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
        rangemode: 'nonnegative',
        visible: true,
        tickformat: 'd',
      },
      xaxis: {
        linecolor: 'black',
        showgrid: false,
        showline: false,
        fixedrange: true,
        showticklabels: false,
      },
      legend: {
        x: 1,
        xanchor: 'right',
        y: 1,
      },
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (!setup) {
      return
    }
    const layoutUpdate = {
      'yaxis.title': { text: 'Goals' },
      'yaxis.visible': true,
      'margin.l': 60,
    };
    //@ts-ignore
    Plotly.update(plotDiv, {}, layoutUpdate);
  }

  function setMobileLayout() {
    if (!setup) {
      return
    }
    const layoutUpdate = {
      'yaxis.title': null,
      'yaxis.visible': false,
      'margin.l': 20,
    };
    //@ts-ignore
    Plotly.update(plotDiv, {}, layoutUpdate);
  }

  function buildPlotData(data: DashboardData, team: Team): PlotData {
    const [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
    const avgGoals = getAvgGoalsPerGame(data);
    const matchdays = Object.keys(avgGoals);

    const scoredBar = teamScoredBar(playedDates, teamScored, matchdays);
    const concededBar = teamConcededBar(playedDates, teamConceded, matchdays);
    const line = avgLine(playedDates, avgGoals, matchdays);

    const plotData = {
      data: [scoredBar, concededBar, line],
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
      return
    }
    const [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
    const avgGoals = getAvgGoalsPerGame(data);
    const matchdays = Object.keys(avgGoals);

    const scoredBar = teamScoredBar(playedDates, teamScored, matchdays);
    const concededBar = teamConcededBar(playedDates, teamConceded, matchdays);
    const line = avgLine(playedDates, avgGoals, matchdays);

    plotData.data[0] = scoredBar;
    plotData.data[1] = concededBar;
    plotData.data[2] = line;

    //@ts-ignore
    Plotly.redraw(plotDiv);
    if (mobileView) {
      setMobileLayout();
    }
  }

  $: team && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: DashboardData,
    team: Team,
    playedDates: Date[],
    mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
