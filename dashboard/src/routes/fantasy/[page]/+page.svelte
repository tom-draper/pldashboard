<script lang="ts">
	import type { FantasyData, Page } from '../../[team]/fantasy.types';
	import FantasyDashboard from '../FantasyDashboard.svelte';

	export let data: {
		slug: string;
		title: string;
		page: Page;
		data: FantasyData;
		pageData: FantasyData;
	};
</script>

<FantasyDashboard {data} />
