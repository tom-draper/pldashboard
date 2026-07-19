<script lang="ts">
	import { onMount } from 'svelte';
	import githubIcon from '$lib/images/github.png';
	export let lastUpdated: string | null, dark: boolean;

	const chartColors = ['#00fe87', '#7dff42', '#dfff00', '#ffd700', '#ffaf00', '#ff5f00', '#ff0000'];
	const barCount = 8;
	const chartWidth = 24;
	const chartHeight = 12;
	const minBarHeight = 3;
	const barWidth = chartWidth / barCount;
	let originalBars: number[] = Array(barCount).fill(6);
	let displayedBars: number[] = originalBars;

	function randomBars() {
		return Array.from(
			{ length: barCount },
			() => Math.floor(Math.random() * (chartHeight - minBarHeight + 1)) + minBarHeight
		);
	}

	function barColor(height: number) {
		return chartColors[
			Math.min(
				chartColors.length - 1,
				Math.floor(((height - minBarHeight) / (chartHeight - minBarHeight)) * chartColors.length)
			)
		];
	}

	function startRandomising() {
		displayedBars = randomBars();
	}

	function stopRandomising() {
		displayedBars = originalBars;
	}

	onMount(() => {
		originalBars = randomBars();
		displayedBars = originalBars;

		return stopRandomising;
	});
</script>

<div class="teams-footer footer-text-color">
	<div class="teams-footer-bottom">
		<a href="https://github.com/tom-draper/pldashboard" target="_blank" class="github">
			<img src={githubIcon} alt="GitHub" class="github-img" class:github-img-dark={dark} />
		</a>
		{#if lastUpdated !== null}
			<div class="last-updated no-select">
				Last updated: {new Date(lastUpdated).toLocaleString()} UTC
			</div>
		{/if}
		<a href="https://pldashboard.com/home" class="version no-select"
			><span class="pl">pl</span>dashboard</a
		>
		<button
			type="button"
			class="company-logo"
			aria-label="pldashboard company logo"
			on:mouseenter={startRandomising}
			on:mouseleave={stopRandomising}
			on:focus={startRandomising}
			on:blur={stopRandomising}
		>
			<svg width="24" height="12" viewBox={`0 0 ${chartWidth} ${chartHeight}`} aria-hidden="true">
				{#each displayedBars as height, index}
					<rect
						x={index * barWidth}
						y={chartHeight - height}
						width={barWidth}
						{height}
						rx="0.5"
						fill={barColor(height)}
					/>
				{/each}
			</svg>
		</button>
	</div>
</div>

<style scoped>
	.github {
		opacity: 0.3;
		margin-bottom: 1.5em;
		width: fit-content;
		place-self: center;
	}
	.github-img {
		width: 30px;
	}
	.github-img:hover {
		opacity: 0.8;
	}
	.github-img-dark {
		filter: invert(1);
	}
	.teams-footer {
		color: #c6c6c6;
		padding: 1em 0 0.2em;
		height: auto;
		width: 100%;
		font-size: 13px;
		align-items: center;
	}
	.footer-text-color {
		color: rgb(0 0 0 / 37%);
	}
	.teams-footer-bottom {
		margin: 30px 0;
		display: grid;
	}
	.version {
		margin: 10px auto;
		color: white;
		background: var(--purple);
		padding: 6px 10px;
		border-radius: 4px;
		width: fit-content;
	}
	.company-logo {
		display: grid;
		place-items: center;
		width: 24px;
		height: 12px;
		margin: 4px auto 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		line-height: 0;
		outline: none;
	}
	.company-logo svg {
		display: block;
		overflow: visible;
	}
	.company-logo rect {
		transition:
			height 90ms ease,
			y 90ms ease,
			fill 90ms ease;
	}
	.last-updated {
		text-align: center;
		margin-bottom: 1.5em;
	}
	.no-select {
		-webkit-touch-callout: none; /* iOS Safari */
		-webkit-user-select: none; /* Safari */
		-khtml-user-select: none; /* Konqueror HTML */
		-moz-user-select: none; /* Old versions of Firefox */
		-ms-user-select: none; /* Internet Explorer/Edge */
		user-select: none; /* Non-prefixed version, currently
                                    supported by Chrome, Edge, Opera and Firefox */
	}
	.pl {
		color: #00ef87;
	}

	@media only screen and (max-width: 1200px) {
		.teams-footer {
			padding-bottom: 46px;
		}
	}
</style>
