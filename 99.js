(function() {
    const BASE_URL = 'https://video.az/movie';
    
    async function fetchMovies() {
        try {
            const response = await fetch(`${BASE_URL}/api/movies`);
            const data = await response.json();
            return data.movies; // Adjust based on actual API response structure
        } catch (error) {
            console.error('Error fetching movies:', error);
            return [];
        }
    }

    async function fetchMovieDetails(movieId) {
        try {
            const response = await fetch(`${BASE_URL}/api/movies/${movieId}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching movie details:', error);
            return null;
        }
    }

    async function init() {
        const movies = await fetchMovies();
        Lampa.Template.add('videoaz_movies', `
            <div class="videoaz-movies">
                {{#each movies}}
                <div class="movie">
                    <img src="{{this.poster}}" alt="{{this.title}}">
                    <div class="title">{{this.title}}</div>
                </div>
                {{/each}}
            </div>
        `);

        Lampa.Component.add('videoaz_movies', {
            template: 'videoaz_movies',
            async create() {
                this.movies = movies;
                this.render();
            }
        });

        Lampa.Listener.follow('app', async (e) => {
            if (e.type === 'open' && e.component === 'videoaz_movies') {
                const movieDetails = await fetchMovieDetails(e.movieId);
                // Display movie details
            }
        });

        Lampa.Storage.set('menu', [
            ...Lampa.Storage.get('menu'),
            { title: 'VideoAZ Movies', component: 'videoaz_movies' }
        ]);
    }

    init();
})();
