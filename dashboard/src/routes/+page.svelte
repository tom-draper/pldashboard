<script lang="ts">
	import type { DashboardData } from './[team]/dashboard.types';
	import Dashboard from './[team]/Dashboard.svelte';

	export let data: DashboardData;
</script>

<Dashboard {data} />
