# Cursor IDE Setup Guide for Maktab Project

This document provides comprehensive setup instructions for optimizing Cursor IDE for the Maktab timetable application development.

## 📋 Quick Setup Checklist

- [x] `.cursorrules` file created (project-specific AI rules)
- [x] `.vscode/settings.json` configured (editor settings)
- [x] `.vscode/extensions.json` created (recommended extensions)
- [x] `.prettierrc.json` configured (code formatting)
- [ ] Install recommended extensions
- [ ] Configure ESLint (when frontend is created)
- [ ] Set up Python environment for solver package

---

## 🎯 Configuration Files Created

### 1. `.cursorrules`
**Location:** Root directory
**Purpose:** Provides context and coding guidelines to Cursor AI

**Key Features:**
- Project structure and technology stack context
- RTL-first development guidelines
- TypeScript/React best practices
- API integration patterns
- Code style conventions

**How to Use:**
- Cursor automatically reads this file
- AI suggestions will follow these rules
- Update as project evolves

### 2. `.vscode/settings.json`
**Location:** `.vscode/settings.json`
**Purpose:** Workspace-specific editor settings

**Key Settings:**
- TypeScript configuration (strict mode, inlay hints)
- Format on save enabled
- Tailwind CSS IntelliSense
- Python interpreter path
- File exclusions for performance

### 3. `.vscode/extensions.json`
**Location:** `.vscode/extensions.json`
**Purpose:** Recommends essential extensions

**Install Extensions:**
1. Open Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for "Recommended Extensions"
3. Click "Install All" or install individually

### 4. `.prettierrc.json`
**Location:** Root directory
**Purpose:** Code formatting configuration

**Settings:**
- Single quotes for JavaScript/TypeScript
- 2-space indentation
- 100 character line width
- LF line endings

---

## 🔧 Manual Setup Steps

### Step 1: Install Recommended Extensions

Open the Extensions view and install:

**Essential:**
- ✅ ESLint (`dbaeumer.vscode-eslint`)
- ✅ Prettier (`esbenp.prettier-vscode`)
- ✅ Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)

**TypeScript/React:**
- ✅ TypeScript Importer (`pmneo.tsimporter`)
- ✅ ES7+ React/Redux/React-Native snippets (`dsznajder.es7-react-js-snippets`)
- ✅ Auto Rename Tag (`formulahendry.auto-rename-tag`)

**Code Quality:**
- ✅ Error Lens (`usernamehw.errorlens`) - Shows errors inline
- ✅ Code Spell Checker (`streetsidesoftware.code-spell-checker`)

**Git:**
- ✅ GitLens (`eamodio.gitlens`)

**Python (for solver):**
- ✅ Python (`ms-python.python`)
- ✅ Black Formatter (`ms-python.black-formatter`)
- ✅ Pylance (`ms-python.vscode-pylance`)

### Step 2: Configure ESLint (When Frontend is Created)

Once `packages/web` is set up, create `.eslintrc.json`:

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Step 3: Set Up Python Environment (Solver Package)

```bash
cd packages/solver
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Cursor will automatically detect the virtual environment if it's in `packages/solver/.venv/`.

### Step 4: Configure TypeScript Paths (When Frontend is Created)

In `packages/web/tsconfig.json`, add path aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/features/*": ["./src/features/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/i18n/*": ["./src/i18n/*"]
    }
  }
}
```

Also configure in `vite.config.ts`:

```typescript
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## 🎨 Cursor AI Features to Leverage

### 1. Chat with Codebase
- Use `@` mentions to reference files
- Ask questions about architecture
- Get explanations of complex code

### 2. Composer Mode
- Multi-file editing
- Refactoring across files
- Feature implementation

### 3. Inline Suggestions
- Real-time code completions
- Follows `.cursorrules` guidelines
- Respects RTL-first principles

### 4. Code Actions
- Right-click for AI-powered refactoring
- Generate tests
- Add documentation

---

## 🚀 Best Practices for Cursor

### 1. Use Specific Prompts
❌ Bad: "Fix the bug"
✅ Good: "Fix the duplicate subject creation issue in the subjects feature. Ensure backend unique constraints are enforced and frontend prevents duplicate creates."

### 2. Reference Architecture Docs
When asking about implementation:
```
@docs/FRONTEND_ARCHITECTURE.md How should I implement the schedule board component?
```

### 3. Use File References
```
@packages/api/src/routes/teachers.route.ts How does the teacher API work?
```

### 4. Context-Aware Requests
Mention relevant context:
- "Following RTL-first principles, create a form component..."
- "Using TanStack Query pattern from the architecture doc, implement..."

---

## 🔍 Troubleshooting

### TypeScript Errors Not Showing
1. Check `typescript.tsdk` in settings
2. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Run: `npm install` in workspace root

### Prettier Not Formatting
1. Ensure Prettier extension is installed
2. Check `.prettierrc.json` exists
3. Verify file is not in `.prettierignore`
4. Set Prettier as default formatter for file type

### Tailwind IntelliSense Not Working
1. Install Tailwind CSS IntelliSense extension
2. Ensure `tailwind.config.ts` exists in `packages/web/`
3. Check file associations in settings

### Python Not Detected
1. Select interpreter: `Ctrl+Shift+P` → "Python: Select Interpreter"
2. Choose `packages/solver/.venv/bin/python`
3. Install Python extension if missing

---

## 📝 Additional Recommendations

### 1. Workspace Trust
When opening the project, Cursor may ask to trust the workspace. Click "Yes" to enable all features.

### 2. Git Integration
- Enable GitLens for better Git visualization
- Configure Git user if not already set

### 3. Terminal Profiles
The settings configure bash as default terminal. Adjust if using zsh or fish.

### 4. Performance
Large monorepos can be slow. The settings exclude:
- `node_modules/`
- `dist/` and `build/` directories
- Python cache files

If still slow, consider:
- Using `.cursorignore` for additional exclusions
- Limiting file watchers
- Using workspace folders instead of full monorepo

---

## 🎯 Next Steps

1. ✅ Install recommended extensions
2. ✅ Review `.cursorrules` for project guidelines
3. ✅ Test TypeScript IntelliSense in `packages/api`
4. ⏳ Set up frontend package (`packages/web`) when ready
5. ⏳ Configure ESLint for frontend
6. ⏳ Test RTL layout features

---

## 📚 Related Documentation

- `docs/FRONTEND_ARCHITECTURE.md` - Frontend architecture details
- `docs/API_FILE_STRUCTURE.md` - Backend API structure
- `.cursorrules` - AI coding guidelines
- `NAQSH-UI-DESIGN-SYSTEM.md` - Design system reference

---

**Last Updated:** December 2025
**Cursor Version:** Latest
**Project:** Maktab Timetable Application
