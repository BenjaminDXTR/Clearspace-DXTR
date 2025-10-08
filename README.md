# CS-DXTR  
Détection et ancrage de drones pour ClearSpace

Cette solution se compose de :  
- **Backend** : Node.js / Express (API locale, connexion à API distante GraphQL)  
- **Frontend** : React + TypeScript (interface web utilisateur)

---

## ⚠️ Important : Placement du fichier `.env`

Avant toute exécution des scripts `start-servers.bat` ou `start-servers.sh`, assurez-vous que le fichier `.env` de configuration serveur soit **placé à la racine du projet**. Ce fichier doit contenir toutes les variables nécessaires, notamment :  

BACKEND_PORT=3201
FRONTEND_PORT=3001
...



Ce fichier `.env` sera lu et exploité automatiquement par les scripts et serveurs (backend et frontend).  

---

## 🚀 Prérequis
- **Node.js** (v18 ou supérieure) + npm  
- **Git** (optionnel, pour cloner le dépôt)  
- Navigateur récent (Chrome, Firefox, Edge…)

---

## 📂 Structure
- `/backend` → API, services, scripts.  
- `/frontend` → Application React.

---

## ⚙️ Installation et lancement

### 1. Lancement automatique (recommandé)

#### Windows
1. Placez ou renommez correctement votre `.env` à la racine.  
2. Double-cliquez sur `start-servers.bat` à la racine.  
3. Le script :  
   - Vérifie la présence de `backend/.env`.  
   - Vérifie la présence de Node.js (ouvre lien officiel si absent).  
   - Installe dépendances backend et frontend si nécessaire.  
   - Génère ou met à jour le fichier `frontend/.env.local` automatiquement avec la configuration adaptée (incluant `VITE_BACKEND_PORT` et `FRONTEND_PORT`).  
   - Lance backend et frontend dans deux consoles séparées.  
4. Votre frontend sera accessible sur le port configuré dans `.env` (ex : 3001).

#### Linux / Mac
1. Placez ou renommez votre `.env` à la racine.  
2. Rendez les scripts exécutables (une seule fois) :  
chmod +x start-servers.sh stop-servers.sh


3. Lancez avec :  
./start-servers.sh


4. Même logique que Windows (install, génération `.env.local`, lancement terminaux).

---

### 2. Lancement manuel

Si vous préférez lancer manuellement (par exemple si les scripts ne fonctionnent pas) :

- Vérifiez que dans `/frontend` vous avez un fichier `.env.manual` contenant au minimum la variable pour connecter le frontend au backend, par exemple :

VITE_BACKEND_PORT=3201



- Copiez/le renommez ensuite en `.env.local` dans `/frontend` avant de lancer pour forcer le bon paramétrage.

Puis lancez ainsi :  

**Backend**  
cd backend
npm install # 1ère fois seulement
npm start



**Frontend**  
cd frontend
npm install # 1ère fois seulement
npm start



- Backend accessible sur [http://localhost:3201](http://localhost:3201)  
- Frontend accessible sur [http://localhost:3001](http://localhost:3001)  

---

## ⏹ Arrêt des serveurs

- **Windows** : Exécutez `stop-servers.bat` à la racine.  
- **Linux / Mac** : Exécutez `./stop-servers.sh` depuis la racine.

---

## 🛠 Configuration

### Paramètres généraux dans `.env` racine

- Port HTTP backend  
- Port frontend (serveur Vite)  
- CORS, taille max JSON, logs, simulation, etc.

### Paramètres spécifiques frontend dans `/frontend/.env.local`

Ce fichier est généré automatiquement par le script au lancement et inclut au moins :

VITE_BACKEND_PORT=3201
FRONTEND_PORT=3001



Pour un lancement manuel, vous pouvez générer ou créer manuellement ce fichier ou utiliser `.env.manual` que vous copiez en `.env.local`.

---

## ℹ️ Notes supplémentaires

- Après modification des variables d’environnement, toujours relancer les serveurs pour prise en compte.  
- Le frontend lit les variables dans `.env.local`, qui doit être présente et à jour.  
- Le script automatise la génération et la synchronisation des config entre backend et frontend.

---

## 💻 Support et aide

Pour toute question, consultez la documentation ou contactez l’équipe ClearSpace.

---

Merci pour votre confiance et utilisation de ClearSpace DXTR !