import os
from flask import Flask, jsonify, request
import requests
from dotenv import load_dotenv
from flask_cors import CORS
import google.generativeai as genai # Gemini kütüphanesini import et


# .env dosyasındaki ortam değişkenlerini yükle
load_dotenv()

app = Flask(__name__)
CORS(app) # CORS'u tüm rotalar için etkinleştir

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") # Gemini API anahtarını al
TMDB_BASE_URL = "https://api.themoviedb.org/3"

# Gemini modelini yapılandır
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro') # Gemini Pro modelini kullanıyoruz
@app.route('/')
def home():
    return "Film Öneri Sistemi Backend'e Hoş Geldiniz!"

@app.route('/api/recommend', methods=['GET'])
def recommend_movies():
    query = request.args.get('query')
    genre_id = request.args.get('genre_id')
    page = request.args.get('page', 1) # Sayfalama için page parametresi ekleyelim (şimdilik varsayılan 1)

    params = {
        'api_key': TMDB_API_KEY,
        'language': 'tr-TR',
        'page': page # Sayfalama parametresini ekle
    }

    if query:
        search_url = f"{TMDB_BASE_URL}/search/movie"
        params['query'] = query
        response = requests.get(search_url, params=params)
        data = response.json()
        movies = data.get('results', [])

    elif genre_id:
        discover_url = f"{TMDB_BASE_URL}/discover/movie"
        params['with_genres'] = genre_id
        params['sort_by'] = 'popularity.desc'
        response = requests.get(discover_url, params=params)
        data = response.json()
        movies = data.get('results', [])
    else:
        popular_url = f"{TMDB_BASE_URL}/movie/popular"
        response = requests.get(popular_url, params=params)
        data = response.json()
        movies = data.get('results', [])

    recommended_movies = []
    for movie in movies:
        recommended_movies.append({
            'id': movie.get('id'),
            'title': movie.get('title'),
            'overview': movie.get('overview'),
            'release_date': movie.get('release_date'),
            'vote_average': movie.get('vote_average'),
            'poster_path': f"https://image.tmdb.org/t/p/w500{movie.get('poster_path')}" if movie.get('poster_path') else None
        })

    return jsonify(recommended_movies)

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
        # Gemini'ya isteği gönder
        # Filmlerle ilgili cevap vermesini ve film isimlerini belirtmesini istiyoruz.
        prompt = (
            f"Kullanıcı film önerileri arıyor. Mesajı: '{user_message}'. "
            "Bu mesajı analiz et ve lütfen sadece filmlerle ilgili bir yanıt ver. "
            "Eğer film adı önerebiliyorsan, önerdiğin filmlerin tam adlarını "
            "her satıra bir film adı gelecek şekilde liste halinde yaz. "
            "Örneğin: \n- Yüzüklerin Efendisi\n- Matrix\nEğer doğrudan film adı önermiyorsan, "
            "kullanıcıya yardımcı olabilecek genel bir mesaj ver."
        )
        response = model.generate_content(prompt)
        gemini_text = response.text

        # Gemini'dan gelen yanıtta film isimlerini ayıklama
        # Burada daha sofistike bir parsing yapılabilir, şimdilik basit liste formatını varsayıyoruz.
        movie_titles = []
        if gemini_text:
            lines = gemini_text.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('- ') or line.startswith('* '): # Liste formatlarını kontrol et
                    movie_title = line[2:].strip()
                    if movie_title:
                        movie_titles.append(movie_title)
                elif line: # Direkt film adı da olabilir
                    movie_titles.append(line)

        recommended_movies_from_tmdb = []
        if movie_titles:
            for title in movie_titles:
                # Her bir film adını TMDb'de arayalım
                search_url = f"{TMDB_BASE_URL}/search/movie"
                params = {
                    'api_key': TMDB_API_KEY,
                    'language': 'tr-TR',
                    'query': title
                }
                tmdb_response = requests.get(search_url, params=params)
                tmdb_data = tmdb_response.json()
                
                if tmdb_data and tmdb_data.get('results'):
                    # En iyi eşleşen filmi al (genellikle ilk sonuç)
                    movie = tmdb_data['results'][0]
                    recommended_movies_from_tmdb.append({
                        'id': movie.get('id'),
                        'title': movie.get('title'),
                        'overview': movie.get('overview'),
                        'release_date': movie.get('release_date'),
                        'vote_average': movie.get('vote_average'),
                        'poster_path': f"https://image.tmdb.org/t/p/w500{movie.get('poster_path')}" if movie.get('poster_path') else None
                    })
            
            if recommended_movies_from_tmdb:
                return jsonify({"recommendations": recommended_movies_from_tmdb, "message": "İşte sizin için film önerileri:"})
            else:
                return jsonify({"recommendations": [], "message": "Üzgünüm, önerilen filmleri TMDb'de bulamadım."})
        else:
            return jsonify({"recommendations": [], "message": gemini_text}) # Gemini'dan gelen genel mesajı döndür

    except Exception as e:
        print(f"Chatbot hatası: {e}")
        return jsonify({"error": "Chatbot ile iletişimde bir sorun oluştu."}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)