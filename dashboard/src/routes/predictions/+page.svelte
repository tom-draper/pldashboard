<script lang="ts">
	import Support from '$components/Support.svelte';
	import Predictions from './Predictions.svelte';
	import Seo from '$components/Seo.svelte';
	import type { PredictionsData } from './predictions.types';

	export let data: PredictionsData;
</script>

<Seo
	title="Dashboard - Predictions"
	description="Premier League match result predictions with scorelines and tracked accuracy across the season."
/>

<Support />
<Predictions {data} />
