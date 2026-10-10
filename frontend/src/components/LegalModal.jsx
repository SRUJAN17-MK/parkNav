/**
 * SmartPark - Privacy Policy & Terms and Conditions Modal.
 */

import React from 'react';
import { IconX, IconShield } from '../data/icons.jsx';

export default function LegalModal({ isOpen, type, onClose }) {
  if (!isOpen) return null;

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';

  return (
    <div className="ticket-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ticket-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <header className="ticket-modal-header">
          <div className="ticket-modal-title">
            <span className="modal-icon-badge">
              <IconShield size={18} />
            </span>
            <div>
              <h3>{title}</h3>
              <div className="modal-sub">SmartPark Apartment Parking Management System</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <IconX size={18} />
          </button>
        </header>

        <div className="ticket-modal-body" style={{ background: 'var(--surface)', color: 'var(--text)', padding: 24, fontSize: 13.5, lineHeight: 1.6, display: 'block' }}>
          {isPrivacy ? (
            <div className="stack" style={{ gap: 14 }}>
              <h4>1. Information Collection & ANPR Processing</h4>
              <p className="dim">
                SmartPark captures vehicle registration numbers and timestamp metadata at campus entry and exit gates strictly for resident and visitor parking management, automated slot allocation, and indoor navigation.
              </p>
              <h4>2. Data Security & Storage</h4>
              <p className="dim">
                Vehicle logs and session histories are securely stored within authorized local facility databases. No personal contact numbers or driver financial details are shared with external third parties.
              </p>
              <h4>3. Image Capture & OCR Retention</h4>
              <p className="dim">
                Camera frames used for optical character recognition (OCR) are processed in real-time and retained only in temporary cache for verification and security audit logs as mandated by apartment society management.
              </p>
              <h4>4. Resident & Visitor Rights</h4>
              <p className="dim">
                Apartment residents may review their registered vehicle allocation and entry records by contacting the society security administrator.
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <h4>1. Permitted Campus Parking Use</h4>
              <p className="dim">
                All drivers must park only in their assigned bay as indicated on the navigation ticket or system assignment dashboard. Parking in unauthorized bays or blocking aisles is strictly prohibited.
              </p>
              <h4>2. Navigation & Speed Limits</h4>
              <p className="dim">
                Vehicles must maintain a maximum speed limit of 10 km/h on the Main Parking Road and cross roads, observing all directional signs, pedestrian walkways, and indoor corridors.
              </p>
              <h4>3. EV & Special Bay Allocations</h4>
              <p className="dim">
                Designated EV charging slots (e.g. Bay A-11) and Visitor bays (e.g. Bay C-01) are reserved strictly for authorized charging vehicles and registered campus guests.
              </p>
              <h4>4. Ticket Validity</h4>
              <p className="dim">
                Issued parking navigation tickets are valid for single entry sessions and should be displayed on vehicle dashboards or retained on mobile devices for verification upon security request.
              </p>
            </div>
          )}
        </div>

        <footer className="ticket-modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
