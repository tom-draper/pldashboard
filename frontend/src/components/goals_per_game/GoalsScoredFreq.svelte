<script>
  import { onMount } from "svelte";

  function getGraphData() {
    let xLabels = Object.keys(goalFreq);

    let graphData = {
      data: [
        {
          x: Object.keys(goalFreq),
          y: Object.values(goalFreq),
          type: "bar",
          name: "Avg",
          marker: { color: "#C6C6C6" },
          line: { width: 0 },
          hovertemplate: "%{x} goals in %{y} games<extra></extra>",
          hoverinfo: "x+y",
        },
        {
          x: Object.keys(teamScoredFreq),
          y: Object.values(teamScoredFreq),
          type: "bar",
          name: "Goals scored",
          marker: { color: "#77DD77" },
          line: { width: 0 },
          hovertemplate: "%{x} goals in %{y} games<extra></extra>",
          hoverinfo: "x+y",
          opacity: 0.6,
        },
      ],
      layout: {
        title: false,
        autosize: true,
        margin: { r: 0, l: 50, t: 0, b: 40, pad: 5 },
        hovermode: "closest",
        barmode: "overlay",
        bargap: 0,
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Frequency" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
          rangemode: 'nonnegative'
        },
        xaxis: {
          title: { text: "Goals Scored" },
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
          ticktext: xLabels,
          tickvals: xLabels,
        },
        legend: {
          x: 1,
          xanchor: "right",
          y: 0.95,
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

  let plotDiv, graphData;
  onMount(() => {
    graphData = getGraphData();
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

  export let goalFreq, teamScoredFreq;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
