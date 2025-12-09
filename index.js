const { Telegraf } = require('telegraf');
const axios = require('axios');
const xml2js = require('xml2js');

// 1. Вставь свой токен сюда (обязательно в кавычках)
const bot = new Telegraf('8554302863:AAHV5slCNkayIz1_AY9EVJ_VB7Xu2NK--_o');

// Парсер XML
const parser = new xml2js.Parser();

// Ссылка на Флибусту (если основной сайт блокируется провайдером, бот может не работать без VPN/Proxy)
const FLIBUSTA_HOST = 'http://flibusta.is'; 

bot.start((ctx) => {
    ctx.reply('Привет! Напиши мне название книги, и я поищу её на Флибусте.');
});

bot.on('text', async (ctx) => {
    const query = ctx.message.text;
    ctx.reply(`🔎 Ищу: "${query}"...`);

    try {
        // 2. Делаем запрос к OPDS каталогу
        // encodeURIComponent нужен, чтобы русский текст превратился в понятный ссылке код
        const searchUrl = `${FLIBUSTA_HOST}/opds/search?searchTerm=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl);

        // 3. Парсим XML ответ в удобный объект
        parser.parseString(response.data, (err, result) => {
            if (err) {
                console.error(err);
                return ctx.reply('Ошибка при чтении данных с сайта.');
            }

            // Проверяем, есть ли результаты (в структуре XML это feed -> entry)
            const entries = result.feed.entry;

            if (!entries) {
                return ctx.reply('Ничего не найдено 😔');
            }

            // Если результат один, xml2js не делает массив, делаем его сами
            const books = Array.isArray(entries) ? entries : [entries];

            // 4. Формируем ответ (берем первые 5 книг, чтобы не спамить)
            let message = '';
            books.slice(0, 5).forEach((book) => {
                const title = book.title[0];
                // Ищем автора (иногда его нет)
                const author = book.author ? book.author[0].name[0] : 'Неизвестен';
                
                message += `📖 **${title}**\n👤 ${author}\n`;

                // Ищем ссылки на скачивание (fb2, epub)
                if (book.link) {
                    book.link.forEach(link => {
                        const type = link.$.type;
                        const href = link.$.href;
                        
                        if (type.includes('fb2')) message += `⬇ [FB2](${FLIBUSTA_HOST}${href})\n`;
                        if (type.includes('epub')) message += `⬇ [EPUB](${FLIBUSTA_HOST}${href})\n`;
                        if (type.includes('mobi')) message += `⬇ [MOBI](${FLIBUSTA_HOST}${href})\n`;
                    });
                }
                message += '\n---\n';
            });

            // Отправляем результат (Markdown позволяет делать ссылки)
            ctx.replyWithMarkdown(message);
        });

    } catch (error) {
        console.error('Ошибка сети:', error.message);
        ctx.reply('Ошибка соединения. Возможно, Flibusta заблокирована на сервере/компьютере, где запущен бот.');
    }
});

// Запуск бота
bot.launch();
console.log('Бот запущен...');

// Обработка корректной остановки
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Простой сервер, чтобы Render не усыплял бота из-за отсутствия порта
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
});
// Слушаем порт, который выдаст сервер, или 3000
server.listen(process.env.PORT || 3000);