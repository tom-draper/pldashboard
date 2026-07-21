<script lang="ts">
	function background(result: string, starTeam: boolean): string {
		switch (result) {
			case 'W':
				if (starTeam) {
					return 'linear-gradient(30deg, var(--green), #2bd2ff, #fa8bff)';
				} else {
					return '#00fe87';
				}
			case 'D':
				return '#ffdd00';
			case 'L':
				return '#f83027';
			default:
				return '#d6d6d6';
		}
	}

	function formatResult(result: string): string {
		switch (result) {
			case 'W':
			case 'D':
			case 'L':
				return result;
			default:
				return '';
		}
	}

	export let form: string, starTeams: boolean[];

	const tileClass =
		'grid aspect-[1/0.9] w-full place-items-center rounded-[inherit] text-[#2b2d2f]';
	const resultClass =
		'mt-[0.14em] text-[2vw] max-[1000px]:text-[3em] max-[600px]:mt-[0.25em] max-[600px]:text-[7vw]';
</script>

<div class="relative flex-1 rounded-[6px_0_0_6px] opacity-[0.56]">
	<div class={tileClass} style="background: {background(form[0], starTeams[0])}">
		<div class={resultClass}>
			{formatResult(form[0])}
		</div>
	</div>
</div>
<div class="relative flex-1 opacity-[0.67]">
	<div class={tileClass} style="background: {background(form[1], starTeams[1])}">
		<div class={resultClass}>
			{formatResult(form[1])}
		</div>
	</div>
</div>
<div class="relative flex-1 opacity-[0.78]">
	<div class={tileClass} style="background: {background(form[2], starTeams[2])}">
		<div class={resultClass}>
			{formatResult(form[2])}
		</div>
	</div>
</div>
<div class="relative flex-1 opacity-[0.89]">
	<div class={tileClass} style="background: {background(form[3], starTeams[3])}">
		<div class={resultClass}>
			{formatResult(form[3])}
		</div>
	</div>
</div>
<div class="relative flex-1 rounded-[0_6px_6px_0] opacity-100">
	<div class={tileClass} style="background: {background(form[4], starTeams[4])}">
		<div class={resultClass}>
			{formatResult(form[4])}
		</div>
	</div>
</div>
