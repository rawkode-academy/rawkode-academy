import { readdirSync, readFileSync } from "fs";
import { load, dump } from "js-yaml";
import { unparsedVideo } from "./schemas";

const parseVideos = async () => {
  const videos = {};
  const videoFiles = readdirSync("./videos");

  videoFiles.forEach((videoFile) => {
    const video = unparsedVideo.parse(load(readFileSync(`./videos/${videoFile}`, "utf8")));


  });
};

parseVideos().then(() => {
  console.log("Done!");
}).catch((err) => {
  console.error(err);
});
