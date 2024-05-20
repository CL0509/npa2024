// Module: default
// License: GPL v.3 https://www.gnu.org/copyleft/gpl.html

const apivideoaz = require('./resources/lib/apivideoaz');
const xbmcgui = require('xbmcgui');
const Plugin = require('simpleplugin').Plugin;
const { urlencode } = require('urllib');

// Create plugin instance
const plugin = new Plugin();
const _ = plugin.initialize_gettext();

function init_api() {
    const settings_list = ['cfduid', 'video_stream', 'video_quality', 'rating_source'];

    const settings = {};
    for (const id of settings_list) {
        if (id === 'rating_source') {
            const rating_source = plugin.movie_rating;
            if (rating_source === 0) settings[id] = 'imdb';
            else if (rating_source === 1) settings[id] = 'kinopoisk';
        } else {
            settings[id] = plugin.get_setting(id);
        }
    }

    settings['episode_title'] = _('Episode');
    settings['season_title'] = _('Season');

    return apivideoaz.videoaz(settings);
}

function show_api_error(err) {
    let text = '';
    if (err.code === 1) {
        text = _('Connection error');
    } else {
        text = String(err);
    }
    xbmcgui.Dialog().notification(plugin.addon.getAddonInfo('name'), text, xbmcgui.NOTIFICATION_ERROR);
}

function show_notification(text) {
    xbmcgui.Dialog().notification(plugin.addon.getAddonInfo('name'), text);
}

function check_cookies() {
    if (!plugin.cfduid) {
        try {
            const cfduid = _api.get_cfduid();
            plugin.set_setting('cfduid', cfduid);
        } catch (err) {
            show_api_error(err);
        }
    }
}

function get_request_params(params) {
    const result = {};
    for (const param in params) {
        if (param[0] === '_') {
            result[param.slice(1)] = params[param];
        }
    }
    return result;
}

plugin.action('root', (params) => {
    const listing = list_root();
    return plugin.create_listing(listing, { content: 'files' });
});

function list_root() {
    const items = [
        { action: 'list_videos', label: _('Videos'), params: { cat: 'videos' } },
        { action: 'list_videos', label: _('Movies'), params: { cat: 'movies' } },
        { action: 'list_videos', label: _('TV Series'), params: { cat: 'tvseries' } },
        { action: 'search_history', label: _('Search') }
    ];

    for (const item of items) {
        const params = item.params || {};
        const url = plugin.get_url(item.action, params);

        const list_item = {
            label: item.label,
            url: url,
            icon: plugin.icon,
            fanart: plugin.fanart
        };
        yield list_item;
    }
}

plugin.action('list_videos', (params) => {
    const cur_cat = params.cat;
    const cur_page = parseInt(params._page || '1');
    const content = get_category_content(cur_cat);

    const update_listing = (params.update_listing === 'True') || (parseInt(params._page || '1') > 1);

    const dir_params = { ...params };
    delete dir_params.action;
    if (cur_page > 1) {
        delete dir_params._page;
    }

    check_cookies();

    const u_params = get_request_params(params);

    let video_list;
    try {
        video_list = get_video_list(cur_cat, u_params);
        succeeded = true;
    } catch (err) {
        show_api_error(err);
        succeeded = false;
    }

    let category;
    if (['videos', 'movies', 'tvseries'].includes(cur_cat)) {
        category = `${_('Page')} ${cur_page}`;
    } else {
        category = video_list.title;
    }

    if (succeeded && cur_cat === 'seasons' && video_list.count === 1) {
        const listing = [];
        dir_params.cat = 'episodes';
        const url = plugin.get_url('list_videos', dir_params);
        xbmc.executebuiltin(`Container.Update("${url}")`);
        return;
    }

    let listing = [];
    if (succeeded) {
        listing = make_video_list(video_list, params, dir_params);
    }

    return plugin.create_listing(listing, {
        content: content,
        succeeded: succeeded,
        update_listing: update_listing,
        category: category,
        sort_methods: [0]
    });
});

function get_category_content(cat) {
    if (cat === 'tvseries') {
        return 'tvshows';
    } else if (cat === 'seasons') {
        return 'tvshows';
    } else if (['videos', 'episodes'].includes(cat)) {
        return 'episodes';
    } else if (['movies', 'movie_related'].includes(cat)) {
        return 'movies';
    } else {
        return 'files';
    }
}

function get_video_list(cat, u_params) {
    switch (cat) {
        case 'movies':
            return _api.browse_movie(u_params);
        case 'tvseries':
            return _api.browse_tvseries(u_params);
        case 'seasons':
            return _api.browse_seasons(u_params);
        case 'episodes':
            return _api.browse_episodes(u_params);
        case 'videos':
            return _api.browse_video(u_params);
        case 'movie_related':
            return _api.browse_movie_related(u_params);
        default:
            throw new Error('Invalid category');
    }
}

function* make_video_list(video_list, params = {}, dir_params = {}, search = false) {
    const cur_cat = params.cat || '';
    const keyword = params._keyword || '';
    const cur_page = parseInt(params._page || '1');

    const use_pages = !search && !keyword && ['movies', 'tvseries', 'videos'].includes(cur_cat);
    const use_search = !search && ['movies', 'tvseries', 'videos'].includes(cur_cat);
    const use_category = !search && ['movies', 'videos'].includes(cur_cat);
    const use_genre = !search && cur_cat === 'movies';
    const use_lang = !search && cur_cat === 'movies';

    if (use_search) {
        const url = plugin.get_url('search_category', dir_params);
        const label = make_category_label('yellowgreen', _('Search'), keyword);
        const list_item = {
            label: label,
            is_folder: false,
            is_playable: false,
            url: url,
            icon: plugin.icon,
            fanart: plugin.fanart
        };
        yield list_item;
    }

    if (use_category) {
        const list = get_category(cur_cat);
        const cur_category = params._category || '0';
        const url = plugin.get_url('select_category', dir_params);
        const label = make_category_label('blue', _('Categories'), get_category_name(list, cur_category));
        const list_item = {
            label: label,
            url: url,
            icon: plugin.icon,
            fanart: plugin.fanart,
            is_folder: false, // Setting is_folder to false since it's not a folder
            is_playable: false // Setting is_playable to false since it's not playable
        };
        yield list_item;
    }

    if (use_genre) {
        const list = get_genre(cur_cat);
        const cur_genre = params._genre || '0';
        const url = plugin.get_url('select_genre', dir_params);
        const label = make_category_label('blue', _('Genres'), get_category_name(list, cur_genre));
        const list_item = {
            label: label,
            is_folder: false,
            is_playable: false,
            url: url,
            icon: plugin.icon,
            fanart: plugin.fanart
        };
        yield list_item;
    }

    if (use_lang) {
        const list = get_lang();
        const cur_lang = params._lang || '0';
        const url = plugin.get_url('select_lang', dir_params);
        const label = make_category_label('blue', _('Language'), get_lang_name(list, cur_lang));
        const list_item = {
            label: label,
            is_folder: false,
            is_playable: false,
            url: url,
            icon: plugin.icon,
            fanart: plugin.fanart
        };
        yield list_item;
    }

    const count = video_list.count;
    for (const video_item of video_list.list) {
        yield make_item(video_item, search);
    }

    if (use_pages) {
        if (cur_page > 1) {
            const item_info = {
                label: _('Previous page...'),
                url: plugin.get_url({ ...params, _page: cur_page - 1 })
            };
            yield item_info;
        }

        if (count >= 20) {
            const item_info = {
                label: _('Next page...'),
                url: plugin.get_url({ ...params, _page: cur_page + 1 })
            };
            yield item_info;
        }
    }
    }

    function make_item(video_item, search) {
    const item_info = video_item.item_info;
    const video_info = video_item.video_info;
    const video_type = video_info.type;

    const use_atl_names = plugin.use_atl_names;
    const movie_details = plugin.movie_details;

    let is_playable, url;
    let label_list = [];

    switch (video_type) {
        case 'movie':
            is_playable = true;
            url = plugin.get_url('play', { _type: 'movie', _id: video_info.id });

            if (search) {
                label_list.push(`[${_('Movies')}]`);
            }

            if (use_atl_names) {
                label_list.push(item_info.info.video.originaltitle);
            } else {
                label_list.push(item_info.info.video.title);
            }

            if (movie_details) {
                const details = get_movie_details(video_info.id);

                const quality_info = [];
                if (details.video_quality) {
                    quality_info.push(`[B]${_('Video quality')}:[/B] ${details.video_quality}`);
                    delete details.video_quality;
                }

                if (details.audio_quality) {
                    if (quality_info.length) quality_info.push('\n');
                    quality_info.push(`[B]${_('Audio quality')}:[/B] ${details.audio_quality}`);
                    delete details.audio_quality;
                }

                if (details.plot && quality_info.length) {
                    quality_info.push('\n\n');
                }

                details.plot = quality_info.join('') + details.plot;

                Object.assign(item_info.info.video, details);
            }

            delete item_info.info.video.title;

            const related_url = plugin.get_url('list_videos', { cat: 'movie_related', _id: video_info.id });
            item_info.context_menu = [[_('Related'), `Container.Update(${related_url})`]];
            break;

        case 'tvseries':
            is_playable = false;
            url = plugin.get_url('list_videos', { cat: 'seasons', _tvserie_id: video_info.id, _season: video_info.season });

            if (search) {
                label_list.push(`[${_('TV Series')}]`);
                label_list.push(item_info.info.video.title);
                delete item_info.info.video.title;
            }
            break;

        case 'seasons':
            is_playable = false;
            url = plugin.get_url('list_videos', { cat: 'episodes', _tvserie_id: video_info.tvserie_id, _season: video_info.season });
            break;

        case 'episodes':
            is_playable = true;
            url = plugin.get_url('play', {
                _type: 'episodes',
                _tvserie_id: video_info.tvserie_id,
                _season: video_info.season,
                _id: video_info.id
            });

            if (use_atl_names) {
                label_list.push(item_info.info.video.tvshowtitle);
                label_list.push(`.s${String(video_info.season).padStart(2, '0')}e${String(video_info.episode).padStart(2, '0')}`);
            }
            break;

        case 'video':
            is_playable = true;
            url = plugin.get_url('play', { _type: 'video', _id: video_info.id });

            if (search) {
                label_list.push(`[${_('Videos')}]`);
                label_list.push(item_info.label);
            }
            break;

        default:
            break;
    }

    const label = label_list.join('');
    item_info.url = url;
    item_info.is_playable = is_playable;
    item_info.label = label;

    return item_info;
    }

    function make_category_label(color, title, category) {
    return `[COLOR=${color}][B]${title}:[/B] ${category}[/COLOR]`;
    }

    plugin.action('search', (params) => {
    check_cookies();

    let keyword = params.keyword || '';
    const usearch = params.usearch === 'True';

    const new_search = keyword === '';
    let succeeded = false;

    if (!keyword && new_search && !usearch) {
        const kbd = xbmc.Keyboard();
        kbd.setDefault('');
        kbd.setHeading(_('Search'));
        kbd.doModal();
        if (kbd.isConfirmed()) {
            keyword = kbd.getText();
        }
    }

    if (keyword && new_search && !usearch) {
        const storage = plugin.get_storage('__history__.pcl');
        const history = storage.get('history', []);
        history.unshift({ keyword: keyword });
        if (history.length > plugin.history_length) {
            history.splice(plugin.history_length - history.length);
        }
        storage.set('history', history);

        params.keyword = keyword;
        const url = plugin.get_url(params);
        xbmc.executebuiltin(`Container.Update("${url}")`);
        return;
    }

    if (keyword) {
        succeeded = true;
        const category_list = [];
        const u_params = { keyword: keyword };

        const us_movies = usearch && plugin.us_movies;
        const search_movies = !usearch && plugin.search_movies;
        if (us_movies || search_movies) {
            category_list.push('movies');
        }

        const us_tvseries = (usearch && plugin.us_tvseries) || (!usearch && plugin.search_tvseries);
        if (us_tvseries) {
            category_list.push('tvseries');
        }

        const us_videos = usearch && plugin.us_videos;
                const search_videos = !usearch && plugin.search_videos;
                if (us_videos || search_videos) {
                    category_list.push('videos');
                }

                const video_items = [];
                for (const cat of category_list) {
                    try {
                        const video_list = get_video_list(cat, u_params);
                        if (video_list.count) {
                            video_items.push(...video_list.list);
                        }
                    } catch (err) {
                        show_api_error(err);
                        succeeded = false;
                    }
                }

                if (succeeded && !video_items.length) {
                    succeeded = false;
                    if (!usearch) {
                        show_notification(_('Nothing found!'));
                    }
                }
            }

            const search_list = { count: video_items.length, list: video_items };
            const listing = make_video_list(search_list, true);
            return plugin.create_listing(listing, { succeeded: succeeded, content: 'movies', category: keyword, sort_methods: [27] });
        });

        plugin.action('search_category', (params) => {
            const category = params.cat;
            let keyword = params._keyword || '';

            const kbd = xbmc.Keyboard();
            kbd.setDefault(keyword);
            kbd.setHeading(_('Search'));
            kbd.doModal();
            if (kbd.isConfirmed()) {
                keyword = kbd.getText();
            }

            params._keyword = keyword;
            delete params.action;
            const url = plugin.get_url('list_videos', { update_listing: true, ...params });
            xbmc.executebuiltin(`Container.Update("${url}")`);
        });

        plugin.action('search_history', () => {
            const storage = plugin.get_storage('__history__.pcl');
            const history = storage.get('history', []);

            if (history.length > plugin.history_length) {
                history.splice(plugin.history_length - history.length);
                storage.set('history', history);
            }

            const listing = [
                {
                    label: _('New Search...'),
                    url: plugin.get_url('search')
                }
            ];

            for (const item of history) {
                listing.push({
                    label: item.keyword,
                    url: plugin.get_url('search', { keyword: item.keyword })
                });
            }

            return plugin.create_listing(listing, { content: 'movies' });
        });

        plugin.action('play', (params) => {
            check_cookies();

            const u_params = get_request_params(params);
            try {
                const item = _api.get_video_url(u_params);
                return plugin.resolve_url({ play_item: item, succeeded: true });
            } catch (err) {
                show_api_error(err);
                return plugin.resolve_url({ succeeded: false });
            }
        });

        plugin.action('select_category', (params) => {
            const list = get_category(params.cat);
            list.unshift({ id: '0', title: _('All') });
            const titles = list.map((list_item) => list_item.title);
            const ret = xbmcgui.Dialog().select(_('Categories'), titles);
            if (ret >= 0) {
                const category = list[ret].id;
                if (category === '0' && params._category) {
                    delete params._category;
                } else {
                    params._category = category;
                }
                delete params.action;
                const url = plugin.get_url('list_videos', { update_listing: true, ...params });
                xbmc.executebuiltin(`Container.Update("${url}")`);
            }
        });

        plugin.action('select_genre', (params) => {
            const list = get_genre(params.cat);
            list.unshift({ id: '0', title: _('All') });
            const titles = list.map((list_item) => list_item.title);
            const ret = xbmcgui.Dialog().select(_('Genres'), titles);
            if (ret >= 0) {
                const genre = list[ret].id;
                if (genre === '0' && params._genre) {
                    delete params._genre;
                } else {
                    params._genre = genre;
                }
                delete params.action;
                const url = plugin.get_url('list_videos', { update_listing: true, ...params });
                xbmc.executebuiltin(`Container.Update("${url}")`);
            }
        });

        plugin.action('select_lang', (params) => {
            const list = get_lang();
            list.unshift({ id: '0', title: _('All') });
            const titles = list.map((list_item) => list_item.title);
            const ret = xbmcgui.Dialog().select(_('Language'), titles);
            if (ret >= 0) {
                const lang = list[ret].id;
                if (lang === '0' && params._lang) {
                    delete params._lang;
                } else {
                    params._lang = lang;
                }
                delete params.action;
                const url = plugin.get_url('list_videos', { update_listing: true, ...params });
                xbmc.executebuiltin(`Container.Update("${url}")`);
            }
        });

        _api = init_api();
        plugin.run();
