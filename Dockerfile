FROM python:3.12-alpine AS build
WORKDIR /app
COPY build.py client.js style.css sw.js icon192.png icon512.png logo.webp son-ouverture.mp3 ./
COPY photos ./photos
COPY worker ./worker
RUN python build.py

FROM node:24-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY server.mjs ./
CMD ["node", "server.mjs"]
