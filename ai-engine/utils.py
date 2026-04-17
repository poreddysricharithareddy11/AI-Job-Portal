import os

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def safe_delete(path):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"[WARN] File delete failed: {e}")
