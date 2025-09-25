# Use Node.js 18 as base
FROM node:18

# Install Python and yt-dlp using system packages
RUN apt-get update && \
    apt-get install -y python3 python3-pip curl yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install Node.js dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]