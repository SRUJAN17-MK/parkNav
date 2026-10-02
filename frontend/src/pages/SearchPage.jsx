/**
 * SmartPark - watchman search.
 * One box searches vehicle numbers, parking slots, blocks and owner names.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api } from '../services/api.js';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Card, EmptyState, Meter, Skeleton, Spinner } from '../components/ui.jsx';
import VehicleCard from '../components/VehicleCard.jsx';
import { formatDateTime, formatDuration, occupancyTone } from '../services/format.js';
import { IconSearch, IconCheckCircle, IconCar, IconGrid, IconX, IconClipboard } from '../data/icons.jsx';

const EXAMPLES = ['KA01AB1234', 'A-12', 'B-07', 'Block C', 'Rahul'];

export default function SearchPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const initial = params.get('q') || '';
  const [query, setQuery] = useState(initial);
  const [result, setResult] = useState(null);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  const runSearch = useCallback(
    async (term) => {
      const q = String(term || '').trim();
      if (!q) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.searchVehicles({ q });
        setResult(res);
        setSearched(true);

        // Enrich each parked hit with the full record (owner, model, OCR, slot).
        const parked = (res.parked || []).slice(0, 6);
        const entries = await Promise.all(
          parked.map(async (v) => {
            try {
              const detail = await api.vehicle(v.vehicleNumber);
              return [v.vehicleNumber, detail.vehicle];
            } catch {
              return [v.vehicleNumber, null];
            }
          }),
        );
        setDetails(Object.fromEntries(entries.filter(([, v]) => v)));
      } catch (err) {
        setError(err.message);
        setResult(null);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Deep link: /search?q=KA01AB1234
  useEffect(() => {
    const q = params.get('q');
    if (q) {
      setQuery(q);
      runSearch(q);
    }
  }, [params, runSearch]);

  function onSubmit(event) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setParams({ q });
  }

  function reset() {
    setQuery('');
    setResult(null);
    setDetails({});
    setSearched(false);
    setError('');
    setParams({});
    inputRef.current?.focus();
  }

  async function recordExit(vehicle) {
    try {
      const res = await api.recordExit({ vehicleNumber: vehicle.vehicleNumber });
      toast.success('Slot released ✓', res.message);
      await runSearch(query);
    } catch (err) {
      toast.error('Exit failed', err.message);
    }
  }

  const parked = result?.parked || [];
  const slotHits = result?.slots || [];
  const blockHits = result?.blocks || [];
  const historyHits = result?.history || [];
  const hasHits = parked.length + slotHits.length + blockHits.length > 0;
  const found = parked.length > 0;

  return (
    <div className="stack">
      {/* -------------------------------------------------- search box */}
      <Card
        title="Search a parked vehicle"
        hint="Vehicle number · parking slot · block · owner name"
        icon={<IconSearch size={17} />}
      >
        <form onSubmit={onSubmit} className="row-wrap" style={{ gap: 10 }}>
          <div className="searchbar" style={{ minWidth: 240 }}>
            <span className="search-ico">
              <IconSearch size={18} />
            </span>
            <input
              ref={inputRef}
              className="input mono"
              style={{ padding: '13px 13px 13px 42px', fontSize: 15 }}
              placeholder="Search Vehicle Number  —  e.g. KA01AB1234"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading || !query.trim()}>
            {loading ? <Spinner /> : <IconSearch size={17} />} Search
          </button>
          {searched ? (
            <button className="btn btn-lg" type="button" onClick={reset}>
              <IconX size={16} /> Clear
            </button>
          ) : null}
        </form>

        <div className="row-wrap mt-2 tiny muted">
          <span>Quick:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="badge badge-mute copiable"
              onClick={() => {
                setQuery(ex);
                setParams({ q: ex });
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {loading && !result ? <Skeleton height={220} /> : null}

      {/* ------------------------------------------------- empty state */}
      {searched && !loading && !hasHits ? (
        <Card>
          <EmptyState
            icon={<IconSearch size={22} />}
            title={`No match for “${result?.query || query}”`}
            message="Try a full number plate (KA01AB1234), a slot id (A-12), a block name (Block B) or part of an owner name."
            action={
              <button className="btn btn-sm mt-1" onClick={reset}>
                Search again
              </button>
            }
          />
        </Card>
      ) : null}

      {/* ------------------------------------------------ found banner */}
      {searched && hasHits ? (
        <div className={`anpr-banner ${found ? 'ok' : 'fail'}`}>
          {found ? <IconCheckCircle size={17} /> : <IconClipboard size={17} />}
          <span>
            {found
              ? `Vehicle Found ✓ — ${parked.length} vehicle${parked.length > 1 ? 's' : ''} currently parked`
              : 'No vehicle currently parked matches — showing slot and block matches below'}
          </span>
        </div>
      ) : null}

      {/* ------------------------------------------- parked vehicles */}
      {parked.length ? (
        <div className="grid grid-2">
          {parked.map((hit) => {
            const full = details[hit.vehicleNumber] || hit;
            return (
              <VehicleCard
                key={hit.vehicleNumber}
                vehicle={full}
                distanceM={result.distances?.[hit.slotId]}
                onExit={recordExit}
              />
            );
          })}
        </div>
      ) : null}

      {/* ------------------------------------------------- slot hits */}
      {slotHits.length ? (
        <Card title="Matching parking slots" icon={<IconGrid size={17} />} bodyClass="flush">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Block</th>
                  <th>Status</th>
                  <th>Vehicle</th>
                  <th>From watchman room</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {slotHits.map((slot) => (
                  <tr key={slot.slotId}>
                    <td className="mono strong">{slot.slotId}</td>
                    <td>{slot.blockName}</td>
                    <td>
                      <Badge tone={slot.status === 'Occupied' ? 'danger' : 'ok'} dot>
                        {slot.status}
                      </Badge>
                    </td>
                    <td className="mono">{slot.vehicleNumber || '—'}</td>
                    <td>{result.distances?.[slot.slotId] != null ? `${Math.round(result.distances[slot.slotId])} m` : '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => navigate(`/map?slot=${slot.slotId}`)}>
                          Map
                        </button>
                        <button className="btn btn-sm btn-cyan" onClick={() => navigate(`/navigate?slot=${slot.slotId}`)}>
                          Nav
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* ------------------------------------------------ block hits */}
      {blockHits.length ? (
        <Card title="Matching blocks" icon={<IconGrid size={17} />}>
          <div className="grid grid-2">
            {blockHits.map((block) => (
              <div className="card" key={block.blockId} style={{ background: 'var(--bg-soft)' }}>
                <div className="card-body">
                  <div className="row">
                    <div>
                      <div className="strong">{block.blockName}</div>
                      <div className="tiny muted">{block.zone}</div>
                    </div>
                    <div className="spacer" />
                    <Badge tone={block.occupied === block.total ? 'danger' : 'ok'}>
                      {block.occupied}/{block.total} occupied
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <Meter value={block.occupancy ?? 0} tone={occupancyTone(block.occupancy ?? 0)} />
                  </div>
                  <div className="row-wrap mt-2">
                    <button className="btn btn-sm" onClick={() => navigate(`/map?block=${block.blockId}`)}>
                      Open block on map
                    </button>
                    <button className="btn btn-sm" onClick={() => navigate(`/history?range=week&block=${block.blockId}`)}>
                      Block history
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* --------------------------------------------- exited history */}
      {historyHits.length ? (
        <Card title="Past visits by this search" hint="Vehicles that already left the campus" icon={<IconCar size={17} />} bodyClass="flush">
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
                  <th>Stay</th>
                </tr>
              </thead>
              <tbody>
                {historyHits.map((v) => (
                  <tr key={`${v.vehicleNumber}-${v.entryTime}`}>
                    <td className="mono strong nowrap">{v.vehicleNumber}</td>
                    <td className="truncate">{v.ownerName}</td>
                    <td>{v.blockName}</td>
                    <td className="mono">{v.slotId}</td>
                    <td className="nowrap">{formatDateTime(v.entryTime)}</td>
                    <td className="nowrap">{formatDateTime(v.exitTime)}</td>
                    <td>{formatDuration(v.stayedMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
