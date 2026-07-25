<script lang="ts">
	import './styles.css';
	import { page } from '$app/state';
	import { setThemeColor } from '$lib/theme';
	import type { Snippet } from 'svelte';

	const { children }: { children?: Snippet } = $props();

	// $effect only runs in the browser, so the theme colour is set whenever the
	// route changes on the client.
	$effect(() => {
		const path = page.url.pathname;
		if (path === '/home') {
			setThemeColor('#000');
		} else if (path === '/fantasy' || path === '/predictions' || path === '/overview') {
			setThemeColor('#fff');
		}
	});
</script>

<div class="app">
	<main>
		{@render children?.()}
	</main>
</div>
