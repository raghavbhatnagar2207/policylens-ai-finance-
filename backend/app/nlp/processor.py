"""Complaint NLP processor.

Implements language detection, category classification, sentiment analysis,
and urgency scoring using keyword/pattern-based heuristics.  Each result
includes a confidence score.  The module is deliberately isolated so it
can be replaced with a stronger model (e.g. a fine-tuned transformer) later.
"""

import re
from collections import Counter

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

DEVANAGARI_RANGE = re.compile(r'[\u0900-\u097F]')
ENGLISH_COMMON = {'the', 'is', 'in', 'to', 'of', 'and', 'for', 'not', 'this', 'with', 'my', 'has', 'been'}

def detect_language(text):
    words = text.lower().split()
    devanagari_chars = len(DEVANAGARI_RANGE.findall(text))
    total_chars = max(len(text.replace(' ', '')), 1)
    devanagari_ratio = devanagari_chars / total_chars

    english_hits = sum(1 for w in words if w in ENGLISH_COMMON)
    english_ratio = english_hits / max(len(words), 1)

    if devanagari_ratio > 0.5:
        return 'Hindi', min(0.6 + devanagari_ratio * 0.3, 0.95)
    elif devanagari_ratio > 0.1 and english_ratio > 0.1:
        return 'Hinglish', 0.55 + min(devanagari_ratio, 0.3)
    else:
        return 'English', 0.7 + min(english_ratio * 0.3, 0.25)


# ---------------------------------------------------------------------------
# Category classification
# ---------------------------------------------------------------------------

CATEGORY_KEYWORDS = {
    'Payment Delay': ['delay', 'late', 'pending', 'overdue', 'waiting', 'time', 'slow',
                      'देरी', 'लेट', 'रुका', 'रुकी'],
    'Fund Misallocation': ['allocation', 'misuse', 'wrong', 'incorrect', 'diverted',
                           'गलत', 'गबन'],
    'Documentation': ['document', 'paper', 'proof', 'certificate', 'receipt', 'missing',
                      'कागज', 'दस्तावेज'],
    'Service Quality': ['quality', 'poor', 'bad', 'worse', 'complaint', 'unsatisfied',
                        'खराब', 'बुरा'],
    'Transparency': ['transparency', 'hidden', 'secret', 'unclear', 'information',
                     'जानकारी', 'पारदर्शिता'],
}


def classify_category(text):
    lower = text.lower()
    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in lower)
        if hits > 0:
            scores[cat] = hits

    if not scores:
        return 'General', 0.3

    best = max(scores, key=scores.get)
    confidence = min(0.4 + scores[best] * 0.15, 0.90)
    return best, round(confidence, 2)


# ---------------------------------------------------------------------------
# Sentiment
# ---------------------------------------------------------------------------

NEGATIVE_WORDS = [
    'delay', 'late', 'problem', 'issue', 'wrong', 'bad', 'poor', 'fail',
    'worst', 'terrible', 'corrupt', 'fraud', 'cheat', 'unfair', 'denied',
    'नहीं', 'बुरा', 'खराब', 'गलत', 'समस्या', 'परेशान',
]
POSITIVE_WORDS = [
    'good', 'great', 'thank', 'resolved', 'happy', 'excellent', 'satisfied',
    'अच्छा', 'धन्यवाद',
]


def analyse_sentiment(text):
    lower = text.lower()
    neg = sum(1 for w in NEGATIVE_WORDS if w in lower)
    pos = sum(1 for w in POSITIVE_WORDS if w in lower)

    if neg > pos:
        sentiment = 'Negative'
        confidence = min(0.5 + neg * 0.1, 0.85)
    elif pos > neg:
        sentiment = 'Positive'
        confidence = min(0.5 + pos * 0.1, 0.85)
    else:
        sentiment = 'Neutral'
        confidence = 0.45

    return sentiment, round(confidence, 2)


# ---------------------------------------------------------------------------
# Urgency
# ---------------------------------------------------------------------------

URGENCY_HIGH_WORDS = [
    'urgent', 'immediate', 'emergency', 'critical', 'asap', 'now',
    'तुरंत', 'जल्दी', 'बहुत', 'आपातकाल',
]
URGENCY_MEDIUM_WORDS = [
    'soon', 'quick', 'important', 'needed', 'attention', 'request',
    'जरूरी', 'ध्यान',
]


def assess_urgency(text):
    lower = text.lower()
    high_hits = sum(1 for w in URGENCY_HIGH_WORDS if w in lower)
    med_hits = sum(1 for w in URGENCY_MEDIUM_WORDS if w in lower)

    if high_hits >= 1:
        return 'High', min(0.5 + high_hits * 0.15, 0.90)
    elif med_hits >= 1:
        return 'Medium', min(0.45 + med_hits * 0.1, 0.75)
    else:
        return 'Low', 0.45


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyse(text):
    """Analyse complaint text and return structured NLP results.

    Returns a dict with language, category, sentiment, urgency, priority,
    and per-signal confidence.
    """
    if not text or not text.strip():
        return {
            'language': 'Unknown',
            'category': 'General',
            'sentiment': 'Neutral',
            'urgency': 'Low',
            'priority': 'Low',
            'confidence': 0.0,
            'details': {},
        }

    lang, lang_conf = detect_language(text)
    cat, cat_conf = classify_category(text)
    sent, sent_conf = analyse_sentiment(text)
    urg, urg_conf = assess_urgency(text)

    # Priority = max(urgency, sentiment-driven boost)
    priority_map = {'High': 3, 'Medium': 2, 'Low': 1}
    priority_score = priority_map.get(urg, 1)
    if sent == 'Negative':
        priority_score = max(priority_score, 2)

    priority = {3: 'High', 2: 'Medium', 1: 'Low'}.get(priority_score, 'Medium')

    overall_confidence = round((lang_conf + cat_conf + sent_conf + urg_conf) / 4, 2)

    return {
        'language': lang,
        'category': cat,
        'sentiment': sent,
        'urgency': urg,
        'priority': priority,
        'confidence': overall_confidence,
        'details': {
            'language_confidence': lang_conf,
            'category_confidence': cat_conf,
            'sentiment_confidence': sent_conf,
            'urgency_confidence': urg_conf,
        },
    }
