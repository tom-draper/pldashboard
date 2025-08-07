<script lang="ts">
	import type { DashboardData } from './[team]/dashboard.types';
	import Dashboard from './[team]/Dashboard.svelte';
	import { replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import Support from '$components/Support.svelte';

	export let data: DashboardData;

	onMount(() => {
		// Replace url with team at top of the table
		if (browser) {
			// Use setTimeout to ensure router is ready, or better yet, use goto
			setTimeout(async () => {
				try {
					replaceState(data.team.id, {});
				} catch (error) {
					console.warn('SvelteKit navigation failed, using native browser API:', error);
					// Fallback to native browser navigation
					window.history.replaceState({}, '', `/${data.team.id}`);
				}
			}, 0);
		}
	});
</script>

<Support />
<Dashboard {data} />