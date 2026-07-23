<script lang="ts">
	import type { DashboardData } from './dashboard.types';
	import Dashboard from './Dashboard.svelte';
	import Support from '$components/Support.svelte';

	let { data }: { data: DashboardData } = $props();
</script>

<Support />
<Dashboard {data} />
