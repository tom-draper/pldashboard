<script>
  import SeasonComplete from "./SeasonComplete.svelte";
  import NextGameStats from "./NextGameStats.svelte";

  export let data, currentMatchday, team, showBadge, getAlias, switchTeam;
</script>

{#if data != undefined}
  {#if data.upcoming[team].nextTeam == null}
    <SeasonComplete {data} />
  {:else}
    <NextGameStats {data} {currentMatchday} {team} {showBadge} {getAlias} {switchTeam}/>
  {/if}
{/if}
