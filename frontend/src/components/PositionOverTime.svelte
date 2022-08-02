<script>
  import { onMount } from "svelte";

  function getLine(data, x, teamName, isMainTeam) {
    let matchdays = Object.keys(data.form[data.currentSeason][teamName]) 
    
    let y = [];
    for (let matchday of matchdays) {
      let position = data.form[data.currentSeason][teamName][matchday].position;
      y.push(position);
    }

    let lineVal;
    if (isMainTeam) {
      // Get team primary colour from css variable
      let teamKey = teamName[0].toLowerCase() + teamName.slice(1);
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
      hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
      showlegend: false
    };
    return line;
  }
  
  function getMatchdayDates(data, teamName) {
    let matchdays = Object.keys(data.form[data.currentSeason][teamName]) 

    // If played one or no games, take x-axis from whole season dates
    if (matchdays.length <= 1) {
      matchdays = Object.keys(data.fixtures[teamName])
    }
    
    // Find median matchday date across all teams for each matchday
    let x = [];
    for (let matchday of matchdays) {
      let matchdayDates = [];
      data.teamNames.forEach(team => {
        matchdayDates.push(data.fixtures[team][matchday].date)
      })
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
    let x = getMatchdayDates(data, fullTeamName);  // All lines use the same x
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

    let yLabels = Array.from(Array(20), (_, i) => i+1);

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
          autorange: 'reversed',
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
        shapes: [
          {
            type: "rect",
            x0: x[0],
            y0: 4.5,
            x1: x[x.length-1],
            y1: 0.5,
            line: {
              width: 0,
            },
            fillcolor: '#77DD77',
            opacity: 0.3,
            layer: 'below'
          },
          {
            type: "rect",
            x0: x[0],
            y0: 6.5,
            x1: x[x.length-1],
            y1: 4.5,
            line: {
              width: 0,
            },
            fillcolor: '#4CDEEE',
            opacity: 0.3,
            layer: 'below'
          },
          {
            type: "rect",
            x0: x[0],
            y0: 20.5,
            x1: x[x.length-1],
            y1: 17.5,
            line: {
              width: 0,
            },
            fillcolor: '#C23B22',
            opacity: 0.3,
            layer: 'below'
          },
        ],
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
    Plot.then(plot => {
      plot.children[0].children[0].classList.add('resizable-graph');
    }) 
  });

  export let data, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
