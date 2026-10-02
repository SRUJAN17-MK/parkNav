'use strict';

/**
 * SmartPark - Parking layout definition.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the apartment parking map.
 * Everything else (slot database, navigation graph, frontend rendering) is
 * derived from the numbers declared here, so the map, the OCR pipeline and
 * the A* pathfinder can never drift apart.
 *
 * Coordinate system
 * -----------------
 * A virtual canvas measured in "layout units".
 *   1 layout unit = METERS_PER_UNIT metres on the ground.
 * The canvas is 1200 x 940 units -> 96 m x 75.2 m of real ground area.
 *
 *        y=0    +--------------------------------------------------+
 *               |                MAIN GATE (ANPR camera)          |
 *   Block A  y=110 +-----------------+  +-----------------+ Block B |
 *               |  4 columns x 3 rows, drive aisles both sides    |
 *   x-road y=422 +-----------------+  +-----------------+         |
 *   Block C  y=470 +-----------------+  +-----------------+ Block D |
 *   x-road y=782 +-------------------------------------------------+
 *               |                 WATCHMAN ROOM                    |
 *         y=940  +--------------------------------------------------+
 */

const METERS_PER_UNIT = 0.08;

const CANVAS = { width: 1200, height: 940 };

const GEOMETRY = {
  blockWidth: 500,
  blockHeight: 270,
  titleHeight: 35,
  slotRows: 3,
  slotCols: 4,
  slotWidth: 94,
  slotHeight: 56,
  colGap: 12,
  rowGap: 8,
  aisleWidth: 48,
  firstColOffset: 26,
  firstRowOffset: 45,
  corridorOffset: 245,
  entryGap: 10,
  laneInset: 10,
};

const BLOCK_DEFS = [
  { id: 'A', name: 'Block A', zone: 'North-West Wing', x: 50, y: 110 },
  { id: 'B', name: 'Block B', zone: 'North-East Wing', x: 650, y: 110 },
  { id: 'C', name: 'Block C', zone: 'South-West Wing', x: 50, y: 470 },
  { id: 'D', name: 'Block D', zone: 'South-East Wing', x: 650, y: 470 },
];

/** Reserved (non bookable) slots per block - kept for EV / visitor use. */
const SPECIAL_SLOTS = {
  A: { 'A-11': 'ev' },
  C: { 'C-01': 'visitor' },
};

const ROAD_DEFS = {
  gate: { id: 'GATE', label: 'MAIN GATE', sublabel: 'ANPR Camera', x: 570, y: 30, width: 60, height: 60, type: 'gate' },
  spine: { id: 'MAIN_ROAD', label: 'MAIN PARKING ROAD', x: 570, y: 90, width: 60, height: 730, type: 'road' },
  crossNorth: { id: 'NORTH_CROSS', label: 'NORTH CROSS ROAD', x: 30, y: 400, width: 1140, height: 45, type: 'road' },
  crossSouth: { id: 'SOUTH_CROSS', label: 'SOUTH CROSS ROAD', x: 30, y: 760, width: 1140, height: 45, type: 'road' },
  watchman: { id: 'WATCHMAN_ROOM', label: 'WATCHMAN ROOM', sublabel: 'Security Control', x: 470, y: 820, width: 260, height: 80, type: 'room' },
};

/** Key navigation node ids (exported so controllers / tests can reference them). */
const NODES = {
  watchman: 'WATCHMAN_ROOM',
  gate: 'GATE',
  spineTop: 'SPINE_TOP',
  spineNorth: 'SPINE_NORTH',
  spineMid: 'SPINE_MID',
  spineSouth: 'SPINE_SOUTH',
  spineEnd: 'SPINE_END',
};

const SPINE_X = ROAD_DEFS.spine.x + ROAD_DEFS.spine.width / 2;
const CROSS_NORTH_Y = ROAD_DEFS.crossNorth.y + ROAD_DEFS.crossNorth.height / 2;
const CROSS_SOUTH_Y = ROAD_DEFS.crossSouth.y + ROAD_DEFS.crossSouth.height / 2;
const CROSS_EDGE_X = ROAD_DEFS.crossNorth.x + 10;
const CROSS_FAR_X = ROAD_DEFS.crossNorth.x + ROAD_DEFS.crossNorth.width - 10;

const round = (value) => Math.round(value * 100) / 100;

function columnOffsets() {
  const { slotWidth, colGap, slotCols, firstColOffset, aisleWidth } = GEOMETRY;
  const offsets = [];
  let x = firstColOffset;
  for (let c = 0; c < slotCols; c += 1) {
    if (c > 0) {
      // A drive aisle (aisleWidth) sits between column 2 and column 3.
      x += c === 2 ? aisleWidth : colGap;
    }
    offsets.push(x);
    x += slotWidth;
  }
  return offsets;
}

function aisleCenterOffset() {
  return round(columnOffsets()[2] - GEOMETRY.aisleWidth / 2);
}

function rowCenterY(block, rowIndex) {
  return round(
    block.y +
      GEOMETRY.firstRowOffset +
      rowIndex * (GEOMETRY.slotHeight + GEOMETRY.rowGap) +
      GEOMETRY.slotHeight / 2,
  );
}

function laneNodeFor(blockId, col, row) {
  if (col === 0) return `${blockId}_LANE_L_${row}`;
  if (col === GEOMETRY.slotCols - 1) return `${blockId}_LANE_R_${row}`;
  return `${blockId}_AISLE_${row}`;
}

function buildBlock(def) {
  const { blockWidth, blockHeight, slotWidth, slotHeight, rowGap, firstRowOffset, corridorOffset, laneInset, entryGap } = GEOMETRY;
  const colOffsets = columnOffsets();
  const crossRoadY = def.y + blockHeight <= ROAD_DEFS.crossNorth.y ? CROSS_NORTH_Y : CROSS_SOUTH_Y;
  const corridorY = round(def.y + corridorOffset);
  const slots = [];

  for (let r = 0; r < GEOMETRY.slotRows; r += 1) {
    const y = def.y + firstRowOffset + r * (slotHeight + rowGap);
    for (let c = 0; c < GEOMETRY.slotCols; c += 1) {
      const number = r * GEOMETRY.slotCols + c + 1;
      const id = `${def.id}-${String(number).padStart(2, '0')}`;
      const x = round(def.x + colOffsets[c]);
      slots.push({
        id,
        blockId: def.id,
        blockName: def.name,
        number,
        row: r,
        col: c,
        type: (SPECIAL_SLOTS[def.id] || {})[id] || 'standard',
        x,
        y,
        width: slotWidth,
        height: slotHeight,
        cx: round(x + slotWidth / 2),
        cy: round(y + slotHeight / 2),
        nodeId: `SLOT-${id}`,
        laneNodeId: laneNodeFor(def.id, c, r),
      });
    }
  }

  return {
    id: def.id,
    name: def.name,
    zone: def.zone,
    x: def.x,
    y: def.y,
    width: blockWidth,
    height: blockHeight,
    titleHeight: GEOMETRY.titleHeight,
    aisleX: round(def.x + aisleCenterOffset()),
    corridorY,
    crossRoadY,
    entryY: round(def.y + blockHeight + entryGap),
    leftLaneX: round(def.x + laneInset),
    rightLaneX: round(def.x + blockWidth - laneInset),
    slots,
  };
}

const BLOCKS = BLOCK_DEFS.map(buildBlock);
const BLOCK_BY_ID = BLOCKS.reduce((acc, block) => ({ ...acc, [block.id]: block }), {});
const SLOTS = BLOCKS.flatMap((block) => block.slots);
const SLOT_BY_ID = SLOTS.reduce((acc, slot) => ({ ...acc, [slot.id]: slot }), {});

const ROADS = Object.values(ROAD_DEFS);
const LANDMARKS = {
  watchmanRoom: { ...ROAD_DEFS.watchman, nodeId: NODES.watchman },
  entrance: { ...ROAD_DEFS.gate, nodeId: NODES.gate },
};

function unitsToMeters(units) {
  return round(units * METERS_PER_UNIT);
}

function buildGraph() {
  const nodes = {};
  const edges = [];

  const addNode = (id, x, y, meta = {}) => {
    nodes[id] = { id, x: round(x), y: round(y), ...meta };
    return nodes[id];
  };
  const link = (a, b, meta = {}) => {
    const na = nodes[a];
    const nb = nodes[b];
    if (!na || !nb) throw new Error(`layout: cannot link unknown nodes ${a} -> ${b}`);
    edges.push({ from: a, to: b, weight: unitsToMeters(Math.hypot(nb.x - na.x, nb.y - na.y)), ...meta });
  };

  // ------------------------------------------------------------- phase 1
  addNode(NODES.watchman, SPINE_X, ROAD_DEFS.watchman.y + ROAD_DEFS.watchman.height / 2, { kind: 'room', label: 'Watchman Room' });
  addNode(NODES.gate, SPINE_X, ROAD_DEFS.gate.y + ROAD_DEFS.gate.height / 2, { kind: 'gate', label: 'Main Gate' });
  addNode(NODES.spineTop, SPINE_X, ROAD_DEFS.gate.y + ROAD_DEFS.gate.height + 30, { kind: 'road', label: 'Main Road (gate end)' });
  addNode(NODES.spineNorth, SPINE_X, CROSS_NORTH_Y, { kind: 'junction', label: 'North cross road junction' });
  addNode(NODES.spineMid, SPINE_X, 600, { kind: 'road', label: 'Main Road (middle)' });
  addNode(NODES.spineSouth, SPINE_X, CROSS_SOUTH_Y, { kind: 'junction', label: 'South cross road junction' });
  addNode(NODES.spineEnd, SPINE_X, ROAD_DEFS.watchman.y, { kind: 'road', label: 'Main Road (watchman end)' });

  const crossRoads = [CROSS_NORTH_Y, CROSS_SOUTH_Y].map((y, index) => {
    const isNorth = index === 0;
    const prefix = isNorth ? 'NC' : 'SC';
    const xs = [
      ...new Set(
        [CROSS_EDGE_X, round(SPINE_X), ...BLOCKS.map((b) => round(b.aisleX)), CROSS_FAR_X].map((v) => round(v)),
      ),
    ].sort((a, b) => a - b);
    const ids = xs.map((x, i) => {
      const isSpine = x === round(SPINE_X);
      const id = isSpine ? (isNorth ? NODES.spineNorth : NODES.spineSouth) : `${prefix}_${i}`;
      addNode(id, x, y, {
        kind: 'road',
        road: isNorth ? 'NORTH_CROSS' : 'SOUTH_CROSS',
        label: isNorth ? 'North Cross Road' : 'South Cross Road',
      });
      return id;
    });
    return { y, isNorth, prefix, xs, ids };
  });

  BLOCKS.forEach((block) => {
    addNode(`${block.id}_ENTRY`, block.aisleX, block.entryY, {
      kind: 'entry',
      blockId: block.id,
      label: `${block.name} entry`,
    });
    addNode(`${block.id}_CORRIDOR`, block.aisleX, block.corridorY, {
      kind: 'corridor',
      blockId: block.id,
      label: `${block.name} access corridor`,
    });
    [
      { base: `${block.id}_LANE_L`, side: 'left', x: block.leftLaneX },
      { base: `${block.id}_AISLE`, side: 'center', x: block.aisleX },
      { base: `${block.id}_LANE_R`, side: 'right', x: block.rightLaneX },
    ].forEach(({ base, side, x: laneX }) => {
      addNode(base, laneX, block.corridorY, {
        kind: 'corridor',
        blockId: block.id,
        label: `${block.name} ${side} drive lane`,
      });
      for (let r = 0; r < GEOMETRY.slotRows; r += 1) {
        addNode(`${base}_${r}`, laneX, rowCenterY(block, r), {
          kind: 'aisle',
          blockId: block.id,
          row: r,
          label: `${block.name} ${side} lane, row ${r + 1}`,
        });
      }
    });
    block.slots.forEach((slot) => {
      addNode(slot.nodeId, slot.cx, slot.cy, { kind: 'slot', blockId: block.id, slotId: slot.id, label: slot.id });
    });
  });

  // ------------------------------------------------------------- phase 2
  [NODES.gate, NODES.spineTop, NODES.spineNorth, NODES.spineMid, NODES.spineSouth, NODES.spineEnd].forEach((id, i, arr) => {
    if (i > 0) link(arr[i - 1], id, { road: 'MAIN_ROAD' });
  });
  link(NODES.spineEnd, NODES.watchman, { road: 'WATCHMAN_ACCESS' });

  crossRoads.forEach((cross) => {
    cross.ids.forEach((id, i) => {
      if (i > 0) link(cross.ids[i - 1], id, { road: cross.isNorth ? 'NORTH_CROSS' : 'SOUTH_CROSS' });
    });
    const nodeIdForX = (x) => {
      const i = cross.xs.indexOf(round(x));
      return cross.ids[i === -1 ? 0 : i];
    };
    BLOCKS.forEach((block) => {
      if (Math.abs(block.crossRoadY - cross.y) > 1) return;
      link(nodeIdForX(block.aisleX), `${block.id}_ENTRY`, { road: cross.isNorth ? 'NORTH_CROSS' : 'SOUTH_CROSS' });
      link(`${block.id}_ENTRY`, `${block.id}_CORRIDOR`, { road: `${block.id}_ENTRY`, indoor: true });
    });
  });

  BLOCKS.forEach((block) => {
    [
      { base: `${block.id}_LANE_L` },
      { base: `${block.id}_AISLE` },
      { base: `${block.id}_LANE_R` },
    ].forEach(({ base }) => {
      link(`${block.id}_CORRIDOR`, base, { road: `${block.id}_CORRIDOR`, indoor: true });
      const chain = [base, ...Array.from({ length: GEOMETRY.slotRows }, (_, r) => `${base}_${r}`).reverse()];
      chain.forEach((id, i) => {
        if (i > 0) link(chain[i - 1], id, { road: `${block.id}_LANE`, indoor: true });
      });
    });
    link(`${block.id}_LANE_L`, `${block.id}_CORRIDOR`, { road: `${block.id}_CORRIDOR`, indoor: true });
    link(`${block.id}_LANE_R`, `${block.id}_CORRIDOR`, { road: `${block.id}_CORRIDOR`, indoor: true });
    block.slots.forEach((slot) =>
      link(slot.laneNodeId, slot.nodeId, { road: `${block.id}_BAY`, indoor: true, slotId: slot.id }),
    );
  });

  // ------------------------------------------------------------- phase 3
  const adjacency = {};
  edges.forEach((edge) => {
    adjacency[edge.from] = adjacency[edge.from] || [];
    adjacency[edge.to] = adjacency[edge.to] || [];
    adjacency[edge.from].push({ node: edge.to, weight: edge.weight, edge });
    adjacency[edge.to].push({ node: edge.from, weight: edge.weight, edge });
  });

  return { nodes, edges, adjacency };
}

const GRAPH = buildGraph();

function getSlot(slotId) {
  return SLOT_BY_ID[String(slotId || '').toUpperCase()] || null;
}

function getBlock(blockId) {
  return BLOCK_BY_ID[String(blockId || '').toUpperCase()] || null;
}

module.exports = {
  METERS_PER_UNIT,
  CANVAS,
  GEOMETRY,
  NODES,
  BLOCKS,
  BLOCK_BY_ID,
  SLOTS,
  SLOT_BY_ID,
  ROADS,
  LANDMARKS,
  GRAPH,
  getSlot,
  getBlock,
  unitsToMeters,
  totalSlots: SLOTS.length,
  blockName: (id) => (BLOCK_BY_ID[String(id || '').toUpperCase()] || {}).name || null,
};
