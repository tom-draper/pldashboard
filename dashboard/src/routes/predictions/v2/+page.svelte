<script lang="ts">
	import Predictions from './Predictions.svelte';
	import Seo from '$components/Seo.svelte';
	import type { PredictionsV2Data } from './predictions-v2.types';

	export let data: PredictionsV2Data;
</script>

<Seo
	title="Live Premier League Predictions | pldashboard"
	description="Real-time Premier League match predictions from an intelligent model, with live win probabilities and kick-off countdowns."
/>

<Predictions {data} />
