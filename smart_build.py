#!/usr/bin/env python3
import os
import hashlib
import json
import subprocess
import re
import sys

# Configuration
COMPONENTS = {
    "backend": "backend",
    "frontend": "frontend",
    "toolbox": "toolbox"
}
REGISTRY_PREFIX = "erdincka/playground"
CACHE_FILE = ".smart_build_cache.json"
CHART_FILE = "helm/playground/Chart.yaml"
VALUES_FILE = "helm/playground/values.yaml"

def get_dir_hash(directory):
    """Calculate a hash of the directory contents."""
    hash_md5 = hashlib.md5()
    for root, dirs, files in os.walk(directory):
        # Sort for consistency
        dirs.sort()
        files.sort()
        for names in files:
            if any(x in names for x in ['__pycache__', 'node_modules', '.next', '.pyc']):
                continue
            file_path = os.path.join(root, names)
            hash_md5.update(file_path.encode())
            try:
                with open(file_path, "rb") as f:
                    for chunk in iter(lambda: f.read(4096), b""):
                        hash_md5.update(chunk)
            except (OSError, IOError):
                pass
    return hash_md5.hexdigest()

def get_current_chart_version():
    with open(CHART_FILE, 'r') as f:
        content = f.read()
        match = re.search(r'^version:\s*(\d+\.\d+\.\d+)', content, re.MULTILINE)
        if match:
            return match.group(1)
    return "0.1.0"

def increment_patch_version(version):
    parts = version.split('.')
    parts[-1] = str(int(parts[-1]) + 1)
    return '.'.join(parts)

def update_chart_version(new_version):
    with open(CHART_FILE, 'r') as f:
        content = f.read()
    
    content = re.sub(r'^version:\s*.*', f'version: {new_version}', content, flags=re.MULTILINE)
    content = re.sub(r'^appVersion:\s*.*', f'appVersion: "{new_version}"', content, flags=re.MULTILINE)
    
    with open(CHART_FILE, 'w') as f:
        f.write(content)

def update_values_tag(component, new_tag):
    with open(VALUES_FILE, 'r') as f:
        content = f.read()
    
    # Use regex to find the component section and update its tag
    # This assumes a structure like:
    # backend:
    #   ...
    #   image:
    #     tag: "..."
    pattern = rf'({component}:.*?image:.*?tag:\s*)".*?"'
    content = re.sub(pattern, rf'\1"{new_tag}"', content, flags=re.DOTALL)
    
    # Special case for toolbox if it doesn't follow the same structure
    if component == "toolbox":
        content = re.sub(rf'(toolbox:.*?image:\s*)".*?"', rf'\1"{REGISTRY_PREFIX}-toolbox:{new_tag}"', content, flags=re.DOTALL)

    with open(VALUES_FILE, 'w') as f:
        f.write(content)

def run_command(command):
    print(f"Executing: {command}")
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for line in iter(process.stdout.readline, b''):
        sys.stdout.write(line.decode())
    process.stdout.close()
    return process.wait()

def main():
    if not os.path.exists(CACHE_FILE):
        cache = {}
    else:
        with open(CACHE_FILE, 'r') as f:
            cache = json.load(f)

    changed_any = False
    current_hashes = {}
    
    for name, directory in COMPONENTS.items():
        if not os.path.exists(directory):
            continue
        
        dir_hash = get_dir_hash(directory)
        current_hashes[name] = dir_hash
        
        if cache.get(name) != dir_hash:
            print(f"✨ Changes detected in {name}")
            changed_any = True
        else:
            print(f"✅ No changes in {name}")

    if not changed_any:
        print("🙌 No components changed. Nothing to do.")
        return

    # Bump version
    old_version = get_current_chart_version()
    new_version = increment_patch_version(old_version)
    print(f"⬆️  Bumping version: {old_version} -> {new_version}")
    
    update_chart_version(new_version)
    
    for name, directory in COMPONENTS.items():
        if cache.get(name) != current_hashes[name]:
            image_name = f"{REGISTRY_PREFIX}-{name}"
            print(f"📦 Building {image_name}:{new_version}...")
            
            # Run docker build
            # We use latest as well for convenience
            cmd = f"cd {directory} && docker buildx build --platform linux/amd64 -t {image_name}:{new_version} -t {image_name}:latest --push ."
            if run_command(cmd) == 0:
                print(f"✅ Built and pushed {image_name}")
                update_values_tag(name, new_version)
                cache[name] = current_hashes[name]
            else:
                print(f"❌ Failed to build {image_name}")
                sys.exit(1)

    # Save cache
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)
    
    print(f"\n🚀 Success! Version {new_version} is ready for deployment.")
    print(f"Run './helm/refresh.sh' to update your cluster.")

if __name__ == "__main__":
    main()