// Module: default
// License: GPL v.3 https://www.gnu.org/copyleft/gpl.html

const apivideoaz = require('./resources/lib/apivideoaz');
const xbmcgui = require('xbmcgui');
const Plugin = require('simpleplugin');
const urlencode = require('urlencode');
const xbmc = require('xbmc');

// Create plugin instance
const plugin = new Plugin();
const _ = plugin.initialize_gettext();

function init_api() {
    const settings_list = ['cfduid', 'video_stream', 'video_quality', 'rating_source'];

    const settings = {};
    for (const id of settings_list) {
        if (id === 'rating_source') {
            let rating_source = plugin.movie_rating;
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
    new xbmcgui.Dialog().notification(plugin.addon.getAddonInfo('name'), text, xbmcgui.NOTIFICATION_ERROR);
}

function show_notification(text) {
    new xbmcgui.Dialog().notification(plugin.addon.getAddonInfo('name'), text);
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

function* list_root() {
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
            url,
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

    const update_listing = params.update_listing === 'True' || (parseInt(params._page || '1') > 1);

    const dir_params = { ...params };
    delete dir_params.action;
    if (cur_page > 1) {
        delete dir_params._page;
    }

    check_cookies();

    const u_params = get_request_params(params);

    let video_list;
    let succeeded = true;
    try {
        video_list = get_video_list(cur_cat, u_params);
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
        return [];
    }

    let listing = [];
    if (succeeded) {
        listing = make_video_list(video_list, params, dir_params);
    }

    return plugin.create_listing(listing, { content, succeeded, update_listing, category });
});

function get_category_content(cat) {
    if (cat === 'tvseries' || cat === 'seasons') {
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
            label,
            is_folder: false,
            is_playable: false,
            url,
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
            label,
            is_folder: false,
            is_playable: false,
            url,
            icon: plugin.icon,
            fanart: plugin.fanart
        };
        yield list_item;
    }

    if (use_genre) {
        const list = get_genre(cur_cat);
        const cur_genre = params._genre || '0';
        const url = plugin.get_url('select_genre', dir_params);
        const label = make_category_label('blue', _('Genres'), get_category_name(list, cur_genre));
        const list_item = {
            label,
            is_folder: false,
            is_playable: false,
            url,
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
            label,
            is_folder: false,
            is_playable: false,
            url,
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

        if (video_type === 'movie') {
        is_playable = true;
        url = plugin.get_url({ action: 'play', _type: 'movie', _id: video_info.id });

        const label_list = [];
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

        item_info.label = label_list.join('');

        delete item_info.info.video.title;

        const related_url = plugin.get_url({ action: 'list_videos', cat: 'movie_related', _id: video_info.id });
        item_info.context_menu = [{ label: _('Related'), url: `Container.Update(${related_url})` }];

        } else if (video_type === 'tvseries') {
        is_playable = false;
        url = plugin.get_url({ action: 'list_videos', cat: 'seasons', _tvserie_id: video_info.id, _season: video_info.season });

        if (search) {
            const label_list = [];
            label_list.push(`[${_('TV Series')}]`);
            label_list.push(item_info.info.video.title);
            item_info.label = label_list.join('');

            delete item_info.info.video.title;
        }

        } else if (video_type === 'seasons') {
        is_playable = false;
        url = plugin.get_url({ action: 'list_videos', cat: 'episodes', _tvserie_id: video_info.tvserie_id, _season: video_info.season });

        } else if (video_type === 'episodes') {
        is_playable = true;
        url = plugin.get_url({ action: 'play', _type: 'episodes', _tvserie_id: video_info.tvserie_id, _season: video_info.season, _id: video_info.id });

        if (use_atl_names) {
            const label_list = [];
            label_list.push(item_info.info.video.tvshowtitle);
            label_list.push(`.s${String(video_info.info.video.season).padStart(2, '0')}e${String(video_info.info.video.episode).padStart(2, '0')}`);
            item_info.label = label_list.join('');

            delete item_info.info.video.title;
        }

        } else if (video_type === 'video') {
        is_playable = true;
        item_info.fanart = plugin.fanart;
        url = plugin.get_url({ action: 'play', _type: 'video', _id: video_info.id });

        if (search) {
            const label_list = [];
            label_list.push(`[${_('Videos')}]`);
            label_list.push(item_info.label);
            item_info.label = label_list.join('');
        }
        }

        item_info.url = url;
        item_info.is_playable = is_playable;

        return item_info;
        }

        function make_category_label(color, title, category) {
        return `[COLOR=${color}][B]${title}:[/B] ${category}[/COLOR]`;
        }

        plugin.cached(180, 'get_movie_details', (id) => {
        return _api.get_movie_details(id);
        });

        plugin.cached(180, 'get_category', (cat) => {
        if (cat === 'movies') {
        return _api.category_movie();
        } else if (cat === 'videos') {
        return _api.category_video();
        }
        });

        plugin.cached(180, 'get_genre', (cat) => {
        if (cat === 'movies') {
        return _api.category_genre();
        }
        });

        plugin.cached(180, 'get_lang', () => {
        const list = [
        { id: 'az', title: _('Azərbaycanca') },
        { id: 'ru', title: _('Русский') },
        { id: 'en', title: _('English') },
        { id: 'tr', title: _('Türkçe') }
        ];

        return list;
        });

        function get_category_name(list, id) {
        for (const item of list) {
        if (item.id === id) {
            return item.title;
        }
        }
        return _('All');
        }

        function get_lang_name(list, id) {
        for (const item of list) {
        if (item.id === id) {
            return item.title;
        }
        }
        return _('All');
        }

        plugin.action('search', (params) => {
        check_cookies();

        let keyword = params.keyword || '';
        const usearch = params.usearch === 'True';

        const new_search = keyword === '';
        let succeeded = false;

            if (!new_search) {
                const query = urlencode.decode(keyword);
                try {
                    const result = _api.search(query);
                    succeeded = true;
                    return plugin.create_listing(make_video_list(result, params, {}, true), { content: 'episodes', succeeded });
                } catch (err) {
                    show_api_error(err);
                    succeeded = false;
                }
            }

            if (usearch) {
                return plugin.search_form(_('Search'), keyword);
            }

            const history = plugin.get_setting('search_history') || [];
            const items = [
                { label: _('New search...'), url: plugin.get_url('search', { usearch: 'True' }) }
            ];
            for (const hist of history) {
                items.push({
                    label: hist.keyword,
                    url: plugin.get_url('search', { keyword: hist.keyword })
                });
            }

            return plugin.create_listing(items, { content: 'episodes' });
            });

            plugin.action('play', (params) => {
            check_cookies();

            const type = params._type;
            const id = params._id;

            if (type === 'movie') {
                return plugin.play(apivideoaz.get_stream_url(id));
            } else if (type === 'video') {
                return plugin.play(apivideoaz.get_video_url(id));
            } else if (type === 'episodes') {
                const tvserie_id = params._tvserie_id;
                const season = params._season;
                const episode_id = params._id;
                return plugin.play(apivideoaz.get_episode_url(tvserie_id, season, episode_id));
            }
            });

            plugin.action('search_category', (params) => {
            const keyword = params._keyword;
            return plugin.search_form(_('Search'), keyword);
            });

            plugin.action('select_category', (params) => {
            const cat = params._category;
            const cur_cat = params.cat;
            return plugin.create_listing(get_category(cur_cat), { content: 'episodes' });
            });

            plugin.action('select_genre', (params) => {
            const genre = params._genre;
            return plugin.create_listing(get_genre('movies'), { content: 'episodes' });
            });

            plugin.action('select_lang', () => {
            return plugin.create_listing(get_lang(), { content: 'episodes' });
            });

            plugin.action('search_history', () => {
            return plugin.search_form(_('Search'));
            });

            plugin.action('execute', (params) => {
            const url = params.url;
            xbmc.executebuiltin(url);
            });

            plugin.action('back', () => {
            return plugin.exit();
            });

            plugin.action('stop', () => {
            return plugin.stop();
            });

            plugin.action('pause', () => {
            return plugin.pause();
            });

            plugin.action('reload', () => {
            return plugin.reload();
            });

            plugin.action('get_settings', () => {
            const settings = plugin.get_settings();
            return plugin.create_listing(settings, { content: 'files' });
            });

            plugin.action('save_settings', (params) => {
            plugin.save_settings(params);
            return plugin.exit();
            });

            plugin.action('get_trailer', (params) => {
            const id = params._id;
            return plugin.create_listing(make_video_list(_api.get_trailer(id), {}, {}, true), { content: 'episodes' });
            });

            plugin.action('settings', () => {
            const settings = plugin.get_settings();
            return plugin.create_listing(settings, { content: 'files' });
            });

            plugin.action('logout', () => {
            plugin.set_setting('cfduid', '');
            return plugin.exit();
            });

            const _api = init_api();
            plugin.run();

