import pickle
import os

MODEL_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "model"
)

class_names = [
    "anthracnose",
    "anthracnose & mango malformation",
    "anthracnose & powdery mildew",
    "healthy",
    "mango malformation",
    "mango malformation & powdery mildew",
    "powdery mildew"
]

metadata = {
    "model_file": "mango_disease_model.keras",
    "class_names": class_names,
    "image_size": (256, 256),
    "num_classes": 7,
    "framework": "TensorFlow/Keras"
}

pkl_path = os.path.join(
    MODEL_DIR,
    "mango_disease_metadata.pkl"
)

with open(pkl_path, "wb") as f:
    pickle.dump(metadata, f)

print("Metadata saved successfully!")
print(pkl_path)