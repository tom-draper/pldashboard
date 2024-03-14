<script lang="ts">
	import Footer from "../../Footer.svelte";

	let predictions = [
		{
			home: 'Arsenal',
			away: 'Chelsea',
			prediction: {
				prediction: 'home',
				probability: {
					home: 0.6,
					draw: 0.1,
					away: 0.3
				}
			},
			kickoff: new Date('2024-03-14T16:30:00Z'),
		},
		{
			home: 'Liverpool',
			away: 'Arsenal',
			prediction: {
				prediction: 'draw',
				probability: {
					home: 0.3,
					draw: 0.4,
					away: 0.3
				}
			},
			kickoff: new Date('2024-03-14T17:30:00Z'),
		},
		{
			home: 'Manchester United',
			away: 'Manchester City',
			prediction: {
				prediction: 'away',
				probability: {
					home: 0.2,
					draw: 0.1,
					away: 0.7
				}
			},
			kickoff: new Date('2024-03-14T16:30:00Z'),
		},
		{
			home: 'Brighton',
			away: 'Crystal Palace',
			prediction: {
				prediction: 'away',
				probability: {
					home: 0.6,
					draw: 0.05,
					away: 0.35
				}
			},
			kickoff: new Date('2024-03-14T16:30:00Z'),
		}
	].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

	function updateCountdowns() {
		const updatedCountdowns = Array(predictions.length);
		for (let i = 0; i < predictions.length; i++) {
			updatedCountdowns[i] = getCountdown(predictions[i].kickoff);
		}
		countdowns = updatedCountdowns;
		setTimeout(updateCountdowns, 1000);
	}

	function getCountdown(kickoff: Date) {
		const now = new Date();
		const timeDiff = kickoff.getTime() - now.getTime();

		const seconds = Math.floor(timeDiff / 1000);
		const minutes = Math.floor(seconds / 60);

		if (timeDiff < 0) {
			if (minutes < -45 && minutes > -60) {
				return 'HT';
			} else if (minutes > -90) {
				return `${-minutes}'`;
			}
			return 'Finished';
		}

		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		let countdown = '';
		if (days) {
			countdown += `${days}d `;
		}
		if (hours) {
			countdown += `${hours % 24}h `;
		}
		if (minutes) {
			countdown += `${minutes % 60}m `;
		}
		countdown += `${seconds % 60}s`;
		return countdown;
	}

	let countdowns = Array(predictions.length).fill('');
	$: countdowns;

	updateCountdowns();

	export let data;
</script>

<div class="predictions-container">
	<div class="header">
		<div class="title">
			<div><span class="pl">pl</span>dashboard</div>
			<div class="ai-title">AI</div>
		</div>
		<div>Real-time football predictions from our ground-breaking intelligent model.</div>
	</div>

	<div class="predictions">
		{#if predictions.length > 0}
			{#each predictions as prediction, i}
				<div class="prediction">
					<div class="prediction-header">
						<div>{prediction.home} vs {prediction.away}</div>

						<svg
							version="1.1"
							id="L9"
							xmlns="http://www.w3.org/2000/svg"
							xmlns:xlink="http://www.w3.org/1999/xlink"
							x="0px"
							y="0px"
							viewBox="0 0 100 100"
							enable-background="new 0 0 0 0"
							xml:space="preserve"
						>
							<rect x="20" y="50" width="4" height="10" fill="var(--pink)">
								<animateTransform
									attributeType="xml"
									attributeName="transform"
									type="translate"
									values="0 0; 0 20; 0 0"
									begin="0"
									dur="1.2s"
									repeatCount="indefinite"
								/>
							</rect>
							<rect x="30" y="50" width="4" height="10" fill="var(--pink)">
								<animateTransform
									attributeType="xml"
									attributeName="transform"
									type="translate"
									values="0 0; 0 20; 0 0"
									begin="0.2s"
									dur="1.2s"
									repeatCount="indefinite"
								/>
							</rect>
							<rect x="40" y="50" width="4" height="10" fill="var(--pink)">
								<animateTransform
									attributeType="xml"
									attributeName="transform"
									type="translate"
									values="0 0; 0 20; 0 0"
									begin="0.4s"
									dur="1.2s"
									repeatCount="indefinite"
								/>
							</rect>
						</svg>
						<div class="countdown">{countdowns[i]}</div>
					</div>
					<div class="prediction-value">
						{#if prediction.prediction.prediction === 'home'}
							Home win
						{:else if prediction.prediction.prediction === 'draw'}
							Draw
						{:else}
							Away win
						{/if}
					</div>
					<div class="probabilitity-bar-container">
						<div class="probability-bar">
							<div
								class="probability-bar probability-bar-home"
								style="width: {prediction.prediction.probability.home * 100}%"
								title="{prediction.prediction.probability.home * 100}% home win"
							></div>
							<div
								class="probability-bar probability-bar-draw"
								style="width: {prediction.prediction.probability.draw * 100}%"
								title="{prediction.prediction.probability.draw * 100}% draw"
							></div>
							<div
								class="probability-bar probability-bar-away"
								style="width: {prediction.prediction.probability.away * 100}%"
								title="{prediction.prediction.probability.away * 100}% away win"
							></div>
						</div>
					</div>
				</div>
			{/each}
		{:else}
			<div class="no-predictions">No live predictions available. Check back closer to the game.</div>
		{/if}
	</div>
	<div class="previous-predictions">
		362 games, 61% accuracy
	</div>
</div>


<div class="footer-container">
	<Footer lastUpdated={null} dark={true} />
</div>

<style scoped>
	.prediction-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5em;
	}

	.predictions-container {
		min-height: 100vh;
		background: rgb(10, 0, 8);
		color: white;
	}
	.pl {
		color: var(--green);
	}

	.title {
		place-content: center;
		display: flex;
		place-items: center;
		font-size: 2.5rem;
		padding: 0.8em 1em;
	}
	.ai-title {
		margin-left: 0.5ch;
		font-size: 1.05em;
		background: -webkit-linear-gradient(rgb(188, 12, 241), rgb(212, 4, 4));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.predictions {
		margin: 10vh auto;
	}
	.prediction {
		background: rgb(53, 2, 43);
		background: var(--purple);
		background: rgb(37, 1, 30);
		border-radius: 4px;
		margin: 2em auto;
		padding: 1em 1.6em;
		max-width: 28em;
		/* flex: 1; */
	}
	.no-predictions {
		text-align: center;
		width: fit-content;
		margin: auto;
		padding: 5em 2em;
		background: rgb(53, 2, 43);
		border-radius: 4px;
	}

	.prediction-value {
		margin: 0.2em 0 0.3em;
		font-size: 1.6em;
	}

	.probability-bar {
		height: 12px;
		display: flex;
		margin-bottom: 0.3em;
	}

	.probability-bar-home {
		background: var(--green);
		border-radius: 2px 0 0 2px;
	}
	.probability-bar-draw {
		background: white;
	}
	.probability-bar-away {
		background: var(--pink);
		border-radius: 0 2px 2px 0;
	}

	.header {
		height: auto;
	}

	svg {
		width: 80px;
		height: 80px;
		margin-top: -44px;
		/* margin-right: -140px; */
		margin-right: -50px;
		/* margin-left: -80px; */
		margin-bottom: -50px;
		/* margin: 20px; */
		display: inline-block;
	}

	.countdown {
		flex-grow: 1;
		text-align: right;
	}

	.previous-predictions,
	.footer-container {
		background: rgb(10, 0, 8);
	}

	.previous-predictions {
		text-align: center;
		color: white;
		opacity: 0.4;
	}
</style>
