// hdfilmcehennemi.js
const SITEURL = 'https://www.hdfilmcehennemi1.com';

async function fetchHTML(url) {
    const response = await fetch(url, {
        headers: {
            'Referer': SITEURL,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
        }
    });
    return response.text();
}

function parseMovies(html) {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');
    
    const movies = [];
    const items = document.querySelectorAll('.poster-pop');
    items.forEach(item => {
        const title = item.getAttribute('data-original-title');
        const genre = item.getAttribute('data-types');
        const year = item.getAttribute('data-year');
        const description = item.getAttribute('data-content');
        const link = item.querySelector('a').href;
        const image = item.querySelector('img').getAttribute('data-flickity-lazyload');
        const imdb = item.querySelector('span').textContent.trim();

        movies.push({
            title: `${title} (${year} imdb:${imdb})`,
            description,
            genre,
            link,
            image
        });
    });
    return movies;
}

function displayMovies(movies) {
    movies.forEach(movie => {
        Lampa.TV.addMovie({
            title: movie.title,
            link: movie.link,
            poster: movie.image,
            description: movie.description
        });
    });
}

async function listSpecials() {
    const SPECIALS = [
        { title: 'Son Eklenenler', key: '' },
        { title: 'IMDb 7+ Filmler', key: '/imdb-7' },
        { title: 'En Çok Beğenilenler', key: '/en-cok-begenilenler' },
        { title: 'Animasyon Filmler', key: '/tur/animasyon' },
        { title: 'Bilim Kurgu Filmleri', key: '/tur/bilim-kurgu' },
        { title: 'Aksiyon Filmleri', key: '/tur/aksiyon' },
        { title: 'Macera Filmleri', key: '/tur/macera' },
        { title: 'Fantastik Filmler', key: '/tur/fantastik' },
        { title: 'Komedi Filmleri', key: '/tur/komedi' },
        { title: 'Belgesel Filmler', key: '/tur/belgesel' },
        { title: 'Hint Filmleri', key: '/ulke/hindistan' },
    ];

    for (const special of SPECIALS) {
        const html = await fetchHTML(`${SITEURL}${special.key}`);
        const movies = parseMovies(html);
        displayMovies(movies);
    }
}

async function main() {
    await listSpecials();
}

main();
