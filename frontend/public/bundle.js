
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
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
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_svg_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, svg_element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }
    function query_selector_all(selector, parent = document.body) {
        return Array.from(parent.querySelectorAll(selector));
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

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
    }
    function append_hydration_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append_hydration(target, node);
    }
    function insert_hydration_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert_hydration(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
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
    const { navigate } = globalHistory;

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

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    /* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.49.0 */

    function create_fragment$r(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$r.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$r($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, 'routes');
    	component_subscribe($$self, routes, value => $$invalidate(6, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(5, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(7, $base = value));

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

    	const writable_props = ['basepath', 'url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		setContext,
    		onMount,
    		writable,
    		derived,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		pick,
    		match,
    		stripSlashes,
    		combinePaths,
    		basepath,
    		url,
    		locationContext,
    		routerContext,
    		routes,
    		activeRoute,
    		hasActiveRoute,
    		location,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$location,
    		$routes,
    		$base
    	});

    	$$self.$inject_state = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 128) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			{
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 96) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			{
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		$location,
    		$routes,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$r, create_fragment$r, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$r.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.49.0 */

    const get_default_slot_changes = dirty => ({
    	params: dirty & /*routeParams*/ 4,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context = ctx => ({
    	params: /*routeParams*/ ctx[2],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block$b(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$7, create_else_block$7];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$b.name,
    		type: "if",
    		source: "(40:0) {#if $activeRoute !== null && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {:else}
    function create_else_block$7(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, routeParams, $location*/ 532)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$7.name,
    		type: "else",
    		source: "(43:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:2) {#if component !== null}
    function create_if_block_1$7(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[2],
    		/*routeProps*/ ctx[3]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, routeParams, routeProps*/ 28)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && { location: /*$location*/ ctx[4] },
    					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
    					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$7.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$q(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block$b(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$b(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$q.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$q($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Route', slots, ['default']);
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));

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

    	$$self.$$set = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('path' in $$new_props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('$$scope' in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onDestroy,
    		ROUTER,
    		LOCATION,
    		path,
    		component,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		location,
    		route,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), $$new_props));
    		if ('path' in $$props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
    		if ('routeParams' in $$props) $$invalidate(2, routeParams = $$new_props.routeParams);
    		if ('routeProps' in $$props) $$invalidate(3, routeProps = $$new_props.routeProps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 2) {
    			if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(2, routeParams = $activeRoute.params);
    			}
    		}

    		{
    			const { path, component, ...rest } = $$props;
    			$$invalidate(3, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		$activeRoute,
    		routeParams,
    		routeProps,
    		$location,
    		activeRoute,
    		location,
    		route,
    		path,
    		$$scope,
    		slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$q, create_fragment$q, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$q.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.49.0 */
    const file$o = "node_modules\\svelte-routing\\src\\Link.svelte";

    function create_fragment$p(ctx) {
    	let a;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		{ href: /*href*/ ctx[0] },
    		{ "aria-current": /*ariaCurrent*/ ctx[2] },
    		/*props*/ ctx[1],
    		/*$$restProps*/ ctx[6]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, "aria-current": true });
    			var a_nodes = children(a);
    			if (default_slot) default_slot.l(a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_attributes(a, a_data);
    			add_location(a, file$o, 40, 0, 1249);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*onClick*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 32768)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[15],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[15])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null),
    						null
    					);
    				}
    			}

    			set_attributes(a, a_data = get_spread_update(a_levels, [
    				(!current || dirty & /*href*/ 1) && { href: /*href*/ ctx[0] },
    				(!current || dirty & /*ariaCurrent*/ 4) && { "aria-current": /*ariaCurrent*/ ctx[2] },
    				dirty & /*props*/ 2 && /*props*/ ctx[1],
    				dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6]
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$p.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$p($$self, $$props, $$invalidate) {
    	let ariaCurrent;
    	const omit_props_names = ["to","replace","state","getProps"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $location;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Link', slots, ['default']);
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(14, $base = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(13, $location = value));
    	const dispatch = createEventDispatcher();
    	let href, isPartiallyCurrent, isCurrent, props;

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();

    			// Don't push another entry to the history stack when the user
    			// clicks on a Link to the page they are currently on.
    			const shouldReplace = $location.pathname === href || replace;

    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('to' in $$new_props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$new_props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$new_props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$new_props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('$$scope' in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		createEventDispatcher,
    		ROUTER,
    		LOCATION,
    		navigate,
    		startsWith,
    		resolve,
    		shouldNavigate,
    		to,
    		replace,
    		state,
    		getProps,
    		base,
    		location,
    		dispatch,
    		href,
    		isPartiallyCurrent,
    		isCurrent,
    		props,
    		onClick,
    		ariaCurrent,
    		$location,
    		$base
    	});

    	$$self.$inject_state = $$new_props => {
    		if ('to' in $$props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('href' in $$props) $$invalidate(0, href = $$new_props.href);
    		if ('isPartiallyCurrent' in $$props) $$invalidate(11, isPartiallyCurrent = $$new_props.isPartiallyCurrent);
    		if ('isCurrent' in $$props) $$invalidate(12, isCurrent = $$new_props.isCurrent);
    		if ('props' in $$props) $$invalidate(1, props = $$new_props.props);
    		if ('ariaCurrent' in $$props) $$invalidate(2, ariaCurrent = $$new_props.ariaCurrent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $base*/ 16512) {
    			$$invalidate(0, href = to === "/" ? $base.uri : resolve(to, $base.uri));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 8193) {
    			$$invalidate(11, isPartiallyCurrent = startsWith($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 8193) {
    			$$invalidate(12, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 4096) {
    			$$invalidate(2, ariaCurrent = isCurrent ? "page" : undefined);
    		}

    		if ($$self.$$.dirty & /*getProps, $location, href, isPartiallyCurrent, isCurrent*/ 15361) {
    			$$invalidate(1, props = getProps({
    				location: $location,
    				href,
    				isPartiallyCurrent,
    				isCurrent
    			}));
    		}
    	};

    	return [
    		href,
    		props,
    		ariaCurrent,
    		base,
    		location,
    		onClick,
    		$$restProps,
    		to,
    		replace,
    		state,
    		getProps,
    		isPartiallyCurrent,
    		isCurrent,
    		$location,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$p, create_fragment$p, safe_not_equal, {
    			to: 7,
    			replace: 8,
    			state: 9,
    			getProps: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$p.name
    		});
    	}

    	get to() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get state() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getProps() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getProps(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\routes\Teams.svelte generated by Svelte v3.49.0 */

    const { document: document_1$2 } = globals;
    const file$n = "src\\routes\\Teams.svelte";

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	child_ctx[3] = i;
    	return child_ctx;
    }

    // (76:4) <Link to="/">
    function create_default_slot_2$1(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("Premier League");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "Premier League");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "title main-link no-decoration");
    			add_location(div, file$n, 76, 6, 2716);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$1.name,
    		type: "slot",
    		source: "(76:4) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (83:8) <Link            to="/{team.toLowerCase().replace(/ /g, '-')}"            class="team-button"            id="team-{i + 1}"            style="background-color: var(--{team              .toLowerCase()              .replace(/ /g, '-')});"          >
    function create_default_slot_1$1(ctx) {
    	let div;
    	let t0_value = /*team*/ ctx[1] + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, style: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, t0_value);
    			div_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "main-link");
    			set_style(div, "color", "var(--" + /*team*/ ctx[1].toLowerCase().replace(/ /g, '-') + "-secondary)");
    			add_location(div, file$n, 90, 10, 3164);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t0);
    			insert_hydration_dev(target, t1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$1.name,
    		type: "slot",
    		source: "(83:8) <Link            to=\\\"/{team.toLowerCase().replace(/ /g, '-')}\\\"            class=\\\"team-button\\\"            id=\\\"team-{i + 1}\\\"            style=\\\"background-color: var(--{team              .toLowerCase()              .replace(/ /g, '-')});\\\"          >",
    		ctx
    	});

    	return block;
    }

    // (82:6) {#each teams as team, i (team)}
    function create_each_block$6(key_1, ctx) {
    	let first;
    	let link;
    	let current;

    	link = new Link({
    			props: {
    				to: "/" + /*team*/ ctx[1].toLowerCase().replace(/ /g, '-'),
    				class: "team-button",
    				id: "team-" + (/*i*/ ctx[3] + 1),
    				style: "background-color: var(--" + /*team*/ ctx[1].toLowerCase().replace(/ /g, '-') + ");",
    				$$slots: { default: [create_default_slot_1$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(link.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			first = empty();
    			claim_component(link.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, first, anchor);
    			mount_component(link, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const link_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				link_changes.$$scope = { dirty, ctx };
    			}

    			link.$set(link_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(link.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(link.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(link, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$6.name,
    		type: "each",
    		source: "(82:6) {#each teams as team, i (team)}",
    		ctx
    	});

    	return block;
    }

    // (74:0) <Router>
    function create_default_slot$5(ctx) {
    	let div0;
    	let link;
    	let t;
    	let div2;
    	let div1;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;

    	link = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_2$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	let each_value = /*teams*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*team*/ ctx[1];
    	validate_each_keys(ctx, each_value, get_each_context$6, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$6(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$6(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			create_component(link.$$.fragment);
    			t = space();
    			div2 = element("div");
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(link.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div1_nodes);
    			}

    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "header");
    			add_location(div0, file$n, 74, 2, 2669);
    			attr_dev(div1, "class", "teams svelte-i9b06i");
    			add_location(div1, file$n, 80, 4, 2838);
    			attr_dev(div2, "class", "page-content");
    			add_location(div2, file$n, 79, 2, 2806);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			mount_component(link, div0, null);
    			insert_hydration_dev(target, t, anchor);
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const link_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				link_changes.$$scope = { dirty, ctx };
    			}

    			link.$set(link_changes);

    			if (dirty & /*teams*/ 1) {
    				each_value = /*teams*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$6, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, outro_and_destroy_block, create_each_block$6, null, get_each_context$6);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(link.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(link.$$.fragment, local);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_component(link);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(74:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$o(ctx) {
    	let meta;
    	let t;
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1rqatx0\"]', document_1$2.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			document_1$2.title = "Premier League";
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$n, 70, 2, 2564);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1$2.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(meta);
    			if (detaching) detach_dev(t);
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$o($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Teams', slots, []);

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

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Teams> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Router,
    		Link,
    		onMount,
    		removeBorderRadius,
    		setBorderRadius,
    		teams
    	});

    	$$self.$inject_state = $$props => {
    		if ('teams' in $$props) $$invalidate(0, teams = $$props.teams);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [teams];
    }

    class Teams extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$o, create_fragment$o, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Teams",
    			options,
    			id: create_fragment$o.name
    		});
    	}
    }

    /* src\components\current_form\FormTiles.svelte generated by Svelte v3.49.0 */

    const file$m = "src\\components\\current_form\\FormTiles.svelte";

    function create_fragment$n(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t0_value = formatResult(/*form*/ ctx[0][0]) + "";
    	let t0;
    	let t1;
    	let div5;
    	let div4;
    	let div3;
    	let t2_value = formatResult(/*form*/ ctx[0][1]) + "";
    	let t2;
    	let t3;
    	let div8;
    	let div7;
    	let div6;
    	let t4_value = formatResult(/*form*/ ctx[0][2]) + "";
    	let t4;
    	let t5;
    	let div11;
    	let div10;
    	let div9;
    	let t6_value = formatResult(/*form*/ ctx[0][3]) + "";
    	let t6;
    	let t7;
    	let div14;
    	let div13;
    	let div12;
    	let t8_value = formatResult(/*form*/ ctx[0][4]) + "";
    	let t8;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div8 = element("div");
    			div7 = element("div");
    			div6 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			div14 = element("div");
    			div13 = element("div");
    			div12 = element("div");
    			t8 = text(t8_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { id: true, style: true, class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { id: true, style: true, class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t2 = claim_text(div3_nodes, t2_value);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t3 = claim_space(nodes);
    			div8 = claim_element(nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { id: true, style: true, class: true });
    			var div7_nodes = children(div7);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t4 = claim_text(div6_nodes, t4_value);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t5 = claim_space(nodes);
    			div11 = claim_element(nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { id: true, style: true, class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			t6 = claim_text(div9_nodes, t6_value);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t7 = claim_space(nodes);
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { id: true, style: true, class: true });
    			var div13_nodes = children(div13);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			t8 = claim_text(div12_nodes, t8_value);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "result svelte-1duemg");
    			add_location(div0, file$m, 32, 4, 795);
    			attr_dev(div1, "id", "formTile");
    			set_style(div1, "background", background(/*form*/ ctx[0][0], /*starTeams*/ ctx[1][0]));
    			attr_dev(div1, "class", "svelte-1duemg");
    			add_location(div1, file$m, 31, 2, 714);
    			attr_dev(div2, "class", "icon pos-0 svelte-1duemg");
    			add_location(div2, file$m, 30, 0, 686);
    			attr_dev(div3, "class", "result svelte-1duemg");
    			add_location(div3, file$m, 39, 4, 987);
    			attr_dev(div4, "id", "formTile");
    			set_style(div4, "background", background(/*form*/ ctx[0][1], /*starTeams*/ ctx[1][1]));
    			attr_dev(div4, "class", "svelte-1duemg");
    			add_location(div4, file$m, 38, 2, 906);
    			attr_dev(div5, "class", "icon pos-1 svelte-1duemg");
    			add_location(div5, file$m, 37, 0, 878);
    			attr_dev(div6, "class", "result svelte-1duemg");
    			add_location(div6, file$m, 46, 4, 1179);
    			attr_dev(div7, "id", "formTile");
    			set_style(div7, "background", background(/*form*/ ctx[0][2], /*starTeams*/ ctx[1][2]));
    			attr_dev(div7, "class", "svelte-1duemg");
    			add_location(div7, file$m, 45, 2, 1098);
    			attr_dev(div8, "class", "icon pos-2 svelte-1duemg");
    			add_location(div8, file$m, 44, 0, 1070);
    			attr_dev(div9, "class", "result svelte-1duemg");
    			add_location(div9, file$m, 53, 4, 1371);
    			attr_dev(div10, "id", "formTile");
    			set_style(div10, "background", background(/*form*/ ctx[0][3], /*starTeams*/ ctx[1][3]));
    			attr_dev(div10, "class", "svelte-1duemg");
    			add_location(div10, file$m, 52, 2, 1290);
    			attr_dev(div11, "class", "icon pos-3 svelte-1duemg");
    			add_location(div11, file$m, 51, 0, 1262);
    			attr_dev(div12, "class", "result svelte-1duemg");
    			add_location(div12, file$m, 60, 4, 1563);
    			attr_dev(div13, "id", "formTile");
    			set_style(div13, "background", background(/*form*/ ctx[0][4], /*starTeams*/ ctx[1][4]));
    			attr_dev(div13, "class", "svelte-1duemg");
    			add_location(div13, file$m, 59, 2, 1482);
    			attr_dev(div14, "class", "icon pos-4 svelte-1duemg");
    			add_location(div14, file$m, 58, 0, 1454);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			insert_hydration_dev(target, t1, anchor);
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, t2);
    			insert_hydration_dev(target, t3, anchor);
    			insert_hydration_dev(target, div8, anchor);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, t4);
    			insert_hydration_dev(target, t5, anchor);
    			insert_hydration_dev(target, div11, anchor);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, t6);
    			insert_hydration_dev(target, t7, anchor);
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, t8);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*form*/ 1 && t0_value !== (t0_value = formatResult(/*form*/ ctx[0][0]) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*form, starTeams*/ 3) {
    				set_style(div1, "background", background(/*form*/ ctx[0][0], /*starTeams*/ ctx[1][0]));
    			}

    			if (dirty & /*form*/ 1 && t2_value !== (t2_value = formatResult(/*form*/ ctx[0][1]) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*form, starTeams*/ 3) {
    				set_style(div4, "background", background(/*form*/ ctx[0][1], /*starTeams*/ ctx[1][1]));
    			}

    			if (dirty & /*form*/ 1 && t4_value !== (t4_value = formatResult(/*form*/ ctx[0][2]) + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*form, starTeams*/ 3) {
    				set_style(div7, "background", background(/*form*/ ctx[0][2], /*starTeams*/ ctx[1][2]));
    			}

    			if (dirty & /*form*/ 1 && t6_value !== (t6_value = formatResult(/*form*/ ctx[0][3]) + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*form, starTeams*/ 3) {
    				set_style(div10, "background", background(/*form*/ ctx[0][3], /*starTeams*/ ctx[1][3]));
    			}

    			if (dirty & /*form*/ 1 && t8_value !== (t8_value = formatResult(/*form*/ ctx[0][4]) + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*form, starTeams*/ 3) {
    				set_style(div13, "background", background(/*form*/ ctx[0][4], /*starTeams*/ ctx[1][4]));
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div8);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div11);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div14);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$n($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormTiles', slots, []);
    	let { form, starTeams } = $$props;
    	const writable_props = ['form', 'starTeams'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FormTiles> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('form' in $$props) $$invalidate(0, form = $$props.form);
    		if ('starTeams' in $$props) $$invalidate(1, starTeams = $$props.starTeams);
    	};

    	$$self.$capture_state = () => ({
    		background,
    		formatResult,
    		form,
    		starTeams
    	});

    	$$self.$inject_state = $$props => {
    		if ('form' in $$props) $$invalidate(0, form = $$props.form);
    		if ('starTeams' in $$props) $$invalidate(1, starTeams = $$props.starTeams);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [form, starTeams];
    }

    class FormTiles extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$n, create_fragment$n, safe_not_equal, { form: 0, starTeams: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormTiles",
    			options,
    			id: create_fragment$n.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*form*/ ctx[0] === undefined && !('form' in props)) {
    			console.warn("<FormTiles> was created without expected prop 'form'");
    		}

    		if (/*starTeams*/ ctx[1] === undefined && !('starTeams' in props)) {
    			console.warn("<FormTiles> was created without expected prop 'starTeams'");
    		}
    	}

    	get form() {
    		throw new Error("<FormTiles>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set form(value) {
    		throw new Error("<FormTiles>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get starTeams() {
    		throw new Error("<FormTiles>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set starTeams(value) {
    		throw new Error("<FormTiles>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\current_form\CurrentForm.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$b } = globals;
    const file$l = "src\\components\\current_form\\CurrentForm.svelte";

    // (67:0) {#if formInitials != undefined}
    function create_if_block_1$6(ctx) {
    	let div0;
    	let formtiles;
    	let t0;
    	let div6;
    	let div1;
    	let t1_value = /*formInitials*/ ctx[5][0] + "";
    	let t1;
    	let t2;
    	let div2;
    	let t3_value = /*formInitials*/ ctx[5][1] + "";
    	let t3;
    	let t4;
    	let div3;
    	let t5_value = /*formInitials*/ ctx[5][2] + "";
    	let t5;
    	let t6;
    	let div4;
    	let t7_value = /*formInitials*/ ctx[5][3] + "";
    	let t7;
    	let t8;
    	let div5;
    	let t9_value = /*formInitials*/ ctx[5][4] + "";
    	let t9;
    	let current;

    	formtiles = new FormTiles({
    			props: {
    				form: "" + (/*formIcons*/ ctx[3] + ","),
    				starTeams: /*formStarTeams*/ ctx[4]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			create_component(formtiles.$$.fragment);
    			t0 = space();
    			div6 = element("div");
    			div1 = element("div");
    			t1 = text(t1_value);
    			t2 = space();
    			div2 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			t5 = text(t5_value);
    			t6 = space();
    			div4 = element("div");
    			t7 = text(t7_value);
    			t8 = space();
    			div5 = element("div");
    			t9 = text(t9_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(formtiles.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t0 = claim_space(nodes);
    			div6 = claim_element(nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div1 = claim_element(div6_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t1 = claim_text(div1_nodes, t1_value);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div6_nodes);
    			div2 = claim_element(div6_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t3 = claim_text(div2_nodes, t3_value);
    			div2_nodes.forEach(detach_dev);
    			t4 = claim_space(div6_nodes);
    			div3 = claim_element(div6_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t5 = claim_text(div3_nodes, t5_value);
    			div3_nodes.forEach(detach_dev);
    			t6 = claim_space(div6_nodes);
    			div4 = claim_element(div6_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t7 = claim_text(div4_nodes, t7_value);
    			div4_nodes.forEach(detach_dev);
    			t8 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t9 = claim_text(div5_nodes, t9_value);
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "current-form-row icon-row svelte-11hg8fr");
    			add_location(div0, file$l, 67, 2, 2433);
    			attr_dev(div1, "class", "icon-name pos-0 svelte-11hg8fr");
    			add_location(div1, file$l, 71, 4, 2594);
    			attr_dev(div2, "class", "icon-name pos-1 svelte-11hg8fr");
    			add_location(div2, file$l, 72, 4, 2652);
    			attr_dev(div3, "class", "icon-name pos-2 svelte-11hg8fr");
    			add_location(div3, file$l, 73, 4, 2710);
    			attr_dev(div4, "class", "icon-name pos-3 svelte-11hg8fr");
    			add_location(div4, file$l, 74, 4, 2768);
    			attr_dev(div5, "class", "icon-name pos-4 svelte-11hg8fr");
    			add_location(div5, file$l, 75, 4, 2826);
    			attr_dev(div6, "class", "current-form-row name-row svelte-11hg8fr");
    			add_location(div6, file$l, 70, 2, 2549);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			mount_component(formtiles, div0, null);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div6, anchor);
    			append_hydration_dev(div6, div1);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div6, t2);
    			append_hydration_dev(div6, div2);
    			append_hydration_dev(div2, t3);
    			append_hydration_dev(div6, t4);
    			append_hydration_dev(div6, div3);
    			append_hydration_dev(div3, t5);
    			append_hydration_dev(div6, t6);
    			append_hydration_dev(div6, div4);
    			append_hydration_dev(div4, t7);
    			append_hydration_dev(div6, t8);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, t9);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const formtiles_changes = {};
    			if (dirty & /*formIcons*/ 8) formtiles_changes.form = "" + (/*formIcons*/ ctx[3] + ",");
    			if (dirty & /*formStarTeams*/ 16) formtiles_changes.starTeams = /*formStarTeams*/ ctx[4];
    			formtiles.$set(formtiles_changes);
    			if ((!current || dirty & /*formInitials*/ 32) && t1_value !== (t1_value = /*formInitials*/ ctx[5][0] + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t3_value !== (t3_value = /*formInitials*/ ctx[5][1] + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t5_value !== (t5_value = /*formInitials*/ ctx[5][2] + "")) set_data_dev(t5, t5_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t7_value !== (t7_value = /*formInitials*/ ctx[5][3] + "")) set_data_dev(t7, t7_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t9_value !== (t9_value = /*formInitials*/ ctx[5][4] + "")) set_data_dev(t9, t9_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(formtiles.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(formtiles.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_component(formtiles);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div6);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$6.name,
    		type: "if",
    		source: "(67:0) {#if formInitials != undefined}",
    		ctx
    	});

    	return block;
    }

    // (83:2) {:else}
    function create_else_block$6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "None");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$6.name,
    		type: "else",
    		source: "(83:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (81:2) {#if currentMatchday != null}
    function create_if_block$a(ctx) {
    	let span;
    	let t0_value = (/*data*/ ctx[0].form[/*team*/ ctx[2]][/*data*/ ctx[0]._id][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = text("%");
    			this.h();
    		},
    		l: function claim(nodes) {
    			span = claim_element(nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, t0_value);
    			t1 = claim_text(span_nodes, "%");
    			span_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "current-form-value svelte-11hg8fr");
    			add_location(span, file$l, 81, 4, 2979);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, span, anchor);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(span, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team, currentMatchday*/ 7 && t0_value !== (t0_value = (/*data*/ ctx[0].form[/*team*/ ctx[2]][/*data*/ ctx[0]._id][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(81:2) {#if currentMatchday != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$m(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let current;
    	let if_block0 = /*formInitials*/ ctx[5] != undefined && create_if_block_1$6(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*currentMatchday*/ ctx[1] != null) return create_if_block$a;
    		return create_else_block$6;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div = element("div");
    			t1 = text("Current form:\r\n  ");
    			if_block1.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			if (if_block0) if_block0.l(nodes);
    			t0 = claim_space(nodes);
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t1 = claim_text(div_nodes, "Current form:\r\n  ");
    			if_block1.l(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "current-form svelte-11hg8fr");
    			add_location(div, file$l, 78, 0, 2897);
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t1);
    			if_block1.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*formInitials*/ ctx[5] != undefined) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*formInitials*/ 32) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1$6(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$m($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CurrentForm', slots, []);

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
    		$$invalidate(3, formIcons = getFormIcons(data, team));
    		$$invalidate(4, formStarTeams = getFormStarTeams(data, team, matchdays));
    		$$invalidate(5, formInitials = getFormInitials(data, team, matchdays));
    	}

    	let formIcons, formStarTeams, formInitials;
    	let { data, currentMatchday, team, toInitials } = $$props;
    	const writable_props = ['data', 'currentMatchday', 'team', 'toInitials'];

    	Object_1$b.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CurrentForm> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('toInitials' in $$props) $$invalidate(6, toInitials = $$props.toInitials);
    	};

    	$$self.$capture_state = () => ({
    		FormTiles,
    		getSortedMatchdays,
    		getFormStarTeams,
    		getFormIcons,
    		getFormInitials,
    		latestNPlayedMatchdays,
    		setFormValues,
    		formIcons,
    		formStarTeams,
    		formInitials,
    		data,
    		currentMatchday,
    		team,
    		toInitials
    	});

    	$$self.$inject_state = $$props => {
    		if ('formIcons' in $$props) $$invalidate(3, formIcons = $$props.formIcons);
    		if ('formStarTeams' in $$props) $$invalidate(4, formStarTeams = $$props.formStarTeams);
    		if ('formInitials' in $$props) $$invalidate(5, formInitials = $$props.formInitials);
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('toInitials' in $$props) $$invalidate(6, toInitials = $$props.toInitials);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && setFormValues();
    		}
    	};

    	return [
    		data,
    		currentMatchday,
    		team,
    		formIcons,
    		formStarTeams,
    		formInitials,
    		toInitials
    	];
    }

    class CurrentForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$m, create_fragment$m, safe_not_equal, {
    			data: 0,
    			currentMatchday: 1,
    			team: 2,
    			toInitials: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CurrentForm",
    			options,
    			id: create_fragment$m.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[0] === undefined && !('data' in props)) {
    			console.warn("<CurrentForm> was created without expected prop 'data'");
    		}

    		if (/*currentMatchday*/ ctx[1] === undefined && !('currentMatchday' in props)) {
    			console.warn("<CurrentForm> was created without expected prop 'currentMatchday'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<CurrentForm> was created without expected prop 'team'");
    		}

    		if (/*toInitials*/ ctx[6] === undefined && !('toInitials' in props)) {
    			console.warn("<CurrentForm> was created without expected prop 'toInitials'");
    		}
    	}

    	get data() {
    		throw new Error("<CurrentForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<CurrentForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get currentMatchday() {
    		throw new Error("<CurrentForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentMatchday(value) {
    		throw new Error("<CurrentForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<CurrentForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<CurrentForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toInitials() {
    		throw new Error("<CurrentForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toInitials(value) {
    		throw new Error("<CurrentForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\TableSnippet.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$a } = globals;
    const file$k = "src\\components\\TableSnippet.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    // (47:2) {#if tableSnippet != undefined}
    function create_if_block$9(ctx) {
    	let div0;
    	let t0;
    	let div5;
    	let div1;
    	let t1;
    	let div2;
    	let t2;
    	let t3;
    	let div3;
    	let t4;
    	let t5;
    	let div4;
    	let t6;
    	let t7;
    	let t8;
    	let if_block_anchor;
    	let each_value = /*tableSnippet*/ ctx[3].rows;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
    	}

    	let if_block = /*tableSnippet*/ ctx[3].teamTableIdx != 6 && create_if_block_1$5(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div5 = element("div");
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = text("Team");
    			t3 = space();
    			div3 = element("div");
    			t4 = text("GD");
    			t5 = space();
    			div4 = element("div");
    			t6 = text("Points");
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			t0 = claim_space(nodes);
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div1 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div1).forEach(detach_dev);
    			t1 = claim_space(div5_nodes);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t2 = claim_text(div2_nodes, "Team");
    			div2_nodes.forEach(detach_dev);
    			t3 = claim_space(div5_nodes);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t4 = claim_text(div3_nodes, "GD");
    			div3_nodes.forEach(detach_dev);
    			t5 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t6 = claim_text(div4_nodes, "Points");
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t7 = claim_space(nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			t8 = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "divider");
    			add_location(div0, file$k, 47, 4, 1525);
    			attr_dev(div1, "class", "table-element table-position column-title svelte-1l9y3x9");
    			add_location(div1, file$k, 49, 6, 1585);
    			attr_dev(div2, "class", "table-element table-team-name column-title svelte-1l9y3x9");
    			add_location(div2, file$k, 50, 6, 1650);
    			attr_dev(div3, "class", "table-element table-gd column-title svelte-1l9y3x9");
    			add_location(div3, file$k, 51, 6, 1724);
    			attr_dev(div4, "class", "table-element table-points column-title svelte-1l9y3x9");
    			add_location(div4, file$k, 52, 6, 1789);
    			attr_dev(div5, "class", "table-row svelte-1l9y3x9");
    			add_location(div5, file$k, 48, 4, 1554);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div1);
    			append_hydration_dev(div5, t1);
    			append_hydration_dev(div5, div2);
    			append_hydration_dev(div2, t2);
    			append_hydration_dev(div5, t3);
    			append_hydration_dev(div5, div3);
    			append_hydration_dev(div3, t4);
    			append_hydration_dev(div5, t5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, t6);
    			insert_hydration_dev(target, t7, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration_dev(target, t8, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*hyphenatedTeam, tableSnippet, toAlias, switchTeam*/ 15) {
    				each_value = /*tableSnippet*/ ctx[3].rows;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$5(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$5(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t8.parentNode, t8);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (/*tableSnippet*/ ctx[3].teamTableIdx != 6) {
    				if (if_block) ; else {
    					if_block = create_if_block_1$5(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t7);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t8);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(47:2) {#if tableSnippet != undefined}",
    		ctx
    	});

    	return block;
    }

    // (62:85) 
    function create_if_block_5(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true });
    			children(div).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "id", "divider");
    			attr_dev(div, "class", "svelte-1l9y3x9");
    			add_location(div, file$k, 62, 8, 2143);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(62:85) ",
    		ctx
    	});

    	return block;
    }

    // (58:6) {#if i == 0}
    function create_if_block_3$4(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[10] != /*tableSnippet*/ ctx[3].teamTableIdx && create_if_block_4$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*i*/ ctx[10] != /*tableSnippet*/ ctx[3].teamTableIdx) {
    				if (if_block) ; else {
    					if_block = create_if_block_4$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$4.name,
    		type: "if",
    		source: "(58:6) {#if i == 0}",
    		ctx
    	});

    	return block;
    }

    // (59:8) {#if i != tableSnippet.teamTableIdx}
    function create_if_block_4$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true });
    			children(div).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "id", "divider");
    			attr_dev(div, "class", "svelte-1l9y3x9");
    			add_location(div, file$k, 59, 10, 2011);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(59:8) {#if i != tableSnippet.teamTableIdx}",
    		ctx
    	});

    	return block;
    }

    // (98:6) {:else}
    function create_else_block$5(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*row*/ ctx[8].position + "";
    	let t0;
    	let t1;
    	let button;
    	let t2_value = /*toAlias*/ ctx[1](/*row*/ ctx[8].name) + "";
    	let t2;
    	let t3;
    	let div1;
    	let t4_value = /*row*/ ctx[8].gd + "";
    	let t4;
    	let t5;
    	let div2;
    	let t6_value = /*row*/ ctx[8].points + "";
    	let t6;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[6](/*row*/ ctx[8]);
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			button = element("button");
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div2 = element("div");
    			t6 = text(t6_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div0 = claim_element(div3_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div3_nodes);
    			button = claim_element(div3_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t2 = claim_text(button_nodes, t2_value);
    			button_nodes.forEach(detach_dev);
    			t3 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t4 = claim_text(div1_nodes, t4_value);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "table-element table-position svelte-1l9y3x9");
    			add_location(div0, file$k, 100, 10, 3362);
    			attr_dev(button, "class", "table-element table-team-name svelte-1l9y3x9");
    			add_location(button, file$k, 103, 10, 3462);
    			attr_dev(div1, "class", "table-element table-gd svelte-1l9y3x9");
    			add_location(div1, file$k, 109, 10, 3687);
    			attr_dev(div2, "class", "table-element table-points svelte-1l9y3x9");
    			add_location(div2, file$k, 112, 10, 3775);
    			attr_dev(div3, "class", "table-row svelte-1l9y3x9");
    			add_location(div3, file$k, 99, 8, 3327);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div3, t1);
    			append_hydration_dev(div3, button);
    			append_hydration_dev(button, t2);
    			append_hydration_dev(div3, t3);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div3, t5);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, t6);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*tableSnippet*/ 8 && t0_value !== (t0_value = /*row*/ ctx[8].position + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*toAlias, tableSnippet*/ 10 && t2_value !== (t2_value = /*toAlias*/ ctx[1](/*row*/ ctx[8].name) + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*tableSnippet*/ 8 && t4_value !== (t4_value = /*row*/ ctx[8].gd + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*tableSnippet*/ 8 && t6_value !== (t6_value = /*row*/ ctx[8].points + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(98:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (66:6) {#if i == tableSnippet.teamTableIdx}
    function create_if_block_2$3(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*row*/ ctx[8].position + "";
    	let t0;
    	let t1;
    	let a;
    	let t2_value = /*toAlias*/ ctx[1](/*row*/ ctx[8].name) + "";
    	let t2;
    	let a_href_value;
    	let t3;
    	let div1;
    	let t4_value = /*row*/ ctx[8].gd + "";
    	let t4;
    	let t5;
    	let div2;
    	let t6_value = /*row*/ ctx[8].points + "";
    	let t6;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			a = element("a");
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div2 = element("div");
    			t6 = text(t6_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			div0 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div3_nodes);
    			a = claim_element(div3_nodes, "A", { href: true, class: true, style: true });
    			var a_nodes = children(a);
    			t2 = claim_text(a_nodes, t2_value);
    			a_nodes.forEach(detach_dev);
    			t3 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			t4 = claim_text(div1_nodes, t4_value);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div2_nodes = children(div2);
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "table-element table-position this-team svelte-1l9y3x9");
    			set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div0, file$k, 71, 10, 2454);
    			attr_dev(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			attr_dev(a, "class", "table-element table-team-name this-team svelte-1l9y3x9");
    			set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(a, file$k, 77, 10, 2652);
    			attr_dev(div1, "class", "table-element table-gd this-team svelte-1l9y3x9");
    			set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div1, file$k, 84, 10, 2890);
    			attr_dev(div2, "class", "table-element table-points this-team svelte-1l9y3x9");
    			set_style(div2, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div2, file$k, 90, 10, 3076);
    			attr_dev(div3, "class", "table-row this-team svelte-1l9y3x9");
    			set_style(div3, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(div3, file$k, 67, 8, 2326);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div3, t1);
    			append_hydration_dev(div3, a);
    			append_hydration_dev(a, t2);
    			append_hydration_dev(div3, t3);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div3, t5);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tableSnippet*/ 8 && t0_value !== (t0_value = /*row*/ ctx[8].position + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*toAlias, tableSnippet*/ 10 && t2_value !== (t2_value = /*toAlias*/ ctx[1](/*row*/ ctx[8].name) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*hyphenatedTeam*/ 1 && a_href_value !== (a_href_value = "/" + /*hyphenatedTeam*/ ctx[0])) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*tableSnippet*/ 8 && t4_value !== (t4_value = /*row*/ ctx[8].gd + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*tableSnippet*/ 8 && t6_value !== (t6_value = /*row*/ ctx[8].points + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div2, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div3, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(66:6) {#if i == tableSnippet.teamTableIdx}",
    		ctx
    	});

    	return block;
    }

    // (56:4) {#each tableSnippet.rows as row, i}
    function create_each_block$5(ctx) {
    	let t;
    	let if_block1_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[10] == 0) return create_if_block_3$4;
    		if (/*i*/ ctx[10] - 1 != /*tableSnippet*/ ctx[3].teamTableIdx && /*i*/ ctx[10] != /*tableSnippet*/ ctx[3].teamTableIdx) return create_if_block_5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*i*/ ctx[10] == /*tableSnippet*/ ctx[3].teamTableIdx) return create_if_block_2$3;
    		return create_else_block$5;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if_block1.c();
    			if_block1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block0) if_block0.l(nodes);
    			t = claim_space(nodes);
    			if_block1.l(nodes);
    			if_block1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			if_block1.m(target, anchor);
    			insert_hydration_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(t.parentNode, t);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block0) {
    				if_block0.d(detaching);
    			}

    			if (detaching) detach_dev(t);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(56:4) {#each tableSnippet.rows as row, i}",
    		ctx
    	});

    	return block;
    }

    // (119:4) {#if tableSnippet.teamTableIdx != 6}
    function create_if_block_1$5(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true });
    			children(div).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "id", "divider");
    			attr_dev(div, "class", "svelte-1l9y3x9");
    			add_location(div, file$k, 119, 6, 3951);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(119:4) {#if tableSnippet.teamTableIdx != 6}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$l(ctx) {
    	let div;
    	let if_block = /*tableSnippet*/ ctx[3] != undefined && create_if_block$9(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			if (if_block) if_block.l(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "table-snippet svelte-1l9y3x9");
    			add_location(div, file$k, 45, 0, 1457);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*tableSnippet*/ ctx[3] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$9(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$l($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TableSnippet', slots, []);

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

    		$$invalidate(3, tableSnippet = { teamTableIdx, rows });
    	}

    	let tableSnippet;
    	let { data, hyphenatedTeam, team, toAlias, switchTeam } = $$props;
    	const writable_props = ['data', 'hyphenatedTeam', 'team', 'toAlias', 'switchTeam'];

    	Object_1$a.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TableSnippet> was created with unknown prop '${key}'`);
    	});

    	const click_handler = row => {
    		switchTeam(row.name.toLowerCase().replace(/ /g, '-'));
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(4, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('team' in $$props) $$invalidate(5, team = $$props.team);
    		if ('toAlias' in $$props) $$invalidate(1, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(2, switchTeam = $$props.switchTeam);
    	};

    	$$self.$capture_state = () => ({
    		tableSnippetRange,
    		buildTableSnippet,
    		tableSnippet,
    		data,
    		hyphenatedTeam,
    		team,
    		toAlias,
    		switchTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('tableSnippet' in $$props) $$invalidate(3, tableSnippet = $$props.tableSnippet);
    		if ('data' in $$props) $$invalidate(4, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('team' in $$props) $$invalidate(5, team = $$props.team);
    		if ('toAlias' in $$props) $$invalidate(1, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(2, switchTeam = $$props.switchTeam);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 32) {
    			team && buildTableSnippet();
    		}
    	};

    	return [hyphenatedTeam, toAlias, switchTeam, tableSnippet, data, team, click_handler];
    }

    class TableSnippet extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$l, create_fragment$l, safe_not_equal, {
    			data: 4,
    			hyphenatedTeam: 0,
    			team: 5,
    			toAlias: 1,
    			switchTeam: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TableSnippet",
    			options,
    			id: create_fragment$l.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[4] === undefined && !('data' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'data'");
    		}

    		if (/*hyphenatedTeam*/ ctx[0] === undefined && !('hyphenatedTeam' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'hyphenatedTeam'");
    		}

    		if (/*team*/ ctx[5] === undefined && !('team' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'team'");
    		}

    		if (/*toAlias*/ ctx[1] === undefined && !('toAlias' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'toAlias'");
    		}

    		if (/*switchTeam*/ ctx[2] === undefined && !('switchTeam' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'switchTeam'");
    		}
    	}

    	get data() {
    		throw new Error("<TableSnippet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<TableSnippet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get hyphenatedTeam() {
    		throw new Error("<TableSnippet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hyphenatedTeam(value) {
    		throw new Error("<TableSnippet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<TableSnippet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<TableSnippet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toAlias() {
    		throw new Error("<TableSnippet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toAlias(value) {
    		throw new Error("<TableSnippet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get switchTeam() {
    		throw new Error("<TableSnippet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchTeam(value) {
    		throw new Error("<TableSnippet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\NextGame.svelte generated by Svelte v3.49.0 */

    const file$j = "src\\components\\NextGame.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    // (27:0) {#if data != undefined}
    function create_if_block$8(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam == null) return create_if_block_1$4;
    		return create_else_block$4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(27:0) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (36:2) {:else}
    function create_else_block$4(ctx) {
    	let div9;
    	let div0;
    	let h1;
    	let t0;
    	let button;
    	let t1_value = /*toAlias*/ ctx[4](/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam) + "";
    	let t1;
    	let t2;
    	let t3;

    	let t4_value = (/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].atHome
    	? "Home"
    	: "Away") + "";

    	let t4;
    	let t5;
    	let t6;
    	let div8;
    	let div6;
    	let t7;
    	let div5;
    	let div2;
    	let div1;
    	let t8_value = /*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*data*/ ctx[0]._id].position + "";
    	let t8;
    	let span;
    	let t9_value = ordinal$1(/*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*data*/ ctx[0]._id].position) + "";
    	let t9;
    	let t10;
    	let div3;
    	let t11;
    	let t12;
    	let div4;
    	let t13;
    	let br0;
    	let t14;
    	let a;
    	let b;
    	let t15_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prediction.homeGoals) + "";
    	let t15;
    	let t16;
    	let t17_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prediction.awayGoals) + "";
    	let t17;
    	let t18;
    	let br1;
    	let t19;
    	let div7;
    	let t20;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*showBadge*/ ctx[3]) return create_if_block_4;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*currentMatchday*/ ctx[1] != null) return create_if_block_3$3;
    		return create_else_block_2$1;
    	}

    	let current_block_type_1 = select_block_type_2(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	function select_block_type_3(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prevMatches.length == 0) return create_if_block_2$2;
    		return create_else_block_1$3;
    	}

    	let current_block_type_2 = select_block_type_3(ctx);
    	let if_block2 = current_block_type_2(ctx);
    	let each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prevMatches;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Next Game: \r\n          ");
    			button = element("button");
    			t1 = text(t1_value);
    			t2 = text(" ");
    			t3 = text("\r\n          (");
    			t4 = text(t4_value);
    			t5 = text(")");
    			t6 = space();
    			div8 = element("div");
    			div6 = element("div");
    			if_block0.c();
    			t7 = space();
    			div5 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			t8 = text(t8_value);
    			span = element("span");
    			t9 = text(t9_value);
    			t10 = space();
    			div3 = element("div");
    			t11 = text("Current form:\r\n              ");
    			if_block1.c();
    			t12 = space();
    			div4 = element("div");
    			t13 = text("Score prediction\r\n              ");
    			br0 = element("br");
    			t14 = space();
    			a = element("a");
    			b = element("b");
    			t15 = text(t15_value);
    			t16 = text(" - ");
    			t17 = text(t17_value);
    			t18 = space();
    			br1 = element("br");
    			t19 = space();
    			div7 = element("div");
    			if_block2.c();
    			t20 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div9 = claim_element(nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div0 = claim_element(div9_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Next Game: \r\n          ");
    			button = claim_element(h1_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t1 = claim_text(button_nodes, t1_value);
    			t2 = claim_text(button_nodes, " ");
    			button_nodes.forEach(detach_dev);
    			t3 = claim_text(h1_nodes, "\r\n          (");
    			t4 = claim_text(h1_nodes, t4_value);
    			t5 = claim_text(h1_nodes, ")");
    			h1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t6 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div6 = claim_element(div8_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			if_block0.l(div6_nodes);
    			t7 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t8 = claim_text(div1_nodes, t8_value);
    			span = claim_element(div1_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t9 = claim_text(span_nodes, t9_value);
    			span_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t10 = claim_space(div5_nodes);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t11 = claim_text(div3_nodes, "Current form:\r\n              ");
    			if_block1.l(div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			t12 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t13 = claim_text(div4_nodes, "Score prediction\r\n              ");
    			br0 = claim_element(div4_nodes, "BR", {});
    			t14 = claim_space(div4_nodes);
    			a = claim_element(div4_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			b = claim_element(a_nodes, "B", {});
    			var b_nodes = children(b);
    			t15 = claim_text(b_nodes, t15_value);
    			t16 = claim_text(b_nodes, " - ");
    			t17 = claim_text(b_nodes, t17_value);
    			b_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			t18 = claim_space(div4_nodes);
    			br1 = claim_element(div4_nodes, "BR", {});
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			t19 = claim_space(div8_nodes);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			if_block2.l(div7_nodes);
    			t20 = claim_space(div7_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div7_nodes);
    			}

    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "next-game-team-btn svelte-yed2u9");
    			add_location(button, file$j, 40, 10, 1150);
    			attr_dev(h1, "class", "next-game-title-text svelte-yed2u9");
    			add_location(h1, file$j, 38, 8, 1078);
    			attr_dev(div0, "class", "next-game-title svelte-yed2u9");
    			add_location(div0, file$j, 37, 6, 1039);
    			attr_dev(span, "class", "ordinal-position svelte-yed2u9");
    			add_location(span, file$j, 69, 28, 2179);
    			attr_dev(div1, "class", "next-game-position svelte-yed2u9");
    			add_location(div1, file$j, 67, 14, 2044);
    			attr_dev(div2, "class", "next-game-item svelte-yed2u9");
    			add_location(div2, file$j, 66, 12, 2000);
    			attr_dev(div3, "class", "next-game-item current-form svelte-yed2u9");
    			add_location(div3, file$j, 77, 12, 2451);
    			add_location(br0, file$j, 93, 14, 3026);
    			add_location(b, file$j, 95, 16, 3114);
    			attr_dev(a, "class", "predictions-link svelte-yed2u9");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file$j, 94, 14, 3048);
    			add_location(br1, file$j, 101, 14, 3348);
    			attr_dev(div4, "class", "next-game-item svelte-yed2u9");
    			add_location(div4, file$j, 91, 12, 2950);
    			attr_dev(div5, "class", "predictions");
    			add_location(div5, file$j, 65, 10, 1961);
    			attr_dev(div6, "class", "predictions-and-logo svelte-yed2u9");
    			add_location(div6, file$j, 54, 8, 1587);
    			attr_dev(div7, "class", "past-results svelte-yed2u9");
    			add_location(div7, file$j, 105, 8, 3418);
    			attr_dev(div8, "class", "next-game-values svelte-yed2u9");
    			add_location(div8, file$j, 53, 6, 1547);
    			attr_dev(div9, "class", "next-game-prediction svelte-yed2u9");
    			add_location(div9, file$j, 36, 4, 997);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div9, anchor);
    			append_hydration_dev(div9, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(h1, button);
    			append_hydration_dev(button, t1);
    			append_hydration_dev(button, t2);
    			append_hydration_dev(h1, t3);
    			append_hydration_dev(h1, t4);
    			append_hydration_dev(h1, t5);
    			append_hydration_dev(div9, t6);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div6);
    			if_block0.m(div6, null);
    			append_hydration_dev(div6, t7);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, t8);
    			append_hydration_dev(div1, span);
    			append_hydration_dev(span, t9);
    			append_hydration_dev(div5, t10);
    			append_hydration_dev(div5, div3);
    			append_hydration_dev(div3, t11);
    			if_block1.m(div3, null);
    			append_hydration_dev(div5, t12);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, t13);
    			append_hydration_dev(div4, br0);
    			append_hydration_dev(div4, t14);
    			append_hydration_dev(div4, a);
    			append_hydration_dev(a, b);
    			append_hydration_dev(b, t15);
    			append_hydration_dev(b, t16);
    			append_hydration_dev(b, t17);
    			append_hydration_dev(div4, t18);
    			append_hydration_dev(div4, br1);
    			append_hydration_dev(div8, t19);
    			append_hydration_dev(div8, div7);
    			if_block2.m(div7, null);
    			append_hydration_dev(div7, t20);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div7, null);
    			}

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*toAlias, data, team*/ 21 && t1_value !== (t1_value = /*toAlias*/ ctx[4](/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam) + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*data, team*/ 5 && t4_value !== (t4_value = (/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].atHome
    			? "Home"
    			: "Away") + "")) set_data_dev(t4, t4_value);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div6, t7);
    				}
    			}

    			if (dirty & /*data, team*/ 5 && t8_value !== (t8_value = /*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*data*/ ctx[0]._id].position + "")) set_data_dev(t8, t8_value);
    			if (dirty & /*data, team*/ 5 && t9_value !== (t9_value = ordinal$1(/*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*data*/ ctx[0]._id].position) + "")) set_data_dev(t9, t9_value);

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_2(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div3, null);
    				}
    			}

    			if (dirty & /*data, team*/ 5 && t15_value !== (t15_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prediction.homeGoals) + "")) set_data_dev(t15, t15_value);
    			if (dirty & /*data, team*/ 5 && t17_value !== (t17_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prediction.awayGoals) + "")) set_data_dev(t17, t17_value);

    			if (current_block_type_2 !== (current_block_type_2 = select_block_type_3(ctx))) {
    				if_block2.d(1);
    				if_block2 = current_block_type_2(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div7, t20);
    				}
    			}

    			if (dirty & /*data, team, toInitials, resultColour, Date*/ 37) {
    				each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prevMatches;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div7, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);
    			if_block0.d();
    			if_block1.d();
    			if_block2.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(36:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (28:2) {#if data.upcoming[team].nextTeam == null}
    function create_if_block_1$4(ctx) {
    	let div1;
    	let div0;
    	let h1;
    	let t0_value = /*data*/ ctx[0]._id + "";
    	let t0;
    	let t1;
    	let t2_value = /*data*/ ctx[0]._id + 1 + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = text("/");
    			t2 = text(t2_value);
    			t3 = text(" SEASON COMPLETE");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, t0_value);
    			t1 = claim_text(h1_nodes, "/");
    			t2 = claim_text(h1_nodes, t2_value);
    			t3 = claim_text(h1_nodes, " SEASON COMPLETE");
    			h1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "next-game-title-text svelte-yed2u9");
    			add_location(h1, file$j, 30, 8, 853);
    			attr_dev(div0, "class", "next-game-season-complete svelte-yed2u9");
    			add_location(div0, file$j, 29, 6, 804);
    			attr_dev(div1, "class", "next-game-prediction svelte-yed2u9");
    			add_location(div1, file$j, 28, 4, 762);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(h1, t1);
    			append_hydration_dev(h1, t2);
    			append_hydration_dev(h1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*data*/ ctx[0]._id + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*data*/ ctx[0]._id + 1 + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(28:2) {#if data.upcoming[team].nextTeam == null}",
    		ctx
    	});

    	return block;
    }

    // (63:10) {:else}
    function create_else_block_3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			children(div).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "next-game-position svelte-yed2u9");
    			add_location(div, file$j, 63, 12, 1898);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(63:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (56:10) {#if showBadge}
    function create_if_block_4(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, style: true });
    			children(div).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "next-game-logo opposition-badge svelte-yed2u9");
    			set_style(div, "background-image", "url('" + /*data*/ ctx[0].logoURLs[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam] + "')");
    			add_location(div, file$j, 56, 12, 1662);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team*/ 5) {
    				set_style(div, "background-image", "url('" + /*data*/ ctx[0].logoURLs[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam] + "')");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(56:10) {#if showBadge}",
    		ctx
    	});

    	return block;
    }

    // (88:14) {:else}
    function create_else_block_2$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "None");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$1.name,
    		type: "else",
    		source: "(88:14) {:else}",
    		ctx
    	});

    	return block;
    }

    // (80:14) {#if currentMatchday != null}
    function create_if_block_3$3(ctx) {
    	let span;
    	let t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*data*/ ctx[0]._id][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = text("%");
    			this.h();
    		},
    		l: function claim(nodes) {
    			span = claim_element(nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, t0_value);
    			t1 = claim_text(span_nodes, "%");
    			span_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "current-form-value svelte-yed2u9");
    			add_location(span, file$j, 80, 16, 2584);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, span, anchor);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(span, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team, currentMatchday*/ 7 && t0_value !== (t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*data*/ ctx[0]._id][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$3.name,
    		type: "if",
    		source: "(80:14) {#if currentMatchday != null}",
    		ctx
    	});

    	return block;
    }

    // (111:10) {:else}
    function create_else_block_1$3(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("Previous Results");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "Previous Results");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "next-game-item prev-results-title svelte-yed2u9");
    			add_location(div, file$j, 111, 12, 3670);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$3.name,
    		type: "else",
    		source: "(111:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (107:10) {#if data.upcoming[team].prevMatches.length == 0}
    function create_if_block_2$2(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("No Previous Results");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "No Previous Results");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "next-game-item prev-results-title no-prev-results svelte-yed2u9");
    			add_location(div, file$j, 107, 12, 3519);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(107:10) {#if data.upcoming[team].prevMatches.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (118:10) {#each data.upcoming[team].prevMatches as prevMatch}
    function create_each_block$4(ctx) {
    	let div12;
    	let div0;

    	let t0_value = new Date(/*prevMatch*/ ctx[8].date).toLocaleDateString("en-GB", {
    		year: "numeric",
    		month: "short",
    		day: "numeric"
    	}) + "";

    	let t0;
    	let t1;
    	let div11;
    	let div9;
    	let div4;
    	let div1;
    	let t2_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[8].homeTeam) + "";
    	let t2;
    	let t3;
    	let div3;
    	let div2;
    	let t4_value = /*prevMatch*/ ctx[8].homeGoals + "";
    	let t4;
    	let t5;
    	let div8;
    	let div6;
    	let div5;
    	let t6_value = /*prevMatch*/ ctx[8].awayGoals + "";
    	let t6;
    	let t7;
    	let div7;
    	let t8_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[8].awayTeam) + "";
    	let t8;
    	let t9;
    	let div10;
    	let t10;

    	const block = {
    		c: function create() {
    			div12 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div11 = element("div");
    			div9 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div3 = element("div");
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div8 = element("div");
    			div6 = element("div");
    			div5 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			div7 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			div10 = element("div");
    			t10 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div12 = claim_element(nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div0 = claim_element(div12_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div12_nodes);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div9 = claim_element(div11_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div4 = claim_element(div9_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t5 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div6 = claim_element(div8_nodes, "DIV", { class: true, style: true });
    			var div6_nodes = children(div6);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t6 = claim_text(div5_nodes, t6_value);
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			t7 = claim_space(div8_nodes);
    			div7 = claim_element(div8_nodes, "DIV", { class: true, style: true });
    			var div7_nodes = children(div7);
    			t8 = claim_text(div7_nodes, t8_value);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			t9 = claim_space(div11_nodes);
    			div10 = claim_element(div11_nodes, "DIV", { style: true });
    			children(div10).forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t10 = claim_space(div12_nodes);
    			div12_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "past-result-date result-details svelte-yed2u9");
    			add_location(div0, file$j, 119, 14, 4017);
    			attr_dev(div1, "class", "home-team svelte-yed2u9");
    			set_style(div1, "background", "var(--" + /*prevMatch*/ ctx[8].homeTeam.toLowerCase().replace(/ /g, '-') + ")");
    			set_style(div1, "color", "var(--" + /*prevMatch*/ ctx[8].homeTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			add_location(div1, file$j, 129, 20, 4451);
    			attr_dev(div2, "class", "home-goals svelte-yed2u9");
    			add_location(div2, file$j, 146, 22, 5300);
    			attr_dev(div3, "class", "goals-container svelte-yed2u9");
    			set_style(div3, "background", "var(--" + resultColour(/*prevMatch*/ ctx[8], true).toLowerCase().replace(/ /g, '-') + ")");
    			set_style(div3, "color", "var(--" + resultColour(/*prevMatch*/ ctx[8], true).toLowerCase().replace(/ /g, '-') + "-secondary)");
    			add_location(div3, file$j, 139, 20, 4912);
    			attr_dev(div4, "class", "left-side svelte-yed2u9");
    			add_location(div4, file$j, 128, 18, 4406);
    			attr_dev(div5, "class", "away-goals svelte-yed2u9");
    			add_location(div5, file$j, 159, 22, 5913);
    			attr_dev(div6, "class", "goals-container svelte-yed2u9");
    			set_style(div6, "background", "var(--" + resultColour(/*prevMatch*/ ctx[8], false).toLowerCase().replace(/ /g, '-') + ")");
    			set_style(div6, "color", "var(--" + resultColour(/*prevMatch*/ ctx[8], false).toLowerCase().replace(/ /g, '-') + "-secondary)");
    			add_location(div6, file$j, 152, 20, 5521);
    			attr_dev(div7, "class", "away-team svelte-yed2u9");
    			set_style(div7, "background", "var(--" + /*prevMatch*/ ctx[8].awayTeam.toLowerCase().replace(/ /g, '-') + ")");
    			set_style(div7, "color", "var(--" + /*prevMatch*/ ctx[8].awayTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			add_location(div7, file$j, 163, 20, 6064);
    			attr_dev(div8, "class", "right-side svelte-yed2u9");
    			add_location(div8, file$j, 151, 18, 5475);
    			attr_dev(div9, "class", "past-result svelte-yed2u9");
    			add_location(div9, file$j, 127, 16, 4361);
    			set_style(div10, "clear", "both");
    			add_location(div10, file$j, 175, 16, 6571);
    			attr_dev(div11, "class", "next-game-item result-details svelte-yed2u9");
    			add_location(div11, file$j, 126, 14, 4300);
    			attr_dev(div12, "class", "next-game-item-container");
    			add_location(div12, file$j, 118, 12, 3963);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div12, anchor);
    			append_hydration_dev(div12, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div12, t1);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div9);
    			append_hydration_dev(div9, div4);
    			append_hydration_dev(div4, div1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div4, t3);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, t4);
    			append_hydration_dev(div9, t5);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div6);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, t6);
    			append_hydration_dev(div8, t7);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, t8);
    			append_hydration_dev(div11, t9);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div12, t10);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team*/ 5 && t0_value !== (t0_value = new Date(/*prevMatch*/ ctx[8].date).toLocaleDateString("en-GB", {
    				year: "numeric",
    				month: "short",
    				day: "numeric"
    			}) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*toInitials, data, team*/ 37 && t2_value !== (t2_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[8].homeTeam) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*data, team*/ 5) {
    				set_style(div1, "background", "var(--" + /*prevMatch*/ ctx[8].homeTeam.toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*data, team*/ 5) {
    				set_style(div1, "color", "var(--" + /*prevMatch*/ ctx[8].homeTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*data, team*/ 5 && t4_value !== (t4_value = /*prevMatch*/ ctx[8].homeGoals + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*data, team*/ 5) {
    				set_style(div3, "background", "var(--" + resultColour(/*prevMatch*/ ctx[8], true).toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*data, team*/ 5) {
    				set_style(div3, "color", "var(--" + resultColour(/*prevMatch*/ ctx[8], true).toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*data, team*/ 5 && t6_value !== (t6_value = /*prevMatch*/ ctx[8].awayGoals + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*data, team*/ 5) {
    				set_style(div6, "background", "var(--" + resultColour(/*prevMatch*/ ctx[8], false).toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*data, team*/ 5) {
    				set_style(div6, "color", "var(--" + resultColour(/*prevMatch*/ ctx[8], false).toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*toInitials, data, team*/ 37 && t8_value !== (t8_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[8].awayTeam) + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*data, team*/ 5) {
    				set_style(div7, "background", "var(--" + /*prevMatch*/ ctx[8].awayTeam.toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*data, team*/ 5) {
    				set_style(div7, "color", "var(--" + /*prevMatch*/ ctx[8].awayTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div12);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(118:10) {#each data.upcoming[team].prevMatches as prevMatch}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$k(ctx) {
    	let if_block_anchor;
    	let if_block = /*data*/ ctx[0] != undefined && create_if_block$8(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*data*/ ctx[0] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$8(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function ordinal$1(n) {
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

    function instance$k($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NextGame', slots, []);
    	let { data, currentMatchday, team, showBadge, toAlias, toInitials, switchTeam } = $$props;

    	const writable_props = [
    		'data',
    		'currentMatchday',
    		'team',
    		'showBadge',
    		'toAlias',
    		'toInitials',
    		'switchTeam'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<NextGame> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		switchTeam(data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, "-"));
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('showBadge' in $$props) $$invalidate(3, showBadge = $$props.showBadge);
    		if ('toAlias' in $$props) $$invalidate(4, toAlias = $$props.toAlias);
    		if ('toInitials' in $$props) $$invalidate(5, toInitials = $$props.toInitials);
    		if ('switchTeam' in $$props) $$invalidate(6, switchTeam = $$props.switchTeam);
    	};

    	$$self.$capture_state = () => ({
    		ordinal: ordinal$1,
    		resultColour,
    		data,
    		currentMatchday,
    		team,
    		showBadge,
    		toAlias,
    		toInitials,
    		switchTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('showBadge' in $$props) $$invalidate(3, showBadge = $$props.showBadge);
    		if ('toAlias' in $$props) $$invalidate(4, toAlias = $$props.toAlias);
    		if ('toInitials' in $$props) $$invalidate(5, toInitials = $$props.toInitials);
    		if ('switchTeam' in $$props) $$invalidate(6, switchTeam = $$props.switchTeam);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		data,
    		currentMatchday,
    		team,
    		showBadge,
    		toAlias,
    		toInitials,
    		switchTeam,
    		click_handler
    	];
    }

    class NextGame extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$k, create_fragment$k, safe_not_equal, {
    			data: 0,
    			currentMatchday: 1,
    			team: 2,
    			showBadge: 3,
    			toAlias: 4,
    			toInitials: 5,
    			switchTeam: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NextGame",
    			options,
    			id: create_fragment$k.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[0] === undefined && !('data' in props)) {
    			console.warn("<NextGame> was created without expected prop 'data'");
    		}

    		if (/*currentMatchday*/ ctx[1] === undefined && !('currentMatchday' in props)) {
    			console.warn("<NextGame> was created without expected prop 'currentMatchday'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<NextGame> was created without expected prop 'team'");
    		}

    		if (/*showBadge*/ ctx[3] === undefined && !('showBadge' in props)) {
    			console.warn("<NextGame> was created without expected prop 'showBadge'");
    		}

    		if (/*toAlias*/ ctx[4] === undefined && !('toAlias' in props)) {
    			console.warn("<NextGame> was created without expected prop 'toAlias'");
    		}

    		if (/*toInitials*/ ctx[5] === undefined && !('toInitials' in props)) {
    			console.warn("<NextGame> was created without expected prop 'toInitials'");
    		}

    		if (/*switchTeam*/ ctx[6] === undefined && !('switchTeam' in props)) {
    			console.warn("<NextGame> was created without expected prop 'switchTeam'");
    		}
    	}

    	get data() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get currentMatchday() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentMatchday(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showBadge() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showBadge(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toAlias() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toAlias(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toInitials() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toInitials(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get switchTeam() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchTeam(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_scored_and_conceded\StatsValues.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$9 } = globals;
    const file$i = "src\\components\\goals_scored_and_conceded\\StatsValues.svelte";

    // (131:0) {#if stats != undefined}
    function create_if_block$7(ctx) {
    	let div18;
    	let div5;
    	let div3;
    	let div0;
    	let t0_value = /*rank*/ ctx[2].xG + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xG.toFixed(2) + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*rank*/ ctx[2].xG + "";
    	let t4;
    	let div2_class_value;
    	let t5;
    	let div4;
    	let t6;
    	let t7;
    	let div11;
    	let div9;
    	let div6;
    	let t8_value = /*rank*/ ctx[2].xC + "";
    	let t8;
    	let t9;
    	let div7;
    	let t10_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xC.toFixed(2) + "";
    	let t10;
    	let t11;
    	let div8;
    	let t12_value = /*rank*/ ctx[2].xC + "";
    	let t12;
    	let div8_class_value;
    	let t13;
    	let div10;
    	let t14;
    	let t15;
    	let div17;
    	let div15;
    	let div12;
    	let t16_value = /*rank*/ ctx[2].cleanSheetRatio + "";
    	let t16;
    	let t17;
    	let div13;
    	let t18_value = /*stats*/ ctx[1][/*team*/ ctx[0]].cleanSheetRatio.toFixed(2) + "";
    	let t18;
    	let t19;
    	let div14;
    	let t20_value = /*rank*/ ctx[2].cleanSheetRatio + "";
    	let t20;
    	let div14_class_value;
    	let t21;
    	let div16;
    	let t22;

    	const block = {
    		c: function create() {
    			div18 = element("div");
    			div5 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div4 = element("div");
    			t6 = text("goals per game");
    			t7 = space();
    			div11 = element("div");
    			div9 = element("div");
    			div6 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			div7 = element("div");
    			t10 = text(t10_value);
    			t11 = space();
    			div8 = element("div");
    			t12 = text(t12_value);
    			t13 = space();
    			div10 = element("div");
    			t14 = text("conceded per game");
    			t15 = space();
    			div17 = element("div");
    			div15 = element("div");
    			div12 = element("div");
    			t16 = text(t16_value);
    			t17 = space();
    			div13 = element("div");
    			t18 = text(t18_value);
    			t19 = space();
    			div14 = element("div");
    			t20 = text(t20_value);
    			t21 = space();
    			div16 = element("div");
    			t22 = text("clean sheets");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div18 = claim_element(nodes, "DIV", { class: true });
    			var div18_nodes = children(div18);
    			div5 = claim_element(div18_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div0 = claim_element(div3_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t5 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t6 = claim_text(div4_nodes, "goals per game");
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t7 = claim_space(div18_nodes);
    			div11 = claim_element(div18_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div9 = claim_element(div11_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div6 = claim_element(div9_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t8 = claim_text(div6_nodes, t8_value);
    			div6_nodes.forEach(detach_dev);
    			t9 = claim_space(div9_nodes);
    			div7 = claim_element(div9_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			t10 = claim_text(div7_nodes, t10_value);
    			div7_nodes.forEach(detach_dev);
    			t11 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			t12 = claim_text(div8_nodes, t12_value);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			t13 = claim_space(div11_nodes);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			t14 = claim_text(div10_nodes, "conceded per game");
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t15 = claim_space(div18_nodes);
    			div17 = claim_element(div18_nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			div15 = claim_element(div17_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			div12 = claim_element(div15_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			t16 = claim_text(div12_nodes, t16_value);
    			div12_nodes.forEach(detach_dev);
    			t17 = claim_space(div15_nodes);
    			div13 = claim_element(div15_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			t18 = claim_text(div13_nodes, t18_value);
    			div13_nodes.forEach(detach_dev);
    			t19 = claim_space(div15_nodes);
    			div14 = claim_element(div15_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			t20 = claim_text(div14_nodes, t20_value);
    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			t21 = claim_space(div17_nodes);
    			div16 = claim_element(div17_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			t22 = claim_text(div16_nodes, "clean sheets");
    			div16_nodes.forEach(detach_dev);
    			div17_nodes.forEach(detach_dev);
    			div18_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "season-stat-position hidden svelte-1wquk6c");
    			add_location(div0, file$i, 134, 8, 4175);
    			attr_dev(div1, "class", "season-stat-number");
    			add_location(div1, file$i, 137, 8, 4263);
    			attr_dev(div2, "class", div2_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xG + " svelte-1wquk6c");
    			add_location(div2, file$i, 140, 8, 4360);
    			attr_dev(div3, "class", "season-stat-value svelte-1wquk6c");
    			add_location(div3, file$i, 133, 6, 4134);
    			attr_dev(div4, "class", "season-stat-text svelte-1wquk6c");
    			add_location(div4, file$i, 144, 6, 4467);
    			attr_dev(div5, "class", "season-stat goals-per-game svelte-1wquk6c");
    			add_location(div5, file$i, 132, 4, 4086);
    			attr_dev(div6, "class", "season-stat-position hidden svelte-1wquk6c");
    			add_location(div6, file$i, 148, 8, 4627);
    			attr_dev(div7, "class", "season-stat-number");
    			add_location(div7, file$i, 151, 8, 4715);
    			attr_dev(div8, "class", div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xC + " svelte-1wquk6c");
    			add_location(div8, file$i, 154, 8, 4812);
    			attr_dev(div9, "class", "season-stat-value svelte-1wquk6c");
    			add_location(div9, file$i, 147, 6, 4586);
    			attr_dev(div10, "class", "season-stat-text svelte-1wquk6c");
    			add_location(div10, file$i, 158, 6, 4919);
    			attr_dev(div11, "class", "season-stat conceded-per-game svelte-1wquk6c");
    			add_location(div11, file$i, 146, 4, 4535);
    			attr_dev(div12, "class", "season-stat-position hidden svelte-1wquk6c");
    			add_location(div12, file$i, 162, 8, 5082);
    			attr_dev(div13, "class", "season-stat-number");
    			add_location(div13, file$i, 165, 8, 5183);
    			attr_dev(div14, "class", div14_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].cleanSheetRatio + " svelte-1wquk6c");
    			add_location(div14, file$i, 168, 8, 5293);
    			attr_dev(div15, "class", "season-stat-value svelte-1wquk6c");
    			add_location(div15, file$i, 161, 6, 5041);
    			attr_dev(div16, "class", "season-stat-text svelte-1wquk6c");
    			add_location(div16, file$i, 172, 6, 5426);
    			attr_dev(div17, "class", "season-stat clean-sheet-ratio svelte-1wquk6c");
    			add_location(div17, file$i, 160, 4, 4990);
    			attr_dev(div18, "class", "season-stats svelte-1wquk6c");
    			add_location(div18, file$i, 131, 2, 4054);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div18, anchor);
    			append_hydration_dev(div18, div5);
    			append_hydration_dev(div5, div3);
    			append_hydration_dev(div3, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div3, t1);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div3, t3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, t4);
    			append_hydration_dev(div5, t5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, t6);
    			append_hydration_dev(div18, t7);
    			append_hydration_dev(div18, div11);
    			append_hydration_dev(div11, div9);
    			append_hydration_dev(div9, div6);
    			append_hydration_dev(div6, t8);
    			append_hydration_dev(div9, t9);
    			append_hydration_dev(div9, div7);
    			append_hydration_dev(div7, t10);
    			append_hydration_dev(div9, t11);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, t12);
    			append_hydration_dev(div11, t13);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, t14);
    			append_hydration_dev(div18, t15);
    			append_hydration_dev(div18, div17);
    			append_hydration_dev(div17, div15);
    			append_hydration_dev(div15, div12);
    			append_hydration_dev(div12, t16);
    			append_hydration_dev(div15, t17);
    			append_hydration_dev(div15, div13);
    			append_hydration_dev(div13, t18);
    			append_hydration_dev(div15, t19);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, t20);
    			append_hydration_dev(div17, t21);
    			append_hydration_dev(div17, div16);
    			append_hydration_dev(div16, t22);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rank*/ 4 && t0_value !== (t0_value = /*rank*/ ctx[2].xG + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*stats, team*/ 3 && t2_value !== (t2_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xG.toFixed(2) + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*rank*/ 4 && t4_value !== (t4_value = /*rank*/ ctx[2].xG + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*rank*/ 4 && div2_class_value !== (div2_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xG + " svelte-1wquk6c")) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty & /*rank*/ 4 && t8_value !== (t8_value = /*rank*/ ctx[2].xC + "")) set_data_dev(t8, t8_value);
    			if (dirty & /*stats, team*/ 3 && t10_value !== (t10_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xC.toFixed(2) + "")) set_data_dev(t10, t10_value);
    			if (dirty & /*rank*/ 4 && t12_value !== (t12_value = /*rank*/ ctx[2].xC + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*rank*/ 4 && div8_class_value !== (div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xC + " svelte-1wquk6c")) {
    				attr_dev(div8, "class", div8_class_value);
    			}

    			if (dirty & /*rank*/ 4 && t16_value !== (t16_value = /*rank*/ ctx[2].cleanSheetRatio + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*stats, team*/ 3 && t18_value !== (t18_value = /*stats*/ ctx[1][/*team*/ ctx[0]].cleanSheetRatio.toFixed(2) + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*rank*/ 4 && t20_value !== (t20_value = /*rank*/ ctx[2].cleanSheetRatio + "")) set_data_dev(t20, t20_value);

    			if (dirty & /*rank*/ 4 && div14_class_value !== (div14_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].cleanSheetRatio + " svelte-1wquk6c")) {
    				attr_dev(div14, "class", div14_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div18);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(131:0) {#if stats != undefined}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$j(ctx) {
    	let if_block_anchor;
    	let if_block = /*stats*/ ctx[1] != undefined && create_if_block$7(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*stats*/ ctx[1] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$7(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    // window.addEventListener("resize", setPositionalOffset);
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
    	if (!(team in data.form)) {
    		return;
    	}

    	for (let matchday of Object.keys(data.form[team][season])) {
    		let score = data.form[team][season][matchday].score;

    		if (score != null) {
    			let [h, _, a] = score.split(" ");
    			h = parseInt(h);
    			a = parseInt(a);
    			let atHome = data.form[team][season][matchday].atHome;

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

    function instance$j($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('StatsValues', slots, []);

    	function setStatsValues(seasonStats, team) {
    		$$invalidate(2, rank = getStatsRankings(seasonStats, team));
    	} // Keep ordinal values at the correct offset
    	// Once rank values have updated, init positional offset for ordinal values

    	function refreshStatsValues() {
    		if (setup) {
    			setStatsValues(stats, team);
    		}
    	}

    	let stats;
    	let rank = { xG: "", xC: "", cleanSheetRatio: "" };
    	let setup = false;

    	onMount(() => {
    		$$invalidate(1, stats = buildStats(data));
    		setStatsValues(stats, team);
    		setup = true;
    	});

    	let { data, team } = $$props;
    	const writable_props = ['data', 'team'];

    	Object_1$9.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<StatsValues> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(3, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		ordinal,
    		getStatsRank,
    		getStatsRankings,
    		setStatsValues,
    		isCleanSheet,
    		goalsScored,
    		goalsConceded,
    		notScored,
    		countOccurances,
    		buildStats,
    		refreshStatsValues,
    		stats,
    		rank,
    		setup,
    		data,
    		team
    	});

    	$$self.$inject_state = $$props => {
    		if ('stats' in $$props) $$invalidate(1, stats = $$props.stats);
    		if ('rank' in $$props) $$invalidate(2, rank = $$props.rank);
    		if ('setup' in $$props) setup = $$props.setup;
    		if ('data' in $$props) $$invalidate(3, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 1) {
    			team && refreshStatsValues();
    		}
    	};

    	return [team, stats, rank, data];
    }

    class StatsValues extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, { data: 3, team: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StatsValues",
    			options,
    			id: create_fragment$j.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[3] === undefined && !('data' in props)) {
    			console.warn("<StatsValues> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[0] === undefined && !('team' in props)) {
    			console.warn("<StatsValues> was created without expected prop 'team'");
    		}
    	}

    	get data() {
    		throw new Error("<StatsValues>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<StatsValues>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<StatsValues>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<StatsValues>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\TeamsFooter.svelte generated by Svelte v3.49.0 */

    const file$h = "src\\components\\TeamsFooter.svelte";

    // (6:4) {#if lastUpdated != null}
    function create_if_block$6(ctx) {
    	let div;
    	let t0;
    	let t1_value = new Date(/*lastUpdated*/ ctx[0]).toLocaleString() + "";
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text("Last updated: ");
    			t1 = text(t1_value);
    			t2 = text(" UTC");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, "Last updated: ");
    			t1 = claim_text(div_nodes, t1_value);
    			t2 = claim_text(div_nodes, " UTC");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "last-updated svelte-1snjhax");
    			add_location(div, file$h, 6, 6, 177);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(div, t1);
    			append_hydration_dev(div, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*lastUpdated*/ 1 && t1_value !== (t1_value = new Date(/*lastUpdated*/ ctx[0]).toLocaleString() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(6:4) {#if lastUpdated != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$i(ctx) {
    	let div2;
    	let div1;
    	let t0;
    	let div0;
    	let t1;
    	let if_block = /*lastUpdated*/ ctx[0] != null && create_if_block$6(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			t1 = text("pldashboard v2.0");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if (if_block) if_block.l(div1_nodes);
    			t0 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t1 = claim_text(div0_nodes, "pldashboard v2.0");
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "version svelte-1snjhax");
    			add_location(div0, file$h, 8, 4, 284);
    			attr_dev(div1, "class", "teams-footer-bottom svelte-1snjhax");
    			add_location(div1, file$h, 4, 2, 105);
    			attr_dev(div2, "class", "teams-footer footer-text-colour svelte-1snjhax");
    			add_location(div2, file$h, 3, 0, 56);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*lastUpdated*/ ctx[0] != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					if_block.m(div1, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TeamsFooter', slots, []);
    	let { lastUpdated } = $$props;
    	const writable_props = ['lastUpdated'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TeamsFooter> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('lastUpdated' in $$props) $$invalidate(0, lastUpdated = $$props.lastUpdated);
    	};

    	$$self.$capture_state = () => ({ lastUpdated });

    	$$self.$inject_state = $$props => {
    		if ('lastUpdated' in $$props) $$invalidate(0, lastUpdated = $$props.lastUpdated);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [lastUpdated];
    }

    class TeamsFooter extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, { lastUpdated: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TeamsFooter",
    			options,
    			id: create_fragment$i.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*lastUpdated*/ ctx[0] === undefined && !('lastUpdated' in props)) {
    			console.warn("<TeamsFooter> was created without expected prop 'lastUpdated'");
    		}
    	}

    	get lastUpdated() {
    		throw new Error("<TeamsFooter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lastUpdated(value) {
    		throw new Error("<TeamsFooter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\FixturesGraph.svelte generated by Svelte v3.49.0 */
    const file$g = "src\\components\\FixturesGraph.svelte";

    function create_fragment$h(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$g, 255, 2, 7737);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$g, 254, 0, 7716);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[5](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[5](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function defaultLayout$4(x, now) {
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

    function buildPlotData$1(data, team) {
    	// Build data to create a fixtures line graph displaying the date along the
    	// x-axis and opponent strength along the y-axis
    	let now = Date.now();

    	let l = line(data, team, now);

    	let plotData = {
    		data: [l],
    		layout: defaultLayout$4(l.x, now),
    		config: {
    			responsive: true,
    			showSendToCloud: false,
    			displayModeBar: false
    		}
    	};

    	return plotData;
    }

    function instance$h($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FixturesGraph', slots, []);

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
    		plotData = buildPlotData$1(data, team);

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
    		$$invalidate(4, setup = true);
    	});

    	let { data, team, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'mobileView'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FixturesGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getMatchDetail,
    		sortByMatchDate,
    		increaseNextGameMarker,
    		linePoints,
    		line,
    		nowLine,
    		xRange,
    		defaultLayout: defaultLayout$4,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData: buildPlotData$1,
    		genPlot,
    		refreshPlot,
    		plotDiv,
    		plotData,
    		setup,
    		data,
    		team,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(4, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 8) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 24) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, team, mobileView, setup, div0_binding];
    }

    class FixturesGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FixturesGraph",
    			options,
    			id: create_fragment$h.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<FixturesGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<FixturesGraph> was created without expected prop 'team'");
    		}

    		if (/*mobileView*/ ctx[3] === undefined && !('mobileView' in props)) {
    			console.warn("<FixturesGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<FixturesGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<FixturesGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<FixturesGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<FixturesGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<FixturesGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<FixturesGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\FormOverTimeGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$8 } = globals;
    const file$f = "src\\components\\FormOverTimeGraph.svelte";

    function create_fragment$g(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$f, 157, 2, 4809);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$f, 156, 0, 4788);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[6](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[6](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function lines$2(data, team) {
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

    function instance$g($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormOverTimeGraph', slots, []);

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
    			data: lines$2(data, team),
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
    		$$invalidate(5, setup = true);
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
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$8.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FormOverTimeGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getFormLine,
    		lines: lines$2,
    		defaultLayout,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData,
    		plotDiv,
    		plotData,
    		setup,
    		genPlot,
    		refreshPlot,
    		data,
    		team,
    		playedMatchdays,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(5, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 16) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class FormOverTimeGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedMatchdays: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormOverTimeGraph",
    			options,
    			id: create_fragment$g.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (/*playedMatchdays*/ ctx[3] === undefined && !('playedMatchdays' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'playedMatchdays'");
    		}

    		if (/*mobileView*/ ctx[4] === undefined && !('mobileView' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<FormOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<FormOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<FormOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<FormOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get playedMatchdays() {
    		throw new Error("<FormOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedMatchdays(value) {
    		throw new Error("<FormOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<FormOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<FormOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\PositionOverTimeGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$7 } = globals;
    const file$e = "src\\components\\PositionOverTimeGraph.svelte";

    function create_fragment$f(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$e, 203, 2, 6068);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$e, 202, 0, 6047);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[6](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[6](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getLineConfig(team, isMainTeam) {
    	let lineConfig;

    	if (isMainTeam) {
    		// Get team primary colour from css variable
    		let teamKey = team[0].toLowerCase() + team.slice(1);

    		teamKey = teamKey.replace(/ /g, "-").toLowerCase();
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
    		let position = data.form[team][data._id][matchday].position;
    		y.push(position);
    	}

    	return y;
    }

    function getLine(data, x, team, isMainTeam) {
    	let matchdays = Object.keys(data.form[team][data._id]);
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

    function lines$1(data, team, playedMatchdays) {
    	let lines = [];
    	let teams = Object.keys(data.standings);

    	for (let i = 0; i < Object.keys(data.standings).length; i++) {
    		if (teams[i] != team) {
    			let line = getLine(data, playedMatchdays, teams[i], false);
    			lines.push(line);
    		}
    	}

    	// Add this team last to ensure it overlaps all other lines
    	let line = getLine(data, playedMatchdays, team, true);

    	lines.push(line);
    	return lines;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PositionOverTimeGraph', slots, []);

    	function positionRangeShapes() {
    		return [
    			{
    				type: "rect",
    				x0: playedMatchdays[0],
    				y0: 4.5,
    				x1: playedMatchdays[playedMatchdays.length - 1],
    				y1: 0.5,
    				line: { width: 0 },
    				// fillcolor: "#77DD77",
    				fillcolor: "#00fe87",
    				opacity: 0.2,
    				layer: "below"
    			},
    			{
    				type: "rect",
    				x0: playedMatchdays[0],
    				y0: 6.5,
    				x1: playedMatchdays[playedMatchdays.length - 1],
    				y1: 4.5,
    				line: { width: 0 },
    				// fillcolor: "#4CDEEE",
    				fillcolor: "#02efff",
    				opacity: 0.2,
    				layer: "below"
    			},
    			{
    				type: "rect",
    				x0: playedMatchdays[0],
    				y0: 20.5,
    				x1: playedMatchdays[playedMatchdays.length - 1],
    				y1: 17.5,
    				line: { width: 0 },
    				fillcolor: "#f83027",
    				// fillcolor: "#C23B22",
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
    				'yaxis.title': { text: 'Position' },
    				'yaxis.visible': true,
    				'yaxis.tickvals': Array.from(Array(20), (_, i) => i + 1),
    				'margin.l': 60,
    				'margin.t': 15
    			};

    			//@ts-ignore
    			Plotly.update(plotDiv, {}, layoutUpdate);
    		}
    	}

    	function setMobileLayout() {
    		if (setup) {
    			let layoutUpdate = {
    				'yaxis.title': null,
    				'yaxis.visible': false,
    				'yaxis.tickvals': Array.from(Array(10), (_, i) => i + 2),
    				'margin.l': 20,
    				'margin.t': 5
    			};

    			//@ts-ignore
    			Plotly.update(plotDiv, {}, layoutUpdate);
    		}
    	}

    	function buildPlotData(data, team) {
    		let plotData = {
    			data: lines$1(data, team, playedMatchdays),
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
    		$$invalidate(5, setup = true);
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

    	let { data, team, playedMatchdays, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$7.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PositionOverTimeGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getLineConfig,
    		getLineY,
    		getLine,
    		lines: lines$1,
    		positionRangeShapes,
    		defaultLayout,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData,
    		plotDiv,
    		plotData,
    		setup,
    		genPlot,
    		refreshPlot,
    		data,
    		team,
    		playedMatchdays,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(5, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 16) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class PositionOverTimeGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedMatchdays: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PositionOverTimeGraph",
    			options,
    			id: create_fragment$f.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (/*playedMatchdays*/ ctx[3] === undefined && !('playedMatchdays' in props)) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'playedMatchdays'");
    		}

    		if (/*mobileView*/ ctx[4] === undefined && !('mobileView' in props)) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get playedMatchdays() {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedMatchdays(value) {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_scored_and_conceded\ScoredAndConcededGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$6 } = globals;
    const file$d = "src\\components\\goals_scored_and_conceded\\ScoredAndConcededGraph.svelte";

    function create_fragment$e(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$d, 194, 2, 6223);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$d, 193, 0, 6202);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[6](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[6](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getAvgGoalsPerGame(data) {
    	let avgGoals = {};

    	for (let team of Object.keys(data.standings)) {
    		for (let matchday of Object.keys(data.form[team][data._id])) {
    			let score = data.form[team][data._id][matchday].score;

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

    	for (let matchday of Object.keys(data.form[team][data._id])) {
    		let score = data.form[team][data._id][matchday].score;

    		if (score != null) {
    			let [h, _, a] = score.split(" ");
    			h = parseInt(h);
    			a = parseInt(a);

    			if (data.form[team][data._id][matchday].atHome) {
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
    		marker: { color: "#00fe87" },
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
    		marker: { color: "#f83027" },
    		hovertemplate: "<b>Matchday %{text}</b><br>%{y} goals scored<extra></extra>"
    	};
    }

    function defaultLayout$3() {
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
    			tickformat: 'd'
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

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScoredAndConcededGraph', slots, []);

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
    		// let x = getMatchdayDates(data, fullTeamName);
    		let [teamScored, teamConceded] = getTeamGoalsPerGame(data, team);

    		let avgGoals = getAvgGoalsPerGame(data);
    		let matchdays = Object.keys(avgGoals);
    		let scoredBar = teamScoredBar(playedMatchdays, teamScored, matchdays);
    		let concededBar = teamConcededBar(playedMatchdays, teamConceded, matchdays);
    		let line = avgLine(playedMatchdays, avgGoals, matchdays);

    		let plotData = {
    			data: [scoredBar, concededBar, line],
    			layout: defaultLayout$3(),
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
    		$$invalidate(5, setup = true);
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
    			let scoredBar = teamScoredBar(playedMatchdays, teamScored, matchdays);
    			let concededBar = teamConcededBar(playedMatchdays, teamConceded, matchdays);
    			let line = avgLine(playedMatchdays, avgGoals, matchdays);
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

    	let { data, team, playedMatchdays, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$6.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ScoredAndConcededGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getAvgGoalsPerGame,
    		getTeamGoalsPerGame,
    		avgLine,
    		teamScoredBar,
    		teamConcededBar,
    		defaultLayout: defaultLayout$3,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData,
    		plotDiv,
    		plotData,
    		setup,
    		genPlot,
    		refreshPlot,
    		data,
    		team,
    		playedMatchdays,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(5, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 16) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class ScoredAndConcededGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedMatchdays: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScoredAndConcededGraph",
    			options,
    			id: create_fragment$e.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<ScoredAndConcededGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<ScoredAndConcededGraph> was created without expected prop 'team'");
    		}

    		if (/*playedMatchdays*/ ctx[3] === undefined && !('playedMatchdays' in props)) {
    			console.warn("<ScoredAndConcededGraph> was created without expected prop 'playedMatchdays'");
    		}

    		if (/*mobileView*/ ctx[4] === undefined && !('mobileView' in props)) {
    			console.warn("<ScoredAndConcededGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get playedMatchdays() {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedMatchdays(value) {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<ScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_scored_and_conceded\CleanSheetsGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$5 } = globals;
    const file$c = "src\\components\\goals_scored_and_conceded\\CleanSheetsGraph.svelte";

    function create_fragment$d(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$c, 183, 2, 5197);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$c, 182, 0, 5176);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[6](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[6](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getTeamCleanSheets(data, team) {
    	let notCleanSheets = [];
    	let cleanSheets = [];

    	for (let matchday of Object.keys(data.form[team][data._id])) {
    		let score = data.form[team][data._id][matchday].score;

    		if (score != null) {
    			let [h, _, a] = score.split(" ");
    			h = parseInt(h);
    			a = parseInt(a);

    			if (data.form[team][data._id][matchday].atHome) {
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
    	let matchdays = Object.keys(data.form[team][data._id]);
    	let [cleanSheets, notCleanSheets] = getTeamCleanSheets(data, team);

    	return [
    		{
    			name: "Clean sheets",
    			type: "bar",
    			x: playedMatchdays,
    			y: cleanSheets,
    			text: matchdays,
    			marker: { color: "#00fe87" },
    			hovertemplate: "<b>Clean sheet<extra></extra>",
    			showlegend: false
    		},
    		{
    			name: "Conceded",
    			type: "bar",
    			x: playedMatchdays,
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

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CleanSheetsGraph', slots, []);

    	function baseLine() {
    		return {
    			type: "line",
    			x0: playedMatchdays[0],
    			y0: 0.5,
    			x1: playedMatchdays[playedMatchdays.length - 1],
    			y1: 0.5,
    			layer: "below",
    			line: { color: "#d3d3d3", width: 2 }
    		};
    	}

    	function defaultLayout() {
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
    				linecolor: "black",
    				showgrid: false,
    				showline: false,
    				fixedrange: true
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
    		let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);

    		// Line required on plot to make match goalsScoredAndConcededGraph
    		// TODO: Improve solution
    		let line = hiddenLine(cleanSheetsBar.x);

    		let plotData = {
    			data: [cleanSheetsBar, concededBar, line],
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
    		$$invalidate(5, setup = true);
    	});

    	function genPlot() {
    		plotData = buildPlotData(data, team);

    		//@ts-ignore
    		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
    	}

    	function refreshPlot() {
    		if (setup) {
    			let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);
    			let line = hiddenLine(cleanSheetsBar.x);
    			plotData.data[0] = cleanSheetsBar;
    			plotData.data[1] = concededBar;
    			plotData.data[2] = line;
    			plotData.layout.shapes[0] = baseLine();

    			//@ts-ignore
    			Plotly.redraw(plotDiv);

    			if (mobileView) {
    				setMobileLayout();
    			}
    		}
    	}

    	let { data, team, playedMatchdays, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$5.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CleanSheetsGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getTeamCleanSheets,
    		bars,
    		baseLine,
    		defaultLayout,
    		setDefaultLayout,
    		setMobileLayout,
    		hiddenLine,
    		buildPlotData,
    		plotDiv,
    		plotData,
    		setup,
    		genPlot,
    		refreshPlot,
    		data,
    		team,
    		playedMatchdays,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(5, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedMatchdays' in $$props) $$invalidate(3, playedMatchdays = $$props.playedMatchdays);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 16) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class CleanSheetsGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedMatchdays: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CleanSheetsGraph",
    			options,
    			id: create_fragment$d.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'team'");
    		}

    		if (/*playedMatchdays*/ ctx[3] === undefined && !('playedMatchdays' in props)) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'playedMatchdays'");
    		}

    		if (/*mobileView*/ ctx[4] === undefined && !('mobileView' in props)) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<CleanSheetsGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<CleanSheetsGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<CleanSheetsGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<CleanSheetsGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get playedMatchdays() {
    		throw new Error("<CleanSheetsGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedMatchdays(value) {
    		throw new Error("<CleanSheetsGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<CleanSheetsGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<CleanSheetsGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_per_game\GoalsScoredFreqGraph.svelte generated by Svelte v3.49.0 */
    const file$b = "src\\components\\goals_per_game\\GoalsScoredFreqGraph.svelte";

    function create_fragment$c(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$b, 99, 2, 2707);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$b, 98, 0, 2686);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[8](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[8](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GoalsScoredFreqGraph', slots, []);

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
    		$$invalidate(7, setup = true);
    	});

    	let { team, getScoredBars, getScoredTeamBars, getXLabels, getYAxisLayout, mobileView } = $$props;

    	const writable_props = [
    		'team',
    		'getScoredBars',
    		'getScoredTeamBars',
    		'getXLabels',
    		'getYAxisLayout',
    		'mobileView'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<GoalsScoredFreqGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('getScoredBars' in $$props) $$invalidate(2, getScoredBars = $$props.getScoredBars);
    		if ('getScoredTeamBars' in $$props) $$invalidate(3, getScoredTeamBars = $$props.getScoredTeamBars);
    		if ('getXLabels' in $$props) $$invalidate(4, getXLabels = $$props.getXLabels);
    		if ('getYAxisLayout' in $$props) $$invalidate(5, getYAxisLayout = $$props.getYAxisLayout);
    		if ('mobileView' in $$props) $$invalidate(6, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		defaultLayout,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData,
    		genPlot,
    		refreshPlot,
    		plotDiv,
    		plotData,
    		setup,
    		team,
    		getScoredBars,
    		getScoredTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(7, setup = $$props.setup);
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('getScoredBars' in $$props) $$invalidate(2, getScoredBars = $$props.getScoredBars);
    		if ('getScoredTeamBars' in $$props) $$invalidate(3, getScoredTeamBars = $$props.getScoredTeamBars);
    		if ('getXLabels' in $$props) $$invalidate(4, getXLabels = $$props.getXLabels);
    		if ('getYAxisLayout' in $$props) $$invalidate(5, getYAxisLayout = $$props.getYAxisLayout);
    		if ('mobileView' in $$props) $$invalidate(6, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 2) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 64) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 192) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [
    		plotDiv,
    		team,
    		getScoredBars,
    		getScoredTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		mobileView,
    		setup,
    		div0_binding
    	];
    }

    class GoalsScoredFreqGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			team: 1,
    			getScoredBars: 2,
    			getScoredTeamBars: 3,
    			getXLabels: 4,
    			getYAxisLayout: 5,
    			mobileView: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GoalsScoredFreqGraph",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*team*/ ctx[1] === undefined && !('team' in props)) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'team'");
    		}

    		if (/*getScoredBars*/ ctx[2] === undefined && !('getScoredBars' in props)) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getScoredBars'");
    		}

    		if (/*getScoredTeamBars*/ ctx[3] === undefined && !('getScoredTeamBars' in props)) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getScoredTeamBars'");
    		}

    		if (/*getXLabels*/ ctx[4] === undefined && !('getXLabels' in props)) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getXLabels'");
    		}

    		if (/*getYAxisLayout*/ ctx[5] === undefined && !('getYAxisLayout' in props)) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getYAxisLayout'");
    		}

    		if (/*mobileView*/ ctx[6] === undefined && !('mobileView' in props)) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get team() {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getScoredBars() {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getScoredBars(value) {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getScoredTeamBars() {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getScoredTeamBars(value) {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getXLabels() {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getXLabels(value) {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getYAxisLayout() {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getYAxisLayout(value) {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<GoalsScoredFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_per_game\GoalsConcededFreqGraph.svelte generated by Svelte v3.49.0 */
    const file$a = "src\\components\\goals_per_game\\GoalsConcededFreqGraph.svelte";

    function create_fragment$b(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$a, 99, 2, 2699);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$a, 98, 0, 2678);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[8](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[8](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GoalsConcededFreqGraph', slots, []);

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
    		$$invalidate(7, setup = true);
    	});

    	let { team, getConcededBars, getConcededTeamBars, getXLabels, getYAxisLayout, mobileView } = $$props;

    	const writable_props = [
    		'team',
    		'getConcededBars',
    		'getConcededTeamBars',
    		'getXLabels',
    		'getYAxisLayout',
    		'mobileView'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<GoalsConcededFreqGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('getConcededBars' in $$props) $$invalidate(2, getConcededBars = $$props.getConcededBars);
    		if ('getConcededTeamBars' in $$props) $$invalidate(3, getConcededTeamBars = $$props.getConcededTeamBars);
    		if ('getXLabels' in $$props) $$invalidate(4, getXLabels = $$props.getXLabels);
    		if ('getYAxisLayout' in $$props) $$invalidate(5, getYAxisLayout = $$props.getYAxisLayout);
    		if ('mobileView' in $$props) $$invalidate(6, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		defaultLayout,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData,
    		genPlot,
    		refreshPlot,
    		plotDiv,
    		plotData,
    		setup,
    		team,
    		getConcededBars,
    		getConcededTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(7, setup = $$props.setup);
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('getConcededBars' in $$props) $$invalidate(2, getConcededBars = $$props.getConcededBars);
    		if ('getConcededTeamBars' in $$props) $$invalidate(3, getConcededTeamBars = $$props.getConcededTeamBars);
    		if ('getXLabels' in $$props) $$invalidate(4, getXLabels = $$props.getXLabels);
    		if ('getYAxisLayout' in $$props) $$invalidate(5, getYAxisLayout = $$props.getYAxisLayout);
    		if ('mobileView' in $$props) $$invalidate(6, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 2) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 64) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 192) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [
    		plotDiv,
    		team,
    		getConcededBars,
    		getConcededTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		mobileView,
    		setup,
    		div0_binding
    	];
    }

    class GoalsConcededFreqGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			team: 1,
    			getConcededBars: 2,
    			getConcededTeamBars: 3,
    			getXLabels: 4,
    			getYAxisLayout: 5,
    			mobileView: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GoalsConcededFreqGraph",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*team*/ ctx[1] === undefined && !('team' in props)) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'team'");
    		}

    		if (/*getConcededBars*/ ctx[2] === undefined && !('getConcededBars' in props)) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getConcededBars'");
    		}

    		if (/*getConcededTeamBars*/ ctx[3] === undefined && !('getConcededTeamBars' in props)) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getConcededTeamBars'");
    		}

    		if (/*getXLabels*/ ctx[4] === undefined && !('getXLabels' in props)) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getXLabels'");
    		}

    		if (/*getYAxisLayout*/ ctx[5] === undefined && !('getYAxisLayout' in props)) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getYAxisLayout'");
    		}

    		if (/*mobileView*/ ctx[6] === undefined && !('mobileView' in props)) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get team() {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getConcededBars() {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getConcededBars(value) {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getConcededTeamBars() {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getConcededTeamBars(value) {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getXLabels() {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getXLabels(value) {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getYAxisLayout() {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getYAxisLayout(value) {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<GoalsConcededFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_per_game\GoalsPerGame.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$4 } = globals;
    const file$9 = "src\\components\\goals_per_game\\GoalsPerGame.svelte";

    // (261:2) {#if setup}
    function create_if_block$5(ctx) {
    	let div0;
    	let goalsscoredfreq;
    	let t;
    	let div1;
    	let goalsconcededfreq;
    	let current;

    	goalsscoredfreq = new GoalsScoredFreqGraph({
    			props: {
    				team: /*team*/ ctx[0],
    				getScoredBars: /*getScoredBars*/ ctx[3],
    				getScoredTeamBars: /*getScoredTeamBars*/ ctx[5],
    				getXLabels: /*getXLabels*/ ctx[7],
    				getYAxisLayout: /*getYAxisLayout*/ ctx[8],
    				mobileView: /*mobileView*/ ctx[1]
    			},
    			$$inline: true
    		});

    	goalsconcededfreq = new GoalsConcededFreqGraph({
    			props: {
    				team: /*team*/ ctx[0],
    				getConcededBars: /*getConcededBars*/ ctx[4],
    				getConcededTeamBars: /*getConcededTeamBars*/ ctx[6],
    				getXLabels: /*getXLabels*/ ctx[7],
    				getYAxisLayout: /*getYAxisLayout*/ ctx[8],
    				mobileView: /*mobileView*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			create_component(goalsscoredfreq.$$.fragment);
    			t = space();
    			div1 = element("div");
    			create_component(goalsconcededfreq.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(goalsscoredfreq.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			claim_component(goalsconcededfreq.$$.fragment, div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "graph freq-graph mini-graph");
    			add_location(div0, file$9, 261, 4, 8052);
    			attr_dev(div1, "class", "graph freq-graph mini-graph");
    			add_location(div1, file$9, 271, 4, 8285);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			mount_component(goalsscoredfreq, div0, null);
    			insert_hydration_dev(target, t, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			mount_component(goalsconcededfreq, div1, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const goalsscoredfreq_changes = {};
    			if (dirty & /*team*/ 1) goalsscoredfreq_changes.team = /*team*/ ctx[0];
    			if (dirty & /*mobileView*/ 2) goalsscoredfreq_changes.mobileView = /*mobileView*/ ctx[1];
    			goalsscoredfreq.$set(goalsscoredfreq_changes);
    			const goalsconcededfreq_changes = {};
    			if (dirty & /*team*/ 1) goalsconcededfreq_changes.team = /*team*/ ctx[0];
    			if (dirty & /*mobileView*/ 2) goalsconcededfreq_changes.mobileView = /*mobileView*/ ctx[1];
    			goalsconcededfreq.$set(goalsconcededfreq_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(goalsscoredfreq.$$.fragment, local);
    			transition_in(goalsconcededfreq.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(goalsscoredfreq.$$.fragment, local);
    			transition_out(goalsconcededfreq.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_component(goalsscoredfreq);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div1);
    			destroy_component(goalsconcededfreq);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(261:2) {#if setup}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div;
    	let current;
    	let if_block = /*setup*/ ctx[2] && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			if (if_block) if_block.l(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "two-graphs svelte-1y33275");
    			add_location(div, file$9, 259, 0, 8007);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*setup*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*setup*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$5(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function teamBars(data, type, color) {
    	let opener = "Score";

    	if (type == "Conceded") {
    		opener = "Concede";
    	}

    	return {
    		x: Object.keys(data),
    		y: Object.values(data),
    		type: "bar",
    		name: type,
    		marker: { color },
    		hovertemplate: `${opener} %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
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
    	if (!(team in data.form)) {
    		return;
    	}

    	for (let matchday of Object.keys(data.form[team][season])) {
    		let score = data.form[team][season][matchday].score;

    		if (score != null) {
    			let [h, _, a] = score.split(" ");
    			h = parseInt(h);
    			a = parseInt(a);

    			if (data.form[team][season][matchday].atHome) {
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
    			let [h, _, a] = score.split(" ");
    			h = parseInt(h);
    			a = parseInt(a);

    			if (data.form[team][season][matchday].atHome) {
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

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GoalsPerGame', slots, []);

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
    	// let colourScale = ["#5df455", "#b2d000", "#dfa700", "#f77a1c", "#f74d4d"];
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
    		$$invalidate(2, setup = true);
    	});

    	let { data, team, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<GoalsPerGame> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(9, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(1, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		GoalsScoredFreq: GoalsScoredFreqGraph,
    		GoalsConcededFreq: GoalsConcededFreqGraph,
    		avgBars,
    		teamBars,
    		bars,
    		colourScale,
    		scoredColourScale,
    		concededColourScale,
    		reversed,
    		getScoredBars,
    		getConcededBars,
    		getScoredTeamBars,
    		getConcededTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		countScored,
    		maxObjKey,
    		fillGoalFreqBlanks,
    		avgGoalFrequencies,
    		teamScoredFrequencies,
    		countConceded,
    		teamConcededFrequencies,
    		checkForMax,
    		maxValue,
    		valueSum,
    		scaleTeamFreq,
    		convertToPercentage: convertToPercentage$1,
    		convertAllToPercentage,
    		refreshTeamData,
    		goalFreq,
    		teamScoredFreq,
    		teamConcededFreq,
    		maxY,
    		setup,
    		data,
    		team,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('colourScale' in $$props) colourScale = $$props.colourScale;
    		if ('scoredColourScale' in $$props) scoredColourScale = $$props.scoredColourScale;
    		if ('concededColourScale' in $$props) concededColourScale = $$props.concededColourScale;
    		if ('goalFreq' in $$props) goalFreq = $$props.goalFreq;
    		if ('teamScoredFreq' in $$props) teamScoredFreq = $$props.teamScoredFreq;
    		if ('teamConcededFreq' in $$props) teamConcededFreq = $$props.teamConcededFreq;
    		if ('maxY' in $$props) maxY = $$props.maxY;
    		if ('setup' in $$props) $$invalidate(2, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(9, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(1, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 1) {
    			team && refreshTeamData();
    		}
    	};

    	return [
    		team,
    		mobileView,
    		setup,
    		getScoredBars,
    		getConcededBars,
    		getScoredTeamBars,
    		getConcededTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		data
    	];
    }

    class GoalsPerGame extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { data: 9, team: 0, mobileView: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GoalsPerGame",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[9] === undefined && !('data' in props)) {
    			console.warn("<GoalsPerGame> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[0] === undefined && !('team' in props)) {
    			console.warn("<GoalsPerGame> was created without expected prop 'team'");
    		}

    		if (/*mobileView*/ ctx[1] === undefined && !('mobileView' in props)) {
    			console.warn("<GoalsPerGame> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<GoalsPerGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<GoalsPerGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<GoalsPerGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<GoalsPerGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<GoalsPerGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<GoalsPerGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\SpiderGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$3 } = globals;
    const file$8 = "src\\components\\SpiderGraph.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[31] = list[i];
    	return child_ctx;
    }

    // (527:6) {#if _team != team}
    function create_if_block$4(ctx) {
    	let button;
    	let t_value = /*toAlias*/ ctx[2](/*_team*/ ctx[31]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "spider-opp-team-btn svelte-1cvzyov");
    			add_location(button, file$8, 527, 8, 17236);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*toAlias, teams*/ 6 && t_value !== (t_value = /*toAlias*/ ctx[2](/*_team*/ ctx[31]) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(527:6) {#if _team != team}",
    		ctx
    	});

    	return block;
    }

    // (526:4) {#each teams as _team}
    function create_each_block$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*_team*/ ctx[31] != /*team*/ ctx[0] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*_team*/ ctx[31] != /*team*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(526:4) {#each teams as _team}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t;
    	let div4;
    	let div3;
    	let each_value = /*teams*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t = space();
    			div4 = element("div");
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			div4 = claim_element(nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true, id: true });
    			var div3_nodes = children(div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div3_nodes);
    			}

    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$8, 518, 4, 16944);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$8, 517, 2, 16921);
    			attr_dev(div2, "class", "spider-chart svelte-1cvzyov");
    			add_location(div2, file$8, 516, 0, 16891);
    			attr_dev(div3, "class", "spider-opp-team-btns svelte-1cvzyov");
    			attr_dev(div3, "id", "spider-opp-teams");
    			add_location(div3, file$8, 524, 2, 17115);
    			attr_dev(div4, "class", "spider-opp-team-selector svelte-1cvzyov");
    			add_location(div4, file$8, 523, 0, 17073);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[7](div0);
    			insert_hydration_dev(target, t, anchor);
    			insert_hydration_dev(target, div4, anchor);
    			append_hydration_dev(div4, div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*spiderBtnClick, toAlias, teams, team*/ 23) {
    				each_value = /*teams*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			/*div0_binding*/ ctx[7](null);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div4);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getTeamColor(team) {
    	let teamKey = team[0].toLowerCase() + team.slice(1);
    	teamKey = teamKey.replace(/ /g, "-").toLowerCase();
    	let teamColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
    	return teamColor;
    }

    function teamInSeason$1(form, team, season) {
    	return team in form && form[team][season]['1'] != null;
    }

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

    function goalsPerSeason(data) {
    	let attack = {};
    	let maxGoals = Number.NEGATIVE_INFINITY;
    	let minGoals = Number.POSITIVE_INFINITY;

    	for (let team of Object.keys(data.standings)) {
    		let totalGoals = 0;
    		let gamesPlayed = 0;

    		for (let season in data.standings[team]) {
    			let goals = data.standings[team][season].gF;

    			if (goals > 0) {
    				totalGoals += goals;
    				gamesPlayed += data.standings[team][season].played;
    			}
    		}

    		let goalsPerGame = null;

    		if (gamesPlayed > 0) {
    			goalsPerGame = totalGoals / gamesPlayed;
    		}

    		if (goalsPerGame > maxGoals) {
    			maxGoals = goalsPerGame;
    		} else if (goalsPerGame < minGoals) {
    			minGoals = goalsPerGame;
    		}

    		attack[team] = goalsPerGame;
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
    	let [attack, extremes] = goalsPerSeason(data);
    	attack = scaleAttack(attack, extremes);
    	attack.avg = attributeAvg(attack);
    	return attack;
    }

    function concededPerSeason(data) {
    	let defence = {};
    	let maxConceded = Number.NEGATIVE_INFINITY;
    	let minConceded = Number.POSITIVE_INFINITY;

    	for (let team of Object.keys(data.standings)) {
    		let totalConceded = 0;
    		let gamesPlayed = 0;

    		for (let season in data.standings[team]) {
    			let goals = data.standings[team][season].gA;

    			if (goals > 0) {
    				totalConceded += goals;
    				gamesPlayed += data.standings[team][season].played;
    			}
    		}

    		let goalsPerGame = null;

    		if (gamesPlayed > 0) {
    			goalsPerGame = totalConceded / gamesPlayed;
    		}

    		maxConceded = Math.max(maxConceded, goalsPerGame);
    		minConceded = Math.min(minConceded, goalsPerGame);
    		defence[team] = goalsPerGame;
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
    	defence.avg = attributeAvg(defence);
    	return defence;
    }

    function formCleanSheets(form, team, season) {
    	let nCleanSheets = 0;

    	for (let matchday in form[team][season]) {
    		let match = form[team][season][matchday];

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
    	//@ts-ignore
    	let cleanSheets = {};

    	let maxCleanSheets = Number.NEGATIVE_INFINITY;

    	for (let team of Object.keys(data.standings)) {
    		let nCleanSheets = formCleanSheets(data.form, team, data._id);

    		if (teamInSeason$1(data.form, team, data._id - 1)) {
    			nCleanSheets += formCleanSheets(data.form, team, data._id - 1);
    		}

    		if (teamInSeason$1(data.form, team, data._id - 2)) {
    			nCleanSheets += formCleanSheets(data.form, team, data._id - 2);
    		}

    		if (nCleanSheets > maxCleanSheets) {
    			maxCleanSheets = nCleanSheets;
    		}

    		cleanSheets[team] = nCleanSheets;
    	}

    	cleanSheets.avg = attributeAvgScaled(cleanSheets, maxCleanSheets);
    	return cleanSheets;
    }

    function formConsistency(form, team, season) {
    	let backToBack = 0; // Counts pairs of back to back identical match results
    	let prevResult = null;

    	for (let matchday in form[team][season]) {
    		let match = form[team][season][matchday];

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
    	//@ts-ignore
    	let consistency = {};

    	let maxConsistency = Number.NEGATIVE_INFINITY;

    	for (let team of Object.keys(data.standings)) {
    		let backToBack = formConsistency(data.form, team, data._id);

    		if (teamInSeason$1(data.form, team, data._id - 1)) {
    			backToBack += formConsistency(data.form, team, data._id - 1);
    		}

    		if (teamInSeason$1(data.form, team, data._id - 2)) {
    			backToBack += formConsistency(data.form, team, data._id - 2);
    		}

    		if (backToBack > maxConsistency) {
    			maxConsistency = backToBack;
    		}

    		consistency[team] = backToBack;
    	}

    	consistency.avg = attributeAvgScaled(consistency, maxConsistency);
    	return consistency;
    }

    function formWinStreak(form, team, season) {
    	let winStreak = 0;
    	let tempWinStreak = 0;

    	for (let matchday in form[team][season]) {
    		let match = form[team][season][matchday];

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
    	//@ts-ignore
    	let winStreaks = {};

    	let maxWinStreaks = Number.NEGATIVE_INFINITY;

    	for (let team of Object.keys(data.standings)) {
    		let winStreak = formWinStreak(data.form, team, data._id);

    		if (teamInSeason$1(data.form, team, data._id - 1)) {
    			winStreak += formWinStreak(data.form, team, data._id - 1);
    		}

    		if (teamInSeason$1(data.form, team, data._id - 2)) {
    			winStreak += formWinStreak(data.form, team, data._id - 2);
    		}

    		if (winStreak > maxWinStreaks) {
    			maxWinStreaks = winStreak;
    		}

    		winStreaks[team] = winStreak;
    	}

    	winStreaks.avg = attributeAvgScaled(winStreaks, maxWinStreaks);
    	return winStreaks;
    }

    function removeItem(arr, value) {
    	let index = arr.indexOf(value);

    	if (index > -1) {
    		arr.splice(index, 1);
    	}

    	return arr;
    }

    function formWinsVsBig6(form, team, season, big6) {
    	let winsVsBig6 = 0;

    	for (let matchday in form[team][season]) {
    		let match = form[team][season][matchday];

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
    	//@ts-ignore
    	let vsBig6 = {};

    	let maxWinsVsBig6 = Number.NEGATIVE_INFINITY;

    	for (let team of Object.keys(data.standings)) {
    		let big6 = [
    			"Manchester United",
    			"Liverpool",
    			"Manchester City",
    			"Arsenal",
    			"Chelsea",
    			"Tottenham Hotspur"
    		];

    		big6 = removeItem(big6, team);
    		let winsVsBig6 = formWinsVsBig6(data.form, team, data._id, big6);

    		if (teamInSeason$1(data.form, team, data._id - 1)) {
    			winsVsBig6 += formWinsVsBig6(data.form, team, data._id - 1, big6);
    		}

    		if (teamInSeason$1(data.form, team, data._id - 2)) {
    			winsVsBig6 += formWinsVsBig6(data.form, team, data._id - 2, big6);
    		}

    		if (winsVsBig6 > maxWinsVsBig6) {
    			maxWinsVsBig6 = winsVsBig6;
    		}

    		vsBig6[team] = winsVsBig6;
    	}

    	vsBig6.avg = attributeAvgScaled(vsBig6, maxWinsVsBig6);
    	return vsBig6;
    }

    function defaultLayout$2() {
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

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SpiderGraph', slots, []);

    	function addTeamComparison(team) {
    		let teamColor = getTeamColor(team);

    		let teamData = {
    			name: team,
    			type: "scatterpolar",
    			r: [
    				attack[team],
    				defence[team],
    				cleanSheets[team],
    				consistency[team],
    				winStreaks[team],
    				vsBig6[team]
    			],
    			theta: labels,
    			fill: "toself",
    			marker: { color: teamColor }
    		};

    		plotData.data.push(teamData);

    		//@ts-ignore
    		Plotly.redraw(plotDiv); // Redraw with teamName added
    	}

    	function addAvg() {
    		let avg = avgScatterPlot();
    		plotData.data.unshift(avg); // Add avg below the teamName spider plot
    	}

    	function removeTeamComparison(team) {
    		// Remove spider plot for this teamName
    		for (let i = 0; i < plotData.data.length; i++) {
    			if (plotData.data[i].name == team) {
    				plotData.data.splice(i, 1);
    				break;
    			}
    		}

    		// If removing only comparison teamName, re-insert the initial avg spider plot
    		if (comparisonTeams.length == 1) {
    			addAvg();
    		}

    		//@ts-ignore
    		Plotly.redraw(plotDiv); // Redraw with teamName removed
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
    				addAvg();
    			}

    			removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams
    		}

    		//@ts-ignore
    		Plotly.redraw(plotDiv); // Redraw with teamName removed
    	}

    	function spiderBtnClick(btn) {
    		let team = toName(btn.innerHTML);

    		if (btn.style.background == "") {
    			let teamKey = team.toLowerCase().replace(/ /g, "-");
    			btn.style.background = `var(--${teamKey})`;
    			btn.style.color = `var(--${teamKey}-secondary)`;
    		} else {
    			btn.style.background = "";
    			btn.style.color = "black";
    		}

    		if (comparisonTeams.length == 0) {
    			plotData.data.splice(0, 1); // Remove avg
    		}

    		if (comparisonTeams.includes(team)) {
    			removeTeamComparison(team); // Remove from spider chart
    			removeItem(comparisonTeams, team); // Remove from comparison teams
    		} else {
    			addTeamComparison(team); // Add teamName to spider chart
    			comparisonTeams.push(team); // Add to comparison teams
    		}
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
    			layout: defaultLayout$2(),
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

    	let { data, team, teams, toAlias, toName } = $$props;
    	const writable_props = ['data', 'team', 'teams', 'toAlias', 'toName'];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SpiderGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(3, plotDiv);
    		});
    	}

    	const click_handler = e => {
    		//@ts-ignore
    		spiderBtnClick(e.target);
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(5, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(2, toAlias = $$props.toAlias);
    		if ('toName' in $$props) $$invalidate(6, toName = $$props.toName);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getTeamColor,
    		teamInSeason: teamInSeason$1,
    		addTeamComparison,
    		addAvg,
    		removeTeamComparison,
    		removeAllTeamComparisons,
    		resetTeamComparisonBtns,
    		spiderBtnClick,
    		goalsPerSeason,
    		scaleAttack,
    		attributeAvgScaled,
    		attributeAvg,
    		getAttack,
    		concededPerSeason,
    		scaleDefence,
    		getDefence,
    		formCleanSheets,
    		getCleanSheets,
    		formConsistency,
    		getConsistency,
    		formWinStreak,
    		getWinStreak,
    		removeItem,
    		formWinsVsBig6,
    		getVsBig6,
    		scatterPlot,
    		avgScatterPlot,
    		getTeamData,
    		initSpiderPlots,
    		computePlotData,
    		defaultLayout: defaultLayout$2,
    		buildPlotData,
    		attack,
    		defence,
    		cleanSheets,
    		consistency,
    		winStreaks,
    		vsBig6,
    		labels,
    		plotDiv,
    		plotData,
    		comparisonTeams,
    		setup,
    		genPlot,
    		emptyArray,
    		refreshPlot,
    		data,
    		team,
    		teams,
    		toAlias,
    		toName
    	});

    	$$self.$inject_state = $$props => {
    		if ('attack' in $$props) attack = $$props.attack;
    		if ('defence' in $$props) defence = $$props.defence;
    		if ('cleanSheets' in $$props) cleanSheets = $$props.cleanSheets;
    		if ('consistency' in $$props) consistency = $$props.consistency;
    		if ('winStreaks' in $$props) winStreaks = $$props.winStreaks;
    		if ('vsBig6' in $$props) vsBig6 = $$props.vsBig6;
    		if ('labels' in $$props) labels = $$props.labels;
    		if ('plotDiv' in $$props) $$invalidate(3, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('comparisonTeams' in $$props) comparisonTeams = $$props.comparisonTeams;
    		if ('setup' in $$props) setup = $$props.setup;
    		if ('data' in $$props) $$invalidate(5, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(2, toAlias = $$props.toAlias);
    		if ('toName' in $$props) $$invalidate(6, toName = $$props.toName);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*team*/ 1) {
    			team && refreshPlot();
    		}
    	};

    	return [
    		team,
    		teams,
    		toAlias,
    		plotDiv,
    		spiderBtnClick,
    		data,
    		toName,
    		div0_binding,
    		click_handler
    	];
    }

    class SpiderGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$9,
    			create_fragment$9,
    			safe_not_equal,
    			{
    				data: 5,
    				team: 0,
    				teams: 1,
    				toAlias: 2,
    				toName: 6
    			},
    			null,
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SpiderGraph",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[5] === undefined && !('data' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[0] === undefined && !('team' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'team'");
    		}

    		if (/*teams*/ ctx[1] === undefined && !('teams' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'teams'");
    		}

    		if (/*toAlias*/ ctx[2] === undefined && !('toAlias' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'toAlias'");
    		}

    		if (/*toName*/ ctx[6] === undefined && !('toName' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'toName'");
    		}
    	}

    	get data() {
    		throw new Error("<SpiderGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<SpiderGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<SpiderGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<SpiderGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get teams() {
    		throw new Error("<SpiderGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set teams(value) {
    		throw new Error("<SpiderGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toAlias() {
    		throw new Error("<SpiderGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toAlias(value) {
    		throw new Error("<SpiderGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toName() {
    		throw new Error("<SpiderGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toName(value) {
    		throw new Error("<SpiderGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\ScorelineFreqGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$2 } = globals;
    const file$7 = "src\\components\\ScorelineFreqGraph.svelte";

    function create_fragment$8(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$7, 250, 2, 7570);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$7, 249, 0, 7549);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[5](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[5](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function teamInSeason(form, team, season) {
    	return team in form && form[team][season]['1'] != null;
    }

    function insertSeasonTeamScoreBars(scoreFreq, form, team, season) {
    	for (let matchday in form[team][season]) {
    		let score = form[team][season][matchday].score;

    		if (score != null) {
    			let [h, _, a] = score.split(" ");

    			if (!form[team][season][matchday].atHome) {
    				score = a + " - " + h;
    			}

    			scoreFreq[score][1] += 1;
    		}
    	}
    }

    function insertTeamScoreBars(data, team, scoreFreq) {
    	for (let score in scoreFreq) {
    		if (scoreFreq[score].length == 1) {
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

    function getColours(scores) {
    	let colours = [];

    	for (let score of scores) {
    		let [h, _, a] = score.split(" ");
    		h = parseInt(h);
    		a = parseInt(a);

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

    	let colours = getColours(x);

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

    function defaultLayout$1() {
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

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScorelineFreqGraph', slots, []);

    	function insertSeasonAvgScoreFreq(scoreFreq, form, team, season) {
    		for (let matchday in form[team][season]) {
    			let score = data.form[team][season][matchday].score;

    			if (score != null) {
    				let [h, _, a] = score.split(" ");

    				if (!data.form[team][season][matchday].atHome) {
    					score = a + " - " + h;
    				}

    				if (!(score in scoreFreq)) {
    					scoreFreq[score] = [0];
    				}

    				scoreFreq[score][0] += 1;
    			}
    		}
    	}

    	function getAvgScoreFreq(data) {
    		let scoreFreq = {};

    		for (let team in data.form) {
    			insertSeasonAvgScoreFreq(scoreFreq, data.form, team, data._id);

    			if (teamInSeason(data.form, team, data._id - 1)) {
    				insertSeasonAvgScoreFreq(scoreFreq, data.form, team, data._id - 1);
    			}

    			if (teamInSeason(data.form, team, data._id - 2)) {
    				insertSeasonAvgScoreFreq(scoreFreq, data.form, team, data._id - 2);
    			}
    		}

    		return scoreFreq;
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
    		let [avgBars, teamBars] = separateBars(scoreFreq);

    		let plotData = {
    			data: [avgBars, teamBars],
    			layout: defaultLayout$1(),
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
    			let [_, teamBars] = separateBars(scoreFreq);
    			plotData.data[1] = teamBars; // Update team bars

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
    		$$invalidate(4, setup = true);
    	});

    	let { data, team, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ScorelineFreqGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		teamInSeason,
    		insertSeasonAvgScoreFreq,
    		getAvgScoreFreq,
    		insertSeasonTeamScoreBars,
    		insertTeamScoreBars,
    		getColours,
    		separateBars,
    		scaleBars,
    		convertToPercentage,
    		defaultLayout: defaultLayout$1,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData,
    		genPlot,
    		resetTeamBars,
    		refreshPlot,
    		plotDiv,
    		plotData,
    		scoreFreq,
    		setup,
    		data,
    		team,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('scoreFreq' in $$props) scoreFreq = $$props.scoreFreq;
    		if ('setup' in $$props) $$invalidate(4, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 8) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 24) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, team, mobileView, setup, div0_binding];
    }

    class ScorelineFreqGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScorelineFreqGraph",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<ScorelineFreqGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<ScorelineFreqGraph> was created without expected prop 'team'");
    		}

    		if (/*mobileView*/ ctx[3] === undefined && !('mobileView' in props)) {
    			console.warn("<ScorelineFreqGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<ScorelineFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<ScorelineFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<ScorelineFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<ScorelineFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<ScorelineFreqGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<ScorelineFreqGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\nav\Nav.svelte generated by Svelte v3.49.0 */

    const file$6 = "src\\components\\nav\\Nav.svelte";

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (28:6) {:else}
    function create_else_block$3(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let each_value_1 = /*teams*/ ctx[1];
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*_team*/ ctx[9];
    	validate_each_keys(ctx, each_value_1, get_each_context_1$1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1$1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*teams, toAlias, team, switchTeam*/ 15) {
    				each_value_1 = /*teams*/ ctx[1];
    				validate_each_argument(each_value_1);
    				validate_each_keys(ctx, each_value_1, get_each_context_1$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block_1$1, each_1_anchor, get_each_context_1$1);
    			}
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(28:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (24:6) {#if teams.length == 0}
    function create_if_block$3(ctx) {
    	let each_1_anchor;
    	let each_value = /*widths*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*widths*/ 16) {
    				each_value = /*widths*/ ctx[4];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(24:6) {#if teams.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (42:10) {:else}
    function create_else_block_1$2(ctx) {
    	let button;
    	let div;
    	let t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[9]) + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*_team*/ ctx[9]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			div = claim_element(button_nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, t0_value);
    			div_nodes.forEach(detach_dev);
    			t1 = claim_space(button_nodes);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "team-name svelte-14nmjz0");
    			add_location(div, file$6, 48, 14, 1706);
    			attr_dev(button, "class", "team-link svelte-14nmjz0");
    			add_location(button, file$6, 42, 12, 1515);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, div);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*toAlias, teams*/ 6 && t0_value !== (t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[9]) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(42:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (30:10) {#if _team.toLowerCase().replace(/ /g, "-") == team}
    function create_if_block_1$3(ctx) {
    	let a;
    	let div;
    	let t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[9]) + "";
    	let t0;
    	let t1;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, class: true });
    			var a_nodes = children(a);
    			div = claim_element(a_nodes, "DIV", { class: true, style: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, t0_value);
    			div_nodes.forEach(detach_dev);
    			t1 = claim_space(a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "this-team-name svelte-14nmjz0");
    			set_style(div, "color", "var(--" + /*_team*/ ctx[9].toLowerCase().replace(/ /g, '-') + "-secondary)");
    			set_style(div, "background-color", "var(--" + /*_team*/ ctx[9].toLowerCase().replace(/ /g, '-') + ")");
    			add_location(div, file$6, 31, 14, 1131);
    			attr_dev(a, "href", a_href_value = "/" + /*_team*/ ctx[9].toLowerCase().replace(/ /g, '-'));
    			attr_dev(a, "class", "team-link");
    			add_location(a, file$6, 30, 12, 1045);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, div);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*toAlias, teams*/ 6 && t0_value !== (t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[9]) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*teams*/ 2) {
    				set_style(div, "color", "var(--" + /*_team*/ ctx[9].toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*teams*/ 2) {
    				set_style(div, "background-color", "var(--" + /*_team*/ ctx[9].toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*teams*/ 2 && a_href_value !== (a_href_value = "/" + /*_team*/ ctx[9].toLowerCase().replace(/ /g, '-'))) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(30:10) {#if _team.toLowerCase().replace(/ /g, \\\"-\\\") == team}",
    		ctx
    	});

    	return block;
    }

    // (29:8) {#each teams as _team, _ (_team)}
    function create_each_block_1$1(key_1, ctx) {
    	let first;
    	let show_if;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (dirty & /*teams, team*/ 3) show_if = null;
    		if (show_if == null) show_if = !!(/*_team*/ ctx[9].toLowerCase().replace(/ /g, "-") == /*team*/ ctx[0]);
    		if (show_if) return create_if_block_1$3;
    		return create_else_block_1$2;
    	}

    	let current_block_type = select_block_type_1(ctx, -1);
    	let if_block = current_block_type(ctx);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			first = empty();
    			if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, first, anchor);
    			if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (current_block_type === (current_block_type = select_block_type_1(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(29:8) {#each teams as _team, _ (_team)}",
    		ctx
    	});

    	return block;
    }

    // (25:8) {#each widths as width, _}
    function create_each_block$2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, style: true });
    			children(div).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "placeholder svelte-14nmjz0");
    			set_style(div, "width", /*width*/ ctx[6] + "%");
    			add_location(div, file$6, 25, 10, 837);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(25:8) {#each widths as width, _}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let nav;
    	let div0;
    	let p;
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let button;
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*teams*/ ctx[1].length == 0) return create_if_block$3;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div0 = element("div");
    			p = element("p");
    			span = element("span");
    			t0 = text("pl");
    			t1 = text("dashboard");
    			t2 = space();
    			div1 = element("div");
    			if_block.c();
    			t3 = space();
    			div2 = element("div");
    			button = element("button");
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav = claim_element(nodes, "NAV", { id: true, class: true });
    			var nav_nodes = children(nav);
    			div0 = claim_element(nav_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			p = claim_element(div0_nodes, "P", {});
    			var p_nodes = children(p);
    			span = claim_element(p_nodes, "SPAN", { style: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "pl");
    			span_nodes.forEach(detach_dev);
    			t1 = claim_text(p_nodes, "dashboard");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(nav_nodes);
    			div1 = claim_element(nav_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(nav_nodes);
    			div2 = claim_element(nav_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			button = claim_element(div2_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			img = claim_element(button_nodes, "IMG", { src: true, alt: true });
    			button_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			nav_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_style(span, "color", "#00fe87");
    			add_location(span, file$6, 19, 6, 663);
    			add_location(p, file$6, 18, 4, 652);
    			attr_dev(div0, "class", "title no-selection svelte-14nmjz0");
    			add_location(div0, file$6, 17, 2, 614);
    			attr_dev(div1, "class", "team-links svelte-14nmjz0");
    			add_location(div1, file$6, 22, 2, 734);
    			if (!src_url_equal(img.src, img_src_value = "img/arrow-bar-left.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$6, 58, 6, 1955);
    			attr_dev(button, "class", "close-btn svelte-14nmjz0");
    			add_location(button, file$6, 57, 4, 1898);
    			attr_dev(div2, "class", "close");
    			add_location(div2, file$6, 56, 4, 1873);
    			attr_dev(nav, "id", "navBar");
    			attr_dev(nav, "class", "svelte-14nmjz0");
    			add_location(nav, file$6, 16, 0, 593);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			append_hydration_dev(nav, div0);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(p, t1);
    			append_hydration_dev(nav, t2);
    			append_hydration_dev(nav, div1);
    			if_block.m(div1, null);
    			append_hydration_dev(nav, t3);
    			append_hydration_dev(nav, div2);
    			append_hydration_dev(div2, button);
    			append_hydration_dev(button, img);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", closeNavBar, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function closeNavBar() {
    	document.getElementById("navBar").style.display = "none";
    	document.getElementById("dashboard").style.marginLeft = "0";
    	window.dispatchEvent(new Event("resize")); // Snap plotly graphs to new width
    }

    function openNavBar() {
    	document.getElementById("navBar").style.display = "block";
    	document.getElementById("dashboard").style.marginLeft = "200px";
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Nav', slots, []);
    	let widths = [];

    	for (let i = 0; i < 20; i++) {
    		widths.push(35 + Math.floor(Math.random() * 8) * 5);
    	}

    	let { team, teams, toAlias, switchTeam } = $$props;
    	const writable_props = ['team', 'teams', 'toAlias', 'switchTeam'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Nav> was created with unknown prop '${key}'`);
    	});

    	const click_handler = _team => {
    		switchTeam(_team.toLowerCase().replace(/ /g, "-"));
    	};

    	$$self.$$set = $$props => {
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(2, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(3, switchTeam = $$props.switchTeam);
    	};

    	$$self.$capture_state = () => ({
    		closeNavBar,
    		openNavBar,
    		widths,
    		team,
    		teams,
    		toAlias,
    		switchTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('widths' in $$props) $$invalidate(4, widths = $$props.widths);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(2, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(3, switchTeam = $$props.switchTeam);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [team, teams, toAlias, switchTeam, widths, click_handler];
    }

    class Nav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			team: 0,
    			teams: 1,
    			toAlias: 2,
    			switchTeam: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Nav",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*team*/ ctx[0] === undefined && !('team' in props)) {
    			console.warn("<Nav> was created without expected prop 'team'");
    		}

    		if (/*teams*/ ctx[1] === undefined && !('teams' in props)) {
    			console.warn("<Nav> was created without expected prop 'teams'");
    		}

    		if (/*toAlias*/ ctx[2] === undefined && !('toAlias' in props)) {
    			console.warn("<Nav> was created without expected prop 'toAlias'");
    		}

    		if (/*switchTeam*/ ctx[3] === undefined && !('switchTeam' in props)) {
    			console.warn("<Nav> was created without expected prop 'switchTeam'");
    		}
    	}

    	get team() {
    		throw new Error("<Nav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<Nav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get teams() {
    		throw new Error("<Nav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set teams(value) {
    		throw new Error("<Nav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toAlias() {
    		throw new Error("<Nav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toAlias(value) {
    		throw new Error("<Nav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get switchTeam() {
    		throw new Error("<Nav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchTeam(value) {
    		throw new Error("<Nav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\nav\MobileNav.svelte generated by Svelte v3.49.0 */

    const file$5 = "src\\components\\nav\\MobileNav.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    // (26:2) {#if hyphenatedTeams != undefined}
    function create_if_block$2(ctx) {
    	let div;
    	let each_value = /*hyphenatedTeams*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div_nodes);
    			}

    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "team-links svelte-1d401pl");
    			add_location(div, file$5, 26, 4, 866);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*hyphenatedTeams, switchTeamToTop, toAlias, teams*/ 15) {
    				each_value = /*hyphenatedTeams*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(26:2) {#if hyphenatedTeams != undefined}",
    		ctx
    	});

    	return block;
    }

    // (29:8) {#if team != null}
    function create_if_block_1$2(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[13] == 0 || /*i*/ ctx[13] == 1 && /*hyphenatedTeams*/ ctx[2][0] == null) return create_if_block_2$1;
    		if (/*i*/ ctx[13] == /*hyphenatedTeams*/ ctx[2].length - 1 || /*i*/ ctx[13] == /*hyphenatedTeams*/ ctx[2].length - 2 && /*hyphenatedTeams*/ ctx[2][/*hyphenatedTeams*/ ctx[2].length - 1] == null) return create_if_block_3$2;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(29:8) {#if team != null}",
    		ctx
    	});

    	return block;
    }

    // (50:10) {:else}
    function create_else_block$2(ctx) {
    	let button;
    	let t_value = /*toAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[13]]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[9](/*team*/ ctx[11]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_style(button, "color", "var(--" + /*team*/ ctx[11] + "-secondary)");
    			set_style(button, "background-color", "var(--" + /*team*/ ctx[11] + ")");
    			attr_dev(button, "class", "team-link svelte-1d401pl");
    			add_location(button, file$5, 50, 12, 1991);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_2, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*toAlias, teams*/ 3 && t_value !== (t_value = /*toAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[13]]) + "")) set_data_dev(t, t_value);

    			if (dirty & /*hyphenatedTeams*/ 4) {
    				set_style(button, "color", "var(--" + /*team*/ ctx[11] + "-secondary)");
    			}

    			if (dirty & /*hyphenatedTeams*/ 4) {
    				set_style(button, "background-color", "var(--" + /*team*/ ctx[11] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(50:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (40:144) 
    function create_if_block_3$2(ctx) {
    	let button;
    	let t_value = /*toAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[13]]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[8](/*i*/ ctx[13]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_style(button, "color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + "-secondary)");
    			set_style(button, "background-color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + ")");
    			attr_dev(button, "class", "team-link last-team svelte-1d401pl");
    			add_location(button, file$5, 41, 12, 1628);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_1, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*toAlias, teams*/ 3 && t_value !== (t_value = /*toAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[13]]) + "")) set_data_dev(t, t_value);

    			if (dirty & /*hyphenatedTeams*/ 4) {
    				set_style(button, "color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + "-secondary)");
    			}

    			if (dirty & /*hyphenatedTeams*/ 4) {
    				set_style(button, "background-color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(40:144) ",
    		ctx
    	});

    	return block;
    }

    // (30:10) {#if i == 0 || (i == 1 && hyphenatedTeams[0] == null)}
    function create_if_block_2$1(ctx) {
    	let button;
    	let t_value = /*toAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[13]]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[7](/*i*/ ctx[13]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_style(button, "color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + "-secondary)");
    			set_style(button, "background-color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + ")");
    			attr_dev(button, "class", "team-link first-team svelte-1d401pl");
    			add_location(button, file$5, 31, 12, 1091);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*toAlias, teams*/ 3 && t_value !== (t_value = /*toAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[13]]) + "")) set_data_dev(t, t_value);

    			if (dirty & /*hyphenatedTeams*/ 4) {
    				set_style(button, "color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + "-secondary)");
    			}

    			if (dirty & /*hyphenatedTeams*/ 4) {
    				set_style(button, "background-color", "var(--" + /*hyphenatedTeams*/ ctx[2][/*i*/ ctx[13]] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(30:10) {#if i == 0 || (i == 1 && hyphenatedTeams[0] == null)}",
    		ctx
    	});

    	return block;
    }

    // (28:6) {#each hyphenatedTeams as team, i}
    function create_each_block$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*team*/ ctx[11] != null && create_if_block_1$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*team*/ ctx[11] != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(28:6) {#each hyphenatedTeams as team, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let nav;
    	let if_block = /*hyphenatedTeams*/ ctx[2] != undefined && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav = claim_element(nodes, "NAV", { id: true, style: true, class: true });
    			var nav_nodes = children(nav);
    			if (if_block) if_block.l(nav_nodes);
    			nav_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(nav, "id", "mobileNav");
    			set_style(nav, "width", "0px");
    			attr_dev(nav, "class", "svelte-1d401pl");
    			add_location(nav, file$5, 24, 0, 782);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			if (if_block) if_block.m(nav, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*hyphenatedTeams*/ ctx[2] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(nav, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MobileNav', slots, []);

    	function switchTeamToTop(team) {
    		switchTeam(team);
    		window.scrollTo(0, 0);
    		toggleMobileNav();
    	}

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

    		$$invalidate(2, hyphenatedTeams = hyphenatedTeamNames);
    	}

    	let hyphenatedTeams;
    	let { hyphenatedTeam, teams, toAlias, switchTeam, toggleMobileNav } = $$props;
    	const writable_props = ['hyphenatedTeam', 'teams', 'toAlias', 'switchTeam', 'toggleMobileNav'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MobileNav> was created with unknown prop '${key}'`);
    	});

    	const click_handler = i => {
    		switchTeamToTop(hyphenatedTeams[i]);
    	};

    	const click_handler_1 = i => {
    		switchTeamToTop(hyphenatedTeams[i]);
    	};

    	const click_handler_2 = team => {
    		switchTeamToTop(team);
    	};

    	$$self.$$set = $$props => {
    		if ('hyphenatedTeam' in $$props) $$invalidate(4, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('teams' in $$props) $$invalidate(0, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(1, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(5, switchTeam = $$props.switchTeam);
    		if ('toggleMobileNav' in $$props) $$invalidate(6, toggleMobileNav = $$props.toggleMobileNav);
    	};

    	$$self.$capture_state = () => ({
    		switchTeamToTop,
    		getHyphenatedTeamNames,
    		hyphenatedTeams,
    		hyphenatedTeam,
    		teams,
    		toAlias,
    		switchTeam,
    		toggleMobileNav
    	});

    	$$self.$inject_state = $$props => {
    		if ('hyphenatedTeams' in $$props) $$invalidate(2, hyphenatedTeams = $$props.hyphenatedTeams);
    		if ('hyphenatedTeam' in $$props) $$invalidate(4, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('teams' in $$props) $$invalidate(0, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(1, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(5, switchTeam = $$props.switchTeam);
    		if ('toggleMobileNav' in $$props) $$invalidate(6, toggleMobileNav = $$props.toggleMobileNav);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*hyphenatedTeam, teams*/ 17) {
    			//@ts-ignore
    			hyphenatedTeam & teams.length > 0 & getHyphenatedTeamNames();
    		}
    	};

    	return [
    		teams,
    		toAlias,
    		hyphenatedTeams,
    		switchTeamToTop,
    		hyphenatedTeam,
    		switchTeam,
    		toggleMobileNav,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class MobileNav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			hyphenatedTeam: 4,
    			teams: 0,
    			toAlias: 1,
    			switchTeam: 5,
    			toggleMobileNav: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MobileNav",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*hyphenatedTeam*/ ctx[4] === undefined && !('hyphenatedTeam' in props)) {
    			console.warn("<MobileNav> was created without expected prop 'hyphenatedTeam'");
    		}

    		if (/*teams*/ ctx[0] === undefined && !('teams' in props)) {
    			console.warn("<MobileNav> was created without expected prop 'teams'");
    		}

    		if (/*toAlias*/ ctx[1] === undefined && !('toAlias' in props)) {
    			console.warn("<MobileNav> was created without expected prop 'toAlias'");
    		}

    		if (/*switchTeam*/ ctx[5] === undefined && !('switchTeam' in props)) {
    			console.warn("<MobileNav> was created without expected prop 'switchTeam'");
    		}

    		if (/*toggleMobileNav*/ ctx[6] === undefined && !('toggleMobileNav' in props)) {
    			console.warn("<MobileNav> was created without expected prop 'toggleMobileNav'");
    		}
    	}

    	get hyphenatedTeam() {
    		throw new Error("<MobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hyphenatedTeam(value) {
    		throw new Error("<MobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get teams() {
    		throw new Error("<MobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set teams(value) {
    		throw new Error("<MobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toAlias() {
    		throw new Error("<MobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toAlias(value) {
    		throw new Error("<MobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get switchTeam() {
    		throw new Error("<MobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchTeam(value) {
    		throw new Error("<MobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toggleMobileNav() {
    		throw new Error("<MobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toggleMobileNav(value) {
    		throw new Error("<MobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_scored_and_conceded\ScoredConcededOverTimeGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$1 } = globals;
    const file$4 = "src\\components\\goals_scored_and_conceded\\ScoredConcededOverTimeGraph.svelte";

    function create_fragment$5(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$4, 234, 2, 6768);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$4, 233, 0, 6747);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[5](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[5](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function dateDiffInDays(date1, date2) {
    	//@ts-ignore
    	return Math.floor((date1 - date2) / (1000 * 60 * 60 * 24));
    }

    function seasonFinishLines(x, maxY) {
    	let lines = [];

    	for (let i = 0; i < x.length - 1; i++) {
    		if (dateDiffInDays(new Date(x[i + 1]), new Date(x[i])) > 60) {
    			lines.push({
    				type: "line",
    				x0: x[i],
    				y0: 0,
    				x1: x[i],
    				y1: maxY,
    				line: { color: "black", dash: "dot", width: 1 }
    			});
    		}
    	}

    	return lines;
    }

    function goalsScoredLine(x, y) {
    	return {
    		x,
    		y,
    		type: "scatter",
    		fill: "tozeroy",
    		mode: "lines",
    		name: "Scored",
    		line: { color: "#00fe87" },
    		hovertemplate: "%{x|%d %b %Y}<br>Avg scored: <b>%{y:.1f}</b><extra></extra>"
    	};
    }

    function goalsConcededLine(x, y) {
    	return {
    		x,
    		y,
    		type: "scatter",
    		fill: "tozeroy",
    		mode: "lines",
    		name: "Conceded",
    		line: { color: "#f83027" },
    		hovertemplate: "%{x|%d %b %Y}<br>Avg conceded: <b>%{y:.1f}</b><extra></extra>"
    	};
    }

    function goalsOverTime(data, team, numSeasons) {
    	let goals = [];

    	for (let i = numSeasons - 1; i >= 0; i--) {
    		let teamGames = data.form[team][data._id - i];

    		for (let matchday of Object.keys(teamGames)) {
    			let match = teamGames[matchday];

    			if (match.score != null) {
    				let [h, _, a] = match.score.split(" ");
    				h = parseInt(h);
    				a = parseInt(a);
    				let scored, conceded;

    				if (match.atHome) {
    					scored = h;
    					conceded = a;
    				} else {
    					scored = a;
    					conceded = h;
    				}

    				goals.push({
    					date: match.date,
    					matchday: parseInt(matchday),
    					scored,
    					conceded
    				});
    			}
    		}
    	}

    	return goals;
    }

    function lineData(data, team) {
    	let goals = goalsOverTime(data, team, 3);

    	// Sort by game date
    	goals.sort(function (a, b) {
    		return a.date < b.date ? -1 : a.date == b.date ? 0 : 1;
    	});

    	let dates = [];
    	let scored = [];
    	let conceded = [];

    	for (let i = 0; i < goals.length; i++) {
    		dates.push(goals[i].date);
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

    	return [dates, scored, conceded];
    }

    function lines(dates, scored, conceded) {
    	return [goalsScoredLine(dates, scored), goalsConcededLine(dates, conceded)];
    }

    function defaultLayout(seasonLines) {
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
    			fixedrange: true
    		},
    		dragmode: false,
    		shapes: [...seasonLines],
    		legend: { x: 1, xanchor: "right", y: 0.95 }
    	};
    }

    function buildPlotData(data, team) {
    	let [dates, scored, conceded] = lineData(data, team);
    	let maxY = Math.max(Math.max(...scored), Math.max(...conceded));
    	let seasonLines = seasonFinishLines(dates, maxY);

    	let plotData = {
    		data: [...lines(dates, scored, conceded)],
    		layout: defaultLayout(seasonLines),
    		config: {
    			responsive: true,
    			showSendToCloud: false,
    			displayModeBar: false
    		}
    	};

    	return plotData;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScoredConcededOverTimeGraph', slots, []);

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
    		$$invalidate(4, setup = true);
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
    			plotData.data[0] = newPlotData.data[0];
    			plotData.data[1] = newPlotData.data[1];

    			for (let i = 0; i < plotData.layout.shapes.length; i++) {
    				if (i < newPlotData.layout.shapes.length) {
    					plotData.layout.shapes[i] = newPlotData.layout.shapes[i];
    				} else {
    					plotData.layout.shapes[i] = null;
    				}
    			}

    			//@ts-ignore
    			Plotly.redraw(plotDiv);

    			if (mobileView) {
    				setMobileLayout();
    			}
    		}
    	}

    	let { data, team, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ScoredConcededOverTimeGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		dateDiffInDays,
    		seasonFinishLines,
    		goalsScoredLine,
    		goalsConcededLine,
    		goalsOverTime,
    		lineData,
    		lines,
    		defaultLayout,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData,
    		plotDiv,
    		plotData,
    		setup,
    		genPlot,
    		refreshPlot,
    		data,
    		team,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(4, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 8) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 24) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, team, mobileView, setup, div0_binding];
    }

    class ScoredConcededOverTimeGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScoredConcededOverTimeGraph",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<ScoredConcededOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<ScoredConcededOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (/*mobileView*/ ctx[3] === undefined && !('mobileView' in props)) {
    			console.warn("<ScoredConcededOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<ScoredConcededOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<ScoredConcededOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<ScoredConcededOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<ScoredConcededOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<ScoredConcededOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<ScoredConcededOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\routes\Team.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1, console: console_1$1, document: document_1$1, window: window_1 } = globals;
    const file$3 = "src\\routes\\Team.svelte";

    // (202:4) {:else}
    function create_else_block_2(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Select Team");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { id: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, "Select Team");
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "id", "mobileNavBtn");
    			attr_dev(button, "class", "svelte-1ao5tmf");
    			add_location(button, file$3, 202, 6, 7141);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", toggleMobileNav, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(202:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (199:4) {#if teams.length == 0}
    function create_if_block_3$1(ctx) {
    	let button;
    	let t;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Select Team");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { id: true, style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, "Select Team");
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "id", "mobileNavBtn");
    			set_style(button, "cursor", "default");
    			attr_dev(button, "class", "svelte-1ao5tmf");
    			add_location(button, file$3, 200, 6, 7048);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(199:4) {#if teams.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (397:6) {:else}
    function create_else_block_1$1(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "loading-spinner");
    			add_location(div0, file$3, 398, 10, 13571);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$3, 397, 8, 13520);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(397:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (222:6) {#if data != undefined}
    function create_if_block$1(ctx) {
    	let div9;
    	let div2;
    	let t0;
    	let div1;
    	let h10;
    	let t1;
    	let t2;
    	let div0;
    	let fixturesgraph;
    	let t3;
    	let div5;
    	let div3;
    	let currentform;
    	let t4;
    	let tablesnippet;
    	let t5;
    	let div4;
    	let nextgame;
    	let t6;
    	let div8;
    	let div7;
    	let h11;
    	let t7;
    	let t8;
    	let div6;
    	let formovertimegraph;
    	let t9;
    	let current;

    	function select_block_type_2(ctx, dirty) {
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type_2();
    	let if_block0 = current_block_type(ctx);

    	fixturesgraph = new FixturesGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	currentform = new CurrentForm({
    			props: {
    				data: /*data*/ ctx[8],
    				currentMatchday: /*currentMatchday*/ ctx[6],
    				team: /*team*/ ctx[4],
    				toInitials
    			},
    			$$inline: true
    		});

    	tablesnippet = new TableSnippet({
    			props: {
    				data: /*data*/ ctx[8],
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				team: /*team*/ ctx[4],
    				switchTeam: /*switchTeam*/ ctx[12],
    				toAlias: /*toAlias*/ ctx[10]
    			},
    			$$inline: true
    		});

    	nextgame = new NextGame({
    			props: {
    				data: /*data*/ ctx[8],
    				currentMatchday: /*currentMatchday*/ ctx[6],
    				team: /*team*/ ctx[4],
    				showBadge,
    				toAlias: /*toAlias*/ ctx[10],
    				toInitials,
    				switchTeam: /*switchTeam*/ ctx[12]
    			},
    			$$inline: true
    		});

    	formovertimegraph = new FormOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				playedMatchdays: /*playedMatchdays*/ ctx[7],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	let if_block1 = /*load*/ ctx[3] && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			div2 = element("div");
    			if_block0.c();
    			t0 = space();
    			div1 = element("div");
    			h10 = element("h1");
    			t1 = text("Fixtures");
    			t2 = space();
    			div0 = element("div");
    			create_component(fixturesgraph.$$.fragment);
    			t3 = space();
    			div5 = element("div");
    			div3 = element("div");
    			create_component(currentform.$$.fragment);
    			t4 = space();
    			create_component(tablesnippet.$$.fragment);
    			t5 = space();
    			div4 = element("div");
    			create_component(nextgame.$$.fragment);
    			t6 = space();
    			div8 = element("div");
    			div7 = element("div");
    			h11 = element("h1");
    			t7 = text("Form Over Time");
    			t8 = space();
    			div6 = element("div");
    			create_component(formovertimegraph.$$.fragment);
    			t9 = space();
    			if (if_block1) if_block1.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div9 = claim_element(nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div2 = claim_element(div9_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			if_block0.l(div2_nodes);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h10 = claim_element(div1_nodes, "H1", { class: true });
    			var h10_nodes = children(h10);
    			t1 = claim_text(h10_nodes, "Fixtures");
    			h10_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(fixturesgraph.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t3 = claim_space(div9_nodes);
    			div5 = claim_element(div9_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(currentform.$$.fragment, div3_nodes);
    			t4 = claim_space(div3_nodes);
    			claim_component(tablesnippet.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			t5 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			claim_component(nextgame.$$.fragment, div4_nodes);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t6 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			h11 = claim_element(div7_nodes, "H1", { class: true });
    			var h11_nodes = children(h11);
    			t7 = claim_text(h11_nodes, "Form Over Time");
    			h11_nodes.forEach(detach_dev);
    			t8 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			claim_component(formovertimegraph.$$.fragment, div6_nodes);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t9 = claim_space(div9_nodes);
    			if (if_block1) if_block1.l(div9_nodes);
    			div9_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h10, "class", "lowered");
    			add_location(h10, file$3, 266, 14, 9382);
    			attr_dev(div0, "class", "graph mini-graph mobile-margin");
    			add_location(div0, file$3, 267, 14, 9431);
    			attr_dev(div1, "class", "row-right fixtures-graph row-graph svelte-1ao5tmf");
    			add_location(div1, file$3, 265, 12, 9318);
    			attr_dev(div2, "class", "row multi-element-row small-bottom-margin svelte-1ao5tmf");
    			add_location(div2, file$3, 223, 10, 7762);
    			attr_dev(div3, "class", "row-left form-details svelte-1ao5tmf");
    			add_location(div3, file$3, 274, 12, 9660);
    			attr_dev(div4, "class", "row-right svelte-1ao5tmf");
    			add_location(div4, file$3, 284, 12, 9991);
    			attr_dev(div5, "class", "row multi-element-row svelte-1ao5tmf");
    			add_location(div5, file$3, 273, 10, 9611);
    			attr_dev(h11, "class", "lowered");
    			add_location(h11, file$3, 299, 14, 10389);
    			attr_dev(div6, "class", "graph full-row-graph svelte-1ao5tmf");
    			add_location(div6, file$3, 300, 14, 10444);
    			attr_dev(div7, "class", "form-graph row-graph svelte-1ao5tmf");
    			add_location(div7, file$3, 298, 12, 10339);
    			attr_dev(div8, "class", "row svelte-1ao5tmf");
    			add_location(div8, file$3, 297, 10, 10308);
    			attr_dev(div9, "class", "page-content svelte-1ao5tmf");
    			add_location(div9, file$3, 222, 8, 7724);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div9, anchor);
    			append_hydration_dev(div9, div2);
    			if_block0.m(div2, null);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h10);
    			append_hydration_dev(h10, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, div0);
    			mount_component(fixturesgraph, div0, null);
    			append_hydration_dev(div9, t3);
    			append_hydration_dev(div9, div5);
    			append_hydration_dev(div5, div3);
    			mount_component(currentform, div3, null);
    			append_hydration_dev(div3, t4);
    			mount_component(tablesnippet, div3, null);
    			append_hydration_dev(div5, t5);
    			append_hydration_dev(div5, div4);
    			mount_component(nextgame, div4, null);
    			append_hydration_dev(div9, t6);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, h11);
    			append_hydration_dev(h11, t7);
    			append_hydration_dev(div7, t8);
    			append_hydration_dev(div7, div6);
    			mount_component(formovertimegraph, div6, null);
    			append_hydration_dev(div9, t9);
    			if (if_block1) if_block1.m(div9, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if_block0.p(ctx, dirty);
    			const fixturesgraph_changes = {};
    			if (dirty & /*data*/ 256) fixturesgraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) fixturesgraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*mobileView*/ 512) fixturesgraph_changes.mobileView = /*mobileView*/ ctx[9];
    			fixturesgraph.$set(fixturesgraph_changes);
    			const currentform_changes = {};
    			if (dirty & /*data*/ 256) currentform_changes.data = /*data*/ ctx[8];
    			if (dirty & /*currentMatchday*/ 64) currentform_changes.currentMatchday = /*currentMatchday*/ ctx[6];
    			if (dirty & /*team*/ 16) currentform_changes.team = /*team*/ ctx[4];
    			currentform.$set(currentform_changes);
    			const tablesnippet_changes = {};
    			if (dirty & /*data*/ 256) tablesnippet_changes.data = /*data*/ ctx[8];
    			if (dirty & /*hyphenatedTeam*/ 1) tablesnippet_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			if (dirty & /*team*/ 16) tablesnippet_changes.team = /*team*/ ctx[4];
    			tablesnippet.$set(tablesnippet_changes);
    			const nextgame_changes = {};
    			if (dirty & /*data*/ 256) nextgame_changes.data = /*data*/ ctx[8];
    			if (dirty & /*currentMatchday*/ 64) nextgame_changes.currentMatchday = /*currentMatchday*/ ctx[6];
    			if (dirty & /*team*/ 16) nextgame_changes.team = /*team*/ ctx[4];
    			nextgame.$set(nextgame_changes);
    			const formovertimegraph_changes = {};
    			if (dirty & /*data*/ 256) formovertimegraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) formovertimegraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*playedMatchdays*/ 128) formovertimegraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[7];
    			if (dirty & /*mobileView*/ 512) formovertimegraph_changes.mobileView = /*mobileView*/ ctx[9];
    			formovertimegraph.$set(formovertimegraph_changes);

    			if (/*load*/ ctx[3]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*load*/ 8) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div9, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fixturesgraph.$$.fragment, local);
    			transition_in(currentform.$$.fragment, local);
    			transition_in(tablesnippet.$$.fragment, local);
    			transition_in(nextgame.$$.fragment, local);
    			transition_in(formovertimegraph.$$.fragment, local);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fixturesgraph.$$.fragment, local);
    			transition_out(currentform.$$.fragment, local);
    			transition_out(tablesnippet.$$.fragment, local);
    			transition_out(nextgame.$$.fragment, local);
    			transition_out(formovertimegraph.$$.fragment, local);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div9);
    			if_block0.d();
    			destroy_component(fixturesgraph);
    			destroy_component(currentform);
    			destroy_component(tablesnippet);
    			destroy_component(nextgame);
    			destroy_component(formovertimegraph);
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(222:6) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (234:12) {:else}
    function create_else_block$1(ctx) {
    	let div2;
    	let div0;
    	let svg;
    	let circle0;
    	let circle0_fill_value;
    	let circle1;
    	let circle1_fill_value;
    	let circle2;
    	let circle2_fill_value;
    	let t0;
    	let div1;
    	let t1_value = /*data*/ ctx[8].standings[/*team*/ ctx[4]][/*data*/ ctx[8]._id].position + "";
    	let t1;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			svg = svg_element("svg");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			circle2 = svg_element("circle");
    			t0 = space();
    			div1 = element("div");
    			t1 = text(t1_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			svg = claim_svg_element(div0_nodes, "svg", { class: true });
    			var svg_nodes = children(svg);

    			circle0 = claim_svg_element(svg_nodes, "circle", {
    				cx: true,
    				cy: true,
    				r: true,
    				"stroke-width": true,
    				fill: true
    			});

    			children(circle0).forEach(detach_dev);

    			circle1 = claim_svg_element(svg_nodes, "circle", {
    				cx: true,
    				cy: true,
    				r: true,
    				"stroke-width": true,
    				fill: true
    			});

    			children(circle1).forEach(detach_dev);

    			circle2 = claim_svg_element(svg_nodes, "circle", {
    				cx: true,
    				cy: true,
    				r: true,
    				"stroke-width": true,
    				fill: true
    			});

    			children(circle2).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t1 = claim_text(div1_nodes, t1_value);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(circle0, "cx", "300");
    			attr_dev(circle0, "cy", "150");
    			attr_dev(circle0, "r", "100");
    			attr_dev(circle0, "stroke-width", "0");
    			attr_dev(circle0, "fill", circle0_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(circle0, file$3, 237, 20, 8366);
    			attr_dev(circle1, "cx", "170");
    			attr_dev(circle1, "cy", "170");
    			attr_dev(circle1, "r", "140");
    			attr_dev(circle1, "stroke-width", "0");
    			attr_dev(circle1, "fill", circle1_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(circle1, file$3, 244, 20, 8618);
    			attr_dev(circle2, "cx", "300");
    			attr_dev(circle2, "cy", "320");
    			attr_dev(circle2, "r", "170");
    			attr_dev(circle2, "stroke-width", "0");
    			attr_dev(circle2, "fill", circle2_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(circle2, file$3, 251, 20, 8860);
    			attr_dev(svg, "class", "circles-background svelte-1ao5tmf");
    			add_location(svg, file$3, 236, 18, 8312);
    			attr_dev(div0, "class", "circles-background-container svelte-1ao5tmf");
    			add_location(div0, file$3, 235, 16, 8250);
    			attr_dev(div1, "class", "position-central svelte-1ao5tmf");
    			add_location(div1, file$3, 260, 16, 9148);
    			attr_dev(div2, "class", "row-left position-no-badge svelte-1ao5tmf");
    			add_location(div2, file$3, 234, 14, 8192);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div0, svg);
    			append_hydration_dev(svg, circle0);
    			append_hydration_dev(svg, circle1);
    			append_hydration_dev(svg, circle2);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*hyphenatedTeam*/ 1 && circle0_fill_value !== (circle0_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)")) {
    				attr_dev(circle0, "fill", circle0_fill_value);
    			}

    			if (dirty & /*hyphenatedTeam*/ 1 && circle1_fill_value !== (circle1_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")")) {
    				attr_dev(circle1, "fill", circle1_fill_value);
    			}

    			if (dirty & /*hyphenatedTeam*/ 1 && circle2_fill_value !== (circle2_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")")) {
    				attr_dev(circle2, "fill", circle2_fill_value);
    			}

    			if (dirty & /*data, team*/ 272 && t1_value !== (t1_value = /*data*/ ctx[8].standings[/*team*/ ctx[4]][/*data*/ ctx[8]._id].position + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(234:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (312:10) {#if load}
    function create_if_block_1$1(ctx) {
    	let div2;
    	let div1;
    	let h10;
    	let t0;
    	let t1;
    	let div0;
    	let positionovertimegraph;
    	let t2;
    	let div5;
    	let div4;
    	let h11;
    	let t3;
    	let t4;
    	let div3;
    	let goalsscoredandconcededgraph;
    	let t5;
    	let div8;
    	let div7;
    	let div6;
    	let cleansheetsgraph;
    	let t6;
    	let div9;
    	let statsvalues;
    	let t7;
    	let div12;
    	let div11;
    	let div10;
    	let scoredconcededovertimegraph;
    	let t8;
    	let div14;
    	let div13;
    	let h12;
    	let t9;
    	let t10;
    	let goalspergame;
    	let t11;
    	let div17;
    	let div16;
    	let div15;
    	let scorelinefreqgraph;
    	let t12;
    	let div20;
    	let div19;
    	let h13;
    	let t13;
    	let t14;
    	let div18;
    	let spidergraph;
    	let t15;
    	let teamsfooter;
    	let current;

    	positionovertimegraph = new PositionOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				playedMatchdays: /*playedMatchdays*/ ctx[7],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	goalsscoredandconcededgraph = new ScoredAndConcededGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				playedMatchdays: /*playedMatchdays*/ ctx[7],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	cleansheetsgraph = new CleanSheetsGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				playedMatchdays: /*playedMatchdays*/ ctx[7],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	statsvalues = new StatsValues({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4]
    			},
    			$$inline: true
    		});

    	scoredconcededovertimegraph = new ScoredConcededOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	goalspergame = new GoalsPerGame({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	scorelinefreqgraph = new ScorelineFreqGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[9]
    			},
    			$$inline: true
    		});

    	spidergraph = new SpiderGraph({
    			props: {
    				data: /*data*/ ctx[8],
    				team: /*team*/ ctx[4],
    				teams: /*teams*/ ctx[5],
    				toAlias: /*toAlias*/ ctx[10],
    				toName: /*toName*/ ctx[11]
    			},
    			$$inline: true
    		});

    	teamsfooter = new TeamsFooter({
    			props: { lastUpdated: /*data*/ ctx[8].lastUpdated },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			h10 = element("h1");
    			t0 = text("Position Over Time");
    			t1 = space();
    			div0 = element("div");
    			create_component(positionovertimegraph.$$.fragment);
    			t2 = space();
    			div5 = element("div");
    			div4 = element("div");
    			h11 = element("h1");
    			t3 = text("Goals Scored and Conceded");
    			t4 = space();
    			div3 = element("div");
    			create_component(goalsscoredandconcededgraph.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			div7 = element("div");
    			div6 = element("div");
    			create_component(cleansheetsgraph.$$.fragment);
    			t6 = space();
    			div9 = element("div");
    			create_component(statsvalues.$$.fragment);
    			t7 = space();
    			div12 = element("div");
    			div11 = element("div");
    			div10 = element("div");
    			create_component(scoredconcededovertimegraph.$$.fragment);
    			t8 = space();
    			div14 = element("div");
    			div13 = element("div");
    			h12 = element("h1");
    			t9 = text("Goals Per Game");
    			t10 = space();
    			create_component(goalspergame.$$.fragment);
    			t11 = space();
    			div17 = element("div");
    			div16 = element("div");
    			div15 = element("div");
    			create_component(scorelinefreqgraph.$$.fragment);
    			t12 = space();
    			div20 = element("div");
    			div19 = element("div");
    			h13 = element("h1");
    			t13 = text("Team Comparison");
    			t14 = space();
    			div18 = element("div");
    			create_component(spidergraph.$$.fragment);
    			t15 = space();
    			create_component(teamsfooter.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h10 = claim_element(div1_nodes, "H1", { class: true });
    			var h10_nodes = children(h10);
    			t0 = claim_text(h10_nodes, "Position Over Time");
    			h10_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(positionovertimegraph.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t2 = claim_space(nodes);
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			h11 = claim_element(div4_nodes, "H1", { class: true });
    			var h11_nodes = children(h11);
    			t3 = claim_text(h11_nodes, "Goals Scored and Conceded");
    			h11_nodes.forEach(detach_dev);
    			t4 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(goalsscoredandconcededgraph.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t5 = claim_space(nodes);
    			div8 = claim_element(nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			claim_component(cleansheetsgraph.$$.fragment, div6_nodes);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t6 = claim_space(nodes);
    			div9 = claim_element(nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			claim_component(statsvalues.$$.fragment, div9_nodes);
    			div9_nodes.forEach(detach_dev);
    			t7 = claim_space(nodes);
    			div12 = claim_element(nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			claim_component(scoredconcededovertimegraph.$$.fragment, div10_nodes);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			t8 = claim_space(nodes);
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			h12 = claim_element(div13_nodes, "H1", {});
    			var h12_nodes = children(h12);
    			t9 = claim_text(h12_nodes, "Goals Per Game");
    			h12_nodes.forEach(detach_dev);
    			t10 = claim_space(div13_nodes);
    			claim_component(goalspergame.$$.fragment, div13_nodes);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			t11 = claim_space(nodes);
    			div17 = claim_element(nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			div16 = claim_element(div17_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			div15 = claim_element(div16_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			claim_component(scorelinefreqgraph.$$.fragment, div15_nodes);
    			div15_nodes.forEach(detach_dev);
    			div16_nodes.forEach(detach_dev);
    			div17_nodes.forEach(detach_dev);
    			t12 = claim_space(nodes);
    			div20 = claim_element(nodes, "DIV", { class: true });
    			var div20_nodes = children(div20);
    			div19 = claim_element(div20_nodes, "DIV", { class: true });
    			var div19_nodes = children(div19);
    			h13 = claim_element(div19_nodes, "H1", {});
    			var h13_nodes = children(h13);
    			t13 = claim_text(h13_nodes, "Team Comparison");
    			h13_nodes.forEach(detach_dev);
    			t14 = claim_space(div19_nodes);
    			div18 = claim_element(div19_nodes, "DIV", { class: true });
    			var div18_nodes = children(div18);
    			claim_component(spidergraph.$$.fragment, div18_nodes);
    			div18_nodes.forEach(detach_dev);
    			div19_nodes.forEach(detach_dev);
    			div20_nodes.forEach(detach_dev);
    			t15 = claim_space(nodes);
    			claim_component(teamsfooter.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h10, "class", "lowered");
    			add_location(h10, file$3, 314, 16, 10852);
    			attr_dev(div0, "class", "graph full-row-graph svelte-1ao5tmf");
    			add_location(div0, file$3, 315, 16, 10913);
    			attr_dev(div1, "class", "position-over-time-graph row-graph svelte-1ao5tmf");
    			add_location(div1, file$3, 313, 14, 10786);
    			attr_dev(div2, "class", "row svelte-1ao5tmf");
    			add_location(div2, file$3, 312, 12, 10753);
    			attr_dev(h11, "class", "lowered");
    			add_location(h11, file$3, 328, 16, 11344);
    			attr_dev(div3, "class", "graph full-row-graph svelte-1ao5tmf");
    			add_location(div3, file$3, 329, 16, 11412);
    			attr_dev(div4, "class", "goals-scored-vs-conceded-graph row-graph svelte-1ao5tmf");
    			add_location(div4, file$3, 327, 14, 11272);
    			attr_dev(div5, "class", "row no-bottom-margin svelte-1ao5tmf");
    			add_location(div5, file$3, 326, 12, 11222);
    			attr_dev(div6, "class", "clean-sheets graph full-row-graph svelte-1ao5tmf");
    			add_location(div6, file$3, 342, 16, 11801);
    			attr_dev(div7, "class", "row-graph svelte-1ao5tmf");
    			add_location(div7, file$3, 341, 14, 11760);
    			attr_dev(div8, "class", "row svelte-1ao5tmf");
    			add_location(div8, file$3, 340, 12, 11727);
    			attr_dev(div9, "class", "season-stats-row svelte-1ao5tmf");
    			add_location(div9, file$3, 353, 12, 12130);
    			attr_dev(div10, "class", "graph full-row-graph svelte-1ao5tmf");
    			add_location(div10, file$3, 359, 16, 12327);
    			attr_dev(div11, "class", "row-graph svelte-1ao5tmf");
    			add_location(div11, file$3, 358, 14, 12286);
    			attr_dev(div12, "class", "row svelte-1ao5tmf");
    			add_location(div12, file$3, 357, 12, 12253);
    			add_location(h12, file$3, 371, 16, 12692);
    			attr_dev(div13, "class", "goals-freq-row row-graph svelte-1ao5tmf");
    			add_location(div13, file$3, 370, 14, 12636);
    			attr_dev(div14, "class", "row svelte-1ao5tmf");
    			add_location(div14, file$3, 369, 12, 12603);
    			attr_dev(div15, "class", "score-freq graph svelte-1ao5tmf");
    			add_location(div15, file$3, 378, 16, 12908);
    			attr_dev(div16, "class", "row-graph svelte-1ao5tmf");
    			add_location(div16, file$3, 377, 14, 12867);
    			attr_dev(div17, "class", "row svelte-1ao5tmf");
    			add_location(div17, file$3, 376, 12, 12834);
    			add_location(h13, file$3, 386, 16, 13180);
    			attr_dev(div18, "class", "spider-chart-container svelte-1ao5tmf");
    			add_location(div18, file$3, 387, 16, 13222);
    			attr_dev(div19, "class", "spider-chart-row row-graph svelte-1ao5tmf");
    			add_location(div19, file$3, 385, 14, 13122);
    			attr_dev(div20, "class", "row svelte-1ao5tmf");
    			add_location(div20, file$3, 384, 12, 13089);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h10);
    			append_hydration_dev(h10, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			mount_component(positionovertimegraph, div0, null);
    			insert_hydration_dev(target, t2, anchor);
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, h11);
    			append_hydration_dev(h11, t3);
    			append_hydration_dev(div4, t4);
    			append_hydration_dev(div4, div3);
    			mount_component(goalsscoredandconcededgraph, div3, null);
    			insert_hydration_dev(target, t5, anchor);
    			insert_hydration_dev(target, div8, anchor);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, div6);
    			mount_component(cleansheetsgraph, div6, null);
    			insert_hydration_dev(target, t6, anchor);
    			insert_hydration_dev(target, div9, anchor);
    			mount_component(statsvalues, div9, null);
    			insert_hydration_dev(target, t7, anchor);
    			insert_hydration_dev(target, div12, anchor);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div10);
    			mount_component(scoredconcededovertimegraph, div10, null);
    			insert_hydration_dev(target, t8, anchor);
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, h12);
    			append_hydration_dev(h12, t9);
    			append_hydration_dev(div13, t10);
    			mount_component(goalspergame, div13, null);
    			insert_hydration_dev(target, t11, anchor);
    			insert_hydration_dev(target, div17, anchor);
    			append_hydration_dev(div17, div16);
    			append_hydration_dev(div16, div15);
    			mount_component(scorelinefreqgraph, div15, null);
    			insert_hydration_dev(target, t12, anchor);
    			insert_hydration_dev(target, div20, anchor);
    			append_hydration_dev(div20, div19);
    			append_hydration_dev(div19, h13);
    			append_hydration_dev(h13, t13);
    			append_hydration_dev(div19, t14);
    			append_hydration_dev(div19, div18);
    			mount_component(spidergraph, div18, null);
    			insert_hydration_dev(target, t15, anchor);
    			mount_component(teamsfooter, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const positionovertimegraph_changes = {};
    			if (dirty & /*data*/ 256) positionovertimegraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) positionovertimegraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*playedMatchdays*/ 128) positionovertimegraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[7];
    			if (dirty & /*mobileView*/ 512) positionovertimegraph_changes.mobileView = /*mobileView*/ ctx[9];
    			positionovertimegraph.$set(positionovertimegraph_changes);
    			const goalsscoredandconcededgraph_changes = {};
    			if (dirty & /*data*/ 256) goalsscoredandconcededgraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) goalsscoredandconcededgraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*playedMatchdays*/ 128) goalsscoredandconcededgraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[7];
    			if (dirty & /*mobileView*/ 512) goalsscoredandconcededgraph_changes.mobileView = /*mobileView*/ ctx[9];
    			goalsscoredandconcededgraph.$set(goalsscoredandconcededgraph_changes);
    			const cleansheetsgraph_changes = {};
    			if (dirty & /*data*/ 256) cleansheetsgraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) cleansheetsgraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*playedMatchdays*/ 128) cleansheetsgraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[7];
    			if (dirty & /*mobileView*/ 512) cleansheetsgraph_changes.mobileView = /*mobileView*/ ctx[9];
    			cleansheetsgraph.$set(cleansheetsgraph_changes);
    			const statsvalues_changes = {};
    			if (dirty & /*data*/ 256) statsvalues_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) statsvalues_changes.team = /*team*/ ctx[4];
    			statsvalues.$set(statsvalues_changes);
    			const scoredconcededovertimegraph_changes = {};
    			if (dirty & /*data*/ 256) scoredconcededovertimegraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) scoredconcededovertimegraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*mobileView*/ 512) scoredconcededovertimegraph_changes.mobileView = /*mobileView*/ ctx[9];
    			scoredconcededovertimegraph.$set(scoredconcededovertimegraph_changes);
    			const goalspergame_changes = {};
    			if (dirty & /*data*/ 256) goalspergame_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) goalspergame_changes.team = /*team*/ ctx[4];
    			if (dirty & /*mobileView*/ 512) goalspergame_changes.mobileView = /*mobileView*/ ctx[9];
    			goalspergame.$set(goalspergame_changes);
    			const scorelinefreqgraph_changes = {};
    			if (dirty & /*data*/ 256) scorelinefreqgraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) scorelinefreqgraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*mobileView*/ 512) scorelinefreqgraph_changes.mobileView = /*mobileView*/ ctx[9];
    			scorelinefreqgraph.$set(scorelinefreqgraph_changes);
    			const spidergraph_changes = {};
    			if (dirty & /*data*/ 256) spidergraph_changes.data = /*data*/ ctx[8];
    			if (dirty & /*team*/ 16) spidergraph_changes.team = /*team*/ ctx[4];
    			if (dirty & /*teams*/ 32) spidergraph_changes.teams = /*teams*/ ctx[5];
    			spidergraph.$set(spidergraph_changes);
    			const teamsfooter_changes = {};
    			if (dirty & /*data*/ 256) teamsfooter_changes.lastUpdated = /*data*/ ctx[8].lastUpdated;
    			teamsfooter.$set(teamsfooter_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(positionovertimegraph.$$.fragment, local);
    			transition_in(goalsscoredandconcededgraph.$$.fragment, local);
    			transition_in(cleansheetsgraph.$$.fragment, local);
    			transition_in(statsvalues.$$.fragment, local);
    			transition_in(scoredconcededovertimegraph.$$.fragment, local);
    			transition_in(goalspergame.$$.fragment, local);
    			transition_in(scorelinefreqgraph.$$.fragment, local);
    			transition_in(spidergraph.$$.fragment, local);
    			transition_in(teamsfooter.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(positionovertimegraph.$$.fragment, local);
    			transition_out(goalsscoredandconcededgraph.$$.fragment, local);
    			transition_out(cleansheetsgraph.$$.fragment, local);
    			transition_out(statsvalues.$$.fragment, local);
    			transition_out(scoredconcededovertimegraph.$$.fragment, local);
    			transition_out(goalspergame.$$.fragment, local);
    			transition_out(scorelinefreqgraph.$$.fragment, local);
    			transition_out(spidergraph.$$.fragment, local);
    			transition_out(teamsfooter.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(positionovertimegraph);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div5);
    			destroy_component(goalsscoredandconcededgraph);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div8);
    			destroy_component(cleansheetsgraph);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div9);
    			destroy_component(statsvalues);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div12);
    			destroy_component(scoredconcededovertimegraph);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(div14);
    			destroy_component(goalspergame);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div17);
    			destroy_component(scorelinefreqgraph);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(div20);
    			destroy_component(spidergraph);
    			if (detaching) detach_dev(t15);
    			destroy_component(teamsfooter, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(312:10) {#if load}",
    		ctx
    	});

    	return block;
    }

    // (189:0) <Router>
    function create_default_slot$4(ctx) {
    	let div3;
    	let nav;
    	let t0;
    	let mobilenav;
    	let t1;
    	let t2;
    	let div2;
    	let div1;
    	let a;
    	let div0;
    	let t3_value = /*toAlias*/ ctx[10](/*team*/ ctx[4]) + "";
    	let t3;
    	let a_href_value;
    	let t4;
    	let current_block_type_index;
    	let if_block1;
    	let current;

    	nav = new Nav({
    			props: {
    				team: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[5],
    				toAlias: /*toAlias*/ ctx[10],
    				switchTeam: /*switchTeam*/ ctx[12]
    			},
    			$$inline: true
    		});

    	mobilenav = new MobileNav({
    			props: {
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[5],
    				toAlias: /*toAlias*/ ctx[10],
    				switchTeam: /*switchTeam*/ ctx[12],
    				toggleMobileNav
    			},
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*teams*/ ctx[5].length == 0) return create_if_block_3$1;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	const if_block_creators = [create_if_block$1, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*data*/ ctx[8] != undefined) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			create_component(nav.$$.fragment);
    			t0 = space();
    			create_component(mobilenav.$$.fragment);
    			t1 = space();
    			if_block0.c();
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			a = element("a");
    			div0 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			if_block1.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div3_nodes = children(div3);
    			claim_component(nav.$$.fragment, div3_nodes);
    			t0 = claim_space(div3_nodes);
    			claim_component(mobilenav.$$.fragment, div3_nodes);
    			t1 = claim_space(div3_nodes);
    			if_block0.l(div3_nodes);
    			t2 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { id: true, class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			a = claim_element(div1_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			div0 = claim_element(a_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			t3 = claim_text(div0_nodes, t3_value);
    			div0_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t4 = claim_space(div2_nodes);
    			if_block1.l(div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "title svelte-1ao5tmf");
    			set_style(div0, "color", "var(--" + (/*hyphenatedTeam*/ ctx[0] + '-secondary') + ")");
    			add_location(div0, file$3, 211, 10, 7472);
    			attr_dev(a, "class", "main-link no-decoration svelte-1ao5tmf");
    			attr_dev(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			add_location(a, file$3, 210, 8, 7400);
    			attr_dev(div1, "class", "header svelte-1ao5tmf");
    			set_style(div1, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(div1, file$3, 209, 6, 7319);
    			attr_dev(div2, "id", "dashboard");
    			attr_dev(div2, "class", "svelte-1ao5tmf");
    			add_location(div2, file$3, 207, 4, 7251);
    			attr_dev(div3, "id", "team");
    			attr_dev(div3, "class", "svelte-1ao5tmf");
    			add_location(div3, file$3, 189, 2, 6740);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			mount_component(nav, div3, null);
    			append_hydration_dev(div3, t0);
    			mount_component(mobilenav, div3, null);
    			append_hydration_dev(div3, t1);
    			if_block0.m(div3, null);
    			append_hydration_dev(div3, t2);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, a);
    			append_hydration_dev(a, div0);
    			append_hydration_dev(div0, t3);
    			append_hydration_dev(div2, t4);
    			if_blocks[current_block_type_index].m(div2, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const nav_changes = {};
    			if (dirty & /*hyphenatedTeam*/ 1) nav_changes.team = /*hyphenatedTeam*/ ctx[0];
    			if (dirty & /*teams*/ 32) nav_changes.teams = /*teams*/ ctx[5];
    			nav.$set(nav_changes);
    			const mobilenav_changes = {};
    			if (dirty & /*hyphenatedTeam*/ 1) mobilenav_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			if (dirty & /*teams*/ 32) mobilenav_changes.teams = /*teams*/ ctx[5];
    			mobilenav.$set(mobilenav_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div3, t2);
    				}
    			}

    			if ((!current || dirty & /*team*/ 16) && t3_value !== (t3_value = /*toAlias*/ ctx[10](/*team*/ ctx[4]) + "")) set_data_dev(t3, t3_value);

    			if (!current || dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div0, "color", "var(--" + (/*hyphenatedTeam*/ ctx[0] + '-secondary') + ")");
    			}

    			if (!current || dirty & /*hyphenatedTeam*/ 1 && a_href_value !== (a_href_value = "/" + /*hyphenatedTeam*/ ctx[0])) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (!current || dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div1, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block1 = if_blocks[current_block_type_index];

    				if (!if_block1) {
    					if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block1.c();
    				} else {
    					if_block1.p(ctx, dirty);
    				}

    				transition_in(if_block1, 1);
    				if_block1.m(div2, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(nav.$$.fragment, local);
    			transition_in(mobilenav.$$.fragment, local);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(nav.$$.fragment, local);
    			transition_out(mobilenav.$$.fragment, local);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(nav);
    			destroy_component(mobilenav);
    			if_block0.d();
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(189:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let scrolling = false;

    	let clear_scrolling = () => {
    		scrolling = false;
    	};

    	let scrolling_timeout;
    	let title_value;
    	let meta;
    	let t;
    	let router;
    	let current;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[13]);
    	add_render_callback(/*onwindowscroll*/ ctx[14]);
    	document_1$1.title = title_value = /*team*/ ctx[4];

    	router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1x6khl2\"]', document_1$1.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$3, 183, 2, 6569);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1$1.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1, "resize", /*onwindowresize*/ ctx[13]),
    					listen_dev(window_1, "scroll", () => {
    						scrolling = true;
    						clearTimeout(scrolling_timeout);
    						scrolling_timeout = setTimeout(clear_scrolling, 100);
    						/*onwindowscroll*/ ctx[14]();
    					})
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*y*/ 2 && !scrolling) {
    				scrolling = true;
    				clearTimeout(scrolling_timeout);
    				scrollTo(window_1.pageXOffset, /*y*/ ctx[1]);
    				scrolling_timeout = setTimeout(clear_scrolling, 100);
    			}

    			if ((!current || dirty & /*team*/ 16) && title_value !== (title_value = /*team*/ ctx[4])) {
    				document_1$1.title = title_value;
    			}

    			const router_changes = {};

    			if (dirty & /*$$scope, data, team, teams, mobileView, playedMatchdays, load, currentMatchday, hyphenatedTeam*/ 263161) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(meta);
    			if (detaching) detach_dev(t);
    			destroy_component(router, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$4($$self, $$props, $$invalidate) {
    	let mobileView;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Team', slots, []);

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

    	function initDashboard() {
    		// Set formatted team name so page header can display while fetching data
    		if (hyphenatedTeam != null) {
    			$$invalidate(4, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));
    		}

    		fetchData$1("https://pldashboard-backend.vercel.app/api/teams").then(json => {
    			$$invalidate(5, teams = Object.keys(json.standings));

    			if (hyphenatedTeam == null) {
    				// If '/' searched, set current team to
    				$$invalidate(4, team = teams[0]);

    				$$invalidate(0, hyphenatedTeam = team.toLowerCase().replace(/ /g, "-"));

    				// Change url to /team-name without reloading page
    				history.pushState({}, null, window.location.href + hyphenatedTeam);
    			} else {
    				// If team from url not in current season teams, 404 redirect
    				if (!teams.includes(team)) {
    					window.location.href = "/error";
    				}
    			}

    			$$invalidate(6, currentMatchday = getCurrentMatchday(json, team));
    			$$invalidate(7, playedMatchdays = getPlayedMatchdayDates(json, team));
    			$$invalidate(8, data = json);
    			console.log(data);
    		}).then(() => {
    			window.dispatchEvent(new Event("resize"));
    		});
    	}

    	function switchTeam(newTeam) {
    		$$invalidate(0, hyphenatedTeam = newTeam);
    		$$invalidate(4, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));
    		$$invalidate(6, currentMatchday = getCurrentMatchday(data, team));
    		$$invalidate(7, playedMatchdays = getPlayedMatchdayDates(data, team));
    		window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
    	}

    	function lazyLoad() {
    		$$invalidate(3, load = true);
    		window.dispatchEvent(new Event("resize"));
    	}

    	let y;
    	let load = false;
    	let pageWidth;
    	let team = "";
    	let teams = []; // Used for nav bar links
    	let currentMatchday, playedMatchdays;
    	let data;

    	onMount(() => {
    		initDashboard();
    	});

    	let { hyphenatedTeam } = $$props;
    	const writable_props = ['hyphenatedTeam'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Team> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(2, pageWidth = window_1.innerWidth);
    	}

    	function onwindowscroll() {
    		$$invalidate(1, y = window_1.pageYOffset);
    	}

    	$$self.$$set = $$props => {
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    	};

    	$$self.$capture_state = () => ({
    		Router,
    		onMount,
    		CurrentForm,
    		TableSnippet,
    		NextGame,
    		StatsValues,
    		TeamsFooter,
    		FixturesGraph,
    		FormOverTimeGraph,
    		PositionOverTimeGraph,
    		GoalsScoredAndConcededGraph: ScoredAndConcededGraph,
    		CleanSheetsGraph,
    		GoalsPerGame,
    		SpiderGraph,
    		ScorelineFreqGraph,
    		Nav,
    		MobileNav,
    		ScoredConcededOverTimeGraph,
    		alias,
    		toInitials,
    		toAlias,
    		toName,
    		toggleMobileNav,
    		toTitleCase,
    		getPlayedMatchdayDates,
    		getCurrentMatchday,
    		fetchData: fetchData$1,
    		initDashboard,
    		switchTeam,
    		lazyLoad,
    		y,
    		load,
    		pageWidth,
    		showBadge,
    		team,
    		teams,
    		currentMatchday,
    		playedMatchdays,
    		data,
    		hyphenatedTeam,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('alias' in $$props) alias = $$props.alias;
    		if ('y' in $$props) $$invalidate(1, y = $$props.y);
    		if ('load' in $$props) $$invalidate(3, load = $$props.load);
    		if ('pageWidth' in $$props) $$invalidate(2, pageWidth = $$props.pageWidth);
    		if ('team' in $$props) $$invalidate(4, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(5, teams = $$props.teams);
    		if ('currentMatchday' in $$props) $$invalidate(6, currentMatchday = $$props.currentMatchday);
    		if ('playedMatchdays' in $$props) $$invalidate(7, playedMatchdays = $$props.playedMatchdays);
    		if ('data' in $$props) $$invalidate(8, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('mobileView' in $$props) $$invalidate(9, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*y*/ 2) {
    			y > 30 && lazyLoad();
    		}

    		if ($$self.$$.dirty & /*pageWidth*/ 4) {
    			$$invalidate(9, mobileView = pageWidth <= 700);
    		}
    	};

    	return [
    		hyphenatedTeam,
    		y,
    		pageWidth,
    		load,
    		team,
    		teams,
    		currentMatchday,
    		playedMatchdays,
    		data,
    		mobileView,
    		toAlias,
    		toName,
    		switchTeam,
    		onwindowresize,
    		onwindowscroll
    	];
    }

    class Team extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { hyphenatedTeam: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Team",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*hyphenatedTeam*/ ctx[0] === undefined && !('hyphenatedTeam' in props)) {
    			console_1$1.warn("<Team> was created without expected prop 'hyphenatedTeam'");
    		}
    	}

    	get hyphenatedTeam() {
    		throw new Error("<Team>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hyphenatedTeam(value) {
    		throw new Error("<Team>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\routes\Home.svelte generated by Svelte v3.49.0 */
    const file$2 = "src\\routes\\Home.svelte";

    // (9:0) <Router>
    function create_default_slot$3(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let t0;
    	let img;
    	let img_src_value;
    	let t1;
    	let div1;
    	let a0;
    	let t2;
    	let t3;
    	let a1;
    	let t4;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			img = element("img");
    			t1 = space();
    			div1 = element("div");
    			a0 = element("a");
    			t2 = text("Dashboard");
    			t3 = space();
    			a1 = element("a");
    			t4 = text("Fantasy");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { id: true, class: true });
    			children(div0).forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			img = claim_element(div2_nodes, "IMG", { src: true, alt: true, class: true });
    			t1 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			a0 = claim_element(div1_nodes, "A", { class: true, href: true });
    			var a0_nodes = children(a0);
    			t2 = claim_text(a0_nodes, "Dashboard");
    			a0_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			a1 = claim_element(div1_nodes, "A", { class: true, href: true });
    			var a1_nodes = children(a1);
    			t4 = claim_text(a1_nodes, "Fantasy");
    			a1_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "circle");
    			attr_dev(div0, "class", "svelte-1wkac13");
    			add_location(div0, file$2, 11, 6, 278);
    			if (!src_url_equal(img.src, img_src_value = "img/pldashboard5.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pldashboard");
    			attr_dev(img, "class", "svelte-1wkac13");
    			add_location(img, file$2, 12, 6, 305);
    			attr_dev(a0, "class", "dashboard-link svelte-1wkac13");
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$2, 14, 8, 394);
    			attr_dev(a1, "class", "fantasy-link svelte-1wkac13");
    			attr_dev(a1, "href", "/");
    			add_location(a1, file$2, 15, 8, 452);
    			attr_dev(div1, "class", "links svelte-1wkac13");
    			add_location(div1, file$2, 13, 6, 365);
    			attr_dev(div2, "class", "content svelte-1wkac13");
    			add_location(div2, file$2, 10, 4, 249);
    			attr_dev(div3, "id", "home");
    			attr_dev(div3, "class", "svelte-1wkac13");
    			add_location(div3, file$2, 9, 2, 228);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, img);
    			append_hydration_dev(div2, t1);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, a0);
    			append_hydration_dev(a0, t2);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, a1);
    			append_hydration_dev(a1, t4);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(9:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let meta;
    	let t;
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1rqatx0\"]', document.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			document.title = "Premier League";
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$2, 5, 2, 123);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(meta);
    			if (detaching) detach_dev(t);
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Router });
    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\routes\Predictions.svelte generated by Svelte v3.49.0 */

    const { console: console_1, document: document_1 } = globals;
    const file$1 = "src\\routes\\Predictions.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i]._id;
    	child_ctx[3] = list[i].predictions;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (183:4) {:else}
    function create_else_block_1(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "loading-spinner");
    			add_location(div0, file$1, 184, 8, 7101);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$1, 183, 6, 7052);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(183:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (97:4) {#if data != undefined}
    function create_if_block(ctx) {
    	let div5;
    	let div2;
    	let div1;
    	let span;
    	let t0;
    	let b0;
    	let t1_value = (/*data*/ ctx[0].accuracy.scoreAccuracy * 100).toFixed(2) + "";
    	let t1;
    	let t2;
    	let br;
    	let t3;
    	let div0;
    	let t4;
    	let b1;
    	let t5_value = (/*data*/ ctx[0].accuracy.resultAccuracy * 100).toFixed(2) + "";
    	let t5;
    	let t6;
    	let t7;
    	let div4;
    	let div3;
    	let if_block = /*data*/ ctx[0].predictions != null && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			span = element("span");
    			t0 = text("Predicting with accuracy: ");
    			b0 = element("b");
    			t1 = text(t1_value);
    			t2 = text("%");
    			br = element("br");
    			t3 = space();
    			div0 = element("div");
    			t4 = text("General results accuracy: ");
    			b1 = element("b");
    			t5 = text(t5_value);
    			t6 = text("%");
    			t7 = space();
    			div4 = element("div");
    			div3 = element("div");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			span = claim_element(div1_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "Predicting with accuracy: ");
    			b0 = claim_element(span_nodes, "B", {});
    			var b0_nodes = children(b0);
    			t1 = claim_text(b0_nodes, t1_value);
    			t2 = claim_text(b0_nodes, "%");
    			b0_nodes.forEach(detach_dev);
    			span_nodes.forEach(detach_dev);
    			br = claim_element(div1_nodes, "BR", {});
    			t3 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t4 = claim_text(div0_nodes, "General results accuracy: ");
    			b1 = claim_element(div0_nodes, "B", {});
    			var b1_nodes = children(b1);
    			t5 = claim_text(b1_nodes, t5_value);
    			t6 = claim_text(b1_nodes, "%");
    			b1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t7 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			if (if_block) if_block.l(div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(b0, file$1, 101, 40, 3633);
    			attr_dev(span, "class", "accuracy-item svelte-1qm3m7y");
    			add_location(span, file$1, 100, 12, 3563);
    			add_location(br, file$1, 104, 13, 3744);
    			add_location(b1, file$1, 106, 40, 3833);
    			attr_dev(div0, "class", "accuracy-item svelte-1qm3m7y");
    			add_location(div0, file$1, 105, 12, 3764);
    			attr_dev(div1, "class", "accuracy svelte-1qm3m7y");
    			add_location(div1, file$1, 99, 10, 3527);
    			attr_dev(div2, "class", "accuracy-display svelte-1qm3m7y");
    			add_location(div2, file$1, 98, 8, 3485);
    			attr_dev(div3, "class", "predictions svelte-1qm3m7y");
    			add_location(div3, file$1, 114, 10, 4037);
    			attr_dev(div4, "class", "predictions-container svelte-1qm3m7y");
    			add_location(div4, file$1, 113, 8, 3990);
    			attr_dev(div5, "class", "page-content svelte-1qm3m7y");
    			add_location(div5, file$1, 97, 6, 3449);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(span, b0);
    			append_hydration_dev(b0, t1);
    			append_hydration_dev(b0, t2);
    			append_hydration_dev(div1, br);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t4);
    			append_hydration_dev(div0, b1);
    			append_hydration_dev(b1, t5);
    			append_hydration_dev(b1, t6);
    			append_hydration_dev(div5, t7);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, div3);
    			if (if_block) if_block.m(div3, null);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t1_value !== (t1_value = (/*data*/ ctx[0].accuracy.scoreAccuracy * 100).toFixed(2) + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*data*/ 1 && t5_value !== (t5_value = (/*data*/ ctx[0].accuracy.resultAccuracy * 100).toFixed(2) + "")) set_data_dev(t5, t5_value);

    			if (/*data*/ ctx[0].predictions != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(div3, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(97:4) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (116:12) {#if data.predictions != null}
    function create_if_block_1(ctx) {
    	let each_1_anchor;
    	let each_value = /*data*/ ctx[0].predictions;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, toggleDetailsDisplay, datetimeToTime, Math*/ 1) {
    				each_value = /*data*/ ctx[0].predictions;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(116:12) {#if data.predictions != null}",
    		ctx
    	});

    	return block;
    }

    // (151:20) {:else}
    function create_else_block(ctx) {
    	let div;
    	let t_value = datetimeToTime(/*pred*/ ctx[6].datetime) + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, t_value);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "prediction-time svelte-1qm3m7y");
    			add_location(div, file$1, 151, 22, 5920);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t_value !== (t_value = datetimeToTime(/*pred*/ ctx[6].datetime) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(151:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (140:20) {#if pred.actual != null}
    function create_if_block_3(ctx) {
    	let div5;
    	let div0;
    	let t0;
    	let t1;
    	let div4;
    	let div1;
    	let t2_value = /*pred*/ ctx[6].home + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*pred*/ ctx[6].actual.homeGoals + "";
    	let t4;
    	let t5;
    	let t6_value = /*pred*/ ctx[6].actual.awayGoals + "";
    	let t6;
    	let t7;
    	let div3;
    	let t8_value = /*pred*/ ctx[6].away + "";
    	let t8;

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div0 = element("div");
    			t0 = text("Actual:");
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = text(" - ");
    			t6 = text(t6_value);
    			t7 = space();
    			div3 = element("div");
    			t8 = text(t8_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div0 = claim_element(div5_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, "Actual:");
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(div4_nodes);
    			div2 = claim_element(div4_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			t5 = claim_text(div2_nodes, " - ");
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach_dev);
    			t7 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t8 = claim_text(div3_nodes, t8_value);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "prediction-label svelte-1qm3m7y");
    			add_location(div0, file$1, 141, 24, 5379);
    			attr_dev(div1, "class", "prediction-initials svelte-1qm3m7y");
    			add_location(div1, file$1, 143, 26, 5506);
    			attr_dev(div2, "class", "prediction-score svelte-1qm3m7y");
    			add_location(div2, file$1, 144, 26, 5584);
    			attr_dev(div3, "class", "prediction-initials svelte-1qm3m7y");
    			add_location(div3, file$1, 147, 26, 5755);
    			attr_dev(div4, "class", "prediction-value svelte-1qm3m7y");
    			add_location(div4, file$1, 142, 24, 5448);
    			attr_dev(div5, "class", "actual prediction-item svelte-1qm3m7y");
    			add_location(div5, file$1, 140, 22, 5317);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div5, t1);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, div1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div4, t3);
    			append_hydration_dev(div4, div2);
    			append_hydration_dev(div2, t4);
    			append_hydration_dev(div2, t5);
    			append_hydration_dev(div2, t6);
    			append_hydration_dev(div4, t7);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, t8);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[6].home + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*data*/ 1 && t4_value !== (t4_value = /*pred*/ ctx[6].actual.homeGoals + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*data*/ 1 && t6_value !== (t6_value = /*pred*/ ctx[6].actual.awayGoals + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*data*/ 1 && t8_value !== (t8_value = /*pred*/ ctx[6].away + "")) set_data_dev(t8, t8_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(140:20) {#if pred.actual != null}",
    		ctx
    	});

    	return block;
    }

    // (158:20) {#if pred.prediction != null}
    function create_if_block_2(ctx) {
    	let div1;
    	let div0;
    	let b;
    	let t0_value = /*pred*/ ctx[6].prediction.homeGoals + "";
    	let t0;
    	let t1;
    	let t2_value = /*pred*/ ctx[6].prediction.awayGoals + "";
    	let t2;
    	let div1_id_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			t2 = text(t2_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true, id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			b = claim_element(div0_nodes, "B", {});
    			var b_nodes = children(b);
    			t0 = claim_text(b_nodes, t0_value);
    			t1 = claim_text(b_nodes, " - ");
    			t2 = claim_text(b_nodes, t2_value);
    			b_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(b, file$1, 160, 26, 6337);
    			attr_dev(div0, "class", "detailed-predicted-score svelte-1qm3m7y");
    			add_location(div0, file$1, 159, 24, 6271);
    			attr_dev(div1, "class", "prediction-details svelte-1qm3m7y");
    			attr_dev(div1, "id", div1_id_value = /*pred*/ ctx[6]._id);
    			add_location(div1, file$1, 158, 22, 6199);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, b);
    			append_hydration_dev(b, t0);
    			append_hydration_dev(b, t1);
    			append_hydration_dev(b, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*pred*/ ctx[6].prediction.homeGoals + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[6].prediction.awayGoals + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*data*/ 1 && div1_id_value !== (div1_id_value = /*pred*/ ctx[6]._id)) {
    				attr_dev(div1, "id", div1_id_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(158:20) {#if pred.prediction != null}",
    		ctx
    	});

    	return block;
    }

    // (123:16) {#each predictions as pred}
    function create_each_block_1(ctx) {
    	let button;
    	let div5;
    	let div0;
    	let t0;
    	let t1;
    	let div4;
    	let div1;
    	let t2_value = /*pred*/ ctx[6].home + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = Math.round(/*pred*/ ctx[6].prediction.homeGoals) + "";
    	let t4;
    	let t5;
    	let t6_value = Math.round(/*pred*/ ctx[6].prediction.awayGoals) + "";
    	let t6;
    	let t7;
    	let div3;
    	let t8_value = /*pred*/ ctx[6].away + "";
    	let t8;
    	let t9;
    	let t10;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*pred*/ ctx[6].actual != null) return create_if_block_3;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*pred*/ ctx[6].prediction != null && create_if_block_2(ctx);

    	function click_handler() {
    		return /*click_handler*/ ctx[1](/*pred*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			div5 = element("div");
    			div0 = element("div");
    			t0 = text("Predicted:");
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = text(" - ");
    			t6 = text(t6_value);
    			t7 = space();
    			div3 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			if_block0.c();
    			t10 = space();
    			if (if_block1) if_block1.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			div5 = claim_element(button_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div0 = claim_element(div5_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, "Predicted:");
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(div4_nodes);
    			div2 = claim_element(div4_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			t5 = claim_text(div2_nodes, " - ");
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach_dev);
    			t7 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t8 = claim_text(div3_nodes, t8_value);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t9 = claim_space(button_nodes);
    			if_block0.l(button_nodes);
    			t10 = claim_space(button_nodes);
    			if (if_block1) if_block1.l(button_nodes);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "prediction-label svelte-1qm3m7y");
    			add_location(div0, file$1, 128, 22, 4681);
    			attr_dev(div1, "class", "prediction-initials svelte-1qm3m7y");
    			add_location(div1, file$1, 130, 24, 4807);
    			attr_dev(div2, "class", "prediction-score svelte-1qm3m7y");
    			add_location(div2, file$1, 131, 24, 4883);
    			attr_dev(div3, "class", "prediction-initials svelte-1qm3m7y");
    			add_location(div3, file$1, 136, 24, 5138);
    			attr_dev(div4, "class", "prediction-value svelte-1qm3m7y");
    			add_location(div4, file$1, 129, 22, 4751);
    			attr_dev(div5, "class", "prediction prediction-item svelte-1qm3m7y");
    			add_location(div5, file$1, 127, 20, 4617);
    			attr_dev(button, "class", button_class_value = "prediction-container " + /*pred*/ ctx[6].colour + " svelte-1qm3m7y");
    			add_location(button, file$1, 123, 18, 4434);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, div5);
    			append_hydration_dev(div5, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div5, t1);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, div1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div4, t3);
    			append_hydration_dev(div4, div2);
    			append_hydration_dev(div2, t4);
    			append_hydration_dev(div2, t5);
    			append_hydration_dev(div2, t6);
    			append_hydration_dev(div4, t7);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, t8);
    			append_hydration_dev(button, t9);
    			if_block0.m(button, null);
    			append_hydration_dev(button, t10);
    			if (if_block1) if_block1.m(button, null);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[6].home + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*data*/ 1 && t4_value !== (t4_value = Math.round(/*pred*/ ctx[6].prediction.homeGoals) + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*data*/ 1 && t6_value !== (t6_value = Math.round(/*pred*/ ctx[6].prediction.awayGoals) + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*data*/ 1 && t8_value !== (t8_value = /*pred*/ ctx[6].away + "")) set_data_dev(t8, t8_value);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button, t10);
    				}
    			}

    			if (/*pred*/ ctx[6].prediction != null) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(button, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*data*/ 1 && button_class_value !== (button_class_value = "prediction-container " + /*pred*/ ctx[6].colour + " svelte-1qm3m7y")) {
    				attr_dev(button, "class", button_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(123:16) {#each predictions as pred}",
    		ctx
    	});

    	return block;
    }

    // (117:14) {#each data.predictions as { _id, predictions }}
    function create_each_block(ctx) {
    	let div0;
    	let t0_value = /*_id*/ ctx[2] + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2;
    	let t3;
    	let div2;
    	let each_value_1 = /*predictions*/ ctx[3];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			div2 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			children(div1).forEach(detach_dev);
    			t2 = claim_space(nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			t3 = claim_space(nodes);
    			div2 = claim_element(nodes, "DIV", { class: true });
    			children(div2).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "date svelte-1qm3m7y");
    			add_location(div0, file$1, 117, 16, 4188);
    			attr_dev(div1, "class", "medium-predictions-divider svelte-1qm3m7y");
    			add_location(div1, file$1, 120, 16, 4273);
    			attr_dev(div2, "class", "predictions-gap svelte-1qm3m7y");
    			add_location(div2, file$1, 169, 16, 6652);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, t0);
    			insert_hydration_dev(target, t1, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			insert_hydration_dev(target, t2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration_dev(target, t3, anchor);
    			insert_hydration_dev(target, div2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*_id*/ ctx[2] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*data, toggleDetailsDisplay, datetimeToTime, Math*/ 1) {
    				each_value_1 = /*predictions*/ ctx[3];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t3.parentNode, t3);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(117:14) {#each data.predictions as { _id, predictions }}",
    		ctx
    	});

    	return block;
    }

    // (91:0) <Router>
    function create_default_slot$2(ctx) {
    	let div1;
    	let div0;
    	let a;
    	let t0;
    	let t1;

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[0] != undefined) return create_if_block;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			a = element("a");
    			t0 = text("Predictions");
    			t1 = space();
    			if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, "Predictions");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "class", "predictions-title svelte-1qm3m7y");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file$1, 93, 6, 3334);
    			attr_dev(div0, "class", "predictions-header svelte-1qm3m7y");
    			add_location(div0, file$1, 92, 4, 3294);
    			attr_dev(div1, "id", "predictions");
    			attr_dev(div1, "class", "svelte-1qm3m7y");
    			add_location(div1, file$1, 91, 2, 3266);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t0);
    			append_hydration_dev(div1, t1);
    			if_block.m(div1, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(91:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let meta;
    	let t;
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1w56yuh\"]', document_1.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			document_1.title = "Predictions";
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$1, 87, 2, 3161);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope, data*/ 513) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(meta);
    			if (detaching) detach_dev(t);
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function fetchData(address) {
    	const response = await fetch(address);
    	let json = await response.json();
    	return json;
    }

    function toggleDetailsDisplay(id) {
    	let prediction = document.getElementById(id);

    	if (prediction != null) {
    		prediction.classList.toggle("expanded");
    	}
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

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Predictions', slots, []);
    	let data;

    	onMount(() => {
    		fetchData("https://pldashboard-backend.vercel.app/api/predictions").then(json => {
    			sortByDate(json);
    			insertExtras(json);
    			$$invalidate(0, data = json);
    			console.log(data);
    		});
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Predictions> was created with unknown prop '${key}'`);
    	});

    	const click_handler = pred => toggleDetailsDisplay(pred._id);

    	$$self.$capture_state = () => ({
    		Router,
    		onMount,
    		fetchData,
    		toggleDetailsDisplay,
    		identicalScore,
    		sameResult,
    		insertExtras,
    		datetimeToTime,
    		sortByDate,
    		data
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [data, click_handler];
    }

    class Predictions extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Predictions",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\routes\Error.svelte generated by Svelte v3.49.0 */
    const file = "src\\routes\\Error.svelte";

    // (9:0) <Router>
    function create_default_slot$1(ctx) {
    	let div1;
    	let div0;
    	let t;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t = text("Error: Page not found");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t = claim_text(div0_nodes, "Error: Page not found");
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "msg-container svelte-17qhtmb");
    			add_location(div0, file, 10, 4, 250);
    			attr_dev(div1, "id", "error");
    			attr_dev(div1, "class", "svelte-17qhtmb");
    			add_location(div1, file, 9, 2, 228);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(9:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let meta;
    	let t;
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1rqatx0\"]', document.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			document.title = "Premier League";
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file, 5, 2, 123);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(meta);
    			if (detaching) detach_dev(t);
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Error', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Error> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Router });
    	return [];
    }

    class Error$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Error",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.49.0 */

    const { Error: Error_1 } = globals;

    // (12:2) <Route path="/">
    function create_default_slot_2(ctx) {
    	let team;
    	let current;

    	team = new Team({
    			props: { hyphenatedTeam: null },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(team.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(team.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(team, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(team.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(team.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(team, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(12:2) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (16:2) <Route path="/:team" let:params>
    function create_default_slot_1(ctx) {
    	let team;
    	let current;

    	team = new Team({
    			props: { hyphenatedTeam: /*params*/ ctx[1].team },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(team.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(team.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(team, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const team_changes = {};
    			if (dirty & /*params*/ 2) team_changes.hyphenatedTeam = /*params*/ ctx[1].team;
    			team.$set(team_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(team.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(team.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(team, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(16:2) <Route path=\\\"/:team\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (11:0) <Router {url}>
    function create_default_slot(ctx) {
    	let route0;
    	let t0;
    	let route1;
    	let t1;
    	let route2;
    	let t2;
    	let route3;
    	let t3;
    	let route4;
    	let t4;
    	let route5;
    	let current;

    	route0 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route1 = new Route({
    			props: {
    				path: "/predictions",
    				component: Predictions
    			},
    			$$inline: true
    		});

    	route2 = new Route({
    			props: {
    				path: "/:team",
    				$$slots: {
    					default: [
    						create_default_slot_1,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route3 = new Route({
    			props: { path: "/teams", component: Teams },
    			$$inline: true
    		});

    	route4 = new Route({
    			props: { path: "/home", component: Home },
    			$$inline: true
    		});

    	route5 = new Route({
    			props: { path: "/error", component: Error$1 },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route0.$$.fragment);
    			t0 = space();
    			create_component(route1.$$.fragment);
    			t1 = space();
    			create_component(route2.$$.fragment);
    			t2 = space();
    			create_component(route3.$$.fragment);
    			t3 = space();
    			create_component(route4.$$.fragment);
    			t4 = space();
    			create_component(route5.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(route0.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			claim_component(route1.$$.fragment, nodes);
    			t1 = claim_space(nodes);
    			claim_component(route2.$$.fragment, nodes);
    			t2 = claim_space(nodes);
    			claim_component(route3.$$.fragment, nodes);
    			t3 = claim_space(nodes);
    			claim_component(route4.$$.fragment, nodes);
    			t4 = claim_space(nodes);
    			claim_component(route5.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(route0, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			mount_component(route1, target, anchor);
    			insert_hydration_dev(target, t1, anchor);
    			mount_component(route2, target, anchor);
    			insert_hydration_dev(target, t2, anchor);
    			mount_component(route3, target, anchor);
    			insert_hydration_dev(target, t3, anchor);
    			mount_component(route4, target, anchor);
    			insert_hydration_dev(target, t4, anchor);
    			mount_component(route5, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route0_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route0_changes.$$scope = { dirty, ctx };
    			}

    			route0.$set(route0_changes);
    			const route2_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route2_changes.$$scope = { dirty, ctx };
    			}

    			route2.$set(route2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			transition_in(route5.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			transition_out(route5.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(route1, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(route2, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(route3, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(route4, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(route5, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(11:0) <Router {url}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(router.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope*/ 4) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { url = "" } = $$props;
    	const writable_props = ['url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	$$self.$capture_state = () => ({
    		Router,
    		Route,
    		Teams,
    		Team,
    		Home,
    		Predictions,
    		Error: Error$1,
    		url
    	});

    	$$self.$inject_state = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [url];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { url: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get url() {
    		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    new App({
        target: document.getElementById("app"),
        hydrate: true
    });

})();
//# sourceMappingURL=bundle.js.map
