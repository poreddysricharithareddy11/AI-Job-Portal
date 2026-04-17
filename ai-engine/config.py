import os
import torch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB

# Optimized for your specific model choice
MODEL_NAME = "all-MiniLM-L6-v2"
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'