<script lang="ts">
	import type { FantasyPlayer } from './fantasy.types';
	import { teamToCSS } from '$lib/team';

	const { players }: { players: FantasyPlayer[] } = $props();

	const forwards = $derived((players ?? []).filter((player) => player.position === 'Forward'));
	const midfielders = $derived(
		(players ?? []).filter((player) => player.position === 'Midfielder')
	);
	const defenders = $derived((players ?? []).filter((player) => player.position === 'Defender'));
	const goalkeepers = $derived(
		(players ?? []).filter((player) => player.position === 'Goalkeeper')
	);

	const totalPoints = $derived(
		(players ?? []).reduce((sum, player) => sum + player.totalPoints, 0)
	);
	const totalPrice = $derived((players ?? []).reduce((sum, player) => sum + player.price, 0));

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

	{#each [goalkeepers, defenders, midfielders, forwards] as line, lineIndex (lineIndex)}
		<div class="flex justify-center p-[1em]">
			{#each line as player, playerIndex (playerIndex)}
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
