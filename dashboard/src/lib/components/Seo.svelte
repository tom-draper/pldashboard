<script lang="ts">
	import { page } from '$app/stores';

	export let title: string;
	export let description: string;
	/** Absolute path used for the canonical URL / og:url; defaults to the current path. */
	export let path: string | null = null;
	export let image = '/favicon.png';

	$: origin = $page.url.origin;
	$: canonical = `${origin}${path ?? $page.url.pathname}`;
	$: imageUrl = image.startsWith('http') ? image : `${origin}${image}`;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="pldashboard" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
</svelte:head>
