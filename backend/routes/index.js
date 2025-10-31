const express = require('express');
const router = express.Router();

const historyRoutes = require('./history');
const anchorRoutes = require('./anchor');
const shutdownRoutes = require('./shutdown');
const accessCheck = require("./accessCheck");
const errorLogRoutes = require('./errorLog'); // route log erreurs

router.use('/history', historyRoutes);
router.use('/anchor', anchorRoutes);
router.use('/shutdown', shutdownRoutes);
router.use('/access', accessCheck);
router.use('/log-error', errorLogRoutes);

module.exports = router;
