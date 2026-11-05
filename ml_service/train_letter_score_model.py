import argparse
import csv
import re
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split


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
MODEL_PATH = PREDICTION_SERVICE_DIR / "letter_score_model.pkl"
VECTORIZER_PATH = PREDICTION_SERVICE_DIR / "tfidf_vectorizer_regression.pkl"

TARGET_COLUMNS = (
    "Paragraph Structure",
    "Academic Update",
    "Self-Improvement",
    "Family Update",
    "Difficulty Update",
)
MAX_SCORES = np.array([7, 21, 14, 7, 21], dtype=float)


def clean_text(text):
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n").replace("\u00a0", " ")
    lines = []
    for line in text.split("\n"):
        line = re.sub(r"\s+", " ", line.strip())
        if not line:
            continue
        if re.match(
            r"^(Name|Age|Year Level|Year Level & Section|Year|Strand|School|Course|Date)\s*:",
            line,
            flags=re.IGNORECASE,
        ):
            continue
        if re.match(
            r"^(Dear Kalinga|A pleasant day!|Good day!|Respectfully|Sincerely|"
            r"Yours truly|Warmly|With gratitude|Thank you)",
            line,
            flags=re.IGNORECASE,
        ):
            continue
        lines.append(line)
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def load_dataset():
    if not DATASET_PATH.is_file():
        raise FileNotFoundError(
            f"Training CSV not found: {DATASET_PATH}. "
            "Place DATASETS 1 - FINAL_DATASETS.csv in the project root."
        )

    texts = []
    scores = []
    invalid_rows = 0
    clipped_values = 0

    with DATASET_PATH.open("r", encoding="utf-8-sig", newline="") as dataset:
        reader = csv.reader(dataset)
        next(reader, None)
        next(reader, None)
        rows = csv.DictReader(dataset)

        missing_columns = {"Letter_Text", *TARGET_COLUMNS} - set(rows.fieldnames or ())
        if missing_columns:
            raise ValueError(
                "CSV is missing required columns: " + ", ".join(sorted(missing_columns))
            )

        for row in rows:
            text = clean_text(row.get("Letter_Text", ""))
            try:
                target = np.array(
                    [float(row[column]) for column in TARGET_COLUMNS],
                    dtype=float,
                )
            except (TypeError, ValueError):
                invalid_rows += 1
                continue

            if not text or not np.isfinite(target).all():
                invalid_rows += 1
                continue

            clipped_values += int(np.count_nonzero((target < 0) | (target > MAX_SCORES)))
            texts.append(text)
            scores.append(np.clip(target, 0, MAX_SCORES))

    if len(texts) < 5:
        raise ValueError(
            f"Need at least 5 valid letters with rubric scores; found {len(texts)}."
        )

    return texts, np.vstack(scores), invalid_rows, clipped_values


def print_metrics(name, actual, predicted):
    print(name)
    for index, column in enumerate(TARGET_COLUMNS):
        errors = predicted[:, index] - actual[:, index]
        mae = np.mean(np.abs(errors))
        rmse = np.sqrt(np.mean(errors**2))
        print(f"  {column}: MAE={mae:.2f}, RMSE={rmse:.2f}")

    actual_total = actual.sum(axis=1) * (100 / MAX_SCORES.sum())
    predicted_total = predicted.sum(axis=1) * (100 / MAX_SCORES.sum())
    total_errors = predicted_total - actual_total
    print(
        "  Combined score (/100): "
        f"MAE={np.mean(np.abs(total_errors)):.2f}, "
        f"RMSE={np.sqrt(np.mean(total_errors**2)):.2f}"
    )


def main():
    parser = argparse.ArgumentParser(description="Train the correspondence letter score model.")
    parser.add_argument(
        "--evaluate-only",
        action="store_true",
        help="Report held-out test metrics without replacing the saved model files.",
    )
    args = parser.parse_args()

    texts, targets, invalid_rows, clipped_values = load_dataset()
    print(f"Loaded {len(texts)} valid letters from {DATASET_PATH.name}.")
    if invalid_rows:
        print(f"Skipped {invalid_rows} rows with missing or invalid text/scores.")
    if clipped_values:
        print(
            f"Clipped {clipped_values} rubric values to their configured maximums "
            "before training."
        )

    train_texts, test_texts, train_targets, test_targets = train_test_split(
        texts,
        targets,
        test_size=0.2,
        random_state=42,
    )

    test_vectorizer = TfidfVectorizer(max_features=2500, ngram_range=(1, 2), min_df=1)
    train_features = test_vectorizer.fit_transform(train_texts)
    test_features = test_vectorizer.transform(test_texts)

    test_model = LinearRegression()
    test_model.fit(train_features, train_targets)
    predictions = np.clip(test_model.predict(test_features), 0, MAX_SCORES)
    print(f"\nHeld-out test results ({len(test_texts)} letters):")
    print_metrics("Linear Regression:", test_targets, predictions)

    if args.evaluate_only:
        print("\nEvaluation-only mode; saved model files were not changed.")
        return

    if not PREDICTION_SERVICE_DIR.is_dir():
        raise FileNotFoundError(
            f"Prediction service folder not found: {PREDICTION_SERVICE_DIR}"
        )

    final_vectorizer = TfidfVectorizer(max_features=2500, ngram_range=(1, 2), min_df=1)
    all_features = final_vectorizer.fit_transform(texts)
    final_model = LinearRegression()
    final_model.fit(all_features, targets)

    joblib.dump(final_model, MODEL_PATH)
    joblib.dump(final_vectorizer, VECTORIZER_PATH)
    print("\nSaved scoring model and vectorizer:")
    print(f"  {MODEL_PATH}")
    print(f"  {VECTORIZER_PATH}")


if __name__ == "__main__":
    main()
