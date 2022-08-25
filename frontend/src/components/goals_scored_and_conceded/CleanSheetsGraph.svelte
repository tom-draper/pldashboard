<script lang="ts">
  import { onMount } from "svelte";

  function getTeamCleanSheets(data, team) {
    let notCleanSheets = [];
    let cleanSheets = [];
    for (let matchday of Object.keys(data.form[data._id][team])) {
      let score = data.form[data._id][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        h = parseInt(h);
        a = parseInt(a);
        if (data.form[data._id][team][matchday].atHome) {
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

  function bars(data, team, playedMatchdays) {
    let matchdays = Object.keys(data.form[data._id][team]);

    let [cleanSheets, notCleanSheets] = getTeamCleanSheets(data, team);
    return [
      {
        name: "Clean sheets",
        type: "bar",
        x: playedMatchdays,
        y: cleanSheets,
        text: matchdays,
        marker: { color: "#77DD77" },
        hovertemplate: "<b>Clean sheet<extra></extra>",
        showlegend: false,
      },
      {
        name: "Conceded",
        type: "bar",
        x: playedMatchdays,
        y: notCleanSheets,
        text: matchdays,
        marker: { color: "C23B22" },
        hovertemplate: "<b>Goals conceded<extra></extra>",
        showlegend: false,
      }
    ];
  }

  function defaultLayout() {
    if (setup) {
      let update = {
          yaxis: {
            title: null,
            gridcolor: "gray",
            showgrid: false,
            showline: false,
            zeroline: false,
            fixedrange: true,
            rangemode: "nonnegative",
          },
          margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
      }
      Plotly.update(plotDiv, {}, update)
    }
  }

  function mobileLayout() {
    if (setup) {
      let update = {
          yaxis: {
            title: null,
            gridcolor: "gray",
            showgrid: false,
            showline: false,
            zeroline: false,
            fixedrange: true,
            visible: false,
            rangemode: "nonnegative",
          },
          margin: { r: 20, l: 20, t: 0, b: 40, pad: 5 },
      }
      Plotly.update(plotDiv, {}, update)
    }
  }

  function buildPlotData(data, team) {
    let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);

    let plotData = {
      data: [cleanSheetsBar, concededBar],
      layout: {
        title: false,
        autosize: true,
        height: 60,
        margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
        barmode: "stack",
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: null,
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
        shapes: [
          {
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
          },
        ],
        dragmode: false
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return plotData;
  }

  let plotDiv, plotData;
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
        mobileLayout();
      }
    }
  }

  $: team && refreshPlot();
  $: !mobileView && defaultLayout();
  $: setup && mobileView && mobileLayout();

  export let data, team, playedMatchdays, mobileView;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
