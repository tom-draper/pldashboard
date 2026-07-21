<script lang="ts">
	import { onMount } from 'svelte';
	import Footer from '$lib/components/Footer.svelte';
	import type { PredictionsV2Data } from './predictions-v2.types';
	import live from '$lib/images/live.svg';

	let timeoutId: ReturnType<typeof setTimeout>;

	function updateCountdowns() {
		const updatedCountdowns = Array(data.matches.length);
		for (let i = 0; i < data.matches.length; i++) {
			const kickoff = data.matches[i].kickoff;
			if (kickoff !== null) {
				updatedCountdowns[i] = getCountdown(kickoff);
			} else {
				updatedCountdowns[i] = '';
			}
		}
		countdowns = updatedCountdowns;
		timeoutId = setTimeout(updateCountdowns, 1000);
	}

	function getCountdown(kickoff: Date) {
		const now = new Date();
		const timeDiff = kickoff.getTime() - now.getTime();

		const seconds = Math.floor(timeDiff / 1000);
		const minutes = Math.floor(seconds / 60);

		if (timeDiff < 0) {
			if (minutes < -45 && minutes > -60) {
				return 'HT';
			} else if (minutes > -90) {
				return `${-minutes}'`;
			}
			return 'Finished';
		}

		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		const countdown = countdownString(days, hours, minutes, seconds);
		return countdown;
	}

	function countdownString(days: number, hours: number, minutes: number, seconds: number) {
		let countdown = '';
		if (days) {
			countdown += `${days}d `;
		}
		if (hours) {
			countdown += `${hours % 24}h `;
		}
		if (minutes) {
			countdown += `${minutes % 60}m `;
		}
		countdown += `${seconds % 60}s`;
		return countdown;
	}

	export let data: PredictionsV2Data;

	let countdowns = Array(data.matches.length).fill('');
	$: countdowns;

	const barBase = 'mb-[0.3em] flex h-[12px]';

	onMount(() => {
		updateCountdowns();
		return () => clearTimeout(timeoutId);
	});
</script>

<div class="min-h-screen bg-[rgb(10,0,8)] text-white">
	<div class="px-[15px] py-[12px] text-center">
		<div
			class="flex place-content-center place-items-center px-[1em] py-[0.8em] text-[2.5rem] font-semibold max-[550px]:text-[1.8em]"
		>
			<div><span class="text-[var(--green)]">pl</span>dashboard</div>
			<div
				class="ml-[0.5ch] bg-[linear-gradient(#bc0cf1,#d40404)] bg-clip-text text-[1.05em] text-transparent"
			>
				AI
			</div>
		</div>
		<div>Real-time football predictions from our ground-breaking intelligent model.</div>
	</div>

	<div class="mx-auto my-[10vh]">
		{#if data.matches.length > 0}
			{#each data.matches as prediction, i}
				<div
					class="mx-auto my-[2em] max-w-[28em] rounded-[4px] bg-[rgb(37,1,30)] px-[1.6em] py-[1em]"
				>
					<div class="mb-[0.5em] flex justify-between">
						<div>{prediction._id}</div>

						<img
							src={live}
							alt="Live"
							class="mt-[-44px] mr-[-50px] mb-[-50px] inline-block h-[80px] w-[80px]"
						/>
						<div class="grow text-right">{countdowns[i]}</div>
					</div>
					<div class="mt-[0.2em] mb-[0.3em] text-[1.6em]">
						{#if prediction.odds[prediction.odds.length - 1].prediction.value === 1}
							Home win
						{:else if prediction.odds[prediction.odds.length - 1].prediction.value === 0}
							Draw
						{:else}
							Away win
						{/if}
					</div>
					<div>
						<div class={barBase}>
							<div
								class="{barBase} rounded-l-[2px] bg-[var(--green)]"
								style="width: {prediction.odds[prediction.odds.length - 1].prediction
									.probability[0] * 100}%"
								title="{(
									prediction.odds[prediction.odds.length - 1].prediction.probability[0] * 100
								).toFixed(2)}% home win"
							></div>
							<div
								class="{barBase} bg-white"
								style="width: {prediction.odds[prediction.odds.length - 1].prediction
									.probability[1] * 100}%"
								title="{(
									prediction.odds[prediction.odds.length - 1].prediction.probability[1] * 100
								).toFixed(2)}% draw"
							></div>
							<div
								class="{barBase} rounded-r-[2px] bg-[var(--pink)]"
								style="width: {prediction.odds[prediction.odds.length - 1].prediction
									.probability[2] * 100}%"
								title="{(
									prediction.odds[prediction.odds.length - 1].prediction.probability[2] * 100
								).toFixed(2)}% away win"
							></div>
						</div>
					</div>
				</div>
			{/each}
		{:else}
			<div class="mx-auto w-fit rounded-[4px] bg-[rgb(53,2,43)] px-[2em] py-[5em] text-center">
				No live predictions available. Check back closer to the game.
			</div>
		{/if}
	</div>
	<div class="bg-[rgb(10,0,8)] text-center text-white opacity-40">362 games, 61% accuracy</div>
</div>
<div class="bg-[rgb(10,0,8)]">
	<Footer lastUpdated={null} dark={true} />
</div>
