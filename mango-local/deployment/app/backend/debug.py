import sys
from PIL import Image
import main

img = Image.open(sys.argv[1])
for mode in ["rescale", "none", "mobilenet_v2", "resnet50", "efficientnet", "vgg16"]:
    main.PREPROCESS = mode
    p = main.model.predict(main.preprocess(img), verbose=0)[0]
    print(f"{mode:14s}", main.CLASS_NAMES[p.argmax()], f"{p.max():.0%}")