const { Telegraf } = require('telegraf');
const axios = require('axios');
const xml2js = require('xml2js');
const http = require('http');
const { HttpsProxyAgent } = require('https-proxy-agent');

// --- НАСТРОЙКИ ---
const BOT_TOKEN = '8554302863:AAHV5slCNkayIz1_AY9EVJ_VB7Xu2NK--_o';

// СЮДА ВСТАВЬ IP:PORT, который ты нашел (например: '194.169.1.2:8080')
// Обязательно оставь http:// перед цифрами!
const PROXY_URL = 'http://85.220.141.220:80'; 

const FLIBUSTA_HOST = 'https://flibusta.site'; 
// -----------------

const bot = new Telegraf(BOT_TOKEN);
const parser = new xml2js.Parser();

// Создаем "агента", который понесет наш запрос через прокси
const agent = new HttpsProxyAgent(PROXY_URL);

bot.start((ctx) => {
    ctx.reply('🕵️ Бот работает в режиме "Ниндзя" (через прокси).\nПиши название книги!');
});

bot.on('text', async (ctx) => {
    const query = ctx.message.text;
    ctx.reply(`🔎 Ищу: "${query}"...`);

    try {
        const searchUrl = `${FLIBUSTA_HOST}/opds/search?searchTerm=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 20000, // Даем прокси 20 секунд на раздумья
            httpsAgent: agent, // Подключаем агента для HTTPS
            httpAgent: agent,  // И для HTTP на всякий случай
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
            }
        });

        parser.parseString(response.data, (err, result) => {
            if (err) return ctx.reply('Прокси сработал, но Флибуста вернула кривые данные. Попробуй другую книгу.');
            
            if (!result.feed || !result.feed.entry) return ctx.reply('Ничего не найдено.');

            const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
            let message = '';
            let count = 0;

            entries.forEach((book) => {
                if (count >= 5) return;
                
                let links = '';
                if (book.link) {
                    book.link.forEach(l => {
                        const href = l.$.href;
                        // Ссылка на скачивание тоже должна идти через зеркало
                        const fullLink = href.startsWith('http') ? href : FLIBUSTA_HOST + href;
                        
                        if (l.$.type.includes('fb2')) links += `📦 [FB2](${fullLink})\n`;
                        if (l.$.type.includes('epub')) links += `📦 [EPUB](${fullLink})\n`;
                    });
                }

                if (links) {
                    message += `📖 **${book.title[0]}**\n👤 ${book.author ? book.author[0].name[0] : ''}\n${links}\n---\n`;
                    count++;
                }
            });

            if (message) ctx.replyWithMarkdown(message);
            else ctx.reply('Книги есть, но скачать нельзя (только авторы).');
        });

    } catch (error) {
        console.error(error.message);
        ctx.reply(`❌ Ошибка прокси. Скорее всего, адрес ${PROXY_URL} умер или слишком медленный.\n\nНужно найти новый IP и поменять его в коде.`);
    }
});

// Server for Render
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Alive');
});
server.listen(process.env.PORT || 3000);

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
