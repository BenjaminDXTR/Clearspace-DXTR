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

## 🛠 Configuration et utilisation du fichier `.env` (exemple)

Le fichier `.env.example` sert de modèle pour configurer votre environnement.  
Il doit être copié et renommé en `.env` à la racine du projet avant de lancer les serveurs.  
Vous devrez ensuite personnaliser certaines valeurs pour correspondre à votre réseau et à vos accès.

### Valeurs essentielles à remplir ou modifier dans `.env` :

- **Clé Blockchain (`BLOCKCHAIN_API_KEY`)** :  
  Entrez ici la clé ou le token secret fourni par le service blockchain, indispensable pour les opérations d’ancrage sécurisées.

- **Adresse et IP des machines externes autorisées :**  
  - `ALLOWED_IPS` : liste des adresses IP des machines pouvant accéder au backend.  
    Par exemple : `localhost,127.0.0.1,192.168.x.x`.
  - `ALLOWED_ORIGINS` : liste des domaines (avec protocole et port) autorisés côté backend pour les requêtes CORS.  
    Par exemple : `http://localhost,http://clearspace-dxtr:3000`.

- **Activation du mode simulation (`USE_TEST_SIM`)** :  
  Activez (`true`) pour tester sans avoir tous les matériels et services réels en ligne.  

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

## 🌐 Configuration du nom de domaine local

Pour simplifier l'accès à l'interface frontend sur le réseau local, vous pouvez utiliser le nom de domaine local [translate:clearspace-dxtr] plutôt qu’une adresse IP, qui peut varier selon la machine cliente.

Pour cela :

- Sur chaque machine cliente (poste utilisateur, autre serveur), éditez le fichier `hosts` :
  - Windows : `C:\Windows\System32\drivers\etc\hosts` (ouvrir en mode administrateur).  
  - Linux/macOS : `/etc/hosts` (à modifier avec les droits root/sudo).

- Ajoutez une ligne pointant vers l'IP de la machine hôte sur le réseau local (attention, l'IP dépendra du réseau et peut varier) :

<IP_de_la_machine_hote> clearspace-dxtr

- Pour accéder au frontend depuis cette machine client, ouvrez un navigateur à l'adresse :

http://clearspace-dxtr:<PORT_FRONTEND>
exemple :
(ajouté à la fin du fichier hosts)
192.168.1.10   clearspace-dxtr

où `<PORT_FRONTEND>` est la valeur de `FRONTEND_PORT` définie dans votre `.env` (ex : 3000).

Cette méthode permet de toujours utiliser le même nom d'hôte quel que soit le client, sans avoir à changer l'adresse IP manuellement.

---

## ℹ️ Notes

- Après modification `.env`, relancer serveurs.
- Le fichier `.env.local` dans `/frontend` est généré automatiquement mais peut aussi être modifié manuellement.
- La synchronisation entre backend et frontend est automatisée par le script.

---

## 💻 Support & Contact

Pour toute question, consultez la documentation ou contactez l’équipe DroneXTR