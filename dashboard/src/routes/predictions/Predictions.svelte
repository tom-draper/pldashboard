<script lang="ts">
	import type { PredictionsData } from './predictions.types';

	function toggleDetailsDisplay(id: string) {
		const prediction = document.getElementById(id);
		if (prediction !== null) {
			prediction.classList.toggle('expanded');
		}
	}

	function datetimeToTime(datetime: string): string {
		const date = new Date(datetime);
		return date.toTimeString().slice(0, 5);
	}

	export let data: PredictionsData;

	console.log(data);
</script>

<div id="predictions">
	<div class="predictions-header">
		<a class="predictions-title" href="/predictions">Predictions</a>
	</div>

	<div class="page-content">
		<div class="accuracy-display">
			<div class="accuracy">
				<span class="accuracy-item">
					Predicting with accuracy: <b>{(data.accuracy.scoreAccuracy * 100).toFixed(2)}%</b
					></span
				><br />
				<div class="accuracy-item">
					General results accuracy: <b>{(data.accuracy.resultAccuracy * 100).toFixed(2)}%</b>
				</div>
			</div>
		</div>

		<div class="predictions-container">
			<div class="predictions">
				{#if data.predictions != null}
					{#each data.predictions as { _id, predictions }}
						<div class="date">
							{_id}
						</div>
						<div class="medium-predictions-divider" />
						<!-- Each prediction on this day -->
						{#each predictions as pred}
							<button
								class="prediction-container {pred.color}"
								on:click={() => toggleDetailsDisplay(pred._id)}
							>
								<div class="prediction prediction-item">
									<div class="prediction-label">Predicted:</div>
									<div class="prediction-value">
										<div class="prediction-initials">{pred.home}</div>
										<div class="prediction-score">
											{Math.round(pred.prediction.homeGoals)} - {Math.round(
												pred.prediction.awayGoals
											)}
										</div>
										<div class="prediction-initials">{pred.away}</div>
									</div>
								</div>
								{#if pred.actual != null}
									<div class="actual prediction-item">
										<div class="prediction-label">Actual:</div>
										<div class="prediction-value">
											<div class="prediction-initials">{pred.home}</div>
											<div class="prediction-score">
												{pred.actual.homeGoals} - {pred.actual.awayGoals}
											</div>
											<div class="prediction-initials">{pred.away}</div>
										</div>
									</div>
								{:else}
									<div class="prediction-time">
										{datetimeToTime(pred.datetime)}
									</div>
								{/if}

								<!-- Toggle to see detailed score -->
								{#if pred.prediction != null}
									<div class="prediction-details" id={pred._id}>
										<div class="detailed-predicted-score">
											<b>{pred.prediction.homeGoals} - {pred.prediction.awayGoals}</b>
										</div>
									</div>
								{/if}
							</button>
						{/each}
						<div class="predictions-gap" />
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<style scoped>
	.predictions-header {
		padding: 40px 40px 0;
		text-align: center;
	}
	.predictions-title {
		font-size: 2.6em;
		font-weight: 800;
		letter-spacing: -1px;
		align-self: center;
		flex: auto;
		color: #333;
		margin: 10px;
		text-decoration: none;
	}
	.predictions {
		display: flex;
		flex-direction: column;
	}
	.predictions-gap {
		margin: 15px 0;
	}
	.page-content {
		font-size: 1.3em;
	}
	.green {
		background-color: var(--win);
	}
	.yellow {
		background-color: var(--draw);
	}
	.red {
		background-color: var(--lose);
	}
	.predictions-container {
		width: 50%;
		margin: 0 auto;
	}
	.date {
		width: min(90%, 300px);
		align-self: center;
		text-align: center;
		margin-bottom: 2px;
		font-size: 1.2rem;
	}
	.prediction-item {
		text-align: left;
		margin: 0 8%;
		display: flex;
	}
	.prediction-label {
		flex: 5;
	}
	.prediction-value {
		flex: 4.5;
		display: flex;
		text-align: right;
	}
	.prediction-initials,
	.prediction-score {
		flex: 1;
		text-align: center;
	}
	.prediction-container {
		padding: 6px 0 3px;
		margin: 2px 0;
		width: min(90%, 300px);
		align-self: center;
		border-radius: var(--border-radius);
		color: inherit;
		border: none;
		font-size: 16px;
		cursor: pointer;
		outline: inherit;
		position: relative;
	}
	.medium-predictions-divider {
		align-self: center;
		border-bottom: 3px solid black;
		width: min(100%, 375px);
		margin-bottom: 2px;
	}
	.prediction-details {
		font-size: 0.75em;
		color: black;
		margin: 5px 0;
		text-align: left;
		height: 0;
		display: none;
	}
	.prediction-time {
		color: grey;
		font-size: 0.7em;
		position: absolute;
		right: -34px;
		top: calc(50% - 7px);
	}
	.prediction-detail {
		margin: 3px 0 3px 30px;
	}
	.prediction-details.expanded {
		height: auto;
		display: block;
	}
	.detailed-predicted-score {
		font-size: 1.2em;
		margin: 10px 0 0;
		text-align: center;
	}
	.tabbed {
		padding-left: 2em;
	}
	.predictions-footer {
		align-items: center;
		font-size: 0.8em;
		margin-top: 30px;
		text-align: center;
	}
	.accuracy-display {
		text-align: center;
		font-size: 13px;
	}
	.accuracy {
		margin: 1em 0 2.5em;
	}
	.accuracy-item {
		color: rgb(120 120 120);
		margin-bottom: 5px;
	}
	.method-description {
		margin: 20px auto 15px;
		width: 80%;
	}
	@media only screen and (max-width: 800px) {
		.predictions-container {
			width: 80%;
		}

		.prediction-container {
			width: min(80%, 300px);
		}

		.prediction-time {
			right: -28px;
			top: calc(50% - 6px);
		}

		.prediction-value {
			flex: 4;
		}
	}

	@media only screen and (max-width: 550px) {
		#predictions {
			font-size: 0.9em;
		}
		.predictions-title {
			font-size: 2em !important;
		}
		.predictions-container {
			width: 90%;
		}
		.prediction-container {
			width: 80%;
		}
		.accuracy-display {
			font-size: 0.8rem;
		}
		.prediction-item {
			margin: 0 6%;
		}
	}

	@media only screen and (max-width: 500px) {
		.prediction-value {
			flex: 4.5;
		}
	}

	@media only screen and (max-width: 400px) {
		.prediction-value {
			flex: 6;
		}
	}
</style>
