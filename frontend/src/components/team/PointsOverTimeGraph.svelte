<script lang="ts">
  import { onMount } from "svelte";

  function getLineConfig(team: string, isMainTeam: boolean): any {
    let lineConfig: any;
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = team[0].toLowerCase() + team.slice(1);
      teamKey = teamKey.replace(/ /g, "-").toLowerCase();
      let lineColor = getComputedStyle(
        document.documentElement
      ).getPropertyValue(`--${teamKey}`);
      lineConfig = { color: lineColor, width: 4 };
    } else {
      lineConfig = { color: "#d3d3d3" };
    }
    return lineConfig;
  }

  function getLineY(
    data: TeamData,
    team: string,
    matchdays: string[]
  ): number[] {
    let y = [];
    for (let matchday of matchdays) {
      let points = data.form[team][data._id][matchday].cumPoints;
      y.push(points);
    }
    return y;
  }

  function getLine(
    data: TeamData,
    playedDates: Date[],
    team: string,
    isMainTeam: boolean
  ): any {
    let matchdays = Object.keys(data.form[team][data._id]);
    let y = getLineY(data, team, matchdays);
    let lineConfig = getLineConfig(team, isMainTeam);

    let line = {
      x: matchdays,
      y: y,
      name: team,
      mode: "lines",
      line: lineConfig,
      text: playedDates,
      hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
      showlegend: false,
    };
    return line;
  }

  function lines(
    data: TeamData,
    team: string,
    playedDates: Date[]
  ): any[] {
    let lines = [];
    let teams = Object.keys(data.standings);
    for (let i = 0; i < teams.length; i++) {
      if (teams[i] != team) {
        let line = getLine(data, playedDates, teams[i], false);
        lines.push(line);
      }
    }

    // Add this team last to ensure it overlaps all other lines
    let line = getLine(data, playedDates, team, true);
    lines.push(line);
    return lines;
  }

  function defaultLayout() {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
      hovermode: "closest",
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        title: { text: "Points" },
        gridcolor: "gray",
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
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

  function buildPlotData(data: TeamData, team: string): PlotData {
    let plotData = {
      data: lines(data, team, playedDates),
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
      let newPlotData = buildPlotData(data, team);
      for (let i = 0; i < 20; i++) {
        plotData.data[i] = newPlotData.data[i];
      }

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

  export let data: TeamData,
    team: string,
    playedDates: Date[],
    mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
