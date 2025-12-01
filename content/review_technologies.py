import os
import re
import subprocess
import sys

# Configuration
CONTENT_DIR = '/Users/rawkode/Code/src/github.com/RawkodeAcademy/RawkodeAcademy/projects/rawkode.academy/website/content/videos'
EDITOR = os.environ.get('EDITOR', 'code')

def get_metadata(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    title_match = re.search(r'^title:\s*(.*)', content, re.MULTILINE)
    title = title_match.group(1).strip().strip('"').strip("'") if title_match else "Unknown Title"
    
    techs = []
    match_block = re.search(r'^technologies:\s*\n', content, re.MULTILINE)
    if match_block:
        start_pos = match_block.end()
        lines = content[start_pos:].split('\n')
        for line in lines:
            line_match = re.match(r'^\s*-\s*(.*)', line)
            if line_match:
                techs.append(line_match.group(1).strip().strip("'").strip('"'))
            else:
                if line.strip() == '' or line.strip().startswith('#'):
                    continue
                if re.match(r'^\S', line):
                    break
    
    return title, techs

def main():
    files_to_process = []
    for root, dirs, files in os.walk(CONTENT_DIR):
        for file in files:
            if file.endswith('.md'):
                files_to_process.append(os.path.join(root, file))
    
    files_to_process.sort()
    total_files = len(files_to_process)
    
    print(f"Found {total_files} video files to review.")
    print("--------------------------------------------------")

    for i, file_path in enumerate(files_to_process):
        title, techs = get_metadata(file_path)
        
        print(f"\n[{i+1}/{total_files}] {os.path.basename(file_path)}")
        print(f"Title: {title}")
        print(f"Technologies: {techs if techs else 'None'}")
        
        while True:
            choice = input("Action ([s]kip, [e]dit, [q]uit): ").lower().strip()
            
            if choice == 's':
                break
            elif choice == 'e':
                print(f"Opening in {EDITOR}...")
                try:
                    subprocess.call([EDITOR, file_path])
                except FileNotFoundError:
                    print(f"Error: Editor '{EDITOR}' not found. Please set EDITOR environment variable or install 'code'.")
                break
            elif choice == 'q':
                print("Exiting...")
                sys.exit(0)
            else:
                print("Invalid choice. Please enter 's', 'e', or 'q'.")

if __name__ == "__main__":
    main()
