<script lang="ts">
	import { onMount } from 'svelte';
	import type { FantasyData, FantasyPlayer } from './fantasy.types';
	import Pitch from './Pitch.svelte';

	interface OptimalTeam {
		players: FantasyPlayer[];
		totalPoints: number;
		totalPrice: number;
		formation: {
			goalkeepers: FantasyPlayer[];
			defenders: FantasyPlayer[];
			midfielders: FantasyPlayer[];
			forwards: FantasyPlayer[];
		};
	}

	export function findOptimalFantasyTeam(players: FantasyPlayer[]): OptimalTeam {
		const MAX_BUDGET = 1000;
		const REQUIRED_POSITIONS = {
			Goalkeeper: 2,
			Defender: 5,
			Midfielder: 5,
			Forward: 3
		};

		type TeamOption = {
			price: number;
			points: number;
			players: FantasyPlayer[];
		};

		function isBetterTeam(candidate: TeamOption, current: TeamOption | null) {
			return (
				current === null ||
				candidate.points > current.points ||
				(candidate.points === current.points && candidate.price > current.price)
			);
		}

		function buildPositionOptions(position: keyof typeof REQUIRED_POSITIONS): TeamOption[] {
			const requiredCount = REQUIRED_POSITIONS[position];
			const positionPlayers = players.filter((player) => player.position === position);
			const options: Array<Array<TeamOption | null>> = Array.from(
				{ length: requiredCount + 1 },
				() => Array(MAX_BUDGET + 1).fill(null)
			);

			options[0][0] = { price: 0, points: 0, players: [] };

			for (const player of positionPlayers) {
				for (let count = requiredCount - 1; count >= 0; count--) {
					for (let price = MAX_BUDGET - player.price; price >= 0; price--) {
						const current = options[count][price];
						if (current === null) continue;

						const candidate = {
							price: price + player.price,
							points: current.points + player.totalPoints,
							players: [...current.players, player]
						};

						if (isBetterTeam(candidate, options[count + 1][candidate.price])) {
							options[count + 1][candidate.price] = candidate;
						}
					}
				}
			}

			return options[requiredCount].filter((option): option is TeamOption => option !== null);
		}

		function optimizeTeam(): FantasyPlayer[] {
			let squadOptions: Array<TeamOption | null> = Array(MAX_BUDGET + 1).fill(null);
			squadOptions[0] = { price: 0, points: 0, players: [] };

			for (const position of Object.keys(REQUIRED_POSITIONS) as Array<
				keyof typeof REQUIRED_POSITIONS
			>) {
				const positionOptions = buildPositionOptions(position);
				const nextSquadOptions: Array<TeamOption | null> = Array(MAX_BUDGET + 1).fill(null);

				for (const squadOption of squadOptions) {
					if (squadOption === null) continue;

					for (const positionOption of positionOptions) {
						const candidatePrice = squadOption.price + positionOption.price;
						if (candidatePrice > MAX_BUDGET) continue;

						const candidate = {
							price: candidatePrice,
							points: squadOption.points + positionOption.points,
							players: [...squadOption.players, ...positionOption.players]
						};

						if (isBetterTeam(candidate, nextSquadOptions[candidatePrice])) {
							nextSquadOptions[candidatePrice] = candidate;
						}
					}
				}

				squadOptions = nextSquadOptions;
			}

			return (
				squadOptions.reduce<TeamOption | null>(
					(best, option) => (option !== null && isBetterTeam(option, best) ? option : best),
					null
				)?.players ?? []
			);
		}

		function isValidTeam(team: FantasyPlayer[]): boolean {
			if (team.length !== 15) return false;

			const totalPrice = team.reduce((sum, p) => sum + p.price, 0);
			if (totalPrice > MAX_BUDGET) return false;

			const positionCounts = {
				Goalkeeper: 0,
				Defender: 0,
				Midfielder: 0,
				Forward: 0
			};

			team.forEach((player) => {
				positionCounts[player.position as keyof typeof positionCounts]++;
			});

			return Object.entries(REQUIRED_POSITIONS).every(
				([position, required]) =>
					positionCounts[position as keyof typeof positionCounts] === required
			);
		}

		const optimalTeam = optimizeTeam();

		if (!isValidTeam(optimalTeam)) {
			throw new Error('Unable to find a valid team within budget constraints');
		}

		// Organize team by position
		const formation = {
			goalkeepers: optimalTeam.filter((p) => p.position === 'Goalkeeper'),
			defenders: optimalTeam.filter((p) => p.position === 'Defender'),
			midfielders: optimalTeam.filter((p) => p.position === 'Midfielder'),
			forwards: optimalTeam.filter((p) => p.position === 'Forward')
		};

		return {
			players: optimalTeam,
			totalPoints: optimalTeam.reduce((sum, p) => sum + p.totalPoints, 0),
			totalPrice: optimalTeam.reduce((sum, p) => sum + p.price, 0),
			formation
		};
	}

	let optimalTeam: OptimalTeam;

	onMount(() => {
		const players: FantasyPlayer[] = [];
		for (const [key, value] of Object.entries(data)) {
			if (key !== '_id') {
				players.push(value);
			}
		}
		optimalTeam = findOptimalFantasyTeam(players);
	});

	export let data: FantasyData;
</script>

{#if optimalTeam}
	<div class="optimal-team">
		<Pitch players={optimalTeam.players} />
	</div>
{/if}

<style scoped>
	.optimal-team {
		margin-bottom: -40px;
	}
</style>
