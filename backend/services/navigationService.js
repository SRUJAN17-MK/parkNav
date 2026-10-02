'use strict';

/**
 * SmartPark - Navigation service.
 *
 * Turns the road graph into a human-usable route:
 *   watchman room -> main road -> cross road -> block entry -> drive lane -> slot
 *
 * The route is computed with A* (optimal, heuristic-guided) and the resulting
 * polyline is converted into turn-by-turn instructions.
 */

const config = require('../config');
const layout = require('../data/layout');
const { astar, dijkstra } = require('./pathfinding');

const { GRAPH, NODES, getSlot, getBlock, LANDMARKS } = layout;

const EDGE_INDEX = GRAPH.edges.reduce((acc, edge) => {
  acc[`${edge.from}|${edge.to}`] = edge;
  acc[`${edge.to}|${edge.from}`] = edge;
  return acc;
}, {});

const ROAD_LABELS = {
  MAIN_ROAD: 'Main Parking Road',
  NORTH_CROSS: 'North Cross Road',
  SOUTH_CROSS: 'South Cross Road',
  WATCHMAN_ACCESS: 'Watchman Room exit',
};

function edgeBetween(a, b) {
  return EDGE_INDEX[`${a}|${b}`] || null;
}

function nodeLabel(nodeId) {
  const node = GRAPH.nodes[nodeId];
  if (!node) return nodeId;
  if (node.kind === 'room') return 'Watchman Room';
  if (node.kind === 'gate') return 'Main Gate';
  if (node.kind === 'entry') return node.label;
  if (node.kind === 'slot') return `Parking ${node.slotId}`;
  if (node.kind === 'corridor') return node.label;
  if (node.kind === 'aisle') return node.label;
  return node.label || ROAD_LABELS[node.road] || nodeId;
}

function roadLabel(edge) {
  if (!edge) return 'parking lane';
  if (edge.road && ROAD_LABELS[edge.road]) return ROAD_LABELS[edge.road];
  if (edge.road && /_ENTRY$/.test(edge.road)) return `${edge.road.split('_')[0]} block entry`;
  if (edge.road && /_CORRIDOR$/.test(edge.road)) return 'block access corridor';
  if (edge.road && /_LANE$/.test(edge.road)) return 'drive lane';
  if (edge.road && /_BAY$/.test(edge.road)) return 'parking bay';
  return 'drive lane';
}

/** 0 = north, 90 = east (screen coordinates, y grows downwards). */
function bearingOf(from, to) {
  const deg = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function compassName(deg) {
  const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return dirs[Math.round(deg / 45) % 8];
}

function compassShort(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function angleBetween(a, b) {
  const dot = a.x * b.x + a.y * b.y;
  const det = a.x * b.y - a.y * b.x;
  return (Math.atan2(det, dot) * 180) / Math.PI;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sec`;
}

/**
 * Computes the walking route from a starting node to a parking slot.
 *
 * @param {object} options
 * @param {string} options.slotId
 * @param {string} [options.from]   start node id (default: watchman room)
 * @param {string} [options.algorithm] 'astar' | 'dijkstra'
 * @returns {object} route description
 */
function getRouteToSlot(options) {
  const slot = getSlot(options.slotId);
  if (!slot) {
    const error = new Error(`Unknown parking slot "${options.slotId}"`);
    error.status = 404;
    throw error;
  }

  const fromNodeId = options.from || NODES.watchman;
  if (!GRAPH.nodes[fromNodeId]) {
    const error = new Error(`Unknown start node "${fromNodeId}"`);
    error.status = 400;
    throw error;
  }

  const algorithm = options.algorithm === 'dijkstra' ? 'dijkstra' : 'astar';
  const result = algorithm === 'dijkstra' ? dijkstraPath(fromNodeId, slot.nodeId) : astar(GRAPH, fromNodeId, slot.nodeId);
  if (!result.found) {
    const error = new Error('No route found to the requested slot');
    error.status = 422;
    throw error;
  }

  const points = result.path.map((id) => ({ x: GRAPH.nodes[id].x, y: GRAPH.nodes[id].y, id }));
  const distanceM = Math.round(result.cost * 10) / 10;
  const speed = config.navigation.walkingSpeedMps;
  const durationSec = Math.round(distanceM / speed);
  const block = getBlock(slot.blockId);
  const steps = buildSteps(result.path, points, slot, block);

  return {
    slotId: slot.id,
    blockId: slot.blockId,
    blockName: block ? block.name : slot.blockName,
    zone: block ? block.zone : null,
    slotType: slot.type,
    slotPosition: { row: slot.row + 1, column: slot.col + 1 },
    algorithm: algorithm === 'astar' ? 'A* (A-star)' : 'Dijkstra',
    expandedNodes: result.visited,
    from: { nodeId: fromNodeId, label: nodeLabel(fromNodeId), x: GRAPH.nodes[fromNodeId].x, y: GRAPH.nodes[fromNodeId].y },
    to: { nodeId: slot.nodeId, label: nodeLabel(slot.nodeId), x: slot.cx, y: slot.cy },
    distanceM,
    distanceLabel: `${Math.round(distanceM)} m`,
    walkingSpeedMps: speed,
    durationSec,
    durationLabel: formatDuration(durationSec),
    path: result.path,
    points,
    polyline: points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '),
    steps,
    landmark: LANDMARKS.watchmanRoom,
  };
}

function dijkstraPath(from, to) {
  const { distances, previous } = dijkstra(GRAPH, from);
  if (distances[to] === undefined) return { found: false, cost: Infinity, path: [] };
  const path = [to];
  let node = to;
  while (previous[node]) {
    node = previous[node];
    path.unshift(node);
  }
  return { found: true, cost: distances[to], path, visited: Object.keys(distances).length };
}

/** Collapses the raw node list into a short list of straight legs. */
function toLegs(path, points) {
  const legs = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthUnits = Math.hypot(dx, dy);
    if (lengthUnits < 0.5) continue;
    const leg = {
      from,
      to,
      path: [path[i], path[i + 1]],
      vector: { x: dx, y: dy },
      bearing: bearingOf(from, to),
      distanceM: Math.round(layout.unitsToMeters(lengthUnits) * 10) / 10,
      node: path[i + 1],
      previousNode: path[i],
      road: roadLabel(edgeBetween(path[i], path[i + 1])),
      blockId: GRAPH.nodes[path[i + 1]] ? GRAPH.nodes[path[i + 1]].blockId : null,
    };
    const last = legs[legs.length - 1];
    if (last) {
      const turn = angleBetween(last.vector, leg.vector);
      if (Math.abs(turn) < 16) {
        // Same direction - extend the previous leg.
        last.to = leg.to;
        last.path = last.path.concat(leg.path.slice(1));
        last.node = leg.node;
        last.distanceM = Math.round((last.distanceM + leg.distanceM) * 10) / 10;
        last.bearing = leg.bearing;
        // After merging, the leg is named after the road you end up on.
        last.road = leg.road;
        last.merged = (last.merged || 1) + 1;
        continue;
      }
    }
    legs.push(leg);
  }
  return legs;
}

const TURN_ICONS = { left: 'turn-left', right: 'turn-right', straight: 'straight', uturn: 'uturn' };

function buildSteps(path, points, slot, block) {
  const legs = toLegs(path, points);
  const speed = config.navigation.walkingSpeedMps;
  const steps = [];

  legs.forEach((leg, index) => {
    const isLast = index === legs.length - 1;
    const previous = legs[index - 1];
    const distanceLabel = `${Math.round(leg.distanceM)} m`;
    const road = leg.road === 'Watchman Room exit' ? ROAD_LABELS.MAIN_ROAD : leg.road;
    const insideBlock = leg.blockId ? layout.blockName(leg.blockId) : null;
    const detail = insideBlock ? `Inside ${insideBlock}` : `Bearing ${compassShort(leg.bearing)}`;

    if (index === 0) {
      steps.push({
        order: steps.length + 1,
        icon: 'exit',
        kind: 'exit',
        instruction: `Exit the Watchman Room and walk ${compassName(leg.bearing)} along the ${road}`,
        detail: `Head towards the ${compassShort(leg.bearing)} for ${distanceLabel}`,
        distanceM: leg.distanceM,
        durationSec: Math.round(leg.distanceM / speed),
        road,
        bearing: Math.round(leg.bearing),
        compass: compassShort(leg.bearing),
      });
    } else {
      const turn = angleBetween(previous.vector, leg.vector);
      const abs = Math.abs(turn);
      let kind = 'straight';
      if (abs > 135) kind = 'uturn';
      else if (turn > 0) kind = 'right';
      else if (turn < 0) kind = 'left';

      const instruction =
        kind === 'straight'
          ? `Continue straight for ${distanceLabel} on the ${road}`
          : kind === 'uturn'
            ? `Make a U-turn and head back ${distanceLabel}`
            : `Turn ${kind} onto the ${road} and walk ${distanceLabel}`;

      steps.push({
        order: steps.length + 1,
        icon: TURN_ICONS[kind] || 'straight',
        kind,
        instruction,
        detail,
        distanceM: leg.distanceM,
        durationSec: Math.round(leg.distanceM / speed),
        road,
        bearing: Math.round(leg.bearing),
        compass: compassShort(leg.bearing),
      });
    }

    if (isLast) {
      steps.push({
        order: steps.length + 1,
        icon: 'arrive',
        kind: 'arrive',
        instruction: `Parking ${slot.id} is ${Math.round(leg.distanceM)} m ahead in ${block ? block.name : slot.blockName}`,
        detail: `Row ${slot.row + 1}, bay ${slot.col + 1}${slot.type !== 'standard' ? ` (${slot.type.toUpperCase()} bay)` : ''}`,
        distanceM: leg.distanceM,
        durationSec: Math.round(leg.distanceM / speed),
        road: `Bay ${slot.id}`,
        isDestination: true,
      });
    }
  });

  const totalM = Math.round(legs.reduce((sum, leg) => sum + leg.distanceM, 0) * 10) / 10;
  return { steps, totalM, legs: legs.length };
}

/** Distance matrix helper: distance from the watchman room to every slot. */
function distancesFromWatchman() {
  const { distances } = dijkstra(GRAPH, NODES.watchman);
  return Object.fromEntries(
    layout.SLOTS.map((slot) => [slot.id, Math.round((distances[slot.nodeId] || 0) * 10) / 10]),
  );
}

module.exports = { getRouteToSlot, distancesFromWatchman, formatDuration, buildSteps, toLegs, compassName, bearingOf };
