<script lang="ts">
  import { onMount } from "svelte";

  function getAvgGoalsPerGame(data: any): Counter {
    let avgGoals: Counter = {};

    for (let team of Object.keys(data.standings)) {
      for (let matchday of Object.keys(data.form[team][data._id])) {
        let score = data.form[team][data._id][matchday].score;
        if (score != null) {
          if (matchday in avgGoals) {
            avgGoals[matchday] += score.homeGoals + score.awayGoals;
          } else {
            avgGoals[matchday] = score.homeGoals + score.awayGoals;
          }
        }
      }
    }

    // Divide by number of teams to get avg goals per matchday
    for (let matchday of Object.keys(avgGoals)) {
      avgGoals[matchday] /= 20;
    }

    return avgGoals;
  }

  function getTeamGoalsPerGame(data: any, team: string): [Counter, Counter] {
    let scored: Counter = {};
    let conceded: Counter = {};
    for (let matchday of Object.keys(data.form[team][data._id])) {
      let score = data.form[team][data._id][matchday].score;
      if (score != null) {
        if (data.form[team][data._id][matchday].atHome) {
          scored[matchday] = score.homeGoals;
          conceded[matchday] = score.awayGoals;
        } else {
          scored[matchday] = score.awayGoals;
          conceded[matchday] = score.homeGoals;
        }
      }
    }

    return [scored, conceded];
  }

  function avgLine(
    playedDates: Date[],
    avgGoals: Counter,
    matchdays: string[]
  ): any {
    return {
      name: "Avg",
      type: "line",
      x: playedDates,
      y: Object.values(avgGoals),
      text: matchdays,
      line: { color: "#0080FF", width: 2 },
      hovertemplate: "<b>Matchday %{text}</b><br>%{y:.1f} goals<extra></extra>",
    };
  }

  function teamScoredBar(
    playedDates: Date[],
    teamScored: Counter,
    matchdays: string[]
  ): any {
    return {
      name: "Scored",
      type: "bar",
      x: playedDates,
      y: Object.values(teamScored),
      text: matchdays,
      marker: { color: "#00fe87" },
      hovertemplate:
        "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>",
    };
  }

  function teamConcededBar(
    playedDates: Date[],
    teamConceded: Counter,
    matchdays: string[]
  ): any {
    return {
      name: "Conceded",
      type: "bar",
      x: playedDates,
      y: Object.values(teamConceded),
      text: matchdays,
      marker: { color: "#f83027" },
      hovertemplate:
        "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>",
    };
  }

  function defaultLayout(): any {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 15, b: 15, pad: 5 },
      barmode: "stack",
      hovermode: "closest",
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        title: { text: "Goals" },
        gridcolor: "gray",
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
        rangemode: "nonnegative",
        visible: true,
        tickformat: "d",
      },
      xaxis: {
        linecolor: "black",
        showgrid: false,
        showline: false,
        fixedrange: true,
        showticklabels: false,
      },
      legend: {
        x: 1,
        xanchor: "right",
        y: 1,
      },
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": { text: "Goals" },
        "yaxis.visible": true,
        "margin.l": 60,
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
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function buildPlotData(data: any, team: string): PlotData {
    let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
    let avgGoals = getAvgGoalsPerGame(data);
    let matchdays = Object.keys(avgGoals);

    let scoredBar = teamScoredBar(playedDates, teamScored, matchdays);
    let concededBar = teamConcededBar(playedDates, teamConceded, matchdays);
    let line = avgLine(playedDates, avgGoals, matchdays);

    let plotData = {
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
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  }

  function refreshPlot() {
    if (setup) {
      let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
      let avgGoals = getAvgGoalsPerGame(data);
      let matchdays = Object.keys(avgGoals);

      let scoredBar = teamScoredBar(playedDates, teamScored, matchdays);
      let concededBar = teamConcededBar(playedDates, teamConceded, matchdays);
      let line = avgLine(playedDates, avgGoals, matchdays);

      plotData.data[0] = scoredBar;
      plotData.data[1] = concededBar;
      plotData.data[2] = line;

      //@ts-ignore
      Plotly.redraw(plotDiv);
      if (mobileView) {
        setMobileLayout();
      }
    }
  }

  $: team && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: any, team: string, playedDates: Date[], mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
