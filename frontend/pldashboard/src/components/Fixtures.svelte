<script>
  import { onMount } from "svelte";
  export let graphData;

  let plotDiv;
  onMount(() => {
    let Plot = new Plotly.newPlot(
      plotDiv,
      [graphData.data],
      graphData.layout,
      graphData.config
    );
  });
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
