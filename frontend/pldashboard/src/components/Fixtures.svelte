<script>
  import { onMount } from "svelte";
  export let graphData;

  // console.log(graphData);

  // graphData.type = "scatter";
  // graphData.mode = "lines+markers";
  // graphData.line = { color: "#737373" };
  // graphData.text = graphData.details;
  // graphData.marker = {
  //   size: graphData.sizes,
  //   colorscale: [
  //     [0, "#01c626"],
  //     [0.1, "#08a825"],
  //     [0.2, "#0b7c20"],
  //     [0.3, "#0a661b"],
  //     [0.4, "#064411"],
  //     [0.5, "#000000"],
  //     [0.6, "#5b1d15"],
  //     [0.7, "#85160f"],
  //     [0.8, "#ad1a10"],
  //     [0.9, "#db1a0d"],
  //     [1, "#fc1303"],
  //   ],
  //   color: graphData.y,
  // };
  // graphData.hovertemplate =
  //   "<b>%{text}</b><br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>";
  // graphData.hoveron = "points";
  // graphData.xhoverformat = "";

  let plotDiv;
  onMount(() => {
    let Plot = new Plotly.newPlot(
      plotDiv,
      [graphData.data],
      graphData.layout,
      graphData.config
    );
    // window.addEventListener("resize", () => {Plotly.Plots.resize(Plot)});
  });
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
