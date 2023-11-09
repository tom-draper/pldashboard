<p align="center">
  <img width="830" src="https://user-images.githubusercontent.com/41476809/227160125-c2fdc601-9e32-431c-9ecf-fb0046041c4f.png" />
</p>

A Premier League statistics dashboard presenting the current relative performance of each Premier League team. The dashboard includes interactive visualizations, curated metrics and score predictions for upcoming games. Throughout the dashboard, long-term performance and short-term form have been carefully blended where appropriate, aiming to give a balanced and accurate view of each team's current state and their expected performance in the near future.

Built with Svelte, TypeScript, FastAPI, Plotly, Pandas, MongoDB and <a href="https://www.football-data.org/">football-data.org</a> API for the data. 

Hosted at: https://pldashboard.com

<p align="center">
  <img src="https://user-images.githubusercontent.com/41476809/193349259-57712d5f-085b-4376-9b67-2e817756772d.png"/>
</p>
<br>
<p align="center">
  <img src="https://user-images.githubusercontent.com/41476809/207646620-e3b2ab27-879c-4926-b91c-75a7e435be17.png"/>
</p>

# Statistics & Metrics

The dashboard features statistics and metrics that have been designed to better indicate team performance. For transparency and guidance, all calculations used in the dashboard are outlined below.

## Team Rating

Each team is assigned an overall team rating that represents their long-term (multi-season) performance. This is the single most reliable indicator for predicted result when comparing teams.

Team ratings are calculated by summing the points and goal difference for each of the last 4 seasons (including the current season) for each team. This gives each team 4 team rating values for the last 4 seasons (if the team was present in the season). For each season, the team rating values for all teams in that season are normalised between 0 and 1, with the best team for each season achieving a team rating of 1. To create an overall team rating, a weighted average of each team's 4 team rating values is taken, with the more recent seasons holding a heavier weight. Exponential weightings are used, with each season weighted 2.5X more than the previous season. Due to the per-season normalisation, a team's overall rating could only ever be 1 if they are consistently the best team in every season included. It's a similar case for a team rating of 0, although newly promoted sides often have no previous data to work with, and will start with a team rating of 0 until they play their first game of the season.

Team ratings are used as the y-axis for the fixtures graph (adjusted slightly by home advantage).

## Form

A team's form rating is calculated to give a short-term indication of performance. Two form rating values of different timescales are used in the dashboard, one based on the last 5 games, and another based on the last 10 games.

A 5-game current form value is calculated by taking the last 5 matches played and summing each game's goal difference multiplied by the opposition team's rating. The average of these 5 values is taken to give the final result. A team's 10-game current form value is calculated similarly but with the previous 10 matches.

The raw value for 5-game current form of the team is displayed on the dashboard, as well as the opposition team for that team's next game. The form graph displays the historical 10-game form at the point of each matchday a team has played.

## Home Advantage

A home advantage value is calculated for each team to represent how much playing at home positively or negatively affects a team's performance. This metric considers the last 4 seasons, however in 2020 the Premier League played most matches behind closed doors, resulting in a season-long anomaly with no correlation between playing at home and performance. Due to this, the 2020-2021 season is excluded from home advantage calculations.

Home advantage is calculated by taking each team's win ratio at home, as well as the overall win ratio for the last 4 seasons (including the current season). For each season, the win ratio at home is subtracted from the overall win ratio to give a team's home advantage for that season. The mean is calculated for each team's 4 values from the last 4 seasons to give an overall home advantage. To avoid the current season from skewing the overall home advantage when only a few games have been played, the current season is excluded if a team's calculation if fewer than 6 games have been played. Upgrades are planned for the future to weight each season's home advantage value by the number of games the team has played.

This metric is used to adjust the opposition's team ratings in the fixtures graph depending on whether the game is played at their home ground.

## Score Prediction

Score prediction presents the most likely scoreline based on previous games across the last 4 seasons, with a consideration for the opponent team, both team's current form and the current betting odds for this fixture. A histogram of all scorelines for the current team's previous games across the last 4 seasons is created. The handful of previous scorelines on record from this direct fixture are collected and the probability of these scorelines are boosted in probability. Finally the current form of both teams is combined with the current market odds to create an adjustment value for a home win, draw and away win and the probabilities are multiplied by these adjustments to increase or decrease their likelihood. After these transformations, the most likely scoreline is taken as a prediction.

## Spider Chart

The spider chart displays team comparisons over 6 key metrics using games across the last 4 seasons. These metrics are clean sheets, defensive capability, attacking capability, performance against the big 6 teams, win streak and consistency.

Each metric is normalised relative to the maximum value achieved by any team during a single season.

### Clean Sheets

Clean sheets show the proportion of the current team's games that finished with no goals conceded.

### Defence

Defensive capability tracks the amount of goals conceded, weighting games heavier the more goals are conceded by the team.

### Attack

Attacking capability tracks the amount of goals scored, weighting games heavier the more goals are scored by the team.

### Big 6

Performance against the big 6 measures the goal difference achieved against the strongest 6 teams in the premier league. These include Manchester City, Liverpool, Arsenal, Manchester United, Tottenham and Chelsea. If the current team is one of the big 6, then the value considers the other 5 teams.

### Win Streak

Win streak measures the longest win streak achieved by the team.

### Consistency

Consistency is a measure of the frequency of the games that have back-to-back identical results. Notably this means the consistency metric could be the maximum even if the team consistently loses every game. 

# Contributions

If you find value in my work consider supporting me.

Buy Me a Coffee: https://www.buymeacoffee.com/tomdraper<br>
PayPal: https://www.paypal.com/paypalme/tomdraper
