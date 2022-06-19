<script>
  import { onMount } from "svelte";

  function getGraphData(data, team) {

    let teamKey = team.replace(' FC', '');
    teamKey = teamKey[0].toLowerCase() + teamKey.slice(1);
    teamKey = teamKey.replace(/ ([A-Z])/g, '-$1').toLowerCase();
    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`)

    let graphData = {
      data: [
        {
          type: "scatterpolar",
          r: [20, 20, 10, 10, 20],
          theta: ["Attack", "Scored", "Goal Difference", "Defence", "Clean Sheets"],
          fill: "toself",
          marker: {color: '#d3d3d3' },
          lineclose:true,
          opacity: 1,
        },
        {
          type: "scatterpolar",
          r: [39, 28, 8, 7, 28],
          theta: ["Attack", "Scored", "Goal Difference", "Defence", "Clean Sheets"],
          fill: "toself",
          marker: {color: teamColor},
          // opacity: 0.4,
        },
      ],
      layout: {
        height: 550,
        polar: {
          radialaxis: {
            visible: true,
            range: [0, 100],
          },
        },
        hover: 'closest',
        margin: {t: 20, b: 20, l: 100, r: 100},
        showlegend: false,
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
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
    Plot.then(plot => {
      plot.children[0].children[0].classList.add('resizable-spider-chart')
    })
  });

  export let data, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
