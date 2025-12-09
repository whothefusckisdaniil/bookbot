const { Telegraf } = require('telegraf');
const axios = require('axios');
const xml2js = require('xml2js');
const http = require('http');

// 1. ВСТАВЬ ТОКЕН СЮДА
const bot = new Telegraf('8554302863:AAHV5slCNkayIz1_AY9EVJ_VB7Xu2NK--_o');

const parser = new xml2js.Parser();
// Используем зеркало, которое лучше всего работает с серверов
const FLIBUSTA_HOST = 'http://flibusta.is'; 

bot.start((ctx) => {
    ctx.reply('Привет! Напиши название книги или автора. Я отфильтрую лишнее и дам ссылки.');
});

bot.on('text', async (ctx) => {
    const query = ctx.message.text;
    ctx.reply(`🔎 Ищу: "${query}"...`);

    try {
        const searchUrl = `${FLIBUSTA_HOST}/opds/search?searchTerm=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl);

        parser.parseString(response.data, (err, result) => {
            if (err) {
                console.error(err);
                return ctx.reply('Ошибка обработки данных.');
            }

            // Проверяем структуру ответа
            if (!result.feed || !result.feed.entry) {
                return ctx.reply('Ничего не найдено или Флибуста вернула пустой список.');
            }

            const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
            let message = '';
            let foundBooksCount = 0;

            // Перебираем все результаты
            entries.forEach((book) => {
                // Ограничение: показываем максимум 5 КНИГ (чтобы не спамить)
                if (foundBooksCount >= 5) return;

                // 1. Сначала собираем ссылки на скачивание
                let linksMessage = '';
                let hasDownloadLinks = false;

                if (book.link) {
                    book.link.forEach(link => {
                        const type = link.$.type;
                        const href = link.$.href;
                        
                        // Ищем только файлы книг
                        if (type.includes('fb2')) {
                            linksMessage += `⬇ [FB2](${FLIBUSTA_HOST}${href.replace('/opds', '')})\n`; // фикс ссылки
                            hasDownloadLinks = true;
                        }
                        else if (type.includes('epub')) {
                            linksMessage += `⬇ [EPUB](${FLIBUSTA_HOST}${href.replace('/opds', '')})\n`;
                            hasDownloadLinks = true;
                        }
                        else if (type.includes('mobi')) {
                            linksMessage += `⬇ [MOBI](${FLIBUSTA_HOST}${href.replace('/opds', '')})\n`;
                            hasDownloadLinks = true;
                        }
                    });
                }

                // 2. ВАЖНЫЙ МОМЕНТ: Добавляем в ответ ТОЛЬКО если нашли ссылки на скачивание
                if (hasDownloadLinks) {
                    const title = book.title[0];
                    const author = book.author ? book.author[0].name[0] : 'Автор не указан';
                    
                    message += `📖 **${title}**\n👤 ${author}\n${linksMessage}\n---\n`;
                    foundBooksCount++;
                }
            });

            if (message.length === 0) {
                ctx.reply('Вроде что-то нашел, но скачать нельзя (возможно, это просто категории). Попробуй уточнить запрос.');
            } else {
                ctx.replyWithMarkdown(message);
            }
        });

    } catch (error) {
        console.error('Ошибка:', error.message);
        ctx.reply('Флибуста не отвечает или ошибка сети.');
    }
});

// HTTP сервер для Render (чтобы не засыпал)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
});
server.listen(process.env.PORT || 3000);

// Запуск бота
bot.launch();
console.log('Бот запущен...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
