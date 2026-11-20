# Projet : guide Dofus mobile (usage strictement personnel)

## But
PWA pour iPhone qui affiche les guides de Ganymède (ganymede-dofus.com) pour que le guide soit sur le téléphone, et non sur l'écran du MacBook où tourne le jeu.

## Différence principale avec Ganymède
- Plusieurs personnages, chacun avec sa progression (étape courante) par guide.
- Des « équipes » (ex. duocompte) : un appui sur « étape suivante » fait avancer tous les persos de l'équipe ; un perso peut avancer seul sans toucher aux autres.
- Changer de perso/équipe doit se faire en un geste.

## Contraintes
- Licence : le dépôt GanymedeTeam/ganymede-app est « Contribution-Only, All Rights Reserved ». Ne JAMAIS copier son code. On peut seulement s'inspirer du format de données de l'API. Tout le code est écrit de zéro.
- Être correct avec leur serveur : mettre les guides en cache localement, pas de requêtes en boucle.
- Mobile d'abord : iPhone, Safari, mode « écran d'accueil ». Zones tactiles de 44 px minimum, utilisable à une main.

## Ce qu'on sait de l'API (d'après la lecture de leur code)
- L'URL de base de l'API v2 est une variable secrète dans leur CI. L'ancienne appli utilisait https://ganymede-dofus.com/api/guides. Hypothèse : https://ganymede-dofus.com/api/v2/... (à vérifier).
- GET {API}/v2/guides?status=public|certified|gp  -> liste de guides (sans les étapes)
- GET {API}/v2/guides/{id}  -> guide complet avec ses étapes
- Pas d'authentification pour lire les guides publics.
- Guide : id, name, status, likes, dislikes, downloads, lang (fr/en/es/pt), game_type (dofus/wakfu), order, user {id, name, is_admin, is_certified}, description, web_description, node_image, updated_at, steps[]
- Étape : name (nullable), map (nullable), pos_x, pos_y, web_text (HTML)
- Le HTML de web_text contient des balises spéciales :
  - data-type="custom-tag" avec attributs type (monster|quest|item|dungeon|wakfu-item), name, dofusdbid
  - data-type="guide-step" avec guideid, stepnumber, stepid (lien vers une étape d'un guide ; stepid=0 = « là où j'en suis »)
  - data-type="quest-block" avec questname, status (setup|start|in_progress|end)
  - des listes de tâches (data-type="taskItem")
- Le jeu utilise la commande « /travel x,y » pour se déplacer.
