# BOLOSS — image unique (serveur Socket.io qui sert aussi le client buildé).
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Installer les dépendances des 3 workspaces (avec le lockfile pour la reproductibilité).
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

# Copier le code et builder (shared -> server -> client).
COPY . .
RUN npm run build

# Le serveur lit process.env.PORT (défaut 3001) et sert client/dist.
EXPOSE 3001
CMD ["npm", "start"]
