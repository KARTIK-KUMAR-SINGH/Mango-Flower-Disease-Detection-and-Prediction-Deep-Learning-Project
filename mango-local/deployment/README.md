# Mango flower disease app (local)

deployment/
  model/         <- put mango_disease_model.keras + mango_disease_metadata.pkl here
  app/backend/   FastAPI + TensorFlow
  app/frontend/  React (Vite)

Terminal 1 - backend
    cd app/backend
    python -m venv .venv
    .venv\Scripts\activate          (Mac/Linux: source .venv/bin/activate)
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
    Check http://localhost:8000/health

Terminal 2 - frontend
    cd app/frontend
    npm install
    npm run dev
    Open http://localhost:5173
