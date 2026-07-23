<script lang="ts">
	import { page } from '$app/stores';

	let {
		title,
		description,
		path = null,
		// Default social share image: the dashboard screenshot from the project README.
		image = 'https://user-images.githubusercontent.com/41476809/227160125-c2fdc601-9e32-431c-9ecf-fb0046041c4f.png'
	}: {
		title: string;
		description: string;
		/** Absolute path used for the canonical URL / og:url; defaults to the current path. */
		path?: string | null;
		image?: string;
	} = $props();

	const origin = $derived($page.url.origin);
	const canonical = $derived(`${origin}${path ?? $page.url.pathname}`);
	const imageUrl = $derived(image.startsWith('http') ? image : `${origin}${image}`);
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

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
</svelte:head>
