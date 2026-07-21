<script lang="ts">
	// Shared dashboard row wrapper. The base handles the flex/stacking behaviour;
	// `class` overrides the margins (defaults to the standard spacing).
	let cls = 'mb-[3rem] max-[1000px]:mb-[40px]';
	export { cls as class };
</script>

<div class="relative flex h-auto max-[1000px]:flex-col {cls}">
	<slot />
</div>
