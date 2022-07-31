<script>
  import { onMount } from "svelte";

  function getFormLine(data, x, teamName, isMainTeam) {
    let matchdays = Object.keys(data.form[teamName]);  // Played matchdays
    
    let y = [];
    for (let matchday of matchdays) {
      let form = data.form[teamName][matchday].formRating5;
      y.push(form * 100);
    }

    let lineVal;
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = teamName[0].toLowerCase() + teamName.slice(1);
      teamKey = teamKey.replace(/ ([A-Z])/g, "-$1").toLowerCase();
      let lineColor = getComputedStyle(
        document.documentElement
      ).getPropertyValue(`--${teamKey}`);
      lineVal = { color: lineColor, width: 4 };
    } else {
      lineVal = { color: "#d3d3d3" };
    }

    let line = {
      x: x,
      y: y,
      name: teamName,
      mode: "lines",
      line: lineVal,
      text: matchdays,
      hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
      showlegend: false,
    };
    return line;
  }
  
  function getMatchdayDates(data, teamName) {
    let matchdays = Object.keys(data.form[teamName]);  // Played matchdasy

    // If played one or no games, take x-axis from whole season dates
    if (matchdays.length <= 1) {
      matchdays = Object.keys(data.fixtures[teamName])
    }

    let x = [];
    // Find median matchday date across all teams for each matchday
    for (let matchday of matchdays) {
      let matchdayDates = [];
      for (let team of data.teamNames) {
        matchdayDates.push(data.fixtures[team][matchday].date);
      }
      matchdayDates = matchdayDates.map((val) => {
        return new Date(val);
      });
      matchdayDates = matchdayDates.sort();
      x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
    }
    x.sort(function (a, b) {
      return a - b;
    });
    return x;
  }

  function getGraphData(data, fullTeamName) {
    let x = getMatchdayDates(data, fullTeamName); // All lines use the same x
    let lines = [];
    for (let i = 0; i < data.teamNames.length; i++) {
      if (data.teamNames[i] != fullTeamName) {
        let line = getFormLine(data, x, data.teamNames[i], false);
        lines.push(line);
      }
    }

    // Add this team last to ensure it overlaps all other lines
    let line = getFormLine(data, x, fullTeamName, true);
    lines.push(line);

    let yLabels = Array.from(Array(11), (_, i) => i * 10);

    let graphData = {
      data: lines,
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 50, t: 15, b: 40, pad: 5 },
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
          tickvals: yLabels,
          range: [0, 100]
        },
        xaxis: {
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
    // Once plot generated, add resizable attribute to it to shorten height for mobile view
    Plot.then((plot) => {
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  });

  export let data, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
