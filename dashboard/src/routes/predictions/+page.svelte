<script lang="ts">
	import Predictions from './Predictions.svelte';
	import type { PredictionsData } from './predictions.types';

	export let data: PredictionsData;
</script>

<svelte:head>
	<title>Predictions</title>
	<meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Predictions {data} />
