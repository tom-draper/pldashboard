<script lang="ts">
	import { onMount } from 'svelte';
	import type { FantasyData, Page, Team } from './fantasy.types';

	type TableRow = (string | number)[];

	function teamToCSS(team: string) {
		switch (team) {
			case 'Spurs':
				return 'tottenham-hotspur';
			case "Nott'm Forest":
				return 'nottingham-forest';
			case 'Man Utd':
				return 'manchester-united';
			case 'Man City':
				return 'manchester-city';
			case 'Brighton':
				return 'brighton-and-hove-albion';
			case 'Luton':
				return 'luton-town';
			case 'West Ham':
				return 'west-ham-united';
			case 'Sheffield Utd':
				return 'sheffield-united';
			case 'Wolves':
				return 'wolverhampton-wanderers';
			case 'Newcastle':
				return 'newcastle-united';
		}
		return team.toLowerCase().replace(' ', '-');
	}

	function buildTeamColorCSSTags() {
		const playerTeams: {[player: string]: Team} = {};
		const teamCSS: {[team in Team]?: string} = {};
		for (const name in data) {
			if (name === '_id') {
				continue;
			}
			const team = data[name].team;
			const fullName = `${data[name].firstName} ${data[name].surname}`;
			playerTeams[fullName] = team;
			teamCSS[team] = teamToCSS(team);
		}
		playerToTeam = playerTeams;
		teamCSSTag = teamCSS;
	}

	function abbrNum(num: number, decPlaces: number): string {
		// 2 decimal places => 100, 3 => 1000, etc
		decPlaces = Math.pow(10, decPlaces);

		// Enumerate number abbreviations
		const abbrev = ['k', 'm', 'b', 't'];

		// Go through the array backwards, so we do the largest first
		for (let i = abbrev.length - 1; i >= 0; i--) {
			// Convert array index to "1000", "1000000", etc
			const size = Math.pow(10, (i + 1) * 3);

			// If the number is bigger or equal do the abbreviation
			if (size <= num) {
				// Here, we multiply by decPlaces, round, and then divide by decPlaces.
				// This gives us nice rounding to a particular decimal place.
				num = Math.round((num * decPlaces) / size) / decPlaces;

				// Handle special case where we round up to the next abbreviation
				if (num == 1000 && i < abbrev.length - 1) {
					num = 1;
					i++;
				}

				return num.toString() + abbrev[i];
			}
		}
		return num.toString();
	}

	function getTableRows(data: FantasyData): TableRow[] {
		const tableRows: TableRow[] = [];
		for (const name in data) {
			if (name === '_id') {
				continue;
			}
			const player = [
				`${data[name].firstName} ${data[name].surname}`,
				`£${data[name].price / 10}`,
				data[name].totalPoints,
				data[name].minutes,
				data[name].pointsPerGame,
				data[name].minutes > 0
					? parseFloat((data[name].points / (data[name].minutes / 90)).toFixed(1))
					: 0,
				data[name].form,
				data[name].goals,
				data[name].assists,
				data[name].cleanSheets,
				data[name].saves,
				data[name].bonusPoints,
				data[name].transferIn,
				data[name].transferOut
			];
			tableRows.push(player);
		}

		return tableRows;
	}

	function buildTable(data: FantasyData) {
		const tableRows = getTableRows(data);

		// @ts-ignore
		table = new DataTable('#myTable', {
			responsive: true,
			data: tableRows,
			paging: false,
			columnDefs: [
				{
					targets: 0,
					createdCell: function (
						td: HTMLTableCellElement,
						cellData: Team,
						rowData,
						row: number,
						col: number
					) {
						const team = playerToTeam[cellData];
						const teamID = teamCSSTag[team];
						td.style.background = `var(--${teamID})`;
						td.style.color = `var(--${teamID}-secondary)`;
						td.title = team;
					}
				},
				{
					targets: 12,
					render: function (data, type, row, meta) {
						// If render is just displaying value to user, format as abbreviated number
						if (type === 'display') {
							return data ? abbrNum(data, 1) : 0;
						}
						// Otherwise return raw data so that sort and filter still works
						return data;
					}
				}
			]
		});

		table.order([2, 'desc']).draw();
	}

	function refreshTable(data: FantasyData) {
		if (!setup) {
			return
		}

		buildTeamColorCSSTags();
		const tableRows = getTableRows(data);

		table.clear();
		table.rows.add(tableRows);
		table.draw();
	}

	let table;
	let playerToTeam: {[player: string]: Team};
	let teamCSSTag: {[team in Team]?: string};
	let setup = false;
	onMount(() => {
		buildTeamColorCSSTags();
		buildTable(data);
		setup = true;
	});

	$: page && refreshTable(data);

	export let data: FantasyData, page: Page;
</script>

<div class="table">
	<table id="myTable">
		<thead>
			<tr>
				<th>Name</th>
				<th>Price</th>
				<th>Points</th>
				<th>Minutes</th>
				<th>Points per Game</th>
				<th>Points per 90</th>
				<th>Form</th>
				<th>Goals</th>
				<th>Assists</th>
				<th>Clean Sheets</th>
				<th>Saves</th>
				<th>Bonus</th>
				<!-- <th>Yellow Cards</th>
        <th>Red Cards</th> -->
				<th>Transfers In</th>
				<th>Transfers Out</th>
			</tr>
		</thead>
		<tbody />
	</table>
</div>

<style scoped>
	.table {
		padding: 50px 30px;
		overflow-x: auto;
	}

	#myTable {
		width: 100% !important;
		/* min-width: 2000px; */
	}

	:global(tr.even) {
		background: rgb(239, 239, 239) !important;
	}

	@media only screen and (max-width: 700px) {
		.table {
			padding: 0;
			font-size: 0.85em;
		}
	}
</style>
