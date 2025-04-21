# Workflow Automation Service

A service that allows users to define and trigger simple workflow automations using natural language input. Built for Gently's take-home assignment.

## Features

- Create workflows with natural language descriptions
- Automatic trigger and step extraction
- Sequential step execution
- API for workflow management and execution monitoring
- Mock integrations for email, Slack, and HTTP requests

## Tech Stack

- TypeScript
- Node.js
- Express
- PostgreSQL
- Anthropic Claude API

## Prerequisites

- Node.js (v16+)
- npm
- PostgreSQL (v13+)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/workflow-automation.git
cd workflow-automation
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL Database

#### Install PostgreSQL

**On macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Create the Database

Connect to PostgreSQL as the default postgres user:

**On macOS/Linux:**
```bash
psql postgres
```


Once connected to the PostgreSQL prompt, create the database:

```sql
-- Create the database
CREATE DATABASE workflow_automation;

-- Create a user (optional, you can use the default postgres user)
CREATE USER workflow_user WITH ENCRYPTED PASSWORD 'workflow_automation_pass';

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE workflow_automation TO workflow_user;

-- Exit
\q
```

### 4. Configure Environment Variables

Create a `.env` file based on the example:

```bash
cp .env.example .env
```

Update the values in `.env` with your PostgreSQL and Anthropic API credentials:

```
# Server
PORT=3000
NODE_ENV=development

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres  # or workflow_user if you created a new user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=workflow_automation

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-api...
```

### 5. Run Database Migrations

```bash
psql -h localhost -p 5432 -U your_username -d workflow_automation -f ./migrations/initial.sql
```

### 6. Build and Start the Server

Development mode with hot-reloading:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Workflows

- `POST /api/workflows` - Create a new workflow
- `GET /api/workflows` - List all workflows

### Executions

- `GET /api/workflows/:id/runs` - Get execution history for a workflow
- `GET /api/runs/:runId` - Get details of a specific run
- `POST /api/runs/:runId/retry` - Retry a failed workflow run
- `POST /api/trigger/:triggerType/:triggerValue` - Manually trigger a workflow

## Design Decisions

### Architecture

The service is built with a clear separation of concerns:

1. **API Layer** - Handles HTTP requests and responses
2. **Service Layer** - Contains business logic for workflow management and execution
3. **Database Layer** - Persistence of workflows and execution history
4. **Integration Layer** - Mock integrations for external services

### Natural Language Processing

Claude API is used to extract structured workflow definitions from natural language descriptions. This approach provides flexibility while maintaining a structured representation for execution.

### Execution Engine

The execution engine follows a simple sequential pattern, where:

1. Workflows are triggered based on defined trigger conditions
2. Steps are executed in order with proper error handling
3. Output from previous steps can be used in subsequent steps
4. Execution status and results are tracked in the database

### Mock Integrations

For this assessment, integrations (email, Slack, etc.) are mocked by logging what would be sent rather than making actual API calls. This demonstrates the structure without requiring actual external services.

## Running Tests

```bash
npm test
```

## Future Improvements

- Add authentication and user management
- Implement more robust trigger mechanisms (webhooks, scheduled events)
- Support conditional logic in workflows
- Add parallel execution paths
- Build a simple frontend UI for workflow management
- Implement proper retry mechanisms with exponential backoff# workflow-automation