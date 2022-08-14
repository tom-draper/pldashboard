'use strict';

function noop() { }
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
function compute_rest_props(props, keys) {
    const rest = {};
    keys = new Set(keys);
    for (const k in props)
        if (!keys.has(k) && k[0] !== '$')
            rest[k] = props[k];
    return rest;
}
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, cancelable, detail);
    return e;
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
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail, { cancelable = false } = {}) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail, { cancelable });
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
            return !event.defaultPrevented;
        }
        return true;
    };
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
    return context;
}
function getContext(key) {
    return get_current_component().$$.context.get(key);
}
Promise.resolve();

// source: https://html.spec.whatwg.org/multipage/indices.html
const boolean_attributes = new Set([
    'allowfullscreen',
    'allowpaymentrequest',
    'async',
    'autofocus',
    'autoplay',
    'checked',
    'controls',
    'default',
    'defer',
    'disabled',
    'formnovalidate',
    'hidden',
    'ismap',
    'loop',
    'multiple',
    'muted',
    'nomodule',
    'novalidate',
    'open',
    'playsinline',
    'readonly',
    'required',
    'reversed',
    'selected'
]);

const invalid_attribute_name_character = /[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
// https://infra.spec.whatwg.org/#noncharacter
function spread(args, attrs_to_add) {
    const attributes = Object.assign({}, ...args);
    if (attrs_to_add) {
        const classes_to_add = attrs_to_add.classes;
        const styles_to_add = attrs_to_add.styles;
        if (classes_to_add) {
            if (attributes.class == null) {
                attributes.class = classes_to_add;
            }
            else {
                attributes.class += ' ' + classes_to_add;
            }
        }
        if (styles_to_add) {
            if (attributes.style == null) {
                attributes.style = style_object_to_string(styles_to_add);
            }
            else {
                attributes.style = style_object_to_string(merge_ssr_styles(attributes.style, styles_to_add));
            }
        }
    }
    let str = '';
    Object.keys(attributes).forEach(name => {
        if (invalid_attribute_name_character.test(name))
            return;
        const value = attributes[name];
        if (value === true)
            str += ' ' + name;
        else if (boolean_attributes.has(name.toLowerCase())) {
            if (value)
                str += ' ' + name;
        }
        else if (value != null) {
            str += ` ${name}="${value}"`;
        }
    });
    return str;
}
function merge_ssr_styles(style_attribute, style_directive) {
    const style_object = {};
    for (const individual_style of style_attribute.split(';')) {
        const colon_index = individual_style.indexOf(':');
        const name = individual_style.slice(0, colon_index).trim();
        const value = individual_style.slice(colon_index + 1).trim();
        if (!name)
            continue;
        style_object[name] = value;
    }
    for (const name in style_directive) {
        const value = style_directive[name];
        if (value) {
            style_object[name] = value;
        }
        else {
            delete style_object[name];
        }
    }
    return style_object;
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
function escape_attribute_value(value) {
    // keep booleans, null, and undefined for the sake of `spread`
    const should_escape = typeof value === 'string' || (value && typeof value === 'object');
    return should_escape ? escape(value, true) : value;
}
function escape_object(obj) {
    const result = {};
    for (const key in obj) {
        result[key] = escape_attribute_value(obj[key]);
    }
    return result;
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
        throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
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
function style_object_to_string(style_object) {
    return Object.keys(style_object)
        .filter(key => style_object[key])
        .map(key => `${key}: ${style_object[key]};`)
        .join(' ');
}

const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe
    };
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
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
            if (subscribers.size === 0) {
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
        let inited = false;
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
            if (inited) {
                sync();
            }
        }, () => {
            pending |= (1 << i);
        }));
        inited = true;
        sync();
        return function stop() {
            run_all(unsubscribers);
            cleanup();
        };
    });
}

const LOCATION = {};
const ROUTER = {};

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

function getLocation(source) {
  return {
    ...source.location,
    state: source.history.state,
    key: (source.history.state && source.history.state.key) || "initial"
  };
}

function createHistory(source, options) {
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
        if (replace) {
          source.history.replaceState(state, null, to);
        } else {
          source.history.pushState(state, null, to);
        }
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to);
      }

      location = getLocation(source);
      listeners.forEach(listener => listener({ location, action: "PUSH" }));
    }
  };
}

// Stores history entries in memory for testing or other platforms like Native
function createMemorySource(initialPathname = "/") {
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
      }
    }
  };
}

// Global history uses window.history as the source if available,
// otherwise a memory history
const canUseDOM = Boolean(
  typeof window !== "undefined" &&
    window.document &&
    window.document.createElement
);
const globalHistory = createHistory(canUseDOM ? window : createMemorySource());

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

const paramRe = /^:(.+)/;

const SEGMENT_POINTS = 4;
const STATIC_POINTS = 3;
const DYNAMIC_POINTS = 2;
const SPLAT_PENALTY = 1;
const ROOT_POINTS = 1;

/**
 * Check if `string` starts with `search`
 * @param {string} string
 * @param {string} search
 * @return {boolean}
 */
function startsWith(string, search) {
  return string.substr(0, search.length) === search;
}

/**
 * Check if `segment` is a root segment
 * @param {string} segment
 * @return {boolean}
 */
function isRootSegment(segment) {
  return segment === "";
}

/**
 * Check if `segment` is a dynamic segment
 * @param {string} segment
 * @return {boolean}
 */
function isDynamic(segment) {
  return paramRe.test(segment);
}

/**
 * Check if `segment` is a splat
 * @param {string} segment
 * @return {boolean}
 */
function isSplat(segment) {
  return segment[0] === "*";
}

/**
 * Split up the URI into segments delimited by `/`
 * @param {string} uri
 * @return {string[]}
 */
function segmentize(uri) {
  return (
    uri
      // Strip starting/ending `/`
      .replace(/(^\/+|\/+$)/g, "")
      .split("/")
  );
}

/**
 * Strip `str` of potential start and end `/`
 * @param {string} str
 * @return {string}
 */
function stripSlashes(str) {
  return str.replace(/(^\/+|\/+$)/g, "");
}

/**
 * Score a route depending on how its individual segments look
 * @param {object} route
 * @param {number} index
 * @return {object}
 */
function rankRoute(route, index) {
  const score = route.default
    ? 0
    : segmentize(route.path).reduce((score, segment) => {
        score += SEGMENT_POINTS;

        if (isRootSegment(segment)) {
          score += ROOT_POINTS;
        } else if (isDynamic(segment)) {
          score += DYNAMIC_POINTS;
        } else if (isSplat(segment)) {
          score -= SEGMENT_POINTS + SPLAT_PENALTY;
        } else {
          score += STATIC_POINTS;
        }

        return score;
      }, 0);

  return { route, score, index };
}

/**
 * Give a score to all routes and sort them on that
 * @param {object[]} routes
 * @return {object[]}
 */
function rankRoutes(routes) {
  return (
    routes
      .map(rankRoute)
      // If two routes have the exact same score, we go by index instead
      .sort((a, b) =>
        a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
      )
  );
}

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
function pick(routes, uri) {
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
        uri
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

      if (routeSegment !== undefined && isSplat(routeSegment)) {
        // Hit a splat, just grab the rest, and return a match
        // uri:   /files/documents/work
        // route: /files/* or /files/*splatname
        const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

        params[splatName] = uriSegments
          .slice(index)
          .map(decodeURIComponent)
          .join("/");
        break;
      }

      if (uriSegment === undefined) {
        // URI is shorter than the route, no match
        // uri:   /users
        // route: /users/:userId
        missed = true;
        break;
      }

      let dynamicMatch = paramRe.exec(routeSegment);

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
        uri: "/" + uriSegments.slice(0, index).join("/")
      };
      break;
    }
  }

  return match || default_ || null;
}

/**
 * Check if the `path` matches the `uri`.
 * @param {string} path
 * @param {string} uri
 * @return {?object}
 */
function match(route, uri) {
  return pick([route], uri);
}

/**
 * Add the query to the pathname if a query is given
 * @param {string} pathname
 * @param {string} [query]
 * @return {string}
 */
function addQuery(pathname, query) {
  return pathname + (query ? `?${query}` : "");
}

/**
 * Resolve URIs as though every path is a directory, no files. Relative URIs
 * in the browser can feel awkward because not only can you be "in a directory",
 * you can be "at a file", too. For example:
 *
 *  browserSpecResolve('foo', '/bar/') => /bar/foo
 *  browserSpecResolve('foo', '/bar') => /foo
 *
 * But on the command line of a file system, it's not as complicated. You can't
 * `cd` from a file, only directories. This way, links have to know less about
 * their current path. To go deeper you can do this:
 *
 *  <Link to="deeper"/>
 *  // instead of
 *  <Link to=`{${props.uri}/deeper}`/>
 *
 * Just like `cd`, if you want to go deeper from the command line, you do this:
 *
 *  cd deeper
 *  # not
 *  cd $(pwd)/deeper
 *
 * By treating every path as a directory, linking to relative paths should
 * require less contextual information and (fingers crossed) be more intuitive.
 * @param {string} to
 * @param {string} base
 * @return {string}
 */
function resolve(to, base) {
  // /foo/bar, /baz/qux => /foo/bar
  if (startsWith(to, "/")) {
    return to;
  }

  const [toPathname, toQuery] = to.split("?");
  const [basePathname] = base.split("?");
  const toSegments = segmentize(toPathname);
  const baseSegments = segmentize(basePathname);

  // ?a=b, /users?b=c => /users?a=b
  if (toSegments[0] === "") {
    return addQuery(basePathname, toQuery);
  }

  // profile, /users/789 => /users/789/profile
  if (!startsWith(toSegments[0], ".")) {
    const pathname = baseSegments.concat(toSegments).join("/");

    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
  }

  // ./       , /users/123 => /users/123
  // ../      , /users/123 => /users
  // ../..    , /users/123 => /
  // ../../one, /a/b/c/d   => /a/b/one
  // .././one , /a/b/c/d   => /a/b/c/one
  const allSegments = baseSegments.concat(toSegments);
  const segments = [];

  allSegments.forEach(segment => {
    if (segment === "..") {
      segments.pop();
    } else if (segment !== ".") {
      segments.push(segment);
    }
  });

  return addQuery("/" + segments.join("/"), toQuery);
}

/**
 * Combines the `basepath` and the `path` into one path.
 * @param {string} basepath
 * @param {string} path
 */
function combinePaths(basepath, path) {
  return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
}

/* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.49.0 */

const Router = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $location, $$unsubscribe_location;
	let $routes, $$unsubscribe_routes;
	let $base, $$unsubscribe_base;
	let { basepath = "/" } = $$props;
	let { url = null } = $$props;
	const locationContext = getContext(LOCATION);
	const routerContext = getContext(ROUTER);
	const routes = writable([]);
	$$unsubscribe_routes = subscribe(routes, value => $routes = value);
	const activeRoute = writable(null);
	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

	// If locationContext is not set, this is the topmost Router in the tree.
	// If the `url` prop is given we force the location to it.
	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

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
		if (activeRoute === null) {
			return base;
		}

		const { path: basepath } = base;
		const { route, uri } = activeRoute;

		// Remove the potential /* or /*splatname from
		// the end of the child Routes relative paths.
		const path = route.default
		? basepath
		: route.path.replace(/\*.*$/, "");

		return { path, uri };
	});

	function registerRoute(route) {
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
			if (hasActiveRoute) {
				return;
			}

			const matchingRoute = match(route, $location.pathname);

			if (matchingRoute) {
				activeRoute.set(matchingRoute);
				hasActiveRoute = true;
			}
		} else {
			routes.update(rs => {
				rs.push(route);
				return rs;
			});
		}
	}

	function unregisterRoute(route) {
		routes.update(rs => {
			const index = rs.indexOf(route);
			rs.splice(index, 1);
			return rs;
		});
	}

	if (!locationContext) {
		// The topmost Router in the tree is responsible for updating
		// the location store and supplying it through context.
		onMount(() => {
			const unlisten = globalHistory.listen(history => {
				location.set(history.location);
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

	{
		{
			const { path: basepath } = $base;

			routes.update(rs => {
				rs.forEach(r => r.path = combinePaths(basepath, r._path));
				return rs;
			});
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
	return `${slots.default ? slots.default({}) : ``}`;
});

/* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.49.0 */

const Route = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $activeRoute, $$unsubscribe_activeRoute;
	let $location, $$unsubscribe_location;
	let { path = "" } = $$props;
	let { component = null } = $$props;
	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
	$$unsubscribe_activeRoute = subscribe(activeRoute, value => $activeRoute = value);
	const location = getContext(LOCATION);
	$$unsubscribe_location = subscribe(location, value => $location = value);

	const route = {
		path,
		// If no path prop is given, this Route will act as the default Route
		// that is rendered if no other Route in the Router is a match.
		default: path === ""
	};

	let routeParams = {};
	let routeProps = {};
	registerRoute(route);

	// There is no need to unregister Routes in SSR since it will all be
	// thrown away anyway.
	if (typeof window !== "undefined") {
		onDestroy(() => {
			unregisterRoute(route);
		});
	}

	if ($$props.path === void 0 && $$bindings.path && path !== void 0) $$bindings.path(path);
	if ($$props.component === void 0 && $$bindings.component && component !== void 0) $$bindings.component(component);

	{
		if ($activeRoute && $activeRoute.route === route) {
			routeParams = $activeRoute.params;
		}
	}

	{
		{
			const { path, component, ...rest } = $$props;
			routeProps = rest;
		}
	}

	$$unsubscribe_activeRoute();
	$$unsubscribe_location();

	return `${$activeRoute !== null && $activeRoute.route === route
	? `${component !== null
		? `${validate_component(component || missing_component, "svelte:component").$$render($$result, Object.assign({ location: $location }, routeParams, routeProps), {}, {})}`
		: `${slots.default
			? slots.default({ params: routeParams, location: $location })
			: ``}`}`
	: ``}`;
});

/* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.49.0 */

const Link = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let ariaCurrent;
	let $$restProps = compute_rest_props($$props, ["to","replace","state","getProps"]);
	let $location, $$unsubscribe_location;
	let $base, $$unsubscribe_base;
	let { to = "#" } = $$props;
	let { replace = false } = $$props;
	let { state = {} } = $$props;
	let { getProps = () => ({}) } = $$props;
	const { base } = getContext(ROUTER);
	$$unsubscribe_base = subscribe(base, value => $base = value);
	const location = getContext(LOCATION);
	$$unsubscribe_location = subscribe(location, value => $location = value);
	createEventDispatcher();
	let href, isPartiallyCurrent, isCurrent, props;

	if ($$props.to === void 0 && $$bindings.to && to !== void 0) $$bindings.to(to);
	if ($$props.replace === void 0 && $$bindings.replace && replace !== void 0) $$bindings.replace(replace);
	if ($$props.state === void 0 && $$bindings.state && state !== void 0) $$bindings.state(state);
	if ($$props.getProps === void 0 && $$bindings.getProps && getProps !== void 0) $$bindings.getProps(getProps);
	href = to === "/" ? $base.uri : resolve(to, $base.uri);
	isPartiallyCurrent = startsWith($location.pathname, href);
	isCurrent = href === $location.pathname;
	ariaCurrent = isCurrent ? "page" : undefined;

	props = getProps({
		location: $location,
		href,
		isPartiallyCurrent,
		isCurrent
	});

	$$unsubscribe_location();
	$$unsubscribe_base();

	return `<a${spread(
		[
			{ href: escape_attribute_value(href) },
			{
				"aria-current": escape_attribute_value(ariaCurrent)
			},
			escape_object(props),
			escape_object($$restProps)
		],
		{}
	)}>${slots.default ? slots.default({}) : ``}</a>`;
});

/* src\routes\Teams.svelte generated by Svelte v3.49.0 */

const css$b = {
	code: ".teams.svelte-i9b06i{display:grid;grid-template-columns:repeat(4, 1fr);width:80%;margin:8px auto;box-shadow:0 0 0.5em 0.1em rgba(0, 0, 0, 0.2);background-color:rgba(0, 0, 0, 0.1)}@media only screen and (max-width: 1250px){.teams.svelte-i9b06i{width:90%}}@media only screen and (max-width: 1100px){.teams.svelte-i9b06i{grid-template-columns:repeat(2, 1fr)}}@media only screen and (max-width: 500px){.teams.svelte-i9b06i{grid-template-columns:repeat(1, 1fr)}}",
	map: "{\"version\":3,\"file\":\"Teams.svelte\",\"sources\":[\"Teams.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  import { Router, Link } from \\\"svelte-routing\\\";\\r\\n  import { onMount } from \\\"svelte\\\";\\r\\n\\r\\n  function removeBorderRadius() {\\r\\n    document.getElementById(\\\"team-1\\\").classList.remove(\\\"top-left\\\");\\r\\n    document.getElementById(\\\"team-1\\\").classList.remove(\\\"top-right\\\");\\r\\n    document.getElementById(\\\"team-2\\\").classList.remove(\\\"top-right\\\");\\r\\n    document.getElementById(\\\"team-4\\\").classList.remove(\\\"top-right\\\");\\r\\n    document.getElementById(\\\"team-17\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-18\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-19\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-20\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-20\\\").classList.remove(\\\"bottom-right\\\");\\r\\n  }\\r\\n\\r\\n  function setBorderRadius() {\\r\\n    let width = window.innerWidth;\\r\\n    removeBorderRadius();\\r\\n    if (width < 500) {\\r\\n      // 20 rows of 1 column\\r\\n      document.getElementById(\\\"team-1\\\").classList.add(\\\"top-both\\\");\\r\\n      document.getElementById(\\\"team-20\\\").classList.add(\\\"bottom-both\\\");\\r\\n    } else if (width < 1100) {\\r\\n      // 10 rows of 2 columns\\r\\n      document.getElementById(\\\"team-1\\\").classList.add(\\\"top-left\\\");\\r\\n      document.getElementById(\\\"team-2\\\").classList.add(\\\"top-right\\\");\\r\\n      document.getElementById(\\\"team-19\\\").classList.add(\\\"bottom-left\\\");\\r\\n      document.getElementById(\\\"team-20\\\").classList.add(\\\"bottom-right\\\");\\r\\n    } else {\\r\\n      // 5 rows of 4 columns\\r\\n      document.getElementById(\\\"team-1\\\").classList.add(\\\"top-left\\\");\\r\\n      document.getElementById(\\\"team-4\\\").classList.add(\\\"top-right\\\");\\r\\n      document.getElementById(\\\"team-17\\\").classList.add(\\\"bottom-left\\\");\\r\\n      document.getElementById(\\\"team-20\\\").classList.add(\\\"bottom-right\\\");\\r\\n    }\\r\\n  }\\r\\n\\r\\n  let teams = [\\r\\n    \\\"Manchester City\\\",\\r\\n    \\\"Liverpool\\\",\\r\\n    \\\"Chelsea\\\",\\r\\n    \\\"Tottenham Hotspur\\\",\\r\\n    \\\"Arsenal\\\",\\r\\n    \\\"Manchester United\\\",\\r\\n    \\\"West Ham United\\\",\\r\\n    \\\"Leicester City\\\",\\r\\n    \\\"Brighton and Hove Albion\\\",\\r\\n    \\\"Wolverhampton Wanderers\\\",\\r\\n    \\\"Newcastle United\\\",\\r\\n    \\\"Crystal Palace\\\",\\r\\n    \\\"Brentford\\\",\\r\\n    \\\"Aston Villa\\\",\\r\\n    \\\"Southampton\\\",\\r\\n    \\\"Everton\\\",\\r\\n    \\\"Leeds United\\\",\\r\\n    \\\"Fulham\\\",\\r\\n    \\\"Bournemouth\\\",\\r\\n    \\\"Nottingham Forest\\\",\\r\\n  ];\\r\\n\\r\\n  onMount(() => {\\r\\n    window.addEventListener(\\\"resize\\\", setBorderRadius, true);\\r\\n    setBorderRadius();\\r\\n\\r\\n    return () => {\\r\\n      // Called when component is destroyed\\r\\n      window.removeEventListener(\\\"resize\\\", setBorderRadius, true);\\r\\n    };\\r\\n  });\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Premier League</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div class=\\\"header\\\">\\r\\n    <Link to=\\\"/\\\">\\r\\n      <div class=\\\"title main-link no-decoration\\\">Premier League</div>\\r\\n    </Link>\\r\\n  </div>\\r\\n  <div class=\\\"page-content\\\">\\r\\n    <div class=\\\"teams\\\">\\r\\n      {#each teams as team, i (team)}\\r\\n        <Link\\r\\n          to=\\\"/{team.toLowerCase().replace(/ /g, '-')}\\\"\\r\\n          class=\\\"team-button\\\"\\r\\n          id=\\\"team-{i + 1}\\\"\\r\\n          style=\\\"background-color: var(--{team\\r\\n            .toLowerCase()\\r\\n            .replace(/ /g, '-')});\\\"\\r\\n        >\\r\\n          <div\\r\\n            class=\\\"main-link\\\"\\r\\n            style=\\\"color: var(--{team\\r\\n              .toLowerCase()\\r\\n              .replace(/ /g, '-')}-secondary);\\\"\\r\\n          >\\r\\n            {team}\\r\\n          </div>\\r\\n        </Link>\\r\\n      {/each}\\r\\n    </div>\\r\\n  </div></Router\\r\\n>\\r\\n\\r\\n<style scoped>\\r\\n  .teams {\\r\\n    display: grid;\\r\\n    grid-template-columns: repeat(4, 1fr);\\r\\n    width: 80%;\\r\\n    margin: 8px auto;\\r\\n    box-shadow: 0 0 0.5em 0.1em rgba(0, 0, 0, 0.2);\\r\\n    background-color: rgba(0, 0, 0, 0.1);\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1250px) {\\r\\n    .teams {\\r\\n      width: 90%;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .teams {\\r\\n      grid-template-columns: repeat(2, 1fr);\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 500px) {\\r\\n    .teams {\\r\\n      grid-template-columns: repeat(1, 1fr);\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA6GE,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,IAAI,CACb,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,CACrC,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,GAAG,CAAC,IAAI,CAChB,UAAU,CAAE,CAAC,CAAC,CAAC,CAAC,KAAK,CAAC,KAAK,CAAC,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9C,gBAAgB,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,AACtC,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,MAAM,cAAC,CAAC,AACN,KAAK,CAAE,GAAG,AACZ,CAAC,AACH,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,MAAM,cAAC,CAAC,AACN,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,MAAM,cAAC,CAAC,AACN,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC\"}"
};

function removeBorderRadius() {
	document.getElementById("team-1").classList.remove("top-left");
	document.getElementById("team-1").classList.remove("top-right");
	document.getElementById("team-2").classList.remove("top-right");
	document.getElementById("team-4").classList.remove("top-right");
	document.getElementById("team-17").classList.remove("bottom-left");
	document.getElementById("team-18").classList.remove("bottom-left");
	document.getElementById("team-19").classList.remove("bottom-left");
	document.getElementById("team-20").classList.remove("bottom-left");
	document.getElementById("team-20").classList.remove("bottom-right");
}

function setBorderRadius() {
	let width = window.innerWidth;
	removeBorderRadius();

	if (width < 500) {
		// 20 rows of 1 column
		document.getElementById("team-1").classList.add("top-both");

		document.getElementById("team-20").classList.add("bottom-both");
	} else if (width < 1100) {
		// 10 rows of 2 columns
		document.getElementById("team-1").classList.add("top-left");

		document.getElementById("team-2").classList.add("top-right");
		document.getElementById("team-19").classList.add("bottom-left");
		document.getElementById("team-20").classList.add("bottom-right");
	} else {
		// 5 rows of 4 columns
		document.getElementById("team-1").classList.add("top-left");

		document.getElementById("team-4").classList.add("top-right");
		document.getElementById("team-17").classList.add("bottom-left");
		document.getElementById("team-20").classList.add("bottom-right");
	}
}

const Teams = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let teams = [
		"Manchester City",
		"Liverpool",
		"Chelsea",
		"Tottenham Hotspur",
		"Arsenal",
		"Manchester United",
		"West Ham United",
		"Leicester City",
		"Brighton and Hove Albion",
		"Wolverhampton Wanderers",
		"Newcastle United",
		"Crystal Palace",
		"Brentford",
		"Aston Villa",
		"Southampton",
		"Everton",
		"Leeds United",
		"Fulham",
		"Bournemouth",
		"Nottingham Forest"
	];

	onMount(() => {
		window.addEventListener("resize", setBorderRadius, true);
		setBorderRadius();

		return () => {
			// Called when component is destroyed
			window.removeEventListener("resize", setBorderRadius, true);
		};
	});

	$$result.css.add(css$b);

	return `${($$result.head += `${($$result.title = `<title>Premier League</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div class="${"header"}">${validate_component(Link, "Link").$$render($$result, { to: "/" }, {}, {
				default: () => {
					return `<div class="${"title main-link no-decoration"}">Premier League</div>`;
				}
			})}</div>
  <div class="${"page-content"}"><div class="${"teams svelte-i9b06i"}">${each(teams, (team, i) => {
				return `${validate_component(Link, "Link").$$render(
					$$result,
					{
						to: "/" + team.toLowerCase().replace(/ /g, '-'),
						class: "team-button",
						id: "team-" + (i + 1),
						style: "background-color: var(--" + team.toLowerCase().replace(/ /g, '-') + ");"
					},
					{},
					{
						default: () => {
							return `<div class="${"main-link"}" style="${"color: var(--" + escape(team.toLowerCase().replace(/ /g, '-'), true) + "-secondary);"}">${escape(team)}</div>
        `;
						}
					}
				)}`;
			})}</div></div>`;
		}
	})}`;
});

/* src\components\CurrentForm.svelte generated by Svelte v3.49.0 */

const css$a = {
	code: ".current-form.svelte-b4v5qq{font-size:1.8rem;margin:20px 10px}.current-form-row.svelte-b4v5qq{font-size:0.9em;display:flex;width:min(80%, 600px);width:100%}.icon.svelte-b4v5qq{position:relative;width:20%;height:0;padding-bottom:20%;margin:0 5px;background-repeat:no-repeat;background-size:contain}.icon-name.svelte-b4v5qq{position:relative;width:20%;margin:0 5px}.pos-4.svelte-b4v5qq{opacity:100%}.pos-3.svelte-b4v5qq{opacity:90%}.pos-2.svelte-b4v5qq{opacity:80%}.pos-1.svelte-b4v5qq{opacity:70%}.pos-0.svelte-b4v5qq{opacity:50%}",
	map: "{\"version\":3,\"file\":\"CurrentForm.svelte\",\"sources\":[\"CurrentForm.svelte\"],\"sourcesContent\":[\"<script>\\r\\n\\r\\n\\r\\n  function getSortedMatchdays(data, team) {\\r\\n    let matchdays = Object.keys(data.form[data._id][team]).sort(function (\\r\\n      matchday1,\\r\\n      matchday2\\r\\n    ) {\\r\\n      return (\\r\\n        new Date(data.form[data._id][team][matchday1].date) -\\r\\n        new Date(data.form[data._id][team][matchday2].date)\\r\\n      );\\r\\n    });\\r\\n    return matchdays;\\r\\n  }\\r\\n\\r\\n  function getFormStarTeams(data, team, matchdays) {\\r\\n    let formStarTeams = [];\\r\\n    for (let matchday of matchdays) {\\r\\n      formStarTeams.unshift(\\r\\n        data.form[data._id][team][matchday].beatStarTeam ? \\\"star-team\\\" : \\\"\\\"\\r\\n      );\\r\\n    }\\r\\n\\r\\n    // Fill in blanks\\r\\n    for (let i = formStarTeams.length; i < 5; i++) {\\r\\n      formStarTeams.unshift(\\\"\\\");\\r\\n    }\\r\\n\\r\\n    return formStarTeams;\\r\\n  }\\r\\n\\r\\n  function getFormIcons(data, team) {\\r\\n    let formIcons = [];\\r\\n    if (Object.keys(data.form[data._id][team][currentMatchday]).length > 0) {\\r\\n      formIcons = data.form[data._id][team][currentMatchday].form5.split(\\\"\\\");\\r\\n    }\\r\\n\\r\\n    // Fill in blanks with None icons\\r\\n    for (let i = formIcons.length; i < 5; i++) {\\r\\n      formIcons.unshift(\\\"N\\\");\\r\\n    }\\r\\n\\r\\n    return formIcons;\\r\\n  }\\r\\n\\r\\n  function getFormInitials(data, team, matchdays) {\\r\\n    let formInitials = [];\\r\\n\\r\\n    for (let matchday of matchdays) {\\r\\n      formInitials.unshift(\\r\\n        toInitials(data.form[data._id][team][matchday].team)\\r\\n      );\\r\\n    }\\r\\n\\r\\n    // Fill in blanks with None icons\\r\\n    for (let i = formInitials.length; i < 5; i++) {\\r\\n      formInitials.unshift(\\\"\\\");\\r\\n    }\\r\\n\\r\\n    return formInitials;\\r\\n  }\\r\\n\\r\\n  function latestNPlayedMatchdays(data, team, matchdays, N) {\\r\\n    let latestN = [];\\r\\n\\r\\n    for (let i = matchdays.length - 1; i >= 0; i--) {\\r\\n      if (data.form[data._id][team][matchdays[i]].score != null) {\\r\\n        latestN.unshift(matchdays[i]);\\r\\n      }\\r\\n      if (latestN.length >= N) {\\r\\n        break;\\r\\n      }\\r\\n    }\\r\\n\\r\\n    return latestN;\\r\\n  }\\r\\n\\r\\n  let formIcons, formStarTeams, formInitials;\\r\\n  function setFormValues() {\\r\\n    let sortedMatchdays = getSortedMatchdays(data, team);\\r\\n\\r\\n    let matchdays = latestNPlayedMatchdays(\\r\\n      data,\\r\\n      team,\\r\\n      sortedMatchdays,\\r\\n      5\\r\\n    );\\r\\n\\r\\n    formIcons = getFormIcons(data, team);\\r\\n    formStarTeams = getFormStarTeams(data, team, matchdays);\\r\\n    formInitials = getFormInitials(data, team, matchdays);\\r\\n  }\\r\\n\\r\\n  $: team && setFormValues();\\r\\n\\r\\n  export let data, currentMatchday, team, toInitials;\\r\\n</script>\\r\\n\\r\\n{#if formInitials != undefined}\\r\\n  <div class=\\\"current-form-row\\\">\\r\\n    <div class=\\\"icon pos-0 {formIcons[0]} {formStarTeams[0]}\\\" />\\r\\n    <div class=\\\"icon pos-1 {formIcons[1]} {formStarTeams[1]}\\\" />\\r\\n    <div class=\\\"icon pos-2 {formIcons[2]} {formStarTeams[2]}\\\" />\\r\\n    <div class=\\\"icon pos-3 {formIcons[3]} {formStarTeams[3]}\\\" />\\r\\n    <div class=\\\"icon pos-4 {formIcons[4]} {formStarTeams[4]}\\\" />\\r\\n  </div>\\r\\n  <div class=\\\"current-form-row\\\">\\r\\n    <div class=\\\"icon-name pos-0\\\">{formInitials[0]}</div>\\r\\n    <div class=\\\"icon-name pos-1\\\">{formInitials[1]}</div>\\r\\n    <div class=\\\"icon-name pos-2\\\">{formInitials[2]}</div>\\r\\n    <div class=\\\"icon-name pos-3\\\">{formInitials[3]}</div>\\r\\n    <div class=\\\"icon-name pos-4\\\">{formInitials[4]}</div>\\r\\n  </div>\\r\\n{/if}\\r\\n<div class=\\\"current-form\\\">\\r\\n  Current form:\\r\\n  {#if currentMatchday != null}\\r\\n    {(\\r\\n      data.form[data._id][team][currentMatchday].formRating5 * 100\\r\\n    ).toFixed(1)}%\\r\\n  {:else}\\r\\n    None\\r\\n  {/if}\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .current-form {\\r\\n    font-size: 1.8rem;\\r\\n    margin: 20px 10px;\\r\\n  }\\r\\n  .current-form-row {\\r\\n    font-size: 0.9em;\\r\\n    display: flex;\\r\\n    width: min(80%, 600px);\\r\\n    width: 100%;\\r\\n  }\\r\\n\\r\\n  .icon {\\r\\n    position: relative;\\r\\n    width: 20%;\\r\\n    height: 0;\\r\\n    padding-bottom: 20%;\\r\\n    margin: 0 5px;\\r\\n    background-repeat: no-repeat;\\r\\n    background-size: contain;\\r\\n  }\\r\\n\\r\\n  .icon-name {\\r\\n    position: relative;\\r\\n    width: 20%;\\r\\n    margin: 0 5px;\\r\\n  }\\r\\n\\r\\n  .pos-4 {\\r\\n    /* Most recent game */\\r\\n    opacity: 100%;\\r\\n  }\\r\\n\\r\\n  .pos-3 {\\r\\n    opacity: 90%;\\r\\n  }\\r\\n\\r\\n  .pos-2 {\\r\\n    opacity: 80%;\\r\\n  }\\r\\n\\r\\n  .pos-1 {\\r\\n    opacity: 70%;\\r\\n  }\\r\\n\\r\\n  .pos-0 {\\r\\n    /* Least recent game */\\r\\n    opacity: 50%;\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA+HE,aAAa,cAAC,CAAC,AACb,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,IAAI,CAAC,IAAI,AACnB,CAAC,AACD,iBAAiB,cAAC,CAAC,AACjB,SAAS,CAAE,KAAK,CAChB,OAAO,CAAE,IAAI,CACb,KAAK,CAAE,IAAI,GAAG,CAAC,CAAC,KAAK,CAAC,CACtB,KAAK,CAAE,IAAI,AACb,CAAC,AAED,KAAK,cAAC,CAAC,AACL,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,CAAC,CACT,cAAc,CAAE,GAAG,CACnB,MAAM,CAAE,CAAC,CAAC,GAAG,CACb,iBAAiB,CAAE,SAAS,CAC5B,eAAe,CAAE,OAAO,AAC1B,CAAC,AAED,UAAU,cAAC,CAAC,AACV,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,CAAC,CAAC,GAAG,AACf,CAAC,AAED,MAAM,cAAC,CAAC,AAEN,OAAO,CAAE,IAAI,AACf,CAAC,AAED,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,GAAG,AACd,CAAC,AAED,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,GAAG,AACd,CAAC,AAED,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,GAAG,AACd,CAAC,AAED,MAAM,cAAC,CAAC,AAEN,OAAO,CAAE,GAAG,AACd,CAAC\"}"
};

function getSortedMatchdays(data, team) {
	let matchdays = Object.keys(data.form[data._id][team]).sort(function (matchday1, matchday2) {
		return new Date(data.form[data._id][team][matchday1].date) - new Date(data.form[data._id][team][matchday2].date);
	});

	return matchdays;
}

function getFormStarTeams(data, team, matchdays) {
	let formStarTeams = [];

	for (let matchday of matchdays) {
		formStarTeams.unshift(data.form[data._id][team][matchday].beatStarTeam
		? "star-team"
		: "");
	}

	// Fill in blanks
	for (let i = formStarTeams.length; i < 5; i++) {
		formStarTeams.unshift("");
	}

	return formStarTeams;
}

function latestNPlayedMatchdays(data, team, matchdays, N) {
	let latestN = [];

	for (let i = matchdays.length - 1; i >= 0; i--) {
		if (data.form[data._id][team][matchdays[i]].score != null) {
			latestN.unshift(matchdays[i]);
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

		if (Object.keys(data.form[data._id][team][currentMatchday]).length > 0) {
			formIcons = data.form[data._id][team][currentMatchday].form5.split("");
		}

		// Fill in blanks with None icons
		for (let i = formIcons.length; i < 5; i++) {
			formIcons.unshift("N");
		}

		return formIcons;
	}

	function getFormInitials(data, team, matchdays) {
		let formInitials = [];

		for (let matchday of matchdays) {
			formInitials.unshift(toInitials(data.form[data._id][team][matchday].team));
		}

		// Fill in blanks with None icons
		for (let i = formInitials.length; i < 5; i++) {
			formInitials.unshift("");
		}

		return formInitials;
	}

	let formIcons, formStarTeams, formInitials;

	function setFormValues() {
		let sortedMatchdays = getSortedMatchdays(data, team);
		let matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);
		formIcons = getFormIcons(data, team);
		formStarTeams = getFormStarTeams(data, team, matchdays);
		formInitials = getFormInitials(data, team, matchdays);
	}

	let { data, currentMatchday, team, toInitials } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.toInitials === void 0 && $$bindings.toInitials && toInitials !== void 0) $$bindings.toInitials(toInitials);
	$$result.css.add(css$a);
	team && setFormValues();

	return `${formInitials != undefined
	? `<div class="${"current-form-row svelte-b4v5qq"}"><div class="${"icon pos-0 " + escape(formIcons[0], true) + " " + escape(formStarTeams[0], true) + " svelte-b4v5qq"}"></div>
    <div class="${"icon pos-1 " + escape(formIcons[1], true) + " " + escape(formStarTeams[1], true) + " svelte-b4v5qq"}"></div>
    <div class="${"icon pos-2 " + escape(formIcons[2], true) + " " + escape(formStarTeams[2], true) + " svelte-b4v5qq"}"></div>
    <div class="${"icon pos-3 " + escape(formIcons[3], true) + " " + escape(formStarTeams[3], true) + " svelte-b4v5qq"}"></div>
    <div class="${"icon pos-4 " + escape(formIcons[4], true) + " " + escape(formStarTeams[4], true) + " svelte-b4v5qq"}"></div></div>
  <div class="${"current-form-row svelte-b4v5qq"}"><div class="${"icon-name pos-0 svelte-b4v5qq"}">${escape(formInitials[0])}</div>
    <div class="${"icon-name pos-1 svelte-b4v5qq"}">${escape(formInitials[1])}</div>
    <div class="${"icon-name pos-2 svelte-b4v5qq"}">${escape(formInitials[2])}</div>
    <div class="${"icon-name pos-3 svelte-b4v5qq"}">${escape(formInitials[3])}</div>
    <div class="${"icon-name pos-4 svelte-b4v5qq"}">${escape(formInitials[4])}</div></div>`
	: ``}
<div class="${"current-form svelte-b4v5qq"}">Current form:
  ${currentMatchday != null
	? `${escape((data.form[data._id][team][currentMatchday].formRating5 * 100).toFixed(1))}%`
	: `None`}
</div>`;
});

/* src\components\TableSnippet.svelte generated by Svelte v3.49.0 */

const css$9 = {
	code: ".table-snippet.svelte-13u0ebo{position:relative;margin-top:20px;display:flex;flex-direction:column;width:100%;height:auto}.table-row.svelte-13u0ebo{display:flex;padding:5px 5%;border-radius:var(--border-radius)}.table-row.this-team.svelte-13u0ebo{padding:13px 5%;font-size:20px}.this-team.svelte-13u0ebo{font-size:1.1em !important}#divider.svelte-13u0ebo{align-self:center;border-bottom:1px solid grey;width:90%;margin:auto}.column-title.svelte-13u0ebo{font-weight:700}.table-position.svelte-13u0ebo{width:7%}button.svelte-13u0ebo{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit}.table-team-name.svelte-13u0ebo{width:63%;text-align:left;margin-left:8px;color:#333333}.table-gd.svelte-13u0ebo{width:15%}.table-points.svelte-13u0ebo{width:15%}",
	map: "{\"version\":3,\"file\":\"TableSnippet.svelte\",\"sources\":[\"TableSnippet.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  function tableSnippetRange(sortedTeams, team) {\\r\\n    let teamStandingsIdx = sortedTeams.indexOf(team);\\r\\n\\r\\n    let low = teamStandingsIdx - 3;\\r\\n    let high = teamStandingsIdx + 4;\\r\\n    if (low < 0) {\\r\\n      let overflow = low;\\r\\n      high -= overflow;\\r\\n      low = 0;\\r\\n    }\\r\\n    if (high > sortedTeams.length - 1) {\\r\\n      let overflow = high - sortedTeams.length;\\r\\n      low -= overflow;\\r\\n      high = sortedTeams.length;\\r\\n    }\\r\\n\\r\\n    return [low, high];\\r\\n  }\\r\\n\\r\\n  function buildTableSnippet() {\\r\\n    let sortedTeams = Object.keys(data.standings).sort(function (teamA, teamB) {\\r\\n      return (\\r\\n        data.standings[teamA][data._id].position -\\r\\n        data.standings[teamB][data._id].position\\r\\n      );\\r\\n    });\\r\\n\\r\\n    let [low, high] = tableSnippetRange(sortedTeams, team);\\r\\n\\r\\n    let teamTableIdx;\\r\\n    let rows = [];\\r\\n    for (let i = low; i < high; i++) {\\r\\n      if (sortedTeams[i] == team) {\\r\\n        teamTableIdx = i - low;\\r\\n      }\\r\\n      rows.push({\\r\\n        name: sortedTeams[i],\\r\\n        position: data.standings[sortedTeams[i]][data._id].position,\\r\\n        points: data.standings[sortedTeams[i]][data._id].points,\\r\\n        gd: data.standings[sortedTeams[i]][data._id].gD,\\r\\n      });\\r\\n    }\\r\\n\\r\\n    tableSnippet = {\\r\\n      teamTableIdx: teamTableIdx,\\r\\n      rows: rows,\\r\\n    };\\r\\n  }\\r\\n\\r\\n  let tableSnippet;\\r\\n  $: team && buildTableSnippet()\\r\\n\\r\\n  export let data, hyphenatedTeam, team, toAlias, switchTeam;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"table-snippet\\\">\\r\\n  {#if tableSnippet != undefined}\\r\\n    <div class=\\\"divider\\\" />\\r\\n    <div class=\\\"table-row\\\">\\r\\n      <div class=\\\"table-element table-position column-title\\\" />\\r\\n      <div class=\\\"table-element table-team-name column-title\\\">Team</div>\\r\\n      <div class=\\\"table-element table-gd column-title\\\">GD</div>\\r\\n      <div class=\\\"table-element table-points column-title\\\">Points</div>\\r\\n    </div>\\r\\n\\r\\n    {#each tableSnippet.rows as row, i}\\r\\n      <!-- Divider -->\\r\\n      {#if i == 0}\\r\\n        {#if i != tableSnippet.teamTableIdx}\\r\\n          <div id=\\\"divider\\\" />\\r\\n        {/if}\\r\\n      {:else if i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx}\\r\\n        <div id=\\\"divider\\\" />\\r\\n      {/if}\\r\\n      <!-- Row of table -->\\r\\n      {#if i == tableSnippet.teamTableIdx}\\r\\n        <!-- Highlighted row for the team of the current page -->\\r\\n        <div\\r\\n          class=\\\"table-row this-team\\\"\\r\\n          style=\\\"background-color: var(--{hyphenatedTeam});\\\"\\r\\n        >\\r\\n          <div\\r\\n            class=\\\"table-element table-position this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.position}\\r\\n          </div>\\r\\n          <a\\r\\n            href=\\\"/{hyphenatedTeam}\\\"\\r\\n            class=\\\"table-element table-team-name this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {toAlias(row.name)}\\r\\n          </a>\\r\\n          <div\\r\\n            class=\\\"table-element table-gd this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.gd}\\r\\n          </div>\\r\\n          <div\\r\\n            class=\\\"table-element table-points this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.points}\\r\\n          </div>\\r\\n        </div>\\r\\n      {:else}\\r\\n        <!-- Plain row -->\\r\\n        <div class=\\\"table-row\\\">\\r\\n          <div class=\\\"table-element table-position\\\">\\r\\n            {row.position}\\r\\n          </div>\\r\\n          <button\\r\\n            on:click=\\\"{() => {switchTeam(row.name.toLowerCase().replace(/ /g, '-'))}}\\\"\\r\\n            class=\\\"table-element table-team-name\\\"\\r\\n          >\\r\\n            {toAlias(row.name)}\\r\\n          </button>\\r\\n          <div class=\\\"table-element table-gd\\\">\\r\\n            {row.gd}\\r\\n          </div>\\r\\n          <div class=\\\"table-element table-points\\\">\\r\\n            {row.points}\\r\\n          </div>\\r\\n        </div>\\r\\n      {/if}\\r\\n    {/each}\\r\\n    {#if tableSnippet.teamTableIdx != 6}\\r\\n      <div id=\\\"divider\\\" />\\r\\n    {/if}\\r\\n  {/if}\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .table-snippet {\\r\\n    position: relative;\\r\\n    margin-top: 20px;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    width: 100%;\\r\\n    height: auto;\\r\\n  }\\r\\n\\r\\n  .table-row {\\r\\n    display: flex;\\r\\n    padding: 5px 5%;\\r\\n    border-radius: var(--border-radius);\\r\\n  }\\r\\n\\r\\n  .table-row.this-team {\\r\\n    padding: 13px 5%;\\r\\n    font-size: 20px;\\r\\n  }\\r\\n\\r\\n  .this-team {\\r\\n    font-size: 1.1em !important;\\r\\n  }\\r\\n\\r\\n  #divider {\\r\\n    align-self: center;\\r\\n    border-bottom: 1px solid grey;\\r\\n    width: 90%;\\r\\n    margin: auto;\\r\\n  }\\r\\n\\r\\n  .column-title {\\r\\n    font-weight: 700;\\r\\n  }\\r\\n\\r\\n  .table-position {\\r\\n    width: 7%;\\r\\n  }\\r\\n\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n  }\\r\\n\\r\\n  .table-team-name {\\r\\n    width: 63%;\\r\\n    text-align: left;\\r\\n    margin-left: 8px;\\r\\n    color: #333333;\\r\\n  }\\r\\n\\r\\n  .table-gd {\\r\\n    width: 15%;\\r\\n  }\\r\\n\\r\\n  .table-points {\\r\\n    width: 15%;\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAwIE,cAAc,eAAC,CAAC,AACd,QAAQ,CAAE,QAAQ,CAClB,UAAU,CAAE,IAAI,CAChB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,AACd,CAAC,AAED,UAAU,eAAC,CAAC,AACV,OAAO,CAAE,IAAI,CACb,OAAO,CAAE,GAAG,CAAC,EAAE,CACf,aAAa,CAAE,IAAI,eAAe,CAAC,AACrC,CAAC,AAED,UAAU,UAAU,eAAC,CAAC,AACpB,OAAO,CAAE,IAAI,CAAC,EAAE,CAChB,SAAS,CAAE,IAAI,AACjB,CAAC,AAED,UAAU,eAAC,CAAC,AACV,SAAS,CAAE,KAAK,CAAC,UAAU,AAC7B,CAAC,AAED,QAAQ,eAAC,CAAC,AACR,UAAU,CAAE,MAAM,CAClB,aAAa,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,CAC7B,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,IAAI,AACd,CAAC,AAED,aAAa,eAAC,CAAC,AACb,WAAW,CAAE,GAAG,AAClB,CAAC,AAED,eAAe,eAAC,CAAC,AACf,KAAK,CAAE,EAAE,AACX,CAAC,AAED,MAAM,eAAC,CAAC,AACN,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OAAO,AAClB,CAAC,AAED,gBAAgB,eAAC,CAAC,AAChB,KAAK,CAAE,GAAG,CACV,UAAU,CAAE,IAAI,CAChB,WAAW,CAAE,GAAG,CAChB,KAAK,CAAE,OAAO,AAChB,CAAC,AAED,SAAS,eAAC,CAAC,AACT,KAAK,CAAE,GAAG,AACZ,CAAC,AAED,aAAa,eAAC,CAAC,AACb,KAAK,CAAE,GAAG,AACZ,CAAC\"}"
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
			if (sortedTeams[i] == team) {
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
	let { data, hyphenatedTeam, team, toAlias, switchTeam } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.hyphenatedTeam === void 0 && $$bindings.hyphenatedTeam && hyphenatedTeam !== void 0) $$bindings.hyphenatedTeam(hyphenatedTeam);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$9);
	team && buildTableSnippet();

	return `<div class="${"table-snippet svelte-13u0ebo"}">${tableSnippet != undefined
	? `<div class="${"divider"}"></div>
    <div class="${"table-row svelte-13u0ebo"}"><div class="${"table-element table-position column-title svelte-13u0ebo"}"></div>
      <div class="${"table-element table-team-name column-title svelte-13u0ebo"}">Team</div>
      <div class="${"table-element table-gd column-title svelte-13u0ebo"}">GD</div>
      <div class="${"table-element table-points column-title svelte-13u0ebo"}">Points</div></div>

    ${each(tableSnippet.rows, (row, i) => {
			return `
      ${i == 0
			? `${i != tableSnippet.teamTableIdx
				? `<div id="${"divider"}" class="${"svelte-13u0ebo"}"></div>`
				: ``}`
			: `${i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx
				? `<div id="${"divider"}" class="${"svelte-13u0ebo"}"></div>`
				: ``}`}
      
      ${i == tableSnippet.teamTableIdx
			? `
        <div class="${"table-row this-team svelte-13u0ebo"}" style="${"background-color: var(--" + escape(hyphenatedTeam, true) + ");"}"><div class="${"table-element table-position this-team svelte-13u0ebo"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.position)}</div>
          <a href="${"/" + escape(hyphenatedTeam, true)}" class="${"table-element table-team-name this-team svelte-13u0ebo"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(toAlias(row.name))}</a>
          <div class="${"table-element table-gd this-team svelte-13u0ebo"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.gd)}</div>
          <div class="${"table-element table-points this-team svelte-13u0ebo"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.points)}</div>
        </div>`
			: `
        <div class="${"table-row svelte-13u0ebo"}"><div class="${"table-element table-position svelte-13u0ebo"}">${escape(row.position)}</div>
          <button class="${"table-element table-team-name svelte-13u0ebo"}">${escape(toAlias(row.name))}</button>
          <div class="${"table-element table-gd svelte-13u0ebo"}">${escape(row.gd)}</div>
          <div class="${"table-element table-points svelte-13u0ebo"}">${escape(row.points)}</div>
        </div>`}`;
		})}
    ${tableSnippet.teamTableIdx != 6
		? `<div id="${"divider"}" class="${"svelte-13u0ebo"}"></div>`
		: ``}`
	: ``}
</div>`;
});

/* src\components\next_game\SeasonComplete.svelte generated by Svelte v3.49.0 */

const SeasonComplete = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { data } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);

	return `<div class="${"next-game-prediction"}"><div class="${"next-game-season-complete"}"><h1 class="${"next-game-title-text"}">${escape(data._id)}/${escape(data._id + 1)} SEASON COMPLETE
    </h1></div></div>`;
});

/* src\components\next_game\NextGameStats.svelte generated by Svelte v3.49.0 */

const css$8 = {
	code: ".next-game-title.svelte-1xjzojr{width:max-content;padding:6px 20px;border-radius:0 0 var(--border-radius) 0}.next-game-season-complete.svelte-1xjzojr{display:grid;place-items:center;background:#f3f3f3;border:rgb(181, 181, 181) solid 5px;border-radius:var(--border-radius);height:98%}.next-game-title-text.svelte-1xjzojr{margin:0;color:rgb(181, 181, 181);display:flex}.next-game-logo.svelte-1xjzojr{height:225px;margin:10px;background-repeat:no-repeat;background-size:contain;background-position:center}.predictions-and-logo.svelte-1xjzojr{font-size:22px;width:45%;margin:auto}button.svelte-1xjzojr{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit}.predictions-link.svelte-1xjzojr{text-decoration:none;color:#333}.predictions-link.svelte-1xjzojr:hover{color:rgb(120 120 120)}.past-results.svelte-1xjzojr{font-size:22px;width:55%;display:flex;flex-direction:column;margin:auto 0}.next-game-prediction.svelte-1xjzojr{border-radius:var(--border-radius);min-height:97.5%}.next-game-values.svelte-1xjzojr{display:flex;margin-right:5%;min-height:370px}.next-game-position.svelte-1xjzojr{font-size:3em;font-weight:700}.past-result.svelte-1xjzojr{font-size:17px;display:flex;margin:0 5% 2px}.drew.svelte-1xjzojr{background-color:rgb(255, 207, 139)}.won.svelte-1xjzojr{background-color:rgb(169, 247, 169)}.lost.svelte-1xjzojr{background-color:#f77979}.past-result-date.svelte-1xjzojr{font-size:13px;color:#333}.prev-results-title.svelte-1xjzojr{font-weight:700;padding-top:0 !important;margin:0 !important}.no-prev-results.svelte-1xjzojr{background:grey;padding:60px 0 !important;display:grid;place-items:center;background:#f3f3f3;border:rgb(181, 181, 181) solid 5px;color:rgb(181, 181, 181);border-radius:var(--border-radius);margin:0 25px !important}.next-game-item.svelte-1xjzojr{padding:7px 0 4px;border-radius:var(--border-radius);margin-top:4px}.accuracy.svelte-1xjzojr{margin-bottom:30px}.accuracy-item.svelte-1xjzojr{font-size:14px;color:rgb(120 120 120);margin-bottom:5px}.home-team.svelte-1xjzojr{float:left;width:calc(50% - 18px);text-align:left}.score.svelte-1xjzojr{float:left;min-width:44px;margin:0 4px;text-align:center;font-weight:800}.away-team.svelte-1xjzojr{float:left;width:calc(50% - 18px);text-align:right}.home-team.svelte-1xjzojr,.away-team.svelte-1xjzojr{font-size:16px}.next-game-team-btn.svelte-1xjzojr{color:inherit;text-align:left}@media only screen and (max-width: 1100px){.next-game-prediction.svelte-1xjzojr{margin:50px 20px 0}.next-game-values.svelte-1xjzojr{margin:5% 8% 5% 0}}@media only screen and (max-width: 800px){.next-game-prediction.svelte-1xjzojr{margin:50px 75px 0}.next-game-values.svelte-1xjzojr{flex-direction:column;margin:20px}.predictions-and-logo.svelte-1xjzojr{margin:0 auto;width:100%}.past-results.svelte-1xjzojr{margin:30px auto 0;width:100%}.next-game-prediction.svelte-1xjzojr{padding-bottom:0}.next-game-title-text.svelte-1xjzojr{flex-direction:column;text-align:left}.next-game-title.svelte-1xjzojr{padding:6px 15px}}@media only screen and (max-width: 700px){.next-game-prediction.svelte-1xjzojr{margin:40px 20px}}@media only screen and (max-width: 550px){.next-game-values.svelte-1xjzojr{margin:20px 10px;font-size:0.85em}.next-game-prediction.svelte-1xjzojr{margin:40px 15px}}",
	map: "{\"version\":3,\"file\":\"NextGameStats.svelte\",\"sources\":[\"NextGameStats.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  function ordinal(n) {\\r\\n    let ord = [, \\\"st\\\", \\\"nd\\\", \\\"rd\\\"];\\r\\n    let a = n % 100;\\r\\n    return n + (ord[a > 20 ? a % 10 : a] || \\\"th\\\");\\r\\n  }\\r\\n\\r\\n  function setOppTeam() {\\r\\n    if (data.upcoming[team].nextTeam != null) {\\r\\n      oppTeam = data.upcoming[team].nextTeam\\r\\n        .toLowerCase()\\r\\n        .replace(/ /g, \\\"-\\\");\\r\\n    }\\r\\n  }\\r\\n\\r\\n  let oppTeam;\\r\\n  $: team && setOppTeam();\\r\\n\\r\\n  export let data, team, currentMatchday, showBadge, toAlias, switchTeam;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"next-game-prediction\\\" style=\\\"border: 6px solid var(--{oppTeam});\\\">\\r\\n  <div class=\\\"next-game-title\\\" style=\\\"background-color: var(--{oppTeam});\\\">\\r\\n    <h1 class=\\\"next-game-title-text\\\" style=\\\"color: var(--{oppTeam}-secondary);\\\">\\r\\n      Next Game:&nbsp\\r\\n      <button\\r\\n        on:click=\\\"{() => {switchTeam(data.upcoming[team].nextTeam\\r\\n          .toLowerCase()\\r\\n          .replace(/ /g, '-'))}}\\\"\\r\\n        class=\\\"next-game-team-btn\\\">{toAlias(data.upcoming[team].nextTeam)}&nbsp</button\\r\\n      >\\r\\n      ({data.upcoming[team].atHome ? \\\"Home\\\" : \\\"Away\\\"})\\r\\n    </h1>\\r\\n  </div>\\r\\n\\r\\n  <div class=\\\"next-game-values\\\">\\r\\n    <div class=\\\"predictions-and-logo\\\">\\r\\n      {#if showBadge}\\r\\n        <div\\r\\n          class=\\\"next-game-logo opposition-badge\\\"\\r\\n          style=\\\"background-image: url('{data.logoURLs[\\r\\n            data.upcoming[team].nextTeam\\r\\n          ]}')\\\"\\r\\n        />\\r\\n      {:else}\\r\\n        <div class=\\\"next-game-position\\\" />\\r\\n      {/if}\\r\\n      <div class=\\\"predictions\\\">\\r\\n        <div class=\\\"next-game-item\\\">\\r\\n          <div class=\\\"next-game-position\\\">\\r\\n            {ordinal(\\r\\n              data.standings[data.upcoming[team].nextTeam][data._id]\\r\\n                .position\\r\\n            )}\\r\\n          </div>\\r\\n        </div>\\r\\n        <div class=\\\"next-game-item\\\">\\r\\n          Current form:\\r\\n          {#if currentMatchday != null}\\r\\n            <b\\r\\n              >{(data.form[data._id][data.upcoming[team].nextTeam][\\r\\n                currentMatchday].formRating5 * 100).toFixed(1)}%</b\\r\\n            >\\r\\n          {:else}\\r\\n            None\\r\\n          {/if}\\r\\n        </div>\\r\\n        <div class=\\\"next-game-item\\\">\\r\\n          Score prediction\\r\\n          <br />\\r\\n          <a class=\\\"predictions-link\\\" href=\\\"/predictions\\\">\\r\\n            <b\\r\\n              >{Math.round(data.upcoming[team].prediction.homeGoals)} - {Math.round(\\r\\n                data.upcoming[team].prediction.awayGoals\\r\\n              )}</b\\r\\n            >\\r\\n          </a>\\r\\n          <br />\\r\\n          <!-- <span class=\\\"accuracy-item\\\">\\r\\n              Predicting with accuracy:\\r\\n              <b>{data.upcoming[fullTeamName].prediction.accuracy}%</b></span\\r\\n            ><br />\\r\\n            <div class=\\\"accuracy-item\\\">\\r\\n              General results accuracy:\\r\\n              <b>{data.upcoming[fullTeamName].prediction.resultsAccuracy}%</b>\\r\\n            </div> -->\\r\\n        </div>\\r\\n      </div>\\r\\n    </div>\\r\\n    <div class=\\\"past-results\\\">\\r\\n      {#if data.upcoming[team].prevMatches.length == 0}\\r\\n        <div class=\\\"next-game-item prev-results-title no-prev-results\\\">\\r\\n          No Previous Results\\r\\n        </div>\\r\\n      {:else}\\r\\n        <div class=\\\"next-game-item prev-results-title\\\">Previous Results</div>\\r\\n      {/if}\\r\\n\\r\\n      <!-- Display table of previous results against the next team this team is playing -->\\r\\n      {#each data.upcoming[team].prevMatches as prevMatch}\\r\\n        <div class=\\\"next-game-item {prevMatch.result}\\\">\\r\\n          <div class=\\\"past-result\\\">\\r\\n            <div class=\\\"home-team\\\">{toAlias(prevMatch.homeTeam)}</div>\\r\\n            <div class=\\\"score\\\">\\r\\n              {prevMatch.homeGoals} - {prevMatch.awayGoals}\\r\\n            </div>\\r\\n            <div class=\\\"away-team\\\">{toAlias(prevMatch.awayTeam)}</div>\\r\\n          </div>\\r\\n          <div style=\\\"clear: both\\\" />\\r\\n          <div class=\\\"past-result-date\\\">\\r\\n            {new Date(prevMatch.date).toLocaleDateString(\\\"en-us\\\", {\\r\\n              weekday: \\\"long\\\",\\r\\n              year: \\\"numeric\\\",\\r\\n              month: \\\"short\\\",\\r\\n              day: \\\"numeric\\\",\\r\\n            })}\\r\\n          </div>\\r\\n        </div>\\r\\n      {/each}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .next-game-title {\\r\\n    width: max-content;\\r\\n    padding: 6px 20px;\\r\\n    border-radius: 0 0 var(--border-radius) 0;\\r\\n  }\\r\\n\\r\\n  .next-game-season-complete {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    background: #f3f3f3;\\r\\n    border: rgb(181, 181, 181) solid 5px;\\r\\n    border-radius: var(--border-radius);\\r\\n    height: 98%;\\r\\n  }\\r\\n\\r\\n  .next-game-title-text {\\r\\n    margin: 0;\\r\\n    color: rgb(181, 181, 181);\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  .next-game-logo {\\r\\n    height: 225px;\\r\\n    margin: 10px;\\r\\n    background-repeat: no-repeat;\\r\\n    background-size: contain;\\r\\n    background-position: center;\\r\\n  }\\r\\n\\r\\n  .predictions-and-logo {\\r\\n    font-size: 22px;\\r\\n    width: 45%;\\r\\n    margin: auto;\\r\\n  }\\r\\n\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n  }\\r\\n\\r\\n  .predictions-link {\\r\\n    text-decoration: none;\\r\\n    color: #333;\\r\\n  }\\r\\n\\r\\n  .predictions-link:hover {\\r\\n    color: rgb(120 120 120);\\r\\n  }\\r\\n\\r\\n  .past-results {\\r\\n    font-size: 22px;\\r\\n    width: 55%;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    margin: auto 0;\\r\\n  }\\r\\n\\r\\n  .next-game-prediction {\\r\\n    /* margin: 0 20px 0 0; */\\r\\n    border-radius: var(--border-radius);\\r\\n    min-height: 97.5%;\\r\\n  }\\r\\n\\r\\n  .next-game-values {\\r\\n    display: flex;\\r\\n    margin-right: 5%;\\r\\n    min-height: 370px;\\r\\n  }\\r\\n\\r\\n  .next-game-position {\\r\\n    font-size: 3em;\\r\\n    font-weight: 700;\\r\\n  }\\r\\n\\r\\n  .past-result {\\r\\n    font-size: 17px;\\r\\n    display: flex;\\r\\n    margin: 0 5% 2px;\\r\\n  }\\r\\n\\r\\n  .drew {\\r\\n    background-color: rgb(255, 207, 139);\\r\\n  }\\r\\n\\r\\n  .won {\\r\\n    background-color: rgb(169, 247, 169);\\r\\n  }\\r\\n\\r\\n  .lost {\\r\\n    background-color: #f77979;\\r\\n  }\\r\\n\\r\\n  .past-result-date {\\r\\n    font-size: 13px;\\r\\n    color: #333;\\r\\n  }\\r\\n\\r\\n  .prev-results-title {\\r\\n    font-weight: 700;\\r\\n    padding-top: 0 !important;\\r\\n    margin: 0 !important;\\r\\n  }\\r\\n  .no-prev-results {\\r\\n    background: grey;\\r\\n    padding: 60px 0 !important;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    background: #f3f3f3;\\r\\n    border: rgb(181, 181, 181) solid 5px;\\r\\n    color: rgb(181, 181, 181);\\r\\n    border-radius: var(--border-radius);\\r\\n    margin: 0 25px !important;\\r\\n  }\\r\\n  .next-game-item {\\r\\n    padding: 7px 0 4px;\\r\\n    border-radius: var(--border-radius);\\r\\n    margin-top: 4px;\\r\\n  }\\r\\n\\r\\n  .accuracy {\\r\\n    margin-bottom: 30px;\\r\\n  }\\r\\n\\r\\n  .accuracy-item {\\r\\n    font-size: 14px;\\r\\n    color: rgb(120 120 120);\\r\\n    margin-bottom: 5px;\\r\\n  }\\r\\n\\r\\n  .home-team {\\r\\n    float: left;\\r\\n    width: calc(50% - 18px);\\r\\n    text-align: left;\\r\\n  }\\r\\n\\r\\n  .score {\\r\\n    float: left;\\r\\n    min-width: 44px;\\r\\n    margin: 0 4px;\\r\\n    text-align: center;\\r\\n    font-weight: 800;\\r\\n  }\\r\\n\\r\\n  .away-team {\\r\\n    float: left;\\r\\n    width: calc(50% - 18px);\\r\\n    text-align: right;\\r\\n  }\\r\\n\\r\\n  .home-team,\\r\\n  .away-team {\\r\\n    font-size: 16px;\\r\\n  }\\r\\n\\r\\n  .next-game-team-btn {\\r\\n    color: inherit;\\r\\n    text-align: left;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 50px 20px 0;\\r\\n    }\\r\\n    .next-game-values {\\r\\n      margin: 5% 8% 5% 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 50px 75px 0;\\r\\n    }\\r\\n\\r\\n    /* Change next game to column orientation */\\r\\n    .next-game-values {\\r\\n      flex-direction: column;\\r\\n      margin: 20px;\\r\\n    }\\r\\n\\r\\n    .predictions-and-logo {\\r\\n      margin: 0 auto;\\r\\n      width: 100%;\\r\\n    }\\r\\n\\r\\n    .past-results {\\r\\n      margin: 30px auto 0;\\r\\n      width: 100%;\\r\\n    }\\r\\n\\r\\n    .next-game-prediction {\\r\\n      padding-bottom: 0;\\r\\n    }\\r\\n    .next-game-title-text {\\r\\n      flex-direction: column;\\r\\n      text-align: left;\\r\\n    }\\r\\n\\r\\n    .next-game-title {\\r\\n      padding: 6px 15px;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 40px 20px;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .next-game-values {\\r\\n      margin: 20px 10px;\\r\\n      font-size: 0.85em;\\r\\n    }\\r\\n    .next-game-prediction {\\r\\n      margin: 40px 15px;\\r\\n    }\\r\\n    /* .score,\\r\\n    .home-team,\\r\\n    .away-team {\\r\\n    } */\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA4HE,gBAAgB,eAAC,CAAC,AAChB,KAAK,CAAE,WAAW,CAClB,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,aAAa,CAAE,CAAC,CAAC,CAAC,CAAC,IAAI,eAAe,CAAC,CAAC,CAAC,AAC3C,CAAC,AAED,0BAA0B,eAAC,CAAC,AAC1B,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,UAAU,CAAE,OAAO,CACnB,MAAM,CAAE,IAAI,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,KAAK,CAAC,GAAG,CACpC,aAAa,CAAE,IAAI,eAAe,CAAC,CACnC,MAAM,CAAE,GAAG,AACb,CAAC,AAED,qBAAqB,eAAC,CAAC,AACrB,MAAM,CAAE,CAAC,CACT,KAAK,CAAE,IAAI,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACzB,OAAO,CAAE,IAAI,AACf,CAAC,AAED,eAAe,eAAC,CAAC,AACf,MAAM,CAAE,KAAK,CACb,MAAM,CAAE,IAAI,CACZ,iBAAiB,CAAE,SAAS,CAC5B,eAAe,CAAE,OAAO,CACxB,mBAAmB,CAAE,MAAM,AAC7B,CAAC,AAED,qBAAqB,eAAC,CAAC,AACrB,SAAS,CAAE,IAAI,CACf,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,IAAI,AACd,CAAC,AAED,MAAM,eAAC,CAAC,AACN,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OAAO,AAClB,CAAC,AAED,iBAAiB,eAAC,CAAC,AACjB,eAAe,CAAE,IAAI,CACrB,KAAK,CAAE,IAAI,AACb,CAAC,AAED,gCAAiB,MAAM,AAAC,CAAC,AACvB,KAAK,CAAE,IAAI,GAAG,CAAC,GAAG,CAAC,GAAG,CAAC,AACzB,CAAC,AAED,aAAa,eAAC,CAAC,AACb,SAAS,CAAE,IAAI,CACf,KAAK,CAAE,GAAG,CACV,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,IAAI,CAAC,CAAC,AAChB,CAAC,AAED,qBAAqB,eAAC,CAAC,AAErB,aAAa,CAAE,IAAI,eAAe,CAAC,CACnC,UAAU,CAAE,KAAK,AACnB,CAAC,AAED,iBAAiB,eAAC,CAAC,AACjB,OAAO,CAAE,IAAI,CACb,YAAY,CAAE,EAAE,CAChB,UAAU,CAAE,KAAK,AACnB,CAAC,AAED,mBAAmB,eAAC,CAAC,AACnB,SAAS,CAAE,GAAG,CACd,WAAW,CAAE,GAAG,AAClB,CAAC,AAED,YAAY,eAAC,CAAC,AACZ,SAAS,CAAE,IAAI,CACf,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,CAAC,CAAC,EAAE,CAAC,GAAG,AAClB,CAAC,AAED,KAAK,eAAC,CAAC,AACL,gBAAgB,CAAE,IAAI,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,AACtC,CAAC,AAED,IAAI,eAAC,CAAC,AACJ,gBAAgB,CAAE,IAAI,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,AACtC,CAAC,AAED,KAAK,eAAC,CAAC,AACL,gBAAgB,CAAE,OAAO,AAC3B,CAAC,AAED,iBAAiB,eAAC,CAAC,AACjB,SAAS,CAAE,IAAI,CACf,KAAK,CAAE,IAAI,AACb,CAAC,AAED,mBAAmB,eAAC,CAAC,AACnB,WAAW,CAAE,GAAG,CAChB,WAAW,CAAE,CAAC,CAAC,UAAU,CACzB,MAAM,CAAE,CAAC,CAAC,UAAU,AACtB,CAAC,AACD,gBAAgB,eAAC,CAAC,AAChB,UAAU,CAAE,IAAI,CAChB,OAAO,CAAE,IAAI,CAAC,CAAC,CAAC,UAAU,CAC1B,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,UAAU,CAAE,OAAO,CACnB,MAAM,CAAE,IAAI,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,KAAK,CAAC,GAAG,CACpC,KAAK,CAAE,IAAI,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CACzB,aAAa,CAAE,IAAI,eAAe,CAAC,CACnC,MAAM,CAAE,CAAC,CAAC,IAAI,CAAC,UAAU,AAC3B,CAAC,AACD,eAAe,eAAC,CAAC,AACf,OAAO,CAAE,GAAG,CAAC,CAAC,CAAC,GAAG,CAClB,aAAa,CAAE,IAAI,eAAe,CAAC,CACnC,UAAU,CAAE,GAAG,AACjB,CAAC,AAED,SAAS,eAAC,CAAC,AACT,aAAa,CAAE,IAAI,AACrB,CAAC,AAED,cAAc,eAAC,CAAC,AACd,SAAS,CAAE,IAAI,CACf,KAAK,CAAE,IAAI,GAAG,CAAC,GAAG,CAAC,GAAG,CAAC,CACvB,aAAa,CAAE,GAAG,AACpB,CAAC,AAED,UAAU,eAAC,CAAC,AACV,KAAK,CAAE,IAAI,CACX,KAAK,CAAE,KAAK,GAAG,CAAC,CAAC,CAAC,IAAI,CAAC,CACvB,UAAU,CAAE,IAAI,AAClB,CAAC,AAED,MAAM,eAAC,CAAC,AACN,KAAK,CAAE,IAAI,CACX,SAAS,CAAE,IAAI,CACf,MAAM,CAAE,CAAC,CAAC,GAAG,CACb,UAAU,CAAE,MAAM,CAClB,WAAW,CAAE,GAAG,AAClB,CAAC,AAED,UAAU,eAAC,CAAC,AACV,KAAK,CAAE,IAAI,CACX,KAAK,CAAE,KAAK,GAAG,CAAC,CAAC,CAAC,IAAI,CAAC,CACvB,UAAU,CAAE,KAAK,AACnB,CAAC,AAED,yBAAU,CACV,UAAU,eAAC,CAAC,AACV,SAAS,CAAE,IAAI,AACjB,CAAC,AAED,mBAAmB,eAAC,CAAC,AACnB,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,IAAI,AAClB,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,qBAAqB,eAAC,CAAC,AACrB,MAAM,CAAE,IAAI,CAAC,IAAI,CAAC,CAAC,AACrB,CAAC,AACD,iBAAiB,eAAC,CAAC,AACjB,MAAM,CAAE,EAAE,CAAC,EAAE,CAAC,EAAE,CAAC,CAAC,AACpB,CAAC,AACH,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,qBAAqB,eAAC,CAAC,AACrB,MAAM,CAAE,IAAI,CAAC,IAAI,CAAC,CAAC,AACrB,CAAC,AAGD,iBAAiB,eAAC,CAAC,AACjB,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,IAAI,AACd,CAAC,AAED,qBAAqB,eAAC,CAAC,AACrB,MAAM,CAAE,CAAC,CAAC,IAAI,CACd,KAAK,CAAE,IAAI,AACb,CAAC,AAED,aAAa,eAAC,CAAC,AACb,MAAM,CAAE,IAAI,CAAC,IAAI,CAAC,CAAC,CACnB,KAAK,CAAE,IAAI,AACb,CAAC,AAED,qBAAqB,eAAC,CAAC,AACrB,cAAc,CAAE,CAAC,AACnB,CAAC,AACD,qBAAqB,eAAC,CAAC,AACrB,cAAc,CAAE,MAAM,CACtB,UAAU,CAAE,IAAI,AAClB,CAAC,AAED,gBAAgB,eAAC,CAAC,AAChB,OAAO,CAAE,GAAG,CAAC,IAAI,AACnB,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,qBAAqB,eAAC,CAAC,AACrB,MAAM,CAAE,IAAI,CAAC,IAAI,AACnB,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,iBAAiB,eAAC,CAAC,AACjB,MAAM,CAAE,IAAI,CAAC,IAAI,CACjB,SAAS,CAAE,MAAM,AACnB,CAAC,AACD,qBAAqB,eAAC,CAAC,AACrB,MAAM,CAAE,IAAI,CAAC,IAAI,AACnB,CAAC,AAKH,CAAC\"}"
};

function ordinal$1(n) {
	let ord = [,"st", "nd", "rd"];
	let a = n % 100;
	return n + (ord[a > 20 ? a % 10 : a] || "th");
}

const NextGameStats = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function setOppTeam() {
		if (data.upcoming[team].nextTeam != null) {
			oppTeam = data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, "-");
		}
	}

	let oppTeam;
	let { data, team, currentMatchday, showBadge, toAlias, switchTeam } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.showBadge === void 0 && $$bindings.showBadge && showBadge !== void 0) $$bindings.showBadge(showBadge);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$8);
	team && setOppTeam();

	return `<div class="${"next-game-prediction svelte-1xjzojr"}" style="${"border: 6px solid var(--" + escape(oppTeam, true) + ");"}"><div class="${"next-game-title svelte-1xjzojr"}" style="${"background-color: var(--" + escape(oppTeam, true) + ");"}"><h1 class="${"next-game-title-text svelte-1xjzojr"}" style="${"color: var(--" + escape(oppTeam, true) + "-secondary);"}">Next Game: 
      <button class="${"next-game-team-btn svelte-1xjzojr"}">${escape(toAlias(data.upcoming[team].nextTeam))} </button>
      (${escape(data.upcoming[team].atHome ? "Home" : "Away")})
    </h1></div>

  <div class="${"next-game-values svelte-1xjzojr"}"><div class="${"predictions-and-logo svelte-1xjzojr"}">${showBadge
	? `<div class="${"next-game-logo opposition-badge svelte-1xjzojr"}" style="${"background-image: url('" + escape(data.logoURLs[data.upcoming[team].nextTeam], true) + "')"}"></div>`
	: `<div class="${"next-game-position svelte-1xjzojr"}"></div>`}
      <div class="${"predictions"}"><div class="${"next-game-item svelte-1xjzojr"}"><div class="${"next-game-position svelte-1xjzojr"}">${escape(ordinal$1(data.standings[data.upcoming[team].nextTeam][data._id].position))}</div></div>
        <div class="${"next-game-item svelte-1xjzojr"}">Current form:
          ${currentMatchday != null
	? `<b>${escape((data.form[data._id][data.upcoming[team].nextTeam][currentMatchday].formRating5 * 100).toFixed(1))}%</b>`
	: `None`}</div>
        <div class="${"next-game-item svelte-1xjzojr"}">Score prediction
          <br>
          <a class="${"predictions-link svelte-1xjzojr"}" href="${"/predictions"}"><b>${escape(Math.round(data.upcoming[team].prediction.homeGoals))} - ${escape(Math.round(data.upcoming[team].prediction.awayGoals))}</b></a>
          <br>
          </div></div></div>
    <div class="${"past-results svelte-1xjzojr"}">${data.upcoming[team].prevMatches.length == 0
	? `<div class="${"next-game-item prev-results-title no-prev-results svelte-1xjzojr"}">No Previous Results
        </div>`
	: `<div class="${"next-game-item prev-results-title svelte-1xjzojr"}">Previous Results</div>`}

      
      ${each(data.upcoming[team].prevMatches, prevMatch => {
		return `<div class="${"next-game-item " + escape(prevMatch.result, true) + " svelte-1xjzojr"}"><div class="${"past-result svelte-1xjzojr"}"><div class="${"home-team svelte-1xjzojr"}">${escape(toAlias(prevMatch.homeTeam))}</div>
            <div class="${"score svelte-1xjzojr"}">${escape(prevMatch.homeGoals)} - ${escape(prevMatch.awayGoals)}</div>
            <div class="${"away-team svelte-1xjzojr"}">${escape(toAlias(prevMatch.awayTeam))}</div></div>
          <div style="${"clear: both"}"></div>
          <div class="${"past-result-date svelte-1xjzojr"}">${escape(new Date(prevMatch.date).toLocaleDateString("en-us", {
			weekday: "long",
			year: "numeric",
			month: "short",
			day: "numeric"
		}))}</div>
        </div>`;
	})}</div></div>
</div>`;
});

/* src\components\next_game\NextGame.svelte generated by Svelte v3.49.0 */

const NextGame = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { data, currentMatchday, team, showBadge, toAlias, switchTeam } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.showBadge === void 0 && $$bindings.showBadge && showBadge !== void 0) $$bindings.showBadge(showBadge);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);

	return `${data != undefined
	? `${data.upcoming[team].nextTeam == null
		? `${validate_component(SeasonComplete, "SeasonComplete").$$render($$result, { data }, {}, {})}`
		: `${validate_component(NextGameStats, "NextGameStats").$$render(
				$$result,
				{
					data,
					currentMatchday,
					team,
					showBadge,
					toAlias,
					switchTeam
				},
				{},
				{}
			)}`}`
	: ``}`;
});

/* src\components\SeasonStats.svelte generated by Svelte v3.49.0 */

const css$7 = {
	code: "#ssp1.svelte-jyia24{right:calc(var(--ssp1-offset) - 1.2em)}#ssp2.svelte-jyia24{right:calc(var(--ssp2-offset) - 1.2em)}#ssp3.svelte-jyia24{right:calc(var(--ssp3-offset) - 1.2em)}.ssp-1st.svelte-jyia24{color:#6cff68}.ssp-2nd.svelte-jyia24{color:#78f570}.ssp-3rd.svelte-jyia24{color:#81eb78}.ssp-4th.svelte-jyia24{color:#89e07f}.ssp-5th.svelte-jyia24{color:#8fd686}.ssp-6th.svelte-jyia24{color:#95cc8c}.ssp-7th.svelte-jyia24{color:#99c192}.ssp-8th.svelte-jyia24{color:#9db797}.ssp-9th.svelte-jyia24{color:#a0ad9d}.ssp-10th.svelte-jyia24{color:#a2a2a2}.ssp-11th.svelte-jyia24{color:#a2a2a2}.ssp-12th.svelte-jyia24{color:#af9d9b}.ssp-13th.svelte-jyia24{color:#bc9895}.ssp-14th.svelte-jyia24{color:#c7928e}.ssp-15th.svelte-jyia24{color:#d18d88}.ssp-16th.svelte-jyia24{color:#db8681}.ssp-17th.svelte-jyia24{color:#e5807b}.ssp-18th.svelte-jyia24{color:#ee7975}.ssp-19th.svelte-jyia24{color:#f7716e}.ssp-20th.svelte-jyia24{color:#ff6868}.season-stats.svelte-jyia24{display:flex;font-size:2.2em;width:100%;letter-spacing:-0.06em}.season-stat-value.svelte-jyia24{font-size:3.2em;line-height:0.6em;font-weight:700;width:fit-content;margin:0 auto;position:relative;user-select:none}.season-stat-position.svelte-jyia24{font-size:0.3em;position:absolute;top:-1em;letter-spacing:-0.07em}.season-stat.svelte-jyia24{flex:1}@media only screen and (max-width: 1400px){.season-stat-value.svelte-jyia24{font-size:2.5em}.season-stats-row.svelte-jyia24{margin:70px 0 10px}.season-stat-text.svelte-jyia24{font-size:0.9em}}@media only screen and (max-width: 800px){.season-stats.svelte-jyia24{flex-direction:column}.season-stat-text.svelte-jyia24{font-size:0.9em}.season-stat.svelte-jyia24{margin:0.5em 0 0.9em 0}.season-stat-value.svelte-jyia24{font-size:2.5em}.season-stat-text.svelte-jyia24{font-size:0.9em}}@media only screen and (max-width: 550px){.season-stat-value.svelte-jyia24{font-size:1.4em;letter-spacing:0.01em}.season-stat.svelte-jyia24{margin:0.25em 0 0.45em 0}.season-stat-position.svelte-jyia24{font-size:0.5em;top:-0.5em}.season-stat-text.svelte-jyia24{letter-spacing:-0.04em;font-size:0.7em}}",
	map: "{\"version\":3,\"file\":\"SeasonStats.svelte\",\"sources\":[\"SeasonStats.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  import { onMount } from \\\"svelte\\\";\\r\\n\\r\\n  function ordinal(n) {\\r\\n    let ord = [, \\\"st\\\", \\\"nd\\\", \\\"rd\\\"];\\r\\n    let a = n % 100;\\r\\n    return n + (ord[a > 20 ? a % 10 : a] || \\\"th\\\");\\r\\n  }\\r\\n\\r\\n  function getStatsRank(seasonStats, attribute, team, reverse) {\\r\\n    let sorted = Object.keys(seasonStats).sort(function (team1, team2) {\\r\\n      return seasonStats[team2][attribute] - seasonStats[team1][attribute];\\r\\n    });\\r\\n    let rank = sorted.indexOf(team) + 1;\\r\\n    if (reverse) {\\r\\n      rank = 21 - rank;\\r\\n    }\\r\\n    return rank;\\r\\n  }\\r\\n\\r\\n  function getStatsRankings(seasonStats, team) {\\r\\n    let xGRank = ordinal(getStatsRank(seasonStats, \\\"xG\\\", team, false));\\r\\n    // Reverse - lower rank the better\\r\\n    let xCRank = ordinal(getStatsRank(seasonStats, \\\"xC\\\", team, true));\\r\\n    let cleanSheetRatioRank = ordinal(\\r\\n      getStatsRank(seasonStats, \\\"cleanSheetRatio\\\", team, false)\\r\\n    );\\r\\n    return { xG: xGRank, xC: xCRank, cleanSheetRatio: cleanSheetRatioRank };\\r\\n  }\\r\\n\\r\\n  function setPositionalOffset() {\\r\\n    document.documentElement.style.setProperty(\\r\\n      \\\"--ssp1-offset\\\",\\r\\n      -ssp1.clientWidth / 2 + \\\"px\\\"\\r\\n    );\\r\\n    document.documentElement.style.setProperty(\\r\\n      \\\"--ssp2-offset\\\",\\r\\n      -ssp2.clientWidth / 2 + \\\"px\\\"\\r\\n    );\\r\\n    document.documentElement.style.setProperty(\\r\\n      \\\"--ssp3-offset\\\",\\r\\n      -ssp3.clientWidth / 2 + \\\"px\\\"\\r\\n    );\\r\\n  }\\r\\n\\r\\n  function setStatsValues(seasonStats, team) {\\r\\n    rank = getStatsRankings(seasonStats, team);\\r\\n\\r\\n    // Keep ordinal values at the correct offset\\r\\n    // Once rank values have updated, init positional offset for ordinal values\\r\\n    window.addEventListener(\\\"resize\\\", setPositionalOffset);\\r\\n    // setTimeout(function () {\\r\\n    //   setPositionalOffset();\\r\\n    // }, 0);\\r\\n  }\\r\\n\\r\\n  function isCleanSheet(h, a, atHome) {\\r\\n    return (a == 0 && atHome) || (h == 0 && !atHome)\\r\\n  }\\r\\n\\r\\n  function goalsScored(h, a, atHome) {\\r\\n    if (atHome) {\\r\\n      return h\\r\\n    } else {\\r\\n      return a\\r\\n    }\\r\\n  }\\r\\n\\r\\n  function goalsConceded(h, a, atHome) {\\r\\n    if (atHome) {\\r\\n      return a\\r\\n    } else {\\r\\n      return h\\r\\n    }\\r\\n  }\\r\\n\\r\\n  function notScored(h, a, atHome) {\\r\\n    return (h == 0 && atHome) || (a == 0 && !atHome)\\r\\n  }\\r\\n\\r\\n  function countOccurances(data, seasonStats, team, season) {\\r\\n    if (!(team in data.form[season])) {\\r\\n      return\\r\\n    }\\r\\n\\r\\n    for (let matchday of Object.keys(data.form[season][team])) {\\r\\n      let score = data.form[season][team][matchday].score;\\r\\n      if (score != null) {\\r\\n        let [h, _, a] = score.split(' ');\\r\\n        h = parseInt(h);\\r\\n        a = parseInt(a);\\r\\n        let atHome = data.form[season][team][matchday].atHome;\\r\\n        if (isCleanSheet(h, a, atHome)) {\\r\\n          seasonStats[team].cleanSheetRatio += 1\\r\\n        }\\r\\n        if (notScored(h, a, atHome)) {\\r\\n          seasonStats[team].noGoalRatio += 1\\r\\n        }\\r\\n        seasonStats[team].xG += goalsScored(h, a, atHome)\\r\\n        seasonStats[team].xC += goalsConceded(h, a, atHome)\\r\\n        seasonStats[team].played += 1\\r\\n      }\\r\\n    }\\r\\n  }\\r\\n  \\r\\n  function buildSeasonStats(data) {\\r\\n    let seasonStats = {}\\r\\n    for (let team of data.teamNames) {\\r\\n      seasonStats[team] = {cleanSheetRatio: 0, noGoalRatio: 0, xC: 0, xG: 0, played: 0}\\r\\n\\r\\n      countOccurances(data, seasonStats, team, data._id)\\r\\n      countOccurances(data, seasonStats, team, data._id-1)\\r\\n\\r\\n      if (seasonStats[team].played > 0) {\\r\\n        seasonStats[team].xG /= seasonStats[team].played\\r\\n        seasonStats[team].xC /= seasonStats[team].played\\r\\n        seasonStats[team].cleanSheetRatio /= seasonStats[team].played\\r\\n        seasonStats[team].noGoalRatio /= seasonStats[team].played\\r\\n      }\\r\\n    }\\r\\n\\r\\n    return seasonStats;\\r\\n  }\\r\\n\\r\\n  function refreshStatsValues() {\\r\\n    if (setup) {\\r\\n      // seasonStats = buildSeasonStats(data)\\r\\n      setStatsValues(seasonStats, team);\\r\\n    }\\r\\n  }\\r\\n\\r\\n  let seasonStats;\\r\\n  let ssp1, ssp2, ssp3;\\r\\n  let rank = {\\r\\n    xG: \\\"\\\",\\r\\n    xC: \\\"\\\",\\r\\n    cleanSheetRatio: \\\"\\\",\\r\\n  };\\r\\n  let setup = false;\\r\\n  onMount(() => {\\r\\n    seasonStats = buildSeasonStats(data);\\r\\n    setStatsValues(seasonStats, team);\\r\\n    setup = true;\\r\\n  });\\r\\n\\r\\n  $: team && refreshStatsValues();\\r\\n\\r\\n  export let data, team;\\r\\n</script>\\r\\n\\r\\n{#if seasonStats != undefined}\\r\\n  <div class=\\\"season-stats\\\">\\r\\n    <div class=\\\"season-stat goals-per-game\\\">\\r\\n      <div class=\\\"season-stat-value\\\">\\r\\n        {seasonStats[team].xG.toFixed(2)}\\r\\n        <div\\r\\n          class=\\\"season-stat-position ssp-{rank.xG}\\\"\\r\\n          id=\\\"ssp1\\\"\\r\\n          bind:this={ssp1}\\r\\n        >\\r\\n          {rank.xG}\\r\\n        </div>\\r\\n      </div>\\r\\n      <div class=\\\"season-stat-text\\\">goals per game</div>\\r\\n    </div>\\r\\n    <div class=\\\"season-stat conceded-per-game\\\">\\r\\n      <div class=\\\"season-stat-value\\\">\\r\\n        {seasonStats[team].xC.toFixed(2)}\\r\\n        <div\\r\\n          class=\\\"season-stat-position ssp-{rank.xC}\\\"\\r\\n          id=\\\"ssp2\\\"\\r\\n          bind:this={ssp2}\\r\\n        >\\r\\n          {rank.xC}\\r\\n        </div>\\r\\n      </div>\\r\\n      <div class=\\\"season-stat-text\\\">conceded per game</div>\\r\\n    </div>\\r\\n    <div class=\\\"season-stat clean-sheet-ratio\\\">\\r\\n      <div class=\\\"season-stat-value\\\">\\r\\n        {seasonStats[team].cleanSheetRatio.toFixed(2)}\\r\\n        <div\\r\\n          class=\\\"season-stat-position ssp-{rank.cleanSheetRatio}\\\"\\r\\n          id=\\\"ssp3\\\"\\r\\n          bind:this={ssp3}\\r\\n        >\\r\\n          {rank.cleanSheetRatio}\\r\\n        </div>\\r\\n      </div>\\r\\n      <div class=\\\"season-stat-text\\\">clean sheets</div>\\r\\n    </div>\\r\\n  </div>\\r\\n{/if}\\r\\n\\r\\n<style scoped>\\r\\n  #ssp1 {\\r\\n    right: calc(var(--ssp1-offset) - 1.2em);\\r\\n  }\\r\\n  #ssp2 {\\r\\n    right: calc(var(--ssp2-offset) - 1.2em);\\r\\n  }\\r\\n  #ssp3 {\\r\\n    right: calc(var(--ssp3-offset) - 1.2em);\\r\\n  }\\r\\n  .ssp-1st {\\r\\n    color: #6cff68;\\r\\n  }\\r\\n  .ssp-2nd {\\r\\n    color: #78f570;\\r\\n  }\\r\\n  .ssp-3rd {\\r\\n    color: #81eb78;\\r\\n  }\\r\\n  .ssp-4th {\\r\\n    color: #89e07f;\\r\\n  }\\r\\n  .ssp-5th {\\r\\n    color: #8fd686;\\r\\n  }\\r\\n  .ssp-6th {\\r\\n    color: #95cc8c;\\r\\n  }\\r\\n  .ssp-7th {\\r\\n    color: #99c192;\\r\\n  }\\r\\n  .ssp-8th {\\r\\n    color: #9db797;\\r\\n  }\\r\\n  .ssp-9th {\\r\\n    color: #a0ad9d;\\r\\n  }\\r\\n  .ssp-10th {\\r\\n    color: #a2a2a2;\\r\\n  }\\r\\n  .ssp-11th {\\r\\n    color: #a2a2a2;\\r\\n  }\\r\\n  .ssp-12th {\\r\\n    color: #af9d9b;\\r\\n  }\\r\\n  .ssp-13th {\\r\\n    color: #bc9895;\\r\\n  }\\r\\n  .ssp-14th {\\r\\n    color: #c7928e;\\r\\n  }\\r\\n  .ssp-15th {\\r\\n    color: #d18d88;\\r\\n  }\\r\\n  .ssp-16th {\\r\\n    color: #db8681;\\r\\n  }\\r\\n  .ssp-17th {\\r\\n    color: #e5807b;\\r\\n  }\\r\\n  .ssp-18th {\\r\\n    color: #ee7975;\\r\\n  }\\r\\n  .ssp-19th {\\r\\n    color: #f7716e;\\r\\n  }\\r\\n  .ssp-20th {\\r\\n    color: #ff6868;\\r\\n  }\\r\\n  .season-stats {\\r\\n    display: flex;\\r\\n    font-size: 2.2em;\\r\\n    width: 100%;\\r\\n    letter-spacing: -0.06em;\\r\\n  }\\r\\n\\r\\n  .season-stat-value {\\r\\n    font-size: 3.2em;\\r\\n    line-height: 0.6em;\\r\\n    font-weight: 700;\\r\\n    width: fit-content;\\r\\n    margin: 0 auto;\\r\\n    position: relative;\\r\\n    user-select: none;\\r\\n  }\\r\\n\\r\\n  .season-stat-position {\\r\\n    font-size: 0.3em;\\r\\n    position: absolute;\\r\\n    top: -1em;\\r\\n    letter-spacing: -0.07em;\\r\\n  }\\r\\n\\r\\n  .season-stat {\\r\\n    flex: 1;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1400px) {\\r\\n    .season-stat-value {\\r\\n      font-size: 2.5em;\\r\\n    }\\r\\n\\r\\n    /* .season-stat {\\r\\n    margin: 0.4em 0 1em 0;\\r\\n  } */\\r\\n\\r\\n    .season-stats-row {\\r\\n      margin: 70px 0 10px;\\r\\n    }\\r\\n\\r\\n    .season-stat-text {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .season-stats {\\r\\n      flex-direction: column;\\r\\n    }\\r\\n\\r\\n    .season-stat-text {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n    .season-stat {\\r\\n      margin: 0.5em 0 0.9em 0;\\r\\n    }\\r\\n\\r\\n    .season-stat-value {\\r\\n      font-size: 2.5em;\\r\\n    }\\r\\n\\r\\n    .season-stat-text {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .season-stat-value {\\r\\n      font-size: 1.4em;\\r\\n      letter-spacing: 0.01em;\\r\\n    }\\r\\n\\r\\n    .season-stat {\\r\\n      margin: 0.25em 0 0.45em 0;\\r\\n    }\\r\\n    .season-stat-position {\\r\\n      font-size: 0.5em;\\r\\n      top: -0.5em;\\r\\n    }\\r\\n    .season-stat-text {\\r\\n      letter-spacing: -0.04em;\\r\\n      font-size: 0.7em;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

function ordinal(n) {
	let ord = [,"st", "nd", "rd"];
	let a = n % 100;
	return n + (ord[a > 20 ? a % 10 : a] || "th");
}

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

function getStatsRankings(seasonStats, team) {
	let xGRank = ordinal(getStatsRank(seasonStats, "xG", team, false));

	// Reverse - lower rank the better
	let xCRank = ordinal(getStatsRank(seasonStats, "xC", team, true));

	let cleanSheetRatioRank = ordinal(getStatsRank(seasonStats, "cleanSheetRatio", team, false));

	return {
		xG: xGRank,
		xC: xCRank,
		cleanSheetRatio: cleanSheetRatioRank
	};
}

// }, 0);
function isCleanSheet(h, a, atHome) {
	return a == 0 && atHome || h == 0 && !atHome;
}

function goalsScored(h, a, atHome) {
	if (atHome) {
		return h;
	} else {
		return a;
	}
}

function goalsConceded(h, a, atHome) {
	if (atHome) {
		return a;
	} else {
		return h;
	}
}

function notScored(h, a, atHome) {
	return h == 0 && atHome || a == 0 && !atHome;
}

function countOccurances(data, seasonStats, team, season) {
	if (!(team in data.form[season])) {
		return;
	}

	for (let matchday of Object.keys(data.form[season][team])) {
		let score = data.form[season][team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(' ');
			h = parseInt(h);
			a = parseInt(a);
			let atHome = data.form[season][team][matchday].atHome;

			if (isCleanSheet(h, a, atHome)) {
				seasonStats[team].cleanSheetRatio += 1;
			}

			if (notScored(h, a, atHome)) {
				seasonStats[team].noGoalRatio += 1;
			}

			seasonStats[team].xG += goalsScored(h, a, atHome);
			seasonStats[team].xC += goalsConceded(h, a, atHome);
			seasonStats[team].played += 1;
		}
	}
}

function buildSeasonStats(data) {
	let seasonStats = {};

	for (let team of data.teamNames) {
		seasonStats[team] = {
			cleanSheetRatio: 0,
			noGoalRatio: 0,
			xC: 0,
			xG: 0,
			played: 0
		};

		countOccurances(data, seasonStats, team, data._id);
		countOccurances(data, seasonStats, team, data._id - 1);

		if (seasonStats[team].played > 0) {
			seasonStats[team].xG /= seasonStats[team].played;
			seasonStats[team].xC /= seasonStats[team].played;
			seasonStats[team].cleanSheetRatio /= seasonStats[team].played;
			seasonStats[team].noGoalRatio /= seasonStats[team].played;
		}
	}

	return seasonStats;
}

const SeasonStats = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function setPositionalOffset() {
		document.documentElement.style.setProperty("--ssp1-offset", -ssp1.clientWidth / 2 + "px");
		document.documentElement.style.setProperty("--ssp2-offset", -ssp2.clientWidth / 2 + "px");
		document.documentElement.style.setProperty("--ssp3-offset", -ssp3.clientWidth / 2 + "px");
	}

	function setStatsValues(seasonStats, team) {
		rank = getStatsRankings(seasonStats, team);

		// Keep ordinal values at the correct offset
		// Once rank values have updated, init positional offset for ordinal values
		window.addEventListener("resize", setPositionalOffset);
	} // setTimeout(function () {
	//   setPositionalOffset();

	function refreshStatsValues() {
		if (setup) {
			// seasonStats = buildSeasonStats(data)
			setStatsValues(seasonStats, team);
		}
	}

	let seasonStats;
	let ssp1, ssp2, ssp3;
	let rank = { xG: "", xC: "", cleanSheetRatio: "" };
	let setup = false;

	onMount(() => {
		seasonStats = buildSeasonStats(data);
		setStatsValues(seasonStats, team);
		setup = true;
	});

	let { data, team } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	$$result.css.add(css$7);
	team && refreshStatsValues();

	return `${seasonStats != undefined
	? `<div class="${"season-stats svelte-jyia24"}"><div class="${"season-stat goals-per-game svelte-jyia24"}"><div class="${"season-stat-value svelte-jyia24"}">${escape(seasonStats[team].xG.toFixed(2))}
        <div class="${"season-stat-position ssp-" + escape(rank.xG, true) + " svelte-jyia24"}" id="${"ssp1"}"${add_attribute("this", ssp1, 0)}>${escape(rank.xG)}</div></div>
      <div class="${"season-stat-text svelte-jyia24"}">goals per game</div></div>
    <div class="${"season-stat conceded-per-game svelte-jyia24"}"><div class="${"season-stat-value svelte-jyia24"}">${escape(seasonStats[team].xC.toFixed(2))}
        <div class="${"season-stat-position ssp-" + escape(rank.xC, true) + " svelte-jyia24"}" id="${"ssp2"}"${add_attribute("this", ssp2, 0)}>${escape(rank.xC)}</div></div>
      <div class="${"season-stat-text svelte-jyia24"}">conceded per game</div></div>
    <div class="${"season-stat clean-sheet-ratio svelte-jyia24"}"><div class="${"season-stat-value svelte-jyia24"}">${escape(seasonStats[team].cleanSheetRatio.toFixed(2))}
        <div class="${"season-stat-position ssp-" + escape(rank.cleanSheetRatio, true) + " svelte-jyia24"}" id="${"ssp3"}"${add_attribute("this", ssp3, 0)}>${escape(rank.cleanSheetRatio)}</div></div>
      <div class="${"season-stat-text svelte-jyia24"}">clean sheets</div></div></div>`
	: ``}`;
});

/* src\components\TeamsFooter.svelte generated by Svelte v3.49.0 */

const css$6 = {
	code: ".teams-footer.svelte-qr69iz{padding:50px 0 4px;height:auto;width:100%;font-size:13px;align-items:center}.teams-footer-bottom.svelte-qr69iz{margin-top:30px}.footer-details.svelte-qr69iz{display:flex;flex-direction:column}.footer-detail.svelte-qr69iz{margin:4px 0 !important}.created-by.svelte-qr69iz{margin-left:auto !important;margin:0 10px}.version.svelte-qr69iz{margin:0 10px}.last-updated.svelte-qr69iz{text-align:center;margin-bottom:1em}.ko-fi.svelte-qr69iz{width:fit-content;background:#ff5f5f;padding:0.8em 1.8em;color:white;text-decoration:none;border-radius:6px;display:flex;margin:auto}.ko-fi-text.svelte-qr69iz{margin:auto 0;font-size:1.05em}.ko-fi-img.svelte-qr69iz{width:2.2em;height:2.2em;margin-right:1em}",
	map: "{\"version\":3,\"file\":\"TeamsFooter.svelte\",\"sources\":[\"TeamsFooter.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  export let lastUpdated;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"teams-footer footer-text-colour\\\">\\r\\n  <a class=\\\"ko-fi\\\" href=\\\"https://ko-fi.com/C0C069FOI\\\" target=\\\"_blank\\\">\\r\\n    <img class=\\\"ko-fi-img\\\" src=\\\"img/kofi.png\\\" alt=\\\"\\\" />\\r\\n    <div class=\\\"ko-fi-text\\\">Support Me</div>\\r\\n  </a>\\r\\n  <div class=\\\"teams-footer-bottom\\\">\\r\\n    {#if lastUpdated != null}\\r\\n      <div class=\\\"last-updated\\\">Last updated: {lastUpdated} UTC</div>\\r\\n    {/if}\\r\\n    <div class=\\\"footer-details\\\">\\r\\n      <div class=\\\"footer-detail footer-text-colour\\\">\\r\\n        Data provided by\\r\\n        <a\\r\\n          class=\\\"footer-text-colour underline\\\"\\r\\n          href=\\\"https://www.football-data.org/\\\">football-data.org</a\\r\\n        >\\r\\n      </div>\\r\\n      <div class=\\\"footer-detail footer-text-colour\\\">\\r\\n        Graphs created using\\r\\n        <a class=\\\"footer-text-colour underline\\\" href=\\\"https://plotly.com/\\\"\\r\\n          >Plotly</a\\r\\n        >\\r\\n      </div>\\r\\n      <div class=\\\"footer-detail footer-text-colour\\\">\\r\\n        Font made from\\r\\n        <a class=\\\"footer-text-colour\\\" href=\\\"http://www.onlinewebfonts.com\\\"\\r\\n          >oNline Web Fonts</a\\r\\n        >\\r\\n        is licensed by CC BY 3.0\\r\\n      </div>\\r\\n    </div>\\r\\n    <div class=\\\"footer-bottom\\\">\\r\\n      <div class=\\\"created-by footer-text-colour\\\">Created by Tom Draper</div>\\r\\n      <div class=\\\"version footer-text-colour\\\">v2.0</div>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .teams-footer {\\r\\n    padding: 50px 0 4px;\\r\\n    height: auto;\\r\\n    width: 100%;\\r\\n    font-size: 13px;\\r\\n    align-items: center;\\r\\n  }\\r\\n  .teams-footer-bottom {\\r\\n    margin-top: 30px;\\r\\n  }\\r\\n  .footer-details {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n  }\\r\\n  .footer-detail {\\r\\n    margin: 4px 0 !important;\\r\\n  }\\r\\n  .created-by {\\r\\n    margin-left: auto !important;\\r\\n    margin: 0 10px;\\r\\n  }\\r\\n  .version {\\r\\n    margin: 0 10px;\\r\\n  }\\r\\n  .last-updated {\\r\\n    text-align: center;\\r\\n    margin-bottom: 1em;\\r\\n  }\\r\\n\\r\\n  /* Kofi button */\\r\\n  .ko-fi {\\r\\n    width: fit-content;\\r\\n    background: #ff5f5f;\\r\\n    padding: 0.8em 1.8em;\\r\\n    color: white;\\r\\n    text-decoration: none;\\r\\n    border-radius: 6px;\\r\\n    display: flex;\\r\\n    margin: auto;\\r\\n  }\\r\\n  .ko-fi-text {\\r\\n    margin: auto 0;\\r\\n    font-size: 1.05em;\\r\\n  }\\r\\n  .ko-fi-img {\\r\\n    width: 2.2em;\\r\\n    height: 2.2em;\\r\\n    margin-right: 1em;\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA2CE,aAAa,cAAC,CAAC,AACb,OAAO,CAAE,IAAI,CAAC,CAAC,CAAC,GAAG,CACnB,MAAM,CAAE,IAAI,CACZ,KAAK,CAAE,IAAI,CACX,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,MAAM,AACrB,CAAC,AACD,oBAAoB,cAAC,CAAC,AACpB,UAAU,CAAE,IAAI,AAClB,CAAC,AACD,eAAe,cAAC,CAAC,AACf,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,AACxB,CAAC,AACD,cAAc,cAAC,CAAC,AACd,MAAM,CAAE,GAAG,CAAC,CAAC,CAAC,UAAU,AAC1B,CAAC,AACD,WAAW,cAAC,CAAC,AACX,WAAW,CAAE,IAAI,CAAC,UAAU,CAC5B,MAAM,CAAE,CAAC,CAAC,IAAI,AAChB,CAAC,AACD,QAAQ,cAAC,CAAC,AACR,MAAM,CAAE,CAAC,CAAC,IAAI,AAChB,CAAC,AACD,aAAa,cAAC,CAAC,AACb,UAAU,CAAE,MAAM,CAClB,aAAa,CAAE,GAAG,AACpB,CAAC,AAGD,MAAM,cAAC,CAAC,AACN,KAAK,CAAE,WAAW,CAClB,UAAU,CAAE,OAAO,CACnB,OAAO,CAAE,KAAK,CAAC,KAAK,CACpB,KAAK,CAAE,KAAK,CACZ,eAAe,CAAE,IAAI,CACrB,aAAa,CAAE,GAAG,CAClB,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,IAAI,AACd,CAAC,AACD,WAAW,cAAC,CAAC,AACX,MAAM,CAAE,IAAI,CAAC,CAAC,CACd,SAAS,CAAE,MAAM,AACnB,CAAC,AACD,UAAU,cAAC,CAAC,AACV,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,YAAY,CAAE,GAAG,AACnB,CAAC\"}"
};

const TeamsFooter = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { lastUpdated } = $$props;
	if ($$props.lastUpdated === void 0 && $$bindings.lastUpdated && lastUpdated !== void 0) $$bindings.lastUpdated(lastUpdated);
	$$result.css.add(css$6);

	return `<div class="${"teams-footer footer-text-colour svelte-qr69iz"}"><a class="${"ko-fi svelte-qr69iz"}" href="${"https://ko-fi.com/C0C069FOI"}" target="${"_blank"}"><img class="${"ko-fi-img svelte-qr69iz"}" src="${"img/kofi.png"}" alt="${""}">
    <div class="${"ko-fi-text svelte-qr69iz"}">Support Me</div></a>
  <div class="${"teams-footer-bottom svelte-qr69iz"}">${lastUpdated != null
	? `<div class="${"last-updated svelte-qr69iz"}">Last updated: ${escape(lastUpdated)} UTC</div>`
	: ``}
    <div class="${"footer-details svelte-qr69iz"}"><div class="${"footer-detail footer-text-colour svelte-qr69iz"}">Data provided by
        <a class="${"footer-text-colour underline"}" href="${"https://www.football-data.org/"}">football-data.org</a></div>
      <div class="${"footer-detail footer-text-colour svelte-qr69iz"}">Graphs created using
        <a class="${"footer-text-colour underline"}" href="${"https://plotly.com/"}">Plotly</a></div>
      <div class="${"footer-detail footer-text-colour svelte-qr69iz"}">Font made from
        <a class="${"footer-text-colour"}" href="${"http://www.onlinewebfonts.com"}">oNline Web Fonts</a>
        is licensed by CC BY 3.0
      </div></div>
    <div class="${"footer-bottom"}"><div class="${"created-by footer-text-colour svelte-qr69iz"}">Created by Tom Draper</div>
      <div class="${"version footer-text-colour svelte-qr69iz"}">v2.0</div></div></div>
</div>`;
});

/* src\components\Fixtures.svelte generated by Svelte v3.49.0 */

function getMatchDetail(match) {
	let matchDetail;
	let homeAway = match.atHome ? "Home" : "Away";

	if (match.score != null) {
		matchDetail = `${match.team} (${homeAway}) ${match.score}`;
	} else {
		matchDetail = `${match.team} (${homeAway})`;
	}

	return matchDetail;
}

function sortByMatchDate(x, y, details) {
	let list = [];

	for (let i = 0; i < x.length; i++) {
		list.push({ x: x[i], y: y[i], details: details[i] });
	}

	list.sort(function (a, b) {
		return a.x < b.x ? -1 : a.x == b.x ? 0 : 1;
	});

	for (let i = 0; i < list.length; i++) {
		x[i] = list[i].x;
		y[i] = list[i].y;
		details[i] = list[i].details;
	}
}

function increaseNextGameMarker(sizes, x, now, bigMarkerSize) {
	// Get matchday date with smallest time difference to now
	let nextGameIdx;

	let minDiff = Number.POSITIVE_INFINITY;

	for (let i = 0; i < x.length; i++) {
		let diff = x[i] - now;

		if (0 < diff && diff < minDiff) {
			minDiff = diff;
			nextGameIdx = i;
		}
	}

	// Increase marker size of next game
	if (nextGameIdx != undefined) {
		sizes[nextGameIdx] = bigMarkerSize;
	}

	return sizes;
}

function linePoints(data, team) {
	let x = [];
	let y = [];
	let details = [];

	for (let matchday = 1; matchday <= 38; matchday++) {
		let match = data.fixtures[team][matchday];
		x.push(new Date(match.date));
		let oppTeamRating = data.teamRatings[match.team].totalRating;

		if (match.atHome) {
			// If team playing at home, decrease opposition rating by the amount of home advantage the team gains
			oppTeamRating *= 1 - data.homeAdvantages[match.team].totalHomeAdvantage;
		}

		y.push(oppTeamRating * 100);
		let matchDetail = getMatchDetail(match);
		details.push(matchDetail);
	}

	return [x, y, details];
}

function line(data, team, now) {
	let [x, y, details] = linePoints(data, team);
	sortByMatchDate(x, y, details);
	let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);
	let sizes = Array(x.length).fill(13);
	sizes = increaseNextGameMarker(sizes, x, now, 26);

	return {
		x,
		y,
		type: "scatter",
		mode: "lines+markers",
		text: details,
		line: { color: "#737373" },
		marker: {
			size: sizes,
			// colorscale: [
			//   [0, "#01c626"],
			//   [0.1, "#08a825"],
			//   [0.2, "#0b7c20"],
			//   [0.3, "#0a661b"],
			//   [0.4, "#064411"],
			//   [0.5, "#000000"],
			//   [0.6, "#5b1d15"],
			//   [0.7, "#85160f"],
			//   [0.8, "#ad1a10"],
			//   [0.9, "#db1a0d"],
			//   [1, "#fc1303"],
			// ],
			colorscale: [[0, "#01c626"], [0.5, "#f3f3f3"], [1, "#fc1303"]],
			color: y
		},
		customdata: matchdays,
		hovertemplate: "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>"
	};
}

function nowLine(now, maxX) {
	let nowLine = [];

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
	minX.setDate(minX.getDate() - 12);

	// let maxX = new Date(Math.max(x[x.length - 1], now));
	let maxX = new Date(x[x.length - 1]);

	maxX.setDate(maxX.getDate() + 12);
	return [minX, maxX];
}

function buildPlotData(data, team) {
	// Build data to create a fixtures line graph displaying the date along the
	// x-axis and opponent strength along the y-axis
	let now = Date.now();

	let l = line(data, team, now);
	let yLabels = Array.from(Array(11), (_, i) => i * 10);
	let [minX, maxX] = xRange(l.x);

	let plotData = {
		data: [l],
		layout: {
			title: false,
			autosize: true,
			margin: { r: 20, l: 50, t: 5, b: 40, pad: 5 },
			hovermode: "closest",
			plot_bgcolor: "#fafafa",
			paper_bgcolor: "#fafafa",
			yaxis: {
				title: { text: "Team Rating" },
				gridcolor: "gray",
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
			shapes: [nowLine(now, maxX)]
		},
		config: {
			responsive: true,
			showSendToCloud: false,
			displayModeBar: false
		}
	};

	return plotData;
}

const Fixtures = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function genPlot() {
		plotData = buildPlotData(data, team);

		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			let now = Date.now();
			let l = line(data, team, now);
			plotData.data[0] = l; // Overwrite plot data
			Plotly.redraw(plotDiv);
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { data, team } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\FormOverTime.svelte generated by Svelte v3.49.0 */

function getFormLine(data, playedMatchdays, team, isMainTeam) {
	let matchdays = Object.keys(data.form[data._id][team]); // Played matchdays
	let y = [];

	for (let matchday of matchdays) {
		let form = data.form[data._id][team][matchday].formRating5;
		y.push(form * 100);
	}

	let lineVal;

	if (isMainTeam) {
		// Get team primary colour from css variable
		let teamKey = team[0].toLowerCase() + team.slice(1);

		teamKey = teamKey.replace(/ ([A-Z])/g, "-$1").toLowerCase();
		let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
		lineVal = { color: lineColor, width: 4 };
	} else {
		lineVal = { color: "#d3d3d3" };
	}

	let line = {
		x: playedMatchdays,
		y,
		name: team,
		mode: "lines",
		line: lineVal,
		text: matchdays,
		hovertemplate: `<b>${team}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
		showlegend: false
	};

	return line;
}

function lines$1(data, team, playedMatchdays) {
	let lines = [];

	for (let i = 0; i < data.teamNames.length; i++) {
		if (data.teamNames[i] != team) {
			let line = getFormLine(data, playedMatchdays, data.teamNames[i], false);
			lines.push(line);
		}
	}

	// Add this team last to ensure it overlaps all other lines
	let line = getFormLine(data, playedMatchdays, team, true);

	lines.push(line);
	return lines;
}

const FormOverTime = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildPlotData(data, team) {
		let yLabels = Array.from(Array(11), (_, i) => i * 10);

		let plotData = {
			data: lines$1(data, team, playedMatchdays),
			layout: {
				title: false,
				autosize: true,
				margin: { r: 20, l: 50, t: 15, b: 40, pad: 5 },
				hovermode: "closest",
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa",
				yaxis: {
					title: { text: "Form Rating" },
					gridcolor: "gray",
					showgrid: false,
					showline: false,
					zeroline: false,
					fixedrange: true,
					ticktext: yLabels,
					tickvals: yLabels,
					range: [0, 100]
				},
				xaxis: {
					linecolor: "black",
					showgrid: false,
					showline: false,
					fixedrange: true,
					range: [playedMatchdays[0], playedMatchdays[playedMatchdays.length - 1]]
				}
			},
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

			Plotly.redraw(plotDiv);
		}
	}

	let { data, team, playedMatchdays } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedMatchdays === void 0 && $$bindings.playedMatchdays && playedMatchdays !== void 0) $$bindings.playedMatchdays(playedMatchdays);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\PositionOverTime.svelte generated by Svelte v3.49.0 */

function getLineConfig(team, isMainTeam) {
	let lineConfig;

	if (isMainTeam) {
		// Get team primary colour from css variable
		let teamKey = team[0].toLowerCase() + team.slice(1);

		teamKey = teamKey.replace(/ ([A-Z])/g, "-$1").toLowerCase();
		let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
		lineConfig = { color: lineColor, width: 4 };
	} else {
		lineConfig = { color: "#d3d3d3" };
	}

	return lineConfig;
}

function getLineY(data, team, matchdays) {
	let y = [];

	for (let matchday of matchdays) {
		let position = data.form[data._id][team][matchday].position;
		y.push(position);
	}

	return y;
}

function getLine(data, x, team, isMainTeam) {
	let matchdays = Object.keys(data.form[data._id][team]);
	let y = getLineY(data, team, matchdays);
	let lineConfig = getLineConfig(team, isMainTeam);

	let line = {
		x,
		y,
		name: team,
		mode: "lines",
		line: lineConfig,
		text: matchdays,
		hovertemplate: `<b>${team}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
		showlegend: false
	};

	return line;
}

function lines(data, team, playedMatchdays) {
	let lines = [];

	for (let i = 0; i < data.teamNames.length; i++) {
		if (data.teamNames[i] != team) {
			let line = getLine(data, playedMatchdays, data.teamNames[i], false);
			lines.push(line);
		}
	}

	// Add this team last to ensure it overlaps all other lines
	let line = getLine(data, playedMatchdays, team, true);

	lines.push(line);
	return lines;
}

const PositionOverTime = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildPlotData(data, team) {
		let yLabels = Array.from(Array(20), (_, i) => i + 1);

		let plotData = {
			data: lines(data, team, playedMatchdays),
			layout: {
				title: false,
				autosize: true,
				margin: { r: 20, l: 50, t: 15, b: 40, pad: 5 },
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
					tickvals: yLabels
				},
				xaxis: {
					linecolor: "black",
					showgrid: false,
					showline: false,
					fixedrange: true
				},
				shapes: [
					{
						type: "rect",
						x0: playedMatchdays[0],
						y0: 4.5,
						x1: playedMatchdays[playedMatchdays.length - 1],
						y1: 0.5,
						line: { width: 0 },
						fillcolor: "#77DD77",
						opacity: 0.3,
						layer: "below"
					},
					{
						type: "rect",
						x0: playedMatchdays[0],
						y0: 6.5,
						x1: playedMatchdays[playedMatchdays.length - 1],
						y1: 4.5,
						line: { width: 0 },
						fillcolor: "#4CDEEE",
						opacity: 0.3,
						layer: "below"
					},
					{
						type: "rect",
						x0: playedMatchdays[0],
						y0: 20.5,
						x1: playedMatchdays[playedMatchdays.length - 1],
						y1: 17.5,
						line: { width: 0 },
						fillcolor: "#C23B22",
						opacity: 0.3,
						layer: "below"
					}
				]
			},
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

			Plotly.redraw(plotDiv);
		}
	}

	let { data, team, playedMatchdays } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedMatchdays === void 0 && $$bindings.playedMatchdays && playedMatchdays !== void 0) $$bindings.playedMatchdays(playedMatchdays);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_scored_and_conceded\GoalsScoredAndConceded.svelte generated by Svelte v3.49.0 */

function getAvgGoalsPerGame(data) {
	let avgGoals = {};

	for (let team of data.teamNames) {
		for (let matchday of Object.keys(data.form[data._id][team])) {
			let score = data.form[data._id][team][matchday].score;

			if (score != null) {
				let [h, _, a] = score.split(" ");
				h = parseInt(h);
				a = parseInt(a);

				if (matchday in avgGoals) {
					avgGoals[matchday] += h + a;
				} else {
					avgGoals[matchday] = h + a;
				}
			}
		}
	}

	// Divide by number of teams to get avg goals per gameweek
	for (let matchday of Object.keys(avgGoals)) {
		avgGoals[matchday] /= 20;
	}

	return avgGoals;
}

function getTeamGoalsPerGame(data, team) {
	let scored = {};
	let conceded = {};

	for (let matchday of Object.keys(data.form[data._id][team])) {
		let score = data.form[data._id][team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");
			h = parseInt(h);
			a = parseInt(a);

			if (data.form[data._id][team][matchday].atHome) {
				scored[matchday] = h;
				conceded[matchday] = a;
			} else {
				scored[matchday] = a;
				conceded[matchday] = h;
			}
		}
	}

	return [scored, conceded];
}

function avgLine(playedMatchdays, avgGoals, matchdays) {
	return {
		name: "Avg",
		type: "line",
		x: playedMatchdays,
		y: Object.values(avgGoals),
		text: matchdays,
		hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals<extra></extra>",
		line: { color: "#0080FF", width: 2 }
	};
}

function teamScoredBar(playedMatchdays, teamScored, matchdays) {
	return {
		name: "Scored",
		type: "bar",
		x: playedMatchdays,
		y: Object.values(teamScored),
		text: matchdays,
		marker: { color: "#77DD77" },
		hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>"
	};
}

function teamConcededBar(playedMatchdays, teamConceded, matchdays) {
	return {
		name: "Conceded",
		type: "bar",
		x: playedMatchdays,
		y: Object.values(teamConceded),
		text: matchdays,
		marker: { color: "C23B22" },
		hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>"
	};
}

const GoalsScoredAndConceded = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildPlotData(data, team) {
		// let x = getMatchdayDates(data, fullTeamName);
		let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);

		let avgGoals = getAvgGoalsPerGame(data);
		let matchdays = Object.keys(avgGoals);
		let scoredBar = teamScoredBar(playedMatchdays, teamScored, matchdays);
		let concededBar = teamConcededBar(playedMatchdays, teamConceded, matchdays);
		let line = avgLine(playedMatchdays, avgGoals, matchdays);

		let plotData = {
			data: [scoredBar, concededBar, line],
			layout: {
				title: false,
				autosize: true,
				margin: { r: 20, l: 50, t: 15, b: 15, pad: 5 },
				barmode: "stack",
				hovermode: "closest",
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa",
				yaxis: {
					title: { text: "Goals Scored" },
					gridcolor: "gray",
					showgrid: false,
					showline: false,
					zeroline: false,
					fixedrange: true,
					rangemode: "nonnegative"
				},
				xaxis: {
					linecolor: "black",
					showgrid: false,
					showline: false,
					fixedrange: true,
					showticklabels: false
				},
				legend: { x: 1, xanchor: "right", y: 1 }
			},
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
			let scoredBar = teamScoredBar(playedMatchdays, teamScored, matchdays);
			let concededBar = teamConcededBar(playedMatchdays, teamConceded, matchdays);
			plotData.data[0] = scoredBar;
			plotData.data[1] = concededBar;
			Plotly.redraw(plotDiv);
		}
	}

	let { data, team, playedMatchdays } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedMatchdays === void 0 && $$bindings.playedMatchdays && playedMatchdays !== void 0) $$bindings.playedMatchdays(playedMatchdays);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_scored_and_conceded\CleanSheets.svelte generated by Svelte v3.49.0 */

function getTeamCleanSheets(data, team) {
	let notCleanSheets = [];
	let cleanSheets = [];

	for (let matchday of Object.keys(data.form[data._id][team])) {
		let score = data.form[data._id][team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");
			h = parseInt(h);
			a = parseInt(a);

			if (data.form[data._id][team][matchday].atHome) {
				if (a > 0) {
					notCleanSheets.push(1);
					cleanSheets.push(0);
				} else {
					cleanSheets.push(1);
					notCleanSheets.push(0);
				}
			} else {
				if (h > 0) {
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

function bars(data, team, playedMatchdays) {
	let matchdays = Object.keys(data.form[data._id][team]);
	let [cleanSheets, notCleanSheets] = getTeamCleanSheets(data, team);

	return [
		{
			name: "Clean sheets",
			type: "bar",
			x: playedMatchdays,
			y: cleanSheets,
			text: matchdays,
			marker: { color: "#77DD77" },
			hovertemplate: "<b>Clean sheet<extra></extra>",
			showlegend: false
		},
		{
			name: "Conceded",
			type: "bar",
			x: playedMatchdays,
			y: notCleanSheets,
			text: matchdays,
			marker: { color: "C23B22" },
			hovertemplate: "<b>Goals conceded<extra></extra>",
			showlegend: false
		}
	];
}

const CleanSheets = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildPlotData(data, team) {
		let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);

		let plotData = {
			data: [cleanSheetsBar, concededBar],
			layout: {
				title: false,
				autosize: true,
				height: 60,
				margin: { r: 20, l: 50, t: 0, b: 40, pad: 5 },
				barmode: "stack",
				hovermode: "closest",
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa",
				yaxis: {
					title: { text: "" },
					showticklabels: false,
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
					fixedrange: true
				},
				shapes: [
					{
						type: "line",
						x0: playedMatchdays[0],
						y0: 0.5,
						x1: playedMatchdays[playedMatchdays.length - 1],
						y1: 0.5,
						layer: "below",
						line: { color: "#d3d3d3", width: 2 }
					}
				]
			},
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
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		if (setup) {
			let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);
			plotData.data[0] = cleanSheetsBar;
			plotData.data[1] = concededBar;
			Plotly.redraw(plotDiv);
		}
	}

	let { data, team, playedMatchdays } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedMatchdays === void 0 && $$bindings.playedMatchdays && playedMatchdays !== void 0) $$bindings.playedMatchdays(playedMatchdays);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_per_game\GoalsScoredFreq.svelte generated by Svelte v3.49.0 */

const GoalsScoredFreq = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildPlotData() {
		let xLabels = getXLabels();

		let plotData = {
			data: getScoredBars(),
			layout: {
				title: false,
				autosize: true,
				margin: { r: 10, l: 60, t: 15, b: 40, pad: 5 },
				hovermode: "closest",
				barmode: "overlay",
				bargap: 0,
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa",
				yaxis: getYAxisLayout(),
				xaxis: {
					title: { text: "Goals Scored" },
					linecolor: "black",
					showgrid: false,
					showline: false,
					fixedrange: true,
					ticktext: xLabels,
					tickvals: xLabels
				},
				legend: { x: 1, xanchor: "right", y: 0.95 }
			},
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

		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			plotData.data[1] = getScoredTeamBars(); // Update team bars
			Plotly.relayout(plotDiv, { yaxis: getYAxisLayout() });
			Plotly.redraw(plotDiv);
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { team, getScoredBars, getScoredTeamBars, getXLabels, getYAxisLayout } = $$props;
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.getScoredBars === void 0 && $$bindings.getScoredBars && getScoredBars !== void 0) $$bindings.getScoredBars(getScoredBars);
	if ($$props.getScoredTeamBars === void 0 && $$bindings.getScoredTeamBars && getScoredTeamBars !== void 0) $$bindings.getScoredTeamBars(getScoredTeamBars);
	if ($$props.getXLabels === void 0 && $$bindings.getXLabels && getXLabels !== void 0) $$bindings.getXLabels(getXLabels);
	if ($$props.getYAxisLayout === void 0 && $$bindings.getYAxisLayout && getYAxisLayout !== void 0) $$bindings.getYAxisLayout(getYAxisLayout);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_per_game\GoalsConcededFreq.svelte generated by Svelte v3.49.0 */

const GoalsConcededFreq = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildPlotData() {
		let xLabels = getXLabels();

		let graphData = {
			data: getConcededBars(),
			layout: {
				title: false,
				autosize: true,
				margin: { r: 10, l: 60, t: 15, b: 40, pad: 5 },
				hovermode: "closest",
				barmode: "overlay",
				bargap: 0,
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa",
				yaxis: getYAxisLayout(),
				xaxis: {
					title: { text: "Goals Conceded" },
					linecolor: "black",
					showgrid: false,
					showline: false,
					fixedrange: true,
					ticktext: xLabels,
					tickvals: xLabels
				},
				legend: { x: 1, xanchor: "right", y: 0.95 }
			},
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return graphData;
	}

	function genPlot() {
		plotData = buildPlotData();

		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then(plot => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	}

	function refreshPlot() {
		if (setup) {
			plotData.data[1] = getConcededTeamBars();
			Plotly.relayout(plotDiv, { yaxis: getYAxisLayout() });
			Plotly.redraw(plotDiv);
		}
	}

	let plotDiv, plotData;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { team, getConcededBars, getConcededTeamBars, getXLabels, getYAxisLayout } = $$props;
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.getConcededBars === void 0 && $$bindings.getConcededBars && getConcededBars !== void 0) $$bindings.getConcededBars(getConcededBars);
	if ($$props.getConcededTeamBars === void 0 && $$bindings.getConcededTeamBars && getConcededTeamBars !== void 0) $$bindings.getConcededTeamBars(getConcededTeamBars);
	if ($$props.getXLabels === void 0 && $$bindings.getXLabels && getXLabels !== void 0) $$bindings.getXLabels(getXLabels);
	if ($$props.getYAxisLayout === void 0 && $$bindings.getYAxisLayout && getYAxisLayout !== void 0) $$bindings.getYAxisLayout(getYAxisLayout);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_per_game\GoalsPerGame.svelte generated by Svelte v3.49.0 */

function teamBars(data, type, color) {
	let opener = 'Score';

	if (type == 'conceded') {
		opener = 'Concede';
	}

	return {
		x: Object.keys(data),
		y: Object.values(data),
		type: "bar",
		name: `Goals ${type}`,
		marker: { color },
		hovertemplate: `${opener} %{x} with probability %{y:.2f}<extra></extra>`,
		// marker: { color: color },
		line: { width: 0 },
		hoverinfo: "x+y",
		opacity: 0.5
	};
}

function reversed(arr) {
	return arr.slice().reverse();
}

function countScored(data, goalFreq, season, team) {
	if (!(team in data.form[season])) {
		return;
	}

	for (let matchday of Object.keys(data.form[season][team])) {
		let score = data.form[season][team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");

			if (data.form[season][team][matchday].atHome) {
				if (h in goalFreq) {
					goalFreq[h] += 1;
				} else {
					goalFreq[h] = 1;
				}
			} else {
				if (a in goalFreq) {
					goalFreq[a] += 1;
				} else {
					goalFreq[a] = 1;
				}
			}
		}
	}
}

function avgGoalFrequencies(data) {
	let goalFreq = {};

	for (let team of data.teamNames) {
		countScored(data, goalFreq, data._id, team);
		countScored(data, goalFreq, data._id - 1, team);
	}

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
	return goalFreq;
}

function countConceded(data, goalFreq, season, team) {
	if (!(team in data.form[season])) {
		return;
	}

	for (let matchday of Object.keys(data.form[season][team])) {
		let score = data.form[season][team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");

			if (data.form[season][team][matchday].atHome) {
				if (a in goalFreq) {
					goalFreq[a] += 1;
				} else {
					goalFreq[a] = 1;
				}
			} else {
				if (h in goalFreq) {
					goalFreq[h] += 1;
				} else {
					goalFreq[h] = 1;
				}
			}
		}
	}
}

function teamConcededFrequencies(data, team) {
	let goalFreq = {};
	countConceded(data, goalFreq, data._id, team);
	countConceded(data, goalFreq, data._id - 1, team);
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
			hovertemplate: `Average %{x} with probability %{y:.2f}<extra></extra>`,
			hoverinfo: "x+y"
		};
	}

	function bars(data, name, color) {
		return [avgBars(), teamBars(data, name, color)];
	}

	// Basic colour scale shared between the two bar chars
	let colourScale = ["#5df455", "#b2d000", "#dfa700", "#f77a1c", "#f74d4d"];

	// Concatenate unique extreme colours, for extreme values that only a few teams achieve
	// Concatenate bright greens
	let scoredColourScale = reversed(colourScale).concat(["#4EF745", "#3BFA31", "#1bfd0f"]);

	// Concatenate bright reds
	let concededColourScale = colourScale.concat(["#FA3E3C", "#FC2B29", "#FD0F0F"]);

	function getScoredBars() {
		// return bars(teamScoredFreq, "Goals scored", "#77DD77");
		return bars(teamScoredFreq, "scored", scoredColourScale);
	}

	function getConcededBars() {
		return bars(teamConcededFreq, "conceded", concededColourScale);
	}

	function getScoredTeamBars() {
		return teamBars(teamScoredFreq, "scored", scoredColourScale);
	}

	function getConcededTeamBars() {
		return teamBars(teamConcededFreq, "conceded", concededColourScale);
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

	let { data, team } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	team && refreshTeamData();

	return `<div class="${"two-graphs"}">${setup
	? `<div class="${"graph freq-graph mini-graph"}">${validate_component(GoalsScoredFreq, "GoalsScoredFreq").$$render(
			$$result,
			{
				team,
				getScoredBars,
				getScoredTeamBars,
				getXLabels,
				getYAxisLayout
			},
			{},
			{}
		)}</div>
    <div class="${"graph freq-graph mini-graphh"}">${validate_component(GoalsConcededFreq, "GoalsConcededFreq").$$render(
			$$result,
			{
				team,
				getConcededBars,
				getConcededTeamBars,
				getXLabels,
				getYAxisLayout
			},
			{},
			{}
		)}</div>`
	: ``}</div>`;
});

/* src\components\Spider.svelte generated by Svelte v3.49.0 */

const css$5 = {
	code: ".spider-chart.svelte-1gpl4ff{position:relative}.spider-opp-team-selector.svelte-1gpl4ff{display:flex;flex-direction:column;margin:auto}.spider-opp-team-btns.svelte-1gpl4ff{border-radius:6px;display:flex;flex-direction:column;border:3px solid #333333;color:#333333;width:180px}.spider-opp-team-btn.svelte-1gpl4ff{cursor:pointer;border:none;padding:4px 10px;font-size:13px}.spider-opp-team-btn.svelte-1gpl4ff:hover{filter:brightness(0.95)}",
	map: "{\"version\":3,\"file\":\"Spider.svelte\",\"sources\":[\"Spider.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  import { onMount } from \\\"svelte\\\";\\r\\n\\r\\n  function getTeamColor(team) {\\r\\n    let teamKey = team[0].toLowerCase() + team.slice(1);\\r\\n    teamKey = teamKey.replace(/ /g, \\\"-\\\").toLowerCase();\\r\\n    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(\\r\\n      `--${teamKey}`\\r\\n    );\\r\\n    return teamColor;\\r\\n  }\\r\\n\\r\\n  function addTeamComparison(team) {\\r\\n    let teamColor = getTeamColor(team);\\r\\n\\r\\n    let teamData = {\\r\\n      name: team,\\r\\n      type: \\\"scatterpolar\\\",\\r\\n      r: [\\r\\n        attack[team],\\r\\n        defence[team],\\r\\n        cleanSheets[team],\\r\\n        consistency[team],\\r\\n        winStreaks[team],\\r\\n        vsBig6[team],\\r\\n      ],\\r\\n      theta: labels,\\r\\n      fill: \\\"toself\\\",\\r\\n      marker: { color: teamColor },\\r\\n    };\\r\\n    plotData.data.push(teamData);\\r\\n    Plotly.redraw(plotDiv); // Redraw with teamName added\\r\\n  }\\r\\n\\r\\n  function addAvg() {\\r\\n    let avg = avgScatterPlot();\\r\\n    plotData.data.unshift(avg); // Add avg below the teamName spider plot\\r\\n  }\\r\\n\\r\\n  function removeTeamComparison(team) {\\r\\n    // Remove spider plot for this teamName\\r\\n    for (let i = 0; i < plotData.data.length; i++) {\\r\\n      if (plotData.data[i].name == team) {\\r\\n        plotData.data.splice(i, 1);\\r\\n        break;\\r\\n      }\\r\\n    }\\r\\n\\r\\n    // If removing only comparison teamName, re-insert the initial avg spider plot\\r\\n    if (comparisonTeams.length == 1) {\\r\\n      addAvg(plotData.data);\\r\\n    }\\r\\n\\r\\n    Plotly.redraw(plotDiv); // Redraw with teamName removed\\r\\n  }\\r\\n\\r\\n  function removeAllTeamComparisons() {\\r\\n    for (let i = 0; i < comparisonTeams.length; i++) {\\r\\n      // Remove spider plot for this teamName\\r\\n      for (let i = 0; i < plotData.data.length; i++) {\\r\\n        if (plotData.data[i].name == comparisonTeams[i]) {\\r\\n          plotData.data.splice(i, 1);\\r\\n          break;\\r\\n        }\\r\\n      }\\r\\n\\r\\n      // If removing only comparison teamName, re-insert the initial avg spider plot\\r\\n      if (comparisonTeams.length == 1) {\\r\\n        addAvg(plotData.data);\\r\\n      }\\r\\n      removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams\\r\\n    }\\r\\n\\r\\n    Plotly.redraw(plotDiv); // Redraw with teamName removed\\r\\n  }\\r\\n\\r\\n  function resetTeamComparisonBtns() {\\r\\n    let btns = document.getElementById(\\\"spider-opp-teams\\\");\\r\\n    for (let i = 0; i < btns.children.length; i++) {\\r\\n      let btn = btns.children[i];\\r\\n      if (btn.style.background != \\\"\\\") {\\r\\n        btn.style.background = \\\"\\\";\\r\\n        btn.style.color = \\\"black\\\";\\r\\n      }\\r\\n    }\\r\\n  }\\r\\n\\r\\n  function spiderBtnClick(btn) {\\r\\n    let team = toName(btn.innerHTML);\\r\\n    if (btn.style.background == \\\"\\\") {\\r\\n      let teamKey = team.toLowerCase().replace(/ /g, \\\"-\\\");\\r\\n      btn.style.background = `var(--${teamKey})`;\\r\\n      btn.style.color = `var(--${teamKey}-secondary)`;\\r\\n    } else {\\r\\n      btn.style.background = \\\"\\\";\\r\\n      btn.style.color = \\\"black\\\";\\r\\n    }\\r\\n\\r\\n    if (comparisonTeams.length == 0) {\\r\\n      plotData.data.splice(0, 1); // Remove avg\\r\\n    }\\r\\n\\r\\n    if (comparisonTeams.includes(team)) {\\r\\n      removeTeamComparison(team); // Remove from spider chart\\r\\n      removeItem(comparisonTeams, team); // Remove from comparison teams\\r\\n    } else {\\r\\n      addTeamComparison(team); // Add teamName to spider chart\\r\\n      comparisonTeams.push(team); // Add to comparison teams\\r\\n    }\\r\\n  }\\r\\n\\r\\n  function goalsPerSeason(data) {\\r\\n    let attack = {};\\r\\n    let maxGoals = Number.NEGATIVE_INFINITY;\\r\\n    let minGoals = Number.POSITIVE_INFINITY;\\r\\n    for (let team of data.teamNames) {\\r\\n      let totalGoals = 0;\\r\\n      let seasonsPlayed = 0;\\r\\n      for (let year in data.standings[team]) {\\r\\n        let goals = data.standings[team][year].gF;\\r\\n        if (goals > 0) {\\r\\n          totalGoals += goals;\\r\\n          if (goals > maxGoals) {\\r\\n            maxGoals = goals;\\r\\n          } else if (goals < minGoals) {\\r\\n            minGoals = goals;\\r\\n          }\\r\\n          seasonsPlayed += 1;\\r\\n        }\\r\\n      }\\r\\n\\r\\n      let goalsPerSeason = null;\\r\\n      if (seasonsPlayed > 0) {\\r\\n        goalsPerSeason = totalGoals / seasonsPlayed;\\r\\n      }\\r\\n\\r\\n      attack[team] = goalsPerSeason;\\r\\n    }\\r\\n    return [attack, [minGoals, maxGoals]];\\r\\n  }\\r\\n\\r\\n  function scaleAttack(attack, range) {\\r\\n    let [lower, upper] = range;\\r\\n    for (let team in attack) {\\r\\n      if (attack[team] == null) {\\r\\n        attack[team] = 0;\\r\\n      } else {\\r\\n        attack[team] = ((attack[team] - lower) / (upper - lower)) * 100;\\r\\n      }\\r\\n    }\\r\\n    return attack;\\r\\n  }\\r\\n\\r\\n  function formMetricAvgScaled(formMetric, max) {\\r\\n    let total = 0;\\r\\n    for (let team in formMetric) {\\r\\n      formMetric[team] = (formMetric[team] / max) * 100;\\r\\n      total += formMetric[team];\\r\\n    }\\r\\n    let avg = total / Object.keys(formMetric).length;\\r\\n\\r\\n    return avg;\\r\\n  }\\r\\n\\r\\n  function formMetricAvg(formMetric) {\\r\\n    let total = 0;\\r\\n    for (let team in formMetric) {\\r\\n      total += formMetric[team];\\r\\n    }\\r\\n    let avg = total / Object.keys(formMetric).length;\\r\\n\\r\\n    return avg;\\r\\n  }\\r\\n\\r\\n  function getAttack(data) {\\r\\n    let [attack, maxGoals] = goalsPerSeason(data);\\r\\n    attack = scaleAttack(attack, maxGoals);\\r\\n    attack.avg = formMetricAvg(attack);\\r\\n\\r\\n    return attack;\\r\\n  }\\r\\n\\r\\n  function concededPerSeason(data) {\\r\\n    let defence = {};\\r\\n    let maxConceded = Number.NEGATIVE_INFINITY;\\r\\n    let minConceded = Number.POSITIVE_INFINITY;\\r\\n    for (let team of data.teamNames) {\\r\\n      let totalConceded = 0;\\r\\n      let seasonsPlayed = 0;\\r\\n      for (let year in data.standings[team]) {\\r\\n        let goals = data.standings[team][year].gA;\\r\\n        if (goals > 0) {\\r\\n          totalConceded += goals;\\r\\n          if (goals > maxConceded) {\\r\\n            maxConceded = goals;\\r\\n          } else if (goals < minConceded) {\\r\\n            minConceded = goals;\\r\\n          }\\r\\n          seasonsPlayed += 1;\\r\\n        }\\r\\n      }\\r\\n\\r\\n      let goalsPerSeason = null;\\r\\n      if (seasonsPlayed > 0) {\\r\\n        goalsPerSeason = totalConceded / seasonsPlayed;\\r\\n      }\\r\\n\\r\\n      defence[team] = goalsPerSeason;\\r\\n    }\\r\\n\\r\\n    return [defence, [minConceded, maxConceded]];\\r\\n  }\\r\\n\\r\\n  function scaleDefence(defence, range) {\\r\\n    let [lower, upper] = range;\\r\\n    for (let team in defence) {\\r\\n      if (defence[team] == null) {\\r\\n        defence[team] = 0;\\r\\n      } else {\\r\\n        defence[team] =\\r\\n          100 - ((defence[team] - lower) / (upper - lower)) * 100;\\r\\n      }\\r\\n    }\\r\\n    return defence;\\r\\n  }\\r\\n\\r\\n  function getDefence(data) {\\r\\n    let [defence, range] = concededPerSeason(data);\\r\\n    defence = scaleDefence(defence, range);\\r\\n    defence.avg = formMetricAvg(defence);\\r\\n\\r\\n    return defence;\\r\\n  }\\r\\n\\r\\n  function formCleanSheets(form, team) {\\r\\n    let nCleanSheets = 0;\\r\\n    for (let matchday of Object.keys(form[team])) {\\r\\n      let match = form[team][matchday];\\r\\n      if (match.score != null) {\\r\\n        let [h, _, a] = match.score.split(\\\" \\\");\\r\\n        if (match.atHome && a == 0) {\\r\\n          nCleanSheets += 1;\\r\\n        } else if (!match.atHome && h == 0) {\\r\\n          nCleanSheets += 1;\\r\\n        }\\r\\n      }\\r\\n    }\\r\\n    return nCleanSheets;\\r\\n  }\\r\\n\\r\\n  function getCleanSheets(data) {\\r\\n    let cleanSheets = {};\\r\\n    let maxCleanSheets = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of data.teamNames) {\\r\\n      let nCleanSheets = formCleanSheets(data.form[data._id], team);\\r\\n      if (team in data.form[data._id - 1]) {\\r\\n        nCleanSheets += formCleanSheets(data.form[data._id - 1], team);\\r\\n      }\\r\\n\\r\\n      if (nCleanSheets > maxCleanSheets) {\\r\\n        maxCleanSheets = nCleanSheets;\\r\\n      }\\r\\n      cleanSheets[team] = nCleanSheets;\\r\\n    }\\r\\n\\r\\n    cleanSheets.avg = formMetricAvgScaled(cleanSheets, maxCleanSheets);\\r\\n\\r\\n    return cleanSheets;\\r\\n  }\\r\\n\\r\\n  function formConsistency(form, team) {\\r\\n    let backToBack = 0; // Counts pairs of back to back identical match results\\r\\n    let prevResult = null;\\r\\n    for (let matchday in form[team]) {\\r\\n      let match = form[team][matchday];\\r\\n      if (match.score != null) {\\r\\n        let [h, _, a] = match.score.split(\\\" \\\");\\r\\n        let result;\\r\\n        if ((match.atHome && h > a) || (!match.atHome && h < a)) {\\r\\n          result = \\\"win\\\";\\r\\n        } else if ((match.atHome && h < a) || (!match.atHome && h > a)) {\\r\\n          result = \\\"lost\\\";\\r\\n        } else {\\r\\n          result = \\\"draw\\\";\\r\\n        }\\r\\n        if (prevResult != null && prevResult == result) {\\r\\n          backToBack += 1;\\r\\n        }\\r\\n        prevResult = result;\\r\\n      }\\r\\n    }\\r\\n    return backToBack;\\r\\n  }\\r\\n\\r\\n  function getConsistency(data) {\\r\\n    let consistency = {};\\r\\n    let maxConsistency = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of data.teamNames) {\\r\\n      let backToBack = formConsistency(data.form[data._id], team);\\r\\n      if (team in data.form[data._id - 1]) {\\r\\n        backToBack += formConsistency(data.form[data._id - 1], team);\\r\\n      }\\r\\n\\r\\n      if (backToBack > maxConsistency) {\\r\\n        maxConsistency = backToBack;\\r\\n      }\\r\\n\\r\\n      consistency[team] = backToBack;\\r\\n    }\\r\\n\\r\\n    consistency.avg = formMetricAvgScaled(consistency, maxConsistency);\\r\\n\\r\\n    return consistency;\\r\\n  }\\r\\n\\r\\n  function formWinStreak(form, team) {\\r\\n    let winStreak = 0;\\r\\n    let tempWinStreak = 0;\\r\\n    for (let matchday in form[team]) {\\r\\n      let match = form[team][matchday];\\r\\n      if (match.score != null) {\\r\\n        let [h, _, a] = match.score.split(\\\" \\\");\\r\\n        if ((match.atHome && h > a) || (!match.atHome && h < a)) {\\r\\n          tempWinStreak += 1;\\r\\n          if (tempWinStreak > winStreak) {\\r\\n            winStreak = tempWinStreak;\\r\\n          }\\r\\n        } else {\\r\\n          tempWinStreak = 0;\\r\\n        }\\r\\n      }\\r\\n    }\\r\\n    return winStreak;\\r\\n  }\\r\\n\\r\\n  function getWinStreak(data) {\\r\\n    let winStreaks = {};\\r\\n    let maxWinStreaks = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of data.teamNames) {\\r\\n      let winStreak = formWinStreak(data.form[data._id], team);\\r\\n      if (team in data.form[data._id - 1]) {\\r\\n        winStreak += formWinStreak(data.form[data._id - 1], team);\\r\\n      }\\r\\n\\r\\n      if (winStreak > maxWinStreaks) {\\r\\n        maxWinStreaks = winStreak;\\r\\n      }\\r\\n      winStreaks[team] = winStreak;\\r\\n    }\\r\\n\\r\\n    winStreaks.avg = formMetricAvgScaled(winStreaks, maxWinStreaks);\\r\\n\\r\\n    return winStreaks;\\r\\n  }\\r\\n\\r\\n  function removeItem(arr, value) {\\r\\n    let index = arr.indexOf(value);\\r\\n    if (index > -1) {\\r\\n      arr.splice(index, 1);\\r\\n    }\\r\\n    return arr;\\r\\n  }\\r\\n\\r\\n  function formWinsVsBig6(form, team, big6) {\\r\\n    let winsVsBig6 = 0;\\r\\n    for (let matchday in form[team]) {\\r\\n      let match = form[team][matchday];\\r\\n      if (match.score != null && big6.includes(match.team)) {\\r\\n        let [h, _, a] = match.score.split(\\\" \\\");\\r\\n        if ((match.atHome && h > a) || (!match.atHome && h < a)) {\\r\\n          winsVsBig6 += 1;\\r\\n        }\\r\\n      }\\r\\n    }\\r\\n\\r\\n    return winsVsBig6;\\r\\n  }\\r\\n\\r\\n  function getVsBig6(data) {\\r\\n    let vsBig6 = {};\\r\\n    let maxWinsVsBig6 = Number.NEGATIVE_INFINITY;\\r\\n    for (let team of data.teamNames) {\\r\\n      let big6 = [\\r\\n        \\\"Manchester United\\\",\\r\\n        \\\"Liverpool\\\",\\r\\n        \\\"Manchester City\\\",\\r\\n        \\\"Arsenal\\\",\\r\\n        \\\"Chelsea\\\",\\r\\n        \\\"Tottenham Hotspur\\\",\\r\\n      ];\\r\\n      big6 = removeItem(big6, team);\\r\\n\\r\\n      let winsVsBig6 = formWinsVsBig6(data.form[data._id], team, big6);\\r\\n      if (team in data.form[data._id - 1]) {\\r\\n        winsVsBig6 += formWinsVsBig6(data.form[data._id - 1], team, big6);\\r\\n      }\\r\\n\\r\\n      if (winsVsBig6 > maxWinsVsBig6) {\\r\\n        maxWinsVsBig6 = winsVsBig6;\\r\\n      }\\r\\n\\r\\n      vsBig6[team] = winsVsBig6;\\r\\n    }\\r\\n\\r\\n    vsBig6.avg = formMetricAvgScaled(vsBig6, maxWinsVsBig6);\\r\\n\\r\\n    return vsBig6;\\r\\n  }\\r\\n\\r\\n  function scatterPlot(name, r, color) {\\r\\n    return {\\r\\n      name: name,\\r\\n      type: \\\"scatterpolar\\\",\\r\\n      r: r,\\r\\n      theta: labels,\\r\\n      fill: \\\"toself\\\",\\r\\n      marker: { color: color },\\r\\n      hovertemplate: `<b>${name}</b><br>%{theta}: %{r}<extra></extra>`,\\r\\n      hoveron: \\\"points\\\",\\r\\n    };\\r\\n  }\\r\\n\\r\\n  function avgScatterPlot() {\\r\\n    return scatterPlot(\\r\\n      \\\"Avg\\\",\\r\\n      [\\r\\n        attack.avg,\\r\\n        defence.avg,\\r\\n        cleanSheets.avg,\\r\\n        consistency.avg,\\r\\n        winStreaks.avg,\\r\\n        vsBig6.avg,\\r\\n      ],\\r\\n      \\\"#ADADAD\\\"\\r\\n    );\\r\\n  }\\r\\n\\r\\n  function getTeamData(team) {\\r\\n    let teamColor = getTeamColor(team);\\r\\n    let teamData = scatterPlot(\\r\\n      team,\\r\\n      [\\r\\n        attack[team],\\r\\n        defence[team],\\r\\n        cleanSheets[team],\\r\\n        consistency[team],\\r\\n        winStreaks[team],\\r\\n        vsBig6[team],\\r\\n      ],\\r\\n      teamColor\\r\\n    );\\r\\n    return teamData;\\r\\n  }\\r\\n\\r\\n  function initSpiderPlots(team) {\\r\\n    let avgData = avgScatterPlot();\\r\\n    let teamData = getTeamData(team);\\r\\n\\r\\n    return [avgData, teamData];\\r\\n  }\\r\\n\\r\\n  function computePlotData(data) {\\r\\n    attack = getAttack(data);\\r\\n    defence = getDefence(data);\\r\\n    cleanSheets = getCleanSheets(data);\\r\\n    consistency = getConsistency(data);\\r\\n    winStreaks = getWinStreak(data);\\r\\n    vsBig6 = getVsBig6(data);\\r\\n  }\\r\\n\\r\\n  function buildPlotData(data, team) {\\r\\n    computePlotData(data);\\r\\n\\r\\n    let spiderPlots = initSpiderPlots(team);\\r\\n\\r\\n    let plotData = {\\r\\n      data: spiderPlots,\\r\\n      layout: {\\r\\n        height: 550,\\r\\n        polar: {\\r\\n          radialaxis: {\\r\\n            visible: true,\\r\\n            range: [0, 100],\\r\\n          },\\r\\n        },\\r\\n        hover: \\\"closest\\\",\\r\\n        margin: { t: 25, b: 25, l: 75, r: 75 },\\r\\n        showlegend: false,\\r\\n        plot_bgcolor: \\\"#fafafa\\\",\\r\\n        paper_bgcolor: \\\"#fafafa\\\",\\r\\n      },\\r\\n      config: {\\r\\n        responsive: true,\\r\\n        showSendToCloud: false,\\r\\n        displayModeBar: false,\\r\\n      },\\r\\n    };\\r\\n    return plotData;\\r\\n  }\\r\\n\\r\\n  let attack, defence, cleanSheets, consistency, winStreaks, vsBig6;\\r\\n  let labels = [\\r\\n    \\\"Attack\\\",\\r\\n    \\\"Defence\\\",\\r\\n    \\\"Clean Sheets\\\",\\r\\n    \\\"Consistency\\\",\\r\\n    \\\"Win Streak\\\",\\r\\n    \\\"Vs Big 6\\\",\\r\\n  ];\\r\\n\\r\\n  let plotDiv, plotData;\\r\\n  let comparisonTeams = [];\\r\\n  let setup = false;\\r\\n  onMount(() => {\\r\\n    genPlot();\\r\\n    setup = true;\\r\\n  });\\r\\n  \\r\\n  function genPlot() {\\r\\n    plotData = buildPlotData(data, team);\\r\\n    new Plotly.newPlot(\\r\\n      plotDiv,\\r\\n      plotData.data,\\r\\n      plotData.layout,\\r\\n      plotData.config\\r\\n    ).then(plot => {\\r\\n      // Once plot generated, add resizable attribute to it to shorten height for mobile view\\r\\n      plot.children[0].children[0].classList.add(\\\"resizable-spider-chart\\\");\\r\\n    });\\r\\n\\r\\n    // Add inner border radius to top and bottom teams\\r\\n    document\\r\\n      .getElementById(\\\"spider-opp-teams\\\")\\r\\n      .children[0].classList.add(\\\"top-spider-opp-team-btn\\\");\\r\\n    document\\r\\n      .getElementById(\\\"spider-opp-teams\\\")\\r\\n      .children[18].classList.add(\\\"bottom-spider-opp-team-btn\\\");\\r\\n  }\\r\\n\\r\\n  function emptyArray(arr) {\\r\\n    let length = arr.length;\\r\\n    for (let i = 0; i < length; i++) {\\r\\n      arr.pop();\\r\\n    }\\r\\n  }\\r\\n\\r\\n  function refreshPlot() {\\r\\n    if (setup) {\\r\\n      let spiderPlots = initSpiderPlots(team);\\r\\n      // Remove all but two plots\\r\\n      emptyArray(plotData.data);\\r\\n      // Replace final two plots with defaults\\r\\n      plotData.data.push(spiderPlots[0])  // Reset to avg\\r\\n      plotData.data.push(spiderPlots[1])  // Reset to team data\\r\\n  \\r\\n      removeAllTeamComparisons();\\r\\n      resetTeamComparisonBtns();\\r\\n    }\\r\\n  }\\r\\n\\r\\n  $: team && refreshPlot();\\r\\n\\r\\n  export let data, team, teams, toAlias, toName;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"spider-chart\\\">\\r\\n  <div id=\\\"plotly\\\">\\r\\n    <div id=\\\"plotDiv\\\" bind:this={plotDiv}>\\r\\n      <!-- Plotly chart will be drawn inside this DIV -->\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"spider-opp-team-selector\\\">\\r\\n  <div class=\\\"spider-opp-team-btns\\\" id=\\\"spider-opp-teams\\\">\\r\\n    {#each teams as _team}\\r\\n      {#if _team != team}\\r\\n        <button\\r\\n          class=\\\"spider-opp-team-btn\\\"\\r\\n          on:click={(e) => {\\r\\n            spiderBtnClick(e.target);\\r\\n          }}>{toAlias(_team)}</button\\r\\n        >\\r\\n      {/if}\\r\\n    {/each}\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .spider-chart {\\r\\n    position: relative;\\r\\n  }\\r\\n  .spider-opp-team-selector {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    margin: auto;\\r\\n  }\\r\\n  .spider-opp-team-btns {\\r\\n    border-radius: 6px;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    border: 3px solid #333333;\\r\\n    color: #333333;\\r\\n    width: 180px;\\r\\n  }\\r\\n  .spider-opp-team-btn {\\r\\n    cursor: pointer;\\r\\n    border: none;\\r\\n    padding: 4px 10px;\\r\\n    font-size: 13px;\\r\\n  }\\r\\n  .spider-opp-team-btn:hover {\\r\\n    filter: brightness(0.95);\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA4kBE,aAAa,eAAC,CAAC,AACb,QAAQ,CAAE,QAAQ,AACpB,CAAC,AACD,yBAAyB,eAAC,CAAC,AACzB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,IAAI,AACd,CAAC,AACD,qBAAqB,eAAC,CAAC,AACrB,aAAa,CAAE,GAAG,CAClB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,OAAO,CACzB,KAAK,CAAE,OAAO,CACd,KAAK,CAAE,KAAK,AACd,CAAC,AACD,oBAAoB,eAAC,CAAC,AACpB,MAAM,CAAE,OAAO,CACf,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,SAAS,CAAE,IAAI,AACjB,CAAC,AACD,mCAAoB,MAAM,AAAC,CAAC,AAC1B,MAAM,CAAE,WAAW,IAAI,CAAC,AAC1B,CAAC\"}"
};

function getTeamColor(team) {
	let teamKey = team[0].toLowerCase() + team.slice(1);
	teamKey = teamKey.replace(/ /g, "-").toLowerCase();
	let teamColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
	return teamColor;
}

function resetTeamComparisonBtns() {
	let btns = document.getElementById("spider-opp-teams");

	for (let i = 0; i < btns.children.length; i++) {
		let btn = btns.children[i];

		if (btn.style.background != "") {
			btn.style.background = "";
			btn.style.color = "black";
		}
	}
}

function goalsPerSeason(data) {
	let attack = {};
	let maxGoals = Number.NEGATIVE_INFINITY;
	let minGoals = Number.POSITIVE_INFINITY;

	for (let team of data.teamNames) {
		let totalGoals = 0;
		let seasonsPlayed = 0;

		for (let year in data.standings[team]) {
			let goals = data.standings[team][year].gF;

			if (goals > 0) {
				totalGoals += goals;

				if (goals > maxGoals) {
					maxGoals = goals;
				} else if (goals < minGoals) {
					minGoals = goals;
				}

				seasonsPlayed += 1;
			}
		}

		let goalsPerSeason = null;

		if (seasonsPlayed > 0) {
			goalsPerSeason = totalGoals / seasonsPlayed;
		}

		attack[team] = goalsPerSeason;
	}

	return [attack, [minGoals, maxGoals]];
}

function scaleAttack(attack, range) {
	let [lower, upper] = range;

	for (let team in attack) {
		if (attack[team] == null) {
			attack[team] = 0;
		} else {
			attack[team] = (attack[team] - lower) / (upper - lower) * 100;
		}
	}

	return attack;
}

function formMetricAvgScaled(formMetric, max) {
	let total = 0;

	for (let team in formMetric) {
		formMetric[team] = formMetric[team] / max * 100;
		total += formMetric[team];
	}

	let avg = total / Object.keys(formMetric).length;
	return avg;
}

function formMetricAvg(formMetric) {
	let total = 0;

	for (let team in formMetric) {
		total += formMetric[team];
	}

	let avg = total / Object.keys(formMetric).length;
	return avg;
}

function getAttack(data) {
	let [attack, maxGoals] = goalsPerSeason(data);
	attack = scaleAttack(attack, maxGoals);
	attack.avg = formMetricAvg(attack);
	return attack;
}

function concededPerSeason(data) {
	let defence = {};
	let maxConceded = Number.NEGATIVE_INFINITY;
	let minConceded = Number.POSITIVE_INFINITY;

	for (let team of data.teamNames) {
		let totalConceded = 0;
		let seasonsPlayed = 0;

		for (let year in data.standings[team]) {
			let goals = data.standings[team][year].gA;

			if (goals > 0) {
				totalConceded += goals;

				if (goals > maxConceded) {
					maxConceded = goals;
				} else if (goals < minConceded) {
					minConceded = goals;
				}

				seasonsPlayed += 1;
			}
		}

		let goalsPerSeason = null;

		if (seasonsPlayed > 0) {
			goalsPerSeason = totalConceded / seasonsPlayed;
		}

		defence[team] = goalsPerSeason;
	}

	return [defence, [minConceded, maxConceded]];
}

function scaleDefence(defence, range) {
	let [lower, upper] = range;

	for (let team in defence) {
		if (defence[team] == null) {
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
	defence.avg = formMetricAvg(defence);
	return defence;
}

function formCleanSheets(form, team) {
	let nCleanSheets = 0;

	for (let matchday of Object.keys(form[team])) {
		let match = form[team][matchday];

		if (match.score != null) {
			let [h, _, a] = match.score.split(" ");

			if (match.atHome && a == 0) {
				nCleanSheets += 1;
			} else if (!match.atHome && h == 0) {
				nCleanSheets += 1;
			}
		}
	}

	return nCleanSheets;
}

function getCleanSheets(data) {
	let cleanSheets = {};
	let maxCleanSheets = Number.NEGATIVE_INFINITY;

	for (let team of data.teamNames) {
		let nCleanSheets = formCleanSheets(data.form[data._id], team);

		if (team in data.form[data._id - 1]) {
			nCleanSheets += formCleanSheets(data.form[data._id - 1], team);
		}

		if (nCleanSheets > maxCleanSheets) {
			maxCleanSheets = nCleanSheets;
		}

		cleanSheets[team] = nCleanSheets;
	}

	cleanSheets.avg = formMetricAvgScaled(cleanSheets, maxCleanSheets);
	return cleanSheets;
}

function formConsistency(form, team) {
	let backToBack = 0; // Counts pairs of back to back identical match results
	let prevResult = null;

	for (let matchday in form[team]) {
		let match = form[team][matchday];

		if (match.score != null) {
			let [h, _, a] = match.score.split(" ");
			let result;

			if (match.atHome && h > a || !match.atHome && h < a) {
				result = "win";
			} else if (match.atHome && h < a || !match.atHome && h > a) {
				result = "lost";
			} else {
				result = "draw";
			}

			if (prevResult != null && prevResult == result) {
				backToBack += 1;
			}

			prevResult = result;
		}
	}

	return backToBack;
}

function getConsistency(data) {
	let consistency = {};
	let maxConsistency = Number.NEGATIVE_INFINITY;

	for (let team of data.teamNames) {
		let backToBack = formConsistency(data.form[data._id], team);

		if (team in data.form[data._id - 1]) {
			backToBack += formConsistency(data.form[data._id - 1], team);
		}

		if (backToBack > maxConsistency) {
			maxConsistency = backToBack;
		}

		consistency[team] = backToBack;
	}

	consistency.avg = formMetricAvgScaled(consistency, maxConsistency);
	return consistency;
}

function formWinStreak(form, team) {
	let winStreak = 0;
	let tempWinStreak = 0;

	for (let matchday in form[team]) {
		let match = form[team][matchday];

		if (match.score != null) {
			let [h, _, a] = match.score.split(" ");

			if (match.atHome && h > a || !match.atHome && h < a) {
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
	let maxWinStreaks = Number.NEGATIVE_INFINITY;

	for (let team of data.teamNames) {
		let winStreak = formWinStreak(data.form[data._id], team);

		if (team in data.form[data._id - 1]) {
			winStreak += formWinStreak(data.form[data._id - 1], team);
		}

		if (winStreak > maxWinStreaks) {
			maxWinStreaks = winStreak;
		}

		winStreaks[team] = winStreak;
	}

	winStreaks.avg = formMetricAvgScaled(winStreaks, maxWinStreaks);
	return winStreaks;
}

function removeItem(arr, value) {
	let index = arr.indexOf(value);

	if (index > -1) {
		arr.splice(index, 1);
	}

	return arr;
}

function formWinsVsBig6(form, team, big6) {
	let winsVsBig6 = 0;

	for (let matchday in form[team]) {
		let match = form[team][matchday];

		if (match.score != null && big6.includes(match.team)) {
			let [h, _, a] = match.score.split(" ");

			if (match.atHome && h > a || !match.atHome && h < a) {
				winsVsBig6 += 1;
			}
		}
	}

	return winsVsBig6;
}

function getVsBig6(data) {
	let vsBig6 = {};
	let maxWinsVsBig6 = Number.NEGATIVE_INFINITY;

	for (let team of data.teamNames) {
		let big6 = [
			"Manchester United",
			"Liverpool",
			"Manchester City",
			"Arsenal",
			"Chelsea",
			"Tottenham Hotspur"
		];

		big6 = removeItem(big6, team);
		let winsVsBig6 = formWinsVsBig6(data.form[data._id], team, big6);

		if (team in data.form[data._id - 1]) {
			winsVsBig6 += formWinsVsBig6(data.form[data._id - 1], team, big6);
		}

		if (winsVsBig6 > maxWinsVsBig6) {
			maxWinsVsBig6 = winsVsBig6;
		}

		vsBig6[team] = winsVsBig6;
	}

	vsBig6.avg = formMetricAvgScaled(vsBig6, maxWinsVsBig6);
	return vsBig6;
}

function emptyArray(arr) {
	let length = arr.length;

	for (let i = 0; i < length; i++) {
		arr.pop();
	}
}

const Spider = create_ssr_component(($$result, $$props, $$bindings, slots) => {

	function addAvg() {
		let avg = avgScatterPlot();
		plotData.data.unshift(avg); // Add avg below the teamName spider plot
	}

	function removeAllTeamComparisons() {
		for (let i = 0; i < comparisonTeams.length; i++) {
			// Remove spider plot for this teamName
			for (let i = 0; i < plotData.data.length; i++) {
				if (plotData.data[i].name == comparisonTeams[i]) {
					plotData.data.splice(i, 1);
					break;
				}
			}

			// If removing only comparison teamName, re-insert the initial avg spider plot
			if (comparisonTeams.length == 1) {
				addAvg(plotData.data);
			}

			removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams
		}

		Plotly.redraw(plotDiv); // Redraw with teamName removed
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
		let teamColor = getTeamColor(team);

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
			teamColor
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
			layout: {
				height: 550,
				polar: {
					radialaxis: { visible: true, range: [0, 100] }
				},
				hover: "closest",
				margin: { t: 25, b: 25, l: 75, r: 75 },
				showlegend: false,
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa"
			},
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};

		return plotData;
	}

	let attack, defence, cleanSheets, consistency, winStreaks, vsBig6;
	let labels = ["Attack", "Defence", "Clean Sheets", "Consistency", "Win Streak", "Vs Big 6"];
	let plotDiv, plotData;
	let comparisonTeams = [];
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);

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
		}
	}

	let { data, team, teams, toAlias, toName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.teams === void 0 && $$bindings.teams && teams !== void 0) $$bindings.teams(teams);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.toName === void 0 && $$bindings.toName && toName !== void 0) $$bindings.toName(toName);
	$$result.css.add(css$5);
	team && refreshPlot();

	return `<div class="${"spider-chart svelte-1gpl4ff"}"><div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div></div>
<div class="${"spider-opp-team-selector svelte-1gpl4ff"}"><div class="${"spider-opp-team-btns svelte-1gpl4ff"}" id="${"spider-opp-teams"}">${each(teams, _team => {
		return `${_team != team
		? `<button class="${"spider-opp-team-btn svelte-1gpl4ff"}">${escape(toAlias(_team))}</button>`
		: ``}`;
	})}</div>
</div>`;
});

/* src\components\ScoreFreq.svelte generated by Svelte v3.49.0 */

function getAvgScoreFreq(data) {
	let scoreFreq = {};

	for (let team in data.form[data._id]) {
		for (let matchday in data.form[data._id][team]) {
			let score = data.form[data._id][team][matchday].score;

			if (score != null) {
				let [h, _, a] = score.split(" ");

				if (!data.form[data._id][team][matchday].atHome) {
					score = a + " - " + h;
				}

				if (!(score in scoreFreq)) {
					scoreFreq[score] = [0];
				}

				scoreFreq[score][0] += 1;
			}
		}

		if (team in data.form[data._id]) {
			for (let matchday in data.form[data._id - 1][team]) {
				let score = data.form[data._id - 1][team][matchday].score;

				if (score != null) {
					let [h, _, a] = score.split(" ");

					if (!data.form[data._id - 1][team][matchday].atHome) {
						score = a + " - " + h;
					}

					if (!(score in scoreFreq)) {
						scoreFreq[score] = [0];
					}

					scoreFreq[score][0] += 1;
				}
			}
		}
	}

	return scoreFreq;
}

function insertTeamScoreBars(data, team, scoreFreq) {
	for (let score in scoreFreq) {
		if (scoreFreq[score].length == 1) {
			scoreFreq[score].push(0);
		}
	}

	for (let matchday in data.form[data._id][team]) {
		let score = data.form[data._id][team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");

			if (!data.form[data._id][team][matchday].atHome) {
				score = a + " - " + h;
			}

			scoreFreq[score][1] += 1;
		}
	}

	for (let matchday in data.form[data._id - 1][team]) {
		let score = data.form[data._id - 1][team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");

			if (!data.form[data._id - 1][team][matchday].atHome) {
				score = a + " - " + h;
			}

			scoreFreq[score][1] += 1;
		}
	}
}

function getColours(scores) {
	let colours = [];

	for (let score of scores) {
		let [h, _, a] = score.split(' ');
		h = parseInt(h);
		a = parseInt(a);

		if (h > a) {
			colours.push('#5df455');
		} else if (h < a) {
			colours.push('#f74d4d');
		} else {
			colours.push('#dfa700');
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

	let colours = getColours(x);

	return [
		{
			x,
			y: avgY,
			type: "bar",
			name: 'Avg',
			marker: { color: "#C6C6C6" },
			hovertemplate: `%{x} with probability %{y:.2f}<extra></extra>`,
			hoverinfo: "x+y"
		},
		{
			x, // opacity: 0.6,
			y: teamY,
			type: "bar",
			name: 'Scorelines',
			marker: { color: colours },
			hovertemplate: `%{x} with probability %{y:.2f}<extra></extra>`,
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

function resetTeamBars(scoreFreq) {
	for (let score in scoreFreq) {
		scoreFreq[score][1] = 0;
	}
}

const ScoreFreq = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function buildPlotData(data, team) {
		// let xLabels = getXLabels();
		// let xLabels = scoreBars.
		scoreFreq = getAvgScoreFreq(data);

		insertTeamScoreBars(data, team, scoreFreq);
		scaleBars(scoreFreq);
		convertToPercentage(scoreFreq);
		let [avgBars, teamBars] = separateBars(scoreFreq);

		let plotData = {
			data: [avgBars, teamBars],
			layout: {
				title: false,
				autosize: true,
				margin: { r: 10, l: 65, t: 15, b: 100, pad: 5 },
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
				}, // autorange: false,
				// range: [0, 10],
				xaxis: {
					title: { text: "Scoreline" },
					linecolor: "black",
					showgrid: false,
					showline: false,
					fixedrange: true
				}, // ticktext: xLabels,
				// tickvals: xLabels,
				legend: { x: 1, xanchor: "right", y: 0.95 }
			},
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
			let [_, teamBars] = separateBars(scoreFreq);
			plotData.data[1] = teamBars; // Update team bars
			Plotly.redraw(plotDiv);
		}
	}

	let plotDiv, plotData;
	let scoreFreq;
	let setup = false;

	onMount(() => {
		genPlot();
		setup = true;
	});

	let { data, team } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	team && refreshPlot();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\NavBar.svelte generated by Svelte v3.49.0 */

const css$4 = {
	code: ".title.svelte-1q37vn5{color:white;font-size:1.6em;height:102px;display:grid;place-items:center}.no-selection.svelte-1q37vn5{user-select:none;-webkit-user-select:none;-moz-user-select:none}.team-links.svelte-1q37vn5{font-size:1em;color:white;display:grid}button.svelte-1q37vn5{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit;text-align:left}.this-team-name.svelte-1q37vn5,.team-name.svelte-1q37vn5{padding:0.4em 1em;color:#c600d8}:hover.team-name.svelte-1q37vn5{background:#2c002f}nav.svelte-1q37vn5{position:fixed;width:220px;height:100vh;background:#37003c;background:#38003d}.close-btn.svelte-1q37vn5{position:absolute;right:0.9em;bottom:0.6em;background:transparent;border:none;outline:none;padding-top:0.3em;cursor:pointer}",
	map: "{\"version\":3,\"file\":\"NavBar.svelte\",\"sources\":[\"NavBar.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  function closeNavBar() {\\r\\n    document.getElementById(\\\"navBar\\\").style.display = \\\"none\\\";\\r\\n    document.getElementById(\\\"dashboard\\\").style.marginLeft = 0;\\r\\n    window.dispatchEvent(new Event(\\\"resize\\\")); // Snap plotly graphs to new width\\r\\n  }\\r\\n\\r\\n  export let team, teams, getAlias, switchTeam;\\r\\n</script>\\r\\n\\r\\n<nav>\\r\\n  <div class=\\\"title no-selection\\\">\\r\\n    <p>\\r\\n      <span style=\\\"color: #00fe87\\\">pl</span>dashboard\\r\\n    </p>\\r\\n  </div>\\r\\n  <div class=\\\"team-links\\\">\\r\\n    <!-- <a href=\\\"/all-teams\\\">\\r\\n    <div class=\\\"all-teams\\\">\\r\\n      All Teams\\r\\n    </div>\\r\\n    </a> -->\\r\\n    {#each teams as _team, _ (_team)}\\r\\n      {#if _team.toLowerCase().replace(/ /g, \\\"-\\\") == team}\\r\\n        <a href=\\\"/{_team.toLowerCase().replace(/ /g, '-')}\\\" class=\\\"team-link\\\">\\r\\n          <div\\r\\n            class=\\\"this-team-name\\\"\\r\\n            style=\\\"color: var(--{_team\\r\\n              .toLowerCase()\\r\\n              .replace(/ /g, '-')}-secondary);\\r\\n              background-color: var(--{_team.toLowerCase().replace(/ /g, '-')})\\\"\\r\\n          >\\r\\n            {getAlias(_team)}\\r\\n          </div>\\r\\n        </a>\\r\\n      {:else}\\r\\n        <button\\r\\n          class=\\\"team-link\\\"\\r\\n          on:click={() => {\\r\\n            switchTeam(_team.toLowerCase().replace(/ /g, \\\"-\\\"));\\r\\n          }}\\r\\n        >\\r\\n          <div class=\\\"team-name\\\">\\r\\n            {getAlias(_team)}\\r\\n          </div>\\r\\n        </button>\\r\\n      {/if}\\r\\n    {/each}\\r\\n  </div>\\r\\n  <div class=\\\"close\\\">\\r\\n    <button class=\\\"close-btn\\\" on:click={closeNavBar}>\\r\\n      <img src=\\\"img/arrow-bar-left.svg\\\" alt=\\\"\\\" />\\r\\n    </button>\\r\\n  </div>\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  .title {\\r\\n    color: white;\\r\\n    font-size: 1.6em;\\r\\n    height: 102px;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .no-selection {\\r\\n    user-select: none;\\r\\n    -webkit-user-select: none;\\r\\n    -moz-user-select: none;\\r\\n  }\\r\\n  .team-links {\\r\\n    font-size: 1em;\\r\\n    color: white;\\r\\n    display: grid;\\r\\n  }\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n    text-align: left;\\r\\n  }\\r\\n  /* .all-teams, */\\r\\n  .this-team-name,\\r\\n  .team-name {\\r\\n    padding: 0.4em 1em;\\r\\n    color: #c600d8;\\r\\n    /* color: #fcdbff; */\\r\\n    /* color: #00fe87; */\\r\\n  }\\r\\n  :hover.team-name {\\r\\n    background: #2c002f;\\r\\n  }\\r\\n  /* .all-teams {\\r\\n    padding: 2em 0.8em;\\r\\n  } */\\r\\n  nav {\\r\\n    position: fixed;\\r\\n    width: 220px;\\r\\n    height: 100vh;\\r\\n    background: #37003c;\\r\\n    background: #38003d;\\r\\n  }\\r\\n  .close-btn {\\r\\n    position: absolute;\\r\\n    right: 0.9em;\\r\\n    bottom: 0.6em;\\r\\n    background: transparent;\\r\\n    border: none;\\r\\n    outline: none;\\r\\n    padding-top: 0.3em;\\r\\n    cursor: pointer;\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAyDE,MAAM,eAAC,CAAC,AACN,KAAK,CAAE,KAAK,CACZ,SAAS,CAAE,KAAK,CAChB,MAAM,CAAE,KAAK,CACb,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,AACrB,CAAC,AACD,aAAa,eAAC,CAAC,AACb,WAAW,CAAE,IAAI,CACjB,mBAAmB,CAAE,IAAI,CACzB,gBAAgB,CAAE,IAAI,AACxB,CAAC,AACD,WAAW,eAAC,CAAC,AACX,SAAS,CAAE,GAAG,CACd,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,IAAI,AACf,CAAC,AACD,MAAM,eAAC,CAAC,AACN,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OAAO,CAChB,UAAU,CAAE,IAAI,AAClB,CAAC,AAED,8BAAe,CACf,UAAU,eAAC,CAAC,AACV,OAAO,CAAE,KAAK,CAAC,GAAG,CAClB,KAAK,CAAE,OAAO,AAGhB,CAAC,AACD,MAAM,UAAU,eAAC,CAAC,AAChB,UAAU,CAAE,OAAO,AACrB,CAAC,AAID,GAAG,eAAC,CAAC,AACH,QAAQ,CAAE,KAAK,CACf,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,OAAO,CACnB,UAAU,CAAE,OAAO,AACrB,CAAC,AACD,UAAU,eAAC,CAAC,AACV,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,WAAW,CACvB,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,KAAK,CAClB,MAAM,CAAE,OAAO,AACjB,CAAC\"}"
};

const NavBar = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { team, teams, getAlias, switchTeam } = $$props;
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.teams === void 0 && $$bindings.teams && teams !== void 0) $$bindings.teams(teams);
	if ($$props.getAlias === void 0 && $$bindings.getAlias && getAlias !== void 0) $$bindings.getAlias(getAlias);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$4);

	return `<nav class="${"svelte-1q37vn5"}"><div class="${"title no-selection svelte-1q37vn5"}"><p><span style="${"color: #00fe87"}">pl</span>dashboard
    </p></div>
  <div class="${"team-links svelte-1q37vn5"}">
    ${each(teams, (_team, _) => {
		return `${_team.toLowerCase().replace(/ /g, "-") == team
		? `<a href="${"/" + escape(_team.toLowerCase().replace(/ /g, '-'), true)}" class="${"team-link"}"><div class="${"this-team-name svelte-1q37vn5"}" style="${"color: var(--" + escape(_team.toLowerCase().replace(/ /g, '-'), true) + "-secondary); background-color: var(--" + escape(_team.toLowerCase().replace(/ /g, '-'), true) + ")"}">${escape(getAlias(_team))}</div>
        </a>`
		: `<button class="${"team-link svelte-1q37vn5"}"><div class="${"team-name svelte-1q37vn5"}">${escape(getAlias(_team))}</div>
        </button>`}`;
	})}</div>
  <div class="${"close"}"><button class="${"close-btn svelte-1q37vn5"}"><img src="${"img/arrow-bar-left.svg"}" alt="${""}"></button></div>
</nav>`;
});

/* src\components\MobileViewNav.svelte generated by Svelte v3.49.0 */

const css$3 = {
	code: ".nav-title.svelte-1pbsqfs{font-size:1.4em;margin-bottom:0.8em;font-weight:bold}nav.svelte-1pbsqfs{display:none;margin:40px 8%}.team-links.svelte-1pbsqfs{display:grid}.team-link.svelte-1pbsqfs{color:inherit;background:inherit;cursor:pointer;border:none;font-size:1em;padding:0.4em}@media only screen and (max-width: 1300px){nav.svelte-1pbsqfs{display:grid}.team-links.svelte-1pbsqfs{grid-template-columns:repeat(5, 1fr)}}@media only screen and (max-width: 1150px){.team-links.svelte-1pbsqfs{grid-template-columns:repeat(4, 1fr)}}@media only screen and (max-width: 1000px){nav.svelte-1pbsqfs{margin:40px 5%}}@media only screen and (max-width: 950px){.team-links.svelte-1pbsqfs{grid-template-columns:repeat(3, 1fr)}}@media only screen and (max-width: 750px){.team-links.svelte-1pbsqfs{grid-template-columns:repeat(2, 1fr)}}@media only screen and (max-width: 550px){nav.svelte-1pbsqfs{margin:20px auto;width:80%}.team-links.svelte-1pbsqfs{grid-template-columns:repeat(1, 1fr)}.first-team.svelte-1pbsqfs{border-radius:6px 6px 0 0}.last-team.svelte-1pbsqfs{border-radius:0 0 6px 6px}}",
	map: "{\"version\":3,\"file\":\"MobileViewNav.svelte\",\"sources\":[\"MobileViewNav.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  function switchTeamToTop(team) {\\r\\n    switchTeam(team);\\r\\n    window.scrollTo(0, 0);\\r\\n  }\\r\\n\\r\\n  function getHyphenatedTeamNames() {\\r\\n    let hyphenatedTeamNames = [];\\r\\n    for (let i = 0; i < teams.length; i++) {\\r\\n      let teamLink = teams[i].toLowerCase().replace(/ /g, \\\"-\\\");\\r\\n      if (teamLink != hypenatedTeam) {\\r\\n        hyphenatedTeamNames.push(teamLink);\\r\\n      } else {\\r\\n        hyphenatedTeamNames.push(null);  // To keep teams and teamLinks list same length\\r\\n      }\\r\\n    }\\r\\n    hypenatedTeams = hyphenatedTeamNames;\\r\\n  }\\r\\n\\r\\n  let hypenatedTeams;\\r\\n  $: hypenatedTeam & getHyphenatedTeamNames();\\r\\n\\r\\n  export let hypenatedTeam, teams, toAlias, switchTeam;\\r\\n</script>\\r\\n\\r\\n<nav>\\r\\n  {#if hypenatedTeams != undefined}\\r\\n    <div class=\\\"nav-title\\\">Other Teams</div>\\r\\n    <div class=\\\"team-links\\\">\\r\\n      {#each hypenatedTeams as _hypenatedTeam, i}\\r\\n        {#if _hypenatedTeam != null}\\r\\n          {#if i == 0 || (i == 1 && hypenatedTeams[0] == null)}\\r\\n            <!-- Button with first-team class -->\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(hypenatedTeams[i]);\\r\\n              }}\\r\\n              style=\\\"color: var(--{hypenatedTeams[i]}-secondary);\\r\\n            background-color: var(--{hypenatedTeams[i]})\\\"\\r\\n              class=\\\"team-link first-team\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {:else if i == hypenatedTeams.length - 1 || (i == hypenatedTeams.length-2 && hypenatedTeams[hypenatedTeams.length-1] == null)}\\r\\n            <!-- Button with last-team class -->\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(hypenatedTeams[i]);\\r\\n              }}\\r\\n              style=\\\"color: var(--{hypenatedTeams[i]}-secondary);\\r\\n                background-color: var(--{hypenatedTeams[i]})\\\"\\r\\n              class=\\\"team-link last-team\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {:else}\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(_hypenatedTeam);\\r\\n              }}\\r\\n              style=\\\"color: var(--{_hypenatedTeam}-secondary);\\r\\n                  background-color: var(--{_hypenatedTeam})\\\"\\r\\n              class=\\\"team-link\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {/if}\\r\\n        {/if}\\r\\n      {/each}\\r\\n    </div>\\r\\n  {/if}\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  .nav-title {\\r\\n    font-size: 1.4em;\\r\\n    margin-bottom: 0.8em;\\r\\n    font-weight: bold;\\r\\n  }\\r\\n  nav {\\r\\n    display: none;\\r\\n    margin: 40px 8%;\\r\\n  }\\r\\n  .team-links {\\r\\n    display: grid;\\r\\n  }\\r\\n  .team-link {\\r\\n    color: inherit;\\r\\n    background: inherit;\\r\\n    cursor: pointer;\\r\\n    border: none;\\r\\n    font-size: 1em;\\r\\n    padding: 0.4em;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1300px) {\\r\\n    nav {\\r\\n      display: grid;\\r\\n    }\\r\\n    .team-links {\\r\\n      grid-template-columns: repeat(5, 1fr);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1150px) {\\r\\n    .team-links {\\r\\n      grid-template-columns: repeat(4, 1fr);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1000px) {\\r\\n    nav {\\r\\n      margin: 40px 5%;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 950px) {\\r\\n    .team-links {\\r\\n      grid-template-columns: repeat(3, 1fr);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 750px) {\\r\\n    .team-links {\\r\\n      grid-template-columns: repeat(2, 1fr);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    nav {\\r\\n      margin: 20px auto;\\r\\n      width: 80%;\\r\\n    }\\r\\n\\r\\n    .team-links {\\r\\n      grid-template-columns: repeat(1, 1fr);\\r\\n    }\\r\\n    .first-team {\\r\\n      border-radius: 6px 6px 0 0;\\r\\n    }\\r\\n    .last-team {\\r\\n      border-radius: 0 0 6px 6px;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAoEE,UAAU,eAAC,CAAC,AACV,SAAS,CAAE,KAAK,CAChB,aAAa,CAAE,KAAK,CACpB,WAAW,CAAE,IAAI,AACnB,CAAC,AACD,GAAG,eAAC,CAAC,AACH,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,IAAI,CAAC,EAAE,AACjB,CAAC,AACD,WAAW,eAAC,CAAC,AACX,OAAO,CAAE,IAAI,AACf,CAAC,AACD,UAAU,eAAC,CAAC,AACV,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,OAAO,CACnB,MAAM,CAAE,OAAO,CACf,MAAM,CAAE,IAAI,CACZ,SAAS,CAAE,GAAG,CACd,OAAO,CAAE,KAAK,AAChB,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,GAAG,eAAC,CAAC,AACH,OAAO,CAAE,IAAI,AACf,CAAC,AACD,WAAW,eAAC,CAAC,AACX,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,WAAW,eAAC,CAAC,AACX,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,GAAG,eAAC,CAAC,AACH,MAAM,CAAE,IAAI,CAAC,EAAE,AACjB,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,WAAW,eAAC,CAAC,AACX,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,WAAW,eAAC,CAAC,AACX,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,GAAG,eAAC,CAAC,AACH,MAAM,CAAE,IAAI,CAAC,IAAI,CACjB,KAAK,CAAE,GAAG,AACZ,CAAC,AAED,WAAW,eAAC,CAAC,AACX,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACD,WAAW,eAAC,CAAC,AACX,aAAa,CAAE,GAAG,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC,AAC5B,CAAC,AACD,UAAU,eAAC,CAAC,AACV,aAAa,CAAE,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,GAAG,AAC5B,CAAC,AACH,CAAC\"}"
};

const MobileViewNav = create_ssr_component(($$result, $$props, $$bindings, slots) => {

	function getHyphenatedTeamNames() {
		let hyphenatedTeamNames = [];

		for (let i = 0; i < teams.length; i++) {
			let teamLink = teams[i].toLowerCase().replace(/ /g, "-");

			if (teamLink != hypenatedTeam) {
				hyphenatedTeamNames.push(teamLink);
			} else {
				hyphenatedTeamNames.push(null); // To keep teams and teamLinks list same length
			}
		}

		hypenatedTeams = hyphenatedTeamNames;
	}

	let hypenatedTeams;
	let { hypenatedTeam, teams, toAlias, switchTeam } = $$props;
	if ($$props.hypenatedTeam === void 0 && $$bindings.hypenatedTeam && hypenatedTeam !== void 0) $$bindings.hypenatedTeam(hypenatedTeam);
	if ($$props.teams === void 0 && $$bindings.teams && teams !== void 0) $$bindings.teams(teams);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$3);
	hypenatedTeam & getHyphenatedTeamNames();

	return `<nav class="${"svelte-1pbsqfs"}">${hypenatedTeams != undefined
	? `<div class="${"nav-title svelte-1pbsqfs"}">Other Teams</div>
    <div class="${"team-links svelte-1pbsqfs"}">${each(hypenatedTeams, (_hypenatedTeam, i) => {
			return `${_hypenatedTeam != null
			? `${i == 0 || i == 1 && hypenatedTeams[0] == null
				? `
            <button style="${"color: var(--" + escape(hypenatedTeams[i], true) + "-secondary); background-color: var(--" + escape(hypenatedTeams[i], true) + ")"}" class="${"team-link first-team svelte-1pbsqfs"}">${escape(toAlias(teams[i]))}</button>`
				: `${i == hypenatedTeams.length - 1 || i == hypenatedTeams.length - 2 && hypenatedTeams[hypenatedTeams.length - 1] == null
					? `
            <button style="${"color: var(--" + escape(hypenatedTeams[i], true) + "-secondary); background-color: var(--" + escape(hypenatedTeams[i], true) + ")"}" class="${"team-link last-team svelte-1pbsqfs"}">${escape(toAlias(teams[i]))}</button>`
					: `<button style="${"color: var(--" + escape(_hypenatedTeam, true) + "-secondary); background-color: var(--" + escape(_hypenatedTeam, true) + ")"}" class="${"team-link svelte-1pbsqfs"}">${escape(toAlias(teams[i]))}</button>`}`}`
			: ``}`;
		})}</div>`
	: ``}
</nav>`;
});

/* src\routes\Team.svelte generated by Svelte v3.49.0 */

const css$2 = {
	code: ".header.svelte-1cm2o45{display:grid;place-items:center}.main-link.svelte-1cm2o45{width:fit-content;display:grid;place-items:center}.title.svelte-1cm2o45{font-size:2.5rem;width:fit-content}.page-content.svelte-1cm2o45{position:relative}#team.svelte-1cm2o45{display:flex}.position-and-badge.svelte-1cm2o45{height:500px;background-repeat:no-repeat;background-size:auto 450px;background-position:right center}.position-no-badge.svelte-1cm2o45{padding-left:0;margin:0;height:500px}.position-central.svelte-1cm2o45,.position.svelte-1cm2o45{text-shadow:9px 9px #000;font-weight:800;font-size:430px;user-select:none;max-width:500px}.position.svelte-1cm2o45{text-align:left;margin-top:0.02em;margin-left:30px}.position-central.svelte-1cm2o45{text-align:center;margin-top:0.04em;max-height:500px;margin-left:0.05em}.circles-background-container.svelte-1cm2o45{position:absolute;align-self:center;width:500px;z-index:-10}.circles-background.svelte-1cm2o45{height:500px;width:500px;transform:scale(0.95)}.position-central.svelte-1cm2o45{font-size:20vw;margin:auto}#dashboard.svelte-1cm2o45{margin-left:220px;width:100%}.no-bottom-margin.svelte-1cm2o45{margin-bottom:0 !important}.small-bottom-margin.svelte-1cm2o45{margin-bottom:1.5rem !important}.page-content.svelte-1cm2o45{display:flex;flex-direction:column;text-align:center}.row.svelte-1cm2o45{position:relative;display:flex;margin-bottom:3rem;height:auto}.row-graph.svelte-1cm2o45{width:100%}.score-freq.svelte-1cm2o45{margin:0 8% 0 8%}.row-left.svelte-1cm2o45{display:flex;flex-direction:column;padding-right:auto;margin-right:2vw;text-justify:center;flex:4}.row-right.svelte-1cm2o45{flex:10}.multi-element-row.svelte-1cm2o45{margin:0 20px 3rem 20px}.spider-chart-row.svelte-1cm2o45{display:grid;place-items:center}.spider-chart-container.svelte-1cm2o45{margin:1em auto auto;display:flex}@media only screen and (min-width: 2400px){.position-central.svelte-1cm2o45{font-size:16vw}}@media only screen and (min-width: 2200px){.position-central.svelte-1cm2o45{font-size:18vw}}@media only screen and (min-width: 2000px){.position-central.svelte-1cm2o45{font-size:20vw}}@media only screen and (max-width: 1800px){.circles-background.svelte-1cm2o45{transform:scale(0.9)}.position-central.svelte-1cm2o45{font-size:20vw}}@media only screen and (max-width: 1600px){.row-left.svelte-1cm2o45{flex:5}.circles-background.svelte-1cm2o45{transform:scale(0.85)}}@media only screen and (max-width: 1500px){.circles-background.svelte-1cm2o45{transform:scale(0.8)}.position-central.svelte-1cm2o45{font-size:22vw}}@media only screen and (max-width: 1400px){.circles-background.svelte-1cm2o45{transform:scale(0.75)}}@media only screen and (max-width: 1300px){.circles-background.svelte-1cm2o45{transform:scale(0.7)}#navBar.svelte-1cm2o45{display:none}#dashboard.svelte-1cm2o45{margin-left:0}.position-central.svelte-1cm2o45{font-size:24vw}}@media only screen and (max-width: 1100px){.row.svelte-1cm2o45{flex-direction:column;margin-bottom:40px}.row-graph.svelte-1cm2o45{width:auto}.score-freq.svelte-1cm2o45{margin:0 0 10px}.multi-element-row.svelte-1cm2o45{margin:0}.mobile-margin.svelte-1cm2o45{margin-left:10px}.row-left.svelte-1cm2o45{margin-right:0;align-self:center}.position-and-badge.svelte-1cm2o45{width:50%;max-width:400px;min-width:150px;padding-right:3% !important;background-size:auto 330px !important;height:400px;margin-bottom:-50px}.position-no-badge.svelte-1cm2o45{height:400px;width:500px}.circles-background.svelte-1cm2o45{transform:scale(0.5);margin-top:-100px}}@media only screen and (max-width: 900px){.circles-background.svelte-1cm2o45{transform:scale(0.45);margin-top:-120px}.position-central.svelte-1cm2o45{font-size:25vw}}@media only screen and (max-width: 800px){.circles-background.svelte-1cm2o45{transform:scale(0.4);margin-top:-120px}.position-central.svelte-1cm2o45{font-size:13em}.season-stats-row.svelte-1cm2o45{margin:10px}}@media only screen and (max-width: 550px){.position.svelte-1cm2o45,.position-central.svelte-1cm2o45{font-size:10em;text-align:center;line-height:1.6;padding-right:20px;margin:0;text-shadow:7px 7px #000}.multi-element-row.svelte-1cm2o45{margin:0}.position-and-badge.svelte-1cm2o45{background-size:auto 210px !important;background-position:center !important}.position-no-badge.svelte-1cm2o45,.position-and-badge.svelte-1cm2o45{padding:0 !important;margin:0 !important;width:100%}.circles-background.svelte-1cm2o45{transform:scale(0.35);margin-top:-125px}}",
	map: "{\"version\":3,\"file\":\"Team.svelte\",\"sources\":[\"Team.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  import { Router } from \\\"svelte-routing\\\";\\r\\n  import { onMount } from \\\"svelte\\\";\\r\\n  import CurrentForm from \\\"../components/CurrentForm.svelte\\\";\\r\\n  import TableSnippet from \\\"../components/TableSnippet.svelte\\\";\\r\\n  import NextGame from \\\"../components/next_game/NextGame.svelte\\\";\\r\\n  import SeasonStats from \\\"../components/SeasonStats.svelte\\\";\\r\\n  import TeamsFooter from \\\"../components/TeamsFooter.svelte\\\";\\r\\n  import Fixtures from \\\"../components/Fixtures.svelte\\\";\\r\\n  import FormOverTime from \\\"../components/FormOverTime.svelte\\\";\\r\\n  import PositionOverTime from \\\"../components/PositionOverTime.svelte\\\";\\r\\n  import GoalsScoredAndConceded from \\\"../components/goals_scored_and_conceded/GoalsScoredAndConceded.svelte\\\";\\r\\n  import CleanSheets from \\\"../components/goals_scored_and_conceded/CleanSheets.svelte\\\";\\r\\n  import GoalsPerGame from \\\"../components/goals_per_game/GoalsPerGame.svelte\\\";\\r\\n  import Spider from \\\"../components/Spider.svelte\\\";\\r\\n  import ScoreFreq from \\\"../components/ScoreFreq.svelte\\\";\\r\\n  import NavBar from \\\"../components/NavBar.svelte\\\";\\r\\n  import MobileViewNav from \\\"../components/MobileViewNav.svelte\\\";\\r\\n\\r\\n  let alias = {\\r\\n    \\\"Wolverhampton Wanderers\\\": \\\"Wolves\\\",\\r\\n    \\\"Tottenham Hotspur\\\": \\\"Spurs\\\",\\r\\n    \\\"Leeds United\\\": \\\"Leeds\\\",\\r\\n    \\\"West Ham United\\\": \\\"West Ham\\\",\\r\\n    \\\"Brighton and Hove Albion\\\": \\\"Brighton\\\",\\r\\n  };\\r\\n\\r\\n  function toInitials(team) {\\r\\n    switch (team) {\\r\\n      case \\\"Brighton and Hove Albion\\\":\\r\\n        return \\\"BHA\\\";\\r\\n      case \\\"Manchester City\\\":\\r\\n        return \\\"MCI\\\";\\r\\n      case \\\"Manchester United\\\":\\r\\n        return \\\"MUN\\\";\\r\\n      case \\\"Aston Villa\\\":\\r\\n        return \\\"AVL\\\";\\r\\n      case \\\"Sheffield United\\\":\\r\\n        return \\\"SHU\\\";\\r\\n      case \\\"West Bromwich Albion\\\":\\r\\n        return \\\"WBA\\\";\\r\\n      case \\\"West Ham United\\\":\\r\\n        return \\\"WHU\\\";\\r\\n    }\\r\\n    return team.slice(0, 3).toUpperCase();\\r\\n  }\\r\\n\\r\\n  function toAlias(team) {\\r\\n    if (team in alias) {\\r\\n      return alias[team];\\r\\n    }\\r\\n    return team;\\r\\n  }\\r\\n\\r\\n  function toName(teamAlias) {\\r\\n    if (!Object.values(alias).includes(teamAlias)) {\\r\\n      return teamAlias;\\r\\n    }\\r\\n    return Object.keys(alias).find(key => alias[key] === teamAlias);\\r\\n  }\\r\\n\\r\\n  // Teams in the final position from last season (21/22), including championship teams\\r\\n  // Used for nav bar links order\\r\\n  let teams = [\\r\\n    \\\"Manchester City\\\",\\r\\n    \\\"Liverpool\\\",\\r\\n    \\\"Chelsea\\\",\\r\\n    \\\"Tottenham Hotspur\\\",\\r\\n    \\\"Arsenal\\\",\\r\\n    \\\"Manchester United\\\",\\r\\n    \\\"West Ham United\\\",\\r\\n    \\\"Leicester City\\\",\\r\\n    \\\"Brighton and Hove Albion\\\",\\r\\n    \\\"Wolverhampton Wanderers\\\",\\r\\n    \\\"Newcastle United\\\",\\r\\n    \\\"Crystal Palace\\\",\\r\\n    \\\"Brentford\\\",\\r\\n    \\\"Aston Villa\\\",\\r\\n    \\\"Southampton\\\",\\r\\n    \\\"Everton\\\",\\r\\n    \\\"Leeds United\\\",\\r\\n    \\\"Fulham\\\",\\r\\n    \\\"Bournemouth\\\",\\r\\n    \\\"Nottingham Forest\\\",\\r\\n  ];\\r\\n\\r\\n  function toTitleCase(str) {\\r\\n    return str\\r\\n      .toLowerCase()\\r\\n      .split(\\\" \\\")\\r\\n      .map(function (word) {\\r\\n        return word.charAt(0).toUpperCase() + word.slice(1);\\r\\n      })\\r\\n      .join(\\\" \\\")\\r\\n      .replace(\\\"And\\\", \\\"and\\\");\\r\\n  }\\r\\n\\r\\n  function getPlayedMatchdays(data, team) {\\r\\n    let matchdays = Object.keys(data.form[data._id][team]);\\r\\n\\r\\n    // If played one or no games, take x-axis from whole season dates\\r\\n    if (matchdays.length == 0) {\\r\\n      matchdays = Object.keys(data.fixtures[team]);\\r\\n    }\\r\\n\\r\\n    // Find median matchday date across all teams for each matchday\\r\\n    let x = [];\\r\\n    for (let matchday of matchdays) {\\r\\n      let matchdayDates = [];\\r\\n      data.teamNames.forEach((team) => {\\r\\n        matchdayDates.push(data.fixtures[team][matchday].date);\\r\\n      });\\r\\n      matchdayDates = matchdayDates.map((val) => {\\r\\n        return new Date(val);\\r\\n      });\\r\\n      matchdayDates = matchdayDates.sort();\\r\\n      x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);\\r\\n    }\\r\\n    x.sort(function (a, b) {\\r\\n      return a - b;\\r\\n    });\\r\\n    return x;\\r\\n  }\\r\\n\\r\\n  function getCurrentMatchday(data, team) {\\r\\n    if (Object.keys(data.form[data._id][team]).length == 0) {\\r\\n      return null; // Season has not started yet\\r\\n    }\\r\\n    return Object.keys(data.form[data._id][team]).reduce((matchday1, matchday2) =>\\r\\n      data.form[data._id][team][matchday1] >\\r\\n      data.form[data._id][team][matchday2]\\r\\n        ? matchday1\\r\\n        : matchday2\\r\\n    );\\r\\n  }\\r\\n\\r\\n  function openNavBar() {\\r\\n    document.getElementById(\\\"navBar\\\").style.display = \\\"block\\\";\\r\\n    document.getElementById(\\\"dashboard\\\").style.marginLeft = \\\"200px\\\";\\r\\n  }\\r\\n\\r\\n\\r\\n  async function fetchData(address) {\\r\\n    const response = await fetch(address);\\r\\n    let json = await response.json();\\r\\n    return json;\\r\\n  }\\r\\n\\r\\n  function initDashboard() {\\r\\n    team = toTitleCase(hyphenatedTeam.replace(/\\\\-/g, \\\" \\\"));\\r\\n    // fetchData(\\\"http://127.0.0.1:5000/api/teams\\\")\\r\\n    fetchData(\\\"https://pldashboard.herokuapp.com/api/teams\\\")\\r\\n      .then((json) => {\\r\\n        // Build teamData package from json data\\r\\n        json.teamNames = Object.keys(json.standings)\\r\\n        currentMatchday = getCurrentMatchday(json, team);\\r\\n        playedMatchdays = getPlayedMatchdays(json, team);\\r\\n        data = json;\\r\\n        console.log(data);\\r\\n      })\\r\\n      .then(() => {\\r\\n        window.dispatchEvent(new Event(\\\"resize\\\"));\\r\\n      });\\r\\n  }\\r\\n\\r\\n  function switchTeam(newTeam) {\\r\\n    hyphenatedTeam = newTeam;\\r\\n    team = toTitleCase(hyphenatedTeam.replace(/\\\\-/g, \\\" \\\"));\\r\\n    currentMatchday = getCurrentMatchday(data, team);\\r\\n    playedMatchdays = getPlayedMatchdays(data, team);\\r\\n    window.history.pushState(null,null,hyphenatedTeam); // Change current url without reloading\\r\\n  }\\r\\n\\r\\n  const showBadge = false;\\r\\n  let team = \\\"\\\";\\r\\n  let currentMatchday, playedMatchdays;\\r\\n  let data;\\r\\n  onMount(() => {\\r\\n    initDashboard();\\r\\n  });\\r\\n\\r\\n  export let hyphenatedTeam;\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>{team}</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"team\\\">\\r\\n    <div id=\\\"navBar\\\">\\r\\n      <NavBar team={hyphenatedTeam} {teams} getAlias={toAlias} {switchTeam} />\\r\\n    </div>\\r\\n    <div id=\\\"dashboard\\\">\\r\\n      <div class=\\\"header\\\" style=\\\"background-color: var(--{hyphenatedTeam});\\\">\\r\\n        <a class=\\\"main-link no-decoration\\\" href=\\\"/{hyphenatedTeam}\\\">\\r\\n          <div class=\\\"title\\\" style=\\\"color: var(--{hyphenatedTeam + '-secondary'});\\\">\\r\\n            {toAlias(team)}\\r\\n          </div>\\r\\n        </a>\\r\\n      </div>\\r\\n\\r\\n      {#if data != undefined}\\r\\n        <div class=\\\"page-content\\\">\\r\\n          <div class=\\\"row multi-element-row small-bottom-margin\\\">\\r\\n            {#if showBadge}\\r\\n              <div\\r\\n                class=\\\"row-left position-and-badge\\\"\\r\\n                style=\\\"background-image: url('{data.logoURLs[team]}')\\\"\\r\\n              >\\r\\n                <div class=\\\"position\\\">\\r\\n                  {data.standings[team][data._id].position}\\r\\n                </div>\\r\\n              </div>\\r\\n            {:else}\\r\\n              <div class=\\\"row-left position-no-badge\\\">\\r\\n                <div class=\\\"circles-background-container\\\">\\r\\n                  <svg class=\\\"circles-background\\\">\\r\\n                    <circle\\r\\n                      cx=\\\"300\\\"\\r\\n                      cy=\\\"150\\\"\\r\\n                      r=\\\"100\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{hyphenatedTeam}-secondary)\\\"\\r\\n                    />\\r\\n                    <circle\\r\\n                      cx=\\\"170\\\"\\r\\n                      cy=\\\"170\\\"\\r\\n                      r=\\\"140\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{hyphenatedTeam})\\\"\\r\\n                    />\\r\\n                    <circle\\r\\n                      cx=\\\"300\\\"\\r\\n                      cy=\\\"320\\\"\\r\\n                      r=\\\"170\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{hyphenatedTeam})\\\"\\r\\n                    />\\r\\n                  </svg>\\r\\n                </div>\\r\\n                <div class=\\\"position-central\\\">\\r\\n                  {data.standings[team][data._id].position}\\r\\n                </div>\\r\\n              </div>\\r\\n            {/if}\\r\\n            <div class=\\\"row-right fixtures-graph row-graph\\\">\\r\\n              <h1 class=\\\"lowered\\\">Fixtures</h1>\\r\\n              <div class=\\\"graph mini-graph mobile-margin\\\">\\r\\n                <Fixtures {data} {team} />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row multi-element-row\\\">\\r\\n            <div class=\\\"row-left form-details\\\">\\r\\n              <CurrentForm {data} {currentMatchday} {team} {toInitials} />\\r\\n              <TableSnippet {data} {hyphenatedTeam} {team} {toAlias} {switchTeam} />\\r\\n            </div>\\r\\n            <div class=\\\"row-right\\\">\\r\\n              <NextGame {data} {currentMatchday} {team} {showBadge} {toAlias} {switchTeam} />\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"form-graph row-graph\\\">\\r\\n              <h1 class=\\\"lowered\\\">Form Over Time</h1>\\r\\n              <div class=\\\"graph full-row-graph\\\">\\r\\n                <FormOverTime {data} {team} {playedMatchdays} />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"position-over-time-graph row-graph\\\">\\r\\n              <h1 class=\\\"lowered\\\">Position Over Time</h1>\\r\\n              <div class=\\\"graph full-row-graph\\\">\\r\\n                <PositionOverTime {data} {team} {playedMatchdays} />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row no-bottom-margin\\\">\\r\\n            <div class=\\\"goals-scored-vs-conceded-graph row-graph\\\">\\r\\n              <h1 class=\\\"lowered\\\">Goals Scored and Conceded</h1>\\r\\n              <div class=\\\"graph full-row-graph\\\">\\r\\n                <GoalsScoredAndConceded {data} {team} {playedMatchdays} />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"row-graph\\\">\\r\\n              <div class=\\\"clean-sheets graph full-row-graph\\\">\\r\\n                <CleanSheets {data} {team} {playedMatchdays} />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          \\r\\n          <div class=\\\"season-stats-row\\\">\\r\\n            <SeasonStats {data} {team} />\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"goals-freq-row row-graph\\\">\\r\\n              <h1>Goals Per Game</h1>\\r\\n              <GoalsPerGame {data} {team} />\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"row-graph\\\">\\r\\n                  <div class=\\\"score-freq graph\\\">\\r\\n                    <ScoreFreq {data} {team} />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"spider-chart-row row-graph\\\">\\r\\n              <div class=\\\"spider-chart-container\\\">\\r\\n                <Spider {data} {team} {teams} {toAlias} {toName} />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <MobileViewNav {hyphenatedTeam} {teams} {toAlias} {switchTeam} />\\r\\n\\r\\n          <TeamsFooter lastUpdated={data.lastUpdated} />\\r\\n        </div>\\r\\n      {:else}\\r\\n        <div class=\\\"loading-spinner-container\\\">\\r\\n          <div class=\\\"loading-spinner\\\" />\\r\\n        </div>\\r\\n      {/if}\\r\\n    </div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  .header {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .main-link {\\r\\n    width: fit-content;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .title {\\r\\n    font-size: 2.5rem;\\r\\n    width: fit-content;\\r\\n  }\\r\\n  .page-content {\\r\\n    position: relative;\\r\\n  }\\r\\n  #team {\\r\\n    display: flex;\\r\\n  }\\r\\n  .position-and-badge {\\r\\n    height: 500px;\\r\\n    background-repeat: no-repeat;\\r\\n    background-size: auto 450px;\\r\\n    background-position: right center;\\r\\n  }\\r\\n\\r\\n  .position-no-badge {\\r\\n    padding-left: 0;\\r\\n    margin: 0;\\r\\n    height: 500px;\\r\\n    /* width: 860px; */\\r\\n  }\\r\\n\\r\\n  .position-central,\\r\\n  .position {\\r\\n    text-shadow: 9px 9px #000;\\r\\n    font-weight: 800;\\r\\n    font-size: 430px;\\r\\n    user-select: none;\\r\\n    max-width: 500px;\\r\\n  }\\r\\n\\r\\n  .position {\\r\\n    text-align: left;\\r\\n    margin-top: 0.02em;\\r\\n    margin-left: 30px;\\r\\n  }\\r\\n\\r\\n  .position-central {\\r\\n    text-align: center;\\r\\n    margin-top: 0.04em;\\r\\n    max-height: 500px;\\r\\n    margin-left: 0.05em;\\r\\n  }\\r\\n\\r\\n  .circles-background-container {\\r\\n    position: absolute;\\r\\n    align-self: center;\\r\\n    width: 500px;\\r\\n    z-index: -10;\\r\\n  }\\r\\n\\r\\n  .circles-background {\\r\\n    height: 500px;\\r\\n    width: 500px;\\r\\n    transform: scale(0.95);\\r\\n  }\\r\\n  .position-central {\\r\\n    font-size: 20vw;\\r\\n    margin: auto;\\r\\n  }\\r\\n\\r\\n  #dashboard {\\r\\n    margin-left: 220px;\\r\\n    width: 100%;\\r\\n  }\\r\\n\\r\\n  /* .open-nav-bar-btn {\\r\\n    cursor: pointer;\\r\\n    position: absolute;\\r\\n    top: 0.9em;\\r\\n    left: 0.6em;\\r\\n    background: transparent;\\r\\n    border: none;\\r\\n    outline: none;\\r\\n    z-index: 50;\\r\\n  } */\\r\\n\\r\\n  .no-bottom-margin {\\r\\n    margin-bottom: 0 !important;\\r\\n  }\\r\\n  .small-bottom-margin {\\r\\n    margin-bottom: 1.5rem !important;\\r\\n  }\\r\\n  .page-content {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .row {\\r\\n    position: relative;\\r\\n    display: flex;\\r\\n    margin-bottom: 3rem;\\r\\n    height: auto;\\r\\n  }\\r\\n  .row-graph {\\r\\n    width: 100%;\\r\\n  }\\r\\n  .score-freq {\\r\\n    margin: 0 8% 0 8%;\\r\\n  }\\r\\n  .row-left {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    padding-right: auto;\\r\\n    margin-right: 2vw;\\r\\n    text-justify: center;\\r\\n    flex: 4;\\r\\n  }\\r\\n  .row-right {\\r\\n    flex: 10;\\r\\n  }\\r\\n  .multi-element-row {\\r\\n    margin: 0 20px 3rem 20px;\\r\\n  }\\r\\n\\r\\n  .spider-chart-row {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .spider-chart-container {\\r\\n    margin: 1em auto auto;\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  @media only screen and (min-width: 2400px) {\\r\\n    .position-central {\\r\\n      font-size: 16vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 2200px) {\\r\\n    .position-central {\\r\\n      font-size: 18vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 2000px) {\\r\\n    .position-central {\\r\\n      font-size: 20vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1800px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.9);\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 20vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1600px) {\\r\\n    .row-left {\\r\\n      flex: 5;\\r\\n    }\\r\\n    .circles-background {\\r\\n      transform: scale(0.85);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1500px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.8);\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 22vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1400px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.75);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1300px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.7);\\r\\n    }\\r\\n    #navBar {\\r\\n      display: none;\\r\\n    }\\r\\n    #dashboard {\\r\\n      margin-left: 0;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 24vw;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .row {\\r\\n      flex-direction: column;\\r\\n      margin-bottom: 40px;\\r\\n    }\\r\\n    .row-graph {\\r\\n      width: auto;\\r\\n      /* margin: 0 20px 0 30px */\\r\\n    }\\r\\n    .score-freq {\\r\\n      margin: 0 0 10px;\\r\\n    }\\r\\n\\r\\n    .multi-element-row {\\r\\n      margin: 0;\\r\\n    }\\r\\n    .mobile-margin {\\r\\n      margin-left: 10px;\\r\\n    }\\r\\n    .row-left {\\r\\n      margin-right: 0;\\r\\n      align-self: center;\\r\\n    }\\r\\n\\r\\n    .position-and-badge {\\r\\n      width: 50%;\\r\\n      max-width: 400px;\\r\\n      min-width: 150px;\\r\\n      padding-right: 3% !important;\\r\\n      background-size: auto 330px !important;\\r\\n      height: 400px;\\r\\n      margin-bottom: -50px;\\r\\n    }\\r\\n\\r\\n    .position-no-badge {\\r\\n      height: 400px;\\r\\n      width: 500px;\\r\\n    }\\r\\n\\r\\n    .circles-background {\\r\\n      transform: scale(0.5);\\r\\n      margin-top: -100px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 900px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.45);\\r\\n      margin-top: -120px;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 25vw;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.4);\\r\\n      margin-top: -120px;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 13em;\\r\\n    }\\r\\n    .season-stats-row {\\r\\n      margin: 10px;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .position,\\r\\n    .position-central {\\r\\n      font-size: 10em;\\r\\n      text-align: center;\\r\\n      line-height: 1.6;\\r\\n      padding-right: 20px;\\r\\n      margin: 0;\\r\\n      text-shadow: 7px 7px #000;\\r\\n    }\\r\\n    .multi-element-row {\\r\\n      margin: 0;\\r\\n    }\\r\\n\\r\\n    .position-and-badge {\\r\\n      background-size: auto 210px !important;\\r\\n      background-position: center !important;\\r\\n    }\\r\\n\\r\\n    .position-no-badge,\\r\\n    .position-and-badge {\\r\\n      padding: 0 !important;\\r\\n      margin: 0 !important;\\r\\n      width: 100%;\\r\\n    }\\r\\n\\r\\n    .circles-background {\\r\\n      transform: scale(0.35);\\r\\n      margin-top: -125px;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

const showBadge = false;

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

function toTitleCase(str) {
	return str.toLowerCase().split(" ").map(function (word) {
		return word.charAt(0).toUpperCase() + word.slice(1);
	}).join(" ").replace("And", "and");
}

function getPlayedMatchdays(data, team) {
	let matchdays = Object.keys(data.form[data._id][team]);

	// If played one or no games, take x-axis from whole season dates
	if (matchdays.length == 0) {
		matchdays = Object.keys(data.fixtures[team]);
	}

	// Find median matchday date across all teams for each matchday
	let x = [];

	for (let matchday of matchdays) {
		let matchdayDates = [];

		data.teamNames.forEach(team => {
			matchdayDates.push(data.fixtures[team][matchday].date);
		});

		matchdayDates = matchdayDates.map(val => {
			return new Date(val);
		});

		matchdayDates = matchdayDates.sort();
		x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
	}

	x.sort(function (a, b) {
		return a - b;
	});

	return x;
}

function getCurrentMatchday(data, team) {
	if (Object.keys(data.form[data._id][team]).length == 0) {
		return null; // Season has not started yet
	}

	return Object.keys(data.form[data._id][team]).reduce((matchday1, matchday2) => data.form[data._id][team][matchday1] > data.form[data._id][team][matchday2]
	? matchday1
	: matchday2);
}

async function fetchData$1(address) {
	const response = await fetch(address);
	let json = await response.json();
	return json;
}

const Team = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let alias = {
		"Wolverhampton Wanderers": "Wolves",
		"Tottenham Hotspur": "Spurs",
		"Leeds United": "Leeds",
		"West Ham United": "West Ham",
		"Brighton and Hove Albion": "Brighton"
	};

	function toAlias(team) {
		if (team in alias) {
			return alias[team];
		}

		return team;
	}

	function toName(teamAlias) {
		if (!Object.values(alias).includes(teamAlias)) {
			return teamAlias;
		}

		return Object.keys(alias).find(key => alias[key] === teamAlias);
	}

	// Teams in the final position from last season (21/22), including championship teams
	// Used for nav bar links order
	let teams = [
		"Manchester City",
		"Liverpool",
		"Chelsea",
		"Tottenham Hotspur",
		"Arsenal",
		"Manchester United",
		"West Ham United",
		"Leicester City",
		"Brighton and Hove Albion",
		"Wolverhampton Wanderers",
		"Newcastle United",
		"Crystal Palace",
		"Brentford",
		"Aston Villa",
		"Southampton",
		"Everton",
		"Leeds United",
		"Fulham",
		"Bournemouth",
		"Nottingham Forest"
	];

	function initDashboard() {
		team = toTitleCase(hyphenatedTeam.replace(/\-/g, " "));

		// fetchData("http://127.0.0.1:5000/api/teams")
		fetchData$1("https://pldashboard.herokuapp.com/api/teams").then(json => {
			// Build teamData package from json data
			json.teamNames = Object.keys(json.standings);

			currentMatchday = getCurrentMatchday(json, team);
			playedMatchdays = getPlayedMatchdays(json, team);
			data = json;
			console.log(data);
		}).then(() => {
			window.dispatchEvent(new Event("resize"));
		});
	}

	function switchTeam(newTeam) {
		hyphenatedTeam = newTeam;
		team = toTitleCase(hyphenatedTeam.replace(/\-/g, " "));
		currentMatchday = getCurrentMatchday(data, team);
		playedMatchdays = getPlayedMatchdays(data, team);
		window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
	}

	let team = "";
	let currentMatchday, playedMatchdays;
	let data;

	onMount(() => {
		initDashboard();
	});

	let { hyphenatedTeam } = $$props;
	if ($$props.hyphenatedTeam === void 0 && $$bindings.hyphenatedTeam && hyphenatedTeam !== void 0) $$bindings.hyphenatedTeam(hyphenatedTeam);
	$$result.css.add(css$2);

	return `${($$result.head += `${($$result.title = `<title>${escape(team)}</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="${"team"}" class="${"svelte-1cm2o45"}"><div id="${"navBar"}" class="${"svelte-1cm2o45"}">${validate_component(NavBar, "NavBar").$$render(
				$$result,
				{
					team: hyphenatedTeam,
					teams,
					getAlias: toAlias,
					switchTeam
				},
				{},
				{}
			)}</div>
    <div id="${"dashboard"}" class="${"svelte-1cm2o45"}"><div class="${"header svelte-1cm2o45"}" style="${"background-color: var(--" + escape(hyphenatedTeam, true) + ");"}"><a class="${"main-link no-decoration svelte-1cm2o45"}" href="${"/" + escape(hyphenatedTeam, true)}"><div class="${"title svelte-1cm2o45"}" style="${"color: var(--" + escape(hyphenatedTeam + '-secondary', true) + ");"}">${escape(toAlias(team))}</div></a></div>

      ${data != undefined
			? `<div class="${"page-content svelte-1cm2o45"}"><div class="${"row multi-element-row small-bottom-margin svelte-1cm2o45"}">${`<div class="${"row-left position-no-badge svelte-1cm2o45"}"><div class="${"circles-background-container svelte-1cm2o45"}"><svg class="${"circles-background svelte-1cm2o45"}"><circle cx="${"300"}" cy="${"150"}" r="${"100"}" stroke-width="${"0"}" fill="${"var(--" + escape(hyphenatedTeam, true) + "-secondary)"}"></circle><circle cx="${"170"}" cy="${"170"}" r="${"140"}" stroke-width="${"0"}" fill="${"var(--" + escape(hyphenatedTeam, true) + ")"}"></circle><circle cx="${"300"}" cy="${"320"}" r="${"170"}" stroke-width="${"0"}" fill="${"var(--" + escape(hyphenatedTeam, true) + ")"}"></circle></svg></div>
                <div class="${"position-central svelte-1cm2o45"}">${escape(data.standings[team][data._id].position)}</div></div>`}
            <div class="${"row-right fixtures-graph row-graph svelte-1cm2o45"}"><h1 class="${"lowered"}">Fixtures</h1>
              <div class="${"graph mini-graph mobile-margin svelte-1cm2o45"}">${validate_component(Fixtures, "Fixtures").$$render($$result, { data, team }, {}, {})}</div></div></div>

          <div class="${"row multi-element-row svelte-1cm2o45"}"><div class="${"row-left form-details svelte-1cm2o45"}">${validate_component(CurrentForm, "CurrentForm").$$render($$result, { data, currentMatchday, team, toInitials }, {}, {})}
              ${validate_component(TableSnippet, "TableSnippet").$$render(
					$$result,
					{
						data,
						hyphenatedTeam,
						team,
						toAlias,
						switchTeam
					},
					{},
					{}
				)}</div>
            <div class="${"row-right svelte-1cm2o45"}">${validate_component(NextGame, "NextGame").$$render(
					$$result,
					{
						data,
						currentMatchday,
						team,
						showBadge,
						toAlias,
						switchTeam
					},
					{},
					{}
				)}</div></div>

          <div class="${"row svelte-1cm2o45"}"><div class="${"form-graph row-graph svelte-1cm2o45"}"><h1 class="${"lowered"}">Form Over Time</h1>
              <div class="${"graph full-row-graph"}">${validate_component(FormOverTime, "FormOverTime").$$render($$result, { data, team, playedMatchdays }, {}, {})}</div></div></div>

          <div class="${"row svelte-1cm2o45"}"><div class="${"position-over-time-graph row-graph svelte-1cm2o45"}"><h1 class="${"lowered"}">Position Over Time</h1>
              <div class="${"graph full-row-graph"}">${validate_component(PositionOverTime, "PositionOverTime").$$render($$result, { data, team, playedMatchdays }, {}, {})}</div></div></div>

          <div class="${"row no-bottom-margin svelte-1cm2o45"}"><div class="${"goals-scored-vs-conceded-graph row-graph svelte-1cm2o45"}"><h1 class="${"lowered"}">Goals Scored and Conceded</h1>
              <div class="${"graph full-row-graph"}">${validate_component(GoalsScoredAndConceded, "GoalsScoredAndConceded").$$render($$result, { data, team, playedMatchdays }, {}, {})}</div></div></div>

          <div class="${"row svelte-1cm2o45"}"><div class="${"row-graph svelte-1cm2o45"}"><div class="${"clean-sheets graph full-row-graph"}">${validate_component(CleanSheets, "CleanSheets").$$render($$result, { data, team, playedMatchdays }, {}, {})}</div></div></div>
          
          <div class="${"season-stats-row svelte-1cm2o45"}">${validate_component(SeasonStats, "SeasonStats").$$render($$result, { data, team }, {}, {})}</div>

          <div class="${"row svelte-1cm2o45"}"><div class="${"goals-freq-row row-graph svelte-1cm2o45"}"><h1>Goals Per Game</h1>
              ${validate_component(GoalsPerGame, "GoalsPerGame").$$render($$result, { data, team }, {}, {})}</div></div>

              <div class="${"row svelte-1cm2o45"}"><div class="${"row-graph svelte-1cm2o45"}"><div class="${"score-freq graph svelte-1cm2o45"}">${validate_component(ScoreFreq, "ScoreFreq").$$render($$result, { data, team }, {}, {})}</div></div></div>

          <div class="${"row svelte-1cm2o45"}"><div class="${"spider-chart-row row-graph svelte-1cm2o45"}"><div class="${"spider-chart-container svelte-1cm2o45"}">${validate_component(Spider, "Spider").$$render($$result, { data, team, teams, toAlias, toName }, {}, {})}</div></div></div>

          ${validate_component(MobileViewNav, "MobileViewNav").$$render(
					$$result,
					{
						hyphenatedTeam,
						teams,
						toAlias,
						switchTeam
					},
					{},
					{}
				)}

          ${validate_component(TeamsFooter, "TeamsFooter").$$render($$result, { lastUpdated: data.lastUpdated }, {}, {})}</div>`
			: `<div class="${"loading-spinner-container"}"><div class="${"loading-spinner"}"></div></div>`}</div></div>`;
		}
	})}`;
});

/* src\routes\Home.svelte generated by Svelte v3.49.0 */

const css$1 = {
	code: "#home.svelte-nyqhdk{background:black;min-height:100vh;display:grid;place-items:center}.content.svelte-nyqhdk{display:grid;place-items:center;margin-bottom:100px}img.svelte-nyqhdk{width:min(80%, 1000px)}.links.svelte-nyqhdk{display:flex;margin-top:20px}.dashboard-link-container.svelte-nyqhdk,.fantasy-link-container.svelte-nyqhdk{margin:2em 0}.fantasy-link.svelte-nyqhdk{color:#37003c;background:#00ff87;padding:18px 58.5px\r\n  }.dashboard-link.svelte-nyqhdk{color:#00fe87;background:#38003d;padding:18px 25px}.dashboard-link.svelte-nyqhdk,.fantasy-link.svelte-nyqhdk{font-size:1.2em;border-radius:9px;font-weight:bold;letter-spacing:0.02em;margin:0 10px}@media only screen and (max-width: 800px){img.svelte-nyqhdk{width:90%}.dashboard-link.svelte-nyqhdk{padding:20px 38.45px}.dashboard-link.svelte-nyqhdk,.fantasy-link.svelte-nyqhdk{font-size:1.2em}.links.svelte-nyqhdk{flex-direction:column}}@media only screen and (max-width: 500px){.fantasy-link.svelte-nyqhdk{padding:20px 66.7px}.dashboard-link.svelte-nyqhdk,.fantasy-link.svelte-nyqhdk{font-size:1em}}",
	map: "{\"version\":3,\"file\":\"Home.svelte\",\"sources\":[\"Home.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  import { Router, Link } from \\\"svelte-routing\\\";\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Premier League</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"home\\\">\\r\\n    <div class=\\\"content\\\">\\r\\n      <img src=\\\"img/pldashboard4.png\\\" alt=\\\"pldashboard\\\">\\r\\n      <div class=\\\"links\\\">\\r\\n        <div class=\\\"dashboard-link-container\\\">\\r\\n          <a class=\\\"dashboard-link\\\" href=\\\"/\\\">Dashboard</a>\\r\\n        </div>\\r\\n        <div class=\\\"fantasy-link-container\\\">\\r\\n          <a class=\\\"fantasy-link\\\" href=\\\"/\\\">FPL</a>\\r\\n        </div>\\r\\n      </div>\\r\\n      <!-- <div class=\\\"donate\\\">\\r\\n        <a class=\\\"donate-link\\\" href=\\\"/\\\">Support me</a>\\r\\n      </div> -->\\r\\n    </div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  #home {\\r\\n    background: black;\\r\\n    min-height: 100vh;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .content {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    /* margin-top: 50px; */\\r\\n    margin-bottom: 100px;\\r\\n  }\\r\\n  img {\\r\\n    width: min(80%, 1000px);\\r\\n  }\\r\\n  .links {\\r\\n    display: flex;\\r\\n    margin-top: 20px;\\r\\n  }\\r\\n  .dashboard-link-container,\\r\\n  .fantasy-link-container {\\r\\n    margin: 2em 0;\\r\\n  }\\r\\n  .fantasy-link {\\r\\n    color: #37003c;\\r\\n    background: #00ff87;\\r\\n    padding: 18px 58.5px\\r\\n  }\\r\\n  .dashboard-link {\\r\\n    color: #00fe87;\\r\\n    background: #38003d;\\r\\n    padding: 18px 25px;\\r\\n  }\\r\\n  .dashboard-link,\\r\\n  .fantasy-link {\\r\\n    font-size: 1.2em;\\r\\n    border-radius: 9px;\\r\\n    font-weight: bold;\\r\\n    letter-spacing: 0.02em;\\r\\n    margin: 0 10px;\\r\\n  }\\r\\n\\r\\n  .donate {\\r\\n    margin-top: 100px;\\r\\n  }\\r\\n  .donate-link {\\r\\n    text-decoration: underline;\\r\\n    color: rgb(90, 90, 90);\\r\\n  }\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    img {\\r\\n      width: 90%;\\r\\n    }\\r\\n    .dashboard-link {\\r\\n      padding: 20px 38.45px;\\r\\n    }\\r\\n    .dashboard-link,\\r\\n    .fantasy-link {\\r\\n      font-size: 1.2em;\\r\\n    }\\r\\n    .links {\\r\\n      flex-direction: column;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 500px) {\\r\\n    .fantasy-link {\\r\\n      padding: 20px 66.7px;\\r\\n    }\\r\\n    .dashboard-link,\\r\\n    .fantasy-link {\\r\\n      font-size: 1em;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA6BE,KAAK,cAAC,CAAC,AACL,UAAU,CAAE,KAAK,CACjB,UAAU,CAAE,KAAK,CACjB,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,AACrB,CAAC,AACD,QAAQ,cAAC,CAAC,AACR,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CAEnB,aAAa,CAAE,KAAK,AACtB,CAAC,AACD,GAAG,cAAC,CAAC,AACH,KAAK,CAAE,IAAI,GAAG,CAAC,CAAC,MAAM,CAAC,AACzB,CAAC,AACD,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,IAAI,CACb,UAAU,CAAE,IAAI,AAClB,CAAC,AACD,uCAAyB,CACzB,uBAAuB,cAAC,CAAC,AACvB,MAAM,CAAE,GAAG,CAAC,CAAC,AACf,CAAC,AACD,aAAa,cAAC,CAAC,AACb,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,OAAO,CACnB,OAAO,CAAE,IAAI,CAAC,MAAM;EACtB,CAAC,AACD,eAAe,cAAC,CAAC,AACf,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,OAAO,CACnB,OAAO,CAAE,IAAI,CAAC,IAAI,AACpB,CAAC,AACD,6BAAe,CACf,aAAa,cAAC,CAAC,AACb,SAAS,CAAE,KAAK,CAChB,aAAa,CAAE,GAAG,CAClB,WAAW,CAAE,IAAI,CACjB,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,CAAC,CAAC,IAAI,AAChB,CAAC,AASD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,GAAG,cAAC,CAAC,AACH,KAAK,CAAE,GAAG,AACZ,CAAC,AACD,eAAe,cAAC,CAAC,AACf,OAAO,CAAE,IAAI,CAAC,OAAO,AACvB,CAAC,AACD,6BAAe,CACf,aAAa,cAAC,CAAC,AACb,SAAS,CAAE,KAAK,AAClB,CAAC,AACD,MAAM,cAAC,CAAC,AACN,cAAc,CAAE,MAAM,AACxB,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,aAAa,cAAC,CAAC,AACb,OAAO,CAAE,IAAI,CAAC,MAAM,AACtB,CAAC,AACD,6BAAe,CACf,aAAa,cAAC,CAAC,AACb,SAAS,CAAE,GAAG,AAChB,CAAC,AACH,CAAC\"}"
};

const Home = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css$1);

	return `${($$result.head += `${($$result.title = `<title>Premier League</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="${"home"}" class="${"svelte-nyqhdk"}"><div class="${"content svelte-nyqhdk"}"><img src="${"img/pldashboard4.png"}" alt="${"pldashboard"}" class="${"svelte-nyqhdk"}">
      <div class="${"links svelte-nyqhdk"}"><div class="${"dashboard-link-container svelte-nyqhdk"}"><a class="${"dashboard-link svelte-nyqhdk"}" href="${"/"}">Dashboard</a></div>
        <div class="${"fantasy-link-container svelte-nyqhdk"}"><a class="${"fantasy-link svelte-nyqhdk"}" href="${"/"}">FPL</a></div></div>
      </div></div>`;
		}
	})}`;
});

/* src\routes\Predictions.svelte generated by Svelte v3.49.0 */

const css = {
	code: ".predictions-header.svelte-15srcxs{padding:40px 40px 0;text-align:center}.predictions-title.svelte-15srcxs{font-size:2.6em;font-weight:800;letter-spacing:-1px;align-self:center;flex:auto;color:#333;margin:10px;text-decoration:none}.predictions.svelte-15srcxs{display:flex;flex-direction:column}.predictions-gap.svelte-15srcxs{margin:15px 0}.page-content.svelte-15srcxs{font-size:1.3em}.green.svelte-15srcxs{background-color:#77dd77}.yellow.svelte-15srcxs{background-color:#ffb347}.red.svelte-15srcxs{background-color:#c23b22}.predictions-container.svelte-15srcxs{width:50%;margin:0 auto}.date.svelte-15srcxs{width:min(90%, 300px);align-self:center;text-align:center;margin-bottom:2px;font-size:1.2rem}.prediction-item.svelte-15srcxs{text-align:left;margin:0 8%;display:flex}.prediction-label.svelte-15srcxs{flex:5}.prediction-value.svelte-15srcxs{flex:4.5;display:flex;text-align:right}.prediction-initials.svelte-15srcxs,.prediction-score.svelte-15srcxs{flex:1;text-align:center}.prediction-container.svelte-15srcxs{padding:6px 0 3px;margin:2px 0;width:min(90%, 300px);align-self:center;border-radius:var(--border-radius);color:inherit;border:none;font-size:16px;cursor:pointer;outline:inherit;position:relative}.medium-predictions-divider.svelte-15srcxs{align-self:center;border-bottom:3px solid black;width:min(100%, 375px);margin-bottom:2px}.prediction-details.svelte-15srcxs{font-size:0.75em;color:black;margin:5px 0;text-align:left;height:0;display:none}.prediction-time.svelte-15srcxs{color:grey;font-size:0.7em;position:absolute;right:-34px;top:calc(50% - 7px)}.prediction-detail.svelte-15srcxs{margin:3px 0 3px 30px}.prediction-details.expanded.svelte-15srcxs{height:auto;display:block}.detailed-predicted-score.svelte-15srcxs{font-size:1.2em;margin:10px 0 0;text-align:center}.tabbed.svelte-15srcxs{padding-left:2em}.predictions-footer.svelte-15srcxs{align-items:center;font-size:0.8em;margin-top:30px;text-align:center}.accuracy-display.svelte-15srcxs{text-align:center;font-size:13px}.accuracy.svelte-15srcxs{margin:1em 0 2.5em}.accuracy-item.svelte-15srcxs{color:rgb(120 120 120);margin-bottom:5px}.method-description.svelte-15srcxs{margin:20px auto 15px;width:80%}@media only screen and (max-width: 800px){.predictions-container.svelte-15srcxs{width:80%}.prediction-container.svelte-15srcxs{width:min(80%, 300px)}.prediction-time.svelte-15srcxs{right:-28px;top:calc(50% - 6px)}.prediction-value.svelte-15srcxs{flex:4}}@media only screen and (max-width: 550px){#predictions.svelte-15srcxs{font-size:0.9em}.predictions-title.svelte-15srcxs{font-size:2em !important}.predictions-container.svelte-15srcxs{width:90%}.prediction-container.svelte-15srcxs{width:80%}.accuracy-display.svelte-15srcxs{font-size:0.8rem}.prediction-item.svelte-15srcxs{margin:0 6%}}@media only screen and (max-width: 500px){.prediction-value.svelte-15srcxs{flex:4.5}}@media only screen and (max-width: 400px){.prediction-value.svelte-15srcxs{flex:6}}",
	map: "{\"version\":3,\"file\":\"Predictions.svelte\",\"sources\":[\"Predictions.svelte\"],\"sourcesContent\":[\"<script>\\r\\n  import { Router } from \\\"svelte-routing\\\";\\r\\n  import { onMount } from \\\"svelte\\\";\\r\\n\\r\\n  async function fetchData(address) {\\r\\n    const response = await fetch(address);\\r\\n    let json = await response.json();\\r\\n    return json;\\r\\n  }\\r\\n\\r\\n  function toggleDetailsDisplay(id) {\\r\\n    let prediction = document.getElementById(id);\\r\\n    if (prediction != null) {\\r\\n      prediction.classList.toggle(\\\"expanded\\\");\\r\\n    }\\r\\n  }\\r\\n\\r\\n  function identicalScore(prediction, actual) {\\r\\n    return (\\r\\n      Math.round(prediction.homeGoals) == actual.homeGoals &&\\r\\n      Math.round(prediction.awayGoals) == actual.awayGoals\\r\\n    );\\r\\n  }\\r\\n\\r\\n  function sameResult(prediction, actual) {\\r\\n    return (\\r\\n      (prediction.homeGoals > prediction.awayGoals &&\\r\\n        actual.homeGoals > actual.awayGoals) ||\\r\\n      (prediction.homeGoals == prediction.awayGoals &&\\r\\n        actual.homeGoals == actual.awayGoals) ||\\r\\n      (prediction.homeGoals < prediction.awayGoals &&\\r\\n        actual.homeGoals < actual.awayGoals)\\r\\n    );\\r\\n  }\\r\\n\\r\\n  function insertColours(json) {\\r\\n    for (let i = 0; i < json.predictions.length; i++) {\\r\\n      for (let j = 0; j < json.predictions[i].predictions.length; j++) {\\r\\n        let prediction = json.predictions[i].predictions[j];\\r\\n        if (prediction.actual != null) {\\r\\n          if (identicalScore(prediction.prediction, prediction.actual)) {\\r\\n            prediction.colour = \\\"green\\\";\\r\\n          } else if (sameResult(prediction.prediction, prediction.actual)) {\\r\\n            prediction.colour = \\\"yellow\\\";\\r\\n          } else {\\r\\n            prediction.colour = \\\"red\\\";\\r\\n          }\\r\\n        }\\r\\n      }\\r\\n    }\\r\\n  }\\r\\n\\r\\n  function datetimeToTime(datetime) {\\r\\n    let date = new Date(datetime);\\r\\n    date = date.toTimeString().slice(0, 5);\\r\\n    return date;\\r\\n  }\\r\\n\\r\\n  function sortByDate(json) {\\r\\n    json.predictions.sort((a, b) => {\\r\\n      return new Date(b._id) - new Date(a._id);\\r\\n    });\\r\\n    // Sort each day of predictions by time\\r\\n    for (let i = 0; i < json.predictions.length; i++) {\\r\\n      json.predictions[i].predictions.sort((a, b) => {\\r\\n        return new Date(a._id) - new Date(b._id);\\r\\n      });\\r\\n    }\\r\\n  }\\r\\n\\r\\n  let data;\\r\\n  onMount(() => {\\r\\n    // fetchData(\\\"http://127.0.0.1:5000/api/predictions\\\").then((json) => {\\r\\n    fetchData(\\\"https://pldashboard.herokuapp.com/api/predictions\\\").then(\\r\\n      (json) => {\\r\\n        sortByDate(json);\\r\\n        insertColours(json);\\r\\n        data = json;\\r\\n        console.log(data.predictions);\\r\\n      }\\r\\n    );\\r\\n  });\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Predictions</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"predictions\\\">\\r\\n\\r\\n  <div class=\\\"predictions-header\\\">\\r\\n    <a\\r\\n      class=\\\"predictions-title\\\"\\r\\n      href=\\\"/predictions\\\">Predictions</a\\r\\n    >\\r\\n  </div>\\r\\n\\r\\n  {#if data != undefined}\\r\\n    <div class=\\\"page-content\\\">\\r\\n      <div class=\\\"accuracy-display\\\">\\r\\n        <div class=\\\"accuracy\\\">\\r\\n          <span class=\\\"accuracy-item\\\">\\r\\n            Predicting with accuracy: <b\\r\\n              >{(data.accuracy.scoreAccuracy * 100).toFixed(2)}%</b\\r\\n            ></span\\r\\n          ><br />\\r\\n          <div class=\\\"accuracy-item\\\">\\r\\n            General results accuracy: <b\\r\\n              >{(data.accuracy.resultAccuracy * 100).toFixed(2)}%</b\\r\\n            >\\r\\n          </div>\\r\\n        </div>\\r\\n      </div>\\r\\n\\r\\n      <div class=\\\"predictions-container\\\">\\r\\n        <div class=\\\"predictions\\\">\\r\\n          {#if data.predictions != null}\\r\\n            {#each data.predictions as { _id, predictions }}\\r\\n              <div class=\\\"date\\\">\\r\\n                {_id}\\r\\n              </div>\\r\\n              <div class=\\\"medium-predictions-divider\\\" />\\r\\n              <!-- Each prediction on this day -->\\r\\n              {#each predictions as pred}\\r\\n                <button\\r\\n                  class=\\\"prediction-container {pred.colour}\\\"\\r\\n                  on:click={() => toggleDetailsDisplay(pred._id)}\\r\\n                >\\r\\n                  <div class=\\\"prediction prediction-item\\\">\\r\\n                    <div class=\\\"prediction-label\\\">Predicted:</div>\\r\\n                    <div class=\\\"prediction-value\\\">\\r\\n                      <div class=\\\"prediction-initials\\\">{pred.home}</div>\\r\\n                      <div class=\\\"prediction-score\\\">\\r\\n                        {Math.round(pred.prediction.homeGoals)} - {Math.round(\\r\\n                          pred.prediction.awayGoals\\r\\n                        )}\\r\\n                      </div>\\r\\n                      <div class=\\\"prediction-initials\\\">{pred.away}</div>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                  {#if pred.actual != null}\\r\\n                    <div class=\\\"actual prediction-item\\\">\\r\\n                      <div class=\\\"prediction-label\\\">Actual:</div>\\r\\n                      <div class=\\\"prediction-value\\\">\\r\\n                        <div class=\\\"prediction-initials\\\">{pred.home}</div>\\r\\n                        <div class=\\\"prediction-score\\\">\\r\\n                          {pred.actual.homeGoals} - {pred.actual.awayGoals}\\r\\n                        </div>\\r\\n                        <div class=\\\"prediction-initials\\\">{pred.away}</div>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  {:else}\\r\\n                    <div class=\\\"prediction-time\\\">\\r\\n                      {datetimeToTime(pred.datetime)}\\r\\n                    </div>\\r\\n                  {/if}\\r\\n\\r\\n                  <!-- Toggle to see detialed score -->\\r\\n                  {#if pred.prediction != null}\\r\\n                    <div class=\\\"prediction-details\\\" id={pred._id}>\\r\\n                      <div class=\\\"detailed-predicted-score\\\">\\r\\n                        <b\\r\\n                          >{pred.prediction.homeGoals} - {pred.prediction\\r\\n                            .awayGoals}</b\\r\\n                        >\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  {/if}\\r\\n                </button>\\r\\n              {/each}\\r\\n              <div class=\\\"predictions-gap\\\" />\\r\\n            {/each}\\r\\n          {/if}\\r\\n        </div>\\r\\n      </div>\\r\\n    </div>\\r\\n\\r\\n    <div class=\\\"predictions-footer footer-text-colour\\\">\\r\\n      <div class=\\\"method-description\\\">\\r\\n        Predictions are calculated using previous results and then adjusting by\\r\\n        recent form and home advantage.\\r\\n      </div>\\r\\n      <!-- <div class=\\\"last-updated\\\">{data.lastUpdated} UTC</div> -->\\r\\n    </div>\\r\\n  {:else}\\r\\n    <div class=\\\"loading-spinner-container\\\">\\r\\n      <div class=\\\"loading-spinner\\\" />\\r\\n    </div>\\r\\n  {/if}\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  .predictions-header {\\r\\n    padding: 40px 40px 0;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .predictions-title {\\r\\n    font-size: 2.6em;\\r\\n    font-weight: 800;\\r\\n    letter-spacing: -1px;\\r\\n    align-self: center;\\r\\n    flex: auto;\\r\\n    color: #333;\\r\\n    margin: 10px;\\r\\n    text-decoration: none;\\r\\n  }\\r\\n\\r\\n\\r\\n  .predictions {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n  }\\r\\n\\r\\n  .predictions-gap {\\r\\n    margin: 15px 0;\\r\\n  }\\r\\n\\r\\n  .page-content {\\r\\n    font-size: 1.3em;\\r\\n  }\\r\\n\\r\\n  .green {\\r\\n    background-color: #77dd77;\\r\\n  }\\r\\n\\r\\n  .yellow {\\r\\n    background-color: #ffb347;\\r\\n  }\\r\\n\\r\\n  .red {\\r\\n    background-color: #c23b22;\\r\\n  }\\r\\n\\r\\n  .predictions-container {\\r\\n    width: 50%;\\r\\n    margin: 0 auto;\\r\\n  }\\r\\n\\r\\n  .date {\\r\\n    width: min(90%, 300px);\\r\\n    align-self: center;\\r\\n    text-align: center;\\r\\n    margin-bottom: 2px;\\r\\n    font-size: 1.2rem;\\r\\n  }\\r\\n\\r\\n  .prediction-item {\\r\\n    text-align: left;\\r\\n    margin: 0 8%;\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  .prediction-label {\\r\\n    flex: 5;\\r\\n  }\\r\\n\\r\\n  .prediction-value {\\r\\n    flex: 4.5;\\r\\n    display: flex;\\r\\n    text-align: right;\\r\\n  }\\r\\n\\r\\n  .prediction-initials,\\r\\n  .prediction-score {\\r\\n    flex: 1;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .prediction-container {\\r\\n    padding: 6px 0 3px;\\r\\n    margin: 2px 0;\\r\\n    width: min(90%, 300px);\\r\\n    align-self: center;\\r\\n    border-radius: var(--border-radius);\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    font-size: 16px;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n    position: relative;\\r\\n  }\\r\\n\\r\\n  .medium-predictions-divider {\\r\\n    align-self: center;\\r\\n    border-bottom: 3px solid black;\\r\\n    width: min(100%, 375px);\\r\\n    margin-bottom: 2px;\\r\\n  }\\r\\n\\r\\n  .prediction-details {\\r\\n    font-size: 0.75em;\\r\\n    color: black;\\r\\n    margin: 5px 0;\\r\\n    text-align: left;\\r\\n    height: 0;\\r\\n    display: none;\\r\\n  }\\r\\n\\r\\n  .prediction-time {\\r\\n    color: grey;\\r\\n    font-size: 0.7em;\\r\\n    position: absolute;\\r\\n    right: -34px;\\r\\n    top: calc(50% - 7px);\\r\\n  }\\r\\n\\r\\n  .prediction-detail {\\r\\n    margin: 3px 0 3px 30px;\\r\\n  }\\r\\n\\r\\n  .prediction-details.expanded {\\r\\n    height: auto;\\r\\n    display: block;\\r\\n  }\\r\\n\\r\\n  .detailed-predicted-score {\\r\\n    font-size: 1.2em;\\r\\n    margin: 10px 0 0;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .tabbed {\\r\\n    padding-left: 2em;\\r\\n  }\\r\\n  .predictions-footer {\\r\\n    align-items: center;\\r\\n    font-size: 0.8em;\\r\\n    margin-top: 30px;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .accuracy-display {\\r\\n    text-align: center;\\r\\n    font-size: 13px;\\r\\n  }\\r\\n  .accuracy {\\r\\n    margin: 1em 0 2.5em;\\r\\n  }\\r\\n\\r\\n  .accuracy-item {\\r\\n    color: rgb(120 120 120);\\r\\n    margin-bottom: 5px;\\r\\n  }\\r\\n  .method-description {\\r\\n    margin: 20px auto 15px;\\r\\n    width: 80%;\\r\\n  }\\r\\n@media only screen and (max-width: 800px) {\\r\\n  .predictions-container {\\r\\n    width: 80%;\\r\\n  }\\r\\n\\r\\n  .prediction-container {\\r\\n    width: min(80%, 300px);\\r\\n  }\\r\\n\\r\\n  .prediction-time {\\r\\n    right: -28px;\\r\\n    top: calc(50% - 6px);\\r\\n  }\\r\\n\\r\\n  .prediction-value {\\r\\n    flex: 4;\\r\\n  }\\r\\n}\\r\\n\\r\\n@media only screen and (max-width: 550px) {\\r\\n  #predictions {\\r\\n    font-size: 0.9em;\\r\\n  }\\r\\n  .predictions-title {\\r\\n      font-size: 2em !important;\\r\\n    }\\r\\n    .predictions-container {\\r\\n      width: 90%;\\r\\n    }\\r\\n    .prediction-container {\\r\\n      width: 80%;\\r\\n    }\\r\\n    .accuracy-display {\\r\\n      font-size: 0.8rem;\\r\\n    }\\r\\n\\r\\n    /* .predictions {\\r\\n    font-size: 0.9em;\\r\\n  } */\\r\\n\\r\\n  /* .prev-results-title {\\r\\n    font-size: 18px;\\r\\n  } */\\r\\n  .prediction-item {\\r\\n    margin: 0 6%;\\r\\n  }\\r\\n}\\r\\n@media only screen and (max-width: 500px) {\\r\\n  .prediction-value {\\r\\n    flex: 4.5;\\r\\n  }\\r\\n}\\r\\n\\r\\n@media only screen and (max-width: 400px) {\\r\\n  .prediction-value {\\r\\n    flex: 6;\\r\\n  }\\r\\n}\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

async function fetchData(address) {
	const response = await fetch(address);
	let json = await response.json();
	return json;
}

function identicalScore(prediction, actual) {
	return Math.round(prediction.homeGoals) == actual.homeGoals && Math.round(prediction.awayGoals) == actual.awayGoals;
}

function sameResult(prediction, actual) {
	return prediction.homeGoals > prediction.awayGoals && actual.homeGoals > actual.awayGoals || prediction.homeGoals == prediction.awayGoals && actual.homeGoals == actual.awayGoals || prediction.homeGoals < prediction.awayGoals && actual.homeGoals < actual.awayGoals;
}

function insertColours(json) {
	for (let i = 0; i < json.predictions.length; i++) {
		for (let j = 0; j < json.predictions[i].predictions.length; j++) {
			let prediction = json.predictions[i].predictions[j];

			if (prediction.actual != null) {
				if (identicalScore(prediction.prediction, prediction.actual)) {
					prediction.colour = "green";
				} else if (sameResult(prediction.prediction, prediction.actual)) {
					prediction.colour = "yellow";
				} else {
					prediction.colour = "red";
				}
			}
		}
	}
}

function datetimeToTime(datetime) {
	let date = new Date(datetime);
	date = date.toTimeString().slice(0, 5);
	return date;
}

function sortByDate(json) {
	json.predictions.sort((a, b) => {
		return new Date(b._id) - new Date(a._id);
	});

	// Sort each day of predictions by time
	for (let i = 0; i < json.predictions.length; i++) {
		json.predictions[i].predictions.sort((a, b) => {
			return new Date(a._id) - new Date(b._id);
		});
	}
}

const Predictions = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let data;

	onMount(() => {
		// fetchData("http://127.0.0.1:5000/api/predictions").then((json) => {
		fetchData("https://pldashboard.herokuapp.com/api/predictions").then(json => {
			sortByDate(json);
			insertColours(json);
			data = json;
			console.log(data.predictions);
		});
	});

	$$result.css.add(css);

	return `${($$result.head += `${($$result.title = `<title>Predictions</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="${"predictions"}" class="${"svelte-15srcxs"}"><div class="${"predictions-header svelte-15srcxs"}"><a class="${"predictions-title svelte-15srcxs"}" href="${"/predictions"}">Predictions</a></div>

  ${data != undefined
			? `<div class="${"page-content svelte-15srcxs"}"><div class="${"accuracy-display svelte-15srcxs"}"><div class="${"accuracy svelte-15srcxs"}"><span class="${"accuracy-item svelte-15srcxs"}">Predicting with accuracy: <b>${escape((data.accuracy.scoreAccuracy * 100).toFixed(2))}%</b></span><br>
          <div class="${"accuracy-item svelte-15srcxs"}">General results accuracy: <b>${escape((data.accuracy.resultAccuracy * 100).toFixed(2))}%</b></div></div></div>

      <div class="${"predictions-container svelte-15srcxs"}"><div class="${"predictions svelte-15srcxs"}">${data.predictions != null
				? `${each(data.predictions, ({ _id, predictions }) => {
						return `<div class="${"date svelte-15srcxs"}">${escape(_id)}</div>
              <div class="${"medium-predictions-divider svelte-15srcxs"}"></div>
              
              ${each(predictions, pred => {
							return `<button class="${"prediction-container " + escape(pred.colour, true) + " svelte-15srcxs"}"><div class="${"prediction prediction-item svelte-15srcxs"}"><div class="${"prediction-label svelte-15srcxs"}">Predicted:</div>
                    <div class="${"prediction-value svelte-15srcxs"}"><div class="${"prediction-initials svelte-15srcxs"}">${escape(pred.home)}</div>
                      <div class="${"prediction-score svelte-15srcxs"}">${escape(Math.round(pred.prediction.homeGoals))} - ${escape(Math.round(pred.prediction.awayGoals))}</div>
                      <div class="${"prediction-initials svelte-15srcxs"}">${escape(pred.away)}</div>
                    </div></div>
                  ${pred.actual != null
							? `<div class="${"actual prediction-item svelte-15srcxs"}"><div class="${"prediction-label svelte-15srcxs"}">Actual:</div>
                      <div class="${"prediction-value svelte-15srcxs"}"><div class="${"prediction-initials svelte-15srcxs"}">${escape(pred.home)}</div>
                        <div class="${"prediction-score svelte-15srcxs"}">${escape(pred.actual.homeGoals)} - ${escape(pred.actual.awayGoals)}</div>
                        <div class="${"prediction-initials svelte-15srcxs"}">${escape(pred.away)}</div></div>
                    </div>`
							: `<div class="${"prediction-time svelte-15srcxs"}">${escape(datetimeToTime(pred.datetime))}
                    </div>`}

                  
                  ${pred.prediction != null
							? `<div class="${"prediction-details svelte-15srcxs"}"${add_attribute("id", pred._id, 0)}><div class="${"detailed-predicted-score svelte-15srcxs"}"><b>${escape(pred.prediction.homeGoals)} - ${escape(pred.prediction.awayGoals)}</b></div>
                    </div>`
							: ``}
                </button>`;
						})}
              <div class="${"predictions-gap svelte-15srcxs"}"></div>`;
					})}`
				: ``}</div></div></div>

    <div class="${"predictions-footer footer-text-colour svelte-15srcxs"}"><div class="${"method-description svelte-15srcxs"}">Predictions are calculated using previous results and then adjusting by
        recent form and home advantage.
      </div>
      </div>`
			: `<div class="${"loading-spinner-container"}"><div class="${"loading-spinner"}"></div></div>`}</div>`;
		}
	})}`;
});

/* src\App.svelte generated by Svelte v3.49.0 */

const App = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { url = "" } = $$props;
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);

	return `${validate_component(Router, "Router").$$render($$result, { url }, {}, {
		default: () => {
			return `${validate_component(Route, "Route").$$render($$result, { path: "/" }, {}, {
				default: () => {
					return `${validate_component(Team, "Team").$$render($$result, { hyphenatedTeam: "manchester-city" }, {}, {})}`;
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
  ${validate_component(Route, "Route").$$render($$result, { path: "/:team" }, {}, {
				default: ({ params }) => {
					return `${validate_component(Team, "Team").$$render($$result, { hyphenatedTeam: params.team }, {}, {})}`;
				}
			})}
  ${validate_component(Route, "Route").$$render($$result, { path: "/teams", component: Teams }, {}, {})}
  ${validate_component(Route, "Route").$$render($$result, { path: "/home", component: Home }, {}, {})}`;
		}
	})}`;
});

module.exports = App;
