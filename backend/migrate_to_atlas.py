import sys
from pymongo import MongoClient

LOCAL_URL = "mongodb://localhost:27017"
ATLAS_URL = "mongodb+srv://smallbiz743_db_user:ABoum6xZe0MadqDN@cluster0.kbamsbe.mongodb.net/?appName=Cluster0"
LOCAL_DB = "test_database"
ATLAS_DB = "cashierpro"
COLLECTIONS = ["products", "users", "orders", "wishlist", "settings"]

local = MongoClient(LOCAL_URL)[LOCAL_DB]
atlas = MongoClient(ATLAS_URL)[ATLAS_DB]

for name in COLLECTIONS:
    docs = list(local[name].find({}))
    if not docs:
        print(f"{name}: 0 local docs, skipped")
        continue
    for d in docs:
        d.pop("_id", None)
    atlas[name].delete_many({})
    atlas[name].insert_many(docs)
    print(f"{name}: copied {len(docs)} docs")

print("verification:")
for name in COLLECTIONS:
    print(f"  atlas.{name} = {atlas[name].count_documents({})}")
print("DONE")
