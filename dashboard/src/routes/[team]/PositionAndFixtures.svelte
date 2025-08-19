<script lang="ts">
	import FixturesGraph from './FixturesGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	let pageWidth: number;
	$: mobileView = pageWidth <= 700;

	export let data: DashboardData;
</script>

<svelte:window bind:innerWidth={pageWidth} />

<div class="row multi-element-row small-bottom-margin">
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
	<div class="row-right fixtures-graph row-graph">
		<h1 class="lowered">Fixtures</h1>
		<div class="graph mini-graph mobile-margin">
			<FixturesGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</div>

<style>
	.lowered {
		margin-bottom: -9px;
	}

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

	.fixtures-graph {
		display: flex;
		flex-direction: column;
	}

	.small-bottom-margin {
		margin-bottom: 1.5rem !important;
	}

	.row {
		position: relative;
		display: flex;
		margin-bottom: 3rem;
		height: auto;
	}
	.row-graph {
		width: 100%;
	}

	.row-left {
		display: flex;
		flex-direction: column;
		padding-right: auto;
		margin-right: 1.5em;
		text-justify: center;
		flex: 4;
	}
	.row-right {
		flex: 10;
	}
	.multi-element-row {
		margin: 0 1.4em 3rem;
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
		.row {
			flex-direction: column;
			margin-bottom: 40px;
		}
		.row-graph {
			width: auto;
		}

		.multi-element-row {
			margin: 0;
		}
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

		.row-graph {
			margin: 0;
		}
	}

	@media only screen and (max-width: 550px) {
		.multi-element-row {
			margin: 0;
		}

		.circles-background {
			transform: scale(0.35);
			margin-top: -9.5em;
		}

		.lowered {
			margin: 20px 30px 0;
		}
	}
</style>