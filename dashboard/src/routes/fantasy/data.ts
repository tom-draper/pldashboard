import { URL } from "$lib/consts";
import fantasy from "$db/fantasy";

export async function fetchFantasy() {
	const data = fantasy.find({_id: "fantasy"})
	return data
}

export async function fetchFantasyOld() {
	const response = await fetch(`${URL}/fantasy`);
	if (!response.ok) {
		return;
	}
	const json = await response.json();
	return json;
}