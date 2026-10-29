
# LoanEase – Automated Loan Pre-Screening System

LoanEase is a full-stack web application designed to simplify the initial loan screening process for financial institutions. It collects applicant information, evaluates basic eligibility, calculates estimated EMIs, and provides explainable screening recommendations.


## Problem Statement

Loan officers spend considerable time reviewing loan applications, checking missing information, and performing basic eligibility calculations before underwriting.

LoanEase aims to streamline this initial screening process through a centralized application form, configurable eligibility rules, automated financial calculations, and an application review dashboard.

## Key Features

- **Loan Application Form:** Captures applicant details and validates information before submission.
- **Automated Eligibility Screening:** Checks applications against configured eligibility rules.
- **EMI Calculation:** Calculates estimated monthly loan installments.
- **Financial Risk Calculation:** Calculates debt service ratio using income and EMI details.
- **Explainable Recommendations:** Provides human-readable screening explanations.
- **Loan Officer Dashboard:** Supports application review, filtering, sorting, and status updates.
- **What-If Simulation:** Allows alternative loan terms to be evaluated without changing the original application.
- **Notifications and Authentication:** Includes authentication endpoints and notification records.
- **AI Policy Assistant:** Includes an assistant component for loan-related questions.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Data Validation | Pydantic |
| ORM | SQLAlchemy |
| Database | SQLite |
| API Communication | Axios |
| API Documentation | Swagger UI / OpenAPI |
| Version Control | Git and GitHub |

## System Architecture

```text
React Frontend
      |
      v
FastAPI REST API
      |
      v
Eligibility Rules and Financial Scoring
      |
      v
Explainability and What-If Simulation
      |
      v
SQLAlchemy ORM
      |
      v
SQLite Database
```

## Application Workflow

1. Applicant enters personal and financial details.
2. The frontend validates the information.
3. The application is submitted to the FastAPI backend.
4. The backend checks configured eligibility rules.
5. The system calculates estimated EMI and debt service ratio.
6. A screening recommendation and explanation are generated.
7. Application information is stored in SQLite.
8. Loan officers can review applications and update their status.

## Getting Started

### Prerequisites

- Python 3.12 or compatible version
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/ShivaniPimpalshende/LoanEase.git
cd LoanEase
```

### 2. Set Up the Backend

Create a virtual environment:

```powershell
python -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r backend/requirements.txt
```

Start the backend:

```powershell
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend URL: http://127.0.0.1:8000

API documentation: http://127.0.0.1:8000/docs

### 3. Set Up the Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL displayed in the terminal, usually:

http://localhost:5173

## Database

LoanEase uses SQLite for local development and SQLAlchemy for database interaction.

Local database files and environment variables should not be committed to the repository.





[LoanEase – GitHub](https://github.com/ShivaniPimpalshende/LoanEase)
