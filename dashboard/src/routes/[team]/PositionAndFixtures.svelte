<script lang="ts">
	import FixturesGraph from './FixturesGraph.svelte';
	import Row from './Row.svelte';
	import type { DashboardData } from './dashboard.types';

	let pageWidth: number;
	$: mobileView = pageWidth <= 700;

	export let data: DashboardData;
</script>

<svelte:window bind:innerWidth={pageWidth} />

<Row class="mx-[1.4em] mt-0 mb-[1.2em] max-[1000px]:mx-0">
	<div class="row-left position-no-badge">
		<div class="circles-background-container">
			<svg class="circles-background" viewBox="0 0 600 600">
				<!-- Background decorative circles -->
				<circle cx="300" cy="320" r="210" fill="var(--{data.team.id})" />
				<circle cx="300" cy="320" r="180" fill="var(--{data.team.id}-secondary)" />
				<circle cx="300" cy="320" r="150" fill="var(--{data.team.id})" />

				<!-- Central position number -->
				<text
					x="298"
					y="342"
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="180"
					font-weight="900"
					font-family="Arial, sans-serif"
					fill="var(--{data.team.id}-secondary)"
				>
					{data.data.standings[data.team.name][data.data._id].position}
				</text>
			</svg>
		</div>
	</div>
	<div class="flex w-full flex-[10] flex-col max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">Fixtures</h1>
		<div class="h-[450px] max-[1100px]:h-[400px] max-[700px]:h-[300px] max-[550px]:h-[250px]">
			<FixturesGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</Row>

<style>
	.position-no-badge {
		padding-left: 0;
		margin: 0;
		height: 500px;
	}

	.circles-background-container {
		position: absolute;
		align-self: center;
		width: 500px;
		z-index: -10;
	}

	.circles-background {
		height: 500px;
		width: 500px;
		transform: scale(0.95);
	}

	.row-left {
		display: flex;
		flex-direction: column;
		padding-right: auto;
		margin-right: 1.5em;
		text-justify: center;
		flex: 4;
	}

	@media only screen and (max-width: 1800px) {
		.circles-background {
			transform: scale(0.9);
		}
	}
	@media only screen and (max-width: 1600px) {
		.row-left {
			flex: 5;
		}
		.circles-background {
			transform: scale(0.85);
		}
	}
	@media only screen and (max-width: 1500px) {
		.circles-background {
			transform: scale(0.8);
		}
	}
	@media only screen and (max-width: 1400px) {
		.circles-background {
			transform: scale(0.75);
		}
	}
	@media only screen and (max-width: 1200px) {
		.circles-background {
			transform: scale(0.7);
		}
	}
	@media only screen and (max-width: 1000px) {
		.row-left {
			margin-right: 0;
			align-self: center;
			width: 80%;
		}
		.position-no-badge {
			display: none;
		}
		.circles-background {
			transform: scale(0.48);
			margin-top: -100px;
		}
		.circles-background-container {
			align-self: center;
		}
	}
	@media only screen and (max-width: 900px) {
		.circles-background {
			transform: scale(0.45);
			margin-top: -120px;
		}
	}
	/* Note: the 700 block intentionally precedes the 800 block; at widths <=700
	   the later 800 rule wins for .circles-background, matching the original. */
	@media only screen and (max-width: 700px) {
		.circles-background {
			transform: scale(0.55);
			margin-top: -5em;
		}
		.position-no-badge {
			height: 330px;
		}
	}
	@media only screen and (max-width: 800px) {
		.circles-background {
			transform: scale(0.4);
			margin-top: -9em;
		}
	}
	@media only screen and (max-width: 550px) {
		.circles-background {
			transform: scale(0.35);
			margin-top: -9.5em;
		}
	}
</style>
