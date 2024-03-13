import { url } from "../consts";

export async function fetchFantasy() {
	const response = await fetch(`${url}/fantasy`);
	if (!response.ok) {
		return;
	}
	const json = await response.json();
	return json;
}