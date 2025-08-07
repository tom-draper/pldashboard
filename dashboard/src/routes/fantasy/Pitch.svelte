<script lang="ts">
	import { onMount } from 'svelte';
	import type { FantasyPlayer } from './fantasy.types';
	import { teamToCSS } from '$lib/team';

	export let players: FantasyPlayer[];

	let forwards: FantasyPlayer[] = [];
	let midfielders: FantasyPlayer[] = [];
	let defenders: FantasyPlayer[] = [];
	let goalkeepers: FantasyPlayer[] = [];

    let totalPoints: number = 0;

    function formatPrice(price: number): string {
        return (price/10).toLocaleString('en-GB', {
            style: 'currency',
            currency: 'GBP',
            minimumFractionDigits: 1
        }) + 'm';
    }

	onMount(() => {
        if (!players) {
            return;
        }

		// Initialize players by position
		forwards = players.filter((player) => player.position === 'Forward');
		midfielders = players.filter((player) => player.position === 'Midfielder');
		defenders = players.filter((player) => player.position === 'Defender');
		goalkeepers = players.filter((player) => player.position === 'Goalkeeper');

        totalPoints = players.reduce((sum, player) => sum + player.totalPoints, 0);
	});
</script>

<div id="pitch">
	<div class="formation">
        {#each goalkeepers as player}
        <div>
            <div class="player goalkeeper" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
            <div class="price">{formatPrice(player.price)}</div>
        </div>
        {/each}
    </div>

	<div class="formation">
        {#each defenders as player}
        <div>
            <div class="player goalkeeper" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
            <div class="price">{formatPrice(player.price)}</div>
        </div>
        {/each}
    </div>

	<div class="formation">
        {#each midfielders as player}
            <div>
                <div class="player midfielder" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
                <div class="price">{formatPrice(player.price)}</div>
            </div>
        {/each}
    </div>

	<div class="formation">
        {#each forwards as player}
        <div>
            <div class="player forward" style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(player.team)})">{player.firstName} {player.surname}</div>
            <div class="price">{formatPrice(player.price)}</div>
        </div>
        {/each}
    </div>

    <div class="total-points">
        Total points: {totalPoints.toLocaleString('en-GB')}
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
		background: repeating-linear-gradient(
			to bottom,
			#00fe87,
			/* darker green */ #00fe87 20px,
			#00e178 20px,
			/* #00ce6e 20px, */
			/* lighter green */ #00e178 40px
		);
        padding: 1em;
        padding-bottom: 3em;
        position: relative;
	}
    .formation {
        display: flex;
        justify-content: center;
        padding: 1em;
        z-index: 12;
    }

    .price {
        margin-top: 0.4em;
        text-align: center;
    }

    .player {
        background: #fff;
        border-radius: 4px;
        padding: 0.6em 1em;
        margin: 0 0.5em;
        text-align: center;
    }
    .total-points {
        position: absolute;
        text-align: center;
        font-size: 1em;
        margin-top: 1em;
        right: 1em;
        top: 0;
        color: #333;
    }
</style>
