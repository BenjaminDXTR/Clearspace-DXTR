# CS-DXTR  
Détection et ancrage de drones pour ClearSpace

Elle se compose de :
- **Backend** : Node.js / Express (API locale, connexion à API distante GraphQL)
- **Frontend** : React + TypeScript (interface web utilisateur)

---

## 🚀 Prérequis
- **Node.js** (v18 ou supérieure) + npm
- **Git** (optionnel, pour cloner le dépôt)
- Un navigateur récent (Chrome, Firefox, Edge…)

---

## 📂 Structure
- `/backend` → API, services, scripts.
- `/frontend` → Application React.

---

## ⚙️ Installation et lancement

### 1. Lancement automatique (recommandé)

#### **Windows**
1. Double-clique sur `start-servers.bat` depuis la racine du projet.
2. Le script :
   - Vérifie la présence de `backend/.env`.
   - Vérifie Node.js (ouvre lien officiel si absent).
   - Installe les dépendances backend et frontend si nécessaire.
   - Lance le backend et le frontend dans deux consoles séparées.
   - Utilise `backend/.env` pour la configuration.
3. Ouvre ensuite [http://localhost:3000](http://localhost:3000) dans ton navigateur.

#### **Linux / Mac**
1. Rendre le script exécutable (une seule fois) :

chmod +x start-servers.sh stop-servers.sh

2. Lancer :

./start-servers.sh

3. Le script :
- Vérifie `backend/.env`.
- Vérifie Node.js.
- Installe les dépendances backend et frontend si besoin.
- Lance backend et frontend dans des terminaux séparés.

---

### 2. Lancement manuel
Si vous préférez :

**Backend**

cd backend
npm install # 1ère fois seulement
npm start


**Frontend**

cd frontend
npm install # 1ère fois seulement
npm start


- Backend : [http://localhost:3200](http://localhost:3200)
- Frontend : [http://localhost:3000](http://localhost:3000)

---

## ⏹ Arrêt des serveurs
- **Windows** : `stop-servers.bat`
- **Linux / Mac** : `./stop-servers.sh`

---

## 🛠 Configuration
- Le fichier **backend/.env** contient les paramètres serveur/API.
- Exemple :


API_PROTOCOL=http
API_HOST=192.168.1.105
API_PORT=3200
