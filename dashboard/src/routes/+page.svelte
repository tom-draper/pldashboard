<script lang="ts">
	import type { DashboardData } from './[team]/dashboard.types';
	import Dashboard from './[team]/Dashboard.svelte';
	import { replaceState } from '$app/navigation';
	import { onMount } from 'svelte';

	export let data: DashboardData;

	onMount(() => {
		// Replace url with team at top of the table
		replaceState(data.team.id, {});
	});
</script>

<Dashboard {data} />
