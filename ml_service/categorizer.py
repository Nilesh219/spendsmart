"""
SpendSmart - AI Expense Categorizer (v2: bigger training set)

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
        # added in v2
        "d-mart buying items", "dmart shopping", "d mart items", "dmart purchase",
        "buying items from supermarket", "reliance fresh groceries", "kirana store items",
        "grocery items for home", "rice dal and oil", "vegetables from market",
        "eggs and chicken", "fish and mutton", "paneer and curd", "breakfast at udupi",
        "pani puri", "dosa and idli", "thali lunch", "burger and fries", "chai with friends",
        "lunch with colleagues", "dinner with family", "zepto order", "blinkit groceries",
        "instamart order", "cake from bakery", "sweets and mithai", "biscuits and chips",
        "cold drink and snacks", "tiffin service", "canteen lunch", "street food",
        "order food online", "eating out", "kfc meal", "mcdonalds burger",
        "wheat flour and sugar", "cooking oil and spices", "fruit juice", "banana and apple",
    ],
    "Travel": [
        "bus ticket to Kolhapur", "auto fare to station", "train ticket reservation",
        "petrol for bike", "uber cab ride", "ola ride to mall",
        "flight ticket booking", "taxi to airport", "local bus pass",
        "rickshaw fare", "auto rickshaw to college", "metro card recharge",
        "diesel for car", "toll plaza fee", "irctc train booking",
        "rapido bike taxi", "parking charges", "redbus ticket",
        # added in v2
        "go out explore world", "trip to goa", "tour package booking", "sightseeing trip",
        "vacation travel expenses", "road trip fuel", "explore the city trip",
        "weekend trip to lonavala", "travel to hometown", "bus fare to pune",
        "train fare to mumbai", "petrol pump fill tank", "cab to railway station",
        "ola auto fare", "bike petrol refill", "highway toll", "fastag recharge",
        "hotel stay for trip", "hostel booking travel", "airport cab", "travel to office",
        "monthly bus pass", "ferry ticket", "trekking trip transport", "going to village by bus",
        "bike servicing and petrol", "namma metro ticket", "indigo flight", "sleeper bus ticket",
        "car rental trip", "outstation taxi",
    ],
    "Bills": [
        "electricity bill payment", "mobile recharge jio", "wifi internet bill",
        "water bill", "gas cylinder booking", "rent payment flat",
        "phone postpaid bill", "broadband plan recharge", "airtel recharge",
        "light bill", "dth recharge", "maintenance charges society",
        "house rent", "mseb bill",
        # added in v2
        "monthly rent", "pg rent payment", "room rent", "electricity bill", "current bill",
        "vi recharge", "bsnl recharge", "tata sky recharge", "jio fiber bill", "internet bill payment",
        "lpg cylinder", "water tax", "property tax payment", "society maintenance",
        "loan emi payment", "credit card bill", "insurance premium bike", "mobile bill",
        "cable tv bill", "gas bill", "home emi", "bike emi", "phone recharge",
        "prepaid recharge", "electricity meter payment",
    ],
    "Shopping": [
        "new shirt from mall", "amazon order headphones", "flipkart sale shoes",
        "clothes shopping", "mobile cover purchase", "gift for friend",
        "kurti shopping online", "sneakers from store", "new shoes",
        "jeans and tshirt", "myntra order", "watch purchase",
        "bag from shop", "earphones online order",
        # added in v2
        "bought new clothes", "shopping at mall", "birthday gift", "wedding gift",
        "new phone purchase", "laptop bag", "sunglasses", "perfume and deodorant",
        "ajio order", "meesho order", "amazon delivery", "flipkart order",
        "furniture for room", "home decor items", "kitchen utensils", "bedsheet and pillow",
        "wallet and belt", "saree purchase", "diwali shopping", "festival clothes",
        "charger and cable", "power bank", "smart watch", "makeup and cosmetics",
        "salon haircut", "tailor stitching", "shoes from store", "cap and socks",
        "shampoo and soap", "toothpaste and toiletries", "personal care items", "face wash and cream",
    ],
    "Fun": [
        "movie ticket", "netflix subscription", "video game purchase",
        "concert ticket", "cricket match tickets", "gaming subscription",
        "amusement park entry", "pubg game skin", "movie with friends",
        "spotify premium", "bowling and arcade", "hotstar subscription",
        "party with friends", "bookmyshow tickets", "outing picnic",
        # added in v2
        "making fun with friends", "hangout with friends", "night out with friends",
        "birthday party celebration", "picnic with family", "movie night", "pvr cinema",
        "inox movie tickets", "amazon prime subscription", "youtube premium", "disney hotstar plan",
        "steam game purchase", "play store game", "freefire diamonds", "bgmi uc purchase",
        "club entry", "dj night", "water park", "go karting", "escape room",
        "cricket turf booking", "football turf", "badminton court booking", "snooker with friends",
        "karaoke night", "stand up comedy show", "music festival", "board games",
    ],
    "Health": [
        "medicine from pharmacy", "doctor consultation fee", "gym membership",
        "hospital lab test", "protein powder", "dental checkup",
        "health insurance premium", "yoga class fee", "doctor visit",
        "blood test", "clinic fees", "vitamin tablets", "eye checkup glasses",
        # added in v2
        "medical store medicines", "apollo pharmacy", "medplus order", "tablets for fever",
        "cough syrup", "hospital bill", "x-ray and scan", "physiotherapy session",
        "gym fees", "gym supplements", "whey protein", "zumba class", "swimming pool fee",
        "dentist appointment", "eye drops", "spectacles", "contact lenses", "health checkup package",
        "ayurvedic medicine", "first aid items", "mask and sanitizer", "therapy session",
    ],
    "Education": [
        "udemy course purchase", "college exam fees", "notebooks and stationery",
        "coursera subscription", "textbook for semester", "online certification fee",
        "coaching class fees", "kindle book study", "college fees",
        "java course online", "pens and notebooks", "xerox and printouts",
        "tuition fees", "library membership", "exam form fee",
        # added in v2
        "reading a book", "bought a book", "buying books", "book purchase",
        "novel and story books", "reading material", "study material", "reference book",
        "competitive exam book", "gate exam fees", "upsc coaching", "spoken english class",
        "python course", "internship certificate fee", "project report printing", "college project materials",
        "school fees", "hostel fees college", "scholarship exam form", "stationery shop",
        "geometry box and calculator", "pdf notes purchase", "linkedin learning", "skillshare",
        "online test series", "library fine", "drawing materials", "lab manual",
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
# model never saw (e.g. 'shoes' vs 'shoe', spelling mistakes like 'exlpore').
model = Pipeline([
    ("features", FeatureUnion([
        ("words", TfidfVectorizer(preprocessor=clean, ngram_range=(1, 2))),
        ("chars", TfidfVectorizer(preprocessor=clean, analyzer="char_wb", ngram_range=(2, 4))),
    ])),
    ("clf", LogisticRegression(C=20, max_iter=2000)),
])
model.fit(training_texts, training_labels)

CONFIDENCE_THRESHOLD = 30  # below this % we say "Other" instead of guessing


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
        "200 reading a book", "900 making fun with friends", "800 go out exlpore world",
        "800 d-mart buying items", "500 groceries at D-Mart", "150 rickshaw to college",
        "899 electricity bill", "1200 new shoes sale", "450 doctor visit",
        "999 udemy java course", "75 random thing",
    ]
    for t in tests:
        cat, conf = categorize(t)
        print(f'"{t}" -> {cat} ({conf}%)  amount={extract_amount(t)}')