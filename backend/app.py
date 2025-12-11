import os
import json
import requests
import concurrent.futures
from flask import Flask, jsonify, request
from dotenv import load_dotenv
from flask_cors import CORS
import google.generativeai as genai

load_dotenv()

app = Flask(__name__)
CORS(app)

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"

genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel('gemini-2.5-flash')

@app.route('/')
def home():
    return "Film Öneri Sistemi Backend'e Hoş Geldiniz!"


def format_movie_data(movie):
    """TMDB'den gelen ham veriyi frontend için temizler."""
    return {
        'id': movie.get('id'),
        'title': movie.get('title'),
        'overview': movie.get('overview'),
        'release_date': movie.get('release_date'),
        'vote_average': movie.get('vote_average'),
        'poster_path': f"https://image.tmdb.org/t/p/w500{movie.get('poster_path')}" if movie.get('poster_path') else None
    }

def fetch_single_movie(title):
    """Thread içinde tek bir filmi ismen arar."""
    search_url = f"{TMDB_BASE_URL}/search/movie"
    params = {
        'api_key': TMDB_API_KEY,
        'language': 'tr-TR',
        'query': title
    }
    try:
        tmdb_response = requests.get(search_url, params=params)
        tmdb_data = tmdb_response.json()
        if tmdb_data and tmdb_data.get('results'):
            return format_movie_data(tmdb_data['results'][0])
    except Exception as e:
        print(f"Film arama hatası ({title}): {e}")
    return None


@app.route('/api/recommend', methods=['GET'])
def recommend_movies():
    query = request.args.get('query')
    genre_id = request.args.get('genre_id')
    page = request.args.get('page', 1)

    params = {
        'api_key': TMDB_API_KEY,
        'language': 'tr-TR',
        'page': page
    }

    if query:
        search_url = f"{TMDB_BASE_URL}/search/movie"
        params['query'] = query
        response = requests.get(search_url, params=params)
    elif genre_id:
        discover_url = f"{TMDB_BASE_URL}/discover/movie"
        params['with_genres'] = genre_id
        params['sort_by'] = 'popularity.desc'
        response = requests.get(discover_url, params=params)
    else:
        popular_url = f"{TMDB_BASE_URL}/movie/popular"
        response = requests.get(popular_url, params=params)

    data = response.json()
    movies = data.get('results', [])

    formatted_movies = []
    for movie in movies:
        formatted_movies.append(format_movie_data(movie))

    return jsonify(formatted_movies)

@app.route('/api/genres', methods=['GET'])
def get_genres():
    genres_url = f"{TMDB_BASE_URL}/genre/movie/list"
    params = {
        'api_key': TMDB_API_KEY,
        'language': 'tr-TR'
    }
    response = requests.get(genres_url, params=params)
    data = response.json()
    return jsonify(data.get('genres', []))

@app.route('/api/chatbot', methods=['POST'])
def chatbot_recommendation():
    user_message = request.json.get('message')
    if not user_message:
        return jsonify({"error": "Mesaj belirtilmedi"}), 400

    try:
        prompt = (
            f"Kullanıcı bir film asistanıyla konuşuyor. Mesaj: '{user_message}'. "
            "Görevin: Bu mesaja uygun film önerileri bulmak.\n"
            "ÇIKTI FORMATI: Kesinlikle sadece saf bir JSON array (liste) döndür. "
            "Başka hiçbir metin, açıklama veya markdown (```json gibi) ekleme.\n"
            "Örnek: ['The Matrix', 'Inception', 'Interstellar']\n"
            "Eğer kullanıcı film sormuyorsa veya öneri yoksa boş liste [] döndür."
        )

        response = model.generate_content(prompt)
        
        gemini_text = response.text

        clean_text = gemini_text.replace("```json", "").replace("```", "").strip()
        
        movie_titles = []
        bot_message = "İşte senin için seçtiğim filmler:"

        try:
            movie_titles = json.loads(clean_text)
        except (json.JSONDecodeError, TypeError):
            movie_titles = []
            bot_message = "Şu an tam olarak film listesi çıkaramadım ama sohbet edebiliriz."

        recommended_movies_from_tmdb = []

        if movie_titles:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                results = executor.map(fetch_single_movie, movie_titles)
                recommended_movies_from_tmdb = [res for res in results if res is not None]

        if not recommended_movies_from_tmdb:
             if bot_message == "İşte senin için seçtiğim filmler:":
                 bot_message = "Buna uygun film bulamadım veya veritabanında eşleşmedi."

        return jsonify({
            "recommendations": recommended_movies_from_tmdb,
            "message": bot_message
        })

    except Exception as e:
        print(f"Chatbot genel hatası: {e}")
        return jsonify({"error": "Yapay zeka servisi şu an yanıt veremiyor."}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)