function noop() { }
// Adapted from https://github.com/then/is-promise/blob/master/index.js
// Distributed under MIT License https://github.com/then/is-promise/blob/master/LICENSE
function is_promise(value) {
    return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs#run-time-svelte-onmount
 */
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
/**
 * Schedules a callback to run immediately before the component is unmounted.
 *
 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
 * only one that runs inside a server-side component.
 *
 * https://svelte.dev/docs#run-time-svelte-ondestroy
 */
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
/**
 * Associates an arbitrary `context` object with the current component and the specified `key`
 * and returns that object. The context is then available to children of the component
 * (including slotted content) with `getContext`.
 *
 * Like lifecycle functions, this must be called during component initialisation.
 *
 * https://svelte.dev/docs#run-time-svelte-setcontext
 */
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
    return context;
}
/**
 * Retrieves the context that belongs to the closest parent component with the specified `key`.
 * Must be called during component initialisation.
 *
 * https://svelte.dev/docs#run-time-svelte-getcontext
 */
function getContext(key) {
    return get_current_component().$$.context.get(key);
}
const ATTR_REGEX = /[&"]/g;
const CONTENT_REGEX = /[&<]/g;
/**
 * Note: this method is performance sensitive and has been optimized
 * https://github.com/sveltejs/svelte/pull/5701
 */
function escape(value, is_attr = false) {
    const str = String(value);
    const pattern = is_attr ? ATTR_REGEX : CONTENT_REGEX;
    pattern.lastIndex = 0;
    let escaped = '';
    let last = 0;
    while (pattern.test(str)) {
        const i = pattern.lastIndex - 1;
        const ch = str[i];
        escaped += str.substring(last, i) + (ch === '&' ? '&amp;' : (ch === '"' ? '&quot;' : '&lt;'));
        last = i + 1;
    }
    return escaped + str.substring(last);
}
function each(items, fn) {
    let str = '';
    for (let i = 0; i < items.length; i += 1) {
        str += fn(items[i], i);
    }
    return str;
}
const missing_component = {
    $$render: () => ''
};
function validate_component(component, name) {
    if (!component || !component.$$render) {
        if (name === 'svelte:component')
            name += ' this={...}';
        throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules. Otherwise you may need to fix a <${name}>.`);
    }
    return component;
}
let on_destroy;
function create_ssr_component(fn) {
    function $$render(result, props, bindings, slots, context) {
        const parent_component = current_component;
        const $$ = {
            on_destroy,
            context: new Map(context || (parent_component ? parent_component.$$.context : [])),
            // these will be immediately discarded
            on_mount: [],
            before_update: [],
            after_update: [],
            callbacks: blank_object()
        };
        set_current_component({ $$ });
        const html = fn(result, props, bindings, slots);
        set_current_component(parent_component);
        return html;
    }
    return {
        render: (props = {}, { $$slots = {}, context = new Map() } = {}) => {
            on_destroy = [];
            const result = { title: '', head: '', css: new Set() };
            const html = $$render(result, props, {}, $$slots, context);
            run_all(on_destroy);
            return {
                html,
                css: {
                    code: Array.from(result.css).map(css => css.code).join('\n'),
                    map: null // TODO
                },
                head: result.title + result.head
            };
        },
        $$render
    };
}
function add_attribute(name, value, boolean) {
    if (value == null || (boolean && !value))
        return '';
    const assignment = (boolean && value === true) ? '' : `="${escape(value, true)}"`;
    return ` ${name}${assignment}`;
}

const LOCATION = {};
const ROUTER = {};
const HISTORY = {};

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
 * https://github.com/reach/router/blob/master/LICENSE
 */

const PARAM = /^:(.+)/;
const SEGMENT_POINTS = 4;
const STATIC_POINTS = 3;
const DYNAMIC_POINTS = 2;
const SPLAT_PENALTY = 1;
const ROOT_POINTS = 1;

/**
 * Split up the URI into segments delimited by `/`
 * Strip starting/ending `/`
 * @param {string} uri
 * @return {string[]}
 */
const segmentize = (uri) => uri.replace(/(^\/+|\/+$)/g, "").split("/");
/**
 * Strip `str` of potential start and end `/`
 * @param {string} string
 * @return {string}
 */
const stripSlashes = (string) => string.replace(/(^\/+|\/+$)/g, "");
/**
 * Score a route depending on how its individual segments look
 * @param {object} route
 * @param {number} index
 * @return {object}
 */
const rankRoute = (route, index) => {
    const score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
              score += SEGMENT_POINTS;

              if (segment === "") {
                  score += ROOT_POINTS;
              } else if (PARAM.test(segment)) {
                  score += DYNAMIC_POINTS;
              } else if (segment[0] === "*") {
                  score -= SEGMENT_POINTS + SPLAT_PENALTY;
              } else {
                  score += STATIC_POINTS;
              }

              return score;
          }, 0);

    return { route, score, index };
};
/**
 * Give a score to all routes and sort them on that
 * If two routes have the exact same score, we go by index instead
 * @param {object[]} routes
 * @return {object[]}
 */
const rankRoutes = (routes) =>
    routes
        .map(rankRoute)
        .sort((a, b) =>
            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
        );
/**
 * Ranks and picks the best route to match. Each segment gets the highest
 * amount of points, then the type of segment gets an additional amount of
 * points where
 *
 *  static > dynamic > splat > root
 *
 * This way we don't have to worry about the order of our routes, let the
 * computers do it.
 *
 * A route looks like this
 *
 *  { path, default, value }
 *
 * And a returned match looks like:
 *
 *  { route, params, uri }
 *
 * @param {object[]} routes
 * @param {string} uri
 * @return {?object}
 */
const pick = (routes, uri) => {
    let match;
    let default_;

    const [uriPathname] = uri.split("?");
    const uriSegments = segmentize(uriPathname);
    const isRootUri = uriSegments[0] === "";
    const ranked = rankRoutes(routes);

    for (let i = 0, l = ranked.length; i < l; i++) {
        const route = ranked[i].route;
        let missed = false;

        if (route.default) {
            default_ = {
                route,
                params: {},
                uri,
            };
            continue;
        }

        const routeSegments = segmentize(route.path);
        const params = {};
        const max = Math.max(uriSegments.length, routeSegments.length);
        let index = 0;

        for (; index < max; index++) {
            const routeSegment = routeSegments[index];
            const uriSegment = uriSegments[index];

            if (routeSegment && routeSegment[0] === "*") {
                // Hit a splat, just grab the rest, and return a match
                // uri:   /files/documents/work
                // route: /files/* or /files/*splatname
                const splatName =
                    routeSegment === "*" ? "*" : routeSegment.slice(1);

                params[splatName] = uriSegments
                    .slice(index)
                    .map(decodeURIComponent)
                    .join("/");
                break;
            }

            if (typeof uriSegment === "undefined") {
                // URI is shorter than the route, no match
                // uri:   /users
                // route: /users/:userId
                missed = true;
                break;
            }

            const dynamicMatch = PARAM.exec(routeSegment);

            if (dynamicMatch && !isRootUri) {
                const value = decodeURIComponent(uriSegment);
                params[dynamicMatch[1]] = value;
            } else if (routeSegment !== uriSegment) {
                // Current segments don't match, not dynamic, not splat, so no match
                // uri:   /users/123/settings
                // route: /users/:id/profile
                missed = true;
                break;
            }
        }

        if (!missed) {
            match = {
                route,
                params,
                uri: "/" + uriSegments.slice(0, index).join("/"),
            };
            break;
        }
    }

    return match || default_ || null;
};
/**
 * Combines the `basepath` and the `path` into one path.
 * @param {string} basepath
 * @param {string} path
 */
const combinePaths = (basepath, path) =>
    `${stripSlashes(
        path === "/"
            ? basepath
            : `${stripSlashes(basepath)}/${stripSlashes(path)}`
    )}/`;

const canUseDOM = () =>
    typeof window !== "undefined" &&
    "document" in window &&
    "location" in window;

/* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.59.2 */

const Route = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $activeRoute, $$unsubscribe_activeRoute;
	let { path = "" } = $$props;
	let { component = null } = $$props;
	let routeParams = {};
	let routeProps = {};
	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
	$$unsubscribe_activeRoute = subscribe(activeRoute, value => $activeRoute = value);

	const route = {
		path,
		// If no path prop is given, this Route will act as the default Route
		// that is rendered if no other Route in the Router is a match.
		default: path === ""
	};

	registerRoute(route);

	onDestroy(() => {
		unregisterRoute(route);
	});

	if ($$props.path === void 0 && $$bindings.path && path !== void 0) $$bindings.path(path);
	if ($$props.component === void 0 && $$bindings.component && component !== void 0) $$bindings.component(component);

	{
		if ($activeRoute && $activeRoute.route === route) {
			routeParams = $activeRoute.params;
			const { component: c, path, ...rest } = $$props;
			routeProps = rest;

			if (c) {
				if (c.toString().startsWith("class ")) component = c; else component = c();
			}

			canUseDOM() && window?.scrollTo(0, 0);
		}
	}

	$$unsubscribe_activeRoute();

	return `${$activeRoute && $activeRoute.route === route
	? `${component
		? `${(function (__value) {
				if (is_promise(__value)) {
					__value.then(null, noop);
					return ``;
				}

				return (function (resolvedComponent) {
					return `
            ${validate_component(resolvedComponent?.default || resolvedComponent || missing_component, "svelte:component").$$render($$result, Object.assign({}, routeParams, routeProps), {}, {})}
        `;
				})(__value);
			})(component)}`
		: `${slots.default
			? slots.default({ params: routeParams })
			: ``}`}`
	: ``}`;
});

const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier} [start]
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe
    };
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=} start
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = new Set();
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (const subscriber of subscribers) {
                    subscriber[1]();
                    subscriber_queue.push(subscriber, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.add(subscriber);
        if (subscribers.size === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0 && stop) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}
function derived(stores, fn, initial_value) {
    const single = !Array.isArray(stores);
    const stores_array = single
        ? [stores]
        : stores;
    const auto = fn.length < 2;
    return readable(initial_value, (set) => {
        let started = false;
        const values = [];
        let pending = 0;
        let cleanup = noop;
        const sync = () => {
            if (pending) {
                return;
            }
            cleanup();
            const result = fn(single ? values[0] : values, set);
            if (auto) {
                set(result);
            }
            else {
                cleanup = is_function(result) ? result : noop;
            }
        };
        const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
            values[i] = value;
            pending &= ~(1 << i);
            if (started) {
                sync();
            }
        }, () => {
            pending |= (1 << i);
        }));
        started = true;
        sync();
        return function stop() {
            run_all(unsubscribers);
            cleanup();
            // We need to set this to false because callbacks can still happen despite having unsubscribed:
            // Callbacks might already be placed in the queue which doesn't know it should no longer
            // invoke this derived store.
            started = false;
        };
    });
}

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
 * https://github.com/reach/router/blob/master/LICENSE
 */

const getLocation = (source) => {
    return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || "initial",
    };
};
const createHistory = (source) => {
    const listeners = [];
    let location = getLocation(source);

    return {
        get location() {
            return location;
        },

        listen(listener) {
            listeners.push(listener);

            const popstateListener = () => {
                location = getLocation(source);
                listener({ location, action: "POP" });
            };

            source.addEventListener("popstate", popstateListener);

            return () => {
                source.removeEventListener("popstate", popstateListener);
                const index = listeners.indexOf(listener);
                listeners.splice(index, 1);
            };
        },

        navigate(to, { state, replace = false } = {}) {
            state = { ...state, key: Date.now() + "" };
            // try...catch iOS Safari limits to 100 pushState calls
            try {
                if (replace) source.history.replaceState(state, "", to);
                else source.history.pushState(state, "", to);
            } catch (e) {
                source.location[replace ? "replace" : "assign"](to);
            }
            location = getLocation(source);
            listeners.forEach((listener) =>
                listener({ location, action: "PUSH" })
            );
            document.activeElement.blur();
        },
    };
};
// Stores history entries in memory for testing or other platforms like Native
const createMemorySource = (initialPathname = "/") => {
    let index = 0;
    const stack = [{ pathname: initialPathname, search: "" }];
    const states = [];

    return {
        get location() {
            return stack[index];
        },
        addEventListener(name, fn) {},
        removeEventListener(name, fn) {},
        history: {
            get entries() {
                return stack;
            },
            get index() {
                return index;
            },
            get state() {
                return states[index];
            },
            pushState(state, _, uri) {
                const [pathname, search = ""] = uri.split("?");
                index++;
                stack.push({ pathname, search });
                states.push(state);
            },
            replaceState(state, _, uri) {
                const [pathname, search = ""] = uri.split("?");
                stack[index] = { pathname, search };
                states[index] = state;
            },
        },
    };
};
// Global history uses window.history as the source if available,
// otherwise a memory history
const globalHistory = createHistory(
    canUseDOM() ? window : createMemorySource()
);

/* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.59.2 */

const Router = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $location, $$unsubscribe_location;
	let $routes, $$unsubscribe_routes;
	let $base, $$unsubscribe_base;
	let $activeRoute, $$unsubscribe_activeRoute;
	let { basepath = "/" } = $$props;
	let { url = null } = $$props;
	let { history = globalHistory } = $$props;
	setContext(HISTORY, history);
	const locationContext = getContext(LOCATION);
	const routerContext = getContext(ROUTER);
	const routes = writable([]);
	$$unsubscribe_routes = subscribe(routes, value => $routes = value);
	const activeRoute = writable(null);
	$$unsubscribe_activeRoute = subscribe(activeRoute, value => $activeRoute = value);
	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

	// If locationContext is not set, this is the topmost Router in the tree.
	// If the `url` prop is given we force the location to it.
	const location = locationContext || writable(url ? { pathname: url } : history.location);

	$$unsubscribe_location = subscribe(location, value => $location = value);

	// If routerContext is set, the routerBase of the parent Router
	// will be the base for this Router's descendants.
	// If routerContext is not set, the path and resolved uri will both
	// have the value of the basepath prop.
	const base = routerContext
	? routerContext.routerBase
	: writable({ path: basepath, uri: basepath });

	$$unsubscribe_base = subscribe(base, value => $base = value);

	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
		// If there is no activeRoute, the routerBase will be identical to the base.
		if (!activeRoute) return base;

		const { path: basepath } = base;
		const { route, uri } = activeRoute;

		// Remove the potential /* or /*splatname from
		// the end of the child Routes relative paths.
		const path = route.default
		? basepath
		: route.path.replace(/\*.*$/, "");

		return { path, uri };
	});

	const registerRoute = route => {
		const { path: basepath } = $base;
		let { path } = route;

		// We store the original path in the _path property so we can reuse
		// it when the basepath changes. The only thing that matters is that
		// the route reference is intact, so mutation is fine.
		route._path = path;

		route.path = combinePaths(basepath, path);

		if (typeof window === "undefined") {
			// In SSR we should set the activeRoute immediately if it is a match.
			// If there are more Routes being registered after a match is found,
			// we just skip them.
			if (hasActiveRoute) return;

			const matchingRoute = pick([route], $location.pathname);

			if (matchingRoute) {
				activeRoute.set(matchingRoute);
				hasActiveRoute = true;
			}
		} else {
			routes.update(rs => [...rs, route]);
		}
	};

	const unregisterRoute = route => {
		routes.update(rs => rs.filter(r => r !== route));
	};

	if (!locationContext) {
		// The topmost Router in the tree is responsible for updating
		// the location store and supplying it through context.
		onMount(() => {
			const unlisten = history.listen(event => {
				location.set(event.location);
			});

			return unlisten;
		});

		setContext(LOCATION, location);
	}

	setContext(ROUTER, {
		activeRoute,
		base,
		routerBase,
		registerRoute,
		unregisterRoute
	});

	if ($$props.basepath === void 0 && $$bindings.basepath && basepath !== void 0) $$bindings.basepath(basepath);
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);
	if ($$props.history === void 0 && $$bindings.history && history !== void 0) $$bindings.history(history);

	{
		{
			const { path: basepath } = $base;
			routes.update(rs => rs.map(r => Object.assign(r, { path: combinePaths(basepath, r._path) })));
		}
	}

	{
		{
			const bestMatch = pick($routes, $location.pathname);
			activeRoute.set(bestMatch);
		}
	}

	$$unsubscribe_location();
	$$unsubscribe_routes();
	$$unsubscribe_base();
	$$unsubscribe_activeRoute();

	return `${slots.default
	? slots.default({
			route: $activeRoute && $activeRoute.uri,
			location: $location
		})
	: ``}`;
});

/* src\components\team\current_form\FormTiles.svelte generated by Svelte v3.59.2 */

const css$i = {
	code: "#formTile.svelte-1978cry{width:100%;aspect-ratio:1/0.9;color:#2b2d2f;display:grid;place-items:center;border-radius:inherit}.result.svelte-1978cry{margin-top:0.14em;font-size:2vw}.icon.svelte-1978cry{position:relative;flex:1}.pos-3.svelte-1978cry,.pos-4.svelte-1978cry,.pos-2.svelte-1978cry,.pos-1.svelte-1978cry{border-left:none}.pos-4.svelte-1978cry{opacity:100%;border-radius:0 6px 6px 0}.pos-3.svelte-1978cry{opacity:89%}.pos-2.svelte-1978cry{opacity:78%}.pos-1.svelte-1978cry{opacity:67%}.pos-0.svelte-1978cry{opacity:56%;border-radius:6px 0 0 6px}@media only screen and (max-width: 1000px){.result.svelte-1978cry{font-size:3em}}@media only screen and (max-width: 600px){.result.svelte-1978cry{font-size:7vw;margin-top:0.25em}}",
	map: "{\"version\":3,\"file\":\"FormTiles.svelte\",\"sources\":[\"FormTiles.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function background(result, starTeam) {\\r\\n    switch (result) {\\r\\n        case \\\"W\\\":\\r\\n            if (starTeam) {\\r\\n                return \\\"linear-gradient(30deg, var(--green), #2bd2ff, #fa8bff)\\\";\\r\\n            }\\r\\n            else {\\r\\n                return \\\"#00fe87\\\";\\r\\n            }\\r\\n        case \\\"D\\\":\\r\\n            return \\\"#ffdd00\\\";\\r\\n        case \\\"L\\\":\\r\\n            return \\\"#f83027\\\";\\r\\n        default:\\r\\n            return \\\"#d6d6d6\\\";\\r\\n    }\\r\\n}\\r\\nfunction formatResult(result) {\\r\\n    switch (result) {\\r\\n        case \\\"W\\\":\\r\\n        case \\\"D\\\":\\r\\n        case \\\"L\\\":\\r\\n            return result;\\r\\n        default:\\r\\n            return \\\"\\\";\\r\\n    }\\r\\n}\\r\\nexport let form, starTeams;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"icon pos-0\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[0], starTeams[0])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[0])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-1\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[1], starTeams[1])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[1])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-2\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[2], starTeams[2])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[2])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-3\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[3], starTeams[3])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[3])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-4\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[4], starTeams[4])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[4])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style>\\r\\n  #formTile {\\r\\n    width: 100%;\\r\\n    aspect-ratio: 1/0.9;\\r\\n    color: #2b2d2f;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    border-radius: inherit;\\r\\n  }\\r\\n  .result {\\r\\n    margin-top: 0.14em;\\r\\n    font-size: 2vw;\\r\\n  }\\r\\n\\r\\n  .icon {\\r\\n    position: relative;\\r\\n    flex: 1;\\r\\n  }\\r\\n\\r\\n  .pos-3,\\r\\n  .pos-4,\\r\\n  .pos-2,\\r\\n  .pos-1 {\\r\\n    border-left: none;\\r\\n  }\\r\\n\\r\\n  .pos-4 {\\r\\n    /* Most recent game */\\r\\n    opacity: 100%;\\r\\n    border-radius: 0 6px 6px 0;\\r\\n  }\\r\\n\\r\\n  .pos-3 {\\r\\n    opacity: 89%;\\r\\n  }\\r\\n\\r\\n  .pos-2 {\\r\\n    opacity: 78%;\\r\\n  }\\r\\n\\r\\n  .pos-1 {\\r\\n    opacity: 67%;\\r\\n  }\\r\\n\\r\\n  .pos-0 {\\r\\n    /* Least recent game */\\r\\n    opacity: 56%;\\r\\n    border-radius: 6px 0 0 6px;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1000px) {\\r\\n    .result {\\r\\n      font-size: 3em;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 600px) {\\r\\n    .result {\\r\\n      font-size: 7vw;\\r\\n      margin-top: 0.25em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAmEE,wBAAU,CACR,KAAK,CAAE,IAAI,CACX,YAAY,CAAE,CAAC,CAAC,GAAG,CACnB,KAAK,CAAE,OAAO,CACd,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,aAAa,CAAE,OACjB,CACA,sBAAQ,CACN,UAAU,CAAE,MAAM,CAClB,SAAS,CAAE,GACb,CAEA,oBAAM,CACJ,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,CACR,CAEA,qBAAM,CACN,qBAAM,CACN,qBAAM,CACN,qBAAO,CACL,WAAW,CAAE,IACf,CAEA,qBAAO,CAEL,OAAO,CAAE,IAAI,CACb,aAAa,CAAE,CAAC,CAAC,GAAG,CAAC,GAAG,CAAC,CAC3B,CAEA,qBAAO,CACL,OAAO,CAAE,GACX,CAEA,qBAAO,CACL,OAAO,CAAE,GACX,CAEA,qBAAO,CACL,OAAO,CAAE,GACX,CAEA,qBAAO,CAEL,OAAO,CAAE,GAAG,CACZ,aAAa,CAAE,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,GACzB,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,sBAAQ,CACN,SAAS,CAAE,GACb,CACF,CACA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,sBAAQ,CACN,SAAS,CAAE,GAAG,CACd,UAAU,CAAE,MACd,CACF\"}"
};

function background(result, starTeam) {
	switch (result) {
		case "W":
			if (starTeam) {
				return "linear-gradient(30deg, var(--green), #2bd2ff, #fa8bff)";
			} else {
				return "#00fe87";
			}
		case "D":
			return "#ffdd00";
		case "L":
			return "#f83027";
		default:
			return "#d6d6d6";
	}
}

function formatResult(result) {
	switch (result) {
		case "W":
		case "D":
		case "L":
			return result;
		default:
			return "";
	}
}

const FormTiles = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { form, starTeams } = $$props;
	if ($$props.form === void 0 && $$bindings.form && form !== void 0) $$bindings.form(form);
	if ($$props.starTeams === void 0 && $$bindings.starTeams && starTeams !== void 0) $$bindings.starTeams(starTeams);
	$$result.css.add(css$i);

	return `<div class="icon pos-0 svelte-1978cry"><div id="formTile" style="${"background: " + escape(background(form[0], starTeams[0]), true)}" class="svelte-1978cry"><div class="result svelte-1978cry">${escape(formatResult(form[0]))}</div></div></div>
<div class="icon pos-1 svelte-1978cry"><div id="formTile" style="${"background: " + escape(background(form[1], starTeams[1]), true)}" class="svelte-1978cry"><div class="result svelte-1978cry">${escape(formatResult(form[1]))}</div></div></div>
<div class="icon pos-2 svelte-1978cry"><div id="formTile" style="${"background: " + escape(background(form[2], starTeams[2]), true)}" class="svelte-1978cry"><div class="result svelte-1978cry">${escape(formatResult(form[2]))}</div></div></div>
<div class="icon pos-3 svelte-1978cry"><div id="formTile" style="${"background: " + escape(background(form[3], starTeams[3]), true)}" class="svelte-1978cry"><div class="result svelte-1978cry">${escape(formatResult(form[3]))}</div></div></div>
<div class="icon pos-4 svelte-1978cry"><div id="formTile" style="${"background: " + escape(background(form[4], starTeams[4]), true)}" class="svelte-1978cry"><div class="result svelte-1978cry">${escape(formatResult(form[4]))}</div></div>
</div>`;
});

function toInitials(team) {
    switch (team) {
        case "Brighton and Hove Albion":
            return "BHA";
        case "Manchester City":
            return "MCI";
        case "Manchester United":
            return "MUN";
        case "Aston Villa":
            return "AVL";
        case "Sheffield United":
            return "SHU";
        case "West Bromwich Albion":
            return "WBA";
        case "West Ham United":
            return "WHU";
    }
    return team.slice(0, 3).toUpperCase();
}
let alias = {
    "Wolverhampton Wanderers": "Wolves",
    "Tottenham Hotspur": "Spurs",
    "Leeds United": "Leeds",
    "West Ham United": "West Ham",
    "Brighton and Hove Albion": "Brighton",
};
function toAlias(team) {
    if (team in alias) {
        return alias[team];
    }
    return team;
}
function toHyphenatedName(team) {
    return team.toLowerCase().replace(/ /g, "-");
}
function teamInSeason(form, team, season) {
    return team in form && form[team][season]['1'] != null;
}
function teamColor(team) {
    let teamKey = toHyphenatedName(team);
    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
    return teamColor;
}
function playedMatchdays(data, team) {
    let matchdays = [];
    for (let matchday in data.form[team][data._id]) {
        if (data.form[team][data._id][matchday].score != null) {
            matchdays.push(matchday);
        }
    }
    return matchdays;
}
function currentMatchday(data, team) {
    let matchdays = Object.keys(data.form[team][data._id]);
    for (let i = matchdays.length - 1; i >= 0; i--) {
        if (data.form[team][data._id][matchdays[i]].score != null) {
            return matchdays[i];
        }
    }
    return '1';
}

/* src\components\team\current_form\CurrentForm.svelte generated by Svelte v3.59.2 */

const css$h = {
	code: ".current-form.svelte-oguyd2{font-size:1.7rem;margin:20px 0;width:100%;padding:9px 0;background:var(--purple);color:white;border-radius:var(--border-radius)}.current-form-row.svelte-oguyd2{font-size:13px;display:grid;grid-template-columns:repeat(5, 1fr);width:100%}.current-form-value.svelte-oguyd2{color:var(--win)}.icon-name.svelte-oguyd2{position:relative;margin-top:0.6em}.pos-4.svelte-oguyd2{opacity:100%}.pos-3.svelte-oguyd2{opacity:89%}.pos-2.svelte-oguyd2{opacity:78%}.pos-1.svelte-oguyd2{opacity:67%}.pos-0.svelte-oguyd2{opacity:56%}@media only screen and (max-width: 1000px){.current-form-row.svelte-oguyd2{width:min(80%, 440px);margin:auto}}@media only screen and (max-width: 700px){.current-form-row.svelte-oguyd2{width:95%}}@media only screen and (max-width: 550px){.current-form.svelte-oguyd2{font-size:1.5rem !important}}",
	map: "{\"version\":3,\"file\":\"CurrentForm.svelte\",\"sources\":[\"CurrentForm.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import FormTiles from \\\"./FormTiles.svelte\\\";\\r\\nimport { toInitials } from \\\"../../../lib/team\\\";\\r\\nfunction getSortedMatchdays(data, team) {\\r\\n    let matchdays = Object.keys(data.form[team][data._id]).sort(function (matchday1, matchday2) {\\r\\n        return (new Date(data.form[team][data._id][matchday1].date) -\\r\\n            new Date(data.form[team][data._id][matchday2].date));\\r\\n    });\\r\\n    return matchdays;\\r\\n}\\r\\nfunction getFormStarTeams(data, team, matchdays) {\\r\\n    let formStarTeams = [];\\r\\n    for (let matchday of matchdays) {\\r\\n        let oppTeam = data.form[team][data._id][matchday].team;\\r\\n        formStarTeams.unshift(data.teamRatings[oppTeam].totalRating > 0.75);\\r\\n    }\\r\\n    // Fill in blanks\\r\\n    for (let i = formStarTeams.length; i < 5; i++) {\\r\\n        formStarTeams.unshift(false);\\r\\n    }\\r\\n    return formStarTeams;\\r\\n}\\r\\nfunction getFormIcons(data, team) {\\r\\n    let formIcons = [];\\r\\n    if (Object.keys(data.form[team][data._id][currentMatchday]).length > 0 &&\\r\\n        data.form[team][data._id][currentMatchday].form5 != null) {\\r\\n        formIcons = data.form[team][data._id][currentMatchday].form5.split(\\\"\\\");\\r\\n    }\\r\\n    // Fill in blanks with None icons\\r\\n    for (let i = formIcons.length; i < 5; i++) {\\r\\n        formIcons.unshift(\\\"N\\\");\\r\\n    }\\r\\n    return formIcons.join(\\\"\\\");\\r\\n}\\r\\nfunction getFormInitials(data, team, matchdays) {\\r\\n    let formInitials = [];\\r\\n    for (let matchday of matchdays) {\\r\\n        formInitials.unshift(toInitials(data.form[team][data._id][matchday].team));\\r\\n    }\\r\\n    // Fill in blanks with None icons\\r\\n    for (let i = formInitials.length; i < 5; i++) {\\r\\n        formInitials.unshift(\\\"\\\");\\r\\n    }\\r\\n    return formInitials;\\r\\n}\\r\\nfunction latestNPlayedMatchdays(data, team, matchdays, N) {\\r\\n    let latestN = [];\\r\\n    for (let i = matchdays.length - 1; i >= 0; i--) {\\r\\n        if (data.form[team][data._id][matchdays[i]].score != null) {\\r\\n            latestN.push(matchdays[i]);\\r\\n        }\\r\\n        if (latestN.length >= N) {\\r\\n            break;\\r\\n        }\\r\\n    }\\r\\n    return latestN;\\r\\n}\\r\\nfunction setFormValues() {\\r\\n    let sortedMatchdays = getSortedMatchdays(data, team);\\r\\n    let matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);\\r\\n    formIcons = getFormIcons(data, team);\\r\\n    formStarTeams = getFormStarTeams(data, team, matchdays);\\r\\n    formInitials = getFormInitials(data, team, matchdays);\\r\\n}\\r\\nlet formIcons, formStarTeams, formInitials;\\r\\n$: team && setFormValues();\\r\\nexport let data, currentMatchday, team;\\r\\n</script>\\r\\n\\r\\n{#if formInitials != undefined}\\r\\n  <div class=\\\"current-form-row icon-row\\\">\\r\\n    <FormTiles form=\\\"{formIcons},\\\" starTeams={formStarTeams} />\\r\\n  </div>\\r\\n  <div class=\\\"current-form-row name-row\\\">\\r\\n    <div class=\\\"icon-name pos-0\\\">{formInitials[0]}</div>\\r\\n    <div class=\\\"icon-name pos-1\\\">{formInitials[1]}</div>\\r\\n    <div class=\\\"icon-name pos-2\\\">{formInitials[2]}</div>\\r\\n    <div class=\\\"icon-name pos-3\\\">{formInitials[3]}</div>\\r\\n    <div class=\\\"icon-name pos-4\\\">{formInitials[4]}</div>\\r\\n  </div>\\r\\n{/if}\\r\\n<div class=\\\"current-form\\\">\\r\\n  Current form:\\r\\n  {#if currentMatchday != undefined}\\r\\n    <span class=\\\"current-form-value\\\"\\r\\n      >{(data.form[team][data._id][currentMatchday].formRating5 * 100).toFixed(\\r\\n        1\\r\\n      )}%</span\\r\\n    >\\r\\n  {:else}\\r\\n    None\\r\\n  {/if}\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .current-form {\\r\\n    font-size: 1.7rem;\\r\\n    margin: 20px 0;\\r\\n    width: 100%;\\r\\n    padding: 9px 0;\\r\\n    background: var(--purple);\\r\\n    color: white;\\r\\n    border-radius: var(--border-radius);\\r\\n  }\\r\\n  .current-form-row {\\r\\n    font-size: 13px;\\r\\n    display: grid;\\r\\n    grid-template-columns: repeat(5, 1fr);\\r\\n    width: 100%;\\r\\n  }\\r\\n  .current-form-value {\\r\\n    color: var(--win);\\r\\n  }\\r\\n\\r\\n  .icon-name {\\r\\n    position: relative;\\r\\n    margin-top: 0.6em;\\r\\n  }\\r\\n\\r\\n  .pos-4 {\\r\\n    opacity: 100%;\\r\\n  }\\r\\n  .pos-3 {\\r\\n    opacity: 89%;\\r\\n  }\\r\\n  .pos-2 {\\r\\n    opacity: 78%;\\r\\n  }\\r\\n  .pos-1 {\\r\\n    opacity: 67%;\\r\\n  }\\r\\n  .pos-0 {\\r\\n    opacity: 56%;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1000px) {\\r\\n    .current-form-row {\\r\\n      width: min(80%, 440px);\\r\\n      margin: auto;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .current-form-row {\\r\\n      width: 95%;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .current-form {\\r\\n      font-size: 1.5rem !important;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA8FE,2BAAc,CACZ,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,IAAI,CAAC,CAAC,CACd,KAAK,CAAE,IAAI,CACX,OAAO,CAAE,GAAG,CAAC,CAAC,CACd,UAAU,CAAE,IAAI,QAAQ,CAAC,CACzB,KAAK,CAAE,KAAK,CACZ,aAAa,CAAE,IAAI,eAAe,CACpC,CACA,+BAAkB,CAChB,SAAS,CAAE,IAAI,CACf,OAAO,CAAE,IAAI,CACb,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,CACrC,KAAK,CAAE,IACT,CACA,iCAAoB,CAClB,KAAK,CAAE,IAAI,KAAK,CAClB,CAEA,wBAAW,CACT,QAAQ,CAAE,QAAQ,CAClB,UAAU,CAAE,KACd,CAEA,oBAAO,CACL,OAAO,CAAE,IACX,CACA,oBAAO,CACL,OAAO,CAAE,GACX,CACA,oBAAO,CACL,OAAO,CAAE,GACX,CACA,oBAAO,CACL,OAAO,CAAE,GACX,CACA,oBAAO,CACL,OAAO,CAAE,GACX,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,+BAAkB,CAChB,KAAK,CAAE,IAAI,GAAG,CAAC,CAAC,KAAK,CAAC,CACtB,MAAM,CAAE,IACV,CACF,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,+BAAkB,CAChB,KAAK,CAAE,GACT,CACF,CACA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,2BAAc,CACZ,SAAS,CAAE,MAAM,CAAC,UACpB,CACF\"}"
};

function getSortedMatchdays(data, team) {
	let matchdays = Object.keys(data.form[team][data._id]).sort(function (matchday1, matchday2) {
		return new Date(data.form[team][data._id][matchday1].date) - new Date(data.form[team][data._id][matchday2].date);
	});

	return matchdays;
}

function getFormStarTeams(data, team, matchdays) {
	let formStarTeams = [];

	for (let matchday of matchdays) {
		let oppTeam = data.form[team][data._id][matchday].team;
		formStarTeams.unshift(data.teamRatings[oppTeam].totalRating > 0.75);
	}

	// Fill in blanks
	for (let i = formStarTeams.length; i < 5; i++) {
		formStarTeams.unshift(false);
	}

	return formStarTeams;
}

function latestNPlayedMatchdays(data, team, matchdays, N) {
	let latestN = [];

	for (let i = matchdays.length - 1; i >= 0; i--) {
		if (data.form[team][data._id][matchdays[i]].score != null) {
			latestN.push(matchdays[i]);
		}

		if (latestN.length >= N) {
			break;
		}
	}

	return latestN;
}

const CurrentForm = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getFormIcons(data, team) {
		let formIcons = [];

		if (Object.keys(data.form[team][data._id][currentMatchday]).length > 0 && data.form[team][data._id][currentMatchday].form5 != null) {
			formIcons = data.form[team][data._id][currentMatchday].form5.split("");
		}

		// Fill in blanks with None icons
		for (let i = formIcons.length; i < 5; i++) {
			formIcons.unshift("N");
		}

		return formIcons.join("");
	}

	function getFormInitials(data, team, matchdays) {
		let formInitials = [];

		for (let matchday of matchdays) {
			formInitials.unshift(toInitials(data.form[team][data._id][matchday].team));
		}

		// Fill in blanks with None icons
		for (let i = formInitials.length; i < 5; i++) {
			formInitials.unshift("");
		}

		return formInitials;
	}

	function setFormValues() {
		let sortedMatchdays = getSortedMatchdays(data, team);
		let matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);
		formIcons = getFormIcons(data, team);
		formStarTeams = getFormStarTeams(data, team, matchdays);
		formInitials = getFormInitials(data, team, matchdays);
	}

	let formIcons, formStarTeams, formInitials;
	let { data, currentMatchday, team } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	$$result.css.add(css$h);
	team && setFormValues();

	return `${formInitials != undefined
	? `<div class="current-form-row icon-row svelte-oguyd2">${validate_component(FormTiles, "FormTiles").$$render(
			$$result,
			{
				form: formIcons + ",",
				starTeams: formStarTeams
			},
			{},
			{}
		)}</div>
  <div class="current-form-row name-row svelte-oguyd2"><div class="icon-name pos-0 svelte-oguyd2">${escape(formInitials[0])}</div>
    <div class="icon-name pos-1 svelte-oguyd2">${escape(formInitials[1])}</div>
    <div class="icon-name pos-2 svelte-oguyd2">${escape(formInitials[2])}</div>
    <div class="icon-name pos-3 svelte-oguyd2">${escape(formInitials[3])}</div>
    <div class="icon-name pos-4 svelte-oguyd2">${escape(formInitials[4])}</div></div>`
	: ``}
<div class="current-form svelte-oguyd2">Current form:
  ${currentMatchday != undefined
	? `<span class="current-form-value svelte-oguyd2">${escape((data.form[team][data._id][currentMatchday].formRating5 * 100).toFixed(1))}%</span>`
	: `None`}
</div>`;
});

/* src\components\team\TableSnippet.svelte generated by Svelte v3.59.2 */

const css$g = {
	code: ".table-snippet.svelte-12meswl{position:relative;margin-top:20px;display:flex;flex-direction:column;width:100%;height:auto}.table-row.svelte-12meswl{display:flex;padding:5px 5%;border-radius:var(--border-radius)}.table-row.this-team.svelte-12meswl{padding:14px 5%;font-size:20px}.this-team.svelte-12meswl{font-size:1.1em !important}#divider.svelte-12meswl{align-self:center;border-bottom:1px solid grey;width:90%;margin:auto}.column-title.svelte-12meswl{font-weight:700}.table-position.svelte-12meswl{width:7%}button.svelte-12meswl{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit}.table-team-name.svelte-12meswl{width:63%;text-align:left;margin-left:8px;color:#333333}.table-gd.svelte-12meswl{width:15%}.table-points.svelte-12meswl{width:15%}@media only screen and (max-width: 1100px){.table-snippet.svelte-12meswl{margin-top:0}}@media only screen and (max-width: 550px){.table-snippet.svelte-12meswl{font-size:14px}}",
	map: "{\"version\":3,\"file\":\"TableSnippet.svelte\",\"sources\":[\"TableSnippet.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { toAlias, toHyphenatedName } from '../../lib/team';\\r\\nfunction tableSnippetRange(sortedTeams, team) {\\r\\n    let teamStandingsIdx = sortedTeams.indexOf(team);\\r\\n    let low = teamStandingsIdx - 3;\\r\\n    let high = teamStandingsIdx + 4;\\r\\n    if (low < 0) {\\r\\n        let overflow = low;\\r\\n        high -= overflow;\\r\\n        low = 0;\\r\\n    }\\r\\n    if (high > sortedTeams.length - 1) {\\r\\n        let overflow = high - sortedTeams.length;\\r\\n        low -= overflow;\\r\\n        high = sortedTeams.length;\\r\\n    }\\r\\n    return [low, high];\\r\\n}\\r\\nfunction buildTableSnippet() {\\r\\n    let sortedTeams = Object.keys(data.standings).sort(function (teamA, teamB) {\\r\\n        return (data.standings[teamA][data._id].position -\\r\\n            data.standings[teamB][data._id].position);\\r\\n    });\\r\\n    let [low, high] = tableSnippetRange(sortedTeams, team);\\r\\n    let teamTableIdx;\\r\\n    let rows = [];\\r\\n    for (let i = low; i < high; i++) {\\r\\n        if (sortedTeams[i] === team) {\\r\\n            teamTableIdx = i - low;\\r\\n        }\\r\\n        rows.push({\\r\\n            name: sortedTeams[i],\\r\\n            position: data.standings[sortedTeams[i]][data._id].position,\\r\\n            points: data.standings[sortedTeams[i]][data._id].points,\\r\\n            gd: data.standings[sortedTeams[i]][data._id].gD,\\r\\n        });\\r\\n    }\\r\\n    tableSnippet = {\\r\\n        teamTableIdx: teamTableIdx,\\r\\n        rows: rows,\\r\\n    };\\r\\n}\\r\\nlet tableSnippet;\\r\\n$: team && buildTableSnippet();\\r\\nexport let data, hyphenatedTeam, team, switchTeam;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"table-snippet\\\">\\r\\n  {#if tableSnippet != undefined}\\r\\n    <div class=\\\"divider\\\" />\\r\\n    <div class=\\\"table-row\\\">\\r\\n      <div class=\\\"table-element table-position column-title\\\" />\\r\\n      <div class=\\\"table-element table-team-name column-title\\\">Team</div>\\r\\n      <div class=\\\"table-element table-gd column-title\\\">GD</div>\\r\\n      <div class=\\\"table-element table-points column-title\\\">Points</div>\\r\\n    </div>\\r\\n\\r\\n    {#each tableSnippet.rows as row, i}\\r\\n      <!-- Divider -->\\r\\n      {#if i === 0}\\r\\n        {#if i != tableSnippet.teamTableIdx}\\r\\n          <div id=\\\"divider\\\" />\\r\\n        {/if}\\r\\n      {:else if i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx}\\r\\n        <div id=\\\"divider\\\" />\\r\\n      {/if}\\r\\n      <!-- Row of table -->\\r\\n      {#if i === tableSnippet.teamTableIdx}\\r\\n        <!-- Highlighted row for the team of the current page -->\\r\\n        <div\\r\\n          class=\\\"table-row this-team\\\"\\r\\n          style=\\\"background-color: var(--{hyphenatedTeam});\\\"\\r\\n        >\\r\\n          <div\\r\\n            class=\\\"table-element table-position this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.position}\\r\\n          </div>\\r\\n          <a\\r\\n            href=\\\"/{hyphenatedTeam}\\\"\\r\\n            class=\\\"table-element table-team-name this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {toAlias(row.name)}\\r\\n          </a>\\r\\n          <div\\r\\n            class=\\\"table-element table-gd this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.gd}\\r\\n          </div>\\r\\n          <div\\r\\n            class=\\\"table-element table-points this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.points}\\r\\n          </div>\\r\\n        </div>\\r\\n      {:else}\\r\\n        <!-- Plain row -->\\r\\n        <div class=\\\"table-row\\\">\\r\\n          <div class=\\\"table-element table-position\\\">\\r\\n            {row.position}\\r\\n          </div>\\r\\n          <button\\r\\n            on:click={() => {\\r\\n              switchTeam(toHyphenatedName(row.name));\\r\\n            }}\\r\\n            class=\\\"table-element table-team-name\\\"\\r\\n          >\\r\\n            {toAlias(row.name)}\\r\\n          </button>\\r\\n          <div class=\\\"table-element table-gd\\\">\\r\\n            {row.gd}\\r\\n          </div>\\r\\n          <div class=\\\"table-element table-points\\\">\\r\\n            {row.points}\\r\\n          </div>\\r\\n        </div>\\r\\n      {/if}\\r\\n    {/each}\\r\\n    {#if tableSnippet.teamTableIdx != 6}\\r\\n      <div id=\\\"divider\\\" />\\r\\n    {/if}\\r\\n  {/if}\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .table-snippet {\\r\\n    position: relative;\\r\\n    margin-top: 20px;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    width: 100%;\\r\\n    height: auto;\\r\\n  }\\r\\n  .table-row {\\r\\n    display: flex;\\r\\n    padding: 5px 5%;\\r\\n    border-radius: var(--border-radius);\\r\\n  }\\r\\n  .table-row.this-team {\\r\\n    padding: 14px 5%;\\r\\n    font-size: 20px;\\r\\n  }\\r\\n  .this-team {\\r\\n    font-size: 1.1em !important;\\r\\n  }\\r\\n  #divider {\\r\\n    align-self: center;\\r\\n    border-bottom: 1px solid grey;\\r\\n    width: 90%;\\r\\n    margin: auto;\\r\\n  }\\r\\n  .column-title {\\r\\n    font-weight: 700;\\r\\n  }\\r\\n  .table-position {\\r\\n    width: 7%;\\r\\n  }\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n  }\\r\\n  .table-team-name {\\r\\n    width: 63%;\\r\\n    text-align: left;\\r\\n    margin-left: 8px;\\r\\n    color: #333333;\\r\\n  }\\r\\n  .table-gd {\\r\\n    width: 15%;\\r\\n  }\\r\\n  .table-points {\\r\\n    width: 15%;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .table-snippet {\\r\\n      margin-top: 0;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .table-snippet {\\r\\n      font-size: 14px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAgIE,6BAAe,CACb,QAAQ,CAAE,QAAQ,CAClB,UAAU,CAAE,IAAI,CAChB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IACV,CACA,yBAAW,CACT,OAAO,CAAE,IAAI,CACb,OAAO,CAAE,GAAG,CAAC,EAAE,CACf,aAAa,CAAE,IAAI,eAAe,CACpC,CACA,UAAU,yBAAW,CACnB,OAAO,CAAE,IAAI,CAAC,EAAE,CAChB,SAAS,CAAE,IACb,CACA,yBAAW,CACT,SAAS,CAAE,KAAK,CAAC,UACnB,CACA,uBAAS,CACP,UAAU,CAAE,MAAM,CAClB,aAAa,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,CAC7B,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,IACV,CACA,4BAAc,CACZ,WAAW,CAAE,GACf,CACA,8BAAgB,CACd,KAAK,CAAE,EACT,CACA,qBAAO,CACL,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OACX,CACA,+BAAiB,CACf,KAAK,CAAE,GAAG,CACV,UAAU,CAAE,IAAI,CAChB,WAAW,CAAE,GAAG,CAChB,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,GACT,CACA,4BAAc,CACZ,KAAK,CAAE,GACT,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,6BAAe,CACb,UAAU,CAAE,CACd,CACF,CACA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,6BAAe,CACb,SAAS,CAAE,IACb,CACF\"}"
};

function tableSnippetRange(sortedTeams, team) {
	let teamStandingsIdx = sortedTeams.indexOf(team);
	let low = teamStandingsIdx - 3;
	let high = teamStandingsIdx + 4;

	if (low < 0) {
		let overflow = low;
		high -= overflow;
		low = 0;
	}

	if (high > sortedTeams.length - 1) {
		let overflow = high - sortedTeams.length;
		low -= overflow;
		high = sortedTeams.length;
	}

	return [low, high];
}

const TableSnippet = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildTableSnippet() {
		let sortedTeams = Object.keys(data.standings).sort(function (teamA, teamB) {
			return data.standings[teamA][data._id].position - data.standings[teamB][data._id].position;
		});

		let [low, high] = tableSnippetRange(sortedTeams, team);
		let teamTableIdx;
		let rows = [];

		for (let i = low; i < high; i++) {
			if (sortedTeams[i] === team) {
				teamTableIdx = i - low;
			}

			rows.push({
				name: sortedTeams[i],
				position: data.standings[sortedTeams[i]][data._id].position,
				points: data.standings[sortedTeams[i]][data._id].points,
				gd: data.standings[sortedTeams[i]][data._id].gD
			});
		}

		tableSnippet = { teamTableIdx, rows };
	}

	let tableSnippet;
	let { data, hyphenatedTeam, team, switchTeam } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.hyphenatedTeam === void 0 && $$bindings.hyphenatedTeam && hyphenatedTeam !== void 0) $$bindings.hyphenatedTeam(hyphenatedTeam);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$g);
	team && buildTableSnippet();

	return `<div class="table-snippet svelte-12meswl">${tableSnippet != undefined
	? `<div class="divider"></div>
    <div class="table-row svelte-12meswl"><div class="table-element table-position column-title svelte-12meswl"></div>
      <div class="table-element table-team-name column-title svelte-12meswl">Team</div>
      <div class="table-element table-gd column-title svelte-12meswl">GD</div>
      <div class="table-element table-points column-title svelte-12meswl">Points</div></div>

    ${each(tableSnippet.rows, (row, i) => {
			return `
      ${i === 0
			? `${i != tableSnippet.teamTableIdx
				? `<div id="divider" class="svelte-12meswl"></div>`
				: ``}`
			: `${i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx
				? `<div id="divider" class="svelte-12meswl"></div>`
				: ``}`}
      
      ${i === tableSnippet.teamTableIdx
			? `
        <div class="table-row this-team svelte-12meswl" style="${"background-color: var(--" + escape(hyphenatedTeam, true) + ");"}"><div class="table-element table-position this-team svelte-12meswl" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.position)}</div>
          <a href="${"/" + escape(hyphenatedTeam, true)}" class="table-element table-team-name this-team svelte-12meswl" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(toAlias(row.name))}</a>
          <div class="table-element table-gd this-team svelte-12meswl" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.gd)}</div>
          <div class="table-element table-points this-team svelte-12meswl" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.points)}</div>
        </div>`
			: `
        <div class="table-row svelte-12meswl"><div class="table-element table-position svelte-12meswl">${escape(row.position)}</div>
          <button class="table-element table-team-name svelte-12meswl">${escape(toAlias(row.name))}</button>
          <div class="table-element table-gd svelte-12meswl">${escape(row.gd)}</div>
          <div class="table-element table-points svelte-12meswl">${escape(row.points)}</div>
        </div>`}`;
		})}
    ${tableSnippet.teamTableIdx != 6
		? `<div id="divider" class="svelte-12meswl"></div>`
		: ``}`
	: ``}
</div>`;
});

function ordinal(n) {
    let ord = [, "st", "nd", "rd"];
    let a = n % 100;
    return ord[a > 20 ? a % 10 : a] || "th";
}
function teamStyle(team) {
    let hyphenatedName = toHyphenatedName(team);
    return `background: var(--${hyphenatedName}); color: var(--${hyphenatedName}-secondary);`;
}
function scoreline(homeTeam, awayTeam, homeGoals, awayGoals) {
    return `${homeTeam} ${homeGoals} - ${awayGoals} ${awayTeam}`;
}
function toTitleCase(str) {
    return str
        .toLowerCase()
        .split(" ")
        .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    })
        .join(" ")
        .replace("And", "and");
}

/* src\components\team\NextGame.svelte generated by Svelte v3.59.2 */

const css$f = {
	code: ".left-side.svelte-b6rr06,.right-side.svelte-b6rr06{display:flex;flex:1}.goals-container.svelte-b6rr06{flex-grow:1}.away-goals.svelte-b6rr06,.home-goals.svelte-b6rr06{margin:4px 0}.home-goals.svelte-b6rr06{text-align:right;padding-right:0.5em;border-right:1px solid black}.away-goals.svelte-b6rr06{text-align:left;padding-left:0.5em;border-left:1px solid black}.next-game-title.svelte-b6rr06{width:max-content;padding:6px 20px;border-radius:0 0 var(--border-radius) 0;background:var(--purple);margin:-1px 0 0 -1px}.next-game-season-complete.svelte-b6rr06{display:grid;place-items:center;background:#f0f0f0;background:linear-gradient(45deg, #c600d839, rgb(2 239 255 / 25%), #00fe873e);flex:1}.next-game-title-text.svelte-b6rr06{margin:0;color:white;display:flex}.next-game-team-btn.svelte-b6rr06{color:var(--green) !important}.predictions-and-logo.svelte-b6rr06{font-size:1.4em;width:45%;margin:auto}button.svelte-b6rr06{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit}.predictions-link.svelte-b6rr06{text-decoration:none;color:#333;color:var(--purple)}.predictions-link.svelte-b6rr06:hover{color:rgb(120 120 120)}.past-results.svelte-b6rr06{font-size:22px;width:55%;display:flex;flex-direction:column;padding:15px 20px 10px;border-radius:6px;margin:auto 0}.next-game-prediction-complete.svelte-b6rr06,.next-game-prediction.svelte-b6rr06{border-radius:var(--border-radius);min-height:97.5%;border:6px solid var(--purple)}.next-game-prediction-complete.svelte-b6rr06{display:flex}.next-game-values.svelte-b6rr06{display:flex;margin-right:2vw;min-height:387px}.next-game-position.svelte-b6rr06{font-size:3.3em;font-weight:700}.ordinal-position.svelte-b6rr06{font-size:0.6em}.past-result.svelte-b6rr06{font-size:15px;display:flex}.past-result-date.svelte-b6rr06{font-size:13px;width:90px;margin:3px auto 1px;padding-top:3px;border-radius:4px 4px 0 0}.prev-results-title.svelte-b6rr06{font-weight:700;padding-top:0;margin:0 !important}.no-prev-results.svelte-b6rr06{display:grid;place-items:center;color:rgb(181, 181, 181);color:rgba(0, 0, 0, 0.35);background:rgba(181, 181, 181, 0.3);border-radius:var(--border-radius);padding:100px 0}.next-game-item.svelte-b6rr06{border-radius:9px}.home-team.svelte-b6rr06{float:left;text-align:left;border-radius:var(--border-radius) 0 0 var(--border-radius)}.away-team.svelte-b6rr06{float:left;text-align:right;border-radius:0 var(--border-radius) var(--border-radius) 0}.home-team.svelte-b6rr06,.away-team.svelte-b6rr06{font-size:15px;width:calc(50% - 18px);padding:5px 0 3px;text-align:center}.next-game-team-btn.svelte-b6rr06{color:inherit;text-align:left}.current-form.svelte-b6rr06{border-radius:6px;padding:10px 15px;color:white;background:var(--purple);width:fit-content;margin:auto auto 10px}.current-form-value.svelte-b6rr06{color:var(--green)}@media only screen and (max-width: 1300px){.next-game-values.svelte-b6rr06{margin-right:0}}@media only screen and (max-width: 1100px){.next-game-title.svelte-b6rr06{width:auto;border-radius:0}}@media only screen and (max-width: 1000px){.next-game-prediction-complete.svelte-b6rr06{margin:50px 20px 40px}.next-game-season-complete.svelte-b6rr06{padding:50px 10px}.next-game-prediction.svelte-b6rr06{margin:50px 20px 40px}.next-game-values.svelte-b6rr06{margin:2% 3vw 2% 0;min-height:auto}}@media only screen and (max-width: 800px){.next-game-prediction.svelte-b6rr06{margin:50px 75px 40px}.next-game-values.svelte-b6rr06{flex-direction:column;margin:20px 15px 15px}.predictions-and-logo.svelte-b6rr06{margin:0 auto;width:100%}.past-results.svelte-b6rr06{margin:30px auto 0;width:94%;padding:10px}.next-game-prediction.svelte-b6rr06{padding-bottom:0}.next-game-title-text.svelte-b6rr06{flex-direction:column;text-align:left}.next-game-title.svelte-b6rr06{padding:6px 15px}.no-prev-results.svelte-b6rr06{font-size:0.8em;padding:3em 0}}@media only screen and (max-width: 700px){.next-game-prediction.svelte-b6rr06{margin:40px 20px}}@media only screen and (max-width: 550px){.next-game-title.svelte-b6rr06{padding:6px 15px 7px 12px}.next-game-values.svelte-b6rr06{margin:25px 10px 10px;font-size:0.85em}.next-game-prediction.svelte-b6rr06{margin:40px 14px}}",
	map: "{\"version\":3,\"file\":\"NextGame.svelte\",\"sources\":[\"NextGame.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { toAlias, toInitials, toHyphenatedName, currentMatchday, } from \\\"../../lib/team\\\";\\r\\nimport { ordinal, teamStyle } from \\\"../../lib/format\\\";\\r\\nfunction resultColour(prevMatch, home) {\\r\\n    if (home) {\\r\\n        return prevMatch.homeGoals < prevMatch.awayGoals\\r\\n            ? prevMatch.awayTeam\\r\\n            : prevMatch.homeTeam;\\r\\n    }\\r\\n    else {\\r\\n        return prevMatch.homeGoals > prevMatch.awayGoals\\r\\n            ? prevMatch.homeTeam\\r\\n            : prevMatch.awayTeam;\\r\\n    }\\r\\n}\\r\\nexport let data, team, switchTeam;\\r\\n</script>\\r\\n\\r\\n{#if data.upcoming[team].nextTeam === null}\\r\\n  <div class=\\\"next-game-prediction-complete\\\">\\r\\n    <div class=\\\"next-game-season-complete\\\">\\r\\n      <h1 class=\\\"next-game-title-text\\\">\\r\\n        {data._id}/{data._id + 1} SEASON COMPLETE\\r\\n      </h1>\\r\\n    </div>\\r\\n  </div>\\r\\n{:else}\\r\\n  <div class=\\\"next-game-prediction\\\">\\r\\n    <div class=\\\"next-game-title\\\">\\r\\n      <h1 class=\\\"next-game-title-text\\\">\\r\\n        Next Game:&nbsp\\r\\n        <button\\r\\n          on:click={() => {\\r\\n            switchTeam(toHyphenatedName(data.upcoming[team].nextTeam));\\r\\n          }}\\r\\n          class=\\\"next-game-team-btn\\\"\\r\\n          >{toAlias(data.upcoming[team].nextTeam)}&nbsp</button\\r\\n        >\\r\\n        ({data.upcoming[team].atHome ? \\\"Home\\\" : \\\"Away\\\"})\\r\\n      </h1>\\r\\n    </div>\\r\\n\\r\\n    <div class=\\\"next-game-values\\\">\\r\\n      <div class=\\\"predictions-and-logo\\\">\\r\\n        <div class=\\\"next-game-position\\\" />\\r\\n        <div class=\\\"predictions\\\">\\r\\n          <div class=\\\"next-game-item\\\">\\r\\n            <div class=\\\"next-game-position\\\">\\r\\n              {data.standings[data.upcoming[team].nextTeam][data._id]\\r\\n                .position}<span class=\\\"ordinal-position\\\"\\r\\n                >{ordinal(\\r\\n                  data.standings[data.upcoming[team].nextTeam][data._id]\\r\\n                    .position\\r\\n                )}</span\\r\\n              >\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"next-game-item current-form\\\">\\r\\n            Current form:\\r\\n            <span class=\\\"current-form-value\\\"\\r\\n              >{(\\r\\n                data.form[data.upcoming[team].nextTeam][data._id][\\r\\n                  currentMatchday(data, data.upcoming[team].nextTeam)\\r\\n                ].formRating5 * 100\\r\\n              ).toFixed(1)}%</span\\r\\n            >\\r\\n          </div>\\r\\n          <div class=\\\"next-game-item\\\">\\r\\n            Score prediction\\r\\n            <br />\\r\\n            <a class=\\\"predictions-link\\\" href=\\\"/predictions\\\">\\r\\n              <b\\r\\n                >{data.upcoming[team].prediction}</b\\r\\n              >\\r\\n            </a>\\r\\n            <br />\\r\\n          </div>\\r\\n        </div>\\r\\n      </div>\\r\\n      <div class=\\\"past-results\\\">\\r\\n        {#if data.upcoming[team].prevMatches.length === 0}\\r\\n          <div class=\\\"next-game-item prev-results-title no-prev-results\\\">\\r\\n            No previous results\\r\\n          </div>\\r\\n        {:else}\\r\\n          <div class=\\\"next-game-item prev-results-title\\\">Previous results</div>\\r\\n        {/if}\\r\\n\\r\\n        <!-- Display table of previous results against the next team this team is playing -->\\r\\n        {#each data.upcoming[team].prevMatches as prevMatch}\\r\\n          <div class=\\\"next-game-item-container\\\">\\r\\n            <div class=\\\"past-result-date result-details\\\">\\r\\n              {new Date(prevMatch.date).toLocaleDateString(\\\"en-GB\\\", {\\r\\n                year: \\\"numeric\\\",\\r\\n                month: \\\"short\\\",\\r\\n                day: \\\"numeric\\\",\\r\\n              })}\\r\\n            </div>\\r\\n            <div class=\\\"next-game-item result-details\\\">\\r\\n              <div class=\\\"past-result\\\">\\r\\n                <div class=\\\"left-side\\\">\\r\\n                  <div class=\\\"home-team\\\" style={teamStyle(prevMatch.homeTeam)}>\\r\\n                    {toInitials(prevMatch.homeTeam)}\\r\\n                  </div>\\r\\n                  <div\\r\\n                    class=\\\"goals-container\\\"\\r\\n                    style={teamStyle(resultColour(prevMatch, true))}\\r\\n                  >\\r\\n                    <div class=\\\"home-goals\\\">\\r\\n                      {prevMatch.homeGoals}\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"right-side\\\">\\r\\n                  <div\\r\\n                    class=\\\"goals-container\\\"\\r\\n                    style={teamStyle(resultColour(prevMatch, false))}\\r\\n                  >\\r\\n                    <div class=\\\"away-goals\\\">\\r\\n                      {prevMatch.awayGoals}\\r\\n                    </div>\\r\\n                  </div>\\r\\n                  <div class=\\\"away-team\\\" style={teamStyle(prevMatch.awayTeam)}>\\r\\n                    {toInitials(prevMatch.awayTeam)}\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n              <div style=\\\"clear: both\\\" />\\r\\n            </div>\\r\\n          </div>\\r\\n        {/each}\\r\\n      </div>\\r\\n    </div>\\r\\n  </div>\\r\\n{/if}\\r\\n\\r\\n<style scoped>\\r\\n  .left-side,\\r\\n  .right-side {\\r\\n    display: flex;\\r\\n    flex: 1;\\r\\n  }\\r\\n  .goals-container {\\r\\n    flex-grow: 1;\\r\\n  }\\r\\n  .away-goals,\\r\\n  .home-goals {\\r\\n    margin: 4px 0;\\r\\n  }\\r\\n  .home-goals {\\r\\n    text-align: right;\\r\\n    padding-right: 0.5em;\\r\\n    border-right: 1px solid black;\\r\\n  }\\r\\n  .away-goals {\\r\\n    text-align: left;\\r\\n    padding-left: 0.5em;\\r\\n    border-left: 1px solid black;\\r\\n  }\\r\\n  .next-game-title {\\r\\n    width: max-content;\\r\\n    padding: 6px 20px;\\r\\n    border-radius: 0 0 var(--border-radius) 0;\\r\\n    background: var(--purple);\\r\\n    margin: -1px 0 0 -1px; /* To avoid top and left gap when zooming out */\\r\\n  }\\r\\n  .next-game-season-complete {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    background: #f0f0f0;\\r\\n    background: linear-gradient(45deg, #c600d839, rgb(2 239 255 / 25%), #00fe873e);\\r\\n    flex: 1;\\r\\n  }\\r\\n  .next-game-title-text {\\r\\n    margin: 0;\\r\\n    color: white;\\r\\n    display: flex;\\r\\n  }\\r\\n  .next-game-team-btn {\\r\\n    color: var(--green) !important;\\r\\n  }\\r\\n  .predictions-and-logo {\\r\\n    font-size: 1.4em;\\r\\n    width: 45%;\\r\\n    margin: auto;\\r\\n  }\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n  }\\r\\n  .predictions-link {\\r\\n    text-decoration: none;\\r\\n    color: #333;\\r\\n    color: var(--purple);\\r\\n  }\\r\\n  .predictions-link:hover {\\r\\n    color: rgb(120 120 120);\\r\\n  }\\r\\n  .past-results {\\r\\n    font-size: 22px;\\r\\n    width: 55%;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    padding: 15px 20px 10px;\\r\\n    border-radius: 6px;\\r\\n    margin: auto 0;\\r\\n  }\\r\\n  .next-game-prediction-complete,\\r\\n  .next-game-prediction {\\r\\n    border-radius: var(--border-radius);\\r\\n    min-height: 97.5%;\\r\\n    border: 6px solid var(--purple);\\r\\n  }\\r\\n  .next-game-prediction-complete {\\r\\n    display: flex;\\r\\n  }\\r\\n  .next-game-values {\\r\\n    display: flex;\\r\\n    margin-right: 2vw;\\r\\n    min-height: 387px;\\r\\n  }\\r\\n  .next-game-position {\\r\\n    font-size: 3.3em;\\r\\n    font-weight: 700;\\r\\n  }\\r\\n  .ordinal-position {\\r\\n    font-size: 0.6em;\\r\\n  }\\r\\n  .past-result {\\r\\n    font-size: 15px;\\r\\n    display: flex;\\r\\n  }\\r\\n  .past-result-date {\\r\\n    font-size: 13px;\\r\\n    width: 90px;\\r\\n    margin: 3px auto 1px;\\r\\n    padding-top: 3px;\\r\\n    border-radius: 4px 4px 0 0;\\r\\n  }\\r\\n  .prev-results-title {\\r\\n    font-weight: 700;\\r\\n    padding-top: 0;\\r\\n    margin: 0 !important;\\r\\n  }\\r\\n  .no-prev-results {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    color: rgb(181, 181, 181);\\r\\n    color: rgba(0, 0, 0, 0.35);\\r\\n    background: rgba(181, 181, 181, 0.3);\\r\\n    border-radius: var(--border-radius);\\r\\n    padding: 100px 0;\\r\\n  }\\r\\n  .next-game-item {\\r\\n    border-radius: 9px;\\r\\n  }\\r\\n  .home-team {\\r\\n    float: left;\\r\\n    text-align: left;\\r\\n    border-radius: var(--border-radius) 0 0 var(--border-radius);\\r\\n  }\\r\\n  .away-team {\\r\\n    float: left;\\r\\n    text-align: right;\\r\\n    border-radius: 0 var(--border-radius) var(--border-radius) 0;\\r\\n  }\\r\\n  .home-team,\\r\\n  .away-team {\\r\\n    font-size: 15px;\\r\\n    width: calc(50% - 18px);\\r\\n    padding: 5px 0 3px;\\r\\n    text-align: center;\\r\\n  }\\r\\n  .next-game-team-btn {\\r\\n    color: inherit;\\r\\n    text-align: left;\\r\\n  }\\r\\n  .current-form {\\r\\n    border-radius: 6px;\\r\\n    padding: 10px 15px;\\r\\n    color: white;\\r\\n    background: var(--purple);\\r\\n    width: fit-content;\\r\\n    margin: auto auto 10px;\\r\\n  }\\r\\n  .current-form-value {\\r\\n    color: var(--green);\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1300px) {\\r\\n    .next-game-values {\\r\\n      margin-right: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .next-game-title {\\r\\n      width: auto;\\r\\n      border-radius: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1000px) {\\r\\n    .next-game-prediction-complete {\\r\\n      margin: 50px 20px 40px;\\r\\n    }\\r\\n    .next-game-season-complete {\\r\\n      padding: 50px 10px;\\r\\n    }\\r\\n    .next-game-prediction {\\r\\n      margin: 50px 20px 40px;\\r\\n      \\r\\n    }\\r\\n    .next-game-values {\\r\\n      margin: 2% 3vw 2% 0;\\r\\n      min-height: auto;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 50px 75px 40px;\\r\\n    }\\r\\n\\r\\n    /* Change next game to column orientation */\\r\\n    .next-game-values {\\r\\n      flex-direction: column;\\r\\n      margin: 20px 15px 15px;\\r\\n    }\\r\\n\\r\\n    .predictions-and-logo {\\r\\n      margin: 0 auto;\\r\\n      width: 100%;\\r\\n    }\\r\\n\\r\\n    .past-results {\\r\\n      margin: 30px auto 0;\\r\\n      width: 94%;\\r\\n      padding: 10px;\\r\\n    }\\r\\n\\r\\n    .next-game-prediction {\\r\\n      padding-bottom: 0;\\r\\n    }\\r\\n    .next-game-title-text {\\r\\n      flex-direction: column;\\r\\n      text-align: left;\\r\\n    }\\r\\n\\r\\n    .next-game-title {\\r\\n      padding: 6px 15px;\\r\\n    }\\r\\n    .no-prev-results {\\r\\n      font-size: 0.8em;\\r\\n      padding: 3em 0;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 40px 20px;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .next-game-title {\\r\\n      padding: 6px 15px 7px 12px;\\r\\n    }\\r\\n    .next-game-values {\\r\\n      margin: 25px 10px 10px;\\r\\n      font-size: 0.85em;\\r\\n    }\\r\\n    .next-game-prediction {\\r\\n      margin: 40px 14px;\\r\\n    }\\r\\n    .next-game-logo {\\r\\n      height: 190px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

function resultColour(prevMatch, home) {
	if (home) {
		return prevMatch.homeGoals < prevMatch.awayGoals
		? prevMatch.awayTeam
		: prevMatch.homeTeam;
	} else {
		return prevMatch.homeGoals > prevMatch.awayGoals
		? prevMatch.homeTeam
		: prevMatch.awayTeam;
	}
}

const NextGame = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { data, team, switchTeam } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$f);

	return `${data.upcoming[team].nextTeam === null
	? `<div class="next-game-prediction-complete svelte-b6rr06"><div class="next-game-season-complete svelte-b6rr06"><h1 class="next-game-title-text svelte-b6rr06">${escape(data._id)}/${escape(data._id + 1)} SEASON COMPLETE
      </h1></div></div>`
	: `<div class="next-game-prediction svelte-b6rr06"><div class="next-game-title svelte-b6rr06"><h1 class="next-game-title-text svelte-b6rr06">Next Game: 
        <button class="next-game-team-btn svelte-b6rr06">${escape(toAlias(data.upcoming[team].nextTeam))} </button>
        (${escape(data.upcoming[team].atHome ? "Home" : "Away")})
      </h1></div>

    <div class="next-game-values svelte-b6rr06"><div class="predictions-and-logo svelte-b6rr06"><div class="next-game-position svelte-b6rr06"></div>
        <div class="predictions"><div class="next-game-item svelte-b6rr06"><div class="next-game-position svelte-b6rr06">${escape(data.standings[data.upcoming[team].nextTeam][data._id].position)}<span class="ordinal-position svelte-b6rr06">${escape(ordinal(data.standings[data.upcoming[team].nextTeam][data._id].position))}</span></div></div>
          <div class="next-game-item current-form svelte-b6rr06">Current form:
            <span class="current-form-value svelte-b6rr06">${escape((data.form[data.upcoming[team].nextTeam][data._id][currentMatchday(data, data.upcoming[team].nextTeam)].formRating5 * 100).toFixed(1))}%</span></div>
          <div class="next-game-item svelte-b6rr06">Score prediction
            <br>
            <a class="predictions-link svelte-b6rr06" href="/predictions"><b>${escape(data.upcoming[team].prediction)}</b></a>
            <br></div></div></div>
      <div class="past-results svelte-b6rr06">${data.upcoming[team].prevMatches.length === 0
		? `<div class="next-game-item prev-results-title no-prev-results svelte-b6rr06">No previous results
          </div>`
		: `<div class="next-game-item prev-results-title svelte-b6rr06">Previous results</div>`}

        
        ${each(data.upcoming[team].prevMatches, prevMatch => {
			return `<div class="next-game-item-container"><div class="past-result-date result-details svelte-b6rr06">${escape(new Date(prevMatch.date).toLocaleDateString("en-GB", {
				year: "numeric",
				month: "short",
				day: "numeric"
			}))}</div>
            <div class="next-game-item result-details svelte-b6rr06"><div class="past-result svelte-b6rr06"><div class="left-side svelte-b6rr06"><div class="home-team svelte-b6rr06"${add_attribute("style", teamStyle(prevMatch.homeTeam), 0)}>${escape(toInitials(prevMatch.homeTeam))}</div>
                  <div class="goals-container svelte-b6rr06"${add_attribute("style", teamStyle(resultColour(prevMatch, true)), 0)}><div class="home-goals svelte-b6rr06">${escape(prevMatch.homeGoals)}</div>
                  </div></div>
                <div class="right-side svelte-b6rr06"><div class="goals-container svelte-b6rr06"${add_attribute("style", teamStyle(resultColour(prevMatch, false)), 0)}><div class="away-goals svelte-b6rr06">${escape(prevMatch.awayGoals)}
                    </div></div>
                  <div class="away-team svelte-b6rr06"${add_attribute("style", teamStyle(prevMatch.awayTeam), 0)}>${escape(toInitials(prevMatch.awayTeam))}</div>
                </div></div>
              <div style="clear: both"></div></div>
          </div>`;
		})}</div></div></div>`}`;
});

function identicalScore(prediction, actual) {
    return (Math.round(prediction.homeGoals) === actual.homeGoals &&
        Math.round(prediction.awayGoals) === actual.awayGoals);
}
function sameResult(prediction, actual) {
    return ((Math.round(prediction.homeGoals) > Math.round(prediction.awayGoals) &&
        Math.round(actual.homeGoals) > Math.round(actual.awayGoals)) ||
        (Math.round(prediction.homeGoals) === Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) === Math.round(actual.awayGoals)) ||
        (Math.round(prediction.homeGoals) < Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) < Math.round(actual.awayGoals)));
}
function isCleanSheet(h, a, atHome) {
    return (a === 0 && atHome) || (h === 0 && !atHome);
}
function goalsScored(h, a, atHome) {
    if (atHome) {
        return h;
    }
    else {
        return a;
    }
}
function goalsConceded(h, a, atHome) {
    if (atHome) {
        return a;
    }
    else {
        return h;
    }
}
function notScored(h, a, atHome) {
    return (h === 0 && atHome) || (a === 0 && !atHome);
}

/* src\components\team\goals_scored_and_conceded\StatsValues.svelte generated by Svelte v3.59.2 */

const css$e = {
	code: ".ssp-1st.svelte-11i30am{color:var(--green)}.ssp-2nd.svelte-11i30am{color:#48f98f}.ssp-3rd.svelte-11i30am{color:#65f497}.ssp-4th.svelte-11i30am{color:#7aef9f}.ssp-5th.svelte-11i30am{color:#8ceaa7}.ssp-6th.svelte-11i30am{color:#9be4af}.ssp-7th.svelte-11i30am{color:#a9deb6}.ssp-8th.svelte-11i30am{color:#b6d9bd}.ssp-9th.svelte-11i30am{color:#c1d2c5}.ssp-10th.svelte-11i30am{color:#cccccc}.ssp-11th.svelte-11i30am{color:#cccccc}.ssp-12th.svelte-11i30am{color:#d7beb9}.ssp-13th.svelte-11i30am{color:#e0b0a6}.ssp-14th.svelte-11i30am{color:#e7a293}.ssp-15th.svelte-11i30am{color:#ed9380}.ssp-16th.svelte-11i30am{color:#f1836e}.ssp-17th.svelte-11i30am{color:#f4735c}.ssp-18th.svelte-11i30am{color:#f6604b}.ssp-19th.svelte-11i30am{color:#f84c39}.ssp-20th.svelte-11i30am{color:#f83027}.season-stats.svelte-11i30am{display:flex;font-size:2.2em;width:100%;letter-spacing:-0.06em}.season-stat-value.svelte-11i30am{font-size:3.2em;line-height:0.6em;font-weight:700;width:fit-content;margin:0 auto;position:relative;user-select:none;display:flex}.season-stat-position.svelte-11i30am{font-size:0.3em;line-height:0;margin-left:0.2em}.hidden.svelte-11i30am{color:transparent}.season-stat.svelte-11i30am{flex:1}@media only screen and (max-width: 1400px){.season-stat-value.svelte-11i30am{font-size:2.5em}.season-stats-row.svelte-11i30am{margin:70px 0 10px}.season-stat-text.svelte-11i30am{font-size:0.9em}}@media only screen and (max-width: 800px){.season-stats.svelte-11i30am{flex-direction:column}.season-stat-text.svelte-11i30am{font-size:0.9em}.season-stat.svelte-11i30am{margin:0.5em 0 0.9em 0}.season-stat-value.svelte-11i30am{font-size:2.5em}.season-stat-text.svelte-11i30am{font-size:0.9em}}@media only screen and (max-width: 550px){.season-stat-value.svelte-11i30am{font-size:1.4em;letter-spacing:0.01em}.season-stat.svelte-11i30am{margin:0.25em 0 0.45em 0}.season-stat-position.svelte-11i30am{font-size:0.5em;top:-0.5em}.season-stat-text.svelte-11i30am{letter-spacing:-0.04em;font-size:0.7em}}",
	map: "{\"version\":3,\"file\":\"StatsValues.svelte\",\"sources\":[\"StatsValues.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { onMount } from \\\"svelte\\\";\\r\\nimport { ordinal } from \\\"../../../lib/format\\\";\\r\\nimport { isCleanSheet, notScored, goalsScored, goalsConceded, } from \\\"../../../lib/goals\\\";\\r\\nfunction getStatsRank(seasonStats, attribute, team, reverse) {\\r\\n    let sorted = Object.keys(seasonStats).sort(function (team1, team2) {\\r\\n        return seasonStats[team2][attribute] - seasonStats[team1][attribute];\\r\\n    });\\r\\n    let rank = sorted.indexOf(team) + 1;\\r\\n    if (reverse) {\\r\\n        rank = 21 - rank;\\r\\n    }\\r\\n    return rank;\\r\\n}\\r\\nfunction getStatsRankings(seasonStats, team) {\\r\\n    let xGRank = getStatsRank(seasonStats, \\\"xG\\\", team, false);\\r\\n    // Reverse - lower rank the better\\r\\n    let xCRank = getStatsRank(seasonStats, \\\"xC\\\", team, true);\\r\\n    let cleanSheetRatioRank = getStatsRank(seasonStats, \\\"cleanSheetRatio\\\", team, false);\\r\\n    return {\\r\\n        xG: `${xGRank}${ordinal(xGRank)}`,\\r\\n        xC: `${xCRank}${ordinal(xCRank)}`,\\r\\n        cleanSheetRatio: `${cleanSheetRatioRank}${ordinal(cleanSheetRatioRank)}`,\\r\\n    };\\r\\n}\\r\\nfunction setStatsValues(seasonStats, team) {\\r\\n    rank = getStatsRankings(seasonStats, team);\\r\\n    // Keep ordinal values at the correct offset\\r\\n    // Once rank values have updated, init positional offset for ordinal values\\r\\n    // window.addEventListener(\\\"resize\\\", setPositionalOffset);\\r\\n}\\r\\nfunction countOccurances(data, seasonStats, team, season) {\\r\\n    if (!(team in data.form)) {\\r\\n        return;\\r\\n    }\\r\\n    for (let matchday of Object.keys(data.form[team][season])) {\\r\\n        let score = data.form[team][season][matchday].score;\\r\\n        if (score != null) {\\r\\n            let atHome = data.form[team][season][matchday].atHome;\\r\\n            if (isCleanSheet(score.homeGoals, score.awayGoals, atHome)) {\\r\\n                seasonStats[team].cleanSheetRatio += 1;\\r\\n            }\\r\\n            if (notScored(score.homeGoals, score.awayGoals, atHome)) {\\r\\n                seasonStats[team].noGoalRatio += 1;\\r\\n            }\\r\\n            seasonStats[team].xG += goalsScored(score.homeGoals, score.awayGoals, atHome);\\r\\n            seasonStats[team].xC += goalsConceded(score.homeGoals, score.awayGoals, atHome);\\r\\n            seasonStats[team].played += 1;\\r\\n        }\\r\\n    }\\r\\n}\\r\\nfunction buildStats(data) {\\r\\n    let stats = {};\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        stats[team] = {\\r\\n            cleanSheetRatio: 0,\\r\\n            noGoalRatio: 0,\\r\\n            xC: 0,\\r\\n            xG: 0,\\r\\n            played: 0,\\r\\n        };\\r\\n        countOccurances(data, stats, team, data._id);\\r\\n        countOccurances(data, stats, team, data._id - 1);\\r\\n        if (stats[team].played > 0) {\\r\\n            stats[team].xG /= stats[team].played;\\r\\n            stats[team].xC /= stats[team].played;\\r\\n            stats[team].cleanSheetRatio /= stats[team].played;\\r\\n            stats[team].noGoalRatio /= stats[team].played;\\r\\n        }\\r\\n    }\\r\\n    return stats;\\r\\n}\\r\\nfunction refreshStatsValues() {\\r\\n    if (setup) {\\r\\n        setStatsValues(stats, team);\\r\\n    }\\r\\n}\\r\\nlet stats;\\r\\nlet rank = {\\r\\n    xG: \\\"\\\",\\r\\n    xC: \\\"\\\",\\r\\n    cleanSheetRatio: \\\"\\\",\\r\\n};\\r\\nlet setup = false;\\r\\nonMount(() => {\\r\\n    stats = buildStats(data);\\r\\n    stats;\\r\\n    setStatsValues(stats, team);\\r\\n    setup = true;\\r\\n});\\r\\n$: team && refreshStatsValues();\\r\\nexport let data, team;\\r\\n</script>\\r\\n\\r\\n{#if stats != undefined}\\r\\n  <div class=\\\"season-stats\\\">\\r\\n    <div class=\\\"season-stat goals-per-game\\\">\\r\\n      <div class=\\\"season-stat-value\\\">\\r\\n        <div class=\\\"season-stat-position hidden\\\">\\r\\n          {rank.xG}\\r\\n        </div>\\r\\n        <div class=\\\"season-stat-number\\\">\\r\\n          {stats[team].xG.toFixed(2)}\\r\\n        </div>\\r\\n        <div class=\\\"season-stat-position ssp-{rank.xG}\\\">\\r\\n          {rank.xG}\\r\\n        </div>\\r\\n      </div>\\r\\n      <div class=\\\"season-stat-text\\\">goals per game</div>\\r\\n    </div>\\r\\n    <div class=\\\"season-stat conceded-per-game\\\">\\r\\n      <div class=\\\"season-stat-value\\\">\\r\\n        <div class=\\\"season-stat-position hidden\\\">\\r\\n          {rank.xC}\\r\\n        </div>\\r\\n        <div class=\\\"season-stat-number\\\">\\r\\n          {stats[team].xC.toFixed(2)}\\r\\n        </div>\\r\\n        <div class=\\\"season-stat-position ssp-{rank.xC}\\\">\\r\\n          {rank.xC}\\r\\n        </div>\\r\\n      </div>\\r\\n      <div class=\\\"season-stat-text\\\">conceded per game</div>\\r\\n    </div>\\r\\n    <div class=\\\"season-stat clean-sheet-ratio\\\">\\r\\n      <div class=\\\"season-stat-value\\\">\\r\\n        <div class=\\\"season-stat-position hidden\\\">\\r\\n          {rank.cleanSheetRatio}\\r\\n        </div>\\r\\n        <div class=\\\"season-stat-number\\\">\\r\\n          {stats[team].cleanSheetRatio.toFixed(2)}\\r\\n        </div>\\r\\n        <div class=\\\"season-stat-position ssp-{rank.cleanSheetRatio}\\\">\\r\\n          {rank.cleanSheetRatio}\\r\\n        </div>\\r\\n      </div>\\r\\n      <div class=\\\"season-stat-text\\\">clean sheets</div>\\r\\n    </div>\\r\\n  </div>\\r\\n{/if}\\r\\n\\r\\n<style scoped>\\r\\n  .ssp-1st {\\r\\n    color: var(--green);\\r\\n  }\\r\\n  .ssp-2nd {\\r\\n    color: #48f98f;\\r\\n  }\\r\\n  .ssp-3rd {\\r\\n    color: #65f497;\\r\\n  }\\r\\n  .ssp-4th {\\r\\n    color: #7aef9f;\\r\\n  }\\r\\n  .ssp-5th {\\r\\n    color: #8ceaa7;\\r\\n  }\\r\\n  .ssp-6th {\\r\\n    color: #9be4af;\\r\\n  }\\r\\n  .ssp-7th {\\r\\n    color: #a9deb6;\\r\\n  }\\r\\n  .ssp-8th {\\r\\n    color: #b6d9bd;\\r\\n  }\\r\\n  .ssp-9th {\\r\\n    color: #c1d2c5;\\r\\n  }\\r\\n  .ssp-10th {\\r\\n    color: #cccccc;\\r\\n  }\\r\\n  .ssp-11th {\\r\\n    color: #cccccc;\\r\\n  }\\r\\n  .ssp-12th {\\r\\n    color: #d7beb9;\\r\\n  }\\r\\n  .ssp-13th {\\r\\n    color: #e0b0a6;\\r\\n  }\\r\\n  .ssp-14th {\\r\\n    color: #e7a293;\\r\\n  }\\r\\n  .ssp-15th {\\r\\n    color: #ed9380;\\r\\n  }\\r\\n  .ssp-16th {\\r\\n    color: #f1836e;\\r\\n  }\\r\\n  .ssp-17th {\\r\\n    color: #f4735c;\\r\\n  }\\r\\n  .ssp-18th {\\r\\n    color: #f6604b;\\r\\n  }\\r\\n  .ssp-19th {\\r\\n    color: #f84c39;\\r\\n  }\\r\\n  .ssp-20th {\\r\\n    color: #f83027;\\r\\n  }\\r\\n  .season-stats {\\r\\n    display: flex;\\r\\n    font-size: 2.2em;\\r\\n    width: 100%;\\r\\n    letter-spacing: -0.06em;\\r\\n  }\\r\\n\\r\\n  .season-stat-value {\\r\\n    font-size: 3.2em;\\r\\n    line-height: 0.6em;\\r\\n    font-weight: 700;\\r\\n    width: fit-content;\\r\\n    margin: 0 auto;\\r\\n    position: relative;\\r\\n    user-select: none;\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  .season-stat-position {\\r\\n    font-size: 0.3em;\\r\\n    line-height: 0;\\r\\n    margin-left: 0.2em;\\r\\n  }\\r\\n  .hidden {\\r\\n    color: transparent;\\r\\n  }\\r\\n\\r\\n  .season-stat {\\r\\n    flex: 1;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1400px) {\\r\\n    .season-stat-value {\\r\\n      font-size: 2.5em;\\r\\n    }\\r\\n\\r\\n    .season-stats-row {\\r\\n      margin: 70px 0 10px;\\r\\n    }\\r\\n\\r\\n    .season-stat-text {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .season-stats {\\r\\n      flex-direction: column;\\r\\n    }\\r\\n\\r\\n    .season-stat-text {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n    .season-stat {\\r\\n      margin: 0.5em 0 0.9em 0;\\r\\n    }\\r\\n\\r\\n    .season-stat-value {\\r\\n      font-size: 2.5em;\\r\\n    }\\r\\n\\r\\n    .season-stat-text {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .season-stat-value {\\r\\n      font-size: 1.4em;\\r\\n      letter-spacing: 0.01em;\\r\\n    }\\r\\n\\r\\n    .season-stat {\\r\\n      margin: 0.25em 0 0.45em 0;\\r\\n    }\\r\\n    .season-stat-position {\\r\\n      font-size: 0.5em;\\r\\n      top: -0.5em;\\r\\n    }\\r\\n    .season-stat-text {\\r\\n      letter-spacing: -0.04em;\\r\\n      font-size: 0.7em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA6IE,uBAAS,CACP,KAAK,CAAE,IAAI,OAAO,CACpB,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,uBAAS,CACP,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,wBAAU,CACR,KAAK,CAAE,OACT,CACA,4BAAc,CACZ,OAAO,CAAE,IAAI,CACb,SAAS,CAAE,KAAK,CAChB,KAAK,CAAE,IAAI,CACX,cAAc,CAAE,OAClB,CAEA,iCAAmB,CACjB,SAAS,CAAE,KAAK,CAChB,WAAW,CAAE,KAAK,CAClB,WAAW,CAAE,GAAG,CAChB,KAAK,CAAE,WAAW,CAClB,MAAM,CAAE,CAAC,CAAC,IAAI,CACd,QAAQ,CAAE,QAAQ,CAClB,WAAW,CAAE,IAAI,CACjB,OAAO,CAAE,IACX,CAEA,oCAAsB,CACpB,SAAS,CAAE,KAAK,CAChB,WAAW,CAAE,CAAC,CACd,WAAW,CAAE,KACf,CACA,sBAAQ,CACN,KAAK,CAAE,WACT,CAEA,2BAAa,CACX,IAAI,CAAE,CACR,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,iCAAmB,CACjB,SAAS,CAAE,KACb,CAEA,gCAAkB,CAChB,MAAM,CAAE,IAAI,CAAC,CAAC,CAAC,IACjB,CAEA,gCAAkB,CAChB,SAAS,CAAE,KACb,CACF,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,4BAAc,CACZ,cAAc,CAAE,MAClB,CAEA,gCAAkB,CAChB,SAAS,CAAE,KACb,CACA,2BAAa,CACX,MAAM,CAAE,KAAK,CAAC,CAAC,CAAC,KAAK,CAAC,CACxB,CAEA,iCAAmB,CACjB,SAAS,CAAE,KACb,CAEA,gCAAkB,CAChB,SAAS,CAAE,KACb,CACF,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,iCAAmB,CACjB,SAAS,CAAE,KAAK,CAChB,cAAc,CAAE,MAClB,CAEA,2BAAa,CACX,MAAM,CAAE,MAAM,CAAC,CAAC,CAAC,MAAM,CAAC,CAC1B,CACA,oCAAsB,CACpB,SAAS,CAAE,KAAK,CAChB,GAAG,CAAE,MACP,CACA,gCAAkB,CAChB,cAAc,CAAE,OAAO,CACvB,SAAS,CAAE,KACb,CACF\"}"
};

function getStatsRank(seasonStats, attribute, team, reverse) {
	let sorted = Object.keys(seasonStats).sort(function (team1, team2) {
		return seasonStats[team2][attribute] - seasonStats[team1][attribute];
	});

	let rank = sorted.indexOf(team) + 1;

	if (reverse) {
		rank = 21 - rank;
	}

	return rank;
}

const StatsValues = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getStatsRankings(seasonStats, team) {
		let xGRank = getStatsRank(seasonStats, "xG", team, false);

		// Reverse - lower rank the better
		let xCRank = getStatsRank(seasonStats, "xC", team, true);

		let cleanSheetRatioRank = getStatsRank(seasonStats, "cleanSheetRatio", team, false);

		return {
			xG: `${xGRank}${ordinal(xGRank)}`,
			xC: `${xCRank}${ordinal(xCRank)}`,
			cleanSheetRatio: `${cleanSheetRatioRank}${ordinal(cleanSheetRatioRank)}`
		};
	}

	function setStatsValues(seasonStats, team) {
		rank = getStatsRankings(seasonStats, team);
	} // Keep ordinal values at the correct offset
	// Once rank values have updated, init positional offset for ordinal values

	// window.addEventListener("resize", setPositionalOffset);
	function countOccurances(data, seasonStats, team, season) {
		if (!(team in data.form)) {
			return;
		}

		for (let matchday of Object.keys(data.form[team][season])) {
			let score = data.form[team][season][matchday].score;

			if (score != null) {
				let atHome = data.form[team][season][matchday].atHome;

				if (isCleanSheet(score.homeGoals, score.awayGoals, atHome)) {
					seasonStats[team].cleanSheetRatio += 1;
				}

				if (notScored(score.homeGoals, score.awayGoals, atHome)) {
					seasonStats[team].noGoalRatio += 1;
				}

				seasonStats[team].xG += goalsScored(score.homeGoals, score.awayGoals, atHome);
				seasonStats[team].xC += goalsConceded(score.homeGoals, score.awayGoals, atHome);
				seasonStats[team].played += 1;
			}
		}
	}

	function buildStats(data) {
		let stats = {};

		for (let team of Object.keys(data.standings)) {
			stats[team] = {
				cleanSheetRatio: 0,
				noGoalRatio: 0,
				xC: 0,
				xG: 0,
				played: 0
			};

			countOccurances(data, stats, team, data._id);
			countOccurances(data, stats, team, data._id - 1);

			if (stats[team].played > 0) {
				stats[team].xG /= stats[team].played;
				stats[team].xC /= stats[team].played;
				stats[team].cleanSheetRatio /= stats[team].played;
				stats[team].noGoalRatio /= stats[team].played;
			}
		}

		return stats;
	}

	function refreshStatsValues() {
		if (setup) {
			setStatsValues(stats, team);
		}
	}

	let stats;
	let rank = { xG: "", xC: "", cleanSheetRatio: "" };
	let setup = false;

	onMount(() => {
		stats = buildStats(data);
		setStatsValues(stats, team);
		setup = true;
	});

	let { data, team } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	$$result.css.add(css$e);
	team && refreshStatsValues();

	return `${stats != undefined
	? `<div class="season-stats svelte-11i30am"><div class="season-stat goals-per-game svelte-11i30am"><div class="season-stat-value svelte-11i30am"><div class="season-stat-position hidden svelte-11i30am">${escape(rank.xG)}</div>
        <div class="season-stat-number">${escape(stats[team].xG.toFixed(2))}</div>
        <div class="${"season-stat-position ssp-" + escape(rank.xG, true) + " svelte-11i30am"}">${escape(rank.xG)}</div></div>
      <div class="season-stat-text svelte-11i30am">goals per game</div></div>
    <div class="season-stat conceded-per-game svelte-11i30am"><div class="season-stat-value svelte-11i30am"><div class="season-stat-position hidden svelte-11i30am">${escape(rank.xC)}</div>
        <div class="season-stat-number">${escape(stats[team].xC.toFixed(2))}</div>
        <div class="${"season-stat-position ssp-" + escape(rank.xC, true) + " svelte-11i30am"}">${escape(rank.xC)}</div></div>
      <div class="season-stat-text svelte-11i30am">conceded per game</div></div>
    <div class="season-stat clean-sheet-ratio svelte-11i30am"><div class="season-stat-value svelte-11i30am"><div class="season-stat-position hidden svelte-11i30am">${escape(rank.cleanSheetRatio)}</div>
        <div class="season-stat-number">${escape(stats[team].cleanSheetRatio.toFixed(2))}</div>
        <div class="${"season-stat-position ssp-" + escape(rank.cleanSheetRatio, true) + " svelte-11i30am"}">${escape(rank.cleanSheetRatio)}</div></div>
      <div class="season-stat-text svelte-11i30am">clean sheets</div></div></div>`
	: ``}`;
});

/* src\components\Footer.svelte generated by Svelte v3.59.2 */

const css$d = {
	code: ".github.svelte-k5fict{opacity:0.3;margin-bottom:1.5em;width:fit-content;place-self:center}.github-img.svelte-k5fict{width:30px}.teams-footer.svelte-k5fict{color:#c6c6c6;padding:1em 0 0.2em;height:auto;width:100%;font-size:13px;align-items:center}.footer-text-colour.svelte-k5fict{color:rgb(0 0 0 / 37%)}.teams-footer-bottom.svelte-k5fict{margin:30px 0;display:grid}.version.svelte-k5fict{margin:10px auto;color:white;background:var(--purple);padding:6px 10px;border-radius:4px;width:fit-content}.last-updated.svelte-k5fict{text-align:center;margin-bottom:1.5em}.no-select.svelte-k5fict{-webkit-touch-callout:none;-webkit-user-select:none;-khtml-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.pl.svelte-k5fict{color:#00ef87}@media only screen and (max-width: 1200px){.teams-footer.svelte-k5fict{margin-bottom:46px}}",
	map: "{\"version\":3,\"file\":\"Footer.svelte\",\"sources\":[\"Footer.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">export let lastUpdated;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"teams-footer footer-text-colour\\\">\\r\\n  <div class=\\\"teams-footer-bottom\\\">\\r\\n    <a\\r\\n      href=\\\"https://github.com/tom-draper/pldashboard\\\"\\r\\n      target=\\\"_blank\\\"\\r\\n      class=\\\"github\\\"\\r\\n    >\\r\\n      <img src=\\\"/img/github.png\\\" alt=\\\"GitHub\\\" class=\\\"github-img\\\" />\\r\\n    </a>\\r\\n    {#if lastUpdated != null}\\r\\n      <div class=\\\"last-updated no-select\\\">\\r\\n        Last updated: {new Date(lastUpdated).toLocaleString()} UTC\\r\\n      </div>\\r\\n    {/if}\\r\\n    <a href=\\\"https://pldashboard.com/home\\\" class=\\\"version no-select\\\"\\r\\n      ><span class=\\\"pl\\\">pl</span>dashboard</a\\r\\n    >\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .github {\\r\\n    opacity: 0.3;\\r\\n    margin-bottom: 1.5em;\\r\\n    width: fit-content;\\r\\n    place-self: center;\\r\\n  }\\r\\n  .github-img {\\r\\n    width: 30px;\\r\\n  }\\r\\n  .teams-footer {\\r\\n    color: #c6c6c6;\\r\\n    padding: 1em 0 0.2em;\\r\\n    height: auto;\\r\\n    width: 100%;\\r\\n    font-size: 13px;\\r\\n    align-items: center;\\r\\n  }\\r\\n  .footer-text-colour {\\r\\n    color: rgb(0 0 0 / 37%);\\r\\n  }\\r\\n  .teams-footer-bottom {\\r\\n    margin: 30px 0;\\r\\n    display: grid;\\r\\n  }\\r\\n  .version {\\r\\n    margin: 10px auto;\\r\\n    color: white;\\r\\n    background: var(--purple);\\r\\n    padding: 6px 10px;\\r\\n    border-radius: 4px;\\r\\n    width: fit-content;\\r\\n  }\\r\\n  .last-updated {\\r\\n    text-align: center;\\r\\n    margin-bottom: 1.5em;\\r\\n  }\\r\\n  .no-select {\\r\\n    -webkit-touch-callout: none; /* iOS Safari */\\r\\n    -webkit-user-select: none; /* Safari */\\r\\n    -khtml-user-select: none; /* Konqueror HTML */\\r\\n    -moz-user-select: none; /* Old versions of Firefox */\\r\\n    -ms-user-select: none; /* Internet Explorer/Edge */\\r\\n    user-select: none; /* Non-prefixed version, currently\\r\\n                                    supported by Chrome, Edge, Opera and Firefox */\\r\\n  }\\r\\n  .pl {\\r\\n    color: #00ef87;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1200px) {\\r\\n    .teams-footer {\\r\\n      margin-bottom: 46px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAwBE,qBAAQ,CACN,OAAO,CAAE,GAAG,CACZ,aAAa,CAAE,KAAK,CACpB,KAAK,CAAE,WAAW,CAClB,UAAU,CAAE,MACd,CACA,yBAAY,CACV,KAAK,CAAE,IACT,CACA,2BAAc,CACZ,KAAK,CAAE,OAAO,CACd,OAAO,CAAE,GAAG,CAAC,CAAC,CAAC,KAAK,CACpB,MAAM,CAAE,IAAI,CACZ,KAAK,CAAE,IAAI,CACX,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,MACf,CACA,iCAAoB,CAClB,KAAK,CAAE,IAAI,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CACxB,CACA,kCAAqB,CACnB,MAAM,CAAE,IAAI,CAAC,CAAC,CACd,OAAO,CAAE,IACX,CACA,sBAAS,CACP,MAAM,CAAE,IAAI,CAAC,IAAI,CACjB,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE,IAAI,QAAQ,CAAC,CACzB,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,aAAa,CAAE,GAAG,CAClB,KAAK,CAAE,WACT,CACA,2BAAc,CACZ,UAAU,CAAE,MAAM,CAClB,aAAa,CAAE,KACjB,CACA,wBAAW,CACT,qBAAqB,CAAE,IAAI,CAC3B,mBAAmB,CAAE,IAAI,CACzB,kBAAkB,CAAE,IAAI,CACxB,gBAAgB,CAAE,IAAI,CACtB,eAAe,CAAE,IAAI,CACrB,WAAW,CAAE,IAEf,CACA,iBAAI,CACF,KAAK,CAAE,OACT,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,2BAAc,CACZ,aAAa,CAAE,IACjB,CACF\"}"
};

const Footer = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { lastUpdated } = $$props;
	if ($$props.lastUpdated === void 0 && $$bindings.lastUpdated && lastUpdated !== void 0) $$bindings.lastUpdated(lastUpdated);
	$$result.css.add(css$d);

	return `<div class="teams-footer footer-text-colour svelte-k5fict"><div class="teams-footer-bottom svelte-k5fict"><a href="https://github.com/tom-draper/pldashboard" target="_blank" class="github svelte-k5fict"><img src="/img/github.png" alt="GitHub" class="github-img svelte-k5fict"></a>
    ${lastUpdated != null
	? `<div class="last-updated no-select svelte-k5fict">Last updated: ${escape(new Date(lastUpdated).toLocaleString())} UTC
      </div>`
	: ``}
    <a href="https://pldashboard.com/home" class="version no-select svelte-k5fict"><span class="pl svelte-k5fict">pl</span>dashboard</a></div>
</div>`;
});

/* src\components\team\FixturesGraph.svelte generated by Svelte v3.59.2 */

function sortByMatchDate(x, y, details) {
	let temp = [];

	for (let i = 0; i < x.length; i++) {
		temp.push({ x: x[i], y: y[i], details: details[i] });
	}

	// Sort by x-value (match date)
	temp.sort(function (a, b) {
		return a.x < b.x ? -1 : a.x == b.x ? 0 : 1;
	});

	// Unpack back into original arrays
	for (let i = 0; i < temp.length; i++) {
		x[i] = temp[i].x;
		y[i] = temp[i].y;
		details[i] = temp[i].details;
	}
}

function highlightNextGameMarker(sizes, x, now, highlightSize) {
	// Get matchday date with smallest time difference to now
	let nextGameIdx;

	let minDiff = Number.POSITIVE_INFINITY;

	for (let i = 0; i < x.length; i++) {
		//@ts-ignore
		let diff = x[i] - now;

		if (0 < diff && diff < minDiff) {
			minDiff = diff;
			nextGameIdx = i;
		}
	}

	// Increase marker size of next game
	if (nextGameIdx != undefined) {
		sizes[nextGameIdx] = highlightSize;
	}

	return sizes;
}

function currentDateLine(now, maxX) {
	let nowLine = null;

	if (now <= maxX) {
		// Vertical line shapw marking current day
		nowLine = {
			type: "line",
			x0: now,
			y0: -4,
			x1: now,
			y1: 104,
			line: { color: "black", dash: "dot", width: 1 }
		};
	}

	return nowLine;
}

function xRange(x) {
	let minX = new Date(x[0]);
	minX.setDate(minX.getDate() - 7);
	let maxX = new Date(x[x.length - 1]);
	maxX.setDate(maxX.getDate() + 7);
	return [minX, maxX];
}

function defaultLayout$6(x, now) {
	let yLabels = Array.from(Array(11), (_, i) => i * 10);
	let [minX, maxX] = xRange(x);

	// @ts-ignore
	let currentDate = currentDateLine(now, maxX);

	return {
		title: false,
		autosize: true,
		margin: { r: 20, l: 60, t: 5, b: 40, pad: 5 },
		hovermode: "closest",
		plot_bgcolor: "#fafafa",
		paper_bgcolor: "#fafafa",
		yaxis: {
			title: { text: "Team rating" },
			gridcolor: "#d6d6d6",
			showline: false,
			zeroline: false,
			fixedrange: true,
			ticktext: yLabels,
			tickvals: yLabels
		},
		xaxis: {
			linecolor: "black",
			showgrid: false,
			showline: false,
			range: [minX, maxX],
			fixedrange: true
		},
		shapes: [currentDate],
		dragmode: false
	};
}

const FixturesGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function matchDescription(team, match) {
		let description;
		let homeTeam;
		let awayTeam;

		if (match.atHome) {
			homeTeam = toAlias(team);
			awayTeam = toAlias(match.team);
		} else {
			homeTeam = toAlias(match.team);
			awayTeam = toAlias(team);
		}

		if (match.score != null) {
			description = scoreline(homeTeam, awayTeam, match.score.homeGoals, match.score.awayGoals);
		} else {
			description = `${homeTeam} vs ${awayTeam}`;
		}

		return description;
	}

	function linePoints(data, team) {
		let x = [];
		let y = [];
		let descriptions = [];

		for (let matchday = 1; matchday <= 38; matchday++) {
			let match = data.fixtures[team][matchday];
			x.push(new Date(match.date));
			let oppTeamRating = data.teamRatings[match.team].totalRating;

			if (match.atHome) {
				// If team playing at home, decrease opposition rating by the amount of home advantage the team gains
				oppTeamRating *= 1 - data.homeAdvantages[match.team].totalHomeAdvantage;
			}

			y.push(oppTeamRating * 100);
			let description = matchDescription(team, match);
			descriptions.push(description);
		}

		return [x, y, descriptions];
	}

	function line(data, team, now) {
		let [x, y, description] = linePoints(data, team);
		sortByMatchDate(x, y, description);
		let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);
		let sizes = Array(x.length).fill(13);
		sizes = highlightNextGameMarker(sizes, x, now, 26);

		return {
			x,
			y,
			type: "scatter",
			mode: "lines+markers",
			text: description,
			line: { color: "#737373" },
			marker: {
				size: sizes,
				colorscale: [[0, "#00fe87"], [0.5, "#f3f3f3"], [1, "#f83027"]],
				color: y,
				opacity: 1,
				line: { width: 1 }
			},
			customdata: matchdays,
			hovertemplate: "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>"
		};
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Team rating" },
				"margin.l": 60,
				"yaxis.color": "black"
			};

			let sizes = plotData.data[0].marker.size;

			for (let i = 0; i < sizes.length; i++) {
				sizes[i] = Math.round(sizes[i] * 1.7);
			}

			let dataUpdate = {
				marker: {
					size: sizes,
					colorscale: [[0, "#00fe87"], [0.5, "#f3f3f3"], [1, "#f83027"]],
					color: plotData.data[0].y,
					opacity: 1,
					line: { width: 1 }
				}
			};

			plotData.data[0].marker.size = sizes;

			//@ts-ignore
			Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"margin.l": 20,
				"yaxis.color": "#fafafa"
			};

			let sizes = plotData.data[0].marker.size;

			for (let i = 0; i < sizes.length; i++) {
				sizes[i] = Math.round(sizes[i] / 1.7);
			}

			let dataUpdate = {
				marker: {
					size: sizes,
					colorscale: [[0, "#00fe87"], [0.5, "#f3f3f3"], [1, "#f83027"]],
					color: plotData.data[0].y,
					opacity: 1,
					line: { width: 1 }
				}
			};

			plotData.data[0].marker.size = sizes;

			//@ts-ignore
			Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
		}
	}

	function buildPlotData(data, team) {
		// Build data to create a fixtures line graph displaying the date along the
		// x-axis and opponent strength along the y-axis
		let now = Date.now();

		let l = line(data, team, now);

		let plotData = {
			data: [l],
			layout: defaultLayout$6(l.x, now),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			let l = line(data, team, Date.now());
			plotData.data[0] = l; // Overwrite plot data

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { data, team, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\FormOverTimeGraph.svelte generated by Svelte v3.59.2 */

const FormOverTimeGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getFormLine(data, team, isMainTeam) {
		let playedDates = [];
		let matchdays = [];

		for (let matchday in data.form[team][data._id]) {
			if (data.form[team][data._id][matchday].score != null) {
				matchdays.push(matchday);
				playedDates.push(new Date(data.form[team][data._id][matchday].date));
			}
		}

		let y = [];

		for (let matchday of matchdays) {
			let form = data.form[team][data._id][matchday].formRating5;
			y.push(form * 100);
		}

		let lineVal;

		if (isMainTeam) {
			// Get team primary colour from css variable
			let teamKey = toHyphenatedName(team);

			let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
			lineVal = { color: lineColor, width: 4 };
		} else {
			lineVal = { color: "#d3d3d3" };
		}

		let line = {
			x: matchdays,
			y,
			name: team,
			mode: "lines",
			line: lineVal,
			text: playedDates,
			hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
			showlegend: false
		};

		return line;
	}

	function lines(data, team) {
		let lines = [];
		let teams = Object.keys(data.standings);

		for (let i = 0; i < teams.length; i++) {
			if (teams[i] != team) {
				let line = getFormLine(data, teams[i], false);
				lines.push(line);
			}
		}

		// Add this team last to ensure it overlaps all other lines
		let line = getFormLine(data, team, true);

		lines.push(line);
		return lines;
	}

	function defaultLayout() {
		let yLabels = Array.from(Array(11), (_, i) => i * 10);

		return {
			title: false,
			autosize: true,
			margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
			hovermode: "closest",
			plot_bgcolor: "#fafafa",
			paper_bgcolor: "#fafafa",
			yaxis: {
				title: { text: "Form rating" },
				gridcolor: "gray",
				showgrid: false,
				showline: false,
				zeroline: false,
				fixedrange: true,
				ticktext: yLabels,
				tickvals: yLabels,
				range: [-1, 101]
			},
			xaxis: {
				title: { text: "Matchday" },
				linecolor: "black",
				showgrid: false,
				showline: false,
				fixedrange: true,
				range: [playedDates[0], playedDates[playedDates.length - 1]]
			},
			dragmode: false
		};
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Form rating" },
				"yaxis.visible": true,
				"margin.l": 60,
				"margin.t": 15
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"margin.l": 20,
				"margin.t": 5
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData(data, team) {
		let plotData = {
			data: lines(data, team),
			layout: defaultLayout(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});

		setTimeout(
			() => {
				// Render the bottom half of the page now the visible parts have been rendered
				lazyLoad = true;

				window.dispatchEvent(new Event("resize")); // Snap plots to currently set size
			},
			50
		);
	}

	function refreshPlot() {
		if (setup) {
			let newPlotData = buildPlotData(data, team);

			for (let i = 0; i < 20; i++) {
				plotData.data[i] = newPlotData.data[i];
			}

			plotData.layout.xaxis.range[0] = playedDates[0];
			plotData.layout.xaxis.range[1] = playedDates[playedDates.length - 1];

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, team, playedDates, lazyLoad, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedDates === void 0 && $$bindings.playedDates && playedDates !== void 0) $$bindings.playedDates(playedDates);
	if ($$props.lazyLoad === void 0 && $$bindings.lazyLoad && lazyLoad !== void 0) $$bindings.lazyLoad(lazyLoad);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\PositionOverTimeGraph.svelte generated by Svelte v3.59.2 */

function getPositions(data, team, matchdays) {
	let y = [];

	for (let i = 0; i < matchdays.length; i++) {
		let position = data.form[team][data._id][matchdays[i]].position;
		y.push(position);
	}

	return y;
}

function getMatchdayDates$1(data, team, matchdays) {
	let dates = [];

	for (let i = 0; i < matchdays.length; i++) {
		let date = data.form[team][data._id][matchdays[i]].date;
		dates.push(date);
	}

	return dates;
}

const PositionOverTimeGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getLineConfig(team, isMainTeam) {
		let lineConfig;

		if (isMainTeam) {
			// Get team primary colour from css variable
			let teamKey = toHyphenatedName(team);

			let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
			lineConfig = { color: lineColor, width: 4 };
		} else {
			lineConfig = { color: "#d3d3d3" };
		}

		return lineConfig;
	}

	function getLine(data, team, isMainTeam) {
		let matchdays = Object.keys(data.form[team][data._id]);
		let dates = getMatchdayDates$1(data, team, matchdays);
		let y = getPositions(data, team, matchdays);
		let lineConfig = getLineConfig(team, isMainTeam);

		let line = {
			x: matchdays,
			y,
			name: team,
			mode: "lines",
			line: lineConfig,
			text: dates,
			hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
			showlegend: false
		};

		return line;
	}

	function lines(data, team) {
		let lines = [];
		let teams = Object.keys(data.standings);

		for (let i = 0; i < teams.length; i++) {
			if (teams[i] != team) {
				let line = getLine(data, teams[i], false);
				lines.push(line);
			}
		}

		// Add this team last to ensure it overlaps all other lines
		let line = getLine(data, team, true);

		lines.push(line);
		return lines;
	}

	function positionRangeShapes() {
		let matchdays = Object.keys(data.form[team][data._id]);

		return [
			{
				type: "rect",
				x0: matchdays[0],
				y0: 4.5,
				x1: matchdays[matchdays.length - 1],
				y1: 0.5,
				line: { width: 0 },
				fillcolor: "#00fe87",
				opacity: 0.2,
				layer: "below"
			},
			{
				type: "rect",
				x0: matchdays[0],
				y0: 6.5,
				x1: matchdays[matchdays.length - 1],
				y1: 4.5,
				line: { width: 0 },
				fillcolor: "#02efff",
				opacity: 0.2,
				layer: "below"
			},
			{
				type: "rect",
				x0: matchdays[0],
				y0: 20.5,
				x1: matchdays[matchdays.length - 1],
				y1: 17.5,
				line: { width: 0 },
				fillcolor: "#f83027",
				opacity: 0.2,
				layer: "below"
			}
		];
	}

	function defaultLayout() {
		let yLabels = Array.from(Array(20), (_, i) => i + 1);

		return {
			title: false,
			autosize: true,
			margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
			hovermode: "closest",
			plot_bgcolor: "#fafafa",
			paper_bgcolor: "#fafafa",
			yaxis: {
				title: { text: "Position" },
				gridcolor: "gray",
				showgrid: false,
				showline: false,
				zeroline: false,
				autorange: "reversed",
				fixedrange: true,
				ticktext: yLabels,
				tickvals: yLabels,
				visible: true
			},
			xaxis: {
				title: { text: "Matchday" },
				linecolor: "black",
				showgrid: false,
				showline: false,
				fixedrange: true
			},
			shapes: positionRangeShapes(),
			dragmode: false
		};
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Position" },
				"yaxis.visible": true,
				"yaxis.tickvals": Array.from(Array(20), (_, i) => i + 1),
				"margin.l": 60,
				"margin.t": 15
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"yaxis.tickvals": Array.from(Array(10), (_, i) => i + 2),
				"margin.l": 20,
				"margin.t": 5
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData(data, team) {
		let plotData = {
			data: lines(data, team),
			layout: defaultLayout(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			let newPlotData = buildPlotData(data, team);

			for (let i = 0; i < 20; i++) {
				plotData.data[i] = newPlotData.data[i];
			}

			plotData.layout.shapes = positionRangeShapes();

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, team, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\PointsOverTimeGraph.svelte generated by Svelte v3.59.2 */

function getCumulativePoints(data, team, matchdays) {
	let y = [];

	for (let matchday of matchdays) {
		let points = data.form[team][data._id][matchday].cumPoints;
		y.push(points);
	}

	return y;
}

function getMatchdayDates(data, team, matchdays) {
	let dates = [];

	for (let i = 0; i < matchdays.length; i++) {
		let date = data.form[team][data._id][matchdays[i]].date;
		dates.push(date);
	}

	return dates;
}

function defaultLayout$5() {
	return {
		title: false,
		autosize: true,
		margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
		hovermode: "closest",
		plot_bgcolor: "#fafafa",
		paper_bgcolor: "#fafafa",
		yaxis: {
			title: { text: "Points" },
			gridcolor: "gray",
			showgrid: false,
			showline: false,
			zeroline: false,
			fixedrange: true,
			visible: true
		},
		xaxis: {
			title: { text: "Matchday" },
			linecolor: "black",
			showgrid: false,
			showline: false,
			fixedrange: true
		},
		dragmode: false
	};
}

const PointsOverTimeGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getLineConfig(team, isMainTeam) {
		let lineConfig;

		if (isMainTeam) {
			// Get team primary colour from css variable
			let teamKey = toHyphenatedName(team);

			let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
			lineConfig = { color: lineColor, width: 4 };
		} else {
			lineConfig = { color: "#d3d3d3" };
		}

		return lineConfig;
	}

	function getLine(data, team, isMainTeam) {
		let matchdays = Object.keys(data.form[team][data._id]);
		let dates = getMatchdayDates(data, team, matchdays);
		let y = getCumulativePoints(data, team, matchdays);
		let lineConfig = getLineConfig(team, isMainTeam);

		let line = {
			x: matchdays,
			y,
			name: team,
			mode: "lines",
			line: lineConfig,
			text: dates,
			hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
			showlegend: false
		};

		return line;
	}

	function lines(data, team) {
		let lines = [];
		let teams = Object.keys(data.standings);

		for (let i = 0; i < teams.length; i++) {
			if (teams[i] != team) {
				let line = getLine(data, teams[i], false);
				lines.push(line);
			}
		}

		// Add this team last to ensure it overlaps all other lines
		let line = getLine(data, team, true);

		lines.push(line);
		return lines;
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Position" },
				"yaxis.visible": true,
				"yaxis.tickvals": Array.from(Array(20), (_, i) => i + 1),
				"margin.l": 60,
				"margin.t": 15
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"yaxis.tickvals": Array.from(Array(10), (_, i) => i + 2),
				"margin.l": 20,
				"margin.t": 5
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData(data, team) {
		let plotData = {
			data: lines(data, team),
			layout: defaultLayout$5(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			let newPlotData = buildPlotData(data, team);

			for (let i = 0; i < 20; i++) {
				plotData.data[i] = newPlotData.data[i];
			}

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, team, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\goals_scored_and_conceded\ScoredConcededPerGameGraph.svelte generated by Svelte v3.59.2 */

function getAvgGoalsPerGame(data) {
	let avgGoals = {};

	for (let team of Object.keys(data.standings)) {
		for (let matchday of Object.keys(data.form[team][data._id])) {
			let score = data.form[team][data._id][matchday].score;

			if (score != null) {
				if (matchday in avgGoals) {
					avgGoals[matchday] += score.homeGoals + score.awayGoals;
				} else {
					avgGoals[matchday] = score.homeGoals + score.awayGoals;
				}
			}
		}
	}

	// Divide by number of teams to get avg goals per matchday
	for (let matchday of Object.keys(avgGoals)) {
		avgGoals[matchday] /= 20;
	}

	return avgGoals;
}

function getTeamGoalsPerGame(data, team) {
	let scored = {};
	let conceded = {};

	for (let matchday of Object.keys(data.form[team][data._id])) {
		let score = data.form[team][data._id][matchday].score;

		if (score != null) {
			if (data.form[team][data._id][matchday].atHome) {
				scored[matchday] = score.homeGoals;
				conceded[matchday] = score.awayGoals;
			} else {
				scored[matchday] = score.awayGoals;
				conceded[matchday] = score.homeGoals;
			}
		}
	}

	return [scored, conceded];
}

function avgLine(playedDates, avgGoals, matchdays) {
	return {
		name: "Avg",
		type: "line",
		x: playedDates,
		y: Object.values(avgGoals),
		text: matchdays,
		line: { color: "#0080FF", width: 2 },
		hovertemplate: "<b>Matchday %{text}</b><br>%{y:.1f} goals<extra></extra>"
	};
}

function teamScoredBar(playedDates, teamScored, matchdays) {
	return {
		name: "Scored",
		type: "bar",
		x: playedDates,
		y: Object.values(teamScored),
		text: matchdays,
		marker: { color: "#00fe87" },
		hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>"
	};
}

function teamConcededBar(playedDates, teamConceded, matchdays) {
	return {
		name: "Conceded",
		type: "bar",
		x: playedDates,
		y: Object.values(teamConceded),
		text: matchdays,
		marker: { color: "#f83027" },
		hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>"
	};
}

function defaultLayout$4() {
	return {
		title: false,
		autosize: true,
		margin: { r: 20, l: 60, t: 15, b: 15, pad: 5 },
		barmode: "stack",
		hovermode: "closest",
		plot_bgcolor: "#fafafa",
		paper_bgcolor: "#fafafa",
		yaxis: {
			title: { text: "Goals" },
			gridcolor: "gray",
			showgrid: false,
			showline: false,
			zeroline: false,
			fixedrange: true,
			rangemode: "nonnegative",
			visible: true,
			tickformat: "d"
		},
		xaxis: {
			linecolor: "black",
			showgrid: false,
			showline: false,
			fixedrange: true,
			showticklabels: false
		},
		legend: { x: 1, xanchor: "right", y: 1 },
		dragmode: false
	};
}

const ScoredConcededPerGameGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Goals" },
				"yaxis.visible": true,
				"margin.l": 60
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"margin.l": 20
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData(data, team) {
		let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
		let avgGoals = getAvgGoalsPerGame(data);
		let matchdays = Object.keys(avgGoals);
		let scoredBar = teamScoredBar(playedDates, teamScored, matchdays);
		let concededBar = teamConcededBar(playedDates, teamConceded, matchdays);
		let line = avgLine(playedDates, avgGoals, matchdays);

		let plotData = {
			data: [scoredBar, concededBar, line],
			layout: defaultLayout$4(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);
			let avgGoals = getAvgGoalsPerGame(data);
			let matchdays = Object.keys(avgGoals);
			let scoredBar = teamScoredBar(playedDates, teamScored, matchdays);
			let concededBar = teamConcededBar(playedDates, teamConceded, matchdays);
			let line = avgLine(playedDates, avgGoals, matchdays);
			plotData.data[0] = scoredBar;
			plotData.data[1] = concededBar;
			plotData.data[2] = line;

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, team, playedDates, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedDates === void 0 && $$bindings.playedDates && playedDates !== void 0) $$bindings.playedDates(playedDates);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\goals_scored_and_conceded\CleanSheetsGraph.svelte generated by Svelte v3.59.2 */

function getTeamCleanSheets(data, team) {
	let notCleanSheets = [];
	let cleanSheets = [];

	for (let matchday of Object.keys(data.form[team][data._id])) {
		let score = data.form[team][data._id][matchday].score;

		if (score != null) {
			if (data.form[team][data._id][matchday].atHome) {
				if (score.awayGoals > 0) {
					notCleanSheets.push(1);
					cleanSheets.push(0);
				} else {
					cleanSheets.push(1);
					notCleanSheets.push(0);
				}
			} else {
				if (score.homeGoals > 0) {
					notCleanSheets.push(1);
					cleanSheets.push(0);
				} else {
					cleanSheets.push(1);
					notCleanSheets.push(0);
				}
			}
		}
	}

	return [cleanSheets, notCleanSheets];
}

function bars(data, team, playedDates, matchdays) {
	let [cleanSheets, notCleanSheets] = getTeamCleanSheets(data, team);

	return [
		{
			name: "Clean sheets",
			type: "bar",
			x: playedDates,
			y: cleanSheets,
			text: matchdays,
			marker: { color: "#00fe87" },
			hovertemplate: "<b>Clean sheet<extra></extra>",
			showlegend: false
		},
		{
			name: "Conceded",
			type: "bar",
			x: playedDates,
			y: notCleanSheets,
			text: matchdays,
			marker: { color: "#f83027" },
			hovertemplate: "<b>Goals conceded<extra></extra>",
			showlegend: false
		}
	];
}

function hiddenLine(x) {
	return {
		name: "Avg",
		type: "line",
		x,
		y: Array(x.length).fill(1.1),
		line: { color: "#FAFAFA", width: 1 },
		marker: { size: 1 },
		hoverinfo: "skip"
	};
}

const CleanSheetsGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function baseLine() {
		return {
			type: "line",
			x0: playedDates[0],
			y0: 0.5,
			x1: playedDates[playedDates.length - 1],
			y1: 0.5,
			layer: "below",
			line: { color: "#d3d3d3", width: 2 }
		};
	}

	function defaultLayout(matchdays) {
		return {
			title: false,
			autosize: true,
			height: 60,
			margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
			barmode: "stack",
			hovermode: "closest",
			plot_bgcolor: "#fafafa",
			paper_bgcolor: "#fafafa",
			yaxis: {
				showticklabels: false,
				gridcolor: "gray",
				showgrid: false,
				showline: false,
				zeroline: false,
				fixedrange: true
			},
			xaxis: {
				title: { text: "Matchday" },
				linecolor: "black",
				showgrid: false,
				showline: false,
				fixedrange: true,
				tickmode: "array",
				tickvals: playedDates,
				ticktext: matchdays
			},
			shapes: [baseLine()],
			dragmode: false,
			showlegend: false
		};
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = { "margin.l": 60 };

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = { "margin.l": 20 };

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData(data, team) {
		let matchdays = playedMatchdays(data, team);
		let [cleanSheetsBar, concededBar] = bars(data, team, playedDates, matchdays);

		// Hidden line required on plot to make x-axis length match goalsScoredAndConcededGraph
		// Line added to plotly bar chart changes x-axis physical length vs without
		// TODO: Solution avoiding this hidden line
		let line = hiddenLine(cleanSheetsBar.x);

		let plotData = {
			data: [cleanSheetsBar, concededBar, line],
			layout: defaultLayout(matchdays),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		if (setup) {
			let matchdays = playedMatchdays(data, team);
			let [cleanSheetsBar, concededBar] = bars(data, team, playedDates, matchdays);
			let line = hiddenLine(cleanSheetsBar.x);
			plotData.data[0] = cleanSheetsBar;
			plotData.data[1] = concededBar;
			plotData.data[2] = line;

			for (let i = 0; i < matchdays.length; i++) {
				plotData.layout.xaxis.ticktext[i] = matchdays[i];
			}

			plotData.layout.shapes[0] = baseLine();

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, team, playedDates, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedDates === void 0 && $$bindings.playedDates && playedDates !== void 0) $$bindings.playedDates(playedDates);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\goals_per_game\GoalsScoredFreqGraph.svelte generated by Svelte v3.59.2 */

const GoalsScoredFreqGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function defaultLayout() {
		let xLabels = getXLabels();

		return {
			title: false,
			autosize: true,
			margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
			hovermode: "closest",
			barmode: "overlay",
			bargap: 0,
			plot_bgcolor: "#fafafa",
			paper_bgcolor: "#fafafa",
			yaxis: getYAxisLayout(),
			xaxis: {
				title: { text: "Scored" },
				linecolor: "black",
				showgrid: false,
				showline: false,
				fixedrange: true,
				ticktext: xLabels,
				tickvals: xLabels
			},
			legend: { x: 1, xanchor: "right", y: 0.95 },
			dragmode: false
		};
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Scored" },
				"yaxis.visible": true,
				"margin.l": 60
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"margin.l": 20
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData() {
		let plotData = {
			data: getScoredBars(),
			layout: defaultLayout(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	function genPlot() {
		plotData = buildPlotData();

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			plotData.data[1] = getScoredTeamBars(); // Update team bars

			//@ts-ignore
			Plotly.relayout(plotDiv, { yaxis: getYAxisLayout() });

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { team, getScoredBars, getScoredTeamBars, getXLabels, getYAxisLayout, mobileView } = $$props;
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.getScoredBars === void 0 && $$bindings.getScoredBars && getScoredBars !== void 0) $$bindings.getScoredBars(getScoredBars);
	if ($$props.getScoredTeamBars === void 0 && $$bindings.getScoredTeamBars && getScoredTeamBars !== void 0) $$bindings.getScoredTeamBars(getScoredTeamBars);
	if ($$props.getXLabels === void 0 && $$bindings.getXLabels && getXLabels !== void 0) $$bindings.getXLabels(getXLabels);
	if ($$props.getYAxisLayout === void 0 && $$bindings.getYAxisLayout && getYAxisLayout !== void 0) $$bindings.getYAxisLayout(getYAxisLayout);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\goals_per_game\GoalsConcededFreqGraph.svelte generated by Svelte v3.59.2 */

const GoalsConcededFreqGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function defaultLayout() {
		let xLabels = getXLabels();

		return {
			title: false,
			autosize: true,
			margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
			hovermode: "closest",
			barmode: "overlay",
			bargap: 0,
			plot_bgcolor: "#fafafa",
			paper_bgcolor: "#fafafa",
			yaxis: getYAxisLayout(),
			xaxis: {
				title: { text: "Conceded" },
				linecolor: "black",
				showgrid: false,
				showline: false,
				fixedrange: true,
				ticktext: xLabels,
				tickvals: xLabels
			},
			legend: { x: 1, xanchor: "right", y: 0.95 },
			dragmode: false
		};
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Conceded" },
				"yaxis.visible": true,
				"margin.l": 60
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"margin.l": 20
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData() {
		let plotData = {
			data: getConcededBars(),
			layout: defaultLayout(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	function genPlot() {
		plotData = buildPlotData();

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			plotData.data[1] = getConcededTeamBars();

			//@ts-ignore
			Plotly.relayout(plotDiv, { yaxis: getYAxisLayout() });

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { team, getConcededBars, getConcededTeamBars, getXLabels, getYAxisLayout, mobileView } = $$props;
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.getConcededBars === void 0 && $$bindings.getConcededBars && getConcededBars !== void 0) $$bindings.getConcededBars(getConcededBars);
	if ($$props.getConcededTeamBars === void 0 && $$bindings.getConcededTeamBars && getConcededTeamBars !== void 0) $$bindings.getConcededTeamBars(getConcededTeamBars);
	if ($$props.getXLabels === void 0 && $$bindings.getXLabels && getXLabels !== void 0) $$bindings.getXLabels(getXLabels);
	if ($$props.getYAxisLayout === void 0 && $$bindings.getYAxisLayout && getYAxisLayout !== void 0) $$bindings.getYAxisLayout(getYAxisLayout);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\team\goals_per_game\GoalsPerGame.svelte generated by Svelte v3.59.2 */

const css$c = {
	code: ".two-graphs.svelte-8zd8zw{display:flex;margin:0 8%}.freq-graph.svelte-8zd8zw{width:50%}@media only screen and (max-width: 1000px){.two-graphs.svelte-8zd8zw{display:flex;margin:0}}",
	map: "{\"version\":3,\"file\":\"GoalsPerGame.svelte\",\"sources\":[\"GoalsPerGame.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { onMount } from \\\"svelte\\\";\\r\\nimport GoalsScoredFreq from \\\"./GoalsScoredFreqGraph.svelte\\\";\\r\\nimport GoalsConcededFreq from \\\"./GoalsConcededFreqGraph.svelte\\\";\\r\\nfunction avgBars() {\\r\\n    return {\\r\\n        x: Object.keys(goalFreq),\\r\\n        y: Object.values(goalFreq),\\r\\n        type: \\\"bar\\\",\\r\\n        name: \\\"Avg\\\",\\r\\n        marker: { color: \\\"#C6C6C6\\\" },\\r\\n        line: { width: 0 },\\r\\n        hovertemplate: `Average %{x} with probability <b>%{y:.2f}</b><extra></extra>`,\\r\\n        hoverinfo: \\\"x+y\\\",\\r\\n    };\\r\\n}\\r\\nfunction teamBars(data, type, color) {\\r\\n    let opener = \\\"Score\\\";\\r\\n    if (type === \\\"Conceded\\\") {\\r\\n        opener = \\\"Concede\\\";\\r\\n    }\\r\\n    return {\\r\\n        x: Object.keys(data),\\r\\n        y: Object.values(data),\\r\\n        type: \\\"bar\\\",\\r\\n        name: type,\\r\\n        marker: { color: color },\\r\\n        hovertemplate: `${opener} %{x} with probability <b>%{y:.2f}</b><extra></extra>`,\\r\\n        line: { width: 0 },\\r\\n        hoverinfo: \\\"x+y\\\",\\r\\n        opacity: 0.5,\\r\\n    };\\r\\n}\\r\\nfunction bars(data, name, color) {\\r\\n    return [avgBars(), teamBars(data, name, color)];\\r\\n}\\r\\n// Basic colour scale shared between the two bar chars\\r\\nlet colourScale = [\\\"#00fe87\\\", \\\"#aef23e\\\", \\\"#ffdd00\\\", \\\"#ff9000\\\", \\\"#f83027\\\"];\\r\\n// Concatenate unique extreme colours, for extreme values that only a few teams achieve\\r\\n// Concatenate bright greens\\r\\nlet scoredColourScale = reversed(colourScale).concat([\\r\\n    \\\"#00fe87\\\",\\r\\n    \\\"#00fe87\\\",\\r\\n    \\\"#00fe87\\\",\\r\\n    \\\"#00fe87\\\",\\r\\n    \\\"#00fe87\\\",\\r\\n]);\\r\\n// Concatenate bright reds\\r\\nlet concededColourScale = colourScale.concat([\\r\\n    \\\"#f83027\\\",\\r\\n    \\\"#f83027\\\",\\r\\n    \\\"#f83027\\\",\\r\\n    \\\"#f83027\\\",\\r\\n    \\\"#f83027\\\",\\r\\n]);\\r\\nfunction reversed(arr) {\\r\\n    return arr.slice().reverse();\\r\\n}\\r\\nfunction getScoredBars() {\\r\\n    // return bars(teamScoredFreq, \\\"Goals scored\\\", \\\"#77DD77\\\");\\r\\n    return bars(teamScoredFreq, \\\"Scored\\\", scoredColourScale);\\r\\n}\\r\\nfunction getConcededBars() {\\r\\n    return bars(teamConcededFreq, \\\"Conceded\\\", concededColourScale);\\r\\n}\\r\\nfunction getScoredTeamBars() {\\r\\n    return teamBars(teamScoredFreq, \\\"Scored\\\", scoredColourScale);\\r\\n}\\r\\nfunction getConcededTeamBars() {\\r\\n    return teamBars(teamConcededFreq, \\\"Conceded\\\", concededColourScale);\\r\\n}\\r\\nfunction getXLabels() {\\r\\n    return Object.keys(goalFreq);\\r\\n}\\r\\nfunction getYAxisLayout() {\\r\\n    return {\\r\\n        title: { text: \\\"Probability\\\" },\\r\\n        gridcolor: \\\"gray\\\",\\r\\n        showgrid: false,\\r\\n        showline: false,\\r\\n        zeroline: false,\\r\\n        fixedrange: true,\\r\\n        autorange: false,\\r\\n        range: [0, maxY],\\r\\n    };\\r\\n}\\r\\nfunction countScored(data, goalFreq, season, team) {\\r\\n    if (!(team in data.form)) {\\r\\n        return;\\r\\n    }\\r\\n    for (let matchday of Object.keys(data.form[team][season])) {\\r\\n        let score = data.form[team][season][matchday].score;\\r\\n        if (score != null) {\\r\\n            if (data.form[team][season][matchday].atHome) {\\r\\n                if (score.homeGoals in goalFreq) {\\r\\n                    goalFreq[score.homeGoals] += 1;\\r\\n                }\\r\\n                else {\\r\\n                    goalFreq[score.homeGoals] = 1;\\r\\n                }\\r\\n            }\\r\\n            else {\\r\\n                if (score.awayGoals in goalFreq) {\\r\\n                    goalFreq[score.awayGoals] += 1;\\r\\n                }\\r\\n                else {\\r\\n                    goalFreq[score.awayGoals] = 1;\\r\\n                }\\r\\n            }\\r\\n        }\\r\\n    }\\r\\n}\\r\\nfunction maxObjKey(obj) {\\r\\n    let max = 0;\\r\\n    for (let goals in obj) {\\r\\n        let g = parseInt(goals);\\r\\n        if (g > max) {\\r\\n            max = g;\\r\\n        }\\r\\n    }\\r\\n    return max;\\r\\n}\\r\\nfunction fillGoalFreqBlanks(goalFreq) {\\r\\n    let max = maxObjKey(goalFreq);\\r\\n    for (let i = 1; i < max; i++) {\\r\\n        if (!(i in goalFreq)) {\\r\\n            goalFreq[i] = 0;\\r\\n        }\\r\\n    }\\r\\n}\\r\\nfunction avgGoalFrequencies(data) {\\r\\n    let goalFreq = {};\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        countScored(data, goalFreq, data._id, team);\\r\\n        countScored(data, goalFreq, data._id - 1, team);\\r\\n    }\\r\\n    fillGoalFreqBlanks(goalFreq);\\r\\n    // Divide by number of teams to get avg\\r\\n    for (let goals of Object.keys(goalFreq)) {\\r\\n        goalFreq[goals] /= 20;\\r\\n    }\\r\\n    return goalFreq;\\r\\n}\\r\\nfunction teamScoredFrequencies(data, team) {\\r\\n    let goalFreq = {};\\r\\n    countScored(data, goalFreq, data._id, team);\\r\\n    countScored(data, goalFreq, data._id - 1, team);\\r\\n    fillGoalFreqBlanks(goalFreq);\\r\\n    return goalFreq;\\r\\n}\\r\\nfunction countConceded(data, goalFreq, season, team) {\\r\\n    if (!(team in data.form)) {\\r\\n        return;\\r\\n    }\\r\\n    for (let matchday of Object.keys(data.form[team][season])) {\\r\\n        let score = data.form[team][season][matchday].score;\\r\\n        if (score != null) {\\r\\n            if (data.form[team][season][matchday].atHome) {\\r\\n                if (score.awayGoals in goalFreq) {\\r\\n                    goalFreq[score.awayGoals] += 1;\\r\\n                }\\r\\n                else {\\r\\n                    goalFreq[score.awayGoals] = 1;\\r\\n                }\\r\\n            }\\r\\n            else {\\r\\n                if (score.homeGoals in goalFreq) {\\r\\n                    goalFreq[score.homeGoals] += 1;\\r\\n                }\\r\\n                else {\\r\\n                    goalFreq[score.homeGoals] = 1;\\r\\n                }\\r\\n            }\\r\\n        }\\r\\n    }\\r\\n}\\r\\nfunction teamConcededFrequencies(data, team) {\\r\\n    let goalFreq = {};\\r\\n    countConceded(data, goalFreq, data._id, team);\\r\\n    countConceded(data, goalFreq, data._id - 1, team);\\r\\n    fillGoalFreqBlanks(goalFreq);\\r\\n    return goalFreq;\\r\\n}\\r\\nfunction checkForMax(freq, max) {\\r\\n    for (let goals of Object.values(freq)) {\\r\\n        if (goals > max) {\\r\\n            max = goals;\\r\\n        }\\r\\n    }\\r\\n    return max;\\r\\n}\\r\\nfunction maxValue(goalFreq, teamScoredFreq, teamConcededFreq) {\\r\\n    let max = 0;\\r\\n    max = checkForMax(goalFreq, max);\\r\\n    max = checkForMax(teamScoredFreq, max);\\r\\n    max = checkForMax(teamConcededFreq, max);\\r\\n    return max;\\r\\n}\\r\\nfunction valueSum(obj) {\\r\\n    let total = 0;\\r\\n    for (let freq in obj) {\\r\\n        total += obj[freq];\\r\\n    }\\r\\n    return total;\\r\\n}\\r\\nfunction scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq) {\\r\\n    let totalGoalFreq = valueSum(goalFreq);\\r\\n    let totalTeamScoredFreq = valueSum(teamScoredFreq);\\r\\n    for (let goals in teamScoredFreq) {\\r\\n        teamScoredFreq[goals] *= totalGoalFreq / totalTeamScoredFreq;\\r\\n    }\\r\\n    let totalTeamConcededFreq = valueSum(teamConcededFreq);\\r\\n    for (let goals in teamConcededFreq) {\\r\\n        teamConcededFreq[goals] *= totalGoalFreq / totalTeamConcededFreq;\\r\\n    }\\r\\n}\\r\\nfunction convertToPercentage(freq) {\\r\\n    let totalFreq = valueSum(freq);\\r\\n    for (let goals in freq) {\\r\\n        freq[goals] /= totalFreq;\\r\\n    }\\r\\n}\\r\\nfunction convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq) {\\r\\n    convertToPercentage(goalFreq);\\r\\n    convertToPercentage(teamScoredFreq);\\r\\n    convertToPercentage(teamConcededFreq);\\r\\n}\\r\\nfunction refreshTeamData() {\\r\\n    if (setup) {\\r\\n        teamScoredFreq = teamScoredFrequencies(data, team);\\r\\n        teamConcededFreq = teamConcededFrequencies(data, team);\\r\\n        scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);\\r\\n        convertToPercentage(teamScoredFreq);\\r\\n        convertToPercentage(teamConcededFreq);\\r\\n        maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);\\r\\n    }\\r\\n}\\r\\nlet goalFreq, teamScoredFreq, teamConcededFreq, maxY;\\r\\nlet setup = false;\\r\\nonMount(() => {\\r\\n    goalFreq = avgGoalFrequencies(data);\\r\\n    teamScoredFreq = teamScoredFrequencies(data, team);\\r\\n    teamConcededFreq = teamConcededFrequencies(data, team);\\r\\n    scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);\\r\\n    convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq);\\r\\n    maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);\\r\\n    setup = true;\\r\\n});\\r\\n$: team && refreshTeamData();\\r\\nexport let data, team, mobileView;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"two-graphs\\\">\\r\\n  {#if setup}\\r\\n    <div class=\\\"graph freq-graph mini-graph\\\">\\r\\n      <GoalsScoredFreq\\r\\n        {team}\\r\\n        {getScoredBars}\\r\\n        {getScoredTeamBars}\\r\\n        {getXLabels}\\r\\n        {getYAxisLayout}\\r\\n        {mobileView}\\r\\n      />\\r\\n    </div>\\r\\n    <div class=\\\"graph freq-graph mini-graph\\\">\\r\\n      <GoalsConcededFreq\\r\\n        {team}\\r\\n        {getConcededBars}\\r\\n        {getConcededTeamBars}\\r\\n        {getXLabels}\\r\\n        {getYAxisLayout}\\r\\n        {mobileView}\\r\\n      />\\r\\n    </div>\\r\\n  {/if}\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .two-graphs {\\r\\n    display: flex;\\r\\n    margin: 0 8%;\\r\\n  }\\r\\n  .freq-graph {\\r\\n    width: 50%;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1000px) {\\r\\n    .two-graphs {\\r\\n      display: flex;\\r\\n      margin: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAqRE,yBAAY,CACV,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,CAAC,CAAC,EACZ,CACA,yBAAY,CACV,KAAK,CAAE,GACT,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,yBAAY,CACV,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,CACV,CACF\"}"
};

function teamBars(data, type, color) {
	let opener = "Score";

	if (type === "Conceded") {
		opener = "Concede";
	}

	return {
		x: Object.keys(data),
		y: Object.values(data),
		type: "bar",
		name: type,
		marker: { color },
		hovertemplate: `${opener} %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
		line: { width: 0 },
		hoverinfo: "x+y",
		opacity: 0.5
	};
}

function reversed(arr) {
	return arr.slice().reverse();
}

function countScored(data, goalFreq, season, team) {
	if (!(team in data.form)) {
		return;
	}

	for (let matchday of Object.keys(data.form[team][season])) {
		let score = data.form[team][season][matchday].score;

		if (score != null) {
			if (data.form[team][season][matchday].atHome) {
				if (score.homeGoals in goalFreq) {
					goalFreq[score.homeGoals] += 1;
				} else {
					goalFreq[score.homeGoals] = 1;
				}
			} else {
				if (score.awayGoals in goalFreq) {
					goalFreq[score.awayGoals] += 1;
				} else {
					goalFreq[score.awayGoals] = 1;
				}
			}
		}
	}
}

function maxObjKey(obj) {
	let max = 0;

	for (let goals in obj) {
		let g = parseInt(goals);

		if (g > max) {
			max = g;
		}
	}

	return max;
}

function fillGoalFreqBlanks(goalFreq) {
	let max = maxObjKey(goalFreq);

	for (let i = 1; i < max; i++) {
		if (!(i in goalFreq)) {
			goalFreq[i] = 0;
		}
	}
}

function avgGoalFrequencies(data) {
	let goalFreq = {};

	for (let team of Object.keys(data.standings)) {
		countScored(data, goalFreq, data._id, team);
		countScored(data, goalFreq, data._id - 1, team);
	}

	fillGoalFreqBlanks(goalFreq);

	// Divide by number of teams to get avg
	for (let goals of Object.keys(goalFreq)) {
		goalFreq[goals] /= 20;
	}

	return goalFreq;
}

function teamScoredFrequencies(data, team) {
	let goalFreq = {};
	countScored(data, goalFreq, data._id, team);
	countScored(data, goalFreq, data._id - 1, team);
	fillGoalFreqBlanks(goalFreq);
	return goalFreq;
}

function countConceded(data, goalFreq, season, team) {
	if (!(team in data.form)) {
		return;
	}

	for (let matchday of Object.keys(data.form[team][season])) {
		let score = data.form[team][season][matchday].score;

		if (score != null) {
			if (data.form[team][season][matchday].atHome) {
				if (score.awayGoals in goalFreq) {
					goalFreq[score.awayGoals] += 1;
				} else {
					goalFreq[score.awayGoals] = 1;
				}
			} else {
				if (score.homeGoals in goalFreq) {
					goalFreq[score.homeGoals] += 1;
				} else {
					goalFreq[score.homeGoals] = 1;
				}
			}
		}
	}
}

function teamConcededFrequencies(data, team) {
	let goalFreq = {};
	countConceded(data, goalFreq, data._id, team);
	countConceded(data, goalFreq, data._id - 1, team);
	fillGoalFreqBlanks(goalFreq);
	return goalFreq;
}

function checkForMax(freq, max) {
	for (let goals of Object.values(freq)) {
		if (goals > max) {
			max = goals;
		}
	}

	return max;
}

function maxValue(goalFreq, teamScoredFreq, teamConcededFreq) {
	let max = 0;
	max = checkForMax(goalFreq, max);
	max = checkForMax(teamScoredFreq, max);
	max = checkForMax(teamConcededFreq, max);
	return max;
}

function valueSum(obj) {
	let total = 0;

	for (let freq in obj) {
		total += obj[freq];
	}

	return total;
}

function scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq) {
	let totalGoalFreq = valueSum(goalFreq);
	let totalTeamScoredFreq = valueSum(teamScoredFreq);

	for (let goals in teamScoredFreq) {
		teamScoredFreq[goals] *= totalGoalFreq / totalTeamScoredFreq;
	}

	let totalTeamConcededFreq = valueSum(teamConcededFreq);

	for (let goals in teamConcededFreq) {
		teamConcededFreq[goals] *= totalGoalFreq / totalTeamConcededFreq;
	}
}

function convertToPercentage$1(freq) {
	let totalFreq = valueSum(freq);

	for (let goals in freq) {
		freq[goals] /= totalFreq;
	}
}

function convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq) {
	convertToPercentage$1(goalFreq);
	convertToPercentage$1(teamScoredFreq);
	convertToPercentage$1(teamConcededFreq);
}

const GoalsPerGame = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function avgBars() {
		return {
			x: Object.keys(goalFreq),
			y: Object.values(goalFreq),
			type: "bar",
			name: "Avg",
			marker: { color: "#C6C6C6" },
			line: { width: 0 },
			hovertemplate: `Average %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
			hoverinfo: "x+y"
		};
	}

	function bars(data, name, color) {
		return [avgBars(), teamBars(data, name, color)];
	}

	// Basic colour scale shared between the two bar chars
	let colourScale = ["#00fe87", "#aef23e", "#ffdd00", "#ff9000", "#f83027"];

	// Concatenate unique extreme colours, for extreme values that only a few teams achieve
	// Concatenate bright greens
	let scoredColourScale = reversed(colourScale).concat(["#00fe87", "#00fe87", "#00fe87", "#00fe87", "#00fe87"]);

	// Concatenate bright reds
	let concededColourScale = colourScale.concat(["#f83027", "#f83027", "#f83027", "#f83027", "#f83027"]);

	function getScoredBars() {
		// return bars(teamScoredFreq, "Goals scored", "#77DD77");
		return bars(teamScoredFreq, "Scored", scoredColourScale);
	}

	function getConcededBars() {
		return bars(teamConcededFreq, "Conceded", concededColourScale);
	}

	function getScoredTeamBars() {
		return teamBars(teamScoredFreq, "Scored", scoredColourScale);
	}

	function getConcededTeamBars() {
		return teamBars(teamConcededFreq, "Conceded", concededColourScale);
	}

	function getXLabels() {
		return Object.keys(goalFreq);
	}

	function getYAxisLayout() {
		return {
			title: { text: "Probability" },
			gridcolor: "gray",
			showgrid: false,
			showline: false,
			zeroline: false,
			fixedrange: true,
			autorange: false,
			range: [0, maxY]
		};
	}

	function refreshTeamData() {
		if (setup) {
			teamScoredFreq = teamScoredFrequencies(data, team);
			teamConcededFreq = teamConcededFrequencies(data, team);
			scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);
			convertToPercentage$1(teamScoredFreq);
			convertToPercentage$1(teamConcededFreq);
			maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);
		}
	}

	let goalFreq, teamScoredFreq, teamConcededFreq, maxY;
	let setup = false;

	onMount(() => {
		goalFreq = avgGoalFrequencies(data);
		teamScoredFreq = teamScoredFrequencies(data, team);
		teamConcededFreq = teamConcededFrequencies(data, team);
		scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);
		convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq);
		maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);
		setup = true;
	});

	let { data, team, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	$$result.css.add(css$c);
	team && refreshTeamData();

	return `<div class="two-graphs svelte-8zd8zw">${setup
	? `<div class="graph freq-graph mini-graph svelte-8zd8zw">${validate_component(GoalsScoredFreqGraph, "GoalsScoredFreq").$$render(
			$$result,
			{
				team,
				getScoredBars,
				getScoredTeamBars,
				getXLabels,
				getYAxisLayout,
				mobileView
			},
			{},
			{}
		)}</div>
    <div class="graph freq-graph mini-graph svelte-8zd8zw">${validate_component(GoalsConcededFreqGraph, "GoalsConcededFreq").$$render(
			$$result,
			{
				team,
				getConcededBars,
				getConcededTeamBars,
				getXLabels,
				getYAxisLayout,
				mobileView
			},
			{},
			{}
		)}</div>`
	: ``}
</div>`;
});

/* src\components\team\SpiderGraph.svelte generated by Svelte v3.59.2 */

const css$b = {
	code: ".spider-chart.svelte-13tgs7k{position:relative}.spider-opp-team-selector.svelte-13tgs7k{display:flex;flex-direction:column;margin:auto}.spider-opp-team-btns.svelte-13tgs7k{border-radius:6px;display:flex;flex-direction:column;border:3px solid #333333;color:#333333;width:180px}.spider-opp-team-btn.svelte-13tgs7k{cursor:pointer;color:#333333;border:none;font-size:13px;padding:4px 10px}button.svelte-13tgs7k{margin:0 !important;padding:4 10px !important}.spider-opp-team-btn.svelte-13tgs7k:hover{filter:brightness(0.95)}",
	map: "{\"version\":3,\"file\":\"SpiderGraph.svelte\",\"sources\":[\"SpiderGraph.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { onMount } from \\\"svelte\\\";\\r\\nimport { toAlias, toName, teamInSeason, toHyphenatedName, teamColor, } from \\\"../../lib/team\\\";\\r\\nfunction addTeamComparison(team) {\\r\\n    let teamData = {\\r\\n        name: team,\\r\\n        type: \\\"scatterpolar\\\",\\r\\n        r: [\\r\\n            attack[team],\\r\\n            defence[team],\\r\\n            cleanSheets[team],\\r\\n            consistency[team],\\r\\n            winStreaks[team],\\r\\n            vsBig6[team],\\r\\n        ],\\r\\n        theta: labels,\\r\\n        fill: \\\"toself\\\",\\r\\n        marker: { color: teamColor(team) },\\r\\n    };\\r\\n    plotData.data.push(teamData);\\r\\n    //@ts-ignore\\r\\n    Plotly.redraw(plotDiv); // Redraw with teamName added\\r\\n}\\r\\nfunction addAvg() {\\r\\n    let avg = avgScatterPlot();\\r\\n    plotData.data.unshift(avg); // Add avg below the teamName spider plot\\r\\n}\\r\\nfunction removeTeamComparison(team) {\\r\\n    // Remove spider plot for this teamName\\r\\n    for (let i = 0; i < plotData.data.length; i++) {\\r\\n        if (plotData.data[i].name === team) {\\r\\n            plotData.data.splice(i, 1);\\r\\n            break;\\r\\n        }\\r\\n    }\\r\\n    // If removing only comparison teamName, re-insert the initial avg spider plot\\r\\n    if (comparisonTeams.length === 1) {\\r\\n        addAvg();\\r\\n    }\\r\\n    //@ts-ignore\\r\\n    Plotly.redraw(plotDiv); // Redraw with teamName removed\\r\\n}\\r\\nfunction removeAllTeamComparisons() {\\r\\n    for (let i = 0; i < comparisonTeams.length; i++) {\\r\\n        // Remove spider plot for this teamName\\r\\n        for (let i = 0; i < plotData.data.length; i++) {\\r\\n            if (plotData.data[i].name === comparisonTeams[i] &&\\r\\n                comparisonTeams[i] != team) {\\r\\n                plotData.data.splice(i, 1);\\r\\n                break;\\r\\n            }\\r\\n        }\\r\\n        // If removing only comparison teamName, re-insert the initial avg spider plot\\r\\n        if (comparisonTeams.length === 1) {\\r\\n            addAvg();\\r\\n        }\\r\\n        removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams\\r\\n    }\\r\\n    //@ts-ignore\\r\\n    Plotly.redraw(plotDiv); // Redraw with teamName removed\\r\\n}\\r\\nfunction resetTeamComparisonBtns() {\\r\\n    let btns = document.getElementById(\\\"spider-opp-teams\\\");\\r\\n    for (let i = 0; i < btns.children.length; i++) {\\r\\n        //@ts-ignore\\r\\n        let btn = btns.children[i];\\r\\n        if (btn.style.background != \\\"\\\") {\\r\\n            btn.style.background = \\\"\\\";\\r\\n            btn.style.color = \\\"black\\\";\\r\\n        }\\r\\n    }\\r\\n}\\r\\nfunction spiderBtnClick(btn) {\\r\\n    let team = toName(btn.innerHTML);\\r\\n    if (btn.style.background === \\\"\\\") {\\r\\n        let teamKey = toHyphenatedName(team);\\r\\n        btn.style.background = `var(--${teamKey})`;\\r\\n        btn.style.color = `var(--${teamKey}-secondary)`;\\r\\n    }\\r\\n    else {\\r\\n        btn.style.background = \\\"\\\";\\r\\n        btn.style.color = \\\"black\\\";\\r\\n    }\\r\\n    if (comparisonTeams.length === 0) {\\r\\n        plotData.data.splice(0, 1); // Remove avg\\r\\n    }\\r\\n    if (comparisonTeams.includes(team)) {\\r\\n        removeTeamComparison(team); // Remove from spider chart\\r\\n        removeItem(comparisonTeams, team); // Remove from comparison teams\\r\\n    }\\r\\n    else {\\r\\n        addTeamComparison(team); // Add teamName to spider chart\\r\\n        comparisonTeams.push(team); // Add to comparison teams\\r\\n    }\\r\\n}\\r\\nfunction goalsPerGame(data) {\\r\\n    let attack = {};\\r\\n    let maxGoalsPerSeason = Number.NEGATIVE_INFINITY;\\r\\n    let minGoalsPerSeason = Number.POSITIVE_INFINITY;\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        let totalGoals = 0;\\r\\n        let gamesPlayed = 0;\\r\\n        for (let season in data.standings[team]) {\\r\\n            let goals = data.standings[team][season].gF;\\r\\n            let played = data.standings[team][season].played;\\r\\n            if (goals > 0) {\\r\\n                totalGoals += goals;\\r\\n                gamesPlayed += played;\\r\\n            }\\r\\n            // If season completed, check if team's attacking performance is most extreme yet\\r\\n            if (played === 38) {\\r\\n                let seasonGoalsPerGame = goals / played;\\r\\n                if (seasonGoalsPerGame > maxGoalsPerSeason) {\\r\\n                    maxGoalsPerSeason = seasonGoalsPerGame;\\r\\n                }\\r\\n                else if (seasonGoalsPerGame < minGoalsPerSeason) {\\r\\n                    minGoalsPerSeason = seasonGoalsPerGame;\\r\\n                }\\r\\n            }\\r\\n        }\\r\\n        // Get team's overall goals per game across multiple seasons\\r\\n        let goalsPerGame = null;\\r\\n        if (gamesPlayed > 0) {\\r\\n            goalsPerGame = totalGoals / gamesPlayed;\\r\\n        }\\r\\n        attack[team] = goalsPerGame;\\r\\n    }\\r\\n    return [attack, [minGoalsPerSeason, maxGoalsPerSeason]];\\r\\n}\\r\\nfunction scaleAttack(attack, range) {\\r\\n    let [lower, upper] = range;\\r\\n    for (let team in attack) {\\r\\n        if (attack[team] === null) {\\r\\n            attack[team] = 0;\\r\\n        }\\r\\n        else {\\r\\n            attack[team] = ((attack[team] - lower) / (upper - lower)) * 100;\\r\\n        }\\r\\n    }\\r\\n    return attack;\\r\\n}\\r\\nfunction attributeAvgScaled(attribute, max) {\\r\\n    let total = 0;\\r\\n    for (let team in attribute) {\\r\\n        attribute[team] = (attribute[team] / max) * 100;\\r\\n        total += attribute[team];\\r\\n    }\\r\\n    let avg = total / Object.keys(attribute).length;\\r\\n    return avg;\\r\\n}\\r\\nfunction attributeAvg(attribute) {\\r\\n    let total = 0;\\r\\n    for (let team in attribute) {\\r\\n        total += attribute[team];\\r\\n    }\\r\\n    let avg = total / Object.keys(attribute).length;\\r\\n    return avg;\\r\\n}\\r\\nfunction getAttack(data) {\\r\\n    let [attack, extremes] = goalsPerGame(data);\\r\\n    attack = scaleAttack(attack, extremes);\\r\\n    attack.avg = attributeAvg(attack);\\r\\n    return attack;\\r\\n}\\r\\nfunction concededPerSeason(data) {\\r\\n    let defence = {};\\r\\n    let maxConcededPerSeason = Number.NEGATIVE_INFINITY;\\r\\n    let minConcededPerSeason = Number.POSITIVE_INFINITY;\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        let totalConceded = 0;\\r\\n        let gamesPlayed = 0;\\r\\n        for (let season in data.standings[team]) {\\r\\n            let conceded = data.standings[team][season].gA;\\r\\n            let played = data.standings[team][season].played;\\r\\n            if (conceded > 0) {\\r\\n                totalConceded += conceded;\\r\\n                gamesPlayed += played;\\r\\n            }\\r\\n            // If season completed, check if team's defensive performance is most extreme yet\\r\\n            if (played === 38) {\\r\\n                let seasonConcededPerGame = conceded / played;\\r\\n                if (seasonConcededPerGame > maxConcededPerSeason) {\\r\\n                    maxConcededPerSeason = seasonConcededPerGame;\\r\\n                }\\r\\n                else if (seasonConcededPerGame < minConcededPerSeason) {\\r\\n                    minConcededPerSeason = seasonConcededPerGame;\\r\\n                }\\r\\n            }\\r\\n        }\\r\\n        let goalsPerGame = null;\\r\\n        if (gamesPlayed > 0) {\\r\\n            goalsPerGame = totalConceded / gamesPlayed;\\r\\n        }\\r\\n        defence[team] = goalsPerGame;\\r\\n    }\\r\\n    return [\\r\\n        defence,\\r\\n        [minConcededPerSeason, maxConcededPerSeason],\\r\\n    ];\\r\\n}\\r\\nfunction scaleDefence(defence, range) {\\r\\n    let [lower, upper] = range;\\r\\n    for (let team in defence) {\\r\\n        if (defence[team] === null) {\\r\\n            defence[team] = 0;\\r\\n        }\\r\\n        else {\\r\\n            defence[team] = 100 - ((defence[team] - lower) / (upper - lower)) * 100;\\r\\n        }\\r\\n    }\\r\\n    return defence;\\r\\n}\\r\\nfunction getDefence(data) {\\r\\n    let [defence, range] = concededPerSeason(data);\\r\\n    defence = scaleDefence(defence, range);\\r\\n    defence.avg = attributeAvg(defence);\\r\\n    return defence;\\r\\n}\\r\\nfunction formCleanSheets(form, team, season) {\\r\\n    let nCleanSheets = 0;\\r\\n    for (let matchday in form[team][season]) {\\r\\n        let match = form[team][season][matchday];\\r\\n        if (match.score != null) {\\r\\n            if (match.atHome && match.score.awayGoals === 0) {\\r\\n                nCleanSheets += 1;\\r\\n            }\\r\\n            else if (!match.atHome && match.score.homeGoals === 0) {\\r\\n                nCleanSheets += 1;\\r\\n            }\\r\\n        }\\r\\n    }\\r\\n    return nCleanSheets;\\r\\n}\\r\\nfunction getCleanSheets(data) {\\r\\n    let cleanSheets = {};\\r\\n    let maxSeasonCleanSheets = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        let totalCleanSheetsCount = 0;\\r\\n        for (let i = 0; i < numSeasons; i++) {\\r\\n            let seasonCleanSheets = formCleanSheets(data.form, team, data._id - i);\\r\\n            // If season completed, check if season clean sheets is highest yet\\r\\n            if (seasonComplete(data, team, data._id - i) &&\\r\\n                seasonCleanSheets > maxSeasonCleanSheets) {\\r\\n                maxSeasonCleanSheets = seasonCleanSheets;\\r\\n            }\\r\\n            totalCleanSheetsCount += seasonCleanSheets;\\r\\n        }\\r\\n        cleanSheets[team] = totalCleanSheetsCount;\\r\\n    }\\r\\n    cleanSheets.avg = attributeAvgScaled(cleanSheets, maxSeasonCleanSheets * numSeasons);\\r\\n    return cleanSheets;\\r\\n}\\r\\nfunction formConsistency(form, team, season) {\\r\\n    let backToBack = 0; // Counts pairs of back to back identical match results\\r\\n    let prevResult = null;\\r\\n    for (let matchday in form[team][season]) {\\r\\n        let match = form[team][season][matchday];\\r\\n        if (match.score != null) {\\r\\n            let result;\\r\\n            if ((match.atHome && match.score.homeGoals > match.score.awayGoals) ||\\r\\n                (!match.atHome && match.score.homeGoals < match.score.awayGoals)) {\\r\\n                result = \\\"win\\\";\\r\\n            }\\r\\n            else if ((match.atHome && match.score.homeGoals < match.score.awayGoals) ||\\r\\n                (!match.atHome && match.score.homeGoals > match.score.awayGoals)) {\\r\\n                result = \\\"lost\\\";\\r\\n            }\\r\\n            else {\\r\\n                result = \\\"draw\\\";\\r\\n            }\\r\\n            if (prevResult != null && prevResult === result) {\\r\\n                backToBack += 1;\\r\\n            }\\r\\n            prevResult = result;\\r\\n        }\\r\\n    }\\r\\n    return backToBack;\\r\\n}\\r\\nfunction getConsistency(data) {\\r\\n    let consistency = {};\\r\\n    let maxSeasonBackToBack = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        let totalBackToBack = 0;\\r\\n        for (let i = 0; i < numSeasons; i++) {\\r\\n            let seasonBackToBack = formConsistency(data.form, team, data._id - i);\\r\\n            // If season completed, check if season consistency is highest yet\\r\\n            if (seasonComplete(data, team, data._id - i) &&\\r\\n                seasonBackToBack > maxSeasonBackToBack) {\\r\\n                maxSeasonBackToBack = seasonBackToBack;\\r\\n            }\\r\\n            totalBackToBack += seasonBackToBack;\\r\\n        }\\r\\n        consistency[team] = totalBackToBack;\\r\\n    }\\r\\n    consistency.avg = attributeAvgScaled(consistency, maxSeasonBackToBack * numSeasons);\\r\\n    return consistency;\\r\\n}\\r\\nfunction formWinStreak(form, team, season) {\\r\\n    let winStreak = 0;\\r\\n    let tempWinStreak = 0;\\r\\n    for (let matchday in form[team][season]) {\\r\\n        let match = form[team][season][matchday];\\r\\n        if (match.score != null) {\\r\\n            if ((match.atHome && match.score.homeGoals > match.score.awayGoals) ||\\r\\n                (!match.atHome && match.score.homeGoals < match.score.awayGoals)) {\\r\\n                tempWinStreak += 1;\\r\\n                if (tempWinStreak > winStreak) {\\r\\n                    winStreak = tempWinStreak;\\r\\n                }\\r\\n            }\\r\\n            else {\\r\\n                tempWinStreak = 0;\\r\\n            }\\r\\n        }\\r\\n    }\\r\\n    return winStreak;\\r\\n}\\r\\nfunction getWinStreak(data) {\\r\\n    let winStreaks = {};\\r\\n    let maxSeasonWinStreak = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        let totalWinStreak = 0;\\r\\n        for (let i = 0; i < numSeasons; i++) {\\r\\n            let seasonWinSteak = formWinStreak(data.form, team, data._id - i);\\r\\n            // If season completed, check if season consistency is highest yet\\r\\n            if (seasonComplete(data, team, data._id - i) &&\\r\\n                seasonWinSteak > maxSeasonWinStreak) {\\r\\n                maxSeasonWinStreak = seasonWinSteak;\\r\\n            }\\r\\n            totalWinStreak += seasonWinSteak;\\r\\n        }\\r\\n        winStreaks[team] = totalWinStreak;\\r\\n    }\\r\\n    winStreaks.avg = attributeAvgScaled(winStreaks, maxSeasonWinStreak * numSeasons);\\r\\n    return winStreaks;\\r\\n}\\r\\nfunction seasonComplete(data, team, season) {\\r\\n    return data.standings[team][season].played === 38;\\r\\n}\\r\\nfunction removeItem(arr, value) {\\r\\n    let index = arr.indexOf(value);\\r\\n    if (index > -1) {\\r\\n        arr.splice(index, 1);\\r\\n    }\\r\\n    return arr;\\r\\n}\\r\\nfunction formWinsVsBig6(form, team, season, big6) {\\r\\n    let pointsVsBig6 = 0;\\r\\n    let numPlayed = 0;\\r\\n    for (let matchday in form[team][season]) {\\r\\n        let match = form[team][season][matchday];\\r\\n        if (match.score != null && big6.includes(match.team)) {\\r\\n            if ((match.atHome && match.score.homeGoals > match.score.awayGoals) ||\\r\\n                (!match.atHome && match.score.homeGoals < match.score.awayGoals)) {\\r\\n                pointsVsBig6 += 3;\\r\\n            }\\r\\n            else if (match.score.homeGoals === match.score.awayGoals) {\\r\\n                pointsVsBig6 += 1;\\r\\n            }\\r\\n            numPlayed += 1;\\r\\n        }\\r\\n    }\\r\\n    return [pointsVsBig6, numPlayed];\\r\\n}\\r\\nfunction getVsBig6(data) {\\r\\n    //@ts-ignore\\r\\n    let vsBig6 = {};\\r\\n    let maxAvgSeasonPointsVsBig6 = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of Object.keys(data.standings)) {\\r\\n        let totalPointsVsBig6 = 0;\\r\\n        let totalPlayedVsBig6 = 0;\\r\\n        for (let i = 0; i < numSeasons; i++) {\\r\\n            let [seasonPointsVsBig6, seasonPlayedVsBig6] = formWinsVsBig6(data.form, team, data._id - i, removeItem(big6, team));\\r\\n            if (seasonPlayedVsBig6 === 0) {\\r\\n                continue;\\r\\n            }\\r\\n            let avgSeasonPointsVsBig6 = seasonPlayedVsBig6 / seasonPlayedVsBig6;\\r\\n            // If season completed, check if season consistency is highest yet\\r\\n            if (seasonComplete(data, team, data._id - i) &&\\r\\n                avgSeasonPointsVsBig6 > maxAvgSeasonPointsVsBig6) {\\r\\n                maxAvgSeasonPointsVsBig6 = avgSeasonPointsVsBig6;\\r\\n            }\\r\\n            totalPointsVsBig6 += seasonPointsVsBig6;\\r\\n            totalPlayedVsBig6 += seasonPlayedVsBig6;\\r\\n        }\\r\\n        let totalAvgPointsVsBig = 0;\\r\\n        if (totalPlayedVsBig6 > 0) {\\r\\n            totalAvgPointsVsBig = totalPointsVsBig6 / totalPlayedVsBig6;\\r\\n        }\\r\\n        vsBig6[team] = totalAvgPointsVsBig;\\r\\n    }\\r\\n    vsBig6.avg = attributeAvgScaled(vsBig6, maxAvgSeasonPointsVsBig6 * numSeasons);\\r\\n    return vsBig6;\\r\\n}\\r\\nfunction scatterPlot(name, r, color) {\\r\\n    return {\\r\\n        name: name,\\r\\n        type: \\\"scatterpolar\\\",\\r\\n        r: r,\\r\\n        theta: labels,\\r\\n        fill: \\\"toself\\\",\\r\\n        marker: { color: color },\\r\\n        hovertemplate: `<b>${name}</b><br>%{theta}: %{r}<extra></extra>`,\\r\\n        hoveron: \\\"points\\\",\\r\\n    };\\r\\n}\\r\\nfunction avgScatterPlot() {\\r\\n    return scatterPlot(\\\"Avg\\\", [\\r\\n        attack.avg,\\r\\n        defence.avg,\\r\\n        cleanSheets.avg,\\r\\n        consistency.avg,\\r\\n        winStreaks.avg,\\r\\n        vsBig6.avg,\\r\\n    ], \\\"#ADADAD\\\");\\r\\n}\\r\\nfunction getTeamData(team) {\\r\\n    let teamData = scatterPlot(team, [\\r\\n        attack[team],\\r\\n        defence[team],\\r\\n        cleanSheets[team],\\r\\n        consistency[team],\\r\\n        winStreaks[team],\\r\\n        vsBig6[team],\\r\\n    ], teamColor(team));\\r\\n    return teamData;\\r\\n}\\r\\nfunction initSpiderPlots(team) {\\r\\n    let avgData = avgScatterPlot();\\r\\n    let teamData = getTeamData(team);\\r\\n    return [avgData, teamData];\\r\\n}\\r\\nfunction computePlotData(data) {\\r\\n    attack = getAttack(data);\\r\\n    defence = getDefence(data);\\r\\n    cleanSheets = getCleanSheets(data);\\r\\n    consistency = getConsistency(data);\\r\\n    winStreaks = getWinStreak(data);\\r\\n    vsBig6 = getVsBig6(data);\\r\\n}\\r\\nfunction defaultLayout() {\\r\\n    return {\\r\\n        height: 550,\\r\\n        polar: {\\r\\n            radialaxis: {\\r\\n                visible: true,\\r\\n                range: [0, 100],\\r\\n            },\\r\\n        },\\r\\n        hover: \\\"closest\\\",\\r\\n        margin: { t: 25, b: 25, l: 75, r: 75 },\\r\\n        showlegend: false,\\r\\n        plot_bgcolor: \\\"#fafafa\\\",\\r\\n        paper_bgcolor: \\\"#fafafa\\\",\\r\\n        dragmode: false,\\r\\n    };\\r\\n}\\r\\nfunction buildPlotData(data, team) {\\r\\n    computePlotData(data);\\r\\n    let spiderPlots = initSpiderPlots(team);\\r\\n    let plotData = {\\r\\n        data: spiderPlots,\\r\\n        layout: defaultLayout(),\\r\\n        config: {\\r\\n            responsive: true,\\r\\n            showSendToCloud: false,\\r\\n            displayModeBar: false,\\r\\n        },\\r\\n    };\\r\\n    return plotData;\\r\\n}\\r\\nconst numSeasons = 3;\\r\\nlet attack, defence, cleanSheets, consistency, winStreaks, vsBig6;\\r\\nlet labels = [\\r\\n    \\\"Attack\\\",\\r\\n    \\\"Defence\\\",\\r\\n    \\\"Clean sheets\\\",\\r\\n    \\\"Consistency\\\",\\r\\n    \\\"Win streak\\\",\\r\\n    \\\"Vs big 6\\\",\\r\\n];\\r\\nlet big6 = [\\r\\n    \\\"Manchester United\\\",\\r\\n    \\\"Liverpool\\\",\\r\\n    \\\"Manchester City\\\",\\r\\n    \\\"Arsenal\\\",\\r\\n    \\\"Chelsea\\\",\\r\\n    \\\"Tottenham Hotspur\\\",\\r\\n];\\r\\nlet plotDiv, plotData;\\r\\nlet comparisonTeams = [];\\r\\nlet setup = false;\\r\\nonMount(() => {\\r\\n    genPlot();\\r\\n    setup = true;\\r\\n});\\r\\nfunction genPlot() {\\r\\n    plotData = buildPlotData(data, team);\\r\\n    //@ts-ignore\\r\\n    new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then((plot) => {\\r\\n        // Once plot generated, add resizable attribute to it to shorten height for mobile view\\r\\n        plot.children[0].children[0].classList.add(\\\"resizable-spider-chart\\\");\\r\\n    });\\r\\n    // Add inner border radius to top and bottom teams\\r\\n    document\\r\\n        .getElementById(\\\"spider-opp-teams\\\")\\r\\n        .children[0].classList.add(\\\"top-spider-opp-team-btn\\\");\\r\\n    document\\r\\n        .getElementById(\\\"spider-opp-teams\\\")\\r\\n        .children[18].classList.add(\\\"bottom-spider-opp-team-btn\\\");\\r\\n}\\r\\nfunction emptyArray(arr) {\\r\\n    let length = arr.length;\\r\\n    for (let i = 0; i < length; i++) {\\r\\n        arr.pop();\\r\\n    }\\r\\n}\\r\\nfunction refreshPlot() {\\r\\n    if (setup) {\\r\\n        let spiderPlots = initSpiderPlots(team);\\r\\n        // Remove all but two plots\\r\\n        emptyArray(plotData.data);\\r\\n        // Replace final two plots with defaults\\r\\n        plotData.data.push(spiderPlots[0]); // Reset to avg\\r\\n        plotData.data.push(spiderPlots[1]); // Reset to team data\\r\\n        removeAllTeamComparisons();\\r\\n        resetTeamComparisonBtns();\\r\\n        setTimeout(() => {\\r\\n            document\\r\\n                .getElementById(\\\"spider-opp-teams\\\")\\r\\n                .children[0].classList.add(\\\"top-spider-opp-team-btn\\\");\\r\\n            document\\r\\n                .getElementById(\\\"spider-opp-teams\\\")\\r\\n                .children[18].classList.add(\\\"bottom-spider-opp-team-btn\\\");\\r\\n        }, 0);\\r\\n    }\\r\\n}\\r\\n$: team && refreshPlot();\\r\\nexport let data, team, teams;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"spider-chart\\\">\\r\\n  <div id=\\\"plotly\\\">\\r\\n    <div id=\\\"plotDiv\\\" bind:this={plotDiv}>\\r\\n      <!-- Plotly chart will be drawn inside this DIV -->\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"spider-opp-team-selector\\\">\\r\\n  <div class=\\\"spider-opp-team-btns\\\" id=\\\"spider-opp-teams\\\">\\r\\n    {#each teams as _team}\\r\\n      {#if _team != team}\\r\\n        <button\\r\\n          class=\\\"spider-opp-team-btn\\\"\\r\\n          on:click={(e) => {\\r\\n            //@ts-ignore\\r\\n            spiderBtnClick(e.target);\\r\\n          }}>{toAlias(_team)}</button\\r\\n        >\\r\\n      {/if}\\r\\n    {/each}\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .spider-chart {\\r\\n    position: relative;\\r\\n  }\\r\\n  .spider-opp-team-selector {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    margin: auto;\\r\\n  }\\r\\n  .spider-opp-team-btns {\\r\\n    border-radius: 6px;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    border: 3px solid #333333;\\r\\n    color: #333333;\\r\\n    width: 180px;\\r\\n  }\\r\\n  .spider-opp-team-btn {\\r\\n    cursor: pointer;\\r\\n    color: #333333;\\r\\n    border: none;\\r\\n    font-size: 13px;\\r\\n    padding: 4px 10px;\\r\\n  }\\r\\n  button {\\r\\n    margin: 0 !important;\\r\\n    padding: 4 10px !important;\\r\\n  }\\r\\n  .spider-opp-team-btn:hover {\\r\\n    filter: brightness(0.95);\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAojBE,4BAAc,CACZ,QAAQ,CAAE,QACZ,CACA,wCAA0B,CACxB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,IACV,CACA,oCAAsB,CACpB,aAAa,CAAE,GAAG,CAClB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,OAAO,CACzB,KAAK,CAAE,OAAO,CACd,KAAK,CAAE,KACT,CACA,mCAAqB,CACnB,MAAM,CAAE,OAAO,CACf,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,SAAS,CAAE,IAAI,CACf,OAAO,CAAE,GAAG,CAAC,IACf,CACA,qBAAO,CACL,MAAM,CAAE,CAAC,CAAC,UAAU,CACpB,OAAO,CAAE,CAAC,CAAC,IAAI,CAAC,UAClB,CACA,mCAAoB,MAAO,CACzB,MAAM,CAAE,WAAW,IAAI,CACzB\"}"
};

const numSeasons = 3;

function resetTeamComparisonBtns() {
	let btns = document.getElementById("spider-opp-teams");

	for (let i = 0; i < btns.children.length; i++) {
		//@ts-ignore
		let btn = btns.children[i];

		if (btn.style.background != "") {
			btn.style.background = "";
			btn.style.color = "black";
		}
	}
}

function goalsPerGame(data) {
	let attack = {};
	let maxGoalsPerSeason = Number.NEGATIVE_INFINITY;
	let minGoalsPerSeason = Number.POSITIVE_INFINITY;

	for (let team of Object.keys(data.standings)) {
		let totalGoals = 0;
		let gamesPlayed = 0;

		for (let season in data.standings[team]) {
			let goals = data.standings[team][season].gF;
			let played = data.standings[team][season].played;

			if (goals > 0) {
				totalGoals += goals;
				gamesPlayed += played;
			}

			// If season completed, check if team's attacking performance is most extreme yet
			if (played === 38) {
				let seasonGoalsPerGame = goals / played;

				if (seasonGoalsPerGame > maxGoalsPerSeason) {
					maxGoalsPerSeason = seasonGoalsPerGame;
				} else if (seasonGoalsPerGame < minGoalsPerSeason) {
					minGoalsPerSeason = seasonGoalsPerGame;
				}
			}
		}

		// Get team's overall goals per game across multiple seasons
		let goalsPerGame = null;

		if (gamesPlayed > 0) {
			goalsPerGame = totalGoals / gamesPlayed;
		}

		attack[team] = goalsPerGame;
	}

	return [attack, [minGoalsPerSeason, maxGoalsPerSeason]];
}

function scaleAttack(attack, range) {
	let [lower, upper] = range;

	for (let team in attack) {
		if (attack[team] === null) {
			attack[team] = 0;
		} else {
			attack[team] = (attack[team] - lower) / (upper - lower) * 100;
		}
	}

	return attack;
}

function attributeAvgScaled(attribute, max) {
	let total = 0;

	for (let team in attribute) {
		attribute[team] = attribute[team] / max * 100;
		total += attribute[team];
	}

	let avg = total / Object.keys(attribute).length;
	return avg;
}

function attributeAvg(attribute) {
	let total = 0;

	for (let team in attribute) {
		total += attribute[team];
	}

	let avg = total / Object.keys(attribute).length;
	return avg;
}

function getAttack(data) {
	let [attack, extremes] = goalsPerGame(data);
	attack = scaleAttack(attack, extremes);
	attack.avg = attributeAvg(attack);
	return attack;
}

function concededPerSeason(data) {
	let defence = {};
	let maxConcededPerSeason = Number.NEGATIVE_INFINITY;
	let minConcededPerSeason = Number.POSITIVE_INFINITY;

	for (let team of Object.keys(data.standings)) {
		let totalConceded = 0;
		let gamesPlayed = 0;

		for (let season in data.standings[team]) {
			let conceded = data.standings[team][season].gA;
			let played = data.standings[team][season].played;

			if (conceded > 0) {
				totalConceded += conceded;
				gamesPlayed += played;
			}

			// If season completed, check if team's defensive performance is most extreme yet
			if (played === 38) {
				let seasonConcededPerGame = conceded / played;

				if (seasonConcededPerGame > maxConcededPerSeason) {
					maxConcededPerSeason = seasonConcededPerGame;
				} else if (seasonConcededPerGame < minConcededPerSeason) {
					minConcededPerSeason = seasonConcededPerGame;
				}
			}
		}

		let goalsPerGame = null;

		if (gamesPlayed > 0) {
			goalsPerGame = totalConceded / gamesPlayed;
		}

		defence[team] = goalsPerGame;
	}

	return [defence, [minConcededPerSeason, maxConcededPerSeason]];
}

function scaleDefence(defence, range) {
	let [lower, upper] = range;

	for (let team in defence) {
		if (defence[team] === null) {
			defence[team] = 0;
		} else {
			defence[team] = 100 - (defence[team] - lower) / (upper - lower) * 100;
		}
	}

	return defence;
}

function getDefence(data) {
	let [defence, range] = concededPerSeason(data);
	defence = scaleDefence(defence, range);
	defence.avg = attributeAvg(defence);
	return defence;
}

function formCleanSheets(form, team, season) {
	let nCleanSheets = 0;

	for (let matchday in form[team][season]) {
		let match = form[team][season][matchday];

		if (match.score != null) {
			if (match.atHome && match.score.awayGoals === 0) {
				nCleanSheets += 1;
			} else if (!match.atHome && match.score.homeGoals === 0) {
				nCleanSheets += 1;
			}
		}
	}

	return nCleanSheets;
}

function getCleanSheets(data) {
	let cleanSheets = {};
	let maxSeasonCleanSheets = Number.NEGATIVE_INFINITY;

	for (let team of Object.keys(data.standings)) {
		let totalCleanSheetsCount = 0;

		for (let i = 0; i < numSeasons; i++) {
			let seasonCleanSheets = formCleanSheets(data.form, team, data._id - i);

			// If season completed, check if season clean sheets is highest yet
			if (seasonComplete(data, team, data._id - i) && seasonCleanSheets > maxSeasonCleanSheets) {
				maxSeasonCleanSheets = seasonCleanSheets;
			}

			totalCleanSheetsCount += seasonCleanSheets;
		}

		cleanSheets[team] = totalCleanSheetsCount;
	}

	cleanSheets.avg = attributeAvgScaled(cleanSheets, maxSeasonCleanSheets * numSeasons);
	return cleanSheets;
}

function formConsistency(form, team, season) {
	let backToBack = 0; // Counts pairs of back to back identical match results
	let prevResult = null;

	for (let matchday in form[team][season]) {
		let match = form[team][season][matchday];

		if (match.score != null) {
			let result;

			if (match.atHome && match.score.homeGoals > match.score.awayGoals || !match.atHome && match.score.homeGoals < match.score.awayGoals) {
				result = "win";
			} else if (match.atHome && match.score.homeGoals < match.score.awayGoals || !match.atHome && match.score.homeGoals > match.score.awayGoals) {
				result = "lost";
			} else {
				result = "draw";
			}

			if (prevResult != null && prevResult === result) {
				backToBack += 1;
			}

			prevResult = result;
		}
	}

	return backToBack;
}

function getConsistency(data) {
	let consistency = {};
	let maxSeasonBackToBack = Number.NEGATIVE_INFINITY;

	for (let team of Object.keys(data.standings)) {
		let totalBackToBack = 0;

		for (let i = 0; i < numSeasons; i++) {
			let seasonBackToBack = formConsistency(data.form, team, data._id - i);

			// If season completed, check if season consistency is highest yet
			if (seasonComplete(data, team, data._id - i) && seasonBackToBack > maxSeasonBackToBack) {
				maxSeasonBackToBack = seasonBackToBack;
			}

			totalBackToBack += seasonBackToBack;
		}

		consistency[team] = totalBackToBack;
	}

	consistency.avg = attributeAvgScaled(consistency, maxSeasonBackToBack * numSeasons);
	return consistency;
}

function formWinStreak(form, team, season) {
	let winStreak = 0;
	let tempWinStreak = 0;

	for (let matchday in form[team][season]) {
		let match = form[team][season][matchday];

		if (match.score != null) {
			if (match.atHome && match.score.homeGoals > match.score.awayGoals || !match.atHome && match.score.homeGoals < match.score.awayGoals) {
				tempWinStreak += 1;

				if (tempWinStreak > winStreak) {
					winStreak = tempWinStreak;
				}
			} else {
				tempWinStreak = 0;
			}
		}
	}

	return winStreak;
}

function getWinStreak(data) {
	let winStreaks = {};
	let maxSeasonWinStreak = Number.NEGATIVE_INFINITY;

	for (let team of Object.keys(data.standings)) {
		let totalWinStreak = 0;

		for (let i = 0; i < numSeasons; i++) {
			let seasonWinSteak = formWinStreak(data.form, team, data._id - i);

			// If season completed, check if season consistency is highest yet
			if (seasonComplete(data, team, data._id - i) && seasonWinSteak > maxSeasonWinStreak) {
				maxSeasonWinStreak = seasonWinSteak;
			}

			totalWinStreak += seasonWinSteak;
		}

		winStreaks[team] = totalWinStreak;
	}

	winStreaks.avg = attributeAvgScaled(winStreaks, maxSeasonWinStreak * numSeasons);
	return winStreaks;
}

function seasonComplete(data, team, season) {
	return data.standings[team][season].played === 38;
}

function removeItem(arr, value) {
	let index = arr.indexOf(value);

	if (index > -1) {
		arr.splice(index, 1);
	}

	return arr;
}

function formWinsVsBig6(form, team, season, big6) {
	let pointsVsBig6 = 0;
	let numPlayed = 0;

	for (let matchday in form[team][season]) {
		let match = form[team][season][matchday];

		if (match.score != null && big6.includes(match.team)) {
			if (match.atHome && match.score.homeGoals > match.score.awayGoals || !match.atHome && match.score.homeGoals < match.score.awayGoals) {
				pointsVsBig6 += 3;
			} else if (match.score.homeGoals === match.score.awayGoals) {
				pointsVsBig6 += 1;
			}

			numPlayed += 1;
		}
	}

	return [pointsVsBig6, numPlayed];
}

function defaultLayout$3() {
	return {
		height: 550,
		polar: {
			radialaxis: { visible: true, range: [0, 100] }
		},
		hover: "closest",
		margin: { t: 25, b: 25, l: 75, r: 75 },
		showlegend: false,
		plot_bgcolor: "#fafafa",
		paper_bgcolor: "#fafafa",
		dragmode: false
	};
}

function emptyArray(arr) {
	let length = arr.length;

	for (let i = 0; i < length; i++) {
		arr.pop();
	}
}

const SpiderGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {

	function addAvg() {
		let avg = avgScatterPlot();
		plotData.data.unshift(avg); // Add avg below the teamName spider plot
	}

	function removeAllTeamComparisons() {
		for (let i = 0; i < comparisonTeams.length; i++) {
			// Remove spider plot for this teamName
			for (let i = 0; i < plotData.data.length; i++) {
				if (plotData.data[i].name === comparisonTeams[i] && comparisonTeams[i] != team) {
					plotData.data.splice(i, 1);
					break;
				}
			}

			// If removing only comparison teamName, re-insert the initial avg spider plot
			if (comparisonTeams.length === 1) {
				addAvg();
			}

			removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams
		}

		//@ts-ignore
		Plotly.redraw(plotDiv); // Redraw with teamName removed
	}

	function getVsBig6(data) {
		//@ts-ignore
		let vsBig6 = {};

		let maxAvgSeasonPointsVsBig6 = Number.NEGATIVE_INFINITY;

		for (let team of Object.keys(data.standings)) {
			let totalPointsVsBig6 = 0;
			let totalPlayedVsBig6 = 0;

			for (let i = 0; i < numSeasons; i++) {
				let [seasonPointsVsBig6, seasonPlayedVsBig6] = formWinsVsBig6(data.form, team, data._id - i, removeItem(big6, team));

				if (seasonPlayedVsBig6 === 0) {
					continue;
				}

				let avgSeasonPointsVsBig6 = seasonPlayedVsBig6 / seasonPlayedVsBig6;

				// If season completed, check if season consistency is highest yet
				if (seasonComplete(data, team, data._id - i) && avgSeasonPointsVsBig6 > maxAvgSeasonPointsVsBig6) {
					maxAvgSeasonPointsVsBig6 = avgSeasonPointsVsBig6;
				}

				totalPointsVsBig6 += seasonPointsVsBig6;
				totalPlayedVsBig6 += seasonPlayedVsBig6;
			}

			let totalAvgPointsVsBig = 0;

			if (totalPlayedVsBig6 > 0) {
				totalAvgPointsVsBig = totalPointsVsBig6 / totalPlayedVsBig6;
			}

			vsBig6[team] = totalAvgPointsVsBig;
		}

		vsBig6.avg = attributeAvgScaled(vsBig6, maxAvgSeasonPointsVsBig6 * numSeasons);
		return vsBig6;
	}

	function scatterPlot(name, r, color) {
		return {
			name,
			type: "scatterpolar",
			r,
			theta: labels,
			fill: "toself",
			marker: { color },
			hovertemplate: `<b>${name}</b><br>%{theta}: %{r}<extra></extra>`,
			hoveron: "points"
		};
	}

	function avgScatterPlot() {
		return scatterPlot(
			"Avg",
			[
				attack.avg,
				defence.avg,
				cleanSheets.avg,
				consistency.avg,
				winStreaks.avg,
				vsBig6.avg
			],
			"#ADADAD"
		);
	}

	function getTeamData(team) {
		let teamData = scatterPlot(
			team,
			[
				attack[team],
				defence[team],
				cleanSheets[team],
				consistency[team],
				winStreaks[team],
				vsBig6[team]
			],
			teamColor(team)
		);

		return teamData;
	}

	function initSpiderPlots(team) {
		let avgData = avgScatterPlot();
		let teamData = getTeamData(team);
		return [avgData, teamData];
	}

	function computePlotData(data) {
		attack = getAttack(data);
		defence = getDefence(data);
		cleanSheets = getCleanSheets(data);
		consistency = getConsistency(data);
		winStreaks = getWinStreak(data);
		vsBig6 = getVsBig6(data);
	}

	function buildPlotData(data, team) {
		computePlotData(data);
		let spiderPlots = initSpiderPlots(team);

		let plotData = {
			data: spiderPlots,
			layout: defaultLayout$3(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	let attack, defence, cleanSheets, consistency, winStreaks, vsBig6;
	let labels = ["Attack", "Defence", "Clean sheets", "Consistency", "Win streak", "Vs big 6"];

	let big6 = [
		"Manchester United",
		"Liverpool",
		"Manchester City",
		"Arsenal",
		"Chelsea",
		"Tottenham Hotspur"
	];

	let plotDiv, plotData;
	let comparisonTeams = [];
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-spider-chart");
		});

		// Add inner border radius to top and bottom teams
		document.getElementById("spider-opp-teams").children[0].classList.add("top-spider-opp-team-btn");

		document.getElementById("spider-opp-teams").children[18].classList.add("bottom-spider-opp-team-btn");
	}

	function refreshPlot() {
		if (setup) {
			let spiderPlots = initSpiderPlots(team);

			// Remove all but two plots
			emptyArray(plotData.data);

			// Replace final two plots with defaults
			plotData.data.push(spiderPlots[0]); // Reset to avg

			plotData.data.push(spiderPlots[1]); // Reset to team data
			removeAllTeamComparisons();
			resetTeamComparisonBtns();

			setTimeout(
				() => {
					document.getElementById("spider-opp-teams").children[0].classList.add("top-spider-opp-team-btn");
					document.getElementById("spider-opp-teams").children[18].classList.add("bottom-spider-opp-team-btn");
				},
				0
			);
		}
	}

	let { data, team, teams } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.teams === void 0 && $$bindings.teams && teams !== void 0) $$bindings.teams(teams);
	$$result.css.add(css$b);
	team && refreshPlot();

	return `<div class="spider-chart svelte-13tgs7k"><div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div></div>
<div class="spider-opp-team-selector svelte-13tgs7k"><div class="spider-opp-team-btns svelte-13tgs7k" id="spider-opp-teams">${each(teams, _team => {
		return `${_team != team
		? `<button class="spider-opp-team-btn svelte-13tgs7k">${escape(toAlias(_team))}</button>`
		: ``}`;
	})}</div>
</div>`;
});

/* src\components\team\ScorelineFreqGraph.svelte generated by Svelte v3.59.2 */

function insertSeasonAvgScoreFreq(scoreFreq, form, team, season) {
	for (let matchday in form[team][season]) {
		let score = form[team][season][matchday].score;

		if (score != null) {
			let scoreStr;

			if (form[team][season][matchday].atHome) {
				scoreStr = score.homeGoals + " - " + score.awayGoals;
			} else {
				scoreStr = score.awayGoals + " - " + score.homeGoals;
			}

			if (!(scoreStr in scoreFreq)) {
				scoreFreq[scoreStr] = [1];
			} else {
				scoreFreq[scoreStr][0] += 1;
			}
		}
	}
}

function insertSeasonTeamScoreBars(scoreFreq, form, team, season) {
	for (let matchday in form[team][season]) {
		let score = form[team][season][matchday].score;

		if (score != null) {
			let scoreStr;

			if (form[team][season][matchday].atHome) {
				scoreStr = score.homeGoals + " - " + score.awayGoals;
			} else {
				scoreStr = score.awayGoals + " - " + score.homeGoals;
			}

			scoreFreq[scoreStr][1] += 1;
		}
	}
}

function getColours$1(scores) {
	let colours = [];

	for (let score of scores) {
		let [hs, _, as] = score.split(" ");
		let h = parseInt(hs);
		let a = parseInt(as);

		if (h > a) {
			colours.push("#00fe87");
		} else if (h < a) {
			colours.push("#f83027");
		} else {
			colours.push("#ffdd00");
		}
	}

	return colours;
}

function separateBars(scoreFreq) {
	let sorted = Object.entries(scoreFreq).sort((a, b) => b[1][0] - a[1][0]);
	let x = [];
	let avgY = [];
	let teamY = [];

	for (let i = 0; i < sorted.length; i++) {
		x.push(sorted[i][0]);
		avgY.push(sorted[i][1][0]);
		teamY.push(sorted[i][1][1]);
	}

	let colours = getColours$1(x);

	return [
		{
			x,
			y: avgY,
			type: "bar",
			name: "Avg",
			marker: { color: "#C6C6C6" },
			hovertemplate: `%{x} with probability <b>%{y:.2f}</b><extra></extra>`,
			hoverinfo: "x+y"
		},
		{
			x,
			y: teamY,
			type: "bar",
			name: "Scorelines",
			marker: { color: colours },
			hovertemplate: `%{x} with probability <b>%{y:.2f}</b><extra></extra>`,
			hoverinfo: "x+y",
			opacity: 0.5
		}
	];
}

function scaleBars(scoreFreq) {
	let avgTotal = 0;
	let teamTotal = 0;

	for (let score in scoreFreq) {
		avgTotal += scoreFreq[score][0];
		teamTotal += scoreFreq[score][1];
	}

	// Scale team frequency values to match average
	for (let score in scoreFreq) {
		scoreFreq[score][1] *= avgTotal / teamTotal;
	}
}

function convertToPercentage(scoreFreq) {
	let avgTotal = 0;
	let teamTotal = 0;

	for (let score in scoreFreq) {
		avgTotal += scoreFreq[score][0];
		teamTotal += scoreFreq[score][1];
	}

	// Scale team frequency values to match average
	for (let score in scoreFreq) {
		scoreFreq[score][0] /= avgTotal;
		scoreFreq[score][1] /= teamTotal;
	}
}

function defaultLayout$2() {
	return {
		title: false,
		autosize: true,
		margin: { r: 20, l: 65, t: 15, b: 60, pad: 5 },
		hovermode: "closest",
		barmode: "overlay",
		bargap: 0,
		plot_bgcolor: "#fafafa",
		paper_bgcolor: "#fafafa",
		yaxis: {
			title: { text: "Probability" },
			gridcolor: "gray",
			showgrid: false,
			showline: false,
			zeroline: false,
			fixedrange: true
		},
		xaxis: {
			title: { text: "Scoreline" },
			linecolor: "black",
			showgrid: false,
			showline: false,
			fixedrange: true
		},
		legend: { x: 1, xanchor: "right", y: 0.95 },
		dragmode: false
	};
}

function resetTeamBars(scoreFreq) {
	for (let score in scoreFreq) {
		scoreFreq[score][1] = 0;
	}
}

const ScorelineFreqGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getAvgScoreFreq(data) {
		let scoreFreq = {};

		for (let team in data.form) {
			for (let i = 0; i < 3; i++) {
				if (i === 0) {
					insertSeasonAvgScoreFreq(scoreFreq, data.form, team, data._id - i);
				} else if (teamInSeason(data.form, team, data._id - i)) {
					insertSeasonAvgScoreFreq(scoreFreq, data.form, team, data._id - i);
				}
			}
		}

		return scoreFreq;
	}

	function insertTeamScoreBars(data, team, scoreFreq) {
		for (let score in scoreFreq) {
			if (scoreFreq[score].length === 1) {
				scoreFreq[score].push(0);
			}
		}

		insertSeasonTeamScoreBars(scoreFreq, data.form, team, data._id);

		if (teamInSeason(data.form, team, data._id - 1)) {
			insertSeasonTeamScoreBars(scoreFreq, data.form, team, data._id - 1);
		}

		if (teamInSeason(data.form, team, data._id - 2)) {
			insertSeasonTeamScoreBars(scoreFreq, data.form, team, data._id - 2);
		}
	}

	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Probability" },
				"yaxis.visible": true,
				"xaxis.tickfont.size": 12,
				"margin.l": 65
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"xaxis.tickfont.size": 5,
				"margin.l": 20
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function buildPlotData(data, team) {
		scoreFreq = getAvgScoreFreq(data);
		insertTeamScoreBars(data, team, scoreFreq);
		scaleBars(scoreFreq);
		convertToPercentage(scoreFreq);
		let bars = separateBars(scoreFreq);

		let plotData = {
			data: bars,
			layout: defaultLayout$2(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	function genPlot() {
		plotData = buildPlotData(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			resetTeamBars(scoreFreq);
			insertTeamScoreBars(data, team, scoreFreq);
			scaleBars(scoreFreq);
			convertToPercentage(scoreFreq);
			let bars = separateBars(scoreFreq);
			plotData.data[1] = bars[1]; // Update team bars

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let plotDiv, plotData;
	let scoreFreq;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { data, team, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\nav\Nav.svelte generated by Svelte v3.59.2 */

const css$a = {
	code: ".title.svelte-dh0tqd.svelte-dh0tqd{color:white;font-size:1.6em;height:96px;display:grid;place-items:center}.title.svelte-dh0tqd a.svelte-dh0tqd{color:white}.no-selection.svelte-dh0tqd.svelte-dh0tqd{user-select:none;-webkit-user-select:none;-moz-user-select:none}.team-links.svelte-dh0tqd.svelte-dh0tqd{font-size:1em;color:var(--pink);display:grid}button.svelte-dh0tqd.svelte-dh0tqd{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit;text-align:left}.team-name.svelte-dh0tqd.svelte-dh0tqd,.this-team-name.svelte-dh0tqd.svelte-dh0tqd{padding:0.4em 1.4em}.this-team-container.svelte-dh0tqd.svelte-dh0tqd{color:var(--pink)}:hover.team-container.svelte-dh0tqd.svelte-dh0tqd{background:#2c002f;background:#140921}nav.svelte-dh0tqd.svelte-dh0tqd{position:fixed;width:220px;height:100vh;background:#37003c;background:var(--purple)}img.svelte-dh0tqd.svelte-dh0tqd{height:25px;width:25px}.close-btn.svelte-dh0tqd.svelte-dh0tqd{position:absolute;right:0.9em;bottom:0.6em;background:transparent;border:none;outline:none;padding-top:0.3em;cursor:pointer}.placeholder.svelte-dh0tqd.svelte-dh0tqd{height:19px;margin:6px 21px;width:40px;background:#c600d8;border-radius:4px;opacity:0.25;position:relative;overflow:hidden}.placeholder.svelte-dh0tqd.svelte-dh0tqd::before{content:\"\";display:block;position:absolute;left:-100px;top:0;height:100%;width:150px;background:linear-gradient(\r\n      to right,\r\n      transparent 0%,\r\n      #e8e8e8 50%,\r\n      transparent 100%\r\n    );background:linear-gradient(\r\n      to right,\r\n      transparent 0%,\r\n      #eea7f4 50%,\r\n      transparent 100%\r\n    );animation:svelte-dh0tqd-load 1s cubic-bezier(0.4, 0, 0.2, 1) infinite}@keyframes svelte-dh0tqd-load{from{left:-100px}to{left:100px}}@media only screen and (max-width: 1200px){#navBar.svelte-dh0tqd.svelte-dh0tqd{display:none}}",
	map: "{\"version\":3,\"file\":\"Nav.svelte\",\"sources\":[\"Nav.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { teamStyle } from \\\"../../lib/format\\\";\\r\\nimport { toHyphenatedName } from \\\"../../lib/team\\\";\\r\\nfunction closeNavBar() {\\r\\n    document.getElementById(\\\"navBar\\\").style.display = \\\"none\\\";\\r\\n    document.getElementById(\\\"dashboard\\\").style.marginLeft = \\\"0\\\";\\r\\n    window.dispatchEvent(new Event(\\\"resize\\\")); // Snap plotly graphs to new width\\r\\n}\\r\\nlet widths = [];\\r\\nfor (let i = 0; i < 20; i++) {\\r\\n    widths.push(35 + Math.floor(Math.random() * 8) * 5);\\r\\n}\\r\\nexport let team, teams, toAlias, switchTeam;\\r\\n</script>\\r\\n\\r\\n<nav id=\\\"navBar\\\">\\r\\n  <div class=\\\"title no-selection\\\">\\r\\n    <a href=\\\"/home\\\">\\r\\n      <span style=\\\"color: var(--green)\\\">pl</span>dashboard\\r\\n    </a>\\r\\n  </div>\\r\\n  <div class=\\\"team-links\\\">\\r\\n    {#if teams.length === 0}\\r\\n      {#each widths as width, _}\\r\\n        <div class=\\\"placeholder\\\" style=\\\"width: {width}%\\\" />\\r\\n      {/each}\\r\\n    {:else}\\r\\n      {#each teams as _team, _ (_team)}\\r\\n        {#if toHyphenatedName(_team) === team}\\r\\n          <a href=\\\"/{toHyphenatedName(_team)}\\\" class=\\\"team-link\\\">\\r\\n            <div class=\\\"this-team-container\\\" style={teamStyle(_team)}>\\r\\n              <div class=\\\"this-team-name\\\">\\r\\n                {toAlias(_team)}\\r\\n              </div>\\r\\n            </div>\\r\\n          </a>\\r\\n        {:else}\\r\\n          <button\\r\\n            class=\\\"team-link\\\"\\r\\n            on:click={() => {\\r\\n              switchTeam(toHyphenatedName(_team));\\r\\n            }}\\r\\n          >\\r\\n            <div class=\\\"team-container\\\">\\r\\n              <div class=\\\"team-name\\\">\\r\\n                {toAlias(_team)}\\r\\n              </div>\\r\\n            </div>\\r\\n          </button>\\r\\n        {/if}\\r\\n      {/each}\\r\\n      <!-- <div class=\\\"divider\\\" />\\r\\n      {#if team === \\\"overview\\\"}\\r\\n        <a href=\\\"/overview\\\" class=\\\"team-link\\\">\\r\\n          <div class=\\\"overview-selected\\\">\\r\\n            <div class=\\\"overview\\\">Overview</div>\\r\\n          </div>\\r\\n        </a>\\r\\n      {:else}\\r\\n        <button\\r\\n          class=\\\"team-link\\\"\\r\\n          on:click={() => {\\r\\n            switchTeam(\\\"overview\\\");\\r\\n          }}\\r\\n        >\\r\\n          <div class=\\\"overview-container\\\">\\r\\n            <div class=\\\"overview\\\">Overview</div>\\r\\n          </div>\\r\\n        </button>\\r\\n      {/if} -->\\r\\n    {/if}\\r\\n  </div>\\r\\n  <div class=\\\"close\\\">\\r\\n    <button class=\\\"close-btn\\\" on:click={closeNavBar}>\\r\\n      <img src=\\\"img/arrow-bar-left.svg\\\" alt=\\\"\\\" />\\r\\n    </button>\\r\\n  </div>\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  .title {\\r\\n    color: white;\\r\\n    font-size: 1.6em;\\r\\n    height: 96px;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .title a {\\r\\n    color: white;\\r\\n  }\\r\\n  .no-selection {\\r\\n    user-select: none;\\r\\n    -webkit-user-select: none;\\r\\n    -moz-user-select: none;\\r\\n  }\\r\\n  .team-links {\\r\\n    font-size: 1em;\\r\\n    color: var(--pink);\\r\\n    display: grid;\\r\\n  }\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n    text-align: left;\\r\\n  }\\r\\n  .team-name,\\r\\n  .this-team-name {\\r\\n    padding: 0.4em 1.4em;\\r\\n  }\\r\\n  .overview {\\r\\n    padding: 0.4em 1.4em;\\r\\n  }\\r\\n  .overview-selected {\\r\\n    color: var(--purple) !important;\\r\\n    background: var(--green) !important;\\r\\n  }\\r\\n\\r\\n  .divider {\\r\\n    height: 15px;\\r\\n    border-bottom: 1px solid rgba(198, 0, 216, 0.4);\\r\\n    width: 85%;\\r\\n    margin: auto;\\r\\n    margin-bottom: 15px;\\r\\n  }\\r\\n\\r\\n  .this-team-container {\\r\\n    color: var(--pink);\\r\\n  }\\r\\n\\r\\n  :hover.overview-container,\\r\\n  :hover.team-container {\\r\\n    background: #2c002f;\\r\\n    background: #140921;\\r\\n  }\\r\\n  nav {\\r\\n    position: fixed;\\r\\n    width: 220px;\\r\\n    height: 100vh;\\r\\n    background: #37003c;\\r\\n    background: var(--purple);\\r\\n  }\\r\\n  img {\\r\\n    height: 25px;\\r\\n    width: 25px;\\r\\n  }\\r\\n  .close-btn {\\r\\n    position: absolute;\\r\\n    right: 0.9em;\\r\\n    bottom: 0.6em;\\r\\n    background: transparent;\\r\\n    border: none;\\r\\n    outline: none;\\r\\n    padding-top: 0.3em;\\r\\n    cursor: pointer;\\r\\n  }\\r\\n\\r\\n  .placeholder {\\r\\n    height: 19px;\\r\\n    margin: 6px 21px;\\r\\n    width: 40px;\\r\\n    background: #c600d8;\\r\\n    border-radius: 4px;\\r\\n    opacity: 0.25;\\r\\n    position: relative;\\r\\n    overflow: hidden;\\r\\n  }\\r\\n\\r\\n  .placeholder::before {\\r\\n    content: \\\"\\\";\\r\\n    display: block;\\r\\n    position: absolute;\\r\\n    left: -100px;\\r\\n    top: 0;\\r\\n    height: 100%;\\r\\n    width: 150px;\\r\\n    background: linear-gradient(\\r\\n      to right,\\r\\n      transparent 0%,\\r\\n      #e8e8e8 50%,\\r\\n      transparent 100%\\r\\n    );\\r\\n    background: linear-gradient(\\r\\n      to right,\\r\\n      transparent 0%,\\r\\n      #eea7f4 50%,\\r\\n      transparent 100%\\r\\n    );\\r\\n    animation: load 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;\\r\\n  }\\r\\n  @keyframes load {\\r\\n    from {\\r\\n      left: -100px;\\r\\n    }\\r\\n    to {\\r\\n      left: 100px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1200px) {\\r\\n    #navBar {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA+EE,kCAAO,CACL,KAAK,CAAE,KAAK,CACZ,SAAS,CAAE,KAAK,CAChB,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MACf,CACA,oBAAM,CAAC,eAAE,CACP,KAAK,CAAE,KACT,CACA,yCAAc,CACZ,WAAW,CAAE,IAAI,CACjB,mBAAmB,CAAE,IAAI,CACzB,gBAAgB,CAAE,IACpB,CACA,uCAAY,CACV,SAAS,CAAE,GAAG,CACd,KAAK,CAAE,IAAI,MAAM,CAAC,CAClB,OAAO,CAAE,IACX,CACA,kCAAO,CACL,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OAAO,CAChB,UAAU,CAAE,IACd,CACA,sCAAU,CACV,2CAAgB,CACd,OAAO,CAAE,KAAK,CAAC,KACjB,CAiBA,gDAAqB,CACnB,KAAK,CAAE,IAAI,MAAM,CACnB,CAGA,MAAM,2CAAgB,CACpB,UAAU,CAAE,OAAO,CACnB,UAAU,CAAE,OACd,CACA,+BAAI,CACF,QAAQ,CAAE,KAAK,CACf,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,OAAO,CACnB,UAAU,CAAE,IAAI,QAAQ,CAC1B,CACA,+BAAI,CACF,MAAM,CAAE,IAAI,CACZ,KAAK,CAAE,IACT,CACA,sCAAW,CACT,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,WAAW,CACvB,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,KAAK,CAClB,MAAM,CAAE,OACV,CAEA,wCAAa,CACX,MAAM,CAAE,IAAI,CACZ,MAAM,CAAE,GAAG,CAAC,IAAI,CAChB,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,OAAO,CACnB,aAAa,CAAE,GAAG,CAClB,OAAO,CAAE,IAAI,CACb,QAAQ,CAAE,QAAQ,CAClB,QAAQ,CAAE,MACZ,CAEA,wCAAY,QAAS,CACnB,OAAO,CAAE,EAAE,CACX,OAAO,CAAE,KAAK,CACd,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,MAAM,CACZ,GAAG,CAAE,CAAC,CACN,MAAM,CAAE,IAAI,CACZ,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE;AAChB,MAAM,EAAE,CAAC,KAAK,CAAC;AACf,MAAM,WAAW,CAAC,EAAE,CAAC;AACrB,MAAM,OAAO,CAAC,GAAG,CAAC;AAClB,MAAM,WAAW,CAAC,IAAI;AACtB,KAAK,CACD,UAAU,CAAE;AAChB,MAAM,EAAE,CAAC,KAAK,CAAC;AACf,MAAM,WAAW,CAAC,EAAE,CAAC;AACrB,MAAM,OAAO,CAAC,GAAG,CAAC;AAClB,MAAM,WAAW,CAAC,IAAI;AACtB,KAAK,CACD,SAAS,CAAE,kBAAI,CAAC,EAAE,CAAC,aAAa,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,QAClD,CACA,WAAW,kBAAK,CACd,IAAK,CACH,IAAI,CAAE,MACR,CACA,EAAG,CACD,IAAI,CAAE,KACR,CACF,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,mCAAQ,CACN,OAAO,CAAE,IACX,CACF\"}"
};

const Nav = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let widths = [];

	for (let i = 0; i < 20; i++) {
		widths.push(35 + Math.floor(Math.random() * 8) * 5);
	}

	let { team, teams, toAlias, switchTeam } = $$props;
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.teams === void 0 && $$bindings.teams && teams !== void 0) $$bindings.teams(teams);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$a);

	return `<nav id="navBar" class="svelte-dh0tqd"><div class="title no-selection svelte-dh0tqd"><a href="/home" class="svelte-dh0tqd"><span style="color: var(--green)">pl</span>dashboard
    </a></div>
  <div class="team-links svelte-dh0tqd">${teams.length === 0
	? `${each(widths, (width, _) => {
			return `<div class="placeholder svelte-dh0tqd" style="${"width: " + escape(width, true) + "%"}"></div>`;
		})}`
	: `${each(teams, (_team, _) => {
			return `${toHyphenatedName(_team) === team
			? `<a href="${"/" + escape(toHyphenatedName(_team), true)}" class="team-link"><div class="this-team-container svelte-dh0tqd"${add_attribute("style", teamStyle(_team), 0)}><div class="this-team-name svelte-dh0tqd">${escape(toAlias(_team))}
              </div></div>
          </a>`
			: `<button class="team-link svelte-dh0tqd"><div class="team-container svelte-dh0tqd"><div class="team-name svelte-dh0tqd">${escape(toAlias(_team))}
              </div></div>
          </button>`}`;
		})}
      `}</div>
  <div class="close"><button class="close-btn svelte-dh0tqd"><img src="img/arrow-bar-left.svg" alt="" class="svelte-dh0tqd"></button></div>
</nav>`;
});

/* src\components\overview\Overview.svelte generated by Svelte v3.59.2 */

const css$9 = {
	code: "#page-content.svelte-1gtw5nu{margin-top:3em;position:relative}.row.svelte-1gtw5nu{display:flex;margin-bottom:2em}.left.svelte-1gtw5nu{width:min(40%, 500px)}.upcoming-matches.svelte-1gtw5nu{position:relative;margin-left:40px}.upcoming-match.svelte-1gtw5nu{display:flex;margin-bottom:8px}.upcoming-match-date.svelte-1gtw5nu{text-align:center;margin:0.9em 0 0.4em 0}.fixtures-title.svelte-1gtw5nu,.standings-title.svelte-1gtw5nu,.upcoming-title.svelte-1gtw5nu{font-size:2em;font-weight:800;text-align:center}.upcoming-match-time-container.svelte-1gtw5nu{display:grid;place-items:center;position:absolute;margin-top:-31px;width:100%}.upcoming-match-time.svelte-1gtw5nu{background:#ffffffa1;padding:1px 4px;border-radius:2px;font-size:13px;text-align:right}.upcoming-match-teams.svelte-1gtw5nu{display:flex;flex-grow:1}.upcoming-match-home.svelte-1gtw5nu,.upcoming-match-away.svelte-1gtw5nu{flex:1;padding:4px 10px}.upcoming-match-home.svelte-1gtw5nu{border-radius:4px 0 0 4px}.upcoming-match-away.svelte-1gtw5nu{text-align:right;border-radius:0 4px 4px 0}.standings-container.svelte-1gtw5nu{flex-grow:1;margin:0 40px 0 40px}.standings.svelte-1gtw5nu{margin:10px auto 0}.table-row.svelte-1gtw5nu{display:flex;padding:4px 20px 4px 10px;border-radius:4px}.standings-position.svelte-1gtw5nu{width:20px;margin-right:15px;text-align:right}.standings-team-name.svelte-1gtw5nu{width:210px}.bold.svelte-1gtw5nu{font-weight:800}.standings-won.svelte-1gtw5nu,.standings-drawn.svelte-1gtw5nu,.standings-lost.svelte-1gtw5nu{flex:1;text-align:right}.standings-gf.svelte-1gtw5nu,.standings-ga.svelte-1gtw5nu,.standings-gd.svelte-1gtw5nu{flex:1;text-align:right}.standings-rating.svelte-1gtw5nu,.standings-form.svelte-1gtw5nu,.standings-played.svelte-1gtw5nu,.standings-points.svelte-1gtw5nu{flex:1;text-align:right}.standings-points.svelte-1gtw5nu{margin-right:10%}.grey-row.svelte-1gtw5nu{background:rgb(236, 236, 236)}.cl.svelte-1gtw5nu{background:rgba(0, 254, 135, 0.6)}.cl.grey-row.svelte-1gtw5nu{background:rgb(0, 254, 135, 1)}.el.svelte-1gtw5nu{background:rgba(17, 182, 208, 0.7);background:rgba(2, 238, 255, 0.6)}.el.grey-row.svelte-1gtw5nu{background:rgba(17, 182, 208, 1);background:#02eeff}.relegation.svelte-1gtw5nu{background:rgba(248, 48, 39, 0.7)}.relegation.grey-row.svelte-1gtw5nu{background:rgb(248, 48, 39, 1)}.fixtures.svelte-1gtw5nu{position:relative;width:calc(100vw - 230px)}.fixtures-table.svelte-1gtw5nu{display:flex;margin:20px 30px 0 30px}.fixtures-matches-container.svelte-1gtw5nu{overflow-x:scroll;display:block}.fixtures-teams-container.svelte-1gtw5nu{margin-top:25px}.fixtures-table-row.svelte-1gtw5nu{display:flex}.fixtures-team.svelte-1gtw5nu{min-width:60px;text-align:center;border-right:2px solid black;border-left:2px solid black}.fixtures-matches.svelte-1gtw5nu{display:flex}.fixtures-team.svelte-1gtw5nu,.match.svelte-1gtw5nu{padding:3px 8px}.match.svelte-1gtw5nu{text-align:center;width:60px;border-bottom:2px solid black}.fixtures-team.svelte-1gtw5nu{border-bottom:2px solid black}.scale-btns.svelte-1gtw5nu{position:absolute;top:6px;right:30px;display:flex}.scale-team-ratings.svelte-1gtw5nu,.scale-team-form.svelte-1gtw5nu{padding:5px 0}.scale-team-ratings.svelte-1gtw5nu{padding-right:10px}.scaling-selected.svelte-1gtw5nu{background:var(--purple);color:var(--green)}.scale-btn.svelte-1gtw5nu{border-radius:4px;cursor:pointer}@media only screen and (max-width: 1200px){.fixtures.svelte-1gtw5nu{width:100vw}.standings-points.svelte-1gtw5nu{margin:0}}",
	map: "{\"version\":3,\"file\":\"Overview.svelte\",\"sources\":[\"Overview.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { onMount } from \\\"svelte\\\";\\r\\nimport { toInitials } from \\\"../../lib/team\\\";\\r\\nimport { teamStyle } from \\\"../../lib/format\\\";\\r\\nfunction upcomingMatches() {\\r\\n    let upcoming = [];\\r\\n    for (let team in data.upcoming) {\\r\\n        let date = new Date(data.upcoming[team].date);\\r\\n        if (data.upcoming[team].atHome) {\\r\\n            upcoming.push({\\r\\n                time: date,\\r\\n                home: team,\\r\\n                away: data.upcoming[team].nextTeam,\\r\\n            });\\r\\n        }\\r\\n    }\\r\\n    upcoming.sort((a, b) => {\\r\\n        //@ts-ignore\\r\\n        return a.time - b.time;\\r\\n    });\\r\\n    return upcoming;\\r\\n}\\r\\nfunction standingsTable() {\\r\\n    let standings = [];\\r\\n    for (let team in data.standings) {\\r\\n        let row = Object(data.standings[team][data._id]);\\r\\n        row.team = team;\\r\\n        standings.push(row);\\r\\n    }\\r\\n    standings.sort((a, b) => {\\r\\n        return a.position - b.position;\\r\\n    });\\r\\n    return standings;\\r\\n}\\r\\nfunction applyRatingFixturesScaling() {\\r\\n    if (fixturesScaling === \\\"rating\\\") {\\r\\n        return;\\r\\n    }\\r\\n    fixturesScaling = \\\"rating\\\";\\r\\n    for (let teamFixtures of fixtures) {\\r\\n        for (let match of teamFixtures.matches) {\\r\\n            let homeAdvantage = match.atHome\\r\\n                ? 0\\r\\n                : data.homeAdvantages[match.team].totalHomeAdvantage;\\r\\n            match.colour = fixtureColourSkewed(data.teamRatings[match.team].totalRating + homeAdvantage);\\r\\n        }\\r\\n    }\\r\\n    fixtures = fixtures;\\r\\n}\\r\\nfunction applyRatingFormScaling() {\\r\\n    if (fixturesScaling === \\\"form\\\") {\\r\\n        return;\\r\\n    }\\r\\n    fixturesScaling = \\\"form\\\";\\r\\n    for (let teamFixtures of fixtures) {\\r\\n        for (let match of teamFixtures.matches) {\\r\\n            let form = 0.5;\\r\\n            let matchdays = Object.keys(data.form[teamFixtures.team][data._id]).reverse();\\r\\n            let homeAdvantage = match.atHome\\r\\n                ? 0\\r\\n                : data.homeAdvantages[match.team].totalHomeAdvantage;\\r\\n            for (let matchday of matchdays) {\\r\\n                if (data.form[match.team][data._id][matchday].formRating5 != null) {\\r\\n                    form = data.form[match.team][data._id][matchday].formRating5;\\r\\n                }\\r\\n            }\\r\\n            match.colour = fixtureColour(form + homeAdvantage);\\r\\n        }\\r\\n    }\\r\\n    fixtures = fixtures;\\r\\n}\\r\\nfunction fixturesTable(standings) {\\r\\n    let fixtures = [];\\r\\n    for (let row of standings) {\\r\\n        let matches = [];\\r\\n        for (let matchday in data.fixtures[row.team]) {\\r\\n            let match = data.fixtures[row.team][matchday];\\r\\n            let homeAdvantage = match.atHome\\r\\n                ? 0\\r\\n                : data.homeAdvantages[match.team].totalHomeAdvantage;\\r\\n            matches.push({\\r\\n                team: match.team,\\r\\n                date: match.date,\\r\\n                atHome: match.atHome,\\r\\n                status: match.status,\\r\\n                colour: fixtureColourSkewed(data.teamRatings[match.team].totalRating + homeAdvantage),\\r\\n            });\\r\\n        }\\r\\n        fixtures.push({\\r\\n            team: row.team,\\r\\n            matches: matches,\\r\\n        });\\r\\n    }\\r\\n    return fixtures;\\r\\n}\\r\\nfunction fixtureColourSkewed(scaleVal) {\\r\\n    if (scaleVal < 0.05) {\\r\\n        return \\\"#00fe87\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.1) {\\r\\n        return \\\"#63fb6e\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.15) {\\r\\n        return \\\"#8df755\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.2) {\\r\\n        return \\\"#aef23e\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.25) {\\r\\n        return \\\"#cbec27\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.3) {\\r\\n        return \\\"#e6e50f\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.35) {\\r\\n        return \\\"#ffdd00\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.4) {\\r\\n        return \\\"#ffc400\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.45) {\\r\\n        return \\\"#ffab00\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.5) {\\r\\n        return \\\"#ff9000\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.55) {\\r\\n        return \\\"#ff7400\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.6) {\\r\\n        return \\\"#ff5618\\\";\\r\\n    }\\r\\n    else {\\r\\n        return \\\"#f83027\\\";\\r\\n    }\\r\\n}\\r\\nfunction fixtureColour(scaleVal) {\\r\\n    if (scaleVal < 0.2) {\\r\\n        return \\\"#00fe87\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.25) {\\r\\n        return \\\"#63fb6e\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.35) {\\r\\n        return \\\"#8df755\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.4) {\\r\\n        return \\\"#aef23e\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.45) {\\r\\n        return \\\"#cbec27\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.5) {\\r\\n        return \\\"#e6e50f\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.55) {\\r\\n        return \\\"#ffdd00\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.6) {\\r\\n        return \\\"#ffc400\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.65) {\\r\\n        return \\\"#ffab00\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.7) {\\r\\n        return \\\"#ff9000\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.75) {\\r\\n        return \\\"#ff7400\\\";\\r\\n    }\\r\\n    else if (scaleVal < 0.8) {\\r\\n        return \\\"#ff5618\\\";\\r\\n    }\\r\\n    else {\\r\\n        return \\\"#f83027\\\";\\r\\n    }\\r\\n}\\r\\nlet upcoming;\\r\\nlet standings;\\r\\nlet fixtures;\\r\\n$: fixtures;\\r\\nlet fixturesScaling = \\\"rating\\\";\\r\\nonMount(() => {\\r\\n    upcoming = upcomingMatches();\\r\\n    standings = standingsTable();\\r\\n    fixtures = fixturesTable(standings);\\r\\n});\\r\\nexport let data;\\r\\n</script>\\r\\n\\r\\n<div id=\\\"page-content\\\">\\r\\n  <div class=\\\"row\\\">\\r\\n    <div class=\\\"left\\\">\\r\\n      <div class=\\\"upcoming-matches-container\\\">\\r\\n        {#if upcoming != undefined}\\r\\n          <div class=\\\"upcoming-matches\\\">\\r\\n            <div class=\\\"upcoming-title\\\">Upcoming</div>\\r\\n            {#each upcoming as match, i}\\r\\n              {#if i === 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}\\r\\n                <div class=\\\"upcoming-match-date\\\">\\r\\n                  {match.time.toLocaleDateString(\\\"en-GB\\\", {\\r\\n                    weekday: \\\"long\\\",\\r\\n                    year: \\\"numeric\\\",\\r\\n                    month: \\\"long\\\",\\r\\n                    day: \\\"numeric\\\",\\r\\n                  })}\\r\\n                </div>\\r\\n              {/if}\\r\\n              <div class=\\\"upcoming-match\\\">\\r\\n                <div class=\\\"upcoming-match-teams\\\">\\r\\n                  <div\\r\\n                    class=\\\"upcoming-match-home\\\"\\r\\n                    style={teamStyle(match.home)}\\r\\n                  >\\r\\n                    {toInitials(match.home)}\\r\\n                  </div>\\r\\n                  <div\\r\\n                    class=\\\"upcoming-match-away\\\"\\r\\n                    style={teamStyle(match.away)}\\r\\n                  >\\r\\n                    {toInitials(match.away)}\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n              <div class=\\\"upcoming-match-time-container\\\">\\r\\n                <div class=\\\"upcoming-match-time\\\">\\r\\n                  {match.time.toLocaleTimeString(\\\"en-GB\\\", {\\r\\n                    hour: \\\"2-digit\\\",\\r\\n                    minute: \\\"2-digit\\\",\\r\\n                  })}\\r\\n                </div>\\r\\n              </div>\\r\\n            {/each}\\r\\n          </div>\\r\\n        {/if}\\r\\n      </div>\\r\\n    </div>\\r\\n    <div class=\\\"standings-container\\\">\\r\\n      {#if standings != undefined}\\r\\n        <div class=\\\"standings-table\\\">\\r\\n          <div class=\\\"standings-title\\\">Standings</div>\\r\\n          <div class=\\\"standings\\\">\\r\\n            <div class=\\\"table-row\\\">\\r\\n              <div class=\\\"standings-position\\\" />\\r\\n              <div class=\\\"standings-team-name\\\" />\\r\\n              <div class=\\\"standings-won bold\\\">W</div>\\r\\n              <div class=\\\"standings-drawn bold\\\">D</div>\\r\\n              <div class=\\\"standings-lost bold\\\">L</div>\\r\\n              <div class=\\\"standings-gf bold\\\">GF</div>\\r\\n              <div class=\\\"standings-ga bold\\\">GA</div>\\r\\n              <div class=\\\"standings-gd bold\\\">GD</div>\\r\\n              <div class=\\\"standings-played bold\\\">Played</div>\\r\\n              <div class=\\\"standings-points bold\\\">Points</div>\\r\\n              <div class=\\\"standings-rating bold\\\">Rating</div>\\r\\n              <div class=\\\"standings-form bold\\\">Form</div>\\r\\n            </div>\\r\\n            {#each standings as row, i}\\r\\n              <div\\r\\n                class=\\\"table-row {i % 2 === 0 ? 'grey-row' : ''} {i < 4\\r\\n                  ? 'cl'\\r\\n                  : ''} {i > 3 && i < 6 ? 'el' : ''} {i > 16\\r\\n                  ? 'relegation'\\r\\n                  : ''}\\\"\\r\\n              >\\r\\n                <div class=\\\"standings-position\\\">\\r\\n                  {row.position}\\r\\n                </div>\\r\\n                <div class=\\\"standings-team-name\\\">\\r\\n                  {row.team}\\r\\n                </div>\\r\\n                <div class=\\\"standings-won\\\">\\r\\n                  {row.won}\\r\\n                </div>\\r\\n                <div class=\\\"standings-drawn\\\">\\r\\n                  {row.drawn}\\r\\n                </div>\\r\\n                <div class=\\\"standings-lost\\\">\\r\\n                  {row.lost}\\r\\n                </div>\\r\\n                <div class=\\\"standings-gf\\\">\\r\\n                  {row.gF}\\r\\n                </div>\\r\\n                <div class=\\\"standings-ga\\\">\\r\\n                  {row.gA}\\r\\n                </div>\\r\\n                <div class=\\\"standings-gd\\\">\\r\\n                  {row.gD}\\r\\n                </div>\\r\\n                <div class=\\\"standings-played\\\">\\r\\n                  {row.played}\\r\\n                </div>\\r\\n                <div class=\\\"standings-points\\\">\\r\\n                  {row.points}\\r\\n                </div>\\r\\n                <div class=\\\"standings-rating\\\">\\r\\n                  {data.teamRatings[row.team].totalRating.toFixed(2)}\\r\\n                </div>\\r\\n                <div class=\\\"standings-form\\\">\\r\\n                  {Object.keys(data.form[row.team][data._id]).length > 0 &&\\r\\n                  data.form[row.team][data._id][\\r\\n                    Math.max(\\r\\n                      ...Object.keys(data.form[row.team][data._id]).map((x) =>\\r\\n                        parseInt(x)\\r\\n                      )\\r\\n                    )\\r\\n                  ] != undefined &&\\r\\n                  data.form[row.team][data._id][\\r\\n                    Math.max(\\r\\n                      ...Object.keys(data.form[row.team][data._id]).map((x) =>\\r\\n                        parseInt(x)\\r\\n                      )\\r\\n                    )\\r\\n                  ].formRating5 != null\\r\\n                    ? data.form[row.team][data._id][\\r\\n                        Math.max(\\r\\n                          ...Object.keys(data.form[row.team][data._id]).map(\\r\\n                            (x) => parseInt(x)\\r\\n                          )\\r\\n                        )\\r\\n                      ].formRating5.toFixed(2)\\r\\n                    : \\\"\\\"}\\r\\n                </div>\\r\\n              </div>\\r\\n            {/each}\\r\\n          </div>\\r\\n        </div>\\r\\n      {/if}\\r\\n    </div>\\r\\n  </div>\\r\\n  <div class=\\\"row\\\">\\r\\n    <div class=\\\"fixtures\\\">\\r\\n      <div class=\\\"fixtures-title\\\">Fixtures</div>\\r\\n      {#if fixtures != undefined}\\r\\n        <div class=\\\"scale-btns\\\">\\r\\n          <div class=\\\"scale-team-ratings\\\">\\r\\n            <button\\r\\n              id=\\\"rating-scale-btn\\\"\\r\\n              class=\\\"scale-btn {fixturesScaling === 'rating'\\r\\n                ? 'scaling-selected'\\r\\n                : ''}\\\"\\r\\n              on:click={applyRatingFixturesScaling}\\r\\n            >\\r\\n              Rating\\r\\n            </button>\\r\\n          </div>\\r\\n          <div class=\\\"scale-team-form\\\">\\r\\n            <button\\r\\n              id=\\\"form-scale-btn\\\"\\r\\n              class=\\\"scale-btn {fixturesScaling === 'form'\\r\\n                ? 'scaling-selected'\\r\\n                : ''}\\\"\\r\\n              on:click={applyRatingFormScaling}\\r\\n            >\\r\\n              Form\\r\\n            </button>\\r\\n          </div>\\r\\n        </div>\\r\\n        <div class=\\\"fixtures-table\\\">\\r\\n          <div class=\\\"fixtures-teams-container\\\">\\r\\n            {#each fixtures as row, i}\\r\\n              <div class=\\\"fixtures-table-row\\\">\\r\\n                <div\\r\\n                  class=\\\"fixtures-team\\\"\\r\\n                  style=\\\"{teamStyle(row.team)}\\r\\n                      {i === 0\\r\\n                    ? 'border-top: 2px solid black; border-radius: 4px 0 0'\\r\\n                    : ''}\\r\\n                      {i === fixtures.length - 1\\r\\n                    ? 'border-radius: 0 0 0 4px;'\\r\\n                    : ''}\\\"\\r\\n                >\\r\\n                  {toInitials(row.team)}\\r\\n                </div>\\r\\n              </div>\\r\\n            {/each}\\r\\n          </div>\\r\\n          <div class=\\\"fixtures-matches-container\\\">\\r\\n            <div class=\\\"fixtures-table-row\\\">\\r\\n              <div class=\\\"fixtures-matches\\\">\\r\\n                {#each Array(38) as _, i}\\r\\n                  <div class=\\\"match\\\">{i + 1}</div>\\r\\n                {/each}\\r\\n              </div>\\r\\n            </div>\\r\\n            {#each fixtures as row, _}\\r\\n              <div class=\\\"fixtures-table-row\\\">\\r\\n                <div class=\\\"fixtures-matches\\\">\\r\\n                  {#each row.matches as match, i}\\r\\n                    <div\\r\\n                      class=\\\"match\\\"\\r\\n                      style=\\\"background: {match.colour}; {match.status ==\\r\\n                      'FINISHED'\\r\\n                        ? 'filter: grayscale(100%)'\\r\\n                        : ''} {i === row.matches.length - 1\\r\\n                        ? 'border-right: 2px solid black'\\r\\n                        : ''}\\\"\\r\\n                      title={match.date}\\r\\n                    >\\r\\n                      {`${toInitials(match.team)} (${\\r\\n                        match.atHome ? \\\"H\\\" : \\\"A\\\"\\r\\n                      }`})\\r\\n                    </div>\\r\\n                  {/each}\\r\\n                </div>\\r\\n              </div>\\r\\n            {/each}\\r\\n          </div>\\r\\n        </div>\\r\\n      {/if}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  #page-content {\\r\\n    margin-top: 3em;\\r\\n    position: relative;\\r\\n  }\\r\\n  .row {\\r\\n    display: flex;\\r\\n    margin-bottom: 2em;\\r\\n  }\\r\\n  .left {\\r\\n    width: min(40%, 500px);\\r\\n  }\\r\\n  .upcoming-matches {\\r\\n    position: relative;\\r\\n    margin-left: 40px;\\r\\n  }\\r\\n  .upcoming-match {\\r\\n    display: flex;\\r\\n    margin-bottom: 8px;\\r\\n  }\\r\\n  .upcoming-match-date {\\r\\n    text-align: center;\\r\\n    margin: 0.9em 0 0.4em 0;\\r\\n  }\\r\\n  .fixtures-title,\\r\\n  .standings-title,\\r\\n  .upcoming-title {\\r\\n    font-size: 2em;\\r\\n    font-weight: 800;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .upcoming-match-time-container {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    position: absolute;\\r\\n    margin-top: -31px;\\r\\n    width: 100%;\\r\\n  }\\r\\n  .upcoming-match-time {\\r\\n    background: #ffffffa1;\\r\\n    padding: 1px 4px;\\r\\n    border-radius: 2px;\\r\\n    font-size: 13px;\\r\\n    text-align: right;\\r\\n  }\\r\\n  .upcoming-match-teams {\\r\\n    display: flex;\\r\\n    flex-grow: 1;\\r\\n  }\\r\\n  .upcoming-match-home,\\r\\n  .upcoming-match-away {\\r\\n    flex: 1;\\r\\n    padding: 4px 10px;\\r\\n  }\\r\\n  .upcoming-match-home {\\r\\n    border-radius: 4px 0 0 4px;\\r\\n  }\\r\\n  .upcoming-match-away {\\r\\n    text-align: right;\\r\\n    border-radius: 0 4px 4px 0;\\r\\n  }\\r\\n  .standings-container {\\r\\n    flex-grow: 1;\\r\\n    margin: 0 40px 0 40px;\\r\\n  }\\r\\n  .standings {\\r\\n    margin: 10px auto 0;\\r\\n  }\\r\\n  .table-row {\\r\\n    display: flex;\\r\\n    padding: 4px 20px 4px 10px;\\r\\n    border-radius: 4px;\\r\\n  }\\r\\n  .standings-position {\\r\\n    width: 20px;\\r\\n    margin-right: 15px;\\r\\n    text-align: right;\\r\\n  }\\r\\n  .standings-team-name {\\r\\n    width: 210px;\\r\\n  }\\r\\n  .bold {\\r\\n    font-weight: 800;\\r\\n  }\\r\\n  .standings-won,\\r\\n  .standings-drawn,\\r\\n  .standings-lost {\\r\\n    flex: 1;\\r\\n    text-align: right;\\r\\n  }\\r\\n  .standings-gf,\\r\\n  .standings-ga,\\r\\n  .standings-gd {\\r\\n    flex: 1;\\r\\n    text-align: right;\\r\\n  }\\r\\n  .standings-rating,\\r\\n  .standings-form,\\r\\n  .standings-played,\\r\\n  .standings-points {\\r\\n    flex: 1;\\r\\n    text-align: right;\\r\\n  }\\r\\n  .standings-points {\\r\\n    margin-right: 10%;\\r\\n  }\\r\\n  .grey-row {\\r\\n    background: rgb(236, 236, 236);\\r\\n  }\\r\\n  .cl {\\r\\n    background: rgba(0, 254, 135, 0.6);\\r\\n  }\\r\\n  .cl.grey-row {\\r\\n    background: rgb(0, 254, 135, 1);\\r\\n  }\\r\\n  .el {\\r\\n    background: rgba(17, 182, 208, 0.7);\\r\\n    background: rgba(2, 238, 255, 0.6);\\r\\n  }\\r\\n  .el.grey-row {\\r\\n    background: rgba(17, 182, 208, 1);\\r\\n    background: #02eeff;\\r\\n  }\\r\\n  .relegation {\\r\\n    background: rgba(248, 48, 39, 0.7);\\r\\n  }\\r\\n  .relegation.grey-row {\\r\\n    background: rgb(248, 48, 39, 1);\\r\\n  }\\r\\n  .fixtures {\\r\\n    position: relative;\\r\\n    width: calc(100vw - 230px);\\r\\n  }\\r\\n  .fixtures-table {\\r\\n    display: flex;\\r\\n    margin: 20px 30px 0 30px;\\r\\n  }\\r\\n  .fixtures-matches-container {\\r\\n    overflow-x: scroll;\\r\\n    display: block;\\r\\n  }\\r\\n  .fixtures-teams-container {\\r\\n    margin-top: 25px;\\r\\n  }\\r\\n  .fixtures-table-row {\\r\\n    display: flex;\\r\\n  }\\r\\n  .fixtures-team {\\r\\n    min-width: 60px;\\r\\n    text-align: center;\\r\\n    border-right: 2px solid black;\\r\\n    border-left: 2px solid black;\\r\\n  }\\r\\n  .fixtures-matches {\\r\\n    display: flex;\\r\\n  }\\r\\n  .fixtures-team,\\r\\n  .match {\\r\\n    padding: 3px 8px;\\r\\n  }\\r\\n  .match {\\r\\n    text-align: center;\\r\\n    width: 60px;\\r\\n    border-bottom: 2px solid black;\\r\\n  }\\r\\n  .fixtures-team {\\r\\n    border-bottom: 2px solid black;\\r\\n  }\\r\\n  .scale-btns {\\r\\n    position: absolute;\\r\\n    top: 6px;\\r\\n    right: 30px;\\r\\n    display: flex;\\r\\n  }\\r\\n  .scale-team-ratings,\\r\\n  .scale-team-form {\\r\\n    padding: 5px 0;\\r\\n  }\\r\\n  .scale-team-ratings {\\r\\n    padding-right: 10px;\\r\\n  }\\r\\n  .scaling-selected {\\r\\n    background: var(--purple);\\r\\n    color: var(--green);\\r\\n  }\\r\\n  .scale-btn {\\r\\n    border-radius: 4px;\\r\\n    cursor: pointer;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1200px) {\\r\\n    .fixtures {\\r\\n      width: 100vw;\\r\\n    }\\r\\n    .standings-points {\\r\\n      margin: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

function fixtureColourSkewed(scaleVal) {
	if (scaleVal < 0.05) {
		return "#00fe87";
	} else if (scaleVal < 0.1) {
		return "#63fb6e";
	} else if (scaleVal < 0.15) {
		return "#8df755";
	} else if (scaleVal < 0.2) {
		return "#aef23e";
	} else if (scaleVal < 0.25) {
		return "#cbec27";
	} else if (scaleVal < 0.3) {
		return "#e6e50f";
	} else if (scaleVal < 0.35) {
		return "#ffdd00";
	} else if (scaleVal < 0.4) {
		return "#ffc400";
	} else if (scaleVal < 0.45) {
		return "#ffab00";
	} else if (scaleVal < 0.5) {
		return "#ff9000";
	} else if (scaleVal < 0.55) {
		return "#ff7400";
	} else if (scaleVal < 0.6) {
		return "#ff5618";
	} else {
		return "#f83027";
	}
}

const Overview = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function upcomingMatches() {
		let upcoming = [];

		for (let team in data.upcoming) {
			let date = new Date(data.upcoming[team].date);

			if (data.upcoming[team].atHome) {
				upcoming.push({
					time: date,
					home: team,
					away: data.upcoming[team].nextTeam
				});
			}
		}

		upcoming.sort((a, b) => {
			//@ts-ignore
			return a.time - b.time;
		});

		return upcoming;
	}

	function standingsTable() {
		let standings = [];

		for (let team in data.standings) {
			let row = Object(data.standings[team][data._id]);
			row.team = team;
			standings.push(row);
		}

		standings.sort((a, b) => {
			return a.position - b.position;
		});

		return standings;
	}

	function fixturesTable(standings) {
		let fixtures = [];

		for (let row of standings) {
			let matches = [];

			for (let matchday in data.fixtures[row.team]) {
				let match = data.fixtures[row.team][matchday];

				let homeAdvantage = match.atHome
				? 0
				: data.homeAdvantages[match.team].totalHomeAdvantage;

				matches.push({
					team: match.team,
					date: match.date,
					atHome: match.atHome,
					status: match.status,
					colour: fixtureColourSkewed(data.teamRatings[match.team].totalRating + homeAdvantage)
				});
			}

			fixtures.push({ team: row.team, matches });
		}

		return fixtures;
	}

	let upcoming;
	let standings;
	let fixtures;

	onMount(() => {
		upcoming = upcomingMatches();
		standings = standingsTable();
		fixtures = fixturesTable(standings);
	});

	let { data } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	$$result.css.add(css$9);

	return `<div id="page-content" class="svelte-1gtw5nu"><div class="row svelte-1gtw5nu"><div class="left svelte-1gtw5nu"><div class="upcoming-matches-container">${upcoming != undefined
	? `<div class="upcoming-matches svelte-1gtw5nu"><div class="upcoming-title svelte-1gtw5nu">Upcoming</div>
            ${each(upcoming, (match, i) => {
			return `${i === 0 || match.time.getDate() != upcoming[i - 1].time.getDate()
			? `<div class="upcoming-match-date svelte-1gtw5nu">${escape(match.time.toLocaleDateString("en-GB", {
					weekday: "long",
					year: "numeric",
					month: "long",
					day: "numeric"
				}))}
                </div>`
			: ``}
              <div class="upcoming-match svelte-1gtw5nu"><div class="upcoming-match-teams svelte-1gtw5nu"><div class="upcoming-match-home svelte-1gtw5nu"${add_attribute("style", teamStyle(match.home), 0)}>${escape(toInitials(match.home))}</div>
                  <div class="upcoming-match-away svelte-1gtw5nu"${add_attribute("style", teamStyle(match.away), 0)}>${escape(toInitials(match.away))}</div>
                </div></div>
              <div class="upcoming-match-time-container svelte-1gtw5nu"><div class="upcoming-match-time svelte-1gtw5nu">${escape(match.time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))}</div>
              </div>`;
		})}</div>`
	: ``}</div></div>
    <div class="standings-container svelte-1gtw5nu">${standings != undefined
	? `<div class="standings-table"><div class="standings-title svelte-1gtw5nu">Standings</div>
          <div class="standings svelte-1gtw5nu"><div class="table-row svelte-1gtw5nu"><div class="standings-position svelte-1gtw5nu"></div>
              <div class="standings-team-name svelte-1gtw5nu"></div>
              <div class="standings-won bold svelte-1gtw5nu">W</div>
              <div class="standings-drawn bold svelte-1gtw5nu">D</div>
              <div class="standings-lost bold svelte-1gtw5nu">L</div>
              <div class="standings-gf bold svelte-1gtw5nu">GF</div>
              <div class="standings-ga bold svelte-1gtw5nu">GA</div>
              <div class="standings-gd bold svelte-1gtw5nu">GD</div>
              <div class="standings-played bold svelte-1gtw5nu">Played</div>
              <div class="standings-points bold svelte-1gtw5nu">Points</div>
              <div class="standings-rating bold svelte-1gtw5nu">Rating</div>
              <div class="standings-form bold svelte-1gtw5nu">Form</div></div>
            ${each(standings, (row, i) => {
			return `<div class="${"table-row " + escape(i % 2 === 0 ? 'grey-row' : '', true) + " " + escape(i < 4 ? 'cl' : '', true) + " " + escape(i > 3 && i < 6 ? 'el' : '', true) + " " + escape(i > 16 ? 'relegation' : '', true) + " svelte-1gtw5nu"}"><div class="standings-position svelte-1gtw5nu">${escape(row.position)}</div>
                <div class="standings-team-name svelte-1gtw5nu">${escape(row.team)}</div>
                <div class="standings-won svelte-1gtw5nu">${escape(row.won)}</div>
                <div class="standings-drawn svelte-1gtw5nu">${escape(row.drawn)}</div>
                <div class="standings-lost svelte-1gtw5nu">${escape(row.lost)}</div>
                <div class="standings-gf svelte-1gtw5nu">${escape(row.gF)}</div>
                <div class="standings-ga svelte-1gtw5nu">${escape(row.gA)}</div>
                <div class="standings-gd svelte-1gtw5nu">${escape(row.gD)}</div>
                <div class="standings-played svelte-1gtw5nu">${escape(row.played)}</div>
                <div class="standings-points svelte-1gtw5nu">${escape(row.points)}</div>
                <div class="standings-rating svelte-1gtw5nu">${escape(data.teamRatings[row.team].totalRating.toFixed(2))}</div>
                <div class="standings-form svelte-1gtw5nu">${escape(Object.keys(data.form[row.team][data._id]).length > 0 && data.form[row.team][data._id][Math.max(...Object.keys(data.form[row.team][data._id]).map(x => parseInt(x)))] != undefined && data.form[row.team][data._id][Math.max(...Object.keys(data.form[row.team][data._id]).map(x => parseInt(x)))].formRating5 != null
			? data.form[row.team][data._id][Math.max(...Object.keys(data.form[row.team][data._id]).map(x => parseInt(x)))].formRating5.toFixed(2)
			: "")}</div>
              </div>`;
		})}</div></div>`
	: ``}</div></div>
  <div class="row svelte-1gtw5nu"><div class="fixtures svelte-1gtw5nu"><div class="fixtures-title svelte-1gtw5nu">Fixtures</div>
      ${fixtures != undefined
	? `<div class="scale-btns svelte-1gtw5nu"><div class="scale-team-ratings svelte-1gtw5nu"><button id="rating-scale-btn" class="${"scale-btn " + escape('scaling-selected' , true) + " svelte-1gtw5nu"}">Rating
            </button></div>
          <div class="scale-team-form svelte-1gtw5nu"><button id="form-scale-btn" class="${"scale-btn " + escape('', true) + " svelte-1gtw5nu"}">Form
            </button></div></div>
        <div class="fixtures-table svelte-1gtw5nu"><div class="fixtures-teams-container svelte-1gtw5nu">${each(fixtures, (row, i) => {
			return `<div class="fixtures-table-row svelte-1gtw5nu"><div class="fixtures-team svelte-1gtw5nu" style="${escape(teamStyle(row.team), true) + " " + escape(
				i === 0
				? 'border-top: 2px solid black; border-radius: 4px 0 0'
				: '',
				true
			) + " " + escape(
				i === fixtures.length - 1
				? 'border-radius: 0 0 0 4px;'
				: '',
				true
			)}">${escape(toInitials(row.team))}</div>
              </div>`;
		})}</div>
          <div class="fixtures-matches-container svelte-1gtw5nu"><div class="fixtures-table-row svelte-1gtw5nu"><div class="fixtures-matches svelte-1gtw5nu">${each(Array(38), (_, i) => {
			return `<div class="match svelte-1gtw5nu">${escape(i + 1)}</div>`;
		})}</div></div>
            ${each(fixtures, (row, _) => {
			return `<div class="fixtures-table-row svelte-1gtw5nu"><div class="fixtures-matches svelte-1gtw5nu">${each(row.matches, (match, i) => {
				return `<div class="match svelte-1gtw5nu" style="${"background: " + escape(match.colour, true) + "; " + escape(
					match.status == 'FINISHED'
					? 'filter: grayscale(100%)'
					: '',
					true
				) + " " + escape(
					i === row.matches.length - 1
					? 'border-right: 2px solid black'
					: '',
					true
				)}"${add_attribute("title", match.date, 0)}>${escape(`${toInitials(match.team)} (${match.atHome ? "H" : "A"}`)})
                    </div>`;
			})}</div>
              </div>`;
		})}</div></div>`
	: ``}</div></div>
</div>`;
});

/* src\components\nav\MobileNav.svelte generated by Svelte v3.59.2 */

const css$8 = {
	code: "#mobileNav.svelte-19ywf0{position:fixed;z-index:2;overflow:hidden;height:100vh;animation:svelte-19ywf0-appear 0.1s ease-in 1;display:none}.team-links.svelte-19ywf0{display:flex;flex-direction:column;height:100%}.team-link.svelte-19ywf0{color:inherit;background:inherit;cursor:pointer;border:none;font-size:1em;padding:0.4em;flex:1}@keyframes svelte-19ywf0-appear{from{width:0%}to{width:100%}}",
	map: "{\"version\":3,\"file\":\"MobileNav.svelte\",\"sources\":[\"MobileNav.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { toHyphenatedName } from \\\"../../lib/team\\\";\\r\\nfunction switchTeamToTop(team) {\\r\\n    switchTeam(team);\\r\\n    window.scrollTo(0, 0);\\r\\n    toggleMobileNav();\\r\\n}\\r\\nfunction getHyphenatedTeamNames() {\\r\\n    let hyphenatedTeamNames = [];\\r\\n    for (let i = 0; i < teams.length; i++) {\\r\\n        let teamLink = toHyphenatedName(teams[i]);\\r\\n        if (teamLink != hyphenatedTeam) {\\r\\n            hyphenatedTeamNames.push(teamLink);\\r\\n        }\\r\\n        else {\\r\\n            hyphenatedTeamNames.push(null); // To keep teams and teamLinks list same length\\r\\n        }\\r\\n    }\\r\\n    hyphenatedTeams = hyphenatedTeamNames;\\r\\n}\\r\\nlet hyphenatedTeams;\\r\\n//@ts-ignore\\r\\n$: hyphenatedTeam && teams.length > 0 && getHyphenatedTeamNames();\\r\\nexport let hyphenatedTeam, teams, toAlias, switchTeam, toggleMobileNav;\\r\\n</script>\\r\\n\\r\\n<nav id=\\\"mobileNav\\\" style=\\\"width: 0%;\\\">\\r\\n  {#if hyphenatedTeams != undefined}\\r\\n    <div class=\\\"team-links\\\">\\r\\n      {#each hyphenatedTeams as team, i}\\r\\n        {#if team != null}\\r\\n          {#if i === 0 || (i === 1 && hyphenatedTeams[0] === null)}\\r\\n            <!-- Button with first-team class -->\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(hyphenatedTeams[i]);\\r\\n              }}\\r\\n              style=\\\"color: var(--{hyphenatedTeams[i]}-secondary);\\r\\n            background-color: var(--{hyphenatedTeams[i]})\\\"\\r\\n              class=\\\"team-link first-team\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {:else if i === hyphenatedTeams.length - 1 || (i === hyphenatedTeams.length - 2 && hyphenatedTeams[hyphenatedTeams.length - 1] === null)}\\r\\n            <!-- Button with last-team class -->\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(hyphenatedTeams[i]);\\r\\n              }}\\r\\n              style=\\\"color: var(--{hyphenatedTeams[i]}-secondary);\\r\\n                background-color: var(--{hyphenatedTeams[i]})\\\"\\r\\n              class=\\\"team-link last-team\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {:else}\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(team);\\r\\n              }}\\r\\n              style=\\\"color: var(--{team}-secondary);\\r\\n                  background-color: var(--{team})\\\"\\r\\n              class=\\\"team-link\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {/if}\\r\\n        {/if}\\r\\n      {/each}\\r\\n    </div>\\r\\n  {/if}\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  #mobileNav {\\r\\n    position: fixed;\\r\\n    z-index: 2;\\r\\n    overflow: hidden;\\r\\n    height: 100vh;\\r\\n    animation: appear 0.1s ease-in 1;\\r\\n    display: none;\\r\\n  }\\r\\n  .team-links {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    height: 100%;\\r\\n  }\\r\\n  .team-link {\\r\\n    color: inherit;\\r\\n    background: inherit;\\r\\n    cursor: pointer;\\r\\n    border: none;\\r\\n    font-size: 1em;\\r\\n    padding: 0.4em;\\r\\n    flex: 1;\\r\\n  }\\r\\n  @keyframes appear {\\r\\n    from {\\r\\n      width: 0%;\\r\\n    }\\r\\n    to {\\r\\n      width: 100%;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAmEE,wBAAW,CACT,QAAQ,CAAE,KAAK,CACf,OAAO,CAAE,CAAC,CACV,QAAQ,CAAE,MAAM,CAChB,MAAM,CAAE,KAAK,CACb,SAAS,CAAE,oBAAM,CAAC,IAAI,CAAC,OAAO,CAAC,CAAC,CAChC,OAAO,CAAE,IACX,CACA,yBAAY,CACV,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,IACV,CACA,wBAAW,CACT,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,OAAO,CACnB,MAAM,CAAE,OAAO,CACf,MAAM,CAAE,IAAI,CACZ,SAAS,CAAE,GAAG,CACd,OAAO,CAAE,KAAK,CACd,IAAI,CAAE,CACR,CACA,WAAW,oBAAO,CAChB,IAAK,CACH,KAAK,CAAE,EACT,CACA,EAAG,CACD,KAAK,CAAE,IACT,CACF\"}"
};

const MobileNav = create_ssr_component(($$result, $$props, $$bindings, slots) => {

	function getHyphenatedTeamNames() {
		let hyphenatedTeamNames = [];

		for (let i = 0; i < teams.length; i++) {
			let teamLink = toHyphenatedName(teams[i]);

			if (teamLink != hyphenatedTeam) {
				hyphenatedTeamNames.push(teamLink);
			} else {
				hyphenatedTeamNames.push(null); // To keep teams and teamLinks list same length
			}
		}

		hyphenatedTeams = hyphenatedTeamNames;
	}

	let hyphenatedTeams;
	let { hyphenatedTeam, teams, toAlias, switchTeam, toggleMobileNav } = $$props;
	if ($$props.hyphenatedTeam === void 0 && $$bindings.hyphenatedTeam && hyphenatedTeam !== void 0) $$bindings.hyphenatedTeam(hyphenatedTeam);
	if ($$props.teams === void 0 && $$bindings.teams && teams !== void 0) $$bindings.teams(teams);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	if ($$props.toggleMobileNav === void 0 && $$bindings.toggleMobileNav && toggleMobileNav !== void 0) $$bindings.toggleMobileNav(toggleMobileNav);
	$$result.css.add(css$8);
	hyphenatedTeam && teams.length > 0 && getHyphenatedTeamNames();

	return `<nav id="mobileNav" style="width: 0%;" class="svelte-19ywf0">${hyphenatedTeams != undefined
	? `<div class="team-links svelte-19ywf0">${each(hyphenatedTeams, (team, i) => {
			return `${team != null
			? `${i === 0 || i === 1 && hyphenatedTeams[0] === null
				? `
            <button style="${"color: var(--" + escape(hyphenatedTeams[i], true) + "-secondary); background-color: var(--" + escape(hyphenatedTeams[i], true) + ")"}" class="team-link first-team svelte-19ywf0">${escape(toAlias(teams[i]))}</button>`
				: `${i === hyphenatedTeams.length - 1 || i === hyphenatedTeams.length - 2 && hyphenatedTeams[hyphenatedTeams.length - 1] === null
					? `
            <button style="${"color: var(--" + escape(hyphenatedTeams[i], true) + "-secondary); background-color: var(--" + escape(hyphenatedTeams[i], true) + ")"}" class="team-link last-team svelte-19ywf0">${escape(toAlias(teams[i]))}</button>`
					: `<button style="${"color: var(--" + escape(team, true) + "-secondary); background-color: var(--" + escape(team, true) + ")"}" class="team-link svelte-19ywf0">${escape(toAlias(teams[i]))}</button>`}`}`
			: ``}`;
		})}</div>`
	: ``}
</nav>`;
});

/* src\components\team\goals_scored_and_conceded\ScoredConcededOverTimeGraph.svelte generated by Svelte v3.59.2 */

function seasonFinishLines(seasonBoundaries, maxX, maxY) {
	let lines = [];

	for (let i = 0; i < seasonBoundaries.length; i++) {
		if (seasonBoundaries[i] < maxX) {
			lines.push({
				type: "line",
				x0: seasonBoundaries[i],
				y0: 0,
				x1: seasonBoundaries[i],
				y1: maxY,
				line: { color: "black", dash: "dot", width: 1 }
			});
		}
	}

	return lines;
}

function goalsScoredLine(x, y, dates) {
	return {
		x,
		y,
		type: "scatter",
		fill: "tozeroy",
		mode: "lines",
		name: "Scored",
		text: dates,
		line: { color: "#00fe87" },
		hovertemplate: "%{text|%d %b %Y}<br>Avg scored: <b>%{y:.1f}</b><extra></extra>"
	};
}

function goalsConcededLine(x, y, dates) {
	return {
		x,
		y,
		type: "scatter",
		fill: "tozeroy",
		mode: "lines",
		name: "Conceded",
		text: dates,
		line: { color: "#f83027" },
		hovertemplate: "%{text|%d %b %Y}<br>Avg conceded: <b>%{y:.1f}</b><extra></extra>"
	};
}

function numDays(start, end) {
	const date1 = new Date(start);
	const date2 = new Date(end);

	// One day in milliseconds
	const oneDay = 1000 * 60 * 60 * 24;

	// Calculating the time difference between two dates
	const diffInTime = date1.getTime() - date2.getTime();

	// Calculating the no. of days between two dates
	const diffInDays = Math.round(diffInTime / oneDay);

	return diffInDays;
}

function goalsOverTime(data, team, numSeasons) {
	let goals = [];
	let startingDate = data.form[team][data._id - numSeasons][1].date;
	let dateOffset = 0;

	for (let i = numSeasons - 1; i >= 0; i--) {
		let teamGames = data.form[team][data._id - i];

		for (let matchday of Object.keys(teamGames)) {
			let match = teamGames[matchday];

			if (match.score != null) {
				let scored, conceded;

				if (match.atHome) {
					scored = match.score.homeGoals;
					conceded = match.score.awayGoals;
				} else {
					scored = match.score.awayGoals;
					conceded = match.score.homeGoals;
				}

				goals.push({
					date: match.date,
					// @ts-ignore
					days: numDays(match.date, startingDate) - dateOffset,
					matchday,
					scored,
					conceded
				});
			}
		}

		// If not current season...
		if (i > 0) {
			// To remove summer gap between seasons, increase dateOffset by number
			// of days between current season end and next season start
			let currentSeasonEndDate = data.form[team][data._id - i][38].date;

			let nextSeasonStartDate = data.form[team][data._id - i + 1][1].date;

			// @ts-ignore
			dateOffset += numDays(nextSeasonStartDate, currentSeasonEndDate);

			dateOffset -= 14; // Allow a 2 week gap between seasons for clarity
		}
	}

	return goals;
}

function lineData(data, team) {
	let numSeasons = 3;
	let goals = goalsOverTime(data, team, numSeasons);

	// Sort by game date
	goals.sort(function (a, b) {
		return a.days < b.days ? -1 : a.days === b.days ? 0 : 1;
	});

	// Separate out into lists
	let dates = [];

	let days = [];
	let seasonBoundaries = [];
	let ticktext = [];
	let tickvals = [];
	let scored = [];
	let conceded = [];

	for (let i = 0; i < goals.length; i++) {
		dates.push(goals[i].date);
		days.push(goals[i].days);

		if (i % 38 === 37) {
			// Season boundary line a week after season finish
			seasonBoundaries.push(goals[i].days + 7);

			ticktext.push((i % 38 + 1).toString());
			tickvals.push(goals[i].days);
		} else if (i % 38 === 0) {
			ticktext.push((i % 38 + 1).toString());
			tickvals.push(goals[i].days);
		} else if (i % 38 === 19 || i === goals.length - 1) {
			let season = data._id - numSeasons + 1 + Math.floor(i / 38);

			// If in current season and matchday is 19, wait for until reach final
			// matchday in current season instead to place season ticktext label
			if (season != data._id || goals[i].matchday != "19") {
				let seasonTag = `${String(season).slice(2)}/${String(season + 1).slice(2)}`;
				ticktext.push(seasonTag);
				tickvals.push(goals[i].days);
			}
		}

		scored.push(goals[i].scored);
		conceded.push(goals[i].conceded);
	}

	let nGames = 5;

	// Smooth goals with last nGames average
	for (let i = 0; i < dates.length; i++) {
		let j = i - 1;
		let count = 1;

		while (j > i - nGames && j >= 0) {
			scored[i] += scored[j];
			conceded[i] += conceded[j];
			count += 1;
			j -= 1;
		}

		if (count > 1) {
			scored[i] /= count;
			conceded[i] /= count;
		}
	}

	return [dates, days, seasonBoundaries, ticktext, tickvals, scored, conceded];
}

function lines$1(days, scored, conceded, dates) {
	return [goalsScoredLine(days, scored, dates), goalsConcededLine(days, conceded, dates)];
}

function defaultLayout$1(ticktext, tickvals, seasonLines) {
	return {
		title: false,
		autosize: true,
		margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
		hovermode: "closest",
		plot_bgcolor: "#fafafa",
		paper_bgcolor: "#fafafa",
		yaxis: {
			title: { text: "Goals (5-game avg)" },
			gridcolor: "gray",
			showgrid: false,
			showline: false,
			zeroline: false,
			fixedrange: true
		},
		xaxis: {
			linecolor: "black",
			showgrid: false,
			showline: false,
			fixedrange: true,
			tickmode: "array",
			tickvals,
			ticktext
		},
		dragmode: false,
		shapes: [...seasonLines],
		legend: { x: 1, xanchor: "right", y: 0.95 }
	};
}

function buildPlotData$1(data, team) {
	let [dates, days, seasonBoundaries, ticktext, tickvals, scored, conceded] = lineData(data, team);
	let maxY = Math.max(Math.max(...scored), Math.max(...conceded));
	let seasonLines = seasonFinishLines(seasonBoundaries, days[days.length - 1], maxY);

	let plotData = {
		data: [...lines$1(days, scored, conceded, dates)],
		layout: defaultLayout$1(ticktext, tickvals, seasonLines),
		config: {
			responsive: true,
			showSendToCloud: false,
			displayModeBar: false
		}
	};

	return plotData;
}

const ScoredConcededOverTimeGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function setDefaultLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": { text: "Goals (5-game avg)" },
				"yaxis.visible": true,
				"margin.l": 60,
				"margin.t": 15
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	function setMobileLayout() {
		if (setup) {
			let layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"margin.l": 20,
				"margin.t": 5
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate);
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData$1(data, team);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			let newPlotData = buildPlotData$1(data, team);

			// Copy new values into exisitng plotData to be accessed during redraw
			plotData.data[0] = newPlotData.data[0]; // Copy goals scored line

			plotData.data[1] = newPlotData.data[1]; // Copy goals conceded line
			plotData.layout.shapes = newPlotData.layout.shapes;
			plotData.layout.xaxis.ticktext = newPlotData.layout.xaxis.ticktext;
			plotData.layout.xaxis.tickvals = newPlotData.layout.xaxis.tickvals;

			//@ts-ignore
			Plotly.redraw(plotDiv); // Update plot data

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, team, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

const url = "https://pldashboard-backend.vercel.app/api";

/* src\routes\Dashboard.svelte generated by Svelte v3.59.2 */

const css$7 = {
	code: ".header.svelte-1y2ntyl{display:grid;place-items:center}.main-link.svelte-1y2ntyl{width:fit-content;display:grid;place-items:center}.title.svelte-1y2ntyl{font-size:2.3rem;width:fit-content}.lowered.svelte-1y2ntyl{margin-bottom:-9px}.page-content.svelte-1y2ntyl{position:relative}#team.svelte-1y2ntyl{display:flex;overflow-x:hidden;font-size:15px}.position-no-badge.svelte-1y2ntyl{padding-left:0;margin:0;height:500px}.position-central.svelte-1y2ntyl{text-shadow:9px 9px #000;font-weight:800;font-size:430px;user-select:none;max-width:500px}.position-central.svelte-1y2ntyl{text-align:center;margin-top:0.1em;max-height:500px;margin-left:0.05em;font-size:20vw;color:#333}.circles-background-container.svelte-1y2ntyl{position:absolute;align-self:center;width:500px;z-index:-10}.circles-background.svelte-1y2ntyl{height:500px;width:500px;transform:scale(0.95)}#dashboard.svelte-1y2ntyl{margin-left:220px;width:100%}.fixtures-graph.svelte-1y2ntyl{display:flex;flex-direction:column}.clean-sheets.svelte-1y2ntyl{height:60px}.no-bottom-margin.svelte-1y2ntyl{margin-bottom:0 !important}.small-bottom-margin.svelte-1y2ntyl{margin-bottom:1.5rem !important}.page-content.svelte-1y2ntyl{display:flex;flex-direction:column;text-align:center}.row.svelte-1y2ntyl{position:relative;display:flex;margin-bottom:3rem;height:auto}.row-graph.svelte-1y2ntyl{width:100%}.score-freq.svelte-1y2ntyl{margin:0 8% 0 8%}.row-left.svelte-1y2ntyl{display:flex;flex-direction:column;padding-right:auto;margin-right:1.5em;text-justify:center;flex:4}.row-right.svelte-1y2ntyl{flex:10}.multi-element-row.svelte-1y2ntyl{margin:0 1.4em 3rem}.spider-chart-row.svelte-1y2ntyl{display:grid;place-items:center}.spider-chart-container.svelte-1y2ntyl{margin:1em auto auto;display:flex}#mobileNavBtn.svelte-1y2ntyl{position:fixed;color:white;background:var(--purple);padding:0.8em 0;cursor:pointer;font-size:1.1em;z-index:1;width:100%;bottom:0;border:none;margin-bottom:-1px}@media only screen and (min-width: 2400px){.position-central.svelte-1y2ntyl{font-size:16vw}}@media only screen and (min-width: 2200px){.position-central.svelte-1y2ntyl{font-size:18vw}}@media only screen and (min-width: 2000px){.position-central.svelte-1y2ntyl{font-size:20vw}}@media only screen and (max-width: 1800px){.circles-background.svelte-1y2ntyl{transform:scale(0.9)}.position-central.svelte-1y2ntyl{font-size:20vw;margin-top:0.2em}}@media only screen and (max-width: 1600px){.row-left.svelte-1y2ntyl{flex:5}.circles-background.svelte-1y2ntyl{transform:scale(0.85)}}@media only screen and (max-width: 1500px){.circles-background.svelte-1y2ntyl{transform:scale(0.8)}.position-central.svelte-1y2ntyl{font-size:22vw}}@media only screen and (max-width: 1400px){.circles-background.svelte-1y2ntyl{transform:scale(0.75)}.position-central.svelte-1y2ntyl{margin-top:0.25em}}@media only screen and (min-width: 1200px){#mobileNavBtn.svelte-1y2ntyl{display:none}}@media only screen and (max-width: 1200px){.position-central.svelte-1y2ntyl{margin-top:0.3em}.circles-background.svelte-1y2ntyl{transform:scale(0.7)}#dashboard.svelte-1y2ntyl{margin-left:0}.position-central.svelte-1y2ntyl{font-size:24vw}}@media only screen and (min-width: 1100px){.form-details.svelte-1y2ntyl{width:80%;align-items:center}}@media only screen and (max-width: 1000px){.row.svelte-1y2ntyl{flex-direction:column;margin-bottom:40px}.row-graph.svelte-1y2ntyl{width:auto}.score-freq.svelte-1y2ntyl{margin:0 0 10px}.multi-element-row.svelte-1y2ntyl{margin:0}.row-left.svelte-1y2ntyl{margin-right:0;align-self:center;width:80%}.position-no-badge.svelte-1y2ntyl{height:400px;width:500px}.position-central.svelte-1y2ntyl{margin:auto}.circles-background.svelte-1y2ntyl{transform:scale(0.48);margin-top:-100px}.position-central.svelte-1y2ntyl,.circles-background-container.svelte-1y2ntyl{align-self:center}.spider-chart-container.svelte-1y2ntyl{flex-direction:column;width:100%}.full-row-graph.svelte-1y2ntyl{margin:0}}@media only screen and (max-width: 900px){.circles-background.svelte-1y2ntyl{transform:scale(0.45);margin-top:-120px}.position-central.svelte-1y2ntyl{font-size:25vw}}@media only screen and (max-width: 700px){.circles-background.svelte-1y2ntyl{transform:scale(0.55);margin-top:-5em}.position-no-badge.svelte-1y2ntyl{height:330px}.position-central.svelte-1y2ntyl{font-size:250px;margin:35px 0 0 0}}@media only screen and (max-width: 800px){.circles-background.svelte-1y2ntyl{transform:scale(0.4);margin-top:-9em}.position-central.svelte-1y2ntyl{font-size:13em}.season-stats-row.svelte-1y2ntyl{margin:1em}.row-graph.svelte-1y2ntyl{margin:0}}@media only screen and (max-width: 550px){.position-central.svelte-1y2ntyl{font-size:10em;text-align:center;line-height:1.55;padding-right:20px;margin:0;text-shadow:7px 7px #000}.multi-element-row.svelte-1y2ntyl{margin:0}.season-stats-row.svelte-1y2ntyl{margin:0 1em 1em}.form-details.svelte-1y2ntyl{width:95%}.position-no-badge.svelte-1y2ntyl{padding:0 !important;margin:0 !important;width:100%}.circles-background.svelte-1y2ntyl{transform:scale(0.35);margin-top:-9.5em}.lowered.svelte-1y2ntyl{margin:0 30px}}",
	map: "{\"version\":3,\"file\":\"Dashboard.svelte\",\"sources\":[\"Dashboard.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from 'svelte-routing';\\r\\nimport { onMount } from 'svelte';\\r\\nimport CurrentForm from '../components/team/current_form/CurrentForm.svelte';\\r\\nimport TableSnippet from '../components/team/TableSnippet.svelte';\\r\\nimport NextGame from '../components/team/NextGame.svelte';\\r\\nimport StatsValues from '../components/team/goals_scored_and_conceded/StatsValues.svelte';\\r\\nimport Footer from '../components/Footer.svelte';\\r\\nimport FixturesGraph from '../components/team/FixturesGraph.svelte';\\r\\nimport FormOverTimeGraph from '../components/team/FormOverTimeGraph.svelte';\\r\\nimport PositionOverTimeGraph from '../components/team/PositionOverTimeGraph.svelte';\\r\\nimport PointsOverTimeGraph from '../components/team/PointsOverTimeGraph.svelte';\\r\\nimport GoalsScoredAndConcededGraph from '../components/team/goals_scored_and_conceded/ScoredConcededPerGameGraph.svelte';\\r\\nimport CleanSheetsGraph from '../components/team/goals_scored_and_conceded/CleanSheetsGraph.svelte';\\r\\nimport GoalsPerGame from '../components/team/goals_per_game/GoalsPerGame.svelte';\\r\\nimport SpiderGraph from '../components/team/SpiderGraph.svelte';\\r\\nimport ScorelineFreqGraph from '../components/team/ScorelineFreqGraph.svelte';\\r\\nimport Nav from '../components/nav/Nav.svelte';\\r\\nimport Overview from '../components/overview/Overview.svelte';\\r\\nimport MobileNav from '../components/nav/MobileNav.svelte';\\r\\nimport ScoredConcededOverTimeGraph from '../components/team/goals_scored_and_conceded/ScoredConcededOverTimeGraph.svelte';\\r\\nimport { toAlias, toHyphenatedName, playedMatchdays, currentMatchday as getCurrentMatchday, } from '../lib/team';\\r\\nimport { toTitleCase } from '../lib/format';\\r\\nimport { url } from '../lib/consts';\\r\\nfunction toggleMobileNav() {\\r\\n    let mobileNav = document.getElementById('mobileNav');\\r\\n    if (mobileNav.style.width === '0%') {\\r\\n        mobileNav.style.display = 'block';\\r\\n        mobileNav.style.width = '100%';\\r\\n    }\\r\\n    else {\\r\\n        mobileNav.style.display = 'none';\\r\\n        mobileNav.style.width = '0%';\\r\\n    }\\r\\n}\\r\\nfunction playedMatchdayDates(data, team) {\\r\\n    let matchdays = playedMatchdays(data, team);\\r\\n    // If played one or no games, take x-axis from whole season dates\\r\\n    if (matchdays.length === 0) {\\r\\n        matchdays = Object.keys(data.fixtures[team]);\\r\\n    }\\r\\n    // Find median matchday date across all teams for each matchday\\r\\n    let x = [];\\r\\n    for (let i = 0; i < matchdays.length; i++) {\\r\\n        let matchdayDates = [];\\r\\n        for (let team in data.standings) {\\r\\n            matchdayDates.push(new Date(data.fixtures[team][matchdays[i]].date));\\r\\n        }\\r\\n        matchdayDates.sort();\\r\\n        x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);\\r\\n    }\\r\\n    x.sort(function (a, b) {\\r\\n        return a - b;\\r\\n    });\\r\\n    return x;\\r\\n}\\r\\nasync function initDashboard() {\\r\\n    // Set formatted team name so page header can display while fetching data\\r\\n    if (slug === 'overview') {\\r\\n        team = 'Overview';\\r\\n        title = 'Dashboard | Overview';\\r\\n    }\\r\\n    else if (slug != null) {\\r\\n        slug = slugAlias(slug);\\r\\n        team = toTitleCase(slug.replace(/\\\\-/g, ' '));\\r\\n        title = `Dashboard | ${team}`;\\r\\n    }\\r\\n    const response = await fetch(`${url}/teams`);\\r\\n    if (!response.ok) {\\r\\n        return;\\r\\n    }\\r\\n    let json = (await response.json());\\r\\n    teams = Object.keys(json.standings);\\r\\n    if (slug === null) {\\r\\n        // If root, set team to current leader\\r\\n        team = teams[0];\\r\\n        title = `Dashboard | ${team}`;\\r\\n        slug = toHyphenatedName(team);\\r\\n        // Change url to /team-name without reloading page\\r\\n        history.pushState({}, null, window.location.href + slug);\\r\\n    }\\r\\n    else if (team != 'Overview' && team != '' && !teams.includes(team)) {\\r\\n        window.location.href = '/error';\\r\\n    }\\r\\n    if (team != 'Overview' && team != '') {\\r\\n        currentMatchday = getCurrentMatchday(json, team);\\r\\n        playedDates = playedMatchdayDates(json, team);\\r\\n    }\\r\\n    data = json;\\r\\n    console.log(data);\\r\\n    window.dispatchEvent(new Event('resize')); // Snap plots to currently set size\\r\\n}\\r\\nfunction slugAlias(slug) {\\r\\n    switch (slug) {\\r\\n        case 'brighton':\\r\\n            return 'brighton-and-hove-albion';\\r\\n        case 'palace':\\r\\n            return 'crystal-palace';\\r\\n        case 'united':\\r\\n            return 'manchester-united';\\r\\n        case 'city':\\r\\n            return 'city';\\r\\n        case 'nottingham':\\r\\n            return 'nottingham-forest';\\r\\n        case 'luton':\\r\\n            return 'luton-town';\\r\\n        case 'sheffield':\\r\\n            return 'sheffield-united';\\r\\n        case 'villa':\\r\\n            return 'aston-villa';\\r\\n        case 'spurs':\\r\\n            return 'tottenham-hotspur';\\r\\n        case 'wolves':\\r\\n            return 'wolverhampton-wanderers';\\r\\n        default:\\r\\n            return slug; // No alias found\\r\\n    }\\r\\n}\\r\\nfunction switchTeam(newTeam) {\\r\\n    slug = newTeam;\\r\\n    if (slug === 'overview') {\\r\\n        team = 'Overview';\\r\\n        title = 'Dashboard | Overview';\\r\\n    }\\r\\n    else {\\r\\n        slug = slugAlias(slug);\\r\\n        team = toTitleCase(slug.replace(/\\\\-/g, ' '));\\r\\n        title = `Dashboard | ${team}`;\\r\\n        // Overwrite values from new team's perspective using same data\\r\\n        currentMatchday = getCurrentMatchday(data, team);\\r\\n        playedDates = playedMatchdayDates(data, team);\\r\\n    }\\r\\n    window.history.pushState(null, null, slug); // Change current url without reloading\\r\\n}\\r\\nfunction lazyLoad() {\\r\\n    load = true;\\r\\n    window.dispatchEvent(new Event('resize')); // Snap plots to currently set size\\r\\n}\\r\\nlet y;\\r\\nlet load = false;\\r\\n$: y > 30 && lazyLoad();\\r\\nlet pageWidth;\\r\\n$: mobileView = pageWidth <= 700;\\r\\nlet title = 'Dashboard';\\r\\nlet team = '';\\r\\nlet teams = []; // Used for nav bar links\\r\\nlet currentMatchday;\\r\\nlet playedDates;\\r\\nlet data;\\r\\nonMount(() => {\\r\\n    initDashboard();\\r\\n});\\r\\nexport let slug;\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>{title}</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<svelte:window bind:innerWidth={pageWidth} bind:scrollY={y} />\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"team\\\">\\r\\n    <Nav team={slug} {teams} {toAlias} {switchTeam} />\\r\\n    <MobileNav\\r\\n      hyphenatedTeam={slug}\\r\\n      {teams}\\r\\n      {toAlias}\\r\\n      {switchTeam}\\r\\n      {toggleMobileNav}\\r\\n    />\\r\\n    {#if teams.length === 0}\\r\\n      <!-- Navigation disabled while teams list are loading -->\\r\\n      <button id=\\\"mobileNavBtn\\\" style=\\\"cursor: default\\\">Select Team</button>\\r\\n    {:else}\\r\\n      <button id=\\\"mobileNavBtn\\\" on:click={toggleMobileNav}>\\r\\n        Select Team\\r\\n      </button>\\r\\n    {/if}\\r\\n\\r\\n    <div id=\\\"dashboard\\\">\\r\\n      <div class=\\\"header\\\" style=\\\"background-color: var(--{slug});\\\">\\r\\n        <a class=\\\"main-link no-decoration\\\" href=\\\"/{slug}\\\">\\r\\n          <div class=\\\"title\\\" style=\\\"color: var(--{slug + '-secondary'});\\\">\\r\\n            {team == '' || team == 'Overview' ? team : toAlias(team)}\\r\\n          </div>\\r\\n        </a>\\r\\n      </div>\\r\\n\\r\\n      {#if data != undefined}\\r\\n        {#if slug === 'overview'}\\r\\n          <Overview {data} />\\r\\n        {:else}\\r\\n          <div class=\\\"page-content\\\">\\r\\n            <div class=\\\"row multi-element-row small-bottom-margin\\\">\\r\\n              <div class=\\\"row-left position-no-badge\\\">\\r\\n                <div class=\\\"circles-background-container\\\">\\r\\n                  <svg class=\\\"circles-background\\\">\\r\\n                    <circle\\r\\n                      cx=\\\"300\\\"\\r\\n                      cy=\\\"150\\\"\\r\\n                      r=\\\"100\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{slug}-secondary)\\\"\\r\\n                    />\\r\\n                    <circle\\r\\n                      cx=\\\"170\\\"\\r\\n                      cy=\\\"170\\\"\\r\\n                      r=\\\"140\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{slug})\\\"\\r\\n                    />\\r\\n                    <circle\\r\\n                      cx=\\\"300\\\"\\r\\n                      cy=\\\"320\\\"\\r\\n                      r=\\\"170\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{slug})\\\"\\r\\n                    />\\r\\n                  </svg>\\r\\n                </div>\\r\\n                <div class=\\\"position-central\\\">\\r\\n                  {data.standings[team][data._id].position}\\r\\n                </div>\\r\\n              </div>\\r\\n              <div class=\\\"row-right fixtures-graph row-graph\\\">\\r\\n                <h1 class=\\\"lowered\\\">Fixtures</h1>\\r\\n                <div class=\\\"graph mini-graph mobile-margin\\\">\\r\\n                  <FixturesGraph {data} {team} {mobileView} />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row multi-element-row\\\">\\r\\n              <div class=\\\"row-left form-details\\\">\\r\\n                <CurrentForm {data} {currentMatchday} {team} />\\r\\n                <TableSnippet\\r\\n                  {data}\\r\\n                  hyphenatedTeam={slug}\\r\\n                  {team}\\r\\n                  {switchTeam}\\r\\n                />\\r\\n              </div>\\r\\n              <div class=\\\"row-right\\\">\\r\\n                <NextGame {data} {team} {switchTeam} />\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"form-graph row-graph\\\">\\r\\n                <h1 class=\\\"lowered\\\">Form</h1>\\r\\n                <div class=\\\"graph full-row-graph\\\">\\r\\n                  <FormOverTimeGraph\\r\\n                    {data}\\r\\n                    {team}\\r\\n                    {playedDates}\\r\\n                    bind:lazyLoad={load}\\r\\n                    {mobileView}\\r\\n                  />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            {#if load}\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"position-over-time-graph row-graph\\\">\\r\\n                  <h1 class=\\\"lowered\\\">Position</h1>\\r\\n                  <div class=\\\"graph full-row-graph\\\">\\r\\n                    <PositionOverTimeGraph {data} {team} {mobileView} />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"position-over-time-graph row-graph\\\">\\r\\n                  <h1 class=\\\"lowered\\\">Points</h1>\\r\\n                  <div class=\\\"graph full-row-graph\\\">\\r\\n                    <PointsOverTimeGraph {data} {team} {mobileView} />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"row no-bottom-margin\\\">\\r\\n                <div class=\\\"goals-scored-vs-conceded-graph row-graph\\\">\\r\\n                  <h1 class=\\\"lowered\\\">Goals Per Game</h1>\\r\\n                  <div class=\\\"graph full-row-graph\\\">\\r\\n                    <GoalsScoredAndConcededGraph\\r\\n                      {data}\\r\\n                      {team}\\r\\n                      {playedDates}\\r\\n                      {mobileView}\\r\\n                    />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"row-graph\\\">\\r\\n                  <div class=\\\"clean-sheets graph full-row-graph\\\">\\r\\n                    <CleanSheetsGraph\\r\\n                      {data}\\r\\n                      {team}\\r\\n                      {playedDates}\\r\\n                      {mobileView}\\r\\n                    />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"season-stats-row\\\">\\r\\n                <StatsValues {data} {team} />\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"row-graph\\\">\\r\\n                  <div class=\\\"graph full-row-graph\\\">\\r\\n                    <ScoredConcededOverTimeGraph {data} {team} {mobileView} />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"goals-freq-row row-graph\\\">\\r\\n                  <h1>Scorelines</h1>\\r\\n                  <GoalsPerGame {data} {team} {mobileView} />\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"row-graph\\\">\\r\\n                  <div class=\\\"score-freq graph\\\">\\r\\n                    <ScorelineFreqGraph {data} {team} {mobileView} />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"spider-chart-row row-graph\\\">\\r\\n                  <h1>Team Comparison</h1>\\r\\n                  <div class=\\\"spider-chart-container\\\">\\r\\n                    <SpiderGraph {data} {team} {teams} />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n            {/if}\\r\\n          </div>\\r\\n        {/if}\\r\\n        <Footer lastUpdated={data.lastUpdated} />\\r\\n      {:else}\\r\\n        <div class=\\\"loading-spinner-container\\\">\\r\\n          <div class=\\\"loading-spinner\\\" />\\r\\n        </div>\\r\\n      {/if}\\r\\n    </div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  .header {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .main-link {\\r\\n    width: fit-content;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .title {\\r\\n    font-size: 2.3rem;\\r\\n    width: fit-content;\\r\\n  }\\r\\n  .lowered {\\r\\n    margin-bottom: -9px;\\r\\n  }\\r\\n  .page-content {\\r\\n    position: relative;\\r\\n  }\\r\\n  #team {\\r\\n    display: flex;\\r\\n    overflow-x: hidden;\\r\\n    font-size: 15px;\\r\\n  }\\r\\n\\r\\n  .position-no-badge {\\r\\n    padding-left: 0;\\r\\n    margin: 0;\\r\\n    height: 500px;\\r\\n  }\\r\\n\\r\\n  .position-central {\\r\\n    text-shadow: 9px 9px #000;\\r\\n    font-weight: 800;\\r\\n    font-size: 430px;\\r\\n    user-select: none;\\r\\n    max-width: 500px;\\r\\n  }\\r\\n\\r\\n  .position-central {\\r\\n    text-align: center;\\r\\n    margin-top: 0.1em;\\r\\n    max-height: 500px;\\r\\n    margin-left: 0.05em;\\r\\n    font-size: 20vw;\\r\\n    color: #333;\\r\\n  }\\r\\n\\r\\n  .circles-background-container {\\r\\n    position: absolute;\\r\\n    align-self: center;\\r\\n    width: 500px;\\r\\n    z-index: -10;\\r\\n  }\\r\\n\\r\\n  .circles-background {\\r\\n    height: 500px;\\r\\n    width: 500px;\\r\\n    transform: scale(0.95);\\r\\n  }\\r\\n\\r\\n  #dashboard {\\r\\n    margin-left: 220px;\\r\\n    width: 100%;\\r\\n  }\\r\\n\\r\\n  .fixtures-graph {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n  }\\r\\n\\r\\n  .clean-sheets {\\r\\n    height: 60px;\\r\\n  }\\r\\n\\r\\n  .no-bottom-margin {\\r\\n    margin-bottom: 0 !important;\\r\\n  }\\r\\n  .small-bottom-margin {\\r\\n    margin-bottom: 1.5rem !important;\\r\\n  }\\r\\n  .page-content {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .row {\\r\\n    position: relative;\\r\\n    display: flex;\\r\\n    margin-bottom: 3rem;\\r\\n    height: auto;\\r\\n  }\\r\\n  .row-graph {\\r\\n    width: 100%;\\r\\n  }\\r\\n  .score-freq {\\r\\n    margin: 0 8% 0 8%;\\r\\n  }\\r\\n  .row-left {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    padding-right: auto;\\r\\n    margin-right: 1.5em;\\r\\n    text-justify: center;\\r\\n    flex: 4;\\r\\n  }\\r\\n  .row-right {\\r\\n    flex: 10;\\r\\n  }\\r\\n  .multi-element-row {\\r\\n    margin: 0 1.4em 3rem;\\r\\n  }\\r\\n\\r\\n  .spider-chart-row {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .spider-chart-container {\\r\\n    margin: 1em auto auto;\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  #mobileNavBtn {\\r\\n    position: fixed;\\r\\n    color: white;\\r\\n    background: var(--purple);\\r\\n    padding: 0.8em 0;\\r\\n    cursor: pointer;\\r\\n    font-size: 1.1em;\\r\\n    z-index: 1;\\r\\n    width: 100%;\\r\\n    bottom: 0;\\r\\n    border: none;\\r\\n    margin-bottom: -1px; /* For gap at bottom found in safari */\\r\\n  }\\r\\n\\r\\n  @media only screen and (min-width: 2400px) {\\r\\n    .position-central {\\r\\n      font-size: 16vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 2200px) {\\r\\n    .position-central {\\r\\n      font-size: 18vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 2000px) {\\r\\n    .position-central {\\r\\n      font-size: 20vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1800px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.9);\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 20vw;\\r\\n      margin-top: 0.2em;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1600px) {\\r\\n    .row-left {\\r\\n      flex: 5;\\r\\n    }\\r\\n    .circles-background {\\r\\n      transform: scale(0.85);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1500px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.8);\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 22vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1400px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.75);\\r\\n    }\\r\\n    .position-central {\\r\\n      margin-top: 0.25em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (min-width: 1200px) {\\r\\n    #mobileNavBtn {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1200px) {\\r\\n    .position-central {\\r\\n      margin-top: 0.3em;\\r\\n    }\\r\\n    .circles-background {\\r\\n      transform: scale(0.7);\\r\\n    }\\r\\n    #dashboard {\\r\\n      margin-left: 0;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 24vw;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (min-width: 1100px) {\\r\\n    .form-details {\\r\\n      width: 80%;\\r\\n      align-items: center;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1000px) {\\r\\n    .row {\\r\\n      flex-direction: column;\\r\\n      margin-bottom: 40px;\\r\\n    }\\r\\n    .row-graph {\\r\\n      width: auto;\\r\\n    }\\r\\n    .score-freq {\\r\\n      margin: 0 0 10px;\\r\\n    }\\r\\n\\r\\n    .multi-element-row {\\r\\n      margin: 0;\\r\\n    }\\r\\n    .row-left {\\r\\n      margin-right: 0;\\r\\n      align-self: center;\\r\\n      width: 80%;\\r\\n    }\\r\\n\\r\\n    .position-no-badge {\\r\\n      height: 400px;\\r\\n      width: 500px;\\r\\n    }\\r\\n    .position-central {\\r\\n      margin: auto;\\r\\n    }\\r\\n\\r\\n    .circles-background {\\r\\n      transform: scale(0.48);\\r\\n      margin-top: -100px;\\r\\n    }\\r\\n\\r\\n    .position-central,\\r\\n    .circles-background-container {\\r\\n      align-self: center;\\r\\n    }\\r\\n    .spider-chart-container {\\r\\n      flex-direction: column;\\r\\n      width: 100%;\\r\\n    }\\r\\n    .full-row-graph {\\r\\n      margin: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 900px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.45);\\r\\n      margin-top: -120px;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 25vw;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.55);\\r\\n      margin-top: -5em;\\r\\n    }\\r\\n\\r\\n    .position-no-badge {\\r\\n      height: 330px;\\r\\n    }\\r\\n\\r\\n    .position-central {\\r\\n      font-size: 250px;\\r\\n      margin: 35px 0 0 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.4);\\r\\n      margin-top: -9em;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 13em;\\r\\n    }\\r\\n    .season-stats-row {\\r\\n      margin: 1em;\\r\\n    }\\r\\n    .row-graph {\\r\\n      margin: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .position-central {\\r\\n      font-size: 10em;\\r\\n      text-align: center;\\r\\n      line-height: 1.55;\\r\\n      padding-right: 20px;\\r\\n      margin: 0;\\r\\n      text-shadow: 7px 7px #000;\\r\\n    }\\r\\n    .multi-element-row {\\r\\n      margin: 0;\\r\\n    }\\r\\n\\r\\n    .season-stats-row {\\r\\n      margin: 0 1em 1em;\\r\\n    }\\r\\n    .form-details {\\r\\n      width: 95%;\\r\\n    }\\r\\n    .position-no-badge {\\r\\n      padding: 0 !important;\\r\\n      margin: 0 !important;\\r\\n      width: 100%;\\r\\n    }\\r\\n\\r\\n    .circles-background {\\r\\n      transform: scale(0.35);\\r\\n      margin-top: -9.5em;\\r\\n    }\\r\\n\\r\\n    .lowered {\\r\\n      margin: 0 30px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

function toggleMobileNav$1() {
	let mobileNav = document.getElementById('mobileNav');

	if (mobileNav.style.width === '0%') {
		mobileNav.style.display = 'block';
		mobileNav.style.width = '100%';
	} else {
		mobileNav.style.display = 'none';
		mobileNav.style.width = '0%';
	}
}

function slugAlias(slug) {
	switch (slug) {
		case 'brighton':
			return 'brighton-and-hove-albion';
		case 'palace':
			return 'crystal-palace';
		case 'united':
			return 'manchester-united';
		case 'city':
			return 'city';
		case 'nottingham':
			return 'nottingham-forest';
		case 'luton':
			return 'luton-town';
		case 'sheffield':
			return 'sheffield-united';
		case 'villa':
			return 'aston-villa';
		case 'spurs':
			return 'tottenham-hotspur';
		case 'wolves':
			return 'wolverhampton-wanderers';
		default:
			return slug;
	} // No alias found
}

const Dashboard = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let mobileView;

	function playedMatchdayDates(data, team) {
		let matchdays = playedMatchdays(data, team);

		// If played one or no games, take x-axis from whole season dates
		if (matchdays.length === 0) {
			matchdays = Object.keys(data.fixtures[team]);
		}

		// Find median matchday date across all teams for each matchday
		let x = [];

		for (let i = 0; i < matchdays.length; i++) {
			let matchdayDates = [];

			for (let team in data.standings) {
				matchdayDates.push(new Date(data.fixtures[team][matchdays[i]].date));
			}

			matchdayDates.sort();
			x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
		}

		x.sort(function (a, b) {
			return a - b;
		});

		return x;
	}

	async function initDashboard() {
		// Set formatted team name so page header can display while fetching data
		if (slug === 'overview') {
			team = 'Overview';
			title = 'Dashboard | Overview';
		} else if (slug != null) {
			slug = slugAlias(slug);
			team = toTitleCase(slug.replace(/\-/g, ' '));
			title = `Dashboard | ${team}`;
		}

		const response = await fetch(`${url}/teams`);

		if (!response.ok) {
			return;
		}

		let json = await response.json();
		teams = Object.keys(json.standings);

		if (slug === null) {
			// If root, set team to current leader
			team = teams[0];

			title = `Dashboard | ${team}`;
			slug = toHyphenatedName(team);

			// Change url to /team-name without reloading page
			history.pushState({}, null, window.location.href + slug);
		} else if (team != 'Overview' && team != '' && !teams.includes(team)) {
			window.location.href = '/error';
		}

		if (team != 'Overview' && team != '') {
			currentMatchday$1 = currentMatchday(json, team);
			playedDates = playedMatchdayDates(json, team);
		}

		data = json;
		console.log(data);
		window.dispatchEvent(new Event('resize')); // Snap plots to currently set size
	}

	function switchTeam(newTeam) {
		slug = newTeam;

		if (slug === 'overview') {
			team = 'Overview';
			title = 'Dashboard | Overview';
		} else {
			slug = slugAlias(slug);
			team = toTitleCase(slug.replace(/\-/g, ' '));
			title = `Dashboard | ${team}`;

			// Overwrite values from new team's perspective using same data
			currentMatchday$1 = currentMatchday(data, team);

			playedDates = playedMatchdayDates(data, team);
		}

		window.history.pushState(null, null, slug); // Change current url without reloading
	}
	let load = false;
	let pageWidth;
	let title = 'Dashboard';
	let team = '';
	let teams = []; // Used for nav bar links
	let currentMatchday$1;
	let playedDates;
	let data;

	onMount(() => {
		initDashboard();
	});

	let { slug } = $$props;
	if ($$props.slug === void 0 && $$bindings.slug && slug !== void 0) $$bindings.slug(slug);
	$$result.css.add(css$7);
	let $$settled;
	let $$rendered;

	do {
		$$settled = true;
		mobileView = pageWidth <= 700;

		$$rendered = `${($$result.head += `${($$result.title = `<title>${escape(title)}</title>`, "")}<meta name="description" content="Premier League Statistics Dashboard">`, "")}



${validate_component(Router, "Router").$$render($$result, {}, {}, {
			default: () => {
				return `<div id="team" class="svelte-1y2ntyl">${validate_component(Nav, "Nav").$$render($$result, { team: slug, teams, toAlias, switchTeam }, {}, {})}
    ${validate_component(MobileNav, "MobileNav").$$render(
					$$result,
					{
						hyphenatedTeam: slug,
						teams,
						toAlias,
						switchTeam,
						toggleMobileNav: toggleMobileNav$1
					},
					{},
					{}
				)}
    ${teams.length === 0
				? `
      <button id="mobileNavBtn" style="cursor: default" class="svelte-1y2ntyl">Select Team</button>`
				: `<button id="mobileNavBtn" class="svelte-1y2ntyl">Select Team
      </button>`}

    <div id="dashboard" class="svelte-1y2ntyl"><div class="header svelte-1y2ntyl" style="${"background-color: var(--" + escape(slug, true) + ");"}"><a class="main-link no-decoration svelte-1y2ntyl" href="${"/" + escape(slug, true)}"><div class="title svelte-1y2ntyl" style="${"color: var(--" + escape(slug + '-secondary', true) + ");"}">${escape(team == '' || team == 'Overview' ? team : toAlias(team))}</div></a></div>

      ${data != undefined
				? `${slug === 'overview'
					? `${validate_component(Overview, "Overview").$$render($$result, { data }, {}, {})}`
					: `<div class="page-content svelte-1y2ntyl"><div class="row multi-element-row small-bottom-margin svelte-1y2ntyl"><div class="row-left position-no-badge svelte-1y2ntyl"><div class="circles-background-container svelte-1y2ntyl"><svg class="circles-background svelte-1y2ntyl"><circle cx="300" cy="150" r="100" stroke-width="0" fill="${"var(--" + escape(slug, true) + "-secondary)"}"></circle><circle cx="170" cy="170" r="140" stroke-width="0" fill="${"var(--" + escape(slug, true) + ")"}"></circle><circle cx="300" cy="320" r="170" stroke-width="0" fill="${"var(--" + escape(slug, true) + ")"}"></circle></svg></div>
                <div class="position-central svelte-1y2ntyl">${escape(data.standings[team][data._id].position)}</div></div>
              <div class="row-right fixtures-graph row-graph svelte-1y2ntyl"><h1 class="lowered svelte-1y2ntyl">Fixtures</h1>
                <div class="graph mini-graph mobile-margin">${validate_component(FixturesGraph, "FixturesGraph").$$render($$result, { data, team, mobileView }, {}, {})}</div></div></div>

            <div class="row multi-element-row svelte-1y2ntyl"><div class="row-left form-details svelte-1y2ntyl">${validate_component(CurrentForm, "CurrentForm").$$render($$result, { data, currentMatchday: currentMatchday$1, team }, {}, {})}
                ${validate_component(TableSnippet, "TableSnippet").$$render(
							$$result,
							{
								data,
								hyphenatedTeam: slug,
								team,
								switchTeam
							},
							{},
							{}
						)}</div>
              <div class="row-right svelte-1y2ntyl">${validate_component(NextGame, "NextGame").$$render($$result, { data, team, switchTeam }, {}, {})}</div></div>

            <div class="row svelte-1y2ntyl"><div class="form-graph row-graph svelte-1y2ntyl"><h1 class="lowered svelte-1y2ntyl">Form</h1>
                <div class="graph full-row-graph svelte-1y2ntyl">${validate_component(FormOverTimeGraph, "FormOverTimeGraph").$$render(
							$$result,
							{
								data,
								team,
								playedDates,
								mobileView,
								lazyLoad: load
							},
							{
								lazyLoad: $$value => {
									load = $$value;
									$$settled = false;
								}
							},
							{}
						)}</div></div></div>

            ${load
						? `<div class="row svelte-1y2ntyl"><div class="position-over-time-graph row-graph svelte-1y2ntyl"><h1 class="lowered svelte-1y2ntyl">Position</h1>
                  <div class="graph full-row-graph svelte-1y2ntyl">${validate_component(PositionOverTimeGraph, "PositionOverTimeGraph").$$render($$result, { data, team, mobileView }, {}, {})}</div></div></div>

              <div class="row svelte-1y2ntyl"><div class="position-over-time-graph row-graph svelte-1y2ntyl"><h1 class="lowered svelte-1y2ntyl">Points</h1>
                  <div class="graph full-row-graph svelte-1y2ntyl">${validate_component(PointsOverTimeGraph, "PointsOverTimeGraph").$$render($$result, { data, team, mobileView }, {}, {})}</div></div></div>

              <div class="row no-bottom-margin svelte-1y2ntyl"><div class="goals-scored-vs-conceded-graph row-graph svelte-1y2ntyl"><h1 class="lowered svelte-1y2ntyl">Goals Per Game</h1>
                  <div class="graph full-row-graph svelte-1y2ntyl">${validate_component(ScoredConcededPerGameGraph, "GoalsScoredAndConcededGraph").$$render($$result, { data, team, playedDates, mobileView }, {}, {})}</div></div></div>

              <div class="row svelte-1y2ntyl"><div class="row-graph svelte-1y2ntyl"><div class="clean-sheets graph full-row-graph svelte-1y2ntyl">${validate_component(CleanSheetsGraph, "CleanSheetsGraph").$$render($$result, { data, team, playedDates, mobileView }, {}, {})}</div></div></div>

              <div class="season-stats-row svelte-1y2ntyl">${validate_component(StatsValues, "StatsValues").$$render($$result, { data, team }, {}, {})}</div>

              <div class="row svelte-1y2ntyl"><div class="row-graph svelte-1y2ntyl"><div class="graph full-row-graph svelte-1y2ntyl">${validate_component(ScoredConcededOverTimeGraph, "ScoredConcededOverTimeGraph").$$render($$result, { data, team, mobileView }, {}, {})}</div></div></div>

              <div class="row svelte-1y2ntyl"><div class="goals-freq-row row-graph svelte-1y2ntyl"><h1>Scorelines</h1>
                  ${validate_component(GoalsPerGame, "GoalsPerGame").$$render($$result, { data, team, mobileView }, {}, {})}</div></div>

              <div class="row svelte-1y2ntyl"><div class="row-graph svelte-1y2ntyl"><div class="score-freq graph svelte-1y2ntyl">${validate_component(ScorelineFreqGraph, "ScorelineFreqGraph").$$render($$result, { data, team, mobileView }, {}, {})}</div></div></div>

              <div class="row svelte-1y2ntyl"><div class="spider-chart-row row-graph svelte-1y2ntyl"><h1>Team Comparison</h1>
                  <div class="spider-chart-container svelte-1y2ntyl">${validate_component(SpiderGraph, "SpiderGraph").$$render($$result, { data, team, teams }, {}, {})}</div></div></div>`
						: ``}</div>`}
        ${validate_component(Footer, "Footer").$$render($$result, { lastUpdated: data.lastUpdated }, {}, {})}`
				: `<div class="loading-spinner-container"><div class="loading-spinner"></div></div>`}</div></div>`;
			}
		})}`;
	} while (!$$settled);

	return $$rendered;
});

/* src\routes\Home.svelte generated by Svelte v3.59.2 */

const css$6 = {
	code: "#home.svelte-yx1mpi{background:black;min-height:100vh;display:grid;place-items:center;background-image:linear-gradient(to right, #025e4c45 1px, transparent 1px),\r\n      linear-gradient(to bottom, #025e4c45 1px, transparent 1px);background-size:80px 80px}#circle.svelte-yx1mpi{border-radius:50%;width:60vw;height:28vw;z-index:1;position:absolute;box-shadow:black 0 0 200px 100px}.content.svelte-yx1mpi{display:grid;place-items:center;margin-bottom:100px}img.svelte-yx1mpi{z-index:2;width:min(80%, 1000px);box-shadow:black 0px 0 70px 58px;box-shadow:black 0px 0 80px 80px}.links.svelte-yx1mpi{z-index:3;display:flex;padding-top:60px;background:black;box-shadow:black 0 60px 30px 30px}.fantasy-link.svelte-yx1mpi{color:#37003d;background:linear-gradient(70deg, var(--green), #02efff, #5e80ff);background:linear-gradient(90deg, #00fbd6, #02efff);background:var(--green);box-shadow:0 0 30px 1px rgba(0, 254, 135, 0.2),\r\n      0 0 60px 2px rgba(0, 254, 135, 0.2);padding:18px 0}.dashboard-link.svelte-yx1mpi{color:#37003d;background:var(--green);background:linear-gradient(70deg, var(--green), #02efff, #5e80ff);background:linear-gradient(30deg, var(--green), #2bd2ff);background:linear-gradient(70deg, var(--green), #2bd2ff, #5e80ff);background:#fc014e;background:linear-gradient(90deg, var(--green), #00fbd6);background:rgb(5, 235, 235);box-shadow:0 0 30px 1px rgba(5, 235, 235, 0.2),\r\n      0 0 60px 2px rgba(5, 235, 235, 0.2);padding:18px 0}.dashboard-link.svelte-yx1mpi,.fantasy-link.svelte-yx1mpi{font-size:1.2em;border-radius:5px;font-weight:bold;letter-spacing:0.02em;margin:0 20px;width:160px;display:grid;place-items:center}@media only screen and (max-width: 800px){img.svelte-yx1mpi{width:90%}#circle.svelte-yx1mpi{display:none}}@media only screen and (max-width: 600px){#home.svelte-yx1mpi{background-size:60px 60px}}@media only screen and (max-width: 500px){.links.svelte-yx1mpi{flex-direction:column}.dashboard-link.svelte-yx1mpi,.fantasy-link.svelte-yx1mpi{font-size:14px;margin:12px 0;padding:18px 0;width:140px}img.svelte-yx1mpi{box-shadow:black 0px 20px 30px 40px}.links.svelte-yx1mpi{box-shadow:black 0px 40px 30px 40px}}",
	map: "{\"version\":3,\"file\":\"Home.svelte\",\"sources\":[\"Home.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from \\\"svelte-routing\\\";\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Premier League Dashboard</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"home\\\">\\r\\n    <div class=\\\"content\\\">\\r\\n      <div id=\\\"circle\\\" />\\r\\n      <img src=\\\"img/pldashboard5.png\\\" alt=\\\"pldashboard\\\" />\\r\\n      <div class=\\\"links\\\">\\r\\n        <a class=\\\"dashboard-link\\\" href=\\\"/\\\">Dashboard</a>\\r\\n        <a class=\\\"fantasy-link\\\" href=\\\"/fantasy\\\">Fantasy</a>\\r\\n      </div>\\r\\n    </div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  #home {\\r\\n    background: black;\\r\\n    min-height: 100vh;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    background-image: linear-gradient(to right, #025e4c45 1px, transparent 1px),\\r\\n      linear-gradient(to bottom, #025e4c45 1px, transparent 1px);\\r\\n    background-size: 80px 80px;\\r\\n  }\\r\\n  #circle {\\r\\n    border-radius: 50%;\\r\\n    width: 60vw;\\r\\n    height: 28vw;\\r\\n    z-index: 1;\\r\\n    position: absolute;\\r\\n    box-shadow: black 0 0 200px 100px;\\r\\n  }\\r\\n\\r\\n  .content {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    margin-bottom: 100px;\\r\\n  }\\r\\n  img {\\r\\n    z-index: 2;\\r\\n    width: min(80%, 1000px);\\r\\n    box-shadow: black 0px 0 70px 58px;\\r\\n    box-shadow: black 0px 0 80px 80px;\\r\\n  }\\r\\n  .links {\\r\\n    z-index: 3;\\r\\n    display: flex;\\r\\n    padding-top: 60px;\\r\\n    background: black;\\r\\n    box-shadow: black 0 60px 30px 30px;\\r\\n  }\\r\\n  .fantasy-link {\\r\\n    color: #37003d;\\r\\n    background: linear-gradient(70deg, var(--green), #02efff, #5e80ff);\\r\\n    background: linear-gradient(90deg, #00fbd6, #02efff);\\r\\n    background: var(--green);\\r\\n    box-shadow: 0 0 30px 1px rgba(0, 254, 135, 0.2),\\r\\n      0 0 60px 2px rgba(0, 254, 135, 0.2);\\r\\n    padding: 18px 0;\\r\\n  }\\r\\n  .dashboard-link {\\r\\n    color: #37003d;\\r\\n    background: var(--green);\\r\\n    background: linear-gradient(70deg, var(--green), #02efff, #5e80ff);\\r\\n    background: linear-gradient(30deg, var(--green), #2bd2ff);\\r\\n    background: linear-gradient(70deg, var(--green), #2bd2ff, #5e80ff);\\r\\n    background: #fc014e;\\r\\n    background: linear-gradient(90deg, var(--green), #00fbd6);\\r\\n    background: rgb(5, 235, 235);\\r\\n    box-shadow: 0 0 30px 1px rgba(5, 235, 235, 0.2),\\r\\n      0 0 60px 2px rgba(5, 235, 235, 0.2);\\r\\n    padding: 18px 0;\\r\\n  }\\r\\n  .dashboard-link,\\r\\n  .fantasy-link {\\r\\n    font-size: 1.2em;\\r\\n    border-radius: 5px;\\r\\n    font-weight: bold;\\r\\n    letter-spacing: 0.02em;\\r\\n    margin: 0 20px;\\r\\n    width: 160px;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    /* box-shadow: 0 0 30px 1px #00ff882c, 0 0 60px 2px #02eeff2c; */\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    img {\\r\\n      width: 90%;\\r\\n    }\\r\\n    #circle {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 600px) {\\r\\n    #home {\\r\\n      background-size: 60px 60px;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 500px) {\\r\\n    .links {\\r\\n      flex-direction: column;\\r\\n    }\\r\\n    .dashboard-link,\\r\\n    .fantasy-link {\\r\\n      font-size: 14px;\\r\\n      margin: 12px 0;\\r\\n      padding: 18px 0;\\r\\n      width: 140px;\\r\\n    }\\r\\n    img {\\r\\n      box-shadow: black 0px 20px 30px 40px;\\r\\n    }\\r\\n    .links {\\r\\n      box-shadow: black 0px 40px 30px 40px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

const Home = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css$6);

	return `${($$result.head += `${($$result.title = `<title>Premier League Dashboard</title>`, "")}<meta name="description" content="Premier League Statistics Dashboard">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="home" class="svelte-yx1mpi"><div class="content svelte-yx1mpi"><div id="circle" class="svelte-yx1mpi"></div>
      <img src="img/pldashboard5.png" alt="pldashboard" class="svelte-yx1mpi">
      <div class="links svelte-yx1mpi"><a class="dashboard-link svelte-yx1mpi" href="/">Dashboard</a>
        <a class="fantasy-link svelte-yx1mpi" href="/fantasy">Fantasy</a></div></div></div>`;
		}
	})}`;
});

/* src\routes\Predictions.svelte generated by Svelte v3.59.2 */

const css$5 = {
	code: ".predictions-header.svelte-g2t46v{padding:40px 40px 0;text-align:center}.predictions-title.svelte-g2t46v{font-size:2.6em;font-weight:800;letter-spacing:-1px;align-self:center;flex:auto;color:#333;margin:10px;text-decoration:none}.predictions.svelte-g2t46v{display:flex;flex-direction:column}.predictions-gap.svelte-g2t46v{margin:15px 0}.page-content.svelte-g2t46v{font-size:1.3em}.green.svelte-g2t46v{background-color:var(--win)}.yellow.svelte-g2t46v{background-color:var(--draw)}.red.svelte-g2t46v{background-color:var(--lose)}.predictions-container.svelte-g2t46v{width:50%;margin:0 auto}.date.svelte-g2t46v{width:min(90%, 300px);align-self:center;text-align:center;margin-bottom:2px;font-size:1.2rem}.prediction-item.svelte-g2t46v{text-align:left;margin:0 8%;display:flex}.prediction-label.svelte-g2t46v{flex:5}.prediction-value.svelte-g2t46v{flex:4.5;display:flex;text-align:right}.prediction-initials.svelte-g2t46v,.prediction-score.svelte-g2t46v{flex:1;text-align:center}.prediction-container.svelte-g2t46v{padding:6px 0 3px;margin:2px 0;width:min(90%, 300px);align-self:center;border-radius:var(--border-radius);color:inherit;border:none;font-size:16px;cursor:pointer;outline:inherit;position:relative}.medium-predictions-divider.svelte-g2t46v{align-self:center;border-bottom:3px solid black;width:min(100%, 375px);margin-bottom:2px}.prediction-details.svelte-g2t46v{font-size:0.75em;color:black;margin:5px 0;text-align:left;height:0;display:none}.prediction-time.svelte-g2t46v{color:grey;font-size:0.7em;position:absolute;right:-34px;top:calc(50% - 7px)}.prediction-detail.svelte-g2t46v{margin:3px 0 3px 30px}.prediction-details.expanded.svelte-g2t46v{height:auto;display:block}.detailed-predicted-score.svelte-g2t46v{font-size:1.2em;margin:10px 0 0;text-align:center}.tabbed.svelte-g2t46v{padding-left:2em}.predictions-footer.svelte-g2t46v{align-items:center;font-size:0.8em;margin-top:30px;text-align:center}.accuracy-display.svelte-g2t46v{text-align:center;font-size:13px}.accuracy.svelte-g2t46v{margin:1em 0 2.5em}.accuracy-item.svelte-g2t46v{color:rgb(120 120 120);margin-bottom:5px}.method-description.svelte-g2t46v{margin:20px auto 15px;width:80%}@media only screen and (max-width: 800px){.predictions-container.svelte-g2t46v{width:80%}.prediction-container.svelte-g2t46v{width:min(80%, 300px)}.prediction-time.svelte-g2t46v{right:-28px;top:calc(50% - 6px)}.prediction-value.svelte-g2t46v{flex:4}}@media only screen and (max-width: 550px){#predictions.svelte-g2t46v{font-size:0.9em}.predictions-title.svelte-g2t46v{font-size:2em !important}.predictions-container.svelte-g2t46v{width:90%}.prediction-container.svelte-g2t46v{width:80%}.accuracy-display.svelte-g2t46v{font-size:0.8rem}.prediction-item.svelte-g2t46v{margin:0 6%}}@media only screen and (max-width: 500px){.prediction-value.svelte-g2t46v{flex:4.5}}@media only screen and (max-width: 400px){.prediction-value.svelte-g2t46v{flex:6}}",
	map: "{\"version\":3,\"file\":\"Predictions.svelte\",\"sources\":[\"Predictions.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from 'svelte-routing';\\r\\nimport { onMount } from 'svelte';\\r\\nimport { identicalScore, sameResult } from '../lib/goals';\\r\\nimport { url } from '../lib/consts';\\r\\nfunction toggleDetailsDisplay(id) {\\r\\n    let prediction = document.getElementById(id);\\r\\n    if (prediction != null) {\\r\\n        prediction.classList.toggle('expanded');\\r\\n    }\\r\\n}\\r\\n/**\\r\\n * Insert green, yellow or red colour values representing the results of completed\\r\\n * games as well as overall prediction accuracy values for scores and general\\r\\n * match results.\\r\\n */\\r\\nfunction insertExtras(json) {\\r\\n    let scoreCorrect = 0;\\r\\n    let resultCorrect = 0;\\r\\n    let total = 0;\\r\\n    for (let i = 0; i < json.predictions.length; i++) {\\r\\n        for (let j = 0; j < json.predictions[i].predictions.length; j++) {\\r\\n            let prediction = json.predictions[i].predictions[j];\\r\\n            if (prediction.actual != null) {\\r\\n                if (identicalScore(prediction.prediction, prediction.actual)) {\\r\\n                    prediction.colour = 'green';\\r\\n                    scoreCorrect += 1;\\r\\n                    resultCorrect += 1;\\r\\n                }\\r\\n                else if (sameResult(prediction.prediction, prediction.actual)) {\\r\\n                    prediction.colour = 'yellow';\\r\\n                    resultCorrect += 1;\\r\\n                }\\r\\n                else {\\r\\n                    prediction.colour = 'red';\\r\\n                }\\r\\n                total += 1;\\r\\n            }\\r\\n        }\\r\\n    }\\r\\n    let scoreAccuracy = 0;\\r\\n    let resultAccuracy = 0;\\r\\n    if (total > 0) {\\r\\n        scoreAccuracy = scoreCorrect / total;\\r\\n        resultAccuracy = resultCorrect / total;\\r\\n    }\\r\\n    json.accuracy = {\\r\\n        scoreAccuracy,\\r\\n        resultAccuracy,\\r\\n    };\\r\\n}\\r\\nfunction datetimeToTime(datetime) {\\r\\n    let date = new Date(datetime);\\r\\n    return date.toTimeString().slice(0, 5);\\r\\n}\\r\\nfunction sortByDate(predictions) {\\r\\n    predictions.sort((a, b) => {\\r\\n        //@ts-ignore\\r\\n        return new Date(b._id) - new Date(a._id);\\r\\n    });\\r\\n    // Sort each day of predictions by time\\r\\n    for (let i = 0; i < predictions.length; i++) {\\r\\n        predictions[i].predictions.sort((a, b) => {\\r\\n            return new Date(a.datetime) - new Date(b.datetime);\\r\\n        });\\r\\n    }\\r\\n}\\r\\nlet data;\\r\\nonMount(async () => {\\r\\n    const response = await fetch(`${url}/predictions`);\\r\\n    if (!response.ok) {\\r\\n        return;\\r\\n    }\\r\\n    let json = await response.json();\\r\\n    sortByDate(json);\\r\\n    json = { predictions: json };\\r\\n    insertExtras(json);\\r\\n    data = json;\\r\\n    console.log(data);\\r\\n});\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Predictions</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"predictions\\\">\\r\\n    <div class=\\\"predictions-header\\\">\\r\\n      <a class=\\\"predictions-title\\\" href=\\\"/predictions\\\">Predictions</a>\\r\\n    </div>\\r\\n\\r\\n    {#if data != undefined}\\r\\n      <div class=\\\"page-content\\\">\\r\\n        <div class=\\\"accuracy-display\\\">\\r\\n          <div class=\\\"accuracy\\\">\\r\\n            <span class=\\\"accuracy-item\\\">\\r\\n              Predicting with accuracy: <b\\r\\n                >{(data.accuracy.scoreAccuracy * 100).toFixed(2)}%</b\\r\\n              ></span\\r\\n            ><br />\\r\\n            <div class=\\\"accuracy-item\\\">\\r\\n              General results accuracy: <b\\r\\n                >{(data.accuracy.resultAccuracy * 100).toFixed(2)}%</b\\r\\n              >\\r\\n            </div>\\r\\n          </div>\\r\\n        </div>\\r\\n\\r\\n        <div class=\\\"predictions-container\\\">\\r\\n          <div class=\\\"predictions\\\">\\r\\n            {#if data.predictions != null}\\r\\n              {#each data.predictions as { _id, predictions }}\\r\\n                <div class=\\\"date\\\">\\r\\n                  {_id}\\r\\n                </div>\\r\\n                <div class=\\\"medium-predictions-divider\\\" />\\r\\n                <!-- Each prediction on this day -->\\r\\n                {#each predictions as pred}\\r\\n                  <button\\r\\n                    class=\\\"prediction-container {pred.colour}\\\"\\r\\n                    on:click={() => toggleDetailsDisplay(pred._id)}\\r\\n                  >\\r\\n                    <div class=\\\"prediction prediction-item\\\">\\r\\n                      <div class=\\\"prediction-label\\\">Predicted:</div>\\r\\n                      <div class=\\\"prediction-value\\\">\\r\\n                        <div class=\\\"prediction-initials\\\">{pred.home}</div>\\r\\n                        <div class=\\\"prediction-score\\\">\\r\\n                          {Math.round(pred.prediction.homeGoals)} - {Math.round(\\r\\n                            pred.prediction.awayGoals\\r\\n                          )}\\r\\n                        </div>\\r\\n                        <div class=\\\"prediction-initials\\\">{pred.away}</div>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    {#if pred.actual != null}\\r\\n                      <div class=\\\"actual prediction-item\\\">\\r\\n                        <div class=\\\"prediction-label\\\">Actual:</div>\\r\\n                        <div class=\\\"prediction-value\\\">\\r\\n                          <div class=\\\"prediction-initials\\\">{pred.home}</div>\\r\\n                          <div class=\\\"prediction-score\\\">\\r\\n                            {pred.actual.homeGoals} - {pred.actual.awayGoals}\\r\\n                          </div>\\r\\n                          <div class=\\\"prediction-initials\\\">{pred.away}</div>\\r\\n                        </div>\\r\\n                      </div>\\r\\n                    {:else}\\r\\n                      <div class=\\\"prediction-time\\\">\\r\\n                        {datetimeToTime(pred.datetime)}\\r\\n                      </div>\\r\\n                    {/if}\\r\\n\\r\\n                    <!-- Toggle to see detialed score -->\\r\\n                    {#if pred.prediction != null}\\r\\n                      <div class=\\\"prediction-details\\\" id={pred._id}>\\r\\n                        <div class=\\\"detailed-predicted-score\\\">\\r\\n                          <b\\r\\n                            >{pred.prediction.homeGoals} - {pred.prediction\\r\\n                              .awayGoals}</b\\r\\n                          >\\r\\n                        </div>\\r\\n                      </div>\\r\\n                    {/if}\\r\\n                  </button>\\r\\n                {/each}\\r\\n                <div class=\\\"predictions-gap\\\" />\\r\\n              {/each}\\r\\n            {/if}\\r\\n          </div>\\r\\n        </div>\\r\\n      </div>\\r\\n    {:else}\\r\\n      <div class=\\\"loading-spinner-container\\\">\\r\\n        <div class=\\\"loading-spinner\\\" />\\r\\n      </div>\\r\\n    {/if}\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  .predictions-header {\\r\\n    padding: 40px 40px 0;\\r\\n    text-align: center;\\r\\n  }\\r\\n  .predictions-title {\\r\\n    font-size: 2.6em;\\r\\n    font-weight: 800;\\r\\n    letter-spacing: -1px;\\r\\n    align-self: center;\\r\\n    flex: auto;\\r\\n    color: #333;\\r\\n    margin: 10px;\\r\\n    text-decoration: none;\\r\\n  }\\r\\n  .predictions {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n  }\\r\\n  .predictions-gap {\\r\\n    margin: 15px 0;\\r\\n  }\\r\\n  .page-content {\\r\\n    font-size: 1.3em;\\r\\n  }\\r\\n  .green {\\r\\n    background-color: var(--win);\\r\\n  }\\r\\n  .yellow {\\r\\n    background-color: var(--draw);\\r\\n  }\\r\\n  .red {\\r\\n    background-color: var(--lose);\\r\\n  }\\r\\n  .predictions-container {\\r\\n    width: 50%;\\r\\n    margin: 0 auto;\\r\\n  }\\r\\n  .date {\\r\\n    width: min(90%, 300px);\\r\\n    align-self: center;\\r\\n    text-align: center;\\r\\n    margin-bottom: 2px;\\r\\n    font-size: 1.2rem;\\r\\n  }\\r\\n  .prediction-item {\\r\\n    text-align: left;\\r\\n    margin: 0 8%;\\r\\n    display: flex;\\r\\n  }\\r\\n  .prediction-label {\\r\\n    flex: 5;\\r\\n  }\\r\\n  .prediction-value {\\r\\n    flex: 4.5;\\r\\n    display: flex;\\r\\n    text-align: right;\\r\\n  }\\r\\n  .prediction-initials,\\r\\n  .prediction-score {\\r\\n    flex: 1;\\r\\n    text-align: center;\\r\\n  }\\r\\n  .prediction-container {\\r\\n    padding: 6px 0 3px;\\r\\n    margin: 2px 0;\\r\\n    width: min(90%, 300px);\\r\\n    align-self: center;\\r\\n    border-radius: var(--border-radius);\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    font-size: 16px;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n    position: relative;\\r\\n  }\\r\\n  .medium-predictions-divider {\\r\\n    align-self: center;\\r\\n    border-bottom: 3px solid black;\\r\\n    width: min(100%, 375px);\\r\\n    margin-bottom: 2px;\\r\\n  }\\r\\n  .prediction-details {\\r\\n    font-size: 0.75em;\\r\\n    color: black;\\r\\n    margin: 5px 0;\\r\\n    text-align: left;\\r\\n    height: 0;\\r\\n    display: none;\\r\\n  }\\r\\n  .prediction-time {\\r\\n    color: grey;\\r\\n    font-size: 0.7em;\\r\\n    position: absolute;\\r\\n    right: -34px;\\r\\n    top: calc(50% - 7px);\\r\\n  }\\r\\n  .prediction-detail {\\r\\n    margin: 3px 0 3px 30px;\\r\\n  }\\r\\n  .prediction-details.expanded {\\r\\n    height: auto;\\r\\n    display: block;\\r\\n  }\\r\\n  .detailed-predicted-score {\\r\\n    font-size: 1.2em;\\r\\n    margin: 10px 0 0;\\r\\n    text-align: center;\\r\\n  }\\r\\n  .tabbed {\\r\\n    padding-left: 2em;\\r\\n  }\\r\\n  .predictions-footer {\\r\\n    align-items: center;\\r\\n    font-size: 0.8em;\\r\\n    margin-top: 30px;\\r\\n    text-align: center;\\r\\n  }\\r\\n  .accuracy-display {\\r\\n    text-align: center;\\r\\n    font-size: 13px;\\r\\n  }\\r\\n  .accuracy {\\r\\n    margin: 1em 0 2.5em;\\r\\n  }\\r\\n  .accuracy-item {\\r\\n    color: rgb(120 120 120);\\r\\n    margin-bottom: 5px;\\r\\n  }\\r\\n  .method-description {\\r\\n    margin: 20px auto 15px;\\r\\n    width: 80%;\\r\\n  }\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .predictions-container {\\r\\n      width: 80%;\\r\\n    }\\r\\n\\r\\n    .prediction-container {\\r\\n      width: min(80%, 300px);\\r\\n    }\\r\\n\\r\\n    .prediction-time {\\r\\n      right: -28px;\\r\\n      top: calc(50% - 6px);\\r\\n    }\\r\\n\\r\\n    .prediction-value {\\r\\n      flex: 4;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    #predictions {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n    .predictions-title {\\r\\n      font-size: 2em !important;\\r\\n    }\\r\\n    .predictions-container {\\r\\n      width: 90%;\\r\\n    }\\r\\n    .prediction-container {\\r\\n      width: 80%;\\r\\n    }\\r\\n    .accuracy-display {\\r\\n      font-size: 0.8rem;\\r\\n    }\\r\\n    .prediction-item {\\r\\n      margin: 0 6%;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 500px) {\\r\\n    .prediction-value {\\r\\n      flex: 4.5;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 400px) {\\r\\n    .prediction-value {\\r\\n      flex: 6;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

function datetimeToTime(datetime) {
	let date = new Date(datetime);
	return date.toTimeString().slice(0, 5);
}

function sortByDate(predictions) {
	predictions.sort((a, b) => {
		//@ts-ignore
		return new Date(b._id) - new Date(a._id);
	});

	// Sort each day of predictions by time
	for (let i = 0; i < predictions.length; i++) {
		predictions[i].predictions.sort((a, b) => {
			return new Date(a.datetime) - new Date(b.datetime);
		});
	}
}

const Predictions = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function insertExtras(json) {
		let scoreCorrect = 0;
		let resultCorrect = 0;
		let total = 0;

		for (let i = 0; i < json.predictions.length; i++) {
			for (let j = 0; j < json.predictions[i].predictions.length; j++) {
				let prediction = json.predictions[i].predictions[j];

				if (prediction.actual != null) {
					if (identicalScore(prediction.prediction, prediction.actual)) {
						prediction.colour = 'green';
						scoreCorrect += 1;
						resultCorrect += 1;
					} else if (sameResult(prediction.prediction, prediction.actual)) {
						prediction.colour = 'yellow';
						resultCorrect += 1;
					} else {
						prediction.colour = 'red';
					}

					total += 1;
				}
			}
		}

		let scoreAccuracy = 0;
		let resultAccuracy = 0;

		if (total > 0) {
			scoreAccuracy = scoreCorrect / total;
			resultAccuracy = resultCorrect / total;
		}

		json.accuracy = { scoreAccuracy, resultAccuracy };
	}

	let data;

	onMount(async () => {
		const response = await fetch(`${url}/predictions`);

		if (!response.ok) {
			return;
		}

		let json = await response.json();
		sortByDate(json);
		json = { predictions: json };
		insertExtras(json);
		data = json;
		console.log(data);
	});

	$$result.css.add(css$5);

	return `${($$result.head += `${($$result.title = `<title>Predictions</title>`, "")}<meta name="description" content="Premier League Statistics Dashboard">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="predictions" class="svelte-g2t46v"><div class="predictions-header svelte-g2t46v"><a class="predictions-title svelte-g2t46v" href="/predictions">Predictions</a></div>

    ${data != undefined
			? `<div class="page-content svelte-g2t46v"><div class="accuracy-display svelte-g2t46v"><div class="accuracy svelte-g2t46v"><span class="accuracy-item svelte-g2t46v">Predicting with accuracy: <b>${escape((data.accuracy.scoreAccuracy * 100).toFixed(2))}%</b></span><br>
            <div class="accuracy-item svelte-g2t46v">General results accuracy: <b>${escape((data.accuracy.resultAccuracy * 100).toFixed(2))}%</b></div></div></div>

        <div class="predictions-container svelte-g2t46v"><div class="predictions svelte-g2t46v">${data.predictions != null
				? `${each(data.predictions, ({ _id, predictions }) => {
						return `<div class="date svelte-g2t46v">${escape(_id)}</div>
                <div class="medium-predictions-divider svelte-g2t46v"></div>
                
                ${each(predictions, pred => {
							return `<button class="${"prediction-container " + escape(pred.colour, true) + " svelte-g2t46v"}"><div class="prediction prediction-item svelte-g2t46v"><div class="prediction-label svelte-g2t46v">Predicted:</div>
                      <div class="prediction-value svelte-g2t46v"><div class="prediction-initials svelte-g2t46v">${escape(pred.home)}</div>
                        <div class="prediction-score svelte-g2t46v">${escape(Math.round(pred.prediction.homeGoals))} - ${escape(Math.round(pred.prediction.awayGoals))}</div>
                        <div class="prediction-initials svelte-g2t46v">${escape(pred.away)}</div>
                      </div></div>
                    ${pred.actual != null
							? `<div class="actual prediction-item svelte-g2t46v"><div class="prediction-label svelte-g2t46v">Actual:</div>
                        <div class="prediction-value svelte-g2t46v"><div class="prediction-initials svelte-g2t46v">${escape(pred.home)}</div>
                          <div class="prediction-score svelte-g2t46v">${escape(pred.actual.homeGoals)} - ${escape(pred.actual.awayGoals)}</div>
                          <div class="prediction-initials svelte-g2t46v">${escape(pred.away)}</div></div>
                      </div>`
							: `<div class="prediction-time svelte-g2t46v">${escape(datetimeToTime(pred.datetime))}
                      </div>`}

                    
                    ${pred.prediction != null
							? `<div class="prediction-details svelte-g2t46v"${add_attribute("id", pred._id, 0)}><div class="detailed-predicted-score svelte-g2t46v"><b>${escape(pred.prediction.homeGoals)} - ${escape(pred.prediction.awayGoals)}</b></div>
                      </div>`
							: ``}
                  </button>`;
						})}
                <div class="predictions-gap svelte-g2t46v"></div>`;
					})}`
				: ``}</div></div></div>`
			: `<div class="loading-spinner-container"><div class="loading-spinner"></div></div>`}</div>`;
		}
	})}`;
});

/* src\components\nav\FantasyNav.svelte generated by Svelte v3.59.2 */

const css$4 = {
	code: ".title.svelte-1esiuxe{color:white;font-size:1.6em;height:96px;display:grid;place-items:center}.fantasy-logo.svelte-1esiuxe{color:white;position:absolute;font-size:0.67em;top:59px;right:40px}.no-selection.svelte-1esiuxe{user-select:none;-webkit-user-select:none;-moz-user-select:none}.team-links.svelte-1esiuxe{font-size:1em;color:var(--pink);display:grid}button.svelte-1esiuxe{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit;text-align:left}.team-name.svelte-1esiuxe,.this-team-name.svelte-1esiuxe{padding:0.4em 1.4em}.this-team-container.svelte-1esiuxe{color:var(--purple);background:var(--green)}:hover.team-container.svelte-1esiuxe{background:#2c002f;background:#140921}nav.svelte-1esiuxe{position:fixed;width:220px;height:100vh;background:#37003c;background:var(--purple)}img.svelte-1esiuxe{height:25px;width:25px}.close-btn.svelte-1esiuxe{position:absolute;right:0.9em;bottom:0.6em;background:transparent;border:none;outline:none;padding-top:0.3em;cursor:pointer}@keyframes svelte-1esiuxe-load{from{left:-100px}to{left:100px}}@media only screen and (max-width: 1200px){#navBar.svelte-1esiuxe{display:none}}",
	map: "{\"version\":3,\"file\":\"FantasyNav.svelte\",\"sources\":[\"FantasyNav.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function closeNavBar() {\\r\\n    document.getElementById(\\\"navBar\\\").style.display = \\\"none\\\";\\r\\n    document.getElementById(\\\"dashboard\\\").style.marginLeft = \\\"0\\\";\\r\\n    window.dispatchEvent(new Event(\\\"resize\\\")); // Snap plotly graphs to new width\\r\\n}\\r\\nexport let currentPage, pages, switchPage;\\r\\n</script>\\r\\n\\r\\n<nav id=\\\"navBar\\\">\\r\\n  <div class=\\\"title no-selection\\\">\\r\\n    <p>\\r\\n      <span style=\\\"color: var(--green)\\\">pl</span>dashboard\\r\\n    </p>\\r\\n    <div class=\\\"fantasy-logo\\\">Fantasy</div>\\r\\n  </div>\\r\\n  <div class=\\\"team-links\\\">\\r\\n    {#each pages as _page, _ (_page)}\\r\\n      {#if _page === currentPage}\\r\\n        <a\\r\\n          href=\\\"/fantasy{_page === 'all' ? '' : '/' + _page}\\\"\\r\\n          class=\\\"team-link\\\"\\r\\n        >\\r\\n          <div class=\\\"this-team-container\\\">\\r\\n            <div class=\\\"this-team-name\\\">\\r\\n              {_page[0].toUpperCase() + _page.slice(1)}\\r\\n            </div>\\r\\n          </div>\\r\\n        </a>\\r\\n      {:else}\\r\\n        <button\\r\\n          class=\\\"team-link\\\"\\r\\n          on:click={() => {\\r\\n            switchPage(_page);\\r\\n          }}\\r\\n        >\\r\\n          <div class=\\\"team-container\\\">\\r\\n            <div class=\\\"team-name\\\">\\r\\n              {_page[0].toUpperCase() + _page.slice(1)}\\r\\n            </div>\\r\\n          </div>\\r\\n        </button>\\r\\n      {/if}\\r\\n    {/each}\\r\\n  </div>\\r\\n  <div class=\\\"close\\\">\\r\\n    <button class=\\\"close-btn\\\" on:click={closeNavBar}>\\r\\n      <img src=\\\"img/arrow-bar-left.svg\\\" alt=\\\"\\\" />\\r\\n    </button>\\r\\n  </div>\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  .title {\\r\\n    color: white;\\r\\n    font-size: 1.6em;\\r\\n    height: 96px;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .fantasy-logo {\\r\\n    color: white;\\r\\n    position: absolute;\\r\\n    font-size: 0.67em;\\r\\n    top: 59px;\\r\\n    right: 40px;\\r\\n  }\\r\\n  .no-selection {\\r\\n    user-select: none;\\r\\n    -webkit-user-select: none;\\r\\n    -moz-user-select: none;\\r\\n  }\\r\\n  .team-links {\\r\\n    font-size: 1em;\\r\\n    color: var(--pink);\\r\\n    display: grid;\\r\\n  }\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n    text-align: left;\\r\\n  }\\r\\n  .team-name,\\r\\n  .this-team-name {\\r\\n    padding: 0.4em 1.4em;\\r\\n  }\\r\\n\\r\\n  .this-team-container {\\r\\n    color: var(--purple);\\r\\n    background: var(--green);\\r\\n  }\\r\\n\\r\\n  :hover.team-container {\\r\\n    background: #2c002f;\\r\\n    background: #140921;\\r\\n  }\\r\\n  nav {\\r\\n    position: fixed;\\r\\n    width: 220px;\\r\\n    height: 100vh;\\r\\n    background: #37003c;\\r\\n    background: var(--purple);\\r\\n  }\\r\\n  img {\\r\\n    height: 25px;\\r\\n    width: 25px;\\r\\n  }\\r\\n  .close-btn {\\r\\n    position: absolute;\\r\\n    right: 0.9em;\\r\\n    bottom: 0.6em;\\r\\n    background: transparent;\\r\\n    border: none;\\r\\n    outline: none;\\r\\n    padding-top: 0.3em;\\r\\n    cursor: pointer;\\r\\n  }\\r\\n\\r\\n  @keyframes load {\\r\\n    from {\\r\\n      left: -100px;\\r\\n    }\\r\\n    to {\\r\\n      left: 100px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1200px) {\\r\\n    #navBar {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAoDE,qBAAO,CACL,KAAK,CAAE,KAAK,CACZ,SAAS,CAAE,KAAK,CAChB,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MACf,CACA,4BAAc,CACZ,KAAK,CAAE,KAAK,CACZ,QAAQ,CAAE,QAAQ,CAClB,SAAS,CAAE,MAAM,CACjB,GAAG,CAAE,IAAI,CACT,KAAK,CAAE,IACT,CACA,4BAAc,CACZ,WAAW,CAAE,IAAI,CACjB,mBAAmB,CAAE,IAAI,CACzB,gBAAgB,CAAE,IACpB,CACA,0BAAY,CACV,SAAS,CAAE,GAAG,CACd,KAAK,CAAE,IAAI,MAAM,CAAC,CAClB,OAAO,CAAE,IACX,CACA,qBAAO,CACL,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OAAO,CAChB,UAAU,CAAE,IACd,CACA,yBAAU,CACV,8BAAgB,CACd,OAAO,CAAE,KAAK,CAAC,KACjB,CAEA,mCAAqB,CACnB,KAAK,CAAE,IAAI,QAAQ,CAAC,CACpB,UAAU,CAAE,IAAI,OAAO,CACzB,CAEA,MAAM,8BAAgB,CACpB,UAAU,CAAE,OAAO,CACnB,UAAU,CAAE,OACd,CACA,kBAAI,CACF,QAAQ,CAAE,KAAK,CACf,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,OAAO,CACnB,UAAU,CAAE,IAAI,QAAQ,CAC1B,CACA,kBAAI,CACF,MAAM,CAAE,IAAI,CACZ,KAAK,CAAE,IACT,CACA,yBAAW,CACT,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,WAAW,CACvB,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,KAAK,CAClB,MAAM,CAAE,OACV,CAEA,WAAW,mBAAK,CACd,IAAK,CACH,IAAI,CAAE,MACR,CACA,EAAG,CACD,IAAI,CAAE,KACR,CACF,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,sBAAQ,CACN,OAAO,CAAE,IACX,CACF\"}"
};

const FantasyNav = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { currentPage, pages, switchPage } = $$props;
	if ($$props.currentPage === void 0 && $$bindings.currentPage && currentPage !== void 0) $$bindings.currentPage(currentPage);
	if ($$props.pages === void 0 && $$bindings.pages && pages !== void 0) $$bindings.pages(pages);
	if ($$props.switchPage === void 0 && $$bindings.switchPage && switchPage !== void 0) $$bindings.switchPage(switchPage);
	$$result.css.add(css$4);

	return `<nav id="navBar" class="svelte-1esiuxe"><div class="title no-selection svelte-1esiuxe"><p><span style="color: var(--green)">pl</span>dashboard
    </p>
    <div class="fantasy-logo svelte-1esiuxe">Fantasy</div></div>
  <div class="team-links svelte-1esiuxe">${each(pages, (_page, _) => {
		return `${_page === currentPage
		? `<a href="${"/fantasy" + escape(_page === 'all' ? '' : '/' + _page, true)}" class="team-link"><div class="this-team-container svelte-1esiuxe"><div class="this-team-name svelte-1esiuxe">${escape(_page[0].toUpperCase() + _page.slice(1))}
            </div></div>
        </a>`
		: `<button class="team-link svelte-1esiuxe"><div class="team-container svelte-1esiuxe"><div class="team-name svelte-1esiuxe">${escape(_page[0].toUpperCase() + _page.slice(1))}
            </div></div>
        </button>`}`;
	})}</div>
  <div class="close"><button class="close-btn svelte-1esiuxe"><img src="img/arrow-bar-left.svg" alt="" class="svelte-1esiuxe"></button></div>
</nav>`;
});

/* src\components\nav\FantasyMobileNav.svelte generated by Svelte v3.59.2 */

const css$3 = {
	code: "#mobileNav.svelte-1my4j6l{position:fixed;z-index:2;overflow:hidden;height:100vh;animation:svelte-1my4j6l-appear 0.1s ease-in 1;display:none}.team-links.svelte-1my4j6l{display:flex;flex-direction:column;height:100%}.team-link.svelte-1my4j6l{color:inherit;background:inherit;cursor:pointer;border:none;font-size:1em;padding:0.4em;flex:1;color:#1c0d2d;background:#00fe87}.attack.svelte-1my4j6l{background:var(--pink)}.defence.svelte-1my4j6l{background:#2dbaff}.goalkeeper.svelte-1my4j6l{background:#280936;color:white}@keyframes svelte-1my4j6l-appear{from{width:0%}to{width:100%}}",
	map: "{\"version\":3,\"file\":\"FantasyMobileNav.svelte\",\"sources\":[\"FantasyMobileNav.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function switchTeamToTop(page) {\\r\\n    switchPage(page);\\r\\n    window.scrollTo(0, 0);\\r\\n    toggleMobileNav();\\r\\n}\\r\\nexport let currentPage, pages, switchPage, toggleMobileNav;\\r\\n</script>\\r\\n\\r\\n<nav id=\\\"mobileNav\\\" style=\\\"width: 0%;\\\">\\r\\n  {#if pages != undefined}\\r\\n    <div class=\\\"team-links\\\">\\r\\n      {#each pages as page, i}\\r\\n        <button\\r\\n          on:click={() => {\\r\\n            switchTeamToTop(page);\\r\\n          }}\\r\\n          class=\\\"team-link {page.toLowerCase()}\\\"\\r\\n          >{pages[i][0].toUpperCase() + pages[i].slice(1)}</button\\r\\n        >\\r\\n      {/each}\\r\\n    </div>\\r\\n  {/if}\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  #mobileNav {\\r\\n    position: fixed;\\r\\n    z-index: 2;\\r\\n    overflow: hidden;\\r\\n    height: 100vh;\\r\\n    animation: appear 0.1s ease-in 1;\\r\\n    display: none;\\r\\n  }\\r\\n  .team-links {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    height: 100%;\\r\\n  }\\r\\n  .team-link {\\r\\n    color: inherit;\\r\\n    background: inherit;\\r\\n    cursor: pointer;\\r\\n    border: none;\\r\\n    font-size: 1em;\\r\\n    padding: 0.4em;\\r\\n    flex: 1;\\r\\n    color: #1c0d2d;\\r\\n    background: #00fe87;\\r\\n  }\\r\\n  .attack {\\r\\n    background: var(--pink);\\r\\n  }\\r\\n  .defence {\\r\\n    background: #2dbaff;\\r\\n  }\\r\\n  .goalkeeper {\\r\\n    background: #280936;\\r\\n    color: white;\\r\\n  }\\r\\n  @keyframes appear {\\r\\n    from {\\r\\n      width: 0%;\\r\\n    }\\r\\n\\r\\n    to {\\r\\n      width: 100%;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAyBE,yBAAW,CACT,QAAQ,CAAE,KAAK,CACf,OAAO,CAAE,CAAC,CACV,QAAQ,CAAE,MAAM,CAChB,MAAM,CAAE,KAAK,CACb,SAAS,CAAE,qBAAM,CAAC,IAAI,CAAC,OAAO,CAAC,CAAC,CAChC,OAAO,CAAE,IACX,CACA,0BAAY,CACV,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,IACV,CACA,yBAAW,CACT,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,OAAO,CACnB,MAAM,CAAE,OAAO,CACf,MAAM,CAAE,IAAI,CACZ,SAAS,CAAE,GAAG,CACd,OAAO,CAAE,KAAK,CACd,IAAI,CAAE,CAAC,CACP,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,OACd,CACA,sBAAQ,CACN,UAAU,CAAE,IAAI,MAAM,CACxB,CACA,uBAAS,CACP,UAAU,CAAE,OACd,CACA,0BAAY,CACV,UAAU,CAAE,OAAO,CACnB,KAAK,CAAE,KACT,CACA,WAAW,qBAAO,CAChB,IAAK,CACH,KAAK,CAAE,EACT,CAEA,EAAG,CACD,KAAK,CAAE,IACT,CACF\"}"
};

const FantasyMobileNav = create_ssr_component(($$result, $$props, $$bindings, slots) => {

	let { currentPage, pages, switchPage, toggleMobileNav } = $$props;
	if ($$props.currentPage === void 0 && $$bindings.currentPage && currentPage !== void 0) $$bindings.currentPage(currentPage);
	if ($$props.pages === void 0 && $$bindings.pages && pages !== void 0) $$bindings.pages(pages);
	if ($$props.switchPage === void 0 && $$bindings.switchPage && switchPage !== void 0) $$bindings.switchPage(switchPage);
	if ($$props.toggleMobileNav === void 0 && $$bindings.toggleMobileNav && toggleMobileNav !== void 0) $$bindings.toggleMobileNav(toggleMobileNav);
	$$result.css.add(css$3);

	return `<nav id="mobileNav" style="width: 0%;" class="svelte-1my4j6l">${pages != undefined
	? `<div class="team-links svelte-1my4j6l">${each(pages, (page, i) => {
			return `<button class="${"team-link " + escape(page.toLowerCase(), true) + " svelte-1my4j6l"}">${escape(pages[i][0].toUpperCase() + pages[i].slice(1))}</button>`;
		})}</div>`
	: ``}
</nav>`;
});

/* src\components\fantasy\PointsVsPrice.svelte generated by Svelte v3.59.2 */

function getColours(position) {
	switch (position) {
		case "Forward":
			return "#c600d8";
		case "Midfielder":
			return "#00fe87";
		case "Defender":
			return "#2dbaff";
		case "Goalkeeper":
			return "#280936";
	}
}

function lines(data) {
	const teams = [];
	const points = [];
	const price = [];
	const minutes = [];
	const colours = [];
	let maxMinutes = 0;

	for (const team of Object.keys(data)) {
		if (team != "_id") {
			teams.push(team);

			points.push(data[team].totalPoints === null
			? 0
			: data[team].totalPoints);

			price.push(data[team].price == null ? 0 : data[team].price / 10);
			minutes.push(data[team].minutes == null ? 0 : data[team].minutes / 2);

			if (minutes[minutes.length - 1] > maxMinutes) {
				maxMinutes = minutes[minutes.length - 1];
			}

			colours.push(getColours(data[team].position));
		}
	}

	let sizes = minutes.slice(0);

	for (let i = 0; i < sizes.length; i++) {
		sizes[i] /= maxMinutes * 0.02;
	}

	// sizes.map((x) => {
	//   return (x / maxMinutes) * sizeScale;
	// });
	const playtimes = minutes.map(x => (x / maxMinutes * 100).toFixed(1));

	const markers = {
		x: points,
		y: price,
		name: "test",
		mode: "markers",
		type: "scatter",
		marker: {
			size: sizes,
			// colorscale: [
			//   [0, "#00fe87"],
			//   [0.5, "#f3f3f3"],
			//   [1, "#f83027"],
			// ],
			opacity: 0.75,
			color: colours
		},
		customdata: playtimes,
		text: teams,
		hovertemplate: `<b>%{text}</b><br><b>£%{y}m</b><br><b>%{x} points</b><br>%{customdata}% playtime<extra></extra>`,
		showlegend: false
	};

	// Add this team last to ensure it overlaps all other lines
	return [markers];
}

function defaultLayout() {
	return {
		title: false,
		autosize: true,
		margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
		hovermode: "closest",
		plot_bgcolor: "transparent",
		paper_bgcolor: "transparent",
		height: 700,
		yaxis: {
			title: { text: "Price" },
			gridcolor: "gray",
			showgrid: false,
			showline: false,
			zeroline: false,
			fixedrange: true,
			visible: true
		},
		xaxis: {
			title: { text: "Points" },
			linecolor: "black",
			showgrid: false,
			showline: false,
			fixedrange: true
		},
		dragmode: false
	};
}

function buildPlotData(data) {
	let plotData = {
		data: lines(data),
		layout: defaultLayout(),
		config: {
			responsive: true,
			showSendToCloud: false,
			displayModeBar: false
		}
	};

	return plotData;
}

const PointsVsPrice = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function setDefaultLayout() {
		if (setup) {
			const layoutUpdate = {
				"yaxis.title": { text: "Position" },
				"yaxis.visible": true,
				"yaxis.tickvals": Array.from(Array(20), (_, i) => i + 1),
				"margin.l": 60,
				"margin.t": 15
			};

			//@ts-ignore
			Plotly.update(plotDiv, {}, layoutUpdate, 0);
		}
	}

	function setMobileLayout() {
		if (setup) {
			const layoutUpdate = {
				"yaxis.title": null,
				"yaxis.visible": false,
				"yaxis.tickvals": Array.from(Array(10), (_, i) => i + 2),
				"margin.l": 20,
				"margin.t": 5
			};

			const sizes = plotData.data[0].marker.size;

			for (let i = 0; i < sizes.length; i++) {
				sizes[i] = Math.round(sizes[i] / 2);
			}

			const dataUpdate = {
				marker: {
					size: sizes,
					color: plotData.data[0].marker.color,
					opacity: 0.75
				}
			};

			plotData.data[0].marker.size = sizes;

			//@ts-ignore
			Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data);

		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");

			plot.children[0].children[0].classList.add("tall-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			let newPlotData = buildPlotData(data);
			plotData.data[0] = newPlotData.data[0];

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, page, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.page === void 0 && $$bindings.page && page !== void 0) $$bindings.page(page);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	page && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="plotly"><div id="plotDiv"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\fantasy\Table.svelte generated by Svelte v3.59.2 */

const css$2 = {
	code: ".table.svelte-10wi54{padding:50px 30px;overflow-x:auto}#myTable.svelte-10wi54{width:100% !important}tr.even{background:rgb(239, 239, 239) !important}@media only screen and (max-width: 700px){.table.svelte-10wi54{padding:0;font-size:0.85em}}",
	map: "{\"version\":3,\"file\":\"Table.svelte\",\"sources\":[\"Table.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { onMount } from \\\"svelte\\\";\\r\\nfunction teamToCSS(team) {\\r\\n    switch (team) {\\r\\n        case \\\"Spurs\\\":\\r\\n            return \\\"tottenham-hotspur\\\";\\r\\n        case 'Nott\\\\'m Forest':\\r\\n            return \\\"nottingham-forest\\\";\\r\\n        case 'Man Utd':\\r\\n            return \\\"manchester-united\\\";\\r\\n        case 'Man City':\\r\\n            return \\\"manchester-city\\\";\\r\\n        case 'Brighton':\\r\\n            return 'brighton-and-hove-albion';\\r\\n        case 'Luton':\\r\\n            return 'luton-town';\\r\\n        case 'West Ham':\\r\\n            return 'west-ham-united';\\r\\n        case 'Sheffield Utd':\\r\\n            return 'sheffield-united';\\r\\n        case 'Wolves':\\r\\n            return 'wolverhampton-wanderers';\\r\\n        case 'Newcastle':\\r\\n            return 'newcastle-united';\\r\\n    }\\r\\n    return team.toLowerCase().replace(' ', '-');\\r\\n}\\r\\nfunction buildTeamColourCSSTags() {\\r\\n    const playerTeams = {};\\r\\n    const teamCSS = {};\\r\\n    for (const name of Object.keys(data)) {\\r\\n        if (name === \\\"_id\\\") {\\r\\n            continue;\\r\\n        }\\r\\n        const team = data[name].team;\\r\\n        const fullName = `${data[name].firstName} ${data[name].surname}`;\\r\\n        playerTeams[fullName] = team;\\r\\n        teamCSS[team] = teamToCSS(team);\\r\\n    }\\r\\n    playerToTeam = playerTeams;\\r\\n    teamCSSTag = teamCSS;\\r\\n}\\r\\nfunction getTableRows(data) {\\r\\n    const tableRows = [];\\r\\n    for (const name of Object.keys(data)) {\\r\\n        if (name === \\\"_id\\\") {\\r\\n            continue;\\r\\n        }\\r\\n        // console.log(name, data[name].points, data[name].minutes, data[name].minutes/90, data[name].points / (data[name].minutes/90))\\r\\n        const player = [\\r\\n            `${data[name].firstName} ${data[name].surname}`,\\r\\n            `£${data[name].price / 10}`,\\r\\n            data[name].totalPoints,\\r\\n            data[name].minutes,\\r\\n            data[name].pointsPerGame,\\r\\n            data[name].minutes > 0 ? parseFloat((data[name].points / (data[name].minutes / 90)).toFixed(1)) : 0,\\r\\n            data[name].form,\\r\\n            data[name].goals,\\r\\n            data[name].assists,\\r\\n            data[name].cleanSheets,\\r\\n            data[name].saves,\\r\\n            data[name].bonusPoints,\\r\\n            // data[team].yellowCards,\\r\\n            // data[team].redCards,\\r\\n            data[name].transferIn.toLocaleString(),\\r\\n            data[name].transferOut.toLocaleString()\\r\\n        ];\\r\\n        tableRows.push(player);\\r\\n    }\\r\\n    return tableRows;\\r\\n}\\r\\nfunction buildTable(data) {\\r\\n    let tableRows = getTableRows(data);\\r\\n    // @ts-ignore\\r\\n    table = new DataTable(\\\"#myTable\\\", {\\r\\n        responsive: true,\\r\\n        data: tableRows,\\r\\n        paging: false,\\r\\n        columnDefs: [{\\r\\n                targets: 0,\\r\\n                createdCell: function (td, cellData, rowData, row, col) {\\r\\n                    const team = playerToTeam[cellData];\\r\\n                    td.style.background = `var(--${teamCSSTag[team]})`;\\r\\n                    td.style.color = `var(--${teamCSSTag[team]}-secondary)`;\\r\\n                    td.title = team;\\r\\n                }\\r\\n            }]\\r\\n    });\\r\\n    table.order([2, 'desc']).draw();\\r\\n}\\r\\nfunction refreshTable(data) {\\r\\n    if (setup) {\\r\\n        buildTeamColourCSSTags();\\r\\n        let tableRows = getTableRows(data);\\r\\n        table.clear();\\r\\n        table.rows.add(tableRows);\\r\\n        table.draw();\\r\\n    }\\r\\n}\\r\\nlet table;\\r\\nlet playerToTeam;\\r\\nlet teamCSSTag;\\r\\nlet setup = false;\\r\\nonMount(() => {\\r\\n    buildTeamColourCSSTags();\\r\\n    buildTable(data);\\r\\n    setup = true;\\r\\n});\\r\\n$: page && refreshTable(data);\\r\\n//   $: !mobileView && setDefaultLayout();\\r\\n//   $: setup && mobileView && setMobileLayout();\\r\\nexport let data, page, mobileView;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"table\\\">\\r\\n  <table id=\\\"myTable\\\">\\r\\n    <thead>\\r\\n      <tr>\\r\\n        <th>Name</th>\\r\\n        <th>Price</th>\\r\\n        <th>Points</th>\\r\\n        <th>Minutes</th>\\r\\n        <th>Points per Game</th>\\r\\n        <th>Points per 90</th>\\r\\n        <th>Form</th>\\r\\n        <th>Goals</th>\\r\\n        <th>Assists</th>\\r\\n        <th>Clean Sheets</th>\\r\\n        <th>Saves</th>\\r\\n        <th>Bonus</th>\\r\\n        <!-- <th>Yellow Cards</th>\\r\\n        <th>Red Cards</th> -->\\r\\n        <th>Transfers In</th>\\r\\n        <th>Transfers Out</th>\\r\\n      </tr>\\r\\n    </thead>\\r\\n    <tbody />\\r\\n  </table>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .table {\\r\\n    padding: 50px 30px;\\r\\n    overflow-x: auto;\\r\\n  }\\r\\n  \\r\\n  #myTable {\\r\\n    width: 100% !important;\\r\\n    /* min-width: 2000px; */\\r\\n  }\\r\\n\\r\\n  :global(tr.even) {\\r\\n    background: rgb(239, 239, 239) !important;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .table {\\r\\n      padding: 0;\\r\\n      font-size: 0.85em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA4IE,oBAAO,CACL,OAAO,CAAE,IAAI,CAAC,IAAI,CAClB,UAAU,CAAE,IACd,CAEA,sBAAS,CACP,KAAK,CAAE,IAAI,CAAC,UAEd,CAEQ,OAAS,CACf,UAAU,CAAE,IAAI,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,UACjC,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,oBAAO,CACL,OAAO,CAAE,CAAC,CACV,SAAS,CAAE,MACb,CACF\"}"
};

function teamToCSS(team) {
	switch (team) {
		case "Spurs":
			return "tottenham-hotspur";
		case 'Nott\'m Forest':
			return "nottingham-forest";
		case 'Man Utd':
			return "manchester-united";
		case 'Man City':
			return "manchester-city";
		case 'Brighton':
			return 'brighton-and-hove-albion';
		case 'Luton':
			return 'luton-town';
		case 'West Ham':
			return 'west-ham-united';
		case 'Sheffield Utd':
			return 'sheffield-united';
		case 'Wolves':
			return 'wolverhampton-wanderers';
		case 'Newcastle':
			return 'newcastle-united';
	}

	return team.toLowerCase().replace(' ', '-');
}

function getTableRows(data) {
	const tableRows = [];

	for (const name of Object.keys(data)) {
		if (name === "_id") {
			continue;
		}

		// console.log(name, data[name].points, data[name].minutes, data[name].minutes/90, data[name].points / (data[name].minutes/90))
		const player = [
			`${data[name].firstName} ${data[name].surname}`,
			`£${data[name].price / 10}`,
			data[name].totalPoints,
			data[name].minutes,
			data[name].pointsPerGame,
			data[name].minutes > 0
			? parseFloat((data[name].points / (data[name].minutes / 90)).toFixed(1))
			: 0,
			data[name].form,
			data[name].goals,
			data[name].assists,
			data[name].cleanSheets,
			data[name].saves,
			data[name].bonusPoints,
			// data[team].yellowCards,
			// data[team].redCards,
			data[name].transferIn.toLocaleString(),
			data[name].transferOut.toLocaleString()
		];

		tableRows.push(player);
	}

	return tableRows;
}

const Table = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildTeamColourCSSTags() {
		const playerTeams = {};
		const teamCSS = {};

		for (const name of Object.keys(data)) {
			if (name === "_id") {
				continue;
			}

			const team = data[name].team;
			const fullName = `${data[name].firstName} ${data[name].surname}`;
			playerTeams[fullName] = team;
			teamCSS[team] = teamToCSS(team);
		}

		playerToTeam = playerTeams;
		teamCSSTag = teamCSS;
	}

	function buildTable(data) {
		let tableRows = getTableRows(data);

		// @ts-ignore
		table = new DataTable("#myTable",
		{
				responsive: true,
				data: tableRows,
				paging: false,
				columnDefs: [
					{
						targets: 0,
						createdCell(td, cellData, rowData, row, col) {
							const team = playerToTeam[cellData];
							td.style.background = `var(--${teamCSSTag[team]})`;
							td.style.color = `var(--${teamCSSTag[team]}-secondary)`;
							td.title = team;
						}
					}
				]
			});

		table.order([2, 'desc']).draw();
	}

	function refreshTable(data) {
		if (setup) {
			buildTeamColourCSSTags();
			let tableRows = getTableRows(data);
			table.clear();
			table.rows.add(tableRows);
			table.draw();
		}
	}

	let table;
	let playerToTeam;
	let teamCSSTag;
	let setup = false;

	onMount(() => {
		buildTeamColourCSSTags();
		buildTable(data);
		setup = true;
	});

	let { data, page, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.page === void 0 && $$bindings.page && page !== void 0) $$bindings.page(page);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	$$result.css.add(css$2);
	page && refreshTable(data);

	return `<div class="table svelte-10wi54"><table id="myTable" class="svelte-10wi54"><thead><tr><th>Name</th>
        <th>Price</th>
        <th>Points</th>
        <th>Minutes</th>
        <th>Points per Game</th>
        <th>Points per 90</th>
        <th>Form</th>
        <th>Goals</th>
        <th>Assists</th>
        <th>Clean Sheets</th>
        <th>Saves</th>
        <th>Bonus</th>
        
        <th>Transfers In</th>
        <th>Transfers Out</th></tr></thead>
    <tbody></tbody></table>
</div>`;
});

/* src\routes\Fantasy.svelte generated by Svelte v3.59.2 */

const css$1 = {
	code: "#team.svelte-1l590fp{display:flex;overflow-x:hidden;font-size:15px}#dashboard.svelte-1l590fp{margin-left:220px;width:100%}#mobileNavBtn.svelte-1l590fp{position:fixed;color:white;background:var(--purple);padding:0.8em 0;cursor:pointer;font-size:1.1em;z-index:1;width:100%;bottom:0;border:none;margin-bottom:-1px}@media only screen and (min-width: 1200px){#mobileNavBtn.svelte-1l590fp{display:none}}@media only screen and (max-width: 1200px){#dashboard.svelte-1l590fp{margin-left:0}}",
	map: "{\"version\":3,\"file\":\"Fantasy.svelte\",\"sources\":[\"Fantasy.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from \\\"svelte-routing\\\";\\r\\nimport { onMount } from \\\"svelte\\\";\\r\\nimport FantasyNav from \\\"../components/nav/FantasyNav.svelte\\\";\\r\\nimport FantasyMobileNav from \\\"../components/nav/FantasyMobileNav.svelte\\\";\\r\\nimport PointsVsPrice from \\\"../components/fantasy/PointsVsPrice.svelte\\\";\\r\\nimport Footer from \\\"../components/Footer.svelte\\\";\\r\\nimport Table from \\\"../components/fantasy/Table.svelte\\\";\\r\\nimport { url } from \\\"../lib/consts\\\";\\r\\nfunction toggleMobileNav() {\\r\\n    let mobileNav = document.getElementById(\\\"mobileNav\\\");\\r\\n    if (mobileNav.style.width === \\\"0%\\\") {\\r\\n        mobileNav.style.display = \\\"block\\\";\\r\\n        mobileNav.style.width = \\\"100%\\\";\\r\\n    }\\r\\n    else {\\r\\n        mobileNav.style.display = \\\"none\\\";\\r\\n        mobileNav.style.width = \\\"0%\\\";\\r\\n    }\\r\\n}\\r\\nasync function initFantasy() {\\r\\n    if (page === undefined) {\\r\\n        page = pages[0];\\r\\n    }\\r\\n    const response = await fetch(`${url}/fantasy`);\\r\\n    if (!response.ok) {\\r\\n        return;\\r\\n    }\\r\\n    let json = await response.json();\\r\\n    data = json;\\r\\n    pageData = filterDataByPosition(data);\\r\\n    console.log(data);\\r\\n}\\r\\nfunction filterDataByPosition(data) {\\r\\n    let newData = {};\\r\\n    for (let team of Object.keys(data)) {\\r\\n        if (team === \\\"_id\\\" ||\\r\\n            page === \\\"all\\\" ||\\r\\n            (page === \\\"attack\\\" && data[team].position === \\\"Forward\\\") ||\\r\\n            (page === \\\"midfield\\\" && data[team].position === \\\"Midfielder\\\") ||\\r\\n            (page === \\\"defence\\\" && data[team].position === \\\"Defender\\\") ||\\r\\n            (page === \\\"goalkeeper\\\" && data[team].position === \\\"Goalkeeper\\\"))\\r\\n            newData[team] = data[team];\\r\\n    }\\r\\n    return newData;\\r\\n}\\r\\nfunction abbrNum(number, decPlaces) {\\r\\n    // 2 decimal places => 100, 3 => 1000, etc\\r\\n    decPlaces = Math.pow(10, decPlaces);\\r\\n    // Enumerate number abbreviations\\r\\n    var abbrev = [\\\"k\\\", \\\"m\\\", \\\"b\\\", \\\"t\\\"];\\r\\n    // Go through the array backwards, so we do the largest first\\r\\n    for (var i = abbrev.length - 1; i >= 0; i--) {\\r\\n        // Convert array index to \\\"1000\\\", \\\"1000000\\\", etc\\r\\n        var size = Math.pow(10, (i + 1) * 3);\\r\\n        // If the number is bigger or equal do the abbreviation\\r\\n        if (size <= number) {\\r\\n            // Here, we multiply by decPlaces, round, and then divide by decPlaces.\\r\\n            // This gives us nice rounding to a particular decimal place.\\r\\n            number = Math.round((number * decPlaces) / size) / decPlaces;\\r\\n            // Handle special case where we round up to the next abbreviation\\r\\n            if (number == 1000 && i < abbrev.length - 1) {\\r\\n                number = 1;\\r\\n                i++;\\r\\n            }\\r\\n            // Add the letter for the abbreviation\\r\\n            number += abbrev[i];\\r\\n            // We are done... stop\\r\\n            break;\\r\\n        }\\r\\n    }\\r\\n    return number;\\r\\n}\\r\\nfunction switchPage(newPage) {\\r\\n    page = newPage;\\r\\n    if (page === \\\"all\\\") {\\r\\n        title = \\\"Fantasy\\\";\\r\\n    }\\r\\n    else {\\r\\n        title = `Fantasy | ${page[0].toUpperCase() + page.slice(1)}`;\\r\\n    }\\r\\n    pageData = filterDataByPosition(data);\\r\\n    let nextPage = page;\\r\\n    if (nextPage === \\\"all\\\") {\\r\\n        nextPage = \\\"/fantasy\\\";\\r\\n    }\\r\\n    else if (!window.location.href.endsWith(\\\"/\\\")) {\\r\\n        nextPage = \\\"/fantasy/\\\" + nextPage;\\r\\n    }\\r\\n    window.history.pushState(null, null, nextPage); // Change current url without reloading\\r\\n}\\r\\nlet pages = [\\\"all\\\", \\\"attack\\\", \\\"midfield\\\", \\\"defence\\\", \\\"goalkeeper\\\"];\\r\\nlet title = \\\"Fantasy\\\";\\r\\nlet data;\\r\\nlet pageData;\\r\\nonMount(() => {\\r\\n    initFantasy();\\r\\n    setTimeout(() => {\\r\\n        window.dispatchEvent(new Event(\\\"resize\\\")); // Snap plots to currently set size\\r\\n    }, 1000);\\r\\n});\\r\\nlet pageWidth;\\r\\n$: mobileView = pageWidth <= 700;\\r\\nexport let page;\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>{title}</title>\\r\\n  <meta\\r\\n    name=\\\"description\\\"\\r\\n    content=\\\"Fantasy Premier League Statistics Dashboard\\\"\\r\\n  />\\r\\n</svelte:head>\\r\\n\\r\\n<svelte:window bind:innerWidth={pageWidth} />\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"team\\\">\\r\\n    <FantasyNav currentPage={page} {pages} {switchPage} />\\r\\n    <FantasyMobileNav\\r\\n      currentPage={page}\\r\\n      {pages}\\r\\n      {switchPage}\\r\\n      {toggleMobileNav}\\r\\n    />\\r\\n    {#if pages.length === 0}\\r\\n      <!-- Navigation disabled while teams list are loading -->\\r\\n      <button id=\\\"mobileNavBtn\\\" style=\\\"cursor: default\\\">Menu</button>\\r\\n    {:else}\\r\\n      <button id=\\\"mobileNavBtn\\\" on:click={toggleMobileNav}> Menu </button>\\r\\n    {/if}\\r\\n\\r\\n    <div id=\\\"dashboard\\\">\\r\\n      {#if pageData != undefined}\\r\\n        <div class=\\\"first-graph\\\">\\r\\n          <PointsVsPrice data={pageData} {page} {mobileView} />\\r\\n        </div>\\r\\n\\r\\n        <div class=\\\"table\\\">\\r\\n          <Table data={pageData} {page} {mobileView} />\\r\\n        </div>\\r\\n        <Footer lastUpdated={null} />\\r\\n      {:else}\\r\\n        <div class=\\\"loading-spinner-container\\\">\\r\\n          <div class=\\\"loading-spinner\\\" />\\r\\n        </div>\\r\\n      {/if}\\r\\n    </div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  #team {\\r\\n    display: flex;\\r\\n    overflow-x: hidden;\\r\\n    font-size: 15px;\\r\\n  }\\r\\n  #dashboard {\\r\\n    margin-left: 220px;\\r\\n    width: 100%;\\r\\n  }\\r\\n  #mobileNavBtn {\\r\\n    position: fixed;\\r\\n    color: white;\\r\\n    background: var(--purple);\\r\\n    padding: 0.8em 0;\\r\\n    cursor: pointer;\\r\\n    font-size: 1.1em;\\r\\n    z-index: 1;\\r\\n    width: 100%;\\r\\n    bottom: 0;\\r\\n    border: none;\\r\\n    margin-bottom: -1px; /* For gap at bottom found in safari */\\r\\n  }\\r\\n  @media only screen and (min-width: 1200px) {\\r\\n    #mobileNavBtn {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1200px) {\\r\\n    #dashboard {\\r\\n      margin-left: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAuJE,oBAAM,CACJ,OAAO,CAAE,IAAI,CACb,UAAU,CAAE,MAAM,CAClB,SAAS,CAAE,IACb,CACA,yBAAW,CACT,WAAW,CAAE,KAAK,CAClB,KAAK,CAAE,IACT,CACA,4BAAc,CACZ,QAAQ,CAAE,KAAK,CACf,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE,IAAI,QAAQ,CAAC,CACzB,OAAO,CAAE,KAAK,CAAC,CAAC,CAChB,MAAM,CAAE,OAAO,CACf,SAAS,CAAE,KAAK,CAChB,OAAO,CAAE,CAAC,CACV,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,CAAC,CACT,MAAM,CAAE,IAAI,CACZ,aAAa,CAAE,IACjB,CACA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,4BAAc,CACZ,OAAO,CAAE,IACX,CACF,CACA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAE,CACzC,yBAAW,CACT,WAAW,CAAE,CACf,CACF\"}"
};

function toggleMobileNav() {
	let mobileNav = document.getElementById("mobileNav");

	if (mobileNav.style.width === "0%") {
		mobileNav.style.display = "block";
		mobileNav.style.width = "100%";
	} else {
		mobileNav.style.display = "none";
		mobileNav.style.width = "0%";
	}
}

const Fantasy = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let mobileView;

	async function initFantasy() {
		if (page === undefined) {
			page = pages[0];
		}

		const response = await fetch(`${url}/fantasy`);

		if (!response.ok) {
			return;
		}

		let json = await response.json();
		data = json;
		pageData = filterDataByPosition(data);
		console.log(data);
	}

	function filterDataByPosition(data) {
		let newData = {};

		for (let team of Object.keys(data)) {
			if (team === "_id" || page === "all" || page === "attack" && data[team].position === "Forward" || page === "midfield" && data[team].position === "Midfielder" || page === "defence" && data[team].position === "Defender" || page === "goalkeeper" && data[team].position === "Goalkeeper") newData[team] = data[team];
		}

		return newData;
	}

	function switchPage(newPage) {
		page = newPage;

		if (page === "all") {
			title = "Fantasy";
		} else {
			title = `Fantasy | ${page[0].toUpperCase() + page.slice(1)}`;
		}

		pageData = filterDataByPosition(data);
		let nextPage = page;

		if (nextPage === "all") {
			nextPage = "/fantasy";
		} else if (!window.location.href.endsWith("/")) {
			nextPage = "/fantasy/" + nextPage;
		}

		window.history.pushState(null, null, nextPage); // Change current url without reloading
	}

	let pages = ["all", "attack", "midfield", "defence", "goalkeeper"];
	let title = "Fantasy";
	let data;
	let pageData;

	onMount(() => {
		initFantasy();

		setTimeout(
			() => {
				window.dispatchEvent(new Event("resize")); // Snap plots to currently set size
			},
			1000
		);
	});

	let pageWidth;
	let { page } = $$props;
	if ($$props.page === void 0 && $$bindings.page && page !== void 0) $$bindings.page(page);
	$$result.css.add(css$1);
	mobileView = pageWidth <= 700;

	return `${($$result.head += `${($$result.title = `<title>${escape(title)}</title>`, "")}<meta name="description" content="Fantasy Premier League Statistics Dashboard">`, "")}



${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="team" class="svelte-1l590fp">${validate_component(FantasyNav, "FantasyNav").$$render($$result, { currentPage: page, pages, switchPage }, {}, {})}
    ${validate_component(FantasyMobileNav, "FantasyMobileNav").$$render(
				$$result,
				{
					currentPage: page,
					pages,
					switchPage,
					toggleMobileNav
				},
				{},
				{}
			)}
    ${pages.length === 0
			? `
      <button id="mobileNavBtn" style="cursor: default" class="svelte-1l590fp">Menu</button>`
			: `<button id="mobileNavBtn" class="svelte-1l590fp">Menu </button>`}

    <div id="dashboard" class="svelte-1l590fp">${pageData != undefined
			? `<div class="first-graph">${validate_component(PointsVsPrice, "PointsVsPrice").$$render($$result, { data: pageData, page, mobileView }, {}, {})}</div>

        <div class="table">${validate_component(Table, "Table").$$render($$result, { data: pageData, page, mobileView }, {}, {})}</div>
        ${validate_component(Footer, "Footer").$$render($$result, { lastUpdated: null }, {}, {})}`
			: `<div class="loading-spinner-container"><div class="loading-spinner"></div></div>`}</div></div>`;
		}
	})}`;
});

/* src\routes\Error.svelte generated by Svelte v3.59.2 */

const css = {
	code: "#error.svelte-q4wkyh{display:grid;place-items:center;height:75vh;background:#fafafa}.msg-container.svelte-q4wkyh{background:var(--purple);color:var(--green);border-radius:6px;padding:0.5em 1em 0.5em 1em;font-size:2em}@media only screen and (max-width: 600px){#error.svelte-q4wkyh{height:85vh}.msg-container.svelte-q4wkyh{font-size:1.5em}}",
	map: "{\"version\":3,\"file\":\"Error.svelte\",\"sources\":[\"Error.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from \\\"svelte-routing\\\";\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Premier League</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"error\\\">\\r\\n    <div class=\\\"msg-container\\\">Error: Page not found</div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  #error {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    height: 75vh;\\r\\n    background: #fafafa;\\r\\n  }\\r\\n  .msg-container {\\r\\n    background: var(--purple);\\r\\n    color: var(--green);\\r\\n    border-radius: 6px;\\r\\n    padding: 0.5em 1em 0.5em 1em;\\r\\n    font-size: 2em;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 600px) {\\r\\n    #error {\\r\\n      height: 85vh;\\r\\n    }\\r\\n    .msg-container {\\r\\n      font-size: 1.5em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAeE,oBAAO,CACL,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,MAAM,CAAE,IAAI,CACZ,UAAU,CAAE,OACd,CACA,4BAAe,CACb,UAAU,CAAE,IAAI,QAAQ,CAAC,CACzB,KAAK,CAAE,IAAI,OAAO,CAAC,CACnB,aAAa,CAAE,GAAG,CAClB,OAAO,CAAE,KAAK,CAAC,GAAG,CAAC,KAAK,CAAC,GAAG,CAC5B,SAAS,CAAE,GACb,CAEA,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAE,CACxC,oBAAO,CACL,MAAM,CAAE,IACV,CACA,4BAAe,CACb,SAAS,CAAE,KACb,CACF\"}"
};

const Error$1 = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css);

	return `${($$result.head += `${($$result.title = `<title>Premier League</title>`, "")}<meta name="description" content="Premier League Statistics Dashboard">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="error" class="svelte-q4wkyh"><div class="msg-container svelte-q4wkyh">Error: Page not found</div></div>`;
		}
	})}`;
});

/* src\App.svelte generated by Svelte v3.59.2 */

const App = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { url = "" } = $$props;
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);

	return `${validate_component(Router, "Router").$$render($$result, { url }, {}, {
		default: () => {
			return `${validate_component(Route, "Route").$$render($$result, { path: "/" }, {}, {
				default: () => {
					return `${validate_component(Dashboard, "Dashboard").$$render($$result, { slug: null }, {}, {})}`;
				}
			})}
  ${validate_component(Route, "Route").$$render($$result, { path: "/:team" }, {}, {
				default: ({ params }) => {
					return `${validate_component(Dashboard, "Dashboard").$$render($$result, { slug: params.team }, {}, {})}`;
				}
			})}
  ${validate_component(Route, "Route").$$render(
				$$result,
				{
					path: "/predictions",
					component: Predictions
				},
				{},
				{}
			)}
  ${validate_component(Route, "Route").$$render($$result, { path: "/home", component: Home }, {}, {})}
  ${validate_component(Route, "Route").$$render($$result, { path: "/fantasy/:page" }, {}, {
				default: ({ params }) => {
					return `${validate_component(Fantasy, "Fantasy").$$render($$result, { page: params.page }, {}, {})}`;
				}
			})}
  ${validate_component(Route, "Route").$$render($$result, { path: "/fantasy", component: Fantasy }, {}, {})}
  ${validate_component(Route, "Route").$$render($$result, { path: "/error", component: Error$1 }, {}, {})}`;
		}
	})}`;
});

export { App as default };
