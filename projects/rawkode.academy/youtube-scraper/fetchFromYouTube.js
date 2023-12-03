import fs from 'fs';
import { google } from 'googleapis';
import { dump } from "js-yaml";
import readline from 'readline';

var OAuth2 = google.auth.OAuth2;

var SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'youtube-nodejs-quickstart.json';

fs.readFile('credentials.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }

  let authorizePromise = new Promise((resolve, reject) => {
    fs.readFile('credentials.json', function processClientSecrets(err, content) {
      if (err) {
        console.log('Error loading client secret file: ' + err);
        reject(err);
      } else {
        authorize(JSON.parse(content.toString()), findVideos)
          .then(client => resolve(client))
          .catch(err => reject(err));
      }
    });
  });

  Promise.all([authorizePromise])
    .then(() => {
      console.log('All promises have been resolved.');
    })
    .catch(err => {
      console.log('An error occurred: ', err);
    });
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
const authorize = async (credentials, callback) => {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log('Token stored to ' + TOKEN_PATH);
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
const findVideos = async (auth, pageToken = null) => {
  const videos = await getVideos(auth, pageToken);

  const videoInfo = await google.youtube('v3').videos.list({
    part: 'id, snippet, contentDetails, fileDetails, liveStreamingDetails, recordingDetails, statistics, status, suggestions, topicDetails, player, processingDetails',
    id: videos.data.items.map(item => item.id.videoId).join(','),
    auth,
  });

  videoInfo.data.items.forEach((video) => {
    fs.writeFile(`./videos/${video.id}.yaml`, dump(video, {}), (err) => {
      if (err) throw err;
    });
  });

  if (videos.data.nextPageToken !== null) {
    return findVideos(auth, videos.data.nextPageToken);
  }
};


const getVideos = async (auth, pageToken) => {
  const service = google.youtube('v3');

  console.log("sending request with page token " + pageToken);

  return await service.search.list({
    part: 'id',
    type: 'video',
    maxResults: 500,
    pageToken: pageToken,
    forMine: true,
    auth,
  })
}
