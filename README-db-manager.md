# Database Manager Script

A comprehensive Node.js script for managing your SQLite database with various operations.

## Features

- **Interactive Mode**: Run commands interactively
- **Command Line Mode**: Execute single commands
- **Database Overview**: View all tables and row counts
- **Data Viewing**: View table data with customizable limits
- **Data Deletion**: Delete data from specific tables or all tables
- **Custom SQL**: Execute any SQL command
- **Schema Inspection**: View table schemas and structure

## Installation

1. Install the required dependency:
```bash
npm install better-sqlite3
```

Or copy the package.json and run:
```bash
cp db-manager-package.json package.json
npm install
```

## Usage

### Interactive Mode (Recommended)
```bash
node db-manager.js
```

This will start an interactive session where you can run commands.

### Command Line Mode
```bash
# Show database overview
node db-manager.js overview

# List all tables
node db-manager.js tables

# Delete all data from all tables
node db-manager.js delete-all

# Execute custom SQL
node db-manager.js sql "SELECT * FROM teachers LIMIT 5"
```

## Available Commands (Interactive Mode)

- `overview` - Show database overview with all tables and row counts
- `tables` - List all tables with row counts
- `schema <table>` - Show detailed schema for a specific table
- `view <table> [limit]` - View data from a table (default limit: 10)
- `count <table>` - Count rows in a specific table
- `delete <table>` - Delete all data from a specific table
- `delete-all` - Delete all data from all tables (with confirmation)
- `reset-ai` - Reset auto-increment counters
- `sql <query>` - Execute custom SQL command
- `help` - Show available commands
- `exit` or `quit` - Exit the program

## Examples

### View all teachers
```
> view teachers
```

### View first 20 subjects
```
> view subjects 20
```

### Count rooms
```
> count rooms
```

### Delete all timetables
```
> delete timetables
```

### Execute custom SQL
```
> sql SELECT t.fullName, s.name as subject FROM teachers t JOIN subjects s ON t.primarySubjectIds LIKE '%' || s.id || '%'
```

### Show table schema
```
> schema teachers
```

## Database Structure

The script works with the following tables:
- `timetable` - Generated timetables
- `teacher` - Teacher information and preferences
- `subject` - Subject definitions
- `room` - Room information
- `class_group` - Class group definitions
- `configuration` - System configuration
- `wizard_step` - Wizard step data

## Safety Features

- Confirmation prompts for destructive operations
- Error handling for invalid SQL commands
- Safe parameter binding to prevent SQL injection
- Graceful error messages

## File Location

The script automatically looks for the database at `./packages/api/timetable.db`. If your database is in a different location, you can modify the `dbPath` in the script or run it from the correct directory.
