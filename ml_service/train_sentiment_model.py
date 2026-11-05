import argparse
import csv
import re
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = next(
    (
        parent
        for parent in (BASE_DIR, *BASE_DIR.parents)
        if (parent / "client").is_dir() and (parent / "server").is_dir()
    ),
    BASE_DIR.parent,
)
DATASET_PATH = PROJECT_ROOT / "DATASETS 1 - FINAL_DATASETS.csv"
PREDICTION_SERVICE_DIR = PROJECT_ROOT / "ml-service"
MODEL_PATH = PREDICTION_SERVICE_DIR / "sentiment_model.pkl"
VECTORIZER_PATH = PREDICTION_SERVICE_DIR / "tfidf_vectorizer.pkl"
LABEL_NAMES = {-1: "Negative", 0: "Neutral", 1: "Positive"}
VALID_LABELS = set(LABEL_NAMES)


def clean_text(text):
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"\s+", " ", text).strip()


def load_dataset():
    if not DATASET_PATH.is_file():
        raise FileNotFoundError(
            f"Training CSV not found: {DATASET_PATH}. "
            "Place DATASETS 1 - FINAL_DATASETS.csv in the project root."
        )

    texts = []
    labels = []
    invalid_rows = 0

    with DATASET_PATH.open("r", encoding="utf-8-sig", newline="") as dataset:
        metadata = csv.reader(dataset)
        next(metadata, None)
        next(metadata, None)
        rows = csv.DictReader(dataset)
        required_columns = {"Letter_Text", "Sentiment_Label"}
        missing_columns = required_columns - set(rows.fieldnames or ())
        if missing_columns:
            raise ValueError(
                "CSV is missing required columns: " + ", ".join(sorted(missing_columns))
            )

        for row in rows:
            text = clean_text(row.get("Letter_Text", ""))
            try:
                label = int(row.get("Sentiment_Label", "").strip())
            except (AttributeError, TypeError, ValueError):
                invalid_rows += 1
                continue

            if not text or label not in VALID_LABELS:
                invalid_rows += 1
                continue

            texts.append(text)
            labels.append(label)

    if len(texts) < 10:
        raise ValueError(f"Need at least 10 valid labeled letters; found {len(texts)}.")

    counts = {label: labels.count(label) for label in VALID_LABELS}
    if min(counts.values()) < 2:
        raise ValueError(
            "Need at least 2 examples for each sentiment label (-1, 0, 1); "
            f"found {counts}."
        )

    return texts, labels, invalid_rows


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate or train the correspondence sentiment classifier."
    )
    parser.add_argument(
        "--train",
        action="store_true",
        help="Save the selected model and vectorizer, replacing the current sentiment artifacts.",
    )
    args = parser.parse_args()

    texts, labels, invalid_rows = load_dataset()
    print(f"Loaded {len(texts)} valid labeled letters from {DATASET_PATH.name}.")
    if invalid_rows:
        print(f"Skipped {invalid_rows} rows with missing or invalid text/labels.")
    print(
        "Label counts: "
        + ", ".join(
            f"{LABEL_NAMES[label]}={labels.count(label)}"
            for label in sorted(VALID_LABELS)
        )
    )

    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )
    test_vectorizer = TfidfVectorizer(
        max_features=3000,
        ngram_range=(1, 2),
        min_df=2,
    )
    train_features = test_vectorizer.fit_transform(train_texts)
    test_features = test_vectorizer.transform(test_texts)

    candidates = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=42,
        ),
        "Multinomial Naive Bayes": MultinomialNB(),
    }
    results = []

    print(f"\nHeld-out test set: {len(test_texts)} letters")
    for name, model in candidates.items():
        model.fit(train_features, train_labels)
        predictions = model.predict(test_features)
        macro_f1 = f1_score(
            test_labels,
            predictions,
            labels=sorted(VALID_LABELS),
            average="macro",
            zero_division=0,
        )
        accuracy = accuracy_score(test_labels, predictions)
        results.append((macro_f1, name, model))
        print(f"\n{name}: accuracy={accuracy:.3f}, macro-F1={macro_f1:.3f}")
        print(
            classification_report(
                test_labels,
                predictions,
                labels=sorted(VALID_LABELS),
                target_names=[LABEL_NAMES[label] for label in sorted(VALID_LABELS)],
                zero_division=0,
            )
        )

    _, best_name, _ = max(results, key=lambda result: result[0])
    print(f"Selected by held-out macro-F1: {best_name}")

    if not args.train:
        print("\nEvaluation-only mode; saved sentiment model files were not changed.")
        print("Add --train when ready to replace the model used by ml-service/app.py.")
        return

    if not PREDICTION_SERVICE_DIR.is_dir():
        raise FileNotFoundError(
            f"Prediction service folder not found: {PREDICTION_SERVICE_DIR}"
        )

    final_vectorizer = TfidfVectorizer(
        max_features=3000,
        ngram_range=(1, 2),
        min_df=2,
    )
    all_features = final_vectorizer.fit_transform(texts)
    final_model = LogisticRegression(
        max_iter=1000,
        class_weight="balanced",
        random_state=42,
    ) if best_name == "Logistic Regression" else MultinomialNB()
    final_model.fit(all_features, labels)

    joblib.dump(final_model, MODEL_PATH)
    joblib.dump(final_vectorizer, VECTORIZER_PATH)
    print("\nSaved sentiment model and vectorizer:")
    print(f"  {MODEL_PATH}")
    print(f"  {VECTORIZER_PATH}")


if __name__ == "__main__":
    main()
