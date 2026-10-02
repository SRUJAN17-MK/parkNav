'use strict';

const express = require('express');

const { requireAuth } = require('../middleware/auth');
const auth = require('../controllers/authController');
const parking = require('../controllers/parkingController');
const vehicles = require('../controllers/vehicleController');
const navigation = require('../controllers/navigationController');
const camera = require('../controllers/cameraController');

const router = express.Router();

// ---------------------------------------------------------------- public
router.get('/health', (req, res) => res.json({ success: true, service: 'smartpark-api', status: 'ok' }));
router.post('/auth/login', auth.login);
router.get('/auth/demo-accounts', auth.demoAccounts);

// ------------------------------------------------------- watchman session
router.use(requireAuth);

router.get('/auth/me', auth.me);

router.get('/dashboard/stats', vehicles.stats);

router.get('/parking/map', parking.getMap);
router.get('/parking/slots', parking.getSlots);
router.get('/parking/slots/:slotId', parking.getSlot);
router.get('/parking/blocks', parking.getBlocks);
router.get('/parking/next-available', parking.getNextAvailable);

router.get('/vehicles/search', vehicles.searchVehicles);
router.get('/vehicles/history', vehicles.listVehicles);
router.get('/vehicles/:vehicleNumber', vehicles.getVehicle);
router.post('/vehicles/entry', vehicles.createEntry);
router.post('/vehicles/exit', vehicles.createExit);

router.get('/navigation/route', navigation.getRoute);
router.get('/navigation/distances', navigation.getSlotDistances);
router.get('/navigation/graph', navigation.getGraph);

router.get('/camera/status', camera.status);
router.post('/camera/simulate-entry', camera.simulateEntry);
router.post('/camera/simulate-exit', camera.simulateExit);
router.post('/camera/ocr', camera.readPlate);

module.exports = router;
