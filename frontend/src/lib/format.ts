import { toHyphenatedName } from "./team";

export function ordinal(n: number): string {
    let ord = [, "st", "nd", "rd"];
    let a = n % 100;
    return ord[a > 20 ? a % 10 : a] || "th";
}

export function teamStyle(team: string): string {
    let hyphenatedName = toHyphenatedName(team);
    return `background: var(--${hyphenatedName}); color: var(--${hyphenatedName}-secondary);`
}

export function scoreline(homeTeam: string, awayTeam: string, homeGoals: number, awayGoals: number): string {
    return `${homeTeam} ${homeGoals} - ${awayGoals} ${awayTeam}`
}