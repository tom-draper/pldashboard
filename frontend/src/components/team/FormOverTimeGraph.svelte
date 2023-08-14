<script lang="ts">
  import { onMount } from "svelte";
  import { toHyphenatedName } from "../../lib/team";

  function getFormLine(data: any, team: string, isMainTeam: boolean): any {
    let playedDates = [];
    let matchdays = [];
    for (let matchday in data.form[team][data._id]) {
      if (data.form[team][data._id][matchday].score != null) {
        matchdays.push(matchday);
        playedDates.push(new Date(data.form[team][data._id][matchday].date));
      }
    }

    let y = [];
    for (let matchday of matchdays) {
      let form = data.form[team][data._id][matchday].formRating5;
      y.push(form * 100);
    }

    let lineVal: { color: string; width?: number };
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = toHyphenatedName(team);
      let lineColor = getComputedStyle(
        document.documentElement
      ).getPropertyValue(`--${teamKey}`);
      lineVal = { color: lineColor, width: 4 };
    } else {
      lineVal = { color: "#d3d3d3" };
    }

    let line = {
      x: matchdays,
      y: y,
      name: team,
      mode: "lines",
      line: lineVal,
      text: playedDates,
      hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
      showlegend: false,
    };
    return line;
  }

  function lines(data: any, team: string): any[] {
    let lines = [];

    let teams = Object.keys(data.standings);
    for (let i = 0; i < teams.length; i++) {
      if (teams[i] != team) {
        let line = getFormLine(data, teams[i], false);
        lines.push(line);
      }
    }

    // Add this team last to ensure it overlaps all other lines
    let line = getFormLine(data, team, true);
    lines.push(line);
    return lines;
  }

  function defaultLayout() {
    let yLabels = Array.from(Array(11), (_, i) => i * 10);
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
      hovermode: "closest",
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        title: { text: "Form rating" },
        gridcolor: "gray",
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
        ticktext: yLabels,
        tickvals: yLabels,
        range: [-1, 101],
      },
      xaxis: {
        title: { text: "Matchday" },
        linecolor: "black",
        showgrid: false,
        showline: false,
        fixedrange: true,
        range: [playedDates[0], playedDates[playedDates.length - 1]],
      },
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": { text: "Form rating" },
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

  function buildPlotData(data: any, team: string): PlotData {
    let plotData = {
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
      plot.children[0].children[0].classList.add("resizable-graph");
    });
    setTimeout(() => {
      // Render the bottom half of the page now the visible parts have been rendered
      lazyLoad = true;
      window.dispatchEvent(new Event("resize"));  // Snap plots to currently set size
    }, 50);
  }

  function refreshPlot() {
    if (setup) {
      let newPlotData = buildPlotData(data, team);
      for (let i = 0; i < 20; i++) {
        plotData.data[i] = newPlotData.data[i];
      }

      plotData.layout.xaxis.range[0] = playedDates[0];
      plotData.layout.xaxis.range[1] = playedDates[playedDates.length - 1];

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

  export let data: any,
    team: string,
    playedDates: Date[],
    lazyLoad: boolean,
    mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
