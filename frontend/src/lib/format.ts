import { toHyphenatedName } from "./team";

export function ordinal(n: number): string {
    const ord = ["", "st", "nd", "rd"];
    const a = n % 100;
    return ord[a > 20 ? a % 10 : a] || "th";
}

export function teamStyle(team: string): string {
    const hyphenatedName = toHyphenatedName(team);
    return `background: var(--${hyphenatedName}); color: var(--${hyphenatedName}-secondary);`
}

export function scoreline(homeTeam: string, awayTeam: string, homeGoals: number, awayGoals: number): string {
    return `${homeTeam} ${homeGoals} - ${awayGoals} ${awayTeam}`
}

export function toTitleCase(str: string): string {
    return str
        .toLowerCase()
        .split(" ")
        .map(function (word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ")
        .replace("And", "and");
}