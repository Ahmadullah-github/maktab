# Windows Deployment Guide: Zero-Dependency Installation

## Overview

This guide explains how to create a single `.exe` installer that works on any Windows PC without requiring Python, Node.js, or any other dependencies.

---

## What the User Experiences

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INSTALLATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: Download                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  📥 Download: "Maktab-Timetable-Setup-1.0.0.exe" (150 MB)           │   │
│  │     From: Your website, Google Drive, USB flash drive               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Step 2: Install (Double-click .exe)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔧 Standard Windows installer wizard:                               │   │
│  │     • "Welcome to Maktab Timetable Setup"                           │   │
│  │     • Choose install location (default: C:\Program Files\Maktab)    │   │
│  │     • Create desktop shortcut? [✓]                                  │   │
│  │     • Install... (30 seconds)                                       │   │
│  │     • "Installation Complete!" [Launch Now]                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Step 3: Use                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🎉 Double-click desktop icon → App opens → Ready to use!           │   │
│  │     No Python needed. No Node.js needed. No internet needed.        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture: What's Inside the .exe

```
Maktab-Timetable-Setup-1.0.0.exe (NSIS Installer)
│
├── 📁 Maktab Timetable/
│   │
│   ├── 🚀 Maktab Timetable.exe          ← Main Electron app (launches everything)
│   │
│   ├── 📁 resources/
│   │   ├── app.asar                      ← React UI + Express API (bundled)
│   │   │
│   │   └── 📁 solver/
│   │       ├── solver.exe                ← Python solver (PyInstaller bundle)
│   │       ├── config/                   ← Configuration files
│   │       └── (all Python deps inside)  ← OR-Tools, Pydantic, etc.
│   │
│   ├── 📁 locales/                       ← Language files
│   ├── 📁 data/                          ← SQLite database (created on first run)
│   │
│   └── 📄 Uninstall Maktab Timetable.exe ← Clean uninstaller
│
└── 📄 Desktop shortcut: "Maktab Timetable"
```

---

## How Each Component is Bundled

### 1. Python Solver → solver.exe (PyInstaller)

PyInstaller compiles Python + all dependencies into a single executable:

```
Python Code + OR-Tools + Pydantic + structlog
                    ↓
              PyInstaller
                    ↓
            solver.exe (60 MB)
            
Contains:
- Python interpreter (embedded)
- All Python packages
- Your solver code
- Works without Python installed!
```

### 2. React Frontend → app.asar (Webpack)

```
React Components + CSS + Assets
                    ↓
              npm run build
                    ↓
            dist/ folder (5 MB)
                    ↓
              electron-builder
                    ↓
            app.asar (compressed)
```

### 3. Express API → Bundled in Electron

```
Express.js + Routes + SQLite
                    ↓
              Runs inside Electron main process
              (Node.js is bundled with Electron)
```

### 4. Everything → Single Installer (electron-builder + NSIS)

```
Electron + React + Express + solver.exe
                    ↓
              electron-builder
                    ↓
    Maktab-Timetable-Setup-1.0.0.exe (150 MB)
```

---

## Build Process (Developer Side)

### Prerequisites (Only on YOUR development machine)

```bash
# Your machine needs:
- Node.js 18+
- Python 3.10+
- npm/yarn
```

### Build Commands

```bash
# 1. Build Python solver to standalone .exe
cd packages/solver
pip install pyinstaller
pyinstaller --onefile --name solver solver_enhanced.py

# 2. Build React frontend
cd packages/frontend
npm run build

# 3. Build complete Windows installer
cd /project-root
npm run build:win

# Output: dist/Maktab-Timetable-Setup-1.0.0.exe
```


---

## Complete Build Configuration

### electron-builder.json (Updated)

```json
{
  "appId": "com.maktab.timetable",
  "productName": "Maktab Timetable",
  "copyright": "Copyright © 2025",
  
  "directories": {
    "output": "dist",
    "buildResources": "build"
  },
  
  "files": [
    "electron/**/*",
    "!electron/node_modules",
    "packages/api/dist/**/*",
    "packages/frontend/dist/**/*"
  ],
  
  "extraResources": [
    {
      "from": "packages/solver/dist/solver.exe",
      "to": "solver/solver.exe"
    },
    {
      "from": "packages/solver/config",
      "to": "solver/config",
      "filter": ["**/*"]
    }
  ],
  
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.ico",
    "artifactName": "${productName}-Setup-${version}.${ext}"
  },
  
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "build/icon.ico",
    "uninstallerIcon": "build/icon.ico",
    "installerHeaderIcon": "build/icon.ico",
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Maktab Timetable",
    "license": "LICENSE",
    "installerLanguages": ["en_US"],
    "language": 1033
  },
  
  "publish": null
}
```

### PyInstaller Spec File (solver.spec)

```python
# packages/solver/solver.spec
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['solver_enhanced.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('strategies', 'strategies'),
        ('decomposition', 'decomposition'),
        ('utils', 'utils'),
        ('constraints', 'constraints'),
        ('config', 'config'),
    ],
    hiddenimports=[
        'ortools',
        'ortools.sat',
        'ortools.sat.python',
        'ortools.sat.python.cp_model',
        'pydantic',
        'pydantic.fields',
        'pydantic_core',
        'structlog',
        'structlog.processors',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy.testing',
        'pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='solver',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # Compress executable
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console for stdin/stdout
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../../build/solver-icon.ico'
)
```

---

## Electron Main Process (Updated)

```javascript
// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Determine paths based on packaged vs development
const isDev = !app.isPackaged;

function getSolverPath() {
  if (isDev) {
    // Development: use Python directly
    return {
      command: 'python',
      args: ['solver_enhanced.py'],
      cwd: path.join(__dirname, '../packages/solver')
    };
  } else {
    // Production: use bundled solver.exe
    const solverExe = path.join(process.resourcesPath, 'solver', 'solver.exe');
    return {
      command: solverExe,
      args: [],
      cwd: path.join(process.resourcesPath, 'solver')
    };
  }
}

function getDataPath() {
  // Store user data in AppData (persists across updates)
  return path.join(app.getPath('userData'), 'data');
}

// Ensure data directory exists
function ensureDataDir() {
  const dataPath = getDataPath();
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  return dataPath;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Load bundled React app
    mainWindow.loadFile(path.join(__dirname, '../packages/frontend/dist/index.html'));
  }
}

// Solver execution
ipcMain.handle('solver:solve', async (event, inputData) => {
  return new Promise((resolve, reject) => {
    const { command, args, cwd } = getSolverPath();
    
    console.log(`Starting solver: ${command} ${args.join(' ')}`);
    
    const solver = spawn(command, args, { cwd });
    
    let stdout = '';
    let stderr = '';
    
    // Send input data
    solver.stdin.write(JSON.stringify(inputData));
    solver.stdin.end();
    
    solver.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    solver.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            if (event.event === 'progress') {
              // Send progress to renderer
              mainWindow.webContents.send('solver:progress', event);
            }
          } catch (e) {
            stderr += line + '\n';
          }
        }
      });
    });
    
    solver.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error(`Failed to parse solver output: ${e.message}`));
        }
      } else {
        reject(new Error(`Solver failed with code ${code}: ${stderr}`));
      }
    });
    
    solver.on('error', (err) => {
      reject(new Error(`Failed to start solver: ${err.message}`));
    });
  });
});

// App lifecycle
app.whenReady().then(() => {
  ensureDataDir();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

---

## Complete Build Script

```bash
#!/bin/bash
# scripts/build-windows-installer.sh

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Building Maktab Timetable Windows Installer                ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# Step 1: Build Python Solver
echo ""
echo "📦 Step 1/4: Building Python solver..."
cd packages/solver

# Create virtual environment if not exists
if [ ! -d ".venv" ]; then
    python -m venv .venv
fi

# Activate and install
source .venv/Scripts/activate  # Windows Git Bash
pip install -r requirements.txt
pip install pyinstaller

# Build solver.exe
pyinstaller solver.spec --clean --noconfirm

# Verify
if [ -f "dist/solver.exe" ]; then
    echo "✅ solver.exe created ($(du -h dist/solver.exe | cut -f1))"
else
    echo "❌ Failed to create solver.exe"
    exit 1
fi

cd ../..

# Step 2: Build React Frontend
echo ""
echo "📦 Step 2/4: Building React frontend..."
cd packages/frontend
npm ci --silent
npm run build

if [ -d "dist" ]; then
    echo "✅ Frontend built ($(du -sh dist | cut -f1))"
else
    echo "❌ Failed to build frontend"
    exit 1
fi

cd ../..

# Step 3: Build Express API
echo ""
echo "📦 Step 3/4: Building Express API..."
cd packages/api
npm ci --silent
npm run build

if [ -d "dist" ]; then
    echo "✅ API built"
else
    echo "❌ Failed to build API"
    exit 1
fi

cd ../..

# Step 4: Build Electron Installer
echo ""
echo "📦 Step 4/4: Building Windows installer..."
npm ci --silent
npm run electron:build -- --win

# Check output
INSTALLER=$(ls dist/*.exe 2>/dev/null | head -1)
if [ -f "$INSTALLER" ]; then
    SIZE=$(du -h "$INSTALLER" | cut -f1)
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  ✅ BUILD SUCCESSFUL!                                          ║"
    echo "╠════════════════════════════════════════════════════════════════╣"
    echo "║  Output: $INSTALLER"
    echo "║  Size: $SIZE"
    echo "╚════════════════════════════════════════════════════════════════╝"
else
    echo "❌ Failed to create installer"
    exit 1
fi
```


---

## What Happens on User's Computer

### Installation Process (Behind the Scenes)

```
User double-clicks: Maktab-Timetable-Setup-1.0.0.exe

NSIS Installer does:
├── 1. Extract files to temp folder
├── 2. Show license agreement
├── 3. Ask for install location (default: C:\Program Files\Maktab Timetable)
├── 4. Copy files:
│   ├── Maktab Timetable.exe (Electron)
│   ├── resources/app.asar (React + Express)
│   ├── resources/solver/solver.exe (Python solver)
│   └── ... other files
├── 5. Create registry entries (for uninstall)
├── 6. Create shortcuts:
│   ├── Desktop: "Maktab Timetable"
│   └── Start Menu: "Maktab Timetable"
└── 7. Done! (30 seconds total)
```

### First Launch

```
User clicks desktop shortcut

What happens:
├── 1. Windows runs: "Maktab Timetable.exe"
├── 2. Electron starts (Node.js bundled inside)
├── 3. Express API starts (inside Electron)
├── 4. React UI loads in Electron window
├── 5. SQLite database created in:
│      C:\Users\{username}\AppData\Roaming\Maktab Timetable\data\
└── 6. App ready to use!

When user generates timetable:
├── 1. React sends request to Express API
├── 2. Express spawns: resources/solver/solver.exe
├── 3. solver.exe runs (Python bundled inside)
├── 4. Results returned to UI
└── 5. No Python installation needed!
```

### File Locations on User's PC

```
C:\Program Files\Maktab Timetable\          ← Application files (read-only)
├── Maktab Timetable.exe
├── resources\
│   ├── app.asar
│   └── solver\
│       └── solver.exe
└── Uninstall Maktab Timetable.exe

C:\Users\{username}\AppData\Roaming\Maktab Timetable\  ← User data
├── data\
│   └── maktab.db                           ← SQLite database
├── checkpoints\                            ← Solver checkpoints
├── logs\                                   ← Application logs
└── config\                                 ← User settings
```

---

## Comparison: Docker vs Single .exe

### Docker Approach (NOT Recommended for End Users)

```
What user would need to do:
1. Download Docker Desktop (~500 MB)
2. Install Docker Desktop
3. Enable WSL2 (Windows Subsystem for Linux)
4. Restart computer
5. Wait for Docker to start (30+ seconds each boot)
6. Download your Docker image
7. Run docker-compose up
8. Open browser to localhost:3000

Problems:
❌ Complex for non-technical users
❌ Docker Desktop requires admin rights
❌ WSL2 can conflict with other software
❌ Uses more RAM (Docker overhead)
❌ Slower startup
❌ Confusing error messages
❌ Updates are complicated
```

### Single .exe Approach (RECOMMENDED)

```
What user does:
1. Download Maktab-Timetable-Setup.exe (150 MB)
2. Double-click to install
3. Click desktop shortcut
4. Done!

Benefits:
✅ Familiar Windows installation
✅ No technical knowledge needed
✅ Works offline immediately
✅ Fast startup (2-3 seconds)
✅ Easy updates (download new installer)
✅ Clean uninstall via Control Panel
✅ Works on any Windows 10/11 PC
```

---

## Minimum System Requirements

```
Operating System: Windows 10 (64-bit) or Windows 11
Processor: Intel Core i3 / AMD Ryzen 3 or better
RAM: 4 GB minimum, 8 GB recommended
Storage: 500 MB for installation + 100 MB for data
Display: 1024x768 minimum resolution

NOT Required:
❌ Python
❌ Node.js
❌ Docker
❌ Internet connection (after installation)
❌ Administrator rights (for per-user install)
```

---

## Distribution Options

### Option 1: Direct Download
```
Host on your website:
https://yoursite.com/downloads/Maktab-Timetable-Setup-1.0.0.exe

Or cloud storage:
- Google Drive (share link)
- Dropbox
- OneDrive
```

### Option 2: USB Flash Drive
```
For schools without reliable internet:
1. Copy .exe to USB drive
2. Give to school administrator
3. They install on each computer
```

### Option 3: Auto-Update (Optional)
```javascript
// electron/main.js - Add auto-updater
const { autoUpdater } = require('electron-updater');

app.whenReady().then(() => {
  // Check for updates (if online)
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
  // Notify user
});

autoUpdater.on('update-downloaded', () => {
  // Prompt to restart
});
```

---

## Summary

| Question | Answer |
|----------|--------|
| Does user need Python? | **No** - bundled in solver.exe |
| Does user need Node.js? | **No** - bundled in Electron |
| Does user need Docker? | **No** - not recommended |
| Does user need internet? | **No** - works offline |
| Does user need admin rights? | **No** - can install per-user |
| How big is the installer? | **~150 MB** |
| How long to install? | **~30 seconds** |
| How to update? | Download new installer or auto-update |

**Bottom line:** Single .exe installer is the best approach for end users. They just download, install, and use - exactly like any other Windows application.
