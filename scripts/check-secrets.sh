#!/bin/sh
set -eu

bad_paths=""
while IFS= read -r path; do
  case "$path" in
    .env.example|*/.env.example) ;;
    .env|*/.env|.env.*|*/.env.*|.codex/*|*/.codex/*|*.pem|*.p12|*.pfx|*.key)
      bad_paths="${bad_paths}${path}\n"
      ;;
  esac
done <<EOF
$(git ls-files)
EOF

if [ -n "$bad_paths" ]; then
  echo "Refusing sensitive/local tracked paths:" >&2
  printf "%b" "$bad_paths" >&2
  exit 1
fi

secret_pattern='AIza[0-9A-Za-z_-]{35}|opr_(live|test)_[0-9A-Za-z]{20,}|SERP_API_KEY=[0-9a-fA-F]{32,}|gh[pousr]_[0-9A-Za-z]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----'
if matches=$(git grep -n -I -E "$secret_pattern" -- . 2>/dev/null); then
  echo "Potential committed secret detected:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "Tracked-file secret check passed."
