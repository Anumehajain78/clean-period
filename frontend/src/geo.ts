// Place search with the Open-Meteo Geocoding API (location data based on GeoNames).
// City/town level is enough: the PM2.5 forecast grid is about 45 km.

export interface Place {
  id: number
  name: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
}

export const GEOCODING_SOURCE = 'Open-Meteo Geocoding API, location data based on GeoNames'

export async function searchPlaces(name: string): Promise<Place[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({ name, count: '5', language: 'en', countryCode: 'IN' }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  return (body.results ?? []) as Place[]
}

export function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('geolocation not available'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (e) => reject(new Error(e.message)),
      { timeout: 10000 },
    )
  })
}

export const round4 = (n: number) => Math.round(n * 10000) / 10000
