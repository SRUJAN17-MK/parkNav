/**
 * SmartPark - Printable Ticket Mini Map Component.
 *
 * High-contrast, clean vector SVG mini map designed for physical paper print
 * and thermal receipt tickets.
 * Renders the real campus layout (Blocks A-D, all 48 bays, roads, Watchman Room)
 * and highlights the exact A* walking route to the destination.
 */

import React, { useMemo } from 'react';

export default function TicketMiniMap({ map, route, className = '', height = 'auto' }) {
  const canvas = map?.canvas || { width: 1200, height: 940 };

  const slotsByBlock = useMemo(() => {
    const groups = {};
    (map?.slots || []).forEach((slot) => {
      (groups[slot.blockId] = groups[slot.blockId] || []).push(slot);
    });
    Object.values(groups).forEach((list) => list.sort((a, b) => a.number - b.number));
    return groups;
  }, [map]);

  const destSlotId = route?.slotId;

  return (
    <div className={`ticket-minimap-container ${className}`}>
      <svg
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        className="ticket-minimap-svg"
        style={{ width: '100%', height, maxHeight: '260px', display: 'block' }}
        role="img"
        aria-label="Printable Parking Map with Route"
      >
        <defs>
          <marker
            id="ticketRouteArrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
          </marker>
        </defs>

        {/* Map Background */}
        <rect x="0" y="0" width={canvas.width} height={canvas.height} fill="#f8fafc" rx="8" />

        {/* Outer border */}
        <rect
          x="2"
          y="2"
          width={canvas.width - 4}
          height={canvas.height - 4}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="3"
          rx="8"
        />

        {/* ------------------------------------------------ Roads */}
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
                  fill="#e2e8f0"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <text
                  x={road.x + road.width / 2}
                  y={road.y + road.height / 2}
                  fill="#475569"
                  fontSize="12"
                  fontWeight="600"
                  letterSpacing="1.2"
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

        {/* ------------------------------------------------ Blocks & Bays */}
        {(map?.blocks || []).map((block) => {
          const blockSlots = slotsByBlock[block.id] || [];
          const isTargetBlock = route?.blockId === block.id;

          return (
            <g key={block.id}>
              {/* Block container */}
              <rect
                x={block.x}
                y={block.y}
                width={block.width}
                height={block.height}
                rx="10"
                fill="#ffffff"
                stroke={isTargetBlock ? '#0284c7' : '#94a3b8'}
                strokeWidth={isTargetBlock ? '3' : '1.5'}
              />

              {/* Block header */}
              <rect
                x={block.x}
                y={block.y}
                width={block.width}
                height={block.titleHeight}
                rx="10"
                fill={isTargetBlock ? '#e0f2fe' : '#f1f5f9'}
              />
              <rect
                x={block.x}
                y={block.y + block.titleHeight - 10}
                width={block.width}
                height="10"
                fill={isTargetBlock ? '#e0f2fe' : '#f1f5f9'}
              />
              <text
                x={block.x + 14}
                y={block.y + block.titleHeight / 2 + 1}
                fill={isTargetBlock ? '#0369a1' : '#334155'}
                fontSize="15"
                fontWeight="700"
                dominantBaseline="middle"
              >
                {block.name}
              </text>
              <text
                x={block.x + block.width - 14}
                y={block.y + block.titleHeight / 2 + 1}
                fill="#64748b"
                fontSize="11"
                fontWeight="600"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {block.zone || 'Wing'}
              </text>

              {/* Drive aisles */}
              {[block.leftLaneX, block.aisleX, block.rightLaneX].map((x, i) => (
                <rect
                  key={`${block.id}-mini-lane-${i}`}
                  x={x - 6}
                  y={block.corridorY - 14}
                  width="12"
                  height="28"
                  rx="6"
                  fill="#e2e8f0"
                />
              ))}

              {/* Bays */}
              {blockSlots.map((slot) => {
                const isDest = destSlotId === slot.slotId;

                return (
                  <g key={slot.slotId}>
                    {/* Bay box */}
                    <rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      rx="6"
                      fill={isDest ? '#0284c7' : '#ffffff'}
                      stroke={isDest ? '#0369a1' : '#cbd5e1'}
                      strokeWidth={isDest ? '2.5' : '1.2'}
                      strokeDasharray={!isDest && slot.status === 'Empty' ? '3 2' : undefined}
                    />

                    {/* Bay ID */}
                    <text
                      x={slot.x + slot.width / 2}
                      y={slot.y + (isDest ? 22 : 24)}
                      fontSize={isDest ? '15' : '13'}
                      fontWeight="700"
                      textAnchor="middle"
                      fill={isDest ? '#ffffff' : '#1e293b'}
                      fontFamily="monospace, sans-serif"
                    >
                      {slot.id}
                    </text>

                    {/* Sub text or star */}
                    {isDest ? (
                      <text
                        x={slot.x + slot.width / 2}
                        y={slot.y + 44}
                        fontSize="10"
                        fontWeight="800"
                        textAnchor="middle"
                        fill="#f0f9ff"
                        letterSpacing="1"
                      >
                        ★ DESTINATION
                      </text>
                    ) : (
                      <text
                        x={slot.x + slot.width / 2}
                        y={slot.y + 41}
                        fontSize="9"
                        textAnchor="middle"
                        fill="#64748b"
                      >
                        {slot.type === 'ev' ? 'EV' : slot.type === 'visitor' ? 'VISITOR' : 'BAY'}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ------------------------------------------------ Landmarks */}
        {(map?.roads || [])
          .filter((road) => road.type === 'gate' || road.type === 'room')
          .map((road) => {
            const isWatchman = road.type === 'room';
            return (
              <g key={road.id}>
                <rect
                  x={road.x}
                  y={road.y}
                  width={road.width}
                  height={road.height}
                  rx="10"
                  fill={isWatchman ? '#ede9fe' : '#e0f2fe'}
                  stroke={isWatchman ? '#7c3aed' : '#0284c7'}
                  strokeWidth="2"
                />
                <text
                  x={road.x + road.width / 2}
                  y={road.y + road.height / 2 - (isWatchman ? 6 : 4)}
                  fontSize="13"
                  fontWeight="800"
                  textAnchor="middle"
                  fill={isWatchman ? '#5b21b6' : '#0369a1'}
                >
                  {isWatchman ? '★ ' + road.label : road.label}
                </text>
                {road.sublabel ? (
                  <text
                    x={road.x + road.width / 2}
                    y={road.y + road.height / 2 + 12}
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                    fill={isWatchman ? '#6d28d9' : '#0284c7'}
                  >
                    {isWatchman ? 'START LOCATION' : road.sublabel}
                  </text>
                ) : null}
              </g>
            );
          })}

        {/* ------------------------------------------------ Route Polyline */}
        {route?.polyline ? (
          <g>
            {/* Route border casing */}
            <path
              d={route.polyline}
              fill="none"
              stroke="#ffffff"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Main high-contrast route path */}
            <path
              d={route.polyline}
              fill="none"
              stroke="#0284c7"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#ticketRouteArrow)"
            />
            {/* Route dashed centerline */}
            <path
              d={route.polyline}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="6 8"
            />

            {/* Start point marker */}
            <g>
              <circle cx={route.from.x} cy={route.from.y} r="14" fill="#7c3aed" />
              <circle cx={route.from.x} cy={route.from.y} r="6" fill="#ffffff" />
              <text
                x={route.from.x}
                y={route.from.y - 20}
                fontSize="13"
                fontWeight="800"
                textAnchor="middle"
                fill="#5b21b6"
              >
                YOU ARE HERE (START)
              </text>
            </g>

            {/* Destination bay marker */}
            <g>
              <circle cx={route.to.x} cy={route.to.y} r="16" fill="#0284c7" />
              <text
                x={route.to.x}
                y={route.to.y + 5}
                fontSize="14"
                fontWeight="900"
                textAnchor="middle"
                fill="#ffffff"
              >
                ★
              </text>
            </g>
          </g>
        ) : null}
      </svg>

      {/* Mini map print legend */}
      <div className="ticket-map-legend">
        <span className="t-legend-item">
          <i className="t-swatch" style={{ background: '#7c3aed', borderColor: '#5b21b6' }} />
          <strong>Start:</strong> Watchman Room
        </span>
        <span className="t-legend-item">
          <i className="t-swatch" style={{ background: '#0284c7', borderColor: '#0369a1' }} />
          <strong>Route:</strong> Walking Path
        </span>
        <span className="t-legend-item">
          <i className="t-swatch" style={{ background: '#0284c7', borderColor: '#0369a1' }} />
          <strong>Destination:</strong> {destSlotId || 'Assigned Bay'}
        </span>
        <span className="t-legend-item">
          <i className="t-swatch" style={{ background: '#ffffff', borderColor: '#94a3b8' }} />
          <strong>Bays:</strong> 48 Campus Slots
        </span>
      </div>
    </div>
  );
}
