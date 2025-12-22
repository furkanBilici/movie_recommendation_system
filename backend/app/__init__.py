from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from config import Config

db = SQLAlchemy()
login = LoginManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    db.init_app(app)
    login.init_app(app)
    login.login_view = 'main.login'

    from app.routes import main
    app.register_blueprint(main)
    
    with app.app_context():
        db.create_all()

    return app

from app import models