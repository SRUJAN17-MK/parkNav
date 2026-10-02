'use strict';

const { asyncHandler } = require('../middleware/errorHandler');
const navigationService = require('../services/navigationService');
const layout = require('../data/layout');

/**
 * GET /api/navigation/route?slot=A-12
 * Watchman room -> selected parking slot: distance, time, polyline, steps.
 */
const getRoute = asyncHandler(async (req, res) => {
  const { slot, from, algorithm } = req.query;
  if (!slot) return res.status(400).json({ success: false, message: 'Query parameter "slot" is required (e.g. A-12)' });
  const route = navigationService.getRouteToSlot({ slotId: slot, from, algorithm });
  res.json({ success: true, route });
});

/** GET /api/navigation/slots - distance from the watchman room to every slot. */
const getSlotDistances = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    from: 'Watchman Room',
    walkingSpeedMps: require('../config').navigation.walkingSpeedMps,
    distances: navigationService.distancesFromWatchman(),
  });
});

/** GET /api/navigation/graph - the raw graph (used by the map debug view). */
const getGraph = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    nodes: Object.keys(layout.GRAPH.nodes).length,
    edges: layout.GRAPH.edges.length,
    graph: layout.GRAPH,
  });
});

module.exports = { getRoute, getSlotDistances, getGraph };
