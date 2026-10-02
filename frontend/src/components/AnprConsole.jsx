/**
 * SmartPark - ANPR pipeline console.
 * Renders the stage-by-stage log returned by the camera pipeline so the demo
 * shows *how* a plate was read, not just the result.
 */

import { IconCamera, IconRadar, IconClipboard, IconCheck, IconX, IconZap } from '../data/icons.jsx';

const STAGE_ICON = {
  camera: IconCamera,
  'vehicle-detection': IconRadar,
  'plate-localisation': IconClipboard,
  ocr: IconClipboard,
  'plate-validation': IconCheck,
  'duplicate-check': IconCheck,
  'slot-allocation': IconZap,
  'slot-release': IconZap,
  database: IconCheck,
};

export function PipelineStages({ stages, emptyLabel = 'No pipeline data yet.' }) {
  if (!stages || !stages.length) {
    return <p className="small muted">{emptyLabel}</p>;
  }
  return (
    <div className="anpr">
      {stages.map((stage, i) => {
        const Icon = STAGE_ICON[stage.stage] || IconClipboard;
        return (
          <div className="anpr-line" key={`${stage.stage}-${i}`}>
            <span className="anpr-ms">{stage.ms != null ? `${stage.ms}ms` : ''}</span>
            <span className={stage.ok ? 'anpr-ok' : 'anpr-fail'}>{stage.ok ? <IconCheck size={13} /> : <IconX size={13} />}</span>
            <div className="anpr-body">
              <span className="anpr-stage">{stage.label || stage.stage}</span>
              <div className="anpr-detail">{stage.detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AnprBanner({ tone, children }) {
  return (
    <div className={`anpr-banner ${tone}`}>
      {tone === 'ok' ? <IconCheck size={17} /> : <IconX size={17} />}
      <span>{children}</span>
    </div>
  );
}
