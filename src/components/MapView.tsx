import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
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

export default function MapView({ articles }: { articles: Article[] }) {
  const center: [number, number] = [17.2, 79.8] // roughly between TG/AP centroid

  return (
    <MapContainer
      center={center}
      zoom={7}
      className="h-full w-full"
      scrollWheelZoom
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ResizeHandler />
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
