import marimo

__generated_with = "0.7.17"
app = marimo.App(
    width="full",
    app_title="YouTube Video to Social Media Collateral",
)


@app.cell
def resolve_deepgram_api_key():
    import os

    deepgram_api_key = os.environ["DEEPGRAM_API_KEY"]
    return deepgram_api_key, os


@app.cell
def resolve_youtube_video_id():
    video_id = "unW1zk8terk"
    keywords = [
        "Rawkode:50",
        "Nix:5",
        "nix.dev:5",
        "Cachix:5",
        "Devenv:5",
        "IOHK:5",
        "nix dot dev:5",
    ]
    return keywords, video_id


@app.cell
def download_youtube_video_to_mp3(video_id):
    import yt_dlp

    video_url = f"http://www.youtube.com/watch?v={video_id}"

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "outtmpl": "./downloads/%(id)s",
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])
    return video_url, ydl, ydl_opts, yt_dlp


@app.cell
def deepgram_transcription(deepgram_api_key, keywords, video_id):
    from deepgram import DeepgramClient, PrerecordedOptions, FileSource
    import httpx

    deepgram = DeepgramClient(deepgram_api_key)

    with open(f"downloads/{video_id}.mp3", "rb") as file:
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
        detect_topics=True,
        detect_entities=True,
        summarize=True,
        keywords=keywords,
    )

    response = deepgram.listen.rest.v("1").transcribe_file(
        payload, options, timeout=httpx.Timeout(600.0, connect=10.0)
    )

    with open(f"transcripts/{video_id}.json", "w") as transcript_file:
        transcript_file.write(response.to_json(indent=4))
        print("Transcript JSON file generated successfully.")
    return (
        DeepgramClient,
        FileSource,
        PrerecordedOptions,
        buffer_data,
        deepgram,
        file,
        httpx,
        options,
        payload,
        response,
        transcript_file,
    )


@app.cell
def __(response, video_id):
    from deepgram_captions import DeepgramConverter, webvtt
    import json

    transcription = DeepgramConverter(response)
    captions = webvtt(transcription)

    with open(f"transcripts/{video_id}.webvtt", "w") as webvtt_file:
        webvtt_file.write(captions)
        print("WebVTT file generated successfully.")
    return (
        DeepgramConverter,
        captions,
        json,
        transcription,
        webvtt,
        webvtt_file,
    )


if __name__ == "__main__":
    app.run()
