<script lang="ts">
  import { onMount } from "svelte";
  function dateDiffInDays(date1: Date, date2: Date) {
    //@ts-ignore
    return Math.floor((date1 - date2) / (1000 * 60 * 60 * 24));
  }

  function seasonFinishLines(x: Date[], maxY: number): any {
    let lines: any[] = [];
    for (let i = 0; i < x.length-1; i++) {
      if (dateDiffInDays(new Date(x[i+1]), new Date(x[i])) > 60) {
          lines.push({
            type: "line",
            x0: x[i],
            y0: 0,
            x1: x[i],
            y1: maxY,
            line: {
              color: "black",
              dash: "dot",
              width: 1,
            },
          })
      }
    }
    return lines;
  }

  function goalsScoredLine(x: Date[],  y: any[]) {
    return {
      x: x,
      y: y,
      type: "scatter",
      fill: "tozeroy",
      mode: "lines",
      name: "Scored",
      line: {
        color: "#00fe87",
      },
      hovertemplate:
        "%{x|%d %b %Y}<br>Avg scored: <b>%{y:.1f}</b><extra></extra>",
    };
  }
  function goalsConcededLine(x: Date[], y: any[]) {
    return {
      x: x,
      y: y,
      type: "scatter",
      fill: "tozeroy",
      mode: "lines",
      name: "Conceded",
      line: {
        color: "#f83027",
      },
      hovertemplate:
        "%{x|%d %b %Y}<br>Avg conceded: <b>%{y:.1f}</b><extra></extra>",
    };
  }

  type GoalsOverTime = {
    date: Date,
    matchday: string;
    scored: number;
    conceded: number;
  }[];

  function goalsOverTime(
    data: TeamData,
    team: string,
    numSeasons: number
  ): GoalsOverTime {
    let goals: GoalsOverTime = [];
    for (let i = numSeasons - 1; i >= 0; i--) {
      let teamGames = data.form[team][data._id - i];
      for (let matchday of Object.keys(teamGames)) {
        let match = teamGames[matchday];
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
            date: new Date(match.date),
            matchday: matchday,
            scored: scored,
            conceded: conceded,
          });
        }
      }
    }
    return goals;
  }

  function lineData(data: TeamData, team: string): [Date[], number[], number[]] {
    let goals = goalsOverTime(data, team, 3);
    // Sort by game date
    goals.sort(function (a, b) {
      return a.date < b.date ? -1 : a.date == b.date ? 0 : 1;
    });

    // Separate out into lists
    let dates: Date[] = [];
    let scored: number[] = [];
    let conceded: number[] = [];
    for (let i = 0; i < goals.length; i++) {
      dates.push(goals[i].date);
      scored.push(goals[i].scored);
      conceded.push(goals[i].conceded);
    }

    let nGames = 5;
    // Smooth goals with last nGames average
    for (let i = 0; i < dates.length; i++) {
      let j = i-1;
      let count = 1;
      while (j > i-nGames && j >= 0) {
        scored[i] += scored[j]
        conceded[i] += conceded[j]
        count += 1
        j -= 1
      }
      if (count > 1) {
        scored[i] /= count
        conceded[i] /= count
      }
    }

    return [dates, scored, conceded]
  }

  function lines(dates: Date[], scored: number[], conceded: number[]): [any, any]{
    return [
      goalsScoredLine(dates, scored),
      goalsConcededLine(dates, conceded),
    ];
  }

  function defaultLayout(seasonLines: any[]): any {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
      hovermode: "closest",
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        title: { text: "Goals (5-game avg)" },
        gridcolor: "gray",
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
      },
      xaxis: {
        linecolor: "black",
        showgrid: false,
        showline: false,
        fixedrange: true,
        tickmode: "array",
      },
      dragmode: false,
      shapes: [
        ...seasonLines,
      ],
      legend: {
        x: 1,
        xanchor: "right",
        y: 0.95,
      },
    };
  }

  function setDefaultLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": { text: "Goals (5-game avg)" },
        "yaxis.visible": true,
        "margin.l": 60,
        "margin.t": 15,
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function setMobileLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": null,
        "yaxis.visible": false,
        "margin.l": 20,
        "margin.t": 5,
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function buildPlotData(data: TeamData, team: string): PlotData {
    let [dates, scored, conceded] = lineData(data, team);
    let maxY = Math.max(Math.max(...scored), Math.max(...conceded));
    let seasonLines = seasonFinishLines(dates, maxY);
    let plotData = {
      data: [...lines(dates, scored, conceded)],
      layout: defaultLayout(seasonLines),
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
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  }

  function refreshPlot() {
    if (setup) {
      let newPlotData = buildPlotData(data, team);

      // Copy new values into exisitng plotData to be accessed during redraw
      plotData.data[0] = newPlotData.data[0];  // Copy goals scored line
      plotData.data[1] = newPlotData.data[1];  // Copy goals conceded line

      plotData.layout.shapes = newPlotData.layout.shapes

      //@ts-ignore
      Plotly.redraw(plotDiv);  // Update plot data
      if (mobileView) {
        setMobileLayout();
      }
    }
  }

  $: team && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: TeamData, team: string, mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
