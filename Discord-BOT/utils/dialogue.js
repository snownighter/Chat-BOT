// utils/dialogue.js
const xlsx = require('xlsx');
const path = require('path');

const dialogueFilePath = path.resolve(__dirname, '../data/dialogue.xlsx');

function readDialogueFile() {
    const workbook = xlsx.readFile(dialogueFilePath);
    const sheetName = workbook.SheetNames[0]; // 假設所有資料都在第一張工作表
    const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    return worksheet;
}

function getRandomResponse(message) {
    const data = readDialogueFile();
    let responses = [];

    data.forEach((row) => {
        const keyRegex = new RegExp(`${row.key}`, 'i'); // 使用更簡單的正則表達式進行匹配
        if (keyRegex.test(message)) {
            responses.push(row);
        }
    });

    if (responses.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
}

async function processDialogue(message) {
    const response = getRandomResponse(message);
    if (response) {
        return { text: response.value, audio: response.audio };
    } else {
        return { text: '抱歉，找不到相應的回應。', audio: null };
    }
}

module.exports = {
    processDialogue,
};
