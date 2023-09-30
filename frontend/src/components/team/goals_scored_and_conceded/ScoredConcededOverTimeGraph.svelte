<script lang="ts">
  import { onMount } from 'svelte';
  import type { DashboardData, Team } from '../../../lib/dashboard.types';

  function seasonFinishLines(
    seasonBoundaries: number[],
    maxX: number,
    maxY: number
  ) {
    const lines = [];
    for (let i = 0; i < seasonBoundaries.length; i++) {
      if (seasonBoundaries[i] < maxX) {
        lines.push({
          type: 'line',
          x0: seasonBoundaries[i],
          y0: 0,
          x1: seasonBoundaries[i],
          y1: maxY,
          line: {
            color: 'black',
            dash: 'dot',
            width: 1,
          },
        });
      }
    }
    return lines;
  }

  function goalsScoredLine(x: number[], y: number[], dates: Date[]) {
    return {
      x: x,
      y: y,
      type: 'scatter',
      fill: 'tozeroy',
      mode: 'lines',
      name: 'Scored',
      text: dates,
      line: {
        color: '#00fe87',
      },
      hovertemplate:
        '%{text|%d %b %Y}<br>Avg scored: <b>%{y:.1f}</b><extra></extra>',
    };
  }
  function goalsConcededLine(x: number[], y: number[], dates: Date[]) {
    return {
      x: x,
      y: y,
      type: 'scatter',
      fill: 'tozeroy',
      mode: 'lines',
      name: 'Conceded',
      text: dates,
      line: {
        color: '#f83027',
      },
      hovertemplate:
        '%{text|%d %b %Y}<br>Avg conceded: <b>%{y:.1f}</b><extra></extra>',
    };
  }

  type GoalsOverTime = {
    date: Date;
    days: number;
    matchday: string;
    scored: number;
    conceded: number;
  }[];

  function numDays(start: Date, end: Date): number {
    const date1 = new Date(start);
    const date2 = new Date(end);

    // One day in milliseconds
    const oneDay = 1000 * 60 * 60 * 24;

    // Calculating the time difference between two dates
    const diffInTime = date1.getTime() - date2.getTime();

    // Calculating the no. of days between two dates
    const diffInDays = Math.round(diffInTime / oneDay);

    return diffInDays;
  }

  function goalsOverTime(
    data: DashboardData,
    team: Team,
    numSeasons: number
  ): GoalsOverTime {
    const goals: GoalsOverTime = [];
    const startingDate = data.form[team][data._id - numSeasons][1].date;
    let dateOffset = 0;
    for (let i = numSeasons - 1; i >= 0; i--) {
      const teamGames = data.form[team][data._id - i];
      for (const matchday of Object.keys(teamGames)) {
        const match = teamGames[matchday];
        if (match.score != null) {
          let scored: number, conceded: number;
          if (match.atHome) {
            scored = match.score.homeGoals;
            conceded = match.score.awayGoals;
          } else {
            scored = match.score.awayGoals;
            conceded = match.score.homeGoals;
          }
          goals.push({
            date: match.date,
            // @ts-ignore
            days: numDays(match.date, startingDate) - dateOffset,
            matchday: matchday,
            scored: scored,
            conceded: conceded,
          });
        }
      }
      // If not current season...
      if (i > 0) {
        // To remove summer gap between seasons, increase dateOffset by number
        // of days between current season end and next season start
        const currentSeasonEndDate = data.form[team][data._id - i][38].date;
        const nextSeasonStartDate = data.form[team][data._id - i + 1][1].date;
        // @ts-ignore
        dateOffset += numDays(nextSeasonStartDate, currentSeasonEndDate);
        dateOffset -= 14; // Allow a 2 week gap between seasons for clarity
      }
    }
    return goals;
  }

  function lineData(
    data: DashboardData,
    team: Team
  ): [Date[], number[], number[], string[], number[], number[], number[]] {
    const numSeasons = 3;
    const goals = goalsOverTime(data, team, numSeasons);
    // Sort by game date
    goals.sort(function (a, b) {
      return a.days < b.days ? -1 : a.days === b.days ? 0 : 1;
    });

    // Separate out into lists
    const dates: Date[] = [];
    const days: number[] = [];
    const seasonBoundaries: number[] = [];
    const ticktext: string[] = [];
    const tickvals: number[] = [];
    const scored: number[] = [];
    const conceded: number[] = [];
    for (let i = 0; i < goals.length; i++) {
      dates.push(goals[i].date);
      days.push(goals[i].days);
      if (i % 38 === 37) {
        // Season boundary line a week after season finish
        seasonBoundaries.push(goals[i].days + 7);
        ticktext.push(((i % 38) + 1).toString());
        tickvals.push(goals[i].days);
      } else if (i % 38 === 0) {
        ticktext.push(((i % 38) + 1).toString());
        tickvals.push(goals[i].days);
      } else if (i % 38 === 19 || i === goals.length - 1) {
        const season = data._id - numSeasons + 1 + Math.floor(i / 38);
        // If in current season and matchday is 19, wait for until reach final
        // matchday in current season instead to place season ticktext label
        if (season != data._id || goals[i].matchday != '19') {
          const seasonTag = `${String(season).slice(2)}/${String(
            season + 1
          ).slice(2)}`;
          ticktext.push(seasonTag);
          tickvals.push(goals[i].days);
        }
      }
      scored.push(goals[i].scored);
      conceded.push(goals[i].conceded);
    }

    const nGames = 5;
    // Smooth goals with last nGames average
    for (let i = 0; i < dates.length; i++) {
      let j = i - 1;
      let count = 1;
      while (j > i - nGames && j >= 0) {
        scored[i] += scored[j];
        conceded[i] += conceded[j];
        count += 1;
        j -= 1;
      }
      if (count > 1) {
        scored[i] /= count;
        conceded[i] /= count;
      }
    }

    return [
      dates,
      days,
      seasonBoundaries,
      ticktext,
      tickvals,
      scored,
      conceded,
    ];
  }

  function lines(
    days: number[],
    scored: number[],
    conceded: number[],
    dates: Date[]
  ) {
    return [
      goalsScoredLine(days, scored, dates),
      goalsConcededLine(days, conceded, dates),
    ];
  }

  function defaultLayout(ticktext: string[], tickvals: number[], seasonLines) {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#fafafa',
      yaxis: {
        title: { text: 'Goals (5-game avg)' },
        gridcolor: 'gray',
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
      },
      xaxis: {
        linecolor: 'black',
        showgrid: false,
        showline: false,
        fixedrange: true,
        tickmode: 'array',
        tickvals: tickvals,
        ticktext: ticktext,
      },
      dragmode: false,
      shapes: [...seasonLines],
      legend: {
        x: 1,
        xanchor: 'right',
        y: 0.95,
      },
    };
  }

  function setDefaultLayout() {
    if (setup) {
      const layoutUpdate = {
        'yaxis.title': { text: 'Goals (5-game avg)' },
        'yaxis.visible': true,
        'margin.l': 60,
        'margin.t': 15,
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function setMobileLayout() {
    if (setup) {
      const layoutUpdate = {
        'yaxis.title': null,
        'yaxis.visible': false,
        'margin.l': 20,
        'margin.t': 5,
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function buildPlotData(data: DashboardData, team: Team): PlotData {
    const [
      dates,
      days,
      seasonBoundaries,
      ticktext,
      tickvals,
      scored,
      conceded,
    ] = lineData(data, team);
    const maxY = Math.max(Math.max(...scored), Math.max(...conceded));
    const seasonLines = seasonFinishLines(
      seasonBoundaries,
      days[days.length - 1],
      maxY
    );
    const plotData = {
      data: [...lines(days, scored, conceded, dates)],
      layout: defaultLayout(ticktext, tickvals, seasonLines),
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
    if (setup) {
      const newPlotData = buildPlotData(data, team);

      // Copy new values into exisitng plotData to be accessed during redraw
      plotData.data[0] = newPlotData.data[0]; // Copy goals scored line
      plotData.data[1] = newPlotData.data[1]; // Copy goals conceded line

      plotData.layout.shapes = newPlotData.layout.shapes;
      plotData.layout.xaxis.ticktext = newPlotData.layout.xaxis.ticktext;
      plotData.layout.xaxis.tickvals = newPlotData.layout.xaxis.tickvals;

      //@ts-ignore
      Plotly.redraw(plotDiv); // Update plot data
      if (mobileView) {
        setMobileLayout();
      }
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
