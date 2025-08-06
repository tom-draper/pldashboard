<script lang="ts">
	import Support from '$components/Support.svelte';
	import type { DashboardData } from '../[team]/dashboard.types';
	import Dashboard from '../[team]/Dashboard.svelte';

	export let data: DashboardData;
</script>

<Support />
<Dashboard {data} />
