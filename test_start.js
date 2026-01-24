const youtube = require('youtube-sr').default;

async function test() {
    console.log("Searching...");
    const videos = await youtube.search("Never Gonna Give You Up Rick Astley");
    if (videos.length > 0) {
        console.log("KEYS:", Object.keys(videos[0]));
        console.log("DESCRIPTION:", videos[0].description);
    }
}

test();
