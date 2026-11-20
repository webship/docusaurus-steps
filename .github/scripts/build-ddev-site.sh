#!/usr/bin/env bash
# Builds the site the suite runs against, in a DDEV project of type generic: a
# site made with create-docusaurus (the classic template, TypeScript) in site/,
# its packages installed in the web container (Node.js 24), built for
# production (`docusaurus build`) and served (`docusaurus serve`) by the web
# container as a daemon, at https://<PROJECT_NAME>.ddev.site.
#
#   test-site  the template's site turned into the test site of this pack by
#              site/test-site.cjs: its own docs (tabs, admonitions, code
#              blocks) in three versions (Next, 2.0, 1.0), a French locale, its
#              own blog, an announcement bar, a menu in the navbar, and the
#              local search (@easyops-cn/docusaurus-search-local, MIT), which
#              needs no account and no outside service.
#   template   the site create-docusaurus makes, as it makes it.
#
# The project folder holds the site in site/ and nothing else of it, so a test
# project (cucumber.js, package.json, tests/) can live at the top without
# touching the site's own package.json.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME        the DDEV project name                       (default docusaurussteps)
#   SITE_DIR            the project folder                          (default a new temporary folder)
#   SITE                test-site or template                       (default test-site)
#   DOCUSAURUS_VERSION  the release of create-docusaurus and of the site
#                                                                   (default 3.10.2)
#   SEARCH_VERSION      the release of the local search             (default 0.55.3)
#   SERVE_ONLY          1: build nothing new; build the site in SITE_DIR again
#                       and serve it
#
# A documentation site has no accounts: nothing logs in, nothing is created
# for the suite but the site itself.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-docusaurussteps}"
SITE="${SITE:-test-site}"
DOCUSAURUS_VERSION="${DOCUSAURUS_VERSION:-3.10.2}"
SEARCH_VERSION="${SEARCH_VERSION:-0.55.3}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
HOST="${PROJECT_NAME}.ddev.site"
SITE_URL="https://${HOST}"
APP_DIR=/var/www/html/site

case "$SITE" in
  test-site|template) ;;
  *) echo "SITE is test-site or template, not \"$SITE\"." >&2; exit 1 ;;
esac

mkdir -p "$SITE_DIR"
SITE_DIR="$(cd "$SITE_DIR" && pwd)"
cd "$SITE_DIR"

# A command in the site's folder in the web container, with stdin closed (an
# open stdin pipe keeps some tools waiting for input when this runs in the
# background).
in_site() {
  ddev exec -d "$APP_DIR" "$@" </dev/null
}

# Wait until the site's server answers on its own port in the web container.
wait_for_server() {
  local attempt
  for attempt in $(seq 1 90); do
    if ddev exec "curl -fsS -o /dev/null http://127.0.0.1:3000/" </dev/null >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "The site's server did not answer; its last lines:" >&2
  docker logs --tail 40 "ddev-${PROJECT_NAME}-web" 2>&1 | tail -40 >&2 || true
  return 1
}

# Build the site for production and serve the new build.
build_and_serve() {
  echo "Building the site for production (docusaurus build)."
  in_site "npm run build"
  ddev exec "supervisorctl restart webextradaemons:docusaurus" </dev/null
  wait_for_server
}

if [ "${SERVE_ONLY:-}" = "1" ]; then
  build_and_serve
  echo "Serving the site at $SITE_URL"
  exit 0
fi

# A project of this name somewhere else is somebody else's: never touch it.
if ddev describe "$PROJECT_NAME" -j </dev/null >/dev/null 2>&1; then
  EXISTING="$(ddev describe "$PROJECT_NAME" -j </dev/null 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['approot'])" || true)"
  if [ -n "$EXISTING" ] && [ "$EXISTING" != "$SITE_DIR" ]; then
    echo "A DDEV project named $PROJECT_NAME already lives at $EXISTING. Choose another PROJECT_NAME, or delete that project first." >&2
    exit 1
  fi
fi

# A generic project: the web container runs no web server of its own; the
# router sends ports 80 and 443 of the project's address to the site's server.
# No database: the site is files.
ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name="$PROJECT_NAME" \
  --nodejs-version=24 --omit-containers=db </dev/null

# Node.js 24 in the web image, so the site's server has it before the
# container's daemons start.
mkdir -p .ddev/web-build
cat > .ddev/web-build/Dockerfile.docusaurus <<'DOCKEREOF'
# Node.js 24 in the web image, so the site's server has it before the daemons start.
RUN N_PREFIX=/usr/local n install 24 && node --version
DOCKEREOF

# The site's server: the production build, once there is one.
cat > .ddev/docusaurus-serve.sh <<'SERVEEOF'
#!/usr/bin/env bash
# Serves the production build of the site (site/build) on port 3000. Run by the web container's supervisor.
cd /var/www/html/site 2>/dev/null || { sleep 5; exit 1; }
if [ ! -x node_modules/.bin/docusaurus ] || [ ! -f build/index.html ]; then sleep 5; exit 1; fi
exec node_modules/.bin/docusaurus serve --port 3000 --host 0.0.0.0 --no-open
SERVEEOF
chmod +x .ddev/docusaurus-serve.sh

cat > .ddev/config.docusaurus.yaml <<'YAMLEOF'
# The site in this project. The web container serves no files of its own: the router sends ports 80
# and 443 of the project's address to the site's server on port 3000, which the web container runs as
# a daemon (.ddev/docusaurus-serve.sh).
web_extra_exposed_ports:
  - name: docusaurus
    container_port: 3000
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: docusaurus
    command: "bash /var/www/html/.ddev/docusaurus-serve.sh"
    directory: /var/www/html
YAMLEOF

ddev start -y </dev/null

# The site, in site/: the classic template, TypeScript.
rm -rf "$SITE_DIR/site"
ddev exec -d /var/www/html "npx -y create-docusaurus@${DOCUSAURUS_VERSION} site classic --typescript --package-manager npm --skip-install" </dev/null
echo "Installing the packages of the site (npm). This takes a minute or two."
in_site "npm install --no-audit --no-fund"

if [ "$SITE" = "test-site" ]; then
  in_site "npm install --no-audit --no-fund @easyops-cn/docusaurus-search-local@${SEARCH_VERSION}"
  cp "$REPO_DIR/site/test-site.cjs" "$SITE_DIR/site/.webship-test-site.cjs"
  status=0
  in_site "node .webship-test-site.cjs --test-content" || status=$?
  rm -f "$SITE_DIR/site/.webship-test-site.cjs"
  [ "$status" -eq 0 ] || exit "$status"
fi

build_and_serve

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
RELEASE="$(in_site "node -p \"require('@docusaurus/core/package.json').version\"" 2>/dev/null | tr -d '\r' || true)"
echo "Built the ${SITE} on ${RELEASE:-the release} at $SITE_URL"
