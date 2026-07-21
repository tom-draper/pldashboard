<script lang="ts">
	import logo from '$lib/images/pldashboard5.png';
	import Seo from '$components/Seo.svelte';
</script>

<Seo
	title="Premier League Dashboard — Team Stats, Form & Predictions"
	description="Explore interactive Premier League team dashboards: current form, league position, goals, fixtures, standings and AI match predictions for every club."
/>

<div id="home" class="grid min-h-screen place-items-center bg-black">
	<div class="mb-[100px] grid place-items-center">
		<div id="circle" class="absolute z-[1] h-[28vw] w-[60vw] rounded-full max-[800px]:hidden"></div>
		<img src={logo} alt="pldashboard" class="z-[2] w-[min(80%,1000px)] max-[800px]:w-[90%]" />
		<div class="links z-[3] flex bg-black pt-[60px] max-[500px]:flex-col">
			<a
				href="/"
				class="dashboard-link grid w-[160px] place-items-center rounded-[5px] py-[18px] text-[1.2em] font-bold tracking-[0.02em] text-[#37003d] mx-[20px] max-[500px]:mx-0 max-[500px]:my-[12px] max-[500px]:w-[140px] max-[500px]:text-[14px]"
			>
				Dashboard
			</a>
			<a
				href="/fantasy"
				class="fantasy-link grid w-[160px] place-items-center rounded-[5px] py-[18px] text-[1.2em] font-bold tracking-[0.02em] text-[#37003d] mx-[20px] max-[500px]:mx-0 max-[500px]:my-[12px] max-[500px]:w-[140px] max-[500px]:text-[14px]"
			>
				Fantasy
			</a>
		</div>
	</div>
</div>

<style scoped>
	/* Bespoke visual layer: the grid-pattern background and the multi-layer glow
	   shadows/gradients stay as CSS; layout lives in Tailwind utilities above. */
	#home {
		background-image:
			linear-gradient(to right, #025e4c45 1px, transparent 1px),
			linear-gradient(to bottom, #025e4c45 1px, transparent 1px);
		background-size: 80px 80px;
	}
	#circle {
		box-shadow: black 0 0 200px 100px;
	}
	img {
		box-shadow: black 0px 0 80px 80px;
	}
	.links {
		box-shadow: black 0 60px 30px 30px;
	}
	.fantasy-link {
		background: var(--green);
		box-shadow:
			0 0 30px 1px rgba(0, 254, 135, 0.2),
			0 0 60px 2px rgba(0, 254, 135, 0.2);
	}
	.dashboard-link {
		background: rgb(5, 235, 235);
		box-shadow:
			0 0 30px 1px rgba(5, 235, 235, 0.2),
			0 0 60px 2px rgba(5, 235, 235, 0.2);
	}

	@media only screen and (max-width: 600px) {
		#home {
			background-size: 60px 60px;
		}
	}
	@media only screen and (max-width: 500px) {
		img {
			box-shadow: black 0px 20px 30px 40px;
		}
		.links {
			box-shadow: black 0px 40px 30px 40px;
		}
	}
</style>
