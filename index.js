const { Telegraf } = require('telegraf');
const axios = require('axios');
const xml2js = require('xml2js');
const http = require('http');

// 1. ТВОЙ ТОКЕН
const bot = new Telegraf('8554302863:AAHV5slCNkayIz1_AY9EVJ_VB7Xu2NK--_o');

const parser = new xml2js.Parser();

// Используем зеркало .site (оно часто стабильнее для OPDS)
// Если не сработает через день — поменяй на http://flibusta.is
const FLIBUSTA_HOST = 'https://flibusta.club'; 

bot.start((ctx) => {
    ctx.reply('📚 Привет! Напиши название книги. \n\n💡 Совет: Лучше писать "Название книги", а не просто фамилию автора, иначе я найду только профиль писателя.');
});

bot.on('text', async (ctx) => {
    const query = ctx.message.text;
    ctx.reply(`🔎 Ищу: "${query}"... (это может занять пару секунд)`);

    try {
        const searchUrl = `${FLIBUSTA_HOST}/opds/search?searchTerm=${encodeURIComponent(query)}`;
        
        // 2. МАСКИРОВКА: Притворяемся обычным браузером
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000 // Ждем ответ 15 секунд, потом сдаемся
        });

        parser.parseString(response.data, (err, result) => {
            if (err) {
                console.error('Ошибка парсинга XML:', err);
                return ctx.reply('Сайт вернул что-то странное. Попробуй другой запрос.');
            }

            if (!result.feed || !result.feed.entry) {
                return ctx.reply('🤷‍♂️ Ничего не найдено.');
            }

            const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
            let message = '';
            let booksFound = 0;
            let authorsFound = 0;

            entries.forEach((entry) => {
                if (booksFound >= 5) return; // Максимум 5 книг

                // Проверяем, есть ли ссылки
                let downloadLinks = '';
                
                if (entry.link) {
                    entry.link.forEach(link => {
                        const type = link.$.type;
                        const href = link.$.href;
                        
                        // Если ссылка ведет на скачивание (fix: убираем /opds/ из пути, если он там лишний)
                        // Flibusta.site иногда отдает ссылки без домена, добавляем его
                        let fullLink = href.startsWith('http') ? href : FLIBUSTA_HOST + href;
                        
                        if (type.includes('fb2')) downloadLinks += `📥 [FB2](${fullLink})\n`;
                        if (type.includes('epub')) downloadLinks += `📥 [EPUB](${fullLink})\n`;
                        if (type.includes('mobi')) downloadLinks += `📥 [MOBI](${fullLink})\n`;
                    });
                }

                const title = entry.title[0];

                if (downloadLinks) {
                    // Это КНИГА
                    const author = entry.author ? entry.author[0].name[0] : 'Неизвестен';
                    message += `📖 **${title}**\n👤 ${author}\n${downloadLinks}\n---\n`;
                    booksFound++;
                } else {
                    // Это АВТОР или СЕРИЯ (нет ссылок на скачивание)
                    // Мы их считаем, но не выводим подробно, чтобы не засорять чат
                    authorsFound++;
                }
            });

            if (booksFound > 0) {
                ctx.replyWithMarkdown(message);
            } else if (authorsFound > 0) {
                ctx.reply(`Нашел ${authorsFound} авторов или серий с таким названием, но самих книг с кнопкой "Скачать" в поиске нет.\n\n💡 **Попробуй добавить название конкретной книги.**\nНапример: не "Пелевин", а "Generation П".`);
            } else {
                ctx.reply('Вроде что-то нашел, но ссылок на скачивание нет. Возможно, книга заблокирована по требованию правообладателя.');
            }
        });

    } catch (error) {
        console.error('Ошибка сети:', error.message);
        if (error.code === 'ECONNABORTED') {
            ctx.reply('⏳ Флибуста отвечает слишком долго. Попробуй еще раз через минуту.');
        } else {
            ctx.reply('☠️ Флибуста временно недоступна (ошибка 502/503 или блокировка). Такое бывает, бот тут бессилен. Попробуй позже.');
        }
    }
});

// Server for Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
});
server.listen(process.env.PORT || 3000);

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
