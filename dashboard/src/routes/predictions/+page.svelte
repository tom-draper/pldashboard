<script lang="ts">
	import Support from '$components/Support.svelte';
	import Predictions from './Predictions.svelte';
	import type { PredictionsData } from './predictions.types';

	export let data: PredictionsData;
</script>

<svelte:head>
	<title>Predictions</title>
	<meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Support />
<Predictions {data} />
