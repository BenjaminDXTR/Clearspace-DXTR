const express = require('express');
const router = express.Router();

const historyRoutes = require('./history');
const anchorRoutes = require('./anchor');
// const graphqlRoutes = require('./graphql'); // Commentez ou supprimez cette ligne si graphql n’est plus utilisé

router.use(historyRoutes);
router.use(anchorRoutes);
// router.use('/graphql', graphqlRoutes); // Commentez ou supprimez cette ligne aussi

module.exports = router;
