from app import db
from app.models import Comment, Rating
from sqlalchemy import func

class CommunityService:
    @staticmethod
    def add_comment(user_id, movie_id, content, parent_id=None):
        comment = Comment(body=content, user_id=user_id, movie_id=movie_id, parent_id=parent_id)
        db.session.add(comment)
        db.session.commit()
        return comment.to_dict()

    @staticmethod
    @staticmethod
    def get_comments(movie_id):
        comments = Comment.query.filter_by(movie_id=movie_id).order_by(Comment.timestamp.desc()).all()
        
        results = []
        for c in comments:
            c_dict = c.to_dict()
            rating = Rating.query.filter_by(user_id=c.user_id, movie_id=movie_id).first()
            
            c_dict['user_score'] = rating.score if rating else 0
            
            results.append(c_dict)
            
        return results

    @staticmethod
    def delete_comment(comment_id, user_id):
        comment = Comment.query.get(comment_id)
        if comment and comment.user_id == user_id:
            db.session.delete(comment)
            db.session.commit()
            return True
        return False

    @staticmethod
    def rate_movie(user_id, movie_id, score):
        rating = Rating.query.filter_by(user_id=user_id, movie_id=movie_id).first()
        if rating:
            rating.score = score
        else:
            rating = Rating(user_id=user_id, movie_id=movie_id, score=score)
            db.session.add(rating)
        db.session.commit()

    @staticmethod
    def get_community_top_rated():
        results = db.session.query(
            Rating.movie_id, func.avg(Rating.score).label('average')
        ).group_by(Rating.movie_id).order_by(func.avg(Rating.score).desc()).limit(20).all()
        
        return [r.movie_id for r in results]