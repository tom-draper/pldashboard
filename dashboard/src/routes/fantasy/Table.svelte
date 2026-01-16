<script lang="ts">
	import { onMount } from 'svelte';
	import type { FantasyData, Page, Team } from './fantasy.types';
	import { teamToCSS } from '$lib/team';
	import type { TeamsData } from '../[team]/dashboard.types';

	type TableRow = (string | number)[];

	function buildTeamColorCSSTags() {
		const playerTeams: { [player: string]: Team } = {};
		const teamCSS: { [team in Team]?: string } = {};
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
					? parseFloat((data[name].totalPoints / (data[name].minutes / 90)).toFixed(1))
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
						rowData: any,
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
					targets: 3,
					render: function (data: any, type: string, row: any, meta: any) {
						// If render is just displaying value to user, format as abbreviated number
						if (type === 'display') {
							return data ? data.toLocaleString() : 0;
						}
						// Otherwise return raw data so that sort and filter still works
						return data;
					}
				},
				{
					targets: 1,
					render: function (data: any, type: string, row: any, meta: any) {
						// If render is just displaying value to user, format as abbreviated number
						if (type === 'display') {
							return data ? data.toLocaleString() + "m" : 0;
						}
						// Otherwise return raw data so that sort and filter still works
						return data;
					}
				},
				{
					targets: [4, 5, 6],
					render: function (data: any, type: string, row: any, meta: any) {
						// If render is just displaying value to user, format as abbreviated number
						if (type === 'display') {
							return data ? parseFloat(data).toFixed(1) : 0;
						}
						// Otherwise return raw data so that sort and filter still works
						return data;
					}
				},
				{
					targets: [12, 13],
					render: function (data: any, type: string, row: any, meta: any) {
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
			return;
		}

		buildTeamColorCSSTags();
		const tableRows = getTableRows(data);

		table.clear();
		table.rows.add(tableRows);
		table.draw();
	}

	function loadScript(src: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = src;
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
			document.head.appendChild(script);
		});
	}

	function loadStyle(href: string): void {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		document.head.appendChild(link);
	}

	let table: any;
	let playerToTeam: { [player: string]: Team };
	let teamCSSTag: { [team in Team]?: string };
	let setup = false;

	onMount(async () => {
		try {
			loadStyle('https://cdn.datatables.net/1.13.6/css/jquery.dataTables.css');

			await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.0/jquery.min.js');
			await loadScript('https://cdn.datatables.net/1.13.6/js/jquery.dataTables.js');
		} catch (err) {
			console.error('Error loading DataTables:', err);
		}

		buildTeamColorCSSTags();
		buildTable(data);
		setup = true;
	});

	$: page && refreshTable(data);

	export let data: FantasyData, page: Page;
</script>

{#if !setup}
	<div class="loading-spinner-container">
		<div class="loading-spinner"></div>
	</div>
{/if}
<div class="table" class:hidden={!setup}>
	<table id="myTable">
		<thead>
			<tr>
				<th>Name</th>
				<th>Price</th>
				<th>Points</th>
				<th>Minutes</th>
				<th>Points/Game</th>
				<th>Points/90'</th>
				<th>Form</th>
				<th>Goals</th>
				<th>Assists</th>
				<th>Clean Sheets</th>
				<th>Saves</th>
				<th>Bonus</th>
				<th>Transfers In</th>
				<th>Transfers Out</th>
			</tr>
		</thead>
		<tbody></tbody>
	</table>
</div>

<style scoped>
	.table {
		padding: 50px 30px;
		overflow-x: auto;
	}

	.hidden {
		visibility: hidden;
	}

	#myTable {
		width: 100% !important;
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
