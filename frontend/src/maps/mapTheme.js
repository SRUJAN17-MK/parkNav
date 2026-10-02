/**
 * SmartPark - map visual theme.
 * Kept in one place so the dashboard, map page and navigation screen agree.
 */

export const SLOT_STYLE = {
  empty: { fill: '#16213a', stroke: '#2c3f63', text: '#8fa5c8', label: '#c8d6ee' },
  occupied: { fill: 'rgba(239,68,68,0.24)', stroke: '#ef4444', text: '#fca5a5', label: '#fecaca' },
  ev: { fill: 'rgba(34,211,238,0.2)', stroke: '#22d3ee', text: '#67e8f9', label: '#a5f3fc' },
  visitor: { fill: 'rgba(167,139,250,0.2)', stroke: '#a78bfa', text: '#c4b5fd', label: '#ddd6fe' },
};

export const BLOCK_FILL = 'rgba(17,26,46,0.72)';
export const BLOCK_STROKE = '#24344f';
export const ROAD_FILL = '#141f36';
export const ROAD_STROKE = '#243352';
export const ROUTE_COLOR = '#22d3ee';
export const ROUTE_CASING = '#062a35';

export const MAP_TEXT = {
  blockTitle: '#e8eefc',
  blockSub: '#6b7fa2',
  road: '#7f92b3',
  landmark: '#c8d6ee',
};

export function slotTone(slot) {
  if (slot.type === 'ev') return SLOT_STYLE.ev;
  if (slot.type === 'visitor') return SLOT_STYLE.visitor;
  if (slot.status === 'Occupied') return SLOT_STYLE.occupied;
  return SLOT_STYLE.empty;
}
