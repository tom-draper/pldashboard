export enum Team {
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

export type Counter = {
    [k: string | number | symbol]: number;
};

export type Score = {
	homeGoals: number;
	awayGoals: number;
};

export type Scoreline = Score & {
	homeTeam: Team;
	awayTeam: Team;
};

export type PlotData = {
	data: any;
	layout: any;
	config: any;
};