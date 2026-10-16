import os
import re
import pandas as pd
import numpy as np
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error

# ------------------------------------------------------------
# Train scorer from the existing Apple Scholar spreadsheet
# ------------------------------------------------------------
# The file is the root spreadsheet already opened in the workspace:
# DATASETS 1 - FINAL DATASETS (1).csv
# It contains the rubric-style score fields, including:
#   Letter_Text
#   Evaluated_Grade
#   Risk_Label
# ------------------------------------------------------------

DATASET_PATH = os.path.abspath(os.path.join(os.getcwd(), '..', '..', 'DATASETS 1 - FINAL DATASETS (1).csv'))
MODEL_PATH = os.path.abspath(os.path.join(os.getcwd(), 'letter_score_regressor.pkl'))
VECTORIZER_PATH = os.path.abspath(os.path.join(os.getcwd(), 'letter_score_tfidf.pkl'))

if not os.path.exists(DATASET_PATH):
    raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

# Read the real header row, which begins after the rubric metadata rows.
# The top of the CSV contains 8 descriptive lines before the true header.

df = pd.read_csv(DATASET_PATH, skiprows=range(8), encoding='utf-8-sig', engine='python')
print(f"Loaded {len(df)} rows from dataset.")

# Keep only the columns that are useful for scoring.
# Letter_Text is the raw scholar narrative.
# Evaluated_Grade is the target numeric score.
required = ['Letter_Text', 'Evaluated_Grade']
missing = [c for c in required if c not in df.columns]
if missing:
    raise ValueError(f"Missing expected training columns: {missing}")

df = df[required].dropna().copy()

df['Letter_Text'] = df['Letter_Text'].fillna('').astype(str)
df['Evaluated_Grade'] = pd.to_numeric(df['Evaluated_Grade'], errors='coerce')

df = df.dropna(subset=['Evaluated_Grade']).reset_index(drop=True)

def clean_text(text):
    text = str(text or '')
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = text.replace('\u00a0', ' ')

    # Remove the initial form-filling wrapper lines from the Letter_Text field.
    # The raw sheet writes the student's profile and date into the letter body.
    lines = []
    for line in text.split('\n'):
        s = re.sub(r'\s+', ' ', line.strip())
        if not s:
            continue

        # Drop header/profile metadata lines that appear in Letter_Text.
        if re.match(r'^(Name|Age|Year Level|Year Level & Section|Strand|School|Course|Date)\s*:', s, flags=re.I):
            continue
        if re.match(r'^(Dear Kalinga|A pleasant day!|Good day!|Respectfully|Sincerely|Yours truly|Warmly|With gratitude|Thank you)', s, flags=re.I):
            continue

        # Remove trailing closing clauses found in the raw letters when they are
        # placed as standalone lines instead of part of the paragraph body.
        if re.match(r'^(May God bless you|May you.*|This letter.*|Thank you.*)', s, flags=re.I):
            continue

        lines.append(s)

    # Remove interspersed line noise but preserve the paragraph text data.
    text = '\n'.join(lines)
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

df['Letter_Text'] = df['Letter_Text'].map(clean_text)
df = df[df['Letter_Text'].str.len() > 0].reset_index(drop=True)

print(df[['Letter_Text', 'Evaluated_Grade']].head())
print(df['Evaluated_Grade'].describe())

X = df['Letter_Text']
y = df['Evaluated_Grade'].astype(float)

# Text -> TF-IDF feature matrix
vectorizer = TfidfVectorizer(max_features=2500, ngram_range=(1, 2), min_df=1)
X_vec = vectorizer.fit_transform(X)

# Keep a simple regression target, since the spreadsheet already has the grade column.
X_train, X_test, y_train, y_test = train_test_split(
    X_vec, y, test_size=0.2, random_state=42
)

model = LinearRegression()
model.fit(X_train, y_train)

pred = model.predict(X_test)

r2 = r2_score(y_test, pred)
rmse = np.sqrt(mean_squared_error(y_test, pred))

print('\nModel report')
print('=' * 60)
print(f'R2 score: {r2:.4f}')
print(f'RMSE: {rmse:.4f}')
print(f'Test rows: {len(y_test)}')
print(f'Train rows: {len(y_train)}')

# Save artifacts in the current ml-service folder.
joblib.dump(model, MODEL_PATH)
joblib.dump(vectorizer, VECTORIZER_PATH)

print('\nSaved artifacts:')
print(MODEL_PATH)
print(VECTORIZER_PATH)
print('\nNext steps:')
print('1. Start a Flask microservice that loads the saved model and vectorizer.')
print('2. Accept a JSON payload with letter_text and return a predicted score.')
print('3. Use the returned score as the letter quality signal in the app UI or backend.')
