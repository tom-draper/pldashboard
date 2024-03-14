<script lang="ts">
	import Predictions from './Predictions.svelte';

	export let data;
</script>

<svelte:head>
	<title>Predictions</title>
	<meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Predictions {data} />
