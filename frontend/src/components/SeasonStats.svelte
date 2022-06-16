<script>
  import { onMount } from "svelte";

  function ordinal(n) {
    var ord = [, "st", "nd", "rd"];
    var a = n % 100;
    return n + (ord[a > 20 ? a % 10 : a] || "th");
  }

  function getStatsRank(data, attribute, fullTeamName, reverse) {
    let sorted = Object.keys(data.seasonStats).sort(function (a, b) {
      return data.seasonStats[b][attribute] - data.seasonStats[a][attribute];
    });
    let rank = sorted.indexOf(fullTeamName) + 1;
    if (reverse) {
      rank = 21 - rank;
    }
    return rank;
  }

  function getStatsRankings(data, fullTeamName) {
    let xGRank = ordinal(getStatsRank(data, "xG", fullTeamName, false));
    // Reverse - lower rank the better
    let xCRank = ordinal(getStatsRank(data, "xC", fullTeamName, true));
    let cleanSheetRatioRank = ordinal(
      getStatsRank(data, "cleanSheetRatio", fullTeamName, false)
    );
    return { xG: xGRank, xC: xCRank, cleanSheetRatio: cleanSheetRatioRank };
  }

  function setPositionalOffset() {
    document.documentElement.style.setProperty(
      "--ssp1-offset",
      -ssp1.clientWidth / 2 + "px"
    );
    document.documentElement.style.setProperty(
      "--ssp2-offset",
      -ssp2.clientWidth / 2 + "px"
    );
    document.documentElement.style.setProperty(
      "--ssp3-offset",
      -ssp3.clientWidth / 2 + "px"
    );
  }

  let ssp1, ssp2, ssp3;
  let rank = {
    xG: "",
    xC: "",
    cleanSheetRatio: ""
  };
  onMount(() => {
    rank = getStatsRankings(data, fullTeamName);

    // Keep ordinal values at the correct offset
    window.addEventListener("resize", setPositionalOffset);
    // Once rank values have updated, init positional offset for ordinal values
    setTimeout(function () {
      setPositionalOffset();
    }, 0)
  });

  export let data, fullTeamName;
</script>

<div class="season-stats">
  <div class="season-stat goals-per-game">
    <div class="season-stat-value">
      {data.seasonStats[fullTeamName].xG}
      <div
      class="season-stat-position ssp-{rank.xG}"
      id="ssp1"
      bind:this={ssp1}
      >
          {rank.xG}
        </div>
      </div>
      <div class="season-stat-text">goals per game</div>
    </div>
    <div class="season-stat conceded-per-game">
      <div class="season-stat-value">
        {data.seasonStats[fullTeamName].xC}
        <div
          class="season-stat-position ssp-{rank.xC}"
          id="ssp2"
          bind:this={ssp2}
        >
          {rank.xC}
        </div>
      </div>
      <div class="season-stat-text">conceded per game</div>
    </div>
    <div class="season-stat clean-sheet-ratio">
      <div class="season-stat-value">
        {data.seasonStats[fullTeamName].cleanSheetRatio}
        <div
          class="season-stat-position ssp-{rank.cleanSheetRatio}"
          id="ssp3"
          bind:this={ssp3}
        >
          {rank.cleanSheetRatio}
        </div>
      </div>
      <div class="season-stat-text">clean sheets</div>
    </div>
</div>
