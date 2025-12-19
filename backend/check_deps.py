try:
    import sklearn
    print("sklearn: installed")
except ImportError:
    print("sklearn: not installed")

try:
    import xgboost
    print("xgboost: installed")
except ImportError:
    print("xgboost: not installed")

try:
    import transformers
    print("transformers: installed")
except ImportError:
    print("transformers: not installed")

try:
    import sentence_transformers
    print("sentence_transformers: installed")
except ImportError:
    print("sentence_transformers: not installed")

try:
    import playwright
    print("playwright: installed")
except ImportError:
    print("playwright: not installed")
