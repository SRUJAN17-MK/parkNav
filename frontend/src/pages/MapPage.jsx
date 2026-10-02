/**
 * SmartPark - full parking map.
 * Every bay is clickable; the side panel shows status and offers navigation.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import ParkingMap from '../maps/ParkingMap.jsx';
import { api } from '../services/api.js';
import { useParking } from '../services/parking.jsx';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Card, EmptyState, KeyValue, Meter, Skeleton, Spinner } from '../components/ui.jsx';
import { SLOT_STYLE } from '../maps/mapTheme.js';
import { formatDateTime, formatTime, occupancyTone } from '../services/format.js';
import { IconGrid, IconNavigation, IconSearch, IconMap, IconCar, IconRefresh, IconX } from '../data/icons.jsx';

export default function MapPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { mapData, blocks, slots, loading, error, refresh, totals, lastUpdated } = useParking();
  const [params, setParams] = useSearchParams();

  const [selected, setSelected] = useState(null);
  const [blockFilter, setBlockFilter] = useState(params.get('block') || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterText, setFilterText] = useState('');
  const [exiting, setExiting] = useState(false);

  // Deep link: /map?slot=A-12
  useEffect(() => {
    const slotId = params.get('slot');
    if (slotId && slots.length) {
      const found = slots.find((s) => s.slotId === slotId.toUpperCase());
      if (found) setSelected(found);
    }
  }, [params, slots]);

  const visibleSlots = useMemo(() => {
    const q = filterText.trim().toUpperCase();
    return slots.filter((s) => (blockFilter === 'ALL' ? true : s.blockId === blockFilter))
      .filter((s) => (statusFilter === 'ALL' ? true : s.status === statusFilter))
      .filter((s) => (q ? s.slotId.includes(q) || (s.vehicleNumber || '').includes(q) : true));
  }, [slots, blockFilter, statusFilter, filterText]);

  const highlightIds = useMemo(() => new Set(visibleSlots.map((s) => s.slotId)), [visibleSlots]);

  function onSelectSlot(slot) {
    setSelected(slot);
  }

  async function releaseSlot() {
    if (!selected) return;
    setExiting(true);
    try {
      const res = await api.recordExit({ slotId: selected.slotId });
      toast.success('Slot released ✓', res.message);
      await refresh();
      const refreshed = res.slot;
      setSelected({ ...selected, ...refreshed });
    } catch (err) {
      toast.error('Exit failed', err.message);
    } finally {
      setExiting(false);
    }
  }

  if (loading && !mapData) return <Skeleton height={520} />;
  if (error && !mapData) return <Alert tone="danger">{error}</Alert>;

  return (
    <div className="stack">
      {/* ------------------------------------------------------ KPIs */}
      <div className="grid grid-4">
        <Card bodyClass="tight">
          <div className="row">
            <span className="badge badge-brand">Total</span>
            <div className="spacer" />
            <span className="strong" style={{ fontSize: 20 }}>
              {totals.slots}
            </span>
          </div>
        </Card>
        <Card bodyClass="tight">
          <div className="row">
            <span className="badge badge-danger">Occupied</span>
            <div className="spacer" />
            <span className="strong" style={{ fontSize: 20 }}>
              {totals.occupied}
            </span>
          </div>
        </Card>
        <Card bodyClass="tight">
          <div className="row">
            <span className="badge badge-ok">Available</span>
            <div className="spacer" />
            <span className="strong" style={{ fontSize: 20 }}>
              {totals.empty}
            </span>
          </div>
        </Card>
        <Card bodyClass="tight">
          <div className="row">
            <span className="badge badge-violet">Shown</span>
            <div className="spacer" />
            <span className="strong" style={{ fontSize: 20 }}>
              {visibleSlots.length}
            </span>
          </div>
        </Card>
      </div>

      {/* ---------------------------------------------------- filters */}
      <Card bodyClass="tight">
        <div className="row-wrap" style={{ gap: 10 }}>
          <div className="segmented">
            <button className={blockFilter === 'ALL' ? 'active' : ''} onClick={() => setBlockFilter('ALL')} type="button">
              All blocks
            </button>
            {blocks.map((b) => (
              <button
                key={b.id}
                className={blockFilter === b.id ? 'active' : ''}
                onClick={() => setBlockFilter(b.id)}
                type="button"
              >
                {b.name} · {b.empty} free
              </button>
            ))}
          </div>

          <div className="segmented">
            {['ALL', 'Occupied', 'Empty'].map((s) => (
              <button
                key={s}
                className={statusFilter === s ? 'active' : ''}
                onClick={() => setStatusFilter(s)}
                type="button"
              >
                {s === 'ALL' ? 'Any' : s}
              </button>
            ))}
          </div>

          <div className="searchbar" style={{ maxWidth: 260 }}>
            <span className="search-ico">
              <IconSearch size={15} />
            </span>
            <input
              className="input mono"
              style={{ paddingLeft: 36, padding: '9px 12px 9px 36px' }}
              placeholder="A-12 or KA01AB1234"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>

          <div className="spacer" />
          <span className="tiny muted nowrap">
            Updated {lastUpdated ? formatTime(lastUpdated) : '—'}
          </span>
          <button className="btn btn-sm" onClick={refresh} disabled={loading}>
            {loading ? <Spinner /> : <IconRefresh size={14} />} Refresh
          </button>
        </div>
      </Card>

      <div className="split-nav">
        {/* ------------------------------------------------------ map */}
        <Card bodyClass="flush" title="Campus layout" hint="Click any bay to inspect it" icon={<IconMap size={17} />}>
          <ParkingMap
            map={mapData}
            selectedSlot={selected?.slotId}
            routeSlotIds={highlightIds}
            showRoute={false}
            onSelectSlot={onSelectSlot}
            hint={`${visibleSlots.length} of ${totals.slots} bays shown`}
          />
          <div className="map-legend">
            <span className="legend-item">
              <i className="legend-swatch" style={{ background: SLOT_STYLE.empty.fill, borderColor: SLOT_STYLE.empty.stroke }} />
              Empty
            </span>
            <span className="legend-item">
              <i className="legend-swatch" style={{ background: SLOT_STYLE.occupied.fill, borderColor: SLOT_STYLE.occupied.stroke }} />
              Occupied
            </span>
            <span className="legend-item">
              <i className="legend-swatch" style={{ background: SLOT_STYLE.ev.fill, borderColor: SLOT_STYLE.ev.stroke }} />
              EV bay
            </span>
            <span className="legend-item">
              <i className="legend-swatch" style={{ background: SLOT_STYLE.visitor.fill, borderColor: SLOT_STYLE.visitor.stroke }} />
              Visitor bay
            </span>
            <span className="legend-item">
              <i className="legend-swatch" style={{ background: 'rgba(34,211,238,0.2)', borderColor: '#22d3ee' }} />
              Main gate (ANPR)
            </span>
            <span className="legend-item">
              <i className="legend-swatch" style={{ background: 'rgba(167,139,250,0.2)', borderColor: '#a78bfa' }} />
              Watchman room
            </span>
          </div>
        </Card>

        {/* ------------------------------------------------- side panel */}
        <div className="stack">
          {selected ? (
            <Card
              title={`Parking ${selected.slotId}`}
              hint={`${selected.blockName} · row ${selected.row + 1} · bay ${selected.col + 1}`}
              icon={<IconGrid size={17} />}
              actions={
                <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)} title="Clear selection">
                  <IconX size={14} />
                </button>
              }
            >
              <div className="stack" style={{ gap: 14 }}>
                <div className="row-wrap">
                  <Badge tone={selected.status === 'Occupied' ? 'danger' : 'ok'} dot>
                    {selected.status}
                  </Badge>
                  {selected.type !== 'standard' ? (
                    <Badge tone={selected.type === 'ev' ? 'cyan' : 'violet'}>{selected.type.toUpperCase()} bay</Badge>
                  ) : null}
                  <Badge tone="mute">Row {selected.row + 1}</Badge>
                  <Badge tone="mute">Column {selected.col + 1}</Badge>
                </div>

                {selected.vehicleNumber ? (
                  <div>
                    <div className="tiny muted">Vehicle in this bay</div>
                    <div className="mono strong mt-1" style={{ fontSize: 17 }}>
                      {selected.vehicleNumber}
                    </div>
                    {selected.entryTime ? (
                      <div className="tiny muted">Parked since {formatDateTime(selected.entryTime)}</div>
                    ) : null}
                  </div>
                ) : (
                  <Alert tone="ok">This bay is free and can be allocated to the next arriving vehicle.</Alert>
                )}

                <KeyValue
                  items={[
                    { label: 'Slot ID', value: <span className="mono">{selected.slotId}</span> },
                    { label: 'Block', value: selected.blockName },
                    {
                      label: 'From watchman',
                      value: selected.distanceFromWatchmanM != null ? `${Math.round(selected.distanceFromWatchmanM)} m` : '—',
                    },
                    {
                      label: 'From main gate',
                      value: selected.distanceFromGateM != null ? `${Math.round(selected.distanceFromGateM)} m` : '—',
                    },
                  ]}
                />

                <div className="row-wrap">
                  <button className="btn btn-cyan" onClick={() => navigate(`/navigate?slot=${selected.slotId}`)}>
                    <IconNavigation size={15} /> Navigate here
                  </button>
                  {selected.status === 'Occupied' ? (
                    <button className="btn btn-danger" onClick={releaseSlot} disabled={exiting}>
                      {exiting ? 'Releasing…' : 'Record exit'}
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Select a bay" icon={<IconGrid size={17} />}>
              <EmptyState
                icon={<IconMap size={22} />}
                title="Nothing selected"
                message="Click any bay on the map to see its status, the vehicle parked there and the walking distance from the watchman room."
              />
            </Card>
          )}

          <Card title="Block occupancy" icon={<IconCar size={17} />}>
            <div className="stack" style={{ gap: 12 }}>
              {blocks.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setBlockFilter(block.id)}
                >
                  <div className="row" style={{ marginBottom: 5 }}>
                    <span className="small strong">{block.name}</span>
                    <span className="tiny muted">{block.zone}</span>
                    <div className="spacer" />
                    <span className="tiny muted">
                      {block.occupied}/{block.total} · {block.empty} free
                    </span>
                  </div>
                  <Meter value={block.occupancy} tone={occupancyTone(block.occupancy)} />
                </button>
              ))}
            </div>
          </Card>

          <Card title="Bays in the current filter" icon={<IconGrid size={17} />} bodyClass="flush">
            {visibleSlots.length ? (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table className="tbl" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Slot</th>
                      <th>Vehicle</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSlots.map((slot) => (
                      <tr
                        key={slot.slotId}
                        onClick={() => setSelected(slot)}
                        style={{
                          cursor: 'pointer',
                          background: selected?.slotId === slot.slotId ? 'var(--brand-soft)' : undefined,
                        }}
                      >
                        <td className="mono strong">{slot.id}</td>
                        <td className="mono tiny">{slot.vehicleNumber || '—'}</td>
                        <td>
                          <Badge tone={slot.status === 'Occupied' ? 'danger' : 'ok'} dot>
                            {slot.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No bays match" message="Clear the filters to see all 48 bays." />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
