import type { Fixture, Form, HomeAdvantage, Standing, Team, TeamRating, Upcoming } from "../../global";

export type DashboardData = {
	data: TeamsData;
	teams: Team[];
	team: {
		name: Team;
		id: string;
	};
	currentMatchday: string;
	title: string;
	slug: string;
	playedDates: Date[];
};

export type TeamsData = {
	_id: number;
	lastUpdated: string;
	fixtures: { [team in Team]: { [matchday: string]: Fixture } };
	standings: { [team in Team]: { [matchday: string]: Standing } };
	teamRatings: { [team in Team]: TeamRating };
	homeAdvantages: { [team in Team]: HomeAdvantage };
	form: { [team in Team]: { [year: string]: { [matchday: string]: Form } } };
	upcoming: { [team in Team]: Upcoming };
};

// export enum Status {
// 	Finished = 'FINISHED',
// 	Postponed = 'POSTPONED',
// 	Scheduled = 'SCHEDULED'
// }

// export type Home = {
// 	played: number;
// 	winRatio: number | null;
// };

// export enum Result {
// 	Drew = 'drew',
// 	Lost = 'lost',
// 	Won = 'won'
// }
