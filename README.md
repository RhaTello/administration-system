# Systema

Full-stack application with React + Vite frontend and Python + FastAPI backend.

## Structure

```
Systema/
├── frontend/        # React + Vite
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/         # Python + FastAPI
│   ├── app/
│   │   └── routers/
│   │       └── health.py
│   ├── main.py
│   └── requirements.txt
└── .gitignore
```

## Getting started

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
python main.py
```

API running at <http://localhost:8000> — docs at <http://localhost:8000/docs>

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App running at <http://localhost:5173>
