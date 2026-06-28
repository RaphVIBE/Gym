#!/bin/bash
# Double-clique ce fichier pour voir Pulse Gym en local (sans déployer).
# Le navigateur s'ouvre et se met à jour automatiquement à chaque changement.
cd "$(dirname "$0")" || exit 1

echo "🔍  Aperçu local de Pulse Gym"
echo ""

if [ ! -d node_modules ]; then
  echo "📦  Première fois : installation des dépendances (~30 s)…"
  npm install
  echo ""
fi

echo "🚀  Démarrage du serveur d'aperçu — le navigateur va s'ouvrir tout seul."
echo "    👉  Laisse cette fenêtre ouverte tant que tu regardes."
echo "    👉  Pour arrêter : ferme cette fenêtre (ou Ctrl-C)."
echo ""

npm run dev -- --open
