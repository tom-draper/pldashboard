<script lang="ts">
  import { onMount } from 'svelte';
  import type { FantasyData, Page } from '../../lib/fantasy.types';

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

  function buildTeamColourCSSTags() {
    const playerTeams = {};
    const teamCSS = {};
    for (const name of Object.keys(data)) {
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

  function getTableRows(data: FantasyData): TableRow[] {
    const tableRows: TableRow[] = [];
    for (const name of Object.keys(data)) {
      if (name === '_id') {
        continue;
      }
      // console.log(name, data[name].points, data[name].minutes, data[name].minutes/90, data[name].points / (data[name].minutes/90))
      const player = [
        `${data[name].firstName} ${data[name].surname}`,
        `£${data[name].price / 10}`,
        data[name].totalPoints,
        data[name].minutes,
        data[name].pointsPerGame,
        data[name].minutes > 0
          ? parseFloat(
              (data[name].points / (data[name].minutes / 90)).toFixed(1)
            )
          : 0,
        data[name].form,
        data[name].goals,
        data[name].assists,
        data[name].cleanSheets,
        data[name].saves,
        data[name].bonusPoints,
        // data[team].yellowCards,
        // data[team].redCards,
        data[name].transferIn.toLocaleString(),
        data[name].transferOut.toLocaleString(),
      ];
      tableRows.push(player);
    }

    return tableRows;
  }

  function buildTable(data: FantasyData) {
    let tableRows = getTableRows(data);

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
            cellData,
            rowData,
            row: number,
            col: number
          ) {
            const team = playerToTeam[cellData];
            td.style.background = `var(--${teamCSSTag[team]})`;
            td.style.color = `var(--${teamCSSTag[team]}-secondary)`;
            td.title = team;
          },
        },
      ],
    });

    table.order([2, 'desc']).draw();
  }

  function refreshTable(data: FantasyData) {
    if (setup) {
      buildTeamColourCSSTags();
      let tableRows = getTableRows(data);

      table.clear();
      table.rows.add(tableRows);
      table.draw();
    }
  }

  let table;
  let playerToTeam;
  let teamCSSTag;
  let setup = false;
  onMount(() => {
    buildTeamColourCSSTags();
    buildTable(data);
    setup = true;
  });

  $: page && refreshTable(data);
  //   $: !mobileView && setDefaultLayout();
  //   $: setup && mobileView && setMobileLayout();

  export let data: FantasyData, page: Page, mobileView: boolean;
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
