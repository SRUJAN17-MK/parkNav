/**
 * SmartPark - Printable Parking Ticket Component.
 *
 * Designed like a real physical bus / parking receipt ticket with:
 *   - Clean header with facility name, title, unique ticket serial, and timestamp
 *   - Prominently highlighted destination parking bay (Block, Bay, Zone, Row/Col)
 *   - Navigation stats (Distance, Estimated Walking Time, Total Steps)
 *   - High-contrast vector Mini Parking Map showing the walking route from the Watchman Room
 *   - Concise step-by-step walking directions
 *   - Verification QR code and barcode
 *   - Official notice footer
 *
 * Can be rendered standalone, inside the interactive Preview Modal, and into the print container.
 */

import React, { useMemo } from 'react';
import TicketMiniMap from './TicketMiniMap.jsx';
import TicketQRCode from './TicketQRCode.jsx';
import { IconPrint, IconX, IconCheckCircle, IconNavigation, IconPin, IconClock, IconShield } from '../data/icons.jsx';
import { generateTicketId, formatTicketDate } from '../services/ticketUtils.js';

export function ParkingTicketContent({ route, mapData, slot, ticketId, issuedAt }) {
  const steps = route?.steps?.steps || [];
  const distance = route ? `${Math.round(route.distanceM)} metres` : '—';
  const duration = route?.durationLabel || (route ? `${route.durationSec} seconds` : '—');
  const totalSteps = steps.length;
  const blockName = route?.blockName || (route?.blockId ? `Block ${route.blockId}` : 'Block A');
  const bayId = route?.slotId || 'A-11';
  const zone = route?.zone || 'North-West Wing';
  const fullDestination = `${blockName}, Parking ${bayId}`;
  const slotType = slot?.type === 'ev' ? 'EV Charging Bay' : slot?.type === 'visitor' ? 'Visitor Bay' : 'Standard Bay';

  // QR verification payload
  const qrPayload = useMemo(() => {
    return JSON.stringify({
      tkt: ticketId,
      bay: bayId,
      block: blockName,
      dist: distance,
      time: duration,
      dt: issuedAt,
    });
  }, [ticketId, bayId, blockName, distance, duration, issuedAt]);

  return (
    <div className="printable-ticket-card">
      {/* Top perforated edge effect */}
      <div className="ticket-perforation-edge top" />

      {/* Ticket Header */}
      <div className="ticket-header">
        <div className="ticket-facility-name">SMARTPARK CAMPUS</div>
        <div className="ticket-facility-sub">Smart Apartment Parking Management System</div>
        <div className="ticket-title-badge">
          <span>PARKING NAVIGATION TICKET</span>
        </div>
        <div className="ticket-meta-grid">
          <div>
            <span className="t-meta-k">TICKET NO:</span>
            <span className="t-meta-v mono">{ticketId}</span>
          </div>
          <div>
            <span className="t-meta-k">ISSUED:</span>
            <span className="t-meta-v">{issuedAt}</span>
          </div>
          <div>
            <span className="t-meta-k">START POINT:</span>
            <span className="t-meta-v">Watchman Room / Security</span>
          </div>
          <div>
            <span className="t-meta-k">STATUS:</span>
            <span className="t-meta-v" style={{ color: '#0369a1', fontWeight: '700' }}>
              ACTIVE PASS
            </span>
          </div>
        </div>
      </div>

      <div className="ticket-divider dashed" />

      {/* Prominent Destination Box */}
      <div className="ticket-destination-box">
        <div className="t-dest-label">ASSIGNED PARKING DESTINATION</div>
        <div className="t-dest-main">
          <span className="t-dest-block">{blockName}</span>
          <span className="t-dest-bay">{bayId}</span>
        </div>
        <div className="t-dest-full">
          <strong>Full Destination:</strong> {fullDestination}
        </div>
        <div className="t-dest-sub">
          <span>
            <strong>Zone:</strong> {zone}
          </span>
          <span>•</span>
          <span>
            <strong>Type:</strong> {slotType}
          </span>
          {route?.slotPosition ? (
            <>
              <span>•</span>
              <span>
                <strong>Row/Col:</strong> R{route.slotPosition.row} / C{route.slotPosition.column}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Navigation Quick Stats */}
      <div className="ticket-stats-grid">
        <div className="t-stat-cell">
          <div className="t-stat-k">Distance</div>
          <div className="t-stat-v">{distance}</div>
        </div>
        <div className="t-stat-cell">
          <div className="t-stat-k">Est. Walking Time</div>
          <div className="t-stat-v">{duration}</div>
        </div>
        <div className="t-stat-cell">
          <div className="t-stat-k">Nav Steps</div>
          <div className="t-stat-v">{totalSteps} steps</div>
        </div>
      </div>

      <div className="ticket-divider dashed" />

      {/* Mini Parking Map */}
      <div className="ticket-section">
        <div className="ticket-section-title">
          <span>PARKING MAP & WALKING ROUTE</span>
        </div>
        <TicketMiniMap map={mapData} route={route} />
      </div>

      <div className="ticket-divider dashed" />

      {/* Step-by-Step Walking Directions */}
      <div className="ticket-section">
        <div className="ticket-section-title">
          <span>STEP-BY-STEP WALKING DIRECTIONS</span>
        </div>
        {steps.length > 0 ? (
          <ol className="ticket-directions-list">
            {steps.map((step, idx) => (
              <li key={step.order || idx} className="ticket-dir-item">
                <span className="t-dir-num">{idx + 1}.</span>
                <div className="t-dir-text">
                  <div className="t-dir-instruction">
                    {step.instruction || `Follow walking route (${Math.round(step.distanceM || 0)} m)`}
                  </div>
                  <div className="t-dir-detail">
                    {step.distanceM != null ? `${Math.round(step.distanceM)} m ground distance` : ''}
                    {step.road ? ` · via ${step.road}` : ''}
                    {step.compass ? ` · heading ${step.compass}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="ticket-dir-empty">
            1. Exit the Watchman Room and follow the highlighted route to {bayId}.
          </div>
        )}
      </div>

      <div className="ticket-divider dashed" />

      {/* Verification & Barcode / QR Code */}
      <div className="ticket-security-grid">
        <div className="ticket-qr-wrap">
          <TicketQRCode text={qrPayload} size={84} />
          <div className="ticket-qr-caption">Scan to Verify</div>
        </div>
        <div className="ticket-barcode-wrap">
          {/* Stylized vector barcode */}
          <div className="ticket-barcode-svg">
            <svg viewBox="0 0 160 38" width="100%" height="38">
              <rect x="0" y="0" width="160" height="38" fill="#ffffff" />
              {[
                3, 7, 10, 15, 17, 22, 24, 27, 32, 36, 40, 43, 48, 51, 56, 59, 62, 66, 71, 74, 78, 83,
                86, 91, 95, 98, 102, 107, 111, 114, 119, 122, 126, 131, 134, 138, 143, 146, 150, 154,
              ].map((x, i) => (
                <rect
                  key={i}
                  x={x}
                  y="2"
                  width={i % 3 === 0 ? '3.5' : i % 2 === 0 ? '2' : '1.2'}
                  height="34"
                  fill="#0f172a"
                />
              ))}
            </svg>
          </div>
          <div className="ticket-serial-mono">{ticketId}</div>
          <div className="ticket-security-badge">
            <IconShield size={12} /> Verified SmartPark Security
          </div>
        </div>
      </div>

      <div className="ticket-divider dashed" />

      {/* Ticket Footer */}
      <div className="ticket-footer">
        <div className="ticket-footer-important">PLEASE PARK ONLY IN YOUR ASSIGNED BAY</div>
        <div className="ticket-footer-note">
          Keep this ticket on your dashboard or phone. For assistance, contact Security Control / Watchman Room.
        </div>
      </div>

      {/* Bottom perforated edge effect */}
      <div className="ticket-perforation-edge bottom" />
    </div>
  );
}

export default function PrintableParkingTicket({
  route,
  mapData,
  slot,
  isOpen = false,
  onClose,
  onPrint,
}) {
  const [ticketId, setTicketId] = React.useState('');
  const [issuedAt, setIssuedAt] = React.useState('');

  // Update unique ticket id & timestamp whenever modal opens or route changes
  React.useEffect(() => {
    if (route?.slotId) {
      setTicketId(generateTicketId(route.slotId));
      setIssuedAt(formatTicketDate());
    }
  }, [route?.slotId, isOpen]);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  if (!route) return null;

  return (
    <>
      {/* Hidden print container that appears strictly during window.print() */}
      <div id="print-ticket-root" className="print-only-ticket-root">
        <ParkingTicketContent
          route={route}
          mapData={mapData}
          slot={slot}
          ticketId={ticketId || generateTicketId(route.slotId)}
          issuedAt={issuedAt || formatTicketDate()}
        />
      </div>

      {/* Interactive On-Screen Preview Modal */}
      {isOpen ? (
        <div className="ticket-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
          <div className="ticket-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <header className="ticket-modal-header">
              <div className="ticket-modal-title">
                <span className="modal-icon-badge">
                  <IconPrint size={18} />
                </span>
                <div>
                  <h3>Parking Navigation Ticket</h3>
                  <div className="modal-sub">
                    Preview your printable bus-style parking pass for {route.blockName} • Bay {route.slotId}
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close modal">
                <IconX size={18} />
              </button>
            </header>

            {/* Modal Body with Ticket Card */}
            <div className="ticket-modal-body">
              <div className="ticket-preview-wrapper">
                <ParkingTicketContent
                  route={route}
                  mapData={mapData}
                  slot={slot}
                  ticketId={ticketId || generateTicketId(route.slotId)}
                  issuedAt={issuedAt || formatTicketDate()}
                />
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <footer className="ticket-modal-footer">
              <button className="btn" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-cyan btn-lg" onClick={handlePrint}>
                <IconPrint size={17} /> Print Parking Ticket (PDF / Paper)
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
