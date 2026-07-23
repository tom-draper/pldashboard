<script lang="ts">
	import Support from '$components/Support.svelte';
	import type { DashboardData } from '../[team]/dashboard.types';
	import Dashboard from '../[team]/Dashboard.svelte';

	let { data }: { data: DashboardData } = $props();
</script>

<Support />
<Dashboard {data} />
