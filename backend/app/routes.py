from flask import Blueprint, jsonify, request
from flask_login import current_user, login_user, logout_user, login_required
from app import db
from app.models import User
from app.services.tmdb_service import TMDBService
from app.services.ai_service import AIService
from app.services.community_service import CommunityService
import concurrent.futures
from email_validator import validate_email, EmailNotValidError
from app.models import User, Comment, Rating

main = Blueprint('main', __name__)

@main.route('/')
def home():
    return "Film Topluluğu Backend'e Hoş Geldiniz!"

@main.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email', '').strip() 
    username = data.get('username', '').strip()
    password = data.get('password', '')

   
    if not username or not email or not password:
        return jsonify({'error': 'Tüm alanları doldurmalısınız.'}), 400

    try:
        v = validate_email(email, check_deliverability=True)
        email = v.normalized 
    except EmailNotValidError as e:
        return jsonify({'error': f'Geçersiz e-posta adresi. Lütfen kontrol edin.'}), 400

    banned_words = ['bok']
    
    if any(word in email.lower() for word in banned_words):
         return jsonify({'error': 'Bu e-posta adresi politikalarımıza uygun değildir.'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Bu kullanıcı adı zaten alınmış.'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Bu e-posta adresi zaten kayıtlı.'}), 400
    
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'Kayıt başarılı! Giriş yapabilirsiniz.'})

@main.route('/api/login', methods=['POST'])
@main.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user is None or not user.check_password(data['password']):
        return jsonify({'error': 'Geçersiz kullanıcı adı veya şifre'}), 401
    
    login_user(user, remember=True)
    return jsonify({'username': user.username, 'id': user.id, 'is_admin': user.is_admin})

@main.route('/api/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'message': 'Çıkış yapıldı'})

@main.route('/api/current_user', methods=['GET'])
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({
            'username': current_user.username, 
            'id': current_user.id,
            'is_admin': current_user.is_admin 
        })
    return jsonify({'username': None})

@main.route('/api/recommend', methods=['GET'])
def recommend_movies():
    query = request.args.get('query')
    genre_id = request.args.get('genre_id')
    page = request.args.get('page', 1)
    filter_type = request.args.get('filter_type', 'popular')
    
    if filter_type == 'community_top':
      
        movie_ids = CommunityService.get_community_top_rated()
     
        if not movie_ids:
            return jsonify({"results": [], "total_pages": 0})

        results = []
        with concurrent.futures.ThreadPoolExecutor() as executor:
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
@main.route('/api/comments/<int:movie_id>', methods=['POST']) # Flutter'ın attığı URL'yi de kabul et
def add_comment(movie_id=None):
    data = request.json
    
    # 1. Verileri topla (İster web'den gelsin ister mobilden)
    actual_movie_id = movie_id or data.get('movie_id')
    content = data.get('body') or data.get('content') # Flutter 'body' yolluyor, Web 'content'
    mobile_username = data.get('username')

    # 2. Kullanıcıyı bul
    user = None
    if mobile_username:
        user = User.query.filter_by(username=mobile_username).first() # Mobilden geldiyse
    elif current_user.is_authenticated:
        user = current_user # Web'den geldiyse

    # 3. Güvenlik Kontrolü (@login_required sildiğimiz için manuel yapıyoruz)
    if not user:
        return jsonify({'error': 'Yorum yapmak için giriş yapmalısınız'}), 401

    # 4. Senin mevcut CommunityService yapını bozmadan kaydediyoruz
    comment = CommunityService.add_comment(user.id, actual_movie_id, content)
    return jsonify(comment)

@main.route('/api/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    # Mobilden DELETE isteğinde JSON gövdesi gelebilir
    data = request.get_json(silent=True) or {}
    mobile_username = data.get('username')
    
    user = None
    if mobile_username:
        user = User.query.filter_by(username=mobile_username).first()
    elif current_user.is_authenticated:
        user = current_user

    if not user:
        return jsonify({'error': 'Yetkisiz işlem'}), 401

    success = CommunityService.delete_comment(comment_id, user.id)
    if success:
        return jsonify({'message': 'Yorum silindi'})
    return jsonify({'error': 'Yetkisiz işlem veya yorum bulunamadı'}), 403


@main.route('/api/rate', methods=['POST'])
def rate_movie():
    data = request.json
    mobile_username = data.get('username')
    
    user = None
    if mobile_username:
        user = User.query.filter_by(username=mobile_username).first()
    elif current_user.is_authenticated:
        user = current_user

    if not user:
        return jsonify({'error': 'Puan vermek için giriş yapmalısınız'}), 401

    CommunityService.rate_movie(user.id, data['movie_id'], data['score'])
    return jsonify({'message': 'Puan kaydedildi'})
@main.route('/api/genres', methods=['GET'])
def get_genres():
    return jsonify(TMDBService.get_genres())

@main.route('/api/chatbot', methods=['POST'])
def chatbot_recommendation():
    user_message = request.json.get('message')
    movie_titles, bot_message = AIService.get_recommendations(user_message)
    recommended_movies = TMDBService.fetch_movies_parallel(movie_titles)
    return jsonify({"recommendations": recommended_movies, "message": bot_message})# --- ADMIN ROUTES ---
# --- ADMIN ROUTES (MOBİL UYUMLU) ---

@main.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    username = request.args.get('username')
    user = User.query.filter_by(username=username).first() if username else current_user
    
    if not user or not getattr(user, 'is_admin', False):
        return jsonify({'error': 'Yetkisiz erişim'}), 403
    
    user_count = User.query.count()
    comment_count = Comment.query.count()
    comments = Comment.query.order_by(Comment.timestamp.desc()).limit(50).all()
    
    return jsonify({
        'user_count': user_count,
        'comment_count': comment_count,
        'recent_comments': [{'id': c.id, 'body': c.body, 'movie_id': c.movie_id, 'author': c.user.username} for c in comments],
        'all_users': [{'id': u.id, 'username': u.username, 'email': u.email} for u in User.query.all()]
    })

@main.route('/api/admin/delete_comment/<int:comment_id>', methods=['DELETE'])
def admin_delete_comment(comment_id):
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    user = User.query.filter_by(username=username).first() if username else current_user
    
    if not user or not getattr(user, 'is_admin', False):
        return jsonify({'error': 'Yetkisiz erişim'}), 403
        
    comment = Comment.query.get(comment_id)
    if comment:
        db.session.delete(comment)
        db.session.commit()
        return jsonify({'message': 'Yorum yönetici tarafından silindi.'})
    return jsonify({'error': 'Yorum bulunamadı'}), 404

@main.route('/api/admin/delete_user/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    user = User.query.filter_by(username=username).first() if username else current_user
    
    if not user or not getattr(user, 'is_admin', False):
        return jsonify({'error': 'Yetkisiz erişim'}), 403
    
    if user_id == user.id:
        return jsonify({'error': 'Kendinizi silemezsiniz!'}), 400

    user_to_delete = User.query.get(user_id)
    if user_to_delete:
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({'message': 'Kullanıcı silindi.'})
    return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
# --- KULLANICI PROFİLİ İŞLEMLERİ ---

@main.route('/api/profile/comments', methods=['POST'])
def get_user_comments():
    # Mobilden çerez gelmediği için POST ile username alıyoruz
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    
    if not user:
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
        
    comments = Comment.query.filter_by(user_id=user.id).order_by(Comment.timestamp.desc()).all()
    
    result = []
    for c in comments:
        result.append({
            'id': c.id,
            'movie_id': c.movie_id,
            'body': c.body,
            # Eğer modelinde timestamp string değilse hata vermesin diye:
            'timestamp': str(c.timestamp)[:16] if c.timestamp else 'Bilinmeyen Tarih'
        })
    return jsonify(result)

@main.route('/api/profile/update', methods=['PUT'])
def update_profile():
    data = request.json
    user = User.query.filter_by(username=data.get('current_username')).first()
    
    if not user:
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
        
    new_username = data.get('new_username', '').strip()
    new_password = data.get('new_password', '').strip()
    
    # Kullanıcı adı değişmişse ve boş değilse
    if new_username and new_username != user.username:
        if User.query.filter_by(username=new_username).first():
            return jsonify({'error': 'Bu kullanıcı adı zaten alınmış.'}), 400
        user.username = new_username
        
    # Şifre girilmişse güncelle
    if len(new_password) > 0:
        user.set_password(new_password)
        
    db.session.commit()
    return jsonify({'message': 'Profil başarıyla güncellendi.', 'new_username': user.username})