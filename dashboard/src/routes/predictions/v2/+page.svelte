<script lang="ts">
	import Predictions from "./Predictions.svelte";
	import type { PredictionsV2Data } from "./predictions-v2.types";

	export let data: PredictionsV2Data;
</script>

<svelte:head>
	<title>Predictions</title>
	<meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Predictions {data} />
