FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY client/package.json ./client/package.json
RUN npm install
RUN npm --prefix client install

COPY . .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV APP_INTERNAL_PORT=3088

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/data ./data

EXPOSE 3088

CMD ["npm", "start"]

