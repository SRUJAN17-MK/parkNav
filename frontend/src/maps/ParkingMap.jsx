/**
 * SmartPark - the parking map.
 *
 * Renders the *entire* campus from the layout the backend computes:
 *   - main gate + ANPR camera
 *   - main parking road, north / south cross roads
 *   - Block A..D with every one of the 48 bays
 *   - the watchman room (navigation start point)
 *
 * When a `route` is supplied the A* polyline is drawn on top and the
 * destination bay is highlighted. Nothing is ever hidden - other bays stay
 * visible so the guard can still read the whole layout.
 *
 * Zoom / pan is handled by transforming an inner <g>, so text scales together
 * with the geometry and the map stays legible on a phone.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { MAP_TEXT, ROUTE_CASING, ROUTE_COLOR, slotTone, BLOCK_FILL, BLOCK_STROKE, ROAD_FILL, ROAD_STROKE } from './mapTheme.js';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export default function ParkingMap({
  map,
  route = null,
  selectedSlot = null,
  routeSlotIds = [],
  onSelectSlot,
  showRoute = true,
  height,
  hint,
  className = '',
  children,
}) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef(null);

  const canvas = map?.canvas || { width: 1200, height: 940 };

  const slotsByBlock = useMemo(() => {
    const groups = {};
    (map?.slots || []).forEach((slot) => {
      (groups[slot.blockId] = groups[slot.blockId] || []).push(slot);
    });
    Object.values(groups).forEach((list) => list.sort((a, b) => a.number - b.number));
    return groups;
  }, [map]);

  const routeSlotSet = useMemo(() => new Set(routeSlotIds), [routeSlotIds]);

  const zoom = useCallback((factor) => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((v.scale * factor).toFixed(2))));
      return { ...v, scale };
    });
  }, []);

  const reset = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  const onWheel = useCallback((event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.18 : 1 / 1.18);
  }, [zoom]);

  const onPointerDown = (event) => {
    if (view.scale <= 1) return;
    drag.current = { px: event.clientX, py: event.clientY, ox: view.x, oy: view.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // Convert screen pixels into layout units.
    const k = canvas.width / rect.width / view.scale;
    setView((v) => ({
      ...v,
      x: drag.current.ox - (event.clientX - drag.current.px) * k,
      y: drag.current.oy - (event.clientY - drag.current.py) * k,
    }));
  };

  const onPointerUp = (event) => {
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const transform = `translate(${view.x} ${view.y}) scale(${view.scale})`;
  const zoomed = view.scale > 1.01;
  const showControls = view.scale > 1.01;

  return (
    <div className={`map-wrap ${className}`} style={height ? { height } : undefined}>
      {hint ? <div className="map-hint">{hint}</div> : null}

      <svg
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        role="img"
        aria-label="Apartment parking layout"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: zoomed ? 'none' : 'auto', cursor: zoomed ? 'grab' : 'default' }}
      >
        <defs>
          <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="transparent" />
          </pattern>
          <linearGradient id="routeGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ROUTE_COLOR} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#3d8bfd" stopOpacity="0.95" />
          </linearGradient>
          <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="routeArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={ROUTE_COLOR} />
          </marker>
        </defs>

        <g transform={transform}>
          {/* ------------------------------------------------------ roads */}
          {(map?.roads || [])
            .filter((road) => road.type === 'road')
            .map((road) => {
              const vertical = road.height > road.width;
              return (
                <g key={road.id}>
                  <rect
                    x={road.x}
                    y={road.y}
                    width={road.width}
                    height={road.height}
                    rx={vertical ? road.width / 2 : road.height / 2}
                    fill={ROAD_FILL}
                    stroke={ROAD_STROKE}
                    strokeWidth="1.5"
                  />
                  <text
                    x={road.x + road.width / 2}
                    y={road.y + road.height / 2}
                    fill={MAP_TEXT.road}
                    fontSize="11"
                    letterSpacing="1.4"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={
                      vertical
                        ? `rotate(-90 ${road.x + road.width / 2} ${road.y + road.height / 2})`
                        : undefined
                    }
                  >
                    {road.label}
                  </text>
                </g>
              );
            })}

          {/* --------------------------------------------------- blocks */}
          {(map?.blocks || []).map((block) => {
            const blockSlots = slotsByBlock[block.id] || [];
            const occupied = blockSlots.filter((s) => s.status === 'Occupied').length;
            return (
              <g key={block.id}>
                <rect
                  x={block.x}
                  y={block.y}
                  width={block.width}
                  height={block.height}
                  rx="14"
                  fill={BLOCK_FILL}
                  stroke={BLOCK_STROKE}
                  strokeWidth="1.5"
                />
                {/* block header */}
                <rect
                  x={block.x}
                  y={block.y}
                  width={block.width}
                  height={block.titleHeight}
                  rx="14"
                  fill="rgba(61,139,253,0.10)"
                  stroke="none"
                />
                <rect x={block.x} y={block.y + block.titleHeight - 14} width={block.width} height="14" fill="rgba(61,139,253,0.10)" />
                <text
                  x={block.x + 14}
                  y={block.y + block.titleHeight / 2 + 1}
                  fill={MAP_TEXT.blockTitle}
                  fontSize="15"
                  fontWeight="700"
                  dominantBaseline="middle"
                >
                  {block.name}
                </text>
                <text
                  x={block.x + block.width - 14}
                  y={block.y + block.titleHeight / 2 + 1}
                  fill={MAP_TEXT.blockSub}
                  fontSize="11"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {occupied}/{blockSlots.length} occupied
                </text>

                {/* drive lanes (visual only - routing uses the graph) */}
                {[block.leftLaneX, block.aisleX, block.rightLaneX].map((x, i) => (
                  <rect
                    key={`${block.id}-lane-${i}`}
                    x={x - 7}
                    y={block.corridorY - 16}
                    width="14"
                    height="32"
                    rx="7"
                    fill="rgba(124,143,179,0.14)"
                    stroke="none"
                  />
                ))}

                {/* ------------------------------------------------ bays */}
                {blockSlots.map((slot) => {
                  const tone = slotTone(slot);
                  const isSelected = selectedSlot === slot.slotId;
                  const isDest = route?.slotId === slot.slotId;
                  const onRoute = routeSlotSet.has(slot.slotId);

                  return (
                    <g
                      key={slot.slotId}
                      className="slot-g"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSlot?.(slot);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${slot.slotId} ${slot.status}${slot.vehicleNumber ? ` ${slot.vehicleNumber}` : ''}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectSlot?.(slot);
                        }
                      }}
                    >
                      <title>
                        {`${slot.slotId} · ${slot.status}${slot.vehicleNumber ? ` · ${slot.vehicleNumber}` : ''}`}
                      </title>

                      {(isSelected || isDest) ? (
                        <rect
                          x={slot.x - 4}
                          y={slot.y - 4}
                          width={slot.width + 8}
                          height={slot.height + 8}
                          rx="11"
                          fill="none"
                          stroke={isDest ? ROUTE_COLOR : '#ffffff'}
                          strokeWidth="2.5"
                          filter="url(#softGlow)"
                        />
                      ) : null}

                      <rect
                        className="slot-rect"
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        rx="8"
                        fill={tone.fill}
                        stroke={isSelected ? '#ffffff' : tone.stroke}
                        strokeWidth={isSelected ? 2.4 : 1.4}
                        strokeDasharray={slot.status === 'Empty' ? '4 3' : undefined}
                        opacity={onRoute && !isDest ? 1 : 0.94}
                      />

                      <text
                        className="slot-label"
                        x={slot.x + slot.width / 2}
                        y={slot.y + 19}
                        fontSize="14"
                        textAnchor="middle"
                        fill={tone.label}
                      >
                        {slot.id}
                      </text>

                      {slot.vehicleNumber ? (
                        <>
                          <text
                            className="slot-plate-txt"
                            x={slot.x + slot.width / 2}
                            y={slot.y + 36}
                            fontSize="10.5"
                            textAnchor="middle"
                            fill={tone.text}
                          >
                            {slot.vehicleNumber}
                          </text>
                          <text
                            x={slot.x + slot.width / 2}
                            y={slot.y + 49}
                            fontSize="8.5"
                            textAnchor="middle"
                            fill={tone.text}
                            opacity="0.8"
                            letterSpacing="0.8"
                          >
                            OCCUPIED
                          </text>
                        </>
                      ) : (
                        <text
                          x={slot.x + slot.width / 2}
                          y={slot.y + 40}
                          fontSize="9.5"
                          textAnchor="middle"
                          fill={tone.text}
                          letterSpacing="1"
                        >
                          {slot.type === 'ev' ? 'EV · FREE' : slot.type === 'visitor' ? 'VISITOR · FREE' : 'EMPTY'}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* ------------------------------------------------ landmarks */}
          {(map?.roads || [])
            .filter((road) => road.type === 'gate' || road.type === 'room')
            .map((road) => (
              <g key={road.id}>
                <rect
                  x={road.x}
                  y={road.y}
                  width={road.width}
                  height={road.height}
                  rx="12"
                  fill={road.type === 'gate' ? 'rgba(34,211,238,0.16)' : 'rgba(167,139,250,0.18)'}
                  stroke={road.type === 'gate' ? '#22d3ee' : '#a78bfa'}
                  strokeWidth="1.6"
                />
                <text
                  x={road.x + road.width / 2}
                  y={road.y + road.height / 2 - 6}
                  fontSize="12.5"
                  fontWeight="700"
                  textAnchor="middle"
                  fill={road.type === 'gate' ? '#67e8f9' : '#c4b5fd'}
                >
                  {road.label}
                </text>
                {road.sublabel ? (
                  <text
                    x={road.x + road.width / 2}
                    y={road.y + road.height / 2 + 10}
                    fontSize="9.5"
                    textAnchor="middle"
                    fill={MAP_TEXT.blockSub}
                  >
                    {road.sublabel}
                  </text>
                ) : null}
              </g>
            ))}

          {/* ---------------------------------------------------- route */}
          {showRoute && route?.polyline ? (
            <g>
              <path d={route.polyline} fill="none" stroke={ROUTE_CASING} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
              <path
                d={route.polyline}
                fill="none"
                stroke="url(#routeGlow)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#softGlow)"
              />
              <path
                d={route.polyline}
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeDasharray="10 12"
                strokeDashoffset="0"
                opacity="0.85"
              >
                <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1s" repeatCount="indefinite" />
              </path>

              {/* start marker: watchman room */}
              <g>
                <circle cx={route.from.x} cy={route.from.y} r="15" fill="rgba(167,139,250,0.28)" stroke="#a78bfa" strokeWidth="2">
                  <animate attributeName="r" values="13;20;13" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={route.from.x} cy={route.from.y} r="6.5" fill="#a78bfa" />
                <text x={route.from.x} y={route.from.y - 24} fontSize="12" fontWeight="700" textAnchor="middle" fill="#ddd6fe">
                  YOU ARE HERE
                </text>
              </g>

              {/* end marker: destination bay */}
              <g>
                <circle cx={route.to.x} cy={route.to.y} r="13" fill="rgba(34,211,238,0.3)" stroke={ROUTE_COLOR} strokeWidth="2.4" />
                <text x={route.to.x} y={route.to.y + 4.5} fontSize="15" fontWeight="700" textAnchor="middle" fill="#062a35">
                  ★
                </text>
              </g>
            </g>
          ) : null}
        </g>
      </svg>

      {/* -------------------------------------------------- map controls */}
      {showControls ? (
        <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 6 }}>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => zoom(1.35)} aria-label="Zoom in">
            +
          </button>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => zoom(1 / 1.35)} aria-label="Zoom out">
            −
          </button>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={reset} aria-label="Reset view">
            ⤢
          </button>
        </div>
      ) : null}

      {/* distance scale bar */}
      {map?.metersPerUnit ? (
        <div className="map-scale">
          <span>{Math.round(200 / map.metersPerUnit)} units</span>
          <i style={{ width: Math.round((200 / map.metersPerUnit) * (canvas.width / 1200) * 0.55) }} />
          <span>≈ 200 m ground scale</span>
        </div>
      ) : null}

      {children}
    </div>
  );
}
