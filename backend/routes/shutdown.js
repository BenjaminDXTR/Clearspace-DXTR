const express = require('express');
const router = express.Router();

const { gracefulShutdown } = require('../middleware/shutdownHandler'); // chemin adapté

router.post('/', async (req, res) => {
    res.status(200).send('Arrêt initié');
    try {
        await gracefulShutdown();
    } catch (error) {
        console.error('Erreur lors de l\'arrêt :', error);
    }
});

module.exports = router;
