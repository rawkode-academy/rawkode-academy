#!/usr/bin/env python3
"""
Video Categorization Script
Fetches all videos from the GraphQL API and prompts for episode assignment.
Generates SQL statements for the episodes table.
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime
import requests
import termios
import tty


class VideoCategorizationTool:
    def __init__(self):
        self.api_url = "https://api.rawkode.academy/graphql"
        self.state_file = Path("categorization_state.json")
        self.sql_file = Path("episodes.sql")
        self.deletions_file = Path("videos_to_delete.txt")
        self.state = self.load_state()

    def get_single_key(self):
        """Get a single key press without requiring Enter"""
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(sys.stdin.fileno())
            key = sys.stdin.read(1)
            # Handle Ctrl+C
            if ord(key) == 3:
                raise KeyboardInterrupt
            return key
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

    def load_state(self):
        """Load previous state or create new one"""
        if self.state_file.exists():
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {
            "processed": {},
            "deletions": [],
            "last_index": 0
        }

    def save_state(self):
        """Save current state to file"""
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)

    def fetch_all_videos(self):
        """Fetch all videos from GraphQL API"""
        query = """
        query {
            getAllVideos {
                id
                title
                description
                publishedAt
            }
        }
        """

        response = requests.post(
            self.api_url,
            json={"query": query},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code != 200:
            raise Exception(f"GraphQL request failed: {response.status_code}")

        data = response.json()
        if "errors" in data:
            raise Exception(f"GraphQL errors: {data['errors']}")

        videos = data["data"]["getAllVideos"]

        # Sort by publishedAt date
        videos.sort(key=lambda v: v.get("publishedAt", "") or "")

        return videos

    def prompt_for_show(self, video, index, total):
        """Prompt user to select show for a video"""
        print("\n" + "="*80)
        print(f"Video {index}/{total}: {video['title']}")
        print(f"Date: {video.get('publishedAt', 'Unknown')}")

        # Auto-detect Klustered videos
        title_lower = video['title'].lower()
        if 'klustered' in title_lower:
            print("→ Auto-detected as Klustered episode")
            return 'klustered'

        print("\nSelect show:")
        print("1. rawkode-live")
        print("2. klustered")
        print("3. cloud-native-compass")
        print("4. no show (skip)")
        print("5. schedule for deletion")
        print("q. quit (save progress)")
        print("\nPress key: ", end='', flush=True)

        while True:
            choice = self.get_single_key()
            print(choice)  # Echo the key pressed

            if choice == 'q':
                return 'quit'
            elif choice == '1':
                return 'rawkode-live'
            elif choice == '2':
                return 'klustered'
            elif choice == '3':
                return 'cloud-native-compass'
            elif choice == '4':
                return 'no-show'
            elif choice == '5':
                return 'delete'
            else:
                print(f"Invalid choice '{choice}'. Press 1-5 or q: ", end='', flush=True)

    def prompt_for_show_audit(self, video, index, total, current_show):
        """Prompt user to review/change show assignment in audit mode"""
        print("\n" + "="*80)
        print(f"Video {index}/{total}: {video['title']}")
        print(f"Date: {video.get('publishedAt', 'Unknown')}")
        print(f"Current assignment: {current_show}")

        print("\nOptions:")
        print("n. next (keep current)")
        print("p. previous")
        print("c. change assignment")
        print("q. quit")
        print("\nPress key: ", end='', flush=True)

        while True:
            choice = self.get_single_key()
            print(choice)  # Echo the key

            if choice == 'q':
                return 'quit'
            elif choice == 'n':
                return 'keep'
            elif choice == 'p':
                return 'previous'
            elif choice == 'c':
                # Show change options
                print("\nSelect new show:")
                print("1. rawkode-live")
                print("2. klustered")
                print("3. cloud-native-compass")
                print("4. no show (skip)")
                print("5. schedule for deletion")
                print("\nPress key: ", end='', flush=True)

                while True:
                    new_choice = self.get_single_key()
                    print(new_choice)  # Echo the key

                    if new_choice == '1':
                        return 'rawkode-live'
                    elif new_choice == '2':
                        return 'klustered'
                    elif new_choice == '3':
                        return 'cloud-native-compass'
                    elif new_choice == '4':
                        return 'no-show'
                    elif new_choice == '5':
                        return 'delete'
                    else:
                        print(f"Invalid choice '{new_choice}'. Press 1-5: ", end='', flush=True)
            else:
                print(f"Invalid choice '{choice}'. Press n/p/c/q: ", end='', flush=True)

    def generate_sql(self):
        """Generate SQL file from processed videos"""
        with open(self.sql_file, 'w') as f:
            f.write("-- Episodes table population\n")
            f.write("-- Generated on: " + datetime.now().isoformat() + "\n\n")

            # Group by show for better organization
            shows = {}
            for video_id, data in self.state["processed"].items():
                if data["show"] not in ["no-show", "delete"]:
                    if data["show"] not in shows:
                        shows[data["show"]] = []
                    shows[data["show"]].append({
                        "video_id": video_id,
                        "title": data.get("title", "")
                    })

            # Write SQL for each show
            for show_id, episodes in shows.items():
                f.write(f"\n-- {show_id} episodes\n")
                for episode in episodes:
                    f.write(f"-- {episode['title']}\n")
                    f.write(f"INSERT INTO episodes (videoId, showId, code)\n")
                    f.write(f"VALUES ('{episode['video_id']}', '{show_id}', '{episode['video_id']}')\n")
                    f.write(f"ON CONFLICT DO NOTHING;\n\n")

        print(f"\nSQL statements written to: {self.sql_file}")

    def save_deletions(self):
        """Save list of videos marked for deletion"""
        if self.state["deletions"]:
            with open(self.deletions_file, 'w') as f:
                f.write("# Videos marked for deletion\n")
                f.write(f"# Generated on: {datetime.now().isoformat()}\n\n")
                for video_id in self.state["deletions"]:
                    video = self.state["processed"].get(video_id, {})
                    f.write(f"{video_id} # {video.get('title', 'Unknown')}\n")
            print(f"Deletion list written to: {self.deletions_file}")

    def audit(self):
        """Audit mode to review and change existing assignments"""
        if not self.state["processed"]:
            print("No processed videos to audit. Run normal mode first.")
            return

        print("AUDIT MODE - Reviewing processed videos")
        print(f"Found {len(self.state['processed'])} processed videos")

        # Get all processed videos and sort by publishedAt
        processed_items = list(self.state["processed"].items())
        processed_items.sort(key=lambda x: x[1].get("publishedAt", "") or "")

        total = len(processed_items)
        changes_made = 0
        i = 0

        try:
            while i < total:
                video_id, video_data = processed_items[i]
                video = {
                    'id': video_id,
                    'title': video_data['title'],
                    'publishedAt': video_data.get('publishedAt')
                }

                result = self.prompt_for_show_audit(video, i + 1, total, video_data['show'])

                if result == 'quit':
                    break
                elif result == 'keep':
                    i += 1
                    continue
                elif result == 'previous':
                    if i > 0:
                        i -= 1
                    else:
                        print("Already at first video")
                    continue
                else:
                    # Update the assignment
                    old_show = video_data['show']
                    video_data['show'] = result

                    # Update deletions list
                    if old_show == 'delete' and result != 'delete':
                        if video_id in self.state["deletions"]:
                            self.state["deletions"].remove(video_id)
                    elif old_show != 'delete' and result == 'delete':
                        if video_id not in self.state["deletions"]:
                            self.state["deletions"].append(video_id)

                    self.state["processed"][video_id] = video_data
                    changes_made += 1
                    print(f"Updated: {old_show} → {result}")
                    i += 1

                # Save periodically
                if (i + 1) % 10 == 0:
                    self.save_state()

        except KeyboardInterrupt:
            print("\n\nInterrupted. Saving changes...")

        self.save_state()

        if changes_made > 0:
            self.generate_sql()
            self.save_deletions()
            print(f"\nAudit complete. Made {changes_made} changes.")
        else:
            print("\nAudit complete. No changes made.")

    def run(self, audit_mode=False):
        """Main execution"""
        if audit_mode:
            self.audit()
            return

        print("Fetching all videos from API...")
        videos = self.fetch_all_videos()
        total = len(videos)
        print(f"Found {total} videos")

        # Resume from last position
        start_index = self.state["last_index"]
        if start_index > 0:
            print(f"Resuming from video {start_index + 1}")

        try:
            for i in range(start_index, total):
                video = videos[i]

                # Skip if already processed
                if video['id'] in self.state["processed"]:
                    continue

                show = self.prompt_for_show(video, i + 1, total)

                if show == 'quit':
                    self.state["last_index"] = i
                    self.save_state()
                    print("\nProgress saved. Run again to continue.")
                    return

                video_data = {
                    "show": show,
                    "title": video['title'],
                    "publishedAt": video.get('publishedAt')
                }

                if show == 'delete':
                    self.state["deletions"].append(video['id'])

                self.state["processed"][video['id']] = video_data
                self.state["last_index"] = i + 1

                # Save state periodically
                if (i + 1) % 10 == 0:
                    self.save_state()
                    print(f"Progress saved ({i + 1}/{total})")

        except KeyboardInterrupt:
            print("\n\nInterrupted. Saving progress...")
            self.save_state()
            print("Progress saved. Run again to continue.")
            return

        # Mark as complete
        self.state["last_index"] = total
        self.save_state()

        # Generate outputs
        self.generate_sql()
        self.save_deletions()

        # Summary
        processed = len(self.state["processed"])
        episodes = sum(1 for v in self.state["processed"].values()
                      if v["show"] not in ["no-show", "delete"])
        deletions = len(self.state["deletions"])

        print("\n" + "="*80)
        print("SUMMARY")
        print(f"Total videos processed: {processed}")
        print(f"Episodes created: {episodes}")
        print(f"Videos marked for deletion: {deletions}")
        print(f"Videos skipped (no show): {processed - episodes - deletions}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Categorize videos into shows')
    parser.add_argument('--audit', action='store_true', help='Audit mode - review and change existing assignments')
    args = parser.parse_args()

    tool = VideoCategorizationTool()
    tool.run(audit_mode=args.audit)