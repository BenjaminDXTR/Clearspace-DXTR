const express = require('express');
const router = express.Router();

const historyRoutes = require('./history');
const anchorRoutes = require('./anchor');
const shutdownRoutes = require('./shutdown');
const accessCheck = require("./accessCheck");
const errorLogRoutes = require('./errorLog'); // nouvelle route log d’erreur

router.use('/history', historyRoutes);
router.use('/', anchorRoutes);
router.use('/shutdown', shutdownRoutes);
router.use('/api', accessCheck);
router.use('/api', errorLogRoutes); // L’endpoint POST /api/log-error

module.exports = router;
