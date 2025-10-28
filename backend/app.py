import os
from flask import Flask, jsonify, request
import requests
from dotenv import load_dotenv
from flask_cors import CORS

# .env içindeki anahtar yukleme
load_dotenv()

app = Flask(__name__)
CORS(app)

# Tmdb ayarları
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"


@app.route('/')
def home():
    return "🎬 Film Öneri Sistemi Backend'e Hoş Geldiniz!"


@app.route('/api/recommend', methods=['GET'])
def recommend_movies():
    """Kullanıcının arama sorgusuna veya türe göre film önerir."""
    query = request.args.get('query')  # Örnegin aksiyon
    genre_id = request.args.get('genre_id')  # Tür idsi

    params = {
        "api_key": TMDB_API_KEY,
        "language": "tr-TR"
    }

    # Eğer kullanıcı arama yaptıysa
    if query:
        url = f"{TMDB_BASE_URL}/search/movie"
        params["query"] = query
    # Eğer kullanıcı tür seçtiyse
    elif genre_id:
        url = f"{TMDB_BASE_URL}/discover/movie"
        params["with_genres"] = genre_id
        params["sort_by"] = "popularity.desc"
    # Hiçbiri yoksa popüler filmleri getir
    else:
        url = f"{TMDB_BASE_URL}/movie/popular"

    # Tmdbden verileri çek
    response = requests.get(url, params=params)
    data = response.json()
    movies = data.get("results", [])

    # Kullanıcıya sade bir liste döndür
    result = []
    for movie in movies:
        result.append({
            "id": movie.get("id"),
            "title": movie.get("title"),
            "overview": movie.get("overview"),
            "release_date": movie.get("release_date"),
            "vote_average": movie.get("vote_average"),
            "poster_path": f"https://image.tmdb.org/t/p/w500{movie.get('poster_path')}" if movie.get("poster_path") else None
        })

    return jsonify(result)


@app.route('/api/genres', methods=['GET'])
def get_genres():
    """Tüm film türlerini döndürür."""
    url = f"{TMDB_BASE_URL}/genre/movie/list"
    params = {
        "api_key": TMDB_API_KEY,
        "language": "tr-TR"
    }

    response = requests.get(url, params=params)
    data = response.json()
    return jsonify(data.get("genres", []))


if __name__ == '__main__':
    app.run(debug=True, port=5000)
