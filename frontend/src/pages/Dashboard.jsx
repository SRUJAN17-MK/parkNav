/**
 * SmartPark - watchman dashboard.
 * Occupancy KPIs, per-block breakdown, quick search, recent activity and the
 * demo entry/exit triggers.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../services/api.js';
import { useParking } from '../services/parking.jsx';
import { useAuth } from '../services/auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Card, EmptyState, Meter, MiniStat, Skeleton, StatCard } from '../components/ui.jsx';
import { formatDuration, formatTime, formatDateTime, occupancyTone } from '../services/format.js';
import {
  IconGrid,
  IconCar,
  IconCheckCircle,
  IconTrendUp,
  IconSearch,
  IconArrowRight,
  IconBuilding,
  IconClock,
  IconZap,
  IconLogout,
  IconGauge,
  IconCamera,
} from '../data/icons.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { refresh } = useParking();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.stats();
      setStats(res.stats);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function simulateEntry() {
    setBusy('entry');
    try {
      const res = await api.simulateEntry({ vehicleType: 'Car' });
      const r = res.report;
      if (r.success) {
        toast.success('Vehicle parked', `${r.vehicleNumber} -> ${r.block} / ${r.slot}`);
      } else {
        toast.error('Entry rejected', r.message || `Reason: ${r.reason}`);
      }
      await Promise.all([load(), refresh()]);
    } catch (err) {
      toast.error('Entry failed', err.message);
    } finally {
      setBusy('');
    }
  }

  async function simulateExit() {
    setBusy('exit');
    try {
      const res = await api.simulateExit({});
      const r = res.report;
      toast.success('Slot released', r.message);
      await Promise.all([load(), refresh()]);
    } catch (err) {
      toast.error('Exit failed', err.message);
    } finally {
      setBusy('');
    }
  }

  function onSearch(event) {
    event.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  if (loading && !stats) {
    return (
      <div className="stack">
        <div className="grid grid-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={124} />
          ))}
        </div>
        <Skeleton height={260} />
      </div>
    );
  }

  if (error && !stats) return <Alert tone="danger">{error}</Alert>;

  const occupancy = stats.occupancyRate;

  return (
    <div className="stack">
      {/* ------------------------------------------------------ header */}
      <div className="row-wrap">
        <div>
          <h2 style={{ fontSize: 20 }}>Welcome, {user?.name?.split(' ')[0] || 'Watchman'}</h2>
          <p className="small muted">
            Sunrise Apartments · {stats.totalSlots} bays across {stats.byBlock.length} blocks
            {user?.shift ? ` · ${user.shift}` : ''}
          </p>
        </div>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={simulateEntry} disabled={busy === 'entry'}>
          <IconCamera size={16} /> {busy === 'entry' ? 'Reading plate...' : 'Simulate vehicle entry'}
        </button>
        <button className="btn btn-danger" onClick={simulateExit} disabled={busy === 'exit'}>
          <IconLogout size={16} /> {busy === 'exit' ? 'Releasing...' : 'Simulate vehicle exit'}
        </button>
      </div>

      {/* -------------------------------------------------------- KPIs */}
      <div className="grid grid-4">
        <StatCard
          icon={<IconGrid size={17} />}
          label="Total slots"
          value={stats.totalSlots}
          tone="brand"
          foot={`${stats.byBlock.length} blocks · 4 zones`}
        />
        <StatCard
          icon={<IconCar size={17} />}
          label="Occupied"
          value={stats.occupiedSlots}
          tone="danger"
          foot={`${occupancy}% of the campus`}
        >
          <div className="mt-1">
            <Meter value={occupancy} tone={occupancyTone(occupancy)} />
          </div>
        </StatCard>
        <StatCard
          icon={<IconCheckCircle size={17} />}
          label="Available"
          value={stats.availableSlots}
          tone="ok"
          foot="Free bays right now"
        />
        <StatCard
          icon={<IconTrendUp size={17} />}
          label="Vehicles today"
          value={stats.vehiclesToday}
          tone="violet"
          foot={`${stats.exitsToday} exits · ${stats.totalVehicles} total records`}
        />
      </div>

      {/* ------------------------------------------------- search + demo */}
      <div className="grid grid-2-1">
        <Card title="Quick search" hint="Vehicle number, parking slot, block or owner" icon={<IconSearch size={17} />}>
          <form onSubmit={onSearch} className="row-wrap" style={{ gap: 10 }}>
            <div className="searchbar">
              <span className="search-ico">
                <IconSearch size={17} />
              </span>
              <input
                className="input mono"
                placeholder="KA01AB1234  ·  A-12  ·  Block B"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Search <IconArrowRight size={15} />
            </button>
          </form>

          <div className="row-wrap mt-3 tiny muted">
            <span>Try:</span>
            {(stats.recentEntries || []).slice(0, 3).map((v) => (
              <button
                key={v.vehicleNumber}
                className="badge badge-mute copiable"
                onClick={() => navigate(`/search?q=${v.vehicleNumber}`)}
                type="button"
              >
                {v.vehicleNumber}
              </button>
            ))}
            {['A-12', 'B-07', 'Block C'].map((chip) => (
              <button
                key={chip}
                className="badge badge-brand copiable"
                onClick={() => navigate(`/search?q=${encodeURIComponent(chip)}`)}
                type="button"
              >
                {chip}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Live performance" icon={<IconGauge size={17} />}>
          <MiniStat
            items={[
              { label: 'Occupancy', value: `${occupancy}%` },
              { label: 'Avg stay', value: formatDuration(stats.averageStayMinutes) },
              { label: 'Longest stay', value: `${stats.longestStayHours} h` },
              { label: 'Parked now', value: stats.vehiclesParked },
            ]}
          />
          <div className="mt-3">
            <div className="row tiny muted" style={{ justifyContent: 'space-between' }}>
              <span>Campus load</span>
              <span className="strong" style={{ color: 'var(--text)' }}>
                {stats.occupiedSlots}/{stats.totalSlots}
              </span>
            </div>
            <div className="mt-1">
              <Meter value={occupancy} tone={occupancyTone(occupancy)} />
            </div>
          </div>
          <button className="btn btn-block mt-3" onClick={() => navigate('/map')}>
            <IconGrid size={15} /> Open parking map
          </button>
        </Card>
      </div>

      {/* -------------------------------------------------- block table */}
      <Card title="Occupancy by block" hint="Click a block to filter the parking map" icon={<IconBuilding size={17} />}>
        <div className="grid grid-4">
          {stats.byBlock.map((block) => (
            <button
              key={block.blockId}
              className="stat"
              style={{
                '--accent': 'var(--brand)',
                textAlign: 'left',
                cursor: 'pointer',
                background: 'var(--bg-soft)',
              }}
              onClick={() => navigate(`/map?block=${block.blockId}`)}
              type="button"
            >
              <div className="row">
                <div>
                  <div className="strong">{block.blockName}</div>
                  <div className="tiny muted">{block.zone}</div>
                </div>
                <div className="spacer" />
                <div style={{ textAlign: 'right' }}>
                  <div className="strong" style={{ fontSize: 19 }}>
                    {block.occupied}
                    <span className="muted" style={{ fontSize: 13 }}>
                      /{block.total}
                    </span>
                  </div>
                  <div className="tiny muted">{block.occupancy}%</div>
                </div>
              </div>
              <div className="mt-1">
                <Meter value={block.occupancy} tone={occupancyTone(block.occupancy)} />
              </div>
              <div className="row-wrap mt-1" style={{ gap: 6 }}>
                {block.evSlots ? <Badge tone="cyan">{block.evSlots} EV</Badge> : null}
                {block.visitorSlots ? <Badge tone="violet">{block.visitorSlots} visitor</Badge> : null}
                <Badge tone="ok">{block.empty} free</Badge>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------ recent activity */}
      <div className="grid grid-2">
        <Card
          title="Recent entries"
          hint="Today"
          icon={<IconZap size={17} />}
          bodyClass="flush"
          actions={
            <button className="btn btn-sm" onClick={() => navigate('/history?range=today&status=Parked')}>
              View all
            </button>
          }
        >
          {stats.recentEntries?.length ? (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Owner</th>
                    <th>Slot</th>
                    <th>Entry</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stats.recentEntries.map((v) => (
                    <tr key={`${v.vehicleNumber}-${v.entryTime}`}>
                      <td className="mono strong nowrap">{v.vehicleNumber}</td>
                      <td className="truncate">{v.ownerName}</td>
                      <td>
                        <span className="badge badge-mute">{v.slotId}</span>{' '}
                        <span className="tiny muted">{v.blockName}</span>
                      </td>
                      <td className="nowrap">{formatTime(v.entryTime)}</td>
                      <td>
                        <button className="btn btn-sm btn-cyan" onClick={() => navigate(`/navigate?slot=${v.slotId}`)}>
                          Nav
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No entries yet today" message="Use “Simulate vehicle entry” to trigger the ANPR pipeline." />
          )}
        </Card>

        <Card
          title="Recent exits"
          hint="Today"
          icon={<IconClock size={17} />}
          bodyClass="flush"
          actions={
            <button className="btn btn-sm" onClick={() => navigate('/history?range=today&status=Exited')}>
              View all
            </button>
          }
        >
          {stats.recentExits?.length ? (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Owner</th>
                    <th>Slot</th>
                    <th>Exit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stats.recentExits.map((v) => (
                    <tr key={`${v.vehicleNumber}-${v.exitTime}`}>
                      <td className="mono strong nowrap">{v.vehicleNumber}</td>
                      <td className="truncate">{v.ownerName}</td>
                      <td>
                        <span className="badge badge-mute">{v.slotId}</span>
                      </td>
                      <td className="nowrap">{formatTime(v.exitTime)}</td>
                      <td>
                        <span className="badge badge-ok">Slot free</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No exits yet today" message="Released bays appear here as vehicles leave." />
          )}
        </Card>
      </div>

      {/* -------------------------------------------------- camera feed */}
      <Card
        title="ANPR camera activity"
        hint="Every gate decision, newest first"
        icon={<IconCamera size={17} />}
        bodyClass="flush"
        actions={
          <button className="btn btn-sm" onClick={() => navigate('/camera')}>
            Open console
          </button>
        }
      >
        {stats.recentEvents?.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Vehicle</th>
                  <th>Slot</th>
                  <th>Detail</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <Badge tone={ev.type === 'Entry' ? 'ok' : ev.type === 'Exit' ? 'brand' : 'danger'} dot>
                        {ev.type}
                      </Badge>
                    </td>
                    <td className="mono">{ev.vehicleNumber || '—'}</td>
                    <td className="mono">{ev.slotId || '—'}</td>
                    <td className="small truncate" style={{ maxWidth: 380 }}>
                      {ev.message}
                    </td>
                    <td className="nowrap tiny muted">{formatDateTime(ev.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No camera events yet" message="Trigger a simulated entry from the camera console." />
        )}
      </Card>
    </div>
  );
}
