
export function setThemeColor(color: string) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', color);
    } else {
        // Optionally create the tag if it doesn't exist
        const newMeta = document.createElement('meta');
        newMeta.name = 'theme-color';
        newMeta.content = color;
        document.head.appendChild(newMeta);
    }
}