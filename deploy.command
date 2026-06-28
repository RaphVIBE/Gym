#!/bin/bash
# Double-clique ce fichier dans le Finder pour publier Pulse Gym.
cd "$(dirname "$0")" || exit 1

echo "🚀  Déploiement de Pulse Gym…"
echo ""

# nettoie d'éventuels verrous git restés bloqués
rm -f .git/*.lock .git/refs/heads/*.lock 2>/dev/null

git add -A

if git diff --cached --quiet; then
  echo "ℹ️   Aucun changement à publier."
else
  git commit -m "Mise à jour $(date '+%d/%m/%Y %H:%M')"
fi

echo "⬆️   Envoi vers GitHub…"
if git push; then
  echo ""
  echo "✅  Envoyé ! Netlify déploie la nouvelle version dans ~1 minute."
else
  echo ""
  echo "❌  Échec de l'envoi. Vérifie ta connexion ou tes accès GitHub."
fi

echo ""
read -p "Appuie sur Entrée pour fermer cette fenêtre…"
