# Portability Guide

This project is designed to be completely portable and runnable on any device when cloned. All paths are relative and environment-agnostic.

## Environment Variables

You can customize the following environment variables if needed:

### API Configuration
- `API_PORT` - Port for the API server (default: 4000)
- `API_HOST` - Host for the API server (default: localhost)

### Web Development Server
- `VITE_PORT` - Port for the web dev server (default: 5173)
- `VITE_HOST` - Host for the web dev server (default: localhost)
- `VITE_API_TARGET` - API target URL for proxy (default: http://localhost:4000)

### Solver Configuration
- `SOLVER_PATH` - Override path to Python solver (optional)

### Database Configuration
- `DATABASE_PATH` - Path to SQLite database (default: ./packages/api/timetable.db)

## Path Resolution

The project uses robust path resolution that works across different operating systems and directory structures:

1. **API Package**: Uses relative paths from compiled location
2. **Web Package**: Uses environment variables for configuration
3. **Solver Package**: Uses relative paths from script location
4. **Electron Package**: Uses relative paths from app directory

## Running on Different Systems

### Windows
```bash
npm install
npm run dev
```

### macOS/Linux
```bash
npm install
npm run dev
```

### Custom Configuration
```bash
# Set custom ports
VITE_PORT=3000 API_PORT=5000 npm run dev

# Set custom API target
VITE_API_TARGET=http://192.168.1.100:4000 npm run dev
```

## Troubleshooting

If you encounter path-related issues:

1. Check that all packages are installed: `npm install`
2. Verify Python dependencies: `npm run install:deps`
3. Check environment variables are set correctly
4. Ensure you're running from the project root directory

## File Structure

The project maintains a consistent structure regardless of where it's cloned:
```
project-root/
├── packages/
│   ├── api/          # Backend API
│   ├── web/          # Frontend web app
│   └── solver/       # Python solver
├── electron/         # Electron main process
└── package.json      # Root configuration
```

All paths are resolved relative to this structure, making the project portable across different systems and directory locations.
