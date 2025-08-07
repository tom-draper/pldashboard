<script lang="ts">
	import './styles.css';
	import { page } from '$app/stores';
	import { setThemeColor } from '$lib/theme';

	$: {
		if (typeof document !== 'undefined') {
			const path = $page.url.pathname;
			if (path === '/home') {
				setThemeColor('#000');
			} else if (path === '/fantasy' || path === '/predictions' || path === '/overview') {
				setThemeColor('#fff');
			}
		}
	}
</script>

<div class="app">
	<main>
		<slot />
	</main>
</div>
