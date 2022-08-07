
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
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
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

    function create_fragment$p(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		l(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
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
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$o($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	component_subscribe($$self, routes, value => $$invalidate(6, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	component_subscribe($$self, location, value => $$invalidate(5, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

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

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

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

    class Router extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$o, create_fragment$p, safe_not_equal, { basepath: 3, url: 4 });
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
    function create_if_block$c(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$6, create_else_block$8];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
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
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (43:2) {:else}
    function create_else_block$8(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		l(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
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
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    // (41:2) {#if component !== null}
    function create_if_block_1$6(ctx) {
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

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
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
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    function create_fragment$o(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block$c(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$c(ctx);
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
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$n($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	const location = getContext(LOCATION);
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

    class Route extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$n, create_fragment$o, safe_not_equal, { path: 8, component: 0 });
    	}
    }

    /* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.49.0 */

    function create_fragment$n(ctx) {
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

    	return {
    		c() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l(nodes) {
    			a = claim_element(nodes, "A", { href: true, "aria-current": true });
    			var a_nodes = children(a);
    			if (default_slot) default_slot.l(a_nodes);
    			a_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			set_attributes(a, a_data);
    		},
    		m(target, anchor) {
    			insert_hydration(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(a, "click", /*onClick*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
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
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$m($$self, $$props, $$invalidate) {
    	let ariaCurrent;
    	const omit_props_names = ["to","replace","state","getProps"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $location;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	component_subscribe($$self, base, value => $$invalidate(14, $base = value));
    	const location = getContext(LOCATION);
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

    class Link extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$m, create_fragment$n, safe_not_equal, {
    			to: 7,
    			replace: 8,
    			state: 9,
    			getProps: 10
    		});
    	}
    }

    /* src\routes\Teams.svelte generated by Svelte v3.49.0 */

    const { document: document_1$2 } = globals;

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	child_ctx[3] = i;
    	return child_ctx;
    }

    // (80:4) <Link to="/">
    function create_default_slot_2$1(ctx) {
    	let div;
    	let t;

    	return {
    		c() {
    			div = element("div");
    			t = text("Premier League");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "Premier League");
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "title main-link no-decoration");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (87:8) <Link            to="/{team.toLowerCase().replace(/ /g, '-')}"            class="team-button"            id="team-{i + 1}"            style="background-color: var(--{team              .toLowerCase()              .replace(/ /g, '-')});"          >
    function create_default_slot_1$1(ctx) {
    	let div;
    	let t0_value = /*team*/ ctx[1] + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, style: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, t0_value);
    			div_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "main-link");
    			set_style(div, "color", "var(--" + /*team*/ ctx[1].toLowerCase().replace(/ /g, '-') + "-secondary)");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t0);
    			insert_hydration(target, t1, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t1);
    		}
    	};
    }

    // (86:6) {#each teams as team, i (team)}
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
    			}
    		});

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			create_component(link.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			first = empty();
    			claim_component(link.$$.fragment, nodes);
    			this.h();
    		},
    		h() {
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert_hydration(target, first, anchor);
    			mount_component(link, target, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const link_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				link_changes.$$scope = { dirty, ctx };
    			}

    			link.$set(link_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(link.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(link.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(first);
    			destroy_component(link, detaching);
    		}
    	};
    }

    // (78:0) <Router>
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
    			}
    		});

    	let each_value = /*teams*/ ctx[0];
    	const get_key = ctx => /*team*/ ctx[1];

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$6(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$6(key, child_ctx));
    	}

    	return {
    		c() {
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
    		l(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(link.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach);
    			t = claim_space(nodes);
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div1_nodes);
    			}

    			div1_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "header");
    			attr(div1, "class", "teams svelte-i9b06i");
    			attr(div2, "class", "page-content");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div0, anchor);
    			mount_component(link, div0, null);
    			insert_hydration(target, t, anchor);
    			insert_hydration(target, div2, anchor);
    			append_hydration(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			const link_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				link_changes.$$scope = { dirty, ctx };
    			}

    			link.$set(link_changes);

    			if (dirty & /*teams*/ 1) {
    				each_value = /*teams*/ ctx[0];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, outro_and_destroy_block, create_each_block$6, null, get_each_context$6);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(link.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			transition_out(link.$$.fragment, local);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			destroy_component(link);
    			if (detaching) detach(t);
    			if (detaching) detach(div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};
    }

    function create_fragment$m(ctx) {
    	let meta;
    	let t;
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$4] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1rqatx0\"]', document_1$2.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h() {
    			document_1$2.title = "Premier League";
    			attr(meta, "name", "description");
    			attr(meta, "content", "Premier League Statistics Dashboard");
    		},
    		m(target, anchor) {
    			append_hydration(document_1$2.head, meta);
    			insert_hydration(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			detach(meta);
    			if (detaching) detach(t);
    			destroy_component(router, detaching);
    		}
    	};
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

    function instance$l($$self) {
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

    	return [teams];
    }

    class Teams extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$l, create_fragment$m, safe_not_equal, {});
    	}
    }

    /* src\components\CurrentForm.svelte generated by Svelte v3.49.0 */

    function create_if_block_1$5(ctx) {
    	let div5;
    	let div0;
    	let div0_class_value;
    	let t0;
    	let div1;
    	let div1_class_value;
    	let t1;
    	let div2;
    	let div2_class_value;
    	let t2;
    	let div3;
    	let div3_class_value;
    	let t3;
    	let div4;
    	let div4_class_value;
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

    	return {
    		c() {
    			div5 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = space();
    			div3 = element("div");
    			t3 = space();
    			div4 = element("div");
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
    		l(nodes) {
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div0 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div0).forEach(detach);
    			t0 = claim_space(div5_nodes);
    			div1 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div1).forEach(detach);
    			t1 = claim_space(div5_nodes);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div2).forEach(detach);
    			t2 = claim_space(div5_nodes);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div3).forEach(detach);
    			t3 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div4).forEach(detach);
    			div5_nodes.forEach(detach);
    			t4 = claim_space(nodes);
    			div11 = claim_element(nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div6 = claim_element(div11_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t5 = claim_text(div6_nodes, t5_value);
    			div6_nodes.forEach(detach);
    			t6 = claim_space(div11_nodes);
    			div7 = claim_element(div11_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			t7 = claim_text(div7_nodes, t7_value);
    			div7_nodes.forEach(detach);
    			t8 = claim_space(div11_nodes);
    			div8 = claim_element(div11_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			t9 = claim_text(div8_nodes, t9_value);
    			div8_nodes.forEach(detach);
    			t10 = claim_space(div11_nodes);
    			div9 = claim_element(div11_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			t11 = claim_text(div9_nodes, t11_value);
    			div9_nodes.forEach(detach);
    			t12 = claim_space(div11_nodes);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			t13 = claim_text(div10_nodes, t13_value);
    			div10_nodes.forEach(detach);
    			div11_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", div0_class_value = "icon pos-0 " + /*formIcons*/ ctx[3][0] + " " + /*formStarTeams*/ ctx[4][0] + " svelte-b4v5qq");
    			attr(div1, "class", div1_class_value = "icon pos-1 " + /*formIcons*/ ctx[3][1] + " " + /*formStarTeams*/ ctx[4][1] + " svelte-b4v5qq");
    			attr(div2, "class", div2_class_value = "icon pos-2 " + /*formIcons*/ ctx[3][2] + " " + /*formStarTeams*/ ctx[4][2] + " svelte-b4v5qq");
    			attr(div3, "class", div3_class_value = "icon pos-3 " + /*formIcons*/ ctx[3][3] + " " + /*formStarTeams*/ ctx[4][3] + " svelte-b4v5qq");
    			attr(div4, "class", div4_class_value = "icon pos-4 " + /*formIcons*/ ctx[3][4] + " " + /*formStarTeams*/ ctx[4][4] + " svelte-b4v5qq");
    			attr(div5, "class", "current-form-row svelte-b4v5qq");
    			attr(div6, "class", "icon-name pos-0 svelte-b4v5qq");
    			attr(div7, "class", "icon-name pos-1 svelte-b4v5qq");
    			attr(div8, "class", "icon-name pos-2 svelte-b4v5qq");
    			attr(div9, "class", "icon-name pos-3 svelte-b4v5qq");
    			attr(div10, "class", "icon-name pos-4 svelte-b4v5qq");
    			attr(div11, "class", "current-form-row svelte-b4v5qq");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div5, anchor);
    			append_hydration(div5, div0);
    			append_hydration(div5, t0);
    			append_hydration(div5, div1);
    			append_hydration(div5, t1);
    			append_hydration(div5, div2);
    			append_hydration(div5, t2);
    			append_hydration(div5, div3);
    			append_hydration(div5, t3);
    			append_hydration(div5, div4);
    			insert_hydration(target, t4, anchor);
    			insert_hydration(target, div11, anchor);
    			append_hydration(div11, div6);
    			append_hydration(div6, t5);
    			append_hydration(div11, t6);
    			append_hydration(div11, div7);
    			append_hydration(div7, t7);
    			append_hydration(div11, t8);
    			append_hydration(div11, div8);
    			append_hydration(div8, t9);
    			append_hydration(div11, t10);
    			append_hydration(div11, div9);
    			append_hydration(div9, t11);
    			append_hydration(div11, t12);
    			append_hydration(div11, div10);
    			append_hydration(div10, t13);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*formIcons, formStarTeams*/ 24 && div0_class_value !== (div0_class_value = "icon pos-0 " + /*formIcons*/ ctx[3][0] + " " + /*formStarTeams*/ ctx[4][0] + " svelte-b4v5qq")) {
    				attr(div0, "class", div0_class_value);
    			}

    			if (dirty & /*formIcons, formStarTeams*/ 24 && div1_class_value !== (div1_class_value = "icon pos-1 " + /*formIcons*/ ctx[3][1] + " " + /*formStarTeams*/ ctx[4][1] + " svelte-b4v5qq")) {
    				attr(div1, "class", div1_class_value);
    			}

    			if (dirty & /*formIcons, formStarTeams*/ 24 && div2_class_value !== (div2_class_value = "icon pos-2 " + /*formIcons*/ ctx[3][2] + " " + /*formStarTeams*/ ctx[4][2] + " svelte-b4v5qq")) {
    				attr(div2, "class", div2_class_value);
    			}

    			if (dirty & /*formIcons, formStarTeams*/ 24 && div3_class_value !== (div3_class_value = "icon pos-3 " + /*formIcons*/ ctx[3][3] + " " + /*formStarTeams*/ ctx[4][3] + " svelte-b4v5qq")) {
    				attr(div3, "class", div3_class_value);
    			}

    			if (dirty & /*formIcons, formStarTeams*/ 24 && div4_class_value !== (div4_class_value = "icon pos-4 " + /*formIcons*/ ctx[3][4] + " " + /*formStarTeams*/ ctx[4][4] + " svelte-b4v5qq")) {
    				attr(div4, "class", div4_class_value);
    			}

    			if (dirty & /*formInitials*/ 32 && t5_value !== (t5_value = /*formInitials*/ ctx[5][0] + "")) set_data(t5, t5_value);
    			if (dirty & /*formInitials*/ 32 && t7_value !== (t7_value = /*formInitials*/ ctx[5][1] + "")) set_data(t7, t7_value);
    			if (dirty & /*formInitials*/ 32 && t9_value !== (t9_value = /*formInitials*/ ctx[5][2] + "")) set_data(t9, t9_value);
    			if (dirty & /*formInitials*/ 32 && t11_value !== (t11_value = /*formInitials*/ ctx[5][3] + "")) set_data(t11, t11_value);
    			if (dirty & /*formInitials*/ 32 && t13_value !== (t13_value = /*formInitials*/ ctx[5][4] + "")) set_data(t13, t13_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div5);
    			if (detaching) detach(t4);
    			if (detaching) detach(div11);
    		}
    	};
    }

    // (140:2) {:else}
    function create_else_block$7(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("None");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "None");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (136:2) {#if currentMatchday != null}
    function create_if_block$b(ctx) {
    	let t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*team*/ ctx[2]][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			t0 = text(t0_value);
    			t1 = text("%");
    		},
    		l(nodes) {
    			t0 = claim_text(nodes, t0_value);
    			t1 = claim_text(nodes, "%");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t0, anchor);
    			insert_hydration(target, t1, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data, team, currentMatchday*/ 7 && t0_value !== (t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*team*/ ctx[2]][/*currentMatchday*/ ctx[1]].formRating5 * 100).toFixed(1) + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(t1);
    		}
    	};
    }

    function create_fragment$l(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let if_block0 = /*formInitials*/ ctx[5] != undefined && create_if_block_1$5(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*currentMatchday*/ ctx[1] != null) return create_if_block$b;
    		return create_else_block$7;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div = element("div");
    			t1 = text("Current form:\r\n  ");
    			if_block1.c();
    			this.h();
    		},
    		l(nodes) {
    			if (if_block0) if_block0.l(nodes);
    			t0 = claim_space(nodes);
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t1 = claim_text(div_nodes, "Current form:\r\n  ");
    			if_block1.l(div_nodes);
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "current-form svelte-b4v5qq");
    		},
    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_hydration(target, t0, anchor);
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t1);
    			if_block1.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (/*formInitials*/ ctx[5] != undefined) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$5(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
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
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t0);
    			if (detaching) detach(div);
    			if_block1.d();
    		}
    	};
    }

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

    function instance$k($$self, $$props, $$invalidate) {
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

    	let formIcons, formStarTeams, formInitials;

    	function setFormValues() {
    		let sortedMatchdays = getSortedMatchdays(data, team);
    		let matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);
    		$$invalidate(3, formIcons = getFormIcons(data, team));
    		$$invalidate(4, formStarTeams = getFormStarTeams(data, team, matchdays));
    		$$invalidate(5, formInitials = getFormInitials(data, team, matchdays));
    	}

    	let { data, currentMatchday, team } = $$props;

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && setFormValues();
    		}
    	};

    	return [data, currentMatchday, team, formIcons, formStarTeams, formInitials];
    }

    class CurrentForm extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$k, create_fragment$l, safe_not_equal, { data: 0, currentMatchday: 1, team: 2 });
    	}
    }

    /* src\components\TableSnippet.svelte generated by Svelte v3.49.0 */

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    // (58:2) {#if tableSnippet != undefined}
    function create_if_block$a(ctx) {
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
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
    	}

    	let if_block = /*tableSnippet*/ ctx[3].teamTableIdx != 6 && create_if_block_1$4();

    	return {
    		c() {
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
    		l(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			children(div0).forEach(detach);
    			t0 = claim_space(nodes);
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div1 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div1).forEach(detach);
    			t1 = claim_space(div5_nodes);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t2 = claim_text(div2_nodes, "Team");
    			div2_nodes.forEach(detach);
    			t3 = claim_space(div5_nodes);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t4 = claim_text(div3_nodes, "GD");
    			div3_nodes.forEach(detach);
    			t5 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t6 = claim_text(div4_nodes, "Points");
    			div4_nodes.forEach(detach);
    			div5_nodes.forEach(detach);
    			t7 = claim_space(nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			t8 = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "divider");
    			attr(div1, "class", "table-element table-position column-title svelte-13u0ebo");
    			attr(div2, "class", "table-element table-team-name column-title svelte-13u0ebo");
    			attr(div3, "class", "table-element table-gd column-title svelte-13u0ebo");
    			attr(div4, "class", "table-element table-points column-title svelte-13u0ebo");
    			attr(div5, "class", "table-row svelte-13u0ebo");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div0, anchor);
    			insert_hydration(target, t0, anchor);
    			insert_hydration(target, div5, anchor);
    			append_hydration(div5, div1);
    			append_hydration(div5, t1);
    			append_hydration(div5, div2);
    			append_hydration(div2, t2);
    			append_hydration(div5, t3);
    			append_hydration(div5, div3);
    			append_hydration(div3, t4);
    			append_hydration(div5, t5);
    			append_hydration(div5, div4);
    			append_hydration(div4, t6);
    			insert_hydration(target, t7, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration(target, t8, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*hyphenatedTeam, tableSnippet, getAlias, switchTeam*/ 15) {
    				each_value = /*tableSnippet*/ ctx[3].rows;
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
    					if_block = create_if_block_1$4();
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t0);
    			if (detaching) detach(div5);
    			if (detaching) detach(t7);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t8);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (73:85) 
    function create_if_block_5(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true });
    			children(div).forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "id", "divider");
    			attr(div, "class", "svelte-13u0ebo");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (69:6) {#if i == 0}
    function create_if_block_3$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[10] != /*tableSnippet*/ ctx[3].teamTableIdx && create_if_block_4();

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (/*i*/ ctx[10] != /*tableSnippet*/ ctx[3].teamTableIdx) {
    				if (if_block) ; else {
    					if_block = create_if_block_4();
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (70:8) {#if i != tableSnippet.teamTableIdx}
    function create_if_block_4(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true });
    			children(div).forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "id", "divider");
    			attr(div, "class", "svelte-13u0ebo");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (109:6) {:else}
    function create_else_block$6(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*row*/ ctx[8].position + "";
    	let t0;
    	let t1;
    	let button;
    	let t2_value = /*getAlias*/ ctx[1](/*row*/ ctx[8].name) + "";
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

    	return {
    		c() {
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
    		l(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div0 = claim_element(div3_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach);
    			t1 = claim_space(div3_nodes);
    			button = claim_element(div3_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t2 = claim_text(button_nodes, t2_value);
    			button_nodes.forEach(detach);
    			t3 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t4 = claim_text(div1_nodes, t4_value);
    			div1_nodes.forEach(detach);
    			t5 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach);
    			div3_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "table-element table-position svelte-13u0ebo");
    			attr(button, "class", "table-element table-team-name svelte-13u0ebo");
    			attr(div1, "class", "table-element table-gd svelte-13u0ebo");
    			attr(div2, "class", "table-element table-points svelte-13u0ebo");
    			attr(div3, "class", "table-row svelte-13u0ebo");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div3, anchor);
    			append_hydration(div3, div0);
    			append_hydration(div0, t0);
    			append_hydration(div3, t1);
    			append_hydration(div3, button);
    			append_hydration(button, t2);
    			append_hydration(div3, t3);
    			append_hydration(div3, div1);
    			append_hydration(div1, t4);
    			append_hydration(div3, t5);
    			append_hydration(div3, div2);
    			append_hydration(div2, t6);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*tableSnippet*/ 8 && t0_value !== (t0_value = /*row*/ ctx[8].position + "")) set_data(t0, t0_value);
    			if (dirty & /*getAlias, tableSnippet*/ 10 && t2_value !== (t2_value = /*getAlias*/ ctx[1](/*row*/ ctx[8].name) + "")) set_data(t2, t2_value);
    			if (dirty & /*tableSnippet*/ 8 && t4_value !== (t4_value = /*row*/ ctx[8].gd + "")) set_data(t4, t4_value);
    			if (dirty & /*tableSnippet*/ 8 && t6_value !== (t6_value = /*row*/ ctx[8].points + "")) set_data(t6, t6_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div3);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (77:6) {#if i == tableSnippet.teamTableIdx}
    function create_if_block_2$3(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*row*/ ctx[8].position + "";
    	let t0;
    	let t1;
    	let a;
    	let t2_value = /*getAlias*/ ctx[1](/*row*/ ctx[8].name) + "";
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

    	return {
    		c() {
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
    		l(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			div0 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach);
    			t1 = claim_space(div3_nodes);
    			a = claim_element(div3_nodes, "A", { href: true, class: true, style: true });
    			var a_nodes = children(a);
    			t2 = claim_text(a_nodes, t2_value);
    			a_nodes.forEach(detach);
    			t3 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			t4 = claim_text(div1_nodes, t4_value);
    			div1_nodes.forEach(detach);
    			t5 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div2_nodes = children(div2);
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach);
    			div3_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "table-element table-position this-team svelte-13u0ebo");
    			set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			attr(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			attr(a, "class", "table-element table-team-name this-team svelte-13u0ebo");
    			set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			attr(div1, "class", "table-element table-gd this-team svelte-13u0ebo");
    			set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			attr(div2, "class", "table-element table-points this-team svelte-13u0ebo");
    			set_style(div2, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			attr(div3, "class", "table-row this-team svelte-13u0ebo");
    			set_style(div3, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div3, anchor);
    			append_hydration(div3, div0);
    			append_hydration(div0, t0);
    			append_hydration(div3, t1);
    			append_hydration(div3, a);
    			append_hydration(a, t2);
    			append_hydration(div3, t3);
    			append_hydration(div3, div1);
    			append_hydration(div1, t4);
    			append_hydration(div3, t5);
    			append_hydration(div3, div2);
    			append_hydration(div2, t6);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*tableSnippet*/ 8 && t0_value !== (t0_value = /*row*/ ctx[8].position + "")) set_data(t0, t0_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*getAlias, tableSnippet*/ 10 && t2_value !== (t2_value = /*getAlias*/ ctx[1](/*row*/ ctx[8].name) + "")) set_data(t2, t2_value);

    			if (dirty & /*hyphenatedTeam*/ 1 && a_href_value !== (a_href_value = "/" + /*hyphenatedTeam*/ ctx[0])) {
    				attr(a, "href", a_href_value);
    			}

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*tableSnippet*/ 8 && t4_value !== (t4_value = /*row*/ ctx[8].gd + "")) set_data(t4, t4_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*tableSnippet*/ 8 && t6_value !== (t6_value = /*row*/ ctx[8].points + "")) set_data(t6, t6_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div2, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div3, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div3);
    		}
    	};
    }

    // (67:4) {#each tableSnippet.rows as row, i}
    function create_each_block$5(ctx) {
    	let t;
    	let if_block1_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[10] == 0) return create_if_block_3$2;
    		if (/*i*/ ctx[10] - 1 != /*tableSnippet*/ ctx[3].teamTableIdx && /*i*/ ctx[10] != /*tableSnippet*/ ctx[3].teamTableIdx) return create_if_block_5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*i*/ ctx[10] == /*tableSnippet*/ ctx[3].teamTableIdx) return create_if_block_2$3;
    		return create_else_block$6;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if_block1.c();
    			if_block1_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block0) if_block0.l(nodes);
    			t = claim_space(nodes);
    			if_block1.l(nodes);
    			if_block1_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_hydration(target, t, anchor);
    			if_block1.m(target, anchor);
    			insert_hydration(target, if_block1_anchor, anchor);
    		},
    		p(ctx, dirty) {
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
    		d(detaching) {
    			if (if_block0) {
    				if_block0.d(detaching);
    			}

    			if (detaching) detach(t);
    			if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    		}
    	};
    }

    // (130:4) {#if tableSnippet.teamTableIdx != 6}
    function create_if_block_1$4(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true });
    			children(div).forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "id", "divider");
    			attr(div, "class", "svelte-13u0ebo");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$k(ctx) {
    	let div;
    	let if_block = /*tableSnippet*/ ctx[3] != undefined && create_if_block$a(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			if (if_block) if_block.l(div_nodes);
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "table-snippet svelte-13u0ebo");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (/*tableSnippet*/ ctx[3] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$a(ctx);
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
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
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

    function instance$j($$self, $$props, $$invalidate) {
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
    	let { data, hyphenatedTeam, team, getAlias, switchTeam } = $$props;

    	const click_handler = row => {
    		switchTeam(row.name.toLowerCase().replace(/ /g, '-'));
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(4, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('team' in $$props) $$invalidate(5, team = $$props.team);
    		if ('getAlias' in $$props) $$invalidate(1, getAlias = $$props.getAlias);
    		if ('switchTeam' in $$props) $$invalidate(2, switchTeam = $$props.switchTeam);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 32) {
    			team && buildTableSnippet();
    		}
    	};

    	return [hyphenatedTeam, getAlias, switchTeam, tableSnippet, data, team, click_handler];
    }

    class TableSnippet extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$j, create_fragment$k, safe_not_equal, {
    			data: 4,
    			hyphenatedTeam: 0,
    			team: 5,
    			getAlias: 1,
    			switchTeam: 2
    		});
    	}
    }

    /* src\components\next_game\SeasonComplete.svelte generated by Svelte v3.49.0 */

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

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = text("/");
    			t2 = text(t2_value);
    			t3 = text(" SEASON COMPLETE");
    			this.h();
    		},
    		l(nodes) {
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
    			h1_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(h1, "class", "next-game-title-text");
    			attr(div0, "class", "next-game-season-complete");
    			attr(div1, "class", "next-game-prediction");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			append_hydration(div0, h1);
    			append_hydration(h1, t0);
    			append_hydration(h1, t1);
    			append_hydration(h1, t2);
    			append_hydration(h1, t3);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*data*/ ctx[0]._id + "")) set_data(t0, t0_value);
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*data*/ ctx[0]._id + 1 + "")) set_data(t2, t2_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let { data } = $$props;

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	return [data];
    }

    class SeasonComplete extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$i, create_fragment$j, safe_not_equal, { data: 0 });
    	}
    }

    /* src\components\next_game\NextGameStats.svelte generated by Svelte v3.49.0 */

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (45:6) {:else}
    function create_else_block_2(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			children(div).forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "next-game-position svelte-1tklhzf");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (38:6) {#if showBadge}
    function create_if_block_2$2(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, style: true });
    			children(div).forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "next-game-logo opposition-badge svelte-1tklhzf");
    			set_style(div, "background-image", "url('" + /*data*/ ctx[0].logoURLs[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam] + "')");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data, team*/ 3) {
    				set_style(div, "background-image", "url('" + /*data*/ ctx[0].logoURLs[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam] + "')");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (64:10) {:else}
    function create_else_block_1$2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("None");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "None");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (59:10) {#if currentMatchday != null}
    function create_if_block_1$3(ctx) {
    	let b;
    	let t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*currentMatchday*/ ctx[2]].formRating5 * 100).toFixed(1) + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = text("%");
    		},
    		l(nodes) {
    			b = claim_element(nodes, "B", {});
    			var b_nodes = children(b);
    			t0 = claim_text(b_nodes, t0_value);
    			t1 = claim_text(b_nodes, "%");
    			b_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, b, anchor);
    			append_hydration(b, t0);
    			append_hydration(b, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data, team, currentMatchday*/ 7 && t0_value !== (t0_value = (/*data*/ ctx[0].form[/*data*/ ctx[0]._id][/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*currentMatchday*/ ctx[2]].formRating5 * 100).toFixed(1) + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(b);
    		}
    	};
    }

    // (95:6) {:else}
    function create_else_block$5(ctx) {
    	let div;
    	let t;

    	return {
    		c() {
    			div = element("div");
    			t = text("Previous Results");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "Previous Results");
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "next-game-item prev-results-title svelte-1tklhzf");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (91:6) {#if data.upcoming[team].prevMatches.length == 0}
    function create_if_block$9(ctx) {
    	let div;
    	let t;

    	return {
    		c() {
    			div = element("div");
    			t = text("No Previous Results");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "No Previous Results");
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "next-game-item prev-results-title no-prev-results svelte-1tklhzf");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (100:6) {#each data.upcoming[team].prevMatches as prevMatch}
    function create_each_block$4(ctx) {
    	let div6;
    	let div3;
    	let div0;
    	let t0_value = /*getAlias*/ ctx[4](/*prevMatch*/ ctx[9].homeTeam) + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*prevMatch*/ ctx[9].homeGoals + "";
    	let t2;
    	let t3;
    	let t4_value = /*prevMatch*/ ctx[9].awayGoals + "";
    	let t4;
    	let t5;
    	let div2;
    	let t6_value = /*getAlias*/ ctx[4](/*prevMatch*/ ctx[9].awayTeam) + "";
    	let t6;
    	let t7;
    	let div4;
    	let t8;
    	let div5;

    	let t9_value = new Date(/*prevMatch*/ ctx[9].date).toLocaleDateString("en-us", {
    		weekday: "long",
    		year: "numeric",
    		month: "short",
    		day: "numeric"
    	}) + "";

    	let t9;
    	let t10;
    	let div6_class_value;

    	return {
    		c() {
    			div6 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = text(" - ");
    			t4 = text(t4_value);
    			t5 = space();
    			div2 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			div4 = element("div");
    			t8 = space();
    			div5 = element("div");
    			t9 = text(t9_value);
    			t10 = space();
    			this.h();
    		},
    		l(nodes) {
    			div6 = claim_element(nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div3 = claim_element(div6_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div0 = claim_element(div3_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach);
    			t1 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			t3 = claim_text(div1_nodes, " - ");
    			t4 = claim_text(div1_nodes, t4_value);
    			div1_nodes.forEach(detach);
    			t5 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach);
    			div3_nodes.forEach(detach);
    			t7 = claim_space(div6_nodes);
    			div4 = claim_element(div6_nodes, "DIV", { style: true });
    			children(div4).forEach(detach);
    			t8 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t9 = claim_text(div5_nodes, t9_value);
    			div5_nodes.forEach(detach);
    			t10 = claim_space(div6_nodes);
    			div6_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "home-team svelte-1tklhzf");
    			attr(div1, "class", "score svelte-1tklhzf");
    			attr(div2, "class", "away-team svelte-1tklhzf");
    			attr(div3, "class", "past-result svelte-1tklhzf");
    			set_style(div4, "clear", "both");
    			attr(div5, "class", "past-result-date svelte-1tklhzf");
    			attr(div6, "class", div6_class_value = "next-game-item " + /*prevMatch*/ ctx[9].result + " svelte-1tklhzf");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div6, anchor);
    			append_hydration(div6, div3);
    			append_hydration(div3, div0);
    			append_hydration(div0, t0);
    			append_hydration(div3, t1);
    			append_hydration(div3, div1);
    			append_hydration(div1, t2);
    			append_hydration(div1, t3);
    			append_hydration(div1, t4);
    			append_hydration(div3, t5);
    			append_hydration(div3, div2);
    			append_hydration(div2, t6);
    			append_hydration(div6, t7);
    			append_hydration(div6, div4);
    			append_hydration(div6, t8);
    			append_hydration(div6, div5);
    			append_hydration(div5, t9);
    			append_hydration(div6, t10);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*getAlias, data, team*/ 19 && t0_value !== (t0_value = /*getAlias*/ ctx[4](/*prevMatch*/ ctx[9].homeTeam) + "")) set_data(t0, t0_value);
    			if (dirty & /*data, team*/ 3 && t2_value !== (t2_value = /*prevMatch*/ ctx[9].homeGoals + "")) set_data(t2, t2_value);
    			if (dirty & /*data, team*/ 3 && t4_value !== (t4_value = /*prevMatch*/ ctx[9].awayGoals + "")) set_data(t4, t4_value);
    			if (dirty & /*getAlias, data, team*/ 19 && t6_value !== (t6_value = /*getAlias*/ ctx[4](/*prevMatch*/ ctx[9].awayTeam) + "")) set_data(t6, t6_value);

    			if (dirty & /*data, team*/ 3 && t9_value !== (t9_value = new Date(/*prevMatch*/ ctx[9].date).toLocaleDateString("en-us", {
    				weekday: "long",
    				year: "numeric",
    				month: "short",
    				day: "numeric"
    			}) + "")) set_data(t9, t9_value);

    			if (dirty & /*data, team*/ 3 && div6_class_value !== (div6_class_value = "next-game-item " + /*prevMatch*/ ctx[9].result + " svelte-1tklhzf")) {
    				attr(div6, "class", div6_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div6);
    		}
    	};
    }

    function create_fragment$i(ctx) {
    	let div9;
    	let div0;
    	let h1;
    	let t0;
    	let button;
    	let t1_value = /*getAlias*/ ctx[4](/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam) + "";
    	let t1;
    	let t2;
    	let t3;

    	let t4_value = (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].atHome
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
    	let t8_value = ordinal$1(/*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id].position) + "";
    	let t8;
    	let t9;
    	let div3;
    	let t10;
    	let t11;
    	let div4;
    	let t12;
    	let br0;
    	let t13;
    	let a;
    	let b;
    	let t14_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.homeGoals) + "";
    	let t14;
    	let t15;
    	let t16_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.awayGoals) + "";
    	let t16;
    	let t17;
    	let br1;
    	let t18;
    	let div7;
    	let t19;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*showBadge*/ ctx[3]) return create_if_block_2$2;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*currentMatchday*/ ctx[2] != null) return create_if_block_1$3;
    		return create_else_block_1$2;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches.length == 0) return create_if_block$9;
    		return create_else_block$5;
    	}

    	let current_block_type_2 = select_block_type_2(ctx);
    	let if_block2 = current_block_type_2(ctx);
    	let each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div9 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Next Game: \r\n      ");
    			button = element("button");
    			t1 = text(t1_value);
    			t2 = text(" ");
    			t3 = text("\r\n      (");
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
    			t9 = space();
    			div3 = element("div");
    			t10 = text("Current form:\r\n          ");
    			if_block1.c();
    			t11 = space();
    			div4 = element("div");
    			t12 = text("Score prediction\r\n          ");
    			br0 = element("br");
    			t13 = space();
    			a = element("a");
    			b = element("b");
    			t14 = text(t14_value);
    			t15 = text(" - ");
    			t16 = text(t16_value);
    			t17 = space();
    			br1 = element("br");
    			t18 = space();
    			div7 = element("div");
    			if_block2.c();
    			t19 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l(nodes) {
    			div9 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div9_nodes = children(div9);
    			div0 = claim_element(div9_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true, style: true });
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Next Game: \r\n      ");
    			button = claim_element(h1_nodes, "BUTTON", { style: true, class: true });
    			var button_nodes = children(button);
    			t1 = claim_text(button_nodes, t1_value);
    			t2 = claim_text(button_nodes, " ");
    			button_nodes.forEach(detach);
    			t3 = claim_text(h1_nodes, "\r\n      (");
    			t4 = claim_text(h1_nodes, t4_value);
    			t5 = claim_text(h1_nodes, ")");
    			h1_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
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
    			div1_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			t9 = claim_space(div5_nodes);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t10 = claim_text(div3_nodes, "Current form:\r\n          ");
    			if_block1.l(div3_nodes);
    			div3_nodes.forEach(detach);
    			t11 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t12 = claim_text(div4_nodes, "Score prediction\r\n          ");
    			br0 = claim_element(div4_nodes, "BR", {});
    			t13 = claim_space(div4_nodes);
    			a = claim_element(div4_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			b = claim_element(a_nodes, "B", {});
    			var b_nodes = children(b);
    			t14 = claim_text(b_nodes, t14_value);
    			t15 = claim_text(b_nodes, " - ");
    			t16 = claim_text(b_nodes, t16_value);
    			b_nodes.forEach(detach);
    			a_nodes.forEach(detach);
    			t17 = claim_space(div4_nodes);
    			br1 = claim_element(div4_nodes, "BR", {});
    			div4_nodes.forEach(detach);
    			div5_nodes.forEach(detach);
    			div6_nodes.forEach(detach);
    			t18 = claim_space(div8_nodes);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			if_block2.l(div7_nodes);
    			t19 = claim_space(div7_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div7_nodes);
    			}

    			div7_nodes.forEach(detach);
    			div8_nodes.forEach(detach);
    			div9_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			set_style(button, "color", "inherit");
    			attr(button, "class", "svelte-1tklhzf");
    			attr(h1, "class", "next-game-title-text svelte-1tklhzf");
    			set_style(h1, "color", "var(--" + /*oppTeam*/ ctx[6] + "-secondary)");
    			attr(div0, "class", "next-game-title svelte-1tklhzf");
    			set_style(div0, "background-color", "var(--" + /*oppTeam*/ ctx[6] + ")");
    			attr(div1, "class", "next-game-position svelte-1tklhzf");
    			attr(div2, "class", "next-game-item svelte-1tklhzf");
    			attr(div3, "class", "next-game-item svelte-1tklhzf");
    			attr(a, "class", "predictions-link svelte-1tklhzf");
    			attr(a, "href", "/predictions");
    			attr(div4, "class", "next-game-item svelte-1tklhzf");
    			attr(div5, "class", "predictions");
    			attr(div6, "class", "predictions-and-logo svelte-1tklhzf");
    			attr(div7, "class", "past-results svelte-1tklhzf");
    			attr(div8, "class", "next-game-values svelte-1tklhzf");
    			attr(div9, "class", "next-game-prediction svelte-1tklhzf");
    			set_style(div9, "border", "6px solid var(--" + /*oppTeam*/ ctx[6] + ")");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div9, anchor);
    			append_hydration(div9, div0);
    			append_hydration(div0, h1);
    			append_hydration(h1, t0);
    			append_hydration(h1, button);
    			append_hydration(button, t1);
    			append_hydration(button, t2);
    			append_hydration(h1, t3);
    			append_hydration(h1, t4);
    			append_hydration(h1, t5);
    			append_hydration(div9, t6);
    			append_hydration(div9, div8);
    			append_hydration(div8, div6);
    			if_block0.m(div6, null);
    			append_hydration(div6, t7);
    			append_hydration(div6, div5);
    			append_hydration(div5, div2);
    			append_hydration(div2, div1);
    			append_hydration(div1, t8);
    			append_hydration(div5, t9);
    			append_hydration(div5, div3);
    			append_hydration(div3, t10);
    			if_block1.m(div3, null);
    			append_hydration(div5, t11);
    			append_hydration(div5, div4);
    			append_hydration(div4, t12);
    			append_hydration(div4, br0);
    			append_hydration(div4, t13);
    			append_hydration(div4, a);
    			append_hydration(a, b);
    			append_hydration(b, t14);
    			append_hydration(b, t15);
    			append_hydration(b, t16);
    			append_hydration(div4, t17);
    			append_hydration(div4, br1);
    			append_hydration(div8, t18);
    			append_hydration(div8, div7);
    			if_block2.m(div7, null);
    			append_hydration(div7, t19);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div7, null);
    			}

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*getAlias, data, team*/ 19 && t1_value !== (t1_value = /*getAlias*/ ctx[4](/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam) + "")) set_data(t1, t1_value);

    			if (dirty & /*data, team*/ 3 && t4_value !== (t4_value = (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].atHome
    			? "Home"
    			: "Away") + "")) set_data(t4, t4_value);

    			if (dirty & /*oppTeam*/ 64) {
    				set_style(h1, "color", "var(--" + /*oppTeam*/ ctx[6] + "-secondary)");
    			}

    			if (dirty & /*oppTeam*/ 64) {
    				set_style(div0, "background-color", "var(--" + /*oppTeam*/ ctx[6] + ")");
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div6, t7);
    				}
    			}

    			if (dirty & /*data, team*/ 3 && t8_value !== (t8_value = ordinal$1(/*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id].position) + "")) set_data(t8, t8_value);

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div3, null);
    				}
    			}

    			if (dirty & /*data, team*/ 3 && t14_value !== (t14_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.homeGoals) + "")) set_data(t14, t14_value);
    			if (dirty & /*data, team*/ 3 && t16_value !== (t16_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.awayGoals) + "")) set_data(t16, t16_value);

    			if (current_block_type_2 !== (current_block_type_2 = select_block_type_2(ctx))) {
    				if_block2.d(1);
    				if_block2 = current_block_type_2(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div7, t19);
    				}
    			}

    			if (dirty & /*data, team, Date, getAlias*/ 19) {
    				each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches;
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

    			if (dirty & /*oppTeam*/ 64) {
    				set_style(div9, "border", "6px solid var(--" + /*oppTeam*/ ctx[6] + ")");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div9);
    			if_block0.d();
    			if_block1.d();
    			if_block2.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function ordinal$1(n) {
    	let ord = [,"st", "nd", "rd"];
    	let a = n % 100;
    	return n + (ord[a > 20 ? a % 10 : a] || "th");
    }

    function instance$h($$self, $$props, $$invalidate) {
    	function setOppTeam() {
    		if (data.upcoming[team].nextTeam != null) {
    			$$invalidate(6, oppTeam = data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, "-"));
    		}
    	}

    	let oppTeam;
    	let { data, team, currentMatchday, showBadge, getAlias, switchTeam } = $$props;

    	const click_handler = () => {
    		switchTeam(data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, '-'));
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('currentMatchday' in $$props) $$invalidate(2, currentMatchday = $$props.currentMatchday);
    		if ('showBadge' in $$props) $$invalidate(3, showBadge = $$props.showBadge);
    		if ('getAlias' in $$props) $$invalidate(4, getAlias = $$props.getAlias);
    		if ('switchTeam' in $$props) $$invalidate(5, switchTeam = $$props.switchTeam);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 2) {
    			team && setOppTeam();
    		}
    	};

    	return [
    		data,
    		team,
    		currentMatchday,
    		showBadge,
    		getAlias,
    		switchTeam,
    		oppTeam,
    		click_handler
    	];
    }

    class NextGameStats extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$h, create_fragment$i, safe_not_equal, {
    			data: 0,
    			team: 1,
    			currentMatchday: 2,
    			showBadge: 3,
    			getAlias: 4,
    			switchTeam: 5
    		});
    	}
    }

    /* src\components\next_game\NextGame.svelte generated by Svelte v3.49.0 */

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

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
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
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (11:2) {:else}
    function create_else_block$4(ctx) {
    	let nextgamestats;
    	let current;

    	nextgamestats = new NextGameStats({
    			props: {
    				data: /*data*/ ctx[0],
    				currentMatchday: /*currentMatchday*/ ctx[1],
    				team: /*team*/ ctx[2],
    				showBadge: /*showBadge*/ ctx[3],
    				getAlias: /*getAlias*/ ctx[4],
    				switchTeam: /*switchTeam*/ ctx[5]
    			}
    		});

    	return {
    		c() {
    			create_component(nextgamestats.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(nextgamestats.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(nextgamestats, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const nextgamestats_changes = {};
    			if (dirty & /*data*/ 1) nextgamestats_changes.data = /*data*/ ctx[0];
    			if (dirty & /*currentMatchday*/ 2) nextgamestats_changes.currentMatchday = /*currentMatchday*/ ctx[1];
    			if (dirty & /*team*/ 4) nextgamestats_changes.team = /*team*/ ctx[2];
    			if (dirty & /*showBadge*/ 8) nextgamestats_changes.showBadge = /*showBadge*/ ctx[3];
    			if (dirty & /*getAlias*/ 16) nextgamestats_changes.getAlias = /*getAlias*/ ctx[4];
    			if (dirty & /*switchTeam*/ 32) nextgamestats_changes.switchTeam = /*switchTeam*/ ctx[5];
    			nextgamestats.$set(nextgamestats_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(nextgamestats.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(nextgamestats.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(nextgamestats, detaching);
    		}
    	};
    }

    // (9:2) {#if data.upcoming[team].nextTeam == null}
    function create_if_block_1$2(ctx) {
    	let seasoncomplete;
    	let current;
    	seasoncomplete = new SeasonComplete({ props: { data: /*data*/ ctx[0] } });

    	return {
    		c() {
    			create_component(seasoncomplete.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(seasoncomplete.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(seasoncomplete, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const seasoncomplete_changes = {};
    			if (dirty & /*data*/ 1) seasoncomplete_changes.data = /*data*/ ctx[0];
    			seasoncomplete.$set(seasoncomplete_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(seasoncomplete.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(seasoncomplete.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(seasoncomplete, detaching);
    		}
    	};
    }

    function create_fragment$h(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*data*/ ctx[0] != undefined && create_if_block$8(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
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
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let { data, currentMatchday, team, showBadge, getAlias, switchTeam } = $$props;

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('showBadge' in $$props) $$invalidate(3, showBadge = $$props.showBadge);
    		if ('getAlias' in $$props) $$invalidate(4, getAlias = $$props.getAlias);
    		if ('switchTeam' in $$props) $$invalidate(5, switchTeam = $$props.switchTeam);
    	};

    	return [data, currentMatchday, team, showBadge, getAlias, switchTeam];
    }

    class NextGame extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$g, create_fragment$h, safe_not_equal, {
    			data: 0,
    			currentMatchday: 1,
    			team: 2,
    			showBadge: 3,
    			getAlias: 4,
    			switchTeam: 5
    		});
    	}
    }

    /* src\components\SeasonStats.svelte generated by Svelte v3.49.0 */

    function create_if_block$7(ctx) {
    	let div12;
    	let div3;
    	let div1;
    	let t0_value = /*seasonStats*/ ctx[1][/*team*/ ctx[0]].xG.toFixed(2) + "";
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
    	let t6_value = /*seasonStats*/ ctx[1][/*team*/ ctx[0]].xC.toFixed(2) + "";
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
    	let t12_value = /*seasonStats*/ ctx[1][/*team*/ ctx[0]].cleanSheetRatio.toFixed(2) + "";
    	let t12;
    	let t13;
    	let div8;
    	let t14_value = /*rank*/ ctx[5].cleanSheetRatio + "";
    	let t14;
    	let div8_class_value;
    	let t15;
    	let div10;
    	let t16;

    	return {
    		c() {
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
    		l(nodes) {
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
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			t3 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, "goals per game");
    			div2_nodes.forEach(detach);
    			div3_nodes.forEach(detach);
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
    			div4_nodes.forEach(detach);
    			div5_nodes.forEach(detach);
    			t9 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t10 = claim_text(div6_nodes, "conceded per game");
    			div6_nodes.forEach(detach);
    			div7_nodes.forEach(detach);
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
    			div8_nodes.forEach(detach);
    			div9_nodes.forEach(detach);
    			t15 = claim_space(div11_nodes);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			t16 = claim_text(div10_nodes, "clean sheets");
    			div10_nodes.forEach(detach);
    			div11_nodes.forEach(detach);
    			div12_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", div0_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xG + " svelte-jyia24");
    			attr(div0, "id", "ssp1");
    			attr(div1, "class", "season-stat-value svelte-jyia24");
    			attr(div2, "class", "season-stat-text svelte-jyia24");
    			attr(div3, "class", "season-stat goals-per-game svelte-jyia24");
    			attr(div4, "class", div4_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xC + " svelte-jyia24");
    			attr(div4, "id", "ssp2");
    			attr(div5, "class", "season-stat-value svelte-jyia24");
    			attr(div6, "class", "season-stat-text svelte-jyia24");
    			attr(div7, "class", "season-stat conceded-per-game svelte-jyia24");
    			attr(div8, "class", div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].cleanSheetRatio + " svelte-jyia24");
    			attr(div8, "id", "ssp3");
    			attr(div9, "class", "season-stat-value svelte-jyia24");
    			attr(div10, "class", "season-stat-text svelte-jyia24");
    			attr(div11, "class", "season-stat clean-sheet-ratio svelte-jyia24");
    			attr(div12, "class", "season-stats svelte-jyia24");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div12, anchor);
    			append_hydration(div12, div3);
    			append_hydration(div3, div1);
    			append_hydration(div1, t0);
    			append_hydration(div1, t1);
    			append_hydration(div1, div0);
    			append_hydration(div0, t2);
    			/*div0_binding*/ ctx[7](div0);
    			append_hydration(div3, t3);
    			append_hydration(div3, div2);
    			append_hydration(div2, t4);
    			append_hydration(div12, t5);
    			append_hydration(div12, div7);
    			append_hydration(div7, div5);
    			append_hydration(div5, t6);
    			append_hydration(div5, t7);
    			append_hydration(div5, div4);
    			append_hydration(div4, t8);
    			/*div4_binding*/ ctx[8](div4);
    			append_hydration(div7, t9);
    			append_hydration(div7, div6);
    			append_hydration(div6, t10);
    			append_hydration(div12, t11);
    			append_hydration(div12, div11);
    			append_hydration(div11, div9);
    			append_hydration(div9, t12);
    			append_hydration(div9, t13);
    			append_hydration(div9, div8);
    			append_hydration(div8, t14);
    			/*div8_binding*/ ctx[9](div8);
    			append_hydration(div11, t15);
    			append_hydration(div11, div10);
    			append_hydration(div10, t16);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*seasonStats, team*/ 3 && t0_value !== (t0_value = /*seasonStats*/ ctx[1][/*team*/ ctx[0]].xG.toFixed(2) + "")) set_data(t0, t0_value);
    			if (dirty & /*rank*/ 32 && t2_value !== (t2_value = /*rank*/ ctx[5].xG + "")) set_data(t2, t2_value);

    			if (dirty & /*rank*/ 32 && div0_class_value !== (div0_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xG + " svelte-jyia24")) {
    				attr(div0, "class", div0_class_value);
    			}

    			if (dirty & /*seasonStats, team*/ 3 && t6_value !== (t6_value = /*seasonStats*/ ctx[1][/*team*/ ctx[0]].xC.toFixed(2) + "")) set_data(t6, t6_value);
    			if (dirty & /*rank*/ 32 && t8_value !== (t8_value = /*rank*/ ctx[5].xC + "")) set_data(t8, t8_value);

    			if (dirty & /*rank*/ 32 && div4_class_value !== (div4_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].xC + " svelte-jyia24")) {
    				attr(div4, "class", div4_class_value);
    			}

    			if (dirty & /*seasonStats, team*/ 3 && t12_value !== (t12_value = /*seasonStats*/ ctx[1][/*team*/ ctx[0]].cleanSheetRatio.toFixed(2) + "")) set_data(t12, t12_value);
    			if (dirty & /*rank*/ 32 && t14_value !== (t14_value = /*rank*/ ctx[5].cleanSheetRatio + "")) set_data(t14, t14_value);

    			if (dirty & /*rank*/ 32 && div8_class_value !== (div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[5].cleanSheetRatio + " svelte-jyia24")) {
    				attr(div8, "class", div8_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div12);
    			/*div0_binding*/ ctx[7](null);
    			/*div4_binding*/ ctx[8](null);
    			/*div8_binding*/ ctx[9](null);
    		}
    	};
    }

    function create_fragment$g(ctx) {
    	let if_block_anchor;
    	let if_block = /*seasonStats*/ ctx[1] != undefined && create_if_block$7(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (/*seasonStats*/ ctx[1] != undefined) {
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
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
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

    function instance$f($$self, $$props, $$invalidate) {
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
    		$$invalidate(1, seasonStats = buildSeasonStats(data));
    		setStatsValues(seasonStats, team);
    		setup = true;
    	});

    	let { data, team } = $$props;

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

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 1) {
    			team && refreshStatsValues();
    		}
    	};

    	return [
    		team,
    		seasonStats,
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

    class SeasonStats extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$f, create_fragment$g, safe_not_equal, { data: 6, team: 0 });
    	}
    }

    /* src\components\TeamsFooter.svelte generated by Svelte v3.49.0 */

    function create_if_block$6(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;

    	return {
    		c() {
    			div = element("div");
    			t0 = text("Last updated: ");
    			t1 = text(/*lastUpdated*/ ctx[0]);
    			t2 = text(" UTC");
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, "Last updated: ");
    			t1 = claim_text(div_nodes, /*lastUpdated*/ ctx[0]);
    			t2 = claim_text(div_nodes, " UTC");
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "last-updated svelte-qr69iz");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t0);
    			append_hydration(div, t1);
    			append_hydration(div, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*lastUpdated*/ 1) set_data(t1, /*lastUpdated*/ ctx[0]);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$f(ctx) {
    	let div9;
    	let a0;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let t1;
    	let t2;
    	let div8;
    	let t3;
    	let div4;
    	let div1;
    	let t4;
    	let a1;
    	let t5;
    	let t6;
    	let div2;
    	let t7;
    	let a2;
    	let t8;
    	let t9;
    	let div3;
    	let t10;
    	let a3;
    	let t11;
    	let t12;
    	let t13;
    	let div7;
    	let div5;
    	let t14;
    	let t15;
    	let div6;
    	let t16;
    	let if_block = /*lastUpdated*/ ctx[0] != null && create_if_block$6(ctx);

    	return {
    		c() {
    			div9 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			t1 = text("Support Me");
    			t2 = space();
    			div8 = element("div");
    			if (if_block) if_block.c();
    			t3 = space();
    			div4 = element("div");
    			div1 = element("div");
    			t4 = text("Data provided by\r\n        ");
    			a1 = element("a");
    			t5 = text("football-data.org");
    			t6 = space();
    			div2 = element("div");
    			t7 = text("Graphs created using\r\n        ");
    			a2 = element("a");
    			t8 = text("Plotly");
    			t9 = space();
    			div3 = element("div");
    			t10 = text("Font made from\r\n        ");
    			a3 = element("a");
    			t11 = text("oNline Web Fonts");
    			t12 = text("\r\n        is licensed by CC BY 3.0");
    			t13 = space();
    			div7 = element("div");
    			div5 = element("div");
    			t14 = text("Created by Tom Draper");
    			t15 = space();
    			div6 = element("div");
    			t16 = text("v2.0");
    			this.h();
    		},
    		l(nodes) {
    			div9 = claim_element(nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			a0 = claim_element(div9_nodes, "A", { class: true, href: true, target: true });
    			var a0_nodes = children(a0);
    			img = claim_element(a0_nodes, "IMG", { class: true, src: true, alt: true });
    			t0 = claim_space(a0_nodes);
    			div0 = claim_element(a0_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t1 = claim_text(div0_nodes, "Support Me");
    			div0_nodes.forEach(detach);
    			a0_nodes.forEach(detach);
    			t2 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			if (if_block) if_block.l(div8_nodes);
    			t3 = claim_space(div8_nodes);
    			div4 = claim_element(div8_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t4 = claim_text(div1_nodes, "Data provided by\r\n        ");
    			a1 = claim_element(div1_nodes, "A", { class: true, href: true });
    			var a1_nodes = children(a1);
    			t5 = claim_text(a1_nodes, "football-data.org");
    			a1_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			t6 = claim_space(div4_nodes);
    			div2 = claim_element(div4_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t7 = claim_text(div2_nodes, "Graphs created using\r\n        ");
    			a2 = claim_element(div2_nodes, "A", { class: true, href: true });
    			var a2_nodes = children(a2);
    			t8 = claim_text(a2_nodes, "Plotly");
    			a2_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			t9 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t10 = claim_text(div3_nodes, "Font made from\r\n        ");
    			a3 = claim_element(div3_nodes, "A", { class: true, href: true });
    			var a3_nodes = children(a3);
    			t11 = claim_text(a3_nodes, "oNline Web Fonts");
    			a3_nodes.forEach(detach);
    			t12 = claim_text(div3_nodes, "\r\n        is licensed by CC BY 3.0");
    			div3_nodes.forEach(detach);
    			div4_nodes.forEach(detach);
    			t13 = claim_space(div8_nodes);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div5 = claim_element(div7_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t14 = claim_text(div5_nodes, "Created by Tom Draper");
    			div5_nodes.forEach(detach);
    			t15 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t16 = claim_text(div6_nodes, "v2.0");
    			div6_nodes.forEach(detach);
    			div7_nodes.forEach(detach);
    			div8_nodes.forEach(detach);
    			div9_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(img, "class", "ko-fi-img svelte-qr69iz");
    			if (!src_url_equal(img.src, img_src_value = "img/kofi.png")) attr(img, "src", img_src_value);
    			attr(img, "alt", "");
    			attr(div0, "class", "ko-fi-text svelte-qr69iz");
    			attr(a0, "class", "ko-fi svelte-qr69iz");
    			attr(a0, "href", "https://ko-fi.com/C0C069FOI");
    			attr(a0, "target", "_blank");
    			attr(a1, "class", "footer-text-colour underline");
    			attr(a1, "href", "https://www.football-data.org/");
    			attr(div1, "class", "footer-detail footer-text-colour svelte-qr69iz");
    			attr(a2, "class", "footer-text-colour underline");
    			attr(a2, "href", "https://plotly.com/");
    			attr(div2, "class", "footer-detail footer-text-colour svelte-qr69iz");
    			attr(a3, "class", "footer-text-colour");
    			attr(a3, "href", "http://www.onlinewebfonts.com");
    			attr(div3, "class", "footer-detail footer-text-colour svelte-qr69iz");
    			attr(div4, "class", "footer-details svelte-qr69iz");
    			attr(div5, "class", "created-by footer-text-colour svelte-qr69iz");
    			attr(div6, "class", "version footer-text-colour svelte-qr69iz");
    			attr(div7, "class", "footer-bottom");
    			attr(div8, "class", "teams-footer-bottom svelte-qr69iz");
    			attr(div9, "class", "teams-footer footer-text-colour svelte-qr69iz");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div9, anchor);
    			append_hydration(div9, a0);
    			append_hydration(a0, img);
    			append_hydration(a0, t0);
    			append_hydration(a0, div0);
    			append_hydration(div0, t1);
    			append_hydration(div9, t2);
    			append_hydration(div9, div8);
    			if (if_block) if_block.m(div8, null);
    			append_hydration(div8, t3);
    			append_hydration(div8, div4);
    			append_hydration(div4, div1);
    			append_hydration(div1, t4);
    			append_hydration(div1, a1);
    			append_hydration(a1, t5);
    			append_hydration(div4, t6);
    			append_hydration(div4, div2);
    			append_hydration(div2, t7);
    			append_hydration(div2, a2);
    			append_hydration(a2, t8);
    			append_hydration(div4, t9);
    			append_hydration(div4, div3);
    			append_hydration(div3, t10);
    			append_hydration(div3, a3);
    			append_hydration(a3, t11);
    			append_hydration(div3, t12);
    			append_hydration(div8, t13);
    			append_hydration(div8, div7);
    			append_hydration(div7, div5);
    			append_hydration(div5, t14);
    			append_hydration(div7, t15);
    			append_hydration(div7, div6);
    			append_hydration(div6, t16);
    		},
    		p(ctx, [dirty]) {
    			if (/*lastUpdated*/ ctx[0] != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					if_block.m(div8, t3);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div9);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { lastUpdated } = $$props;

    	$$self.$$set = $$props => {
    		if ('lastUpdated' in $$props) $$invalidate(0, lastUpdated = $$props.lastUpdated);
    	};

    	return [lastUpdated];
    }

    class TeamsFooter extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$e, create_fragment$f, safe_not_equal, { lastUpdated: 0 });
    	}
    }

    /* src\components\Fixtures.svelte generated by Svelte v3.49.0 */

    function create_fragment$e(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[3](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			/*div0_binding*/ ctx[3](null);
    		}
    	};
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

    function instance$d($$self, $$props, $$invalidate) {
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

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}
    	};

    	return [plotDiv, data, team, div0_binding];
    }

    class Fixtures extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$d, create_fragment$e, safe_not_equal, { data: 1, team: 2 });
    	}
    }

    /* src\components\FormOverTime.svelte generated by Svelte v3.49.0 */

    function create_fragment$d(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[4](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			/*div0_binding*/ ctx[4](null);
    		}
    	};
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

    function instance$c($$self, $$props, $$invalidate) {
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
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, div0_binding];
    }

    class FormOverTime extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$c, create_fragment$d, safe_not_equal, { data: 1, team: 2, playedMatchdays: 3 });
    	}
    }

    /* src\components\PositionOverTime.svelte generated by Svelte v3.49.0 */

    function create_fragment$c(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[4](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			/*div0_binding*/ ctx[4](null);
    		}
    	};
    }

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

    function instance$b($$self, $$props, $$invalidate) {
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
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, div0_binding];
    }

    class PositionOverTime extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$b, create_fragment$c, safe_not_equal, { data: 1, team: 2, playedMatchdays: 3 });
    	}
    }

    /* src\components\goals_scored_and_conceded\GoalsScoredAndConceded.svelte generated by Svelte v3.49.0 */

    function create_fragment$b(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[4](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			/*div0_binding*/ ctx[4](null);
    		}
    	};
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

    function instance$a($$self, $$props, $$invalidate) {
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
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, div0_binding];
    }

    class GoalsScoredAndConceded extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$a, create_fragment$b, safe_not_equal, { data: 1, team: 2, playedMatchdays: 3 });
    	}
    }

    /* src\components\goals_scored_and_conceded\CleanSheets.svelte generated by Svelte v3.49.0 */

    function create_fragment$a(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[4](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			/*div0_binding*/ ctx[4](null);
    		}
    	};
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

    function instance$9($$self, $$props, $$invalidate) {
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
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && refreshPlot();
    		}
    	};

    	return [plotDiv, data, team, playedMatchdays, div0_binding];
    }

    class CleanSheets extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$9, create_fragment$a, safe_not_equal, { data: 1, team: 2, playedMatchdays: 3 });
    	}
    }

    /* src\components\goals_per_game\GoalsScoredFreq.svelte generated by Svelte v3.49.0 */

    function create_fragment$9(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[6](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			/*div0_binding*/ ctx[6](null);
    		}
    	};
    }

    function instance$8($$self, $$props, $$invalidate) {
    	function buildPlotData() {
    		let xLabels = getXLabels();

    		let plotData = {
    			data: getScoredBars(),
    			layout: {
    				title: false,
    				autosize: true,
    				margin: { r: 0, l: 50, t: 15, b: 40, pad: 5 },
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
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 2) {
    			team && refreshPlot();
    		}
    	};

    	return [
    		plotDiv,
    		team,
    		getScoredBars,
    		getScoredTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		div0_binding
    	];
    }

    class GoalsScoredFreq extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$8, create_fragment$9, safe_not_equal, {
    			team: 1,
    			getScoredBars: 2,
    			getScoredTeamBars: 3,
    			getXLabels: 4,
    			getYAxisLayout: 5
    		});
    	}
    }

    /* src\components\goals_per_game\GoalsConcededFreq.svelte generated by Svelte v3.49.0 */

    function create_fragment$8(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[6](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			/*div0_binding*/ ctx[6](null);
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	function buildPlotData() {
    		let xLabels = getXLabels();

    		let graphData = {
    			data: getConcededBars(),
    			layout: {
    				title: false,
    				autosize: true,
    				margin: { r: 0, l: 50, t: 15, b: 40, pad: 5 },
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
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 2) {
    			team && refreshPlot();
    		}
    	};

    	return [
    		plotDiv,
    		team,
    		getConcededBars,
    		getConcededTeamBars,
    		getXLabels,
    		getYAxisLayout,
    		div0_binding
    	];
    }

    class GoalsConcededFreq extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$7, create_fragment$8, safe_not_equal, {
    			team: 1,
    			getConcededBars: 2,
    			getConcededTeamBars: 3,
    			getXLabels: 4,
    			getYAxisLayout: 5
    		});
    	}
    }

    /* src\components\goals_per_game\GoalsPerGame.svelte generated by Svelte v3.49.0 */

    function create_if_block$5(ctx) {
    	let div0;
    	let goalsscoredfreq;
    	let t;
    	let div1;
    	let goalsconcededfreq;
    	let current;

    	goalsscoredfreq = new GoalsScoredFreq({
    			props: {
    				team: /*team*/ ctx[0],
    				getScoredBars: /*getScoredBars*/ ctx[2],
    				getScoredTeamBars: /*getScoredTeamBars*/ ctx[4],
    				getXLabels: /*getXLabels*/ ctx[6],
    				getYAxisLayout: /*getYAxisLayout*/ ctx[7]
    			}
    		});

    	goalsconcededfreq = new GoalsConcededFreq({
    			props: {
    				team: /*team*/ ctx[0],
    				getConcededBars: /*getConcededBars*/ ctx[3],
    				getConcededTeamBars: /*getConcededTeamBars*/ ctx[5],
    				getXLabels: /*getXLabels*/ ctx[6],
    				getYAxisLayout: /*getYAxisLayout*/ ctx[7]
    			}
    		});

    	return {
    		c() {
    			div0 = element("div");
    			create_component(goalsscoredfreq.$$.fragment);
    			t = space();
    			div1 = element("div");
    			create_component(goalsconcededfreq.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(goalsscoredfreq.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach);
    			t = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			claim_component(goalsconcededfreq.$$.fragment, div1_nodes);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "graph freq-graph mini-graph");
    			attr(div1, "class", "graph freq-graph mini-graphh");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div0, anchor);
    			mount_component(goalsscoredfreq, div0, null);
    			insert_hydration(target, t, anchor);
    			insert_hydration(target, div1, anchor);
    			mount_component(goalsconcededfreq, div1, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const goalsscoredfreq_changes = {};
    			if (dirty & /*team*/ 1) goalsscoredfreq_changes.team = /*team*/ ctx[0];
    			goalsscoredfreq.$set(goalsscoredfreq_changes);
    			const goalsconcededfreq_changes = {};
    			if (dirty & /*team*/ 1) goalsconcededfreq_changes.team = /*team*/ ctx[0];
    			goalsconcededfreq.$set(goalsconcededfreq_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(goalsscoredfreq.$$.fragment, local);
    			transition_in(goalsconcededfreq.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(goalsscoredfreq.$$.fragment, local);
    			transition_out(goalsconcededfreq.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			destroy_component(goalsscoredfreq);
    			if (detaching) detach(t);
    			if (detaching) detach(div1);
    			destroy_component(goalsconcededfreq);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let div;
    	let current;
    	let if_block = /*setup*/ ctx[1] && create_if_block$5(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			if (if_block) if_block.l(div_nodes);
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "two-graphs");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*setup*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*setup*/ 2) {
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
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
    }

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
    		opacity: 0.6
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

    function convertToPercentage(freq) {
    	let totalFreq = valueSum(freq);

    	for (let goals in freq) {
    		freq[goals] /= totalFreq;
    	}
    }

    function convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq) {
    	convertToPercentage(goalFreq);
    	convertToPercentage(teamScoredFreq);
    	convertToPercentage(teamConcededFreq);
    }

    function instance$6($$self, $$props, $$invalidate) {
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
    			convertToPercentage(teamScoredFreq);
    			convertToPercentage(teamConcededFreq);
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
    		$$invalidate(1, setup = true);
    	});

    	let { data, team } = $$props;

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(8, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 1) {
    			team && refreshTeamData();
    		}
    	};

    	return [
    		team,
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

    class GoalsPerGame extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$7, safe_not_equal, { data: 8, team: 0 });
    	}
    }

    /* src\components\Spider.svelte generated by Svelte v3.49.0 */

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	return child_ctx;
    }

    // (576:6) {#if _team != team}
    function create_if_block$4(ctx) {
    	let button;
    	let t_value = /*getAlias*/ ctx[2](/*_team*/ ctx[30]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(button, "class", "spider-opp-team-btn svelte-1gpl4ff");
    		},
    		m(target, anchor) {
    			insert_hydration(target, button, anchor);
    			append_hydration(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*getAlias, data*/ 5 && t_value !== (t_value = /*getAlias*/ ctx[2](/*_team*/ ctx[30]) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (575:4) {#each data.teamNames as _team}
    function create_each_block$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*_team*/ ctx[30] != /*team*/ ctx[1] && create_if_block$4(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (/*_team*/ ctx[30] != /*team*/ ctx[1]) {
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
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t;
    	let div4;
    	let div3;
    	let each_value = /*data*/ ctx[0].teamNames;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	return {
    		c() {
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
    		l(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			t = claim_space(nodes);
    			div4 = claim_element(nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true, id: true });
    			var div3_nodes = children(div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div3_nodes);
    			}

    			div3_nodes.forEach(detach);
    			div4_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "plotDiv");
    			attr(div1, "id", "plotly");
    			attr(div2, "class", "spider-chart svelte-1gpl4ff");
    			attr(div3, "class", "spider-opp-team-btns svelte-1gpl4ff");
    			attr(div3, "id", "spider-opp-teams");
    			attr(div4, "class", "spider-opp-team-selector svelte-1gpl4ff");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div2, anchor);
    			append_hydration(div2, div1);
    			append_hydration(div1, div0);
    			/*div0_binding*/ ctx[6](div0);
    			insert_hydration(target, t, anchor);
    			insert_hydration(target, div4, anchor);
    			append_hydration(div4, div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*spiderBtnClick, getAlias, data, team*/ 23) {
    				each_value = /*data*/ ctx[0].teamNames;
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
    		d(detaching) {
    			if (detaching) detach(div2);
    			/*div0_binding*/ ctx[6](null);
    			if (detaching) detach(t);
    			if (detaching) detach(div4);
    			destroy_each(each_blocks, detaching);
    		}
    	};
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

    function instance$5($$self, $$props, $$invalidate) {
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
    			addAvg(plotData.data);
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
    				addAvg(plotData.data);
    			}

    			removeItem(comparisonTeams, comparisonTeams[i]); // Remove from comparison teams
    		}

    		Plotly.redraw(plotDiv); // Redraw with teamName removed
    	}

    	function spiderBtnClick(btn) {
    		let team = getName(btn.innerHTML);

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

    	let { data, team, getAlias, getName } = $$props;

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
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('getAlias' in $$props) $$invalidate(2, getAlias = $$props.getAlias);
    		if ('getName' in $$props) $$invalidate(5, getName = $$props.getName);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*team*/ 2) {
    			team && refreshPlot();
    		}
    	};

    	return [
    		data,
    		team,
    		getAlias,
    		plotDiv,
    		spiderBtnClick,
    		getName,
    		div0_binding,
    		click_handler
    	];
    }

    class Spider extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(
    			this,
    			options,
    			instance$5,
    			create_fragment$6,
    			safe_not_equal,
    			{
    				data: 0,
    				team: 1,
    				getAlias: 2,
    				getName: 5
    			},
    			null,
    			[-1, -1]
    		);
    	}
    }

    /* src\components\NavBar.svelte generated by Svelte v3.49.0 */

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (36:6) {:else}
    function create_else_block$3(ctx) {
    	let button;
    	let div;
    	let t0_value = /*getAlias*/ ctx[2](/*_team*/ ctx[5]) + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[4](/*_team*/ ctx[5]);
    	}

    	return {
    		c() {
    			button = element("button");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			div = claim_element(button_nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, t0_value);
    			div_nodes.forEach(detach);
    			t1 = claim_space(button_nodes);
    			button_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "team-name svelte-1q37vn5");
    			attr(button, "class", "team-link svelte-1q37vn5");
    		},
    		m(target, anchor) {
    			insert_hydration(target, button, anchor);
    			append_hydration(button, div);
    			append_hydration(div, t0);
    			append_hydration(button, t1);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*getAlias, teams*/ 6 && t0_value !== (t0_value = /*getAlias*/ ctx[2](/*_team*/ ctx[5]) + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (24:6) {#if _team.toLowerCase().replace(/ /g, "-") == team}
    function create_if_block$3(ctx) {
    	let a;
    	let div;
    	let t0_value = /*getAlias*/ ctx[2](/*_team*/ ctx[5]) + "";
    	let t0;
    	let t1;
    	let a_href_value;

    	return {
    		c() {
    			a = element("a");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l(nodes) {
    			a = claim_element(nodes, "A", { href: true, class: true });
    			var a_nodes = children(a);
    			div = claim_element(a_nodes, "DIV", { class: true, style: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, t0_value);
    			div_nodes.forEach(detach);
    			t1 = claim_space(a_nodes);
    			a_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "this-team-name svelte-1q37vn5");
    			set_style(div, "color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + "-secondary)");
    			set_style(div, "background-color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + ")");
    			attr(a, "href", a_href_value = "/" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-'));
    			attr(a, "class", "team-link");
    		},
    		m(target, anchor) {
    			insert_hydration(target, a, anchor);
    			append_hydration(a, div);
    			append_hydration(div, t0);
    			append_hydration(a, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*getAlias, teams*/ 6 && t0_value !== (t0_value = /*getAlias*/ ctx[2](/*_team*/ ctx[5]) + "")) set_data(t0, t0_value);

    			if (dirty & /*teams*/ 2) {
    				set_style(div, "color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + "-secondary)");
    			}

    			if (dirty & /*teams*/ 2) {
    				set_style(div, "background-color", "var(--" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-') + ")");
    			}

    			if (dirty & /*teams*/ 2 && a_href_value !== (a_href_value = "/" + /*_team*/ ctx[5].toLowerCase().replace(/ /g, '-'))) {
    				attr(a, "href", a_href_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(a);
    		}
    	};
    }

    // (23:4) {#each teams as _team, _ (_team)}
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

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l(nodes) {
    			first = empty();
    			if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h() {
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert_hydration(target, first, anchor);
    			if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    		},
    		p(new_ctx, dirty) {
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
    		d(detaching) {
    			if (detaching) detach(first);
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
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
    	const get_key = ctx => /*_team*/ ctx[5];

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

    	return {
    		c() {
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
    		l(nodes) {
    			nav = claim_element(nodes, "NAV", { class: true });
    			var nav_nodes = children(nav);
    			div0 = claim_element(nav_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			p = claim_element(div0_nodes, "P", {});
    			var p_nodes = children(p);
    			span = claim_element(p_nodes, "SPAN", { style: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "pl");
    			span_nodes.forEach(detach);
    			t1 = claim_text(p_nodes, "dashboard");
    			p_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
    			t2 = claim_space(nav_nodes);
    			div1 = claim_element(nav_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div1_nodes);
    			}

    			div1_nodes.forEach(detach);
    			t3 = claim_space(nav_nodes);
    			div2 = claim_element(nav_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			button = claim_element(div2_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			img = claim_element(button_nodes, "IMG", { src: true, alt: true });
    			button_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			nav_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			set_style(span, "color", "#00fe87");
    			attr(div0, "class", "title no-selection svelte-1q37vn5");
    			attr(div1, "class", "team-links svelte-1q37vn5");
    			if (!src_url_equal(img.src, img_src_value = "img/arrow-bar-left.svg")) attr(img, "src", img_src_value);
    			attr(img, "alt", "");
    			attr(button, "class", "close-btn svelte-1q37vn5");
    			attr(div2, "class", "close");
    			attr(nav, "class", "svelte-1q37vn5");
    		},
    		m(target, anchor) {
    			insert_hydration(target, nav, anchor);
    			append_hydration(nav, div0);
    			append_hydration(div0, p);
    			append_hydration(p, span);
    			append_hydration(span, t0);
    			append_hydration(p, t1);
    			append_hydration(nav, t2);
    			append_hydration(nav, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_hydration(nav, t3);
    			append_hydration(nav, div2);
    			append_hydration(div2, button);
    			append_hydration(button, img);

    			if (!mounted) {
    				dispose = listen(button, "click", closeNavBar);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*teams, getAlias, team, switchTeam*/ 15) {
    				each_value = /*teams*/ ctx[1];
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, destroy_block, create_each_block$2, null, get_each_context$2);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(nav);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			dispose();
    		}
    	};
    }

    function closeNavBar() {
    	document.getElementById("navBar").style.display = "none";
    	document.getElementById("dashboard").style.marginLeft = 0;
    	window.dispatchEvent(new Event("resize")); // Snap plotly graphs to new width
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { team, teams, getAlias, switchTeam } = $$props;

    	const click_handler = _team => {
    		switchTeam(_team.toLowerCase().replace(/ /g, "-"));
    	};

    	$$self.$$set = $$props => {
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    		if ('getAlias' in $$props) $$invalidate(2, getAlias = $$props.getAlias);
    		if ('switchTeam' in $$props) $$invalidate(3, switchTeam = $$props.switchTeam);
    	};

    	return [team, teams, getAlias, switchTeam, click_handler];
    }

    class NavBar extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$4, create_fragment$5, safe_not_equal, {
    			team: 0,
    			teams: 1,
    			getAlias: 2,
    			switchTeam: 3
    		});
    	}
    }

    /* src\components\MobileViewNav.svelte generated by Svelte v3.49.0 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	child_ctx[12] = i;
    	return child_ctx;
    }

    // (27:2) {#if hypenatedTeams != undefined}
    function create_if_block$2(ctx) {
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let each_value = /*hypenatedTeams*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div0 = element("div");
    			t0 = text("Other Teams");
    			t1 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, "Other Teams");
    			div0_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div1_nodes);
    			}

    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "nav-title svelte-1pbsqfs");
    			attr(div1, "class", "team-links svelte-1pbsqfs");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div0, anchor);
    			append_hydration(div0, t0);
    			insert_hydration(target, t1, anchor);
    			insert_hydration(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*hypenatedTeams, switchTeamToTop, getAlias, teams*/ 15) {
    				each_value = /*hypenatedTeams*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (31:8) {#if _hypenatedTeam != null}
    function create_if_block_1$1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[12] == 0 || /*i*/ ctx[12] == 1 && /*hypenatedTeams*/ ctx[2][0] == null) return create_if_block_2$1;
    		if (/*i*/ ctx[12] == /*hypenatedTeams*/ ctx[2].length - 1 || /*i*/ ctx[12] == /*hypenatedTeams*/ ctx[2].length - 2 && /*hypenatedTeams*/ ctx[2][/*hypenatedTeams*/ ctx[2].length - 1] == null) return create_if_block_3$1;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
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
    		d(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (52:10) {:else}
    function create_else_block$2(ctx) {
    	let button;
    	let t_value = /*getAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[12]]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[8](/*_hypenatedTeam*/ ctx[10]);
    	}

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l(nodes) {
    			button = claim_element(nodes, "BUTTON", { style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			set_style(button, "color", "var(--" + /*_hypenatedTeam*/ ctx[10] + "-secondary)");
    			set_style(button, "background-color", "var(--" + /*_hypenatedTeam*/ ctx[10] + ")");
    			attr(button, "class", "team-link svelte-1pbsqfs");
    		},
    		m(target, anchor) {
    			insert_hydration(target, button, anchor);
    			append_hydration(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler_2);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*getAlias, teams*/ 3 && t_value !== (t_value = /*getAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[12]]) + "")) set_data(t, t_value);

    			if (dirty & /*hypenatedTeams*/ 4) {
    				set_style(button, "color", "var(--" + /*_hypenatedTeam*/ ctx[10] + "-secondary)");
    			}

    			if (dirty & /*hypenatedTeams*/ 4) {
    				set_style(button, "background-color", "var(--" + /*_hypenatedTeam*/ ctx[10] + ")");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (42:136) 
    function create_if_block_3$1(ctx) {
    	let button;
    	let t_value = /*getAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[12]]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[7](/*i*/ ctx[12]);
    	}

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l(nodes) {
    			button = claim_element(nodes, "BUTTON", { style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			set_style(button, "color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + "-secondary)");
    			set_style(button, "background-color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + ")");
    			attr(button, "class", "team-link last-team svelte-1pbsqfs");
    		},
    		m(target, anchor) {
    			insert_hydration(target, button, anchor);
    			append_hydration(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*getAlias, teams*/ 3 && t_value !== (t_value = /*getAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[12]]) + "")) set_data(t, t_value);

    			if (dirty & /*hypenatedTeams*/ 4) {
    				set_style(button, "color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + "-secondary)");
    			}

    			if (dirty & /*hypenatedTeams*/ 4) {
    				set_style(button, "background-color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + ")");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (32:10) {#if i == 0 || (i == 1 && hypenatedTeams[0] == null)}
    function create_if_block_2$1(ctx) {
    	let button;
    	let t_value = /*getAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[12]]) + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[6](/*i*/ ctx[12]);
    	}

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l(nodes) {
    			button = claim_element(nodes, "BUTTON", { style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			set_style(button, "color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + "-secondary)");
    			set_style(button, "background-color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + ")");
    			attr(button, "class", "team-link first-team svelte-1pbsqfs");
    		},
    		m(target, anchor) {
    			insert_hydration(target, button, anchor);
    			append_hydration(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*getAlias, teams*/ 3 && t_value !== (t_value = /*getAlias*/ ctx[1](/*teams*/ ctx[0][/*i*/ ctx[12]]) + "")) set_data(t, t_value);

    			if (dirty & /*hypenatedTeams*/ 4) {
    				set_style(button, "color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + "-secondary)");
    			}

    			if (dirty & /*hypenatedTeams*/ 4) {
    				set_style(button, "background-color", "var(--" + /*hypenatedTeams*/ ctx[2][/*i*/ ctx[12]] + ")");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (30:6) {#each hypenatedTeams as _hypenatedTeam, i}
    function create_each_block$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*_hypenatedTeam*/ ctx[10] != null && create_if_block_1$1(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (/*_hypenatedTeam*/ ctx[10] != null) {
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
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let nav;
    	let if_block = /*hypenatedTeams*/ ctx[2] != undefined && create_if_block$2(ctx);

    	return {
    		c() {
    			nav = element("nav");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l(nodes) {
    			nav = claim_element(nodes, "NAV", { class: true });
    			var nav_nodes = children(nav);
    			if (if_block) if_block.l(nav_nodes);
    			nav_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(nav, "class", "svelte-1pbsqfs");
    		},
    		m(target, anchor) {
    			insert_hydration(target, nav, anchor);
    			if (if_block) if_block.m(nav, null);
    		},
    		p(ctx, [dirty]) {
    			if (/*hypenatedTeams*/ ctx[2] != undefined) {
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
    		d(detaching) {
    			if (detaching) detach(nav);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	function switchTeamToTop(team) {
    		switchTeam(team);
    		window.scrollTo(0, 0);
    	}

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

    		$$invalidate(2, hypenatedTeams = hyphenatedTeamNames);
    	}

    	let hypenatedTeams;
    	let { hypenatedTeam, teams, getAlias, switchTeam } = $$props;

    	const click_handler = i => {
    		switchTeamToTop(hypenatedTeams[i]);
    	};

    	const click_handler_1 = i => {
    		switchTeamToTop(hypenatedTeams[i]);
    	};

    	const click_handler_2 = _hypenatedTeam => {
    		switchTeamToTop(_hypenatedTeam);
    	};

    	$$self.$$set = $$props => {
    		if ('hypenatedTeam' in $$props) $$invalidate(4, hypenatedTeam = $$props.hypenatedTeam);
    		if ('teams' in $$props) $$invalidate(0, teams = $$props.teams);
    		if ('getAlias' in $$props) $$invalidate(1, getAlias = $$props.getAlias);
    		if ('switchTeam' in $$props) $$invalidate(5, switchTeam = $$props.switchTeam);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*hypenatedTeam*/ 16) {
    			hypenatedTeam & getHyphenatedTeamNames();
    		}
    	};

    	return [
    		teams,
    		getAlias,
    		hypenatedTeams,
    		switchTeamToTop,
    		hypenatedTeam,
    		switchTeam,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class MobileViewNav extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$3, create_fragment$4, safe_not_equal, {
    			hypenatedTeam: 4,
    			teams: 0,
    			getAlias: 1,
    			switchTeam: 5
    		});
    	}
    }

    /* src\routes\Team.svelte generated by Svelte v3.49.0 */

    const { document: document_1$1 } = globals;

    function create_else_block_1$1(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "loading-spinner");
    			attr(div1, "class", "loading-spinner-container");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    // (180:6) {#if data != undefined}
    function create_if_block$1(ctx) {
    	let div24;
    	let div2;
    	let t0;
    	let div1;
    	let h10;
    	let t1;
    	let t2;
    	let div0;
    	let fixtures;
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
    	let formovertime;
    	let t9;
    	let div11;
    	let div10;
    	let h12;
    	let t10;
    	let t11;
    	let div9;
    	let positionovertime;
    	let t12;
    	let div14;
    	let div13;
    	let h13;
    	let t13;
    	let t14;
    	let div12;
    	let goalsscoredandconceded;
    	let t15;
    	let div17;
    	let div16;
    	let div15;
    	let cleansheets;
    	let t16;
    	let div18;
    	let seasonstats;
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
    	let spider;
    	let t21;
    	let mobileviewnav;
    	let t22;
    	let teamsfooter;
    	let current;

    	function select_block_type_1(ctx, dirty) {
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type_1();
    	let if_block = current_block_type(ctx);

    	fixtures = new Fixtures({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1]
    			}
    		});

    	currentform = new CurrentForm({
    			props: {
    				data: /*data*/ ctx[4],
    				currentMatchday: /*currentMatchday*/ ctx[2],
    				team: /*team*/ ctx[1]
    			}
    		});

    	tablesnippet = new TableSnippet({
    			props: {
    				data: /*data*/ ctx[4],
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				team: /*team*/ ctx[1],
    				getAlias: /*getAlias*/ ctx[5],
    				switchTeam: /*switchTeam*/ ctx[8]
    			}
    		});

    	nextgame = new NextGame({
    			props: {
    				data: /*data*/ ctx[4],
    				currentMatchday: /*currentMatchday*/ ctx[2],
    				team: /*team*/ ctx[1],
    				showBadge,
    				getAlias: /*getAlias*/ ctx[5],
    				switchTeam: /*switchTeam*/ ctx[8]
    			}
    		});

    	formovertime = new FormOverTime({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1],
    				playedMatchdays: /*playedMatchdays*/ ctx[3]
    			}
    		});

    	positionovertime = new PositionOverTime({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1],
    				playedMatchdays: /*playedMatchdays*/ ctx[3]
    			}
    		});

    	goalsscoredandconceded = new GoalsScoredAndConceded({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1],
    				playedMatchdays: /*playedMatchdays*/ ctx[3]
    			}
    		});

    	cleansheets = new CleanSheets({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1],
    				playedMatchdays: /*playedMatchdays*/ ctx[3]
    			}
    		});

    	seasonstats = new SeasonStats({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1]
    			}
    		});

    	goalspergame = new GoalsPerGame({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1]
    			}
    		});

    	spider = new Spider({
    			props: {
    				data: /*data*/ ctx[4],
    				team: /*team*/ ctx[1],
    				getAlias: /*getAlias*/ ctx[5],
    				getName: /*getName*/ ctx[6]
    			}
    		});

    	mobileviewnav = new MobileViewNav({
    			props: {
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[7],
    				getAlias: /*getAlias*/ ctx[5],
    				switchTeam: /*switchTeam*/ ctx[8]
    			}
    		});

    	teamsfooter = new TeamsFooter({
    			props: { lastUpdated: /*data*/ ctx[4].lastUpdated }
    		});

    	return {
    		c() {
    			div24 = element("div");
    			div2 = element("div");
    			if_block.c();
    			t0 = space();
    			div1 = element("div");
    			h10 = element("h1");
    			t1 = text("Fixtures");
    			t2 = space();
    			div0 = element("div");
    			create_component(fixtures.$$.fragment);
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
    			create_component(formovertime.$$.fragment);
    			t9 = space();
    			div11 = element("div");
    			div10 = element("div");
    			h12 = element("h1");
    			t10 = text("Position Over Time");
    			t11 = space();
    			div9 = element("div");
    			create_component(positionovertime.$$.fragment);
    			t12 = space();
    			div14 = element("div");
    			div13 = element("div");
    			h13 = element("h1");
    			t13 = text("Goals Scored and Conceded");
    			t14 = space();
    			div12 = element("div");
    			create_component(goalsscoredandconceded.$$.fragment);
    			t15 = space();
    			div17 = element("div");
    			div16 = element("div");
    			div15 = element("div");
    			create_component(cleansheets.$$.fragment);
    			t16 = space();
    			div18 = element("div");
    			create_component(seasonstats.$$.fragment);
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
    			create_component(spider.$$.fragment);
    			t21 = space();
    			create_component(mobileviewnav.$$.fragment);
    			t22 = space();
    			create_component(teamsfooter.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			div24 = claim_element(nodes, "DIV", { class: true });
    			var div24_nodes = children(div24);
    			div2 = claim_element(div24_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			if_block.l(div2_nodes);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			h10 = claim_element(div1_nodes, "H1", { class: true });
    			var h10_nodes = children(h10);
    			t1 = claim_text(h10_nodes, "Fixtures");
    			h10_nodes.forEach(detach);
    			t2 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(fixtures.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			t3 = claim_space(div24_nodes);
    			div5 = claim_element(div24_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(currentform.$$.fragment, div3_nodes);
    			t4 = claim_space(div3_nodes);
    			claim_component(tablesnippet.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach);
    			t5 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			claim_component(nextgame.$$.fragment, div4_nodes);
    			div4_nodes.forEach(detach);
    			div5_nodes.forEach(detach);
    			t6 = claim_space(div24_nodes);
    			div8 = claim_element(div24_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			h11 = claim_element(div7_nodes, "H1", { class: true });
    			var h11_nodes = children(h11);
    			t7 = claim_text(h11_nodes, "Form Over Time");
    			h11_nodes.forEach(detach);
    			t8 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			claim_component(formovertime.$$.fragment, div6_nodes);
    			div6_nodes.forEach(detach);
    			div7_nodes.forEach(detach);
    			div8_nodes.forEach(detach);
    			t9 = claim_space(div24_nodes);
    			div11 = claim_element(div24_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h12 = claim_element(div10_nodes, "H1", { class: true });
    			var h12_nodes = children(h12);
    			t10 = claim_text(h12_nodes, "Position Over Time");
    			h12_nodes.forEach(detach);
    			t11 = claim_space(div10_nodes);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			claim_component(positionovertime.$$.fragment, div9_nodes);
    			div9_nodes.forEach(detach);
    			div10_nodes.forEach(detach);
    			div11_nodes.forEach(detach);
    			t12 = claim_space(div24_nodes);
    			div14 = claim_element(div24_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			h13 = claim_element(div13_nodes, "H1", { class: true });
    			var h13_nodes = children(h13);
    			t13 = claim_text(h13_nodes, "Goals Scored and Conceded");
    			h13_nodes.forEach(detach);
    			t14 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			claim_component(goalsscoredandconceded.$$.fragment, div12_nodes);
    			div12_nodes.forEach(detach);
    			div13_nodes.forEach(detach);
    			div14_nodes.forEach(detach);
    			t15 = claim_space(div24_nodes);
    			div17 = claim_element(div24_nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			div16 = claim_element(div17_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			div15 = claim_element(div16_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			claim_component(cleansheets.$$.fragment, div15_nodes);
    			div15_nodes.forEach(detach);
    			div16_nodes.forEach(detach);
    			div17_nodes.forEach(detach);
    			t16 = claim_space(div24_nodes);
    			div18 = claim_element(div24_nodes, "DIV", { class: true });
    			var div18_nodes = children(div18);
    			claim_component(seasonstats.$$.fragment, div18_nodes);
    			div18_nodes.forEach(detach);
    			t17 = claim_space(div24_nodes);
    			div20 = claim_element(div24_nodes, "DIV", { class: true });
    			var div20_nodes = children(div20);
    			div19 = claim_element(div20_nodes, "DIV", { class: true });
    			var div19_nodes = children(div19);
    			h14 = claim_element(div19_nodes, "H1", {});
    			var h14_nodes = children(h14);
    			t18 = claim_text(h14_nodes, "Goals Per Game");
    			h14_nodes.forEach(detach);
    			t19 = claim_space(div19_nodes);
    			claim_component(goalspergame.$$.fragment, div19_nodes);
    			div19_nodes.forEach(detach);
    			div20_nodes.forEach(detach);
    			t20 = claim_space(div24_nodes);
    			div23 = claim_element(div24_nodes, "DIV", { class: true });
    			var div23_nodes = children(div23);
    			div22 = claim_element(div23_nodes, "DIV", { class: true });
    			var div22_nodes = children(div22);
    			div21 = claim_element(div22_nodes, "DIV", { class: true });
    			var div21_nodes = children(div21);
    			claim_component(spider.$$.fragment, div21_nodes);
    			div21_nodes.forEach(detach);
    			div22_nodes.forEach(detach);
    			div23_nodes.forEach(detach);
    			t21 = claim_space(div24_nodes);
    			claim_component(mobileviewnav.$$.fragment, div24_nodes);
    			t22 = claim_space(div24_nodes);
    			claim_component(teamsfooter.$$.fragment, div24_nodes);
    			div24_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(h10, "class", "lowered");
    			attr(div0, "class", "graph mini-graph");
    			attr(div1, "class", "row-right fixtures-graph row-graph svelte-1xx35mc");
    			attr(div2, "class", "row multi-element-row small-bottom-margin svelte-1xx35mc");
    			attr(div3, "class", "row-left form-details svelte-1xx35mc");
    			attr(div4, "class", "row-right svelte-1xx35mc");
    			attr(div5, "class", "row multi-element-row svelte-1xx35mc");
    			attr(h11, "class", "lowered");
    			attr(div6, "class", "graph full-row-graph");
    			attr(div7, "class", "form-graph row-graph svelte-1xx35mc");
    			attr(div8, "class", "row svelte-1xx35mc");
    			attr(h12, "class", "lowered");
    			attr(div9, "class", "graph full-row-graph");
    			attr(div10, "class", "position-over-time-graph row-graph svelte-1xx35mc");
    			attr(div11, "class", "row svelte-1xx35mc");
    			attr(h13, "class", "lowered");
    			attr(div12, "class", "graph full-row-graph");
    			attr(div13, "class", "goals-scored-vs-conceded-graph row-graph svelte-1xx35mc");
    			attr(div14, "class", "row no-bottom-margin svelte-1xx35mc");
    			attr(div15, "class", "clean-sheets graph full-row-graph");
    			attr(div16, "class", "row-graph svelte-1xx35mc");
    			attr(div17, "class", "row svelte-1xx35mc");
    			attr(div18, "class", "season-stats-row svelte-1xx35mc");
    			attr(div19, "class", "goals-freq-row row-graph svelte-1xx35mc");
    			attr(div20, "class", "row svelte-1xx35mc");
    			attr(div21, "class", "spider-chart-container svelte-1xx35mc");
    			attr(div22, "class", "spider-chart-row row-graph svelte-1xx35mc");
    			attr(div23, "class", "row svelte-1xx35mc");
    			attr(div24, "class", "page-content svelte-1xx35mc");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div24, anchor);
    			append_hydration(div24, div2);
    			if_block.m(div2, null);
    			append_hydration(div2, t0);
    			append_hydration(div2, div1);
    			append_hydration(div1, h10);
    			append_hydration(h10, t1);
    			append_hydration(div1, t2);
    			append_hydration(div1, div0);
    			mount_component(fixtures, div0, null);
    			append_hydration(div24, t3);
    			append_hydration(div24, div5);
    			append_hydration(div5, div3);
    			mount_component(currentform, div3, null);
    			append_hydration(div3, t4);
    			mount_component(tablesnippet, div3, null);
    			append_hydration(div5, t5);
    			append_hydration(div5, div4);
    			mount_component(nextgame, div4, null);
    			append_hydration(div24, t6);
    			append_hydration(div24, div8);
    			append_hydration(div8, div7);
    			append_hydration(div7, h11);
    			append_hydration(h11, t7);
    			append_hydration(div7, t8);
    			append_hydration(div7, div6);
    			mount_component(formovertime, div6, null);
    			append_hydration(div24, t9);
    			append_hydration(div24, div11);
    			append_hydration(div11, div10);
    			append_hydration(div10, h12);
    			append_hydration(h12, t10);
    			append_hydration(div10, t11);
    			append_hydration(div10, div9);
    			mount_component(positionovertime, div9, null);
    			append_hydration(div24, t12);
    			append_hydration(div24, div14);
    			append_hydration(div14, div13);
    			append_hydration(div13, h13);
    			append_hydration(h13, t13);
    			append_hydration(div13, t14);
    			append_hydration(div13, div12);
    			mount_component(goalsscoredandconceded, div12, null);
    			append_hydration(div24, t15);
    			append_hydration(div24, div17);
    			append_hydration(div17, div16);
    			append_hydration(div16, div15);
    			mount_component(cleansheets, div15, null);
    			append_hydration(div24, t16);
    			append_hydration(div24, div18);
    			mount_component(seasonstats, div18, null);
    			append_hydration(div24, t17);
    			append_hydration(div24, div20);
    			append_hydration(div20, div19);
    			append_hydration(div19, h14);
    			append_hydration(h14, t18);
    			append_hydration(div19, t19);
    			mount_component(goalspergame, div19, null);
    			append_hydration(div24, t20);
    			append_hydration(div24, div23);
    			append_hydration(div23, div22);
    			append_hydration(div22, div21);
    			mount_component(spider, div21, null);
    			append_hydration(div24, t21);
    			mount_component(mobileviewnav, div24, null);
    			append_hydration(div24, t22);
    			mount_component(teamsfooter, div24, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if_block.p(ctx, dirty);
    			const fixtures_changes = {};
    			if (dirty & /*data*/ 16) fixtures_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) fixtures_changes.team = /*team*/ ctx[1];
    			fixtures.$set(fixtures_changes);
    			const currentform_changes = {};
    			if (dirty & /*data*/ 16) currentform_changes.data = /*data*/ ctx[4];
    			if (dirty & /*currentMatchday*/ 4) currentform_changes.currentMatchday = /*currentMatchday*/ ctx[2];
    			if (dirty & /*team*/ 2) currentform_changes.team = /*team*/ ctx[1];
    			currentform.$set(currentform_changes);
    			const tablesnippet_changes = {};
    			if (dirty & /*data*/ 16) tablesnippet_changes.data = /*data*/ ctx[4];
    			if (dirty & /*hyphenatedTeam*/ 1) tablesnippet_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			if (dirty & /*team*/ 2) tablesnippet_changes.team = /*team*/ ctx[1];
    			tablesnippet.$set(tablesnippet_changes);
    			const nextgame_changes = {};
    			if (dirty & /*data*/ 16) nextgame_changes.data = /*data*/ ctx[4];
    			if (dirty & /*currentMatchday*/ 4) nextgame_changes.currentMatchday = /*currentMatchday*/ ctx[2];
    			if (dirty & /*team*/ 2) nextgame_changes.team = /*team*/ ctx[1];
    			nextgame.$set(nextgame_changes);
    			const formovertime_changes = {};
    			if (dirty & /*data*/ 16) formovertime_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) formovertime_changes.team = /*team*/ ctx[1];
    			if (dirty & /*playedMatchdays*/ 8) formovertime_changes.playedMatchdays = /*playedMatchdays*/ ctx[3];
    			formovertime.$set(formovertime_changes);
    			const positionovertime_changes = {};
    			if (dirty & /*data*/ 16) positionovertime_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) positionovertime_changes.team = /*team*/ ctx[1];
    			if (dirty & /*playedMatchdays*/ 8) positionovertime_changes.playedMatchdays = /*playedMatchdays*/ ctx[3];
    			positionovertime.$set(positionovertime_changes);
    			const goalsscoredandconceded_changes = {};
    			if (dirty & /*data*/ 16) goalsscoredandconceded_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) goalsscoredandconceded_changes.team = /*team*/ ctx[1];
    			if (dirty & /*playedMatchdays*/ 8) goalsscoredandconceded_changes.playedMatchdays = /*playedMatchdays*/ ctx[3];
    			goalsscoredandconceded.$set(goalsscoredandconceded_changes);
    			const cleansheets_changes = {};
    			if (dirty & /*data*/ 16) cleansheets_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) cleansheets_changes.team = /*team*/ ctx[1];
    			if (dirty & /*playedMatchdays*/ 8) cleansheets_changes.playedMatchdays = /*playedMatchdays*/ ctx[3];
    			cleansheets.$set(cleansheets_changes);
    			const seasonstats_changes = {};
    			if (dirty & /*data*/ 16) seasonstats_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) seasonstats_changes.team = /*team*/ ctx[1];
    			seasonstats.$set(seasonstats_changes);
    			const goalspergame_changes = {};
    			if (dirty & /*data*/ 16) goalspergame_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) goalspergame_changes.team = /*team*/ ctx[1];
    			goalspergame.$set(goalspergame_changes);
    			const spider_changes = {};
    			if (dirty & /*data*/ 16) spider_changes.data = /*data*/ ctx[4];
    			if (dirty & /*team*/ 2) spider_changes.team = /*team*/ ctx[1];
    			spider.$set(spider_changes);
    			const mobileviewnav_changes = {};
    			if (dirty & /*hyphenatedTeam*/ 1) mobileviewnav_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			mobileviewnav.$set(mobileviewnav_changes);
    			const teamsfooter_changes = {};
    			if (dirty & /*data*/ 16) teamsfooter_changes.lastUpdated = /*data*/ ctx[4].lastUpdated;
    			teamsfooter.$set(teamsfooter_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(fixtures.$$.fragment, local);
    			transition_in(currentform.$$.fragment, local);
    			transition_in(tablesnippet.$$.fragment, local);
    			transition_in(nextgame.$$.fragment, local);
    			transition_in(formovertime.$$.fragment, local);
    			transition_in(positionovertime.$$.fragment, local);
    			transition_in(goalsscoredandconceded.$$.fragment, local);
    			transition_in(cleansheets.$$.fragment, local);
    			transition_in(seasonstats.$$.fragment, local);
    			transition_in(goalspergame.$$.fragment, local);
    			transition_in(spider.$$.fragment, local);
    			transition_in(mobileviewnav.$$.fragment, local);
    			transition_in(teamsfooter.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(fixtures.$$.fragment, local);
    			transition_out(currentform.$$.fragment, local);
    			transition_out(tablesnippet.$$.fragment, local);
    			transition_out(nextgame.$$.fragment, local);
    			transition_out(formovertime.$$.fragment, local);
    			transition_out(positionovertime.$$.fragment, local);
    			transition_out(goalsscoredandconceded.$$.fragment, local);
    			transition_out(cleansheets.$$.fragment, local);
    			transition_out(seasonstats.$$.fragment, local);
    			transition_out(goalspergame.$$.fragment, local);
    			transition_out(spider.$$.fragment, local);
    			transition_out(mobileviewnav.$$.fragment, local);
    			transition_out(teamsfooter.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div24);
    			if_block.d();
    			destroy_component(fixtures);
    			destroy_component(currentform);
    			destroy_component(tablesnippet);
    			destroy_component(nextgame);
    			destroy_component(formovertime);
    			destroy_component(positionovertime);
    			destroy_component(goalsscoredandconceded);
    			destroy_component(cleansheets);
    			destroy_component(seasonstats);
    			destroy_component(goalspergame);
    			destroy_component(spider);
    			destroy_component(mobileviewnav);
    			destroy_component(teamsfooter);
    		}
    	};
    }

    // (192:12) {:else}
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
    	let t1_value = /*data*/ ctx[4].standings[/*team*/ ctx[1]][/*data*/ ctx[4]._id].position + "";
    	let t1;

    	return {
    		c() {
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
    		l(nodes) {
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

    			children(circle0).forEach(detach);

    			circle1 = claim_svg_element(svg_nodes, "circle", {
    				cx: true,
    				cy: true,
    				r: true,
    				"stroke-width": true,
    				fill: true
    			});

    			children(circle1).forEach(detach);

    			circle2 = claim_svg_element(svg_nodes, "circle", {
    				cx: true,
    				cy: true,
    				r: true,
    				"stroke-width": true,
    				fill: true
    			});

    			children(circle2).forEach(detach);
    			svg_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
    			t0 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t1 = claim_text(div1_nodes, t1_value);
    			div1_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(circle0, "cx", "300");
    			attr(circle0, "cy", "150");
    			attr(circle0, "r", "100");
    			attr(circle0, "stroke-width", "0");
    			attr(circle0, "fill", circle0_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			attr(circle1, "cx", "170");
    			attr(circle1, "cy", "170");
    			attr(circle1, "r", "140");
    			attr(circle1, "stroke-width", "0");
    			attr(circle1, "fill", circle1_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			attr(circle2, "cx", "300");
    			attr(circle2, "cy", "320");
    			attr(circle2, "r", "170");
    			attr(circle2, "stroke-width", "0");
    			attr(circle2, "fill", circle2_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			attr(svg, "class", "circles-background svelte-1xx35mc");
    			attr(div0, "class", "circles-background-container svelte-1xx35mc");
    			attr(div1, "class", "position-central svelte-1xx35mc");
    			attr(div2, "class", "row-left position-no-badge svelte-1xx35mc");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div2, anchor);
    			append_hydration(div2, div0);
    			append_hydration(div0, svg);
    			append_hydration(svg, circle0);
    			append_hydration(svg, circle1);
    			append_hydration(svg, circle2);
    			append_hydration(div2, t0);
    			append_hydration(div2, div1);
    			append_hydration(div1, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*hyphenatedTeam*/ 1 && circle0_fill_value !== (circle0_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)")) {
    				attr(circle0, "fill", circle0_fill_value);
    			}

    			if (dirty & /*hyphenatedTeam*/ 1 && circle1_fill_value !== (circle1_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")")) {
    				attr(circle1, "fill", circle1_fill_value);
    			}

    			if (dirty & /*hyphenatedTeam*/ 1 && circle2_fill_value !== (circle2_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")")) {
    				attr(circle2, "fill", circle2_fill_value);
    			}

    			if (dirty & /*data, team*/ 18 && t1_value !== (t1_value = /*data*/ ctx[4].standings[/*team*/ ctx[1]][/*data*/ ctx[4]._id].position + "")) set_data(t1, t1_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    		}
    	};
    }

    // (166:0) <Router>
    function create_default_slot$3(ctx) {
    	let div4;
    	let div0;
    	let navbar;
    	let t0;
    	let div3;
    	let div2;
    	let a;
    	let div1;
    	let t1_value = /*getAlias*/ ctx[5](/*team*/ ctx[1]) + "";
    	let t1;
    	let a_href_value;
    	let t2;
    	let current_block_type_index;
    	let if_block;
    	let current;

    	navbar = new NavBar({
    			props: {
    				team: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[7],
    				getAlias: /*getAlias*/ ctx[5],
    				switchTeam: /*switchTeam*/ ctx[8]
    			}
    		});

    	const if_block_creators = [create_if_block$1, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[4] != undefined) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			div4 = element("div");
    			div0 = element("div");
    			create_component(navbar.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			div2 = element("div");
    			a = element("a");
    			div1 = element("div");
    			t1 = text(t1_value);
    			t2 = space();
    			if_block.c();
    			this.h();
    		},
    		l(nodes) {
    			div4 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div4_nodes = children(div4);
    			div0 = claim_element(div4_nodes, "DIV", { id: true, class: true });
    			var div0_nodes = children(div0);
    			claim_component(navbar.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach);
    			t0 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { id: true, class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div2_nodes = children(div2);
    			a = claim_element(div2_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			div1 = claim_element(a_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			t1 = claim_text(div1_nodes, t1_value);
    			div1_nodes.forEach(detach);
    			a_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			t2 = claim_space(div3_nodes);
    			if_block.l(div3_nodes);
    			div3_nodes.forEach(detach);
    			div4_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "id", "navBar");
    			attr(div0, "class", "svelte-1xx35mc");
    			attr(div1, "class", "title svelte-1xx35mc");
    			set_style(div1, "color", "var(--" + (/*hyphenatedTeam*/ ctx[0] + '-secondary') + ")");
    			attr(a, "class", "main-link no-decoration svelte-1xx35mc");
    			attr(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			attr(div2, "class", "header svelte-1xx35mc");
    			set_style(div2, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			attr(div3, "id", "dashboard");
    			attr(div3, "class", "svelte-1xx35mc");
    			attr(div4, "id", "team");
    			attr(div4, "class", "svelte-1xx35mc");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div4, anchor);
    			append_hydration(div4, div0);
    			mount_component(navbar, div0, null);
    			append_hydration(div4, t0);
    			append_hydration(div4, div3);
    			append_hydration(div3, div2);
    			append_hydration(div2, a);
    			append_hydration(a, div1);
    			append_hydration(div1, t1);
    			append_hydration(div3, t2);
    			if_blocks[current_block_type_index].m(div3, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const navbar_changes = {};
    			if (dirty & /*hyphenatedTeam*/ 1) navbar_changes.team = /*hyphenatedTeam*/ ctx[0];
    			navbar.$set(navbar_changes);
    			if ((!current || dirty & /*team*/ 2) && t1_value !== (t1_value = /*getAlias*/ ctx[5](/*team*/ ctx[1]) + "")) set_data(t1, t1_value);

    			if (!current || dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div1, "color", "var(--" + (/*hyphenatedTeam*/ ctx[0] + '-secondary') + ")");
    			}

    			if (!current || dirty & /*hyphenatedTeam*/ 1 && a_href_value !== (a_href_value = "/" + /*hyphenatedTeam*/ ctx[0])) {
    				attr(a, "href", a_href_value);
    			}

    			if (!current || dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div2, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
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
    				if_block.m(div3, null);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div4);
    			destroy_component(navbar);
    			if_blocks[current_block_type_index].d();
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let title_value;
    	let meta;
    	let t;
    	let router;
    	let current;
    	document_1$1.title = title_value = /*team*/ ctx[1];

    	router = new Router({
    			props: {
    				$$slots: { default: [create_default_slot$3] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1x6khl2\"]', document_1$1.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h() {
    			attr(meta, "name", "description");
    			attr(meta, "content", "Premier League Statistics Dashboard");
    		},
    		m(target, anchor) {
    			append_hydration(document_1$1.head, meta);
    			insert_hydration(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if ((!current || dirty & /*team*/ 2) && title_value !== (title_value = /*team*/ ctx[1])) {
    				document_1$1.title = title_value;
    			}

    			const router_changes = {};

    			if (dirty & /*$$scope, data, hyphenatedTeam, team, playedMatchdays, currentMatchday*/ 2079) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			detach(meta);
    			if (detaching) detach(t);
    			destroy_component(router, detaching);
    		}
    	};
    }

    const showBadge = false;

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

    function instance$2($$self, $$props, $$invalidate) {
    	let alias = {
    		"Wolverhampton Wanderers": "Wolves",
    		"Tottenham Hotspur": "Spurs",
    		"Leeds United": "Leeds",
    		"West Ham United": "West Ham",
    		"Brighton and Hove Albion": "Brighton"
    	};

    	function getAlias(team) {
    		if (team in alias) {
    			return alias[team];
    		}

    		return team;
    	}

    	function getName(teamAlias) {
    		if (!Object.values(alias).includes(teamAlias)) {
    			return teamAlias;
    		}

    		return Object.keys(alias).find(key => alias[key] === teamAlias);
    	}

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
    		$$invalidate(1, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));

    		// fetchData("http://127.0.0.1:5000/api/teams")
    		fetchData$1("https://pldashboard.herokuapp.com/api/teams").then(json => {
    			// Build teamData package from json data
    			json.teamNames = Object.keys(json.fixtures);

    			$$invalidate(2, currentMatchday = getCurrentMatchday(json, team));
    			$$invalidate(3, playedMatchdays = getPlayedMatchdays(json, team));
    			$$invalidate(4, data = json);
    			console.log(data);
    		}).then(() => {
    			window.dispatchEvent(new Event("resize"));
    		});
    	}

    	function switchTeam(newTeam) {
    		$$invalidate(0, hyphenatedTeam = newTeam);
    		$$invalidate(1, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));
    		$$invalidate(2, currentMatchday = getCurrentMatchday(data, team));
    		$$invalidate(3, playedMatchdays = getPlayedMatchdays(data, team));
    		window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
    	}

    	let team = "";
    	let currentMatchday, playedMatchdays;
    	let data;

    	onMount(() => {
    		initDashboard();
    	});

    	let { hyphenatedTeam } = $$props;

    	$$self.$$set = $$props => {
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    	};

    	return [
    		hyphenatedTeam,
    		team,
    		currentMatchday,
    		playedMatchdays,
    		data,
    		getAlias,
    		getName,
    		teams,
    		switchTeam
    	];
    }

    class Team extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, { hyphenatedTeam: 0 });
    	}
    }

    /* src\routes\Home.svelte generated by Svelte v3.49.0 */

    function create_default_slot$2(ctx) {
    	let div4;
    	let div3;
    	let img;
    	let img_src_value;
    	let t0;
    	let div2;
    	let div0;
    	let a0;
    	let t1;
    	let t2;
    	let div1;
    	let a1;
    	let t3;

    	return {
    		c() {
    			div4 = element("div");
    			div3 = element("div");
    			img = element("img");
    			t0 = space();
    			div2 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			t1 = text("Dashboard");
    			t2 = space();
    			div1 = element("div");
    			a1 = element("a");
    			t3 = text("FPL");
    			this.h();
    		},
    		l(nodes) {
    			div4 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			img = claim_element(div3_nodes, "IMG", { src: true, alt: true, class: true });
    			t0 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a0 = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a0_nodes = children(a0);
    			t1 = claim_text(a0_nodes, "Dashboard");
    			a0_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
    			t2 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			a1 = claim_element(div1_nodes, "A", { class: true, href: true });
    			var a1_nodes = children(a1);
    			t3 = claim_text(a1_nodes, "FPL");
    			a1_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			div3_nodes.forEach(detach);
    			div4_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			if (!src_url_equal(img.src, img_src_value = "img/pldashboard4.png")) attr(img, "src", img_src_value);
    			attr(img, "alt", "pldashboard");
    			attr(img, "class", "svelte-nyqhdk");
    			attr(a0, "class", "dashboard-link svelte-nyqhdk");
    			attr(a0, "href", "/");
    			attr(div0, "class", "dashboard-link-container svelte-nyqhdk");
    			attr(a1, "class", "fantasy-link svelte-nyqhdk");
    			attr(a1, "href", "/");
    			attr(div1, "class", "fantasy-link-container svelte-nyqhdk");
    			attr(div2, "class", "links svelte-nyqhdk");
    			attr(div3, "class", "content svelte-nyqhdk");
    			attr(div4, "id", "home");
    			attr(div4, "class", "svelte-nyqhdk");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div4, anchor);
    			append_hydration(div4, div3);
    			append_hydration(div3, img);
    			append_hydration(div3, t0);
    			append_hydration(div3, div2);
    			append_hydration(div2, div0);
    			append_hydration(div0, a0);
    			append_hydration(a0, t1);
    			append_hydration(div2, t2);
    			append_hydration(div2, div1);
    			append_hydration(div1, a1);
    			append_hydration(a1, t3);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div4);
    		}
    	};
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
    			}
    		});

    	return {
    		c() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1rqatx0\"]', document.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h() {
    			document.title = "Premier League";
    			attr(meta, "name", "description");
    			attr(meta, "content", "Premier League Statistics Dashboard");
    		},
    		m(target, anchor) {
    			append_hydration(document.head, meta);
    			insert_hydration(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			detach(meta);
    			if (detaching) detach(t);
    			destroy_component(router, detaching);
    		}
    	};
    }

    class Home extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src\routes\Predictions.svelte generated by Svelte v3.49.0 */

    const { document: document_1 } = globals;

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

    // (187:2) {:else}
    function create_else_block_1(ctx) {
    	let div1;
    	let div0;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "loading-spinner");
    			attr(div1, "class", "loading-spinner-container");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    // (100:2) {#if data != undefined}
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
    	let t8;
    	let div7;
    	let div6;
    	let t9;
    	let if_block = /*data*/ ctx[0].predictions != null && create_if_block_1(ctx);

    	return {
    		c() {
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
    			t8 = space();
    			div7 = element("div");
    			div6 = element("div");
    			t9 = text("Predictions are calculated using previous results and then adjusting by\r\n        recent form and home advantage.");
    			this.h();
    		},
    		l(nodes) {
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
    			b0_nodes.forEach(detach);
    			span_nodes.forEach(detach);
    			br = claim_element(div1_nodes, "BR", {});
    			t3 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t4 = claim_text(div0_nodes, "General results accuracy: ");
    			b1 = claim_element(div0_nodes, "B", {});
    			var b1_nodes = children(b1);
    			t5 = claim_text(b1_nodes, t5_value);
    			t6 = claim_text(b1_nodes, "%");
    			b1_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			div2_nodes.forEach(detach);
    			t7 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			if (if_block) if_block.l(div3_nodes);
    			div3_nodes.forEach(detach);
    			div4_nodes.forEach(detach);
    			div5_nodes.forEach(detach);
    			t8 = claim_space(nodes);
    			div7 = claim_element(nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t9 = claim_text(div6_nodes, "Predictions are calculated using previous results and then adjusting by\r\n        recent form and home advantage.");
    			div6_nodes.forEach(detach);
    			div7_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(span, "class", "accuracy-item svelte-l0s73l");
    			attr(div0, "class", "accuracy-item svelte-l0s73l");
    			attr(div1, "class", "accuracy svelte-l0s73l");
    			attr(div2, "class", "accuracy-display svelte-l0s73l");
    			attr(div3, "class", "predictions svelte-l0s73l");
    			attr(div4, "class", "predictions-container svelte-l0s73l");
    			attr(div5, "class", "page-content svelte-l0s73l");
    			attr(div6, "class", "method-description svelte-l0s73l");
    			attr(div7, "class", "predictions-footer footer-text-colour svelte-l0s73l");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div5, anchor);
    			append_hydration(div5, div2);
    			append_hydration(div2, div1);
    			append_hydration(div1, span);
    			append_hydration(span, t0);
    			append_hydration(span, b0);
    			append_hydration(b0, t1);
    			append_hydration(b0, t2);
    			append_hydration(div1, br);
    			append_hydration(div1, t3);
    			append_hydration(div1, div0);
    			append_hydration(div0, t4);
    			append_hydration(div0, b1);
    			append_hydration(b1, t5);
    			append_hydration(b1, t6);
    			append_hydration(div5, t7);
    			append_hydration(div5, div4);
    			append_hydration(div4, div3);
    			if (if_block) if_block.m(div3, null);
    			insert_hydration(target, t8, anchor);
    			insert_hydration(target, div7, anchor);
    			append_hydration(div7, div6);
    			append_hydration(div6, t9);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t1_value !== (t1_value = (/*data*/ ctx[0].accuracy.scoreAccuracy * 100).toFixed(2) + "")) set_data(t1, t1_value);
    			if (dirty & /*data*/ 1 && t5_value !== (t5_value = (/*data*/ ctx[0].accuracy.resultAccuracy * 100).toFixed(2) + "")) set_data(t5, t5_value);

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
    		d(detaching) {
    			if (detaching) detach(div5);
    			if (if_block) if_block.d();
    			if (detaching) detach(t8);
    			if (detaching) detach(div7);
    		}
    	};
    }

    // (119:10) {#if data.predictions != null}
    function create_if_block_1(ctx) {
    	let each_1_anchor;
    	let each_value = /*data*/ ctx[0].predictions;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l(nodes) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data, toggleDetailsDisplay, datetimeToTime, Math*/ 1) {
    				each_value = /*data*/ ctx[0].predictions;
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
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (154:18) {:else}
    function create_else_block(ctx) {
    	let div;
    	let t_value = datetimeToTime(/*pred*/ ctx[6].datetime) + "";
    	let t;

    	return {
    		c() {
    			div = element("div");
    			t = text(t_value);
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, t_value);
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "prediction-time svelte-l0s73l");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t_value !== (t_value = datetimeToTime(/*pred*/ ctx[6].datetime) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (143:18) {#if pred.actual != null}
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

    	return {
    		c() {
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
    		l(nodes) {
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div0 = claim_element(div5_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, "Actual:");
    			div0_nodes.forEach(detach);
    			t1 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			div1_nodes.forEach(detach);
    			t3 = claim_space(div4_nodes);
    			div2 = claim_element(div4_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			t5 = claim_text(div2_nodes, " - ");
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach);
    			t7 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t8 = claim_text(div3_nodes, t8_value);
    			div3_nodes.forEach(detach);
    			div4_nodes.forEach(detach);
    			div5_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "prediction-label svelte-l0s73l");
    			attr(div1, "class", "prediction-initials svelte-l0s73l");
    			attr(div2, "class", "prediction-score svelte-l0s73l");
    			attr(div3, "class", "prediction-initials svelte-l0s73l");
    			attr(div4, "class", "prediction-value svelte-l0s73l");
    			attr(div5, "class", "actual prediction-item svelte-l0s73l");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div5, anchor);
    			append_hydration(div5, div0);
    			append_hydration(div0, t0);
    			append_hydration(div5, t1);
    			append_hydration(div5, div4);
    			append_hydration(div4, div1);
    			append_hydration(div1, t2);
    			append_hydration(div4, t3);
    			append_hydration(div4, div2);
    			append_hydration(div2, t4);
    			append_hydration(div2, t5);
    			append_hydration(div2, t6);
    			append_hydration(div4, t7);
    			append_hydration(div4, div3);
    			append_hydration(div3, t8);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[6].home + "")) set_data(t2, t2_value);
    			if (dirty & /*data*/ 1 && t4_value !== (t4_value = /*pred*/ ctx[6].actual.homeGoals + "")) set_data(t4, t4_value);
    			if (dirty & /*data*/ 1 && t6_value !== (t6_value = /*pred*/ ctx[6].actual.awayGoals + "")) set_data(t6, t6_value);
    			if (dirty & /*data*/ 1 && t8_value !== (t8_value = /*pred*/ ctx[6].away + "")) set_data(t8, t8_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div5);
    		}
    	};
    }

    // (161:18) {#if pred.prediction != null}
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

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			t2 = text(t2_value);
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true, id: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			b = claim_element(div0_nodes, "B", {});
    			var b_nodes = children(b);
    			t0 = claim_text(b_nodes, t0_value);
    			t1 = claim_text(b_nodes, " - ");
    			t2 = claim_text(b_nodes, t2_value);
    			b_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "detailed-predicted-score svelte-l0s73l");
    			attr(div1, "class", "prediction-details svelte-l0s73l");
    			attr(div1, "id", div1_id_value = /*pred*/ ctx[6]._id);
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			append_hydration(div0, b);
    			append_hydration(b, t0);
    			append_hydration(b, t1);
    			append_hydration(b, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*pred*/ ctx[6].prediction.homeGoals + "")) set_data(t0, t0_value);
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[6].prediction.awayGoals + "")) set_data(t2, t2_value);

    			if (dirty & /*data*/ 1 && div1_id_value !== (div1_id_value = /*pred*/ ctx[6]._id)) {
    				attr(div1, "id", div1_id_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    // (126:14) {#each predictions as pred}
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

    	return {
    		c() {
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
    		l(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			div5 = claim_element(button_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div0 = claim_element(div5_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, "Predicted:");
    			div0_nodes.forEach(detach);
    			t1 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			div1_nodes.forEach(detach);
    			t3 = claim_space(div4_nodes);
    			div2 = claim_element(div4_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			t5 = claim_text(div2_nodes, " - ");
    			t6 = claim_text(div2_nodes, t6_value);
    			div2_nodes.forEach(detach);
    			t7 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t8 = claim_text(div3_nodes, t8_value);
    			div3_nodes.forEach(detach);
    			div4_nodes.forEach(detach);
    			div5_nodes.forEach(detach);
    			t9 = claim_space(button_nodes);
    			if_block0.l(button_nodes);
    			t10 = claim_space(button_nodes);
    			if (if_block1) if_block1.l(button_nodes);
    			button_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "prediction-label svelte-l0s73l");
    			attr(div1, "class", "prediction-initials svelte-l0s73l");
    			attr(div2, "class", "prediction-score svelte-l0s73l");
    			attr(div3, "class", "prediction-initials svelte-l0s73l");
    			attr(div4, "class", "prediction-value svelte-l0s73l");
    			attr(div5, "class", "prediction prediction-item svelte-l0s73l");
    			attr(button, "class", button_class_value = "prediction-container " + /*pred*/ ctx[6].colour + " svelte-l0s73l");
    		},
    		m(target, anchor) {
    			insert_hydration(target, button, anchor);
    			append_hydration(button, div5);
    			append_hydration(div5, div0);
    			append_hydration(div0, t0);
    			append_hydration(div5, t1);
    			append_hydration(div5, div4);
    			append_hydration(div4, div1);
    			append_hydration(div1, t2);
    			append_hydration(div4, t3);
    			append_hydration(div4, div2);
    			append_hydration(div2, t4);
    			append_hydration(div2, t5);
    			append_hydration(div2, t6);
    			append_hydration(div4, t7);
    			append_hydration(div4, div3);
    			append_hydration(div3, t8);
    			append_hydration(button, t9);
    			if_block0.m(button, null);
    			append_hydration(button, t10);
    			if (if_block1) if_block1.m(button, null);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[6].home + "")) set_data(t2, t2_value);
    			if (dirty & /*data*/ 1 && t4_value !== (t4_value = Math.round(/*pred*/ ctx[6].prediction.homeGoals) + "")) set_data(t4, t4_value);
    			if (dirty & /*data*/ 1 && t6_value !== (t6_value = Math.round(/*pred*/ ctx[6].prediction.awayGoals) + "")) set_data(t6, t6_value);
    			if (dirty & /*data*/ 1 && t8_value !== (t8_value = /*pred*/ ctx[6].away + "")) set_data(t8, t8_value);

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

    			if (dirty & /*data*/ 1 && button_class_value !== (button_class_value = "prediction-container " + /*pred*/ ctx[6].colour + " svelte-l0s73l")) {
    				attr(button, "class", button_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (120:12) {#each data.predictions as { _id, predictions }}
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
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
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
    		l(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			children(div1).forEach(detach);
    			t2 = claim_space(nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			t3 = claim_space(nodes);
    			div2 = claim_element(nodes, "DIV", { class: true });
    			children(div2).forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div0, "class", "date svelte-l0s73l");
    			attr(div1, "class", "medium-predictions-divider svelte-l0s73l");
    			attr(div2, "class", "predictions-gap svelte-l0s73l");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div0, anchor);
    			append_hydration(div0, t0);
    			insert_hydration(target, t1, anchor);
    			insert_hydration(target, div1, anchor);
    			insert_hydration(target, t2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration(target, t3, anchor);
    			insert_hydration(target, div2, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*_id*/ ctx[2] + "")) set_data(t0, t0_value);

    			if (dirty & /*data, toggleDetailsDisplay, datetimeToTime, Math*/ 1) {
    				each_value_1 = /*predictions*/ ctx[3];
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
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			if (detaching) detach(t2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(div2);
    		}
    	};
    }

    // (90:0) <Router>
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

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			a = element("a");
    			t0 = text("Predictions");
    			t1 = space();
    			if_block.c();
    			this.h();
    		},
    		l(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a = claim_element(div0_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, "Predictions");
    			a_nodes.forEach(detach);
    			div0_nodes.forEach(detach);
    			t1 = claim_space(div1_nodes);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(a, "class", "predictions-title svelte-l0s73l");
    			attr(a, "href", "/predictions");
    			attr(div0, "class", "predictions-header svelte-l0s73l");
    			attr(div1, "id", "predictions");
    			attr(div1, "class", "svelte-l0s73l");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div1, anchor);
    			append_hydration(div1, div0);
    			append_hydration(div0, a);
    			append_hydration(a, t0);
    			append_hydration(div1, t1);
    			if_block.m(div1, null);
    		},
    		p(ctx, dirty) {
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
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_block.d();
    		}
    	};
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
    			}
    		});

    	return {
    		c() {
    			meta = element("meta");
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1w56yuh\"]', document_1.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h() {
    			document_1.title = "Predictions";
    			attr(meta, "name", "description");
    			attr(meta, "content", "Premier League Statistics Dashboard");
    		},
    		m(target, anchor) {
    			append_hydration(document_1.head, meta);
    			insert_hydration(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope, data*/ 513) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			detach(meta);
    			if (detaching) detach(t);
    			destroy_component(router, detaching);
    		}
    	};
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

    function instance$1($$self, $$props, $$invalidate) {
    	let data;

    	onMount(() => {
    		// fetchData("http://127.0.0.1:5000/api/predictions").then((json) => {
    		fetchData("https://pldashboard.herokuapp.com/api/predictions").then(json => {
    			sortByDate(json);
    			insertColours(json);
    			$$invalidate(0, data = json);
    			console.log(data.predictions);
    		});
    	});

    	const click_handler = pred => toggleDetailsDisplay(pred._id);
    	return [data, click_handler];
    }

    class Predictions extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\App.svelte generated by Svelte v3.49.0 */

    function create_default_slot_2(ctx) {
    	let team;
    	let current;

    	team = new Team({
    			props: { hyphenatedTeam: "manchester-city" }
    		});

    	return {
    		c() {
    			create_component(team.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(team.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(team, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(team.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(team.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(team, detaching);
    		}
    	};
    }

    // (17:2) <Route path="/:team" let:params>
    function create_default_slot_1(ctx) {
    	let team;
    	let current;

    	team = new Team({
    			props: { hyphenatedTeam: /*params*/ ctx[1].team }
    		});

    	return {
    		c() {
    			create_component(team.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(team.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(team, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const team_changes = {};
    			if (dirty & /*params*/ 2) team_changes.hyphenatedTeam = /*params*/ ctx[1].team;
    			team.$set(team_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(team.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(team.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(team, detaching);
    		}
    	};
    }

    // (12:0) <Router {url}>
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
    			}
    		});

    	route1 = new Route({
    			props: {
    				path: "/predictions",
    				component: Predictions
    			}
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
    			}
    		});

    	route3 = new Route({
    			props: { path: "/teams", component: Teams }
    		});

    	route4 = new Route({
    			props: { path: "/home", component: Home }
    		});

    	return {
    		c() {
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
    		l(nodes) {
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
    		m(target, anchor) {
    			mount_component(route0, target, anchor);
    			insert_hydration(target, t0, anchor);
    			mount_component(route1, target, anchor);
    			insert_hydration(target, t1, anchor);
    			mount_component(route2, target, anchor);
    			insert_hydration(target, t2, anchor);
    			mount_component(route3, target, anchor);
    			insert_hydration(target, t3, anchor);
    			mount_component(route4, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
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
    		i(local) {
    			if (current) return;
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(route0, detaching);
    			if (detaching) detach(t0);
    			destroy_component(route1, detaching);
    			if (detaching) detach(t1);
    			destroy_component(route2, detaching);
    			if (detaching) detach(t2);
    			destroy_component(route3, detaching);
    			if (detaching) detach(t3);
    			destroy_component(route4, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(router.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(router.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope*/ 4) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(router, detaching);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { url = "" } = $$props;

    	$$self.$$set = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	return [url];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { url: 0 });
    	}
    }

    new App({
      target: document.getElementById("app"),
      hydrate: true
    });

})();
//# sourceMappingURL=bundle.js.map
