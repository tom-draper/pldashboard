
<div class="support">
    <a href="https://www.buymeacoffee.com/tomdraper">Buy Me a Coffee</a>
</div>

<style>
	.support {
		position: fixed;
		top: 0;
		right: 0;
		font-size: 13px;
		margin: 8px 10px;
		z-index: 1000;
		border-radius: 4px;
		background-color: rgba(255, 255, 255, 0.25);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		/* background-color rather than the shorthand so only the colour
		   animates, leaving the backdrop blur untouched. */
		transition: background-color 100ms ease;
	}

	/* The padding lives on the link so the whole pill is both hoverable and
	   clickable. On the wrapper it left a blurred, unclickable border. */
	.support a {
		display: block;
		padding: 6px 9px;
		color: inherit;
		transition: color 200ms ease;
	}

	.support:hover {
		background-color: var(--dark-purple);
	}

	.support:hover a {
		color: var(--green);
	}

	@media (prefers-reduced-motion: reduce) {
		.support,
		.support a {
			transition: none;
		}
	}
</style>
