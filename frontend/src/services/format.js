/**
 * SmartPark - formatting helpers shared across the UI.
 */

export function formatTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${formatTime(d)}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function relativeTime(value) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return diff >= 0 ? `${min} min ago` : `in ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return diff >= 0 ? `${hrs} h ago` : `in ${hrs} h`;
  const days = Math.round(hrs / 24);
  return diff >= 0 ? `${days} d ago` : `in ${days} d`;
}

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h} h ${rest} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

export function formatMetres(value) {
  if (value === null || value === undefined) return '—';
  const m = Math.round(value);
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export function plateStatus(status) {
  if (status === 'Parked') return { tone: 'ok', label: 'Parked' };
  if (status === 'Exited') return { tone: 'mute', label: 'Exited' };
  return { tone: 'mute', label: status || 'Unknown' };
}

export function eventTone(type) {
  switch (type) {
    case 'Entry':
      return 'ok';
    case 'Exit':
      return 'brand';
    case 'Rejected':
      return 'danger';
    default:
      return 'mute';
  }
}

export function occupancyTone(rate) {
  if (rate >= 90) return 'danger';
  if (rate >= 70) return 'warn';
  return 'ok';
}
