<script lang="ts">
	import type { FantasyDashboardData } from '../fantasy.types';
	import FantasyDashboard from '../FantasyDashboard.svelte';

	let { data }: { data: FantasyDashboardData } = $props();
</script>

<FantasyDashboard {data} />
