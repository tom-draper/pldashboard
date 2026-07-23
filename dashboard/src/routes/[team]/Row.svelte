<script lang="ts">
	import type { Snippet } from 'svelte';

	// Shared dashboard row wrapper. The base handles the flex/stacking behaviour;
	// `class` overrides the margins (defaults to the standard spacing).
	let {
		class: cls = 'mb-[3rem] max-[1000px]:mb-[40px]',
		children
	}: { class?: string; children?: Snippet } = $props();
</script>

<div class="relative flex h-auto max-[1000px]:flex-col {cls}">
	{@render children?.()}
</div>
