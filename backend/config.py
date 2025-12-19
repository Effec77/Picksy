import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class AppConfig:
    """
    Centralized configuration for Picksy Backend.
    """
    # Base Directory
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # API Keys
    GROQ_API_KEY = os.getenv('GROQ_API_KEY')
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') # Keeping for fallback if needed, or remove later
    REDDIT_CLIENT_ID = os.getenv('REDDIT_CLIENT_ID')
    REDDIT_CLIENT_SECRET = os.getenv('REDDIT_CLIENT_SECRET')

    # Paths
    # Using a relative path for the vector DB to ensure portability
    CHROMA_DB_PATH = os.path.join(BASE_DIR, 'chroma_db')
    
    # Validation
    @classmethod
    def validate(cls):
        missing = []
        if not cls.GROQ_API_KEY:
            missing.append("GROQ_API_KEY")
        
        if missing:
            print(f"⚠️ Warning: Missing configuration variables: {', '.join(missing)}")
            return False
        return True

# Ensure DB directory exists
if not os.path.exists(AppConfig.CHROMA_DB_PATH):
    try:
        os.makedirs(AppConfig.CHROMA_DB_PATH)
        print(f"📁 Created Database Directory: {AppConfig.CHROMA_DB_PATH}")
    except OSError as e:
        print(f"❌ Failed to create Database Directory: {e}")
