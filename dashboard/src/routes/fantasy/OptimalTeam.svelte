<script lang="ts">
	import { onMount } from 'svelte';
	import type { FantasyData, FantasyPlayer, Page } from './fantasy.types';
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

		// Separate players by position and sort by points per price ratio (efficiency)
		const playersByPosition = {
			Goalkeeper: players
				.filter((p) => p.position === 'Goalkeeper')
				.sort((a, b) => b.totalPoints / b.price - a.totalPoints / a.price),
			Defender: players
				.filter((p) => p.position === 'Defender')
				.sort((a, b) => b.totalPoints / b.price - a.totalPoints / a.price),
			Midfielder: players
				.filter((p) => p.position === 'Midfielder')
				.sort((a, b) => b.totalPoints / b.price - a.totalPoints / a.price),
			Forward: players
				.filter((p) => p.position === 'Forward')
				.sort((a, b) => b.totalPoints / b.price - a.totalPoints / a.price)
		};

		// Greedy approach with budget-aware selection
		function selectTeam(): FantasyPlayer[] {
			const selectedPlayers: FantasyPlayer[] = [];
			let remainingBudget = MAX_BUDGET;

			// Track how many players we need for each position
			const remainingNeeds = { ...REQUIRED_POSITIONS };

			// First pass: Try to fill each position with best value players
			for (const [position, count] of Object.entries(REQUIRED_POSITIONS)) {
				const positionPlayers = playersByPosition[position as keyof typeof playersByPosition];

				for (let i = 0; i < Math.min(count, positionPlayers.length); i++) {
					const player = positionPlayers[i];
					if (player.price <= remainingBudget) {
						selectedPlayers.push(player);
						remainingBudget -= player.price;
						remainingNeeds[position as keyof typeof remainingNeeds]--;
					}
				}
			}

			// Second pass: Fill remaining positions with cheaper alternatives if needed
			for (const [position, needed] of Object.entries(remainingNeeds)) {
				if (needed > 0) {
					const positionPlayers = playersByPosition[position as keyof typeof playersByPosition]
						.filter((p) => !selectedPlayers.includes(p))
						.sort((a, b) => a.price - b.price); // Sort by price for remaining slots

					for (let i = 0; i < Math.min(needed, positionPlayers.length); i++) {
						const player = positionPlayers[i];
						if (player.price <= remainingBudget) {
							selectedPlayers.push(player);
							remainingBudget -= player.price;
						}
					}
				}
			}

			return selectedPlayers;
		}

		// Try multiple strategies and pick the best one
		function optimizeTeam(): FantasyPlayer[] {
			let bestTeam: FantasyPlayer[] = [];
			let bestPoints = 0;

			// Strategy 1: Pure value-based selection
			const valueTeam = selectTeam();
			if (isValidTeam(valueTeam)) {
				const points = valueTeam.reduce((sum, p) => sum + p.totalPoints, 0);
				if (points > bestPoints) {
					bestTeam = valueTeam;
					bestPoints = points;
				}
			}

			// Strategy 2: Prioritize high scorers within budget constraints
			const highScorerTeam = selectHighScorerTeam();
			if (isValidTeam(highScorerTeam)) {
				const points = highScorerTeam.reduce((sum, p) => sum + p.totalPoints, 0);
				if (points > bestPoints) {
					bestTeam = highScorerTeam;
					bestPoints = points;
				}
			}

			return bestTeam;
		}

		function selectHighScorerTeam(): FantasyPlayer[] {
			// Sort all players by total points descending
			const allPlayersSorted = [...players].sort((a, b) => b.totalPoints - a.totalPoints);

			const selectedPlayers: FantasyPlayer[] = [];
			let remainingBudget = MAX_BUDGET;
			const positionCounts = {
				Goalkeeper: 0,
				Defender: 0,
				Midfielder: 0,
				Forward: 0
			};

			// Greedy selection of highest scorers that fit budget and position constraints
			for (const player of allPlayersSorted) {
				const position = player.position as keyof typeof positionCounts;
				const maxForPosition = REQUIRED_POSITIONS[position];

				if (positionCounts[position] < maxForPosition && player.price <= remainingBudget) {
					selectedPlayers.push(player);
					remainingBudget -= player.price;
					positionCounts[position]++;
				}

				// Check if team is complete
				if (selectedPlayers.length === 15) break;
			}

			return selectedPlayers;
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

	// Helper function to display team summary
	function displayTeamSummary(team: OptimalTeam): void {
		console.log(`\n=== OPTIMAL FANTASY TEAM ===`);
		console.log(`Total Points: ${team.totalPoints}`);
		console.log(`Total Price: ${team.totalPrice}/1000`);
		console.log(`Budget Remaining: ${1000 - team.totalPrice}\n`);

		Object.entries(team.formation).forEach(([position, players]) => {
			console.log(`${position.toUpperCase()}:`);
			players.forEach((player) => {
				console.log(
					`  ${player.firstName} ${player.surname} (${player.team}) - ${player.totalPoints} pts - £${player.price}`
				);
			});
			console.log();
		});
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
		console.log('Optimal Fantasy Team Found:');
		displayTeamSummary(optimalTeam);
	});

	export let data: FantasyData;
</script>

{#if optimalTeam}
	<div>
		<Pitch players={optimalTeam.players} />
	</div>
{/if}
