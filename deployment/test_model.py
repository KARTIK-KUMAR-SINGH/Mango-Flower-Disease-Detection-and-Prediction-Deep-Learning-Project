import os
import numpy as np
from tensorflow import keras
from tensorflow.keras.utils import load_img, img_to_array


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "model",
    "mango_disease_model.keras"
)

EXTERNAL_DIR = os.path.join(
    BASE_DIR,
    "external_test"
)


# ============================================================
# CLASS NAMES
# ============================================================

class_names = [
    "anthracnose",
    "anthracnose & mango malformation",
    "anthracnose & powdery mildew",
    "healthy",
    "mango malformation",
    "mango malformation & powdery mildew",
    "powdery mildew"
]


IMG_SIZE = (256, 256)


# ============================================================
# LOAD MODEL
# ============================================================

print("Loading model...")

model = keras.models.load_model(
    MODEL_PATH
)

print("Model loaded successfully!")
print()


# ============================================================
# PREDICTION FUNCTION
# ============================================================

def predict_image(image_path):

    image = load_img(
        image_path,
        target_size=IMG_SIZE
    )

    image_array = img_to_array(image)

    image_array = np.expand_dims(
        image_array,
        axis=0
    )

    predictions = model.predict(
        image_array,
        verbose=0
    )[0]

    predicted_index = np.argmax(
        predictions
    )

    predicted_class = class_names[
        predicted_index
    ]

    confidence = predictions[
        predicted_index
    ]

    return predicted_class, confidence


# ============================================================
# TEST ALL EXTERNAL IMAGES
# ============================================================

print("=" * 70)
print("MANGO FLOWER DISEASE — EXTERNAL IMAGE TEST")
print("=" * 70)

image_extensions = (
    ".jpg",
    ".jpeg",
    ".png",
    ".webp"
)

total_images = 0


for filename in sorted(
    os.listdir(EXTERNAL_DIR)
):

    image_path = os.path.join(
        EXTERNAL_DIR,
        filename
    )

    if not os.path.isfile(image_path):
        continue

    if not filename.lower().endswith(
        image_extensions
    ):
        continue

    total_images += 1

    predicted_class, confidence = predict_image(
        image_path
    )

    print()
    print("Image      :", filename)
    print("Prediction :", predicted_class)
    print(
        "Confidence :",
        f"{confidence * 100:.2f}%"
    )


print()
print("=" * 70)
print(
    "Total images tested:",
    total_images
)
print("=" * 70)