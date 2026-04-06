import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { jidDecode } from "@whiskeysockets/baileys";
import { getPlugins } from "../../handlers/plugins.js";
import axios from "axios";

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

// أرقام دائرية
const circledNumbers = {
  1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤", 6: "⑥", 7: "⑦", 8: "⑧", 9: "⑨", 10: "⑩",
  11: "⑪", 12: "⑫", 13: "⑬", 14: "⑭", 15: "⑮", 16: "⑯", 17: "⑰", 18: "⑱", 19: "⑲", 20: "⑳"
};

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
        let categories = [];
        if (fs.existsSync(pluginsRoot)) {
            categories = fs.readdirSync(pluginsRoot).filter((dir) => 
                fs.statSync(path.join(pluginsRoot, dir)).isDirectory()
            );
        }

        // ترجمة أسماء المجلدات إلى أسماء عربية مع أيقونات
        const categoryTranslation = {
            "قائمة1": { name: "الـمـجـمـوعـات", icon: "👮🏻‍♂️" },
            "قائمة2": { name: "الأدوات", icon: "🛠️" },
            "قائمة3": { name: "الــتــرفــيــة", icon: "✨" },
            "قائمة4": { name: "الــتــحــمــيــلات", icon: "⬇️" },
            "قائمة5": { name: "الألــعــاب", icon: "🎮" },
            "قائمة6": { name: "الــنــخــبــة", icon: "🔱" },
            "قائمة7": { name: "الاعــدادات", icon: "⚙️" },
            "قائمة8": { name: "الــوســائط", icon: "📌" }
        };

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
        const botName = "𝑲 𝒊 𝒍 𝒍 𝒖 𝒂 - 𝑩𝛩𝑻";

        // بناء قائمة الفئات
        let categoriesList = "";
        for (let i = 0; i < categories.length; i++) {
            const folderName = categories[i];
            const translation = categoryTranslation[folderName] || { name: folderName, icon: "📂" };
            const circledNum = circledNumbers[i+1] || `${i+1}`;
            
            categoriesList += `*${circledNum}‹ ˼ \`.${folderName}\` ˹*\n`;
            categoriesList += `*◇ •﹝قـسـم ${translation.name}╵${translation.icon}╷⤹﹞*\n`;
        }

        // القائمة الرئيسية (نص)
        const mainMenuText = `*⎔═━━═━ ╃━╷⚜️╵━╄ ━═━━═⎔*
*❏ •﹝ ╵ \`صـلـي عـلـي مـحـمـد\`╷⤹🌹﹞*
*⎔═━━═━ ╃━╷⚜️╵━╄ ━═━━═⎔*
*❏ •﹝مـرحـبـا بـك يـا ╵ ${sender.split('@')[0]} ╷⤹﹞*
*⎔═━══━═━═━━═━═━═⎔*
*﹝˼🌟˹ \`مـعـلـومـات الـبـوت\` ˼🌟˹﹞*
*⎔═━══━═━═━━═━═━═⎔*
*⧉ • الـمـطـور ⤹ ╵ كــيــلوا 👨🏻‍💻╷*
*※ • اسـم الـبـوت ⤹ ╵ ${botName} ╷*
*☆ • وقـت الـتـشـغـيـل ⤹ ╵ ${uptimeStr} ╷*
*⎔═━══━═━˼🌿˹═━━═━═⎔*
*﹝˼˹ \`مـعـلـومـات الـمـسـتـخـدم\` ˼˹﹞*
*⎔═━══━═━˼🦅˹═━━═━═⎔*
*⧉ • مـسـتـواڰ ⤹ ╵ \`0\` ╷*
*⧉ • رتـبـتڰ ⤹ ╵ \`مــشــرد\` ╷*
*⧉ • مـنـشـنـڰ ⤹ ╵ @${sender.split('@')[0]} ╷*
*⎔═━═━ ╃━╷⚜️╵━╄ ━═━═⎔*
*﹝˼📖˹ \`قــــــؤائـــم الـبـــــوت\` ˼📖˹﹞*
*⎔═━═━ ╃━〔🪻〕━╄ ━═━═⎔*
${categoriesList}
*⎔═━═━ ╃━╷⚜️╵━╄ ━═━═⎔*

> ⏤͟͟͞͞ ~ 𝑲𝒓𝒐𝒍𝒍𝒐 - 𝑩𝛩𝑻 🕸⃝⃕`;

        // رابط الصورة من الإنترنت
        const imageUrl = "https://cityupload.io/2026/04/40422f207beffab521842104974ad15b.jpg";
        
        // معرف القناة (JID حقيقي للقناة)
        const channelJid = "120363333333333333@newsletter"; // ⚠️ غير هذا إلى JID قناتك الحقيقي
        const channelName = "𝑲𝒓𝒐𝒍𝒍𝒐 𝑩𝒐𝒕";
        
        let sentMsg;
        
        // إرسال القائمة مع إعادة توجيه من القناة
        const contextInfoWithChannel = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: channelJid,
                newsletterName: channelName,
                serverMessageId: Date.now().toString()
            }
        };
        
        // تحميل الصورة من الرابط وإرسالها مع إعادة التوجيه
        try {
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data, 'binary');
            
            sentMsg = await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: mainMenuText,
                mentions: [sender],
                contextInfo: contextInfoWithChannel
            }, { quoted: msg });
            console.log("✅ تم إرسال القائمة مع الصورة وإعادة التوجيه من القناة");
        } catch (err) {
            console.log("⚠️ فشل تحميل الصورة من الرابط:", err.message);
            // إذا فشل تحميل الصورة، نرسل نص فقط مع إعادة التوجيه
            sentMsg = await sock.sendMessage(chatId, { 
                text: mainMenuText, 
                mentions: [sender],
                contextInfo: contextInfoWithChannel
            }, { quoted: msg });
        }
        
        const botMsgKey = sentMsg.key;

        let state = "MAIN";
        let sessionTimer;

        const updateMessage = async (newText, mentionsList = []) => {
            const newMsg = await sock.sendMessage(chatId, { 
                text: newText, 
                mentions: mentionsList,
                contextInfo: contextInfoWithChannel
            }, { quoted: msg });
            return newMsg.key;
        };

        const showCategoryCommands = async (folderName) => {
            const plugins = getPlugins();
            const commandsList = [];

            for (const plugin of Object.values(plugins)) {
                if (!plugin || plugin.hidden) continue;
                const pluginPath = plugin.filePath || "";
                if (pluginPath.includes(`/plugins/${folderName}/`)) {
                    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
                    const suffix = getCommandStatusSuffix(plugin);
                    commandsList.push(`${cmds[0]}${suffix}`);
                }
            }

            const translation = categoryTranslation[folderName] || { name: folderName, icon: "📂" };

            let categoryMenu = `*⎔═━ ╃━╷⚜️╵━╄ ━═⎔*
*❏ ﹝╵\`صـلـي عـلـي مـحـمـد\`╷⤹﹞*
*⎔═━ ╃━╷🌲╵━╄ ━═⎔*
*❏ •﹝مـرحـبـا بـك يـا ╵ ${sender.split('@')[0]} ╷⤹﹞*
*⎔═━═━ ╃━╷🏷️╵━╄ ━═━═⎔*
*﹝˼🏷️˹ \`قـسـم ${translation.name}\` ˼🏷️˹﹞*
*⎔═━═━ ╃━╷🏷️╵━╄ ━═━═⎔*\n\n`;

            if (commandsList.length === 0) {
                categoryMenu += `*❗ لا توجد أوامر في هذه الفئة*\n\n`;
            } else {
                for (let i = 0; i < commandsList.length && i < 10; i++) {
                    const circledNum = circledNumbers[i+1] || `${i+1}`;
                    categoryMenu += `*${circledNum}┊⇇ ◝˼ \`${commandsList[i]}\` ˹◟*\n`;
                }
                if (commandsList.length > 10) {
                    categoryMenu += `\n*✨ و ${commandsList.length - 10} أمر آخر...*\n`;
                }
            }

            categoryMenu += `\n*⎔═━═━ ╃━╷⚜️╵━╄ ━═━═⎔*
> ⏤͟͟͞͞ ~ 𝑲𝒓𝒐𝒍𝒍𝒐 - 𝑩𝛩𝑻 🕸⃝⃕`;

            const newKey = await updateMessage(categoryMenu);
            Object.assign(botMsgKey, newKey);
            state = "CATEGORY_VIEW";
            resetTimer();
        };

        const listener = async ({ messages }) => {
            const newMsg = messages[0];
            if (!newMsg.message || newMsg.key.remoteJid !== chatId) return;
            const newSender = decode(newMsg.key.participant || newMsg.key.remoteJid);
            if (newSender !== sender) return;
            
            let input = newMsg.message?.conversation || newMsg.message?.extendedTextMessage?.text || "";
            if (!input) return;
            input = input.trim();
            
            // إزالة النقطة من البداية إذا وجدت
            let cleanInput = input;
            if (cleanInput.startsWith('.')) {
                cleanInput = cleanInput.substring(1);
            }

            if (cleanInput === "رجوع") {
                if (state === "CATEGORY_VIEW") {
                    await sock.sendMessage(chatId, { react: { text: "🔙", key: newMsg.key } });
                    // العودة للقائمة الرئيسية مع الصورة وإعادة التوجيه
                    try {
                        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                        const imageBuffer = Buffer.from(response.data, 'binary');
                        const newMainMsg = await sock.sendMessage(chatId, {
                            image: imageBuffer,
                            caption: mainMenuText,
                            mentions: [sender],
                            contextInfo: contextInfoWithChannel
                        }, { quoted: msg });
                        Object.assign(botMsgKey, newMainMsg.key);
                    } catch (err) {
                        const newMainMsg = await sock.sendMessage(chatId, { 
                            text: mainMenuText, 
                            mentions: [sender],
                            contextInfo: contextInfoWithChannel
                        }, { quoted: msg });
                        Object.assign(botMsgKey, newMainMsg.key);
                    }
                    state = "MAIN";
                    resetTimer();
                }
                return;
            }

            if (state === "MAIN") {
                let selectedFolder = null;
                const num = parseInt(cleanInput);
                
                if (!isNaN(num) && num >= 1 && num <= categories.length) {
                    selectedFolder = categories[num - 1];
                }
                if (!selectedFolder) {
                    selectedFolder = categories.find(c => c === cleanInput);
                }

                if (selectedFolder) {
                    await sock.sendMessage(chatId, { react: { text: "🆗", key: newMsg.key } });
                    await showCategoryCommands(selectedFolder);
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