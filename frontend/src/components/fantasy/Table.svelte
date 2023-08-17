<script lang="ts">
  import { onMount } from "svelte";

  function getTableRows(data) {
    let tableRows = [];
    for (let team of Object.keys(data)) {
      if (team === "_id") {
        continue;
      }
      let player = [
        team,
        data[team].points,
        data[team].minutes,
        data[team].goals,
        data[team].assists.toString(),
        data[team].cleanSheets.toString(),
        data[team].saves.toString(),
      ];
      tableRows.push(player);
    }

    return tableRows;
  }

  function buildTable(data) {
    // Find a <table> element with id="myTable":
    let tableRows = getTableRows(data);

    table = new DataTable("#myTable", {
      responsive: true,
      data: tableRows,
      paging: false,
    });

    console.log(tableRows);
  }

  function refreshTable(data) {
    if (setup) {
      // clearTable();
      // buildTable(data);
      let tableRows = getTableRows(data);

      table.clear();
      table.rows.add(tableRows);
      table.draw();
    }
  }

  let tableDiv: HTMLTableElement;
  let table;
  let setup = false;
  onMount(() => {
    buildTable(data);

    // let table = new DataTable("#myTable", {
    //   responsive: true,
    //   data:
    // });

    setup = true;
  });

  $: page && refreshTable(data);
  //   $: !mobileView && setDefaultLayout();
  //   $: setup && mobileView && setMobileLayout();

  export let data: any, page: string, mobileView: boolean;
</script>

<div class="table">
  <table id="myTable" class="display">
    <thead>
      <tr>
        <th>Name</th>
        <th>Points</th>
        <th>Minutes</th>
        <th>Goals</th>
        <th>Assists</th>
        <th>Clean Sheets</th>
        <th>Saves</th>
      </tr>
    </thead>
    <tbody />
  </table>
</div>

<style scoped>
  .table {
    padding: 80px 50px;
  }
</style>
