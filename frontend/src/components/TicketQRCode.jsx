/**
 * SmartPark - Inline SVG QR Code Component.
 */

import React, { useMemo } from 'react';
import { generateQrMatrix } from '../services/ticketUtils.js';

export default function TicketQRCode({ text, size = 96, className = '' }) {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(text || 'SmartPark-Ticket');
    } catch {
      return [];
    }
  }, [text]);

  if (!matrix.length) return null;

  const count = matrix.length;
  const cellSize = 100 / count;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`ticket-qr-svg ${className}`}
      role="img"
      aria-label="Ticket verification QR Code"
    >
      <rect width="100" height="100" fill="#ffffff" rx="4" />
      {matrix.map((row, r) =>
        row.map((val, c) =>
          val ? (
            <rect
              key={`${r}-${c}`}
              x={(c * cellSize).toFixed(2)}
              y={(r * cellSize).toFixed(2)}
              width={(cellSize + 0.1).toFixed(2)}
              height={(cellSize + 0.1).toFixed(2)}
              fill="#0f172a"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
