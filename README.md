# CS-DXTR
**Détection et ancrage de drones pour ClearSpace**

---

## Présentation

Cette solution se compose de :
- **Backend** : Node.js / Express (API locale, connexion à API distante GraphQL)
- **Frontend** : React + TypeScript (interface web utilisateur)

---

## ⚠️ Placement du fichier `.env`

Avant tout lancement, il faut copier le fichier `.env.example` en `.env` à la racine du projet et le personnaliser avec vos paramètres.
Ce fichier est automatiquement lu par les scripts pour configurer backend et frontend.

---

## 🚀 Prérequis

- **Node.js** (v18 ou supérieur) + npm
- Navigateur moderne (Chrome, Firefox, Edge...)

---

## 🛠 Configuration

### Variables dans `.env` (racine)

- **Port backend** : `BACKEND_PORT`
- **Port frontend (Vite)** : `FRONTEND_PORT`
- **Liste des IPs autorisées (BACKEND)** : `ALLOWED_IPS`
Exemples : `localhost,127.0.0.1,192.168.x.x`
- **Origines CORS** : `ALLOWED_ORIGINS`
Format : `http://host:port`, séparés par une virgule.
- **Vérification TLS** : `IGNORE_TLS_ERRORS=false` en prod, `true` en dev.
- **Mode test/simulation** : `USE_TEST_SIM=true` (à désactiver en prod).
- **Clé Blockchain** : `BLOCKCHAIN_API_KEY` (à remplir avec votre clé).

---

## 🔑 Conseils sécurité

- Limitez `ALLOWED_IPS` aux IPs de vos clients de confiance.
- Configurez `ALLOWED_ORIGINS` pour n’autoriser que vos domaines de production.

---

## ⚙️ Installation & Lancement

### 1. Lancement automatique (recommandé)

**Windows**

1. Placez ou nommez `.env` à la racine.
2. Double-cliquez sur `start-servers.bat`.
3. Le script :
 - Vérifie la présence de `.env`.
 - Vérifie Node.js (ouvre le lien officiel si absent).
 - Installe dépendances si besoin.
 - Génère `frontend/.env.local` avec les paramètres adaptés (inclut `VITE_BACKEND_PORT`, `FRONTEND_PORT`).
 - Lance backend et frontend dans deux consoles séparées.
4. Accédez au frontend via [http://<IP_HOST>:<PORT>] (par exemple http://192.168.1.10:3000)

**Linux / Mac**

1. Placez ou nommez `.env`.
2. Rendez les scripts exécutables :
chmod +x start-servers.sh stop-servers.sh
3. Lancez :
./start-servers.sh
4. Même principe que sous Windows.

---

### 2. Lancement manuel

- Copiez ou renommez `env.local.exemple` dans `/frontend` en `.env.local`.
- Modifiez `{VITE_BACKEND_PORT}` selon votre configuration, par exemple `3200`.
- Ensuite, lancez séparément :

backend
cd backend
npm install
npm start

frontend
cd frontend
npm install
npm start

- Accédez au frontend via [http://<IP_HOST>:<PORT>] (par exemple http://192.168.1.10:3000)

---

## ⏹ Arrêt des serveurs

- **Windows** : exécuté `stop-servers.bat`.
- **Linux / Mac** : `./stop-servers.sh`.

---

## 🌐 Configuration locale `[translate:clearspace-dxtr]`

Pour accéder par nom local :

- Modifier le fichier `hosts` (sous Windows/Linux/macos) :
IP_de_la_machine_hôte﻿ clearspace-dxtr

- Dans le navigateur :
http://clearspace-dxtr:<port_frontend>

où `<port_frontend>` correspond à `FRONTEND_PORT`.

---

## ℹ️ Notes

- Après modification `.env`, relancer serveurs.
- Le fichier `.env.local` dans `/frontend` est généré automatiquement mais peut aussi être modifié manuellement.
- La synchronisation entre backend et frontend est automatisée par le script.

---

## 💻 Support & Contact

Pour toute question, consultez la documentation ou contactez l’équipe DroneXTR