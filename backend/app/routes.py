from flask import Blueprint, jsonify, request
from flask_login import current_user, login_user, logout_user, login_required
from app import db
from app.models import User
from app.services.tmdb_service import TMDBService
from app.services.ai_service import AIService
from app.services.community_service import CommunityService
import concurrent.futures

main = Blueprint('main', __name__)

@main.route('/')
def home():
    return "Film Topluluğu Backend'e Hoş Geldiniz!"

@main.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Bu kullanıcı adı zaten alınmış.'}), 400
    
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'Kayıt başarılı! Giriş yapabilirsiniz.'})

@main.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user is None or not user.check_password(data['password']):
        return jsonify({'error': 'Geçersiz kullanıcı adı veya şifre'}), 401
    
    login_user(user, remember=True)
    return jsonify({'username': user.username, 'id': user.id})

@main.route('/api/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'message': 'Çıkış yapıldı'})

@main.route('/api/current_user', methods=['GET'])
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({'username': current_user.username, 'id': current_user.id})
    return jsonify({'username': None})

@main.route('/api/recommend', methods=['GET'])
def recommend_movies():
    query = request.args.get('query')
    genre_id = request.args.get('genre_id')
    page = request.args.get('page', 1)
    filter_type = request.args.get('filter_type', 'popular')
    
    if filter_type == 'community_top':
        # 1. Veritabanından en yüksek puanlı ID'leri çek
        movie_ids = CommunityService.get_community_top_rated()
        
        # 2. Eğer hiç oy verilmemişse boş dön
        if not movie_ids:
            return jsonify({"results": [], "total_pages": 0})

        # 3. ID'leri kullanarak paralel şekilde TMDB'den detayları çek
        results = []
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Dikkat: Burada fetch_single_movie DEĞİL, fetch_movie_by_id kullanıyoruz
            futures = executor.map(TMDBService.fetch_movie_by_id, movie_ids)
            results = [f for f in futures if f is not None]

        data = {"results": results, "total_pages": 1}
    else:
        data = TMDBService.get_movies(query, genre_id, page, filter_type)
    
    return jsonify(data)

@main.route('/api/comments/<int:movie_id>', methods=['GET'])
def get_comments(movie_id):
    comments = CommunityService.get_comments(movie_id)
    return jsonify(comments)

@main.route('/api/comments', methods=['POST'])
@login_required
def add_comment():
    data = request.json
    comment = CommunityService.add_comment(current_user.id, data['movie_id'], data['content'])
    return jsonify(comment)

@main.route('/api/comments/<int:comment_id>', methods=['DELETE'])
@login_required
def delete_comment(comment_id):
    success = CommunityService.delete_comment(comment_id, current_user.id)
    if success:
        return jsonify({'message': 'Yorum silindi'})
    return jsonify({'error': 'Yetkisiz işlem'}), 403

@main.route('/api/rate', methods=['POST'])
@login_required
def rate_movie():
    data = request.json
    CommunityService.rate_movie(current_user.id, data['movie_id'], data['score'])
    return jsonify({'message': 'Puan kaydedildi'})

@main.route('/api/genres', methods=['GET'])
def get_genres():
    return jsonify(TMDBService.get_genres())

@main.route('/api/chatbot', methods=['POST'])
def chatbot_recommendation():
    user_message = request.json.get('message')
    movie_titles, bot_message = AIService.get_recommendations(user_message)
    recommended_movies = TMDBService.fetch_movies_parallel(movie_titles)
    return jsonify({"recommendations": recommended_movies, "message": bot_message})