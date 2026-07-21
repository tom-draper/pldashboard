<script lang="ts">
	import type { PredictionsData } from './predictions.types';

	function toggleDetailsDisplay(id: string) {
		const prediction = document.getElementById(id);
		if (prediction !== null) {
			prediction.classList.toggle('expanded');
		}
	}

	function datetimeToTime(datetime: string): string {
		const date = new Date(datetime);
		return date.toTimeString().slice(0, 5);
	}

	export let data: PredictionsData;

	const itemClass = 'flex text-left mx-[8%] max-[550px]:mx-[6%]';
	const valueClass =
		'flex flex-[4.5] text-right max-[800px]:flex-[4] max-[500px]:flex-[4.5] max-[400px]:flex-[6]';
</script>

<div class="max-[550px]:text-[0.9em]">
	<div class="px-[40px] pt-[40px] text-center">
		<a
			class="m-[10px] flex-auto self-center text-[2.6em] font-extrabold tracking-[-1px] text-[#333] no-underline max-[550px]:text-[2em]"
			href="/predictions">Predictions</a
		>
	</div>

	<div class="text-[1.3em] max-[550px]:overflow-x-hidden">
		<div class="text-center text-[13px] max-[550px]:text-[0.8rem]">
			<div class="mt-[1em] mb-[2.5em]">
				<span class="text-[rgb(120,120,120)] mb-[5px]">
					Predicting with accuracy: <b>{(data.accuracy.scoreAccuracy * 100).toFixed(2)}%</b></span
				><br />
				<div class="text-[rgb(120,120,120)] mb-[5px]">
					General results accuracy: <b>{(data.accuracy.resultAccuracy * 100).toFixed(2)}%</b>
				</div>
			</div>
		</div>

		<div class="mx-auto w-1/2 max-[800px]:w-[80%] max-[550px]:w-[90%]">
			<div class="flex flex-col">
				{#if data.predictions != null}
					{#each data.predictions as { _id, predictions }}
						<div class="mb-[2px] w-[min(90%,300px)] self-center text-center text-[1.2rem]">
							{_id}
						</div>
						<div
							class="mb-[2px] w-[min(100%,375px)] self-center border-b-[3px] border-b-black"
						></div>
						<!-- Each prediction on this day -->
						{#each predictions as pred}
							<button
								class="relative mx-0 my-[2px] w-[min(90%,300px)] self-center cursor-pointer rounded-[var(--border-radius)] border-none px-0 pt-[6px] pb-[3px] text-[16px] text-inherit [outline:inherit] max-[800px]:w-[min(80%,300px)] max-[550px]:w-[80%] {pred.color}"
								on:click={() => toggleDetailsDisplay(pred._id)}
							>
								<div class={itemClass}>
									<div class="flex-[5]">Predicted:</div>
									<div class={valueClass}>
										<div class="flex-1 text-center">{pred.home}</div>
										<div class="flex-1 text-center">
											{Math.round(pred.prediction.homeGoals)} - {Math.round(
												pred.prediction.awayGoals
											)}
										</div>
										<div class="flex-1 text-center">{pred.away}</div>
									</div>
								</div>
								{#if pred.actual != null}
									<div class={itemClass}>
										<div class="flex-[5]">Actual:</div>
										<div class={valueClass}>
											<div class="flex-1 text-center">{pred.home}</div>
											<div class="flex-1 text-center">
												{pred.actual.homeGoals} - {pred.actual.awayGoals}
											</div>
											<div class="flex-1 text-center">{pred.away}</div>
										</div>
									</div>
								{:else}
									<div
										class="absolute right-[-34px] top-[calc(50%_-_7px)] text-[0.7em] text-[grey] max-[800px]:right-[-28px] max-[800px]:top-[calc(50%_-_6px)]"
									>
										{datetimeToTime(pred.datetime)}
									</div>
								{/if}

								<!-- Toggle to see detailed score -->
								{#if pred.prediction != null}
									<div class="prediction-details" id={pred._id}>
										<div class="mt-[10px] text-center text-[1.2em]">
											<b>{pred.prediction.homeGoals} - {pred.prediction.awayGoals}</b>
										</div>
									</div>
								{/if}
							</button>
						{/each}
						<div class="my-[15px]"></div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<style scoped>
	/* Runtime-selected result colour (via {pred.color}) and the JS-toggled
	   `expanded` details state stay as CSS. */
	.green {
		background-color: var(--win);
	}
	.yellow {
		background-color: var(--draw);
	}
	.red {
		background-color: var(--lose);
	}
	.prediction-details {
		font-size: 0.75em;
		color: black;
		margin: 5px 0;
		text-align: left;
		height: 0;
		display: none;
	}
	.prediction-details.expanded {
		height: auto;
		display: block;
	}
</style>
