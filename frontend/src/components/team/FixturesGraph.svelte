<script lang="ts">
  import { onMount } from "svelte";

  function getMatchDetail(match: Match): string {
    let matchDetail: string;
    let homeAway = match.atHome ? "Home" : "Away";
    if (match.score != null) {
      matchDetail = `${match.team} (${homeAway}) ${match.score.homeGoals} - ${match.score.awayGoals}`;
    } else {
      matchDetail = `${match.team} (${homeAway})`;
    }
    return matchDetail;
  }

  function sortByMatchDate(x: Date[], y: number[], details: string[]) {
    let list = [];
    for (let i = 0; i < x.length; i++) {
      list.push({ x: x[i], y: y[i], details: details[i] });
    }

    list.sort(function (a, b) {
      return a.x < b.x ? -1 : a.x == b.x ? 0 : 1;
    });

    for (let i = 0; i < list.length; i++) {
      x[i] = list[i].x;
      y[i] = list[i].y;
      details[i] = list[i].details;
    }
  }

  function increaseNextGameMarker(
    sizes: number[],
    x: Date[],
    now: number,
    bigMarkerSize: number
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
      sizes[nextGameIdx] = bigMarkerSize;
    }

    return sizes;
  }

  function linePoints(
    data: TeamData,
    team: string
  ): [Date[], number[], string[]] {
    let x: Date[] = [];
    let y: number[] = [];
    let details: string[] = [];
    for (let matchday = 1; matchday <= 38; matchday++) {
      let match = data.fixtures[team][matchday];
      x.push(new Date(match.date));

      let oppTeamRating = data.teamRatings[match.team].totalRating;
      if (match.atHome) {
        // If team playing at home, decrease opposition rating by the amount of home advantage the team gains
        oppTeamRating *= 1 - data.homeAdvantages[match.team].totalHomeAdvantage;
      }
      y.push(oppTeamRating * 100);

      let matchDetail = getMatchDetail(match);
      details.push(matchDetail);
    }
    return [x, y, details];
  }

  function line(data: TeamData, team: string, now: number): any {
    let [x, y, details] = linePoints(data, team);

    sortByMatchDate(x, y, details);

    let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);

    let sizes = Array(x.length).fill(13);
    sizes = increaseNextGameMarker(sizes, x, now, 26);

    return {
      x: x,
      y: y,
      type: "scatter",
      mode: "lines+markers",
      text: details,
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

  function nowLine(now: number, maxX: number): Object {
    let nowLine = {};
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
      //@ts-ignore
      shapes: [nowLine(now, maxX)],
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

  function buildPlotData(data: TeamData, team: string): PlotData {
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

  export let data: TeamData, team: string, mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
