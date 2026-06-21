# JobCity frontend — build the CRA app, serve it with nginx + an /api reverse
# proxy so the browser only ever talks to one origin (no CORS, portable image).

# --- build stage ---
FROM node:22-bookworm-slim AS build
WORKDIR /app

# bash is needed by the prebuild patch script (scripts/patch-r3f.sh).
RUN apt-get update \
    && apt-get install -y --no-install-recommends bash python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
# Empty backend URL => the app calls same-origin "/api", which nginx proxies to
# the backend (see nginx template). Keeps the image environment-independent.
ENV REACT_APP_BACKEND_URL=""
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-bookworm AS serve
# The official nginx image runs envsubst over /etc/nginx/templates/*.template at
# start, substituting ${PORT} and ${BACKEND_URL} from the environment.
ENV PORT=8080 \
    BACKEND_URL=http://backend:8001
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
