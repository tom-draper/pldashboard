<script>
  import { onMount } from "svelte";

  function getMatchDetail(match) {
    let matchDetail;
    let homeAway = match.atHome ? "Home" : "Away";
    if (match.score != null) {
      matchDetail = `${match.team} (${homeAway}) ${match.score}`;
    } else {
      matchDetail = `${match.team} (${homeAway})`;
    }
    return matchDetail;
  }

  function sortByMatchDate(x, y, details) {
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

  function increaseNextGameMarker(sizes, x, now, bigMarkerSize) {
    // Get matchday date with smallest time difference to now
    let nextGameIdx;
    let minDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < x.length; i++) {
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

  function linePoints(data, team) {
    let x = [];
    let y = [];
    let details = [];
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

  function line(data, team, now) {
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
        // colorscale: [
        //   [0, "#01c626"],
        //   [0.1, "#08a825"],
        //   [0.2, "#0b7c20"],
        //   [0.3, "#0a661b"],
        //   [0.4, "#064411"],
        //   [0.5, "#000000"],
        //   [0.6, "#5b1d15"],
        //   [0.7, "#85160f"],
        //   [0.8, "#ad1a10"],
        //   [0.9, "#db1a0d"],
        //   [1, "#fc1303"],
        // ],
        colorscale: [
          [0, "#01c626"],
          [0.5, "#f3f3f3"],
          [1, "#fc1303"],
        ],
        color: y,
      },
      customdata: matchdays,
      hovertemplate:
        "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>",
    }
  }

  function nowLine(now, maxX) {
    let nowLine = [];
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

  function xRange(x) {
    let minX = new Date(x[0]);
    minX.setDate(minX.getDate() - 12);
    // let maxX = new Date(Math.max(x[x.length - 1], now));
    let maxX = new Date(x[x.length - 1]);
    maxX.setDate(maxX.getDate() + 12);
    return [minX, maxX];
  }

  function buildPlotData(data, team) {
    // Build data to create a fixtures line graph displaying the date along the
    // x-axis and opponent strength along the y-axis
    let now = Date.now();
    let l = line(data, team, now);

    let yLabels = Array.from(Array(11), (_, i) => i * 10);

    let [minX, maxX] = xRange(l.x);

    let plotData = {
      data: [l],
      layout: {
        title: false,
        autosize: true,
        margin: { r: 10, l: 0, t: 5, b: 40, pad: 5 },
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          // title: { text: "Difficulty" },
          gridcolor: "gray",
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
        shapes: [nowLine(now, maxX)],
        dragmode: false
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      }
    };
    return plotData;
  }

  function genPlot() {
    plotData = buildPlotData(data, team);
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    ).then(plot => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  }
  
  function refreshPlot() {
    if (setup) {
      let now = Date.now();
      let l = line(data, team, now);
      plotData.data[0] = l;  // Overwrite plot data
      Plotly.redraw(plotDiv)
    }
  }
  
  let plotDiv, plotData;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  $: team && refreshPlot()

  export let data, team;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>