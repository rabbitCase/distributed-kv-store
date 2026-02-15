FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/index.js"]