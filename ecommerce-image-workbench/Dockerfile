FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache sqlite

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV UPLOADS_DIR=/app/data/uploads
ENV PROJECTS_DIR=/app/projects
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 3000
CMD ["npm", "start"]
