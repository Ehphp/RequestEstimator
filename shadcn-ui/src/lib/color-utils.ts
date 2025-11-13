type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB | null {
    const h = hex.replace('#', '').trim();
    const parse = (s: string) => parseInt(s, 16);
    if (h.length === 3) {
        const r = parse(h[0] + h[0]);
        const g = parse(h[1] + h[1]);
        const b = parse(h[2] + h[2]);
        return { r, g, b };
    }
    if (h.length === 6) {
        const r = parse(h.slice(0, 2));
        const g = parse(h.slice(2, 4));
        const b = parse(h.slice(4, 6));
        return { r, g, b };
    }
    return null;
}

function srgbToLinear(c: number): number {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const R = srgbToLinear(rgb.r);
    const G = srgbToLinear(rgb.g);
    const B = srgbToLinear(rgb.b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(fgHex: string, bgHex: string): number {
    const L1 = relativeLuminance(fgHex);
    const L2 = relativeLuminance(bgHex);
    const [Lmax, Lmin] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (Lmax + 0.05) / (Lmin + 0.05);
}

export function getAccessibleTextColor(
    bgHex: string,
    targetRatio = 4.5,
    prefer: 'auto' | 'dark' | 'light' = 'auto'
): { color: '#111111' | '#ffffff'; ratio: number } {
    const dark: '#111111' = '#111111';
    const light: '#ffffff' = '#ffffff';
    const crDark = contrastRatio(dark, bgHex);
    const crLight = contrastRatio(light, bgHex);
    let color: '#111111' | '#ffffff' = crDark >= crLight ? dark : light;

    if (prefer !== 'auto') {
        const preferred = prefer === 'dark' ? dark : light;
        const alt = prefer === 'dark' ? light : dark;
        const crPreferred = contrastRatio(preferred, bgHex);
        const crAlt = contrastRatio(alt, bgHex);
        if (crPreferred >= targetRatio && crPreferred >= crAlt) color = preferred;
    }
    const ratio = contrastRatio(color, bgHex);
    return { color, ratio };
}

export function mixHexColors(hex1: string, hex2: string, weight: number): string {
    const a = hexToRgb(hex1), b = hexToRgb(hex2);
    if (!a || !b) return hex1;
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    const mix = (x: number, y: number) => Math.round(clamp(x * (1 - weight) + y * weight));
    const r = mix(a.r, b.r), g = mix(a.g, b.g), bch = mix(a.b, b.b);
    return `#${[r, g, bch].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function ensureAccessibleCardColor(
    baseColor: string,
    pastelBase: string,
    startWeight = 0.25,
    targetRatio = 4.5
): { bg: string; text: '#111111' | '#ffffff'; ratio: number; weight: number } {
    // Use a small binary-search-like adjustment of the mix weight to reach the
    // requested contrast ratio. Keep the returned shape identical to the
    // previous implementation so consumers are unaffected.
    const MAX_WEIGHT = 0.9;
    const MAX_ITER = 10;
    let minW = 0;
    let maxW = MAX_WEIGHT;
    // Clamp startWeight into a valid range
    let weight = Math.min(Math.max(startWeight, 0), MAX_WEIGHT);

    let bg = mixHexColors(baseColor, pastelBase, weight);
    let { color: text, ratio } = getAccessibleTextColor(bg, targetRatio);

    if (ratio >= targetRatio) return { bg, text, ratio, weight };

    for (let i = 0; i < MAX_ITER && ratio < targetRatio; i++) {
        // If current text suggested is white, the background is relatively dark
        // so reduce the pastel mix (move weight towards min) to darken the bg.
        if (text === '#ffffff') {
            maxW = weight;
            weight = (minW + weight) / 2;
        } else {
            // Otherwise background is light and we can increase the pastel mix
            minW = weight;
            weight = (weight + maxW) / 2;
        }

        bg = mixHexColors(baseColor, pastelBase, weight);
        const res = getAccessibleTextColor(bg, targetRatio);
        text = res.color;
        ratio = res.ratio;

        if (ratio >= targetRatio) break;
    }

    return { bg, text, ratio, weight };
}
