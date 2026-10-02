/**
 * SmartPark - entrance ANPR camera console.
 *
 * This is the page used for the college demo:
 *   [SIMULATE VEHICLE ENTRY]  ->  live stage-by-stage pipeline  ->  slot allocated
 *   [SIMULATE VEHICLE EXIT]   ->  slot released
 * plus an optional webcam / image upload that runs the OCR endpoint.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../services/api.js';
import { useParking } from '../services/parking.jsx';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Card, EmptyState, KeyValue, MiniStat, Plate, Spinner } from '../components/ui.jsx';
import { PipelineStages, AnprBanner } from '../components/AnprConsole.jsx';
import { formatDateTime } from '../services/format.js';
import {
  IconCamera,
  IconCar,
  IconZap,
  IconRadar,
  IconUpload,
  IconRefresh,
  IconNavigation,
  IconMap,
  IconInfo,
} from '../data/icons.jsx';

const WAITING = [
  { stage: 'camera', label: 'Entrance camera', detail: 'Opening the entry lane stream…', ok: true, ms: 0 },
  { stage: 'vehicle-detection', label: 'Vehicle detection', detail: 'Scanning for a vehicle in the lane…', ok: true, ms: 0 },
];

export default function CameraPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useParking();

  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);

  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState([]);
  const [result, setResult] = useState(null);
  const [banner, setBanner] = useState(null);
  const [error, setError] = useState('');

  const [plateHint, setPlateHint] = useState('');
  const [vehicleType, setVehicleType] = useState('Car');

  // webcam / upload OCR
  const [image, setImage] = useState(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocr, setOcr] = useState(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);

  const timers = useRef([]);

  useEffect(() => {
    loadStatus();
    return () => stopCamera();
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function loadStatus() {
    try {
      const res = await api.cameraStatus();
      setStatus(res.camera);
      setEvents(res.recentEvents || []);
    } catch (err) {
      setError(err.message);
    }
  }

  function clearRun() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStages([]);
    setResult(null);
    setBanner(null);
  }

  /** Replays the real pipeline stages one at a time so the demo feels live. */
  function playStages(finalStages, done) {
    let delay = 0;
    finalStages.forEach((stage) => {
      delay += Math.min(420, 160 + (stage.ms || 0) * 2);
      timers.current.push(
        setTimeout(() => {
          setStages((prev) => [...prev, stage]);
        }, delay),
      );
    });
    timers.current.push(setTimeout(done, delay + 260));
  }

  async function simulateEntry() {
    clearRun();
    setRunning(true);
    setError('');
    setStages(WAITING);

    try {
      const payload = { vehicleType };
      if (plateHint.trim()) payload.plateHint = plateHint.trim().toUpperCase();
      const res = await api.simulateEntry(payload);
      const report = res.report;

      playStages(report.stages || [], async () => {
        setRunning(false);
        setResult(report);
        if (report.success) {
          setBanner({ tone: 'ok', text: `Vehicle parked successfully — ${report.block} / ${report.slot}` });
          toast.success('Vehicle parked ✓', `${report.vehicleNumber} assigned to ${report.block} / ${report.slot}`);
        } else {
          setBanner({ tone: 'fail', text: `Entry rejected — ${report.message || report.reason}` });
          toast.error('Entry rejected', report.message || String(report.reason));
        }
        await Promise.all([refresh(), loadStatus()]);
      });
    } catch (err) {
      setRunning(false);
      setStages([]);
      setError(err.message);
      toast.error('Camera error', err.message);
    }
  }

  async function simulateExit() {
    clearRun();
    setRunning(true);
    setError('');
    setStages([{ stage: 'camera', label: 'Entrance camera', detail: 'Reading the exit lane plate…', ok: true, ms: 0 }]);

    try {
      const payload = {};
      if (plateHint.trim()) payload.plateHint = plateHint.trim().toUpperCase();
      const res = await api.simulateExit(payload);
      const report = res.report;

      playStages(report.stages || [], async () => {
        setRunning(false);
        setResult(report);
        setBanner({ tone: 'ok', text: report.message });
        toast.success('Slot released ✓', report.message);
        await Promise.all([refresh(), loadStatus()]);
      });
    } catch (err) {
      setRunning(false);
      setStages([]);
      setError(err.message);
      toast.error('Exit failed', err.message);
    }
  }

  // ------------------------------------------------------------- webcam
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      toast.error('Camera unavailable', 'Grant camera permission or use “Upload image” instead.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setImage(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
  }

  function onFilePick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function runOcr() {
    if (!image) return;
    setOcrBusy(true);
    try {
      const res = await api.readPlate({ image, frameId: `UPLOAD-${Date.now()}` });
      setOcr(res);
      setPlateHint(res.ocr.repaired || res.ocr.text);
      toast.success('Plate read', `${res.ocr.repaired || res.ocr.text} (${res.ocr.confidence}% confidence)`);
    } catch (err) {
      toast.error('OCR failed', err.message);
    } finally {
      setOcrBusy(false);
    }
  }

  const busy = running || ocrBusy;

  return (
    <div className="stack">
      {/* ------------------------------------------------- demo controls */}
      <Card
        title="Demo controls"
        hint="Runs the real backend pipeline end to end"
        icon={<IconZap size={17} />}
      >
        <div className="row-wrap" style={{ gap: 12 }}>
          <button className="btn btn-primary btn-lg" onClick={simulateEntry} disabled={busy}>
            {running ? <Spinner /> : <IconCamera size={17} />}
            {running ? 'Processing…' : 'Simulate vehicle entry'}
          </button>
          <button className="btn btn-danger btn-lg" onClick={simulateExit} disabled={busy}>
            <IconCar size={17} /> Simulate vehicle exit
          </button>
          <div className="spacer" />

          <div className="field" style={{ minWidth: 190 }}>
            <label htmlFor="plateHint">Force plate (optional)</label>
            <input
              id="plateHint"
              className="input mono"
              placeholder="KA01AB1234"
              value={plateHint}
              onChange={(e) => setPlateHint(e.target.value)}
            />
          </div>
          <div className="field" style={{ minWidth: 140 }}>
            <label htmlFor="vtype">Vehicle type</label>
            <select id="vtype" className="select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option>Car</option>
              <option>EV</option>
              <option>Visitor</option>
            </select>
          </div>
        </div>
        <p className="tiny muted mt-2">
          Leave the plate empty and the simulator generates a random valid Indian number plate
          (e.g. <span className="mono">KA01AB1234</span>) for the demo.
        </p>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="split-nav">
        {/* -------------------------------------------- pipeline console */}
        <Card
          title="Pipeline console"
          hint="Camera → detection → plate ROI → OCR → validation → slot allocation → database"
          icon={<IconRadar size={17} />}
          actions={
            !running && stages.length ? (
              <button className="btn btn-sm" onClick={clearRun}>
                <IconRefresh size={14} /> Clear
              </button>
            ) : null
          }
        >
          {!stages.length && !result ? (
            <EmptyState
              icon={<IconCamera size={22} />}
              title="Camera idle"
              message="Press “Simulate vehicle entry” to run the full ANPR pipeline and watch each stage execute."
            />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {running ? (
                <div className="anpr-banner ok">
                  <Spinner />
                  <span>Camera detecting vehicle…</span>
                </div>
              ) : banner ? (
                <AnprBanner tone={banner.tone}>{banner.text}</AnprBanner>
              ) : null}

              <PipelineStages stages={stages} />

              {result?.success ? (
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div>
                    <div className="tiny muted">Number plate detected</div>
                    <div className="mt-1">{result.plateImage ? <Plate src={result.plateImage} /> : <Plate>{result.vehicleNumber}</Plate>}</div>
                  </div>
                  <div>
                    <div className="tiny muted">Parking assigned</div>
                    <div className="mt-1 row" style={{ gap: 8 }}>
                      <span className="badge badge-brand">{result.block}</span>
                      <span className="badge badge-cyan mono">{result.slot}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {result?.ocr ? (
                <MiniStat
                  items={[
                    { label: 'Raw OCR', value: result.ocr.text || '—' },
                    { label: 'Repaired', value: result.ocr.repaired || '—' },
                    { label: 'Confidence', value: `${result.ocr.confidence}%` },
                    { label: 'Engine', value: result.ocr.engine },
                  ]}
                />
              ) : null}

              {result?.success ? (
                <div className="row-wrap">
                  <button className="btn btn-cyan" onClick={() => navigate(`/navigate?slot=${result.slot}`)}>
                    <IconNavigation size={15} /> Navigate to {result.slot}
                  </button>
                  <button className="btn" onClick={() => navigate(`/map?slot=${result.slot}`)}>
                    <IconMap size={15} /> View on map
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setPlateHint(result.vehicleNumber);
                      toast.info('Plate loaded', 'Press “Simulate vehicle exit” to release this bay.');
                    }}
                  >
                    Load plate for exit test
                  </button>
                </div>
              ) : null}

              {result && !result.success ? (
                <KeyValue
                  items={[
                    { label: 'Reason', value: result.reason },
                    { label: 'Message', value: result.message || 'Entry was not allowed' },
                    { label: 'Plate read', value: result.vehicleNumber || result.rawText || 'unreadable' },
                  ]}
                />
              ) : null}
            </div>
          )}
        </Card>

        {/* --------------------------------------------- camera + OCR */}
        <div className="stack">
          <Card title="Camera & OCR engine" icon={<IconCamera size={17} />}>
            {status ? (
              <KeyValue
                items={[
                  { label: 'Camera ID', value: <span className="mono">{status.id}</span> },
                  { label: 'Location', value: status.location },
                  { label: 'Lane', value: status.lane },
                  { label: 'OCR engine', value: <Badge tone="cyan">{status.engine.active}</Badge> },
                  { label: 'Configured', value: status.engine.configured },
                  {
                    label: 'Tesseract.js',
                    value: status.engine.tesseractInstalled ? (
                      <Badge tone="ok">installed</Badge>
                    ) : (
                      <Badge tone="warn">not installed (simulator active)</Badge>
                    ),
                  },
                ]}
              />
            ) : (
              <p className="small muted">Loading camera status…</p>
            )}
            <p className="tiny muted mt-2">
              Install the optional real OCR engine with <span className="mono">cd ai/ocr &amp;&amp; npm install</span> — the
              facade falls back to the built-in simulator when it is absent.
            </p>
          </Card>

          <Card title="Upload a plate image" hint="Webcam snapshot or file upload" icon={<IconUpload size={17} />}>
            <div className="stack" style={{ gap: 12 }}>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#05080f', minHeight: 150 }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ width: '100%', display: cameraOn ? 'block' : 'none', borderRadius: 12 }}
                />
                {!cameraOn && !image ? (
                  <div className="center-screen" style={{ minHeight: 150 }}>
                    <div style={{ textAlign: 'center' }}>
                      <IconCamera size={26} style={{ color: 'var(--text-mute)' }} />
                      <div className="tiny muted mt-1">No frame loaded</div>
                    </div>
                  </div>
                ) : null}
                {image ? (
                  <img src={image} alt="captured frame" style={{ width: '100%', display: 'block' }} />
                ) : null}
              </div>

              <div className="row-wrap">
                {cameraOn ? (
                  <button className="btn btn-primary btn-sm" onClick={captureFrame}>
                    <IconCamera size={14} /> Capture frame
                  </button>
                ) : (
                  <button className="btn btn-sm" onClick={startCamera}>
                    <IconCamera size={14} /> Use webcam
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                  <IconUpload size={14} /> Upload image
                </button>
                {image ? (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setImage(null);
                      setOcr(null);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
                <div className="spacer" />
                <button className="btn btn-cyan btn-sm" onClick={runOcr} disabled={!image || ocrBusy}>
                  {ocrBusy ? <Spinner /> : <IconRadar size={14} />} Run OCR
                </button>
              </div>

              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFilePick} />

              {ocr ? (
                <div className="stack" style={{ gap: 10 }}>
                  {ocr.plateImage ? <Plate src={ocr.plateImage} /> : null}
                  <MiniStat
                    items={[
                      { label: 'Raw', value: ocr.ocr.text || '—' },
                      { label: 'Repaired', value: ocr.ocr.repaired || '—' },
                      { label: 'Confidence', value: `${ocr.ocr.confidence}%` },
                      { label: 'Valid plate', value: ocr.ocr.parsed?.valid ? 'Yes' : 'No' },
                    ]}
                  />
                  {!ocr.ocr.parsed?.valid && ocr.ocr.parsed?.issues?.length ? (
                    <Alert tone="warn">
                      {ocr.ocr.parsed.issues.join('; ')}. The plate was still normalised to{' '}
                      <span className="mono">{ocr.ocr.repaired}</span> for the demo.
                    </Alert>
                  ) : null}
                </div>
              ) : (
                <p className="tiny muted">
                  <IconInfo size={12} /> Without tesseract.js installed the simulator synthesises a plate so the
                  pipeline can still be demonstrated.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------ events */}
      <Card title="Camera event log" hint="Newest first" icon={<IconCamera size={17} />} bodyClass="flush">
        {events.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Vehicle</th>
                  <th>Block / Slot</th>
                  <th>Confidence</th>
                  <th>Message</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <Badge tone={ev.type === 'Entry' ? 'ok' : ev.type === 'Exit' ? 'brand' : 'danger'} dot>
                        {ev.type}
                      </Badge>
                    </td>
                    <td className="mono strong">{ev.vehicleNumber || '—'}</td>
                    <td className="nowrap">
                      {ev.blockName || '—'} {ev.slotId ? <span className="mono">{ev.slotId}</span> : null}
                    </td>
                    <td>{ev.confidence != null ? `${ev.confidence}%` : '—'}</td>
                    <td className="small truncate" style={{ maxWidth: 340 }}>
                      {ev.message}
                    </td>
                    <td className="nowrap tiny muted">{formatDateTime(ev.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No events yet" message="Run a simulated entry to populate the camera log." />
        )}
      </Card>
    </div>
  );
}
