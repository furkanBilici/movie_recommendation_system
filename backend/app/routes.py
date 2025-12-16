from flask import Blueprint, jsonify, request
from app.services.tmdb_service import TMDBService
from app.services.ai_service import AIService

main = Blueprint('main', __name__)

@main.route('/')
def home():
    return "Film Öneri Sistemi Backend'e Hoş Geldiniz!"

@main.route('/api/recommend', methods=['GET'])
def recommend_movies():
    query = request.args.get('query')
    genre_id = request.args.get('genre_id')
    page = request.args.get('page', 1)
    filter_type = request.args.get('filter_type', 'popular')
    data = TMDBService.get_movies(query, genre_id, page, filter_type)
    return jsonify(data)

@main.route('/api/genres', methods=['GET'])
def get_genres():
    genres = TMDBService.get_genres()
    return jsonify(genres)

@main.route('/api/chatbot', methods=['POST'])
def chatbot_recommendation():
    user_message = request.json.get('message')
    if not user_message:
        return jsonify({"error": "Mesaj belirtilmedi"}), 400

    movie_titles, bot_message = AIService.get_recommendations(user_message)
    recommended_movies = TMDBService.fetch_movies_parallel(movie_titles)

    if not recommended_movies and bot_message == "İşte senin için seçtiğim filmler:":
        bot_message = "Buna uygun film bulamadım veya veritabanında eşleşmedi."

    return jsonify({
        "recommendations": recommended_movies,
        "message": bot_message
    })