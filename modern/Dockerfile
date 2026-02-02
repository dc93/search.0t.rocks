FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY --from=build /app/.output .output
COPY exports/ exports/

EXPOSE 3000

ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

CMD ["node", ".output/server/index.mjs"]
