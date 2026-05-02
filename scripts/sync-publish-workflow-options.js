const { syncPublishWorkflowOptions } = require('./lib/publish-workflow-sync');

try {
    const { workflowPath, draftOptions } = syncPublishWorkflowOptions();
    console.log(`[Workflow] Updated draft choices in ${workflowPath}`);
    console.log(`[Workflow] Available draft options: ${draftOptions.join(', ')}`);
} catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
}
