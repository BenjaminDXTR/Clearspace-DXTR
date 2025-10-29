const express = require("express");
const router = express.Router();

// Cette route est protégée par le middleware IP défini globalement dans server.js
// Si le middleware bloque l'IP cliente, cette route ne sera pas appelée, sinon répond OK

router.get("/check-access", (req, res) => {
    res.json({ status: "ok", message: "Accès autorisé" });
});

module.exports = router;
