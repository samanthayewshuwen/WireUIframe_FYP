from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.generate_code import router as generate_code_router
from routes.storyboard import router as storyboard_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_code_router)
app.include_router(storyboard_router)

@app.get("/")
async def root():
    return {"message": "Backend is running"}