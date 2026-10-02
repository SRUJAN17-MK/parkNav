'use strict';

/**
 * SmartPark - Graph path finding.
 *
 * Implements the two algorithms required by the project brief:
 *
 *   1. Dijkstra's algorithm  - guaranteed optimal, used to build the
 *      "closest empty slot to the entrance" ranking during slot allocation.
 *   2. A* (A-star) search   - same optimal result as Dijkstra for a single
 *      destination, but much faster because the Euclidean heuristic prunes
 *      most of the graph. This powers the watchman navigation route.
 *
 * The heuristic is admissible (straight-line distance can never be shorter
 * than the real road distance), therefore A* is optimal here.
 */

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop() {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

function euclidean(graph, from, to) {
  const a = graph.nodes[from];
  const b = graph.nodes[to];
  if (!a || !b) return Infinity;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function reconstruct(cameFrom, current) {
  const path = [current];
  let node = current;
  while (cameFrom[node]) {
    node = cameFrom[node];
    path.unshift(node);
  }
  return path;
}

function runSearch(graph, startId, goalId, { heuristicWeight = 1 } = {}) {
  if (!graph.nodes[startId]) return { found: false, path: [], cost: Infinity, visited: 0 };
  if (!graph.nodes[goalId]) return { found: false, path: [], cost: Infinity, visited: 0 };
  if (startId === goalId) return { found: true, path: [startId], cost: 0, visited: 0 };

  const open = new MinHeap();
  const cameFrom = {};
  const gScore = { [startId]: 0 };
  const closed = new Set();

  open.push({ id: startId, priority: heuristicWeight * euclidean(graph, startId, goalId) });

  while (open.size > 0) {
    const current = open.pop();
    if (current.id === goalId) {
      return { found: true, path: reconstruct(cameFrom, goalId), cost: gScore[goalId], visited: closed.size };
    }
    if (closed.has(current.id)) continue;
    closed.add(current.id);

    const neighbours = graph.adjacency[current.id] || [];
    for (const neighbour of neighbours) {
      if (closed.has(neighbour.node)) continue;
      const tentative = gScore[current.id] + neighbour.weight;
      if (tentative < (gScore[neighbour.node] ?? Infinity)) {
        cameFrom[neighbour.node] = current.id;
        gScore[neighbour.node] = tentative;
        open.push({ id: neighbour.node, priority: tentative + heuristicWeight * euclidean(graph, neighbour.node, goalId) });
      }
    }
  }

  return { found: false, path: [], cost: Infinity, visited: closed.size };
}

/** Classic Dijkstra - single source shortest paths for the whole graph. */
function dijkstra(graph, startId) {
  const distances = {};
  const previous = {};
  const settled = new Set();
  const open = new MinHeap();

  if (!graph.nodes[startId]) return { distances, previous, settled };

  distances[startId] = 0;
  open.push({ id: startId, priority: 0 });

  while (open.size > 0) {
    const current = open.pop();
    if (settled.has(current.id)) continue;
    settled.add(current.id);

    const neighbours = graph.adjacency[current.id] || [];
    for (const neighbour of neighbours) {
      const tentative = distances[current.id] + neighbour.weight;
      if (tentative < (distances[neighbour.node] ?? Infinity)) {
        distances[neighbour.node] = tentative;
        previous[neighbour.node] = current.id;
        open.push({ id: neighbour.node, priority: tentative });
      }
    }
  }

  return { distances, previous, settled };
}

/** A* - optimal point to point route. */
function astar(graph, startId, goalId, options) {
  return runSearch(graph, startId, goalId, { heuristicWeight: 1, ...options });
}

/** Greedy best-first: fastest but not guaranteed optimal (used for map previews). */
function greedy(graph, startId, goalId) {
  return runSearch(graph, startId, goalId, { heuristicWeight: 5 });
}

/** Shortest distance in metres between two graph nodes (Dijkstra based). */
function distanceBetween(graph, from, to) {
  const result = astar(graph, from, to);
  return result.found ? result.cost : Infinity;
}

module.exports = { MinHeap, dijkstra, astar, greedy, distanceBetween, euclidean };
