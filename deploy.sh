#!/bin/bash
# Publishes the latest main branch from GitHub. A cPanel cron job runs this every
# few minutes, so merged changes go live without clicking "Deploy" in cPanel.
# It does the same copy as .cpanel.yml, and does nothing when there is no new commit.
set -e
cd "$HOME/repositories/flowsuit-website"
git fetch -q origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
    exit 0
fi
git reset -q --hard origin/main
mkdir -p "$HOME/flowsuit-app"
/bin/cp -R app/. "$HOME/flowsuit-app/"
/bin/cp -R public/. "$HOME/public_html/"
echo "$(date '+%Y-%m-%d %H:%M:%S') deployed $(git rev-parse --short HEAD)" >> "$HOME/flowsuit-deploy.log"
