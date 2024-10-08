<script lang="ts">
	import { toAlias, toInitials, getCurrentMatchday } from '$lib/team';
	import { ordinal, scorelineShort, teamStyle } from '$lib/format';
	import type { PrevMatch, TeamsData } from './dashboard.types';
	import type { Team } from '$lib/types';

	function resultColor(prevMatch: PrevMatch, home: boolean): Team {
		if (home) {
			return prevMatch.result.homeGoals < prevMatch.result.awayGoals ? prevMatch.result.awayTeam : prevMatch.result.homeTeam;
		}
		return prevMatch.result.homeGoals > prevMatch.result.awayGoals ? prevMatch.result.homeTeam : prevMatch.result.awayTeam;
	}

	function oppositionFormPercentage(data: TeamsData, team: Team) {
		const opposition = data.upcoming[team].team;
		if (!(data._id in data.form[opposition])) {
			return 'N/A';
		}
		return ((data.form[opposition][data._id][getCurrentMatchday(data, opposition)].formRating5 ?? 0) * 100).toFixed(1) + '%'
	}

	function predictedScoreline(data: TeamsData, team: Team) {
		const homeGoals = data.upcoming[team].prediction.homeGoals;
		const awayGoals = data.upcoming[team].prediction.awayGoals;
		const homeTeam = data.upcoming[team].prediction.homeTeam;
		const awayTeam = data.upcoming[team].prediction.awayTeam;
		return scorelineShort(homeTeam, awayTeam, homeGoals, awayGoals);
	}
	
	export let data: TeamsData, team: Team, switchTeam: (newTeam: Team) => void;
</script>

{#if data.upcoming[team].team === null}
	<div class="next-game-prediction-complete">
		<div class="next-game-season-complete">
			<h1 class="next-game-title-text">
				{data._id}/{data._id + 1} SEASON COMPLETE
			</h1>
		</div>
	</div>
{:else}
	<div class="next-game-prediction">
		<div class="next-game-title">
			<h1 class="next-game-title-text">
				Next Game:&nbsp
				<button
					on:click={() => {
						switchTeam(data.upcoming[team].team);
					}}
					class="next-game-team-btn">{toAlias(data.upcoming[team].team)}&nbsp</button
				>
				({data.upcoming[team].atHome ? 'Home' : 'Away'})
			</h1>
		</div>

		<div class="next-game-values">
			<div class="predictions-and-logo">
				<div class="next-game-position" />
				<div class="predictions">
					<div class="next-game-item">
						<div class="next-game-position">
							{data.standings[data.upcoming[team].team][data._id].position}<span
								class="ordinal-position"
								>{ordinal(data.standings[data.upcoming[team].team][data._id].position)}</span
							>
						</div>
					</div>
					<div class="next-game-item current-form">
						Current form:
						<span class="current-form-value"
							>{oppositionFormPercentage(data, team)}</span
						>
					</div>
					<div class="next-game-item">
						Score prediction
						<br />
						<a class="predictions-link" href="/predictions">
							<b>{predictedScoreline(data, team)}</b>
						</a>
						<br />
					</div>
				</div>
			</div>
			<div class="past-results">
				{#if data.upcoming[team].prevMatches.length === 0}
					<div class="next-game-item prev-results-title no-prev-results">No previous results</div>
				{:else}
					<div class="next-game-item prev-results-title">Previous results</div>
				{/if}

				<!-- Display table of previous results against the next team this team is playing -->
				{#each data.upcoming[team].prevMatches as prevMatch}
					<div class="next-game-item-container">
						<div class="past-result-date result-details">
							{new Date(prevMatch.date).toLocaleDateString('en-GB', {
								year: 'numeric',
								month: 'short',
								day: 'numeric'
							})}
						</div>
						<div class="next-game-item result-details">
							<div class="past-result">
								<div class="left-side">
									<div class="home-team" style={teamStyle(prevMatch.result.homeTeam)}>
										{toInitials(prevMatch.result.homeTeam)}
									</div>
									<div class="goals-container" style={teamStyle(resultColor(prevMatch, true))}>
										<div class="home-goals">
											{prevMatch.result.homeGoals}
										</div>
									</div>
								</div>
								<div class="right-side">
									<div class="goals-container" style={teamStyle(resultColor(prevMatch, false))}>
										<div class="away-goals">
											{prevMatch.result.awayGoals}
										</div>
									</div>
									<div class="away-team" style={teamStyle(prevMatch.result.awayTeam)}>
										{toInitials(prevMatch.result.awayTeam)}
									</div>
								</div>
							</div>
							<div style="clear: both" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style scoped>
	.left-side,
	.right-side {
		display: flex;
		flex: 1;
	}
	.goals-container {
		flex-grow: 1;
	}
	.away-goals,
	.home-goals {
		margin: 4px 0;
	}
	.home-goals {
		text-align: right;
		padding-right: 0.5em;
		border-right: 1px solid black;
	}
	.away-goals {
		text-align: left;
		padding-left: 0.5em;
		border-left: 1px solid black;
	}
	.next-game-title {
		width: max-content;
		padding: 6px 20px;
		border-radius: 0 0 var(--border-radius) 0;
		background: var(--purple);
		margin: -1px 0 0 -1px; /* To avoid top and left gap when zooming out */
	}
	.next-game-season-complete {
		display: grid;
		place-items: center;
		background: #f0f0f0;
		background: linear-gradient(45deg, #c600d839, rgb(2 239 255 / 25%), #00fe873e);
		flex: 1;
	}
	.next-game-title-text {
		margin: 0;
		color: white;
		display: flex;
	}
	.next-game-team-btn {
		color: var(--green) !important;
	}
	.predictions-and-logo {
		font-size: 1.4em;
		width: 45%;
		margin: auto;
	}
	button {
		background: none;
		color: inherit;
		border: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
		outline: inherit;
	}
	.predictions-link {
		text-decoration: none;
		color: #333;
		color: var(--purple);
	}
	.predictions-link:hover {
		color: rgb(120 120 120);
	}
	.past-results {
		font-size: 22px;
		width: 55%;
		display: flex;
		flex-direction: column;
		padding: 15px 20px 10px;
		border-radius: 6px;
		margin: auto 0;
	}
	.next-game-prediction-complete,
	.next-game-prediction {
		border-radius: var(--border-radius);
		min-height: 97.5%;
		border: 6px solid var(--purple);
	}
	.next-game-prediction-complete {
		display: flex;
	}
	.next-game-values {
		display: flex;
		margin-right: 2vw;
		min-height: 387px;
	}
	.next-game-position {
		font-size: 3.3em;
		font-weight: 700;
	}
	.ordinal-position {
		font-size: 0.6em;
	}
	.past-result {
		font-size: 15px;
		display: flex;
	}
	.past-result-date {
		font-size: 13px;
		width: 90px;
		margin: 3px auto 1px;
		padding-top: 3px;
		border-radius: 4px 4px 0 0;
	}
	.prev-results-title {
		font-weight: 700;
		padding-top: 0;
		margin: 0 !important;
	}
	.no-prev-results {
		display: grid;
		place-items: center;
		color: rgb(181, 181, 181);
		color: rgba(0, 0, 0, 0.35);
		background: rgba(181, 181, 181, 0.3);
		border-radius: var(--border-radius);
		padding: 100px 0;
	}
	.next-game-item {
		border-radius: 9px;
	}
	.home-team {
		float: left;
		text-align: left;
		border-radius: var(--border-radius) 0 0 var(--border-radius);
	}
	.away-team {
		float: left;
		text-align: right;
		border-radius: 0 var(--border-radius) var(--border-radius) 0;
	}
	.home-team,
	.away-team {
		font-size: 15px;
		width: calc(50% - 18px);
		padding: 5px 0 3px;
		text-align: center;
	}
	.next-game-team-btn {
		color: inherit;
		text-align: left;
	}
	.current-form {
		border-radius: 6px;
		padding: 10px 15px;
		color: white;
		background: var(--purple);
		width: fit-content;
		margin: auto auto 10px;
	}
	.current-form-value {
		color: var(--green);
	}

	@media only screen and (max-width: 1300px) {
		.next-game-values {
			margin-right: 0;
		}
	}

	@media only screen and (max-width: 1100px) {
		.next-game-title {
			width: auto;
			border-radius: 0;
		}
	}

	@media only screen and (max-width: 1000px) {
		.next-game-prediction-complete {
			margin: 50px 20px 40px;
		}
		.next-game-season-complete {
			padding: 50px 10px;
		}
		.next-game-prediction {
			margin: 50px 20px 40px;
		}
		.next-game-values {
			margin: 2% 3vw 2% 0;
			min-height: auto;
		}
	}

	@media only screen and (max-width: 800px) {
		.next-game-prediction {
			margin: 50px 75px 40px;
		}

		/* Change next game to column orientation */
		.next-game-values {
			flex-direction: column;
			margin: 20px 15px 15px;
		}

		.predictions-and-logo {
			margin: 0 auto;
			width: 100%;
		}

		.past-results {
			margin: 30px auto 0;
			width: 94%;
			padding: 10px;
		}

		.next-game-prediction {
			padding-bottom: 0;
		}
		.next-game-title-text {
			flex-direction: column;
			text-align: left;
		}

		.next-game-title {
			padding: 6px 15px;
		}
		.no-prev-results {
			font-size: 0.8em;
			padding: 3em 0;
		}
	}
	@media only screen and (max-width: 700px) {
		.next-game-prediction {
			margin: 40px 20px;
		}
	}
	@media only screen and (max-width: 550px) {
		.next-game-title {
			padding: 6px 15px 7px 12px;
		}
		.next-game-values {
			margin: 25px 10px 10px;
			font-size: 0.85em;
		}
		.next-game-prediction {
			margin: 40px 14px;
		}
	}
</style>
