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

const css$a = {
	code: ".teams.svelte-i9b06i{display:grid;grid-template-columns:repeat(4, 1fr);width:80%;margin:8px auto;box-shadow:0 0 0.5em 0.1em rgba(0, 0, 0, 0.2);background-color:rgba(0, 0, 0, 0.1)}@media only screen and (max-width: 1250px){.teams.svelte-i9b06i{width:90%}}@media only screen and (max-width: 1100px){.teams.svelte-i9b06i{grid-template-columns:repeat(2, 1fr)}}@media only screen and (max-width: 500px){.teams.svelte-i9b06i{grid-template-columns:repeat(1, 1fr)}}",
	map: "{\"version\":3,\"file\":\"Teams.svelte\",\"sources\":[\"Teams.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router, Link } from \\\"svelte-routing\\\";\\r\\nimport { onMount } from \\\"svelte\\\";\\r\\nfunction removeBorderRadius() {\\r\\n    document.getElementById(\\\"team-1\\\").classList.remove(\\\"top-left\\\");\\r\\n    document.getElementById(\\\"team-1\\\").classList.remove(\\\"top-right\\\");\\r\\n    document.getElementById(\\\"team-2\\\").classList.remove(\\\"top-right\\\");\\r\\n    document.getElementById(\\\"team-4\\\").classList.remove(\\\"top-right\\\");\\r\\n    document.getElementById(\\\"team-17\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-18\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-19\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-20\\\").classList.remove(\\\"bottom-left\\\");\\r\\n    document.getElementById(\\\"team-20\\\").classList.remove(\\\"bottom-right\\\");\\r\\n}\\r\\nfunction setBorderRadius() {\\r\\n    let width = window.innerWidth;\\r\\n    removeBorderRadius();\\r\\n    if (width < 500) {\\r\\n        // 20 rows of 1 column\\r\\n        document.getElementById(\\\"team-1\\\").classList.add(\\\"top-both\\\");\\r\\n        document.getElementById(\\\"team-20\\\").classList.add(\\\"bottom-both\\\");\\r\\n    }\\r\\n    else if (width < 1100) {\\r\\n        // 10 rows of 2 columns\\r\\n        document.getElementById(\\\"team-1\\\").classList.add(\\\"top-left\\\");\\r\\n        document.getElementById(\\\"team-2\\\").classList.add(\\\"top-right\\\");\\r\\n        document.getElementById(\\\"team-19\\\").classList.add(\\\"bottom-left\\\");\\r\\n        document.getElementById(\\\"team-20\\\").classList.add(\\\"bottom-right\\\");\\r\\n    }\\r\\n    else {\\r\\n        // 5 rows of 4 columns\\r\\n        document.getElementById(\\\"team-1\\\").classList.add(\\\"top-left\\\");\\r\\n        document.getElementById(\\\"team-4\\\").classList.add(\\\"top-right\\\");\\r\\n        document.getElementById(\\\"team-17\\\").classList.add(\\\"bottom-left\\\");\\r\\n        document.getElementById(\\\"team-20\\\").classList.add(\\\"bottom-right\\\");\\r\\n    }\\r\\n}\\r\\nlet teams = [\\r\\n    \\\"Manchester City\\\",\\r\\n    \\\"Liverpool\\\",\\r\\n    \\\"Chelsea\\\",\\r\\n    \\\"Tottenham Hotspur\\\",\\r\\n    \\\"Arsenal\\\",\\r\\n    \\\"Manchester United\\\",\\r\\n    \\\"West Ham United\\\",\\r\\n    \\\"Leicester City\\\",\\r\\n    \\\"Brighton and Hove Albion\\\",\\r\\n    \\\"Wolverhampton Wanderers\\\",\\r\\n    \\\"Newcastle United\\\",\\r\\n    \\\"Crystal Palace\\\",\\r\\n    \\\"Brentford\\\",\\r\\n    \\\"Aston Villa\\\",\\r\\n    \\\"Southampton\\\",\\r\\n    \\\"Everton\\\",\\r\\n    \\\"Leeds United\\\",\\r\\n    \\\"Fulham\\\",\\r\\n    \\\"Bournemouth\\\",\\r\\n    \\\"Nottingham Forest\\\",\\r\\n];\\r\\nonMount(() => {\\r\\n    window.addEventListener(\\\"resize\\\", setBorderRadius, true);\\r\\n    setBorderRadius();\\r\\n    return () => {\\r\\n        // Called when component is destroyed\\r\\n        window.removeEventListener(\\\"resize\\\", setBorderRadius, true);\\r\\n    };\\r\\n});\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Premier League</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div class=\\\"header\\\">\\r\\n    <Link to=\\\"/\\\">\\r\\n      <div class=\\\"title main-link no-decoration\\\">Premier League</div>\\r\\n    </Link>\\r\\n  </div>\\r\\n  <div class=\\\"page-content\\\">\\r\\n    <div class=\\\"teams\\\">\\r\\n      {#each teams as team, i (team)}\\r\\n        <Link\\r\\n          to=\\\"/{team.toLowerCase().replace(/ /g, '-')}\\\"\\r\\n          class=\\\"team-button\\\"\\r\\n          id=\\\"team-{i + 1}\\\"\\r\\n          style=\\\"background-color: var(--{team\\r\\n            .toLowerCase()\\r\\n            .replace(/ /g, '-')});\\\"\\r\\n        >\\r\\n          <div\\r\\n            class=\\\"main-link\\\"\\r\\n            style=\\\"color: var(--{team\\r\\n              .toLowerCase()\\r\\n              .replace(/ /g, '-')}-secondary);\\\"\\r\\n          >\\r\\n            {team}\\r\\n          </div>\\r\\n        </Link>\\r\\n      {/each}\\r\\n    </div>\\r\\n  </div></Router\\r\\n>\\r\\n\\r\\n<style scoped>\\r\\n  .teams {\\r\\n    display: grid;\\r\\n    grid-template-columns: repeat(4, 1fr);\\r\\n    width: 80%;\\r\\n    margin: 8px auto;\\r\\n    box-shadow: 0 0 0.5em 0.1em rgba(0, 0, 0, 0.2);\\r\\n    background-color: rgba(0, 0, 0, 0.1);\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1250px) {\\r\\n    .teams {\\r\\n      width: 90%;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .teams {\\r\\n      grid-template-columns: repeat(2, 1fr);\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 500px) {\\r\\n    .teams {\\r\\n      grid-template-columns: repeat(1, 1fr);\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAyGE,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,IAAI,CACb,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,CACrC,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,GAAG,CAAC,IAAI,CAChB,UAAU,CAAE,CAAC,CAAC,CAAC,CAAC,KAAK,CAAC,KAAK,CAAC,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,CAC9C,gBAAgB,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,AACtC,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,MAAM,cAAC,CAAC,AACN,KAAK,CAAE,GAAG,AACZ,CAAC,AACH,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,MAAM,cAAC,CAAC,AACN,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,MAAM,cAAC,CAAC,AACN,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,AACvC,CAAC,AACH,CAAC\"}"
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

	$$result.css.add(css$a);

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

/* src\components\current_form\FormTiles.svelte generated by Svelte v3.49.0 */

const css$9 = {
	code: "#formTile.svelte-1duemg{width:100%;aspect-ratio:1/0.9;color:#2b2d2f;display:grid;place-items:center;border-radius:inherit}.result.svelte-1duemg{margin-top:0.14em;font-size:2vw}.icon.svelte-1duemg{position:relative;flex:1}.pos-3.svelte-1duemg,.pos-4.svelte-1duemg,.pos-2.svelte-1duemg,.pos-1.svelte-1duemg{border-left:none}.pos-4.svelte-1duemg{opacity:100%;border-radius:0 6px 6px 0}.pos-3.svelte-1duemg{opacity:90%}.pos-2.svelte-1duemg{opacity:80%}.pos-1.svelte-1duemg{opacity:70%}.pos-0.svelte-1duemg{opacity:60%;border-radius:6px 0 0 6px}@media only screen and (max-width: 1100px){.result.svelte-1duemg{font-size:3em}}@media only screen and (max-width: 600px){.result.svelte-1duemg{font-size:7vw;margin-top:0.25em}}",
	map: "{\"version\":3,\"file\":\"FormTiles.svelte\",\"sources\":[\"FormTiles.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function background(result, starTeam) {\\r\\n    switch (result) {\\r\\n        case \\\"W\\\":\\r\\n            if (starTeam) {\\r\\n                return \\\"linear-gradient(30deg, #00ff87, #2bd2ff, #fa8bff)\\\";\\r\\n            }\\r\\n            else {\\r\\n                return \\\"#00fe87\\\";\\r\\n            }\\r\\n        case \\\"D\\\":\\r\\n            return \\\"#ffdd00\\\";\\r\\n        case \\\"L\\\":\\r\\n            return \\\"#f83027\\\";\\r\\n        default:\\r\\n            return \\\"#d6d6d6\\\";\\r\\n    }\\r\\n}\\r\\nfunction formatResult(result) {\\r\\n    switch (result) {\\r\\n        case \\\"W\\\":\\r\\n        case \\\"D\\\":\\r\\n        case \\\"L\\\":\\r\\n            return result;\\r\\n        default:\\r\\n            return \\\"\\\";\\r\\n    }\\r\\n}\\r\\nexport let form, starTeams;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"icon pos-0\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[0], starTeams[0])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[0])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-1\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[1], starTeams[1])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[1])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-2\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[2], starTeams[2])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[2])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-3\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[3], starTeams[3])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[3])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"icon pos-4\\\">\\r\\n  <div id=\\\"formTile\\\" style=\\\"background: {background(form[4], starTeams[4])}\\\">\\r\\n    <div class=\\\"result\\\">\\r\\n      {formatResult(form[4])}\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style>\\r\\n  #formTile {\\r\\n    width: 100%;\\r\\n    aspect-ratio: 1/0.9;\\r\\n    color: #2b2d2f;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    border-radius: inherit;\\r\\n  }\\r\\n  .result {\\r\\n    margin-top: 0.14em;\\r\\n    font-size: 2vw;\\r\\n  }\\r\\n\\r\\n  .icon {\\r\\n    position: relative;\\r\\n    flex: 1;\\r\\n  }\\r\\n\\r\\n  /* .pos-4, */\\r\\n  .pos-3,\\r\\n  .pos-4,\\r\\n  .pos-2,\\r\\n  .pos-1 {\\r\\n    border-left: none;\\r\\n  }\\r\\n\\r\\n  .pos-4 {\\r\\n    /* Most recent game */\\r\\n    opacity: 100%;\\r\\n    border-radius: 0 6px 6px 0;\\r\\n  }\\r\\n  \\r\\n  .pos-3 {\\r\\n    opacity: 90%;\\r\\n  }\\r\\n  \\r\\n  .pos-2 {\\r\\n    opacity: 80%;\\r\\n  }\\r\\n  \\r\\n  .pos-1 {\\r\\n    opacity: 70%;\\r\\n  }\\r\\n\\r\\n  .pos-0 {\\r\\n    /* Least recent game */\\r\\n    opacity: 60%;\\r\\n    border-radius: 6px 0 0 6px;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .result {\\r\\n      font-size: 3em;\\r\\n    }\\r\\n\\r\\n\\r\\n  }\\r\\n  @media only screen and (max-width: 600px) {\\r\\n    .result {\\r\\n      font-size: 7vw;\\r\\n      margin-top: 0.25em;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAmEE,SAAS,cAAC,CAAC,AACT,KAAK,CAAE,IAAI,CACX,YAAY,CAAE,CAAC,CAAC,GAAG,CACnB,KAAK,CAAE,OAAO,CACd,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,aAAa,CAAE,OAAO,AACxB,CAAC,AACD,OAAO,cAAC,CAAC,AACP,UAAU,CAAE,MAAM,CAClB,SAAS,CAAE,GAAG,AAChB,CAAC,AAED,KAAK,cAAC,CAAC,AACL,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,CAAC,AACT,CAAC,AAGD,oBAAM,CACN,oBAAM,CACN,oBAAM,CACN,MAAM,cAAC,CAAC,AACN,WAAW,CAAE,IAAI,AACnB,CAAC,AAED,MAAM,cAAC,CAAC,AAEN,OAAO,CAAE,IAAI,CACb,aAAa,CAAE,CAAC,CAAC,GAAG,CAAC,GAAG,CAAC,CAAC,AAC5B,CAAC,AAED,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,GAAG,AACd,CAAC,AAED,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,GAAG,AACd,CAAC,AAED,MAAM,cAAC,CAAC,AACN,OAAO,CAAE,GAAG,AACd,CAAC,AAED,MAAM,cAAC,CAAC,AAEN,OAAO,CAAE,GAAG,CACZ,aAAa,CAAE,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,GAAG,AAC5B,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,OAAO,cAAC,CAAC,AACP,SAAS,CAAE,GAAG,AAChB,CAAC,AAGH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,OAAO,cAAC,CAAC,AACP,SAAS,CAAE,GAAG,CACd,UAAU,CAAE,MAAM,AACpB,CAAC,AACH,CAAC\"}"
};

function background(result, starTeam) {
	switch (result) {
		case "W":
			if (starTeam) {
				return "linear-gradient(30deg, #00ff87, #2bd2ff, #fa8bff)";
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
	$$result.css.add(css$9);

	return `<div class="${"icon pos-0 svelte-1duemg"}"><div id="${"formTile"}" style="${"background: " + escape(background(form[0], starTeams[0]), true)}" class="${"svelte-1duemg"}"><div class="${"result svelte-1duemg"}">${escape(formatResult(form[0]))}</div></div></div>
<div class="${"icon pos-1 svelte-1duemg"}"><div id="${"formTile"}" style="${"background: " + escape(background(form[1], starTeams[1]), true)}" class="${"svelte-1duemg"}"><div class="${"result svelte-1duemg"}">${escape(formatResult(form[1]))}</div></div></div>
<div class="${"icon pos-2 svelte-1duemg"}"><div id="${"formTile"}" style="${"background: " + escape(background(form[2], starTeams[2]), true)}" class="${"svelte-1duemg"}"><div class="${"result svelte-1duemg"}">${escape(formatResult(form[2]))}</div></div></div>
<div class="${"icon pos-3 svelte-1duemg"}"><div id="${"formTile"}" style="${"background: " + escape(background(form[3], starTeams[3]), true)}" class="${"svelte-1duemg"}"><div class="${"result svelte-1duemg"}">${escape(formatResult(form[3]))}</div></div></div>
<div class="${"icon pos-4 svelte-1duemg"}"><div id="${"formTile"}" style="${"background: " + escape(background(form[4], starTeams[4]), true)}" class="${"svelte-1duemg"}"><div class="${"result svelte-1duemg"}">${escape(formatResult(form[4]))}</div></div>
</div>`;
});

/* src\components\current_form\CurrentForm.svelte generated by Svelte v3.49.0 */

const css$8 = {
	code: ".current-form.svelte-11hg8fr{font-size:1.7rem;margin:20px 0;padding:9px 25px;background:#38003d;color:white;border-radius:var(--border-radius)}.current-form-row.svelte-11hg8fr{font-size:13px;display:grid;grid-template-columns:repeat(5, 1fr);width:100%}.current-form-value.svelte-11hg8fr{color:var(--win)}.icon-name.svelte-11hg8fr{position:relative;margin-top:0.6em}@media only screen and (max-width: 1100px){.current-form-row.svelte-11hg8fr{width:min(80%, 440px)}}@media only screen and (max-width: 700px){.current-form-row.svelte-11hg8fr{width:95%}}@media only screen and (max-width: 550px){.current-form.svelte-11hg8fr{font-size:1.5rem !important}}",
	map: "{\"version\":3,\"file\":\"CurrentForm.svelte\",\"sources\":[\"CurrentForm.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import FormTiles from \\\"./FormTiles.svelte\\\";\\r\\nfunction getSortedMatchdays(data, team) {\\r\\n    let matchdays = Object.keys(data.form[team][data._id]).sort(function (matchday1, matchday2) {\\r\\n        return (new Date(data.form[team][data._id][matchday1].date) -\\r\\n            new Date(data.form[team][data._id][matchday2].date));\\r\\n    });\\r\\n    return matchdays;\\r\\n}\\r\\nfunction getFormStarTeams(data, team, matchdays) {\\r\\n    let formStarTeams = [];\\r\\n    for (let matchday of matchdays) {\\r\\n        let oppTeam = data.form[team][data._id][matchday].team;\\r\\n        formStarTeams.unshift(data.teamRatings[oppTeam].totalRating > 0.75);\\r\\n    }\\r\\n    // Fill in blanks\\r\\n    for (let i = formStarTeams.length; i < 5; i++) {\\r\\n        formStarTeams.unshift(false);\\r\\n    }\\r\\n    return formStarTeams;\\r\\n}\\r\\nfunction getFormIcons(data, team) {\\r\\n    let formIcons = [];\\r\\n    if (Object.keys(data.form[team][data._id][currentMatchday]).length > 0) {\\r\\n        formIcons = data.form[team][data._id][currentMatchday].form5.split(\\\"\\\");\\r\\n    }\\r\\n    // Fill in blanks with None icons\\r\\n    for (let i = formIcons.length; i < 5; i++) {\\r\\n        formIcons.unshift(\\\"N\\\");\\r\\n    }\\r\\n    return formIcons.join('');\\r\\n}\\r\\nfunction getFormInitials(data, team, matchdays) {\\r\\n    let formInitials = [];\\r\\n    for (let matchday of matchdays) {\\r\\n        formInitials.unshift(toInitials(data.form[team][data._id][matchday].team));\\r\\n    }\\r\\n    // Fill in blanks with None icons\\r\\n    for (let i = formInitials.length; i < 5; i++) {\\r\\n        formInitials.unshift(\\\"\\\");\\r\\n    }\\r\\n    return formInitials;\\r\\n}\\r\\nfunction latestNPlayedMatchdays(data, team, matchdays, N) {\\r\\n    let latestN = [];\\r\\n    for (let i = matchdays.length - 1; i >= 0; i--) {\\r\\n        if (data.form[team][data._id][matchdays[i]].score != null) {\\r\\n            latestN.push(matchdays[i]);\\r\\n        }\\r\\n        if (latestN.length >= N) {\\r\\n            break;\\r\\n        }\\r\\n    }\\r\\n    return latestN;\\r\\n}\\r\\nfunction setFormValues() {\\r\\n    let sortedMatchdays = getSortedMatchdays(data, team);\\r\\n    let matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);\\r\\n    formIcons = getFormIcons(data, team);\\r\\n    formStarTeams = getFormStarTeams(data, team, matchdays);\\r\\n    formInitials = getFormInitials(data, team, matchdays);\\r\\n}\\r\\nlet formIcons, formStarTeams, formInitials;\\r\\n$: team && setFormValues();\\r\\nexport let data, currentMatchday, team, toInitials;\\r\\n</script>\\r\\n\\r\\n{#if formInitials != undefined}\\r\\n  <div class=\\\"current-form-row icon-row\\\">\\r\\n    <FormTiles form={formIcons}, starTeams={formStarTeams} />\\r\\n  </div>\\r\\n  <div class=\\\"current-form-row name-row\\\">\\r\\n    <div class=\\\"icon-name pos-0\\\">{formInitials[0]}</div>\\r\\n    <div class=\\\"icon-name pos-1\\\">{formInitials[1]}</div>\\r\\n    <div class=\\\"icon-name pos-2\\\">{formInitials[2]}</div>\\r\\n    <div class=\\\"icon-name pos-3\\\">{formInitials[3]}</div>\\r\\n    <div class=\\\"icon-name pos-4\\\">{formInitials[4]}</div>\\r\\n  </div>\\r\\n{/if}\\r\\n<div class=\\\"current-form\\\">\\r\\n  Current form:\\r\\n  {#if currentMatchday != null}\\r\\n    <span class=\\\"current-form-value\\\">{(data.form[team][data._id][currentMatchday].formRating5 * 100).toFixed(1)}%</span>\\r\\n  {:else}\\r\\n    None\\r\\n  {/if}\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .current-form {\\r\\n    font-size: 1.7rem;\\r\\n    margin: 20px 0;\\r\\n    padding: 9px 25px;\\r\\n    background: #38003d;\\r\\n    color: white;\\r\\n    border-radius: var(--border-radius);\\r\\n  }\\r\\n  .current-form-row {\\r\\n    font-size: 13px;\\r\\n    display: grid;\\r\\n    grid-template-columns: repeat(5, 1fr);\\r\\n    width: 100%;\\r\\n  }\\r\\n  .current-form-value {\\r\\n    color: var(--win);\\r\\n  }\\r\\n\\r\\n  /* .name-row {\\r\\n    margin: 0 12px 0 4px;\\r\\n  } */\\r\\n\\r\\n  .icon-name {\\r\\n    position: relative;\\r\\n    margin-top: 0.6em;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .current-form-row {\\r\\n      width: min(80%, 440px);\\r\\n      /* margin-right: 8px; */\\r\\n    }\\r\\n    /* .name-row {\\r\\n      margin: 0 0 8px\\r\\n    } */\\r\\n  }\\r\\n  \\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .current-form-row {\\r\\n      width: 95%;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 550px) {\\r\\n\\r\\n  .current-form {\\r\\n    font-size: 1.5rem !important;\\r\\n  }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAwFE,aAAa,eAAC,CAAC,AACb,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,IAAI,CAAC,CAAC,CACd,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,UAAU,CAAE,OAAO,CACnB,KAAK,CAAE,KAAK,CACZ,aAAa,CAAE,IAAI,eAAe,CAAC,AACrC,CAAC,AACD,iBAAiB,eAAC,CAAC,AACjB,SAAS,CAAE,IAAI,CACf,OAAO,CAAE,IAAI,CACb,qBAAqB,CAAE,OAAO,CAAC,CAAC,CAAC,GAAG,CAAC,CACrC,KAAK,CAAE,IAAI,AACb,CAAC,AACD,mBAAmB,eAAC,CAAC,AACnB,KAAK,CAAE,IAAI,KAAK,CAAC,AACnB,CAAC,AAMD,UAAU,eAAC,CAAC,AACV,QAAQ,CAAE,QAAQ,CAClB,UAAU,CAAE,KAAK,AACnB,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,iBAAiB,eAAC,CAAC,AACjB,KAAK,CAAE,IAAI,GAAG,CAAC,CAAC,KAAK,CAAC,AAExB,CAAC,AAIH,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,iBAAiB,eAAC,CAAC,AACjB,KAAK,CAAE,GAAG,AACZ,CAAC,AACH,CAAC,AACD,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AAE3C,aAAa,eAAC,CAAC,AACb,SAAS,CAAE,MAAM,CAAC,UAAU,AAC9B,CAAC,AACD,CAAC\"}"
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

		if (Object.keys(data.form[team][data._id][currentMatchday]).length > 0) {
			formIcons = data.form[team][data._id][currentMatchday].form5.split("");
		}

		// Fill in blanks with None icons
		for (let i = formIcons.length; i < 5; i++) {
			formIcons.unshift("N");
		}

		return formIcons.join('');
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
	let { data, currentMatchday, team, toInitials } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.toInitials === void 0 && $$bindings.toInitials && toInitials !== void 0) $$bindings.toInitials(toInitials);
	$$result.css.add(css$8);
	team && setFormValues();

	return `${formInitials != undefined
	? `<div class="${"current-form-row icon-row svelte-11hg8fr"}">${validate_component(FormTiles, "FormTiles").$$render(
			$$result,
			{
				form: formIcons + ",",
				starTeams: formStarTeams
			},
			{},
			{}
		)}</div>
  <div class="${"current-form-row name-row svelte-11hg8fr"}"><div class="${"icon-name pos-0 svelte-11hg8fr"}">${escape(formInitials[0])}</div>
    <div class="${"icon-name pos-1 svelte-11hg8fr"}">${escape(formInitials[1])}</div>
    <div class="${"icon-name pos-2 svelte-11hg8fr"}">${escape(formInitials[2])}</div>
    <div class="${"icon-name pos-3 svelte-11hg8fr"}">${escape(formInitials[3])}</div>
    <div class="${"icon-name pos-4 svelte-11hg8fr"}">${escape(formInitials[4])}</div></div>`
	: ``}
<div class="${"current-form svelte-11hg8fr"}">Current form:
  ${currentMatchday != null
	? `<span class="${"current-form-value svelte-11hg8fr"}">${escape((data.form[team][data._id][currentMatchday].formRating5 * 100).toFixed(1))}%</span>`
	: `None`}
</div>`;
});

/* src\components\TableSnippet.svelte generated by Svelte v3.49.0 */

const css$7 = {
	code: ".table-snippet.svelte-1l9y3x9{position:relative;margin-top:20px;display:flex;flex-direction:column;width:100%;height:auto}.table-row.svelte-1l9y3x9{display:flex;padding:5px 5%;border-radius:var(--border-radius)}.table-row.this-team.svelte-1l9y3x9{padding:14px 5%;font-size:20px}.this-team.svelte-1l9y3x9{font-size:1.1em !important}#divider.svelte-1l9y3x9{align-self:center;border-bottom:1px solid grey;width:90%;margin:auto}.column-title.svelte-1l9y3x9{font-weight:700}.table-position.svelte-1l9y3x9{width:7%}button.svelte-1l9y3x9{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit}.table-team-name.svelte-1l9y3x9{width:63%;text-align:left;margin-left:8px;color:#333333}.table-gd.svelte-1l9y3x9{width:15%}.table-points.svelte-1l9y3x9{width:15%}",
	map: "{\"version\":3,\"file\":\"TableSnippet.svelte\",\"sources\":[\"TableSnippet.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function tableSnippetRange(sortedTeams, team) {\\r\\n    let teamStandingsIdx = sortedTeams.indexOf(team);\\r\\n    let low = teamStandingsIdx - 3;\\r\\n    let high = teamStandingsIdx + 4;\\r\\n    if (low < 0) {\\r\\n        let overflow = low;\\r\\n        high -= overflow;\\r\\n        low = 0;\\r\\n    }\\r\\n    if (high > sortedTeams.length - 1) {\\r\\n        let overflow = high - sortedTeams.length;\\r\\n        low -= overflow;\\r\\n        high = sortedTeams.length;\\r\\n    }\\r\\n    return [low, high];\\r\\n}\\r\\nfunction buildTableSnippet() {\\r\\n    let sortedTeams = Object.keys(data.standings).sort(function (teamA, teamB) {\\r\\n        return (data.standings[teamA][data._id].position -\\r\\n            data.standings[teamB][data._id].position);\\r\\n    });\\r\\n    let [low, high] = tableSnippetRange(sortedTeams, team);\\r\\n    let teamTableIdx;\\r\\n    let rows = [];\\r\\n    for (let i = low; i < high; i++) {\\r\\n        if (sortedTeams[i] == team) {\\r\\n            teamTableIdx = i - low;\\r\\n        }\\r\\n        rows.push({\\r\\n            name: sortedTeams[i],\\r\\n            position: data.standings[sortedTeams[i]][data._id].position,\\r\\n            points: data.standings[sortedTeams[i]][data._id].points,\\r\\n            gd: data.standings[sortedTeams[i]][data._id].gD,\\r\\n        });\\r\\n    }\\r\\n    tableSnippet = {\\r\\n        teamTableIdx: teamTableIdx,\\r\\n        rows: rows,\\r\\n    };\\r\\n}\\r\\nlet tableSnippet;\\r\\n$: team && buildTableSnippet();\\r\\nexport let data, hyphenatedTeam, team, toAlias, switchTeam;\\r\\n</script>\\r\\n\\r\\n<div class=\\\"table-snippet\\\">\\r\\n  {#if tableSnippet != undefined}\\r\\n    <div class=\\\"divider\\\" />\\r\\n    <div class=\\\"table-row\\\">\\r\\n      <div class=\\\"table-element table-position column-title\\\" />\\r\\n      <div class=\\\"table-element table-team-name column-title\\\">Team</div>\\r\\n      <div class=\\\"table-element table-gd column-title\\\">GD</div>\\r\\n      <div class=\\\"table-element table-points column-title\\\">Points</div>\\r\\n    </div>\\r\\n\\r\\n    {#each tableSnippet.rows as row, i}\\r\\n      <!-- Divider -->\\r\\n      {#if i == 0}\\r\\n        {#if i != tableSnippet.teamTableIdx}\\r\\n          <div id=\\\"divider\\\" />\\r\\n        {/if}\\r\\n      {:else if i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx}\\r\\n        <div id=\\\"divider\\\" />\\r\\n      {/if}\\r\\n      <!-- Row of table -->\\r\\n      {#if i == tableSnippet.teamTableIdx}\\r\\n        <!-- Highlighted row for the team of the current page -->\\r\\n        <div\\r\\n          class=\\\"table-row this-team\\\"\\r\\n          style=\\\"background-color: var(--{hyphenatedTeam});\\\"\\r\\n        >\\r\\n          <div\\r\\n            class=\\\"table-element table-position this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.position}\\r\\n          </div>\\r\\n          <a\\r\\n            href=\\\"/{hyphenatedTeam}\\\"\\r\\n            class=\\\"table-element table-team-name this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {toAlias(row.name)}\\r\\n          </a>\\r\\n          <div\\r\\n            class=\\\"table-element table-gd this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.gd}\\r\\n          </div>\\r\\n          <div\\r\\n            class=\\\"table-element table-points this-team\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam}-secondary);\\\"\\r\\n          >\\r\\n            {row.points}\\r\\n          </div>\\r\\n        </div>\\r\\n      {:else}\\r\\n        <!-- Plain row -->\\r\\n        <div class=\\\"table-row\\\">\\r\\n          <div class=\\\"table-element table-position\\\">\\r\\n            {row.position}\\r\\n          </div>\\r\\n          <button\\r\\n            on:click=\\\"{() => {switchTeam(row.name.toLowerCase().replace(/ /g, '-'))}}\\\"\\r\\n            class=\\\"table-element table-team-name\\\"\\r\\n          >\\r\\n            {toAlias(row.name)}\\r\\n          </button>\\r\\n          <div class=\\\"table-element table-gd\\\">\\r\\n            {row.gd}\\r\\n          </div>\\r\\n          <div class=\\\"table-element table-points\\\">\\r\\n            {row.points}\\r\\n          </div>\\r\\n        </div>\\r\\n      {/if}\\r\\n    {/each}\\r\\n    {#if tableSnippet.teamTableIdx != 6}\\r\\n      <div id=\\\"divider\\\" />\\r\\n    {/if}\\r\\n  {/if}\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .table-snippet {\\r\\n    position: relative;\\r\\n    margin-top: 20px;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    width: 100%;\\r\\n    height: auto;\\r\\n  }\\r\\n\\r\\n  .table-row {\\r\\n    display: flex;\\r\\n    padding: 5px 5%;\\r\\n    border-radius: var(--border-radius);\\r\\n  }\\r\\n\\r\\n  .table-row.this-team {\\r\\n    padding: 14px 5%;\\r\\n    font-size: 20px;\\r\\n  }\\r\\n\\r\\n  .this-team {\\r\\n    font-size: 1.1em !important;\\r\\n  }\\r\\n\\r\\n  #divider {\\r\\n    align-self: center;\\r\\n    border-bottom: 1px solid grey;\\r\\n    width: 90%;\\r\\n    margin: auto;\\r\\n  }\\r\\n\\r\\n  .column-title {\\r\\n    font-weight: 700;\\r\\n  }\\r\\n\\r\\n  .table-position {\\r\\n    width: 7%;\\r\\n  }\\r\\n\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n  }\\r\\n\\r\\n  .table-team-name {\\r\\n    width: 63%;\\r\\n    text-align: left;\\r\\n    margin-left: 8px;\\r\\n    color: #333333;\\r\\n  }\\r\\n\\r\\n  .table-gd {\\r\\n    width: 15%;\\r\\n  }\\r\\n\\r\\n  .table-points {\\r\\n    width: 15%;\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA6HE,cAAc,eAAC,CAAC,AACd,QAAQ,CAAE,QAAQ,CAClB,UAAU,CAAE,IAAI,CAChB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,AACd,CAAC,AAED,UAAU,eAAC,CAAC,AACV,OAAO,CAAE,IAAI,CACb,OAAO,CAAE,GAAG,CAAC,EAAE,CACf,aAAa,CAAE,IAAI,eAAe,CAAC,AACrC,CAAC,AAED,UAAU,UAAU,eAAC,CAAC,AACpB,OAAO,CAAE,IAAI,CAAC,EAAE,CAChB,SAAS,CAAE,IAAI,AACjB,CAAC,AAED,UAAU,eAAC,CAAC,AACV,SAAS,CAAE,KAAK,CAAC,UAAU,AAC7B,CAAC,AAED,QAAQ,eAAC,CAAC,AACR,UAAU,CAAE,MAAM,CAClB,aAAa,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,CAC7B,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,IAAI,AACd,CAAC,AAED,aAAa,eAAC,CAAC,AACb,WAAW,CAAE,GAAG,AAClB,CAAC,AAED,eAAe,eAAC,CAAC,AACf,KAAK,CAAE,EAAE,AACX,CAAC,AAED,MAAM,eAAC,CAAC,AACN,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OAAO,AAClB,CAAC,AAED,gBAAgB,eAAC,CAAC,AAChB,KAAK,CAAE,GAAG,CACV,UAAU,CAAE,IAAI,CAChB,WAAW,CAAE,GAAG,CAChB,KAAK,CAAE,OAAO,AAChB,CAAC,AAED,SAAS,eAAC,CAAC,AACT,KAAK,CAAE,GAAG,AACZ,CAAC,AAED,aAAa,eAAC,CAAC,AACb,KAAK,CAAE,GAAG,AACZ,CAAC\"}"
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
	$$result.css.add(css$7);
	team && buildTableSnippet();

	return `<div class="${"table-snippet svelte-1l9y3x9"}">${tableSnippet != undefined
	? `<div class="${"divider"}"></div>
    <div class="${"table-row svelte-1l9y3x9"}"><div class="${"table-element table-position column-title svelte-1l9y3x9"}"></div>
      <div class="${"table-element table-team-name column-title svelte-1l9y3x9"}">Team</div>
      <div class="${"table-element table-gd column-title svelte-1l9y3x9"}">GD</div>
      <div class="${"table-element table-points column-title svelte-1l9y3x9"}">Points</div></div>

    ${each(tableSnippet.rows, (row, i) => {
			return `
      ${i == 0
			? `${i != tableSnippet.teamTableIdx
				? `<div id="${"divider"}" class="${"svelte-1l9y3x9"}"></div>`
				: ``}`
			: `${i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx
				? `<div id="${"divider"}" class="${"svelte-1l9y3x9"}"></div>`
				: ``}`}
      
      ${i == tableSnippet.teamTableIdx
			? `
        <div class="${"table-row this-team svelte-1l9y3x9"}" style="${"background-color: var(--" + escape(hyphenatedTeam, true) + ");"}"><div class="${"table-element table-position this-team svelte-1l9y3x9"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.position)}</div>
          <a href="${"/" + escape(hyphenatedTeam, true)}" class="${"table-element table-team-name this-team svelte-1l9y3x9"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(toAlias(row.name))}</a>
          <div class="${"table-element table-gd this-team svelte-1l9y3x9"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.gd)}</div>
          <div class="${"table-element table-points this-team svelte-1l9y3x9"}" style="${"color: var(--" + escape(hyphenatedTeam, true) + "-secondary);"}">${escape(row.points)}</div>
        </div>`
			: `
        <div class="${"table-row svelte-1l9y3x9"}"><div class="${"table-element table-position svelte-1l9y3x9"}">${escape(row.position)}</div>
          <button class="${"table-element table-team-name svelte-1l9y3x9"}">${escape(toAlias(row.name))}</button>
          <div class="${"table-element table-gd svelte-1l9y3x9"}">${escape(row.gd)}</div>
          <div class="${"table-element table-points svelte-1l9y3x9"}">${escape(row.points)}</div>
        </div>`}`;
		})}
    ${tableSnippet.teamTableIdx != 6
		? `<div id="${"divider"}" class="${"svelte-1l9y3x9"}"></div>`
		: ``}`
	: ``}
</div>`;
});

/* src\components\NextGame.svelte generated by Svelte v3.49.0 */

const css$6 = {
	code: ".left-side.svelte-yed2u9,.right-side.svelte-yed2u9{display:flex;flex:1}.goals-container.svelte-yed2u9{flex-grow:1}.away-goals.svelte-yed2u9,.home-goals.svelte-yed2u9{margin:4px 0}.home-goals.svelte-yed2u9{text-align:right;padding-right:0.5em;border-right:1px solid black}.away-goals.svelte-yed2u9{text-align:left;padding-left:0.5em;border-left:1px solid black}.next-game-title.svelte-yed2u9{width:max-content;padding:6px 20px;border-radius:0 0 var(--border-radius) 0;background:#38003d;margin:-1px 0 0 -1px}.next-game-season-complete.svelte-yed2u9{display:grid;place-items:center;background:#f3f3f3;border:rgb(181, 181, 181) solid 5px;border-radius:var(--border-radius);height:98%}.next-game-title-text.svelte-yed2u9{margin:0;color:white;display:flex}.next-game-team-btn.svelte-yed2u9{color:#00fe87 !important}.next-game-logo.svelte-yed2u9{height:225px;margin:10px;background-repeat:no-repeat;background-size:contain;background-position:center}.predictions-and-logo.svelte-yed2u9{font-size:1.4em;width:45%;margin:auto}button.svelte-yed2u9{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit}.predictions-link.svelte-yed2u9{text-decoration:none;color:#333}.predictions-link.svelte-yed2u9:hover{color:rgb(120 120 120)}.past-results.svelte-yed2u9{font-size:22px;width:55%;display:flex;flex-direction:column;padding:15px 20px 10px;border-radius:6px;margin:auto 0}.next-game-prediction.svelte-yed2u9{border-radius:var(--border-radius);min-height:97.5%;border:6px solid #38003d}.next-game-values.svelte-yed2u9{display:flex;margin-right:2vw;min-height:387px}.next-game-position.svelte-yed2u9{font-size:3.3em;font-weight:700}.ordinal-position.svelte-yed2u9{font-size:0.6em}.past-result.svelte-yed2u9{font-size:15px;display:flex}.past-result-date.svelte-yed2u9{font-size:13px;width:90px;margin:5px auto 2px;padding-top:3px;border-radius:4px 4px 0 0}.prev-results-title.svelte-yed2u9{font-weight:700;padding-top:0;margin:0 !important}.no-prev-results.svelte-yed2u9{display:grid;place-items:center;color:rgb(181, 181, 181);color:rgba(0, 0, 0, 0.35);border-radius:var(--border-radius);padding:100px 0;color:white}.next-game-item.svelte-yed2u9{border-radius:9px}.home-team.svelte-yed2u9{float:left;text-align:left;border-radius:var(--border-radius) 0 0 var(--border-radius)}.away-team.svelte-yed2u9{float:left;text-align:right;border-radius:0 var(--border-radius) var(--border-radius) 0}.home-team.svelte-yed2u9,.away-team.svelte-yed2u9{font-size:15px;width:calc(50% - 18px);padding:5px 0 3px;text-align:center}.next-game-team-btn.svelte-yed2u9{color:inherit;text-align:left}.current-form.svelte-yed2u9{border-radius:6px;padding:10px 15px;color:white;background:#38003d;width:fit-content;margin:auto auto 10px}.current-form-value.svelte-yed2u9{color:#00fe87}@media only screen and (max-width: 1100px){.next-game-prediction.svelte-yed2u9{margin:50px 20px 40px}.next-game-values.svelte-yed2u9{margin:2% 3vw 2% 0;min-height:auto}}@media only screen and (max-width: 800px){.next-game-prediction.svelte-yed2u9{margin:50px 75px 40px}.next-game-values.svelte-yed2u9{flex-direction:column;margin:20px 15px 15px}.predictions-and-logo.svelte-yed2u9{margin:0 auto;width:100%}.past-results.svelte-yed2u9{margin:30px auto 0;width:94%;padding:10px}.next-game-prediction.svelte-yed2u9{padding-bottom:0}.next-game-title-text.svelte-yed2u9{flex-direction:column;text-align:left}.next-game-title.svelte-yed2u9{padding:6px 15px}}@media only screen and (max-width: 700px){.next-game-prediction.svelte-yed2u9{margin:40px 20px}}@media only screen and (max-width: 550px){.next-game-title.svelte-yed2u9{padding:6px 15px 7px 12px}.next-game-values.svelte-yed2u9{margin:25px 10px 10px;font-size:0.85em}.next-game-prediction.svelte-yed2u9{margin:40px 14px}}",
	map: "{\"version\":3,\"file\":\"NextGame.svelte\",\"sources\":[\"NextGame.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function ordinal(n) {\\r\\n    let ord = [, \\\"st\\\", \\\"nd\\\", \\\"rd\\\"];\\r\\n    let a = n % 100;\\r\\n    return ord[a > 20 ? a % 10 : a] || \\\"th\\\";\\r\\n}\\r\\nfunction resultColour(prevMatch, home) {\\r\\n    if (home) {\\r\\n        if (prevMatch.homeGoals < prevMatch.awayGoals) {\\r\\n            return prevMatch.awayTeam;\\r\\n        }\\r\\n        else {\\r\\n            return prevMatch.homeTeam;\\r\\n        }\\r\\n    }\\r\\n    else {\\r\\n        if (prevMatch.homeGoals > prevMatch.awayGoals) {\\r\\n            return prevMatch.homeTeam;\\r\\n        }\\r\\n        else {\\r\\n            return prevMatch.awayTeam;\\r\\n        }\\r\\n    }\\r\\n}\\r\\nexport let data, currentMatchday, team, showBadge, toAlias, toInitials, switchTeam;\\r\\n</script>\\r\\n\\r\\n{#if data != undefined}\\r\\n  {#if data.upcoming[team].nextTeam == null}\\r\\n    <div class=\\\"next-game-prediction\\\">\\r\\n      <div class=\\\"next-game-season-complete\\\">\\r\\n        <h1 class=\\\"next-game-title-text\\\">\\r\\n          {data._id}/{data._id + 1} SEASON COMPLETE\\r\\n        </h1>\\r\\n      </div>\\r\\n    </div>\\r\\n  {:else}\\r\\n    <div class=\\\"next-game-prediction\\\">\\r\\n      <div class=\\\"next-game-title\\\">\\r\\n        <h1 class=\\\"next-game-title-text\\\">\\r\\n          Next Game:&nbsp\\r\\n          <button\\r\\n            on:click={() => {\\r\\n              switchTeam(\\r\\n                data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, \\\"-\\\")\\r\\n              );\\r\\n            }}\\r\\n            class=\\\"next-game-team-btn\\\"\\r\\n            >{toAlias(data.upcoming[team].nextTeam)}&nbsp</button\\r\\n          >\\r\\n          ({data.upcoming[team].atHome ? \\\"Home\\\" : \\\"Away\\\"})\\r\\n        </h1>\\r\\n      </div>\\r\\n\\r\\n      <div class=\\\"next-game-values\\\">\\r\\n        <div class=\\\"predictions-and-logo\\\">\\r\\n          {#if showBadge}\\r\\n            <div\\r\\n              class=\\\"next-game-logo opposition-badge\\\"\\r\\n              style=\\\"background-image: url('{data.logoURLs[\\r\\n                data.upcoming[team].nextTeam\\r\\n              ]}')\\\"\\r\\n            />\\r\\n          {:else}\\r\\n            <div class=\\\"next-game-position\\\" />\\r\\n          {/if}\\r\\n          <div class=\\\"predictions\\\">\\r\\n            <div class=\\\"next-game-item\\\">\\r\\n              <div class=\\\"next-game-position\\\">\\r\\n                {data.standings[data.upcoming[team].nextTeam][data._id]\\r\\n                  .position}<span class=\\\"ordinal-position\\\"\\r\\n                  >{ordinal(\\r\\n                    data.standings[data.upcoming[team].nextTeam][data._id]\\r\\n                      .position\\r\\n                  )}</span\\r\\n                >\\r\\n              </div>\\r\\n            </div>\\r\\n            <div class=\\\"next-game-item current-form\\\">\\r\\n              Current form:\\r\\n              {#if currentMatchday != null}\\r\\n                <span class=\\\"current-form-value\\\"\\r\\n                  >{(\\r\\n                    data.form[data.upcoming[team].nextTeam][data._id][\\r\\n                      currentMatchday\\r\\n                    ].formRating5 * 100\\r\\n                  ).toFixed(1)}%</span\\r\\n                >\\r\\n              {:else}\\r\\n                None\\r\\n              {/if}\\r\\n            </div>\\r\\n            <div class=\\\"next-game-item\\\">\\r\\n              Score prediction\\r\\n              <br />\\r\\n              <a class=\\\"predictions-link\\\" href=\\\"/predictions\\\">\\r\\n                <b\\r\\n                  >{Math.round(data.upcoming[team].prediction.homeGoals)} - {Math.round(\\r\\n                    data.upcoming[team].prediction.awayGoals\\r\\n                  )}</b\\r\\n                >\\r\\n              </a>\\r\\n              <br />\\r\\n            </div>\\r\\n          </div>\\r\\n        </div>\\r\\n        <div class=\\\"past-results\\\">\\r\\n          {#if data.upcoming[team].prevMatches.length == 0}\\r\\n            <div class=\\\"next-game-item prev-results-title no-prev-results\\\">\\r\\n              No Previous Results\\r\\n            </div>\\r\\n          {:else}\\r\\n            <div class=\\\"next-game-item prev-results-title\\\">\\r\\n              Previous Results\\r\\n            </div>\\r\\n          {/if}\\r\\n\\r\\n          <!-- Display table of previous results against the next team this team is playing -->\\r\\n          {#each data.upcoming[team].prevMatches as prevMatch}\\r\\n            <div class=\\\"next-game-item-container\\\">\\r\\n              <div class=\\\"past-result-date result-details\\\">\\r\\n                {new Date(prevMatch.date).toLocaleDateString(\\\"en-GB\\\", {\\r\\n                  year: \\\"numeric\\\",\\r\\n                  month: \\\"short\\\",\\r\\n                  day: \\\"numeric\\\",\\r\\n                })}\\r\\n              </div>\\r\\n              <div class=\\\"next-game-item result-details\\\">\\r\\n                <div class=\\\"past-result\\\">\\r\\n                  <div class=\\\"left-side\\\">\\r\\n                    <div\\r\\n                      class=\\\"home-team\\\"\\r\\n                      style=\\\"background: var(--{prevMatch.homeTeam\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}); color: var(--{prevMatch.homeTeam\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}-secondary)\\\"\\r\\n                    >\\r\\n                      {toInitials(prevMatch.homeTeam)}\\r\\n                    </div>\\r\\n                    <div class=\\\"goals-container\\\"\\r\\n                      style=\\\"background: var(--{\\r\\n                        resultColour(prevMatch, true)\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}); color: var(--{resultColour(prevMatch, true)\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}-secondary)\\\">\\r\\n                      <div class=\\\"home-goals\\\">\\r\\n                        {prevMatch.homeGoals}\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                  <div class=\\\"right-side\\\">\\r\\n                    <div class=\\\"goals-container\\\"\\r\\n                        style=\\\"background: var(--{\\r\\n                        resultColour(prevMatch, false)\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}); color: var(--{resultColour(prevMatch, false)\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}-secondary)\\\">\\r\\n                      <div class=\\\"away-goals\\\">\\r\\n                        {prevMatch.awayGoals}\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div\\r\\n                      class=\\\"away-team\\\"\\r\\n                      style=\\\"background: var(--{prevMatch.awayTeam\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}); color: var(--{prevMatch.awayTeam\\r\\n                        .toLowerCase()\\r\\n                        .replace(/ /g, '-')}-secondary)\\\"\\r\\n                    >\\r\\n                      {toInitials(prevMatch.awayTeam)}\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div style=\\\"clear: both\\\" />\\r\\n              </div>\\r\\n            </div>\\r\\n          {/each}\\r\\n        </div>\\r\\n      </div>\\r\\n    </div>\\r\\n  {/if}\\r\\n{/if}\\r\\n\\r\\n<style scoped>\\r\\n  .left-side,\\r\\n  .right-side {\\r\\n    display: flex;\\r\\n    flex: 1;\\r\\n  }\\r\\n\\r\\n  .goals-container {\\r\\n    flex-grow: 1;\\r\\n  }\\r\\n\\r\\n  .away-goals,\\r\\n  .home-goals {\\r\\n    margin: 4px 0;\\r\\n  }\\r\\n  .home-goals {\\r\\n    text-align: right;\\r\\n    padding-right: 0.5em;\\r\\n    border-right: 1px solid black;\\r\\n  }\\r\\n  .away-goals {\\r\\n    text-align: left;\\r\\n    padding-left: 0.5em;\\r\\n    border-left: 1px solid black;\\r\\n  }\\r\\n\\r\\n  .next-game-title {\\r\\n    width: max-content;\\r\\n    padding: 6px 20px;\\r\\n    border-radius: 0 0 var(--border-radius) 0;\\r\\n    background: #38003d;\\r\\n    margin: -1px 0 0 -1px; /* To avoid top and left gap when zooming out */\\r\\n  }\\r\\n\\r\\n  .next-game-season-complete {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    background: #f3f3f3;\\r\\n    border: rgb(181, 181, 181) solid 5px;\\r\\n    border-radius: var(--border-radius);\\r\\n    height: 98%;\\r\\n  }\\r\\n\\r\\n  .next-game-title-text {\\r\\n    margin: 0;\\r\\n    color: white;\\r\\n    display: flex;\\r\\n  }\\r\\n  .next-game-team-btn {\\r\\n    color: #00fe87 !important;\\r\\n  }\\r\\n  .next-game-logo {\\r\\n    height: 225px;\\r\\n    margin: 10px;\\r\\n    background-repeat: no-repeat;\\r\\n    background-size: contain;\\r\\n    background-position: center;\\r\\n  }\\r\\n\\r\\n  .predictions-and-logo {\\r\\n    font-size: 1.4em;\\r\\n    width: 45%;\\r\\n    margin: auto;\\r\\n  }\\r\\n\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n  }\\r\\n\\r\\n  .predictions-link {\\r\\n    text-decoration: none;\\r\\n    color: #333;\\r\\n  }\\r\\n\\r\\n  .predictions-link:hover {\\r\\n    color: rgb(120 120 120);\\r\\n  }\\r\\n\\r\\n  .past-results {\\r\\n    font-size: 22px;\\r\\n    width: 55%;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    padding: 15px 20px 10px;\\r\\n    border-radius: 6px;\\r\\n    /* background: rgba(255, 255, 255, 0.6); */\\r\\n    margin: auto 0;\\r\\n    /* background: var(--purple); */\\r\\n  }\\r\\n\\r\\n  .next-game-prediction {\\r\\n    border-radius: var(--border-radius);\\r\\n    min-height: 97.5%;\\r\\n    border: 6px solid #38003d;\\r\\n    /* background: linear-gradient(45deg, #00fe87, #03efff) */\\r\\n  }\\r\\n\\r\\n  .next-game-values {\\r\\n    display: flex;\\r\\n    /* margin-top: 1em; */\\r\\n    margin-right: 2vw;\\r\\n    min-height: 387px;\\r\\n  }\\r\\n\\r\\n  .next-game-position {\\r\\n    font-size: 3.3em;\\r\\n    font-weight: 700;\\r\\n  }\\r\\n  .ordinal-position {\\r\\n    font-size: 0.6em;\\r\\n  }\\r\\n\\r\\n  .past-result {\\r\\n    font-size: 15px;\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  .past-result-date {\\r\\n    font-size: 13px;\\r\\n    /* color: #333; */\\r\\n    width: 90px;\\r\\n    margin: 5px auto 2px;\\r\\n    padding-top: 3px;\\r\\n    border-radius: 4px 4px 0 0;\\r\\n  }\\r\\n\\r\\n  .prev-results-title {\\r\\n    font-weight: 700;\\r\\n    padding-top: 0;\\r\\n    margin: 0 !important;\\r\\n    /* color: white; */\\r\\n  }\\r\\n  .no-prev-results {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    color: rgb(181, 181, 181);\\r\\n    color: rgba(0, 0, 0, 0.35);\\r\\n    border-radius: var(--border-radius);\\r\\n    /* background: var(--purple); */\\r\\n    padding: 100px 0;\\r\\n    color: white;\\r\\n  }\\r\\n  .next-game-item {\\r\\n    border-radius: 9px;\\r\\n  }\\r\\n\\r\\n  /* .result-details {\\r\\n    background: #f0fefd;\\r\\n  } */\\r\\n\\r\\n  .home-team {\\r\\n    float: left;\\r\\n    text-align: left;\\r\\n    border-radius: var(--border-radius) 0 0 var(--border-radius);\\r\\n  }\\r\\n\\r\\n  .away-team {\\r\\n    float: left;\\r\\n    text-align: right;\\r\\n    border-radius: 0 var(--border-radius) var(--border-radius) 0;\\r\\n  }\\r\\n\\r\\n  .home-team,\\r\\n  .away-team {\\r\\n    font-size: 15px;\\r\\n    width: calc(50% - 18px);\\r\\n    padding: 5px 0 3px;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .next-game-team-btn {\\r\\n    color: inherit;\\r\\n    text-align: left;\\r\\n  }\\r\\n\\r\\n  .current-form {\\r\\n    border-radius: 6px;\\r\\n    padding: 10px 15px;\\r\\n    color: white;\\r\\n    background: #38003d;\\r\\n    width: fit-content;\\r\\n    margin: auto auto 10px;\\r\\n  }\\r\\n  .current-form-value {\\r\\n    color: #00fe87;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 50px 20px 40px;\\r\\n    }\\r\\n    .next-game-values {\\r\\n      margin: 2% 3vw 2% 0;\\r\\n      min-height: auto;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 50px 75px 40px;\\r\\n    }\\r\\n\\r\\n    /* Change next game to column orientation */\\r\\n    .next-game-values {\\r\\n      flex-direction: column;\\r\\n      margin: 20px 15px 15px;\\r\\n    }\\r\\n\\r\\n    .predictions-and-logo {\\r\\n      margin: 0 auto;\\r\\n      width: 100%;\\r\\n    }\\r\\n\\r\\n    .past-results {\\r\\n      margin: 30px auto 0;\\r\\n      width: 94%;\\r\\n      padding: 10px;\\r\\n    }\\r\\n\\r\\n    .next-game-prediction {\\r\\n      padding-bottom: 0;\\r\\n    }\\r\\n    .next-game-title-text {\\r\\n      flex-direction: column;\\r\\n      text-align: left;\\r\\n    }\\r\\n\\r\\n    .next-game-title {\\r\\n      padding: 6px 15px;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .next-game-prediction {\\r\\n      margin: 40px 20px;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .next-game-title {\\r\\n      padding: 6px 15px 7px 12px;\\r\\n    }\\r\\n    .next-game-values {\\r\\n      margin: 25px 10px 10px;\\r\\n      font-size: 0.85em;\\r\\n    }\\r\\n    .next-game-prediction {\\r\\n      margin: 40px 14px;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

function ordinal(n) {
	let ord = [,"st", "nd", "rd"];
	let a = n % 100;
	return ord[a > 20 ? a % 10 : a] || "th";
}

function resultColour(prevMatch, home) {
	if (home) {
		if (prevMatch.homeGoals < prevMatch.awayGoals) {
			return prevMatch.awayTeam;
		} else {
			return prevMatch.homeTeam;
		}
	} else {
		if (prevMatch.homeGoals > prevMatch.awayGoals) {
			return prevMatch.homeTeam;
		} else {
			return prevMatch.awayTeam;
		}
	}
}

const NextGame = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { data, currentMatchday, team, showBadge, toAlias, toInitials, switchTeam } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.showBadge === void 0 && $$bindings.showBadge && showBadge !== void 0) $$bindings.showBadge(showBadge);
	if ($$props.toAlias === void 0 && $$bindings.toAlias && toAlias !== void 0) $$bindings.toAlias(toAlias);
	if ($$props.toInitials === void 0 && $$bindings.toInitials && toInitials !== void 0) $$bindings.toInitials(toInitials);
	if ($$props.switchTeam === void 0 && $$bindings.switchTeam && switchTeam !== void 0) $$bindings.switchTeam(switchTeam);
	$$result.css.add(css$6);

	return `${data != undefined
	? `${data.upcoming[team].nextTeam == null
		? `<div class="${"next-game-prediction svelte-yed2u9"}"><div class="${"next-game-season-complete svelte-yed2u9"}"><h1 class="${"next-game-title-text svelte-yed2u9"}">${escape(data._id)}/${escape(data._id + 1)} SEASON COMPLETE
        </h1></div></div>`
		: `<div class="${"next-game-prediction svelte-yed2u9"}"><div class="${"next-game-title svelte-yed2u9"}"><h1 class="${"next-game-title-text svelte-yed2u9"}">Next Game: 
          <button class="${"next-game-team-btn svelte-yed2u9"}">${escape(toAlias(data.upcoming[team].nextTeam))} </button>
          (${escape(data.upcoming[team].atHome ? "Home" : "Away")})
        </h1></div>

      <div class="${"next-game-values svelte-yed2u9"}"><div class="${"predictions-and-logo svelte-yed2u9"}">${showBadge
			? `<div class="${"next-game-logo opposition-badge svelte-yed2u9"}" style="${"background-image: url('" + escape(data.logoURLs[data.upcoming[team].nextTeam], true) + "')"}"></div>`
			: `<div class="${"next-game-position svelte-yed2u9"}"></div>`}
          <div class="${"predictions"}"><div class="${"next-game-item svelte-yed2u9"}"><div class="${"next-game-position svelte-yed2u9"}">${escape(data.standings[data.upcoming[team].nextTeam][data._id].position)}<span class="${"ordinal-position svelte-yed2u9"}">${escape(ordinal(data.standings[data.upcoming[team].nextTeam][data._id].position))}</span></div></div>
            <div class="${"next-game-item current-form svelte-yed2u9"}">Current form:
              ${currentMatchday != null
			? `<span class="${"current-form-value svelte-yed2u9"}">${escape((data.form[data.upcoming[team].nextTeam][data._id][currentMatchday].formRating5 * 100).toFixed(1))}%</span>`
			: `None`}</div>
            <div class="${"next-game-item svelte-yed2u9"}">Score prediction
              <br>
              <a class="${"predictions-link svelte-yed2u9"}" href="${"/predictions"}"><b>${escape(Math.round(data.upcoming[team].prediction.homeGoals))} - ${escape(Math.round(data.upcoming[team].prediction.awayGoals))}</b></a>
              <br></div></div></div>
        <div class="${"past-results svelte-yed2u9"}">${data.upcoming[team].prevMatches.length == 0
			? `<div class="${"next-game-item prev-results-title no-prev-results svelte-yed2u9"}">No Previous Results
            </div>`
			: `<div class="${"next-game-item prev-results-title svelte-yed2u9"}">Previous Results
            </div>`}

          
          ${each(data.upcoming[team].prevMatches, prevMatch => {
				return `<div class="${"next-game-item-container"}"><div class="${"past-result-date result-details svelte-yed2u9"}">${escape(new Date(prevMatch.date).toLocaleDateString("en-GB", {
					year: "numeric",
					month: "short",
					day: "numeric"
				}))}</div>
              <div class="${"next-game-item result-details svelte-yed2u9"}"><div class="${"past-result svelte-yed2u9"}"><div class="${"left-side svelte-yed2u9"}"><div class="${"home-team svelte-yed2u9"}" style="${"background: var(--" + escape(prevMatch.homeTeam.toLowerCase().replace(/ /g, '-'), true) + "); color: var(--" + escape(prevMatch.homeTeam.toLowerCase().replace(/ /g, '-'), true) + "-secondary)"}">${escape(toInitials(prevMatch.homeTeam))}</div>
                    <div class="${"goals-container svelte-yed2u9"}" style="${"background: var(--" + escape(resultColour(prevMatch, true).toLowerCase().replace(/ /g, '-'), true) + "); color: var(--" + escape(resultColour(prevMatch, true).toLowerCase().replace(/ /g, '-'), true) + "-secondary)"}"><div class="${"home-goals svelte-yed2u9"}">${escape(prevMatch.homeGoals)}</div>
                    </div></div>
                  <div class="${"right-side svelte-yed2u9"}"><div class="${"goals-container svelte-yed2u9"}" style="${"background: var(--" + escape(resultColour(prevMatch, false).toLowerCase().replace(/ /g, '-'), true) + "); color: var(--" + escape(resultColour(prevMatch, false).toLowerCase().replace(/ /g, '-'), true) + "-secondary)"}"><div class="${"away-goals svelte-yed2u9"}">${escape(prevMatch.awayGoals)}
                      </div></div>
                    <div class="${"away-team svelte-yed2u9"}" style="${"background: var(--" + escape(prevMatch.awayTeam.toLowerCase().replace(/ /g, '-'), true) + "); color: var(--" + escape(prevMatch.awayTeam.toLowerCase().replace(/ /g, '-'), true) + "-secondary)"}">${escape(toInitials(prevMatch.awayTeam))}</div>
                  </div></div>
                <div style="${"clear: both"}"></div></div>
            </div>`;
			})}</div></div></div>`}`
	: ``}`;
});

/* src\components\FixturesGraph.svelte generated by Svelte v3.49.0 */

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
		//@ts-ignore
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
			colorscale: [[0, "#00fe87"], [0.5, "#f3f3f3"], [1, "#f83027"]],
			color: y,
			opacity: 1,
			line: { width: 1 }
		},
		customdata: matchdays,
		hovertemplate: "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>"
	};
}

function nowLine(now, maxX) {
	let nowLine = {};

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

function defaultLayout(x, now) {
	let yLabels = Array.from(Array(11), (_, i) => i * 10);
	let [minX, maxX] = xRange(x);

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
		//@ts-ignore
		shapes: [nowLine(now, maxX)],
		dragmode: false
	};
}

function buildPlotData(data, team) {
	// Build data to create a fixtures line graph displaying the date along the
	// x-axis and opponent strength along the y-axis
	let now = Date.now();

	let l = line(data, team, now);

	let plotData = {
		data: [l],
		layout: defaultLayout(l.x, now),
		config: {
			responsive: true,
			showSendToCloud: false,
			displayModeBar: false
		}
	};

	return plotData;
}

const FixturesGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
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
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\FormOverTimeGraph.svelte generated by Svelte v3.49.0 */

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
		let teamKey = team[0].toLowerCase() + team.slice(1);

		teamKey = teamKey.replace(/ /g, "-").toLowerCase();
		let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
		lineVal = { color: lineColor, width: 4 };
	} else {
		lineVal = { color: "#d3d3d3" };
	}

	let line = {
		x: playedDates,
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

const FormOverTimeGraph = create_ssr_component(($$result, $$props, $$bindings, slots) => {
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
				linecolor: "black",
				showgrid: false,
				showline: false,
				fixedrange: true,
				range: [playedMatchdays[0], playedMatchdays[playedMatchdays.length - 1]]
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
	}

	function refreshPlot() {
		if (setup) {
			let newPlotData = buildPlotData(data, team);

			for (let i = 0; i < 20; i++) {
				plotData.data[i] = newPlotData.data[i];
			}

			plotData.layout.xaxis.range[0] = playedMatchdays[0];
			plotData.layout.xaxis.range[1] = playedMatchdays[playedMatchdays.length - 1];

			//@ts-ignore
			Plotly.redraw(plotDiv);

			if (mobileView) {
				setMobileLayout();
			}
		}
	}

	let { data, team, playedMatchdays, mobileView } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.playedMatchdays === void 0 && $$bindings.playedMatchdays && playedMatchdays !== void 0) $$bindings.playedMatchdays(playedMatchdays);
	if ($$props.mobileView === void 0 && $$bindings.mobileView && mobileView !== void 0) $$bindings.mobileView(mobileView);
	team && refreshPlot();
	!mobileView && setDefaultLayout();
	setup && mobileView && setMobileLayout();
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\nav\Nav.svelte generated by Svelte v3.49.0 */

const css$5 = {
	code: ".title.svelte-14nmjz0{color:white;font-size:1.6em;height:96px;display:grid;place-items:center}.no-selection.svelte-14nmjz0{user-select:none;-webkit-user-select:none;-moz-user-select:none}.team-links.svelte-14nmjz0{font-size:1em;color:white;display:grid}button.svelte-14nmjz0{background:none;color:inherit;border:none;padding:0;font:inherit;cursor:pointer;outline:inherit;text-align:left}.this-team-name.svelte-14nmjz0,.team-name.svelte-14nmjz0{padding:0.4em 1em;color:#c600d8}:hover.team-name.svelte-14nmjz0{background:#2c002f}nav.svelte-14nmjz0{position:fixed;width:220px;height:100vh;background:#37003c;background:#38003d}.close-btn.svelte-14nmjz0{position:absolute;right:0.9em;bottom:0.6em;background:transparent;border:none;outline:none;padding-top:0.3em;cursor:pointer}.placeholder.svelte-14nmjz0{height:19px;margin:6px 15px;width:40px;background:#c600d8;border-radius:4px;opacity:0.25;position:relative;overflow:hidden}.placeholder.svelte-14nmjz0::before{content:'';display:block;position:absolute;left:-100px;top:0;height:100%;width:150px;background:linear-gradient(to right, transparent 0%, #E8E8E8 50%, transparent 100%);background:linear-gradient(to right, transparent 0%, #eea7f4 50%, transparent 100%);animation:svelte-14nmjz0-load 1s cubic-bezier(0.4, 0.0, 0.2, 1) infinite}@keyframes svelte-14nmjz0-load{from{left:-100px}to{left:100px}}@media only screen and (max-width: 1300px){#navBar.svelte-14nmjz0{display:none}}",
	map: "{\"version\":3,\"file\":\"Nav.svelte\",\"sources\":[\"Nav.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function closeNavBar() {\\r\\n    document.getElementById(\\\"navBar\\\").style.display = \\\"none\\\";\\r\\n    document.getElementById(\\\"dashboard\\\").style.marginLeft = \\\"0\\\";\\r\\n    window.dispatchEvent(new Event(\\\"resize\\\")); // Snap plotly graphs to new width\\r\\n}\\r\\nfunction openNavBar() {\\r\\n    document.getElementById(\\\"navBar\\\").style.display = \\\"block\\\";\\r\\n    document.getElementById(\\\"dashboard\\\").style.marginLeft = \\\"200px\\\";\\r\\n}\\r\\nlet widths = [];\\r\\nfor (let i = 0; i < 20; i++) {\\r\\n    widths.push(35 + (Math.floor(Math.random() * 8) * 5));\\r\\n}\\r\\nexport let team, teams, toAlias, switchTeam;\\r\\n</script>\\r\\n\\r\\n<nav id=\\\"navBar\\\">\\r\\n  <div class=\\\"title no-selection\\\">\\r\\n    <p>\\r\\n      <span style=\\\"color: #00fe87\\\">pl</span>dashboard\\r\\n    </p>\\r\\n  </div>\\r\\n  <div class=\\\"team-links\\\">\\r\\n      {#if teams.length == 0}\\r\\n        {#each widths as width, _}\\r\\n          <div class=\\\"placeholder\\\" style=\\\"width: {width}%\\\"></div>\\r\\n        {/each}\\r\\n      {:else}\\r\\n        {#each teams as _team, _ (_team)}\\r\\n          {#if _team.toLowerCase().replace(/ /g, \\\"-\\\") == team}\\r\\n            <a href=\\\"/{_team.toLowerCase().replace(/ /g, '-')}\\\" class=\\\"team-link\\\">\\r\\n              <div\\r\\n                class=\\\"this-team-name\\\"\\r\\n                style=\\\"color: var(--{_team\\r\\n                  .toLowerCase()\\r\\n                  .replace(/ /g, '-')}-secondary);\\r\\n                  background-color: var(--{_team.toLowerCase().replace(/ /g, '-')})\\\"\\r\\n              >\\r\\n                {toAlias(_team)}\\r\\n              </div>\\r\\n            </a>\\r\\n          {:else}\\r\\n            <button\\r\\n              class=\\\"team-link\\\"\\r\\n              on:click={() => {\\r\\n                switchTeam(_team.toLowerCase().replace(/ /g, \\\"-\\\"));\\r\\n              }}\\r\\n            >\\r\\n              <div class=\\\"team-name\\\">\\r\\n                {toAlias(_team)}\\r\\n              </div>\\r\\n            </button>\\r\\n          {/if}\\r\\n        {/each}\\r\\n      {/if}\\r\\n    </div>\\r\\n    <div class=\\\"close\\\">\\r\\n    <button class=\\\"close-btn\\\" on:click={closeNavBar}>\\r\\n      <img src=\\\"img/arrow-bar-left.svg\\\" alt=\\\"\\\" />\\r\\n    </button>\\r\\n  </div>\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  .title {\\r\\n    color: white;\\r\\n    font-size: 1.6em;\\r\\n    height: 96px;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .no-selection {\\r\\n    user-select: none;\\r\\n    -webkit-user-select: none;\\r\\n    -moz-user-select: none;\\r\\n  }\\r\\n  .team-links {\\r\\n    font-size: 1em;\\r\\n    color: white;\\r\\n    display: grid;\\r\\n  }\\r\\n  button {\\r\\n    background: none;\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    padding: 0;\\r\\n    font: inherit;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n    text-align: left;\\r\\n  }\\r\\n  .this-team-name,\\r\\n  .team-name {\\r\\n    padding: 0.4em 1em;\\r\\n    color: #c600d8;\\r\\n  }\\r\\n  :hover.team-name {\\r\\n    background: #2c002f;\\r\\n  }\\r\\n  nav {\\r\\n    position: fixed;\\r\\n    width: 220px;\\r\\n    height: 100vh;\\r\\n    background: #37003c;\\r\\n    background: #38003d;\\r\\n  }\\r\\n  .close-btn {\\r\\n    position: absolute;\\r\\n    right: 0.9em;\\r\\n    bottom: 0.6em;\\r\\n    background: transparent;\\r\\n    border: none;\\r\\n    outline: none;\\r\\n    padding-top: 0.3em;\\r\\n    cursor: pointer;\\r\\n  }\\r\\n\\r\\n  .placeholder {\\r\\n    height: 19px;\\r\\n    margin: 6px 15px;\\r\\n    width: 40px;\\r\\n    background: #c600d8;\\r\\n    border-radius: 4px;\\r\\n    opacity: 0.25;\\r\\n    position: relative;\\r\\n    overflow: hidden;\\r\\n  }\\r\\n\\r\\n  .placeholder::before {\\r\\n    content: '';\\r\\n    display: block;\\r\\n    position: absolute;\\r\\n    left: -100px;\\r\\n    top: 0;\\r\\n    height: 100%;\\r\\n    width: 150px;\\r\\n    background: linear-gradient(to right, transparent 0%, #E8E8E8 50%, transparent 100%);\\r\\n    background: linear-gradient(to right, transparent 0%, #eea7f4 50%, transparent 100%);\\r\\n    animation: load 1s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;\\r\\n}\\r\\n@keyframes load {\\r\\n    from {\\r\\n        left: -100px;\\r\\n    }\\r\\n    to   {\\r\\n        left: 100px;\\r\\n    }\\r\\n}\\r\\n\\r\\n  @media only screen and (max-width: 1300px) {\\r\\n    #navBar {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAgEE,MAAM,eAAC,CAAC,AACN,KAAK,CAAE,KAAK,CACZ,SAAS,CAAE,KAAK,CAChB,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,AACrB,CAAC,AACD,aAAa,eAAC,CAAC,AACb,WAAW,CAAE,IAAI,CACjB,mBAAmB,CAAE,IAAI,CACzB,gBAAgB,CAAE,IAAI,AACxB,CAAC,AACD,WAAW,eAAC,CAAC,AACX,SAAS,CAAE,GAAG,CACd,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,IAAI,AACf,CAAC,AACD,MAAM,eAAC,CAAC,AACN,UAAU,CAAE,IAAI,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CACV,IAAI,CAAE,OAAO,CACb,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,OAAO,CAChB,UAAU,CAAE,IAAI,AAClB,CAAC,AACD,8BAAe,CACf,UAAU,eAAC,CAAC,AACV,OAAO,CAAE,KAAK,CAAC,GAAG,CAClB,KAAK,CAAE,OAAO,AAChB,CAAC,AACD,MAAM,UAAU,eAAC,CAAC,AAChB,UAAU,CAAE,OAAO,AACrB,CAAC,AACD,GAAG,eAAC,CAAC,AACH,QAAQ,CAAE,KAAK,CACf,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,OAAO,CACnB,UAAU,CAAE,OAAO,AACrB,CAAC,AACD,UAAU,eAAC,CAAC,AACV,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,UAAU,CAAE,WAAW,CACvB,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,KAAK,CAClB,MAAM,CAAE,OAAO,AACjB,CAAC,AAED,YAAY,eAAC,CAAC,AACZ,MAAM,CAAE,IAAI,CACZ,MAAM,CAAE,GAAG,CAAC,IAAI,CAChB,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,OAAO,CACnB,aAAa,CAAE,GAAG,CAClB,OAAO,CAAE,IAAI,CACb,QAAQ,CAAE,QAAQ,CAClB,QAAQ,CAAE,MAAM,AAClB,CAAC,AAED,2BAAY,QAAQ,AAAC,CAAC,AACpB,OAAO,CAAE,EAAE,CACX,OAAO,CAAE,KAAK,CACd,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,MAAM,CACZ,GAAG,CAAE,CAAC,CACN,MAAM,CAAE,IAAI,CACZ,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE,gBAAgB,EAAE,CAAC,KAAK,CAAC,CAAC,WAAW,CAAC,EAAE,CAAC,CAAC,OAAO,CAAC,GAAG,CAAC,CAAC,WAAW,CAAC,IAAI,CAAC,CACpF,UAAU,CAAE,gBAAgB,EAAE,CAAC,KAAK,CAAC,CAAC,WAAW,CAAC,EAAE,CAAC,CAAC,OAAO,CAAC,GAAG,CAAC,CAAC,WAAW,CAAC,IAAI,CAAC,CACpF,SAAS,CAAE,mBAAI,CAAC,EAAE,CAAC,aAAa,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC,CAAC,QAAQ,AAC9D,CAAC,AACD,WAAW,mBAAK,CAAC,AACb,IAAI,AAAC,CAAC,AACF,IAAI,CAAE,MAAM,AAChB,CAAC,AACD,EAAE,AAAG,CAAC,AACF,IAAI,CAAE,KAAK,AACf,CAAC,AACL,CAAC,AAEC,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,MAAM,CAAC,AAAC,CAAC,AAC1C,OAAO,eAAC,CAAC,AACP,OAAO,CAAE,IAAI,AACf,CAAC,AACH,CAAC\"}"
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
	$$result.css.add(css$5);

	return `<nav id="${"navBar"}" class="${"svelte-14nmjz0"}"><div class="${"title no-selection svelte-14nmjz0"}"><p><span style="${"color: #00fe87"}">pl</span>dashboard
    </p></div>
  <div class="${"team-links svelte-14nmjz0"}">${teams.length == 0
	? `${each(widths, (width, _) => {
			return `<div class="${"placeholder svelte-14nmjz0"}" style="${"width: " + escape(width, true) + "%"}"></div>`;
		})}`
	: `${each(teams, (_team, _) => {
			return `${_team.toLowerCase().replace(/ /g, "-") == team
			? `<a href="${"/" + escape(_team.toLowerCase().replace(/ /g, '-'), true)}" class="${"team-link"}"><div class="${"this-team-name svelte-14nmjz0"}" style="${"color: var(--" + escape(_team.toLowerCase().replace(/ /g, '-'), true) + "-secondary); background-color: var(--" + escape(_team.toLowerCase().replace(/ /g, '-'), true) + ")"}">${escape(toAlias(_team))}</div>
            </a>`
			: `<button class="${"team-link svelte-14nmjz0"}"><div class="${"team-name svelte-14nmjz0"}">${escape(toAlias(_team))}</div>
            </button>`}`;
		})}`}</div>
    <div class="${"close"}"><button class="${"close-btn svelte-14nmjz0"}"><img src="${"img/arrow-bar-left.svg"}" alt="${""}"></button></div>
</nav>`;
});

/* src\components\nav\MobileNav.svelte generated by Svelte v3.49.0 */

const css$4 = {
	code: "#mobileNav.svelte-1d401pl{position:fixed;z-index:2;overflow:hidden;height:100vh;width:0}.team-links.svelte-1d401pl{display:flex;flex-direction:column;height:100%}.team-link.svelte-1d401pl{color:inherit;background:inherit;cursor:pointer;border:none;font-size:1em;padding:0.4em;flex:1}",
	map: "{\"version\":3,\"file\":\"MobileNav.svelte\",\"sources\":[\"MobileNav.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">function switchTeamToTop(team) {\\r\\n    switchTeam(team);\\r\\n    window.scrollTo(0, 0);\\r\\n    toggleMobileNav();\\r\\n}\\r\\nfunction getHyphenatedTeamNames() {\\r\\n    let hyphenatedTeamNames = [];\\r\\n    for (let i = 0; i < teams.length; i++) {\\r\\n        let teamLink = teams[i].toLowerCase().replace(/ /g, \\\"-\\\");\\r\\n        if (teamLink != hyphenatedTeam) {\\r\\n            hyphenatedTeamNames.push(teamLink);\\r\\n        }\\r\\n        else {\\r\\n            hyphenatedTeamNames.push(null); // To keep teams and teamLinks list same length\\r\\n        }\\r\\n    }\\r\\n    hyphenatedTeams = hyphenatedTeamNames;\\r\\n}\\r\\nlet hyphenatedTeams;\\r\\n//@ts-ignore\\r\\n$: hyphenatedTeam & (teams.length > 0) & getHyphenatedTeamNames();\\r\\nexport let hyphenatedTeam, teams, toAlias, switchTeam, toggleMobileNav;\\r\\n</script>\\r\\n\\r\\n<nav id=\\\"mobileNav\\\" style=\\\"width: 0px;\\\">\\r\\n  {#if hyphenatedTeams != undefined}\\r\\n    <div class=\\\"team-links\\\">\\r\\n      {#each hyphenatedTeams as team, i}\\r\\n        {#if team != null}\\r\\n          {#if i == 0 || (i == 1 && hyphenatedTeams[0] == null)}\\r\\n            <!-- Button with first-team class -->\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(hyphenatedTeams[i]);\\r\\n              }}\\r\\n              style=\\\"color: var(--{hyphenatedTeams[i]}-secondary);\\r\\n            background-color: var(--{hyphenatedTeams[i]})\\\"\\r\\n              class=\\\"team-link first-team\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {:else if i == hyphenatedTeams.length - 1 || (i == hyphenatedTeams.length - 2 && hyphenatedTeams[hyphenatedTeams.length - 1] == null)}\\r\\n            <!-- Button with last-team class -->\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(hyphenatedTeams[i]);\\r\\n              }}\\r\\n              style=\\\"color: var(--{hyphenatedTeams[i]}-secondary);\\r\\n                background-color: var(--{hyphenatedTeams[i]})\\\"\\r\\n              class=\\\"team-link last-team\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {:else}\\r\\n            <button\\r\\n              on:click={() => {\\r\\n                switchTeamToTop(team);\\r\\n              }}\\r\\n              style=\\\"color: var(--{team}-secondary);\\r\\n                  background-color: var(--{team})\\\"\\r\\n              class=\\\"team-link\\\">{toAlias(teams[i])}</button\\r\\n            >\\r\\n          {/if}\\r\\n        {/if}\\r\\n      {/each}\\r\\n    </div>\\r\\n  {/if}\\r\\n</nav>\\r\\n\\r\\n<style scoped>\\r\\n  #mobileNav {\\r\\n    position: fixed;\\r\\n    z-index: 2;\\r\\n    overflow: hidden;\\r\\n    height: 100vh;\\r\\n    width: 0;\\r\\n  }\\r\\n  .team-links {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    height: 100%;\\r\\n  }\\r\\n  .team-link {\\r\\n    color: inherit;\\r\\n    background: inherit;\\r\\n    cursor: pointer;\\r\\n    border: none;\\r\\n    font-size: 1em;\\r\\n    padding: 0.4em;\\r\\n    flex: 1;\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAkEE,UAAU,eAAC,CAAC,AACV,QAAQ,CAAE,KAAK,CACf,OAAO,CAAE,CAAC,CACV,QAAQ,CAAE,MAAM,CAChB,MAAM,CAAE,KAAK,CACb,KAAK,CAAE,CAAC,AACV,CAAC,AACD,WAAW,eAAC,CAAC,AACX,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,IAAI,AACd,CAAC,AACD,UAAU,eAAC,CAAC,AACV,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,OAAO,CACnB,MAAM,CAAE,OAAO,CACf,MAAM,CAAE,IAAI,CACZ,SAAS,CAAE,GAAG,CACd,OAAO,CAAE,KAAK,CACd,IAAI,CAAE,CAAC,AACT,CAAC\"}"
};

const MobileNav = create_ssr_component(($$result, $$props, $$bindings, slots) => {

	function getHyphenatedTeamNames() {
		let hyphenatedTeamNames = [];

		for (let i = 0; i < teams.length; i++) {
			let teamLink = teams[i].toLowerCase().replace(/ /g, "-");

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
	$$result.css.add(css$4);
	hyphenatedTeam & teams.length > 0 & getHyphenatedTeamNames();

	return `<nav id="${"mobileNav"}" style="${"width: 0px;"}" class="${"svelte-1d401pl"}">${hyphenatedTeams != undefined
	? `<div class="${"team-links svelte-1d401pl"}">${each(hyphenatedTeams, (team, i) => {
			return `${team != null
			? `${i == 0 || i == 1 && hyphenatedTeams[0] == null
				? `
            <button style="${"color: var(--" + escape(hyphenatedTeams[i], true) + "-secondary); background-color: var(--" + escape(hyphenatedTeams[i], true) + ")"}" class="${"team-link first-team svelte-1d401pl"}">${escape(toAlias(teams[i]))}</button>`
				: `${i == hyphenatedTeams.length - 1 || i == hyphenatedTeams.length - 2 && hyphenatedTeams[hyphenatedTeams.length - 1] == null
					? `
            <button style="${"color: var(--" + escape(hyphenatedTeams[i], true) + "-secondary); background-color: var(--" + escape(hyphenatedTeams[i], true) + ")"}" class="${"team-link last-team svelte-1d401pl"}">${escape(toAlias(teams[i]))}</button>`
					: `<button style="${"color: var(--" + escape(team, true) + "-secondary); background-color: var(--" + escape(team, true) + ")"}" class="${"team-link svelte-1d401pl"}">${escape(toAlias(teams[i]))}</button>`}`}`
			: ``}`;
		})}</div>`
	: ``}
</nav>`;
});

/* src\routes\Team.svelte generated by Svelte v3.49.0 */

const css$3 = {
	code: ".header.svelte-1ao5tmf{display:grid;place-items:center}.main-link.svelte-1ao5tmf{width:fit-content;display:grid;place-items:center}.title.svelte-1ao5tmf{font-size:2.3rem;width:fit-content}.page-content.svelte-1ao5tmf{position:relative}#team.svelte-1ao5tmf{display:flex;overflow-x:hidden;font-size:15px}.position-and-badge.svelte-1ao5tmf{height:500px;background-repeat:no-repeat;background-size:auto 450px;background-position:right center}.position-no-badge.svelte-1ao5tmf{padding-left:0;margin:0;height:500px}.position-central.svelte-1ao5tmf,.position.svelte-1ao5tmf{text-shadow:9px 9px #000;font-weight:800;font-size:430px;user-select:none;max-width:500px}.position.svelte-1ao5tmf{text-align:left;margin-top:0.02em;margin-left:30px}.position-central.svelte-1ao5tmf{text-align:center;margin-top:0.1em;max-height:500px;margin-left:0.05em;font-size:20vw}.circles-background-container.svelte-1ao5tmf{position:absolute;align-self:center;width:500px;z-index:-10}.circles-background.svelte-1ao5tmf{height:500px;width:500px;transform:scale(0.95)}#dashboard.svelte-1ao5tmf{margin-left:220px;width:100%}.fixtures-graph.svelte-1ao5tmf{display:flex;flex-direction:column}.clean-sheets.svelte-1ao5tmf{height:60px}.no-bottom-margin.svelte-1ao5tmf{margin-bottom:0 !important}.small-bottom-margin.svelte-1ao5tmf{margin-bottom:1.5rem !important}.page-content.svelte-1ao5tmf{display:flex;flex-direction:column;text-align:center}.row.svelte-1ao5tmf{position:relative;display:flex;margin-bottom:3rem;height:auto}.row-graph.svelte-1ao5tmf{width:100%}.score-freq.svelte-1ao5tmf{margin:0 8% 0 8%}.row-left.svelte-1ao5tmf{display:flex;flex-direction:column;padding-right:auto;margin-right:1.4em;text-justify:center;flex:4}.row-right.svelte-1ao5tmf{flex:10}.multi-element-row.svelte-1ao5tmf{margin:0 1.4em 3rem}.spider-chart-row.svelte-1ao5tmf{display:grid;place-items:center}.spider-chart-container.svelte-1ao5tmf{margin:1em auto auto;display:flex}#mobileNavBtn.svelte-1ao5tmf{position:fixed;color:white;background:#38003d;padding:0.8em 0;cursor:pointer;font-size:1.1em;z-index:1;width:100%;bottom:0;border:none;margin-bottom:-1px}@media only screen and (min-width: 2400px){.position-central.svelte-1ao5tmf{font-size:16vw}}@media only screen and (min-width: 2200px){.position-central.svelte-1ao5tmf{font-size:18vw}}@media only screen and (min-width: 2000px){.position-central.svelte-1ao5tmf{font-size:20vw}}@media only screen and (max-width: 1800px){.circles-background.svelte-1ao5tmf{transform:scale(0.9)}.position-central.svelte-1ao5tmf{font-size:20vw;margin-top:0.2em}}@media only screen and (max-width: 1600px){.row-left.svelte-1ao5tmf{flex:5}.circles-background.svelte-1ao5tmf{transform:scale(0.85)}}@media only screen and (max-width: 1500px){.circles-background.svelte-1ao5tmf{transform:scale(0.8)}.position-central.svelte-1ao5tmf{font-size:22vw}}@media only screen and (max-width: 1400px){.circles-background.svelte-1ao5tmf{transform:scale(0.75)}.position-central.svelte-1ao5tmf{margin-top:0.25em}}@media only screen and (max-width: 1300px){.circles-background.svelte-1ao5tmf{transform:scale(0.7)}#dashboard.svelte-1ao5tmf{margin-left:0}.position-central.svelte-1ao5tmf{font-size:24vw}}@media only screen and (min-width: 1300px){#mobileNavBtn.svelte-1ao5tmf{display:none}}@media only screen and (max-width: 1200px){.position-central.svelte-1ao5tmf{margin-top:0.3em}}@media only screen and (min-width: 1100px){.full-row-graph.svelte-1ao5tmf{margin:0 1em}}@media only screen and (max-width: 1100px){.row.svelte-1ao5tmf{flex-direction:column;margin-bottom:40px}.row-graph.svelte-1ao5tmf{width:auto}.score-freq.svelte-1ao5tmf{margin:0 0 10px}.multi-element-row.svelte-1ao5tmf{margin:0}.row-left.svelte-1ao5tmf{margin-right:0;align-self:center}.position-and-badge.svelte-1ao5tmf{width:50%;max-width:400px;min-width:150px;padding-right:3% !important;background-size:auto 330px !important;height:400px;margin-bottom:-50px}.position-no-badge.svelte-1ao5tmf{height:400px;width:500px}.position-central.svelte-1ao5tmf{margin:auto}.circles-background.svelte-1ao5tmf{transform:scale(0.48);margin-top:-100px}.position-central.svelte-1ao5tmf,.circles-background-container.svelte-1ao5tmf{align-self:center}}@media only screen and (max-width: 1000px){.spider-chart-container.svelte-1ao5tmf{flex-direction:column;width:100%}}@media only screen and (max-width: 900px){.circles-background.svelte-1ao5tmf{transform:scale(0.45);margin-top:-120px}.position-central.svelte-1ao5tmf{font-size:25vw}}@media only screen and (max-width: 700px){.position-and-badge.svelte-1ao5tmf{width:70%}.circles-background.svelte-1ao5tmf{transform:scale(0.55);margin-top:-5em}.position-no-badge.svelte-1ao5tmf{height:330px}.position-central.svelte-1ao5tmf{font-size:250px;margin:35px 0 0 0}}@media only screen and (max-width: 800px){.circles-background.svelte-1ao5tmf{transform:scale(0.4);margin-top:-9em}.position-central.svelte-1ao5tmf{font-size:13em}.season-stats-row.svelte-1ao5tmf{margin:1em}.row-graph.svelte-1ao5tmf{margin:0}}@media only screen and (max-width: 550px){.position.svelte-1ao5tmf,.position-central.svelte-1ao5tmf{font-size:10em;text-align:center;line-height:1.55;padding-right:20px;margin:0;text-shadow:7px 7px #000}.multi-element-row.svelte-1ao5tmf{margin:0}.position-and-badge.svelte-1ao5tmf{background-size:auto 210px !important;background-position:center !important}.season-stats-row.svelte-1ao5tmf{margin:0 1em 1em}.position-no-badge.svelte-1ao5tmf,.position-and-badge.svelte-1ao5tmf{padding:0 !important;margin:0 !important;width:100%}.circles-background.svelte-1ao5tmf{transform:scale(0.35);margin-top:-9.5em}}",
	map: "{\"version\":3,\"file\":\"Team.svelte\",\"sources\":[\"Team.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from \\\"svelte-routing\\\";\\r\\nimport { onMount } from \\\"svelte\\\";\\r\\nimport CurrentForm from \\\"../components/current_form/CurrentForm.svelte\\\";\\r\\nimport TableSnippet from \\\"../components/TableSnippet.svelte\\\";\\r\\nimport NextGame from \\\"../components/NextGame.svelte\\\";\\r\\nimport StatsValues from \\\"../components/goals_scored_and_conceded/StatsValues.svelte\\\";\\r\\nimport TeamsFooter from \\\"../components/TeamsFooter.svelte\\\";\\r\\nimport FixturesGraph from \\\"../components/FixturesGraph.svelte\\\";\\r\\nimport FormOverTimeGraph from \\\"../components/FormOverTimeGraph.svelte\\\";\\r\\nimport PositionOverTimeGraph from \\\"../components/PositionOverTimeGraph.svelte\\\";\\r\\nimport GoalsScoredAndConcededGraph from \\\"../components/goals_scored_and_conceded/ScoredAndConcededGraph.svelte\\\";\\r\\nimport CleanSheetsGraph from \\\"../components/goals_scored_and_conceded/CleanSheetsGraph.svelte\\\";\\r\\nimport GoalsPerGame from \\\"../components/goals_per_game/GoalsPerGame.svelte\\\";\\r\\nimport SpiderGraph from \\\"../components/SpiderGraph.svelte\\\";\\r\\nimport ScorelineFreqGraph from \\\"../components/ScorelineFreqGraph.svelte\\\";\\r\\nimport Nav from \\\"../components/nav/Nav.svelte\\\";\\r\\nimport MobileNav from \\\"../components/nav/MobileNav.svelte\\\";\\r\\nimport ScoredConcededOverTimeGraph from \\\"../components/goals_scored_and_conceded/ScoredConcededOverTimeGraph.svelte\\\";\\r\\nlet alias = {\\r\\n    \\\"Wolverhampton Wanderers\\\": \\\"Wolves\\\",\\r\\n    \\\"Tottenham Hotspur\\\": \\\"Spurs\\\",\\r\\n    \\\"Leeds United\\\": \\\"Leeds\\\",\\r\\n    \\\"West Ham United\\\": \\\"West Ham\\\",\\r\\n    \\\"Brighton and Hove Albion\\\": \\\"Brighton\\\",\\r\\n};\\r\\nfunction toInitials(team) {\\r\\n    switch (team) {\\r\\n        case \\\"Brighton and Hove Albion\\\":\\r\\n            return \\\"BHA\\\";\\r\\n        case \\\"Manchester City\\\":\\r\\n            return \\\"MCI\\\";\\r\\n        case \\\"Manchester United\\\":\\r\\n            return \\\"MUN\\\";\\r\\n        case \\\"Aston Villa\\\":\\r\\n            return \\\"AVL\\\";\\r\\n        case \\\"Sheffield United\\\":\\r\\n            return \\\"SHU\\\";\\r\\n        case \\\"West Bromwich Albion\\\":\\r\\n            return \\\"WBA\\\";\\r\\n        case \\\"West Ham United\\\":\\r\\n            return \\\"WHU\\\";\\r\\n    }\\r\\n    return team.slice(0, 3).toUpperCase();\\r\\n}\\r\\nfunction toAlias(team) {\\r\\n    if (team in alias) {\\r\\n        return alias[team];\\r\\n    }\\r\\n    return team;\\r\\n}\\r\\nfunction toName(teamAlias) {\\r\\n    if (!Object.values(alias).includes(teamAlias)) {\\r\\n        return teamAlias;\\r\\n    }\\r\\n    return Object.keys(alias).find((key) => alias[key] === teamAlias);\\r\\n}\\r\\nfunction toggleMobileNav() {\\r\\n    let mobileNav = document.getElementById(\\\"mobileNav\\\");\\r\\n    if (mobileNav.style.width == \\\"0px\\\") {\\r\\n        mobileNav.style.animation = \\\"appear 0.1s ease-in 1\\\";\\r\\n        mobileNav.style.width = \\\"100%\\\";\\r\\n    }\\r\\n    else {\\r\\n        mobileNav.style.animation = null;\\r\\n        mobileNav.style.width = \\\"0px\\\";\\r\\n    }\\r\\n}\\r\\nfunction toTitleCase(str) {\\r\\n    return str\\r\\n        .toLowerCase()\\r\\n        .split(\\\" \\\")\\r\\n        .map(function (word) {\\r\\n        return word.charAt(0).toUpperCase() + word.slice(1);\\r\\n    })\\r\\n        .join(\\\" \\\")\\r\\n        .replace(\\\"And\\\", \\\"and\\\");\\r\\n}\\r\\nfunction getPlayedMatchdayDates(data, team) {\\r\\n    let matchdays = [];\\r\\n    for (let matchday in data.form[team][data._id]) {\\r\\n        if (data.form[team][data._id][matchday].score != null) {\\r\\n            matchdays.push(matchday);\\r\\n        }\\r\\n    }\\r\\n    // If played one or no games, take x-axis from whole season dates\\r\\n    if (matchdays.length == 0) {\\r\\n        matchdays = Object.keys(data.fixtures[team]);\\r\\n    }\\r\\n    // Find median matchday date across all teams for each matchday\\r\\n    let x = [];\\r\\n    for (let matchday of matchdays) {\\r\\n        let matchdayDates = [];\\r\\n        Object.keys(data.standings).forEach((team) => {\\r\\n            matchdayDates.push(data.fixtures[team][matchday].date);\\r\\n        });\\r\\n        matchdayDates = matchdayDates.map((val) => {\\r\\n            return new Date(val);\\r\\n        });\\r\\n        matchdayDates = matchdayDates.sort();\\r\\n        x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);\\r\\n    }\\r\\n    x.sort(function (a, b) {\\r\\n        return a - b;\\r\\n    });\\r\\n    return x;\\r\\n}\\r\\nfunction getCurrentMatchday(data, team) {\\r\\n    let currentMatchday = null;\\r\\n    if (Object.keys(data.form[team][data._id]).length > 0) {\\r\\n        // Largest matchday with score is current matchday\\r\\n        for (let matchday of Object.keys(data.form[team][data._id]).reverse()) {\\r\\n            if (data.form[team][data._id][matchday].score != null) {\\r\\n                currentMatchday = matchday;\\r\\n                break;\\r\\n            }\\r\\n        }\\r\\n    }\\r\\n    return currentMatchday;\\r\\n}\\r\\nasync function fetchData(address) {\\r\\n    const response = await fetch(address);\\r\\n    let json = await response.json();\\r\\n    return json;\\r\\n}\\r\\nfunction initDashboard() {\\r\\n    // Set formatted team name so page header can display while fetching data\\r\\n    if (hyphenatedTeam != null) {\\r\\n        team = toTitleCase(hyphenatedTeam.replace(/\\\\-/g, \\\" \\\"));\\r\\n    }\\r\\n    fetchData(\\\"https://pldashboard-backend.vercel.app/api/teams\\\")\\r\\n        .then((json) => {\\r\\n        teams = Object.keys(json.standings);\\r\\n        if (hyphenatedTeam == null) {\\r\\n            // If '/' searched, set current team to\\r\\n            team = teams[0];\\r\\n            hyphenatedTeam = team.toLowerCase().replace(/ /g, \\\"-\\\");\\r\\n            // Change url to /team-name without reloading page\\r\\n            history.pushState({}, null, window.location.href + hyphenatedTeam);\\r\\n        }\\r\\n        else {\\r\\n            // If team from url not in current season teams, 404 redirect\\r\\n            if (!teams.includes(team)) {\\r\\n                window.location.href = \\\"/error\\\";\\r\\n            }\\r\\n        }\\r\\n        currentMatchday = getCurrentMatchday(json, team);\\r\\n        playedMatchdays = getPlayedMatchdayDates(json, team);\\r\\n        data = json;\\r\\n        console.log(data);\\r\\n    })\\r\\n        .then(() => {\\r\\n        window.dispatchEvent(new Event(\\\"resize\\\"));\\r\\n    });\\r\\n}\\r\\nfunction switchTeam(newTeam) {\\r\\n    hyphenatedTeam = newTeam;\\r\\n    team = toTitleCase(hyphenatedTeam.replace(/\\\\-/g, \\\" \\\"));\\r\\n    currentMatchday = getCurrentMatchday(data, team);\\r\\n    playedMatchdays = getPlayedMatchdayDates(data, team);\\r\\n    window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading\\r\\n}\\r\\nfunction lazyLoad() {\\r\\n    load = true;\\r\\n    window.dispatchEvent(new Event(\\\"resize\\\"));\\r\\n}\\r\\nlet y;\\r\\nlet load = false;\\r\\n$: y > 30 && lazyLoad();\\r\\nlet pageWidth;\\r\\n$: mobileView = pageWidth <= 700;\\r\\nconst showBadge = false;\\r\\nlet team = \\\"\\\";\\r\\nlet teams = []; // Used for nav bar links\\r\\nlet currentMatchday, playedMatchdays;\\r\\nlet data;\\r\\nonMount(() => {\\r\\n    initDashboard();\\r\\n});\\r\\nexport let hyphenatedTeam;\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>{team}</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<svelte:window bind:innerWidth={pageWidth} bind:scrollY={y} />\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"team\\\">\\r\\n    <Nav team={hyphenatedTeam} {teams} {toAlias} {switchTeam} />\\r\\n    <MobileNav\\r\\n      {hyphenatedTeam}\\r\\n      {teams}\\r\\n      {toAlias}\\r\\n      {switchTeam}\\r\\n      {toggleMobileNav}\\r\\n    />\\r\\n    {#if teams.length == 0}\\r\\n      <!-- Navigation disabled while teams list are loading -->\\r\\n      <button id=\\\"mobileNavBtn\\\" style=\\\"cursor: default\\\"> Select Team </button>\\r\\n    {:else}\\r\\n      <button id=\\\"mobileNavBtn\\\" on:click={toggleMobileNav}>\\r\\n        Select Team\\r\\n      </button>\\r\\n    {/if}\\r\\n\\r\\n    <div id=\\\"dashboard\\\">\\r\\n      <!-- {#if teams.length != 0} -->\\r\\n      <div class=\\\"header\\\" style=\\\"background-color: var(--{hyphenatedTeam});\\\">\\r\\n        <a class=\\\"main-link no-decoration\\\" href=\\\"/{hyphenatedTeam}\\\">\\r\\n          <div\\r\\n            class=\\\"title\\\"\\r\\n            style=\\\"color: var(--{hyphenatedTeam + '-secondary'});\\\"\\r\\n          >\\r\\n            {toAlias(team)}\\r\\n          </div>\\r\\n        </a>\\r\\n      </div>\\r\\n      <!-- {/if} -->\\r\\n\\r\\n      {#if data != undefined}\\r\\n        <div class=\\\"page-content\\\">\\r\\n          <div class=\\\"row multi-element-row small-bottom-margin\\\">\\r\\n            {#if showBadge}\\r\\n              <div\\r\\n                class=\\\"row-left position-and-badge\\\"\\r\\n                style=\\\"background-image: url('{data.logoURLs[team]}')\\\"\\r\\n              >\\r\\n                <div class=\\\"position\\\">\\r\\n                  {data.standings[team][data._id].position}\\r\\n                </div>\\r\\n              </div>\\r\\n            {:else}\\r\\n              <div class=\\\"row-left position-no-badge\\\">\\r\\n                <div class=\\\"circles-background-container\\\">\\r\\n                  <svg class=\\\"circles-background\\\">\\r\\n                    <circle\\r\\n                      cx=\\\"300\\\"\\r\\n                      cy=\\\"150\\\"\\r\\n                      r=\\\"100\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{hyphenatedTeam}-secondary)\\\"\\r\\n                    />\\r\\n                    <circle\\r\\n                      cx=\\\"170\\\"\\r\\n                      cy=\\\"170\\\"\\r\\n                      r=\\\"140\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{hyphenatedTeam})\\\"\\r\\n                    />\\r\\n                    <circle\\r\\n                      cx=\\\"300\\\"\\r\\n                      cy=\\\"320\\\"\\r\\n                      r=\\\"170\\\"\\r\\n                      stroke-width=\\\"0\\\"\\r\\n                      fill=\\\"var(--{hyphenatedTeam})\\\"\\r\\n                    />\\r\\n                  </svg>\\r\\n                </div>\\r\\n                <div class=\\\"position-central\\\">\\r\\n                  {data.standings[team][data._id].position}\\r\\n                </div>\\r\\n              </div>\\r\\n            {/if}\\r\\n            <div class=\\\"row-right fixtures-graph row-graph\\\">\\r\\n              <h1 class=\\\"lowered\\\">Fixtures</h1>\\r\\n              <div class=\\\"graph mini-graph mobile-margin\\\">\\r\\n                <FixturesGraph {data} {team} {mobileView} />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row multi-element-row\\\">\\r\\n            <div class=\\\"row-left form-details\\\">\\r\\n              <CurrentForm {data} {currentMatchday} {team} {toInitials} />\\r\\n              <TableSnippet\\r\\n                {data}\\r\\n                {hyphenatedTeam}\\r\\n                {team}\\r\\n                {switchTeam}\\r\\n                {toAlias}\\r\\n              />\\r\\n            </div>\\r\\n            <div class=\\\"row-right\\\">\\r\\n              <NextGame\\r\\n                {data}\\r\\n                {currentMatchday}\\r\\n                {team}\\r\\n                {showBadge}\\r\\n                {toAlias}\\r\\n                {toInitials}\\r\\n                {switchTeam}\\r\\n              />\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"form-graph row-graph\\\">\\r\\n              <h1 class=\\\"lowered\\\">Form Over Time</h1>\\r\\n              <div class=\\\"graph full-row-graph\\\">\\r\\n                <FormOverTimeGraph\\r\\n                  {data}\\r\\n                  {team}\\r\\n                  {playedMatchdays}\\r\\n                  {mobileView}\\r\\n                />\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          {#if load}\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"position-over-time-graph row-graph\\\">\\r\\n                <h1 class=\\\"lowered\\\">Position Over Time</h1>\\r\\n                <div class=\\\"graph full-row-graph\\\">\\r\\n                  <PositionOverTimeGraph\\r\\n                    {data}\\r\\n                    {team}\\r\\n                    {playedMatchdays}\\r\\n                    {mobileView}\\r\\n                  />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row no-bottom-margin\\\">\\r\\n              <div class=\\\"goals-scored-vs-conceded-graph row-graph\\\">\\r\\n                <h1 class=\\\"lowered\\\">Goals Scored and Conceded</h1>\\r\\n                <div class=\\\"graph full-row-graph\\\">\\r\\n                  <GoalsScoredAndConcededGraph\\r\\n                    {data}\\r\\n                    {team}\\r\\n                    {playedMatchdays}\\r\\n                    {mobileView}\\r\\n                  />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"row-graph\\\">\\r\\n                <div class=\\\"clean-sheets graph full-row-graph\\\">\\r\\n                  <CleanSheetsGraph\\r\\n                    {data}\\r\\n                    {team}\\r\\n                    {playedMatchdays}\\r\\n                    {mobileView}\\r\\n                  />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n            \\r\\n            <div class=\\\"season-stats-row\\\">\\r\\n              <StatsValues {data} {team} />\\r\\n            </div>\\r\\n            \\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"row-graph\\\">\\r\\n                <div class=\\\"graph full-row-graph\\\">\\r\\n                  <ScoredConcededOverTimeGraph\\r\\n                    {data}\\r\\n                    {team}\\r\\n                    {mobileView}\\r\\n                  />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"goals-freq-row row-graph\\\">\\r\\n                <h1>Goals Per Game</h1>\\r\\n                <GoalsPerGame {data} {team} {mobileView} />\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"row-graph\\\">\\r\\n                <div class=\\\"score-freq graph\\\">\\r\\n                  <ScorelineFreqGraph {data} {team} {mobileView} />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"spider-chart-row row-graph\\\">\\r\\n                <h1>Team Comparison</h1>\\r\\n                <div class=\\\"spider-chart-container\\\">\\r\\n                  <SpiderGraph {data} {team} {teams} {toAlias} {toName} />\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <TeamsFooter lastUpdated={data.lastUpdated} />\\r\\n          {/if}\\r\\n        </div>\\r\\n      {:else}\\r\\n        <div class=\\\"loading-spinner-container\\\">\\r\\n          <div class=\\\"loading-spinner\\\" />\\r\\n        </div>\\r\\n      {/if}\\r\\n    </div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  .header {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .main-link {\\r\\n    width: fit-content;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .title {\\r\\n    font-size: 2.3rem;\\r\\n    width: fit-content;\\r\\n  }\\r\\n  .page-content {\\r\\n    position: relative;\\r\\n  }\\r\\n  #team {\\r\\n    display: flex;\\r\\n    overflow-x: hidden;\\r\\n    font-size: 15px;\\r\\n  }\\r\\n  .position-and-badge {\\r\\n    height: 500px;\\r\\n    background-repeat: no-repeat;\\r\\n    background-size: auto 450px;\\r\\n    background-position: right center;\\r\\n  }\\r\\n\\r\\n  .position-no-badge {\\r\\n    padding-left: 0;\\r\\n    margin: 0;\\r\\n    height: 500px;\\r\\n  }\\r\\n\\r\\n  .position-central,\\r\\n  .position {\\r\\n    text-shadow: 9px 9px #000;\\r\\n    font-weight: 800;\\r\\n    font-size: 430px;\\r\\n    user-select: none;\\r\\n    max-width: 500px;\\r\\n  }\\r\\n\\r\\n  .position {\\r\\n    text-align: left;\\r\\n    margin-top: 0.02em;\\r\\n    margin-left: 30px;\\r\\n  }\\r\\n\\r\\n  .position-central {\\r\\n    text-align: center;\\r\\n    margin-top: 0.1em;\\r\\n    max-height: 500px;\\r\\n    margin-left: 0.05em;\\r\\n    font-size: 20vw;\\r\\n  }\\r\\n\\r\\n  .circles-background-container {\\r\\n    position: absolute;\\r\\n    align-self: center;\\r\\n    width: 500px;\\r\\n    z-index: -10;\\r\\n  }\\r\\n\\r\\n  .circles-background {\\r\\n    height: 500px;\\r\\n    width: 500px;\\r\\n    transform: scale(0.95);\\r\\n  }\\r\\n\\r\\n  #dashboard {\\r\\n    margin-left: 220px;\\r\\n    width: 100%;\\r\\n  }\\r\\n\\r\\n  .fixtures-graph {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n  }\\r\\n\\r\\n  .clean-sheets {\\r\\n    height: 60px;\\r\\n  }\\r\\n\\r\\n  .no-bottom-margin {\\r\\n    margin-bottom: 0 !important;\\r\\n  }\\r\\n  .small-bottom-margin {\\r\\n    margin-bottom: 1.5rem !important;\\r\\n  }\\r\\n  .page-content {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .row {\\r\\n    position: relative;\\r\\n    display: flex;\\r\\n    margin-bottom: 3rem;\\r\\n    height: auto;\\r\\n  }\\r\\n  .row-graph {\\r\\n    width: 100%;\\r\\n  }\\r\\n  .score-freq {\\r\\n    margin: 0 8% 0 8%;\\r\\n  }\\r\\n  .row-left {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    padding-right: auto;\\r\\n    margin-right: 1.4em;\\r\\n    text-justify: center;\\r\\n    flex: 4;\\r\\n  }\\r\\n  .row-right {\\r\\n    flex: 10;\\r\\n  }\\r\\n  .multi-element-row {\\r\\n    margin: 0 1.4em 3rem;\\r\\n  }\\r\\n\\r\\n  .spider-chart-row {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n  .spider-chart-container {\\r\\n    margin: 1em auto auto;\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  #mobileNavBtn {\\r\\n    position: fixed;\\r\\n    color: white;\\r\\n    background: #38003d;\\r\\n    padding: 0.8em 0;\\r\\n    cursor: pointer;\\r\\n    font-size: 1.1em;\\r\\n    z-index: 1;\\r\\n    width: 100%;\\r\\n    bottom: 0;\\r\\n    border: none;\\r\\n    margin-bottom: -1px;  /* For gap at bottom found in safari */\\r\\n  }\\r\\n  \\r\\n  @media only screen and (min-width: 2400px) {\\r\\n    .position-central {\\r\\n      font-size: 16vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 2200px) {\\r\\n    .position-central {\\r\\n      font-size: 18vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 2000px) {\\r\\n    .position-central {\\r\\n      font-size: 20vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1800px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.9);\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 20vw;\\r\\n      margin-top: 0.2em;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1600px) {\\r\\n    .row-left {\\r\\n      flex: 5;\\r\\n    }\\r\\n    .circles-background {\\r\\n      transform: scale(0.85);\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1500px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.8);\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 22vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1400px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.75);\\r\\n    }\\r\\n    .position-central {\\r\\n      margin-top: 0.25em;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1300px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.7);\\r\\n    }\\r\\n    #dashboard {\\r\\n      margin-left: 0;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 24vw;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 1300px) {\\r\\n    #mobileNavBtn {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1200px) {\\r\\n    .position-central {\\r\\n      margin-top: 0.3em;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (min-width: 1100px) {\\r\\n    .full-row-graph {\\r\\n      margin: 0 1em;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 1100px) {\\r\\n    .row {\\r\\n      flex-direction: column;\\r\\n      margin-bottom: 40px;\\r\\n    }\\r\\n    .row-graph {\\r\\n      width: auto;\\r\\n    }\\r\\n    .score-freq {\\r\\n      margin: 0 0 10px;\\r\\n    }\\r\\n\\r\\n    .multi-element-row {\\r\\n      margin: 0;\\r\\n    }\\r\\n    .row-left {\\r\\n      margin-right: 0;\\r\\n      align-self: center;\\r\\n    }\\r\\n\\r\\n    .position-and-badge {\\r\\n      width: 50%;\\r\\n      max-width: 400px;\\r\\n      min-width: 150px;\\r\\n      padding-right: 3% !important;\\r\\n      background-size: auto 330px !important;\\r\\n      height: 400px;\\r\\n      margin-bottom: -50px;\\r\\n    }\\r\\n\\r\\n    .position-no-badge {\\r\\n      height: 400px;\\r\\n      width: 500px;\\r\\n    }\\r\\n    .position-central {\\r\\n      margin: auto;\\r\\n    }\\r\\n\\r\\n    .circles-background {\\r\\n      transform: scale(0.48);\\r\\n      margin-top: -100px;\\r\\n    }\\r\\n\\r\\n    .position-central,\\r\\n    .circles-background-container {\\r\\n      align-self: center;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 1000px) {\\r\\n    .spider-chart-container {\\r\\n      flex-direction: column;\\r\\n      width: 100%;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 900px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.45);\\r\\n      margin-top: -120px;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 25vw;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 700px) {\\r\\n    .position-and-badge {\\r\\n      width: 70%;\\r\\n    }\\r\\n\\r\\n    .circles-background {\\r\\n      transform: scale(0.55);\\r\\n      margin-top: -5em;\\r\\n    }\\r\\n\\r\\n    .position-no-badge {\\r\\n      height: 330px;\\r\\n    }\\r\\n\\r\\n    .position-central {\\r\\n      font-size: 250px;\\r\\n      margin: 35px 0 0 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .circles-background {\\r\\n      transform: scale(0.4);\\r\\n      margin-top: -9em;\\r\\n    }\\r\\n    .position-central {\\r\\n      font-size: 13em;\\r\\n    }\\r\\n    .season-stats-row {\\r\\n      margin: 1em;\\r\\n    }\\r\\n    .row-graph {\\r\\n      margin: 0;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    .position,\\r\\n    .position-central {\\r\\n      font-size: 10em;\\r\\n      text-align: center;\\r\\n      line-height: 1.55;\\r\\n      padding-right: 20px;\\r\\n      margin: 0;\\r\\n      text-shadow: 7px 7px #000;\\r\\n    }\\r\\n    .multi-element-row {\\r\\n      margin: 0;\\r\\n    }\\r\\n\\r\\n    .position-and-badge {\\r\\n      background-size: auto 210px !important;\\r\\n      background-position: center !important;\\r\\n    }\\r\\n    .season-stats-row {\\r\\n      margin: 0 1em 1em;\\r\\n    }\\r\\n\\r\\n    .position-no-badge,\\r\\n    .position-and-badge {\\r\\n      padding: 0 !important;\\r\\n      margin: 0 !important;\\r\\n      width: 100%;\\r\\n    }\\r\\n\\r\\n    .circles-background {\\r\\n      transform: scale(0.35);\\r\\n      margin-top: -9.5em;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
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

function toggleMobileNav() {
	let mobileNav = document.getElementById("mobileNav");

	if (mobileNav.style.width == "0px") {
		mobileNav.style.animation = "appear 0.1s ease-in 1";
		mobileNav.style.width = "100%";
	} else {
		mobileNav.style.animation = null;
		mobileNav.style.width = "0px";
	}
}

function toTitleCase(str) {
	return str.toLowerCase().split(" ").map(function (word) {
		return word.charAt(0).toUpperCase() + word.slice(1);
	}).join(" ").replace("And", "and");
}

function getPlayedMatchdayDates(data, team) {
	let matchdays = [];

	for (let matchday in data.form[team][data._id]) {
		if (data.form[team][data._id][matchday].score != null) {
			matchdays.push(matchday);
		}
	}

	// If played one or no games, take x-axis from whole season dates
	if (matchdays.length == 0) {
		matchdays = Object.keys(data.fixtures[team]);
	}

	// Find median matchday date across all teams for each matchday
	let x = [];

	for (let matchday of matchdays) {
		let matchdayDates = [];

		Object.keys(data.standings).forEach(team => {
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
	let currentMatchday = null;

	if (Object.keys(data.form[team][data._id]).length > 0) {
		// Largest matchday with score is current matchday
		for (let matchday of Object.keys(data.form[team][data._id]).reverse()) {
			if (data.form[team][data._id][matchday].score != null) {
				currentMatchday = matchday;
				break;
			}
		}
	}

	return currentMatchday;
}

async function fetchData$1(address) {
	const response = await fetch(address);
	let json = await response.json();
	return json;
}

const Team = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let mobileView;

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

	function initDashboard() {
		// Set formatted team name so page header can display while fetching data
		if (hyphenatedTeam != null) {
			team = toTitleCase(hyphenatedTeam.replace(/\-/g, " "));
		}

		fetchData$1("https://pldashboard-backend.vercel.app/api/teams").then(json => {
			teams = Object.keys(json.standings);

			if (hyphenatedTeam == null) {
				// If '/' searched, set current team to
				team = teams[0];

				hyphenatedTeam = team.toLowerCase().replace(/ /g, "-");

				// Change url to /team-name without reloading page
				history.pushState({}, null, window.location.href + hyphenatedTeam);
			} else {
				// If team from url not in current season teams, 404 redirect
				if (!teams.includes(team)) {
					window.location.href = "/error";
				}
			}

			currentMatchday = getCurrentMatchday(json, team);
			playedMatchdays = getPlayedMatchdayDates(json, team);
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
		playedMatchdays = getPlayedMatchdayDates(data, team);
		window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
	}
	let pageWidth;
	let team = "";
	let teams = []; // Used for nav bar links
	let currentMatchday, playedMatchdays;
	let data;

	onMount(() => {
		initDashboard();
	});

	let { hyphenatedTeam } = $$props;
	if ($$props.hyphenatedTeam === void 0 && $$bindings.hyphenatedTeam && hyphenatedTeam !== void 0) $$bindings.hyphenatedTeam(hyphenatedTeam);
	$$result.css.add(css$3);
	mobileView = pageWidth <= 700;

	return `${($$result.head += `${($$result.title = `<title>${escape(team)}</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}



${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="${"team"}" class="${"svelte-1ao5tmf"}">${validate_component(Nav, "Nav").$$render(
				$$result,
				{
					team: hyphenatedTeam,
					teams,
					toAlias,
					switchTeam
				},
				{},
				{}
			)}
    ${validate_component(MobileNav, "MobileNav").$$render(
				$$result,
				{
					hyphenatedTeam,
					teams,
					toAlias,
					switchTeam,
					toggleMobileNav
				},
				{},
				{}
			)}
    ${teams.length == 0
			? `
      <button id="${"mobileNavBtn"}" style="${"cursor: default"}" class="${"svelte-1ao5tmf"}">Select Team </button>`
			: `<button id="${"mobileNavBtn"}" class="${"svelte-1ao5tmf"}">Select Team
      </button>`}

    <div id="${"dashboard"}" class="${"svelte-1ao5tmf"}">
      <div class="${"header svelte-1ao5tmf"}" style="${"background-color: var(--" + escape(hyphenatedTeam, true) + ");"}"><a class="${"main-link no-decoration svelte-1ao5tmf"}" href="${"/" + escape(hyphenatedTeam, true)}"><div class="${"title svelte-1ao5tmf"}" style="${"color: var(--" + escape(hyphenatedTeam + '-secondary', true) + ");"}">${escape(toAlias(team))}</div></a></div>
      

      ${data != undefined
			? `<div class="${"page-content svelte-1ao5tmf"}"><div class="${"row multi-element-row small-bottom-margin svelte-1ao5tmf"}">${`<div class="${"row-left position-no-badge svelte-1ao5tmf"}"><div class="${"circles-background-container svelte-1ao5tmf"}"><svg class="${"circles-background svelte-1ao5tmf"}"><circle cx="${"300"}" cy="${"150"}" r="${"100"}" stroke-width="${"0"}" fill="${"var(--" + escape(hyphenatedTeam, true) + "-secondary)"}"></circle><circle cx="${"170"}" cy="${"170"}" r="${"140"}" stroke-width="${"0"}" fill="${"var(--" + escape(hyphenatedTeam, true) + ")"}"></circle><circle cx="${"300"}" cy="${"320"}" r="${"170"}" stroke-width="${"0"}" fill="${"var(--" + escape(hyphenatedTeam, true) + ")"}"></circle></svg></div>
                <div class="${"position-central svelte-1ao5tmf"}">${escape(data.standings[team][data._id].position)}</div></div>`}
            <div class="${"row-right fixtures-graph row-graph svelte-1ao5tmf"}"><h1 class="${"lowered"}">Fixtures</h1>
              <div class="${"graph mini-graph mobile-margin"}">${validate_component(FixturesGraph, "FixturesGraph").$$render($$result, { data, team, mobileView }, {}, {})}</div></div></div>

          <div class="${"row multi-element-row svelte-1ao5tmf"}"><div class="${"row-left form-details svelte-1ao5tmf"}">${validate_component(CurrentForm, "CurrentForm").$$render($$result, { data, currentMatchday, team, toInitials }, {}, {})}
              ${validate_component(TableSnippet, "TableSnippet").$$render(
					$$result,
					{
						data,
						hyphenatedTeam,
						team,
						switchTeam,
						toAlias
					},
					{},
					{}
				)}</div>
            <div class="${"row-right svelte-1ao5tmf"}">${validate_component(NextGame, "NextGame").$$render(
					$$result,
					{
						data,
						currentMatchday,
						team,
						showBadge,
						toAlias,
						toInitials,
						switchTeam
					},
					{},
					{}
				)}</div></div>

          <div class="${"row svelte-1ao5tmf"}"><div class="${"form-graph row-graph svelte-1ao5tmf"}"><h1 class="${"lowered"}">Form Over Time</h1>
              <div class="${"graph full-row-graph svelte-1ao5tmf"}">${validate_component(FormOverTimeGraph, "FormOverTimeGraph").$$render($$result, { data, team, playedMatchdays, mobileView }, {}, {})}</div></div></div>

          ${``}</div>`
			: `<div class="${"loading-spinner-container"}"><div class="${"loading-spinner"}"></div></div>`}</div></div>`;
		}
	})}`;
});

/* src\routes\Home.svelte generated by Svelte v3.49.0 */

const css$2 = {
	code: "#home.svelte-1wkac13{background:black;min-height:100vh;display:grid;place-items:center;background-image:linear-gradient(to right, #025e4c45 1px, transparent 1px),\r\n      linear-gradient(to bottom, #025e4c45 1px, transparent 1px);background-size:80px 80px}#circle.svelte-1wkac13{border-radius:50%;width:60vw;height:28vw;z-index:1;position:absolute;box-shadow:black 0 0 200px 100px}.content.svelte-1wkac13{display:grid;place-items:center;margin-bottom:100px}img.svelte-1wkac13{z-index:2;width:min(80%, 1000px);box-shadow:black 0px 0 70px 58px;box-shadow:black 0px 0 80px 80px}.links.svelte-1wkac13{z-index:3;display:flex;padding-top:60px;background:black;box-shadow:black 0 60px 30px 30px}.fantasy-link.svelte-1wkac13{color:#37003d;background:linear-gradient(70deg, #00ff87, #02efff, #5e80ff);background:linear-gradient(90deg, #00fbd6, #02efff);background:#00ff87;padding:18px 0}.dashboard-link.svelte-1wkac13{color:#37003d;background:#00ff87;background:linear-gradient(70deg, #00ff87, #02efff, #5e80ff);background:linear-gradient(30deg, #00ff87, #2bd2ff);background:linear-gradient(70deg, #00ff87, #2bd2ff, #5e80ff);background:#fc014e;background:linear-gradient(90deg, #00ff87, #00fbd6);background:rgb(5, 235, 235);padding:18px 0}.dashboard-link.svelte-1wkac13,.fantasy-link.svelte-1wkac13{font-size:1.2em;border-radius:5px;font-weight:bold;letter-spacing:0.02em;margin:0 20px;width:160px;display:grid;place-items:center;box-shadow:0 0 30px 1px #00ff882c, 0 0 60px 2px #02eeff2c}@media only screen and (max-width: 800px){img.svelte-1wkac13{width:90%}#circle.svelte-1wkac13{display:none}}@media only screen and (max-width: 500px){.links.svelte-1wkac13{flex-direction:column}.dashboard-link.svelte-1wkac13,.fantasy-link.svelte-1wkac13{font-size:14px;margin:12px 0;padding:18px 0;width:140px}img.svelte-1wkac13{box-shadow:black 0px 20px 30px 40px}.links.svelte-1wkac13{box-shadow:black 0px 40px 30px 40px}}",
	map: "{\"version\":3,\"file\":\"Home.svelte\",\"sources\":[\"Home.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from \\\"svelte-routing\\\";\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Premier League</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"home\\\">\\r\\n    <div class=\\\"content\\\">\\r\\n      <div id=\\\"circle\\\" />\\r\\n      <img src=\\\"img/pldashboard5.png\\\" alt=\\\"pldashboard\\\" />\\r\\n      <div class=\\\"links\\\">\\r\\n        <a class=\\\"dashboard-link\\\" href=\\\"/\\\">Dashboard</a>\\r\\n        <a class=\\\"fantasy-link\\\" href=\\\"/\\\">Fantasy</a>\\r\\n      </div>\\r\\n    </div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  #home {\\r\\n    background: black;\\r\\n    min-height: 100vh;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    background-image: linear-gradient(to right, #025e4c45 1px, transparent 1px),\\r\\n      linear-gradient(to bottom, #025e4c45 1px, transparent 1px);\\r\\n    background-size: 80px 80px;\\r\\n  }\\r\\n  #circle {\\r\\n    border-radius: 50%;\\r\\n    width: 60vw;\\r\\n    height: 28vw;\\r\\n    z-index: 1;\\r\\n    position: absolute;\\r\\n    box-shadow: black 0 0 200px 100px;\\r\\n  }\\r\\n\\r\\n  .content {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    margin-bottom: 100px;\\r\\n  }\\r\\n  img {\\r\\n    z-index: 2;\\r\\n    width: min(80%, 1000px);\\r\\n    box-shadow: black 0px 0 70px 58px;\\r\\n    box-shadow: black 0px 0 80px 80px;\\r\\n  }\\r\\n  .links {\\r\\n    z-index: 3;\\r\\n    display: flex;\\r\\n    padding-top: 60px;\\r\\n    background: black;\\r\\n    box-shadow: black 0 60px 30px 30px;\\r\\n  }\\r\\n  .fantasy-link {\\r\\n    color: #37003d;\\r\\n    background: linear-gradient(70deg, #00ff87, #02efff, #5e80ff);\\r\\n    background: linear-gradient(90deg, #00fbd6, #02efff);\\r\\n    background: #00ff87;\\r\\n    padding: 18px 0;\\r\\n  }\\r\\n  .dashboard-link {\\r\\n    color: #37003d;\\r\\n    background: #00ff87;\\r\\n    background: linear-gradient(70deg, #00ff87, #02efff, #5e80ff);\\r\\n    background: linear-gradient(30deg, #00ff87, #2bd2ff);\\r\\n    background: linear-gradient(70deg, #00ff87, #2bd2ff, #5e80ff);\\r\\n    background: #fc014e;\\r\\n    background: linear-gradient(90deg, #00ff87, #00fbd6);\\r\\n    background: rgb(5, 235, 235);\\r\\n    padding: 18px 0;\\r\\n  }\\r\\n  .dashboard-link,\\r\\n  .fantasy-link {\\r\\n    font-size: 1.2em;\\r\\n    border-radius: 5px;\\r\\n    font-weight: bold;\\r\\n    letter-spacing: 0.02em;\\r\\n    margin: 0 20px;\\r\\n    width: 160px;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    box-shadow: 0 0 30px 1px #00ff882c, 0 0 60px 2px #02eeff2c;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    img {\\r\\n      width: 90%;\\r\\n    }\\r\\n    #circle {\\r\\n      display: none;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 500px) {\\r\\n    .links {\\r\\n      flex-direction: column;\\r\\n    }\\r\\n    .dashboard-link,\\r\\n    .fantasy-link {\\r\\n      font-size: 14px;\\r\\n      margin: 12px 0;\\r\\n      padding: 18px 0;\\r\\n      width: 140px;\\r\\n    }\\r\\n    img {\\r\\n      box-shadow: black 0px 20px 30px 40px;\\r\\n    }\\r\\n    .links {\\r\\n      box-shadow: black 0px 40px 30px 40px;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
};

const Home = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css$2);

	return `${($$result.head += `${($$result.title = `<title>Premier League</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="${"home"}" class="${"svelte-1wkac13"}"><div class="${"content svelte-1wkac13"}"><div id="${"circle"}" class="${"svelte-1wkac13"}"></div>
      <img src="${"img/pldashboard5.png"}" alt="${"pldashboard"}" class="${"svelte-1wkac13"}">
      <div class="${"links svelte-1wkac13"}"><a class="${"dashboard-link svelte-1wkac13"}" href="${"/"}">Dashboard</a>
        <a class="${"fantasy-link svelte-1wkac13"}" href="${"/"}">Fantasy</a></div></div></div>`;
		}
	})}`;
});

/* src\routes\Predictions.svelte generated by Svelte v3.49.0 */

const css$1 = {
	code: ".predictions-header.svelte-1qm3m7y{padding:40px 40px 0;text-align:center}.predictions-title.svelte-1qm3m7y{font-size:2.6em;font-weight:800;letter-spacing:-1px;align-self:center;flex:auto;color:#333;margin:10px;text-decoration:none}.predictions.svelte-1qm3m7y{display:flex;flex-direction:column}.predictions-gap.svelte-1qm3m7y{margin:15px 0}.page-content.svelte-1qm3m7y{font-size:1.3em}.green.svelte-1qm3m7y{background-color:var(--win)}.yellow.svelte-1qm3m7y{background-color:var(--draw)}.red.svelte-1qm3m7y{background-color:var(--lose)}.predictions-container.svelte-1qm3m7y{width:50%;margin:0 auto}.date.svelte-1qm3m7y{width:min(90%, 300px);align-self:center;text-align:center;margin-bottom:2px;font-size:1.2rem}.prediction-item.svelte-1qm3m7y{text-align:left;margin:0 8%;display:flex}.prediction-label.svelte-1qm3m7y{flex:5}.prediction-value.svelte-1qm3m7y{flex:4.5;display:flex;text-align:right}.prediction-initials.svelte-1qm3m7y,.prediction-score.svelte-1qm3m7y{flex:1;text-align:center}.prediction-container.svelte-1qm3m7y{padding:6px 0 3px;margin:2px 0;width:min(90%, 300px);align-self:center;border-radius:var(--border-radius);color:inherit;border:none;font-size:16px;cursor:pointer;outline:inherit;position:relative}.medium-predictions-divider.svelte-1qm3m7y{align-self:center;border-bottom:3px solid black;width:min(100%, 375px);margin-bottom:2px}.prediction-details.svelte-1qm3m7y{font-size:0.75em;color:black;margin:5px 0;text-align:left;height:0;display:none}.prediction-time.svelte-1qm3m7y{color:grey;font-size:0.7em;position:absolute;right:-34px;top:calc(50% - 7px)}.prediction-detail.svelte-1qm3m7y{margin:3px 0 3px 30px}.prediction-details.expanded.svelte-1qm3m7y{height:auto;display:block}.detailed-predicted-score.svelte-1qm3m7y{font-size:1.2em;margin:10px 0 0;text-align:center}.tabbed.svelte-1qm3m7y{padding-left:2em}.predictions-footer.svelte-1qm3m7y{align-items:center;font-size:0.8em;margin-top:30px;text-align:center}.accuracy-display.svelte-1qm3m7y{text-align:center;font-size:13px}.accuracy.svelte-1qm3m7y{margin:1em 0 2.5em}.accuracy-item.svelte-1qm3m7y{color:rgb(120 120 120);margin-bottom:5px}.method-description.svelte-1qm3m7y{margin:20px auto 15px;width:80%}@media only screen and (max-width: 800px){.predictions-container.svelte-1qm3m7y{width:80%}.prediction-container.svelte-1qm3m7y{width:min(80%, 300px)}.prediction-time.svelte-1qm3m7y{right:-28px;top:calc(50% - 6px)}.prediction-value.svelte-1qm3m7y{flex:4}}@media only screen and (max-width: 550px){#predictions.svelte-1qm3m7y{font-size:0.9em}.predictions-title.svelte-1qm3m7y{font-size:2em !important}.predictions-container.svelte-1qm3m7y{width:90%}.prediction-container.svelte-1qm3m7y{width:80%}.accuracy-display.svelte-1qm3m7y{font-size:0.8rem}.prediction-item.svelte-1qm3m7y{margin:0 6%}}@media only screen and (max-width: 500px){.prediction-value.svelte-1qm3m7y{flex:4.5}}@media only screen and (max-width: 400px){.prediction-value.svelte-1qm3m7y{flex:6}}",
	map: "{\"version\":3,\"file\":\"Predictions.svelte\",\"sources\":[\"Predictions.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from \\\"svelte-routing\\\";\\r\\nimport { onMount } from \\\"svelte\\\";\\r\\nasync function fetchData(address) {\\r\\n    const response = await fetch(address);\\r\\n    let json = await response.json();\\r\\n    return json;\\r\\n}\\r\\nfunction toggleDetailsDisplay(id) {\\r\\n    let prediction = document.getElementById(id);\\r\\n    if (prediction != null) {\\r\\n        prediction.classList.toggle(\\\"expanded\\\");\\r\\n    }\\r\\n}\\r\\nfunction identicalScore(prediction, actual) {\\r\\n    return (Math.round(prediction.homeGoals) == actual.homeGoals &&\\r\\n        Math.round(prediction.awayGoals) == actual.awayGoals);\\r\\n}\\r\\nfunction sameResult(prediction, actual) {\\r\\n    return ((Math.round(prediction.homeGoals) > Math.round(prediction.awayGoals) &&\\r\\n        Math.round(actual.homeGoals) > Math.round(actual.awayGoals)) ||\\r\\n        (Math.round(prediction.homeGoals) == Math.round(prediction.awayGoals) &&\\r\\n            Math.round(actual.homeGoals) == Math.round(actual.awayGoals)) ||\\r\\n        (Math.round(prediction.homeGoals) < Math.round(prediction.awayGoals) &&\\r\\n            Math.round(actual.homeGoals) < Math.round(actual.awayGoals)));\\r\\n}\\r\\n/**\\r\\n * Insert green, yellow or red colour values representing the results of completed\\r\\n * games as well as overall prediction accuracy values for scores and general\\r\\n * match results.\\r\\n*/\\r\\nfunction insertExtras(json) {\\r\\n    let scoreCorrect = 0;\\r\\n    let resultCorrect = 0;\\r\\n    let total = 0;\\r\\n    for (let i = 0; i < json.predictions.length; i++) {\\r\\n        for (let j = 0; j < json.predictions[i].predictions.length; j++) {\\r\\n            let prediction = json.predictions[i].predictions[j];\\r\\n            if (prediction.actual != null) {\\r\\n                if (identicalScore(prediction.prediction, prediction.actual)) {\\r\\n                    prediction.colour = \\\"green\\\";\\r\\n                    scoreCorrect += 1;\\r\\n                    resultCorrect += 1;\\r\\n                }\\r\\n                else if (sameResult(prediction.prediction, prediction.actual)) {\\r\\n                    prediction.colour = \\\"yellow\\\";\\r\\n                    resultCorrect += 1;\\r\\n                }\\r\\n                else {\\r\\n                    prediction.colour = \\\"red\\\";\\r\\n                }\\r\\n                total += 1;\\r\\n            }\\r\\n        }\\r\\n    }\\r\\n    json.accuracy = {\\r\\n        scoreAccuracy: scoreCorrect / total,\\r\\n        resultAccuracy: resultCorrect / total,\\r\\n    };\\r\\n}\\r\\nfunction datetimeToTime(datetime) {\\r\\n    let date = new Date(datetime);\\r\\n    return date.toTimeString().slice(0, 5);\\r\\n}\\r\\nfunction sortByDate(json) {\\r\\n    json.predictions.sort((a, b) => {\\r\\n        return new Date(b._id) - new Date(a._id);\\r\\n    });\\r\\n    // Sort each day of predictions by time\\r\\n    for (let i = 0; i < json.predictions.length; i++) {\\r\\n        json.predictions[i].predictions.sort((a, b) => {\\r\\n            return new Date(a.datetime) - new Date(b.datetime);\\r\\n        });\\r\\n    }\\r\\n}\\r\\nlet data;\\r\\nonMount(() => {\\r\\n    fetchData(\\\"https://pldashboard-backend.vercel.app/api/predictions\\\").then((json) => {\\r\\n        sortByDate(json);\\r\\n        insertExtras(json);\\r\\n        data = json;\\r\\n        console.log(data);\\r\\n    });\\r\\n});\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Predictions</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"predictions\\\">\\r\\n    <div class=\\\"predictions-header\\\">\\r\\n      <a class=\\\"predictions-title\\\" href=\\\"/predictions\\\">Predictions</a>\\r\\n    </div>\\r\\n\\r\\n    {#if data != undefined}\\r\\n      <div class=\\\"page-content\\\">\\r\\n        <div class=\\\"accuracy-display\\\">\\r\\n          <div class=\\\"accuracy\\\">\\r\\n            <span class=\\\"accuracy-item\\\">\\r\\n              Predicting with accuracy: <b\\r\\n                >{(data.accuracy.scoreAccuracy * 100).toFixed(2)}%</b\\r\\n              ></span\\r\\n            ><br />\\r\\n            <div class=\\\"accuracy-item\\\">\\r\\n              General results accuracy: <b\\r\\n                >{(data.accuracy.resultAccuracy * 100).toFixed(2)}%</b\\r\\n              >\\r\\n            </div>\\r\\n          </div>\\r\\n        </div>\\r\\n\\r\\n        <div class=\\\"predictions-container\\\">\\r\\n          <div class=\\\"predictions\\\">\\r\\n            {#if data.predictions != null}\\r\\n              {#each data.predictions as { _id, predictions }}\\r\\n                <div class=\\\"date\\\">\\r\\n                  {_id}\\r\\n                </div>\\r\\n                <div class=\\\"medium-predictions-divider\\\" />\\r\\n                <!-- Each prediction on this day -->\\r\\n                {#each predictions as pred}\\r\\n                  <button\\r\\n                    class=\\\"prediction-container {pred.colour}\\\"\\r\\n                    on:click={() => toggleDetailsDisplay(pred._id)}\\r\\n                  >\\r\\n                    <div class=\\\"prediction prediction-item\\\">\\r\\n                      <div class=\\\"prediction-label\\\">Predicted:</div>\\r\\n                      <div class=\\\"prediction-value\\\">\\r\\n                        <div class=\\\"prediction-initials\\\">{pred.home}</div>\\r\\n                        <div class=\\\"prediction-score\\\">\\r\\n                          {Math.round(pred.prediction.homeGoals)} - {Math.round(\\r\\n                            pred.prediction.awayGoals\\r\\n                          )}\\r\\n                        </div>\\r\\n                        <div class=\\\"prediction-initials\\\">{pred.away}</div>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    {#if pred.actual != null}\\r\\n                      <div class=\\\"actual prediction-item\\\">\\r\\n                        <div class=\\\"prediction-label\\\">Actual:</div>\\r\\n                        <div class=\\\"prediction-value\\\">\\r\\n                          <div class=\\\"prediction-initials\\\">{pred.home}</div>\\r\\n                          <div class=\\\"prediction-score\\\">\\r\\n                            {pred.actual.homeGoals} - {pred.actual.awayGoals}\\r\\n                          </div>\\r\\n                          <div class=\\\"prediction-initials\\\">{pred.away}</div>\\r\\n                        </div>\\r\\n                      </div>\\r\\n                    {:else}\\r\\n                      <div class=\\\"prediction-time\\\">\\r\\n                        {datetimeToTime(pred.datetime)}\\r\\n                      </div>\\r\\n                    {/if}\\r\\n\\r\\n                    <!-- Toggle to see detialed score -->\\r\\n                    {#if pred.prediction != null}\\r\\n                      <div class=\\\"prediction-details\\\" id={pred._id}>\\r\\n                        <div class=\\\"detailed-predicted-score\\\">\\r\\n                          <b\\r\\n                            >{pred.prediction.homeGoals} - {pred.prediction\\r\\n                              .awayGoals}</b\\r\\n                          >\\r\\n                        </div>\\r\\n                      </div>\\r\\n                    {/if}\\r\\n                  </button>\\r\\n                {/each}\\r\\n                <div class=\\\"predictions-gap\\\" />\\r\\n              {/each}\\r\\n            {/if}\\r\\n          </div>\\r\\n        </div>\\r\\n      </div>\\r\\n\\r\\n      <!-- <div class=\\\"predictions-footer footer-text-colour\\\">\\r\\n      <div class=\\\"method-description\\\">\\r\\n        Predictions are calculated using previous results and then adjusting by\\r\\n        recent form and home advantage.\\r\\n      </div>\\r\\n    </div> -->\\r\\n    {:else}\\r\\n      <div class=\\\"loading-spinner-container\\\">\\r\\n        <div class=\\\"loading-spinner\\\" />\\r\\n      </div>\\r\\n    {/if}\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  .predictions-header {\\r\\n    padding: 40px 40px 0;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .predictions-title {\\r\\n    font-size: 2.6em;\\r\\n    font-weight: 800;\\r\\n    letter-spacing: -1px;\\r\\n    align-self: center;\\r\\n    flex: auto;\\r\\n    color: #333;\\r\\n    margin: 10px;\\r\\n    text-decoration: none;\\r\\n  }\\r\\n\\r\\n  .predictions {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n  }\\r\\n\\r\\n  .predictions-gap {\\r\\n    margin: 15px 0;\\r\\n  }\\r\\n\\r\\n  .page-content {\\r\\n    font-size: 1.3em;\\r\\n  }\\r\\n\\r\\n  .green {\\r\\n    background-color: var(--win);\\r\\n  }\\r\\n\\r\\n  .yellow {\\r\\n    background-color: var(--draw);\\r\\n  }\\r\\n\\r\\n  .red {\\r\\n    background-color: var(--lose);\\r\\n  }\\r\\n\\r\\n  .predictions-container {\\r\\n    width: 50%;\\r\\n    margin: 0 auto;\\r\\n  }\\r\\n\\r\\n  .date {\\r\\n    width: min(90%, 300px);\\r\\n    align-self: center;\\r\\n    text-align: center;\\r\\n    margin-bottom: 2px;\\r\\n    font-size: 1.2rem;\\r\\n  }\\r\\n\\r\\n  .prediction-item {\\r\\n    text-align: left;\\r\\n    margin: 0 8%;\\r\\n    display: flex;\\r\\n  }\\r\\n\\r\\n  .prediction-label {\\r\\n    flex: 5;\\r\\n  }\\r\\n\\r\\n  .prediction-value {\\r\\n    flex: 4.5;\\r\\n    display: flex;\\r\\n    text-align: right;\\r\\n  }\\r\\n\\r\\n  .prediction-initials,\\r\\n  .prediction-score {\\r\\n    flex: 1;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .prediction-container {\\r\\n    padding: 6px 0 3px;\\r\\n    margin: 2px 0;\\r\\n    width: min(90%, 300px);\\r\\n    align-self: center;\\r\\n    border-radius: var(--border-radius);\\r\\n    color: inherit;\\r\\n    border: none;\\r\\n    font-size: 16px;\\r\\n    cursor: pointer;\\r\\n    outline: inherit;\\r\\n    position: relative;\\r\\n  }\\r\\n\\r\\n  .medium-predictions-divider {\\r\\n    align-self: center;\\r\\n    border-bottom: 3px solid black;\\r\\n    width: min(100%, 375px);\\r\\n    margin-bottom: 2px;\\r\\n  }\\r\\n\\r\\n  .prediction-details {\\r\\n    font-size: 0.75em;\\r\\n    color: black;\\r\\n    margin: 5px 0;\\r\\n    text-align: left;\\r\\n    height: 0;\\r\\n    display: none;\\r\\n  }\\r\\n\\r\\n  .prediction-time {\\r\\n    color: grey;\\r\\n    font-size: 0.7em;\\r\\n    position: absolute;\\r\\n    right: -34px;\\r\\n    top: calc(50% - 7px);\\r\\n  }\\r\\n\\r\\n  .prediction-detail {\\r\\n    margin: 3px 0 3px 30px;\\r\\n  }\\r\\n\\r\\n  .prediction-details.expanded {\\r\\n    height: auto;\\r\\n    display: block;\\r\\n  }\\r\\n\\r\\n  .detailed-predicted-score {\\r\\n    font-size: 1.2em;\\r\\n    margin: 10px 0 0;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .tabbed {\\r\\n    padding-left: 2em;\\r\\n  }\\r\\n  .predictions-footer {\\r\\n    align-items: center;\\r\\n    font-size: 0.8em;\\r\\n    margin-top: 30px;\\r\\n    text-align: center;\\r\\n  }\\r\\n\\r\\n  .accuracy-display {\\r\\n    text-align: center;\\r\\n    font-size: 13px;\\r\\n  }\\r\\n  .accuracy {\\r\\n    margin: 1em 0 2.5em;\\r\\n  }\\r\\n\\r\\n  .accuracy-item {\\r\\n    color: rgb(120 120 120);\\r\\n    margin-bottom: 5px;\\r\\n  }\\r\\n  .method-description {\\r\\n    margin: 20px auto 15px;\\r\\n    width: 80%;\\r\\n  }\\r\\n  @media only screen and (max-width: 800px) {\\r\\n    .predictions-container {\\r\\n      width: 80%;\\r\\n    }\\r\\n\\r\\n    .prediction-container {\\r\\n      width: min(80%, 300px);\\r\\n    }\\r\\n\\r\\n    .prediction-time {\\r\\n      right: -28px;\\r\\n      top: calc(50% - 6px);\\r\\n    }\\r\\n\\r\\n    .prediction-value {\\r\\n      flex: 4;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 550px) {\\r\\n    #predictions {\\r\\n      font-size: 0.9em;\\r\\n    }\\r\\n    .predictions-title {\\r\\n      font-size: 2em !important;\\r\\n    }\\r\\n    .predictions-container {\\r\\n      width: 90%;\\r\\n    }\\r\\n    .prediction-container {\\r\\n      width: 80%;\\r\\n    }\\r\\n    .accuracy-display {\\r\\n      font-size: 0.8rem;\\r\\n    }\\r\\n\\r\\n    /* .predictions {\\r\\n    font-size: 0.9em;\\r\\n  } */\\r\\n\\r\\n    /* .prev-results-title {\\r\\n    font-size: 18px;\\r\\n  } */\\r\\n    .prediction-item {\\r\\n      margin: 0 6%;\\r\\n    }\\r\\n  }\\r\\n  @media only screen and (max-width: 500px) {\\r\\n    .prediction-value {\\r\\n      flex: 4.5;\\r\\n    }\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 400px) {\\r\\n    .prediction-value {\\r\\n      flex: 6;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"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\"}"
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
	return Math.round(prediction.homeGoals) > Math.round(prediction.awayGoals) && Math.round(actual.homeGoals) > Math.round(actual.awayGoals) || Math.round(prediction.homeGoals) == Math.round(prediction.awayGoals) && Math.round(actual.homeGoals) == Math.round(actual.awayGoals) || Math.round(prediction.homeGoals) < Math.round(prediction.awayGoals) && Math.round(actual.homeGoals) < Math.round(actual.awayGoals);
}

/**
 * Insert green, yellow or red colour values representing the results of completed
 * games as well as overall prediction accuracy values for scores and general
 * match results.
*/
function insertExtras(json) {
	let scoreCorrect = 0;
	let resultCorrect = 0;
	let total = 0;

	for (let i = 0; i < json.predictions.length; i++) {
		for (let j = 0; j < json.predictions[i].predictions.length; j++) {
			let prediction = json.predictions[i].predictions[j];

			if (prediction.actual != null) {
				if (identicalScore(prediction.prediction, prediction.actual)) {
					prediction.colour = "green";
					scoreCorrect += 1;
					resultCorrect += 1;
				} else if (sameResult(prediction.prediction, prediction.actual)) {
					prediction.colour = "yellow";
					resultCorrect += 1;
				} else {
					prediction.colour = "red";
				}

				total += 1;
			}
		}
	}

	json.accuracy = {
		scoreAccuracy: scoreCorrect / total,
		resultAccuracy: resultCorrect / total
	};
}

function datetimeToTime(datetime) {
	let date = new Date(datetime);
	return date.toTimeString().slice(0, 5);
}

function sortByDate(json) {
	json.predictions.sort((a, b) => {
		return new Date(b._id) - new Date(a._id);
	});

	// Sort each day of predictions by time
	for (let i = 0; i < json.predictions.length; i++) {
		json.predictions[i].predictions.sort((a, b) => {
			return new Date(a.datetime) - new Date(b.datetime);
		});
	}
}

const Predictions = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let data;

	onMount(() => {
		fetchData("https://pldashboard-backend.vercel.app/api/predictions").then(json => {
			sortByDate(json);
			insertExtras(json);
			data = json;
			console.log(data);
		});
	});

	$$result.css.add(css$1);

	return `${($$result.head += `${($$result.title = `<title>Predictions</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="${"predictions"}" class="${"svelte-1qm3m7y"}"><div class="${"predictions-header svelte-1qm3m7y"}"><a class="${"predictions-title svelte-1qm3m7y"}" href="${"/predictions"}">Predictions</a></div>

    ${data != undefined
			? `<div class="${"page-content svelte-1qm3m7y"}"><div class="${"accuracy-display svelte-1qm3m7y"}"><div class="${"accuracy svelte-1qm3m7y"}"><span class="${"accuracy-item svelte-1qm3m7y"}">Predicting with accuracy: <b>${escape((data.accuracy.scoreAccuracy * 100).toFixed(2))}%</b></span><br>
            <div class="${"accuracy-item svelte-1qm3m7y"}">General results accuracy: <b>${escape((data.accuracy.resultAccuracy * 100).toFixed(2))}%</b></div></div></div>

        <div class="${"predictions-container svelte-1qm3m7y"}"><div class="${"predictions svelte-1qm3m7y"}">${data.predictions != null
				? `${each(data.predictions, ({ _id, predictions }) => {
						return `<div class="${"date svelte-1qm3m7y"}">${escape(_id)}</div>
                <div class="${"medium-predictions-divider svelte-1qm3m7y"}"></div>
                
                ${each(predictions, pred => {
							return `<button class="${"prediction-container " + escape(pred.colour, true) + " svelte-1qm3m7y"}"><div class="${"prediction prediction-item svelte-1qm3m7y"}"><div class="${"prediction-label svelte-1qm3m7y"}">Predicted:</div>
                      <div class="${"prediction-value svelte-1qm3m7y"}"><div class="${"prediction-initials svelte-1qm3m7y"}">${escape(pred.home)}</div>
                        <div class="${"prediction-score svelte-1qm3m7y"}">${escape(Math.round(pred.prediction.homeGoals))} - ${escape(Math.round(pred.prediction.awayGoals))}</div>
                        <div class="${"prediction-initials svelte-1qm3m7y"}">${escape(pred.away)}</div>
                      </div></div>
                    ${pred.actual != null
							? `<div class="${"actual prediction-item svelte-1qm3m7y"}"><div class="${"prediction-label svelte-1qm3m7y"}">Actual:</div>
                        <div class="${"prediction-value svelte-1qm3m7y"}"><div class="${"prediction-initials svelte-1qm3m7y"}">${escape(pred.home)}</div>
                          <div class="${"prediction-score svelte-1qm3m7y"}">${escape(pred.actual.homeGoals)} - ${escape(pred.actual.awayGoals)}</div>
                          <div class="${"prediction-initials svelte-1qm3m7y"}">${escape(pred.away)}</div></div>
                      </div>`
							: `<div class="${"prediction-time svelte-1qm3m7y"}">${escape(datetimeToTime(pred.datetime))}
                      </div>`}

                    
                    ${pred.prediction != null
							? `<div class="${"prediction-details svelte-1qm3m7y"}"${add_attribute("id", pred._id, 0)}><div class="${"detailed-predicted-score svelte-1qm3m7y"}"><b>${escape(pred.prediction.homeGoals)} - ${escape(pred.prediction.awayGoals)}</b></div>
                      </div>`
							: ``}
                  </button>`;
						})}
                <div class="${"predictions-gap svelte-1qm3m7y"}"></div>`;
					})}`
				: ``}</div></div></div>

      `
			: `<div class="${"loading-spinner-container"}"><div class="${"loading-spinner"}"></div></div>`}</div>`;
		}
	})}`;
});

/* src\routes\Error.svelte generated by Svelte v3.49.0 */

const css = {
	code: "#error.svelte-17qhtmb{display:grid;place-items:center;height:75vh;background:#fafafa}.msg-container.svelte-17qhtmb{background:#38003d;color:#00fe87;border-radius:6px;padding:0.5em 1em 0.5em 1em;font-size:2em}@media only screen and (max-width: 600px){#error.svelte-17qhtmb{height:85vh}.msg-container.svelte-17qhtmb{font-size:1.5em}}",
	map: "{\"version\":3,\"file\":\"Error.svelte\",\"sources\":[\"Error.svelte\"],\"sourcesContent\":[\"<script lang=\\\"ts\\\">import { Router } from \\\"svelte-routing\\\";\\r\\n</script>\\r\\n\\r\\n<svelte:head>\\r\\n  <title>Premier League</title>\\r\\n  <meta name=\\\"description\\\" content=\\\"Premier League Statistics Dashboard\\\" />\\r\\n</svelte:head>\\r\\n\\r\\n<Router>\\r\\n  <div id=\\\"error\\\">\\r\\n    <div class=\\\"msg-container\\\">Error: Page not found</div>\\r\\n  </div>\\r\\n</Router>\\r\\n\\r\\n<style scoped>\\r\\n  #error {\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n    height: 75vh;\\r\\n    background: #fafafa;\\r\\n  }\\r\\n  .msg-container {\\r\\n    /* width: 50%; */\\r\\n    /* height: 10%; */\\r\\n    /* background: blue; */\\r\\n    background: #38003d;\\r\\n    color: #00fe87;\\r\\n    /* border-bottom: 10px solid blue; */\\r\\n    border-radius: 6px;\\r\\n    padding: 0.5em 1em 0.5em 1em;\\r\\n    font-size: 2em;\\r\\n  }\\r\\n\\r\\n  @media only screen and (max-width: 600px) {\\r\\n    #error {\\r\\n        height: 85vh;\\r\\n    }\\r\\n    .msg-container {\\r\\n        font-size: 1.5em;\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n\"],\"names\":[],\"mappings\":\"AAeE,MAAM,eAAC,CAAC,AACN,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,MAAM,CAAE,IAAI,CACZ,UAAU,CAAE,OAAO,AACrB,CAAC,AACD,cAAc,eAAC,CAAC,AAId,UAAU,CAAE,OAAO,CACnB,KAAK,CAAE,OAAO,CAEd,aAAa,CAAE,GAAG,CAClB,OAAO,CAAE,KAAK,CAAC,GAAG,CAAC,KAAK,CAAC,GAAG,CAC5B,SAAS,CAAE,GAAG,AAChB,CAAC,AAED,OAAO,IAAI,CAAC,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACzC,MAAM,eAAC,CAAC,AACJ,MAAM,CAAE,IAAI,AAChB,CAAC,AACD,cAAc,eAAC,CAAC,AACZ,SAAS,CAAE,KAAK,AACpB,CAAC,AACH,CAAC\"}"
};

const Error$1 = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css);

	return `${($$result.head += `${($$result.title = `<title>Premier League</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div id="${"error"}" class="${"svelte-17qhtmb"}"><div class="${"msg-container svelte-17qhtmb"}">Error: Page not found</div></div>`;
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
					return `${validate_component(Team, "Team").$$render($$result, { hyphenatedTeam: null }, {}, {})}`;
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
  ${validate_component(Route, "Route").$$render($$result, { path: "/home", component: Home }, {}, {})}
  ${validate_component(Route, "Route").$$render($$result, { path: "/error", component: Error$1 }, {}, {})}`;
		}
	})}`;
});

module.exports = App;
