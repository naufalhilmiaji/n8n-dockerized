FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install system deps (for puppeteer/chromium or other libs)
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install npm dependencies
RUN npm install

# Copy the rest of the app (but node_modules will stay in container, not overwritten)
COPY . .

# Expose port
EXPOSE 3000

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "serve"]
