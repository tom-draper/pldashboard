enum Team {
	Arsenal = 'Arsenal',
	AstonVilla = 'Aston Villa',
	Bournemouth = 'Bournemouth',
	Brentford = 'Brentford',
	BrightonAndHoveAlbion = 'Brighton and Hove Albion',
	Burnley = 'Burnley',
	Chelsea = 'Chelsea',
	CrystalPalace = 'Crystal Palace',
	Everton = 'Everton',
	Fulham = 'Fulham',
	LeedsUnited = 'Leeds United',
	LeicesterCity = 'Leicester City',
	Liverpool = 'Liverpool',
	LutonTown = 'Luton Town',
	ManchesterCity = 'Manchester City',
	ManchesterUnited = 'Manchester United',
	NewcastleUnited = 'Newcastle United',
	NorwichCity = 'Norwich City',
	NottinghamForest = 'Nottingham Forest',
	SheffieldUnited = 'Sheffield United',
	Southampton = 'Southampton',
	TottenhamHotspur = 'Tottenham Hotspur',
	Watford = 'Watford',
	WestBromwichAlbion = 'West Bromwich Albion',
	WestHamUnited = 'West Ham United',
	WolverhamptonWanderers = 'Wolverhampton Wanderers'
}

type Score = {
	homeGoals: number;
	awayGoals: number;
};

type Scoreline = Score & {
	homeTeam: Team;
	awayTeam: Team;
};

type Match = {
	team: Team;
	date: string;
	score: Score,
	status: 'FINISHED' | 'IN-PLAY';
	SCHEDULED;
	atHome: boolean;
};

type Fixtures = {
	[team in Team]: {
		[matchday: number]: Fixture
	};
};

type Fixture = {
	date: Date;
	atHome: boolean;
	team: Team;
	status: Status;
	score: Score | null;
};

type Form = {
	[season: string]: {
		// Season start year
		[team in Team]: {
			[matchday: number]: FormEntry;
		};
	};
};

type FormEntry = {
	team: Team;
	date: string;
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

type Standings = {
	[team in Team]: {
		[season: number]: Standing;
	};
};

type Standing = {
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

type TeamRatings = {
	[team in Team]: TeamRating;
};

type TeamRating = {
	current: number;
	prevSeason1: number;
	prevSeason2: number;
	prevSeason3: number;
	total: number;
}

type HomeAdvantages = {
	[team in Team]: HomeAdvantage;
};

export type HomeAdvantage = {
	[season: number]: SeasonHomeAdvantage;
	totalHomeAdvantage: number;
};

type SeasonHomeAdvantage = {
	home: number;
	homeAdvantage: number;
	overall: number;
};

type PrevMatch = {
	result: Scoreline;
	date: string;
};

type Upcoming = {
	[team in Team]: {
		team: Team;
		date: string;
		atHome: boolean;
		prediction: Score;
		prevMatches: PrevMatch[];
	};
};

type LogoURLs = {
	[team in Team]: string;
};

type PlotData = {
	data;
	layout;
	config;
};

type Counter = {
	[k: string | number | symbol]: number;
};

type SpiderAttribute = {
	[team: Team]: number | null;
	avg: number;
};
