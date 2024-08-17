<script lang="ts">
	import type { FantasyDashboardData } from './fantasy.types';
	import FantasyDashboard from './FantasyDashboard.svelte';

	export let data: FantasyDashboardData;
</script>

<FantasyDashboard {data} />
