<script lang="ts">
	import { page } from '$app/state';

	const title = $derived(`${page.status} — ${page.error?.message ?? 'Something went wrong'}`);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="flex min-h-screen items-start justify-center px-4 pt-24">
	<div class="w-full max-w-2xl rounded-lg bg-[var(--purple)] px-6 py-5 text-center text-white">
		<div class="mb-2 text-3xl font-bold text-[var(--green)]">{page.status}</div>
		<div class="text-lg">{page.error?.message ?? 'Something went wrong'}</div>
	</div>
</div>
