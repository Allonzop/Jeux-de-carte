# BOLOSS — image unique (serveur Socket.io qui sert aussi le client buildé).
FROM node:22-alpine

WORKDIR /app

# Installer les dépendances des 3 workspaces (avec le lockfile pour la reproductibilité).
# IMPORTANT : ne PAS définir NODE_ENV=production avant cette étape, sinon npm
# saute les devDependencies (typescript, tsx, vite) et le build échoue
# avec "tsc: not found".
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

# Copier le code et builder (shared -> server -> client).
COPY . .
RUN npm run build

# Production seulement à l'exécution (le serveur tourne via tsx, déjà installé).
ENV NODE_ENV=production

# Le serveur lit process.env.PORT (défaut 3001) et sert client/dist.
EXPOSE 3001
CMD ["npm", "start"]
