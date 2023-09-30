<script lang="ts">
  import { onMount } from "svelte";
  import { toAlias } from "../../lib/team";
  import { scoreline } from "../../lib/format";
  import type { DashboardData, Team } from "../../lib/dashboard.types";

  function matchDescription(team: Team, match: Match): string {
    let description: string;
    let homeTeam: string;
    let awayTeam: string;
    if (match.atHome) {
      homeTeam = toAlias(team);
      awayTeam = toAlias(match.team);
    } else {
      homeTeam = toAlias(match.team);
      awayTeam = toAlias(team);
    }
    if (match.score != null) {
      description = scoreline(
        homeTeam,
        awayTeam,
        match.score.homeGoals,
        match.score.awayGoals
      );
    } else {
      description = `${homeTeam} vs ${awayTeam}`;
    }
    return description;
  }

  function sortByMatchDate(x: Date[], y: number[], details: string[]) {
    let temp = [];
    for (let i = 0; i < x.length; i++) {
      temp.push({ x: x[i], y: y[i], details: details[i] });
    }

    // Sort by x-value (match date)
    temp.sort(function (a, b) {
      return a.x < b.x ? -1 : a.x == b.x ? 0 : 1;
    });

    // Unpack back into original arrays
    for (let i = 0; i < temp.length; i++) {
      x[i] = temp[i].x;
      y[i] = temp[i].y;
      details[i] = temp[i].details;
    }
  }

  function highlightNextGameMarker(
    sizes: number[],
    x: Date[],
    now: number,
    highlightSize: number
  ): number[] {
    // Get matchday date with smallest time difference to now
    let nextGameIdx: number;
    let minDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < x.length; i++) {
      //@ts-ignore
      let diff = x[i] - now;
      if (0 < diff && diff < minDiff) {
        minDiff = diff;
        nextGameIdx = i;
      }
    }

    // Increase marker size of next game
    if (nextGameIdx != undefined) {
      sizes[nextGameIdx] = highlightSize;
    }

    return sizes;
  }

  function linePoints(data: any, team: Team): [Date[], number[], string[]] {
    let x: Date[] = [];
    let y: number[] = [];
    let descriptions: string[] = [];
    for (let matchday = 1; matchday <= 38; matchday++) {
      let match = data.fixtures[team][matchday];
      x.push(new Date(match.date));

      let oppTeamRating = data.teamRatings[match.team].totalRating;
      if (match.atHome) {
        // If team playing at home, decrease opposition rating by the amount of home advantage the team gains
        oppTeamRating *= 1 - data.homeAdvantages[match.team].totalHomeAdvantage;
      }
      y.push(oppTeamRating * 100);

      let description = matchDescription(team, match);
      descriptions.push(description);
    }
    return [x, y, descriptions];
  }

  function line(data: DashboardData, team: Team, now: number): any {
    let [x, y, description] = linePoints(data, team);

    sortByMatchDate(x, y, description);

    let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);

    let sizes = Array(x.length).fill(13);
    sizes = highlightNextGameMarker(sizes, x, now, 26);

    return {
      x: x,
      y: y,
      type: "scatter",
      mode: "lines+markers",
      text: description,
      line: {
        color: "#737373",
      },
      marker: {
        size: sizes,
        colorscale: [
          [0, "#00fe87"],
          [0.5, "#f3f3f3"],
          [1, "#f83027"],
        ],
        color: y,
        opacity: 1,
        line: { width: 1 },
      },
      customdata: matchdays,
      hovertemplate:
        "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>",
    };
  }

  function currentDateLine(now: number, maxX: number): Object {
    let nowLine = null;
    if (now <= maxX) {
      // Vertical line shapw marking current day
      nowLine = {
        type: "line",
        x0: now,
        y0: -4,
        x1: now,
        y1: 104,
        line: {
          color: "black",
          dash: "dot",
          width: 1,
        },
      };
    }
    return nowLine;
  }

  function xRange(x: Date[]): [Date, Date] {
    let minX = new Date(x[0]);
    minX.setDate(minX.getDate() - 7);
    let maxX = new Date(x[x.length - 1]);
    maxX.setDate(maxX.getDate() + 7);
    return [minX, maxX];
  }

  function defaultLayout(x: Date[], now: number): Object {
    let yLabels = Array.from(Array(11), (_, i) => i * 10);

    let [minX, maxX] = xRange(x);
    // @ts-ignore
    let currentDate = currentDateLine(now, maxX);
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 60, t: 5, b: 40, pad: 5 },
      hovermode: "closest",
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        title: { text: "Team rating" },
        gridcolor: "#d6d6d6",
        showline: false,
        zeroline: false,
        fixedrange: true,
        ticktext: yLabels,
        tickvals: yLabels,
      },
      xaxis: {
        linecolor: "black",
        showgrid: false,
        showline: false,
        range: [minX, maxX],
        fixedrange: true,
      },
      shapes: [currentDate],
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": { text: "Team rating" },
        "margin.l": 60,
        "yaxis.color": "black",
      };

      let sizes = plotData.data[0].marker.size;
      for (let i = 0; i < sizes.length; i++) {
        sizes[i] = Math.round(sizes[i] * 1.7);
      }
      let dataUpdate = {
        marker: {
          size: sizes,
          colorscale: [
            [0, "#00fe87"],
            [0.5, "#f3f3f3"],
            [1, "#f83027"],
          ],
          color: plotData.data[0].y,
          opacity: 1,
          line: { width: 1 },
        },
      };
      plotData.data[0].marker.size = sizes;

      //@ts-ignore
      Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
    }
  }

  function setMobileLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": null,
        "margin.l": 20,
        "yaxis.color": "#fafafa",
      };

      let sizes = plotData.data[0].marker.size;
      for (let i = 0; i < sizes.length; i++) {
        sizes[i] = Math.round(sizes[i] / 1.7);
      }
      let dataUpdate = {
        marker: {
          size: sizes,
          colorscale: [
            [0, "#00fe87"],
            [0.5, "#f3f3f3"],
            [1, "#f83027"],
          ],
          color: plotData.data[0].y,
          opacity: 1,
          line: { width: 1 },
        },
      };
      plotData.data[0].marker.size = sizes;

      //@ts-ignore
      Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
    }
  }

  function buildPlotData(data: DashboardData, team: Team): PlotData {
    // Build data to create a fixtures line graph displaying the date along the
    // x-axis and opponent strength along the y-axis
    let now = Date.now();
    let l = line(data, team, now);

    let plotData = {
      data: [l],
      layout: defaultLayout(l.x, now),
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return plotData;
  }

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
      let l = line(data, team, Date.now());
      plotData.data[0] = l; // Overwrite plot data
      //@ts-ignore
      Plotly.redraw(plotDiv);
      if (mobileView) {
        setMobileLayout();
      }
    }
  }

  let plotDiv: HTMLDivElement, plotData: PlotData;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

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
