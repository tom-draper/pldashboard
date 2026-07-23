<script lang="ts">
	import Support from '$components/Support.svelte';
	import type { FantasyDashboardData } from './fantasy.types';
	import FantasyDashboard from './FantasyDashboard.svelte';

	let { data }: { data: FantasyDashboardData } = $props();
</script>

<svelte:head>
	<meta name="theme-color" content="#000" />
</svelte:head>

<Support />
<FantasyDashboard {data} />
