import os
import shutil

# SOVEREIGN ATTRACTOR: GOLFCAD
# Exfiltrates and consolidates all golfcad-related assets from legacy entropy traps.

APEX_ROOT = os.path.expanduser("~/golfcad")
VERSIONS_DIR = os.path.join(APEX_ROOT, "versions")
LEGACY_DIRS = [
    os.path.expanduser("~/ventures"),
    os.path.expanduser("~/MobCorp/products")
]

def attract():
    print(f"[ATTRACTOR - GOLFCAD] Initializing gravity well...")
    os.makedirs(VERSIONS_DIR, exist_ok=True)
    
    files_exfiltrated = 0
    bytes_consolidated = 0

    for legacy_dir in LEGACY_DIRS:
        if not os.path.exists(legacy_dir):
            continue
            
        for root, dirs, files in os.walk(legacy_dir):
            if "golfcad" in root.lower():
                for file in files:
                    src = os.path.join(root, file)
                    parent_name = os.path.basename(root)
                    dest_name = f"{parent_name}_{file}"
                    dest = os.path.join(VERSIONS_DIR, dest_name)
                    
                    if not os.path.exists(dest):
                        try:
                            shutil.copy2(src, dest)
                            size = os.path.getsize(src)
                            bytes_consolidated += size
                            files_exfiltrated += 1
                        except Exception:
                            pass

    print(f"[ATTRACTOR - GOLFCAD] Flattened {files_exfiltrated} assets. Recovered {bytes_consolidated / (1024*1024):.2f} MB.")

if __name__ == "__main__":
    attract()
