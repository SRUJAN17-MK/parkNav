/**
 * SmartPark - navigation.
 *
 * Shows the *complete* parking map and highlights only the route from the
 * watchman room to the selected bay, with distance, walking time and
 * turn-by-turn instructions.
 *
 * The route itself is computed on the server with A* over the road graph
 * (backend/services/pathfinding.js); this page renders the returned polyline.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import ParkingMap from '../maps/ParkingMap.jsx';
import RouteSteps from '../components/RouteSteps.jsx';
import PrintableParkingTicket from '../components/PrintableParkingTicket.jsx';
import { api } from '../services/api.js';
import { useParking } from '../services/parking.jsx';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Card, EmptyState, MiniStat, Skeleton, Spinner } from '../components/ui.jsx';
import {
  IconArrowLeft,
  IconNavigation,
  IconPlay,
  IconSearch,
  IconPin,
  IconClock,
  IconZap,
  IconRefresh,
  IconPrint,
} from '../data/icons.jsx';

const STEP_MS = 2600;
const SLOT_EMPTY = '#16213a';

/** Truncates a polyline at a given walking distance (for the step-through). */
function partialPolyline(points, metersPerUnit, targetMeters) {
  if (!points?.length) return '';
  if (targetMeters <= 0) return `M ${points[0].x} ${points[0].y}`;
  let acc = 0;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const leg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) * metersPerUnit;
    if (acc + leg >= targetMeters) {
      const need = targetMeters - acc;
      const k = leg > 0 ? need / leg : 0;
      const x = points[i - 1].x + (points[i].x - points[i - 1].x) * k;
      const y = points[i - 1].y + (points[i].y - points[i - 1].y) * k;
      return `${d} L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    acc += leg;
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export default function NavigationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { mapData, slots, totals } = useParking();
  const [params, setParams] = useSearchParams();

  const [slotId, setSlotId] = useState(params.get('slot') || '');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [algorithm, setAlgorithm] = useState('astar');

  const [navigating, setNavigating] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const timer = useRef(null);

  const slot = useMemo(() => slots.find((s) => s.slotId === slotId) || null, [slots, slotId]);

  const loadRoute = useCallback(
    async (target, algo = algorithm) => {
      if (!target) {
        setRoute(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await api.route({ slot: target, algorithm: algo });
        setRoute(res.route);
      } catch (err) {
        setError(err.message);
        setRoute(null);
      } finally {
        setLoading(false);
      }
    },
    [algorithm],
  );

  useEffect(() => {
    if (slotId) loadRoute(slotId);
    else setRoute(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId]);

  useEffect(() => () => clearInterval(timer.current), []);

  // Deep link: /navigate?slot=A-12
  useEffect(() => {
    const q = params.get('slot');
    if (q) setSlotId(q.toUpperCase());
  }, [params]);

  function stopNavigation() {
    clearInterval(timer.current);
    timer.current = null;
    setNavigating(false);
    setActiveStep(-1);
  }

  function startNavigation() {
    if (!route) return;
    stopNavigation();
    setNavigating(true);
    setActiveStep(0);
    const total = route.steps.steps.length;
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      if (i >= total) {
        clearInterval(timer.current);
        timer.current = null;
        setActiveStep(total - 1);
        setNavigating(false);
        toast.success('You have arrived', `${route.blockName} · Parking ${route.slotId}`);
        return;
      }
      setActiveStep(i);
    }, STEP_MS);
  }

  async function onVehicleLookup(event) {
    event.preventDefault();
    const q = vehicleQuery.trim();
    if (!q) return;
    try {
      const res = await api.vehicle(q.toUpperCase());
      if (res.vehicle.status === 'Parked' && res.vehicle.slotId) {
        setSlotId(res.vehicle.slotId);
        setParams({ slot: res.vehicle.slotId });
        toast.success('Destination set', `${res.vehicle.vehicleNumber} → ${res.vehicle.blockName} / ${res.vehicle.slotId}`);
      } else {
        toast.error('Not parked', `${q.toUpperCase()} has no active parking session.`);
      }
    } catch {
      // Fall back to a slot lookup: the user may have typed a slot id.
      const candidate = slots.find((s) => s.slotId === q.toUpperCase());
      if (candidate) {
        setSlotId(candidate.slotId);
        setParams({ slot: candidate.slotId });
      } else {
        toast.error('Not found', `No parked vehicle or slot matched “${q}”.`);
      }
    }
  }

  function changeAlgorithm(algo) {
    setAlgorithm(algo);
    if (slotId) loadRoute(slotId, algo);
  }

  const grouped = useMemo(() => {
    const groups = {};
    slots.forEach((s) => {
      (groups[s.blockId] = groups[s.blockId] || []).push(s);
    });
    return groups;
  }, [slots]);

  // Route rendered up to the active step while walking through directions.
  const walkedDistance = useMemo(() => {
    if (!route || activeStep < 0) return null;
    const steps = route.steps.steps;
    let acc = 0;
    for (let i = 0; i <= activeStep && i < steps.length; i += 1) acc += steps[i].distanceM || 0;
    return Math.min(acc, route.distanceM);
  }, [route, activeStep]);

  const displayRoute = useMemo(() => {
    if (!route) return null;
    if (walkedDistance == null) return route;
    return {
      ...route,
      polyline: partialPolyline(route.points, mapData?.metersPerUnit || 0.08, walkedDistance),
    };
  }, [route, walkedDistance, mapData]);

  const routeSlotIds = route ? [route.slotId] : [];

  return (
    <div className="stack">
      {/* ------------------------------------------------ destination bar */}
      <Card bodyClass="tight">
        <div className="row-wrap" style={{ gap: 10 }}>
          <button className="btn btn-sm" onClick={() => navigate(-1)}>
            <IconArrowLeft size={15} /> Back
          </button>

          <div className="field" style={{ minWidth: 230 }}>
            <label htmlFor="slotSelect">Destination bay</label>
            <select
              id="slotSelect"
              className="select"
              value={slotId}
              onChange={(e) => {
                stopNavigation();
                setSlotId(e.target.value);
                if (e.target.value) setParams({ slot: e.target.value });
              }}
            >
              <option value="">— choose a parking slot —</option>
              {Object.entries(grouped).map(([blockId, list]) => (
                <optgroup key={blockId} label={`Block ${blockId} (${list.filter((s) => s.status === 'Empty').length} free)`}>
                  {list.map((s) => (
                    <option key={s.slotId} value={s.slotId}>
                      {s.slotId} — {s.status === 'Occupied' ? s.vehicleNumber : 'Empty'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <form onSubmit={onVehicleLookup} className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="navVehicle">Or find by vehicle number</label>
              <div className="searchbar">
                <span className="search-ico">
                  <IconSearch size={15} />
                </span>
                <input
                  id="navVehicle"
                  className="input mono"
                  style={{ paddingLeft: 36 }}
                  placeholder="KA01AB1234"
                  value={vehicleQuery}
                  onChange={(e) => setVehicleQuery(e.target.value)}
                />
              </div>
            </div>
            <button className="btn" type="submit">
              Find
            </button>
          </form>

          <div className="spacer" />

          <div className="field" style={{ minWidth: 150 }}>
            <label htmlFor="algo">Path algorithm</label>
            <select id="algo" className="select" value={algorithm} onChange={(e) => changeAlgorithm(e.target.value)}>
              <option value="astar">A* (A-star)</option>
              <option value="dijkstra">Dijkstra</option>
            </select>
          </div>
        </div>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ------------------------------------------------- empty state */}
      {!slotId ? (
        <Card>
          <EmptyState
            icon={<IconNavigation size={22} />}
            title="Choose a destination"
            message="Pick a parking bay above, or type a vehicle number and SmartPark will route you from the watchman room to that exact bay."
          />
        </Card>
      ) : null}

      {slotId && loading && !route ? <Skeleton height={420} /> : null}

      {route ? (
        <>
          {/* ------------------------------------------------- header */}
          <div className="card nav-head">
            <span className="nav-arrow">
              <IconNavigation size={22} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="tiny muted">Navigating from the Watchman Room to</div>
              <div className="dest">
                {route.slotId} · {route.blockName}
              </div>
              <div className="dest-sub">
                {route.distanceLabel} · ~{route.durationLabel} walk · {route.steps.steps.length} steps
              </div>
            </div>
            <div className="spacer" />
            <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
              {slot ? (
                <Badge tone={slot.status === 'Occupied' ? 'danger' : 'ok'} dot>
                  {slot.status}
                  {slot.vehicleNumber ? ` · ${slot.vehicleNumber}` : ''}
                </Badge>
              ) : null}
              <Badge tone="brand">{route.algorithm}</Badge>
            </div>
          </div>

          <div className="split-nav">
            {/* --------------------------------------------- the map */}
            <Card
              title="Parking map"
              hint="Full layout with the highlighted route"
              icon={<IconPin size={17} />}
              bodyClass="flush"
              actions={
                <button className="btn btn-sm" onClick={() => loadRoute(slotId)}>
                  <IconRefresh size={14} /> Recalculate
                </button>
              }
            >
              <ParkingMap
                map={mapData}
                route={displayRoute}
                selectedSlot={route.slotId}
                routeSlotIds={routeSlotIds}
                showRoute
                onSelectSlot={(s) => {
                  stopNavigation();
                  setSlotId(s.slotId);
                  setParams({ slot: s.slotId });
                }}
                hint="Route: Watchman Room → destination bay"
              />
              <div className="map-legend">
                <span className="legend-item">
                  <i className="legend-swatch" style={{ background: '#22d3ee', borderColor: '#22d3ee' }} />
                  Your route
                </span>
                <span className="legend-item">
                  <i className="legend-swatch" style={{ background: 'rgba(167,139,250,0.35)', borderColor: '#a78bfa' }} />
                  Start · Watchman Room
                </span>
                <span className="legend-item">
                  <i className="legend-swatch" style={{ background: 'rgba(239,68,68,0.25)', borderColor: '#ef4444' }} />
                  Occupied bay
                </span>
                <span className="legend-item">
                  <i className="legend-swatch" style={{ background: SLOT_EMPTY, borderColor: '#2c3f63' }} />
                  Empty bay
                </span>
              </div>
            </Card>

            {/* ------------------------------------------ instructions */}
            <div className="stack">
              <Card
                title="Destination"
                icon={<IconPin size={17} />}
                actions={
                  navigating ? (
                    <button className="btn btn-sm btn-danger" onClick={stopNavigation}>
                      Stop
                    </button>
                  ) : null
                }
              >
                <div className="stack" style={{ gap: 12 }}>
                  <div className="row">
                    <div>
                      <div className="tiny muted">Destination</div>
                      <div className="strong" style={{ fontSize: 16 }}>
                        {route.blockName} • Parking {route.slotId}
                      </div>
                    </div>
                  </div>

                  <MiniStat
                    items={[
                      { label: 'Distance', value: `${Math.round(route.distanceM)} m` },
                      { label: 'Walking time', value: route.durationLabel },
                      { label: 'Row / bay', value: `${route.slotPosition.row} / ${route.slotPosition.column}` },
                      { label: 'Zone', value: route.zone || '—' },
                    ]}
                  />

                  <div className="stack" style={{ gap: 9 }}>
                    <button className="btn btn-primary btn-lg btn-block" onClick={startNavigation} disabled={navigating}>
                      {navigating ? <Spinner /> : <IconPlay size={17} />}
                      {navigating ? `Step ${activeStep + 1} of ${route.steps.steps.length}` : 'Start navigation'}
                    </button>

                    <button
                      className="btn btn-cyan btn-lg btn-block"
                      onClick={() => setShowTicketModal(true)}
                      title="Print physical bus-ticket style parking pass"
                    >
                      <IconPrint size={17} /> Print Parking Ticket
                    </button>
                  </div>

                  {navigating || activeStep > -1 ? (
                    <div className="alert alert-info">
                      <IconNavigation size={16} style={{ flex: 'none', marginTop: 1 }} />
                      <div>
                        Follow the highlighted route from the Watchman Room. Distance covered:{' '}
                        <strong>{Math.round(walkedDistance || 0)} m</strong> of {Math.round(route.distanceM)} m.
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card title="Directions" hint={`${route.steps.steps.length} steps · ${route.algorithm}`} icon={<IconZap size={17} />}>
                <RouteSteps steps={route.steps.steps} activeIndex={activeStep} onSelect={setActiveStep} />
              </Card>

              <Card title="Route details" icon={<IconClock size={17} />}>
                <MiniStat
                  items={[
                    { label: 'Nodes expanded', value: route.expandedNodes },
                    { label: 'Graph nodes used', value: route.path.length },
                    { label: 'Legs', value: route.steps.legs },
                    { label: 'Walking speed', value: `${route.walkingSpeedMps} m/s` },
                  ]}
                />
                <p className="tiny muted mt-2">
                  Shortest path computed with {route.algorithm} on the parking road graph (main road, cross
                  roads, block entries, drive lanes and bays).
                </p>
              </Card>
            </div>
          </div>

          {/* Printable Ticket & Modal */}
          <PrintableParkingTicket
            route={route}
            mapData={mapData}
            slot={slot}
            isOpen={showTicketModal}
            onClose={() => setShowTicketModal(false)}
          />
        </>
      ) : null}
    </div>
  );
}
