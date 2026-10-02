/**
 * SmartPark - vehicle history with time-range filters.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../services/api.js';
import { useToast } from '../components/Toast.jsx';
import { Alert, Card, EmptyState, Skeleton, Spinner, StatCard } from '../components/ui.jsx';
import { VehicleRow } from '../components/VehicleCard.jsx';
import { formatDuration } from '../services/format.js';
import { IconHistory, IconSearch, IconFilter, IconRefresh, IconCar, IconClock } from '../data/icons.jsx';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

const STATUSES = [
  { key: 'ALL', label: 'All statuses' },
  { key: 'Parked', label: 'Parked' },
  { key: 'Exited', label: 'Exited' },
];

export default function HistoryPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [range, setRange] = useState(params.get('range') || 'today');
  const [status, setStatus] = useState(params.get('status') || 'ALL');
  const [block, setBlock] = useState(params.get('block') || 'ALL');
  const [text, setText] = useState(params.get('q') || '');
  const [applied, setApplied] = useState(params.get('q') || '');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exiting, setExiting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.history({ range, status: status === 'ALL' ? '' : status, block: block === 'ALL' ? '' : block, q: applied });
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range, status, block, applied]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the URL in sync so a filtered view can be shared / bookmarked.
  useEffect(() => {
    const next = {};
    if (range !== 'today') next.range = range;
    if (status !== 'ALL') next.status = status;
    if (block !== 'ALL') next.block = block;
    if (applied) next.q = applied;
    setParams(next, { replace: true });
  }, [range, status, block, applied, setParams]);

  async function recordExit(vehicle) {
    setExiting(vehicle.vehicleNumber);
    try {
      const res = await api.recordExit({ vehicleNumber: vehicle.vehicleNumber });
      toast.success('Slot released ✓', res.message);
      await load();
    } catch (err) {
      toast.error('Exit failed', err.message);
    } finally {
      setExiting('');
    }
  }

  const rows = data?.vehicles || [];
  const summary = useMemo(() => {
    const parked = rows.filter((r) => r.status === 'Parked').length;
    const exited = rows.length - parked;
    const totalStay = rows.reduce((sum, r) => sum + (r.stayedMinutes || 0), 0);
    return { parked, exited, totalStay, avg: rows.length ? Math.round(totalStay / rows.length) : 0 };
  }, [rows]);

  return (
    <div className="stack">
      {/* ------------------------------------------------------ KPIs */}
      <div className="grid grid-4">
        <StatCard icon={<IconHistory size={17} />} label="Records" value={data?.total ?? 0} tone="brand" foot={`Range: ${range}`} />
        <StatCard icon={<IconCar size={17} />} label="Currently parked" value={summary.parked} tone="danger" foot="Active sessions" />
        <StatCard icon={<IconClock size={17} />} label="Completed visits" value={summary.exited} tone="ok" foot="Entered and left" />
        <StatCard
          icon={<IconClock size={17} />}
          label="Average stay"
          value={formatDuration(summary.avg)}
          tone="violet"
          foot={`${summary.totalStay} min total`}
        />
      </div>

      {/* ---------------------------------------------------- filters */}
      <Card title="Filters" icon={<IconFilter size={17} />} bodyClass="tight">
        <div className="row-wrap" style={{ gap: 10 }}>
          <div className="segmented">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={range === r.key ? 'active' : ''}
                onClick={() => setRange(r.key)}
                type="button"
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="segmented">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                className={status === s.key ? 'active' : ''}
                onClick={() => setStatus(s.key)}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="field" style={{ minWidth: 150 }}>
            <label htmlFor="blockFilter">Block</label>
            <select id="blockFilter" className="select" value={block} onChange={(e) => setBlock(e.target.value)}>
              <option value="ALL">All blocks</option>
              <option value="A">Block A</option>
              <option value="B">Block B</option>
              <option value="C">Block C</option>
              <option value="D">Block D</option>
            </select>
          </div>

          <form
            className="row"
            style={{ gap: 8, flex: 1, minWidth: 220 }}
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(text.trim());
            }}
          >
            <div className="searchbar">
              <span className="search-ico">
                <IconSearch size={15} />
              </span>
              <input
                className="input mono"
                style={{ paddingLeft: 36 }}
                placeholder="Vehicle, owner or slot"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <button className="btn" type="submit">
              Apply
            </button>
          </form>

          <button className="btn btn-sm" onClick={load} disabled={loading}>
            {loading ? <Spinner /> : <IconRefresh size={14} />} Refresh
          </button>
        </div>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ------------------------------------------------------ table */}
      <Card
        title="Vehicle records"
        hint="Entry time · exit time · block · parking slot · status"
        icon={<IconHistory size={17} />}
        bodyClass="flush"
      >
        {loading && !data ? (
          <div style={{ padding: 18 }}>
            <Skeleton height={220} />
          </div>
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Owner</th>
                  <th>Block</th>
                  <th>Slot</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <VehicleRow
                    key={`${v.vehicleNumber}-${v.entryTime}`}
                    vehicle={v}
                    onExit={recordExit}
                    exiting={exiting === v.vehicleNumber}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<IconHistory size={22} />}
            title="No records for these filters"
            message="Widen the time range or clear the search text to see more vehicle sessions."
            action={
              <button
                className="btn btn-sm mt-1"
                onClick={() => {
                  setRange('month');
                  setStatus('ALL');
                  setBlock('ALL');
                  setText('');
                  setApplied('');
                }}
              >
                Reset filters
              </button>
            }
          />
        )}
      </Card>
    </div>
  );
}
