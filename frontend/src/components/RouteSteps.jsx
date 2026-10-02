/**
 * SmartPark - turn-by-turn route steps.
 * `activeIndex` drives the "start navigation" walk-through.
 */

import {
  IconTurnLeft,
  IconTurnRight,
  IconStraight,
  IconUTurn,
  IconDoor,
  IconFlag,
} from '../data/icons.jsx';

const ICONS = {
  left: IconTurnLeft,
  right: IconTurnRight,
  straight: IconStraight,
  uturn: IconUTurn,
  exit: IconDoor,
  arrive: IconFlag,
};

export default function RouteSteps({ steps, activeIndex = -1, onSelect }) {
  if (!steps?.length) {
    return <p className="small muted">No route steps available.</p>;
  }

  return (
    <div className="steps">
      {steps.map((step, index) => {
        const Icon = ICONS[step.kind] || IconStraight;
        const isDest = Boolean(step.isDestination);
        const isActive = index === activeIndex;
        const isDone = activeIndex > -1 && index < activeIndex;
        const cls = [
          'step',
          isDest ? 'dest' : '',
          isActive ? 'active' : '',
          isDone ? 'done' : '',
          activeIndex > -1 && !isActive && !isDone ? 'dim' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={step.order}
            className={cls}
            onClick={onSelect ? () => onSelect(index) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            <span className="step-ico">
              <Icon size={18} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="step-title">{step.instruction}</div>
              <div className="step-meta">
                {step.distanceM != null ? <span>{Math.round(step.distanceM)} m</span> : null}
                {step.durationSec != null ? <span>~{step.durationSec} s</span> : null}
                {step.road ? <span>{step.road}</span> : null}
                {step.compass ? <span>heading {step.compass}</span> : null}
              </div>
              {step.detail ? <div className="tiny muted mt-1">{step.detail}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
