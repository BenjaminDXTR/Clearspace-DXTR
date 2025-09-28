const express = require('express');
const router = express.Router();

const historyRoutes = require('./history');
const anchorRoutes = require('./anchor');
// const graphqlRoutes = require('./graphql'); // Si non utilisé


router.use('/history', historyRoutes); // <-- Correction ici : historyRoutes au lieu de historyRouter
router.use('/', anchorRoutes);
// router.use('/graphql', graphqlRoutes); // Si graphql utilisé


module.exports = router;
