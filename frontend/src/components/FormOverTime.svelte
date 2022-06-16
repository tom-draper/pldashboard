<script>
  import { onMount } from "svelte";

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
      teamKey = teamKey.replace(/ ([A-Z])/g, '-$1').toLowerCase();
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
      hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
      // hoverinfo: 'x+y',
      showlegend: false
    };
    return line;
  }

  function getMatchdayDates(data) {
    // Find median matchday date across all teams for each matchday
    let x = [];
    for (let i = 1; i <= 38; i++) {
      let matchdayDates = [];
      for (let team of data.teamNames) {
        matchdayDates.push(data.fixtures[team][i].date)
      } 
      matchdayDates = matchdayDates.map(val => {return new Date(val)})
      matchdayDates = matchdayDates.sort();
      x.push(matchdayDates[Math.floor(matchdayDates.length/2)]);
    }
    x.sort(function (a, b) {
      return a - b;
    })
    return x;
  }

  function getGraphData(data, fullTeamName) {
    let x = getMatchdayDates(data);  // All lines use the same x
    let lines = [];
    for (let i = 0; i < data.teamNames.length; i++) {
      if (data.teamNames[i] != fullTeamName) {
        let line = getLine(data, x, data.teamNames[i], false)
        lines.push(line)
      }
    }

    // Add this team last to ensure it overlaps all other lines
    let line = getLine(data, x, fullTeamName, true);
    lines.push(line);

    let yLabels = Array.from(Array(11), (_, i) => i*10)

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
