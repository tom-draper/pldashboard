export function ordinal(n: number): string {
    let ord = [, "st", "nd", "rd"];
    let a = n % 100;
    return ord[a > 20 ? a % 10 : a] || "th";
}