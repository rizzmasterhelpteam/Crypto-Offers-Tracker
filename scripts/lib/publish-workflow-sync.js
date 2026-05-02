const fs = require('fs');
const path = require('path');
const { listDrafts } = require('./publisher');

const WORKFLOW_PATH = path.join(__dirname, '..', '..', '.github', 'workflows', 'publish.yml');
const START_MARKER = '# AUTO-GENERATED DRAFT OPTIONS START';
const END_MARKER = '# AUTO-GENERATED DRAFT OPTIONS END';
const EMPTY_OPTION = '__no_drafts_available__';

function quoteYaml(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function syncPublishWorkflowOptions() {
    if (!fs.existsSync(WORKFLOW_PATH)) {
        throw new Error(`Publish workflow not found: ${WORKFLOW_PATH}`);
    }

    const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const options = listDrafts().map(draft => draft.fileName);
    const optionValues = options.length > 0 ? options : [EMPTY_OPTION];

    const markerPattern = /(^[ \t]*)# AUTO-GENERATED DRAFT OPTIONS START[\s\S]*?^[ \t]*# AUTO-GENERATED DRAFT OPTIONS END/m;
    const match = workflow.match(markerPattern);
    if (!match) {
        throw new Error('Could not find auto-generated draft option markers in publish workflow.');
    }

    const indent = match[1];
    const replacement = [
        `${indent}${START_MARKER}`,
        ...optionValues.map(option => `${indent}- ${quoteYaml(option)}`),
        `${indent}${END_MARKER}`
    ].join('\n');

    const updatedWorkflow = workflow.replace(markerPattern, replacement);
    if (updatedWorkflow !== workflow) {
        fs.writeFileSync(WORKFLOW_PATH, updatedWorkflow, 'utf8');
    }

    return {
        workflowPath: WORKFLOW_PATH,
        draftOptions: optionValues
    };
}

module.exports = {
    EMPTY_OPTION,
    WORKFLOW_PATH,
    syncPublishWorkflowOptions
};
