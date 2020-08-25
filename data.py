import requests
import json

url = "https://api.football-data.org/v2/"
headers = {}
response = requests.get(url + "competitions?plan=TIER_ONE")