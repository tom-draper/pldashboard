<script lang="ts">
	import type { DashboardData } from './dashboard.types';
	import Dashboard from './Dashboard.svelte';
	import Support from '$components/Support.svelte';

	export let data: DashboardData;
</script>

<Support />
<Dashboard {data} />
