<script lang="ts">
  import { onMount } from "svelte";

  function isUnexpectedResult(data: TeamData, team: string, matchday: string): boolean {
    let match = data.form[team][data._id][matchday]
    if (match.score == null) {
      return false
    }

    let [h, _, a] = match.score.split(' ')
    h = parseInt(h);
    a = parseInt(a);
    
    let homeRating: number;
    let awayRating: number;
    if (match.atHome) {
      homeRating = data.teamRatings[team].totalRating;
      awayRating = data.teamRatings[match.team].totalRating;
    } else {
      homeRating = data.teamRatings[match.team].totalRating;
      awayRating = data.teamRatings[team].totalRating;
    }

    let winnerRating: number;
    let loserRating: number;
    if (h > a) {
      winnerRating = homeRating;
      loserRating = awayRating;
    } else if (h < a) {
      winnerRating = awayRating;
      loserRating = homeRating;
    } else {
      winnerRating = Math.max(homeRating, awayRating);
      loserRating = Math.min(homeRating, awayRating);
    }

    return winnerRating > loserRating * 2
  }

  function buildLine(
    data: TeamData,
    playedDates: Date[]
  ): any {
    let y = []
    let matchdays = Object.keys(data.form['Liverpool'][data._id])
    for (let matchday of matchdays) {
      let total = 0;
      let count = 0;
      for (let team in data.standings) {
        if (isUnexpectedResult(data, team, matchday)) {
          count++;
        }
        total++;
      }
      y.push(count / total);
    }

    let line = [{
      x: playedDates,
      y: y,
      name: 'Unexpected Results',
      mode: "lines",
      text: playedDates,
      hovertemplate: `Matchday %{x}<br>%{text|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
      showlegend: false,
    }];
    return line;
  }

  function getPlayedDates(data: TeamData) {
    let matchdays = Object.keys(data.form['Arsenal'][2022])

    let dates = [];
    for (let i = 0; i < matchdays.length; i++) {
      let matchdayDates = [];
      for (let team in data.standings) {
        matchdayDates.push(new Date(data.fixtures[team][matchdays[i]].date));
      }
      matchdayDates.sort();
      dates.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
    }
    dates.sort(function (a, b) {
      return a - b;
    });
    return dates
  }


  function defaultLayout() {
    // let yLabels = Array.from(Array(20), (_, i) => i + 1);
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
      hovermode: "closest",
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        title: { text: "Unexpected Results" },
        gridcolor: "gray",
        showgrid: false,
        showline: false,
        zeroline: false,
        // autorange: "reversed",
        fixedrange: true,
        // ticktext: yLabels,
        // tickvals: yLabels,
        visible: true,
      },
      xaxis: {
        title: { text: "Matchday" },
        linecolor: "black",
        showgrid: false,
        showline: false,
        fixedrange: true,
      },
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": { text: "Position" },
        "yaxis.visible": true,
        "yaxis.tickvals": Array.from(Array(20), (_, i) => i + 1),
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
        "yaxis.tickvals": Array.from(Array(10), (_, i) => i + 2),
        "margin.l": 20,
        "margin.t": 5,
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function buildPlotData(data: TeamData): PlotData {
    let matchdayDates = getPlayedDates(data);
    let plotData = {
      data: buildLine(data, matchdayDates),
      layout: defaultLayout(),
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    console.log(plotData);
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
    ).then((plot) => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  }

  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: TeamData,
    mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
