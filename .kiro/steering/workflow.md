# Workflow Preferences

Guidelines for how to collaborate efficiently with this developer.

## Developer Profile

- Experienced with Node.js and React
- Can identify problems clearly and knows what needs fixing
- Prefers to handle file creation and code copying manually when beneficial
- Values stability and predictable behavior over speed

## Collaboration Rules

### DO

- **Ask before large searches**: If a fix requires searching 5+ files, ask which
  files are relevant first
- **Provide code in chat**: For new files or large changes, output the code in
  chat so the developer can copy it manually if preferred
- **Explain the fix**: Brief explanation of what's being changed and why
- **Confirm file paths**: Before creating/modifying files, confirm the target
  path is correct
- **Chunk large changes**: Break big refactors into smaller, reviewable pieces

### DON'T

- **Don't auto-create many files**: Ask first if creating 3+ files at once
- **Don't search blindly**: If unsure which file contains the issue, ask for
  clarification
- **Don't assume file locations**: Confirm paths for new files, especially in
  features/
- **Don't make unrelated changes**: Stay focused on the reported issue

## When to Ask for Context

Ask the developer to provide files when:

- The issue spans multiple features
- The error message doesn't clearly indicate the source
- A component's parent/child relationship is unclear
- The fix might affect shared utilities or hooks

## Preferred Response Format

### For Bug Fixes

```
Problem: [What's wrong]
Cause: [Why it's happening]
Fix: [The solution]

[Code block with the fix]

Files affected: [List]
```

### For New Features

```
Approach: [How we'll implement it]
Files to create/modify: [List with paths]

[Ask for confirmation before proceeding]
```

### For UI/UX Issues

```
Issue identified: [What's wrong visually]
Component: [Which component needs changes]
CSS/Tailwind changes: [Specific classes to add/remove/modify]

[Code block with the fix]
```

## File Creation Preferences

- **Small fixes (1-2 files)**: Agent can write directly
- **New components**: Provide code in chat, let developer create the file
- **New features (3+ files)**: Discuss structure first, then provide code for
  each file separately
- **Config changes**: Always show the diff/change, don't overwrite entire files

## Code Output Preferences

When outputting code:

- Include the full file path as a comment at the top
- Show only the relevant section for modifications (with context lines)
- For new files, show the complete file content
- Use clear markers for where code should be inserted/replaced
