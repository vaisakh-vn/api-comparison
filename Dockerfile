FROM node:20-alpine

WORKDIR /app

# Install deps first so this layer is cached when only source changes
COPY package.json ./
RUN npm install

COPY . .

# Ports for all three servers — the compose file picks which to expose per service
EXPOSE 3001 4000 50051
