import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    TMDB_API_KEY = os.getenv("TMDB_API_KEY")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    TMDB_BASE_URL = "https://api.themoviedb.org/3"
    DEBUG = True