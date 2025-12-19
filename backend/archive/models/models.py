from app import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to reviews
    reviews = db.relationship('Review', backref='user', lazy=True)

    def __repr__(self):
        return f'<User {self.username}>'

class Review(db.Model):
    __tablename__ = 'review_history'

    # Primary Key and Metadata
    id = db.Column(db.Integer, primary_key=True)
    scan_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Key to User
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # Nullable for backward compatibility/MVP
    
    # Product Information
    product_name = db.Column(db.String(255), nullable=False)
    product_id_scraped = db.Column(db.String(100), index=True) 

    # Review Content and Source
    review_content = db.Column(db.Text, nullable=False)
    review_source = db.Column(db.String(50)) 

    # Agent 2 Analysis Results 
    picksy_score = db.Column(db.Float, default=0.0) 
    sentiment_score = db.Column(db.Float, default=0.0) 
    verdict = db.Column(db.String(20), default='Unscored') 
    
    def __repr__(self):
        return f'<Review {self.id} | Score: {self.picksy_score:.2f} for {self.product_name}>'