
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
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
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

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.50.1' }, detail), { bubbles: true }));
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
     * Combines the `basepath` and the `path` into one path.
     * @param {string} basepath
     * @param {string} path
     */
    function combinePaths(basepath, path) {
      return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
    }

    /* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.50.1 */

    function create_fragment$s(ctx) {
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
    		id: create_fragment$s.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$s($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$s, create_fragment$s, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$s.name
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

    /* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.50.1 */

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
    	const if_block_creators = [create_if_block_1$8, create_else_block$7];
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
    		id: create_if_block$c.name,
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
    function create_if_block_1$8(ctx) {
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
    		id: create_if_block_1$8.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$r(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block$c(ctx);

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
    		id: create_fragment$r.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$r($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$r, create_fragment$r, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$r.name
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

    /* src\components\team\current_form\FormTiles.svelte generated by Svelte v3.50.1 */

    const file$p = "src\\components\\team\\current_form\\FormTiles.svelte";

    function create_fragment$q(ctx) {
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
    			attr_dev(div0, "class", "result svelte-16nvusq");
    			add_location(div0, file$p, 32, 4, 800);
    			attr_dev(div1, "id", "formTile");
    			set_style(div1, "background", background(/*form*/ ctx[0][0], /*starTeams*/ ctx[1][0]));
    			attr_dev(div1, "class", "svelte-16nvusq");
    			add_location(div1, file$p, 31, 2, 719);
    			attr_dev(div2, "class", "icon pos-0 svelte-16nvusq");
    			add_location(div2, file$p, 30, 0, 691);
    			attr_dev(div3, "class", "result svelte-16nvusq");
    			add_location(div3, file$p, 39, 4, 992);
    			attr_dev(div4, "id", "formTile");
    			set_style(div4, "background", background(/*form*/ ctx[0][1], /*starTeams*/ ctx[1][1]));
    			attr_dev(div4, "class", "svelte-16nvusq");
    			add_location(div4, file$p, 38, 2, 911);
    			attr_dev(div5, "class", "icon pos-1 svelte-16nvusq");
    			add_location(div5, file$p, 37, 0, 883);
    			attr_dev(div6, "class", "result svelte-16nvusq");
    			add_location(div6, file$p, 46, 4, 1184);
    			attr_dev(div7, "id", "formTile");
    			set_style(div7, "background", background(/*form*/ ctx[0][2], /*starTeams*/ ctx[1][2]));
    			attr_dev(div7, "class", "svelte-16nvusq");
    			add_location(div7, file$p, 45, 2, 1103);
    			attr_dev(div8, "class", "icon pos-2 svelte-16nvusq");
    			add_location(div8, file$p, 44, 0, 1075);
    			attr_dev(div9, "class", "result svelte-16nvusq");
    			add_location(div9, file$p, 53, 4, 1376);
    			attr_dev(div10, "id", "formTile");
    			set_style(div10, "background", background(/*form*/ ctx[0][3], /*starTeams*/ ctx[1][3]));
    			attr_dev(div10, "class", "svelte-16nvusq");
    			add_location(div10, file$p, 52, 2, 1295);
    			attr_dev(div11, "class", "icon pos-3 svelte-16nvusq");
    			add_location(div11, file$p, 51, 0, 1267);
    			attr_dev(div12, "class", "result svelte-16nvusq");
    			add_location(div12, file$p, 60, 4, 1568);
    			attr_dev(div13, "id", "formTile");
    			set_style(div13, "background", background(/*form*/ ctx[0][4], /*starTeams*/ ctx[1][4]));
    			attr_dev(div13, "class", "svelte-16nvusq");
    			add_location(div13, file$p, 59, 2, 1487);
    			attr_dev(div14, "class", "icon pos-4 svelte-16nvusq");
    			add_location(div14, file$p, 58, 0, 1459);
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
    		id: create_fragment$q.name,
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

    function instance$q($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$q, create_fragment$q, safe_not_equal, { form: 0, starTeams: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormTiles",
    			options,
    			id: create_fragment$q.name
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
    function toName(teamAlias) {
        if (!Object.values(alias).includes(teamAlias)) {
            return teamAlias;
        }
        return Object.keys(alias).find((key) => alias[key] === teamAlias);
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
        return null;
    }

    /* src\components\team\current_form\CurrentForm.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$d } = globals;
    const file$o = "src\\components\\team\\current_form\\CurrentForm.svelte";

    // (68:0) {#if formInitials != undefined}
    function create_if_block_1$7(ctx) {
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
    			attr_dev(div0, "class", "current-form-row icon-row svelte-xtjb4h");
    			add_location(div0, file$o, 68, 2, 2470);
    			attr_dev(div1, "class", "icon-name pos-0 svelte-xtjb4h");
    			add_location(div1, file$o, 72, 4, 2631);
    			attr_dev(div2, "class", "icon-name pos-1 svelte-xtjb4h");
    			add_location(div2, file$o, 73, 4, 2689);
    			attr_dev(div3, "class", "icon-name pos-2 svelte-xtjb4h");
    			add_location(div3, file$o, 74, 4, 2747);
    			attr_dev(div4, "class", "icon-name pos-3 svelte-xtjb4h");
    			add_location(div4, file$o, 75, 4, 2805);
    			attr_dev(div5, "class", "icon-name pos-4 svelte-xtjb4h");
    			add_location(div5, file$o, 76, 4, 2863);
    			attr_dev(div6, "class", "current-form-row name-row svelte-xtjb4h");
    			add_location(div6, file$o, 71, 2, 2586);
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
    		id: create_if_block_1$7.name,
    		type: "if",
    		source: "(68:0) {#if formInitials != undefined}",
    		ctx
    	});

    	return block;
    }

    // (84:2) {:else}
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
    		source: "(84:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (82:2) {#if currentMatchday != undefined}
    function create_if_block$b(ctx) {
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
    			attr_dev(span, "class", "current-form-value svelte-xtjb4h");
    			add_location(span, file$o, 82, 4, 3021);
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
    		id: create_if_block$b.name,
    		type: "if",
    		source: "(82:2) {#if currentMatchday != undefined}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$p(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let current;
    	let if_block0 = /*formInitials*/ ctx[5] != undefined && create_if_block_1$7(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*currentMatchday*/ ctx[1] != undefined) return create_if_block$b;
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
    			attr_dev(div, "class", "current-form svelte-xtjb4h");
    			add_location(div, file$o, 79, 0, 2934);
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
    					if_block0 = create_if_block_1$7(ctx);
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
    		id: create_fragment$p.name,
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

    function instance$p($$self, $$props, $$invalidate) {
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
    	let { data, currentMatchday, team } = $$props;
    	const writable_props = ['data', 'currentMatchday', 'team'];

    	Object_1$d.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CurrentForm> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    	};

    	$$self.$capture_state = () => ({
    		FormTiles,
    		toInitials,
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
    		team
    	});

    	$$self.$inject_state = $$props => {
    		if ('formIcons' in $$props) $$invalidate(3, formIcons = $$props.formIcons);
    		if ('formStarTeams' in $$props) $$invalidate(4, formStarTeams = $$props.formStarTeams);
    		if ('formInitials' in $$props) $$invalidate(5, formInitials = $$props.formInitials);
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('currentMatchday' in $$props) $$invalidate(1, currentMatchday = $$props.currentMatchday);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 4) {
    			team && setFormValues();
    		}
    	};

    	return [data, currentMatchday, team, formIcons, formStarTeams, formInitials];
    }

    class CurrentForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$p, create_fragment$p, safe_not_equal, { data: 0, currentMatchday: 1, team: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CurrentForm",
    			options,
    			id: create_fragment$p.name
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
    }

    /* src\components\team\TableSnippet.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$c } = globals;
    const file$n = "src\\components\\team\\TableSnippet.svelte";

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	child_ctx[9] = i;
    	return child_ctx;
    }

    // (48:2) {#if tableSnippet != undefined}
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
    	let each_value = /*tableSnippet*/ ctx[2].rows;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$6(get_each_context$6(ctx, each_value, i));
    	}

    	let if_block = /*tableSnippet*/ ctx[2].teamTableIdx != 6 && create_if_block_1$6(ctx);

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
    			add_location(div0, file$n, 48, 4, 1577);
    			attr_dev(div1, "class", "table-element table-position column-title svelte-1sscurl");
    			add_location(div1, file$n, 50, 6, 1637);
    			attr_dev(div2, "class", "table-element table-team-name column-title svelte-1sscurl");
    			add_location(div2, file$n, 51, 6, 1702);
    			attr_dev(div3, "class", "table-element table-gd column-title svelte-1sscurl");
    			add_location(div3, file$n, 52, 6, 1776);
    			attr_dev(div4, "class", "table-element table-points column-title svelte-1sscurl");
    			add_location(div4, file$n, 53, 6, 1841);
    			attr_dev(div5, "class", "table-row svelte-1sscurl");
    			add_location(div5, file$n, 49, 4, 1606);
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
    			if (dirty & /*hyphenatedTeam, tableSnippet, toAlias, switchTeam, toHyphenatedName*/ 7) {
    				each_value = /*tableSnippet*/ ctx[2].rows;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$6(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$6(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t8.parentNode, t8);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (/*tableSnippet*/ ctx[2].teamTableIdx != 6) {
    				if (if_block) ; else {
    					if_block = create_if_block_1$6(ctx);
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
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(48:2) {#if tableSnippet != undefined}",
    		ctx
    	});

    	return block;
    }

    // (63:85) 
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
    			attr_dev(div, "class", "svelte-1sscurl");
    			add_location(div, file$n, 63, 8, 2195);
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
    		source: "(63:85) ",
    		ctx
    	});

    	return block;
    }

    // (59:6) {#if i == 0}
    function create_if_block_3$4(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[9] != /*tableSnippet*/ ctx[2].teamTableIdx && create_if_block_4(ctx);

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
    			if (/*i*/ ctx[9] != /*tableSnippet*/ ctx[2].teamTableIdx) {
    				if (if_block) ; else {
    					if_block = create_if_block_4(ctx);
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
    		source: "(59:6) {#if i == 0}",
    		ctx
    	});

    	return block;
    }

    // (60:8) {#if i != tableSnippet.teamTableIdx}
    function create_if_block_4(ctx) {
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
    			attr_dev(div, "class", "svelte-1sscurl");
    			add_location(div, file$n, 60, 10, 2063);
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
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(60:8) {#if i != tableSnippet.teamTableIdx}",
    		ctx
    	});

    	return block;
    }

    // (99:6) {:else}
    function create_else_block$5(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*row*/ ctx[7].position + "";
    	let t0;
    	let t1;
    	let button;
    	let t2_value = toAlias(/*row*/ ctx[7].name) + "";
    	let t2;
    	let t3;
    	let div1;
    	let t4_value = /*row*/ ctx[7].gd + "";
    	let t4;
    	let t5;
    	let div2;
    	let t6_value = /*row*/ ctx[7].points + "";
    	let t6;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*row*/ ctx[7]);
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
    			attr_dev(div0, "class", "table-element table-position svelte-1sscurl");
    			add_location(div0, file$n, 101, 10, 3414);
    			attr_dev(button, "class", "table-element table-team-name svelte-1sscurl");
    			add_location(button, file$n, 104, 10, 3514);
    			attr_dev(div1, "class", "table-element table-gd svelte-1sscurl");
    			add_location(div1, file$n, 110, 10, 3724);
    			attr_dev(div2, "class", "table-element table-points svelte-1sscurl");
    			add_location(div2, file$n, 113, 10, 3812);
    			attr_dev(div3, "class", "table-row svelte-1sscurl");
    			add_location(div3, file$n, 100, 8, 3379);
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
    			if (dirty & /*tableSnippet*/ 4 && t0_value !== (t0_value = /*row*/ ctx[7].position + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*tableSnippet*/ 4 && t2_value !== (t2_value = toAlias(/*row*/ ctx[7].name) + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*tableSnippet*/ 4 && t4_value !== (t4_value = /*row*/ ctx[7].gd + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*tableSnippet*/ 4 && t6_value !== (t6_value = /*row*/ ctx[7].points + "")) set_data_dev(t6, t6_value);
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
    		source: "(99:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (67:6) {#if i == tableSnippet.teamTableIdx}
    function create_if_block_2$4(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*row*/ ctx[7].position + "";
    	let t0;
    	let t1;
    	let a;
    	let t2_value = toAlias(/*row*/ ctx[7].name) + "";
    	let t2;
    	let a_href_value;
    	let t3;
    	let div1;
    	let t4_value = /*row*/ ctx[7].gd + "";
    	let t4;
    	let t5;
    	let div2;
    	let t6_value = /*row*/ ctx[7].points + "";
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
    			attr_dev(div0, "class", "table-element table-position this-team svelte-1sscurl");
    			set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div0, file$n, 72, 10, 2506);
    			attr_dev(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			attr_dev(a, "class", "table-element table-team-name this-team svelte-1sscurl");
    			set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(a, file$n, 78, 10, 2704);
    			attr_dev(div1, "class", "table-element table-gd this-team svelte-1sscurl");
    			set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div1, file$n, 85, 10, 2942);
    			attr_dev(div2, "class", "table-element table-points this-team svelte-1sscurl");
    			set_style(div2, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div2, file$n, 91, 10, 3128);
    			attr_dev(div3, "class", "table-row this-team svelte-1sscurl");
    			set_style(div3, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(div3, file$n, 68, 8, 2378);
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
    			if (dirty & /*tableSnippet*/ 4 && t0_value !== (t0_value = /*row*/ ctx[7].position + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*tableSnippet*/ 4 && t2_value !== (t2_value = toAlias(/*row*/ ctx[7].name) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*hyphenatedTeam*/ 1 && a_href_value !== (a_href_value = "/" + /*hyphenatedTeam*/ ctx[0])) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*tableSnippet*/ 4 && t4_value !== (t4_value = /*row*/ ctx[7].gd + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*hyphenatedTeam*/ 1) {
    				set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			}

    			if (dirty & /*tableSnippet*/ 4 && t6_value !== (t6_value = /*row*/ ctx[7].points + "")) set_data_dev(t6, t6_value);

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
    		id: create_if_block_2$4.name,
    		type: "if",
    		source: "(67:6) {#if i == tableSnippet.teamTableIdx}",
    		ctx
    	});

    	return block;
    }

    // (57:4) {#each tableSnippet.rows as row, i}
    function create_each_block$6(ctx) {
    	let t;
    	let if_block1_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[9] == 0) return create_if_block_3$4;
    		if (/*i*/ ctx[9] - 1 != /*tableSnippet*/ ctx[2].teamTableIdx && /*i*/ ctx[9] != /*tableSnippet*/ ctx[2].teamTableIdx) return create_if_block_5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*i*/ ctx[9] == /*tableSnippet*/ ctx[2].teamTableIdx) return create_if_block_2$4;
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
    		id: create_each_block$6.name,
    		type: "each",
    		source: "(57:4) {#each tableSnippet.rows as row, i}",
    		ctx
    	});

    	return block;
    }

    // (120:4) {#if tableSnippet.teamTableIdx != 6}
    function create_if_block_1$6(ctx) {
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
    			attr_dev(div, "class", "svelte-1sscurl");
    			add_location(div, file$n, 120, 6, 3988);
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
    		id: create_if_block_1$6.name,
    		type: "if",
    		source: "(120:4) {#if tableSnippet.teamTableIdx != 6}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$o(ctx) {
    	let div;
    	let if_block = /*tableSnippet*/ ctx[2] != undefined && create_if_block$a(ctx);

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
    			attr_dev(div, "class", "table-snippet svelte-1sscurl");
    			add_location(div, file$n, 46, 0, 1509);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*tableSnippet*/ ctx[2] != undefined) {
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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
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

    function instance$o($$self, $$props, $$invalidate) {
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

    		$$invalidate(2, tableSnippet = { teamTableIdx, rows });
    	}

    	let tableSnippet;
    	let { data, hyphenatedTeam, team, switchTeam } = $$props;
    	const writable_props = ['data', 'hyphenatedTeam', 'team', 'switchTeam'];

    	Object_1$c.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TableSnippet> was created with unknown prop '${key}'`);
    	});

    	const click_handler = row => {
    		switchTeam(toHyphenatedName(row.name));
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(3, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('team' in $$props) $$invalidate(4, team = $$props.team);
    		if ('switchTeam' in $$props) $$invalidate(1, switchTeam = $$props.switchTeam);
    	};

    	$$self.$capture_state = () => ({
    		toAlias,
    		toHyphenatedName,
    		tableSnippetRange,
    		buildTableSnippet,
    		tableSnippet,
    		data,
    		hyphenatedTeam,
    		team,
    		switchTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('tableSnippet' in $$props) $$invalidate(2, tableSnippet = $$props.tableSnippet);
    		if ('data' in $$props) $$invalidate(3, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('team' in $$props) $$invalidate(4, team = $$props.team);
    		if ('switchTeam' in $$props) $$invalidate(1, switchTeam = $$props.switchTeam);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 16) {
    			team && buildTableSnippet();
    		}
    	};

    	return [hyphenatedTeam, switchTeam, tableSnippet, data, team, click_handler];
    }

    class TableSnippet extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$o, create_fragment$o, safe_not_equal, {
    			data: 3,
    			hyphenatedTeam: 0,
    			team: 4,
    			switchTeam: 1
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TableSnippet",
    			options,
    			id: create_fragment$o.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[3] === undefined && !('data' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'data'");
    		}

    		if (/*hyphenatedTeam*/ ctx[0] === undefined && !('hyphenatedTeam' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'hyphenatedTeam'");
    		}

    		if (/*team*/ ctx[4] === undefined && !('team' in props)) {
    			console.warn("<TableSnippet> was created without expected prop 'team'");
    		}

    		if (/*switchTeam*/ ctx[1] === undefined && !('switchTeam' in props)) {
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

    	get switchTeam() {
    		throw new Error("<TableSnippet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchTeam(value) {
    		throw new Error("<TableSnippet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function ordinal(n) {
        let ord = [, "st", "nd", "rd"];
        let a = n % 100;
        return ord[a > 20 ? a % 10 : a] || "th";
    }
    function teamStyle(team) {
        let hyphenatedName = toHyphenatedName(team);
        return `background: var(--${hyphenatedName}); color: var(--${hyphenatedName}-secondary);`;
    }

    /* src\components\team\NextGame.svelte generated by Svelte v3.50.1 */
    const file$m = "src\\components\\team\\NextGame.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (22:2) {:else}
    function create_else_block$4(ctx) {
    	let div10;
    	let div0;
    	let h1;
    	let t0;
    	let button;
    	let t1_value = toAlias(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam) + "";
    	let t1;
    	let t2;
    	let t3;

    	let t4_value = (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].atHome
    	? "Home"
    	: "Away") + "";

    	let t4;
    	let t5;
    	let t6;
    	let div9;
    	let div7;
    	let div1;
    	let t7;
    	let div6;
    	let div3;
    	let div2;
    	let t8_value = /*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id].position + "";
    	let t8;
    	let span0;
    	let t9_value = ordinal(/*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id].position) + "";
    	let t9;
    	let t10;
    	let div4;
    	let t11;
    	let span1;
    	let t12_value = (/*data*/ ctx[0].form[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id][currentMatchday(/*data*/ ctx[0], /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam)].formRating5 * 100).toFixed(1) + "";
    	let t12;
    	let t13;
    	let t14;
    	let div5;
    	let t15;
    	let br0;
    	let t16;
    	let a;
    	let b;
    	let t17_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.homeGoals) + "";
    	let t17;
    	let t18;
    	let t19_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.awayGoals) + "";
    	let t19;
    	let t20;
    	let br1;
    	let t21;
    	let div8;
    	let t22;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches.length == 0) return create_if_block_1$5;
    		return create_else_block_1$3;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div10 = element("div");
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
    			div9 = element("div");
    			div7 = element("div");
    			div1 = element("div");
    			t7 = space();
    			div6 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			t8 = text(t8_value);
    			span0 = element("span");
    			t9 = text(t9_value);
    			t10 = space();
    			div4 = element("div");
    			t11 = text("Current form:\r\n                ");
    			span1 = element("span");
    			t12 = text(t12_value);
    			t13 = text("%");
    			t14 = space();
    			div5 = element("div");
    			t15 = text("Score prediction\r\n              ");
    			br0 = element("br");
    			t16 = space();
    			a = element("a");
    			b = element("b");
    			t17 = text(t17_value);
    			t18 = text(" - ");
    			t19 = text(t19_value);
    			t20 = space();
    			br1 = element("br");
    			t21 = space();
    			div8 = element("div");
    			if_block.c();
    			t22 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div10 = claim_element(nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div0 = claim_element(div10_nodes, "DIV", { class: true });
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
    			t6 = claim_space(div10_nodes);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div7 = claim_element(div9_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div1 = claim_element(div7_nodes, "DIV", { class: true });
    			children(div1).forEach(detach_dev);
    			t7 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div3 = claim_element(div6_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t8 = claim_text(div2_nodes, t8_value);
    			span0 = claim_element(div2_nodes, "SPAN", { class: true });
    			var span0_nodes = children(span0);
    			t9 = claim_text(span0_nodes, t9_value);
    			span0_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t10 = claim_space(div6_nodes);
    			div4 = claim_element(div6_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t11 = claim_text(div4_nodes, "Current form:\r\n                ");
    			span1 = claim_element(div4_nodes, "SPAN", { class: true });
    			var span1_nodes = children(span1);
    			t12 = claim_text(span1_nodes, t12_value);
    			t13 = claim_text(span1_nodes, "%");
    			span1_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t14 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t15 = claim_text(div5_nodes, "Score prediction\r\n              ");
    			br0 = claim_element(div5_nodes, "BR", {});
    			t16 = claim_space(div5_nodes);
    			a = claim_element(div5_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			b = claim_element(a_nodes, "B", {});
    			var b_nodes = children(b);
    			t17 = claim_text(b_nodes, t17_value);
    			t18 = claim_text(b_nodes, " - ");
    			t19 = claim_text(b_nodes, t19_value);
    			b_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			t20 = claim_space(div5_nodes);
    			br1 = claim_element(div5_nodes, "BR", {});
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t21 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			if_block.l(div8_nodes);
    			t22 = claim_space(div8_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div8_nodes);
    			}

    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "next-game-team-btn svelte-413w6e");
    			add_location(button, file$m, 26, 10, 941);
    			attr_dev(h1, "class", "next-game-title-text svelte-413w6e");
    			add_location(h1, file$m, 24, 8, 869);
    			attr_dev(div0, "class", "next-game-title svelte-413w6e");
    			add_location(div0, file$m, 23, 6, 830);
    			attr_dev(div1, "class", "next-game-position svelte-413w6e");
    			add_location(div1, file$m, 39, 10, 1375);
    			attr_dev(span0, "class", "ordinal-position svelte-413w6e");
    			add_location(span0, file$m, 44, 28, 1639);
    			attr_dev(div2, "class", "next-game-position svelte-413w6e");
    			add_location(div2, file$m, 42, 14, 1504);
    			attr_dev(div3, "class", "next-game-item svelte-413w6e");
    			add_location(div3, file$m, 41, 12, 1460);
    			attr_dev(span1, "class", "current-form-value svelte-413w6e");
    			add_location(span1, file$m, 54, 16, 1999);
    			attr_dev(div4, "class", "next-game-item current-form svelte-413w6e");
    			add_location(div4, file$m, 52, 12, 1911);
    			add_location(br0, file$m, 64, 14, 2411);
    			add_location(b, file$m, 66, 16, 2499);
    			attr_dev(a, "class", "predictions-link svelte-413w6e");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file$m, 65, 14, 2433);
    			add_location(br1, file$m, 72, 14, 2733);
    			attr_dev(div5, "class", "next-game-item svelte-413w6e");
    			add_location(div5, file$m, 62, 12, 2335);
    			attr_dev(div6, "class", "predictions");
    			add_location(div6, file$m, 40, 10, 1421);
    			attr_dev(div7, "class", "predictions-and-logo svelte-413w6e");
    			add_location(div7, file$m, 38, 8, 1329);
    			attr_dev(div8, "class", "past-results svelte-413w6e");
    			add_location(div8, file$m, 76, 8, 2803);
    			attr_dev(div9, "class", "next-game-values svelte-413w6e");
    			add_location(div9, file$m, 37, 6, 1289);
    			attr_dev(div10, "class", "next-game-prediction svelte-413w6e");
    			add_location(div10, file$m, 22, 4, 788);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div10, anchor);
    			append_hydration_dev(div10, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(h1, button);
    			append_hydration_dev(button, t1);
    			append_hydration_dev(button, t2);
    			append_hydration_dev(h1, t3);
    			append_hydration_dev(h1, t4);
    			append_hydration_dev(h1, t5);
    			append_hydration_dev(div10, t6);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div7);
    			append_hydration_dev(div7, div1);
    			append_hydration_dev(div7, t7);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, t8);
    			append_hydration_dev(div2, span0);
    			append_hydration_dev(span0, t9);
    			append_hydration_dev(div6, t10);
    			append_hydration_dev(div6, div4);
    			append_hydration_dev(div4, t11);
    			append_hydration_dev(div4, span1);
    			append_hydration_dev(span1, t12);
    			append_hydration_dev(span1, t13);
    			append_hydration_dev(div6, t14);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, t15);
    			append_hydration_dev(div5, br0);
    			append_hydration_dev(div5, t16);
    			append_hydration_dev(div5, a);
    			append_hydration_dev(a, b);
    			append_hydration_dev(b, t17);
    			append_hydration_dev(b, t18);
    			append_hydration_dev(b, t19);
    			append_hydration_dev(div5, t20);
    			append_hydration_dev(div5, br1);
    			append_hydration_dev(div9, t21);
    			append_hydration_dev(div9, div8);
    			if_block.m(div8, null);
    			append_hydration_dev(div8, t22);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div8, null);
    			}

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, team*/ 3 && t1_value !== (t1_value = toAlias(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam) + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*data, team*/ 3 && t4_value !== (t4_value = (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].atHome
    			? "Home"
    			: "Away") + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*data, team*/ 3 && t8_value !== (t8_value = /*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id].position + "")) set_data_dev(t8, t8_value);
    			if (dirty & /*data, team*/ 3 && t9_value !== (t9_value = ordinal(/*data*/ ctx[0].standings[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id].position) + "")) set_data_dev(t9, t9_value);
    			if (dirty & /*data, team*/ 3 && t12_value !== (t12_value = (/*data*/ ctx[0].form[/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam][/*data*/ ctx[0]._id][currentMatchday(/*data*/ ctx[0], /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam)].formRating5 * 100).toFixed(1) + "")) set_data_dev(t12, t12_value);
    			if (dirty & /*data, team*/ 3 && t17_value !== (t17_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.homeGoals) + "")) set_data_dev(t17, t17_value);
    			if (dirty & /*data, team*/ 3 && t19_value !== (t19_value = Math.round(/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction.awayGoals) + "")) set_data_dev(t19, t19_value);

    			if (current_block_type !== (current_block_type = select_block_type_1(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div8, t22);
    				}
    			}

    			if (dirty & /*teamStyle, data, team, toInitials, resultColour, Date*/ 3) {
    				each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$5(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$5(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div8, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			if_block.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(22:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (14:2) {#if data.upcoming[team].nextTeam == null}
    function create_if_block$9(ctx) {
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
    			attr_dev(h1, "class", "next-game-title-text svelte-413w6e");
    			add_location(h1, file$m, 16, 8, 644);
    			attr_dev(div0, "class", "next-game-season-complete svelte-413w6e");
    			add_location(div0, file$m, 15, 6, 595);
    			attr_dev(div1, "class", "next-game-prediction svelte-413w6e");
    			add_location(div1, file$m, 14, 4, 553);
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
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(14:2) {#if data.upcoming[team].nextTeam == null}",
    		ctx
    	});

    	return block;
    }

    // (82:10) {:else}
    function create_else_block_1$3(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("Previous results");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "Previous results");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "next-game-item prev-results-title svelte-413w6e");
    			add_location(div, file$m, 82, 12, 3055);
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
    		source: "(82:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (78:10) {#if data.upcoming[team].prevMatches.length == 0}
    function create_if_block_1$5(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("No previous results");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "No previous results");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "next-game-item prev-results-title no-prev-results svelte-413w6e");
    			add_location(div, file$m, 78, 12, 2904);
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
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(78:10) {#if data.upcoming[team].prevMatches.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (89:10) {#each data.upcoming[team].prevMatches as prevMatch}
    function create_each_block$5(ctx) {
    	let div12;
    	let div0;

    	let t0_value = new Date(/*prevMatch*/ ctx[4].date).toLocaleDateString("en-GB", {
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
    	let t2_value = toInitials(/*prevMatch*/ ctx[4].homeTeam) + "";
    	let t2;
    	let div1_style_value;
    	let t3;
    	let div3;
    	let div2;
    	let t4_value = /*prevMatch*/ ctx[4].homeGoals + "";
    	let t4;
    	let div3_style_value;
    	let t5;
    	let div8;
    	let div6;
    	let div5;
    	let t6_value = /*prevMatch*/ ctx[4].awayGoals + "";
    	let t6;
    	let div6_style_value;
    	let t7;
    	let div7;
    	let t8_value = toInitials(/*prevMatch*/ ctx[4].awayTeam) + "";
    	let t8;
    	let div7_style_value;
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
    			attr_dev(div0, "class", "past-result-date result-details svelte-413w6e");
    			add_location(div0, file$m, 90, 14, 3402);
    			attr_dev(div1, "class", "home-team svelte-413w6e");
    			attr_dev(div1, "style", div1_style_value = teamStyle(/*prevMatch*/ ctx[4].homeTeam));
    			add_location(div1, file$m, 100, 20, 3836);
    			attr_dev(div2, "class", "home-goals svelte-413w6e");
    			add_location(div2, file$m, 104, 22, 4105);
    			attr_dev(div3, "class", "goals-container svelte-413w6e");
    			attr_dev(div3, "style", div3_style_value = teamStyle(resultColour(/*prevMatch*/ ctx[4], true)));
    			add_location(div3, file$m, 103, 20, 4003);
    			attr_dev(div4, "class", "left-side svelte-413w6e");
    			add_location(div4, file$m, 99, 18, 3791);
    			attr_dev(div5, "class", "away-goals svelte-413w6e");
    			add_location(div5, file$m, 111, 22, 4429);
    			attr_dev(div6, "class", "goals-container svelte-413w6e");
    			attr_dev(div6, "style", div6_style_value = teamStyle(resultColour(/*prevMatch*/ ctx[4], false)));
    			add_location(div6, file$m, 110, 20, 4326);
    			attr_dev(div7, "class", "away-team svelte-413w6e");
    			attr_dev(div7, "style", div7_style_value = teamStyle(/*prevMatch*/ ctx[4].awayTeam));
    			add_location(div7, file$m, 115, 20, 4580);
    			attr_dev(div8, "class", "right-side svelte-413w6e");
    			add_location(div8, file$m, 109, 18, 4280);
    			attr_dev(div9, "class", "past-result svelte-413w6e");
    			add_location(div9, file$m, 98, 16, 3746);
    			set_style(div10, "clear", "both");
    			add_location(div10, file$m, 120, 16, 4793);
    			attr_dev(div11, "class", "next-game-item result-details svelte-413w6e");
    			add_location(div11, file$m, 97, 14, 3685);
    			attr_dev(div12, "class", "next-game-item-container");
    			add_location(div12, file$m, 89, 12, 3348);
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
    			if (dirty & /*data, team*/ 3 && t0_value !== (t0_value = new Date(/*prevMatch*/ ctx[4].date).toLocaleDateString("en-GB", {
    				year: "numeric",
    				month: "short",
    				day: "numeric"
    			}) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*data, team*/ 3 && t2_value !== (t2_value = toInitials(/*prevMatch*/ ctx[4].homeTeam) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*data, team*/ 3 && div1_style_value !== (div1_style_value = teamStyle(/*prevMatch*/ ctx[4].homeTeam))) {
    				attr_dev(div1, "style", div1_style_value);
    			}

    			if (dirty & /*data, team*/ 3 && t4_value !== (t4_value = /*prevMatch*/ ctx[4].homeGoals + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*data, team*/ 3 && div3_style_value !== (div3_style_value = teamStyle(resultColour(/*prevMatch*/ ctx[4], true)))) {
    				attr_dev(div3, "style", div3_style_value);
    			}

    			if (dirty & /*data, team*/ 3 && t6_value !== (t6_value = /*prevMatch*/ ctx[4].awayGoals + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*data, team*/ 3 && div6_style_value !== (div6_style_value = teamStyle(resultColour(/*prevMatch*/ ctx[4], false)))) {
    				attr_dev(div6, "style", div6_style_value);
    			}

    			if (dirty & /*data, team*/ 3 && t8_value !== (t8_value = toInitials(/*prevMatch*/ ctx[4].awayTeam) + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*data, team*/ 3 && div7_style_value !== (div7_style_value = teamStyle(/*prevMatch*/ ctx[4].awayTeam))) {
    				attr_dev(div7, "style", div7_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div12);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(89:10) {#each data.upcoming[team].prevMatches as prevMatch}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$n(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam == null) return create_if_block$9;
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
    		p: function update(ctx, [dirty]) {
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
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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

    function instance$n($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NextGame', slots, []);
    	let { data, team, switchTeam } = $$props;
    	const writable_props = ['data', 'team', 'switchTeam'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<NextGame> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		switchTeam(toHyphenatedName(data.upcoming[team].nextTeam));
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('switchTeam' in $$props) $$invalidate(2, switchTeam = $$props.switchTeam);
    	};

    	$$self.$capture_state = () => ({
    		toAlias,
    		toInitials,
    		toHyphenatedName,
    		currentMatchday,
    		ordinal,
    		teamStyle,
    		resultColour,
    		data,
    		team,
    		switchTeam
    	});

    	$$self.$inject_state = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('team' in $$props) $$invalidate(1, team = $$props.team);
    		if ('switchTeam' in $$props) $$invalidate(2, switchTeam = $$props.switchTeam);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [data, team, switchTeam, click_handler];
    }

    class NextGame extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$n, create_fragment$n, safe_not_equal, { data: 0, team: 1, switchTeam: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NextGame",
    			options,
    			id: create_fragment$n.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[0] === undefined && !('data' in props)) {
    			console.warn("<NextGame> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[1] === undefined && !('team' in props)) {
    			console.warn("<NextGame> was created without expected prop 'team'");
    		}

    		if (/*switchTeam*/ ctx[2] === undefined && !('switchTeam' in props)) {
    			console.warn("<NextGame> was created without expected prop 'switchTeam'");
    		}
    	}

    	get data() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get switchTeam() {
    		throw new Error("<NextGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchTeam(value) {
    		throw new Error("<NextGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function identicalScore(prediction, actual) {
        return (Math.round(prediction.homeGoals) == actual.homeGoals &&
            Math.round(prediction.awayGoals) == actual.awayGoals);
    }
    function sameResult(prediction, actual) {
        return ((Math.round(prediction.homeGoals) > Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) > Math.round(actual.awayGoals)) ||
            (Math.round(prediction.homeGoals) == Math.round(prediction.awayGoals) &&
                Math.round(actual.homeGoals) == Math.round(actual.awayGoals)) ||
            (Math.round(prediction.homeGoals) < Math.round(prediction.awayGoals) &&
                Math.round(actual.homeGoals) < Math.round(actual.awayGoals)));
    }
    function isCleanSheet(h, a, atHome) {
        return (a == 0 && atHome) || (h == 0 && !atHome);
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
        return (h == 0 && atHome) || (a == 0 && !atHome);
    }

    /* src\components\team\goals_scored_and_conceded\StatsValues.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$b } = globals;

    const file$l = "src\\components\\team\\goals_scored_and_conceded\\StatsValues.svelte";

    // (94:0) {#if stats != undefined}
    function create_if_block$8(ctx) {
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
    			attr_dev(div0, "class", "season-stat-position hidden svelte-11i30am");
    			add_location(div0, file$l, 97, 8, 3436);
    			attr_dev(div1, "class", "season-stat-number");
    			add_location(div1, file$l, 100, 8, 3524);
    			attr_dev(div2, "class", div2_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xG + " svelte-11i30am");
    			add_location(div2, file$l, 103, 8, 3621);
    			attr_dev(div3, "class", "season-stat-value svelte-11i30am");
    			add_location(div3, file$l, 96, 6, 3395);
    			attr_dev(div4, "class", "season-stat-text svelte-11i30am");
    			add_location(div4, file$l, 107, 6, 3728);
    			attr_dev(div5, "class", "season-stat goals-per-game svelte-11i30am");
    			add_location(div5, file$l, 95, 4, 3347);
    			attr_dev(div6, "class", "season-stat-position hidden svelte-11i30am");
    			add_location(div6, file$l, 111, 8, 3888);
    			attr_dev(div7, "class", "season-stat-number");
    			add_location(div7, file$l, 114, 8, 3976);
    			attr_dev(div8, "class", div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xC + " svelte-11i30am");
    			add_location(div8, file$l, 117, 8, 4073);
    			attr_dev(div9, "class", "season-stat-value svelte-11i30am");
    			add_location(div9, file$l, 110, 6, 3847);
    			attr_dev(div10, "class", "season-stat-text svelte-11i30am");
    			add_location(div10, file$l, 121, 6, 4180);
    			attr_dev(div11, "class", "season-stat conceded-per-game svelte-11i30am");
    			add_location(div11, file$l, 109, 4, 3796);
    			attr_dev(div12, "class", "season-stat-position hidden svelte-11i30am");
    			add_location(div12, file$l, 125, 8, 4343);
    			attr_dev(div13, "class", "season-stat-number");
    			add_location(div13, file$l, 128, 8, 4444);
    			attr_dev(div14, "class", div14_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].cleanSheetRatio + " svelte-11i30am");
    			add_location(div14, file$l, 131, 8, 4554);
    			attr_dev(div15, "class", "season-stat-value svelte-11i30am");
    			add_location(div15, file$l, 124, 6, 4302);
    			attr_dev(div16, "class", "season-stat-text svelte-11i30am");
    			add_location(div16, file$l, 135, 6, 4687);
    			attr_dev(div17, "class", "season-stat clean-sheet-ratio svelte-11i30am");
    			add_location(div17, file$l, 123, 4, 4251);
    			attr_dev(div18, "class", "season-stats svelte-11i30am");
    			add_location(div18, file$l, 94, 2, 3315);
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

    			if (dirty & /*rank*/ 4 && div2_class_value !== (div2_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xG + " svelte-11i30am")) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty & /*rank*/ 4 && t8_value !== (t8_value = /*rank*/ ctx[2].xC + "")) set_data_dev(t8, t8_value);
    			if (dirty & /*stats, team*/ 3 && t10_value !== (t10_value = /*stats*/ ctx[1][/*team*/ ctx[0]].xC.toFixed(2) + "")) set_data_dev(t10, t10_value);
    			if (dirty & /*rank*/ 4 && t12_value !== (t12_value = /*rank*/ ctx[2].xC + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*rank*/ 4 && div8_class_value !== (div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xC + " svelte-11i30am")) {
    				attr_dev(div8, "class", div8_class_value);
    			}

    			if (dirty & /*rank*/ 4 && t16_value !== (t16_value = /*rank*/ ctx[2].cleanSheetRatio + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*stats, team*/ 3 && t18_value !== (t18_value = /*stats*/ ctx[1][/*team*/ ctx[0]].cleanSheetRatio.toFixed(2) + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*rank*/ 4 && t20_value !== (t20_value = /*rank*/ ctx[2].cleanSheetRatio + "")) set_data_dev(t20, t20_value);

    			if (dirty & /*rank*/ 4 && div14_class_value !== (div14_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].cleanSheetRatio + " svelte-11i30am")) {
    				attr_dev(div14, "class", div14_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div18);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(94:0) {#if stats != undefined}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$m(ctx) {
    	let if_block_anchor;
    	let if_block = /*stats*/ ctx[1] != undefined && create_if_block$8(ctx);

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
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
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

    function instance$m($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('StatsValues', slots, []);

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
    		$$invalidate(2, rank = getStatsRankings(seasonStats, team));
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
    	let rank = { xG: '', xC: '', cleanSheetRatio: '' };
    	let setup = false;

    	onMount(() => {
    		$$invalidate(1, stats = buildStats(data));
    		setStatsValues(stats, team);
    		setup = true;
    	});

    	let { data, team } = $$props;
    	const writable_props = ['data', 'team'];

    	Object_1$b.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<StatsValues> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(3, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		ordinal,
    		isCleanSheet,
    		notScored,
    		goalsScored,
    		goalsConceded,
    		getStatsRank,
    		getStatsRankings,
    		setStatsValues,
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
    		init(this, options, instance$m, create_fragment$m, safe_not_equal, { data: 3, team: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StatsValues",
    			options,
    			id: create_fragment$m.name
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

    /* src\components\team\Footer.svelte generated by Svelte v3.50.1 */

    const file$k = "src\\components\\team\\Footer.svelte";

    // (6:4) {#if lastUpdated != null}
    function create_if_block$7(ctx) {
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
    			attr_dev(div, "class", "last-updated no-select svelte-1t85vi0");
    			add_location(div, file$k, 6, 6, 177);
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
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(6:4) {#if lastUpdated != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$l(ctx) {
    	let div2;
    	let div1;
    	let t0;
    	let div0;
    	let span;
    	let t1;
    	let t2;
    	let if_block = /*lastUpdated*/ ctx[0] != null && create_if_block$7(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			span = element("span");
    			t1 = text("pl");
    			t2 = text("dashboard");
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
    			span = claim_element(div0_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t1 = claim_text(span_nodes, "pl");
    			span_nodes.forEach(detach_dev);
    			t2 = claim_text(div0_nodes, "dashboard");
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "pl svelte-1t85vi0");
    			add_location(span, file$k, 8, 35, 325);
    			attr_dev(div0, "class", "version no-select svelte-1t85vi0");
    			add_location(div0, file$k, 8, 4, 294);
    			attr_dev(div1, "class", "teams-footer-bottom svelte-1t85vi0");
    			add_location(div1, file$k, 4, 2, 105);
    			attr_dev(div2, "class", "teams-footer footer-text-colour svelte-1t85vi0");
    			add_location(div2, file$k, 3, 0, 56);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, span);
    			append_hydration_dev(span, t1);
    			append_hydration_dev(div0, t2);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*lastUpdated*/ ctx[0] != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$7(ctx);
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
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	let { lastUpdated } = $$props;
    	const writable_props = ['lastUpdated'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
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

    class Footer$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$l, create_fragment$l, safe_not_equal, { lastUpdated: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$l.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*lastUpdated*/ ctx[0] === undefined && !('lastUpdated' in props)) {
    			console.warn("<Footer> was created without expected prop 'lastUpdated'");
    		}
    	}

    	get lastUpdated() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lastUpdated(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\FixturesGraph.svelte generated by Svelte v3.50.1 */
    const file$j = "src\\components\\team\\FixturesGraph.svelte";

    function create_fragment$k(ctx) {
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
    			add_location(div0, file$j, 255, 2, 7774);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$j, 254, 0, 7753);
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
    		id: create_fragment$k.name,
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
    		matchDetail = `${match.team} (${homeAway}) ${match.score.homeGoals} - ${match.score.awayGoals}`;
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
    	let maxX = new Date(x[x.length - 1]);
    	maxX.setDate(maxX.getDate() + 7);
    	return [minX, maxX];
    }

    function defaultLayout$5(x, now) {
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
    		layout: defaultLayout$5(l.x, now),
    		config: {
    			responsive: true,
    			showSendToCloud: false,
    			displayModeBar: false
    		}
    	};

    	return plotData;
    }

    function instance$k($$self, $$props, $$invalidate) {
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
    		defaultLayout: defaultLayout$5,
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
    		init(this, options, instance$k, create_fragment$k, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FixturesGraph",
    			options,
    			id: create_fragment$k.name
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

    /* src\components\team\FormOverTimeGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$a } = globals;
    const file$i = "src\\components\\team\\FormOverTimeGraph.svelte";

    function create_fragment$j(ctx) {
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
    			add_location(div0, file$i, 161, 2, 4874);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$i, 160, 0, 4853);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[7](div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[7](null);
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
    	validate_slots('FormOverTimeGraph', slots, []);

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
    		$$invalidate(6, setup = true);
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
    				$$invalidate(1, lazyLoad = true);
    			},
    			3000
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
    	const writable_props = ['data', 'team', 'playedDates', 'lazyLoad', 'mobileView'];

    	Object_1$a.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FormOverTimeGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(2, data = $$props.data);
    		if ('team' in $$props) $$invalidate(3, team = $$props.team);
    		if ('playedDates' in $$props) $$invalidate(4, playedDates = $$props.playedDates);
    		if ('lazyLoad' in $$props) $$invalidate(1, lazyLoad = $$props.lazyLoad);
    		if ('mobileView' in $$props) $$invalidate(5, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		toHyphenatedName,
    		getFormLine,
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
    		playedDates,
    		lazyLoad,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(6, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(2, data = $$props.data);
    		if ('team' in $$props) $$invalidate(3, team = $$props.team);
    		if ('playedDates' in $$props) $$invalidate(4, playedDates = $$props.playedDates);
    		if ('lazyLoad' in $$props) $$invalidate(1, lazyLoad = $$props.lazyLoad);
    		if ('mobileView' in $$props) $$invalidate(5, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*team*/ 8) {
    			team && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 32) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 96) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, lazyLoad, data, team, playedDates, mobileView, setup, div0_binding];
    }

    class FormOverTimeGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {
    			data: 2,
    			team: 3,
    			playedDates: 4,
    			lazyLoad: 1,
    			mobileView: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormOverTimeGraph",
    			options,
    			id: create_fragment$j.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[2] === undefined && !('data' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[3] === undefined && !('team' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (/*playedDates*/ ctx[4] === undefined && !('playedDates' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'playedDates'");
    		}

    		if (/*lazyLoad*/ ctx[1] === undefined && !('lazyLoad' in props)) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'lazyLoad'");
    		}

    		if (/*mobileView*/ ctx[5] === undefined && !('mobileView' in props)) {
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

    	get playedDates() {
    		throw new Error("<FormOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedDates(value) {
    		throw new Error("<FormOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lazyLoad() {
    		throw new Error("<FormOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lazyLoad(value) {
    		throw new Error("<FormOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<FormOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<FormOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\PositionOverTimeGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$9 } = globals;
    const file$h = "src\\components\\team\\PositionOverTimeGraph.svelte";

    function create_fragment$i(ctx) {
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
    			add_location(div0, file$h, 211, 2, 6202);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$h, 210, 0, 6181);
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
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$i($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PositionOverTimeGraph', slots, []);

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
    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$9.keys($$props).forEach(key => {
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
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		toHyphenatedName,
    		getLineConfig,
    		getPositions,
    		getMatchdayDates: getMatchdayDates$1,
    		getLine,
    		lines,
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

    class PositionOverTimeGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PositionOverTimeGraph",
    			options,
    			id: create_fragment$i.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (/*mobileView*/ ctx[3] === undefined && !('mobileView' in props)) {
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

    	get mobileView() {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<PositionOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\PointsOverTimeGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$8 } = globals;
    const file$g = "src\\components\\team\\PointsOverTimeGraph.svelte";

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
    			add_location(div0, file$g, 161, 2, 4827);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$g, 160, 0, 4806);
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

    function defaultLayout$4() {
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

    function instance$h($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PointsOverTimeGraph', slots, []);

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
    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$8.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PointsOverTimeGraph> was created with unknown prop '${key}'`);
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
    		toHyphenatedName,
    		getLineConfig,
    		getCumulativePoints,
    		getMatchdayDates,
    		getLine,
    		lines,
    		defaultLayout: defaultLayout$4,
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

    class PointsOverTimeGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PointsOverTimeGraph",
    			options,
    			id: create_fragment$h.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<PointsOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<PointsOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (/*mobileView*/ ctx[3] === undefined && !('mobileView' in props)) {
    			console.warn("<PointsOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<PointsOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<PointsOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<PointsOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<PointsOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<PointsOverTimeGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<PointsOverTimeGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\goals_scored_and_conceded\ScoredConcededPerGameGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$7 } = globals;
    const file$f = "src\\components\\team\\goals_scored_and_conceded\\ScoredConcededPerGameGraph.svelte";

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
    			add_location(div0, file$f, 187, 2, 6007);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$f, 186, 0, 5986);
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

    function instance$g($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScoredConcededPerGameGraph', slots, []);

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
    	const writable_props = ['data', 'team', 'playedDates', 'mobileView'];

    	Object_1$7.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ScoredConcededPerGameGraph> was created with unknown prop '${key}'`);
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
    		if ('playedDates' in $$props) $$invalidate(3, playedDates = $$props.playedDates);
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
    		playedDates,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(5, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedDates' in $$props) $$invalidate(3, playedDates = $$props.playedDates);
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

    	return [plotDiv, data, team, playedDates, mobileView, setup, div0_binding];
    }

    class ScoredConcededPerGameGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedDates: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScoredConcededPerGameGraph",
    			options,
    			id: create_fragment$g.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'team'");
    		}

    		if (/*playedDates*/ ctx[3] === undefined && !('playedDates' in props)) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'playedDates'");
    		}

    		if (/*mobileView*/ ctx[4] === undefined && !('mobileView' in props)) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'mobileView'");
    		}
    	}

    	get data() {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team() {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get playedDates() {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedDates(value) {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<ScoredConcededPerGameGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\goals_scored_and_conceded\CleanSheetsGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$6 } = globals;
    const file$e = "src\\components\\team\\goals_scored_and_conceded\\CleanSheetsGraph.svelte";

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
    			add_location(div0, file$e, 190, 2, 5624);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$e, 189, 0, 5603);
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

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CleanSheetsGraph', slots, []);

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
    		$$invalidate(5, setup = true);
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
    	const writable_props = ['data', 'team', 'playedDates', 'mobileView'];

    	Object_1$6.keys($$props).forEach(key => {
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
    		if ('playedDates' in $$props) $$invalidate(3, playedDates = $$props.playedDates);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		playedMatchdays,
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
    		playedDates,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(5, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('team' in $$props) $$invalidate(2, team = $$props.team);
    		if ('playedDates' in $$props) $$invalidate(3, playedDates = $$props.playedDates);
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

    	return [plotDiv, data, team, playedDates, mobileView, setup, div0_binding];
    }

    class CleanSheetsGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedDates: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CleanSheetsGraph",
    			options,
    			id: create_fragment$f.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[1] === undefined && !('data' in props)) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[2] === undefined && !('team' in props)) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'team'");
    		}

    		if (/*playedDates*/ ctx[3] === undefined && !('playedDates' in props)) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'playedDates'");
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

    	get playedDates() {
    		throw new Error("<CleanSheetsGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playedDates(value) {
    		throw new Error("<CleanSheetsGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<CleanSheetsGraph>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<CleanSheetsGraph>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\goals_per_game\GoalsScoredFreqGraph.svelte generated by Svelte v3.50.1 */
    const file$d = "src\\components\\team\\goals_per_game\\GoalsScoredFreqGraph.svelte";

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
    			add_location(div0, file$d, 99, 2, 2707);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$d, 98, 0, 2686);
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
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
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

    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {
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
    			id: create_fragment$e.name
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

    /* src\components\team\goals_per_game\GoalsConcededFreqGraph.svelte generated by Svelte v3.50.1 */
    const file$c = "src\\components\\team\\goals_per_game\\GoalsConcededFreqGraph.svelte";

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
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "plotDiv");
    			add_location(div0, file$c, 99, 2, 2699);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$c, 98, 0, 2678);
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
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
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

    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {
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
    			id: create_fragment$d.name
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

    /* src\components\team\goals_per_game\GoalsPerGame.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$5 } = globals;
    const file$b = "src\\components\\team\\goals_per_game\\GoalsPerGame.svelte";

    // (253:2) {#if setup}
    function create_if_block$6(ctx) {
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
    			attr_dev(div0, "class", "graph freq-graph mini-graph svelte-8zd8zw");
    			add_location(div0, file$b, 253, 4, 7889);
    			attr_dev(div1, "class", "graph freq-graph mini-graph svelte-8zd8zw");
    			add_location(div1, file$b, 263, 4, 8122);
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
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(253:2) {#if setup}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div;
    	let current;
    	let if_block = /*setup*/ ctx[2] && create_if_block$6(ctx);

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
    			attr_dev(div, "class", "two-graphs svelte-8zd8zw");
    			add_location(div, file$b, 251, 0, 7844);
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
    					if_block = create_if_block$6(ctx);
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
    		id: create_fragment$c.name,
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

    function instance$c($$self, $$props, $$invalidate) {
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

    	Object_1$5.keys($$props).forEach(key => {
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
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { data: 9, team: 0, mobileView: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GoalsPerGame",
    			options,
    			id: create_fragment$c.name
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

    /* src\components\team\SpiderGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$4 } = globals;

    const file$a = "src\\components\\team\\SpiderGraph.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[33] = list[i];
    	return child_ctx;
    }

    // (527:6) {#if _team != team}
    function create_if_block$5(ctx) {
    	let button;
    	let t_value = toAlias(/*_team*/ ctx[33]) + "";
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
    			attr_dev(button, "class", "spider-opp-team-btn svelte-13tgs7k");
    			add_location(button, file$a, 527, 8, 17548);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*teams*/ 2 && t_value !== (t_value = toAlias(/*_team*/ ctx[33]) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(527:6) {#if _team != team}",
    		ctx
    	});

    	return block;
    }

    // (526:4) {#each teams as _team}
    function create_each_block$4(ctx) {
    	let if_block_anchor;
    	let if_block = /*_team*/ ctx[33] != /*team*/ ctx[0] && create_if_block$5(ctx);

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
    			if (/*_team*/ ctx[33] != /*team*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$5(ctx);
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
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(526:4) {#each teams as _team}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
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
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
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
    			add_location(div0, file$a, 518, 4, 17256);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$a, 517, 2, 17233);
    			attr_dev(div2, "class", "spider-chart svelte-13tgs7k");
    			add_location(div2, file$a, 516, 0, 17203);
    			attr_dev(div3, "class", "spider-opp-team-btns svelte-13tgs7k");
    			attr_dev(div3, "id", "spider-opp-teams");
    			add_location(div3, file$a, 524, 2, 17427);
    			attr_dev(div4, "class", "spider-opp-team-selector svelte-13tgs7k");
    			add_location(div4, file$a, 523, 0, 17385);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			/*div0_binding*/ ctx[5](div0);
    			insert_hydration_dev(target, t, anchor);
    			insert_hydration_dev(target, div4, anchor);
    			append_hydration_dev(div4, div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*spiderBtnClick, teams, team*/ 11) {
    				each_value = /*teams*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
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
    			/*div0_binding*/ ctx[5](null);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div4);
    			destroy_each(each_blocks, detaching);
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
    			if (match.atHome && match.score.awayGoals == 0) {
    				nCleanSheets += 1;
    			} else if (!match.atHome && match.score.homeGoals == 0) {
    				nCleanSheets += 1;
    			}
    		}
    	}

    	return nCleanSheets;
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

    			if (prevResult != null && prevResult == result) {
    				backToBack += 1;
    			}

    			prevResult = result;
    		}
    	}

    	return backToBack;
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
    			} else if (match.score.homeGoals == match.score.awayGoals) {
    				pointsVsBig6 += 1;
    			}

    			numPlayed += 1;
    		}
    	}

    	return [pointsVsBig6, numPlayed];
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

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SpiderGraph', slots, []);

    	function addTeamComparison(team) {
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
    			marker: { color: teamColor(team) }
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
    				if (plotData.data[i].name == comparisonTeams[i] && comparisonTeams[i] != team) {
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
    			let teamKey = toHyphenatedName(team);
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

    	function getCleanSheets(data) {
    		//@ts-ignore
    		let cleanSheets = {};

    		let maxCleanSheets = Number.NEGATIVE_INFINITY;

    		for (let team of Object.keys(data.standings)) {
    			let nCleanSheets = formCleanSheets(data.form, team, data._id);

    			if (teamInSeason(data.form, team, data._id - 1)) {
    				nCleanSheets += formCleanSheets(data.form, team, data._id - 1);
    			}

    			if (teamInSeason(data.form, team, data._id - 2)) {
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

    	function getConsistency(data) {
    		//@ts-ignore
    		let consistency = {};

    		let maxConsistency = Number.NEGATIVE_INFINITY;

    		for (let team of Object.keys(data.standings)) {
    			let backToBack = formConsistency(data.form, team, data._id);

    			if (teamInSeason(data.form, team, data._id - 1)) {
    				backToBack += formConsistency(data.form, team, data._id - 1);
    			}

    			if (teamInSeason(data.form, team, data._id - 2)) {
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

    	function getWinStreak(data) {
    		//@ts-ignore
    		let winStreaks = {};

    		let maxWinStreaks = Number.NEGATIVE_INFINITY;

    		for (let team of Object.keys(data.standings)) {
    			let winStreak = formWinStreak(data.form, team, data._id);

    			if (teamInSeason(data.form, team, data._id - 1)) {
    				winStreak += formWinStreak(data.form, team, data._id - 1);
    			}

    			if (teamInSeason(data.form, team, data._id - 2)) {
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

    	function getVsBig6(data) {
    		//@ts-ignore
    		let vsBig6 = {};

    		let maxAvgPointsVsBig6 = Number.NEGATIVE_INFINITY;

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
    			let [avgPointsVsBig6, numPlayed] = formWinsVsBig6(data.form, team, data._id, big6);

    			if (teamInSeason(data.form, team, data._id - 1)) {
    				let [points, played] = formWinsVsBig6(data.form, team, data._id - 1, big6);
    				avgPointsVsBig6 += points;
    				numPlayed += played;
    			}

    			if (teamInSeason(data.form, team, data._id - 2)) {
    				let [points, played] = formWinsVsBig6(data.form, team, data._id - 2, big6);
    				avgPointsVsBig6 += points;
    				numPlayed += played;
    			}

    			avgPointsVsBig6 /= numPlayed;

    			if (avgPointsVsBig6 > maxAvgPointsVsBig6) {
    				maxAvgPointsVsBig6 = avgPointsVsBig6;
    			}

    			vsBig6[team] = avgPointsVsBig6;
    		}

    		vsBig6.avg = attributeAvgScaled(vsBig6, maxAvgPointsVsBig6);
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
    	let labels = ["Attack", "Defence", "Clean sheets", "Consistency", "Win streak", "Vs big 6"];
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
    	const writable_props = ['data', 'team', 'teams'];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SpiderGraph> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(2, plotDiv);
    		});
    	}

    	const click_handler = e => {
    		//@ts-ignore
    		spiderBtnClick(e.target);
    	};

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(4, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		toAlias,
    		toName,
    		teamInSeason,
    		toHyphenatedName,
    		teamColor,
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
    		teams
    	});

    	$$self.$inject_state = $$props => {
    		if ('attack' in $$props) attack = $$props.attack;
    		if ('defence' in $$props) defence = $$props.defence;
    		if ('cleanSheets' in $$props) cleanSheets = $$props.cleanSheets;
    		if ('consistency' in $$props) consistency = $$props.consistency;
    		if ('winStreaks' in $$props) winStreaks = $$props.winStreaks;
    		if ('vsBig6' in $$props) vsBig6 = $$props.vsBig6;
    		if ('labels' in $$props) labels = $$props.labels;
    		if ('plotDiv' in $$props) $$invalidate(2, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('comparisonTeams' in $$props) comparisonTeams = $$props.comparisonTeams;
    		if ('setup' in $$props) setup = $$props.setup;
    		if ('data' in $$props) $$invalidate(4, data = $$props.data);
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*team*/ 1) {
    			team && refreshPlot();
    		}
    	};

    	return [team, teams, plotDiv, spiderBtnClick, data, div0_binding, click_handler];
    }

    class SpiderGraph extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { data: 4, team: 0, teams: 1 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SpiderGraph",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[4] === undefined && !('data' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'data'");
    		}

    		if (/*team*/ ctx[0] === undefined && !('team' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'team'");
    		}

    		if (/*teams*/ ctx[1] === undefined && !('teams' in props)) {
    			console.warn("<SpiderGraph> was created without expected prop 'teams'");
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
    }

    /* src\components\team\ScorelineFreqGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$3 } = globals;
    const file$9 = "src\\components\\team\\ScorelineFreqGraph.svelte";

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
    			add_location(div0, file$9, 257, 2, 7723);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$9, 256, 0, 7702);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function getColours(scores) {
    	let colours = [];

    	for (let score of scores) {
    		let [hs, _, as] = score.split(' ');
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

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScorelineFreqGraph', slots, []);

    	function getAvgScoreFreq(data) {
    		let scoreFreq = {};

    		for (let team in data.form) {
    			for (let i = 0; i < 3; i++) {
    				if (i == 0) {
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
    		$$invalidate(4, setup = true);
    	});

    	let { data, team, mobileView } = $$props;
    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$3.keys($$props).forEach(key => {
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
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScorelineFreqGraph",
    			options,
    			id: create_fragment$a.name
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

    /* src\components\nav\Nav.svelte generated by Svelte v3.50.1 */
    const file$8 = "src\\components\\nav\\Nav.svelte";

    function get_each_context_1$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (29:4) {:else}
    function create_else_block$3(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let each_value_1 = /*teams*/ ctx[1];
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*_team*/ ctx[9];
    	validate_each_keys(ctx, each_value_1, get_each_context_1$2, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1$2(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1$2(key, child_ctx));
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
    			if (dirty & /*toHyphenatedName, teams, teamStyle, toAlias, team, switchTeam*/ 15) {
    				each_value_1 = /*teams*/ ctx[1];
    				validate_each_argument(each_value_1);
    				validate_each_keys(ctx, each_value_1, get_each_context_1$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block_1$2, each_1_anchor, get_each_context_1$2);
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
    		source: "(29:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:4) {#if teams.length == 0}
    function create_if_block$4(ctx) {
    	let each_1_anchor;
    	let each_value = /*widths*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
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
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
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
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(22:4) {#if teams.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (39:8) {:else}
    function create_else_block_1$2(ctx) {
    	let button;
    	let div1;
    	let div0;
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
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			div1 = claim_element(button_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t1 = claim_space(button_nodes);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "team-name svelte-1kfqoxr");
    			add_location(div0, file$8, 46, 14, 1481);
    			attr_dev(div1, "class", "team-container svelte-1kfqoxr");
    			add_location(div1, file$8, 45, 12, 1437);
    			attr_dev(button, "class", "team-link svelte-1kfqoxr");
    			add_location(button, file$8, 39, 10, 1273);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
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
    		source: "(39:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (31:8) {#if toHyphenatedName(_team) == team}
    function create_if_block_1$4(ctx) {
    	let a;
    	let div1;
    	let div0;
    	let t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[9]) + "";
    	let t0;
    	let div1_style_value;
    	let t1;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, class: true });
    			var a_nodes = children(a);
    			div1 = claim_element(a_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t1 = claim_space(a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "this-team-name svelte-1kfqoxr");
    			add_location(div0, file$8, 33, 14, 1124);
    			attr_dev(div1, "class", "this-team-container");
    			attr_dev(div1, "style", div1_style_value = teamStyle(/*_team*/ ctx[9]));
    			add_location(div1, file$8, 32, 12, 1050);
    			attr_dev(a, "href", a_href_value = "/" + toHyphenatedName(/*_team*/ ctx[9]));
    			attr_dev(a, "class", "team-link");
    			add_location(a, file$8, 31, 10, 981);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*toAlias, teams*/ 6 && t0_value !== (t0_value = /*toAlias*/ ctx[2](/*_team*/ ctx[9]) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*teams*/ 2 && div1_style_value !== (div1_style_value = teamStyle(/*_team*/ ctx[9]))) {
    				attr_dev(div1, "style", div1_style_value);
    			}

    			if (dirty & /*teams*/ 2 && a_href_value !== (a_href_value = "/" + toHyphenatedName(/*_team*/ ctx[9]))) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(31:8) {#if toHyphenatedName(_team) == team}",
    		ctx
    	});

    	return block;
    }

    // (30:6) {#each teams as _team, _ (_team)}
    function create_each_block_1$2(key_1, ctx) {
    	let first;
    	let show_if;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (dirty & /*teams, team*/ 3) show_if = null;
    		if (show_if == null) show_if = !!(toHyphenatedName(/*_team*/ ctx[9]) == /*team*/ ctx[0]);
    		if (show_if) return create_if_block_1$4;
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
    		id: create_each_block_1$2.name,
    		type: "each",
    		source: "(30:6) {#each teams as _team, _ (_team)}",
    		ctx
    	});

    	return block;
    }

    // (23:6) {#each widths as width, _}
    function create_each_block$3(ctx) {
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
    			attr_dev(div, "class", "placeholder svelte-1kfqoxr");
    			set_style(div, "width", /*width*/ ctx[6] + "%");
    			add_location(div, file$8, 23, 8, 771);
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
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(23:6) {#each widths as width, _}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
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
    		if (/*teams*/ ctx[1].length == 0) return create_if_block$4;
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
    			img = claim_element(button_nodes, "IMG", { src: true, alt: true, class: true });
    			button_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			nav_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_style(span, "color", "var(--green)");
    			add_location(span, file$8, 17, 6, 598);
    			add_location(p, file$8, 16, 4, 587);
    			attr_dev(div0, "class", "title no-selection svelte-1kfqoxr");
    			add_location(div0, file$8, 15, 2, 549);
    			attr_dev(div1, "class", "team-links svelte-1kfqoxr");
    			add_location(div1, file$8, 20, 2, 674);
    			if (!src_url_equal(img.src, img_src_value = "img/arrow-bar-left.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-1kfqoxr");
    			add_location(img, file$8, 76, 6, 2279);
    			attr_dev(button, "class", "close-btn svelte-1kfqoxr");
    			add_location(button, file$8, 75, 4, 2222);
    			attr_dev(div2, "class", "close");
    			add_location(div2, file$8, 74, 2, 2197);
    			attr_dev(nav, "id", "navBar");
    			attr_dev(nav, "class", "svelte-1kfqoxr");
    			add_location(nav, file$8, 14, 0, 528);
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
    		id: create_fragment$9.name,
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

    function instance$9($$self, $$props, $$invalidate) {
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
    		switchTeam(toHyphenatedName(_team));
    	};

    	$$self.$$set = $$props => {
    		if ('team' in $$props) $$invalidate(0, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(1, teams = $$props.teams);
    		if ('toAlias' in $$props) $$invalidate(2, toAlias = $$props.toAlias);
    		if ('switchTeam' in $$props) $$invalidate(3, switchTeam = $$props.switchTeam);
    	};

    	$$self.$capture_state = () => ({
    		teamStyle,
    		toHyphenatedName,
    		closeNavBar,
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

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			team: 0,
    			teams: 1,
    			toAlias: 2,
    			switchTeam: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Nav",
    			options,
    			id: create_fragment$9.name
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

    /* src\components\overview\Footer.svelte generated by Svelte v3.50.1 */

    const file$7 = "src\\components\\overview\\Footer.svelte";

    function create_fragment$8(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let span;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			t0 = text("pl");
    			t1 = text("dashboard");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			span = claim_element(div0_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "pl");
    			span_nodes.forEach(detach_dev);
    			t1 = claim_text(div0_nodes, "dashboard");
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "pl svelte-mh37ub");
    			add_location(span, file$7, 2, 35, 119);
    			attr_dev(div0, "class", "version no-select svelte-mh37ub");
    			add_location(div0, file$7, 2, 4, 88);
    			attr_dev(div1, "class", "teams-footer-bottom svelte-mh37ub");
    			add_location(div1, file$7, 1, 2, 49);
    			attr_dev(div2, "class", "teams-footer footer-text-colour svelte-mh37ub");
    			add_location(div2, file$7, 0, 0, 0);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(div0, t1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
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

    function instance$8($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src\components\overview\Overview.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$2 } = globals;
    const file$6 = "src\\components\\overview\\Overview.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	child_ctx[12] = i;
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    function get_each_context_5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    // (195:8) {#if upcoming != undefined}
    function create_if_block_2$3(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let each_value_5 = /*upcoming*/ ctx[2];
    	validate_each_argument(each_value_5);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_5.length; i += 1) {
    		each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("Upcoming");
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, "Upcoming");
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div1_nodes);
    			}

    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "upcoming-title svelte-1gtw5nu");
    			add_location(div0, file$6, 196, 12, 5415);
    			attr_dev(div1, "class", "upcoming-matches svelte-1gtw5nu");
    			add_location(div1, file$6, 195, 10, 5371);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div1, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*upcoming, teamStyle, toInitials*/ 4) {
    				each_value_5 = /*upcoming*/ ctx[2];
    				validate_each_argument(each_value_5);
    				let i;

    				for (i = 0; i < each_value_5.length; i += 1) {
    					const child_ctx = get_each_context_5(ctx, each_value_5, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_5(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_5.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(195:8) {#if upcoming != undefined}",
    		ctx
    	});

    	return block;
    }

    // (199:14) {#if i == 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}
    function create_if_block_3$3(ctx) {
    	let div;

    	let t_value = /*match*/ ctx[13].time.toLocaleDateString("en-GB", {
    		weekday: "long",
    		year: "numeric",
    		month: "long",
    		day: "numeric"
    	}) + "";

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
    			attr_dev(div, "class", "upcoming-match-date svelte-1gtw5nu");
    			add_location(div, file$6, 199, 16, 5603);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*upcoming*/ 4 && t_value !== (t_value = /*match*/ ctx[13].time.toLocaleDateString("en-GB", {
    				weekday: "long",
    				year: "numeric",
    				month: "long",
    				day: "numeric"
    			}) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$3.name,
    		type: "if",
    		source: "(199:14) {#if i == 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}",
    		ctx
    	});

    	return block;
    }

    // (198:12) {#each upcoming as match, i}
    function create_each_block_5(ctx) {
    	let show_if = /*i*/ ctx[15] == 0 || /*match*/ ctx[13].time.getDate() != /*upcoming*/ ctx[2][/*i*/ ctx[15] - 1].time.getDate();
    	let t0;
    	let div3;
    	let div2;
    	let div0;
    	let t1_value = toInitials(/*match*/ ctx[13].home) + "";
    	let t1;
    	let div0_style_value;
    	let t2;
    	let div1;
    	let t3_value = toInitials(/*match*/ ctx[13].away) + "";
    	let t3;
    	let div1_style_value;
    	let t4;
    	let div5;
    	let div4;
    	let t5_value = /*match*/ ctx[13].time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "";
    	let t5;
    	let t6;
    	let if_block = show_if && create_if_block_3$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t0 = space();
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			t1 = text(t1_value);
    			t2 = space();
    			div1 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			div5 = element("div");
    			div4 = element("div");
    			t5 = text(t5_value);
    			t6 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			t0 = claim_space(nodes);
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			t1 = claim_text(div0_nodes, t1_value);
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true, style: true });
    			var div1_nodes = children(div1);
    			t3 = claim_text(div1_nodes, t3_value);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t4 = claim_space(nodes);
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t5 = claim_text(div4_nodes, t5_value);
    			div4_nodes.forEach(detach_dev);
    			t6 = claim_space(div5_nodes);
    			div5_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "upcoming-match-home svelte-1gtw5nu");
    			attr_dev(div0, "style", div0_style_value = teamStyle(/*match*/ ctx[13].home));
    			add_location(div0, file$6, 210, 18, 6030);
    			attr_dev(div1, "class", "upcoming-match-away svelte-1gtw5nu");
    			attr_dev(div1, "style", div1_style_value = teamStyle(/*match*/ ctx[13].away));
    			add_location(div1, file$6, 216, 18, 6247);
    			attr_dev(div2, "class", "upcoming-match-teams svelte-1gtw5nu");
    			add_location(div2, file$6, 209, 16, 5976);
    			attr_dev(div3, "class", "upcoming-match svelte-1gtw5nu");
    			add_location(div3, file$6, 208, 14, 5930);
    			attr_dev(div4, "class", "upcoming-match-time svelte-1gtw5nu");
    			add_location(div4, file$6, 225, 16, 6567);
    			attr_dev(div5, "class", "upcoming-match-time-container svelte-1gtw5nu");
    			add_location(div5, file$6, 224, 14, 6506);
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div2, t2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, t3);
    			insert_hydration_dev(target, t4, anchor);
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, t5);
    			append_hydration_dev(div5, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*upcoming*/ 4) show_if = /*i*/ ctx[15] == 0 || /*match*/ ctx[13].time.getDate() != /*upcoming*/ ctx[2][/*i*/ ctx[15] - 1].time.getDate();

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_3$3(ctx);
    					if_block.c();
    					if_block.m(t0.parentNode, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*upcoming*/ 4 && t1_value !== (t1_value = toInitials(/*match*/ ctx[13].home) + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*upcoming*/ 4 && div0_style_value !== (div0_style_value = teamStyle(/*match*/ ctx[13].home))) {
    				attr_dev(div0, "style", div0_style_value);
    			}

    			if (dirty & /*upcoming*/ 4 && t3_value !== (t3_value = toInitials(/*match*/ ctx[13].away) + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*upcoming*/ 4 && div1_style_value !== (div1_style_value = teamStyle(/*match*/ ctx[13].away))) {
    				attr_dev(div1, "style", div1_style_value);
    			}

    			if (dirty & /*upcoming*/ 4 && t5_value !== (t5_value = /*match*/ ctx[13].time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "")) set_data_dev(t5, t5_value);
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_5.name,
    		type: "each",
    		source: "(198:12) {#each upcoming as match, i}",
    		ctx
    	});

    	return block;
    }

    // (239:6) {#if standings != undefined}
    function create_if_block_1$3(ctx) {
    	let div15;
    	let div0;
    	let t0;
    	let t1;
    	let div14;
    	let div13;
    	let div1;
    	let t2;
    	let div2;
    	let t3;
    	let div3;
    	let t4;
    	let t5;
    	let div4;
    	let t6;
    	let t7;
    	let div5;
    	let t8;
    	let t9;
    	let div6;
    	let t10;
    	let t11;
    	let div7;
    	let t12;
    	let t13;
    	let div8;
    	let t14;
    	let t15;
    	let div9;
    	let t16;
    	let t17;
    	let div10;
    	let t18;
    	let t19;
    	let div11;
    	let t20;
    	let t21;
    	let div12;
    	let t22;
    	let t23;
    	let each_value_4 = /*standings*/ ctx[3];
    	validate_each_argument(each_value_4);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_4.length; i += 1) {
    		each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
    	}

    	const block = {
    		c: function create() {
    			div15 = element("div");
    			div0 = element("div");
    			t0 = text("Standings");
    			t1 = space();
    			div14 = element("div");
    			div13 = element("div");
    			div1 = element("div");
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			t4 = text("W");
    			t5 = space();
    			div4 = element("div");
    			t6 = text("D");
    			t7 = space();
    			div5 = element("div");
    			t8 = text("L");
    			t9 = space();
    			div6 = element("div");
    			t10 = text("GF");
    			t11 = space();
    			div7 = element("div");
    			t12 = text("GA");
    			t13 = space();
    			div8 = element("div");
    			t14 = text("GD");
    			t15 = space();
    			div9 = element("div");
    			t16 = text("Played");
    			t17 = space();
    			div10 = element("div");
    			t18 = text("Points");
    			t19 = space();
    			div11 = element("div");
    			t20 = text("Rating");
    			t21 = space();
    			div12 = element("div");
    			t22 = text("Form");
    			t23 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div15 = claim_element(nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			div0 = claim_element(div15_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, "Standings");
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div15_nodes);
    			div14 = claim_element(div15_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div1 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div1).forEach(detach_dev);
    			t2 = claim_space(div13_nodes);
    			div2 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div2).forEach(detach_dev);
    			t3 = claim_space(div13_nodes);
    			div3 = claim_element(div13_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t4 = claim_text(div3_nodes, "W");
    			div3_nodes.forEach(detach_dev);
    			t5 = claim_space(div13_nodes);
    			div4 = claim_element(div13_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t6 = claim_text(div4_nodes, "D");
    			div4_nodes.forEach(detach_dev);
    			t7 = claim_space(div13_nodes);
    			div5 = claim_element(div13_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t8 = claim_text(div5_nodes, "L");
    			div5_nodes.forEach(detach_dev);
    			t9 = claim_space(div13_nodes);
    			div6 = claim_element(div13_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t10 = claim_text(div6_nodes, "GF");
    			div6_nodes.forEach(detach_dev);
    			t11 = claim_space(div13_nodes);
    			div7 = claim_element(div13_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			t12 = claim_text(div7_nodes, "GA");
    			div7_nodes.forEach(detach_dev);
    			t13 = claim_space(div13_nodes);
    			div8 = claim_element(div13_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			t14 = claim_text(div8_nodes, "GD");
    			div8_nodes.forEach(detach_dev);
    			t15 = claim_space(div13_nodes);
    			div9 = claim_element(div13_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			t16 = claim_text(div9_nodes, "Played");
    			div9_nodes.forEach(detach_dev);
    			t17 = claim_space(div13_nodes);
    			div10 = claim_element(div13_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			t18 = claim_text(div10_nodes, "Points");
    			div10_nodes.forEach(detach_dev);
    			t19 = claim_space(div13_nodes);
    			div11 = claim_element(div13_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			t20 = claim_text(div11_nodes, "Rating");
    			div11_nodes.forEach(detach_dev);
    			t21 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			t22 = claim_text(div12_nodes, "Form");
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			t23 = claim_space(div14_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div14_nodes);
    			}

    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "standings-title svelte-1gtw5nu");
    			add_location(div0, file$6, 240, 10, 7014);
    			attr_dev(div1, "class", "standings-position svelte-1gtw5nu");
    			add_location(div1, file$6, 243, 14, 7146);
    			attr_dev(div2, "class", "standings-team-name svelte-1gtw5nu");
    			add_location(div2, file$6, 244, 14, 7196);
    			attr_dev(div3, "class", "standings-won bold svelte-1gtw5nu");
    			add_location(div3, file$6, 245, 14, 7247);
    			attr_dev(div4, "class", "standings-drawn bold svelte-1gtw5nu");
    			add_location(div4, file$6, 246, 14, 7302);
    			attr_dev(div5, "class", "standings-lost bold svelte-1gtw5nu");
    			add_location(div5, file$6, 247, 14, 7359);
    			attr_dev(div6, "class", "standings-gf bold svelte-1gtw5nu");
    			add_location(div6, file$6, 248, 14, 7415);
    			attr_dev(div7, "class", "standings-ga bold svelte-1gtw5nu");
    			add_location(div7, file$6, 249, 14, 7470);
    			attr_dev(div8, "class", "standings-gd bold svelte-1gtw5nu");
    			add_location(div8, file$6, 250, 14, 7525);
    			attr_dev(div9, "class", "standings-played bold svelte-1gtw5nu");
    			add_location(div9, file$6, 251, 14, 7580);
    			attr_dev(div10, "class", "standings-points bold svelte-1gtw5nu");
    			add_location(div10, file$6, 252, 14, 7643);
    			attr_dev(div11, "class", "standings-rating bold svelte-1gtw5nu");
    			add_location(div11, file$6, 253, 14, 7706);
    			attr_dev(div12, "class", "standings-form bold svelte-1gtw5nu");
    			add_location(div12, file$6, 254, 14, 7769);
    			attr_dev(div13, "class", "table-row svelte-1gtw5nu");
    			add_location(div13, file$6, 242, 12, 7107);
    			attr_dev(div14, "class", "standings svelte-1gtw5nu");
    			add_location(div14, file$6, 241, 10, 7070);
    			attr_dev(div15, "class", "standings-table");
    			add_location(div15, file$6, 239, 8, 6973);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div15, anchor);
    			append_hydration_dev(div15, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div15, t1);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div1);
    			append_hydration_dev(div13, t2);
    			append_hydration_dev(div13, div2);
    			append_hydration_dev(div13, t3);
    			append_hydration_dev(div13, div3);
    			append_hydration_dev(div3, t4);
    			append_hydration_dev(div13, t5);
    			append_hydration_dev(div13, div4);
    			append_hydration_dev(div4, t6);
    			append_hydration_dev(div13, t7);
    			append_hydration_dev(div13, div5);
    			append_hydration_dev(div5, t8);
    			append_hydration_dev(div13, t9);
    			append_hydration_dev(div13, div6);
    			append_hydration_dev(div6, t10);
    			append_hydration_dev(div13, t11);
    			append_hydration_dev(div13, div7);
    			append_hydration_dev(div7, t12);
    			append_hydration_dev(div13, t13);
    			append_hydration_dev(div13, div8);
    			append_hydration_dev(div8, t14);
    			append_hydration_dev(div13, t15);
    			append_hydration_dev(div13, div9);
    			append_hydration_dev(div9, t16);
    			append_hydration_dev(div13, t17);
    			append_hydration_dev(div13, div10);
    			append_hydration_dev(div10, t18);
    			append_hydration_dev(div13, t19);
    			append_hydration_dev(div13, div11);
    			append_hydration_dev(div11, t20);
    			append_hydration_dev(div13, t21);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, t22);
    			append_hydration_dev(div14, t23);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div14, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, standings*/ 9) {
    				each_value_4 = /*standings*/ ctx[3];
    				validate_each_argument(each_value_4);
    				let i;

    				for (i = 0; i < each_value_4.length; i += 1) {
    					const child_ctx = get_each_context_4(ctx, each_value_4, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div14, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_4.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div15);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(239:6) {#if standings != undefined}",
    		ctx
    	});

    	return block;
    }

    // (257:12) {#each standings as row, i}
    function create_each_block_4(ctx) {
    	let div12;
    	let div0;
    	let t0_value = /*row*/ ctx[10].position + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*row*/ ctx[10].team + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*row*/ ctx[10].won + "";
    	let t4;
    	let t5;
    	let div3;
    	let t6_value = /*row*/ ctx[10].drawn + "";
    	let t6;
    	let t7;
    	let div4;
    	let t8_value = /*row*/ ctx[10].lost + "";
    	let t8;
    	let t9;
    	let div5;
    	let t10_value = /*row*/ ctx[10].gF + "";
    	let t10;
    	let t11;
    	let div6;
    	let t12_value = /*row*/ ctx[10].gA + "";
    	let t12;
    	let t13;
    	let div7;
    	let t14_value = /*row*/ ctx[10].gD + "";
    	let t14;
    	let t15;
    	let div8;
    	let t16_value = /*row*/ ctx[10].played + "";
    	let t16;
    	let t17;
    	let div9;
    	let t18_value = /*row*/ ctx[10].points + "";
    	let t18;
    	let t19;
    	let div10;
    	let t20_value = /*data*/ ctx[0].teamRatings[/*row*/ ctx[10].team].totalRating.toFixed(2) + "";
    	let t20;
    	let t21;
    	let div11;
    	let t22_value = /*data*/ ctx[0].form[/*row*/ ctx[10].team][/*data*/ ctx[0]._id][13].formRating5.toFixed(2) + "";
    	let t22;
    	let t23;

    	const block = {
    		c: function create() {
    			div12 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div3 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			div4 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			div5 = element("div");
    			t10 = text(t10_value);
    			t11 = space();
    			div6 = element("div");
    			t12 = text(t12_value);
    			t13 = space();
    			div7 = element("div");
    			t14 = text(t14_value);
    			t15 = space();
    			div8 = element("div");
    			t16 = text(t16_value);
    			t17 = space();
    			div9 = element("div");
    			t18 = text(t18_value);
    			t19 = space();
    			div10 = element("div");
    			t20 = text(t20_value);
    			t21 = space();
    			div11 = element("div");
    			t22 = text(t22_value);
    			t23 = space();
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
    			div1 = claim_element(div12_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t2 = claim_text(div1_nodes, t2_value);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(div12_nodes);
    			div2 = claim_element(div12_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			div2_nodes.forEach(detach_dev);
    			t5 = claim_space(div12_nodes);
    			div3 = claim_element(div12_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t6 = claim_text(div3_nodes, t6_value);
    			div3_nodes.forEach(detach_dev);
    			t7 = claim_space(div12_nodes);
    			div4 = claim_element(div12_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t8 = claim_text(div4_nodes, t8_value);
    			div4_nodes.forEach(detach_dev);
    			t9 = claim_space(div12_nodes);
    			div5 = claim_element(div12_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t10 = claim_text(div5_nodes, t10_value);
    			div5_nodes.forEach(detach_dev);
    			t11 = claim_space(div12_nodes);
    			div6 = claim_element(div12_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t12 = claim_text(div6_nodes, t12_value);
    			div6_nodes.forEach(detach_dev);
    			t13 = claim_space(div12_nodes);
    			div7 = claim_element(div12_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			t14 = claim_text(div7_nodes, t14_value);
    			div7_nodes.forEach(detach_dev);
    			t15 = claim_space(div12_nodes);
    			div8 = claim_element(div12_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			t16 = claim_text(div8_nodes, t16_value);
    			div8_nodes.forEach(detach_dev);
    			t17 = claim_space(div12_nodes);
    			div9 = claim_element(div12_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			t18 = claim_text(div9_nodes, t18_value);
    			div9_nodes.forEach(detach_dev);
    			t19 = claim_space(div12_nodes);
    			div10 = claim_element(div12_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			t20 = claim_text(div10_nodes, t20_value);
    			div10_nodes.forEach(detach_dev);
    			t21 = claim_space(div12_nodes);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			t22 = claim_text(div11_nodes, t22_value);
    			div11_nodes.forEach(detach_dev);
    			t23 = claim_space(div12_nodes);
    			div12_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "standings-position svelte-1gtw5nu");
    			add_location(div0, file$6, 264, 16, 8148);
    			attr_dev(div1, "class", "standings-team-name svelte-1gtw5nu");
    			add_location(div1, file$6, 267, 16, 8256);
    			attr_dev(div2, "class", "standings-won svelte-1gtw5nu");
    			add_location(div2, file$6, 270, 16, 8361);
    			attr_dev(div3, "class", "standings-drawn svelte-1gtw5nu");
    			add_location(div3, file$6, 273, 16, 8459);
    			attr_dev(div4, "class", "standings-lost svelte-1gtw5nu");
    			add_location(div4, file$6, 276, 16, 8561);
    			attr_dev(div5, "class", "standings-gf svelte-1gtw5nu");
    			add_location(div5, file$6, 279, 16, 8661);
    			attr_dev(div6, "class", "standings-ga svelte-1gtw5nu");
    			add_location(div6, file$6, 282, 16, 8757);
    			attr_dev(div7, "class", "standings-gd svelte-1gtw5nu");
    			add_location(div7, file$6, 285, 16, 8853);
    			attr_dev(div8, "class", "standings-played svelte-1gtw5nu");
    			add_location(div8, file$6, 288, 16, 8949);
    			attr_dev(div9, "class", "standings-points svelte-1gtw5nu");
    			add_location(div9, file$6, 291, 16, 9053);
    			attr_dev(div10, "class", "standings-rating svelte-1gtw5nu");
    			add_location(div10, file$6, 294, 16, 9157);
    			attr_dev(div11, "class", "standings-form svelte-1gtw5nu");
    			add_location(div11, file$6, 297, 16, 9300);
    			attr_dev(div12, "class", "table-row " + (/*i*/ ctx[15] % 2 == 0 ? 'grey-row' : '') + " " + (/*i*/ ctx[15] < 4 ? 'cl' : '') + " " + (/*i*/ ctx[15] > 3 && /*i*/ ctx[15] < 6 ? 'el' : '') + " " + (/*i*/ ctx[15] > 16 ? 'relegation' : '') + " svelte-1gtw5nu");
    			add_location(div12, file$6, 257, 14, 7889);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div12, anchor);
    			append_hydration_dev(div12, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div12, t1);
    			append_hydration_dev(div12, div1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div12, t3);
    			append_hydration_dev(div12, div2);
    			append_hydration_dev(div2, t4);
    			append_hydration_dev(div12, t5);
    			append_hydration_dev(div12, div3);
    			append_hydration_dev(div3, t6);
    			append_hydration_dev(div12, t7);
    			append_hydration_dev(div12, div4);
    			append_hydration_dev(div4, t8);
    			append_hydration_dev(div12, t9);
    			append_hydration_dev(div12, div5);
    			append_hydration_dev(div5, t10);
    			append_hydration_dev(div12, t11);
    			append_hydration_dev(div12, div6);
    			append_hydration_dev(div6, t12);
    			append_hydration_dev(div12, t13);
    			append_hydration_dev(div12, div7);
    			append_hydration_dev(div7, t14);
    			append_hydration_dev(div12, t15);
    			append_hydration_dev(div12, div8);
    			append_hydration_dev(div8, t16);
    			append_hydration_dev(div12, t17);
    			append_hydration_dev(div12, div9);
    			append_hydration_dev(div9, t18);
    			append_hydration_dev(div12, t19);
    			append_hydration_dev(div12, div10);
    			append_hydration_dev(div10, t20);
    			append_hydration_dev(div12, t21);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, t22);
    			append_hydration_dev(div12, t23);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*standings*/ 8 && t0_value !== (t0_value = /*row*/ ctx[10].position + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*standings*/ 8 && t2_value !== (t2_value = /*row*/ ctx[10].team + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*standings*/ 8 && t4_value !== (t4_value = /*row*/ ctx[10].won + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*standings*/ 8 && t6_value !== (t6_value = /*row*/ ctx[10].drawn + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*standings*/ 8 && t8_value !== (t8_value = /*row*/ ctx[10].lost + "")) set_data_dev(t8, t8_value);
    			if (dirty & /*standings*/ 8 && t10_value !== (t10_value = /*row*/ ctx[10].gF + "")) set_data_dev(t10, t10_value);
    			if (dirty & /*standings*/ 8 && t12_value !== (t12_value = /*row*/ ctx[10].gA + "")) set_data_dev(t12, t12_value);
    			if (dirty & /*standings*/ 8 && t14_value !== (t14_value = /*row*/ ctx[10].gD + "")) set_data_dev(t14, t14_value);
    			if (dirty & /*standings*/ 8 && t16_value !== (t16_value = /*row*/ ctx[10].played + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*standings*/ 8 && t18_value !== (t18_value = /*row*/ ctx[10].points + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*data, standings*/ 9 && t20_value !== (t20_value = /*data*/ ctx[0].teamRatings[/*row*/ ctx[10].team].totalRating.toFixed(2) + "")) set_data_dev(t20, t20_value);
    			if (dirty & /*data, standings*/ 9 && t22_value !== (t22_value = /*data*/ ctx[0].form[/*row*/ ctx[10].team][/*data*/ ctx[0]._id][13].formRating5.toFixed(2) + "")) set_data_dev(t22, t22_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div12);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(257:12) {#each standings as row, i}",
    		ctx
    	});

    	return block;
    }

    // (311:6) {#if fixtures != undefined}
    function create_if_block$3(ctx) {
    	let div2;
    	let div0;
    	let button0;
    	let t0;
    	let button0_class_value;
    	let t1;
    	let div1;
    	let button1;
    	let t2;
    	let button1_class_value;
    	let t3;
    	let div7;
    	let div3;
    	let t4;
    	let div6;
    	let div5;
    	let div4;
    	let t5;
    	let mounted;
    	let dispose;
    	let each_value_3 = /*fixtures*/ ctx[1];
    	validate_each_argument(each_value_3);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_2[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let each_value_2 = Array(38);
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = /*fixtures*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			t0 = text("Rating");
    			t1 = space();
    			div1 = element("div");
    			button1 = element("button");
    			t2 = text("Form");
    			t3 = space();
    			div7 = element("div");
    			div3 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t4 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div4 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			button0 = claim_element(div0_nodes, "BUTTON", { id: true, class: true });
    			var button0_nodes = children(button0);
    			t0 = claim_text(button0_nodes, "Rating");
    			button0_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			button1 = claim_element(div1_nodes, "BUTTON", { id: true, class: true });
    			var button1_nodes = children(button1);
    			t2 = claim_text(button1_nodes, "Form");
    			button1_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t3 = claim_space(nodes);
    			div7 = claim_element(nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div3 = claim_element(div7_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].l(div3_nodes);
    			}

    			div3_nodes.forEach(detach_dev);
    			t4 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].l(div4_nodes);
    			}

    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t5 = claim_space(div6_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div6_nodes);
    			}

    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button0, "id", "rating-scale-btn");

    			attr_dev(button0, "class", button0_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] == 'rating'
    			? 'scaling-selected'
    			: '') + " svelte-1gtw5nu");

    			add_location(button0, file$6, 313, 12, 9768);
    			attr_dev(div0, "class", "scale-team-ratings svelte-1gtw5nu");
    			add_location(div0, file$6, 312, 10, 9722);
    			attr_dev(button1, "id", "form-scale-btn");

    			attr_dev(button1, "class", button1_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] == 'form'
    			? 'scaling-selected'
    			: '') + " svelte-1gtw5nu");

    			add_location(button1, file$6, 324, 12, 10121);
    			attr_dev(div1, "class", "scale-team-form svelte-1gtw5nu");
    			add_location(div1, file$6, 323, 10, 10078);
    			attr_dev(div2, "class", "scale-btns svelte-1gtw5nu");
    			add_location(div2, file$6, 311, 8, 9686);
    			attr_dev(div3, "class", "fixtures-teams-container svelte-1gtw5nu");
    			add_location(div3, file$6, 336, 10, 10475);
    			attr_dev(div4, "class", "fixtures-matches svelte-1gtw5nu");
    			add_location(div4, file$6, 356, 14, 11235);
    			attr_dev(div5, "class", "fixtures-table-row svelte-1gtw5nu");
    			add_location(div5, file$6, 355, 12, 11187);
    			attr_dev(div6, "class", "fixtures-matches-container svelte-1gtw5nu");
    			add_location(div6, file$6, 354, 10, 11133);
    			attr_dev(div7, "class", "fixtures-table svelte-1gtw5nu");
    			add_location(div7, file$6, 335, 8, 10435);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div0, button0);
    			append_hydration_dev(button0, t0);
    			append_hydration_dev(div2, t1);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, button1);
    			append_hydration_dev(button1, t2);
    			insert_hydration_dev(target, t3, anchor);
    			insert_hydration_dev(target, div7, anchor);
    			append_hydration_dev(div7, div3);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div3, null);
    			}

    			append_hydration_dev(div7, t4);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, div4);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div4, null);
    			}

    			append_hydration_dev(div6, t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div6, null);
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*applyRatingFixturesScaling*/ ctx[5], false, false, false),
    					listen_dev(button1, "click", /*applyRatingFormScaling*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixturesScaling*/ 16 && button0_class_value !== (button0_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] == 'rating'
    			? 'scaling-selected'
    			: '') + " svelte-1gtw5nu")) {
    				attr_dev(button0, "class", button0_class_value);
    			}

    			if (dirty & /*fixturesScaling*/ 16 && button1_class_value !== (button1_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] == 'form'
    			? 'scaling-selected'
    			: '') + " svelte-1gtw5nu")) {
    				attr_dev(button1, "class", button1_class_value);
    			}

    			if (dirty & /*teamStyle, fixtures, toInitials*/ 2) {
    				each_value_3 = /*fixtures*/ ctx[1];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_3(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_3.length;
    			}

    			if (dirty & /*fixtures, toInitials*/ 2) {
    				each_value = /*fixtures*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div6, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div7);
    			destroy_each(each_blocks_2, detaching);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(311:6) {#if fixtures != undefined}",
    		ctx
    	});

    	return block;
    }

    // (338:12) {#each fixtures as row, i}
    function create_each_block_3(ctx) {
    	let div1;
    	let div0;
    	let t0_value = toInitials(/*row*/ ctx[10].team) + "";
    	let t0;
    	let div0_style_value;
    	let t1;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			t0 = claim_text(div0_nodes, t0_value);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "fixtures-team svelte-1gtw5nu");

    			attr_dev(div0, "style", div0_style_value = "" + (teamStyle(/*row*/ ctx[10].team) + " " + (/*i*/ ctx[15] == 0
    			? 'border-top: 2px solid black; border-radius: 4px 0 0'
    			: '') + " " + (/*i*/ ctx[15] == /*fixtures*/ ctx[1].length - 1
    			? 'border-radius: 0 0 0 4px;'
    			: '')));

    			add_location(div0, file$6, 339, 16, 10619);
    			attr_dev(div1, "class", "fixtures-table-row svelte-1gtw5nu");
    			add_location(div1, file$6, 338, 14, 10569);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div1, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixtures*/ 2 && t0_value !== (t0_value = toInitials(/*row*/ ctx[10].team) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*fixtures*/ 2 && div0_style_value !== (div0_style_value = "" + (teamStyle(/*row*/ ctx[10].team) + " " + (/*i*/ ctx[15] == 0
    			? 'border-top: 2px solid black; border-radius: 4px 0 0'
    			: '') + " " + (/*i*/ ctx[15] == /*fixtures*/ ctx[1].length - 1
    			? 'border-radius: 0 0 0 4px;'
    			: '')))) {
    				attr_dev(div0, "style", div0_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(338:12) {#each fixtures as row, i}",
    		ctx
    	});

    	return block;
    }

    // (358:16) {#each Array(38) as _, i}
    function create_each_block_2(ctx) {
    	let div;
    	let t_value = /*i*/ ctx[15] + 1 + "";
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
    			attr_dev(div, "class", "match svelte-1gtw5nu");
    			add_location(div, file$6, 358, 18, 11328);
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
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(358:16) {#each Array(38) as _, i}",
    		ctx
    	});

    	return block;
    }

    // (366:18) {#each row.matches as match, i}
    function create_each_block_1$1(ctx) {
    	let div;
    	let t0_value = `${toInitials(/*match*/ ctx[13].team)} (${/*match*/ ctx[13].atHome ? "H" : "A"}` + "";
    	let t0;
    	let t1;
    	let div_style_value;
    	let div_title_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = text(")\r\n                    ");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, style: true, title: true });
    			var div_nodes = children(div);
    			t0 = claim_text(div_nodes, t0_value);
    			t1 = claim_text(div_nodes, ")\r\n                    ");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "match svelte-1gtw5nu");

    			attr_dev(div, "style", div_style_value = "background: " + /*match*/ ctx[13].colour + "; " + (/*match*/ ctx[13].status == 'FINISHED'
    			? 'filter: grayscale(100%)'
    			: '') + " " + (/*i*/ ctx[15] == /*row*/ ctx[10].matches.length - 1
    			? 'border-right: 2px solid black'
    			: ''));

    			attr_dev(div, "title", div_title_value = /*match*/ ctx[13].date);
    			add_location(div, file$6, 366, 20, 11636);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(div, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixtures*/ 2 && t0_value !== (t0_value = `${toInitials(/*match*/ ctx[13].team)} (${/*match*/ ctx[13].atHome ? "H" : "A"}` + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*fixtures*/ 2 && div_style_value !== (div_style_value = "background: " + /*match*/ ctx[13].colour + "; " + (/*match*/ ctx[13].status == 'FINISHED'
    			? 'filter: grayscale(100%)'
    			: '') + " " + (/*i*/ ctx[15] == /*row*/ ctx[10].matches.length - 1
    			? 'border-right: 2px solid black'
    			: ''))) {
    				attr_dev(div, "style", div_style_value);
    			}

    			if (dirty & /*fixtures*/ 2 && div_title_value !== (div_title_value = /*match*/ ctx[13].date)) {
    				attr_dev(div, "title", div_title_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(366:18) {#each row.matches as match, i}",
    		ctx
    	});

    	return block;
    }

    // (363:12) {#each fixtures as row, _}
    function create_each_block$2(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let each_value_1 = /*row*/ ctx[10].matches;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div0_nodes);
    			}

    			div0_nodes.forEach(detach_dev);
    			t = claim_space(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "fixtures-matches svelte-1gtw5nu");
    			add_location(div0, file$6, 364, 16, 11533);
    			attr_dev(div1, "class", "fixtures-table-row svelte-1gtw5nu");
    			add_location(div1, file$6, 363, 14, 11483);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_hydration_dev(div1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixtures, toInitials*/ 2) {
    				each_value_1 = /*row*/ ctx[10].matches;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(363:12) {#each fixtures as row, _}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let div7;
    	let div3;
    	let div1;
    	let div0;
    	let t0;
    	let div2;
    	let t1;
    	let div6;
    	let div5;
    	let div4;
    	let t2;
    	let t3;
    	let t4;
    	let overviewfooter;
    	let current;
    	let if_block0 = /*upcoming*/ ctx[2] != undefined && create_if_block_2$3(ctx);
    	let if_block1 = /*standings*/ ctx[3] != undefined && create_if_block_1$3(ctx);
    	let if_block2 = /*fixtures*/ ctx[1] != undefined && create_if_block$3(ctx);
    	overviewfooter = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div2 = element("div");
    			if (if_block1) if_block1.c();
    			t1 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div4 = element("div");
    			t2 = text("Fixtures");
    			t3 = space();
    			if (if_block2) if_block2.c();
    			t4 = space();
    			create_component(overviewfooter.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div7 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div7_nodes = children(div7);
    			div3 = claim_element(div7_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			if (if_block0) if_block0.l(div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t0 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			if (if_block1) if_block1.l(div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t1 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t2 = claim_text(div4_nodes, "Fixtures");
    			div4_nodes.forEach(detach_dev);
    			t3 = claim_space(div5_nodes);
    			if (if_block2) if_block2.l(div5_nodes);
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t4 = claim_space(nodes);
    			claim_component(overviewfooter.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "upcoming-matches-container");
    			add_location(div0, file$6, 193, 6, 5282);
    			attr_dev(div1, "class", "left svelte-1gtw5nu");
    			add_location(div1, file$6, 192, 4, 5256);
    			attr_dev(div2, "class", "standings-container svelte-1gtw5nu");
    			add_location(div2, file$6, 237, 4, 6894);
    			attr_dev(div3, "class", "row svelte-1gtw5nu");
    			add_location(div3, file$6, 191, 2, 5233);
    			attr_dev(div4, "class", "fixtures-title svelte-1gtw5nu");
    			add_location(div4, file$6, 309, 6, 9599);
    			attr_dev(div5, "class", "fixtures svelte-1gtw5nu");
    			add_location(div5, file$6, 308, 4, 9569);
    			attr_dev(div6, "class", "row svelte-1gtw5nu");
    			add_location(div6, file$6, 307, 2, 9546);
    			attr_dev(div7, "id", "page-content");
    			attr_dev(div7, "class", "svelte-1gtw5nu");
    			add_location(div7, file$6, 190, 0, 5206);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div7, anchor);
    			append_hydration_dev(div7, div3);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append_hydration_dev(div3, t0);
    			append_hydration_dev(div3, div2);
    			if (if_block1) if_block1.m(div2, null);
    			append_hydration_dev(div7, t1);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, t2);
    			append_hydration_dev(div5, t3);
    			if (if_block2) if_block2.m(div5, null);
    			insert_hydration_dev(target, t4, anchor);
    			mount_component(overviewfooter, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*upcoming*/ ctx[2] != undefined) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$3(ctx);
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*standings*/ ctx[3] != undefined) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$3(ctx);
    					if_block1.c();
    					if_block1.m(div2, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*fixtures*/ ctx[1] != undefined) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$3(ctx);
    					if_block2.c();
    					if_block2.m(div5, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(overviewfooter.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(overviewfooter.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (detaching) detach_dev(t4);
    			destroy_component(overviewfooter, detaching);
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

    function fixtureColour(scaleVal) {
    	if (scaleVal < 0.2) {
    		return "#00fe87";
    	} else if (scaleVal < 0.25) {
    		return "#63fb6e";
    	} else if (scaleVal < 0.35) {
    		return "#8df755";
    	} else if (scaleVal < 0.4) {
    		return "#aef23e";
    	} else if (scaleVal < 0.45) {
    		return "#cbec27";
    	} else if (scaleVal < 0.5) {
    		return "#e6e50f";
    	} else if (scaleVal < 0.55) {
    		return "#ffdd00";
    	} else if (scaleVal < 0.6) {
    		return "#ffc400";
    	} else if (scaleVal < 0.65) {
    		return "#ffab00";
    	} else if (scaleVal < 0.7) {
    		return "#ff9000";
    	} else if (scaleVal < 0.75) {
    		return "#ff7400";
    	} else if (scaleVal < 0.8) {
    		return "#ff5618";
    	} else {
    		return "#f83027";
    	}
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Overview', slots, []);

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

    	function applyRatingFixturesScaling() {
    		if (fixturesScaling == "rating") {
    			return;
    		}

    		$$invalidate(4, fixturesScaling = "rating");

    		for (let teamFixtures of fixtures) {
    			for (let match of teamFixtures.matches) {
    				let homeAdvantage = match.atHome
    				? 0
    				: data.homeAdvantages[match.team].totalHomeAdvantage;

    				match.colour = fixtureColourSkewed(data.teamRatings[match.team].totalRating + homeAdvantage);
    			}
    		}

    		$$invalidate(1, fixtures);
    	}

    	function applyRatingFormScaling() {
    		if (fixturesScaling == "form") {
    			return;
    		}

    		$$invalidate(4, fixturesScaling = "form");

    		for (let teamFixtures of fixtures) {
    			for (let match of teamFixtures.matches) {
    				let form = 0.5;
    				let matchdays = Object.keys(data.form[teamFixtures.team][data._id]).reverse();

    				let homeAdvantage = match.atHome
    				? 0
    				: data.homeAdvantages[match.team].totalHomeAdvantage;

    				for (let matchday of matchdays) {
    					if (data.form[match.team][data._id][matchday].formRating5 != null) {
    						form = data.form[match.team][data._id][matchday].formRating5;
    					}
    				}

    				match.colour = fixtureColour(form + homeAdvantage);
    			}
    		}

    		$$invalidate(1, fixtures);
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
    	let fixturesScaling = "rating";

    	onMount(() => {
    		$$invalidate(2, upcoming = upcomingMatches());
    		$$invalidate(3, standings = standingsTable());
    		$$invalidate(1, fixtures = fixturesTable(standings));
    	});

    	let { data } = $$props;
    	const writable_props = ['data'];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Overview> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		toInitials,
    		teamStyle,
    		OverviewFooter: Footer,
    		upcomingMatches,
    		standingsTable,
    		applyRatingFixturesScaling,
    		applyRatingFormScaling,
    		fixturesTable,
    		fixtureColourSkewed,
    		fixtureColour,
    		upcoming,
    		standings,
    		fixtures,
    		fixturesScaling,
    		data
    	});

    	$$self.$inject_state = $$props => {
    		if ('upcoming' in $$props) $$invalidate(2, upcoming = $$props.upcoming);
    		if ('standings' in $$props) $$invalidate(3, standings = $$props.standings);
    		if ('fixtures' in $$props) $$invalidate(1, fixtures = $$props.fixtures);
    		if ('fixturesScaling' in $$props) $$invalidate(4, fixturesScaling = $$props.fixturesScaling);
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*fixtures*/ 2) ;
    	};

    	return [
    		data,
    		fixtures,
    		upcoming,
    		standings,
    		fixturesScaling,
    		applyRatingFixturesScaling,
    		applyRatingFormScaling
    	];
    }

    class Overview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { data: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Overview",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[0] === undefined && !('data' in props)) {
    			console.warn("<Overview> was created without expected prop 'data'");
    		}
    	}

    	get data() {
    		throw new Error("<Overview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Overview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\nav\MobileNav.svelte generated by Svelte v3.50.1 */
    const file$5 = "src\\components\\nav\\MobileNav.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    // (27:2) {#if hyphenatedTeams != undefined}
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
    			attr_dev(div, "class", "team-links svelte-6va0xs");
    			add_location(div, file$5, 27, 4, 904);
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
    		source: "(27:2) {#if hyphenatedTeams != undefined}",
    		ctx
    	});

    	return block;
    }

    // (30:8) {#if team != null}
    function create_if_block_1$2(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[13] == 0 || /*i*/ ctx[13] == 1 && /*hyphenatedTeams*/ ctx[2][0] == null) return create_if_block_2$2;
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
    		source: "(30:8) {#if team != null}",
    		ctx
    	});

    	return block;
    }

    // (51:10) {:else}
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
    			attr_dev(button, "class", "team-link svelte-6va0xs");
    			add_location(button, file$5, 51, 12, 2029);
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
    		source: "(51:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:144) 
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
    			attr_dev(button, "class", "team-link last-team svelte-6va0xs");
    			add_location(button, file$5, 42, 12, 1666);
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
    		source: "(41:144) ",
    		ctx
    	});

    	return block;
    }

    // (31:10) {#if i == 0 || (i == 1 && hyphenatedTeams[0] == null)}
    function create_if_block_2$2(ctx) {
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
    			attr_dev(button, "class", "team-link first-team svelte-6va0xs");
    			add_location(button, file$5, 32, 12, 1129);
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
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(31:10) {#if i == 0 || (i == 1 && hyphenatedTeams[0] == null)}",
    		ctx
    	});

    	return block;
    }

    // (29:6) {#each hyphenatedTeams as team, i}
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
    		source: "(29:6) {#each hyphenatedTeams as team, i}",
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
    			attr_dev(nav, "class", "svelte-6va0xs");
    			add_location(nav, file$5, 25, 0, 821);
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
    			let teamLink = toHyphenatedName(teams[i]);

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
    		toHyphenatedName,
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
    			hyphenatedTeam && teams.length > 0 && getHyphenatedTeamNames();
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

    /* src\components\team\goals_scored_and_conceded\ScoredConcededOverTimeGraph.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1$1 } = globals;
    const file$4 = "src\\components\\team\\goals_scored_and_conceded\\ScoredConcededOverTimeGraph.svelte";

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
    			add_location(div0, file$4, 271, 2, 9195);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$4, 270, 0, 9174);
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

    function seasonFinishLines(seasonBoundaries, maxY) {
    	let lines = [];

    	for (let i = 0; i < seasonBoundaries.length; i++) {
    		lines.push({
    			type: "line",
    			x0: seasonBoundaries[i],
    			y0: 0,
    			x1: seasonBoundaries[i],
    			y1: maxY,
    			line: { color: "black", dash: "dot", width: 1 }
    		});
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
    		return a.days < b.days ? -1 : a.days == b.days ? 0 : 1;
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

    		if (goals[i].matchday == '38') {
    			// Season boundary line a week after season finish
    			seasonBoundaries.push(goals[i].days + 7);

    			ticktext.push(goals[i].matchday);
    			tickvals.push(goals[i].days);
    		} else if (goals[i].matchday == '1') {
    			ticktext.push(goals[i].matchday);
    			tickvals.push(goals[i].days);
    		} else if (goals[i].matchday == '19' || i == goals.length - 1) {
    			let season = data._id - numSeasons + 1 + Math.floor(i / 38);

    			// If in current season and matchday is 19, wait for until reach final 
    			// matchday in current season instead to place season ticktext label
    			if (season != data._id || goals[i].matchday != '19') {
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

    function lines(days, scored, conceded, dates) {
    	return [goalsScoredLine(days, scored, dates), goalsConcededLine(days, conceded, dates)];
    }

    function defaultLayout(ticktext, tickvals, seasonLines) {
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

    function buildPlotData(data, team) {
    	let [dates, days, seasonBoundaries, ticktext, tickvals, scored, conceded] = lineData(data, team);
    	let maxY = Math.max(Math.max(...scored), Math.max(...conceded));
    	let seasonLines = seasonFinishLines(seasonBoundaries, maxY);

    	let plotData = {
    		data: [...lines(days, scored, conceded, dates)],
    		layout: defaultLayout(ticktext, tickvals, seasonLines),
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
    		seasonFinishLines,
    		goalsScoredLine,
    		goalsConcededLine,
    		numDays,
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

    /* src\routes\Dashboard.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1, console: console_1$1, document: document_1$1, window: window_1 } = globals;

    const file$3 = "src\\routes\\Dashboard.svelte";

    // (150:4) {:else}
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
    			attr_dev(button, "class", "svelte-qtsjuh");
    			add_location(button, file$3, 150, 6, 5859);
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
    		source: "(150:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (147:4) {#if teams.length == 0}
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
    			attr_dev(button, "class", "svelte-qtsjuh");
    			add_location(button, file$3, 148, 6, 5768);
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
    		source: "(147:4) {#if teams.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (331:6) {:else}
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
    			add_location(div0, file$3, 332, 10, 12198);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$3, 331, 8, 12147);
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
    		source: "(331:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (168:6) {#if data != undefined}
    function create_if_block$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*hyphenatedTeam*/ ctx[0] == "overview") return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
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
    			current_block_type_index = select_block_type_2(ctx);

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
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(168:6) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (171:8) {:else}
    function create_else_block$1(ctx) {
    	let div12;
    	let div5;
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
    	let t1_value = /*data*/ ctx[9].standings[/*team*/ ctx[5]][/*data*/ ctx[9]._id].position + "";
    	let t1;
    	let t2;
    	let div4;
    	let h10;
    	let t3;
    	let t4;
    	let div3;
    	let fixturesgraph;
    	let t5;
    	let div8;
    	let div6;
    	let currentform;
    	let t6;
    	let tablesnippet;
    	let t7;
    	let div7;
    	let nextgame;
    	let t8;
    	let div11;
    	let div10;
    	let h11;
    	let t9;
    	let t10;
    	let div9;
    	let formovertimegraph;
    	let updating_lazyLoad;
    	let t11;
    	let current;

    	fixturesgraph = new FixturesGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	currentform = new CurrentForm({
    			props: {
    				data: /*data*/ ctx[9],
    				currentMatchday: /*currentMatchday*/ ctx[7],
    				team: /*team*/ ctx[5]
    			},
    			$$inline: true
    		});

    	tablesnippet = new TableSnippet({
    			props: {
    				data: /*data*/ ctx[9],
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				team: /*team*/ ctx[5],
    				switchTeam: /*switchTeam*/ ctx[11]
    			},
    			$$inline: true
    		});

    	nextgame = new NextGame({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				switchTeam: /*switchTeam*/ ctx[11]
    			},
    			$$inline: true
    		});

    	function formovertimegraph_lazyLoad_binding(value) {
    		/*formovertimegraph_lazyLoad_binding*/ ctx[14](value);
    	}

    	let formovertimegraph_props = {
    		data: /*data*/ ctx[9],
    		team: /*team*/ ctx[5],
    		playedDates: /*playedDates*/ ctx[8],
    		mobileView: /*mobileView*/ ctx[10]
    	};

    	if (/*load*/ ctx[3] !== void 0) {
    		formovertimegraph_props.lazyLoad = /*load*/ ctx[3];
    	}

    	formovertimegraph = new FormOverTimeGraph({
    			props: formovertimegraph_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(formovertimegraph, 'lazyLoad', formovertimegraph_lazyLoad_binding));
    	let if_block = /*load*/ ctx[3] && create_if_block_2$1(ctx);

    	const block = {
    		c: function create() {
    			div12 = element("div");
    			div5 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			svg = svg_element("svg");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			circle2 = svg_element("circle");
    			t0 = space();
    			div1 = element("div");
    			t1 = text(t1_value);
    			t2 = space();
    			div4 = element("div");
    			h10 = element("h1");
    			t3 = text("Fixtures");
    			t4 = space();
    			div3 = element("div");
    			create_component(fixturesgraph.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			div6 = element("div");
    			create_component(currentform.$$.fragment);
    			t6 = space();
    			create_component(tablesnippet.$$.fragment);
    			t7 = space();
    			div7 = element("div");
    			create_component(nextgame.$$.fragment);
    			t8 = space();
    			div11 = element("div");
    			div10 = element("div");
    			h11 = element("h1");
    			t9 = text("Form");
    			t10 = space();
    			div9 = element("div");
    			create_component(formovertimegraph.$$.fragment);
    			t11 = space();
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div12 = claim_element(nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div5 = claim_element(div12_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
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
    			t2 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			h10 = claim_element(div4_nodes, "H1", { class: true });
    			var h10_nodes = children(h10);
    			t3 = claim_text(h10_nodes, "Fixtures");
    			h10_nodes.forEach(detach_dev);
    			t4 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(fixturesgraph.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t5 = claim_space(div12_nodes);
    			div8 = claim_element(div12_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div6 = claim_element(div8_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			claim_component(currentform.$$.fragment, div6_nodes);
    			t6 = claim_space(div6_nodes);
    			claim_component(tablesnippet.$$.fragment, div6_nodes);
    			div6_nodes.forEach(detach_dev);
    			t7 = claim_space(div8_nodes);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			claim_component(nextgame.$$.fragment, div7_nodes);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t8 = claim_space(div12_nodes);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h11 = claim_element(div10_nodes, "H1", { class: true });
    			var h11_nodes = children(h11);
    			t9 = claim_text(h11_nodes, "Form");
    			h11_nodes.forEach(detach_dev);
    			t10 = claim_space(div10_nodes);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			claim_component(formovertimegraph.$$.fragment, div9_nodes);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t11 = claim_space(div12_nodes);
    			if (if_block) if_block.l(div12_nodes);
    			div12_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(circle0, "cx", "300");
    			attr_dev(circle0, "cy", "150");
    			attr_dev(circle0, "r", "100");
    			attr_dev(circle0, "stroke-width", "0");
    			attr_dev(circle0, "fill", circle0_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(circle0, file$3, 176, 20, 6803);
    			attr_dev(circle1, "cx", "170");
    			attr_dev(circle1, "cy", "170");
    			attr_dev(circle1, "r", "140");
    			attr_dev(circle1, "stroke-width", "0");
    			attr_dev(circle1, "fill", circle1_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(circle1, file$3, 183, 20, 7055);
    			attr_dev(circle2, "cx", "300");
    			attr_dev(circle2, "cy", "320");
    			attr_dev(circle2, "r", "170");
    			attr_dev(circle2, "stroke-width", "0");
    			attr_dev(circle2, "fill", circle2_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(circle2, file$3, 190, 20, 7297);
    			attr_dev(svg, "class", "circles-background svelte-qtsjuh");
    			add_location(svg, file$3, 175, 18, 6749);
    			attr_dev(div0, "class", "circles-background-container svelte-qtsjuh");
    			add_location(div0, file$3, 174, 16, 6687);
    			attr_dev(div1, "class", "position-central svelte-qtsjuh");
    			add_location(div1, file$3, 199, 16, 7585);
    			attr_dev(div2, "class", "row-left position-no-badge svelte-qtsjuh");
    			add_location(div2, file$3, 173, 14, 6629);
    			attr_dev(h10, "class", "lowered svelte-qtsjuh");
    			add_location(h10, file$3, 204, 16, 7804);
    			attr_dev(div3, "class", "graph mini-graph mobile-margin");
    			add_location(div3, file$3, 205, 16, 7855);
    			attr_dev(div4, "class", "row-right fixtures-graph row-graph svelte-qtsjuh");
    			add_location(div4, file$3, 203, 14, 7738);
    			attr_dev(div5, "class", "row multi-element-row small-bottom-margin svelte-qtsjuh");
    			add_location(div5, file$3, 172, 12, 6558);
    			attr_dev(div6, "class", "row-left form-details svelte-qtsjuh");
    			add_location(div6, file$3, 212, 14, 8096);
    			attr_dev(div7, "class", "row-right svelte-qtsjuh");
    			add_location(div7, file$3, 216, 14, 8328);
    			attr_dev(div8, "class", "row multi-element-row svelte-qtsjuh");
    			add_location(div8, file$3, 211, 12, 8045);
    			attr_dev(h11, "class", "lowered svelte-qtsjuh");
    			add_location(h11, file$3, 223, 16, 8551);
    			attr_dev(div9, "class", "graph full-row-graph svelte-qtsjuh");
    			add_location(div9, file$3, 224, 16, 8598);
    			attr_dev(div10, "class", "form-graph row-graph svelte-qtsjuh");
    			add_location(div10, file$3, 222, 14, 8499);
    			attr_dev(div11, "class", "row svelte-qtsjuh");
    			add_location(div11, file$3, 221, 12, 8466);
    			attr_dev(div12, "class", "page-content svelte-qtsjuh");
    			add_location(div12, file$3, 171, 10, 6518);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div12, anchor);
    			append_hydration_dev(div12, div5);
    			append_hydration_dev(div5, div2);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div0, svg);
    			append_hydration_dev(svg, circle0);
    			append_hydration_dev(svg, circle1);
    			append_hydration_dev(svg, circle2);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div5, t2);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, h10);
    			append_hydration_dev(h10, t3);
    			append_hydration_dev(div4, t4);
    			append_hydration_dev(div4, div3);
    			mount_component(fixturesgraph, div3, null);
    			append_hydration_dev(div12, t5);
    			append_hydration_dev(div12, div8);
    			append_hydration_dev(div8, div6);
    			mount_component(currentform, div6, null);
    			append_hydration_dev(div6, t6);
    			mount_component(tablesnippet, div6, null);
    			append_hydration_dev(div8, t7);
    			append_hydration_dev(div8, div7);
    			mount_component(nextgame, div7, null);
    			append_hydration_dev(div12, t8);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, h11);
    			append_hydration_dev(h11, t9);
    			append_hydration_dev(div10, t10);
    			append_hydration_dev(div10, div9);
    			mount_component(formovertimegraph, div9, null);
    			append_hydration_dev(div12, t11);
    			if (if_block) if_block.m(div12, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*hyphenatedTeam*/ 1 && circle0_fill_value !== (circle0_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)")) {
    				attr_dev(circle0, "fill", circle0_fill_value);
    			}

    			if (!current || dirty & /*hyphenatedTeam*/ 1 && circle1_fill_value !== (circle1_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")")) {
    				attr_dev(circle1, "fill", circle1_fill_value);
    			}

    			if (!current || dirty & /*hyphenatedTeam*/ 1 && circle2_fill_value !== (circle2_fill_value = "var(--" + /*hyphenatedTeam*/ ctx[0] + ")")) {
    				attr_dev(circle2, "fill", circle2_fill_value);
    			}

    			if ((!current || dirty & /*data, team*/ 544) && t1_value !== (t1_value = /*data*/ ctx[9].standings[/*team*/ ctx[5]][/*data*/ ctx[9]._id].position + "")) set_data_dev(t1, t1_value);
    			const fixturesgraph_changes = {};
    			if (dirty & /*data*/ 512) fixturesgraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) fixturesgraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*mobileView*/ 1024) fixturesgraph_changes.mobileView = /*mobileView*/ ctx[10];
    			fixturesgraph.$set(fixturesgraph_changes);
    			const currentform_changes = {};
    			if (dirty & /*data*/ 512) currentform_changes.data = /*data*/ ctx[9];
    			if (dirty & /*currentMatchday*/ 128) currentform_changes.currentMatchday = /*currentMatchday*/ ctx[7];
    			if (dirty & /*team*/ 32) currentform_changes.team = /*team*/ ctx[5];
    			currentform.$set(currentform_changes);
    			const tablesnippet_changes = {};
    			if (dirty & /*data*/ 512) tablesnippet_changes.data = /*data*/ ctx[9];
    			if (dirty & /*hyphenatedTeam*/ 1) tablesnippet_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			if (dirty & /*team*/ 32) tablesnippet_changes.team = /*team*/ ctx[5];
    			tablesnippet.$set(tablesnippet_changes);
    			const nextgame_changes = {};
    			if (dirty & /*data*/ 512) nextgame_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) nextgame_changes.team = /*team*/ ctx[5];
    			nextgame.$set(nextgame_changes);
    			const formovertimegraph_changes = {};
    			if (dirty & /*data*/ 512) formovertimegraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) formovertimegraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*playedDates*/ 256) formovertimegraph_changes.playedDates = /*playedDates*/ ctx[8];
    			if (dirty & /*mobileView*/ 1024) formovertimegraph_changes.mobileView = /*mobileView*/ ctx[10];

    			if (!updating_lazyLoad && dirty & /*load*/ 8) {
    				updating_lazyLoad = true;
    				formovertimegraph_changes.lazyLoad = /*load*/ ctx[3];
    				add_flush_callback(() => updating_lazyLoad = false);
    			}

    			formovertimegraph.$set(formovertimegraph_changes);

    			if (/*load*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*load*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div12, null);
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
    			transition_in(fixturesgraph.$$.fragment, local);
    			transition_in(currentform.$$.fragment, local);
    			transition_in(tablesnippet.$$.fragment, local);
    			transition_in(nextgame.$$.fragment, local);
    			transition_in(formovertimegraph.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fixturesgraph.$$.fragment, local);
    			transition_out(currentform.$$.fragment, local);
    			transition_out(tablesnippet.$$.fragment, local);
    			transition_out(nextgame.$$.fragment, local);
    			transition_out(formovertimegraph.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div12);
    			destroy_component(fixturesgraph);
    			destroy_component(currentform);
    			destroy_component(tablesnippet);
    			destroy_component(nextgame);
    			destroy_component(formovertimegraph);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(171:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (169:8) {#if hyphenatedTeam == "overview"}
    function create_if_block_1$1(ctx) {
    	let overview;
    	let current;

    	overview = new Overview({
    			props: { data: /*data*/ ctx[9] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(overview.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(overview.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(overview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const overview_changes = {};
    			if (dirty & /*data*/ 512) overview_changes.data = /*data*/ ctx[9];
    			overview.$set(overview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(overview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(overview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(overview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(169:8) {#if hyphenatedTeam == \\\"overview\\\"}",
    		ctx
    	});

    	return block;
    }

    // (237:12) {#if load}
    function create_if_block_2$1(ctx) {
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
    	let pointsovertimegraph;
    	let t5;
    	let div8;
    	let div7;
    	let h12;
    	let t6;
    	let t7;
    	let div6;
    	let goalsscoredandconcededgraph;
    	let t8;
    	let div11;
    	let div10;
    	let div9;
    	let cleansheetsgraph;
    	let t9;
    	let div12;
    	let statsvalues;
    	let t10;
    	let div15;
    	let div14;
    	let div13;
    	let scoredconcededovertimegraph;
    	let t11;
    	let div17;
    	let div16;
    	let h13;
    	let t12;
    	let t13;
    	let goalspergame;
    	let t14;
    	let div20;
    	let div19;
    	let div18;
    	let scorelinefreqgraph;
    	let t15;
    	let div23;
    	let div22;
    	let h14;
    	let t16;
    	let t17;
    	let div21;
    	let spidergraph;
    	let t18;
    	let teamsfooter;
    	let current;

    	positionovertimegraph = new PositionOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	pointsovertimegraph = new PointsOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	goalsscoredandconcededgraph = new ScoredConcededPerGameGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				playedDates: /*playedDates*/ ctx[8],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	cleansheetsgraph = new CleanSheetsGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				playedDates: /*playedDates*/ ctx[8],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	statsvalues = new StatsValues({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5]
    			},
    			$$inline: true
    		});

    	scoredconcededovertimegraph = new ScoredConcededOverTimeGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	goalspergame = new GoalsPerGame({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	scorelinefreqgraph = new ScorelineFreqGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				mobileView: /*mobileView*/ ctx[10]
    			},
    			$$inline: true
    		});

    	spidergraph = new SpiderGraph({
    			props: {
    				data: /*data*/ ctx[9],
    				team: /*team*/ ctx[5],
    				teams: /*teams*/ ctx[6]
    			},
    			$$inline: true
    		});

    	teamsfooter = new Footer$1({
    			props: { lastUpdated: /*data*/ ctx[9].lastUpdated },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			h10 = element("h1");
    			t0 = text("Position");
    			t1 = space();
    			div0 = element("div");
    			create_component(positionovertimegraph.$$.fragment);
    			t2 = space();
    			div5 = element("div");
    			div4 = element("div");
    			h11 = element("h1");
    			t3 = text("Points");
    			t4 = space();
    			div3 = element("div");
    			create_component(pointsovertimegraph.$$.fragment);
    			t5 = space();
    			div8 = element("div");
    			div7 = element("div");
    			h12 = element("h1");
    			t6 = text("Goals Scored and Conceded");
    			t7 = space();
    			div6 = element("div");
    			create_component(goalsscoredandconcededgraph.$$.fragment);
    			t8 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			create_component(cleansheetsgraph.$$.fragment);
    			t9 = space();
    			div12 = element("div");
    			create_component(statsvalues.$$.fragment);
    			t10 = space();
    			div15 = element("div");
    			div14 = element("div");
    			div13 = element("div");
    			create_component(scoredconcededovertimegraph.$$.fragment);
    			t11 = space();
    			div17 = element("div");
    			div16 = element("div");
    			h13 = element("h1");
    			t12 = text("Goals Per Game");
    			t13 = space();
    			create_component(goalspergame.$$.fragment);
    			t14 = space();
    			div20 = element("div");
    			div19 = element("div");
    			div18 = element("div");
    			create_component(scorelinefreqgraph.$$.fragment);
    			t15 = space();
    			div23 = element("div");
    			div22 = element("div");
    			h14 = element("h1");
    			t16 = text("Team Comparison");
    			t17 = space();
    			div21 = element("div");
    			create_component(spidergraph.$$.fragment);
    			t18 = space();
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
    			t0 = claim_text(h10_nodes, "Position");
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
    			t3 = claim_text(h11_nodes, "Points");
    			h11_nodes.forEach(detach_dev);
    			t4 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(pointsovertimegraph.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t5 = claim_space(nodes);
    			div8 = claim_element(nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			h12 = claim_element(div7_nodes, "H1", { class: true });
    			var h12_nodes = children(h12);
    			t6 = claim_text(h12_nodes, "Goals Scored and Conceded");
    			h12_nodes.forEach(detach_dev);
    			t7 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			claim_component(goalsscoredandconcededgraph.$$.fragment, div6_nodes);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t8 = claim_space(nodes);
    			div11 = claim_element(nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			claim_component(cleansheetsgraph.$$.fragment, div9_nodes);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t9 = claim_space(nodes);
    			div12 = claim_element(nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			claim_component(statsvalues.$$.fragment, div12_nodes);
    			div12_nodes.forEach(detach_dev);
    			t10 = claim_space(nodes);
    			div15 = claim_element(nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			div14 = claim_element(div15_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			claim_component(scoredconcededovertimegraph.$$.fragment, div13_nodes);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			t11 = claim_space(nodes);
    			div17 = claim_element(nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			div16 = claim_element(div17_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			h13 = claim_element(div16_nodes, "H1", {});
    			var h13_nodes = children(h13);
    			t12 = claim_text(h13_nodes, "Goals Per Game");
    			h13_nodes.forEach(detach_dev);
    			t13 = claim_space(div16_nodes);
    			claim_component(goalspergame.$$.fragment, div16_nodes);
    			div16_nodes.forEach(detach_dev);
    			div17_nodes.forEach(detach_dev);
    			t14 = claim_space(nodes);
    			div20 = claim_element(nodes, "DIV", { class: true });
    			var div20_nodes = children(div20);
    			div19 = claim_element(div20_nodes, "DIV", { class: true });
    			var div19_nodes = children(div19);
    			div18 = claim_element(div19_nodes, "DIV", { class: true });
    			var div18_nodes = children(div18);
    			claim_component(scorelinefreqgraph.$$.fragment, div18_nodes);
    			div18_nodes.forEach(detach_dev);
    			div19_nodes.forEach(detach_dev);
    			div20_nodes.forEach(detach_dev);
    			t15 = claim_space(nodes);
    			div23 = claim_element(nodes, "DIV", { class: true });
    			var div23_nodes = children(div23);
    			div22 = claim_element(div23_nodes, "DIV", { class: true });
    			var div22_nodes = children(div22);
    			h14 = claim_element(div22_nodes, "H1", {});
    			var h14_nodes = children(h14);
    			t16 = claim_text(h14_nodes, "Team Comparison");
    			h14_nodes.forEach(detach_dev);
    			t17 = claim_space(div22_nodes);
    			div21 = claim_element(div22_nodes, "DIV", { class: true });
    			var div21_nodes = children(div21);
    			claim_component(spidergraph.$$.fragment, div21_nodes);
    			div21_nodes.forEach(detach_dev);
    			div22_nodes.forEach(detach_dev);
    			div23_nodes.forEach(detach_dev);
    			t18 = claim_space(nodes);
    			claim_component(teamsfooter.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h10, "class", "lowered svelte-qtsjuh");
    			add_location(h10, file$3, 239, 18, 9070);
    			attr_dev(div0, "class", "graph full-row-graph svelte-qtsjuh");
    			add_location(div0, file$3, 240, 18, 9123);
    			attr_dev(div1, "class", "position-over-time-graph row-graph svelte-qtsjuh");
    			add_location(div1, file$3, 238, 16, 9002);
    			attr_dev(div2, "class", "row svelte-qtsjuh");
    			add_location(div2, file$3, 237, 14, 8967);
    			attr_dev(h11, "class", "lowered svelte-qtsjuh");
    			add_location(h11, file$3, 252, 18, 9514);
    			attr_dev(div3, "class", "graph full-row-graph svelte-qtsjuh");
    			add_location(div3, file$3, 253, 18, 9565);
    			attr_dev(div4, "class", "position-over-time-graph row-graph svelte-qtsjuh");
    			add_location(div4, file$3, 251, 16, 9446);
    			attr_dev(div5, "class", "row svelte-qtsjuh");
    			add_location(div5, file$3, 250, 14, 9411);
    			attr_dev(h12, "class", "lowered svelte-qtsjuh");
    			add_location(h12, file$3, 265, 18, 9977);
    			attr_dev(div6, "class", "graph full-row-graph svelte-qtsjuh");
    			add_location(div6, file$3, 266, 18, 10047);
    			attr_dev(div7, "class", "goals-scored-vs-conceded-graph row-graph svelte-qtsjuh");
    			add_location(div7, file$3, 264, 16, 9903);
    			attr_dev(div8, "class", "row no-bottom-margin svelte-qtsjuh");
    			add_location(div8, file$3, 263, 14, 9851);
    			attr_dev(div9, "class", "clean-sheets graph full-row-graph svelte-qtsjuh");
    			add_location(div9, file$3, 279, 18, 10456);
    			attr_dev(div10, "class", "row-graph svelte-qtsjuh");
    			add_location(div10, file$3, 278, 16, 10413);
    			attr_dev(div11, "class", "row svelte-qtsjuh");
    			add_location(div11, file$3, 277, 14, 10378);
    			attr_dev(div12, "class", "season-stats-row svelte-qtsjuh");
    			add_location(div12, file$3, 290, 14, 10789);
    			attr_dev(div13, "class", "graph full-row-graph svelte-qtsjuh");
    			add_location(div13, file$3, 296, 18, 10984);
    			attr_dev(div14, "class", "row-graph svelte-qtsjuh");
    			add_location(div14, file$3, 295, 16, 10941);
    			attr_dev(div15, "class", "row svelte-qtsjuh");
    			add_location(div15, file$3, 294, 14, 10906);
    			add_location(h13, file$3, 304, 18, 11281);
    			attr_dev(div16, "class", "goals-freq-row row-graph svelte-qtsjuh");
    			add_location(div16, file$3, 303, 16, 11223);
    			attr_dev(div17, "class", "row svelte-qtsjuh");
    			add_location(div17, file$3, 302, 14, 11188);
    			attr_dev(div18, "class", "score-freq graph svelte-qtsjuh");
    			add_location(div18, file$3, 311, 18, 11509);
    			attr_dev(div19, "class", "row-graph svelte-qtsjuh");
    			add_location(div19, file$3, 310, 16, 11466);
    			attr_dev(div20, "class", "row svelte-qtsjuh");
    			add_location(div20, file$3, 309, 14, 11431);
    			add_location(h14, file$3, 319, 18, 11795);
    			attr_dev(div21, "class", "spider-chart-container svelte-qtsjuh");
    			add_location(div21, file$3, 320, 18, 11839);
    			attr_dev(div22, "class", "spider-chart-row row-graph svelte-qtsjuh");
    			add_location(div22, file$3, 318, 16, 11735);
    			attr_dev(div23, "class", "row svelte-qtsjuh");
    			add_location(div23, file$3, 317, 14, 11700);
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
    			mount_component(pointsovertimegraph, div3, null);
    			insert_hydration_dev(target, t5, anchor);
    			insert_hydration_dev(target, div8, anchor);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, h12);
    			append_hydration_dev(h12, t6);
    			append_hydration_dev(div7, t7);
    			append_hydration_dev(div7, div6);
    			mount_component(goalsscoredandconcededgraph, div6, null);
    			insert_hydration_dev(target, t8, anchor);
    			insert_hydration_dev(target, div11, anchor);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, div9);
    			mount_component(cleansheetsgraph, div9, null);
    			insert_hydration_dev(target, t9, anchor);
    			insert_hydration_dev(target, div12, anchor);
    			mount_component(statsvalues, div12, null);
    			insert_hydration_dev(target, t10, anchor);
    			insert_hydration_dev(target, div15, anchor);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, div13);
    			mount_component(scoredconcededovertimegraph, div13, null);
    			insert_hydration_dev(target, t11, anchor);
    			insert_hydration_dev(target, div17, anchor);
    			append_hydration_dev(div17, div16);
    			append_hydration_dev(div16, h13);
    			append_hydration_dev(h13, t12);
    			append_hydration_dev(div16, t13);
    			mount_component(goalspergame, div16, null);
    			insert_hydration_dev(target, t14, anchor);
    			insert_hydration_dev(target, div20, anchor);
    			append_hydration_dev(div20, div19);
    			append_hydration_dev(div19, div18);
    			mount_component(scorelinefreqgraph, div18, null);
    			insert_hydration_dev(target, t15, anchor);
    			insert_hydration_dev(target, div23, anchor);
    			append_hydration_dev(div23, div22);
    			append_hydration_dev(div22, h14);
    			append_hydration_dev(h14, t16);
    			append_hydration_dev(div22, t17);
    			append_hydration_dev(div22, div21);
    			mount_component(spidergraph, div21, null);
    			insert_hydration_dev(target, t18, anchor);
    			mount_component(teamsfooter, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const positionovertimegraph_changes = {};
    			if (dirty & /*data*/ 512) positionovertimegraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) positionovertimegraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*mobileView*/ 1024) positionovertimegraph_changes.mobileView = /*mobileView*/ ctx[10];
    			positionovertimegraph.$set(positionovertimegraph_changes);
    			const pointsovertimegraph_changes = {};
    			if (dirty & /*data*/ 512) pointsovertimegraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) pointsovertimegraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*mobileView*/ 1024) pointsovertimegraph_changes.mobileView = /*mobileView*/ ctx[10];
    			pointsovertimegraph.$set(pointsovertimegraph_changes);
    			const goalsscoredandconcededgraph_changes = {};
    			if (dirty & /*data*/ 512) goalsscoredandconcededgraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) goalsscoredandconcededgraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*playedDates*/ 256) goalsscoredandconcededgraph_changes.playedDates = /*playedDates*/ ctx[8];
    			if (dirty & /*mobileView*/ 1024) goalsscoredandconcededgraph_changes.mobileView = /*mobileView*/ ctx[10];
    			goalsscoredandconcededgraph.$set(goalsscoredandconcededgraph_changes);
    			const cleansheetsgraph_changes = {};
    			if (dirty & /*data*/ 512) cleansheetsgraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) cleansheetsgraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*playedDates*/ 256) cleansheetsgraph_changes.playedDates = /*playedDates*/ ctx[8];
    			if (dirty & /*mobileView*/ 1024) cleansheetsgraph_changes.mobileView = /*mobileView*/ ctx[10];
    			cleansheetsgraph.$set(cleansheetsgraph_changes);
    			const statsvalues_changes = {};
    			if (dirty & /*data*/ 512) statsvalues_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) statsvalues_changes.team = /*team*/ ctx[5];
    			statsvalues.$set(statsvalues_changes);
    			const scoredconcededovertimegraph_changes = {};
    			if (dirty & /*data*/ 512) scoredconcededovertimegraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) scoredconcededovertimegraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*mobileView*/ 1024) scoredconcededovertimegraph_changes.mobileView = /*mobileView*/ ctx[10];
    			scoredconcededovertimegraph.$set(scoredconcededovertimegraph_changes);
    			const goalspergame_changes = {};
    			if (dirty & /*data*/ 512) goalspergame_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) goalspergame_changes.team = /*team*/ ctx[5];
    			if (dirty & /*mobileView*/ 1024) goalspergame_changes.mobileView = /*mobileView*/ ctx[10];
    			goalspergame.$set(goalspergame_changes);
    			const scorelinefreqgraph_changes = {};
    			if (dirty & /*data*/ 512) scorelinefreqgraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) scorelinefreqgraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*mobileView*/ 1024) scorelinefreqgraph_changes.mobileView = /*mobileView*/ ctx[10];
    			scorelinefreqgraph.$set(scorelinefreqgraph_changes);
    			const spidergraph_changes = {};
    			if (dirty & /*data*/ 512) spidergraph_changes.data = /*data*/ ctx[9];
    			if (dirty & /*team*/ 32) spidergraph_changes.team = /*team*/ ctx[5];
    			if (dirty & /*teams*/ 64) spidergraph_changes.teams = /*teams*/ ctx[6];
    			spidergraph.$set(spidergraph_changes);
    			const teamsfooter_changes = {};
    			if (dirty & /*data*/ 512) teamsfooter_changes.lastUpdated = /*data*/ ctx[9].lastUpdated;
    			teamsfooter.$set(teamsfooter_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(positionovertimegraph.$$.fragment, local);
    			transition_in(pointsovertimegraph.$$.fragment, local);
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
    			transition_out(pointsovertimegraph.$$.fragment, local);
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
    			destroy_component(pointsovertimegraph);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div8);
    			destroy_component(goalsscoredandconcededgraph);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(div11);
    			destroy_component(cleansheetsgraph);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div12);
    			destroy_component(statsvalues);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div15);
    			destroy_component(scoredconcededovertimegraph);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div17);
    			destroy_component(goalspergame);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(div20);
    			destroy_component(scorelinefreqgraph);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(div23);
    			destroy_component(spidergraph);
    			if (detaching) detach_dev(t18);
    			destroy_component(teamsfooter, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(237:12) {#if load}",
    		ctx
    	});

    	return block;
    }

    // (137:0) <Router>
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

    	let t3_value = (/*hyphenatedTeam*/ ctx[0] != "overview"
    	? toAlias(/*team*/ ctx[5])
    	: "Overview") + "";

    	let t3;
    	let a_href_value;
    	let t4;
    	let current_block_type_index;
    	let if_block1;
    	let current;

    	nav = new Nav({
    			props: {
    				team: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[6],
    				toAlias,
    				switchTeam: /*switchTeam*/ ctx[11]
    			},
    			$$inline: true
    		});

    	mobilenav = new MobileNav({
    			props: {
    				hyphenatedTeam: /*hyphenatedTeam*/ ctx[0],
    				teams: /*teams*/ ctx[6],
    				toAlias,
    				switchTeam: /*switchTeam*/ ctx[11],
    				toggleMobileNav
    			},
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*teams*/ ctx[6].length == 0) return create_if_block_3$1;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	const if_block_creators = [create_if_block$1, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*data*/ ctx[9] != undefined) return 0;
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
    			attr_dev(div0, "class", "title svelte-qtsjuh");
    			set_style(div0, "color", "var(--" + (/*hyphenatedTeam*/ ctx[0] + '-secondary') + ")");
    			add_location(div0, file$3, 158, 10, 6150);
    			attr_dev(a, "class", "main-link no-decoration svelte-qtsjuh");
    			attr_dev(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			add_location(a, file$3, 157, 8, 6078);
    			attr_dev(div1, "class", "header svelte-qtsjuh");
    			set_style(div1, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(div1, file$3, 156, 6, 5997);
    			attr_dev(div2, "id", "dashboard");
    			attr_dev(div2, "class", "svelte-qtsjuh");
    			add_location(div2, file$3, 155, 4, 5969);
    			attr_dev(div3, "id", "team");
    			attr_dev(div3, "class", "svelte-qtsjuh");
    			add_location(div3, file$3, 137, 2, 5460);
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
    			if (dirty & /*teams*/ 64) nav_changes.teams = /*teams*/ ctx[6];
    			nav.$set(nav_changes);
    			const mobilenav_changes = {};
    			if (dirty & /*hyphenatedTeam*/ 1) mobilenav_changes.hyphenatedTeam = /*hyphenatedTeam*/ ctx[0];
    			if (dirty & /*teams*/ 64) mobilenav_changes.teams = /*teams*/ ctx[6];
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

    			if ((!current || dirty & /*hyphenatedTeam, team*/ 33) && t3_value !== (t3_value = (/*hyphenatedTeam*/ ctx[0] != "overview"
    			? toAlias(/*team*/ ctx[5])
    			: "Overview") + "")) set_data_dev(t3, t3_value);

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
    		source: "(137:0) <Router>",
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
    	add_render_callback(/*onwindowresize*/ ctx[12]);
    	add_render_callback(/*onwindowscroll*/ ctx[13]);
    	document_1$1.title = title_value = /*title*/ ctx[4];

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
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-1b9t1l7\"]', document_1$1.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$3, 131, 2, 5289);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1$1.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1, "resize", /*onwindowresize*/ ctx[12]),
    					listen_dev(window_1, "scroll", () => {
    						scrolling = true;
    						clearTimeout(scrolling_timeout);
    						scrolling_timeout = setTimeout(clear_scrolling, 100);
    						/*onwindowscroll*/ ctx[13]();
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

    			if ((!current || dirty & /*title*/ 16) && title_value !== (title_value = /*title*/ ctx[4])) {
    				document_1$1.title = title_value;
    			}

    			const router_changes = {};

    			if (dirty & /*$$scope, data, hyphenatedTeam, team, teams, mobileView, playedDates, load, currentMatchday*/ 264169) {
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

    function toggleMobileNav() {
    	let mobileNav = document.getElementById("mobileNav");

    	if (mobileNav.style.width == "0px") {
    		mobileNav.style.width = "100%";
    	} else {
    		mobileNav.style.width = "0px";
    	}
    }

    function toTitleCase(str) {
    	return str.toLowerCase().split(" ").map(function (word) {
    		return word.charAt(0).toUpperCase() + word.slice(1);
    	}).join(" ").replace("And", "and");
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let mobileView;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Dashboard', slots, []);

    	function playedMatchdayDates(data, team) {
    		let matchdays = playedMatchdays(data, team);

    		// If played one or no games, take x-axis from whole season dates
    		if (matchdays.length == 0) {
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
    		if (hyphenatedTeam == "overview") {
    			$$invalidate(5, team = "Overview");
    			$$invalidate(4, title = `Dashboard | ${team}`);
    			$$invalidate(0, hyphenatedTeam = "overview");
    		} else if (hyphenatedTeam != null) {
    			$$invalidate(5, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));
    			$$invalidate(4, title = `Dashboard | ${team}`);
    		}

    		const response = await fetch("https://pldashboard-backend.vercel.app/api/teams");
    		let json = await response.json();
    		$$invalidate(6, teams = Object.keys(json.standings));

    		if (hyphenatedTeam == null) {
    			// If root, set team to current leader
    			$$invalidate(5, team = teams[0]);

    			$$invalidate(4, title = `Dashboard | ${team}`);
    			$$invalidate(0, hyphenatedTeam = toHyphenatedName(team));

    			// Change url to /team-name without reloading page
    			history.pushState({}, null, window.location.href + hyphenatedTeam);
    		} else if (team != "Overview" && !teams.includes(team)) {
    			window.location.href = "/error";
    		}

    		if (team != "Overview") {
    			$$invalidate(7, currentMatchday$1 = currentMatchday(json, team));
    			$$invalidate(8, playedDates = playedMatchdayDates(json, team));
    		}

    		$$invalidate(9, data = json);
    		console.log(data);
    		window.dispatchEvent(new Event("resize")); // Snap plots to currently set size
    	}

    	function switchTeam(newTeam) {
    		$$invalidate(0, hyphenatedTeam = newTeam);

    		if (hyphenatedTeam == "overview") {
    			$$invalidate(5, team = "Overview");
    			$$invalidate(4, title = `Dashboard | ${team}`);
    		} else {
    			$$invalidate(5, team = toTitleCase(hyphenatedTeam.replace(/\-/g, " ")));
    			$$invalidate(4, title = `Dashboard | ${team}`);

    			// Overwrite values from new team's perspective using same data
    			$$invalidate(7, currentMatchday$1 = currentMatchday(data, team));

    			$$invalidate(8, playedDates = playedMatchdayDates(data, team));
    		}

    		window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
    	}

    	function lazyLoad() {
    		$$invalidate(3, load = true);
    		window.dispatchEvent(new Event("resize")); // Snap plots to currently set size
    	}

    	let y;
    	let load = false;
    	let pageWidth;
    	let title = "Dashboard";
    	let team = "";
    	let teams = []; // Used for nav bar links
    	let currentMatchday$1, playedDates;
    	let data;

    	onMount(() => {
    		initDashboard();
    	});

    	let { hyphenatedTeam } = $$props;
    	const writable_props = ['hyphenatedTeam'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(2, pageWidth = window_1.innerWidth);
    	}

    	function onwindowscroll() {
    		$$invalidate(1, y = window_1.pageYOffset);
    	}

    	function formovertimegraph_lazyLoad_binding(value) {
    		load = value;
    		$$invalidate(3, load);
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
    		TeamsFooter: Footer$1,
    		FixturesGraph,
    		FormOverTimeGraph,
    		PositionOverTimeGraph,
    		PointsOverTimeGraph,
    		GoalsScoredAndConcededGraph: ScoredConcededPerGameGraph,
    		CleanSheetsGraph,
    		GoalsPerGame,
    		SpiderGraph,
    		ScorelineFreqGraph,
    		Nav,
    		Overview,
    		MobileNav,
    		ScoredConcededOverTimeGraph,
    		toAlias,
    		toHyphenatedName,
    		playedMatchdays,
    		getCurrentMatchday: currentMatchday,
    		toggleMobileNav,
    		toTitleCase,
    		playedMatchdayDates,
    		initDashboard,
    		switchTeam,
    		lazyLoad,
    		y,
    		load,
    		pageWidth,
    		title,
    		team,
    		teams,
    		currentMatchday: currentMatchday$1,
    		playedDates,
    		data,
    		hyphenatedTeam,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('y' in $$props) $$invalidate(1, y = $$props.y);
    		if ('load' in $$props) $$invalidate(3, load = $$props.load);
    		if ('pageWidth' in $$props) $$invalidate(2, pageWidth = $$props.pageWidth);
    		if ('title' in $$props) $$invalidate(4, title = $$props.title);
    		if ('team' in $$props) $$invalidate(5, team = $$props.team);
    		if ('teams' in $$props) $$invalidate(6, teams = $$props.teams);
    		if ('currentMatchday' in $$props) $$invalidate(7, currentMatchday$1 = $$props.currentMatchday);
    		if ('playedDates' in $$props) $$invalidate(8, playedDates = $$props.playedDates);
    		if ('data' in $$props) $$invalidate(9, data = $$props.data);
    		if ('hyphenatedTeam' in $$props) $$invalidate(0, hyphenatedTeam = $$props.hyphenatedTeam);
    		if ('mobileView' in $$props) $$invalidate(10, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*y*/ 2) {
    			y > 30 && lazyLoad();
    		}

    		if ($$self.$$.dirty & /*pageWidth*/ 4) {
    			$$invalidate(10, mobileView = pageWidth <= 700);
    		}
    	};

    	return [
    		hyphenatedTeam,
    		y,
    		pageWidth,
    		load,
    		title,
    		team,
    		teams,
    		currentMatchday$1,
    		playedDates,
    		data,
    		mobileView,
    		switchTeam,
    		onwindowresize,
    		onwindowscroll,
    		formovertimegraph_lazyLoad_binding
    	];
    }

    class Dashboard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { hyphenatedTeam: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*hyphenatedTeam*/ ctx[0] === undefined && !('hyphenatedTeam' in props)) {
    			console_1$1.warn("<Dashboard> was created without expected prop 'hyphenatedTeam'");
    		}
    	}

    	get hyphenatedTeam() {
    		throw new Error("<Dashboard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hyphenatedTeam(value) {
    		throw new Error("<Dashboard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\routes\Home.svelte generated by Svelte v3.50.1 */
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
    			attr_dev(div0, "class", "svelte-1vjcave");
    			add_location(div0, file$2, 11, 6, 288);
    			if (!src_url_equal(img.src, img_src_value = "img/pldashboard5.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pldashboard");
    			attr_dev(img, "class", "svelte-1vjcave");
    			add_location(img, file$2, 12, 6, 315);
    			attr_dev(a0, "class", "dashboard-link svelte-1vjcave");
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$2, 14, 8, 404);
    			attr_dev(a1, "class", "fantasy-link svelte-1vjcave");
    			attr_dev(a1, "href", "/");
    			add_location(a1, file$2, 15, 8, 462);
    			attr_dev(div1, "class", "links svelte-1vjcave");
    			add_location(div1, file$2, 13, 6, 375);
    			attr_dev(div2, "class", "content svelte-1vjcave");
    			add_location(div2, file$2, 10, 4, 259);
    			attr_dev(div3, "id", "home");
    			attr_dev(div3, "class", "svelte-1vjcave");
    			add_location(div3, file$2, 9, 2, 238);
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
    			const head_nodes = query_selector_all('[data-svelte=\"svelte-96hcuw\"]', document.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			document.title = "Premier League Dashboard";
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$2, 5, 2, 133);
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

    /* src\routes\Predictions.svelte generated by Svelte v3.50.1 */

    const { console: console_1, document: document_1 } = globals;
    const file$1 = "src\\routes\\Predictions.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i]._id;
    	child_ctx[4] = list[i].predictions;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (162:4) {:else}
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
    			add_location(div0, file$1, 163, 8, 6132);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$1, 162, 6, 6083);
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
    		source: "(162:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:4) {#if data != undefined}
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
    			add_location(b0, file$1, 87, 40, 2922);
    			attr_dev(span, "class", "accuracy-item svelte-opqnzr");
    			add_location(span, file$1, 86, 12, 2852);
    			add_location(br, file$1, 90, 13, 3033);
    			add_location(b1, file$1, 92, 40, 3122);
    			attr_dev(div0, "class", "accuracy-item svelte-opqnzr");
    			add_location(div0, file$1, 91, 12, 3053);
    			attr_dev(div1, "class", "accuracy svelte-opqnzr");
    			add_location(div1, file$1, 85, 10, 2816);
    			attr_dev(div2, "class", "accuracy-display svelte-opqnzr");
    			add_location(div2, file$1, 84, 8, 2774);
    			attr_dev(div3, "class", "predictions svelte-opqnzr");
    			add_location(div3, file$1, 100, 10, 3326);
    			attr_dev(div4, "class", "predictions-container svelte-opqnzr");
    			add_location(div4, file$1, 99, 8, 3279);
    			attr_dev(div5, "class", "page-content svelte-opqnzr");
    			add_location(div5, file$1, 83, 6, 2738);
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
    		source: "(83:4) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (102:12) {#if data.predictions != null}
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
    		source: "(102:12) {#if data.predictions != null}",
    		ctx
    	});

    	return block;
    }

    // (137:20) {:else}
    function create_else_block(ctx) {
    	let div;
    	let t_value = datetimeToTime(/*pred*/ ctx[7].datetime) + "";
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
    			attr_dev(div, "class", "prediction-time svelte-opqnzr");
    			add_location(div, file$1, 137, 22, 5209);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t_value !== (t_value = datetimeToTime(/*pred*/ ctx[7].datetime) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(137:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (126:20) {#if pred.actual != null}
    function create_if_block_3(ctx) {
    	let div5;
    	let div0;
    	let t0;
    	let t1;
    	let div4;
    	let div1;
    	let t2_value = /*pred*/ ctx[7].home + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*pred*/ ctx[7].actual.homeGoals + "";
    	let t4;
    	let t5;
    	let t6_value = /*pred*/ ctx[7].actual.awayGoals + "";
    	let t6;
    	let t7;
    	let div3;
    	let t8_value = /*pred*/ ctx[7].away + "";
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
    			attr_dev(div0, "class", "prediction-label svelte-opqnzr");
    			add_location(div0, file$1, 127, 24, 4668);
    			attr_dev(div1, "class", "prediction-initials svelte-opqnzr");
    			add_location(div1, file$1, 129, 26, 4795);
    			attr_dev(div2, "class", "prediction-score svelte-opqnzr");
    			add_location(div2, file$1, 130, 26, 4873);
    			attr_dev(div3, "class", "prediction-initials svelte-opqnzr");
    			add_location(div3, file$1, 133, 26, 5044);
    			attr_dev(div4, "class", "prediction-value svelte-opqnzr");
    			add_location(div4, file$1, 128, 24, 4737);
    			attr_dev(div5, "class", "actual prediction-item svelte-opqnzr");
    			add_location(div5, file$1, 126, 22, 4606);
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
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[7].home + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*data*/ 1 && t4_value !== (t4_value = /*pred*/ ctx[7].actual.homeGoals + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*data*/ 1 && t6_value !== (t6_value = /*pred*/ ctx[7].actual.awayGoals + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*data*/ 1 && t8_value !== (t8_value = /*pred*/ ctx[7].away + "")) set_data_dev(t8, t8_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(126:20) {#if pred.actual != null}",
    		ctx
    	});

    	return block;
    }

    // (144:20) {#if pred.prediction != null}
    function create_if_block_2(ctx) {
    	let div1;
    	let div0;
    	let b;
    	let t0_value = /*pred*/ ctx[7].prediction.homeGoals + "";
    	let t0;
    	let t1;
    	let t2_value = /*pred*/ ctx[7].prediction.awayGoals + "";
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
    			add_location(b, file$1, 146, 26, 5626);
    			attr_dev(div0, "class", "detailed-predicted-score svelte-opqnzr");
    			add_location(div0, file$1, 145, 24, 5560);
    			attr_dev(div1, "class", "prediction-details svelte-opqnzr");
    			attr_dev(div1, "id", div1_id_value = /*pred*/ ctx[7]._id);
    			add_location(div1, file$1, 144, 22, 5488);
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
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*pred*/ ctx[7].prediction.homeGoals + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[7].prediction.awayGoals + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*data*/ 1 && div1_id_value !== (div1_id_value = /*pred*/ ctx[7]._id)) {
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
    		source: "(144:20) {#if pred.prediction != null}",
    		ctx
    	});

    	return block;
    }

    // (109:16) {#each predictions as pred}
    function create_each_block_1(ctx) {
    	let button;
    	let div5;
    	let div0;
    	let t0;
    	let t1;
    	let div4;
    	let div1;
    	let t2_value = /*pred*/ ctx[7].home + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = Math.round(/*pred*/ ctx[7].prediction.homeGoals) + "";
    	let t4;
    	let t5;
    	let t6_value = Math.round(/*pred*/ ctx[7].prediction.awayGoals) + "";
    	let t6;
    	let t7;
    	let div3;
    	let t8_value = /*pred*/ ctx[7].away + "";
    	let t8;
    	let t9;
    	let t10;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*pred*/ ctx[7].actual != null) return create_if_block_3;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*pred*/ ctx[7].prediction != null && create_if_block_2(ctx);

    	function click_handler() {
    		return /*click_handler*/ ctx[1](/*pred*/ ctx[7]);
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
    			attr_dev(div0, "class", "prediction-label svelte-opqnzr");
    			add_location(div0, file$1, 114, 22, 3970);
    			attr_dev(div1, "class", "prediction-initials svelte-opqnzr");
    			add_location(div1, file$1, 116, 24, 4096);
    			attr_dev(div2, "class", "prediction-score svelte-opqnzr");
    			add_location(div2, file$1, 117, 24, 4172);
    			attr_dev(div3, "class", "prediction-initials svelte-opqnzr");
    			add_location(div3, file$1, 122, 24, 4427);
    			attr_dev(div4, "class", "prediction-value svelte-opqnzr");
    			add_location(div4, file$1, 115, 22, 4040);
    			attr_dev(div5, "class", "prediction prediction-item svelte-opqnzr");
    			add_location(div5, file$1, 113, 20, 3906);
    			attr_dev(button, "class", button_class_value = "prediction-container " + /*pred*/ ctx[7].colour + " svelte-opqnzr");
    			add_location(button, file$1, 109, 18, 3723);
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
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = /*pred*/ ctx[7].home + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*data*/ 1 && t4_value !== (t4_value = Math.round(/*pred*/ ctx[7].prediction.homeGoals) + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*data*/ 1 && t6_value !== (t6_value = Math.round(/*pred*/ ctx[7].prediction.awayGoals) + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*data*/ 1 && t8_value !== (t8_value = /*pred*/ ctx[7].away + "")) set_data_dev(t8, t8_value);

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

    			if (/*pred*/ ctx[7].prediction != null) {
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

    			if (dirty & /*data*/ 1 && button_class_value !== (button_class_value = "prediction-container " + /*pred*/ ctx[7].colour + " svelte-opqnzr")) {
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
    		source: "(109:16) {#each predictions as pred}",
    		ctx
    	});

    	return block;
    }

    // (103:14) {#each data.predictions as { _id, predictions }}
    function create_each_block(ctx) {
    	let div0;
    	let t0_value = /*_id*/ ctx[3] + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2;
    	let t3;
    	let div2;
    	let each_value_1 = /*predictions*/ ctx[4];
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
    			attr_dev(div0, "class", "date svelte-opqnzr");
    			add_location(div0, file$1, 103, 16, 3477);
    			attr_dev(div1, "class", "medium-predictions-divider svelte-opqnzr");
    			add_location(div1, file$1, 106, 16, 3562);
    			attr_dev(div2, "class", "predictions-gap svelte-opqnzr");
    			add_location(div2, file$1, 155, 16, 5941);
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
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*_id*/ ctx[3] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*data, toggleDetailsDisplay, datetimeToTime, Math*/ 1) {
    				each_value_1 = /*predictions*/ ctx[4];
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
    		source: "(103:14) {#each data.predictions as { _id, predictions }}",
    		ctx
    	});

    	return block;
    }

    // (77:0) <Router>
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
    			attr_dev(a, "class", "predictions-title svelte-opqnzr");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file$1, 79, 6, 2623);
    			attr_dev(div0, "class", "predictions-header svelte-opqnzr");
    			add_location(div0, file$1, 78, 4, 2583);
    			attr_dev(div1, "id", "predictions");
    			attr_dev(div1, "class", "svelte-opqnzr");
    			add_location(div1, file$1, 77, 2, 2555);
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
    		source: "(77:0) <Router>",
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
    			add_location(meta, file$1, 73, 2, 2450);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};

    			if (dirty & /*$$scope, data*/ 1025) {
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

    function toggleDetailsDisplay(id) {
    	let prediction = document.getElementById(id);

    	if (prediction != null) {
    		prediction.classList.toggle("expanded");
    	}
    }

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

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Predictions', slots, []);

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

    	let data;

    	onMount(async () => {
    		const response = await fetch("https://pldashboard-backend.vercel.app/api/predictions");
    		let json = await response.json();
    		sortByDate(json);
    		json = { predictions: json };
    		insertExtras(json);
    		$$invalidate(0, data = json);
    		console.log(data);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Predictions> was created with unknown prop '${key}'`);
    	});

    	const click_handler = pred => toggleDetailsDisplay(pred._id);

    	$$self.$capture_state = () => ({
    		Router,
    		onMount,
    		identicalScore,
    		sameResult,
    		toggleDetailsDisplay,
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

    /* src\routes\Error.svelte generated by Svelte v3.50.1 */
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
    			attr_dev(div0, "class", "msg-container svelte-1yx5ll");
    			add_location(div0, file, 10, 4, 250);
    			attr_dev(div1, "id", "error");
    			attr_dev(div1, "class", "svelte-1yx5ll");
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

    /* src\App.svelte generated by Svelte v3.50.1 */

    const { Error: Error_1 } = globals;

    // (11:2) <Route path="/">
    function create_default_slot_2(ctx) {
    	let dashboard;
    	let current;

    	dashboard = new Dashboard({
    			props: { hyphenatedTeam: null },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(dashboard.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(dashboard.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dashboard, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dashboard, detaching);
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

    // (14:2) <Route path="/:team" let:params>
    function create_default_slot_1(ctx) {
    	let dashboard;
    	let current;

    	dashboard = new Dashboard({
    			props: { hyphenatedTeam: /*params*/ ctx[1].team },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(dashboard.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(dashboard.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(dashboard, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const dashboard_changes = {};
    			if (dirty & /*params*/ 2) dashboard_changes.hyphenatedTeam = /*params*/ ctx[1].team;
    			dashboard.$set(dashboard_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(dashboard, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(14:2) <Route path=\\\"/:team\\\" let:params>",
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

    	route2 = new Route({
    			props: {
    				path: "/predictions",
    				component: Predictions
    			},
    			$$inline: true
    		});

    	route3 = new Route({
    			props: { path: "/home", component: Home },
    			$$inline: true
    		});

    	route4 = new Route({
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
    			const route1_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
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
    		Dashboard,
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
