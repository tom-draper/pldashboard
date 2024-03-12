<script lang="ts">
	import type { DashboardData } from './dashboard.types';
	import Dashboard from './Dashboard.svelte';

	export let data: DashboardData;
</script>

<Dashboard {data} />
