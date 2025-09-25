FROM node:18

# Install Python and yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

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
