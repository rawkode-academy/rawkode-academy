import marimo

__generated_with = "0.7.17"
app = marimo.App(width="full")


@app.cell
def __():
    import os
    deepgram_api_key = os.environ["DEEPGRAM_API_KEY"]
    return deepgram_api_key, os


@app.cell
def __():
    video_id = "unW1zk8terk"
    return video_id,


@app.cell
def __(video_id):
    import yt_dlp

    video_url = f"http://www.youtube.com/watch?v={video_id}"

    ydl_opts = {
       'format': 'bestaudio/best',
       'postprocessors': [{
           'key': 'FFmpegExtractAudio',
           'preferredcodec': 'mp3',
           'preferredquality': '192',
       }],
       'outtmpl': './downloads/%(id)s.mp3',
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
       ydl.download([video_url])
    return video_url, ydl, ydl_opts, yt_dlp


@app.cell
def __(deepgram_api_key, video_id):
    from deepgram import DeepgramClient, PrerecordedOptions, FileSource
    import requests
    import httpx

    DG_KEY = deepgram_api_key

    AUDIO_FILE = f"./downloads/{video_id}.mp3.mp3"
    TRANSCRIPT_FILE = f"./transcripts/{video_id}-transcript.json"

    def main():
        try:
            deepgram = DeepgramClient(DG_KEY)

            with open(AUDIO_FILE, "rb") as file:
                buffer_data = file.read()

            payload: FileSource = {
                "buffer": buffer_data,
            }


            options: PrerecordedOptions = PrerecordedOptions(
                model="nova-2",
                smart_format=True,
                utterances=True,
                punctuate=True,
                diarize=True,
            )

            response = deepgram.listen.rest.v("1").transcribe_file(
                payload, options, timeout=httpx.Timeout(600.0, connect=10.0)
            )

            with open(TRANSCRIPT_FILE, "w") as transcript_file:
                transcript_file.write(response.to_json(indent=4))

            print("Transcript JSON file generated successfully.")

        except Exception as e:
            print(f"Exception: {e}")

    if __name__ == "__main__":
        main()
    return (
        AUDIO_FILE,
        DG_KEY,
        DeepgramClient,
        FileSource,
        PrerecordedOptions,
        TRANSCRIPT_FILE,
        httpx,
        main,
        requests,
    )


if __name__ == "__main__":
    app.run()
