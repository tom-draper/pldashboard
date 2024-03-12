<script lang="ts">
	import { onMount } from 'svelte';
	import { toInitials } from '../../[team]/team';
	import { teamStyle } from '../../[team]/format';
	import type { DashboardData, Team } from '../../[team]/dashboard.types';

	type UpcomingMatch = {
		time: Date;
		home: Team;
		away: Team;
	};

	function upcomingMatches(): UpcomingMatch[] {
		return Object.entries(data.data.upcoming)
			.filter(([_, upcoming]) => upcoming.atHome)
			.map(([team, upcoming]) => ({
				time: new Date(upcoming.date),
				home: team,
				away: upcoming.nextTeam
			}))
			.sort((a, b) => a.time - b.time);
	}

	type Standings = {
		team: Team;
		position: number;
		played: number;
		points: number;
		won: number;
		lost: number;
		drawn: number;
		gA: number;
		gD: number;
		gF: number;
	};

	function standingsTable(): Standings[] {
		return Object.entries(data.data.standings)
			.map(([team, row]) => ({ ...row[data.data._id], team }))
			.sort((a, b) => a.position - b.position);
	}

	function applyRatingFixturesScaling() {
		if (fixturesScaling === 'rating') {
			return;
		}
		fixturesScaling = 'rating';

		for (const teamFixtures of fixtures) {
			for (const match of teamFixtures.matches) {
				const homeAdvantage = match.atHome
					? 0
					: data.data.homeAdvantages[match.team].totalHomeAdvantage;
				match.colour = fixtureColourSkewed(
					data.data.teamRatings[match.team].totalRating + homeAdvantage
				);
			}
		}
		fixtures = fixtures;
	}

	function applyRatingFormScaling() {
		if (fixturesScaling === 'form') {
			return;
		}
		fixturesScaling = 'form';

		for (const teamFixtures of fixtures) {
			for (const match of teamFixtures.matches) {
				const matchdays = Object.keys(data.data.form[teamFixtures.team][data.data._id]).reverse();
				const homeAdvantage = match.atHome
					? 0
					: data.data.homeAdvantages[match.team].totalHomeAdvantage;
				let form = matchdays.reduce((prevForm, matchday) => {
					const formRating = data.data.form[match.team][data.data._id][matchday].formRating5;
					return formRating != null ? formRating : prevForm;
				}, 0.5);
				match.colour = fixtureColour(form + homeAdvantage);
			}
		}
		fixtures = fixtures;
	}

	type Fixtures = {
		team: Team;
		matches: {
			team: Team;
			date: string;
			atHome: boolean;
			status: string;
			colour: string;
		}[];
	};

	function fixturesTable(standings: Standings[]) {
		const fixtures: Fixtures[] = standings.map((row) => {
			const matches = Object.values(data.data.fixtures[row.team]).map((match) => {
				const homeAdvantage = match.atHome
					? 0
					: data.data.homeAdvantages[match.team].totalHomeAdvantage;
				return {
					team: match.team,
					date: match.date,
					atHome: match.atHome,
					status: match.status,
					colour: fixtureColourSkewed(data.data.teamRatings[match.team].totalRating + homeAdvantage)
				};
			});
			return {
				team: row.team,
				matches: matches
			};
		});
		return fixtures;
	}

	function fixtureColourSkewed(scaleVal: number) {
		const thresholds = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];

		for (let i = 0; i < thresholds.length; i++) {
			if (scaleVal < thresholds[i]) {
				return colors[i];
			}
		}

		return colors[thresholds.length];
	}

	const colors = [
		'#00fe87',
		'#63fb6e',
		'#8df755',
		'#aef23e',
		'#cbec27',
		'#e6e50f',
		'#ffdd00',
		'#ffc400',
		'#ffab00',
		'#ff9000',
		'#ff7400',
		'#ff5618',
		'#f83027'
	];

	function fixtureColour(scaleVal: number) {
		const index = Math.floor(scaleVal * colors.length);
		return colors[index];
	}

	let upcoming: UpcomingMatch[];
	let standings: Standings[];
	let fixtures: Fixtures[];
	$: fixtures;
	let fixturesScaling = 'rating';
	onMount(() => {
		upcoming = upcomingMatches();
		standings = standingsTable();
		fixtures = fixturesTable(standings);
	});

	export let data: DashboardData;
</script>

<div id="page-content">
	<div class="row">
		<div class="left">
			<div class="upcoming-matches-container">
				{#if upcoming != undefined}
					<div class="upcoming-matches">
						<div class="upcoming-title">Upcoming</div>
						{#each upcoming as match, i}
							{#if i === 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}
								<div class="upcoming-match-date">
									{match.time.toLocaleDateString('en-GB', {
										weekday: 'long',
										year: 'numeric',
										month: 'long',
										day: 'numeric'
									})}
								</div>
							{/if}
							<div class="upcoming-match">
								<div class="upcoming-match-teams">
									<div class="upcoming-match-home" style={teamStyle(match.home)}>
										{toInitials(match.home)}
									</div>
									<div class="upcoming-match-away" style={teamStyle(match.away)}>
										{toInitials(match.away)}
									</div>
								</div>
							</div>
							<div class="upcoming-match-time-container">
								<div class="upcoming-match-time">
									{match.time.toLocaleTimeString('en-GB', {
										hour: '2-digit',
										minute: '2-digit'
									})}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<div class="standings-container">
			{#if standings != undefined}
				<div class="standings-table">
					<div class="standings-title">Standings</div>
					<div class="standings">
						<div class="table-row">
							<div class="standings-position" />
							<div class="standings-team-name" />
							<div class="standings-won bold">W</div>
							<div class="standings-drawn bold">D</div>
							<div class="standings-lost bold">L</div>
							<div class="standings-gf bold">GF</div>
							<div class="standings-ga bold">GA</div>
							<div class="standings-gd bold">GD</div>
							<div class="standings-played bold">Played</div>
							<div class="standings-points bold">Points</div>
							<div class="standings-rating bold">Rating</div>
							<div class="standings-form bold">Form</div>
						</div>
						{#each standings as row, i}
							<div
								class="table-row {i % 2 === 0 ? 'grey-row' : ''} {i < 4 ? 'cl' : ''} {i > 3 && i < 6
									? 'el'
									: ''} {i > 16 ? 'relegation' : ''}"
							>
								<div class="standings-position">
									{row.position}
								</div>
								<div class="standings-team-name">
									{row.team}
								</div>
								<div class="standings-won">
									{row.won}
								</div>
								<div class="standings-drawn">
									{row.drawn}
								</div>
								<div class="standings-lost">
									{row.lost}
								</div>
								<div class="standings-gf">
									{row.gF}
								</div>
								<div class="standings-ga">
									{row.gA}
								</div>
								<div class="standings-gd">
									{row.gD}
								</div>
								<div class="standings-played">
									{row.played}
								</div>
								<div class="standings-points">
									{row.points}
								</div>
								<div class="standings-rating">
									{data.data.teamRatings[row.team].totalRating.toFixed(2)}
								</div>
								<div class="standings-form">
									{Object.keys(data.data.form[row.team][data.data._id]).length > 0 &&
									data.data.form[row.team][data.data._id][
										Math.max(
											...Object.keys(data.data.form[row.team][data.data._id]).map((x) =>
												parseInt(x)
											)
										)
									] != undefined &&
									data.data.form[row.team][data.data._id][
										Math.max(
											...Object.keys(data.data.form[row.team][data.data._id]).map((x) =>
												parseInt(x)
											)
										)
									].formRating5 != null
										? data.data.form[row.team][data.data._id][
												Math.max(
													...Object.keys(data.data.form[row.team][data.data._id]).map((x) =>
														parseInt(x)
													)
												)
											].formRating5.toFixed(2)
										: ''}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
	<div class="row">
		<div class="fixtures">
			<div class="fixtures-title">Fixtures</div>
			{#if fixtures != undefined}
				<div class="scale-btns">
					<div class="scale-team-ratings">
						<button
							id="rating-scale-btn"
							class="scale-btn {fixturesScaling === 'rating' ? 'scaling-selected' : ''}"
							on:click={applyRatingFixturesScaling}
						>
							Rating
						</button>
					</div>
					<div class="scale-team-form">
						<button
							id="form-scale-btn"
							class="scale-btn {fixturesScaling === 'form' ? 'scaling-selected' : ''}"
							on:click={applyRatingFormScaling}
						>
							Form
						</button>
					</div>
				</div>
				<div class="fixtures-table">
					<div class="fixtures-teams-container">
						{#each fixtures as row, i}
							<div class="fixtures-table-row">
								<div
									class="fixtures-team"
									style="{teamStyle(row.team)} {i === 0
										? 'border-top: 2px solid black; border-radius: 4px 0 0'
										: i === fixtures.length - 1
											? 'border-radius: 0 0 0 4px;'
											: ''}"
								>
									{toInitials(row.team)}
								</div>
							</div>
						{/each}
					</div>
					<div class="fixtures-matches-container">
						<div class="fixtures-table-row">
							<div class="fixtures-matches">
								{#each Array(38) as _, i}
									<div class="match">{i + 1}</div>
								{/each}
							</div>
						</div>
						{#each fixtures as row, _}
							<div class="fixtures-table-row">
								<div class="fixtures-matches">
									{#each row.matches as match, i}
										<div
											class="match"
											style="background: {match.colour}; {match.status == 'FINISHED'
												? 'filter: grayscale(100%)'
												: ''} {i === row.matches.length - 1 ? 'border-right: 2px solid black' : ''}"
											title={match.date}
										>
											{`${toInitials(match.team)} (${match.atHome ? 'H' : 'A'}`})
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style scoped>
	#page-content {
		margin-top: 3em;
		position: relative;
	}
	.row {
		display: flex;
		margin-bottom: 2em;
	}
	.left {
		width: min(40%, 500px);
	}
	.upcoming-matches {
		position: relative;
		margin-left: 40px;
	}
	.upcoming-match {
		display: flex;
		margin-bottom: 8px;
	}
	.upcoming-match-date {
		text-align: center;
		margin: 0.9em 0 0.4em 0;
	}
	.fixtures-title,
	.standings-title,
	.upcoming-title {
		font-size: 2em;
		font-weight: 800;
		text-align: center;
	}

	.upcoming-match-time-container {
		display: grid;
		place-items: center;
		position: absolute;
		margin-top: -31px;
		width: 100%;
	}
	.upcoming-match-time {
		background: #ffffffa1;
		padding: 1px 4px;
		border-radius: 2px;
		font-size: 13px;
		text-align: right;
	}
	.upcoming-match-teams {
		display: flex;
		flex-grow: 1;
	}
	.upcoming-match-home,
	.upcoming-match-away {
		flex: 1;
		padding: 4px 10px;
	}
	.upcoming-match-home {
		border-radius: 4px 0 0 4px;
	}
	.upcoming-match-away {
		text-align: right;
		border-radius: 0 4px 4px 0;
	}
	.standings-container {
		flex-grow: 1;
		margin: 0 40px 0 40px;
	}
	.standings {
		margin: 10px auto 0;
	}
	.table-row {
		display: flex;
		padding: 4px 20px 4px 10px;
		border-radius: 4px;
	}
	.standings-position {
		width: 20px;
		margin-right: 15px;
		text-align: right;
	}
	.standings-team-name {
		width: 210px;
	}
	.bold {
		font-weight: 800;
	}
	.standings-won,
	.standings-drawn,
	.standings-lost {
		flex: 1;
		text-align: right;
	}
	.standings-gf,
	.standings-ga,
	.standings-gd {
		flex: 1;
		text-align: right;
	}
	.standings-rating,
	.standings-form,
	.standings-played,
	.standings-points {
		flex: 1;
		text-align: right;
	}
	.standings-points {
		margin-right: 10%;
	}
	.grey-row {
		background: rgb(236, 236, 236);
	}
	.cl {
		background: rgba(0, 254, 135, 0.6);
	}
	.cl.grey-row {
		background: rgb(0, 254, 135, 1);
	}
	.el {
		background: rgba(17, 182, 208, 0.7);
		background: rgba(2, 238, 255, 0.6);
	}
	.el.grey-row {
		background: rgba(17, 182, 208, 1);
		background: #02eeff;
	}
	.relegation {
		background: rgba(248, 48, 39, 0.7);
	}
	.relegation.grey-row {
		background: rgb(248, 48, 39, 1);
	}
	.fixtures {
		position: relative;
		width: calc(100vw - 230px);
	}
	.fixtures-table {
		display: flex;
		margin: 20px 30px 0 30px;
	}
	.fixtures-matches-container {
		overflow-x: scroll;
		display: block;
	}
	.fixtures-teams-container {
		margin-top: 25px;
	}
	.fixtures-table-row {
		display: flex;
	}
	.fixtures-team {
		min-width: 60px;
		text-align: center;
		border-right: 2px solid black;
		border-left: 2px solid black;
	}
	.fixtures-matches {
		display: flex;
	}
	.fixtures-team,
	.match {
		padding: 3px 8px;
	}
	.match {
		text-align: center;
		width: 60px;
		border-bottom: 2px solid black;
	}
	.fixtures-team {
		border-bottom: 2px solid black;
	}
	.scale-btns {
		position: absolute;
		top: 6px;
		right: 30px;
		display: flex;
	}
	.scale-team-ratings,
	.scale-team-form {
		padding: 5px 0;
	}
	.scale-team-ratings {
		padding-right: 10px;
	}
	.scaling-selected {
		background: var(--purple);
		color: var(--green);
	}
	.scale-btn {
		border-radius: 4px;
		cursor: pointer;
	}

	@media only screen and (max-width: 1200px) {
		.fixtures {
			width: 100vw;
		}
		.standings-points {
			margin: 0;
		}
	}
</style>
