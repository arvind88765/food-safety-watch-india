import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import type { Article } from '../lib/types'
import { ACTION_LABELS, ACTION_COLORS, formatDate, primaryAction } from '../lib/format'

// Leaflet computes its tile grid from the container's size at the moment it
// mounts. On mobile the map panel starts hidden (display:none) behind the
// "List" tab, so it mounts with a 0x0 (or stale) size and only ever renders
// tiles for that wrong size — leaving most of the panel blank once it's
// shown. Watching the container with a ResizeObserver and calling
// invalidateSize() whenever its real size changes fixes this for tab
// switches, window resizes, and orientation changes alike.
function ResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [map])
  return null
}

function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="
      display:block;width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid #F4F1E9;
      box-shadow:0 0 0 1px rgba(0,0,0,0.35);
    "></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function userIcon() {
  return L.divIcon({
    className: '',
    html: `<span style="
      display:block;width:16px;height:16px;border-radius:50%;
      background:#3B82F6;border:3px solid #ffffff;
      box-shadow:0 0 0 2px rgba(59,130,246,0.5);
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

type LocateState = 'idle' | 'locating' | 'error'

function LocateControl({
  onLocate,
}: {
  onLocate: (pos: { lat: number; lng: number; accuracy: number }) => void
}) {
  const map = useMap()
  const [status, setStatus] = useState<LocateState>('idle')

  function handleClick() {
    if (!navigator.geolocation) {
      setStatus('error')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        onLocate({ lat: latitude, lng: longitude, accuracy })
        map.flyTo([latitude, longitude], 14, { duration: 1.2 })
        setStatus('idle')
      },
      () => {
        setStatus('error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  return (
    <button
      onClick={handleClick}
      title="Show my location"
      className="absolute z-[1000] right-3 bottom-16 sm:bottom-3 bg-ink border border-paper/20 rounded-md w-9 h-9 flex items-center justify-center text-paper hover:bg-paper/10 transition-colors shadow-lg"
    >
      {status === 'locating' ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-paper/30 border-t-marigold animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        </svg>
      )}
      {status === 'error' && (
        <span className="absolute right-11 bottom-0 whitespace-nowrap bg-ink border border-paper/20 text-[0.65rem] font-mono text-paper/80 px-2 py-1 rounded">
          Couldn't get location
        </span>
      )}
    </button>
  )
}

export default function MapView({ articles }: { articles: Article[] }) {
  const center: [number, number] = [17.2, 79.8] // roughly between TG/AP centroid
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  return (
    <MapContainer
      center={center}
      zoom={7}
      className="h-full w-full relative"
      scrollWheelZoom
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <LocateControl onLocate={setUserPos} />
      <ResizeHandler />
      {userPos && (
        <>
          <Circle
            center={[userPos.lat, userPos.lng]}
            radius={userPos.accuracy}
            pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.12, weight: 1 }}
          />
          <Marker position={[userPos.lat, userPos.lng]} icon={userIcon()}>
            <Popup maxWidth={200}>
              <div className="font-mono text-[0.7rem]">You are here</div>
            </Popup>
          </Marker>
        </>
      )}
      <MarkerClusterGroup chunkedLoading maxClusterRadius={45}>
        {articles.map((a) => {
          const main = primaryAction(a.action_taken)
          const color = main ? ACTION_COLORS[main] : '#4F6D5C'
          return (
            <Marker key={a.id} position={[a.lat, a.lon]} icon={dotIcon(color)}>
              <Popup maxWidth={280}>
                <div className="font-mono text-[0.65rem] text-marigold uppercase tracking-wide mb-1">
                  {a.district}, {a.state === 'Telangana' ? 'TG' : 'AP'} · {formatDate(a.published)}
                </div>
                <div className="font-display text-[0.9rem] leading-snug mb-2">{a.title}</div>
                {main && (
                  <div className="text-[0.65rem] font-mono uppercase tracking-wide mb-2" style={{ color }}>
                    {ACTION_LABELS[main]}
                  </div>
                )}
                <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-[0.75rem] underline">
                  Read source ({a.source}) →
                </a>
              </Popup>
            </Marker>
          )
        })}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
