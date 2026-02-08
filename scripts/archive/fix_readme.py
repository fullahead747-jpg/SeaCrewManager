"""
Quick script to upload just the README.md file to fix the configuration error
"""
from huggingface_hub import HfApi

REPO_ID = "Sagar007Rana/sea-crew-manager"
TOKEN = "YOUR_HUGGINGFACE_TOKEN"

api = HfApi()

print("Uploading README.md to fix configuration error...")

api.upload_file(
    path_or_fileobj="README.md",
    path_in_repo="README.md",
    repo_id=REPO_ID,
    repo_type="space",
    token=TOKEN
)

print("✅ README.md uploaded successfully!")
print(f"Check your Space at: https://huggingface.co/spaces/{REPO_ID}")
