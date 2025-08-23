type Coords = { latitude: number; longitude: number } | null;

/**
 * Geocode an address string to latitude/longitude.
 * Provider selection via process.env.GEOCODING_PROVIDER = 'opencage' | 'nominatim'
 * For 'opencage' you must provide OPENCAGE_API_KEY in env.
 * Falls back to Nominatim (OpenStreetMap) when no provider or key is available.
 */
export async function geocodeAddress(address: string): Promise<Coords> {
    if (!address || !address.trim()) return null;

    const provider = (process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase();
    const query = encodeURIComponent(address.trim());

    try {
        if (provider === 'opencage' && process.env.OPENCAGE_API_KEY) {
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${process.env.OPENCAGE_API_KEY}&limit=1&no_annotations=1`;
            const res = await globalThis.fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            const first = data.results && data.results[0];
            if (first && first.geometry && typeof first.geometry.lat === 'number' && typeof first.geometry.lng === 'number') {
                return { latitude: first.geometry.lat, longitude: first.geometry.lng };
            }
            return null;
        }

        // Default: Nominatim (OpenStreetMap) - no API key required but rate-limited
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
        const res = await globalThis.fetch(nominatimUrl, {
            headers: {
                // Lightweight user-agent per Nominatim usage policy
                'User-Agent': 'Up2/1.0 (+https://example.com)'
            }
        });

        if (!res.ok) return null;
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
            const first = json[0];
            const lat = parseFloat(first.lat);
            const lon = parseFloat(first.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                return { latitude: lat, longitude: lon };
            }
        }

        return null;
    } catch (err) {
        // Best-effort: don't throw; return null so the caller can continue
        // eslint-disable-next-line no-console
        console.warn('Geocoding failed:', err);
        return null;
    }
}

export default geocodeAddress;
