// run: node index.js

const {
    Client,
    Events,
    GatewayIntentBits,
    PermissionsBitField,
} = require('discord.js');
const { token, originalVoiceChannelId } = require('./config.json');
const { handleCommand } = require('./features/customCommands');
const { joinVoiceChannel } = require('@discordjs/voice');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // Add intent for voice state
    ],
});

// Store the dynamically created voice channel IDs
const dynamicVoiceChannels = new Set();

// Store bot messages IDs to track them for deletion
const botMessages = new Set();
const userCommandMessages = new Set();

// Store the voice connection
let voiceConnection = null;

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
        botMessages.add(message.id);
        return;
    }
    if (message.content.startsWith('!')) {
        userCommandMessages.add(message.id);
        try {
            const replyMessage = await handleCommand(
                message,
                botMessages,
                userCommandMessages,
                voiceConnection
            );
            if (replyMessage) {
                const sentMessage = await message.reply(replyMessage);
                botMessages.add(sentMessage.id);
            }
        } catch (err) {
            console.error(err);
            message.reply('發生錯誤,指令處理失敗。');
        }
    }
});

client.on(Events.MessageDelete, (message) => {
    if (message.author.bot) return;
    console.log(`${message.author.username}刪除了${message.content}`);
});

client.on(Events.MessageUpdate, (message) => {
    if (message.author.bot) return;
    console.log(
        `${message.author.username}更新了${message.content}改為${message.reactions.message.content}`
    );
});

// Listen for voice state update event
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Check if the user joined the specified voice channel
    if (
        newState.channelId === originalVoiceChannelId &&
        oldState.channelId !== originalVoiceChannelId
    ) {
        const member = newState.member;
        const guild = newState.guild;
        const category = newState.channel.parent;

        // Get the permission settings of the category where the original voice channel is located
        const categoryPermissions = category.permissionOverwrites.cache;

        // Create new voice channel permission settings
        const newChannelPermissions = categoryPermissions.map((permission) => ({
            id: permission.id,
            allow: permission.allow,
            deny: permission.deny,
        }));

        // Create a new voice channel in the same category
        const newChannel = await guild.channels.create({
            name: `${member.user.username}'s Channel`,
            type: 2, // 2 represents a voice channel
            parent: category,
            permissionOverwrites: newChannelPermissions,
        });

        // Move the user to the new voice channel
        await member.voice.setChannel(newChannel);

        // Add the ID of the newly created voice channel to the stored set
        dynamicVoiceChannels.add(newChannel.id);

        // 機器人加入新語音頻道
        voiceConnection = joinVoiceChannel({
            channelId: newChannel.id,
            guildId: newChannel.guild.id,
            adapterCreator: newChannel.guild.voiceAdapterCreator,
        });
    }

    // Check if the user switched from a dynamically created voice channel to another channel
    if (
        dynamicVoiceChannels.has(oldState.channelId) &&
        newState.channelId !== oldState.channelId
    ) {
        const channel = oldState.channel;
        const members = channel.members;
        
        if (channel.members.size === 1) {
            // If there are no other users in the channel, delete it
            try {
                await channel.delete();
                // Remove the channel ID from the stored set
                dynamicVoiceChannels.delete(channel.id);
            } catch (error) {
                console.error('刪除頻道時發生錯誤:', error);
            }
        }
    }
});

// Log in to Discord with your client's token
client.login(token);
