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
const escaped = {
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};
function escape(html) {
    return String(html).replace(/["'&<>]/g, match => escaped[match]);
}
function escape_attribute_value(value) {
    return typeof value === 'string' ? escape(value) : value;
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
    const assignment = (boolean && value === true) ? '' : `="${escape_attribute_value(value.toString())}"`;
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

/* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.48.0 */

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

/* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.48.0 */

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

/* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.48.0 */

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

/* src\routes\Home.svelte generated by Svelte v3.48.0 */

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

const Home = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	onMount(() => {
		window.addEventListener("resize", setBorderRadius, true);
		setBorderRadius();
	});

	return `${($$result.head += `${($$result.title = `<title>Premier League</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div class="${"header"}">${validate_component(Link, "Link").$$render($$result, { to: "/" }, {}, {
				default: () => {
					return `<div class="${"title main-link no-decoration"}">Premier League</div>`;
				}
			})}</div>
  <div class="${"page-content"}"><div class="${"teams"}">${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/manchester-city",
					class: "team-button",
					id: "team-1",
					style: "background-color: var(--manchester-city);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--manchester-city-secondary);"}">Manchester City
        </div>`;
					}
				}
			)}
      ${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/manchester-united",
					class: "team-button",
					id: "team-2",
					style: "background-color: var(--manchester-united);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--manchester-united-secondary);"}">Manchester United
        </div>`;
					}
				}
			)}
      ${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/liverpool",
					class: "team-button",
					id: "team-3",
					style: "background-color: var(--liverpool);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--liverpool-secondary);"}">Liverpool
        </div>`;
					}
				}
			)}
      ${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/chelsea",
					class: "team-button",
					id: "team-4",
					style: "background-color: var(--chelsea);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--chelsea-secondary);"}">Chelsea
        </div>`;
					}
				}
			)}
      ${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/leicester-city",
					class: "team-button",
					id: "team-5",
					style: "background-color: var(--leicester-city);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--leicester-city-secondary);"}">Leicester
        </div>`;
					}
				}
			)}
      ${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/west-ham-united",
					class: "team-button",
					id: "team-6",
					style: "background-color: var(--west-ham-united);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--west-ham-united-secondary);"}">West Ham
        </div>`;
					}
				}
			)}
      ${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/tottenham-hotspur",
					class: "team-button",
					id: "team-7",
					style: "background-color: var(--tottenham-hotspur);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--tottenham-hotspur-secondary);"}">Spurs
        </div>`;
					}
				}
			)}
      ${validate_component(Link, "Link").$$render(
				$$result,
				{
					to: "/arsenal",
					class: "team-button",
					id: "team-8",
					style: "background-color: var(--arsenal);"
				},
				{},
				{
					default: () => {
						return `<div class="${"main-link"}" style="${"color: var(--arsenal-secondary);"}">Arsenal
        </div>`;
					}
				}
			)}
      <a href="${"/leeds-united"}" class="${"team-button"}" id="${"team-9"}" style="${"background-color: var(--leeds-united);"}"><div class="${"main-link"}" style="${"color: var(--leeds-united-secondary);"}">Leeds United
        </div></a>
      <a href="${"/everton"}" class="${"team-button"}" id="${"team-10"}" style="${"background-color: var(--everton);"}"><div class="${"main-link"}" style="${"color: var(--everton-secondary);"}">Everton
        </div></a>
      <a href="${"/aston-villa"}" class="${"team-button"}" id="${"team-11"}" style="${"background-color: var(--aston-villa);"}"><div class="${"main-link"}" style="${"color: var(--aston-villa-secondary);"}">Aston Villa
        </div></a>
      <a href="${"/newcastle-united"}" class="${"team-button"}" id="${"team-12"}" style="${"background-color: var(--newcastle-united);"}"><div class="${"main-link"}" style="${"color: var(--newcastle-united-secondary);"}">Newcastle
        </div></a>
      <a href="${"/wolverhampton-wanderers"}" class="${"team-button"}" id="${"team-13"}" style="${"background-color: var(--wolverhampton-wanderers);"}"><div class="${"main-link"}" style="${"color: var(--wolverhampton-wanderers-secondary);"}">Wolves
        </div></a>
      <a href="${"/crystal-palace"}" class="${"team-button"}" id="${"team-14"}" style="${"background-color: var(--crystal-palace);"}"><div class="${"main-link"}" style="${"color: var(--crystal-palace-secondary);"}">Crystal Palace
        </div></a>
      <a href="${"/southampton"}" class="${"team-button"}" id="${"team-15"}" style="${"background-color: var(--southampton);"}"><div class="${"main-link"}" style="${"color: var(--southampton-secondary);"}">Southampton
        </div></a>
      <a href="${"/brighton-and-hove-albion"}" class="${"team-button"}" id="${"team-16"}" style="${"background-color: var(--brighton-and-hove-albion);"}"><div class="${"main-link"}" style="${"color: var(--brighton-and-hove-albion-secondary);"}">Brighton
        </div></a>
      <a href="${"/burnley"}" class="${"team-button"}" id="${"team-17"}" style="${"background-color: var(--burnley);"}"><div class="${"main-link"}" style="${"color: var(--burnley-secondary);"}">Burnley
        </div></a>
      <a href="${"/norwich-city"}" class="${"team-button"}" id="${"team-18"}" style="${"background-color: var(--norwich-city);"}"><div class="${"main-link"}" style="${"color: var(--norwich-city-secondary);"}">Norwich City
        </div></a>
      <a href="${"/watford"}" class="${"team-button"}" id="${"team-19"}" style="${"background-color: var(--watford);"}"><div class="${"main-link"}" style="${"color: var(--watford-secondary);"}">Watford
        </div></a>
      <a href="${"/brentford"}" class="${"team-button"}" id="${"team-20"}" style="${"background-color: var(--brentford);"}"><div class="${"main-link"}" style="${"color: var(--brentford-secondary);"}">Brentford
        </div></a></div></div>`;
		}
	})}

`;
});

/* src\components\CurrentForm.svelte generated by Svelte v3.48.0 */

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

function getSortedMatchdays(data, team) {
	let matchdays = Object.keys(data.form[team]).sort(function (a, b) {
		return new Date(data.form[team][a].date) - new Date(data.form[team][b].date);
	});

	return matchdays;
}

const CurrentForm = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let matchdays;

	onMount(() => {
		let sortedMatchdays = getSortedMatchdays(data, fullTeamName);
		matchdays = sortedMatchdays.slice(-5);
	});

	let { data, currentMatchday, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);

	return `${matchdays != undefined
	? `<div class="${"current-form-row"}"><div class="${"icon pos-0 " + escape(data.form[fullTeamName][currentMatchday].form5.charAt(4)) + " " + escape(data.form[fullTeamName][matchdays[0]].beatStarTeam
		? 'star-team'
		: '')}"></div>
    <div class="${"icon pos-1 " + escape(data.form[fullTeamName][currentMatchday].form5.charAt(3)) + " " + escape(data.form[fullTeamName][matchdays[1]].beatStarTeam
		? 'star-team'
		: '')}"></div>
    <div class="${"icon pos-2 " + escape(data.form[fullTeamName][currentMatchday].form5.charAt(2)) + " " + escape(data.form[fullTeamName][matchdays[2]].beatStarTeam
		? 'star-team'
		: '')}"></div>
    <div class="${"icon pos-3 " + escape(data.form[fullTeamName][currentMatchday].form5.charAt(1)) + " " + escape(data.form[fullTeamName][matchdays[3]].beatStarTeam
		? 'star-team'
		: '')}"></div>
    <div class="${"icon pos-4 " + escape(data.form[fullTeamName][currentMatchday].form5.charAt(0)) + " " + escape(data.form[fullTeamName][matchdays[4]].beatStarTeam
		? 'star-team'
		: '')}"></div></div>
  <div class="${"current-form-row"}"><div class="${"icon-name pos-0"}">${escape(toInitials(data.form[fullTeamName][matchdays[0]].team))}</div>
    <div class="${"icon-name pos-1"}">${escape(toInitials(data.form[fullTeamName][matchdays[1]].team))}</div>
    <div class="${"icon-name pos-2"}">${escape(toInitials(data.form[fullTeamName][matchdays[2]].team))}</div>
    <div class="${"icon-name pos-3"}">${escape(toInitials(data.form[fullTeamName][matchdays[3]].team))}</div>
    <div class="${"icon-name pos-4"}">${escape(toInitials(data.form[fullTeamName][matchdays[4]].team))}</div></div>`
	: ``}
<div class="${"current-form"}">Current form: ${escape((data.form[fullTeamName][currentMatchday].formRating5 * 100).toFixed(2))}%
</div>`;
});

/* src\components\TableSnippet.svelte generated by Svelte v3.48.0 */

function tableSnippetRange(sortedTeams, fullTeamName) {
	let teamStandingsIdx = sortedTeams.indexOf(fullTeamName);
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

function getTableSnippet(data, fullTeamName) {
	let sortedTeams = Object.keys(data.standings).sort(function (teamA, teamB) {
		return data.standings[teamB][data.currentSeason].points - data.standings[teamA][data.currentSeason].points;
	});

	let [low, high] = tableSnippetRange(sortedTeams, fullTeamName);
	let teamTableIdx;
	let rows = [];

	for (let i = low; i < high; i++) {
		if (sortedTeams[i] == fullTeamName) {
			teamTableIdx = i - low;
		}

		rows.push({
			name: sortedTeams[i],
			position: data.standings[sortedTeams[i]][data.currentSeason].position,
			points: data.standings[sortedTeams[i]][data.currentSeason].points,
			gd: data.standings[sortedTeams[i]][data.currentSeason].gD
		});
	}

	return { teamTableIdx, rows };
}

const TableSnippet = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let tableSnippet;

	onMount(() => {
		tableSnippet = getTableSnippet(data, fullTeamName);
	});

	let { data, team, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);

	return `<div class="${"table-snippet"}">${tableSnippet != undefined
	? `<div class="${"divider"}"></div>
    <div class="${"table-row"}"><div class="${"table-element table-position column-title"}"></div>
      <div class="${"table-element table-team-name column-title"}">Team</div>
      <div class="${"table-element table-gd column-title"}">GD</div>
      <div class="${"table-element table-points column-title"}">Points</div></div>

    ${each(Array(tableSnippet.rows.length), (_, i) => {
			return `
      ${i == 0
			? `${i != tableSnippet.teamTableIdx
				? `<div id="${"divider"}"></div>`
				: ``}`
			: `${i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx
				? `<div id="${"divider"}"></div>`
				: ``}`}

      
      ${i == tableSnippet.teamTableIdx
			? `
        <div class="${"table-row this-team"}" style="${"background-color: var(--" + escape(team) + ");"}"><div class="${"table-element table-position this-team"}" style="${"color: var(--" + escape(team) + "-secondary);"}">${escape(tableSnippet.rows[i].position)}</div>
          <div class="${"table-element table-team-name this-team"}" style="${"color: var(--" + escape(team) + "-secondary);"}">${escape(tableSnippet.rows[i].name)}</div>
          <div class="${"table-element table-gd this-team"}" style="${"color: var(--" + escape(team) + "-secondary);"}">${escape(tableSnippet.rows[i].gd)}</div>
          <div class="${"table-element table-points this-team"}" style="${"color: var(--" + escape(team) + "-secondary);"}">${escape(tableSnippet.rows[i].points)}</div>
        </div>`
			: `
        <div class="${"table-row"}"><div class="${"table-element table-position"}">${escape(tableSnippet.rows[i].position)}</div>
          <div class="${"table-element table-team-name"}">${escape(tableSnippet.rows[i].name)}</div>
          <div class="${"table-element table-gd"}">${escape(tableSnippet.rows[i].gd)}</div>
          <div class="${"table-element table-points"}">${escape(tableSnippet.rows[i].points)}</div>
        </div>`}`;
		})}
    ${tableSnippet.teamTableIdx != 6
		? `<div id="${"divider"}"></div>`
		: ``}`
	: ``}</div>`;
});

/* src\components\NextGame.svelte generated by Svelte v3.48.0 */

const NextGame = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let oppTeam;

	onMount(() => {
		if (data.upcoming[fullTeamName].nextTeam != null) {
			oppTeam = data.upcoming[fullTeamName].nextTeam.toLowerCase().replace(/ /g, "-");
		}
	});

	let { data, currentMatchday, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.currentMatchday === void 0 && $$bindings.currentMatchday && currentMatchday !== void 0) $$bindings.currentMatchday(currentMatchday);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);

	return `${data != undefined
	? `${data.upcoming[fullTeamName].nextTeam == null
		? `<div class="${"next-game-prediction row-graph"}"><div class="${"next-game-season-complete"}"><h1 class="${"next-game-title-text"}">${escape(data.currentSeason)}/${escape(data.currentSeason + 1)} SEASON COMPLETE
        </h1></div></div>`
		: `<div class="${"next-game-prediction row-graph"}" style="${"border: 6px solid var(--" + escape(data.upcoming[fullTeamName].nextTeam) + ");"}">${oppTeam != undefined
			? `<div class="${"next-game-title"}" style="${"background-color: var(--" + escape(oppTeam) + ");"}"><h1 class="${"next-game-title-text"}" style="${"color: var(--" + escape(oppTeam) + "-secondary);"}">Next Game:
            ${validate_component(Link, "Link").$$render($$result, { to: "/" + oppTeam }, {}, {
					default: () => {
						return `<div class="${"no-decoration"}" style="${"color: inherit"}">${escape(data.upcoming[fullTeamName].nextTeam)}</div>`;
					}
				})}<span class="${"parenthesis"}">(</span>${escape(data.upcoming[fullTeamName].atHome)}<span class="${"parenthesis"}">)</span></h1></div>`
			: ``}</div>

    <div class="${"next-game-values"}"><div class="${"predictions-and-logo"}"><div class="${"next-game-logo opposition-badge"}" style="${"background-image: url('" + escape(data.logoURLs[data.upcoming[fullTeamName].nextTeam]) + "')"}"></div>
        <div class="${"predictions"}"><div class="${"next-game-item"}">Current form:
            <b>${escape(data.form[data.upcoming[fullTeamName].nextTeam][currentMatchday].formRating5)}%</b></div>
          <div class="${"next-game-item"}">Score prediction
            <br>
            <a class="${"predictions-link"}" href="${"/predictions"}"><b>${escape(data.upcoming.prediction.scoreline)}</b></a>
            <br>
            <span class="${"accuracy-item"}">Predicting with accuracy:
              <b>${escape(data.upcoming.prediction[fullTeamName].accuracy)}%</b></span><br>
            <div class="${"accuracy-item"}">General results accuracy:
              <b>${escape(data.upcoming.prediction[fullTeamName].resultsAccuracy)}%</b></div></div></div></div>
      <div class="${"past-results"}">${data.upcoming[fullTeamName].previousMatches.length == 0
			? `<div class="${"next-game-item prev-results-title"}">No Previous Results
          </div>`
			: `<div class="${"next-game-item prev-results-title"}">Previous Results</div>`}

        
        ${each(data.upcoming[fullTeamName].previousMatches, prevMatch => {
				return `<div class="${"next-game-item " + escape(prevMatch.oppTeam)}"><div class="${"past-result"}"><div class="${"home-team"}">${escape(prevMatch.homeTeam)}</div>
              <div class="${"score"}">${escape(prevMatch.homeGoals)} - ${escape(prevMatch.awayGoals)}</div>
              <div class="${"away-team"}">${escape(prevMatch.awayTeam)}</div></div>
            <div style="${"clear: both"}"></div>
            <div class="${"past-result-date"}">${escape(prevMatch.date)}</div>
          </div>`;
			})}</div></div>`}`
	: ``}`;
});

/* src\components\SeasonStats.svelte generated by Svelte v3.48.0 */

function ordinal(n) {
	var ord = [,"st", "nd", "rd"];
	var a = n % 100;
	return n + (ord[a > 20 ? a % 10 : a] || "th");
}

function getStatsRank(data, attribute, fullTeamName, reverse) {
	let sorted = Object.keys(data.seasonStats).sort(function (a, b) {
		return data.seasonStats[b][attribute] - data.seasonStats[a][attribute];
	});

	let rank = sorted.indexOf(fullTeamName) + 1;

	if (reverse) {
		rank = 21 - rank;
	}

	return rank;
}

function getStatsRankings(data, fullTeamName) {
	let xGRank = ordinal(getStatsRank(data, "xG", fullTeamName, false));

	// Reverse - lower rank the better
	let xCRank = ordinal(getStatsRank(data, "xC", fullTeamName, true));

	let cleanSheetRatioRank = ordinal(getStatsRank(data, "cleanSheetRatio", fullTeamName, false));

	return {
		xG: xGRank,
		xC: xCRank,
		cleanSheetRatio: cleanSheetRatioRank
	};
}

const SeasonStats = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function setPositionalOffset() {
		document.documentElement.style.setProperty("--ssp1-offset", -ssp1.clientWidth / 2 + "px");
		document.documentElement.style.setProperty("--ssp2-offset", -ssp2.clientWidth / 2 + "px");
		document.documentElement.style.setProperty("--ssp3-offset", -ssp3.clientWidth / 2 + "px");
	}

	let ssp1, ssp2, ssp3;
	let rank = { xG: "", xC: "", cleanSheetRatio: "" };

	onMount(() => {
		rank = getStatsRankings(data, fullTeamName);

		// Keep ordinal values at the correct offset
		window.addEventListener("resize", setPositionalOffset);

		// Once rank values have updated, init positional offset for ordinal values
		setTimeout(
			function () {
				setPositionalOffset();
			},
			0
		);
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);

	return `<div class="${"season-stats"}"><div class="${"season-stat goals-per-game"}"><div class="${"season-stat-value"}">${escape(data.seasonStats[fullTeamName].xG)}
      <div class="${"season-stat-position ssp-" + escape(rank.xG)}" id="${"ssp1"}"${add_attribute("this", ssp1, 0)}>${escape(rank.xG)}</div></div>
      <div class="${"season-stat-text"}">goals per game</div></div>
    <div class="${"season-stat conceded-per-game"}"><div class="${"season-stat-value"}">${escape(data.seasonStats[fullTeamName].xC)}
        <div class="${"season-stat-position ssp-" + escape(rank.xC)}" id="${"ssp2"}"${add_attribute("this", ssp2, 0)}>${escape(rank.xC)}</div></div>
      <div class="${"season-stat-text"}">conceded per game</div></div>
    <div class="${"season-stat clean-sheet-ratio"}"><div class="${"season-stat-value"}">${escape(data.seasonStats[fullTeamName].cleanSheetRatio)}
        <div class="${"season-stat-position ssp-" + escape(rank.cleanSheetRatio)}" id="${"ssp3"}"${add_attribute("this", ssp3, 0)}>${escape(rank.cleanSheetRatio)}</div></div>
      <div class="${"season-stat-text"}">clean sheets</div></div></div>`;
});

/* src\components\TeamsFooter.svelte generated by Svelte v3.48.0 */

const TeamsFooter = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { lastUpdated } = $$props;
	if ($$props.lastUpdated === void 0 && $$bindings.lastUpdated && lastUpdated !== void 0) $$bindings.lastUpdated(lastUpdated);

	return `<div class="${"teams-footer footer-text-colour"}"><a class="${"ko-fi"}" href="${"https://ko-fi.com/C0C069FOI"}" target="${"_blank"}"><img class="${"ko-fi-img"}" src="${"img/kofi.png"}" alt="${""}">
    <div class="${"ko-fi-text"}">Support Me</div></a>
  <div class="${"teams-footer-bottom"}">${lastUpdated != null
	? `<div class="${"last-updated"}">${escape(lastUpdated)} UTC</div>`
	: ``}
    <div class="${"footer-details"}"><div class="${"footer-detail footer-text-colour"}">Data provided by
        <a class="${"footer-text-colour underline"}" href="${"https://www.football-data.org/"}">football-data.org</a></div>
      <div class="${"footer-detail footer-text-colour"}">Graphs created using
        <a class="${"footer-text-colour underline"}" href="${"https://plotly.com/"}">Plotly</a></div>
      <div class="${"footer-detail footer-text-colour"}">Font made from
        <a class="${"footer-text-colour"}" href="${"http://www.onlinewebfonts.com"}">oNline Web Fonts</a>
        is licensed by CC BY 3.0
      </div></div>
    <div class="${"footer-bottom"}"><div class="${"created-by footer-text-colour"}">Created by Tom Draper</div>
      <div class="${"version footer-text-colour"}">v2.0</div></div></div></div>`;
});

/* src\components\Fixtures.svelte generated by Svelte v3.48.0 */

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

function getGraphData$4(data, fullTeamName) {
	// Build data to create a fixtures line graph displaying the date along the
	// x-axis and opponent strength along the y-axis
	let x = [];

	let y = [];
	let details = [];

	for (let matchday = 1; matchday <= 38; matchday++) {
		let match = data.fixtures[fullTeamName][matchday];
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

	sortByMatchDate(x, y, details);
	let now = Date.now();
	let sizes = Array(x.length).fill(14);
	sizes = increaseNextGameMarker(sizes, x, now, 26);
	let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);
	let yLabels = Array.from(Array(11), (_, i) => i * 10);
	let minX = new Date(x[0]);
	minX.setDate(minX.getDate() - 10);
	let maxX = new Date(Math.max(x[x.length - 1], now));
	maxX.setDate(maxX.getDate() + 10);

	let graphData = {
		data: [
			{
				x,
				y,
				type: "scatter",
				mode: "lines+markers",
				text: details,
				line: { color: "#737373" },
				marker: {
					size: sizes,
					colorscale: [
						[0, "#01c626"],
						[0.1, "#08a825"],
						[0.2, "#0b7c20"],
						[0.3, "#0a661b"],
						[0.4, "#064411"],
						[0.5, "#000000"],
						[0.6, "#5b1d15"],
						[0.7, "#85160f"],
						[0.8, "#ad1a10"],
						[0.9, "#db1a0d"],
						[1, "#fc1303"]
					],
					color: y
				},
				customdata: matchdays,
				hovertemplate: "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>"
			}
		],
		layout: {
			title: false,
			autosize: true,
			margin: { r: 20, l: 50, t: 0, b: 40, pad: 5 },
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
			shapes: [
				{
					type: "line",
					x0: now,
					y0: -4,
					x1: now,
					y1: 104,
					line: { color: "black", dash: "dot", width: 1 }
				}
			]
		},
		config: {
			responsive: true,
			showSendToCloud: false,
			displayModeBar: false
		}
	};

	return graphData;
}

const Fixtures = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let plotDiv;
	let graphData;

	onMount(() => {
		graphData = getGraphData$4(data, fullTeamName);
		let Plot = new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);

		// Once plot generated, add resizable attribute to it to shorten height for mobile view
		Plot.then(plot => {
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\FormOverTime.svelte generated by Svelte v3.48.0 */

function getLine$1(data, x, teamName, isMainTeam) {
	let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);
	let y = [];

	for (let i = 1; i <= 38; i++) {
		let form = data.form[teamName][i].formRating5;
		y.push(form * 100);
	}

	let lineVal;

	if (isMainTeam) {
		// Get team primary colour from css variable
		let teamKey = teamName[0].toLowerCase() + teamName.slice(1);

		teamKey = teamKey.replace(/ ([A-Z])/g, "-$1").toLowerCase();
		let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
		lineVal = { color: lineColor, width: 4 };
	} else {
		lineVal = { color: "#d3d3d3" };
	}

	let line = {
		x,
		y,
		name: teamName,
		mode: "lines",
		line: lineVal,
		text: matchdays,
		hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
		// hoverinfo: 'x+y',
		showlegend: false
	};

	return line;
}

function getMatchdayDates$3(data) {
	// Find median matchday date across all teams for each matchday
	let x = [];

	for (let i = 1; i <= 38; i++) {
		let matchdayDates = [];

		for (let team of data.teamNames) {
			matchdayDates.push(data.fixtures[team][i].date);
		}

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

function getGraphData$3(data, fullTeamName) {
	let x = getMatchdayDates$3(data); // All lines use the same x
	let lines = [];

	for (let i = 0; i < data.teamNames.length; i++) {
		if (data.teamNames[i] != fullTeamName) {
			let line = getLine$1(data, x, data.teamNames[i], false);
			lines.push(line);
		}
	}

	// Add this team last to ensure it overlaps all other lines
	let line = getLine$1(data, x, fullTeamName, true);

	lines.push(line);
	let yLabels = Array.from(Array(11), (_, i) => i * 10);

	let graphData = {
		data: lines,
		layout: {
			title: false,
			autosize: true,
			margin: { r: 20, l: 50, t: 0, b: 40, pad: 5 },
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
				tickvals: yLabels
			},
			xaxis: {
				linecolor: "black",
				showgrid: false,
				showline: false,
				fixedrange: true
			}
		},
		config: {
			responsive: true,
			showSendToCloud: false,
			displayModeBar: false
		}
	};

	return graphData;
}

const FormOverTime = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let plotDiv;
	let graphData;

	onMount(() => {
		graphData = getGraphData$3(data, fullTeamName);
		let Plot = new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);

		// Once plot generated, add resizable attribute to it to shorten height for mobile view
		Plot.then(plot => {
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\PositionOverTime.svelte generated by Svelte v3.48.0 */

function getLine(data, x, teamName, isMainTeam) {
	let matchdays = Array.from({ length: 38 }, (_, index) => index + 1);
	let y = [];

	for (let i = 1; i <= 38; i++) {
		let position = data.form[teamName][i].position;
		y.push(position);
	}

	let lineVal;

	if (isMainTeam) {
		// Get team primary colour from css variable
		let teamKey = teamName[0].toLowerCase() + teamName.slice(1);

		teamKey = teamKey.replace(/ ([A-Z])/g, '-$1').toLowerCase();
		let lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
		lineVal = { color: lineColor, width: 4 };
	} else {
		lineVal = { color: '#d3d3d3' };
	}

	let line = {
		x,
		y,
		name: teamName,
		mode: 'lines',
		line: lineVal,
		text: matchdays,
		hovertemplate: `<b>${teamName}</b><br>Matchday %{text}<br>%{x|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
		showlegend: false
	};

	return line;
}

function getMatchdayDates$2(data) {
	// Find median matchday date across all teams for each matchday
	let x = [];

	for (let i = 1; i <= 38; i++) {
		let matchdayDates = [];

		data.teamNames.forEach(team => {
			matchdayDates.push(data.fixtures[team][i].date);
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

function getGraphData$2(data, fullTeamName) {
	let x = getMatchdayDates$2(data); // All lines use the same x
	let lines = [];

	for (let i = 0; i < data.teamNames.length; i++) {
		if (data.teamNames[i] != fullTeamName) {
			let line = getLine(data, x, data.teamNames[i], false);
			lines.push(line);
		}
	}

	// Add this team last to ensure it overlaps all other lines
	let line = getLine(data, x, fullTeamName, true);

	lines.push(line);
	let yLabels = Array.from(Array(20), (_, i) => i + 1);

	let graphData = {
		data: lines,
		layout: {
			title: false,
			autosize: true,
			margin: { r: 20, l: 50, t: 0, b: 40, pad: 5 },
			hovermode: "closest",
			plot_bgcolor: "#fafafa",
			paper_bgcolor: "#fafafa",
			yaxis: {
				title: { text: "Form Rating" },
				gridcolor: "gray",
				showgrid: false,
				showline: false,
				zeroline: false,
				autorange: 'reversed',
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
					x0: x[0],
					y0: 4.5,
					x1: x[x.length - 1],
					y1: 0.5,
					line: { width: 0 },
					fillcolor: '#77DD77',
					opacity: 0.3,
					layer: 'below'
				},
				{
					type: "rect",
					x0: x[0],
					y0: 6.5,
					x1: x[x.length - 1],
					y1: 4.5,
					line: { width: 0 },
					fillcolor: '#4CDEEE',
					opacity: 0.3,
					layer: 'below'
				},
				{
					type: "rect",
					x0: x[0],
					y0: 20.5,
					x1: x[x.length - 1],
					y1: 17.5,
					line: { width: 0 },
					fillcolor: '#C23B22',
					opacity: 0.3,
					layer: 'below'
				}
			]
		},
		config: {
			responsive: true,
			showSendToCloud: false,
			displayModeBar: false
		}
	};

	return graphData;
}

const PositionOverTime = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let plotDiv;
	let graphData;

	onMount(() => {
		graphData = getGraphData$2(data, fullTeamName);
		let Plot = new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);

		// Once plot generated, add resizable attribute to it to shorten height for mobile view
		Plot.then(plot => {
			plot.children[0].children[0].classList.add('resizable-graph');
		});
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_scored_and_conceded\GoalsScoredAndConceded.svelte generated by Svelte v3.48.0 */

function getAvgGoalsPerGame(data) {
	let avgGoals = {};

	for (let team of data.teamNames) {
		for (let matchday of Object.keys(data.form[team])) {
			let [h, _, a] = data.form[team][matchday].score.split(" ");
			h = parseInt(h);
			a = parseInt(a);

			if (matchday in avgGoals) {
				avgGoals[matchday] += h + a;
			} else {
				avgGoals[matchday] = h + a;
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

	for (let matchday of Object.keys(data.form[team])) {
		let [h, _, a] = data.form[team][matchday].score.split(" ");
		h = parseInt(h);
		a = parseInt(a);

		if (data.form[team][matchday].atHome) {
			scored[matchday] = h;
			conceded[matchday] = a;
		} else {
			scored[matchday] = a;
			conceded[matchday] = h;
		}
	}

	return [scored, conceded];
}

function getMatchdayDates$1(data) {
	// Find median matchday date across all teams for each matchday
	let x = [];

	for (let i = 1; i <= 38; i++) {
		let matchdayDates = [];

		for (let team of data.teamNames) {
			matchdayDates.push(data.fixtures[team][i].date);
		}

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

function getGraphData$1(data, fullTeamName) {
	let avgGoals = getAvgGoalsPerGame(data);
	let x = getMatchdayDates$1(data);
	let matchdays = Object.keys(avgGoals);
	let [teamScored, teamConceded] = getTeamGoalsPerGame(data, fullTeamName);

	let graphData = {
		data: [
			{
				name: "Scored",
				type: "bar",
				x,
				y: Object.values(teamScored),
				text: matchdays,
				marker: { color: "#77DD77" },
				hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>"
			},
			{
				name: "Conceded",
				type: "bar",
				x,
				y: Object.values(teamConceded),
				text: matchdays,
				marker: { color: "C23B22" },
				hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>"
			},
			{
				name: "Avg",
				type: "line",
				x,
				y: Object.values(avgGoals),
				text: matchdays,
				hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals<extra></extra>",
				line: { color: "#0080FF", width: 2 }
			}
		],
		layout: {
			title: false,
			autosize: true,
			margin: { r: 20, l: 50, t: 0, b: 15, pad: 5 },
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
				fixedrange: true
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

	return graphData;
}

const GoalsScoredAndConceded = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let plotDiv;
	let graphData;

	onMount(() => {
		graphData = getGraphData$1(data, fullTeamName);
		let Plot = new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);

		// Once plot generated, add resizable attribute to it to shorten height for mobile view
		Plot.then(plot => {
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_scored_and_conceded\CleanSheets.svelte generated by Svelte v3.48.0 */

function getTeamCleanSheets(data, team) {
	let notCleanSheets = [];
	let cleanSheets = [];

	for (let matchday of Object.keys(data.form[team])) {
		let [h, _, a] = data.form[team][matchday].score.split(" ");
		h = parseInt(h);
		a = parseInt(a);

		if (data.form[team][matchday].atHome) {
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

	return [cleanSheets, notCleanSheets];
}

function getMatchdayDates(data) {
	// Find median matchday date across all teams for each matchday
	let x = [];

	for (let i = 1; i <= 38; i++) {
		let matchdayDates = [];

		for (let team of data.teamNames) {
			matchdayDates.push(data.fixtures[team][i].date);
		}

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

function getGraphData(data, fullTeamName) {
	let x = getMatchdayDates(data);
	let matchdays = Object.keys(data.form[fullTeamName]);
	let [cleanSheets, notCleanSheets] = getTeamCleanSheets(data, fullTeamName);

	let graphData = {
		data: [
			{
				name: "Clean sheets",
				type: "bar",
				x,
				y: cleanSheets,
				text: matchdays,
				marker: { color: "#77DD77" },
				hovertemplate: "<b>Clean sheet<extra></extra>",
				showlegend: false
			},
			{
				name: "Conceded",
				type: "bar",
				x,
				y: notCleanSheets,
				text: matchdays,
				marker: { color: "C23B22" },
				hovertemplate: "<b>Goals conceded<extra></extra>",
				showlegend: false
			}
		],
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
					x0: x[0],
					y0: 0.5,
					x1: x[x.length - 1],
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

	return graphData;
}

const CleanSheets = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let plotDiv;
	let graphData;

	onMount(() => {
		graphData = getGraphData(data, fullTeamName);
		new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_per_game\GoalsScoredFreq.svelte generated by Svelte v3.48.0 */

const GoalsScoredFreq = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getGraphData() {
		let xLabels = Object.keys(goalFreq);

		let graphData = {
			data: [
				{
					x: Object.keys(goalFreq),
					y: Object.values(goalFreq),
					type: "bar",
					name: "Avg",
					marker: { color: "#C6C6C6" },
					line: { width: 0 },
					hovertemplate: "%{x} goals in %{y} games<extra></extra>",
					hoverinfo: "x+y"
				},
				{
					x: Object.keys(teamScoredFreq),
					y: Object.values(teamScoredFreq),
					type: "bar",
					name: "Goals scored",
					marker: { color: "#77DD77" },
					line: { width: 0 },
					hovertemplate: "%{x} goals in %{y} games<extra></extra>",
					hoverinfo: "x+y",
					opacity: 0.6
				}
			],
			layout: {
				title: false,
				autosize: true,
				margin: { r: 0, l: 50, t: 0, b: 40, pad: 5 },
				hovermode: "closest",
				barmode: "overlay",
				bargap: 0,
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa",
				yaxis: {
					title: { text: "Frequency" },
					gridcolor: "gray",
					showgrid: false,
					showline: false,
					zeroline: false,
					fixedrange: true
				},
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

		return graphData;
	}

	let plotDiv, graphData;

	onMount(() => {
		graphData = getGraphData();
		let Plot = new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);

		// Once plot generated, add resizable attribute to it to shorten height for mobile view
		Plot.then(plot => {
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	});

	let { goalFreq, teamScoredFreq } = $$props;
	if ($$props.goalFreq === void 0 && $$bindings.goalFreq && goalFreq !== void 0) $$bindings.goalFreq(goalFreq);
	if ($$props.teamScoredFreq === void 0 && $$bindings.teamScoredFreq && teamScoredFreq !== void 0) $$bindings.teamScoredFreq(teamScoredFreq);
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_per_game\GoalsConcededFreq.svelte generated by Svelte v3.48.0 */

const GoalsConcededFreq = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	function getGraphData() {
		let xLabels = Object.keys(goalFreq);

		let graphData = {
			data: [
				{
					x: Object.keys(goalFreq),
					y: Object.values(goalFreq),
					type: "bar",
					name: "Avg",
					marker: { color: "#C6C6C6" },
					line: { width: 0 },
					hovertemplate: "%{x} goals in %{y} games<extra></extra>",
					hoverinfo: "x+y"
				},
				{
					x: Object.keys(teamConcededFreq),
					y: Object.values(teamConcededFreq),
					type: "bar",
					name: "Goals conceded",
					marker: { color: "#C23B22" },
					line: { width: 0 },
					hovertemplate: "%{x} goals in %{y} games<extra></extra>",
					hoverinfo: "x+y",
					opacity: 0.6
				}
			],
			layout: {
				title: false,
				autosize: true,
				margin: { r: 0, l: 50, t: 0, b: 40, pad: 5 },
				hovermode: "closest",
				barmode: "overlay",
				bargap: 0,
				plot_bgcolor: "#fafafa",
				paper_bgcolor: "#fafafa",
				yaxis: {
					title: { text: "Frequency" },
					gridcolor: "gray",
					showgrid: false,
					showline: false,
					zeroline: false,
					fixedrange: true
				},
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

	let plotDiv, graphData;

	onMount(() => {
		graphData = getGraphData();
		let Plot = new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);

		// Once plot generated, add resizable attribute to it to shorten height for mobile view
		Plot.then(plot => {
			plot.children[0].children[0].classList.add("resizable-graph");
		});
	});

	let { goalFreq, teamConcededFreq } = $$props;
	if ($$props.goalFreq === void 0 && $$bindings.goalFreq && goalFreq !== void 0) $$bindings.goalFreq(goalFreq);
	if ($$props.teamConcededFreq === void 0 && $$bindings.teamConcededFreq && teamConcededFreq !== void 0) $$bindings.teamConcededFreq(teamConcededFreq);
	return `<div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div>`;
});

/* src\components\goals_per_game\GoalsPerGame.svelte generated by Svelte v3.48.0 */

function avgGoalFrequencies(data) {
	let goalFreq = {};

	for (let team of data.teamNames) {
		for (let matchday of Object.keys(data.form[team])) {
			let score = data.form[team][matchday].score;

			if (score != null) {
				let [h, _, a] = score.split(" ");

				// Also collect opposition goals scored
				if (data.form[team][matchday].atHome) {
					if (h in goalFreq) {
						goalFreq[h] += 1;
					} else {
						goalFreq[h] = 1;
					}

					if (a in goalFreq) {
						goalFreq[a] += 1;
					} else {
						goalFreq[a] = 1;
					}
				}
			}
		}
	}

	// Divide by number of teams to get avg
	for (let goals of Object.keys(goalFreq)) {
		goalFreq[goals] /= 20;
	}

	return goalFreq;
}

function teamScoredFrequencies(data, team) {
	let goalFreq = {};

	for (let matchday of Object.keys(data.form[team])) {
		let score = data.form[team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");

			if (data.form[team][matchday].atHome) {
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

	return goalFreq;
}

function teamConcededFrequencies(data, team) {
	let goalFreq = {};

	for (let matchday of Object.keys(data.form[team])) {
		let score = data.form[team][matchday].score;

		if (score != null) {
			let [h, _, a] = score.split(" ");

			if (data.form[team][matchday].atHome) {
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

	return goalFreq;
}

const GoalsPerGame = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let goalFreq, teamScoredFreq, teamConcededFreq;

	onMount(() => {
		goalFreq = avgGoalFrequencies(data);
		teamScoredFreq = teamScoredFrequencies(data, fullTeamName);
		teamConcededFreq = teamConcededFrequencies(data, fullTeamName);
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);

	return `<div class="${"two-graphs"}"><div class="${"graph freq-graph mini-graph"}">${teamScoredFreq != undefined
	? `${validate_component(GoalsScoredFreq, "GoalsScoredFreq").$$render($$result, { goalFreq, teamScoredFreq }, {}, {})}`
	: ``}</div>
  <div class="${"graph freq-graph mini-graphh"}">${teamConcededFreq != undefined
	? `${validate_component(GoalsConcededFreq, "GoalsConcededFreq").$$render($$result, { goalFreq, teamConcededFreq }, {}, {})}`
	: ``}</div></div>`;
});

/* src\components\Spider.svelte generated by Svelte v3.48.0 */

function getTeamColor(teamName) {
	let teamKey = teamName[0].toLowerCase() + teamName.slice(1);
	teamKey = teamKey.replace(/ /g, "-").toLowerCase();
	let teamColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
	return teamColor;
}

function goalsPerSeason(data) {
	let attack = {};
	let maxGoals = Number.NEGATIVE_INFINITY;
	let minGoals = Number.POSITIVE_INFINITY;

	for (let teamName of data.teamNames) {
		let totalGoals = 0;
		let seasonsPlayed = 0;

		for (let year in data.standings[teamName]) {
			let goals = data.standings[teamName][year].gF;

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

		let goalsPerSeason = totalGoals / seasonsPlayed;
		attack[teamName] = goalsPerSeason;
	}

	return [attack, [minGoals, maxGoals]];
}

function scaleAttack(attack, range) {
	let [lower, upper] = range;

	for (let teamName in attack) {
		attack[teamName] = (attack[teamName] - lower) / (upper - lower) * 100;
	}

	return attack;
}

function insertAvgAttack(attack) {
	let totalAttack = 0;

	for (let teamName in attack) {
		totalAttack += attack[teamName];
	}

	attack.avg = totalAttack / Object.keys(attack).length;
}

function getAttack(data) {
	let [attack, maxGoals] = goalsPerSeason(data);
	attack = scaleAttack(attack, maxGoals);
	insertAvgAttack(attack);
	return attack;
}

function concededPerSeason(data) {
	let defence = {};
	let maxConceded = Number.NEGATIVE_INFINITY;
	let minConceded = Number.POSITIVE_INFINITY;

	for (let teamName of data.teamNames) {
		let totalGoals = 0;
		let seasonsPlayed = 0;

		for (let year in data.standings[teamName]) {
			let goals = data.standings[teamName][year].gA;

			if (goals > 0) {
				totalGoals += goals;

				if (goals > maxConceded) {
					maxConceded = goals;
				} else if (goals < minConceded) {
					minConceded = goals;
				}

				seasonsPlayed += 1;
			}
		}

		let goalsPerSeason = totalGoals / seasonsPlayed;
		defence[teamName] = goalsPerSeason;
	}

	return [defence, [minConceded, maxConceded]];
}

function scaleDefence(defence, range) {
	let [lower, upper] = range;

	for (let teamName in defence) {
		defence[teamName] = 100 - (defence[teamName] - lower) / (upper - lower) * 100;
	}

	return defence;
}

function insertAvgDefence(defence) {
	let totalAttack = 0;

	for (let teamName in defence) {
		totalAttack += defence[teamName];
	}

	defence.avg = totalAttack / Object.keys(defence).length;
}

function getDefence(data) {
	let [defence, range] = concededPerSeason(data);
	defence = scaleDefence(defence, range);
	insertAvgDefence(defence);
	return defence;
}

function getCleanSheets(data) {
	let cleanSheets = {};
	let maxCleanSheets = Number.NEGATIVE_INFINITY;

	for (let teamName of data.teamNames) {
		let nCleanSheets = 0;

		for (let matchday of Object.keys(data.form[teamName])) {
			let match = data.form[teamName][matchday];

			if (match.score != null) {
				let [h, _, a] = match.score.split(" ");

				if (match.atHome && a == 0) {
					nCleanSheets += 1;
				} else if (!match.atHome && h == 0) {
					nCleanSheets += 1;
				}
			}
		}

		if (nCleanSheets > maxCleanSheets) {
			maxCleanSheets = nCleanSheets;
		}

		cleanSheets[teamName] = nCleanSheets;
	}

	let totalCleanSheets = 0;

	for (let teamName of Object.keys(cleanSheets)) {
		cleanSheets[teamName] = cleanSheets[teamName] / maxCleanSheets * 100;
		totalCleanSheets += cleanSheets[teamName];
	}

	cleanSheets.avg = totalCleanSheets / Object.keys(cleanSheets).length;
	return cleanSheets;
}

function getConsistency(data) {
	let consistency = {};
	let maxConsistency = Number.NEGATIVE_INFINITY;

	for (let teamName of data.teamNames) {
		let backToBack = 0;
		let prevResult = null;

		for (let matchday of Object.keys(data.form[teamName])) {
			let match = data.form[teamName][matchday];

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

		if (backToBack > maxConsistency) {
			maxConsistency = backToBack;
		}

		consistency[teamName] = backToBack;
	}

	let totalConsistency = 0;

	for (let teamName of Object.keys(consistency)) {
		consistency[teamName] = consistency[teamName] / maxConsistency * 100;
		totalConsistency += consistency[teamName];
	}

	consistency.avg = totalConsistency / Object.keys(consistency).length;
	return consistency;
}

function getWinStreak(data) {
	let winStreaks = {};
	let maxWinStreaks = Number.NEGATIVE_INFINITY;

	for (let teamName of data.teamNames) {
		let winStreak = 0;
		let tempWinStreak = 0;

		for (let matchday of Object.keys(data.form[teamName])) {
			let match = data.form[teamName][matchday];

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

		if (winStreak > maxWinStreaks) {
			maxWinStreaks = winStreak;
		}

		winStreaks[teamName] = winStreak;
	}

	let totalWinStreaks = 0;

	for (let teamName of Object.keys(winStreaks)) {
		winStreaks[teamName] = winStreaks[teamName] / maxWinStreaks * 100;
		totalWinStreaks += winStreaks[teamName];
	}

	winStreaks.avg = totalWinStreaks / Object.keys(winStreaks).length;
	return winStreaks;
}

function removeItem(arr, value) {
	let index = arr.indexOf(value);

	if (index > -1) {
		arr.splice(index, 1);
	}

	return arr;
}

function getVsBig6(data) {
	let vsBig6 = {};
	let maxWinsVsBig6 = Number.NEGATIVE_INFINITY;

	for (let teamName of data.teamNames) {
		let big6 = [
			"Manchester United FC",
			"Liverpool FC",
			"Manchester City FC",
			"Arsenal FC",
			"Chelsea FC",
			"Tottenham Hotspurs FC"
		];

		big6 = removeItem(big6, teamName);
		let winsVsBig6 = 0;

		for (let matchday of Object.keys(data.form[teamName])) {
			let match = data.form[teamName][matchday];

			if (match.score != null && big6.includes(match.teamName)) {
				let [h, _, a] = match.score.split(" ");

				if (match.atHome && h > a || !match.atHome && h < a) {
					winsVsBig6 += 1;
				}
			}
		}

		if (winsVsBig6 > maxWinsVsBig6) {
			maxWinsVsBig6 = winsVsBig6;
		}

		vsBig6[teamName] = winsVsBig6;
	}

	let totalVsBig6 = 0;

	for (let teamName of Object.keys(vsBig6)) {
		vsBig6[teamName] = vsBig6[teamName] / maxWinsVsBig6 * 100;
		totalVsBig6 += vsBig6[teamName];
	}

	vsBig6.avg = totalVsBig6 / Object.keys(vsBig6).length;
	return vsBig6;
}

const Spider = create_ssr_component(($$result, $$props, $$bindings, slots) => {

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

	function initSpiderPlots(teamName) {
		let teamColor = getTeamColor(teamName);
		let avgData = avgScatterPlot();

		let teamData = scatterPlot(
			teamName,
			[
				attack[teamName],
				defence[teamName],
				cleanSheets[teamName],
				consistency[teamName],
				winStreaks[teamName],
				vsBig6[teamName]
			],
			teamColor
		);

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

	function getGraphData(data, teamName) {
		computePlotData(data);
		spiderPlots = initSpiderPlots(teamName);

		let graphData = {
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

		return graphData;
	}

	let labels = ["Attack", "Defence", "Clean Sheets", "Consistency", "Win Streak", "vs Big 6"];
	let attack;
	let defence;
	let cleanSheets;
	let consistency;
	let winStreaks;
	let vsBig6;
	let plotDiv;
	let spiderPlots;
	let graphData;

	onMount(() => {
		graphData = getGraphData(data, fullTeamName);
		let Plot = new Plotly.newPlot(plotDiv, graphData.data, graphData.layout, graphData.config);

		Plot.then(plot => {
			plot.children[0].children[0].classList.add("resizable-spider-chart");
		});

		// Add inner border radius to top and bottom teams
		document.getElementById('spider-opp-teams').children[0].classList.add('top-spider-opp-team-btn');

		document.getElementById('spider-opp-teams').children[18].classList.add('bottom-spider-opp-team-btn');
	});

	let { data, fullTeamName } = $$props;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	if ($$props.fullTeamName === void 0 && $$bindings.fullTeamName && fullTeamName !== void 0) $$bindings.fullTeamName(fullTeamName);

	return `<div class="${"spider-chart"}"><div id="${"plotly"}"><div id="${"plotDiv"}"${add_attribute("this", plotDiv, 0)}></div></div></div>
<div class="${"spider-opp-team-selector"}">
  <div class="${"spider-opp-team-btns"}" id="${"spider-opp-teams"}">${each(data.teamNames, teamName => {
		return `${teamName != fullTeamName
		? `<button class="${"spider-opp-team-btn"}">${escape(teamName)}</button>`
		: ``}`;
	})}</div></div>`;
});

/* src\routes\Team.svelte generated by Svelte v3.48.0 */

function toTitleCase(str) {
	return str.toLowerCase().split(" ").map(function (word) {
		return word.charAt(0).toUpperCase() + word.slice(1);
	}).join(" ").replace('And', 'and');
}

function getCurrentMatchday(data, fullTeamName) {
	console.log(data);

	return Object.keys(data.form[fullTeamName]).reduce((a, b) => data.form[fullTeamName][a] > data.form[fullTeamName][b]
	? a
	: b);
}

async function fetchData$1(address) {
	const response = await fetch(address);
	let json = await response.json();
	return json;
}

const Team = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let fullTeamName = "";
	let currentMatchday;
	let data;

	onMount(() => {
		fullTeamName = toTitleCase(team.replace(/\-/g, " "));

		fetchData$1("https://pldashboard.herokuapp.com/teams").then(json => {
			// Build teamData package from json data
			currentMatchday = getCurrentMatchday(json, fullTeamName);

			data = json;
			console.log(data);
		}).then(() => {
			window.dispatchEvent(new Event("resize"));
		});
	});

	let { team } = $$props;
	if ($$props.team === void 0 && $$bindings.team && team !== void 0) $$bindings.team(team);

	return `${($$result.head += `${($$result.title = `<title>${escape(fullTeamName)}</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div class="${"header"}" style="${"background-color: var(--" + escape(team) + ");"}"><div class="${"main-link title no-decoration"}" style="${"color: var(--" + escape(team + '-secondary') + ");"}">${escape(fullTeamName)}</div></div>

  ${data != undefined
			? `<div class="${"page-content"}"><div class="${"row"}">${`<div class="${"row-left position-no-badge"}"><div class="${"circles-background-container"}"><svg class="${"circles-background"}"><circle cx="${"300"}" cy="${"150"}" r="${"100"}" stroke-width="${"0"}" fill="${"var(--" + escape(team) + "-secondary)"}"></circle><circle cx="${"170"}" cy="${"170"}" r="${"140"}" stroke-width="${"0"}" fill="${"var(--" + escape(team) + ")"}"></circle><circle cx="${"300"}" cy="${"320"}" r="${"170"}" stroke-width="${"0"}" fill="${"var(--" + escape(team) + ")"}"></circle></svg></div>
            <div class="${"position-central"}">${escape(data.standings[fullTeamName][data.currentSeason].position)}</div></div>`}
        <div class="${"fixtures-graph row-graph"}"><h1 class="${"lowered"}">Fixtures</h1>
          <div class="${"graph mini-graph"}">${validate_component(Fixtures, "Fixtures").$$render($$result, { data, fullTeamName }, {}, {})}</div></div></div>

      <div class="${"row"}"><div class="${"row-left form-details"}">${validate_component(CurrentForm, "CurrentForm").$$render($$result, { data, currentMatchday, fullTeamName }, {}, {})}
          ${validate_component(TableSnippet, "TableSnippet").$$render($$result, { data, team, fullTeamName }, {}, {})}</div>
        ${validate_component(NextGame, "NextGame").$$render($$result, { data, currentMatchday, fullTeamName }, {}, {})}</div>

      <div class="${"row"}"><div class="${"form-graph row-graph"}"><h1 class="${"lowered"}">Form Over Time</h1>
          <div class="${"graph full-row-graph"}">${validate_component(FormOverTime, "FormOverTime").$$render($$result, { data, fullTeamName }, {}, {})}</div></div></div>

      <div class="${"row"}"><div class="${"position-over-time-graph row-graph"}"><h1 class="${"lowered"}">Position Over Time</h1>
          <div class="${"graph full-row-graph"}">${validate_component(PositionOverTime, "PositionOverTime").$$render($$result, { data, fullTeamName }, {}, {})}</div></div></div>

      <div class="${"row no-bottom-margin"}"><div class="${"goals-scored-vs-conceded-graph row-graph"}"><h1 class="${"lowered"}">Goals Scored and Conceded</h1>
          <div class="${"graph full-row-graph"}">${validate_component(GoalsScoredAndConceded, "GoalsScoredAndConceded").$$render($$result, { data, fullTeamName }, {}, {})}</div></div></div>

      <div class="${"row"}"><div class="${"row-graph"}"><div class="${"clean-sheets graph full-row-graph"}">${validate_component(CleanSheets, "CleanSheets").$$render($$result, { data, fullTeamName }, {}, {})}</div></div></div>

      <div class="${"season-stats-row"}">${validate_component(SeasonStats, "SeasonStats").$$render($$result, { data, fullTeamName }, {}, {})}</div>

      <div class="${"row"}"><div class="${"goals-freq-row row-graph"}"><h1>Goals Per Game</h1>
          ${validate_component(GoalsPerGame, "GoalFrequencies").$$render($$result, { data, fullTeamName }, {}, {})}</div></div>

      <div class="${"row"}"><div class="${"spider-chart-row row-graph"}"><div class="${"spider-chart-container"}">${validate_component(Spider, "Spider").$$render($$result, { data, fullTeamName }, {}, {})}</div></div></div>

      ${validate_component(TeamsFooter, "TeamsFooter").$$render($$result, { lastUpdated: data.lastUpdated }, {}, {})}</div>`
			: `<div class="${"loading-spinner-container"}"><div class="${"loading-spinner"}"></div></div>`}`;
		}
	})}`;
});

/* src\routes\Predictions.svelte generated by Svelte v3.48.0 */

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
		fetchData("https://pldashboard.herokuapp.com/predictions").then(json => {
			sortByDate(json);
			insertColours(json);
			console.log(json);
			data = json;
			console.log(data.predictions);
		});
	});

	return `${($$result.head += `${($$result.title = `<title>Predictions</title>`, "")}<meta name="${"description"}" content="${"Premier League Statistics Dashboard"}">`, "")}

${validate_component(Router, "Router").$$render($$result, {}, {}, {
		default: () => {
			return `<div class="${"predictions-header"}">${validate_component(Link, "Link").$$render(
				$$result,
				{
					class: "predictions-title main-link",
					style: "text-decoration: none",
					to: "/predictions"
				},
				{},
				{
					default: () => {
						return `Predictions`;
					}
				}
			)}</div>

  ${data != undefined
			? `<div class="${"page-content"}"><div class="${"accuracy-display"}"><div class="${"accuracy"}"><span class="${"accuracy-item"}">Predicting with accuracy: <b>${escape((data.accuracy.scoreAccuracy * 100).toFixed(2))}%</b></span><br>
          <div class="${"accuracy-item"}">General results accuracy: <b>${escape((data.accuracy.resultAccuracy * 100).toFixed(2))}%</b></div></div></div>

      <div class="${"predictions-container"}"><div class="${"predictions"}">${data.predictions != null
				? `${each(data.predictions, ({ _id, predictions }) => {
						return `<div class="${"date"}">${escape(_id)}</div>
              <div class="${"medium-predictions-divider"}"></div>
              
              ${each(predictions, pred => {
							return `<button class="${"prediction-container " + escape(pred.colour)}"><div class="${"prediction prediction-item"}"><div class="${"prediction-label"}">Predicted:</div>
                    <div class="${"prediction-value"}"><div class="${"prediction-initials"}">${escape(pred.home)}</div>
                      <div class="${"prediction-score"}">${escape(Math.round(pred.prediction.homeGoals))} - ${escape(Math.round(pred.prediction.awayGoals))}</div>
                      <div class="${"prediction-initials"}">${escape(pred.away)}</div>
                    </div></div>
                  ${pred.actual != null
							? `<div class="${"actual prediction-item"}"><div class="${"prediction-label"}">Actual:</div>
                      <div class="${"prediction-value"}"><div class="${"prediction-initials"}">${escape(pred.home)}</div>
                        <div class="${"prediction-score"}">${escape(pred.actual.homeGoals)} - ${escape(pred.actual.awayGoals)}</div>
                        <div class="${"prediction-initials"}">${escape(pred.away)}</div></div>
                    </div>`
							: `<div class="${"prediction-time"}">${escape(datetimeToTime(pred.datetime))}
                    </div>`}

                  
                  ${pred.prediction != null
							? `<div class="${"prediction-details"}"${add_attribute("id", pred._id, 0)}><div class="${"detailed-predicted-score"}"><b>${escape(pred.prediction.homeGoals)} - ${escape(pred.prediction.awayGoals)}</b></div>
                    </div>`
							: ``}
                </button>`;
						})}
              <div class="${"predictions-gap"}"></div>`;
					})}`
				: ``}</div></div></div>

    <div class="${"predictions-footer footer-text-colour"}"><div class="${"method-description"}">Predictions are calculated using previous results and then adjusting by
        recent form and home advantage.
      </div>
      </div>`
			: `<div class="${"loading-spinner-container"}"><div class="${"loading-spinner"}"></div></div>`}`;
		}
	})}`;
});

/* src\App.svelte generated by Svelte v3.48.0 */

const App = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { url = "" } = $$props;
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);

	return `${validate_component(Router, "Router").$$render($$result, { url }, {}, {
		default: () => {
			return `${validate_component(Route, "Route").$$render($$result, { path: "/", component: Home }, {}, {})}
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
					return `${validate_component(Team, "Team").$$render($$result, { team: params.team }, {}, {})}`;
				}
			})}`;
		}
	})}`;
});

module.exports = App;
