"""
SpendSmart - Step 2: AI Expense Categorizer (improved)

Run:  python categorizer.py
Needs: pip install scikit-learn
"""
import re
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

training_data = {
    "Food": [
        "groceries at D-Mart", "grocery shopping vegetables", "lunch at hotel",
        "dinner restaurant biryani", "chai and samosa", "coffee at cafe",
        "milk and bread", "swiggy food order", "zomato delivery pizza",
        "hotel breakfast", "fruits and vegetables market", "snacks canteen",
        "vada pav", "ice cream", "tea stall", "bigbasket groceries",
        "dominos pizza", "mess fees food", "juice and sandwich", "dmart monthly groceries",
    ],
    "Travel": [
        "bus ticket to Kolhapur", "auto fare to station", "train ticket reservation",
        "petrol for bike", "uber cab ride", "ola ride to mall",
        "flight ticket booking", "taxi to airport", "local bus pass",
        "rickshaw fare", "auto rickshaw to college", "metro card recharge",
        "diesel for car", "toll plaza fee", "irctc train booking",
        "rapido bike taxi", "parking charges", "redbus ticket",
    ],
    "Bills": [
        "electricity bill payment", "mobile recharge jio", "wifi internet bill",
        "water bill", "gas cylinder booking", "rent payment flat",
        "phone postpaid bill", "broadband plan recharge", "airtel recharge",
        "light bill", "dth recharge", "maintenance charges society",
        "house rent", "mseb bill",
    ],
    "Shopping": [
        "new shirt from mall", "amazon order headphones", "flipkart sale shoes",
        "clothes shopping", "mobile cover purchase", "gift for friend",
        "kurti shopping online", "sneakers from store", "new shoes",
        "jeans and tshirt", "myntra order", "watch purchase",
        "bag from shop", "earphones online order",
    ],
    "Fun": [
        "movie ticket", "netflix subscription", "video game purchase",
        "concert ticket", "cricket match tickets", "gaming subscription",
        "amusement park entry", "pubg game skin", "movie with friends",
        "spotify premium", "bowling and arcade", "hotstar subscription",
        "party with friends", "bookmyshow tickets", "outing picnic",
    ],
    "Health": [
        "medicine from pharmacy", "doctor consultation fee", "gym membership",
        "hospital lab test", "protein powder", "dental checkup",
        "health insurance premium", "yoga class fee", "doctor visit",
        "blood test", "clinic fees", "vitamin tablets", "eye checkup glasses",
    ],
    "Education": [
        "udemy course purchase", "college exam fees", "notebooks and stationery",
        "coursera subscription", "textbook for semester", "online certification fee",
        "coaching class fees", "kindle book study", "college fees",
        "java course online", "pens and notebooks", "xerox and printouts",
        "tuition fees", "library membership", "exam form fee",
    ],
}

training_texts, training_labels = [], []
for category, phrases in training_data.items():
    training_texts.extend(phrases)
    training_labels.extend([category] * len(phrases))


def clean(text):
    """lowercase, drop numbers and punctuation so '500 groceries' -> 'groceries'"""
    text = text.lower()
    text = re.sub(r"[^a-z\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def extract_amount(text):
    """Pull the first number out of the text, e.g. '500 groceries' -> 500.0"""
    match = re.search(r"\d+(?:\.\d+)?", text.replace(",", ""))
    return float(match.group()) if match else None


# Word features + character features. Character n-grams help with words the
# model never saw (e.g. 'shoes' vs 'shoe', spelling differences).
model = Pipeline([
    ("features", FeatureUnion([
        ("words", TfidfVectorizer(preprocessor=clean, ngram_range=(1, 2))),
        ("chars", TfidfVectorizer(preprocessor=clean, analyzer="char_wb", ngram_range=(2, 4))),
    ])),
    ("clf", LogisticRegression(C=20, max_iter=2000)),
])
model.fit(training_texts, training_labels)

CONFIDENCE_THRESHOLD = 40  # below this % we say "Other" instead of guessing


def categorize(text):
    probs = model.predict_proba([text])[0]
    best = probs.argmax()
    category = model.classes_[best]
    confidence = round(probs[best] * 100, 1)
    if confidence < CONFIDENCE_THRESHOLD:
        category = "Other"
    return category, confidence


if __name__ == "__main__":
    print(f"Dataset: {len(training_texts)} phrases")
    scores = cross_val_score(model, training_texts, training_labels, cv=5)
    print(f"Accuracy (5-fold CV): {scores.mean()*100:.0f}%")
    print("-" * 50)

    tests = [
        "500 groceries at D-Mart", "150 rickshaw to college", "899 electricity bill",
        "300 movie with friends", "1200 new shoes sale", "450 doctor visit",
        "999 udemy java course", "75 random thing",
    ]
    for t in tests:
        cat, conf = categorize(t)
        print(f'"{t}" -> {cat} ({conf}%)  amount={extract_amount(t)}')