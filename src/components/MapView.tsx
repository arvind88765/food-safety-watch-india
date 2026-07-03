import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import type { Article } from '../lib/types'
import { ACTION_LABELS, formatDate, primaryAction, severityFor } from '../lib/format'

interface MapProps {
  articles: Article[]
  selectedId?: number | null
  onSelect: (article: Article) => void
}

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

// Severity-graded dot. Ring intensifies with severity so a red pin also
// reads as "louder" at cluster-level, not just a different hue.
function severityDot(color: string, emphasized: boolean) {
  const size = emphasized ? 18 : 14
  const ringOpacity = emphasized ? 0.55 : 0.3
  return L.divIcon({
    className: '',
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #F4F1E9;
      box-shadow:0 0 0 3px ${color}${Math.round(ringOpacity * 255).toString(16).padStart(2, '0')};
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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

// Legend explaining the pin colors — otherwise the gradient is meaningless
// to a new visitor. Compact enough to sit in the corner without occluding.
function SeverityLegend() {
  const stops: Array<{ color: string; label: string }> = [
    { color: '#7A2E22', label: 'Critical' },
    { color: '#C9532A', label: 'High' },
    { color: '#E8A33D', label: 'Moderate' },
    { color: '#8FA34A', label: 'Low' },
    { color: '#4F6D5C', label: 'Procedural' },
  ]
  return (
    <div className="absolute z-[1000] left-3 bottom-3 bg-ink/85 backdrop-blur border border-paper/15 rounded-md px-3 py-2 shadow-lg">
      <div className="font-mono text-[0.55rem] uppercase tracking-widest text-paper/45 mb-1.5">
        Severity
      </div>
      <div className="flex flex-col gap-1">
        {stops.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[0.65rem] font-mono text-paper/80">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MapView({ articles, selectedId, onSelect }: MapProps) {
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
      <SeverityLegend />
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
          const severity = severityFor(a)
          const main = primaryAction(a.action_taken)
          const emphasized = selectedId === a.id || severity.level === 'critical'
          // Permanent tooltip content shown on hover — headline preview so
          // you don't have to click the pin to know if it's worth clicking.
          const tooltipHtml = `
            <div style="font-family:'IBM Plex Mono',monospace">
              <div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:${severity.color};margin-bottom:2px">
                ${severity.label} · ${a.district}
              </div>
              <div style="font-family:'Fraunces',Georgia,serif;font-size:0.82rem;line-height:1.25;color:#F4F1E9;max-width:240px">
                ${escapeHtml(a.title).slice(0, 120)}${a.title.length > 120 ? '…' : ''}
              </div>
              <div style="font-size:0.6rem;color:rgba(244,241,233,0.5);margin-top:4px">
                ${a.source} · ${formatDate(a.published)}
              </div>
            </div>
          `
          return (
            <Marker
              key={a.id}
              position={[a.lat, a.lon]}
              icon={severityDot(severity.color, emphasized)}
              eventHandlers={{
                click: () => onSelect(a),
                mouseover: (e) => {
                  e.target
                    .bindTooltip(tooltipHtml, {
                      direction: 'top',
                      offset: [0, -10],
                      opacity: 0.98,
                      className: 'severity-tooltip',
                    })
                    .openTooltip()
                },
                mouseout: (e) => {
                  e.target.closeTooltip()
                  e.target.unbindTooltip()
                },
              }}
            >
              {/* Fallback popup for touch devices where hover isn't a thing */}
              <Popup maxWidth={280}>
                <div className="font-mono text-[0.65rem] uppercase tracking-wide mb-1" style={{ color: severity.color }}>
                  {severity.label} · {a.district}, {a.state === 'Telangana' ? 'TG' : 'AP'} · {formatDate(a.published)}
                </div>
                <div className="font-display text-[0.9rem] leading-snug mb-2">{a.title}</div>
                {main && (
                  <div className="text-[0.65rem] font-mono uppercase tracking-wide mb-2 text-paper/70">
                    {ACTION_LABELS[main]}
                  </div>
                )}
                <button
                  onClick={() => onSelect(a)}
                  className="text-[0.75rem] underline text-marigold cursor-pointer"
                >
                  Open full record →
                </button>
              </Popup>
            </Marker>
          )
        })}
      </MarkerClusterGroup>
    </MapContainer>
  )
}

// Cheap HTML-escape for values interpolated into the tooltip innerHTML —
// article titles come straight from RSS feeds so we can't trust them.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
