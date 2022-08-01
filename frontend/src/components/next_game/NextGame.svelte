<script>
  import SeasonComplete from "./SeasonComplete.svelte";
  import NextGameStats from "./NextGameStats.svelte";

  export let data, currentMatchday, fullTeamName, showBadge;
</script>

{#if data != undefined}
  {#if data.upcoming[fullTeamName].nextTeam == null}
    <SeasonComplete {data} />
  {:else}
    <NextGameStats {data} {currentMatchday} {fullTeamName} {showBadge} />
  {/if}
{/if}
