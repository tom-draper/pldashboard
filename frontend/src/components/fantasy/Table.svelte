<script lang="ts">
  import { onMount } from "svelte";

  function buildTable(data) {
    let headings = ["Player"];
  }

  function clearTable() {}

  function refreshTable(data) {
    clearTable();
    buildTable(data);
  }

  let setup = false;
  onMount(() => {
    buildTable(data);

    let table = new DataTable("#myTable", {
      responsive: true,
    });

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
      <tbody>
        <tr>
          <td>Row 1 Data 1</td>
          <td>Row 1 Data 2</td>
          <td>Row 1 Data 2</td>
          <td>Row 1 Data 2</td>
          <td>Row 1 Data 2</td>
          <td>Row 1 Data 2</td>
          <td>Row 1 Data 2</td>
        </tr>
        <tr>
          <td>Row 2 Data 1</td>
          <td>Row 2 Data 2</td>
          <td>Row 2 Data 2</td>
          <td>Row 2 Data 2</td>
          <td>Row 2 Data 2</td>
          <td>Row 2 Data 2</td>
          <td>Row 2 Data 2</td>
        </tr>
      </tbody>
    </table>
</div>

<style scoped>
    .table {
        padding: 80px 50px;
    }
</style>