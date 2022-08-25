
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

    function create_fragment$q(ctx) {
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
    		id: create_fragment$q.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$q($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$q, create_fragment$q, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$q.name
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
    	const if_block_creators = [create_if_block_1$5, create_else_block$7];
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
    function create_if_block_1$5(ctx) {
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
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$p(ctx) {
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
    		id: create_fragment$p.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$p($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$p, create_fragment$p, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$p.name
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
    const file$n = "node_modules\\svelte-routing\\src\\Link.svelte";

    function create_fragment$o(ctx) {
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
    			add_location(a, file$n, 40, 0, 1249);
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
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$o($$self, $$props, $$invalidate) {
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

    		init(this, options, instance$o, create_fragment$o, safe_not_equal, {
    			to: 7,
    			replace: 8,
    			state: 9,
    			getProps: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$o.name
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
    const file$m = "src\\routes\\Teams.svelte";

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
    			add_location(div, file$m, 76, 6, 2716);
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
    			add_location(div, file$m, 90, 10, 3164);
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
    function create_default_slot$4(ctx) {
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
    			add_location(div0, file$m, 74, 2, 2669);
    			attr_dev(div1, "class", "teams svelte-i9b06i");
    			add_location(div1, file$m, 80, 4, 2838);
    			attr_dev(div2, "class", "page-content");
    			add_location(div2, file$m, 79, 2, 2806);
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
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(74:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$n(ctx) {
    	let meta;
    	let t;
    	let router;
    	let current;

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
    			add_location(meta, file$m, 70, 2, 2564);
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
    		id: create_fragment$n.name,
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

    function instance$n($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$n, create_fragment$n, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Teams",
    			options,
    			id: create_fragment$n.name
    		});
    	}
    }

    /* src\components\current_form\FormTile.svelte generated by Svelte v3.49.0 */

    const file$l = "src\\components\\current_form\\FormTile.svelte";

    function create_fragment$m(ctx) {
    	let div1;
    	let div0;
    	let t_value = formatResult(/*result*/ ctx[0]) + "";
    	let t;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true, style: true, class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t = claim_text(div0_nodes, t_value);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "result svelte-1doaosm");
    			add_location(div0, file$l, 32, 2, 694);
    			attr_dev(div1, "id", "formTile");
    			set_style(div1, "background", background(/*result*/ ctx[0], /*starTeam*/ ctx[1]));
    			attr_dev(div1, "class", "svelte-1doaosm");
    			add_location(div1, file$l, 28, 0, 612);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*result*/ 1 && t_value !== (t_value = formatResult(/*result*/ ctx[0]) + "")) set_data_dev(t, t_value);

    			if (dirty & /*result, starTeam*/ 3) {
    				set_style(div1, "background", background(/*result*/ ctx[0], /*starTeam*/ ctx[1]));
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
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

    function background(result, starTeam) {
    	if (starTeam) {
    		return "linear-gradient(red, blue, green)";
    	}

    	switch (result) {
    		case "W":
    			return "#77dd77";
    		case "D":
    			return "#ffb347";
    		case "L":
    			return "#c23b22";
    		default:
    			return "transparent";
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

    function instance$m($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormTile', slots, []);
    	let { result, starTeam } = $$props;
    	const writable_props = ['result', 'starTeam'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FormTile> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('result' in $$props) $$invalidate(0, result = $$props.result);
    		if ('starTeam' in $$props) $$invalidate(1, starTeam = $$props.starTeam);
    	};

    	$$self.$capture_state = () => ({
    		background,
    		formatResult,
    		result,
    		starTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('result' in $$props) $$invalidate(0, result = $$props.result);
    		if ('starTeam' in $$props) $$invalidate(1, starTeam = $$props.starTeam);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [result, starTeam];
    }

    class FormTile extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$m, create_fragment$m, safe_not_equal, { result: 0, starTeam: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormTile",
    			options,
    			id: create_fragment$m.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*result*/ ctx[0] === undefined && !('result' in props)) {
    			console.warn("<FormTile> was created without expected prop 'result'");
    		}

    		if (/*starTeam*/ ctx[1] === undefined && !('starTeam' in props)) {
    			console.warn("<FormTile> was created without expected prop 'starTeam'");
    		}
    	}

    	get result() {
    		throw new Error("<FormTile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set result(value) {
    		throw new Error("<FormTile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get starTeam() {
    		throw new Error("<FormTile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set starTeam(value) {
    		throw new Error("<FormTile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\current_form\CurrentForm.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$a } = globals;
    const file$k = "src\\components\\current_form\\CurrentForm.svelte";

    // (66:0) {#if formInitials != undefined}
    function create_if_block_1$4(ctx) {
    	let div5;
    	let div0;
    	let formtile0;
    	let t0;
    	let div1;
    	let formtile1;
    	let t1;
    	let div2;
    	let formtile2;
    	let t2;
    	let div3;
    	let formtile3;
    	let t3;
    	let div4;
    	let formtile4;
    	let t4;
    	let div11;
    	let div6;
    	let t5_value = /*formInitials*/ ctx[5][0] + "";
    	let t5;
    	let t6;
    	let div7;
    	let t7_value = /*formInitials*/ ctx[5][1] + "";
    	let t7;
    	let t8;
    	let div8;
    	let t9_value = /*formInitials*/ ctx[5][2] + "";
    	let t9;
    	let t10;
    	let div9;
    	let t11_value = /*formInitials*/ ctx[5][3] + "";
    	let t11;
    	let t12;
    	let div10;
    	let t13_value = /*formInitials*/ ctx[5][4] + "";
    	let t13;
    	let current;

    	formtile0 = new FormTile({
    			props: {
    				result: /*formIcons*/ ctx[3][0],
    				starTeam: /*formStarTeams*/ ctx[4][0]
    			},
    			$$inline: true
    		});

    	formtile1 = new FormTile({
    			props: {
    				result: /*formIcons*/ ctx[3][1],
    				starTeam: /*formStarTeams*/ ctx[4][1]
    			},
    			$$inline: true
    		});

    	formtile2 = new FormTile({
    			props: {
    				result: /*formIcons*/ ctx[3][2],
    				starTeam: /*formStarTeams*/ ctx[4][2]
    			},
    			$$inline: true
    		});

    	formtile3 = new FormTile({
    			props: {
    				result: /*formIcons*/ ctx[3][3],
    				starTeam: /*formStarTeams*/ ctx[4][3]
    			},
    			$$inline: true
    		});

    	formtile4 = new FormTile({
    			props: {
    				result: /*formIcons*/ ctx[3][4],
    				starTeam: /*formStarTeams*/ ctx[4][4]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div0 = element("div");
    			create_component(formtile0.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			create_component(formtile1.$$.fragment);
    			t1 = space();
    			div2 = element("div");
    			create_component(formtile2.$$.fragment);
    			t2 = space();
    			div3 = element("div");
    			create_component(formtile3.$$.fragment);
    			t3 = space();
    			div4 = element("div");
    			create_component(formtile4.$$.fragment);
    			t4 = space();
    			div11 = element("div");
    			div6 = element("div");
    			t5 = text(t5_value);
    			t6 = space();
    			div7 = element("div");
    			t7 = text(t7_value);
    			t8 = space();
    			div8 = element("div");
    			t9 = text(t9_value);
    			t10 = space();
    			div9 = element("div");
    			t11 = text(t11_value);
    			t12 = space();
    			div10 = element("div");
    			t13 = text(t13_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div0 = claim_element(div5_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(formtile0.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t0 = claim_space(div5_nodes);
    			div1 = claim_element(div5_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			claim_component(formtile1.$$.fragment, div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t1 = claim_space(div5_nodes);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			claim_component(formtile2.$$.fragment, div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			t2 = claim_space(div5_nodes);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(formtile3.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			t3 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			claim_component(formtile4.$$.fragment, div4_nodes);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t4 = claim_space(nodes);
    			div11 = claim_element(nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div6 = claim_element(div11_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t5 = claim_text(div6_nodes, t5_value);
    			div6_nodes.forEach(detach_dev);
    			t6 = claim_space(div11_nodes);
    			div7 = claim_element(div11_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			t7 = claim_text(div7_nodes, t7_value);
    			div7_nodes.forEach(detach_dev);
    			t8 = claim_space(div11_nodes);
    			div8 = claim_element(div11_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			t9 = claim_text(div8_nodes, t9_value);
    			div8_nodes.forEach(detach_dev);
    			t10 = claim_space(div11_nodes);
    			div9 = claim_element(div11_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			t11 = claim_text(div9_nodes, t11_value);
    			div9_nodes.forEach(detach_dev);
    			t12 = claim_space(div11_nodes);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			t13 = claim_text(div10_nodes, t13_value);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "icon pos-0 svelte-ngby83");
    			add_location(div0, file$k, 67, 4, 2397);
    			attr_dev(div1, "class", "icon pos-1 svelte-ngby83");
    			add_location(div1, file$k, 70, 4, 2509);
    			attr_dev(div2, "class", "icon pos-2 svelte-ngby83");
    			add_location(div2, file$k, 73, 4, 2621);
    			attr_dev(div3, "class", "icon pos-3 svelte-ngby83");
    			add_location(div3, file$k, 76, 4, 2733);
    			attr_dev(div4, "class", "icon pos4 svelte-ngby83");
    			add_location(div4, file$k, 79, 4, 2845);
    			attr_dev(div5, "class", "current-form-row svelte-ngby83");
    			add_location(div5, file$k, 66, 2, 2361);
    			attr_dev(div6, "class", "icon-name pos-0 svelte-ngby83");
    			add_location(div6, file$k, 84, 4, 3000);
    			attr_dev(div7, "class", "icon-name pos-1 svelte-ngby83");
    			add_location(div7, file$k, 85, 4, 3058);
    			attr_dev(div8, "class", "icon-name pos-2 svelte-ngby83");
    			add_location(div8, file$k, 86, 4, 3116);
    			attr_dev(div9, "class", "icon-name pos-3 svelte-ngby83");
    			add_location(div9, file$k, 87, 4, 3174);
    			attr_dev(div10, "class", "icon-name pos-4 svelte-ngby83");
    			add_location(div10, file$k, 88, 4, 3232);
    			attr_dev(div11, "class", "current-form-row svelte-ngby83");
    			add_location(div11, file$k, 83, 2, 2964);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div0);
    			mount_component(formtile0, div0, null);
    			append_hydration_dev(div5, t0);
    			append_hydration_dev(div5, div1);
    			mount_component(formtile1, div1, null);
    			append_hydration_dev(div5, t1);
    			append_hydration_dev(div5, div2);
    			mount_component(formtile2, div2, null);
    			append_hydration_dev(div5, t2);
    			append_hydration_dev(div5, div3);
    			mount_component(formtile3, div3, null);
    			append_hydration_dev(div5, t3);
    			append_hydration_dev(div5, div4);
    			mount_component(formtile4, div4, null);
    			insert_hydration_dev(target, t4, anchor);
    			insert_hydration_dev(target, div11, anchor);
    			append_hydration_dev(div11, div6);
    			append_hydration_dev(div6, t5);
    			append_hydration_dev(div11, t6);
    			append_hydration_dev(div11, div7);
    			append_hydration_dev(div7, t7);
    			append_hydration_dev(div11, t8);
    			append_hydration_dev(div11, div8);
    			append_hydration_dev(div8, t9);
    			append_hydration_dev(div11, t10);
    			append_hydration_dev(div11, div9);
    			append_hydration_dev(div9, t11);
    			append_hydration_dev(div11, t12);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, t13);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const formtile0_changes = {};
    			if (dirty & /*formIcons*/ 8) formtile0_changes.result = /*formIcons*/ ctx[3][0];
    			if (dirty & /*formStarTeams*/ 16) formtile0_changes.starTeam = /*formStarTeams*/ ctx[4][0];
    			formtile0.$set(formtile0_changes);
    			const formtile1_changes = {};
    			if (dirty & /*formIcons*/ 8) formtile1_changes.result = /*formIcons*/ ctx[3][1];
    			if (dirty & /*formStarTeams*/ 16) formtile1_changes.starTeam = /*formStarTeams*/ ctx[4][1];
    			formtile1.$set(formtile1_changes);
    			const formtile2_changes = {};
    			if (dirty & /*formIcons*/ 8) formtile2_changes.result = /*formIcons*/ ctx[3][2];
    			if (dirty & /*formStarTeams*/ 16) formtile2_changes.starTeam = /*formStarTeams*/ ctx[4][2];
    			formtile2.$set(formtile2_changes);
    			const formtile3_changes = {};
    			if (dirty & /*formIcons*/ 8) formtile3_changes.result = /*formIcons*/ ctx[3][3];
    			if (dirty & /*formStarTeams*/ 16) formtile3_changes.starTeam = /*formStarTeams*/ ctx[4][3];
    			formtile3.$set(formtile3_changes);
    			const formtile4_changes = {};
    			if (dirty & /*formIcons*/ 8) formtile4_changes.result = /*formIcons*/ ctx[3][4];
    			if (dirty & /*formStarTeams*/ 16) formtile4_changes.starTeam = /*formStarTeams*/ ctx[4][4];
    			formtile4.$set(formtile4_changes);
    			if ((!current || dirty & /*formInitials*/ 32) && t5_value !== (t5_value = /*formInitials*/ ctx[5][0] + "")) set_data_dev(t5, t5_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t7_value !== (t7_value = /*formInitials*/ ctx[5][1] + "")) set_data_dev(t7, t7_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t9_value !== (t9_value = /*formInitials*/ ctx[5][2] + "")) set_data_dev(t9, t9_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t11_value !== (t11_value = /*formInitials*/ ctx[5][3] + "")) set_data_dev(t11, t11_value);
    			if ((!current || dirty & /*formInitials*/ 32) && t13_value !== (t13_value = /*formInitials*/ ctx[5][4] + "")) set_data_dev(t13, t13_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(formtile0.$$.fragment, local);
    			transition_in(formtile1.$$.fragment, local);
    			transition_in(formtile2.$$.fragment, local);
    			transition_in(formtile3.$$.fragment, local);
    			transition_in(formtile4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(formtile0.$$.fragment, local);
    			transition_out(formtile1.$$.fragment, local);
    			transition_out(formtile2.$$.fragment, local);
    			transition_out(formtile3.$$.fragment, local);
    			transition_out(formtile4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(formtile0);
    			destroy_component(formtile1);
    			destroy_component(formtile2);
    			destroy_component(formtile3);
    			destroy_component(formtile4);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(66:0) {#if formInitials != undefined}",
    		ctx
    	});

    	return block;
    }

    // (96:2) {:else}
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
    		source: "(96:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (94:2) {#if currentMatchday != null}
    function create_if_block$a(ctx) {
    	let t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*team*/ ctx[2]][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = text("%");
    		},
    		l: function claim(nodes) {
    			t0 = claim_text(nodes, t0_value);
    			t1 = claim_text(nodes, "%");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team, currentMatchday*/ 7 && t0_value !== (t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*team*/ ctx[2]][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(94:2) {#if currentMatchday != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$l(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let current;
    	let if_block0 = /*formInitials*/ ctx[5] != undefined && create_if_block_1$4(ctx);

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
    			attr_dev(div, "class", "current-form svelte-ngby83");
    			add_location(div, file$k, 91, 0, 3303);
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
    					if_block0 = create_if_block_1$4(ctx);
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
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getSortedMatchdays(data, team) {
    	let matchdays = Object.keys(data.form[data._id][team]).sort(function (matchday1, matchday2) {
    		return new Date(data.form[data._id][team][matchday1].date) - new Date(data.form[data._id][team][matchday2].date);
    	});

    	return matchdays;
    }

    function getFormStarTeams(data, team, matchdays) {
    	let formStarTeams = [];

    	for (let matchday of matchdays) {
    		formStarTeams.unshift(data.form[data._id][team][matchday].beatStarTeam);
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

    function instance$l($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CurrentForm', slots, []);

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
    		$$invalidate(3, formIcons = getFormIcons(data, team));
    		$$invalidate(4, formStarTeams = getFormStarTeams(data, team, matchdays));
    		$$invalidate(5, formInitials = getFormInitials(data, team, matchdays));
    	}

    	let { data, currentMatchday, team, toInitials } = $$props;
    	const writable_props = ['data', 'currentMatchday', 'team', 'toInitials'];

    	Object_1$a.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CurrentForm> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('toInitials' in $$props) $$invalidate(6, toInitials = $$props.toInitials);
    	};

    	$$self.$capture_state = () => ({
    		FormTile,
    		getSortedMatchdays,
    		getFormStarTeams,
    		getFormIcons,
    		getFormInitials,
    		latestNPlayedMatchdays,
    		formIcons,
    		formStarTeams,
    		formInitials,
    		setFormValues,
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

    		init(this, options, instance$l, create_fragment$l, safe_not_equal, {
    			data: 0,
    			currentMatchday: 1,
    			team: 2,
    			toInitials: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CurrentForm",
    			options,
    			id: create_fragment$l.name
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

    const { Object: Object_1$9 } = globals;
    const file$j = "src\\components\\TableSnippet.svelte";

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

    	let if_block = /*tableSnippet*/ ctx[3].teamTableIdx != 6 && create_if_block_1$3(ctx);

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
    			add_location(div0, file$j, 47, 4, 1525);
    			attr_dev(div1, "class", "table-element table-position column-title svelte-13u0ebo");
    			add_location(div1, file$j, 49, 6, 1585);
    			attr_dev(div2, "class", "table-element table-team-name column-title svelte-13u0ebo");
    			add_location(div2, file$j, 50, 6, 1650);
    			attr_dev(div3, "class", "table-element table-gd column-title svelte-13u0ebo");
    			add_location(div3, file$j, 51, 6, 1724);
    			attr_dev(div4, "class", "table-element table-points column-title svelte-13u0ebo");
    			add_location(div4, file$j, 52, 6, 1789);
    			attr_dev(div5, "class", "table-row svelte-13u0ebo");
    			add_location(div5, file$j, 48, 4, 1554);
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
    					if_block = create_if_block_1$3(ctx);
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
    			attr_dev(div, "class", "svelte-13u0ebo");
    			add_location(div, file$j, 62, 8, 2143);
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
    function create_if_block_3$3(ctx) {
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
    		id: create_if_block_3$3.name,
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
    			attr_dev(div, "class", "svelte-13u0ebo");
    			add_location(div, file$j, 59, 10, 2011);
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
    			attr_dev(div0, "class", "table-element table-position svelte-13u0ebo");
    			add_location(div0, file$j, 100, 10, 3362);
    			attr_dev(button, "class", "table-element table-team-name svelte-13u0ebo");
    			add_location(button, file$j, 103, 10, 3462);
    			attr_dev(div1, "class", "table-element table-gd svelte-13u0ebo");
    			add_location(div1, file$j, 109, 10, 3687);
    			attr_dev(div2, "class", "table-element table-points svelte-13u0ebo");
    			add_location(div2, file$j, 112, 10, 3775);
    			attr_dev(div3, "class", "table-row svelte-13u0ebo");
    			add_location(div3, file$j, 99, 8, 3327);
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
    			attr_dev(div0, "class", "table-element table-position this-team svelte-13u0ebo");
    			set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div0, file$j, 71, 10, 2454);
    			attr_dev(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			attr_dev(a, "class", "table-element table-team-name this-team svelte-13u0ebo");
    			set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(a, file$j, 77, 10, 2652);
    			attr_dev(div1, "class", "table-element table-gd this-team svelte-13u0ebo");
    			set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div1, file$j, 84, 10, 2890);
    			attr_dev(div2, "class", "table-element table-points this-team svelte-13u0ebo");
    			set_style(div2, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div2, file$j, 90, 10, 3076);
    			attr_dev(div3, "class", "table-row this-team svelte-13u0ebo");
    			set_style(div3, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(div3, file$j, 67, 8, 2326);
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
    		if (/*i*/ ctx[10] == 0) return create_if_block_3$3;
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
    function create_if_block_1$3(ctx) {
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
    			attr_dev(div, "class", "svelte-13u0ebo");
    			add_location(div, file$j, 119, 6, 3951);
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
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(119:4) {#if tableSnippet.teamTableIdx != 6}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$k(ctx) {
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
    			attr_dev(div, "class", "table-snippet svelte-13u0ebo");
    			add_location(div, file$j, 45, 0, 1457);
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
    		id: create_fragment$k.name,
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

    function instance$k($$self, $$props, $$invalidate) {
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

    	Object_1$9.keys($$props).forEach(key => {
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

    		init(this, options, instance$k, create_fragment$k, safe_not_equal, {
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
    			id: create_fragment$k.name
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

    /* src\components\next_game\SeasonComplete.svelte generated by Svelte v3.49.0 */

    const file$i = "src\\components\\next_game\\SeasonComplete.svelte";

    function create_fragment$j(ctx) {
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
    			attr_dev(h1, "class", "next-game-title-text");
    			add_location(h1, file$i, 5, 4, 132);
    			attr_dev(div0, "class", "next-game-season-complete");
    			add_location(div0, file$i, 4, 2, 87);
    			attr_dev(div1, "class", "next-game-prediction");
    			add_location(div1, file$i, 3, 0, 49);
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
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*data*/ ctx[0]._id + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*data*/ ctx[0]._id + 1 + "")) set_data_dev(t2, t2_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
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

    function instance$j($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SeasonComplete', slots, []);
    	let { data } = $$props;
    	const writable_props = ['data'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SeasonComplete> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	$$self.$capture_state = () => ({ data });

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [data];
    }

    class SeasonComplete extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, { data: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SeasonComplete",
    			options,
    			id: create_fragment$j.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[0] === undefined && !('data' in props)) {
    			console.warn("<SeasonComplete> was created without expected prop 'data'");
    		}
    	}

    	get data() {
    		throw new Error("<SeasonComplete>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<SeasonComplete>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\next_game\NextGame.svelte generated by Svelte v3.49.0 */
    const file$h = "src\\components\\next_game\\NextGame.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (17:0) {#if data != undefined}
    function create_if_block$8(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$2, create_else_block$4];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam == null) return 0;
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
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(17:0) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (20:2) {:else}
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
    		if (/*currentMatchday*/ ctx[1] != null) return create_if_block_3$2;
    		return create_else_block_2;
    	}

    	let current_block_type_1 = select_block_type_2(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	function select_block_type_3(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].prevMatches.length == 0) return create_if_block_2$2;
    		return create_else_block_1$2;
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
    			div9 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div9_nodes = children(div9);
    			div0 = claim_element(div9_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true, style: true });
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
    			attr_dev(button, "class", "next-game-team-btn svelte-b5c3gb");
    			add_location(button, file$h, 30, 10, 961);
    			attr_dev(h1, "class", "next-game-title-text svelte-b5c3gb");
    			set_style(h1, "color", "var(--" + /*oppTeam*/ ctx[7] + "-secondary)");
    			add_location(h1, file$h, 25, 8, 814);
    			attr_dev(div0, "class", "next-game-title svelte-b5c3gb");
    			set_style(div0, "background-color", "var(--" + /*oppTeam*/ ctx[7] + ")");
    			add_location(div0, file$h, 24, 6, 731);
    			attr_dev(span, "class", "ordinal-position svelte-b5c3gb");
    			add_location(span, file$h, 59, 28, 1990);
    			attr_dev(div1, "class", "next-game-position svelte-b5c3gb");
    			add_location(div1, file$h, 57, 14, 1855);
    			attr_dev(div2, "class", "next-game-item svelte-b5c3gb");
    			add_location(div2, file$h, 56, 12, 1811);
    			attr_dev(div3, "class", "next-game-item svelte-b5c3gb");
    			add_location(div3, file$h, 67, 12, 2262);
    			add_location(br0, file$h, 83, 14, 2791);
    			add_location(b, file$h, 85, 16, 2879);
    			attr_dev(a, "class", "predictions-link svelte-b5c3gb");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file$h, 84, 14, 2813);
    			add_location(br1, file$h, 91, 14, 3113);
    			attr_dev(div4, "class", "next-game-item svelte-b5c3gb");
    			add_location(div4, file$h, 81, 12, 2715);
    			attr_dev(div5, "class", "predictions");
    			add_location(div5, file$h, 55, 10, 1772);
    			attr_dev(div6, "class", "predictions-and-logo svelte-b5c3gb");
    			add_location(div6, file$h, 44, 8, 1398);
    			attr_dev(div7, "class", "past-results svelte-b5c3gb");
    			add_location(div7, file$h, 95, 8, 3183);
    			attr_dev(div8, "class", "next-game-values svelte-b5c3gb");
    			add_location(div8, file$h, 43, 6, 1358);
    			attr_dev(div9, "class", "next-game-prediction svelte-b5c3gb");
    			set_style(div9, "border", "6px solid var(--" + /*oppTeam*/ ctx[7] + ")");
    			add_location(div9, file$h, 20, 4, 625);
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
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*toAlias, data, team*/ 21 && t1_value !== (t1_value = /*toAlias*/ ctx[4](/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam) + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*data, team*/ 5 && t4_value !== (t4_value = (/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].atHome
    			? "Home"
    			: "Away") + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*oppTeam*/ 128) {
    				set_style(h1, "color", "var(--" + /*oppTeam*/ ctx[7] + "-secondary)");
    			}

    			if (dirty & /*oppTeam*/ 128) {
    				set_style(div0, "background-color", "var(--" + /*oppTeam*/ ctx[7] + ")");
    			}

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

    			if (dirty & /*data, team, toInitials, Date*/ 37) {
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

    			if (dirty & /*oppTeam*/ 128) {
    				set_style(div9, "border", "6px solid var(--" + /*oppTeam*/ ctx[7] + ")");
    			}
    		},
    		i: noop,
    		o: noop,
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
    		source: "(20:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (18:2) {#if data.upcoming[team].nextTeam == null}
    function create_if_block_1$2(ctx) {
    	let seasoncomplete;
    	let current;

    	seasoncomplete = new SeasonComplete({
    			props: { data: /*data*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(seasoncomplete.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(seasoncomplete.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(seasoncomplete, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const seasoncomplete_changes = {};
    			if (dirty & /*data*/ 1) seasoncomplete_changes.data = /*data*/ ctx[0];
    			seasoncomplete.$set(seasoncomplete_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(seasoncomplete.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(seasoncomplete.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(seasoncomplete, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(18:2) {#if data.upcoming[team].nextTeam == null}",
    		ctx
    	});

    	return block;
    }

    // (53:10) {:else}
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
    			attr_dev(div, "class", "next-game-position svelte-b5c3gb");
    			add_location(div, file$h, 53, 12, 1709);
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
    		source: "(53:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (46:10) {#if showBadge}
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
    			attr_dev(div, "class", "next-game-logo opposition-badge svelte-b5c3gb");
    			set_style(div, "background-image", "url('" + /*data*/ ctx[0].logoURLs[/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam] + "')");
    			add_location(div, file$h, 46, 12, 1473);
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
    		source: "(46:10) {#if showBadge}",
    		ctx
    	});

    	return block;
    }

    // (78:14) {:else}
    function create_else_block_2(ctx) {
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
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(78:14) {:else}",
    		ctx
    	});

    	return block;
    }

    // (70:14) {#if currentMatchday != null}
    function create_if_block_3$2(ctx) {
    	let b;
    	let t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = text("%");
    			this.h();
    		},
    		l: function claim(nodes) {
    			b = claim_element(nodes, "B", {});
    			var b_nodes = children(b);
    			t0 = claim_text(b_nodes, t0_value);
    			t1 = claim_text(b_nodes, "%");
    			b_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(b, file$h, 70, 16, 2382);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, b, anchor);
    			append_hydration_dev(b, t0);
    			append_hydration_dev(b, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team, currentMatchday*/ 7 && t0_value !== (t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*data*/ ctx[0].upcoming[/*team*/ ctx[2]].nextTeam][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(70:14) {#if currentMatchday != null}",
    		ctx
    	});

    	return block;
    }

    // (101:10) {:else}
    function create_else_block_1$2(ctx) {
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
    			attr_dev(div, "class", "next-game-item prev-results-title svelte-b5c3gb");
    			add_location(div, file$h, 101, 12, 3435);
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
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(101:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (97:10) {#if data.upcoming[team].prevMatches.length == 0}
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
    			attr_dev(div, "class", "next-game-item prev-results-title no-prev-results svelte-b5c3gb");
    			add_location(div, file$h, 97, 12, 3284);
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
    		source: "(97:10) {#if data.upcoming[team].prevMatches.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (108:10) {#each data.upcoming[team].prevMatches as prevMatch}
    function create_each_block$4(ctx) {
    	let div7;
    	let div0;

    	let t0_value = new Date(/*prevMatch*/ ctx[10].date).toLocaleDateString("en-GB", {
    		weekday: "short",
    		year: "numeric",
    		month: "short",
    		day: "numeric"
    	}) + "";

    	let t0;
    	let t1;
    	let div6;
    	let div4;
    	let div1;
    	let t2_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[10].homeTeam) + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*prevMatch*/ ctx[10].homeGoals + "";
    	let t4;
    	let t5;
    	let t6_value = /*prevMatch*/ ctx[10].awayGoals + "";
    	let t6;
    	let t7;
    	let div3;
    	let t8_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[10].awayTeam) + "";
    	let t8;
    	let t9;
    	let div5;
    	let div6_class_value;
    	let t10;

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div6 = element("div");
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
    			div5 = element("div");
    			t10 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div7 = claim_element(nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div0 = claim_element(div7_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div4 = claim_element(div6_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true, style: true });
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
    			div3 = claim_element(div4_nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			t8 = claim_text(div3_nodes, t8_value);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t9 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { style: true });
    			children(div5).forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			t10 = claim_space(div7_nodes);
    			div7_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "past-result-date svelte-b5c3gb");
    			add_location(div0, file$h, 109, 14, 3782);
    			attr_dev(div1, "class", "home-team svelte-b5c3gb");
    			set_style(div1, "background", "var(--" + /*prevMatch*/ ctx[10].homeTeam.toLowerCase().replace(/ /g, '-') + ")");
    			set_style(div1, "color", "var(--" + /*prevMatch*/ ctx[10].homeTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			add_location(div1, file$h, 119, 18, 4197);
    			attr_dev(div2, "class", "score svelte-b5c3gb");
    			add_location(div2, file$h, 129, 18, 4638);
    			attr_dev(div3, "class", "away-team svelte-b5c3gb");
    			set_style(div3, "background", "var(--" + /*prevMatch*/ ctx[10].awayTeam.toLowerCase().replace(/ /g, '-') + ")");
    			set_style(div3, "color", "var(--" + /*prevMatch*/ ctx[10].awayTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			add_location(div3, file$h, 132, 18, 4770);
    			attr_dev(div4, "class", "past-result svelte-b5c3gb");
    			add_location(div4, file$h, 118, 16, 4152);
    			set_style(div5, "clear", "both");
    			add_location(div5, file$h, 143, 16, 5233);
    			attr_dev(div6, "class", div6_class_value = "next-game-item " + /*prevMatch*/ ctx[10].result + " svelte-b5c3gb");
    			add_location(div6, file$h, 117, 14, 4087);
    			attr_dev(div7, "class", "next-game-item-container");
    			add_location(div7, file$h, 108, 12, 3728);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div7, anchor);
    			append_hydration_dev(div7, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div7, t1);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, div4);
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
    			append_hydration_dev(div6, t9);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div7, t10);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team*/ 5 && t0_value !== (t0_value = new Date(/*prevMatch*/ ctx[10].date).toLocaleDateString("en-GB", {
    				weekday: "short",
    				year: "numeric",
    				month: "short",
    				day: "numeric"
    			}) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*toInitials, data, team*/ 37 && t2_value !== (t2_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[10].homeTeam) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*data, team*/ 5) {
    				set_style(div1, "background", "var(--" + /*prevMatch*/ ctx[10].homeTeam.toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*data, team*/ 5) {
    				set_style(div1, "color", "var(--" + /*prevMatch*/ ctx[10].homeTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*data, team*/ 5 && t4_value !== (t4_value = /*prevMatch*/ ctx[10].homeGoals + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*data, team*/ 5 && t6_value !== (t6_value = /*prevMatch*/ ctx[10].awayGoals + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*toInitials, data, team*/ 37 && t8_value !== (t8_value = /*toInitials*/ ctx[5](/*prevMatch*/ ctx[10].awayTeam) + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*data, team*/ 5) {
    				set_style(div3, "background", "var(--" + /*prevMatch*/ ctx[10].awayTeam.toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*data, team*/ 5) {
    				set_style(div3, "color", "var(--" + /*prevMatch*/ ctx[10].awayTeam.toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*data, team*/ 5 && div6_class_value !== (div6_class_value = "next-game-item " + /*prevMatch*/ ctx[10].result + " svelte-b5c3gb")) {
    				attr_dev(div6, "class", div6_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(108:10) {#each data.upcoming[team].prevMatches as prevMatch}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$i(ctx) {
    	let if_block_anchor;
    	let current;
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
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*data*/ ctx[0] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*data*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$8(ctx);
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
    		id: create_fragment$i.name,
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

    function instance$i($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NextGame', slots, []);

    	function setOppTeam() {
    		if (data.upcoming[team].nextTeam != null) {
    			$$invalidate(7, oppTeam = data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, "-"));
    		}
    	}

    	let oppTeam;
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
    		SeasonComplete,
    		ordinal: ordinal$1,
    		setOppTeam,
    		oppTeam,
    		data,
    		currentMatchday,
    		team,
    		showBadge,
    		toAlias,
    		toInitials,
    		switchTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('oppTeam' in $$props) $$invalidate(7, oppTeam = $$props.oppTeam);
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

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && setOppTeam();
    		}
    	};

    	return [
    		data,
    		currentMatchday,
    		team,
    		showBadge,
    		toAlias,
    		toInitials,
    		switchTeam,
    		oppTeam,
    		click_handler
    	];
    }

    class NextGame extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$i, create_fragment$i, safe_not_equal, {
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
    			id: create_fragment$i.name
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

    /* src\components\StatsValues.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$8 } = globals;
    const file$g = "src\\components\\StatsValues.svelte";

    // (123:0) {#if stats != undefined}
    function create_if_block$7(ctx) {
    	let div12;
    	let div3;
    	let div1;
    	let t0_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xG.toFixed(2) + "";
    	let t0;
    	let t1;
    	let div0;
    	let t2_value = /*rank*/ ctx[5].xG + "";
    	let t2;
    	let div0_class_value;
    	let t3;
    	let div2;
    	let t4;
    	let t5;
    	let div7;
    	let div5;
    	let t6_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xC.toFixed(2) + "";
    	let t6;
    	let t7;
    	let div4;
    	let t8_value = /*rank*/ ctx[5].xC + "";
    	let t8;
    	let div4_class_value;
    	let t9;
    	let div6;
    	let t10;
    	let t11;
    	let div11;
    	let div9;
    	let t12_value = /*stats*/ ctx[1][/*team*/ ctx[0]].cleanSheetRatio.toFixed(2) + "";
    	let t12;
    	let t13;
    	let div8;
    	let t14_value = /*rank*/ ctx[5].cleanSheetRatio + "";
    	let t14;
    	let div8_class_value;
    	let t15;
    	let div10;
    	let t16;

    	const block = {
    		c: function create() {
    			div12 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text("goals per game");
    			t5 = space();
    			div7 = element("div");
    			div5 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			div4 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			div6 = element("div");
    			t10 = text("conceded per game");
    			t11 = space();
    			div11 = element("div");
    			div9 = element("div");
    			t12 = text(t12_value);
    			t13 = space();
    			div8 = element("div");
    			t14 = text(t14_value);
    			t15 = space();
    			div10 = element("div");
    			t16 = text("clean sheets");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div12 = claim_element(nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div3 = claim_element(div12_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t0 = claim_text(div1_nodes, t0_value);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true, id: true });
    			var div0_nodes = children(div0);
    			t2 = claim_text(div0_nodes, t2_value);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, "goals per game");
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t5 = claim_space(div12_nodes);
    			div7 = claim_element(div12_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div5 = claim_element(div7_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t6 = claim_text(div5_nodes, t6_value);
    			t7 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true, id: true });
    			var div4_nodes = children(div4);
    			t8 = claim_text(div4_nodes, t8_value);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t9 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t10 = claim_text(div6_nodes, "conceded per game");
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t11 = claim_space(div12_nodes);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div9 = claim_element(div11_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			t12 = claim_text(div9_nodes, t12_value);
    			t13 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true, id: true });
    			var div8_nodes = children(div8);
    			t14 = claim_text(div8_nodes, t14_value);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			t15 = claim_space(div11_nodes);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			t16 = claim_text(div10_nodes, "clean sheets");
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", div0_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xG + " svelte-jyia24");
    			attr_dev(div0, "id", "ssp1");
    			add_location(div0, file$g, 127, 8, 4146);
    			attr_dev(div1, "class", "season-stat-value svelte-jyia24");
    			add_location(div1, file$g, 125, 6, 4068);
    			attr_dev(div2, "class", "season-stat-text svelte-jyia24");
    			add_location(div2, file$g, 135, 6, 4323);
    			attr_dev(div3, "class", "season-stat goals-per-game svelte-jyia24");
    			add_location(div3, file$g, 124, 4, 4020);
    			attr_dev(div4, "class", div4_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xC + " svelte-jyia24");
    			attr_dev(div4, "id", "ssp2");
    			add_location(div4, file$g, 140, 8, 4520);
    			attr_dev(div5, "class", "season-stat-value svelte-jyia24");
    			add_location(div5, file$g, 138, 6, 4442);
    			attr_dev(div6, "class", "season-stat-text svelte-jyia24");
    			add_location(div6, file$g, 148, 6, 4697);
    			attr_dev(div7, "class", "season-stat conceded-per-game svelte-jyia24");
    			add_location(div7, file$g, 137, 4, 4391);
    			attr_dev(div8, "class", div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].cleanSheetRatio + " svelte-jyia24");
    			attr_dev(div8, "id", "ssp3");
    			add_location(div8, file$g, 153, 8, 4910);
    			attr_dev(div9, "class", "season-stat-value svelte-jyia24");
    			add_location(div9, file$g, 151, 6, 4819);
    			attr_dev(div10, "class", "season-stat-text svelte-jyia24");
    			add_location(div10, file$g, 161, 6, 5113);
    			attr_dev(div11, "class", "season-stat clean-sheet-ratio svelte-jyia24");
    			add_location(div11, file$g, 150, 4, 4768);
    			attr_dev(div12, "class", "season-stats svelte-jyia24");
    			add_location(div12, file$g, 123, 2, 3988);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div12, anchor);
    			append_hydration_dev(div12, div3);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t2);
    			/*div0_binding*/ ctx[7](div0);
    			append_hydration_dev(div3, t3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, t4);
    			append_hydration_dev(div12, t5);
    			append_hydration_dev(div12, div7);
    			append_hydration_dev(div7, div5);
    			append_hydration_dev(div5, t6);
    			append_hydration_dev(div5, t7);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, t8);
    			/*div4_binding*/ ctx[8](div4);
    			append_hydration_dev(div7, t9);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, t10);
    			append_hydration_dev(div12, t11);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div9);
    			append_hydration_dev(div9, t12);
    			append_hydration_dev(div9, t13);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, t14);
    			/*div8_binding*/ ctx[9](div8);
    			append_hydration_dev(div11, t15);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, t16);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*stats, team*/ 3 && t0_value !== (t0_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xG.toFixed(2) + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*rank*/ 32 && t2_value !== (t2_value = /*rank*/ ctx[5].xG + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*rank*/ 32 && div0_class_value !== (div0_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xG + " svelte-jyia24")) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty & /*stats, team*/ 3 && t6_value !== (t6_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xC.toFixed(2) + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*rank*/ 32 && t8_value !== (t8_value = /*rank*/ ctx[5].xC + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*rank*/ 32 && div4_class_value !== (div4_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xC + " svelte-jyia24")) {
    				attr_dev(div4, "class", div4_class_value);
    			}

    			if (dirty & /*stats, team*/ 3 && t12_value !== (t12_value = /*stats*/ ctx[1][/*team*/ ctx[0]].cleanSheetRatio.toFixed(2) + "")) set_data_dev(t12, t12_value);
    			if (dirty & /*rank*/ 32 && t14_value !== (t14_value = /*rank*/ ctx[5].cleanSheetRatio + "")) set_data_dev(t14, t14_value);

    			if (dirty & /*rank*/ 32 && div8_class_value !== (div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].cleanSheetRatio + " svelte-jyia24")) {
    				attr_dev(div8, "class", div8_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div12);
    			/*div0_binding*/ ctx[7](null);
    			/*div4_binding*/ ctx[8](null);
    			/*div8_binding*/ ctx[9](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(123:0) {#if stats != undefined}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$h(ctx) {
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
    		id: create_fragment$h.name,
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
    			let [h, _, a] = score.split(" ");
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

    function buildStats(data) {
    	let stats = {};

    	for (let team of data.teamNames) {
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

    function instance$h($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('StatsValues', slots, []);

    	function setPositionalOffset() {
    		document.documentElement.style.setProperty("--ssp1-offset", -ssp1.clientWidth / 2 + "px");
    		document.documentElement.style.setProperty("--ssp2-offset", -ssp2.clientWidth / 2 + "px");
    		document.documentElement.style.setProperty("--ssp3-offset", -ssp3.clientWidth / 2 + "px");
    	}

    	function setStatsValues(seasonStats, team) {
    		$$invalidate(5, rank = getStatsRankings(seasonStats, team));

    		// Keep ordinal values at the correct offset
    		// Once rank values have updated, init positional offset for ordinal values
    		window.addEventListener("resize", setPositionalOffset);
    	}

    	function refreshStatsValues() {
    		if (setup) {
    			setStatsValues(stats, team);
    		}
    	}

    	let stats;
    	let ssp1, ssp2, ssp3;
    	let rank = { xG: "", xC: "", cleanSheetRatio: "" };
    	let setup = false;

    	onMount(() => {
    		$$invalidate(1, stats = buildStats(data));
    		setStatsValues(stats, team);
    		setup = true;
    	});

    	let { data, team } = $$props;
    	const writable_props = ['data', 'team'];

    	Object_1$8.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<StatsValues> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			ssp1 = $$value;
    			$$invalidate(2, ssp1);
    		});
    	}

    	function div4_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			ssp2 = $$value;
    			$$invalidate(3, ssp2);
    		});
    	}

    	function div8_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			ssp3 = $$value;
    			$$invalidate(4, ssp3);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(6, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		ordinal,
    		getStatsRank,
    		getStatsRankings,
    		setPositionalOffset,
    		setStatsValues,
    		isCleanSheet,
    		goalsScored,
    		goalsConceded,
    		notScored,
    		countOccurances,
    		buildStats,
    		refreshStatsValues,
    		stats,
    		ssp1,
    		ssp2,
    		ssp3,
    		rank,
    		setup,
    		data,
    		team
    	});

    	$$self.$inject_state = $$props => {
    		if ('stats' in $$props) $$invalidate(1, stats = $$props.stats);
    		if ('ssp1' in $$props) $$invalidate(2, ssp1 = $$props.ssp1);
    		if ('ssp2' in $$props) $$invalidate(3, ssp2 = $$props.ssp2);
    		if ('ssp3' in $$props) $$invalidate(4, ssp3 = $$props.ssp3);
    		if ('rank' in $$props) $$invalidate(5, rank = $$props.rank);
    		if ('setup' in $$props) setup = $$props.setup;
    		if ('data' in $$props) $$invalidate(6, data = $$props.data);
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

    	return [
    		team,
    		stats,
    		ssp1,
    		ssp2,
    		ssp3,
    		rank,
    		data,
    		div0_binding,
    		div4_binding,
    		div8_binding
    	];
    }

    class StatsValues extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, { data: 6, team: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StatsValues",
    			options,
    			id: create_fragment$h.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[6] === undefined && !('data' in props)) {
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

    const file$f = "src\\components\\TeamsFooter.svelte";

    // (11:4) {#if lastUpdated != null}
    function create_if_block$6(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text("Last updated: ");
    			t1 = text(/*lastUpdated*/ ctx[0]);
    			t2 = text(" UTC");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, "Last updated: ");
    			t1 = claim_text(div_nodes, /*lastUpdated*/ ctx[0]);
    			t2 = claim_text(div_nodes, " UTC");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "last-updated svelte-14nl4k7");
    			add_location(div, file$f, 11, 6, 409);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(div, t1);
    			append_hydration_dev(div, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*lastUpdated*/ 1) set_data_dev(t1, /*lastUpdated*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(11:4) {#if lastUpdated != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$g(ctx) {
    	let div3;
    	let a;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let t1;
    	let t2;
    	let div2;
    	let div1;
    	let t3;
    	let t4;
    	let if_block = /*lastUpdated*/ ctx[0] != null && create_if_block$6(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			a = element("a");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			t1 = text("Support Me");
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			t3 = text("pldashboard v2.0");
    			t4 = space();
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			a = claim_element(div3_nodes, "A", { class: true, href: true, target: true });
    			var a_nodes = children(a);
    			img = claim_element(a_nodes, "IMG", { class: true, src: true, alt: true });
    			t0 = claim_space(a_nodes);
    			div0 = claim_element(a_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t1 = claim_text(div0_nodes, "Support Me");
    			div0_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			t2 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t3 = claim_text(div1_nodes, "pldashboard v2.0");
    			div1_nodes.forEach(detach_dev);
    			t4 = claim_space(div2_nodes);
    			if (if_block) if_block.l(div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "ko-fi-img svelte-14nl4k7");
    			if (!src_url_equal(img.src, img_src_value = "img/kofi.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$f, 5, 4, 179);
    			attr_dev(div0, "class", "ko-fi-text svelte-14nl4k7");
    			add_location(div0, file$f, 6, 4, 236);
    			attr_dev(a, "class", "ko-fi svelte-14nl4k7");
    			attr_dev(a, "href", "https://ko-fi.com/C0C069FOI");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$f, 4, 2, 105);
    			attr_dev(div1, "class", "version svelte-14nl4k7");
    			add_location(div1, file$f, 9, 4, 327);
    			attr_dev(div2, "class", "teams-footer-bottom svelte-14nl4k7");
    			add_location(div2, file$f, 8, 2, 288);
    			attr_dev(div3, "class", "teams-footer footer-text-colour svelte-14nl4k7");
    			add_location(div3, file$f, 3, 0, 56);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, a);
    			append_hydration_dev(a, img);
    			append_hydration_dev(a, t0);
    			append_hydration_dev(a, div0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div3, t2);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div2, t4);
    			if (if_block) if_block.m(div2, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*lastUpdated*/ ctx[0] != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					if_block.m(div2, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
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

    function instance$g($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, { lastUpdated: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TeamsFooter",
    			options,
    			id: create_fragment$g.name
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
    const file$e = "src\\components\\FixturesGraph.svelte";

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
    			add_location(div0, file$e, 260, 2, 8122);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$e, 259, 0, 8101);
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
    		id: create_fragment$f.name,
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
    			color: y,
    			opacity: 1,
    			line: { width: 1 }
    		},
    		customdata: matchdays,
    		hovertemplate: "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>"
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

    	// let maxX = new Date(Math.max(x[x.length - 1], now));
    	let maxX = new Date(x[x.length - 1]);

    	maxX.setDate(maxX.getDate() + 7);
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
    			margin: { r: 20, l: 60, t: 5, b: 40, pad: 5 },
    			hovermode: "closest",
    			plot_bgcolor: "#fafafa",
    			paper_bgcolor: "#fafafa",
    			yaxis: {
    				title: { text: "Difficulty" },
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
    			shapes: [nowLine(now, maxX)],
    			dragmode: false
    		},
    		config: {
    			responsive: true,
    			showSendToCloud: false,
    			displayModeBar: false
    		}
    	};

    	return plotData;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FixturesGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let layoutUpdate = {
    				"yaxis.title": { text: "Difficulty" },
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
    					colorscale: [[0, "#01c626"], [0.5, "#f3f3f3"], [1, "#fc1303"]],
    					color: plotData.data[0].y,
    					opacity: 1,
    					line: { width: 1 }
    				}
    			};

    			plotData.data[0].marker.size = sizes;
    			Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
    		}
    	}

    	function mobileLayout() {
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
    					colorscale: [[0, "#01c626"], [0.5, "#f3f3f3"], [1, "#fc1303"]],
    					color: plotData.data[0].y,
    					opacity: 1,
    					line: { width: 1 }
    				}
    			};

    			plotData.data[0].marker.size = sizes;
    			Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
    		}
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
    			let l = line(data, team, Date.now());
    			plotData.data[0] = l; // Overwrite plot data
    			Plotly.redraw(plotDiv);

    			if (mobileView) {
    				mobileLayout();
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
    		defaultLayout,
    		mobileLayout,
    		buildPlotData,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 24) {
    			setup && mobileView && mobileLayout();
    		}
    	};

    	return [plotDiv, data, team, mobileView, setup, div0_binding];
    }

    class FixturesGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FixturesGraph",
    			options,
    			id: create_fragment$f.name
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

    const { Object: Object_1$7 } = globals;
    const file$d = "src\\components\\FormOverTimeGraph.svelte";

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
    			add_location(div0, file$d, 155, 2, 5014);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$d, 154, 0, 4993);
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

    		teamKey = teamKey.replace(/ /g, '-').toLowerCase();
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

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormOverTimeGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let layout = {
    				yaxis: {
    					title: { text: "Form Rating" },
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					range: [0, 100],
    					tickvals: Array.from(Array(11), (_, i) => i * 10)
    				},
    				margin: { r: 20, l: 60, t: 5, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, layout);
    		}
    	}

    	function mobileLayout() {
    		if (setup) {
    			let layout = {
    				yaxis: {
    					title: null,
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					range: [0, 100],
    					visible: false,
    					tickvals: Array.from(Array(11), (_, i) => i * 10)
    				},
    				margin: { r: 20, l: 20, t: 5, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, layout);
    		}
    	}

    	function buildPlotData(data, team) {
    		let yLabels = Array.from(Array(11), (_, i) => i * 10);

    		let plotData = {
    			data: lines$1(data, team, playedMatchdays),
    			layout: {
    				title: false,
    				autosize: true,
    				margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
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
    				},
    				dragmode: false
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
    		$$invalidate(5, setup = true);
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

    			if (mobileView) {
    				mobileLayout();
    			}
    		}
    	}

    	let { data, team, playedMatchdays, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$7.keys($$props).forEach(key => {
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
    		lines: lines$1,
    		defaultLayout,
    		mobileLayout,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && mobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class FormOverTimeGraph extends SvelteComponentDev {
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
    			tagName: "FormOverTimeGraph",
    			options,
    			id: create_fragment$e.name
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

    const { Object: Object_1$6 } = globals;
    const file$c = "src\\components\\PositionOverTimeGraph.svelte";

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
    			add_location(div0, file$c, 200, 2, 6451);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$c, 199, 0, 6430);
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

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PositionOverTimeGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: { text: "Position" },
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					autorange: "reversed",
    					fixedrange: true,
    					tickvals: Array.from(Array(20), (_, i) => i + 1)
    				},
    				margin: { r: 20, l: 60, t: 5, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function mobileLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: null,
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					autorange: "reversed",
    					visible: false,
    					tickvals: Array.from(Array(10), (_, i) => i + 2)
    				},
    				margin: { r: 20, l: 20, t: 5, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function buildPlotData(data, team) {
    		let yLabels = Array.from(Array(20), (_, i) => i + 1);

    		let plotData = {
    			data: lines(data, team, playedMatchdays),
    			layout: {
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
    				],
    				dragmode: false
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
    		$$invalidate(5, setup = true);
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

    			if (mobileView) {
    				mobileLayout();
    			}
    		}
    	}

    	let { data, team, playedMatchdays, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$6.keys($$props).forEach(key => {
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
    		lines,
    		defaultLayout,
    		mobileLayout,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && mobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class PositionOverTimeGraph extends SvelteComponentDev {
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
    			tagName: "PositionOverTimeGraph",
    			options,
    			id: create_fragment$d.name
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

    /* src\components\goals_scored_and_conceded\GoalsScoredAndConcededGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$5 } = globals;
    const file$b = "src\\components\\goals_scored_and_conceded\\GoalsScoredAndConcededGraph.svelte";

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
    			add_location(div0, file$b, 198, 2, 6510);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$b, 197, 0, 6489);
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
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GoalsScoredAndConcededGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: { text: 'Goals' },
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					rangemode: "nonnegative"
    				},
    				margin: { r: 20, l: 60, t: 15, b: 15, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function mobileLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: null,
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					visible: false,
    					rangemode: "nonnegative"
    				},
    				margin: { r: 20, l: 20, t: 15, b: 15, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
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
    			layout: {
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
    					rangemode: "nonnegative"
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
    		$$invalidate(5, setup = true);
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

    			if (mobileView) {
    				mobileLayout();
    			}
    		}
    	}

    	let { data, team, playedMatchdays, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$5.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<GoalsScoredAndConcededGraph> was created with unknown prop '${key}'`);
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
    		defaultLayout,
    		mobileLayout,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && mobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class GoalsScoredAndConcededGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedMatchdays: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GoalsScoredAndConcededGraph",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<GoalsScoredAndConcededGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<GoalsScoredAndConcededGraph> was created without expected prop 'team'");
    		}

    		if (/*playedMatchdays*/ ctx[3] === undefined && !('playedMatchdays' in props)) {
    			console.warn("<GoalsScoredAndConcededGraph> was created without expected prop 'playedMatchdays'");
    		}

    		if (/*mobileView*/ ctx[4] === undefined && !('mobileView' in props)) {
    			console.warn("<GoalsScoredAndConcededGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get playedMatchdays() {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedMatchdays(value) {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<GoalsScoredAndConcededGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\goals_scored_and_conceded\CleanSheetsGraph.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1$4 } = globals;
    const file$a = "src\\components\\goals_scored_and_conceded\\CleanSheetsGraph.svelte";

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
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$a, 175, 2, 5327);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$a, 174, 0, 5306);
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
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CleanSheetsGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: null,
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					rangemode: "nonnegative"
    				},
    				margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function mobileLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: null,
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					visible: false,
    					rangemode: "nonnegative"
    				},
    				margin: { r: 20, l: 20, t: 0, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function buildPlotData(data, team) {
    		let [cleanSheetsBar, concededBar] = bars(data, team, playedMatchdays);

    		let plotData = {
    			data: [cleanSheetsBar, concededBar],
    			layout: {
    				title: false,
    				autosize: true,
    				height: 60,
    				margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
    				barmode: "stack",
    				hovermode: "closest",
    				plot_bgcolor: "#fafafa",
    				paper_bgcolor: "#fafafa",
    				yaxis: {
    					title: null,
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
    				],
    				dragmode: false
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
    		$$invalidate(5, setup = true);
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

    			if (mobileView) {
    				mobileLayout();
    			}
    		}
    	}

    	let { data, team, playedMatchdays, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'playedMatchdays', 'mobileView'];

    	Object_1$4.keys($$props).forEach(key => {
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
    		defaultLayout,
    		mobileLayout,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 48) {
    			setup && mobileView && mobileLayout();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, mobileView, setup, div0_binding];
    }

    class CleanSheetsGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedMatchdays: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CleanSheetsGraph",
    			options,
    			id: create_fragment$b.name
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
    const file$9 = "src\\components\\goals_per_game\\GoalsScoredFreqGraph.svelte";

    function create_fragment$a(ctx) {
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
    			add_location(div0, file$9, 91, 2, 2661);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$9, 90, 0, 2640);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GoalsScoredFreqGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let update = {
    				yaxis: getYAxisLayout(),
    				margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function mobileLayout() {
    		if (setup) {
    			let update = {
    				yaxis: getYAxisLayout(),
    				margin: { r: 20, l: 20, t: 15, b: 40, pad: 5 }
    			};

    			update.yaxis.visible = false;
    			update.yaxis.title = null;
    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function buildPlotData() {
    		let xLabels = getXLabels();

    		let plotData = {
    			data: getScoredBars(),
    			layout: {
    				title: null,
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

    			if (mobileView) {
    				mobileLayout();
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
    		mobileLayout,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 192) {
    			setup && mobileView && mobileLayout();
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

    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
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
    			id: create_fragment$a.name
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
    const file$8 = "src\\components\\goals_per_game\\GoalsConcededFreqGraph.svelte";

    function create_fragment$9(ctx) {
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
    			add_location(div0, file$8, 91, 2, 2651);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$8, 90, 0, 2630);
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
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GoalsConcededFreqGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let update = {
    				yaxis: getYAxisLayout(),
    				margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function mobileLayout() {
    		if (setup) {
    			let update = {
    				yaxis: getYAxisLayout(),
    				margin: { r: 20, l: 20, t: 15, b: 40, pad: 5 }
    			};

    			update.yaxis.visible = false;
    			update.yaxis.title = null;
    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function buildPlotData() {
    		let xLabels = getXLabels();

    		let plotData = {
    			data: getConcededBars(),
    			layout: {
    				title: null,
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
    			plotData.data[1] = getConcededTeamBars();
    			Plotly.relayout(plotDiv, { yaxis: getYAxisLayout() });
    			Plotly.redraw(plotDiv);

    			if (mobileView) {
    				mobileLayout();
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
    		mobileLayout,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 192) {
    			setup && mobileView && mobileLayout();
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

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
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
    			id: create_fragment$9.name
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

    const { Object: Object_1$3 } = globals;
    const file$7 = "src\\components\\goals_per_game\\GoalsPerGame.svelte";

    // (231:2) {#if setup}
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
    			add_location(div0, file$7, 231, 4, 7282);
    			attr_dev(div1, "class", "graph freq-graph mini-graph");
    			add_location(div1, file$7, 241, 4, 7515);
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
    		source: "(231:2) {#if setup}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
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
    			add_location(div, file$7, 229, 0, 7237);
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
    		id: create_fragment$8.name,
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

    function instance$8($$self, $$props, $$invalidate) {
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

    	Object_1$3.keys($$props).forEach(key => {
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
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { data: 9, team: 0, mobileView: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GoalsPerGame",
    			options,
    			id: create_fragment$8.name
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

    const { Object: Object_1$2 } = globals;
    const file$6 = "src\\components\\SpiderGraph.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[31] = list[i];
    	return child_ctx;
    }

    // (504:6) {#if _team != team}
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
    			attr_dev(button, "class", "spider-opp-team-btn svelte-1gpl4ff");
    			add_location(button, file$6, 504, 8, 16226);
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
    		source: "(504:6) {#if _team != team}",
    		ctx
    	});

    	return block;
    }

    // (503:4) {#each teams as _team}
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
    		source: "(503:4) {#each teams as _team}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
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
    			add_location(div0, file$6, 495, 4, 15934);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$6, 494, 2, 15911);
    			attr_dev(div2, "class", "spider-chart svelte-1gpl4ff");
    			add_location(div2, file$6, 493, 0, 15881);
    			attr_dev(div3, "class", "spider-opp-team-btns svelte-1gpl4ff");
    			attr_dev(div3, "id", "spider-opp-teams");
    			add_location(div3, file$6, 501, 2, 16105);
    			attr_dev(div4, "class", "spider-opp-team-selector svelte-1gpl4ff");
    			add_location(div4, file$6, 500, 0, 16063);
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
    		id: create_fragment$7.name,
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
    	let [attack, maxGoals] = goalsPerSeason(data);
    	attack = scaleAttack(attack, maxGoals);
    	attack.avg = attributeAvg(attack);
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
    	defence.avg = attributeAvg(defence);
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

    	cleanSheets.avg = attributeAvgScaled(cleanSheets, maxCleanSheets);
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

    	consistency.avg = attributeAvgScaled(consistency, maxConsistency);
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

    	vsBig6.avg = attributeAvgScaled(vsBig6, maxWinsVsBig6);
    	return vsBig6;
    }

    function emptyArray(arr) {
    	let length = arr.length;

    	for (let i = 0; i < length; i++) {
    		arr.pop();
    	}
    }

    function instance$7($$self, $$props, $$invalidate) {
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
    			layout: {
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

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SpiderGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(3, plotDiv);
    		});
    	}

    	const click_handler = e => {
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
    			instance$7,
    			create_fragment$7,
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
    			id: create_fragment$7.name
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

    const { Object: Object_1$1 } = globals;
    const file$5 = "src\\components\\ScorelineFreqGraph.svelte";

    function create_fragment$6(ctx) {
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
    			add_location(div0, file$5, 258, 2, 7990);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$5, 257, 0, 7969);
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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
    		let [h, _, a] = score.split(" ");
    		h = parseInt(h);
    		a = parseInt(a);

    		if (h > a) {
    			colours.push("#5df455");
    		} else if (h < a) {
    			colours.push("#f74d4d");
    		} else {
    			colours.push("#dfa700");
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
    			hovertemplate: `%{x} with probability %{y:.2f}<extra></extra>`,
    			hoverinfo: "x+y"
    		},
    		{
    			x,
    			y: teamY,
    			type: "bar",
    			name: "Scorelines",
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

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScorelineFreqGraph', slots, []);

    	function defaultLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: null,
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true
    				},
    				margin: { r: 20, l: 65, t: 15, b: 60, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
    		}
    	}

    	function mobileLayout() {
    		if (setup) {
    			let update = {
    				yaxis: {
    					title: { text: "Probability" },
    					gridcolor: "gray",
    					showgrid: false,
    					showline: false,
    					zeroline: false,
    					fixedrange: true,
    					visible: false
    				},
    				margin: { r: 20, l: 20, t: 15, b: 60, pad: 5 }
    			};

    			Plotly.update(plotDiv, {}, update);
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
    			layout: {
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

    			if (mobileView) {
    				mobileLayout();
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

    	Object_1$1.keys($$props).forEach(key => {
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
    		getAvgScoreFreq,
    		insertTeamScoreBars,
    		getColours,
    		separateBars,
    		scaleBars,
    		convertToPercentage,
    		defaultLayout,
    		mobileLayout,
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
    			!mobileView && defaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 24) {
    			setup && mobileView && mobileLayout();
    		}
    	};

    	return [plotDiv, data, team, mobileView, setup, div0_binding];
    }

    class ScorelineFreqGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScorelineFreqGraph",
    			options,
    			id: create_fragment$6.name
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

    const file$4 = "src\\components\\nav\\Nav.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (33:6) {:else}
    function create_else_block$3(ctx) {
    	let button;
    	let div;
    	let t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[5]) + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[4](/*_team*/ ctx[5]);
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
    			attr_dev(div, "class", "team-name svelte-h59c53");
    			add_location(div, file$4, 39, 10, 1343);
    			attr_dev(button, "class", "team-link svelte-h59c53");
    			add_location(button, file$4, 33, 8, 1176);
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
    			if (dirty & /*toAlias, teams*/ 6 && t0_value !== (t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[5]) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(33:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (21:6) {#if _team.toLowerCase().replace(/ /g, "-") == team}
    function create_if_block$3(ctx) {
    	let a;
    	let div;
    	let t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[5]) + "";
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
    			attr_dev(div, "class", "this-team-name svelte-h59c53");
    			set_style(div, "color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + "-secondary)");
    			set_style(div, "background-color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + ")");
    			add_location(div, file$4, 22, 10, 836);
    			attr_dev(a, "href", a_href_value = "/" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-'));
    			attr_dev(a, "class", "team-link");
    			add_location(a, file$4, 21, 8, 754);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, div);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*toAlias, teams*/ 6 && t0_value !== (t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[5]) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*teams*/ 2) {
    				set_style(div, "color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*teams*/ 2) {
    				set_style(div, "background-color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*teams*/ 2 && a_href_value !== (a_href_value = "/" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-'))) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(21:6) {#if _team.toLowerCase().replace(/ /g, \\\"-\\\") == team}",
    		ctx
    	});

    	return block;
    }

    // (20:4) {#each teams as _team, _ (_team)}
    function create_each_block$2(key_1, ctx) {
    	let first;
    	let show_if;
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (dirty & /*teams, team*/ 3) show_if = null;
    		if (show_if == null) show_if = !!(/*_team*/ ctx[5].toLowerCase().replace(/ /g, "-") == /*team*/ ctx[0]);
    		if (show_if) return create_if_block$3;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx, -1);
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

    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
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
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(20:4) {#each teams as _team, _ (_team)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let nav;
    	let div0;
    	let p;
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let div1;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t3;
    	let div2;
    	let button;
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;
    	let each_value = /*teams*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*_team*/ ctx[5];
    	validate_each_keys(ctx, each_value, get_each_context$2, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

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

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

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

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div1_nodes);
    			}

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
    			add_location(span, file$4, 15, 6, 550);
    			add_location(p, file$4, 14, 4, 539);
    			attr_dev(div0, "class", "title no-selection svelte-h59c53");
    			add_location(div0, file$4, 13, 2, 501);
    			attr_dev(div1, "class", "team-links svelte-h59c53");
    			add_location(div1, file$4, 18, 2, 621);
    			if (!src_url_equal(img.src, img_src_value = "img/arrow-bar-left.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$4, 48, 6, 1555);
    			attr_dev(button, "class", "close-btn svelte-h59c53");
    			add_location(button, file$4, 47, 4, 1498);
    			attr_dev(div2, "class", "close");
    			add_location(div2, file$4, 46, 2, 1473);
    			attr_dev(nav, "id", "navBar");
    			attr_dev(nav, "class", "svelte-h59c53");
    			add_location(nav, file$4, 12, 0, 480);
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

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

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
    			if (dirty & /*teams, toAlias, team, switchTeam*/ 15) {
    				each_value = /*teams*/ ctx[1];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, destroy_block, create_each_block$2, null, get_each_context$2);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			dispose();
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

    function closeNavBar() {
    	document.getElementById("navBar").style.display = "none";
    	document.getElementById("dashboard").style.marginLeft = "0";
    	window.dispatchEvent(new Event("resize")); // Snap plotly graphs to new width
    }

    function openNavBar() {
    	document.getElementById("navBar").style.display = "block";
    	document.getElementById("dashboard").style.marginLeft = "200px";
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Nav', slots, []);
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
    		team,
    		teams,
    		toAlias,
    		switchTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(2, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(3, switchTeam = $$props.switchTeam);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [team, teams, toAlias, switchTeam, click_handler];
    }

    class Nav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			team: 0,
    			teams: 1,
    			toAlias: 2,
    			switchTeam: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Nav",
    			options,
    			id: create_fragment$5.name
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

    const file$3 = "src\\components\\nav\\MobileNav.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    // (25:2) {#if hyphenatedTeams != undefined}
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
    			add_location(div, file$3, 25, 4, 831);
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
    		source: "(25:2) {#if hyphenatedTeams != undefined}",
    		ctx
    	});

    	return block;
    }

    // (28:8) {#if team != null}
    function create_if_block_1$1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[13] == 0 || /*i*/ ctx[13] == 1 && /*hyphenatedTeams*/ ctx[2][0] == null) return create_if_block_2$1;
    		if (/*i*/ ctx[13] == /*hyphenatedTeams*/ ctx[2].length - 1 || /*i*/ ctx[13] == /*hyphenatedTeams*/ ctx[2].length - 2 && /*hyphenatedTeams*/ ctx[2][/*hyphenatedTeams*/ ctx[2].length - 1] == null) return create_if_block_3$1;
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
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(28:8) {#if team != null}",
    		ctx
    	});

    	return block;
    }

    // (49:10) {:else}
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
    			add_location(button, file$3, 49, 12, 1956);
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
    		source: "(49:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (39:144) 
    function create_if_block_3$1(ctx) {
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
    			add_location(button, file$3, 40, 12, 1593);
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
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(39:144) ",
    		ctx
    	});

    	return block;
    }

    // (29:10) {#if i == 0 || (i == 1 && hyphenatedTeams[0] == null)}
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
    			add_location(button, file$3, 30, 12, 1056);
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
    		source: "(29:10) {#if i == 0 || (i == 1 && hyphenatedTeams[0] == null)}",
    		ctx
    	});

    	return block;
    }

    // (27:6) {#each hyphenatedTeams as team, i}
    function create_each_block$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*team*/ ctx[11] != null && create_if_block_1$1(ctx);

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
    					if_block = create_if_block_1$1(ctx);
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
    		source: "(27:6) {#each hyphenatedTeams as team, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
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
    			add_location(nav, file$3, 23, 0, 747);
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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
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
    		if ($$self.$$.dirty & /*hyphenatedTeam*/ 16) {
    			hyphenatedTeam & getHyphenatedTeamNames();
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

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
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
    			id: create_fragment$4.name
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

    /* src\routes\Team.svelte generated by Svelte v3.49.0 */

    const { Object: Object_1, console: console_1$1, document: document_1$1, window: window_1 } = globals;
    const file$2 = "src\\routes\\Team.svelte";

    // (339:6) {:else}
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
    			add_location(div0, file$2, 340, 10, 11700);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$2, 339, 8, 11649);
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
    		source: "(339:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (198:6) {#if data != undefined}
    function create_if_block$1(ctx) {
    	let div27;
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
    	let div11;
    	let div10;
    	let h12;
    	let t10;
    	let t11;
    	let div9;
    	let positionovertimegraph;
    	let t12;
    	let div14;
    	let div13;
    	let h13;
    	let t13;
    	let t14;
    	let div12;
    	let goalsscoredandconcededgraph;
    	let t15;
    	let div17;
    	let div16;
    	let div15;
    	let cleansheetsgraph;
    	let t16;
    	let div18;
    	let statsvalues;
    	let t17;
    	let div20;
    	let div19;
    	let h14;
    	let t18;
    	let t19;
    	let goalspergame;
    	let t20;
    	let div23;
    	let div22;
    	let div21;
    	let scorelinefreqgraph;
    	let t21;
    	let div26;
    	let div25;
    	let h15;
    	let t22;
    	let t23;
    	let div24;
    	let spidergraph;
    	let t24;
    	let teamsfooter;
    	let current;

    	function select_block_type_1(ctx, dirty) {
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type_1();
    	let if_block = current_block_type(ctx);

    	fixturesgraph = new FixturesGraph({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				mobileView: /*mobileView*/ ctx[6]
    			},
    			$$inline: true
    		});

    	currentform = new CurrentForm({
    			props: {
    				data: /*data*/ ctx[5],
    				currentMatchday: /*currentMatchday*/ ctx[3],
    				team: /*team*/ ctx[2],
    				toInitials
    			},
    			$$inline: true
    		});

    	tablesnippet = new TableSnippet({
    			props: {
    				data: /*data*/ ctx[5],
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				team: /*team*/ ctx[2],
    				switchTeam: /*switchTeam*/ ctx[10],
    				toAlias: /*toAlias*/ ctx[7]
    			},
    			$$inline: true
    		});

    	nextgame = new NextGame({
    			props: {
    				data: /*data*/ ctx[5],
    				currentMatchday: /*currentMatchday*/ ctx[3],
    				team: /*team*/ ctx[2],
    				showBadge,
    				toAlias: /*toAlias*/ ctx[7],
    				toInitials,
    				switchTeam: /*switchTeam*/ ctx[10]
    			},
    			$$inline: true
    		});

    	formovertimegraph = new FormOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				playedMatchdays: /*playedMatchdays*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[6]
    			},
    			$$inline: true
    		});

    	positionovertimegraph = new PositionOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				playedMatchdays: /*playedMatchdays*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[6]
    			},
    			$$inline: true
    		});

    	goalsscoredandconcededgraph = new GoalsScoredAndConcededGraph({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				playedMatchdays: /*playedMatchdays*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[6]
    			},
    			$$inline: true
    		});

    	cleansheetsgraph = new CleanSheetsGraph({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				playedMatchdays: /*playedMatchdays*/ ctx[4],
    				mobileView: /*mobileView*/ ctx[6]
    			},
    			$$inline: true
    		});

    	statsvalues = new StatsValues({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2]
    			},
    			$$inline: true
    		});

    	goalspergame = new GoalsPerGame({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				mobileView: /*mobileView*/ ctx[6]
    			},
    			$$inline: true
    		});

    	scorelinefreqgraph = new ScorelineFreqGraph({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				mobileView: /*mobileView*/ ctx[6]
    			},
    			$$inline: true
    		});

    	spidergraph = new SpiderGraph({
    			props: {
    				data: /*data*/ ctx[5],
    				team: /*team*/ ctx[2],
    				teams: /*teams*/ ctx[9],
    				toAlias: /*toAlias*/ ctx[7],
    				toName: /*toName*/ ctx[8]
    			},
    			$$inline: true
    		});

    	teamsfooter = new TeamsFooter({
    			props: { lastUpdated: /*data*/ ctx[5].lastUpdated },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div27 = element("div");
    			div2 = element("div");
    			if_block.c();
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
    			div11 = element("div");
    			div10 = element("div");
    			h12 = element("h1");
    			t10 = text("Position Over Time");
    			t11 = space();
    			div9 = element("div");
    			create_component(positionovertimegraph.$$.fragment);
    			t12 = space();
    			div14 = element("div");
    			div13 = element("div");
    			h13 = element("h1");
    			t13 = text("Goals Scored and Conceded");
    			t14 = space();
    			div12 = element("div");
    			create_component(goalsscoredandconcededgraph.$$.fragment);
    			t15 = space();
    			div17 = element("div");
    			div16 = element("div");
    			div15 = element("div");
    			create_component(cleansheetsgraph.$$.fragment);
    			t16 = space();
    			div18 = element("div");
    			create_component(statsvalues.$$.fragment);
    			t17 = space();
    			div20 = element("div");
    			div19 = element("div");
    			h14 = element("h1");
    			t18 = text("Goals Per Game");
    			t19 = space();
    			create_component(goalspergame.$$.fragment);
    			t20 = space();
    			div23 = element("div");
    			div22 = element("div");
    			div21 = element("div");
    			create_component(scorelinefreqgraph.$$.fragment);
    			t21 = space();
    			div26 = element("div");
    			div25 = element("div");
    			h15 = element("h1");
    			t22 = text("Team Comparison");
    			t23 = space();
    			div24 = element("div");
    			create_component(spidergraph.$$.fragment);
    			t24 = space();
    			create_component(teamsfooter.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div27 = claim_element(nodes, "DIV", { class: true });
    			var div27_nodes = children(div27);
    			div2 = claim_element(div27_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			if_block.l(div2_nodes);
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
    			t3 = claim_space(div27_nodes);
    			div5 = claim_element(div27_nodes, "DIV", { class: true });
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
    			t6 = claim_space(div27_nodes);
    			div8 = claim_element(div27_nodes, "DIV", { class: true });
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
    			t9 = claim_space(div27_nodes);
    			div11 = claim_element(div27_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h12 = claim_element(div10_nodes, "H1", { class: true });
    			var h12_nodes = children(h12);
    			t10 = claim_text(h12_nodes, "Position Over Time");
    			h12_nodes.forEach(detach_dev);
    			t11 = claim_space(div10_nodes);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			claim_component(positionovertimegraph.$$.fragment, div9_nodes);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t12 = claim_space(div27_nodes);
    			div14 = claim_element(div27_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			h13 = claim_element(div13_nodes, "H1", { class: true });
    			var h13_nodes = children(h13);
    			t13 = claim_text(h13_nodes, "Goals Scored and Conceded");
    			h13_nodes.forEach(detach_dev);
    			t14 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			claim_component(goalsscoredandconcededgraph.$$.fragment, div12_nodes);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			t15 = claim_space(div27_nodes);
    			div17 = claim_element(div27_nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			div16 = claim_element(div17_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			div15 = claim_element(div16_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			claim_component(cleansheetsgraph.$$.fragment, div15_nodes);
    			div15_nodes.forEach(detach_dev);
    			div16_nodes.forEach(detach_dev);
    			div17_nodes.forEach(detach_dev);
    			t16 = claim_space(div27_nodes);
    			div18 = claim_element(div27_nodes, "DIV", { class: true });
    			var div18_nodes = children(div18);
    			claim_component(statsvalues.$$.fragment, div18_nodes);
    			div18_nodes.forEach(detach_dev);
    			t17 = claim_space(div27_nodes);
    			div20 = claim_element(div27_nodes, "DIV", { class: true });
    			var div20_nodes = children(div20);
    			div19 = claim_element(div20_nodes, "DIV", { class: true });
    			var div19_nodes = children(div19);
    			h14 = claim_element(div19_nodes, "H1", {});
    			var h14_nodes = children(h14);
    			t18 = claim_text(h14_nodes, "Goals Per Game");
    			h14_nodes.forEach(detach_dev);
    			t19 = claim_space(div19_nodes);
    			claim_component(goalspergame.$$.fragment, div19_nodes);
    			div19_nodes.forEach(detach_dev);
    			div20_nodes.forEach(detach_dev);
    			t20 = claim_space(div27_nodes);
    			div23 = claim_element(div27_nodes, "DIV", { class: true });
    			var div23_nodes = children(div23);
    			div22 = claim_element(div23_nodes, "DIV", { class: true });
    			var div22_nodes = children(div22);
    			div21 = claim_element(div22_nodes, "DIV", { class: true });
    			var div21_nodes = children(div21);
    			claim_component(scorelinefreqgraph.$$.fragment, div21_nodes);
    			div21_nodes.forEach(detach_dev);
    			div22_nodes.forEach(detach_dev);
    			div23_nodes.forEach(detach_dev);
    			t21 = claim_space(div27_nodes);
    			div26 = claim_element(div27_nodes, "DIV", { class: true });
    			var div26_nodes = children(div26);
    			div25 = claim_element(div26_nodes, "DIV", { class: true });
    			var div25_nodes = children(div25);
    			h15 = claim_element(div25_nodes, "H1", {});
    			var h15_nodes = children(h15);
    			t22 = claim_text(h15_nodes, "Team Comparison");
    			h15_nodes.forEach(detach_dev);
    			t23 = claim_space(div25_nodes);
    			div24 = claim_element(div25_nodes, "DIV", { class: true });
    			var div24_nodes = children(div24);
    			claim_component(spidergraph.$$.fragment, div24_nodes);
    			div24_nodes.forEach(detach_dev);
    			div25_nodes.forEach(detach_dev);
    			div26_nodes.forEach(detach_dev);
    			t24 = claim_space(div27_nodes);
    			claim_component(teamsfooter.$$.fragment, div27_nodes);
    			div27_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h10, "class", "lowered");
    			add_location(h10, file$2, 242, 14, 8412);
    			attr_dev(div0, "class", "graph mini-graph mobile-margin");
    			add_location(div0, file$2, 243, 14, 8461);
    			attr_dev(div1, "class", "row-right fixtures-graph row-graph svelte-yzrut0");
    			add_location(div1, file$2, 241, 12, 8348);
    			attr_dev(div2, "class", "row multi-element-row small-bottom-margin svelte-yzrut0");
    			add_location(div2, file$2, 199, 10, 6792);
    			attr_dev(div3, "class", "row-left form-details svelte-yzrut0");
    			add_location(div3, file$2, 250, 12, 8690);
    			attr_dev(div4, "class", "row-right svelte-yzrut0");
    			add_location(div4, file$2, 260, 12, 9021);
    			attr_dev(div5, "class", "row multi-element-row svelte-yzrut0");
    			add_location(div5, file$2, 249, 10, 8641);
    			attr_dev(h11, "class", "lowered");
    			add_location(h11, file$2, 275, 14, 9419);
    			attr_dev(div6, "class", "graph full-row-graph");
    			add_location(div6, file$2, 276, 14, 9474);
    			attr_dev(div7, "class", "form-graph row-graph svelte-yzrut0");
    			add_location(div7, file$2, 274, 12, 9369);
    			attr_dev(div8, "class", "row svelte-yzrut0");
    			add_location(div8, file$2, 273, 10, 9338);
    			attr_dev(h12, "class", "lowered");
    			add_location(h12, file$2, 284, 14, 9761);
    			attr_dev(div9, "class", "graph full-row-graph");
    			add_location(div9, file$2, 285, 14, 9820);
    			attr_dev(div10, "class", "position-over-time-graph row-graph svelte-yzrut0");
    			add_location(div10, file$2, 283, 12, 9697);
    			attr_dev(div11, "class", "row svelte-yzrut0");
    			add_location(div11, file$2, 282, 10, 9666);
    			attr_dev(h13, "class", "lowered");
    			add_location(h13, file$2, 293, 14, 10134);
    			attr_dev(div12, "class", "graph full-row-graph");
    			add_location(div12, file$2, 294, 14, 10200);
    			attr_dev(div13, "class", "goals-scored-vs-conceded-graph row-graph svelte-yzrut0");
    			add_location(div13, file$2, 292, 12, 10064);
    			attr_dev(div14, "class", "row no-bottom-margin svelte-yzrut0");
    			add_location(div14, file$2, 291, 10, 10016);
    			attr_dev(div15, "class", "clean-sheets graph full-row-graph svelte-yzrut0");
    			add_location(div15, file$2, 302, 14, 10472);
    			attr_dev(div16, "class", "row-graph svelte-yzrut0");
    			add_location(div16, file$2, 301, 12, 10433);
    			attr_dev(div17, "class", "row svelte-yzrut0");
    			add_location(div17, file$2, 300, 10, 10402);
    			attr_dev(div18, "class", "season-stats-row svelte-yzrut0");
    			add_location(div18, file$2, 308, 10, 10676);
    			add_location(h14, file$2, 314, 14, 10866);
    			attr_dev(div19, "class", "goals-freq-row row-graph svelte-yzrut0");
    			add_location(div19, file$2, 313, 12, 10812);
    			attr_dev(div20, "class", "row svelte-yzrut0");
    			add_location(div20, file$2, 312, 10, 10781);
    			attr_dev(div21, "class", "score-freq graph svelte-yzrut0");
    			add_location(div21, file$2, 321, 14, 11070);
    			attr_dev(div22, "class", "row-graph svelte-yzrut0");
    			add_location(div22, file$2, 320, 12, 11031);
    			attr_dev(div23, "class", "row svelte-yzrut0");
    			add_location(div23, file$2, 319, 10, 11000);
    			add_location(h15, file$2, 329, 14, 11338);
    			attr_dev(div24, "class", "spider-chart-container svelte-yzrut0");
    			add_location(div24, file$2, 330, 14, 11378);
    			attr_dev(div25, "class", "spider-chart-row row-graph svelte-yzrut0");
    			add_location(div25, file$2, 328, 12, 11282);
    			attr_dev(div26, "class", "row svelte-yzrut0");
    			add_location(div26, file$2, 327, 10, 11251);
    			attr_dev(div27, "class", "page-content svelte-yzrut0");
    			add_location(div27, file$2, 198, 8, 6754);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div27, anchor);
    			append_hydration_dev(div27, div2);
    			if_block.m(div2, null);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, h10);
    			append_hydration_dev(h10, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, div0);
    			mount_component(fixturesgraph, div0, null);
    			append_hydration_dev(div27, t3);
    			append_hydration_dev(div27, div5);
    			append_hydration_dev(div5, div3);
    			mount_component(currentform, div3, null);
    			append_hydration_dev(div3, t4);
    			mount_component(tablesnippet, div3, null);
    			append_hydration_dev(div5, t5);
    			append_hydration_dev(div5, div4);
    			mount_component(nextgame, div4, null);
    			append_hydration_dev(div27, t6);
    			append_hydration_dev(div27, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, h11);
    			append_hydration_dev(h11, t7);
    			append_hydration_dev(div7, t8);
    			append_hydration_dev(div7, div6);
    			mount_component(formovertimegraph, div6, null);
    			append_hydration_dev(div27, t9);
    			append_hydration_dev(div27, div11);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, h12);
    			append_hydration_dev(h12, t10);
    			append_hydration_dev(div10, t11);
    			append_hydration_dev(div10, div9);
    			mount_component(positionovertimegraph, div9, null);
    			append_hydration_dev(div27, t12);
    			append_hydration_dev(div27, div14);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, h13);
    			append_hydration_dev(h13, t13);
    			append_hydration_dev(div13, t14);
    			append_hydration_dev(div13, div12);
    			mount_component(goalsscoredandconcededgraph, div12, null);
    			append_hydration_dev(div27, t15);
    			append_hydration_dev(div27, div17);
    			append_hydration_dev(div17, div16);
    			append_hydration_dev(div16, div15);
    			mount_component(cleansheetsgraph, div15, null);
    			append_hydration_dev(div27, t16);
    			append_hydration_dev(div27, div18);
    			mount_component(statsvalues, div18, null);
    			append_hydration_dev(div27, t17);
    			append_hydration_dev(div27, div20);
    			append_hydration_dev(div20, div19);
    			append_hydration_dev(div19, h14);
    			append_hydration_dev(h14, t18);
    			append_hydration_dev(div19, t19);
    			mount_component(goalspergame, div19, null);
    			append_hydration_dev(div27, t20);
    			append_hydration_dev(div27, div23);
    			append_hydration_dev(div23, div22);
    			append_hydration_dev(div22, div21);
    			mount_component(scorelinefreqgraph, div21, null);
    			append_hydration_dev(div27, t21);
    			append_hydration_dev(div27, div26);
    			append_hydration_dev(div26, div25);
    			append_hydration_dev(div25, h15);
    			append_hydration_dev(h15, t22);
    			append_hydration_dev(div25, t23);
    			append_hydration_dev(div25, div24);
    			mount_component(spidergraph, div24, null);
    			append_hydration_dev(div27, t24);
    			mount_component(teamsfooter, div27, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if_block.p(ctx, dirty);
    			const fixturesgraph_changes = {};
    			if (dirty & /*data*/ 32) fixturesgraph_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) fixturesgraph_changes.team = /*team*/ ctx[2];
    			if (dirty & /*mobileView*/ 64) fixturesgraph_changes.mobileView = /*mobileView*/ ctx[6];
    			fixturesgraph.$set(fixturesgraph_changes);
    			const currentform_changes = {};
    			if (dirty & /*data*/ 32) currentform_changes.data = /*data*/ ctx[5];
    			if (dirty & /*currentMatchday*/ 8) currentform_changes.currentMatchday = /*currentMatchday*/ ctx[3];
    			if (dirty & /*team*/ 4) currentform_changes.team = /*team*/ ctx[2];
    			currentform.$set(currentform_changes);
    			const tablesnippet_changes = {};
    			if (dirty & /*data*/ 32) tablesnippet_changes.data = /*data*/ ctx[5];
    			if (dirty & /*hyphenatedTeam*/ 1) tablesnippet_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			if (dirty & /*team*/ 4) tablesnippet_changes.team = /*team*/ ctx[2];
    			tablesnippet.$set(tablesnippet_changes);
    			const nextgame_changes = {};
    			if (dirty & /*data*/ 32) nextgame_changes.data = /*data*/ ctx[5];
    			if (dirty & /*currentMatchday*/ 8) nextgame_changes.currentMatchday = /*currentMatchday*/ ctx[3];
    			if (dirty & /*team*/ 4) nextgame_changes.team = /*team*/ ctx[2];
    			nextgame.$set(nextgame_changes);
    			const formovertimegraph_changes = {};
    			if (dirty & /*data*/ 32) formovertimegraph_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) formovertimegraph_changes.team = /*team*/ ctx[2];
    			if (dirty & /*playedMatchdays*/ 16) formovertimegraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[4];
    			if (dirty & /*mobileView*/ 64) formovertimegraph_changes.mobileView = /*mobileView*/ ctx[6];
    			formovertimegraph.$set(formovertimegraph_changes);
    			const positionovertimegraph_changes = {};
    			if (dirty & /*data*/ 32) positionovertimegraph_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) positionovertimegraph_changes.team = /*team*/ ctx[2];
    			if (dirty & /*playedMatchdays*/ 16) positionovertimegraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[4];
    			if (dirty & /*mobileView*/ 64) positionovertimegraph_changes.mobileView = /*mobileView*/ ctx[6];
    			positionovertimegraph.$set(positionovertimegraph_changes);
    			const goalsscoredandconcededgraph_changes = {};
    			if (dirty & /*data*/ 32) goalsscoredandconcededgraph_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) goalsscoredandconcededgraph_changes.team = /*team*/ ctx[2];
    			if (dirty & /*playedMatchdays*/ 16) goalsscoredandconcededgraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[4];
    			if (dirty & /*mobileView*/ 64) goalsscoredandconcededgraph_changes.mobileView = /*mobileView*/ ctx[6];
    			goalsscoredandconcededgraph.$set(goalsscoredandconcededgraph_changes);
    			const cleansheetsgraph_changes = {};
    			if (dirty & /*data*/ 32) cleansheetsgraph_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) cleansheetsgraph_changes.team = /*team*/ ctx[2];
    			if (dirty & /*playedMatchdays*/ 16) cleansheetsgraph_changes.playedMatchdays = /*playedMatchdays*/ ctx[4];
    			if (dirty & /*mobileView*/ 64) cleansheetsgraph_changes.mobileView = /*mobileView*/ ctx[6];
    			cleansheetsgraph.$set(cleansheetsgraph_changes);
    			const statsvalues_changes = {};
    			if (dirty & /*data*/ 32) statsvalues_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) statsvalues_changes.team = /*team*/ ctx[2];
    			statsvalues.$set(statsvalues_changes);
    			const goalspergame_changes = {};
    			if (dirty & /*data*/ 32) goalspergame_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) goalspergame_changes.team = /*team*/ ctx[2];
    			if (dirty & /*mobileView*/ 64) goalspergame_changes.mobileView = /*mobileView*/ ctx[6];
    			goalspergame.$set(goalspergame_changes);
    			const scorelinefreqgraph_changes = {};
    			if (dirty & /*data*/ 32) scorelinefreqgraph_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) scorelinefreqgraph_changes.team = /*team*/ ctx[2];
    			if (dirty & /*mobileView*/ 64) scorelinefreqgraph_changes.mobileView = /*mobileView*/ ctx[6];
    			scorelinefreqgraph.$set(scorelinefreqgraph_changes);
    			const spidergraph_changes = {};
    			if (dirty & /*data*/ 32) spidergraph_changes.data = /*data*/ ctx[5];
    			if (dirty & /*team*/ 4) spidergraph_changes.team = /*team*/ ctx[2];
    			spidergraph.$set(spidergraph_changes);
    			const teamsfooter_changes = {};
    			if (dirty & /*data*/ 32) teamsfooter_changes.lastUpdated = /*data*/ ctx[5].lastUpdated;
    			teamsfooter.$set(teamsfooter_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fixturesgraph.$$.fragment, local);
    			transition_in(currentform.$$.fragment, local);
    			transition_in(tablesnippet.$$.fragment, local);
    			transition_in(nextgame.$$.fragment, local);
    			transition_in(formovertimegraph.$$.fragment, local);
    			transition_in(positionovertimegraph.$$.fragment, local);
    			transition_in(goalsscoredandconcededgraph.$$.fragment, local);
    			transition_in(cleansheetsgraph.$$.fragment, local);
    			transition_in(statsvalues.$$.fragment, local);
    			transition_in(goalspergame.$$.fragment, local);
    			transition_in(scorelinefreqgraph.$$.fragment, local);
    			transition_in(spidergraph.$$.fragment, local);
    			transition_in(teamsfooter.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fixturesgraph.$$.fragment, local);
    			transition_out(currentform.$$.fragment, local);
    			transition_out(tablesnippet.$$.fragment, local);
    			transition_out(nextgame.$$.fragment, local);
    			transition_out(formovertimegraph.$$.fragment, local);
    			transition_out(positionovertimegraph.$$.fragment, local);
    			transition_out(goalsscoredandconcededgraph.$$.fragment, local);
    			transition_out(cleansheetsgraph.$$.fragment, local);
    			transition_out(statsvalues.$$.fragment, local);
    			transition_out(goalspergame.$$.fragment, local);
    			transition_out(scorelinefreqgraph.$$.fragment, local);
    			transition_out(spidergraph.$$.fragment, local);
    			transition_out(teamsfooter.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div27);
    			if_block.d();
    			destroy_component(fixturesgraph);
    			destroy_component(currentform);
    			destroy_component(tablesnippet);
    			destroy_component(nextgame);
    			destroy_component(formovertimegraph);
    			destroy_component(positionovertimegraph);
    			destroy_component(goalsscoredandconcededgraph);
    			destroy_component(cleansheetsgraph);
    			destroy_component(statsvalues);
    			destroy_component(goalspergame);
    			destroy_component(scorelinefreqgraph);
    			destroy_component(spidergraph);
    			destroy_component(teamsfooter);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(198:6) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (210:12) {:else}
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
    	let t1_value = /*data*/ ctx[5].standings[/*team*/ ctx[2]][/*data*/ ctx[5]._id].position + "";
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
    			add_location(circle0, file$2, 213, 20, 7396);
    			attr_dev(circle1, "cx", "170");
    			attr_dev(circle1, "cy", "170");
    			attr_dev(circle1, "r", "140");
    			attr_dev(circle1, "stroke-width", "0");
    			attr_dev(circle1, "fill", circle1_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(circle1, file$2, 220, 20, 7648);
    			attr_dev(circle2, "cx", "300");
    			attr_dev(circle2, "cy", "320");
    			attr_dev(circle2, "r", "170");
    			attr_dev(circle2, "stroke-width", "0");
    			attr_dev(circle2, "fill", circle2_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(circle2, file$2, 227, 20, 7890);
    			attr_dev(svg, "class", "circles-background svelte-yzrut0");
    			add_location(svg, file$2, 212, 18, 7342);
    			attr_dev(div0, "class", "circles-background-container svelte-yzrut0");
    			add_location(div0, file$2, 211, 16, 7280);
    			attr_dev(div1, "class", "position-central svelte-yzrut0");
    			add_location(div1, file$2, 236, 16, 8178);
    			attr_dev(div2, "class", "row-left position-no-badge svelte-yzrut0");
    			add_location(div2, file$2, 210, 14, 7222);
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

    			if (dirty & /*data, team*/ 36 && t1_value !== (t1_value = /*data*/ ctx[5].standings[/*team*/ ctx[2]][/*data*/ ctx[5]._id].position + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(210:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (180:0) <Router>
    function create_default_slot$3(ctx) {
    	let div3;
    	let nav;
    	let t0;
    	let mobilenav;
    	let t1;
    	let button;
    	let t2;
    	let t3;
    	let div2;
    	let div1;
    	let a;
    	let div0;
    	let t4_value = /*toAlias*/ ctx[7](/*team*/ ctx[2]) + "";
    	let t4;
    	let a_href_value;
    	let t5;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	let mounted;
    	let dispose;

    	nav = new Nav({
    			props: {
    				team: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[9],
    				toAlias: /*toAlias*/ ctx[7],
    				switchTeam: /*switchTeam*/ ctx[10]
    			},
    			$$inline: true
    		});

    	mobilenav = new MobileNav({
    			props: {
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[9],
    				toAlias: /*toAlias*/ ctx[7],
    				switchTeam: /*switchTeam*/ ctx[10],
    				toggleMobileNav
    			},
    			$$inline: true
    		});

    	const if_block_creators = [create_if_block$1, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[5] != undefined) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			create_component(nav.$$.fragment);
    			t0 = space();
    			create_component(mobilenav.$$.fragment);
    			t1 = space();
    			button = element("button");
    			t2 = text("Select Team");
    			t3 = space();
    			div2 = element("div");
    			div1 = element("div");
    			a = element("a");
    			div0 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div3_nodes = children(div3);
    			claim_component(nav.$$.fragment, div3_nodes);
    			t0 = claim_space(div3_nodes);
    			claim_component(mobilenav.$$.fragment, div3_nodes);
    			t1 = claim_space(div3_nodes);
    			button = claim_element(div3_nodes, "BUTTON", { id: true, class: true });
    			var button_nodes = children(button);
    			t2 = claim_text(button_nodes, "Select Team");
    			button_nodes.forEach(detach_dev);
    			t3 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { id: true, class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			a = claim_element(div1_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			div0 = claim_element(a_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			t4 = claim_text(div0_nodes, t4_value);
    			div0_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div2_nodes);
    			if_block.l(div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "id", "mobileNavBtn");
    			attr_dev(button, "class", "svelte-yzrut0");
    			add_location(button, file$2, 183, 4, 6260);
    			attr_dev(div0, "class", "title svelte-yzrut0");
    			set_style(div0, "color", "var(--" + (/*hyphenatedTeam*/ ctx[0] + '-secondary') + ")");
    			add_location(div0, file$2, 188, 10, 6524);
    			attr_dev(a, "class", "main-link no-decoration svelte-yzrut0");
    			attr_dev(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			add_location(a, file$2, 187, 8, 6452);
    			attr_dev(div1, "class", "header svelte-yzrut0");
    			set_style(div1, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(div1, file$2, 186, 6, 6371);
    			attr_dev(div2, "id", "dashboard");
    			attr_dev(div2, "class", "svelte-yzrut0");
    			add_location(div2, file$2, 185, 4, 6343);
    			attr_dev(div3, "id", "team");
    			attr_dev(div3, "class", "svelte-yzrut0");
    			add_location(div3, file$2, 180, 2, 6088);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			mount_component(nav, div3, null);
    			append_hydration_dev(div3, t0);
    			mount_component(mobilenav, div3, null);
    			append_hydration_dev(div3, t1);
    			append_hydration_dev(div3, button);
    			append_hydration_dev(button, t2);
    			append_hydration_dev(div3, t3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, a);
    			append_hydration_dev(a, div0);
    			append_hydration_dev(div0, t4);
    			append_hydration_dev(div2, t5);
    			if_blocks[current_block_type_index].m(div2, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", toggleMobileNav, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const nav_changes = {};
    			if (dirty & /*hyphenatedTeam*/ 1) nav_changes.team = /*hyphenatedTeam*/ ctx[0];
    			nav.$set(nav_changes);
    			const mobilenav_changes = {};
    			if (dirty & /*hyphenatedTeam*/ 1) mobilenav_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			mobilenav.$set(mobilenav_changes);
    			if ((!current || dirty & /*team*/ 4) && t4_value !== (t4_value = /*toAlias*/ ctx[7](/*team*/ ctx[2]) + "")) set_data_dev(t4, t4_value);

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
    				if_block.m(div2, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(nav.$$.fragment, local);
    			transition_in(mobilenav.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(nav.$$.fragment, local);
    			transition_out(mobilenav.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(nav);
    			destroy_component(mobilenav);
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(180:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let title_value;
    	let meta;
    	let t;
    	let router;
    	let current;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[11]);
    	document_1$1.title = title_value = /*team*/ ctx[2];

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
    			add_location(meta, file$2, 174, 2, 5935);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1$1.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window_1, "resize", /*onwindowresize*/ ctx[11]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*team*/ 4) && title_value !== (title_value = /*team*/ ctx[2])) {
    				document_1$1.title = title_value;
    			}

    			const router_changes = {};

    			if (dirty & /*$$scope, data, team, mobileView, playedMatchdays, currentMatchday, hyphenatedTeam*/ 16509) {
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
    			dispose();
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
    	let mobileNav = document.getElementById('mobileNav');

    	if (mobileNav.style.width == "0px") {
    		mobileNav.style.animation = 'appear 0.1s ease-in 1';
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

    function instance$3($$self, $$props, $$invalidate) {
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
    		$$invalidate(2, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));

    		fetchData$1("https://pldashboard.herokuapp.com/api/teams").then(json => {
    			// Build teamData package from json data
    			json.teamNames = Object.keys(json.standings);

    			$$invalidate(3, currentMatchday = getCurrentMatchday(json, team));
    			$$invalidate(4, playedMatchdays = getPlayedMatchdays(json, team));
    			$$invalidate(5, data = json);
    			console.log(data);
    		}).then(() => {
    			window.dispatchEvent(new Event("resize"));
    		});
    	}

    	function switchTeam(newTeam) {
    		$$invalidate(0, hyphenatedTeam = newTeam);
    		$$invalidate(2, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));
    		$$invalidate(3, currentMatchday = getCurrentMatchday(data, team));
    		$$invalidate(4, playedMatchdays = getPlayedMatchdays(data, team));
    		window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
    	}

    	let pageWidth;
    	let team = "";
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
    		$$invalidate(1, pageWidth = window_1.innerWidth);
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
    		GoalsScoredAndConcededGraph,
    		CleanSheetsGraph,
    		GoalsPerGame,
    		SpiderGraph,
    		ScorelineFreqGraph,
    		Nav,
    		MobileNav,
    		alias,
    		toInitials,
    		toAlias,
    		toName,
    		toggleMobileNav,
    		teams,
    		toTitleCase,
    		getPlayedMatchdays,
    		getCurrentMatchday,
    		fetchData: fetchData$1,
    		initDashboard,
    		switchTeam,
    		pageWidth,
    		showBadge,
    		team,
    		currentMatchday,
    		playedMatchdays,
    		data,
    		hyphenatedTeam,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('alias' in $$props) alias = $$props.alias;
    		if ('teams' in $$props) $$invalidate(9, teams = $$props.teams);
    		if ('pageWidth' in $$props) $$invalidate(1, pageWidth = $$props.pageWidth);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('currentMatchday' in $$props) $$invalidate(3, currentMatchday = $$props.currentMatchday);
    		if ('playedMatchdays' in $$props) $$invalidate(4, playedMatchdays = $$props.playedMatchdays);
    		if ('data' in $$props) $$invalidate(5, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('mobileView' in $$props) $$invalidate(6, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pageWidth*/ 2) {
    			$$invalidate(6, mobileView = pageWidth <= 700);
    		}
    	};

    	return [
    		hyphenatedTeam,
    		pageWidth,
    		team,
    		currentMatchday,
    		playedMatchdays,
    		data,
    		mobileView,
    		toAlias,
    		toName,
    		teams,
    		switchTeam,
    		onwindowresize
    	];
    }

    class Team extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { hyphenatedTeam: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Team",
    			options,
    			id: create_fragment$3.name
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
    const file$1 = "src\\routes\\Home.svelte";

    // (9:0) <Router>
    function create_default_slot$2(ctx) {
    	let div2;
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let a0;
    	let t1;
    	let t2;
    	let a1;
    	let t3;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			a0 = element("a");
    			t1 = text("Dashboard");
    			t2 = space();
    			a1 = element("a");
    			t3 = text("Fantasy");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			img = claim_element(div1_nodes, "IMG", { src: true, alt: true, class: true });
    			t0 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a0 = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a0_nodes = children(a0);
    			t1 = claim_text(a0_nodes, "Dashboard");
    			a0_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			a1 = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a1_nodes = children(a1);
    			t3 = claim_text(a1_nodes, "Fantasy");
    			a1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = "img/pldashboard4.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pldashboard");
    			attr_dev(img, "class", "svelte-11buupz");
    			add_location(img, file$1, 11, 6, 278);
    			attr_dev(a0, "class", "dashboard-link svelte-11buupz");
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$1, 13, 8, 367);
    			attr_dev(a1, "class", "fantasy-link svelte-11buupz");
    			attr_dev(a1, "href", "/");
    			add_location(a1, file$1, 14, 8, 425);
    			attr_dev(div0, "class", "links svelte-11buupz");
    			add_location(div0, file$1, 12, 6, 338);
    			attr_dev(div1, "class", "content svelte-11buupz");
    			add_location(div1, file$1, 10, 4, 249);
    			attr_dev(div2, "id", "home");
    			attr_dev(div2, "class", "svelte-11buupz");
    			add_location(div2, file$1, 9, 2, 228);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, img);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a0);
    			append_hydration_dev(a0, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, a1);
    			append_hydration_dev(a1, t3);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(9:0) <Router>",
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
    			add_location(meta, file$1, 5, 2, 123);
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\routes\Predictions.svelte generated by Svelte v3.49.0 */

    const { console: console_1, document: document_1 } = globals;
    const file = "src\\routes\\Predictions.svelte";

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

    // (167:4) {:else}
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
    			add_location(div0, file, 168, 8, 6412);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file, 167, 6, 6363);
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
    		source: "(167:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (81:4) {#if data != undefined}
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
    			add_location(b0, file, 85, 40, 2944);
    			attr_dev(span, "class", "accuracy-item svelte-w1juvm");
    			add_location(span, file, 84, 12, 2874);
    			add_location(br, file, 88, 13, 3055);
    			add_location(b1, file, 90, 40, 3144);
    			attr_dev(div0, "class", "accuracy-item svelte-w1juvm");
    			add_location(div0, file, 89, 12, 3075);
    			attr_dev(div1, "class", "accuracy svelte-w1juvm");
    			add_location(div1, file, 83, 10, 2838);
    			attr_dev(div2, "class", "accuracy-display svelte-w1juvm");
    			add_location(div2, file, 82, 8, 2796);
    			attr_dev(div3, "class", "predictions svelte-w1juvm");
    			add_location(div3, file, 98, 10, 3348);
    			attr_dev(div4, "class", "predictions-container svelte-w1juvm");
    			add_location(div4, file, 97, 8, 3301);
    			attr_dev(div5, "class", "page-content svelte-w1juvm");
    			add_location(div5, file, 81, 6, 2760);
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
    		source: "(81:4) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (100:12) {#if data.predictions != null}
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
    		source: "(100:12) {#if data.predictions != null}",
    		ctx
    	});

    	return block;
    }

    // (135:20) {:else}
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
    			attr_dev(div, "class", "prediction-time svelte-w1juvm");
    			add_location(div, file, 135, 22, 5231);
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
    		source: "(135:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (124:20) {#if pred.actual != null}
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
    			attr_dev(div0, "class", "prediction-label svelte-w1juvm");
    			add_location(div0, file, 125, 24, 4690);
    			attr_dev(div1, "class", "prediction-initials svelte-w1juvm");
    			add_location(div1, file, 127, 26, 4817);
    			attr_dev(div2, "class", "prediction-score svelte-w1juvm");
    			add_location(div2, file, 128, 26, 4895);
    			attr_dev(div3, "class", "prediction-initials svelte-w1juvm");
    			add_location(div3, file, 131, 26, 5066);
    			attr_dev(div4, "class", "prediction-value svelte-w1juvm");
    			add_location(div4, file, 126, 24, 4759);
    			attr_dev(div5, "class", "actual prediction-item svelte-w1juvm");
    			add_location(div5, file, 124, 22, 4628);
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
    		source: "(124:20) {#if pred.actual != null}",
    		ctx
    	});

    	return block;
    }

    // (142:20) {#if pred.prediction != null}
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
    			add_location(b, file, 144, 26, 5648);
    			attr_dev(div0, "class", "detailed-predicted-score svelte-w1juvm");
    			add_location(div0, file, 143, 24, 5582);
    			attr_dev(div1, "class", "prediction-details svelte-w1juvm");
    			attr_dev(div1, "id", div1_id_value = /*pred*/ ctx[6]._id);
    			add_location(div1, file, 142, 22, 5510);
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
    		source: "(142:20) {#if pred.prediction != null}",
    		ctx
    	});

    	return block;
    }

    // (107:16) {#each predictions as pred}
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
    			attr_dev(div0, "class", "prediction-label svelte-w1juvm");
    			add_location(div0, file, 112, 22, 3992);
    			attr_dev(div1, "class", "prediction-initials svelte-w1juvm");
    			add_location(div1, file, 114, 24, 4118);
    			attr_dev(div2, "class", "prediction-score svelte-w1juvm");
    			add_location(div2, file, 115, 24, 4194);
    			attr_dev(div3, "class", "prediction-initials svelte-w1juvm");
    			add_location(div3, file, 120, 24, 4449);
    			attr_dev(div4, "class", "prediction-value svelte-w1juvm");
    			add_location(div4, file, 113, 22, 4062);
    			attr_dev(div5, "class", "prediction prediction-item svelte-w1juvm");
    			add_location(div5, file, 111, 20, 3928);
    			attr_dev(button, "class", button_class_value = "prediction-container " + /*pred*/ ctx[6].colour + " svelte-w1juvm");
    			add_location(button, file, 107, 18, 3745);
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

    			if (dirty & /*data*/ 1 && button_class_value !== (button_class_value = "prediction-container " + /*pred*/ ctx[6].colour + " svelte-w1juvm")) {
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
    		source: "(107:16) {#each predictions as pred}",
    		ctx
    	});

    	return block;
    }

    // (101:14) {#each data.predictions as { _id, predictions }}
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
    			attr_dev(div0, "class", "date svelte-w1juvm");
    			add_location(div0, file, 101, 16, 3499);
    			attr_dev(div1, "class", "medium-predictions-divider svelte-w1juvm");
    			add_location(div1, file, 104, 16, 3584);
    			attr_dev(div2, "class", "predictions-gap svelte-w1juvm");
    			add_location(div2, file, 153, 16, 5963);
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
    		source: "(101:14) {#each data.predictions as { _id, predictions }}",
    		ctx
    	});

    	return block;
    }

    // (75:0) <Router>
    function create_default_slot$1(ctx) {
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
    			attr_dev(a, "class", "predictions-title svelte-w1juvm");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file, 77, 6, 2645);
    			attr_dev(div0, "class", "predictions-header svelte-w1juvm");
    			add_location(div0, file, 76, 4, 2605);
    			attr_dev(div1, "id", "predictions");
    			attr_dev(div1, "class", "svelte-w1juvm");
    			add_location(div1, file, 75, 2, 2577);
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
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(75:0) <Router>",
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
    			add_location(meta, file, 71, 2, 2472);
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
    		id: create_fragment$1.name,
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

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Predictions', slots, []);
    	let data;

    	onMount(() => {
    		fetchData("https://pldashboard.herokuapp.com/api/predictions").then(json => {
    			sortByDate(json);
    			insertColours(json);
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
    		insertColours,
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Predictions",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.49.0 */

    // (11:2) <Route path="/">
    function create_default_slot_2(ctx) {
    	let team;
    	let current;

    	team = new Team({
    			props: { hyphenatedTeam: "manchester-city" },
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
    		source: "(11:2) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (15:2) <Route path="/:team" let:params>
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
    		source: "(15:2) <Route path=\\\"/:team\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (10:0) <Router {url}>
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
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
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
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(10:0) <Router {url}>",
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
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    new App({
        target: document.getElementById("app"),
        hydrate: true
    });

})();
//# sourceMappingURL=bundle.js.map
