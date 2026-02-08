import os
import sys
from huggingface_hub import HfApi

def upload_to_hf():
    # --- CONFIGURATION ---
    if len(sys.argv) > 2:
        REPO_ID = sys.argv[1]
        TOKEN = sys.argv[2]
    else:
        REPO_ID = input("Enter your Hugging Face Space ID (e.g., username/space-name): ")
        TOKEN = input("Enter your Hugging Face Write Token: ")
    
    if not REPO_ID or not TOKEN:
        print("Error: Repo ID and Token are required.")
        return

    api = HfApi()
    
    print(f"Starting upload to {REPO_ID}...")
    
    try:
        # Check if repo exists, create if not
        try:
            api.repo_info(repo_id=REPO_ID, repo_type="space")
        except Exception:
            print(f"Space {REPO_ID} not found. Creating it now...")
            api.create_repo(
                repo_id=REPO_ID, 
                repo_type="space", 
                space_sdk="docker",
                token=TOKEN
            )
            print("Space created successfully!")

        api.upload_folder(
            folder_path=".",
            repo_id=REPO_ID,
            repo_type="space",
            token=TOKEN,
            ignore_patterns=[
                "node_modules/*",
                "dist/*",
                ".git/*",
                ".env",
                "uploads/*",
                "baileys_auth/*",
                "*.tar.gz",
                "*.apk",
                "node_modules",
                "dist",
                ".git"
            ]
        )
        print("\nUpload Complete!")
        print(f"Your app will be live soon at: https://huggingface.co/spaces/{REPO_ID}")
    except Exception as e:
        print(f"\nError: {str(e)}")

if __name__ == "__main__":
    # Check if huggingface_hub is installed
    try:
        import huggingface_hub
    except ImportError:
        print("Installing required library: huggingface-hub...")
        os.system(f"{sys.executable} -m pip install huggingface-hub")
    
    upload_to_hf()
