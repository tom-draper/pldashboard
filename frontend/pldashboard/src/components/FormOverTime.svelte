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

  function getLine(data, x, teamName, isMainTeam) {
    let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);

    let y = [];
    for (let i = 1; i <= 38; i++) {
      let form = data.form[teamName][i].formRating5;
      y.push(form * 100);
    }

    let lineVal;
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = teamName.replace(' FC', '');
      teamKey = teamKey[0].toLowerCase() + teamKey.slice(1);
      teamKey = teamKey.replace(/([A-Z])/, '-$1').toLowerCase();
      let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`)
      lineVal = {color: lineColor, width: 4}
    } else {
      lineVal = {color: '#d3d3d3'};
    }

    let line = {
      x: x,
      y: y,
      name: teamName,
      mode: 'lines',
      line: lineVal,
      text: matchdays,
      hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
      hoverinfo: 'x+y',
      showlegend: false
    };
    return line;
  }

  function getMatchdayDates(data) {
    // Find median matchday date across all teams for each matchday
    let x = [];
    for (let i = 1; i <= 38; i++) {
      let matchdayDates = [];
      data.teamNames.forEach(team => {
        matchdayDates.push(data.fixtures[team][i].date)
      })
      matchdayDates.map(val => {new Date(val)})
      matchdayDates = matchdayDates.sort();
      x.push(matchdayDates[Math.floor(matchdayDates.length/2)]);
    }
    return x;
  }

  function getGraphData(data, fullTeamName) {
    // Build data to create a fixtures line graph displaying the date along the
    // x-axis and opponent strength along the y-axis

    let x = getMatchdayDates(data);  // All lines use the same x
    let lines = [];
    for (let i = 0; i < data.teamNames.length; i++) {
      if (data.teamNames[i] != fullTeamName) {
        let line = getLine(data, x, data.teamNames[i], false)
        lines.push(line)
      }
    }

    // Add this team last
    let line = getLine(data, x, fullTeamName, true)
    lines.push(line);

    console.log(lines);

    let yLabels = Array.from(Array(11), (_, i) => i*10)

    // sortByMatchDate(x, y, details);

    // let now = Date.now();

    // let sizes = Array(x.length).fill(14);
    // sizes = increaseNextGameMarker(sizes, x, now, 26);

    let graphData = {
      data: lines,
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 50, t: 0, b: 40, pad: 5 },
        hovermode: "closest",
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Form Rating" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
          ticktext: yLabels,
          tickvals: yLabels
        },
        xaxis: {
          // title: { text: "Matchday" },
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
        },        
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return graphData;
  }

  let plotDiv;
  let graphData;
  onMount(() => {
    graphData = getGraphData(data, fullTeamName);
    let Plot = new Plotly.newPlot(
      plotDiv,
      graphData.data,
      graphData.layout,
      graphData.config
    );
  });

  export let data, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
