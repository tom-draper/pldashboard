<script lang="ts">
	import { onMount } from 'svelte';
	import type { FantasyPlayer } from './fantasy.types';

	export let players: FantasyPlayer[];

	let forwards: FantasyPlayer[] = [];
	let midfielders: FantasyPlayer[] = [];
	let defenders: FantasyPlayer[] = [];
	let goalkeepers: FantasyPlayer[] = [];

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

	onMount(() => {
        console.log(players);
        if (!players) {
            return;
        }

		// Initialize players by position
		forwards = players.filter((player) => player.position === 'Forward');
		midfielders = players.filter((player) => player.position === 'Midfielder');
		defenders = players.filter((player) => player.position === 'Defender');
		goalkeepers = players.filter((player) => player.position === 'Goalkeeper');
	});


</script>

<div id="pitch">
	<div class="formation">
        {#each goalkeepers as player}
            <div class="player goalkeeper" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
        {/each}
    </div>

	<div class="formation">
        {#each defenders as player}
            <div class="player goalkeeper" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
        {/each}
    </div>

	<div class="formation">
        {#each midfielders as player}
            <div class="player midfielder" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
        {/each}
    </div>

	<div class="formation">
        {#each forwards as player}
            <div class="player forward" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
        {/each}
    </div>
</div>

<style scoped>
	#pitch {
        margin: 2em;
        border-radius: 6px;
		background: repeating-linear-gradient(
			to bottom,
			#3f9e4d,
			/* darker green */ #3f9e4d 20px,
			#4caf50 20px,
			/* lighter green */ #4caf50 40px
		);
        padding: 1em;
        padding-bottom: 5em;
	}
    .formation {
        display: flex;
        justify-content: center;
        padding: 1em;
        z-index: 12;
    }

    .player {
        background: #fff;
        border-radius: 4px;
        padding: 0.5em 1em;
        margin: 0 0.5em;
    }
</style>
