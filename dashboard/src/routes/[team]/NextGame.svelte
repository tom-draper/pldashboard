<script lang="ts">
	import { toAlias, toInitials } from '$lib/team';
	import { ordinal, teamStyle } from '$lib/format';
	import type { TeamsData } from './dashboard.types';
	import type { Team } from '$lib/types';
	import { resultColor, oppositionFormPercentage, predictedScoreline } from './next-game';

	export let data: TeamsData, team: Team, switchTeam: (newTeam: Team) => void;

	const teamBadgeBase = 'float-left w-[calc(50%_-_18px)] pt-[5px] pb-[3px] text-center text-[15px]';
</script>

{#if data.upcoming[team].team === null}
	<div class="next-game-prediction-complete">
		<div
			class="grid flex-1 place-items-center bg-[var(--purple)] max-[1000px]:px-[10px] max-[1000px]:py-[50px]"
		>
			<h1 class="m-0! flex text-white max-[800px]:flex-col max-[800px]:text-left">
				{data._id}/{data._id + 1} SEASON COMPLETE
			</h1>
		</div>
	</div>
{:else}
	<div class="next-game-prediction">
		<div class="next-game-title">
			<h1 class="m-0! flex text-white max-[800px]:flex-col max-[800px]:text-left">
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
			<div
				class="m-auto w-[45%] text-[1.4em] max-[800px]:mx-auto max-[800px]:my-0 max-[800px]:w-full"
			>
				<div class="text-[3.3em] font-bold"></div>
				<div>
					<div class="next-game-item">
						<div class="text-[3.3em] font-bold">
							{data.standings[data.upcoming[team].team][data._id].position}<span
								class="text-[0.6em]"
								>{ordinal(data.standings[data.upcoming[team].team][data._id].position)}</span
							>
						</div>
					</div>
					<div class="next-game-item current-form">
						Current form:
						<span class="text-[var(--green)]">{oppositionFormPercentage(data, team)}</span>
					</div>
					<div class="next-game-item">
						Score prediction
						<br />
						<b class="text-[var(--purple)]">{predictedScoreline(data, team)}</b>
						<br />
					</div>
				</div>
			</div>
			<div
				class="mx-0 my-auto flex w-[55%] flex-col rounded-[6px] px-[20px] pt-[15px] pb-[10px] text-[22px] max-[800px]:mx-auto max-[800px]:mt-[30px] max-[800px]:mb-0 max-[800px]:w-[94%] max-[800px]:p-[10px]"
			>
				{#if data.upcoming[team].prevMatches.length === 0}
					<div class="next-game-item prev-results-title no-prev-results">No previous results</div>
				{:else}
					<div class="next-game-item prev-results-title">Previous results</div>
				{/if}

				<!-- Display table of previous results against the next team this team is playing -->
				{#each data.upcoming[team].prevMatches as prevMatch (prevMatch.date)}
					<div>
						<div class="mx-auto mt-[3px] mb-[1px] w-[90px] rounded-t-[4px] pt-[3px] text-[13px]">
							{new Date(prevMatch.date).toLocaleDateString('en-GB', {
								year: 'numeric',
								month: 'short',
								day: 'numeric'
							})}
						</div>
						<div class="next-game-item">
							<div class="flex text-[15px]">
								<div class="flex flex-1">
									<div
										class="{teamBadgeBase} rounded-l-[var(--border-radius)]"
										style={teamStyle(prevMatch.result.homeTeam)}
									>
										{toInitials(prevMatch.result.homeTeam)}
									</div>
									<div class="grow" style={teamStyle(resultColor(prevMatch, true))}>
										<div class="my-[4px] border-r border-r-black pr-[0.5em] text-right">
											{prevMatch.result.homeGoals}
										</div>
									</div>
								</div>
								<div class="flex flex-1">
									<div class="grow" style={teamStyle(resultColor(prevMatch, false))}>
										<div class="my-[4px] border-l border-l-black pl-[0.5em] text-left">
											{prevMatch.result.awayGoals}
										</div>
									</div>
									<div
										class="{teamBadgeBase} rounded-r-[var(--border-radius)]"
										style={teamStyle(prevMatch.result.awayTeam)}
									>
										{toInitials(prevMatch.result.awayTeam)}
									</div>
								</div>
							</div>
							<div style="clear: both"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style scoped>
	.next-game-title {
		width: max-content;
		padding: 6px 20px;
		border-radius: 0 0 var(--border-radius) 0;
		background: var(--purple);
		margin: -1px 0 0 -1px; /* To avoid top and left gap when zooming out */
	}
	.next-game-team-btn {
		color: var(--green) !important;
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
	.next-game-prediction-complete,
	.next-game-prediction {
		border-radius: var(--border-radius);
		min-height: 100%;
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
	.prev-results-title {
		font-weight: 700;
		padding-top: 0;
		margin: 0 !important;
	}
	.no-prev-results {
		display: grid;
		place-items: center;
		color: rgba(0, 0, 0, 0.35);
		background: rgba(181, 181, 181, 0.3);
		border-radius: var(--border-radius);
		padding: 100px 0;
	}
	.next-game-item {
		border-radius: 9px;
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
			padding-bottom: 0;
		}

		/* Change next game to column orientation */
		.next-game-values {
			flex-direction: column;
			margin: 20px 15px 15px;
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
