/**
 * SmartPark - vehicle detail card.
 * Shared by the dashboard, search results, history and the map page.
 */

import { useNavigate } from 'react-router-dom';

import { Badge, KeyValue, Plate, MiniStat } from './ui.jsx';
import { formatDateTime, formatDuration, formatTime, plateStatus } from '../services/format.js';
import { IconMap, IconNavigation, IconCar, IconBuilding } from '../data/icons.jsx';

export default function VehicleCard({
  vehicle,
  distanceM,
  showActions = true,
  onExit,
  exiting = false,
  compact = false,
}) {
  const navigate = useNavigate();
  if (!vehicle) return null;

  const tone = plateStatus(vehicle.status);
  const isParked = vehicle.status === 'Parked';

  return (
    <div className="card" style={{ borderColor: isParked ? 'rgba(239,68,68,0.28)' : 'var(--line-soft)' }}>
      <div className="card-head">
        <span className="nav-ico" style={{ color: 'var(--brand-2)' }}>
          <IconCar size={17} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 className="mono" style={{ fontSize: 15 }}>
            {vehicle.vehicleNumber}
          </h3>
          <div className="hint truncate">
            {vehicle.ownerName}
            {vehicle.ownerFlat ? ` · Flat ${vehicle.ownerFlat}` : ''}
          </div>
        </div>
        <div className="spacer" />
        <Badge tone={tone.tone} dot={isParked}>
          {tone.label}
        </Badge>
      </div>

      <div className="card-body">
        {compact ? (
          <div className="mini-kv">
            <div>
              <div className="k">Block</div>
              <div className="v">{vehicle.blockName || '—'}</div>
            </div>
            <div>
              <div className="k">Slot</div>
              <div className="v">{vehicle.slotId || '—'}</div>
            </div>
            <div>
              <div className="k">Entry</div>
              <div className="v">{formatTime(vehicle.entryTime)}</div>
            </div>
          </div>
        ) : (
          <KeyValue
            items={[
              { label: 'Vehicle number', value: <Plate size="sm">{vehicle.vehicleNumber}</Plate> },
              { label: 'Owner', value: vehicle.ownerName },
              { label: 'Flat', value: vehicle.ownerFlat || '—' },
              { label: 'Vehicle', value: [vehicle.brand, vehicle.color].filter(Boolean).join(' · ') || vehicle.vehicleType || '—' },
              { label: 'Block', value: vehicle.blockName || '—' },
              { label: 'Parking slot', value: vehicle.slotId || '—' },
              { label: 'Entry time', value: formatDateTime(vehicle.entryTime) },
              { label: 'Exit time', value: vehicle.exitTime ? formatDateTime(vehicle.exitTime) : '—' },
              {
                label: 'Duration',
                value: vehicle.exitTime
                  ? formatDuration((new Date(vehicle.exitTime) - new Date(vehicle.entryTime)) / 60000)
                  : vehicle.stayedMinutes != null
                    ? formatDuration(vehicle.stayedMinutes)
                    : '—',
              },
              { label: 'Recorded by', value: `${vehicle.source || 'ANPR'}${vehicle.ocrConfidence ? ` · ${vehicle.ocrConfidence}% OCR` : ''}` },
            ]}
          />
        )}

        {distanceM != null ? (
          <div className="mt-2">
            <MiniStat
              items={[
                { label: 'From watchman room', value: `${Math.round(distanceM)} m` },
                { label: 'Walk time', value: `~${Math.max(1, Math.round(distanceM / 1.25 / 60))} min` },
              ]}
            />
          </div>
        ) : null}

        {showActions ? (
          <div className="row-wrap mt-3">
            <button className="btn btn-sm" onClick={() => navigate(`/map?slot=${vehicle.slotId || ''}`)} disabled={!vehicle.slotId}>
              <IconMap size={15} /> View on map
            </button>
            <button
              className="btn btn-sm btn-cyan"
              onClick={() => navigate(`/navigate?slot=${vehicle.slotId || ''}`)}
              disabled={!vehicle.slotId}
            >
              <IconNavigation size={15} /> Navigate
            </button>
            {isParked && onExit ? (
              <button className="btn btn-sm btn-danger" onClick={() => onExit(vehicle)} disabled={exiting}>
                {exiting ? 'Releasing…' : 'Record exit'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Compact one-line row used inside tables. */
export function VehicleRow({ vehicle, onExit, exiting }) {
  const navigate = useNavigate();
  const tone = plateStatus(vehicle.status);

  return (
    <tr>
      <td>
        <Plate size="sm">{vehicle.vehicleNumber}</Plate>
      </td>
      <td>
        <div className="strong">{vehicle.ownerName}</div>
        {vehicle.ownerFlat ? <div className="tiny muted">{vehicle.ownerFlat}</div> : null}
      </td>
      <td>
        <span className="row" style={{ gap: 6 }}>
          <IconBuilding size={14} style={{ color: 'var(--text-mute)' }} />
          {vehicle.blockName || '—'}
        </span>
      </td>
      <td className="mono strong">{vehicle.slotId || '—'}</td>
      <td className="nowrap">{formatDateTime(vehicle.entryTime)}</td>
      <td className="nowrap">{vehicle.exitTime ? formatDateTime(vehicle.exitTime) : '—'}</td>
      <td>
        <Badge tone={tone.tone} dot={vehicle.status === 'Parked'}>
          {tone.label}
        </Badge>
      </td>
      <td>
        <div className="row" style={{ gap: 6 }}>
          {vehicle.slotId ? (
            <>
              <button className="btn btn-sm" onClick={() => navigate(`/map?slot=${vehicle.slotId}`)}>
                Map
              </button>
              <button className="btn btn-sm btn-cyan" onClick={() => navigate(`/navigate?slot=${vehicle.slotId}`)}>
                Nav
              </button>
            </>
          ) : null}
          {vehicle.status === 'Parked' && onExit ? (
            <button className="btn btn-sm btn-danger" onClick={() => onExit(vehicle)} disabled={exiting}>
              Exit
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
