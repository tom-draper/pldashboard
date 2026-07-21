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
	let totalPrice: number = 0;

	function formatPrice(price: number): string {
		return (
			(price / 10).toLocaleString('en-GB', {
				style: 'currency',
				currency: 'GBP',
				minimumFractionDigits: 1
			}) + 'm'
		);
	}

	function formatTotalPrice(price: number): string {
		return (
			(price / 10).toLocaleString('en-GB', {
				style: 'currency',
				currency: 'GBP',
				minimumFractionDigits: 0,
				maximumFractionDigits: 1
			}) + 'm'
		);
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
		totalPrice = players.reduce((sum, player) => sum + player.price, 0);
	});
</script>

<div
	class="relative m-[2em] rounded-[6px] p-[1em] pb-[3em] bg-[repeating-linear-gradient(to_bottom,#00fe87,#00fe87_20px,#00e178_20px,#00e178_40px)]"
>
	<div
		class="absolute top-[1em] left-[1em] rounded-[6px] bg-[var(--purple)] px-[0.75em] py-[0.55em] text-left"
	>
		<div class="text-[1em] leading-[1.2] text-[var(--green)]">Optimal team</div>
		<div class="mt-[0.25em] text-[0.9em] leading-[1.2] text-white">
			{totalPoints.toLocaleString('en-GB')} points, {formatTotalPrice(totalPrice)}
		</div>
	</div>

	{#each [goalkeepers, defenders, midfielders, forwards] as line}
		<div class="flex justify-center p-[1em]">
			{#each line as player}
				<div>
					<div
						class="mx-[0.5em] rounded-[4px] px-[1em] py-[0.6em] text-center"
						style="color: var(--{teamToCSS(player.team)}-secondary); background: var(--{teamToCSS(
							player.team
						)})"
					>
						{player.firstName}
						{player.surname}
					</div>
					<div class="mt-[0.4em] text-center">{formatPrice(player.price)}</div>
				</div>
			{/each}
		</div>
	{/each}
</div>
