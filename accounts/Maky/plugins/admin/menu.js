import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { jidDecode } from "@whiskeysockets/baileys";
import { getPlugins } from "../../handlers/plugins.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeMenuSessions = new Map();

const NovaUltra = {
  command: "اوامر", 
  description: "قائمة الأوامر التفاعلية — Ultra Nova",
  elite: "off",
  lock: "off",
  nova: "on"
};

function decode(jid) {
  return (jidDecode(jid)?.user || jid.split("@")[0]) + "@s.whatsapp.net";
}

function getCommandStatusSuffix(plugin) {
  let suffix = "";
  const isElite = plugin.elite === "on";
  const isLocked = plugin.lock === "on";
  
  const adminKeywords = [
    "طرد", "حظر", "رفع", "خفض", "تغيير", "قفل", "فتح", 
    "kick", "ban", "promote", "demote", "admin", "group", "tagall", "hidetag"
  ];

  const cmdArray = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
  const textToCheck = ((plugin.description || "") + " " + cmdArray.join(" ")).toLowerCase();
  const isAdminRelated = adminKeywords.some(k => textToCheck.includes(k)) || plugin.admin === true || plugin.group === true;

  if (isLocked) suffix += " 🔒";
  if (isElite) suffix += " 🔰";
  if (!isLocked && !isElite && isAdminRelated) suffix += " ⚠️";

  return suffix; 
}

async function execute({ sock, msg, args }) {
    const chatId = msg.key.remoteJid;
    const sender = decode(msg.key.participant || chatId);

    if (activeMenuSessions.has(chatId)) {
        const oldSession = activeMenuSessions.get(chatId);
        sock.ev.off("messages.upsert", oldSession.listener);
        clearTimeout(oldSession.timer);
        activeMenuSessions.delete(chatId);
    }

    try {
        const pluginsRoot = path.join(process.cwd(), "plugins");
        const categories = fs.readdirSync(pluginsRoot).filter((dir) => fs.statSync(path.join(pluginsRoot, dir)).isDirectory());

        const allPlugins = getPlugins();
        let totalCmds = 0, eliteCmds = 0, lockedCmds = 0, unsafeCmds = 0;

        for (const plugin of Object.values(allPlugins)) {
            if (!plugin || plugin.hidden) continue;
            totalCmds++;
            if (plugin.elite === "on") eliteCmds++;
            if (plugin.lock === "on") lockedCmds++;
            
            const cmdArray = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
            const textToCheck = ((plugin.description || "") + " " + cmdArray.join(" ")).toLowerCase();
            const isAdminRelated = textToCheck.includes("طرد") || textToCheck.includes("حظر") || plugin.admin === true || plugin.group === true;
            if (!plugin.lock && plugin.elite !== "on" && isAdminRelated) unsafeCmds++;
        }

        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeStr = `${hours} ساعة ${minutes} دقيقة`;
        const ownerNumber = "22248049282";
        const botName = "𝐊𝐑𝐎𝐋𝐋𝐎";

        // قائمة الفئات الرئيسية
        const categoryIcons = {
            "المجموعات": "👮🏻‍♂️",
            "الادوات": "🛠️",
            "الترفيه": "✨",
            "التحميلات": "⬇️",
            "الألعاب": "🎮",
            "الملصقات": "🌰",
            "الاعدادات": "⚙️",
            "الألقاب": "📌"
        };

        let categoriesList = "";
        for (let i = 0; i < categories.length && i < 8; i++) {
            const cat = categories[i];
            const icon = categoryIcons[cat] || "📂";
            categoriesList += `*┇${i+1}‹ ˼ \`${cat}\` ˹*\n*◇ •﹝قـسـم ${cat}╵${icon}╷⤹﹞*\n`;
        }

        const mainMenu = `*⎔═━━═━ ╃━╷⚜️╵━╄ ━═━━═⎔*
*❏ •﹝ ╵ \`صـلـي عـلـي مـحـمـد\`╷⤹🌹﹞*
*⎔═━━═━ ╃━╷⚜️╵━╄ ━═━━═⎔*
*❏ •﹝مـرحـبـا بـك يـا ╵ ${sender.split('@')[0]} ╷⤹﹞*
*⎔═━══━═━═━━═━═━═⎔*
*﹝˼🌟˹ \`مـعـلـومـات الـبـوت\` ˼🌟˹﹞*
*⎔═━══━═━═━━═━═━═⎔*
*⧉ • الـمـطـور ⤹ ╵ ${ownerNumber} 👨🏻‍💻╷*
*※ • اسـم الـبـوت ⤹ ╵ ${botName} ╷*
*☆ • وقـت الـتـشـغـيـل ⤹ ╵ ${uptimeStr} ╷*
*⎔═━══━═━˼🌿˹═━━═━═⎔*
*﹝˼˹ \`مـعـلـومـات الـمـسـتـخـدم\` ˼˹﹞*
*⎔═━══━═━˼🦅˹═━━═━═⎔*
*⧉ • مـسـتـواڰ ⤹ ╵ \`0\` ╷*
*⧉ • رتـبـتڰ ⤹ ╵ \`عضو\` ╷*
*⧉ • مـنـشـنـڰ ⤹ ╵ @${sender.split('@')[0]} ╷*
*⎔═━═━ ╃━╷⚜️╵━╄ ━═━═⎔*
*﹝˼📖˹ \`قــــــؤائـــم الـبـــــوت\` ˼📖˹﹞*
*⎔═━═━ ╃━〔🪻〕━╄ ━═━═⎔*
${categoriesList}
*⎔═━═━ ╃━╷⚜️╵━╄ ━═━═⎔*
*✅️ اجمالي عدد الاوامر:* ${totalCmds}
*🛡 اوامر النخبة:* ${eliteCmds}
*🔐 الاوامر المقفلة:* ${lockedCmds}
*⚠️ الاوامر الحساسة:* ${unsafeCmds}

↩️ *اكتب رقم الفئة أو اسمها*

*⎔═━═━ ╃━╷⚜️╵━╄ ━═━═⎔*
> ⏤͟͟͞͞ ~ 𝑲𝒓𝒐𝒍𝒍𝒐 - 𝑩𝛩𝑻 🕸⃝⃕`;

        const sentMsg = await sock.sendMessage(chatId, { text: mainMenu, mentions: [sender] }, { quoted: msg });
        const botMsgKey = sentMsg.key;

        let state = "MAIN";
        let sessionTimer;

        const updateMessage = async (newText, mentionsList = []) => {
            await sock.sendMessage(chatId, { text: newText, edit: botMsgKey, mentions: mentionsList });
        };

        const showCategoryCommands = async (categoryName) => {
            const plugins = getPlugins();
            const commandsList = [];

            for (const plugin of Object.values(plugins)) {
                if (!plugin || plugin.hidden) continue;
                const pluginPath = plugin.filePath || "";
                if (pluginPath.includes(`/plugins/${categoryName}/`)) {
                    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
                    const suffix = getCommandStatusSuffix(plugin);
                    commandsList.push(`${cmds[0]}${suffix}`);
                }
            }

            let categoryMenu = `*⎔═━ ╃━╷⚜️╵━╄ ━═⎔*
*❏ ﹝╵\`صـلـي عـلـي مـحـمـد\`╷⤹﹞*
*⎔═━ ╃━╷🌲╵━╄ ━═⎔*
*❏ •﹝مـرحـبـا بـك يـا ╵ ${sender.split('@')[0]} ╷⤹﹞*
*⎔═━═━ ╃━╷🏷️╵━╄ ━═━═⎔*
*﹝˼🏷️˹ \`قـسـم ${categoryName}\` ˼🏷️˹﹞*
*⎔═━═━ ╃━╷🏷️╵━╄ ━═━═⎔*\n\n`;

            if (commandsList.length === 0) {
                categoryMenu += `*❗ لا توجد أوامر في هذه الفئة*\n\n`;
            } else {
                for (let i = 0; i < commandsList.length && i < 10; i++) {
                    categoryMenu += `*${i+1}┊⇇ ◝˼ \`${commandsList[i]}\` ˹◟*\n`;
                }
                if (commandsList.length > 10) {
                    categoryMenu += `\n*✨ و ${commandsList.length - 10} أمر آخر...*\n`;
                }
            }

            categoryMenu += `\n*⎔═━═━ ╃━╷⚜️╵━╄ ━═━═⎔*
> ⏤͟͟͞͞ ~ 𝑲𝒓𝒐𝒍𝒍𝒐 - 𝑩𝛩𝑻 🕸⃝⃕

↩️ *اكتب "رجوع" للعودة*`;

            await updateMessage(categoryMenu);
            state = "CATEGORY_VIEW";
            resetTimer();
        };

        const listener = async ({ messages }) => {
            const newMsg = messages[0];
            if (!newMsg.message || newMsg.key.remoteJid !== chatId) return;
            const newSender = decode(newMsg.key.participant || newMsg.key.remoteJid);
            if (newSender !== sender) return;
            const text = newMsg.message?.conversation || newMsg.message?.extendedTextMessage?.text || "";
            if (!text) return;
            const input = text.trim();

            if (input === "رجوع") {
                if (state === "CATEGORY_VIEW") {
                    await sock.sendMessage(chatId, { react: { text: "🔙", key: newMsg.key } });
                    await updateMessage(mainMenu, [sender]);
                    state = "MAIN";
                    resetTimer();
                }
                return;
            }

            if (state === "MAIN") {
                let selectedCategory = null;
                const num = parseInt(input);
                if (!isNaN(num) && num >= 1 && num <= categories.length) {
                    selectedCategory = categories[num - 1];
                }
                if (!selectedCategory) {
                    selectedCategory = categories.find(c => c.toLowerCase() === input.toLowerCase());
                }

                if (selectedCategory) {
                    await sock.sendMessage(chatId, { react: { text: "🆗", key: newMsg.key } });
                    await showCategoryCommands(selectedCategory);
                    resetTimer();
                }
            }
        };

        const resetTimer = () => {
            if (sessionTimer) clearTimeout(sessionTimer);
            sessionTimer = setTimeout(() => {
                sock.ev.off("messages.upsert", listener);
                activeMenuSessions.delete(chatId);
            }, 3 * 60 * 1000);
            activeMenuSessions.set(chatId, { listener, timer: sessionTimer });
        };

        resetTimer();
        sock.ev.on("messages.upsert", listener);

    } catch (err) {
        console.error("Menu Error:", err);
        await sock.sendMessage(chatId, { text: "❌ حدث خطأ أثناء إنشاء القائمة." });
    }
}

export default { NovaUltra, execute };