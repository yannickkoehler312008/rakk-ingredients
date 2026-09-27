#!/usr/bin/env bash
# Guided Supabase setup for the ingredient chat assistant.
#
# Run from the rakk-app directory:  bash scripts/setup-supabase.sh
#
# It stops at each step that needs YOU (a browser login, a project ref, an API
# key) and tells you exactly what to do. Nothing here is destructive, and your
# Anthropic key is passed straight to `supabase secrets set` — it is never
# written to a file in this repo and never read back.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
SB="npx --yes supabase@latest"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;36m── %s\033[0m\n' "$*"; }

step "1/6  Log in to Supabase"
if $SB projects list >/dev/null 2>&1; then
  echo "Already logged in."
else
  echo "A browser window will open. Sign in, then come back here."
  $SB login || { echo "Login failed."; exit 1; }
fi

step "2/6  Pick the project"
echo "Your projects:"
$SB projects list || true
echo
read -r -p "Project ref (the ID in the list above, e.g. abcdefghijklmnop): " REF
[ -n "$REF" ] || { echo "No ref given."; exit 1; }
$SB link --project-ref "$REF" || { echo "Link failed."; exit 1; }

step "3/6  Create the rate-limit table"
echo "Pushes supabase/migrations/0001_chat_rate_limit.sql to your database."
$SB db push || { echo "db push failed."; exit 1; }

step "4/6  Store the Anthropic key SERVER-SIDE"
echo "This goes into Supabase's secret store, not into this repo."
echo "Get one at console.anthropic.com -> API Keys."
read -r -s -p "Anthropic API key (sk-ant-...): " KEY; echo
if [ -n "$KEY" ]; then
  $SB secrets set "ANTHROPIC_API_KEY=$KEY" || { echo "Setting the secret failed."; exit 1; }
  unset KEY
else
  echo "Skipped — the chat will return an upstream error until this is set."
fi

step "5/6  Deploy the function"
$SB functions deploy ingredient-chat || { echo "Deploy failed."; exit 1; }

step "6/6  Write .env.local for the app"
echo "These two values are PUBLIC by design and protected by row-level security."
API_JSON="$($SB projects api-keys --project-ref "$REF" -o json 2>/dev/null)"
ANON="$(printf '%s' "$API_JSON" | python3 -c 'import sys,json
try:
  for k in json.load(sys.stdin):
    if k.get("name")=="anon": print(k.get("api_key","")); break
except Exception: pass' 2>/dev/null)"
if [ -z "$ANON" ]; then
  read -r -p "anon key (Dashboard -> Project Settings -> API): " ANON
fi
cat > .env.local <<EOF
EXPO_PUBLIC_SUPABASE_URL=https://$REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON
EOF
echo "Wrote .env.local (gitignored)."

say "Done."
cat <<'EOF'
One thing left that the CLI cannot do for you:

  Dashboard -> Authentication -> Sign In / Providers
  -> turn ON "Allow anonymous sign-ins"

The chat needs a session per user so it can rate-limit; that switch provides
one without building the Apple/Google flow yet.

Then restart Expo so it picks up .env.local:

  npx expo start --clear
EOF
