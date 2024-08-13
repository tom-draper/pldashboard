import type { Score, Scoreline, Team } from "$lib/types";

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
	fixtures: Fixtures;
	standings: Standings;
	teamRatings: TeamRatings;
	homeAdvantages: HomeAdvantages;
	form: Form;
	upcoming: Upcoming;
};

export type Match = {
	team: Team;
	date: string;
	score: Score,
	status: 'FINISHED' | 'IN-PLAY' | 'SCHEDULED';
	atHome: boolean;
};

export type Fixtures = {
	[team in Team]: {
		[matchday: string]: Fixture
	};
};

export type Fixture = {
	date: Date;
	atHome: boolean;
	team: Team;
	status: Status;
	score: Score | null;
};

export type Form = {
	[team in Team]: {
		[year: string]: {
			[matchday: string]: FormEntry
		}
	}
}

export type FormEntry = {
	team: Team;
	date: Date;
	starTeam: boolean;
	score: Score;
	position: number;
	gD: number;
	formRating5: number;
	formRating10: number;
	form5: string;
	form10: string;
	cumGD: number;
	cumPoints: number;
	atHome: boolean;
};

export type Standings = {
	[team in Team]: {
		[season: number]: Standing;
	};
};

export type Standing = {
	position: number;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	gF: number;
	gA: number;
	gD: number;
	points: number;
};

export type TeamRatings = {
	[team in Team]: TeamRating;
};

export type TeamRating = {
	current: number;
	prevSeason1: number;
	prevSeason2: number;
	prevSeason3: number;
	total: number;
}

export type HomeAdvantages = {
	[team in Team]: HomeAdvantage;
};

export type HomeAdvantage = {
	[season: number]: SeasonHomeAdvantage;
	totalHomeAdvantage: number;
};

export type SeasonHomeAdvantage = {
	home: number;
	homeAdvantage: number;
	overall: number;
};

export type PrevMatch = {
	result: Scoreline;
	date: string;
};

export type Upcoming = {
	[team in Team]: UpcomingMatch;
}

export type UpcomingMatch = {
	team: Team;
	date: string;
	atHome: boolean;
	prediction: Scoreline;
	prevMatches: PrevMatch[];
};

export type LogoURLs = {
	[team in Team]: string;
};

export type SpiderAttribute = {
	[team: Team]: number | null;
	avg: number;
};

export enum Status {
	Finished = 'FINISHED',
	Postponed = 'POSTPONED',
	Scheduled = 'SCHEDULED'
}

export type Home = {
	played: number;
	winRatio: number | null;
};

export enum Result {
	Drew = 'drew',
	Lost = 'lost',
	Won = 'won'
}
