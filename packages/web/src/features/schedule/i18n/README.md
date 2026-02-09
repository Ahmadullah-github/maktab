# Schedule Feature Translations

This directory contains all translation strings for the schedule feature.

## Structure

```
i18n/
├── index.ts          # Main export with FA and EN translations
└── README.md         # This file
```

## Translation Keys

### Swap Dialog (`swap.dialog.*`)

- **Title variants**: `valid`, `warning`, `invalid`
- **Description variants**: `valid`, `warning`, `invalid`
- **Content**: `summary`, `lessons`, `valid`, `errors`, `warnings`, `affected`

### Swap Table (`swap.table.*`)

- Column headers: `class`, `subject`, `from`, `to`

### Swap Actions (`swap.*`)

- Actions: `executing`, `confirm`, `cancel`

### Swap Blocked Dialog (`swap.blocked.*`)

- Content: `title`, `description`, `alternatives`, `noAlternatives`,
  `tryAlternative`

### Swap Warning Dialog (`swap.warning.*`)

- Content: `title`, `description`, `proceedAnyway`

### Swap Validation Messages (`swap.validation.*`)

- Constraint types:
  - `teacherConflict`
  - `roomConflict`
  - `roomTypeMismatch`
  - `teacherUnavailable`
  - `consecutiveExceeded`
  - `difficultAfternoon`
  - `teacherPreference`
  - `classGapCreated`
  - `teacherGapCreated`

### Swap Success Messages (`swap.success.*`)

- `swapExecuted`, `swapUndone`, `swapRedone`

### Swap Error Messages (`swap.errors.*`)

- `validationFailed`, `executionFailed`, `networkError`, `unknownError`

### Editing Mode (`editing.mode.*`)

- Modes: `readOnly`, `editing`, `locked`

### Editing Actions (`editing.actions.*`)

- Actions: `enableEditing`, `disableEditing`, `undo`, `redo`, `save`, `discard`

### Editing Status (`editing.status.*`)

- Status: `unsavedChanges`, `saved`, `saving`, `noChanges`

### Editing Hints (`editing.hints.*`)

- User hints: `clickToSelect`, `dragToSwap`, `clickTargetToSwap`,
  `escapeToCancel`, `arrowKeysToNavigate`

### Editing Keyboard (`editing.keyboard.*`)

- Keyboard shortcuts: `escape`, `enter`, `arrows`, `ctrlZ`, `ctrlY`, `ctrlS`

### Cell States (`cell.*`)

- States: `empty`, `fixed`, `selected`, `validTarget`, `invalidTarget`,
  `warningTarget`, `dragging`

### Preview (`preview.*`)

- Content: `title`, `source`, `target`, `willMoveTo`, `willMoveFrom`

## Usage

Import translations in components:

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('swap.dialog.title.valid')}</h1>
      <p>{t('swap.dialog.description.valid')}</p>
    </div>
  );
}
```

## Adding New Translations

1. Add the key to both `fa` and `en` objects in `index.ts`
2. Follow the existing naming convention: `feature.section.key`
3. Keep translations concise and user-friendly
4. Update this README with the new keys

## Translation Guidelines

### Persian (Farsi)

- Use formal Persian language
- Right-to-left (RTL) text direction
- Use Persian numerals when appropriate
- Keep technical terms in Persian when possible

### English

- Use clear, concise language
- Follow US English spelling conventions
- Keep technical terms consistent across the app
