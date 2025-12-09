FROM node:20-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy everything including node_modules from host
COPY . .

# Rebuild native modules for Linux container
RUN npm rebuild better-sqlite3 || true
RUN npm rebuild @swc/core || true  
RUN npm rebuild esbuild || true
RUN npm rebuild @rollup/rollup-linux-x64-gnu || true

# Create data directory
RUN mkdir -p /app/packages/api/data

# Setup Python solver if needed
RUN if [ -f packages/solver/requirements.txt ]; then \
    python3 -m venv /app/venv && \
    /app/venv/bin/pip install -r packages/solver/requirements.txt; \
    fi

ENV PATH="/app/venv/bin:$PATH"
ENV NODE_ENV=development

EXPOSE 5173 4000

CMD ["npm", "run", "dev:docker"]
