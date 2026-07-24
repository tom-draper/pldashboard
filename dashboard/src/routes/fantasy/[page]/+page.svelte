<script lang="ts">
	import type { FantasyDashboardData } from '../fantasy.types';
	import FantasyDashboard from '../FantasyDashboard.svelte';

	const { data }: { data: FantasyDashboardData } = $props();
</script>

<FantasyDashboard {data} />
