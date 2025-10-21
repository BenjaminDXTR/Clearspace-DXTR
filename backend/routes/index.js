const express = require('express');
const router = express.Router();

const historyRoutes = require('./history');
const anchorRoutes = require('./anchor');
const shutdownRoutes = require('./shutdown'); // importer la route shutdown
const accessCheck = require("./accessCheck");


router.use('/history', historyRoutes);
router.use('/', anchorRoutes);
router.use('/shutdown', shutdownRoutes); // ajouter la route shutdown
router.use("/api", accessCheck);


module.exports = router;
