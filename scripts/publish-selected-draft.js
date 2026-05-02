const path = require('path');
const utils = require('./lib/utils');
const { publishDraftByName } = require('./lib/publisher');
async function run() {
    let draftFile = process.env.DRAFT_FILE || process.argv[2];
    if (!draftFile) {
        throw new Error('Missing draft selection. Provide DRAFT_FILE or pass the draft file name as an argument.');
    }

    if (!draftFile.endsWith('.html')) {
        draftFile += '.html';
    }

    console.log(`[Publish] Publishing selected draft: ${draftFile}`);
    const { outputPath, archivedPath } = publishDraftByName(draftFile);

    console.log('[Publish] Syncing blog index...');
    utils.syncBlogIndex();

    console.log(`[Publish] Published blog post: ${path.relative(process.cwd(), outputPath).replace(/\\/g, '/')}`);
    console.log(`[Publish] Archived draft source: ${path.relative(process.cwd(), archivedPath).replace(/\\/g, '/')}`);
}

run().catch(err => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
});
