<script lang="ts">
  import { onMount } from "svelte";
  import type { FantasyData, Page } from "../../lib/fantasy.types"

  type TableRow = (string | number)[]

  function getTableRows(data: FantasyData): TableRow[] {
    let tableRows: TableRow[] = [];
    for (let team of Object.keys(data)) {
      if (team === "_id") {
        continue;
      }
      let player = [
       `${data[team].firstName} ${data[team].surname}`,
        `£${data[team].price/10}`,
        data[team].points,
        data[team].minutes,
        data[team].goals,
        data[team].assists,
        data[team].cleanSheets,
        data[team].saves,
        data[team].form,
        data[team].bonusPoints,
        // data[team].yellowCards,
        // data[team].redCards,
        data[team].pointsPerGame,
        data[team].points / (data[team].minutes/90),
        data[team].transferIn,
        data[team].transferOut
      ];
      tableRows.push(player);
    }

    return tableRows;
  }

  function buildTable(data: FantasyData) {
    let tableRows = getTableRows(data);

    table = new DataTable("#myTable", {
      responsive: true,
      data: tableRows,
      paging: false,
    });

    table.order([2, 'desc']).draw();
  }

  function refreshTable(data: FantasyData) {
    if (setup) {
      let tableRows = getTableRows(data);

      table.clear();
      table.rows.add(tableRows);
      table.draw();
    }
  }

  let table;
  let setup = false;
  onMount(() => {
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
        <th>Goals</th>
        <th>Assists</th>
        <th>Clean Sheets</th>
        <th>Saves</th>
        <th>Form</th>
        <th>Bonus</th>
        <!-- <th>Yellow Cards</th>
        <th>Red Cards</th> -->
        <th>Points per Game</th>
        <th>Points per 90</th>
        <th>Transfers In</th>
        <th>Transfers Out</th>
      </tr>
    </thead>
    <tbody />
  </table>
</div>

<style scoped>
  .table {
    padding: 80px 50px;
    overflow-x: auto;
  }
  #myTable {
    width: 100% !important;
    min-width: 2000px;
  }

</style>
