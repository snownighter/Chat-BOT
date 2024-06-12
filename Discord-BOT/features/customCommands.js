// features/customCommands.js

const { readFileAsync, writeFileAsync } = require('../utils/fileUtils');
const { processDialogue } = require('../utils/dialogue');

const sodium = require('libsodium-wrappers');

(async () => {
    await sodium.ready;
})();

// 播放音檔
const {
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
} = require('@discordjs/voice');

const cache = {}; // 快取所有伺服器的指令
const botMessages = new Set(); // Store bot messages IDs to track them for deletion
const userCommandMessages = new Set(); // Store user command messages IDs to track them for deletion

async function addCommand(guildId, commandName, replyMessage) {
    const commands = await getCommands(guildId);

    const lowercaseCommandName = commandName.toLowerCase();
    if (['add', 'edit', 'remove', 'clear'].includes(lowercaseCommandName)) {
        return '禁止使用保留關鍵字作為指令名稱。';
    }

    if (!commandName || !replyMessage) {
        return '請使用正確的格式：!add [指令名稱] [回覆內容]';
    }

    commands[lowercaseCommandName] = replyMessage;
    await saveCommands(guildId, commands);

    return `已新增指令「${lowercaseCommandName}」，回覆訊息為：${replyMessage}`;
}

async function editCommand(guildId, commandName, replyMessage) {
    const commands = await getCommands(guildId);

    const lowercaseCommandName = commandName.toLowerCase();
    if (!commands[lowercaseCommandName]) {
        return `找不到指令「${commandName}」，請先使用 !add 新增指令。`;
    }

    if (!replyMessage) {
        return '請設定回覆訊息：!edit [指令名稱] [回覆內容]';
    }

    commands[lowercaseCommandName] = replyMessage;
    await saveCommands(guildId, commands);

    return `已編輯指令「${lowercaseCommandName}」的回覆訊息為：${replyMessage}`;
}

async function removeCommand(guildId, commandName) {
    const commands = await getCommands(guildId);

    const lowercaseCommandName = commandName.toLowerCase();
    if (!commands[lowercaseCommandName]) {
        return `找不到指令「${commandName}」，請先使用 !add 新增指令。`;
    }

    delete commands[lowercaseCommandName];
    await saveCommands(guildId, commands);

    return `已刪除指令「${lowercaseCommandName}」`;
}

async function getCommands(guildId) {
    if (!cache[guildId]) {
        try {
            const filePath = `server/${guildId}.json`;
            const data = await readFileAsync(filePath);
            cache[guildId] = data || {};
        } catch (err) {
            console.error(err);
            cache[guildId] = {};
        }
    }

    return cache[guildId];
}

async function saveCommands(guildId, commands) {
    try {
        const filePath = `server/${guildId}.json`;
        await writeFileAsync(filePath, commands);
        cache[guildId] = commands;
    } catch (err) {
        console.error(err);
    }
}

async function processCustomCommand(guildId, command) {
    const lowercaseCommand = command.toLowerCase();
    const commands = await getCommands(guildId);

    if (commands[lowercaseCommand]) {
        return commands[lowercaseCommand];
    } else {
        return '無效的指令！請使用 !add、!edit 或 !remove 來管理指令。';
    }
}

async function handleCommand(
    message,
    botMessages,
    userCommandMessages,
    voiceConnection
) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const guildId = message.guild.id;

    if (['add', 'edit', 'remove'].includes(command)) {
        if (command === 'add') {
            const commandName = args.shift();
            const replyMessage = args.join(' ');
            return await addCommand(guildId, commandName, replyMessage);
        } else if (command === 'edit') {
            const commandName = args.shift();
            const replyMessage = args.join(' ');
            return await editCommand(guildId, commandName, replyMessage);
        } else if (command === 'remove') {
            const commandName = args.shift();
            return await removeCommand(guildId, commandName);
        }
    } else if (command === 'chat') {
        // 只處理 !chat 指令的對話
        const chatMessage = args.join(' ');
        if (chatMessage) {
            try {
                const response = await processDialogue(chatMessage);
                if (response && response.text) {
                    const botReply = await message.reply(response.text);
                    botMessages.add(botReply.id);
                    if (response.audio && voiceConnection) {
                        playAudio(voiceConnection, response.audio);
                    }
                }
            } catch (err) {
                console.error('處理對話時發生錯誤:', err);
            }
        } else {
            return '請提供一個有效的訊息來進行對話。';
        }
    } else if (command === 'clear') {
        await clearBotMessages(
            message.channel,
            botMessages,
            userCommandMessages
        );
        return;
    } else if (command === 'help') {
        return await helpCommand(guildId);
    } else {
        return await processCustomCommand(guildId, command);
    }
}

function playAudio(connection, audioFileName) {
    const player = createAudioPlayer();
    const resource = createAudioResource(`C:/Users/user/OneDrive/桌面/chatbot/Discord-BOT/audio/vocal/${audioFileName}.mp3`);
    player.play(resource);
    connection.subscribe(player);
}

// Function to clear bot messages in a channel
async function clearBotMessages(channel, botMessages, userCommandMessages) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const messagesToDelete = messages.filter(
            (m) => botMessages.has(m.id) || userCommandMessages.has(m.id)
        );
        await channel.bulkDelete(messagesToDelete);
        messagesToDelete.forEach((m) => {
            botMessages.delete(m.id);
            userCommandMessages.delete(m.id);
        });
    } catch (err) {
        console.error('清除訊息時發生錯誤:', err);
    }
}

// Function to provide help information
async function helpCommand(guildId) {
    const commands = await getCommands(guildId);
    const commandList = Object.keys(commands)
        .map((cmd) => `!${cmd}`)
        .join('\n');
    return `可用的指令如下:\n${commandList}`;
}

module.exports = {
    addCommand,
    editCommand,
    removeCommand,
    handleCommand,
};
