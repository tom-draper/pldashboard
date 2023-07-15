<p align="center">
  <img width="830" src="https://user-images.githubusercontent.com/41476809/227160125-c2fdc601-9e32-431c-9ecf-fb0046041c4f.png" />
</p>

A Premier League statistics dashboard presenting a relative outlook for the current performance of each Premier League team. The dashboard includes interactive visualisations, curated metrics and score predictions for upcoming games. Across the dashboard, long-term performance and short-term form have been carefully blended where appropriate, aiming to give a balanced and accurate view of each team's current state.

Built with Svelte, TypeScript, FastAPI, Plotly, Pandas, MongoDB and <a href="https://www.football-data.org/">football-data.org</a> API for the data. 

Hosted at: https://pldashboard.com

<p align="center">
  <img src="https://user-images.githubusercontent.com/41476809/193349259-57712d5f-085b-4376-9b67-2e817756772d.png"/>
</p>
<br>
<p align="center">
  <img src="https://user-images.githubusercontent.com/41476809/207646620-e3b2ab27-879c-4926-b91c-75a7e435be17.png"/>
</p>

# Calculations

For transparency and guidance, all calculations used in the dashboard are outlined below.

## Team Rating

Each team is assigned an overall team rating that represents their long-term (multi-season) performance. This is the single most reliable indicator for predicted result when comparing teams.

It is calculated by summing the points and goal difference for each of the last 4 seasons (including the current season) for each team. This gives each team 4 team rating values for the last 4 seasons (if the team was present in the season). For each season, the team rating values for all teams in that season are normalised between 0 and 1, with the best team that season achieving a team rating of 1. To give an overall team rating, a weighted average of each team's 4 team rating values is taken, with the more recent seasons holding a heavier weight. Exponential weightings are used, with each season weighted 2.5X more than the previous season. The value of 2.5 was chosen based on intuition. Due to the per-season normalisation, a team's overall rating could only ever be 1 if they are consistently the best team in each of the previous 4 seasons. Newly promoted sides often have no previous data to work with, and will start with a team rating of 0 until they play their first game of the season.

Team ratings are used as the y-axis for the fixtures graph (adjusted slightly by home advantage). It is also used as a foundation for calculating each score prediction.

## Form

A form rating is calculated to give a short-term indication of a team's performance. Two form rating values are used in the dashboard, one based on the last 5 games, and another based on the last 10 games.

A team's 5-game current form value is calculated by taking the last 5 matches played and summing each game's goal difference multiplied by the opposition team's rating. The average of these 5 values is taken to give the final result. A team's 10-game current form value is calculated similarly but with the previous 10 matches.

The raw value for 5-game current form of the team is displayed on the dashboard, as well as the opposition team for that team's next game. The form graph displays the historical 10-game form at the point of each matchday a team has played.

## Home Advantage

A home advantage value is calculated for each team to give an indication for how much playing at home positivley or negatively affects a team's performance. This metric considers the last 4 seasons, however in 2020 the Premier League played most matches behind closed doors, resulting in a season-long anomaly with no correlation between playing at home and performance. Due to this, the 2020-2021 season is excluded from home advantage calculations.

Home advantage is calculated by taking the win ratio at home, as well as the overall win ratio for each team for the last 4 seasons (including the current season). For each season, the overall win ratio is subtracted from the win ratio at home to give a team's home advantage for that season. A simple average is taken with each team's 4 values from the last 4 seasons to give an overall home advantage. To avoid the current season from skewing the overall home advantage when only a few games have been played, the current season is excluded if a team's calculation if fewer than 6 games have been played. Upgrades are planned for the future to weight each season's home advantage by the number of games the team has played.

This metric is used to adjust the opposition's team ratings in the fixtures graph depending on whether the game is played at their home ground.
