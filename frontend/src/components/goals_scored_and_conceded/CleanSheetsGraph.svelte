<script lang="ts">
  import { onMount } from "svelte";

  function getTeamCleanSheets(
    data: TeamData,
    team: string
  ): [number[], number[]] {
    let notCleanSheets = [];
    let cleanSheets = [];
    for (let matchday of Object.keys(data.form[team][data._id])) {
      let score = data.form[team][data._id][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        h = parseInt(h);
        a = parseInt(a);
        if (data.form[team][data._id][matchday].atHome) {
          if (a > 0) {
            notCleanSheets.push(1);
            cleanSheets.push(0);
          } else {
            cleanSheets.push(1);
            notCleanSheets.push(0);
          }
        } else {
          if (h > 0) {
            notCleanSheets.push(1);
            cleanSheets.push(0);
          } else {
            cleanSheets.push(1);
            notCleanSheets.push(0);
          }
        }
      }
    }

    return [cleanSheets, notCleanSheets];
  }

  function bars(
    data: TeamData,
    team: string,
    playedMatchdays: string[]
  ): [Object, Object] {
    let matchdays = Object.keys(data.form[team][data._id]);
    
    let [cleanSheets, notCleanSheets] = getTeamCleanSheets(data, team);
    return [
      {
        name: "Clean sheets",
        type: "bar",
        x: playedMatchdays,
        y: cleanSheets,
        text: matchdays,
        marker: { color: "#00fe87" },
        hovertemplate: "<b>Clean sheet<extra></extra>",
        showlegend: false,
      },
      {
        name: "Conceded",
        type: "bar",
        x: playedMatchdays,
        y: notCleanSheets,
        text: matchdays,
        marker: { color: "#f83027" },
        hovertemplate: "<b>Goals conceded<extra></extra>",
        showlegend: false,
      },
    ];
  }

  function baseLine(): Object {
    return {
      type: "line",
      x0: playedMatchdays[0],
      y0: 0.5,
      x1: playedMatchdays[playedMatchdays.length - 1],
      y1: 0.5,
      layer: "below",
      line: {
        color: "#d3d3d3",
        width: 2,
      },
    };
  }

  function defaultLayout(): Object {
    return {
      title: false,
      autosize: true,
      height: 60,
      margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
      barmode: "stack",
      hovermode: "closest",
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        showticklabels: false,
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
      },
      shapes: [baseLine()],
      dragmode: false,
      showlegend: false,
    };
  }

  function setDefaultLayout() {
    if (setup) {
      let layoutUpdate = {
        "margin.l": 60,
      };
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function setMobileLayout() {
    if (setup) {
      let layoutUpdate = {
        "margin.l": 20,
      };
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }
  
  function hiddenLine(x) {
    return {
      name: "Avg",
      type: "line",
        x: x,
        y: Array(x.length).fill(1.1),
        line: { color: "#FAFAFA", width: 1 },
        marker: {
          size: 1
        }
    }
  }

  function buildPlotData(data: TeamData, team: string): PlotData {
    let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);
    // Line required on plot to make match goalsScoredAndConcededGraph
    // TODO: Improve solution
    let line = hiddenLine(cleanSheetsBar.x);
    let plotData = {
      data: [cleanSheetsBar, concededBar, line],
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
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    );
  }

  function refreshPlot() {
    if (setup) {
      let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);
      plotData.data[0] = cleanSheetsBar;
      plotData.data[1] = concededBar;
      Plotly.redraw(plotDiv);
      if (mobileView) {
        setMobileLayout();
      }
    }
  }

  $: team && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: TeamData,
    team: string,
    playedMatchdays: string[],
    mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
