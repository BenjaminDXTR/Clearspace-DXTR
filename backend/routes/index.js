const express = require('express');
const router = express.Router();

const historyRoutes = require('./history');
const anchorRoutes = require('./anchor');

router.use('/history', historyRoutes);
router.use('/', anchorRoutes);

module.exports = router;
