FROM node:22-alpine

# Install extraction tools
RUN apk add --no-cache \
  p7zip \
  unrar \
  unzip \
  bzip2 \
  xz \
  tar \
  gzip

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# Create data directories
RUN mkdir -p /data/incoming /data/temp /data/failed

CMD ["npx", "tsx", "src/main.ts"]
