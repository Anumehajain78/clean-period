// Town or city search with the Open-Meteo Geocoding API (location data from GeoNames).
// Town level is enough: the PM2.5 forecast grid is about 45 km.

export interface Place {
  id: number
  name: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
}

export async function searchPlaces(name: string): Promise<Place[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({ name, count: '6', language: 'en', countryCode: 'IN' }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { results?: Place[] }
  return body.results ?? []
}

export const round4 = (n: number) => (Math.round(n * 10000) / 10000).toString()
