const rp = require('request-promise');
const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs');
const request = require('request');

const step = 50;
const limit = 500;
start('selfie');

const query_hash = 'f92f56d47dc7a55b606908374b43a314';
const photos = [];

async function start(tag) {
    const json = await getJSON(`https://www.instagram.com/explore/tags/${tag}/`);

    json.edges.forEach(element => {
        photos.push(element.node);
    });

    let vars = { tag_name: tag, first: step, after: json.cursor };
    let hash = genHash(json.rhx, JSON.stringify(vars));
    let varStr = encodeURIComponent(JSON.stringify(vars));
    let link = `https://www.instagram.com/graphql/query/?query_hash=${query_hash}&variables=${varStr}`;

    let page_info = await getPhotos(link, hash);

    while (page_info.has_next_page && photos.length <= limit) {
        vars = { tag_name: tag, first: step, after: page_info.end_cursor };
        hash = genHash(json.rhx, JSON.stringify(vars));
        varStr = encodeURIComponent(JSON.stringify(vars));
        link = `https://www.instagram.com/graphql/query/?query_hash=${query_hash}&variables=${varStr}`;

        page_info = await getPhotos(link, hash);
        console.log(photos.length);
    }

    for (let i = 0; i < photos.length; i++) {
        download(photos[i].display_url, `./downloads/${photos[i].id}.jpg`);
        fs.writeFile(`./downloads/${photos[i].id}.txt`, JSON.stringify(photos[i]), error => {
            console.log(error);
        });
    }
}

function genHash(rhx_gis, variables) {
    return crypto
        .createHash('md5')
        .update(`${rhx_gis}:${variables}`)
        .digest('hex');
}

function download(uri, filename) {
    request(uri).pipe(fs.createWriteStream(filename));
}

async function getJSON(link) {
    const options = {
        uri: link,
        headers: {
            Host: 'www.instagram.com',
            Connection: 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36'
        }
    };

    const data = await rp(options);
    const $ = cheerio.load(data);

    let script = $('body > script:nth-child(2)').html();
    script = script.replace('window._sharedData = ', '');
    script = script.slice(0, script.length - 1);

    const json = JSON.parse(script);
    return { rhx: json.rhx_gis, cursor: json.entry_data.TagPage[0].graphql.hashtag.edge_hashtag_to_media.page_info.end_cursor, edges: json.entry_data.TagPage[0].graphql.hashtag.edge_hashtag_to_media.edges };
}

async function getPhotos(link, hash) {
    const options = {
        uri: link,
        headers: {
            Host: 'www.instagram.com',
            Connection: 'keep-alive',
            'X-Instagram-GIS': hash,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36'
        }
    };

    const data = await rp(options);
    const json = JSON.parse(data);
    const edges = json.data.hashtag.edge_hashtag_to_media.edges;

    edges.forEach(element => {
        photos.push(element.node);
    });

    return json.data.hashtag.edge_hashtag_to_media.page_info;
}
