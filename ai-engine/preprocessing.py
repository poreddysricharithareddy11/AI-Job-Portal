"""
Text preprocessing for resume and job descriptions: cleaning, stopword removal, lemmatization.
"""
import re

# Try NLTK for lemmatization; fallback to simple normalization
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.stem import WordNetLemmatizer
    try:
        stopwords.words("english")
    except LookupError:
        nltk.download("stopwords", quiet=True)
    try:
        WordNetLemmatizer().lemmatize("running")
    except LookupError:
        nltk.download("wordnet", quiet=True)
    _stop = set(stopwords.words("english"))
    _lemmatizer = WordNetLemmatizer()
    _use_nltk = True
except Exception:
    _use_nltk = False
    _stop = {
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
        "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had",
        "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
        "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
        "its", "his", "her", "their", "my", "your", "our",
    }


def clean(text):
    """Normalize whitespace and lowercase."""
    if not text or not isinstance(text, str):
        return ""
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def remove_stopwords(tokens):
    """Remove stopwords from a list of tokens."""
    return [t for t in tokens if t and t not in _stop]


def lemmatize(word):
    """Lemmatize a single word."""
    if not _use_nltk:
        return word
    try:
        # Default WordNet lemmatization behaves like noun lemmatization (pos=None),
        # which is generally safer for skill terms than verb-only lemmatization.
        return _lemmatizer.lemmatize(word) or word
    except Exception:
        return word


def tokenize(text):
    """Tokenize: alphanumeric + hyphen words."""
    if not text:
        return []
    # Keep common skill punctuation so overlaps work for tokens like:
    # - "node.js", "c++", "c#", ".net"
    # Later steps (whitelist filtering) take care of which tokens count as skills.
    return re.findall(r"[a-z0-9]+(?:[#+\.\-][a-z0-9]+)*", clean(text))


def preprocess_for_similarity(text):
    """Clean, tokenize, remove stopwords, lemmatize. Returns string for embedding/TF-IDF."""
    if not text:
        return ""
    tokens = tokenize(text)
    tokens = remove_stopwords(tokens)
    tokens = [lemmatize(t) for t in tokens]
    return " ".join(tokens)


def preprocess_for_extraction(text):
    """Light clean only (preserve casing and structure for regex extraction)."""
    if not text or not isinstance(text, str):
        return ""
    return re.sub(r"\s+", " ", text).strip()
