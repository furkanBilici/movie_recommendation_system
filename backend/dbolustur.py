from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    db.drop_all() # Eskileri sil
    db.create_all() # Yenileri oluştur
    
    # --- İLK ADMİNİ OLUŞTUR ---
    admin = User(username='admin', email='admin@movieapp.com', is_admin=True)
    admin.set_password('admin123') # Şifre: admin123
    db.session.add(admin)
    
    db.session.commit()
    print("✅ Tablolar oluşturuldu ve 'admin' kullanıcısı eklendi!")