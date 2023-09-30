
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
    // Adapted from https://github.com/then/is-promise/blob/master/index.js
    // Distributed under MIT License https://github.com/then/is-promise/blob/master/LICENSE
    function is_promise(value) {
        return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
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

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

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
        * subsequence of nodes that are claimed in order can be found by
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
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
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
        if (value == null) {
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
    function head_selector(nodeId, head) {
        const result = [];
        let started = 0;
        for (const node of head.childNodes) {
            if (node.nodeType === 8 /* comment node */) {
                const comment = node.textContent.trim();
                if (comment === `HEAD_${nodeId}_END`) {
                    started -= 1;
                    result.push(node);
                }
                else if (comment === `HEAD_${nodeId}_START`) {
                    started += 1;
                    result.push(node);
                }
            }
            else if (started > 0) {
                result.push(node);
            }
        }
        return result;
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

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
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
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
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
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
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

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function update_await_block_branch(info, ctx, dirty) {
        const child_ctx = ctx.slice();
        const { resolved } = info;
        if (info.current === info.then) {
            child_ctx[info.value] = resolved;
        }
        if (info.current === info.catch) {
            child_ctx[info.error] = resolved;
        }
        info.block.p(child_ctx, dirty);
    }

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
        const updates = [];
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
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
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
        run_all(updates);
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
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
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
            flush_render_callbacks($$.after_update);
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
            ctx: [],
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
            if (!is_function(callback)) {
                return noop;
            }
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
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
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
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
        if (text.data === data)
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
    function construct_svelte_component_dev(component, props) {
        const error_message = 'this={...} of <svelte:component> should specify a Svelte component.';
        try {
            const instance = new component(props);
            if (!instance.$$ || !instance.$set || !instance.$on || !instance.$destroy) {
                throw new Error(error_message);
            }
            return instance;
        }
        catch (err) {
            const { message } = err;
            if (typeof message === 'string' && message.indexOf('is not a constructor') !== -1) {
                throw new Error(error_message);
            }
            else {
                throw err;
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
    const get_default_slot_changes$1 = dirty => ({ params: dirty & /*routeParams*/ 4 });
    const get_default_slot_context$1 = ctx => ({ params: /*routeParams*/ ctx[2] });

    // (42:0) {#if $activeRoute && $activeRoute.route === route}
    function create_if_block$f(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$9, create_else_block$9];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0]) return 0;
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
    		id: create_if_block$f.name,
    		type: "if",
    		source: "(42:0) {#if $activeRoute && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (51:4) {:else}
    function create_else_block$9(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[8].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], get_default_slot_context$1);

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
    				if (default_slot.p && (!current || dirty & /*$$scope, routeParams*/ 132)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[7],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, get_default_slot_changes$1),
    						get_default_slot_context$1
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
    		id: create_else_block$9.name,
    		type: "else",
    		source: "(51:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (43:4) {#if component}
    function create_if_block_1$9(ctx) {
    	let await_block_anchor;
    	let promise;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 12,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*component*/ ctx[0], info);

    	const block = {
    		c: function create() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		l: function claim(nodes) {
    			await_block_anchor = empty();
    			info.block.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*component*/ 1 && promise !== (promise = /*component*/ ctx[0]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$9.name,
    		type: "if",
    		source: "(43:4) {#if component}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import { getContext, onDestroy }
    function create_catch_block(ctx) {
    	const block = {
    		c: noop,
    		l: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(1:0) <script>     import { getContext, onDestroy }",
    		ctx
    	});

    	return block;
    }

    // (44:49)              <svelte:component                 this={resolvedComponent?.default || resolvedComponent}
    function create_then_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*routeParams*/ ctx[2], /*routeProps*/ ctx[3]];
    	var switch_value = /*resolvedComponent*/ ctx[12]?.default || /*resolvedComponent*/ ctx[12];

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
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props());
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
    			if (switch_instance) mount_component(switch_instance, target, anchor);
    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*routeParams, routeProps*/ 12)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
    					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
    				])
    			: {};

    			if (dirty & /*component*/ 1 && switch_value !== (switch_value = /*resolvedComponent*/ ctx[12]?.default || /*resolvedComponent*/ ctx[12])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = construct_svelte_component_dev(switch_value, switch_props());
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
    		id: create_then_block.name,
    		type: "then",
    		source: "(44:49)              <svelte:component                 this={resolvedComponent?.default || resolvedComponent}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>     import { getContext, onDestroy }
    function create_pending_block(ctx) {
    	const block = {
    		c: noop,
    		l: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(1:0) <script>     import { getContext, onDestroy }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$w(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[5] && create_if_block$f(ctx);

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
    			if (/*$activeRoute*/ ctx[1] && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[5]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$f(ctx);
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
    		id: create_fragment$w.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$w($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Route', slots, ['default']);
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	let routeParams = {};
    	let routeProps = {};
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));

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

    	$$self.$$set = $$new_props => {
    		$$invalidate(11, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('path' in $$new_props) $$invalidate(6, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('$$scope' in $$new_props) $$invalidate(7, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onDestroy,
    		ROUTER,
    		canUseDOM,
    		path,
    		component,
    		routeParams,
    		routeProps,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		route,
    		$activeRoute
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(11, $$props = assign(assign({}, $$props), $$new_props));
    		if ('path' in $$props) $$invalidate(6, path = $$new_props.path);
    		if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
    		if ('routeParams' in $$props) $$invalidate(2, routeParams = $$new_props.routeParams);
    		if ('routeProps' in $$props) $$invalidate(3, routeProps = $$new_props.routeProps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($activeRoute && $activeRoute.route === route) {
    			$$invalidate(2, routeParams = $activeRoute.params);
    			const { component: c, path, ...rest } = $$props;
    			$$invalidate(3, routeProps = rest);

    			if (c) {
    				if (c.toString().startsWith("class ")) $$invalidate(0, component = c); else $$invalidate(0, component = c());
    			}

    			canUseDOM() && window?.scrollTo(0, 0);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		$activeRoute,
    		routeParams,
    		routeProps,
    		activeRoute,
    		route,
    		path,
    		$$scope,
    		slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$w, create_fragment$w, safe_not_equal, { path: 6, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$w.name
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

    const { Object: Object_1$h } = globals;

    const get_default_slot_changes = dirty => ({
    	route: dirty & /*$activeRoute*/ 2,
    	location: dirty & /*$location*/ 1
    });

    const get_default_slot_context = ctx => ({
    	route: /*$activeRoute*/ ctx[1] && /*$activeRoute*/ ctx[1].uri,
    	location: /*$location*/ ctx[0]
    });

    function create_fragment$v(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[12].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[11], get_default_slot_context);

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
    				if (default_slot.p && (!current || dirty & /*$$scope, $activeRoute, $location*/ 2051)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[11],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[11])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[11], dirty, get_default_slot_changes),
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
    		id: create_fragment$v.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$v($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let $activeRoute;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	let { history = globalHistory } = $$props;
    	setContext(HISTORY, history);
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, 'routes');
    	component_subscribe($$self, routes, value => $$invalidate(9, $routes = value));
    	const activeRoute = writable(null);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : history.location);

    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(0, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(10, $base = value));

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

    	const writable_props = ['basepath', 'url', 'history'];

    	Object_1$h.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(6, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(7, url = $$props.url);
    		if ('history' in $$props) $$invalidate(8, history = $$props.history);
    		if ('$$scope' in $$props) $$invalidate(11, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onMount,
    		setContext,
    		derived,
    		writable,
    		HISTORY,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		combinePaths,
    		pick,
    		basepath,
    		url,
    		history,
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
    		$base,
    		$activeRoute
    	});

    	$$self.$inject_state = $$props => {
    		if ('basepath' in $$props) $$invalidate(6, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(7, url = $$props.url);
    		if ('history' in $$props) $$invalidate(8, history = $$props.history);
    		if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 1024) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			{
    				const { path: basepath } = $base;
    				routes.update(rs => rs.map(r => Object.assign(r, { path: combinePaths(basepath, r._path) })));
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 513) {
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
    		$location,
    		$activeRoute,
    		routes,
    		activeRoute,
    		location,
    		base,
    		basepath,
    		url,
    		history,
    		$routes,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$v, create_fragment$v, safe_not_equal, { basepath: 6, url: 7, history: 8 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$v.name
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

    	get history() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set history(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\current_form\FormTiles.svelte generated by Svelte v3.59.2 */

    const file$t = "src\\components\\team\\current_form\\FormTiles.svelte";

    function create_fragment$u(ctx) {
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
    			attr_dev(div0, "class", "result svelte-1978cry");
    			add_location(div0, file$t, 32, 4, 800);
    			attr_dev(div1, "id", "formTile");
    			set_style(div1, "background", background(/*form*/ ctx[0][0], /*starTeams*/ ctx[1][0]));
    			attr_dev(div1, "class", "svelte-1978cry");
    			add_location(div1, file$t, 31, 2, 719);
    			attr_dev(div2, "class", "icon pos-0 svelte-1978cry");
    			add_location(div2, file$t, 30, 0, 691);
    			attr_dev(div3, "class", "result svelte-1978cry");
    			add_location(div3, file$t, 39, 4, 992);
    			attr_dev(div4, "id", "formTile");
    			set_style(div4, "background", background(/*form*/ ctx[0][1], /*starTeams*/ ctx[1][1]));
    			attr_dev(div4, "class", "svelte-1978cry");
    			add_location(div4, file$t, 38, 2, 911);
    			attr_dev(div5, "class", "icon pos-1 svelte-1978cry");
    			add_location(div5, file$t, 37, 0, 883);
    			attr_dev(div6, "class", "result svelte-1978cry");
    			add_location(div6, file$t, 46, 4, 1184);
    			attr_dev(div7, "id", "formTile");
    			set_style(div7, "background", background(/*form*/ ctx[0][2], /*starTeams*/ ctx[1][2]));
    			attr_dev(div7, "class", "svelte-1978cry");
    			add_location(div7, file$t, 45, 2, 1103);
    			attr_dev(div8, "class", "icon pos-2 svelte-1978cry");
    			add_location(div8, file$t, 44, 0, 1075);
    			attr_dev(div9, "class", "result svelte-1978cry");
    			add_location(div9, file$t, 53, 4, 1376);
    			attr_dev(div10, "id", "formTile");
    			set_style(div10, "background", background(/*form*/ ctx[0][3], /*starTeams*/ ctx[1][3]));
    			attr_dev(div10, "class", "svelte-1978cry");
    			add_location(div10, file$t, 52, 2, 1295);
    			attr_dev(div11, "class", "icon pos-3 svelte-1978cry");
    			add_location(div11, file$t, 51, 0, 1267);
    			attr_dev(div12, "class", "result svelte-1978cry");
    			add_location(div12, file$t, 60, 4, 1568);
    			attr_dev(div13, "id", "formTile");
    			set_style(div13, "background", background(/*form*/ ctx[0][4], /*starTeams*/ ctx[1][4]));
    			attr_dev(div13, "class", "svelte-1978cry");
    			add_location(div13, file$t, 59, 2, 1487);
    			attr_dev(div14, "class", "icon pos-4 svelte-1978cry");
    			add_location(div14, file$t, 58, 0, 1459);
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
    		id: create_fragment$u.name,
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

    function instance$u($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormTiles', slots, []);
    	let { form, starTeams } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (form === undefined && !('form' in $$props || $$self.$$.bound[$$self.$$.props['form']])) {
    			console.warn("<FormTiles> was created without expected prop 'form'");
    		}

    		if (starTeams === undefined && !('starTeams' in $$props || $$self.$$.bound[$$self.$$.props['starTeams']])) {
    			console.warn("<FormTiles> was created without expected prop 'starTeams'");
    		}
    	});

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
    		init(this, options, instance$u, create_fragment$u, safe_not_equal, { form: 0, starTeams: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormTiles",
    			options,
    			id: create_fragment$u.name
    		});
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
        return '1';
    }

    /* src\components\team\current_form\CurrentForm.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$g } = globals;
    const file$s = "src\\components\\team\\current_form\\CurrentForm.svelte";

    // (69:0) {#if formInitials != undefined}
    function create_if_block_1$8(ctx) {
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
    			attr_dev(div0, "class", "current-form-row icon-row svelte-oguyd2");
    			add_location(div0, file$s, 69, 2, 2539);
    			attr_dev(div1, "class", "icon-name pos-0 svelte-oguyd2");
    			add_location(div1, file$s, 73, 4, 2702);
    			attr_dev(div2, "class", "icon-name pos-1 svelte-oguyd2");
    			add_location(div2, file$s, 74, 4, 2760);
    			attr_dev(div3, "class", "icon-name pos-2 svelte-oguyd2");
    			add_location(div3, file$s, 75, 4, 2818);
    			attr_dev(div4, "class", "icon-name pos-3 svelte-oguyd2");
    			add_location(div4, file$s, 76, 4, 2876);
    			attr_dev(div5, "class", "icon-name pos-4 svelte-oguyd2");
    			add_location(div5, file$s, 77, 4, 2934);
    			attr_dev(div6, "class", "current-form-row name-row svelte-oguyd2");
    			add_location(div6, file$s, 72, 2, 2657);
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
    		id: create_if_block_1$8.name,
    		type: "if",
    		source: "(69:0) {#if formInitials != undefined}",
    		ctx
    	});

    	return block;
    }

    // (89:2) {:else}
    function create_else_block$8(ctx) {
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
    		id: create_else_block$8.name,
    		type: "else",
    		source: "(89:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:2) {#if currentMatchday != undefined}
    function create_if_block$e(ctx) {
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
    			attr_dev(span, "class", "current-form-value svelte-oguyd2");
    			add_location(span, file$s, 83, 4, 3092);
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
    		id: create_if_block$e.name,
    		type: "if",
    		source: "(83:2) {#if currentMatchday != undefined}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$t(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let current;
    	let if_block0 = /*formInitials*/ ctx[5] != undefined && create_if_block_1$8(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*currentMatchday*/ ctx[1] != undefined) return create_if_block$e;
    		return create_else_block$8;
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
    			attr_dev(div, "class", "current-form svelte-oguyd2");
    			add_location(div, file$s, 80, 0, 3005);
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
    					if_block0 = create_if_block_1$8(ctx);
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
    		id: create_fragment$t.name,
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

    function instance$t($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CurrentForm', slots, []);

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
    		$$invalidate(3, formIcons = getFormIcons(data, team));
    		$$invalidate(4, formStarTeams = getFormStarTeams(data, team, matchdays));
    		$$invalidate(5, formInitials = getFormInitials(data, team, matchdays));
    	}

    	let formIcons, formStarTeams, formInitials;
    	let { data, currentMatchday, team } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<CurrentForm> was created without expected prop 'data'");
    		}

    		if (currentMatchday === undefined && !('currentMatchday' in $$props || $$self.$$.bound[$$self.$$.props['currentMatchday']])) {
    			console.warn("<CurrentForm> was created without expected prop 'currentMatchday'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<CurrentForm> was created without expected prop 'team'");
    		}
    	});

    	const writable_props = ['data', 'currentMatchday', 'team'];

    	Object_1$g.keys($$props).forEach(key => {
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
    		init(this, options, instance$t, create_fragment$t, safe_not_equal, { data: 0, currentMatchday: 1, team: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CurrentForm",
    			options,
    			id: create_fragment$t.name
    		});
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

    /* src\components\team\TableSnippet.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$f } = globals;
    const file$r = "src\\components\\team\\TableSnippet.svelte";

    function get_each_context$8(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	child_ctx[9] = i;
    	return child_ctx;
    }

    // (48:2) {#if tableSnippet != undefined}
    function create_if_block$d(ctx) {
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
    		each_blocks[i] = create_each_block$8(get_each_context$8(ctx, each_value, i));
    	}

    	let if_block = /*tableSnippet*/ ctx[2].teamTableIdx != 6 && create_if_block_1$7(ctx);

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
    			add_location(div0, file$r, 48, 4, 1578);
    			attr_dev(div1, "class", "table-element table-position column-title svelte-12meswl");
    			add_location(div1, file$r, 50, 6, 1638);
    			attr_dev(div2, "class", "table-element table-team-name column-title svelte-12meswl");
    			add_location(div2, file$r, 51, 6, 1703);
    			attr_dev(div3, "class", "table-element table-gd column-title svelte-12meswl");
    			add_location(div3, file$r, 52, 6, 1777);
    			attr_dev(div4, "class", "table-element table-points column-title svelte-12meswl");
    			add_location(div4, file$r, 53, 6, 1842);
    			attr_dev(div5, "class", "table-row svelte-12meswl");
    			add_location(div5, file$r, 49, 4, 1607);
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
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
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
    					const child_ctx = get_each_context$8(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$8(child_ctx);
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
    					if_block = create_if_block_1$7(ctx);
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
    		id: create_if_block$d.name,
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
    			attr_dev(div, "class", "svelte-12meswl");
    			add_location(div, file$r, 63, 8, 2197);
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

    // (59:6) {#if i === 0}
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
    		source: "(59:6) {#if i === 0}",
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
    			attr_dev(div, "class", "svelte-12meswl");
    			add_location(div, file$r, 60, 10, 2065);
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
    function create_else_block$7(ctx) {
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
    			attr_dev(div0, "class", "table-element table-position svelte-12meswl");
    			add_location(div0, file$r, 101, 10, 3417);
    			attr_dev(button, "class", "table-element table-team-name svelte-12meswl");
    			add_location(button, file$r, 104, 10, 3517);
    			attr_dev(div1, "class", "table-element table-gd svelte-12meswl");
    			add_location(div1, file$r, 112, 10, 3756);
    			attr_dev(div2, "class", "table-element table-points svelte-12meswl");
    			add_location(div2, file$r, 115, 10, 3844);
    			attr_dev(div3, "class", "table-row svelte-12meswl");
    			add_location(div3, file$r, 100, 8, 3382);
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
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
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
    		id: create_else_block$7.name,
    		type: "else",
    		source: "(99:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (67:6) {#if i === tableSnippet.teamTableIdx}
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
    			attr_dev(div0, "class", "table-element table-position this-team svelte-12meswl");
    			set_style(div0, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div0, file$r, 72, 10, 2509);
    			attr_dev(a, "href", a_href_value = "/" + /*hyphenatedTeam*/ ctx[0]);
    			attr_dev(a, "class", "table-element table-team-name this-team svelte-12meswl");
    			set_style(a, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(a, file$r, 78, 10, 2707);
    			attr_dev(div1, "class", "table-element table-gd this-team svelte-12meswl");
    			set_style(div1, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div1, file$r, 85, 10, 2945);
    			attr_dev(div2, "class", "table-element table-points this-team svelte-12meswl");
    			set_style(div2, "color", "var(--" + /*hyphenatedTeam*/ ctx[0] + "-secondary)");
    			add_location(div2, file$r, 91, 10, 3131);
    			attr_dev(div3, "class", "table-row this-team svelte-12meswl");
    			set_style(div3, "background-color", "var(--" + /*hyphenatedTeam*/ ctx[0] + ")");
    			add_location(div3, file$r, 68, 8, 2381);
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
    		source: "(67:6) {#if i === tableSnippet.teamTableIdx}",
    		ctx
    	});

    	return block;
    }

    // (57:4) {#each tableSnippet.rows as row, i}
    function create_each_block$8(ctx) {
    	let t;
    	let if_block1_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[9] === 0) return create_if_block_3$4;
    		if (/*i*/ ctx[9] - 1 != /*tableSnippet*/ ctx[2].teamTableIdx && /*i*/ ctx[9] != /*tableSnippet*/ ctx[2].teamTableIdx) return create_if_block_5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*i*/ ctx[9] === /*tableSnippet*/ ctx[2].teamTableIdx) return create_if_block_2$4;
    		return create_else_block$7;
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
    		id: create_each_block$8.name,
    		type: "each",
    		source: "(57:4) {#each tableSnippet.rows as row, i}",
    		ctx
    	});

    	return block;
    }

    // (122:4) {#if tableSnippet.teamTableIdx != 6}
    function create_if_block_1$7(ctx) {
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
    			attr_dev(div, "class", "svelte-12meswl");
    			add_location(div, file$r, 122, 6, 4020);
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
    		id: create_if_block_1$7.name,
    		type: "if",
    		source: "(122:4) {#if tableSnippet.teamTableIdx != 6}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$s(ctx) {
    	let div;
    	let if_block = /*tableSnippet*/ ctx[2] != undefined && create_if_block$d(ctx);

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
    			attr_dev(div, "class", "table-snippet svelte-12meswl");
    			add_location(div, file$r, 46, 0, 1510);
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
    					if_block = create_if_block$d(ctx);
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
    		id: create_fragment$s.name,
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

    function instance$s($$self, $$props, $$invalidate) {
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

    		$$invalidate(2, tableSnippet = { teamTableIdx, rows });
    	}

    	let tableSnippet;
    	let { data, hyphenatedTeam, team, switchTeam } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<TableSnippet> was created without expected prop 'data'");
    		}

    		if (hyphenatedTeam === undefined && !('hyphenatedTeam' in $$props || $$self.$$.bound[$$self.$$.props['hyphenatedTeam']])) {
    			console.warn("<TableSnippet> was created without expected prop 'hyphenatedTeam'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<TableSnippet> was created without expected prop 'team'");
    		}

    		if (switchTeam === undefined && !('switchTeam' in $$props || $$self.$$.bound[$$self.$$.props['switchTeam']])) {
    			console.warn("<TableSnippet> was created without expected prop 'switchTeam'");
    		}
    	});

    	const writable_props = ['data', 'hyphenatedTeam', 'team', 'switchTeam'];

    	Object_1$f.keys($$props).forEach(key => {
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

    		init(this, options, instance$s, create_fragment$s, safe_not_equal, {
    			data: 3,
    			hyphenatedTeam: 0,
    			team: 4,
    			switchTeam: 1
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TableSnippet",
    			options,
    			id: create_fragment$s.name
    		});
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
    const file$q = "src\\components\\team\\NextGame.svelte";

    function get_each_context$7(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (26:0) {:else}
    function create_else_block$6(ctx) {
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
    	let t17_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction + "";
    	let t17;
    	let t18;
    	let br1;
    	let t19;
    	let div8;
    	let t20;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches.length === 0) return create_if_block_1$6;
    		return create_else_block_1$4;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$7(get_each_context$7(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Next Game: \r\n        ");
    			button = element("button");
    			t1 = text(t1_value);
    			t2 = text(" ");
    			t3 = text("\r\n        (");
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
    			t11 = text("Current form:\r\n            ");
    			span1 = element("span");
    			t12 = text(t12_value);
    			t13 = text("%");
    			t14 = space();
    			div5 = element("div");
    			t15 = text("Score prediction\r\n            ");
    			br0 = element("br");
    			t16 = space();
    			a = element("a");
    			b = element("b");
    			t17 = text(t17_value);
    			t18 = space();
    			br1 = element("br");
    			t19 = space();
    			div8 = element("div");
    			if_block.c();
    			t20 = space();

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
    			t0 = claim_text(h1_nodes, "Next Game: \r\n        ");
    			button = claim_element(h1_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t1 = claim_text(button_nodes, t1_value);
    			t2 = claim_text(button_nodes, " ");
    			button_nodes.forEach(detach_dev);
    			t3 = claim_text(h1_nodes, "\r\n        (");
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
    			t11 = claim_text(div4_nodes, "Current form:\r\n            ");
    			span1 = claim_element(div4_nodes, "SPAN", { class: true });
    			var span1_nodes = children(span1);
    			t12 = claim_text(span1_nodes, t12_value);
    			t13 = claim_text(span1_nodes, "%");
    			span1_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t14 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t15 = claim_text(div5_nodes, "Score prediction\r\n            ");
    			br0 = claim_element(div5_nodes, "BR", {});
    			t16 = claim_space(div5_nodes);
    			a = claim_element(div5_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			b = claim_element(a_nodes, "B", {});
    			var b_nodes = children(b);
    			t17 = claim_text(b_nodes, t17_value);
    			b_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			t18 = claim_space(div5_nodes);
    			br1 = claim_element(div5_nodes, "BR", {});
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t19 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			if_block.l(div8_nodes);
    			t20 = claim_space(div8_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div8_nodes);
    			}

    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "next-game-team-btn svelte-b6rr06");
    			add_location(button, file$q, 30, 8, 976);
    			attr_dev(h1, "class", "next-game-title-text svelte-b6rr06");
    			add_location(h1, file$q, 28, 6, 908);
    			attr_dev(div0, "class", "next-game-title svelte-b6rr06");
    			add_location(div0, file$q, 27, 4, 871);
    			attr_dev(div1, "class", "next-game-position svelte-b6rr06");
    			add_location(div1, file$q, 43, 8, 1386);
    			attr_dev(span0, "class", "ordinal-position svelte-b6rr06");
    			add_location(span0, file$q, 48, 26, 1640);
    			attr_dev(div2, "class", "next-game-position svelte-b6rr06");
    			add_location(div2, file$q, 46, 12, 1509);
    			attr_dev(div3, "class", "next-game-item svelte-b6rr06");
    			add_location(div3, file$q, 45, 10, 1467);
    			attr_dev(span1, "class", "current-form-value svelte-b6rr06");
    			add_location(span1, file$q, 58, 12, 1978);
    			attr_dev(div4, "class", "next-game-item current-form svelte-b6rr06");
    			add_location(div4, file$q, 56, 10, 1896);
    			add_location(br0, file$q, 68, 12, 2358);
    			add_location(b, file$q, 70, 14, 2442);
    			attr_dev(a, "class", "predictions-link svelte-b6rr06");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file$q, 69, 12, 2378);
    			add_location(br1, file$q, 74, 12, 2547);
    			attr_dev(div5, "class", "next-game-item svelte-b6rr06");
    			add_location(div5, file$q, 66, 10, 2286);
    			attr_dev(div6, "class", "predictions");
    			add_location(div6, file$q, 44, 8, 1430);
    			attr_dev(div7, "class", "predictions-and-logo svelte-b6rr06");
    			add_location(div7, file$q, 42, 6, 1342);
    			attr_dev(div8, "class", "past-results svelte-b6rr06");
    			add_location(div8, file$q, 78, 6, 2609);
    			attr_dev(div9, "class", "next-game-values svelte-b6rr06");
    			add_location(div9, file$q, 41, 4, 1304);
    			attr_dev(div10, "class", "next-game-prediction svelte-b6rr06");
    			add_location(div10, file$q, 26, 2, 831);
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
    			append_hydration_dev(div5, t18);
    			append_hydration_dev(div5, br1);
    			append_hydration_dev(div9, t19);
    			append_hydration_dev(div9, div8);
    			if_block.m(div8, null);
    			append_hydration_dev(div8, t20);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div8, null);
    				}
    			}

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false, false);
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
    			if (dirty & /*data, team*/ 3 && t17_value !== (t17_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prediction + "")) set_data_dev(t17, t17_value);

    			if (current_block_type !== (current_block_type = select_block_type_1(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div8, t20);
    				}
    			}

    			if (dirty & /*teamStyle, data, team, toInitials, resultColour, Date*/ 3) {
    				each_value = /*data*/ ctx[0].upcoming[/*team*/ ctx[1]].prevMatches;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$7(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$7(child_ctx);
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
    		id: create_else_block$6.name,
    		type: "else",
    		source: "(26:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (18:0) {#if data.upcoming[team].nextTeam === null}
    function create_if_block$c(ctx) {
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
    			attr_dev(h1, "class", "next-game-title-text svelte-b6rr06");
    			add_location(h1, file$q, 20, 6, 699);
    			attr_dev(div0, "class", "next-game-season-complete svelte-b6rr06");
    			add_location(div0, file$q, 19, 4, 652);
    			attr_dev(div1, "class", "next-game-prediction-complete svelte-b6rr06");
    			add_location(div1, file$q, 18, 2, 603);
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
    		id: create_if_block$c.name,
    		type: "if",
    		source: "(18:0) {#if data.upcoming[team].nextTeam === null}",
    		ctx
    	});

    	return block;
    }

    // (84:8) {:else}
    function create_else_block_1$4(ctx) {
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
    			attr_dev(div, "class", "next-game-item prev-results-title svelte-b6rr06");
    			add_location(div, file$q, 84, 10, 2850);
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
    		id: create_else_block_1$4.name,
    		type: "else",
    		source: "(84:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (80:8) {#if data.upcoming[team].prevMatches.length === 0}
    function create_if_block_1$6(ctx) {
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
    			attr_dev(div, "class", "next-game-item prev-results-title no-prev-results svelte-b6rr06");
    			add_location(div, file$q, 80, 10, 2707);
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
    		id: create_if_block_1$6.name,
    		type: "if",
    		source: "(80:8) {#if data.upcoming[team].prevMatches.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (89:8) {#each data.upcoming[team].prevMatches as prevMatch}
    function create_each_block$7(ctx) {
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
    			attr_dev(div0, "class", "past-result-date result-details svelte-b6rr06");
    			add_location(div0, file$q, 90, 12, 3157);
    			attr_dev(div1, "class", "home-team svelte-b6rr06");
    			attr_dev(div1, "style", div1_style_value = teamStyle(/*prevMatch*/ ctx[4].homeTeam));
    			add_location(div1, file$q, 100, 18, 3571);
    			attr_dev(div2, "class", "home-goals svelte-b6rr06");
    			add_location(div2, file$q, 107, 20, 3894);
    			attr_dev(div3, "class", "goals-container svelte-b6rr06");
    			attr_dev(div3, "style", div3_style_value = teamStyle(resultColour(/*prevMatch*/ ctx[4], true)));
    			add_location(div3, file$q, 103, 18, 3732);
    			attr_dev(div4, "class", "left-side svelte-b6rr06");
    			add_location(div4, file$q, 99, 16, 3528);
    			attr_dev(div5, "class", "away-goals svelte-b6rr06");
    			add_location(div5, file$q, 117, 20, 4266);
    			attr_dev(div6, "class", "goals-container svelte-b6rr06");
    			attr_dev(div6, "style", div6_style_value = teamStyle(resultColour(/*prevMatch*/ ctx[4], false)));
    			add_location(div6, file$q, 113, 18, 4103);
    			attr_dev(div7, "class", "away-team svelte-b6rr06");
    			attr_dev(div7, "style", div7_style_value = teamStyle(/*prevMatch*/ ctx[4].awayTeam));
    			add_location(div7, file$q, 121, 18, 4409);
    			attr_dev(div8, "class", "right-side svelte-b6rr06");
    			add_location(div8, file$q, 112, 16, 4059);
    			attr_dev(div9, "class", "past-result svelte-b6rr06");
    			add_location(div9, file$q, 98, 14, 3485);
    			set_style(div10, "clear", "both");
    			add_location(div10, file$q, 126, 14, 4612);
    			attr_dev(div11, "class", "next-game-item result-details svelte-b6rr06");
    			add_location(div11, file$q, 97, 12, 3426);
    			attr_dev(div12, "class", "next-game-item-container");
    			add_location(div12, file$q, 89, 10, 3105);
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
    		id: create_each_block$7.name,
    		type: "each",
    		source: "(89:8) {#each data.upcoming[team].prevMatches as prevMatch}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$r(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[0].upcoming[/*team*/ ctx[1]].nextTeam === null) return create_if_block$c;
    		return create_else_block$6;
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
    		id: create_fragment$r.name,
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

    function instance$r($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NextGame', slots, []);
    	let { data, team, switchTeam } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<NextGame> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<NextGame> was created without expected prop 'team'");
    		}

    		if (switchTeam === undefined && !('switchTeam' in $$props || $$self.$$.bound[$$self.$$.props['switchTeam']])) {
    			console.warn("<NextGame> was created without expected prop 'switchTeam'");
    		}
    	});

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
    		init(this, options, instance$r, create_fragment$r, safe_not_equal, { data: 0, team: 1, switchTeam: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NextGame",
    			options,
    			id: create_fragment$r.name
    		});
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

    const { Object: Object_1$e } = globals;

    const file$p = "src\\components\\team\\goals_scored_and_conceded\\StatsValues.svelte";

    // (94:0) {#if stats != undefined}
    function create_if_block$b(ctx) {
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
    			add_location(div0, file$p, 97, 8, 3436);
    			attr_dev(div1, "class", "season-stat-number");
    			add_location(div1, file$p, 100, 8, 3524);
    			attr_dev(div2, "class", div2_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xG + " svelte-11i30am");
    			add_location(div2, file$p, 103, 8, 3621);
    			attr_dev(div3, "class", "season-stat-value svelte-11i30am");
    			add_location(div3, file$p, 96, 6, 3395);
    			attr_dev(div4, "class", "season-stat-text svelte-11i30am");
    			add_location(div4, file$p, 107, 6, 3728);
    			attr_dev(div5, "class", "season-stat goals-per-game svelte-11i30am");
    			add_location(div5, file$p, 95, 4, 3347);
    			attr_dev(div6, "class", "season-stat-position hidden svelte-11i30am");
    			add_location(div6, file$p, 111, 8, 3888);
    			attr_dev(div7, "class", "season-stat-number");
    			add_location(div7, file$p, 114, 8, 3976);
    			attr_dev(div8, "class", div8_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].xC + " svelte-11i30am");
    			add_location(div8, file$p, 117, 8, 4073);
    			attr_dev(div9, "class", "season-stat-value svelte-11i30am");
    			add_location(div9, file$p, 110, 6, 3847);
    			attr_dev(div10, "class", "season-stat-text svelte-11i30am");
    			add_location(div10, file$p, 121, 6, 4180);
    			attr_dev(div11, "class", "season-stat conceded-per-game svelte-11i30am");
    			add_location(div11, file$p, 109, 4, 3796);
    			attr_dev(div12, "class", "season-stat-position hidden svelte-11i30am");
    			add_location(div12, file$p, 125, 8, 4343);
    			attr_dev(div13, "class", "season-stat-number");
    			add_location(div13, file$p, 128, 8, 4444);
    			attr_dev(div14, "class", div14_class_value = "season-stat-position ssp-" + /*rank*/ ctx[2].cleanSheetRatio + " svelte-11i30am");
    			add_location(div14, file$p, 131, 8, 4554);
    			attr_dev(div15, "class", "season-stat-value svelte-11i30am");
    			add_location(div15, file$p, 124, 6, 4302);
    			attr_dev(div16, "class", "season-stat-text svelte-11i30am");
    			add_location(div16, file$p, 135, 6, 4687);
    			attr_dev(div17, "class", "season-stat clean-sheet-ratio svelte-11i30am");
    			add_location(div17, file$p, 123, 4, 4251);
    			attr_dev(div18, "class", "season-stats svelte-11i30am");
    			add_location(div18, file$p, 94, 2, 3315);
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
    		id: create_if_block$b.name,
    		type: "if",
    		source: "(94:0) {#if stats != undefined}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$q(ctx) {
    	let if_block_anchor;
    	let if_block = /*stats*/ ctx[1] != undefined && create_if_block$b(ctx);

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
    					if_block = create_if_block$b(ctx);
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
    		id: create_fragment$q.name,
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

    function instance$q($$self, $$props, $$invalidate) {
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
    	let rank = { xG: "", xC: "", cleanSheetRatio: "" };
    	let setup = false;

    	onMount(() => {
    		$$invalidate(1, stats = buildStats(data));
    		setStatsValues(stats, team);
    		setup = true;
    	});

    	let { data, team } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<StatsValues> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<StatsValues> was created without expected prop 'team'");
    		}
    	});

    	const writable_props = ['data', 'team'];

    	Object_1$e.keys($$props).forEach(key => {
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
    		init(this, options, instance$q, create_fragment$q, safe_not_equal, { data: 3, team: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StatsValues",
    			options,
    			id: create_fragment$q.name
    		});
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

    /* src\components\Footer.svelte generated by Svelte v3.59.2 */

    const file$o = "src\\components\\Footer.svelte";

    // (13:4) {#if lastUpdated != null}
    function create_if_block$a(ctx) {
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
    			attr_dev(div, "class", "last-updated no-select svelte-k5fict");
    			add_location(div, file$o, 13, 6, 372);
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
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(13:4) {#if lastUpdated != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$p(ctx) {
    	let div1;
    	let div0;
    	let a0;
    	let img;
    	let img_src_value;
    	let t0;
    	let t1;
    	let a1;
    	let span;
    	let t2;
    	let t3;
    	let if_block = /*lastUpdated*/ ctx[0] != null && create_if_block$a(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			if (if_block) if_block.c();
    			t1 = space();
    			a1 = element("a");
    			span = element("span");
    			t2 = text("pl");
    			t3 = text("dashboard");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a0 = claim_element(div0_nodes, "A", { href: true, target: true, class: true });
    			var a0_nodes = children(a0);
    			img = claim_element(a0_nodes, "IMG", { src: true, alt: true, class: true });
    			a0_nodes.forEach(detach_dev);
    			t0 = claim_space(div0_nodes);
    			if (if_block) if_block.l(div0_nodes);
    			t1 = claim_space(div0_nodes);
    			a1 = claim_element(div0_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			span = claim_element(a1_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t2 = claim_text(span_nodes, "pl");
    			span_nodes.forEach(detach_dev);
    			t3 = claim_text(a1_nodes, "dashboard");
    			a1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = "/img/github.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "GitHub");
    			attr_dev(img, "class", "github-img svelte-k5fict");
    			add_location(img, file$o, 10, 6, 262);
    			attr_dev(a0, "href", "https://github.com/tom-draper/pldashboard");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "class", "github svelte-k5fict");
    			add_location(a0, file$o, 5, 4, 144);
    			attr_dev(span, "class", "pl svelte-k5fict");
    			add_location(span, file$o, 18, 7, 580);
    			attr_dev(a1, "href", "https://pldashboard.com/home");
    			attr_dev(a1, "class", "version no-select svelte-k5fict");
    			add_location(a1, file$o, 17, 4, 507);
    			attr_dev(div0, "class", "teams-footer-bottom svelte-k5fict");
    			add_location(div0, file$o, 4, 2, 105);
    			attr_dev(div1, "class", "teams-footer footer-text-colour svelte-k5fict");
    			add_location(div1, file$o, 3, 0, 56);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a0);
    			append_hydration_dev(a0, img);
    			append_hydration_dev(div0, t0);
    			if (if_block) if_block.m(div0, null);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, a1);
    			append_hydration_dev(a1, span);
    			append_hydration_dev(span, t2);
    			append_hydration_dev(a1, t3);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*lastUpdated*/ ctx[0] != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$a(ctx);
    					if_block.c();
    					if_block.m(div0, t1);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	let { lastUpdated } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (lastUpdated === undefined && !('lastUpdated' in $$props || $$self.$$.bound[$$self.$$.props['lastUpdated']])) {
    			console.warn("<Footer> was created without expected prop 'lastUpdated'");
    		}
    	});

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

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$p, create_fragment$p, safe_not_equal, { lastUpdated: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$p.name
    		});
    	}

    	get lastUpdated() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lastUpdated(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\team\FixturesGraph.svelte generated by Svelte v3.59.2 */
    const file$n = "src\\components\\team\\FixturesGraph.svelte";

    function create_fragment$o(ctx) {
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
    			add_location(div0, file$n, 269, 2, 8220);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$n, 268, 0, 8199);
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
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$o($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FixturesGraph', slots, []);

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
    		$$invalidate(4, setup = true);
    	});

    	let { data, team, mobileView } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<FixturesGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<FixturesGraph> was created without expected prop 'team'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<FixturesGraph> was created without expected prop 'mobileView'");
    		}
    	});

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
    		toAlias,
    		scoreline,
    		matchDescription,
    		sortByMatchDate,
    		highlightNextGameMarker,
    		linePoints,
    		line,
    		currentDateLine,
    		xRange,
    		defaultLayout: defaultLayout$6,
    		setDefaultLayout,
    		setMobileLayout,
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
    		init(this, options, instance$o, create_fragment$o, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FixturesGraph",
    			options,
    			id: create_fragment$o.name
    		});
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

    /* src\components\team\FormOverTimeGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$d } = globals;
    const file$m = "src\\components\\team\\FormOverTimeGraph.svelte";

    function create_fragment$n(ctx) {
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
    			add_location(div0, file$m, 160, 2, 4999);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$m, 159, 0, 4978);
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
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$n($$self, $$props, $$invalidate) {
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
    				// Render the bottom half of the page now the visible parts have been rendered
    				$$invalidate(1, lazyLoad = true);

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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (playedDates === undefined && !('playedDates' in $$props || $$self.$$.bound[$$self.$$.props['playedDates']])) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'playedDates'");
    		}

    		if (lazyLoad === undefined && !('lazyLoad' in $$props || $$self.$$.bound[$$self.$$.props['lazyLoad']])) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'lazyLoad'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<FormOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'playedDates', 'lazyLoad', 'mobileView'];

    	Object_1$d.keys($$props).forEach(key => {
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

    		init(this, options, instance$n, create_fragment$n, safe_not_equal, {
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
    			id: create_fragment$n.name
    		});
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

    /* src\components\team\PositionOverTimeGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$c } = globals;
    const file$l = "src\\components\\team\\PositionOverTimeGraph.svelte";

    function create_fragment$m(ctx) {
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
    			add_location(div0, file$l, 211, 2, 6202);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$l, 210, 0, 6181);
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
    		id: create_fragment$m.name,
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

    function instance$m($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<PositionOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$c.keys($$props).forEach(key => {
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
    		init(this, options, instance$m, create_fragment$m, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PositionOverTimeGraph",
    			options,
    			id: create_fragment$m.name
    		});
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

    /* src\components\team\PointsOverTimeGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$b } = globals;
    const file$k = "src\\components\\team\\PointsOverTimeGraph.svelte";

    function create_fragment$l(ctx) {
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
    			add_location(div0, file$k, 161, 2, 4827);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$k, 160, 0, 4806);
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
    		id: create_fragment$l.name,
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

    function instance$l($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<PointsOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<PointsOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<PointsOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$b.keys($$props).forEach(key => {
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
    		defaultLayout: defaultLayout$5,
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
    		init(this, options, instance$l, create_fragment$l, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PointsOverTimeGraph",
    			options,
    			id: create_fragment$l.name
    		});
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

    /* src\components\team\goals_scored_and_conceded\ScoredConcededPerGameGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$a } = globals;
    const file$j = "src\\components\\team\\goals_scored_and_conceded\\ScoredConcededPerGameGraph.svelte";

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
    			add_location(div0, file$j, 187, 2, 6007);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$j, 186, 0, 5986);
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
    		id: create_fragment$k.name,
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

    function instance$k($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'team'");
    		}

    		if (playedDates === undefined && !('playedDates' in $$props || $$self.$$.bound[$$self.$$.props['playedDates']])) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'playedDates'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<ScoredConcededPerGameGraph> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'playedDates', 'mobileView'];

    	Object_1$a.keys($$props).forEach(key => {
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

    		init(this, options, instance$k, create_fragment$k, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedDates: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScoredConcededPerGameGraph",
    			options,
    			id: create_fragment$k.name
    		});
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

    /* src\components\team\goals_scored_and_conceded\CleanSheetsGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$9 } = globals;
    const file$i = "src\\components\\team\\goals_scored_and_conceded\\CleanSheetsGraph.svelte";

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
    			add_location(div0, file$i, 190, 2, 5624);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$i, 189, 0, 5603);
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
    		id: create_fragment$j.name,
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

    function instance$j($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'team'");
    		}

    		if (playedDates === undefined && !('playedDates' in $$props || $$self.$$.bound[$$self.$$.props['playedDates']])) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'playedDates'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<CleanSheetsGraph> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'playedDates', 'mobileView'];

    	Object_1$9.keys($$props).forEach(key => {
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

    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {
    			data: 1,
    			team: 2,
    			playedDates: 3,
    			mobileView: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CleanSheetsGraph",
    			options,
    			id: create_fragment$j.name
    		});
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

    /* src\components\team\goals_per_game\GoalsScoredFreqGraph.svelte generated by Svelte v3.59.2 */
    const file$h = "src\\components\\team\\goals_per_game\\GoalsScoredFreqGraph.svelte";

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
    			add_location(div0, file$h, 99, 2, 2707);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$h, 98, 0, 2686);
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
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'team'");
    		}

    		if (getScoredBars === undefined && !('getScoredBars' in $$props || $$self.$$.bound[$$self.$$.props['getScoredBars']])) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getScoredBars'");
    		}

    		if (getScoredTeamBars === undefined && !('getScoredTeamBars' in $$props || $$self.$$.bound[$$self.$$.props['getScoredTeamBars']])) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getScoredTeamBars'");
    		}

    		if (getXLabels === undefined && !('getXLabels' in $$props || $$self.$$.bound[$$self.$$.props['getXLabels']])) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getXLabels'");
    		}

    		if (getYAxisLayout === undefined && !('getYAxisLayout' in $$props || $$self.$$.bound[$$self.$$.props['getYAxisLayout']])) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'getYAxisLayout'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<GoalsScoredFreqGraph> was created without expected prop 'mobileView'");
    		}
    	});

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

    		init(this, options, instance$i, create_fragment$i, safe_not_equal, {
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
    			id: create_fragment$i.name
    		});
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

    /* src\components\team\goals_per_game\GoalsConcededFreqGraph.svelte generated by Svelte v3.59.2 */
    const file$g = "src\\components\\team\\goals_per_game\\GoalsConcededFreqGraph.svelte";

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
    			add_location(div0, file$g, 99, 2, 2699);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$g, 98, 0, 2678);
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
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$h($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'team'");
    		}

    		if (getConcededBars === undefined && !('getConcededBars' in $$props || $$self.$$.bound[$$self.$$.props['getConcededBars']])) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getConcededBars'");
    		}

    		if (getConcededTeamBars === undefined && !('getConcededTeamBars' in $$props || $$self.$$.bound[$$self.$$.props['getConcededTeamBars']])) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getConcededTeamBars'");
    		}

    		if (getXLabels === undefined && !('getXLabels' in $$props || $$self.$$.bound[$$self.$$.props['getXLabels']])) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getXLabels'");
    		}

    		if (getYAxisLayout === undefined && !('getYAxisLayout' in $$props || $$self.$$.bound[$$self.$$.props['getYAxisLayout']])) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'getYAxisLayout'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<GoalsConcededFreqGraph> was created without expected prop 'mobileView'");
    		}
    	});

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

    		init(this, options, instance$h, create_fragment$h, safe_not_equal, {
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
    			id: create_fragment$h.name
    		});
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

    /* src\components\team\goals_per_game\GoalsPerGame.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$8 } = globals;
    const file$f = "src\\components\\team\\goals_per_game\\GoalsPerGame.svelte";

    // (253:2) {#if setup}
    function create_if_block$9(ctx) {
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
    			add_location(div0, file$f, 253, 4, 7890);
    			attr_dev(div1, "class", "graph freq-graph mini-graph svelte-8zd8zw");
    			add_location(div1, file$f, 263, 4, 8123);
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
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(253:2) {#if setup}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$g(ctx) {
    	let div;
    	let current;
    	let if_block = /*setup*/ ctx[2] && create_if_block$9(ctx);

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
    			add_location(div, file$f, 251, 0, 7845);
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
    					if_block = create_if_block$9(ctx);
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
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$g($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<GoalsPerGame> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<GoalsPerGame> was created without expected prop 'team'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<GoalsPerGame> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$8.keys($$props).forEach(key => {
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
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, { data: 9, team: 0, mobileView: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GoalsPerGame",
    			options,
    			id: create_fragment$g.name
    		});
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

    /* src\components\team\SpiderGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$7 } = globals;

    const file$e = "src\\components\\team\\SpiderGraph.svelte";

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[31] = list[i];
    	return child_ctx;
    }

    // (551:6) {#if _team != team}
    function create_if_block$8(ctx) {
    	let button;
    	let t_value = toAlias(/*_team*/ ctx[31]) + "";
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
    			add_location(button, file$e, 551, 8, 19027);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[6], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*teams*/ 2 && t_value !== (t_value = toAlias(/*_team*/ ctx[31]) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(551:6) {#if _team != team}",
    		ctx
    	});

    	return block;
    }

    // (550:4) {#each teams as _team}
    function create_each_block$6(ctx) {
    	let if_block_anchor;
    	let if_block = /*_team*/ ctx[31] != /*team*/ ctx[0] && create_if_block$8(ctx);

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
    					if_block = create_if_block$8(ctx);
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
    		id: create_each_block$6.name,
    		type: "each",
    		source: "(550:4) {#each teams as _team}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$f(ctx) {
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
    		each_blocks[i] = create_each_block$6(get_each_context$6(ctx, each_value, i));
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
    			add_location(div0, file$e, 542, 4, 18735);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$e, 541, 2, 18712);
    			attr_dev(div2, "class", "spider-chart svelte-13tgs7k");
    			add_location(div2, file$e, 540, 0, 18682);
    			attr_dev(div3, "class", "spider-opp-team-btns svelte-13tgs7k");
    			attr_dev(div3, "id", "spider-opp-teams");
    			add_location(div3, file$e, 548, 2, 18906);
    			attr_dev(div4, "class", "spider-opp-team-selector svelte-13tgs7k");
    			add_location(div4, file$e, 547, 0, 18864);
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
    				if (each_blocks[i]) {
    					each_blocks[i].m(div3, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*spiderBtnClick, teams, team*/ 11) {
    				each_value = /*teams*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$6(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$6(child_ctx);
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
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$f($$self, $$props, $$invalidate) {
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
    			if (plotData.data[i].name === team) {
    				plotData.data.splice(i, 1);
    				break;
    			}
    		}

    		// If removing only comparison teamName, re-insert the initial avg spider plot
    		if (comparisonTeams.length === 1) {
    			addAvg();
    		}

    		//@ts-ignore
    		Plotly.redraw(plotDiv); // Redraw with teamName removed
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

    	function spiderBtnClick(btn) {
    		let team = toName(btn.innerHTML);

    		if (btn.style.background === "") {
    			let teamKey = toHyphenatedName(team);
    			btn.style.background = `var(--${teamKey})`;
    			btn.style.color = `var(--${teamKey}-secondary)`;
    		} else {
    			btn.style.background = "";
    			btn.style.color = "black";
    		}

    		if (comparisonTeams.length === 0) {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<SpiderGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<SpiderGraph> was created without expected prop 'team'");
    		}

    		if (teams === undefined && !('teams' in $$props || $$self.$$.bound[$$self.$$.props['teams']])) {
    			console.warn("<SpiderGraph> was created without expected prop 'teams'");
    		}
    	});

    	const writable_props = ['data', 'team', 'teams'];

    	Object_1$7.keys($$props).forEach(key => {
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
    		goalsPerGame,
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
    		seasonComplete,
    		removeItem,
    		formWinsVsBig6,
    		getVsBig6,
    		scatterPlot,
    		avgScatterPlot,
    		getTeamData,
    		initSpiderPlots,
    		computePlotData,
    		defaultLayout: defaultLayout$3,
    		buildPlotData,
    		numSeasons,
    		attack,
    		defence,
    		cleanSheets,
    		consistency,
    		winStreaks,
    		vsBig6,
    		labels,
    		big6,
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
    		if ('big6' in $$props) big6 = $$props.big6;
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
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, { data: 4, team: 0, teams: 1 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SpiderGraph",
    			options,
    			id: create_fragment$f.name
    		});
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

    /* src\components\team\ScorelineFreqGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$6 } = globals;
    const file$d = "src\\components\\team\\ScorelineFreqGraph.svelte";

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
    			add_location(div0, file$d, 257, 2, 7725);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$d, 256, 0, 7704);
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
    		id: create_fragment$e.name,
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

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScorelineFreqGraph', slots, []);

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
    		$$invalidate(4, setup = true);
    	});

    	let { data, team, mobileView } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<ScorelineFreqGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<ScorelineFreqGraph> was created without expected prop 'team'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<ScorelineFreqGraph> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$6.keys($$props).forEach(key => {
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
    		getColours: getColours$1,
    		separateBars,
    		scaleBars,
    		convertToPercentage,
    		defaultLayout: defaultLayout$2,
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
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScorelineFreqGraph",
    			options,
    			id: create_fragment$e.name
    		});
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

    /* src\components\nav\Nav.svelte generated by Svelte v3.59.2 */
    const file$c = "src\\components\\nav\\Nav.svelte";

    function get_each_context_1$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (26:4) {:else}
    function create_else_block$5(ctx) {
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
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
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
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(26:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:4) {#if teams.length === 0}
    function create_if_block$7(ctx) {
    	let each_1_anchor;
    	let each_value = /*widths*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
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
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_hydration_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*widths*/ 16) {
    				each_value = /*widths*/ ctx[4];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$5(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$5(child_ctx);
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
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(22:4) {#if teams.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (36:8) {:else}
    function create_else_block_1$3(ctx) {
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
    			attr_dev(div0, "class", "team-name svelte-dh0tqd");
    			add_location(div0, file$c, 43, 14, 1465);
    			attr_dev(div1, "class", "team-container svelte-dh0tqd");
    			add_location(div1, file$c, 42, 12, 1421);
    			attr_dev(button, "class", "team-link svelte-dh0tqd");
    			add_location(button, file$c, 36, 10, 1257);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
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
    		id: create_else_block_1$3.name,
    		type: "else",
    		source: "(36:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (28:8) {#if toHyphenatedName(_team) === team}
    function create_if_block_1$5(ctx) {
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
    			attr_dev(div0, "class", "this-team-name svelte-dh0tqd");
    			add_location(div0, file$c, 30, 14, 1108);
    			attr_dev(div1, "class", "this-team-container svelte-dh0tqd");
    			attr_dev(div1, "style", div1_style_value = teamStyle(/*_team*/ ctx[9]));
    			add_location(div1, file$c, 29, 12, 1034);
    			attr_dev(a, "href", a_href_value = "/" + toHyphenatedName(/*_team*/ ctx[9]));
    			attr_dev(a, "class", "team-link");
    			add_location(a, file$c, 28, 10, 965);
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
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(28:8) {#if toHyphenatedName(_team) === team}",
    		ctx
    	});

    	return block;
    }

    // (27:6) {#each teams as _team, _ (_team)}
    function create_each_block_1$2(key_1, ctx) {
    	let first;
    	let show_if;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (dirty & /*teams, team*/ 3) show_if = null;
    		if (show_if == null) show_if = !!(toHyphenatedName(/*_team*/ ctx[9]) === /*team*/ ctx[0]);
    		if (show_if) return create_if_block_1$5;
    		return create_else_block_1$3;
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
    		source: "(27:6) {#each teams as _team, _ (_team)}",
    		ctx
    	});

    	return block;
    }

    // (23:6) {#each widths as width, _}
    function create_each_block$5(ctx) {
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
    			attr_dev(div, "class", "placeholder svelte-dh0tqd");
    			set_style(div, "width", /*width*/ ctx[6] + "%");
    			add_location(div, file$c, 23, 8, 785);
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
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(23:6) {#each widths as width, _}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let nav;
    	let div0;
    	let a;
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
    		if (/*teams*/ ctx[1].length === 0) return create_if_block$7;
    		return create_else_block$5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div0 = element("div");
    			a = element("a");
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
    			a = claim_element(div0_nodes, "A", { href: true, class: true });
    			var a_nodes = children(a);
    			span = claim_element(a_nodes, "SPAN", { style: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "pl");
    			span_nodes.forEach(detach_dev);
    			t1 = claim_text(a_nodes, "dashboard");
    			a_nodes.forEach(detach_dev);
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
    			add_location(span, file$c, 17, 6, 611);
    			attr_dev(a, "href", "/home");
    			attr_dev(a, "class", "svelte-dh0tqd");
    			add_location(a, file$c, 16, 4, 587);
    			attr_dev(div0, "class", "title no-selection svelte-dh0tqd");
    			add_location(div0, file$c, 15, 2, 549);
    			attr_dev(div1, "class", "team-links svelte-dh0tqd");
    			add_location(div1, file$c, 20, 2, 687);
    			if (!src_url_equal(img.src, img_src_value = "img/arrow-bar-left.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-dh0tqd");
    			add_location(img, file$c, 73, 6, 2264);
    			attr_dev(button, "class", "close-btn svelte-dh0tqd");
    			add_location(button, file$c, 72, 4, 2207);
    			attr_dev(div2, "class", "close");
    			add_location(div2, file$c, 71, 2, 2182);
    			attr_dev(nav, "id", "navBar");
    			attr_dev(nav, "class", "svelte-dh0tqd");
    			add_location(nav, file$c, 14, 0, 528);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			append_hydration_dev(nav, div0);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(a, t1);
    			append_hydration_dev(nav, t2);
    			append_hydration_dev(nav, div1);
    			if_block.m(div1, null);
    			append_hydration_dev(nav, t3);
    			append_hydration_dev(nav, div2);
    			append_hydration_dev(div2, button);
    			append_hydration_dev(button, img);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", closeNavBar$1, false, false, false, false);
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
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function closeNavBar$1() {
    	document.getElementById("navBar").style.display = "none";
    	document.getElementById("dashboard").style.marginLeft = "0";
    	window.dispatchEvent(new Event("resize")); // Snap plotly graphs to new width
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Nav', slots, []);
    	let widths = [];

    	for (let i = 0; i < 20; i++) {
    		widths.push(35 + Math.floor(Math.random() * 8) * 5);
    	}

    	let { team, teams, toAlias, switchTeam } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<Nav> was created without expected prop 'team'");
    		}

    		if (teams === undefined && !('teams' in $$props || $$self.$$.bound[$$self.$$.props['teams']])) {
    			console.warn("<Nav> was created without expected prop 'teams'");
    		}

    		if (toAlias === undefined && !('toAlias' in $$props || $$self.$$.bound[$$self.$$.props['toAlias']])) {
    			console.warn("<Nav> was created without expected prop 'toAlias'");
    		}

    		if (switchTeam === undefined && !('switchTeam' in $$props || $$self.$$.bound[$$self.$$.props['switchTeam']])) {
    			console.warn("<Nav> was created without expected prop 'switchTeam'");
    		}
    	});

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
    		closeNavBar: closeNavBar$1,
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

    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {
    			team: 0,
    			teams: 1,
    			toAlias: 2,
    			switchTeam: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Nav",
    			options,
    			id: create_fragment$d.name
    		});
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

    /* src\components\overview\Overview.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$5 } = globals;
    const file$b = "src\\components\\overview\\Overview.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	child_ctx[18] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	child_ctx[18] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[18] = i;
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[18] = i;
    	return child_ctx;
    }

    function get_each_context_5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	child_ctx[18] = i;
    	return child_ctx;
    }

    // (194:8) {#if upcoming != undefined}
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
    			add_location(div0, file$b, 195, 12, 5370);
    			attr_dev(div1, "class", "upcoming-matches svelte-1gtw5nu");
    			add_location(div1, file$b, 194, 10, 5326);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div1, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
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
    		source: "(194:8) {#if upcoming != undefined}",
    		ctx
    	});

    	return block;
    }

    // (198:14) {#if i === 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}
    function create_if_block_3$3(ctx) {
    	let div;

    	let t_value = /*match*/ ctx[16].time.toLocaleDateString("en-GB", {
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
    			add_location(div, file$b, 198, 16, 5559);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*upcoming*/ 4 && t_value !== (t_value = /*match*/ ctx[16].time.toLocaleDateString("en-GB", {
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
    		source: "(198:14) {#if i === 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}",
    		ctx
    	});

    	return block;
    }

    // (197:12) {#each upcoming as match, i}
    function create_each_block_5(ctx) {
    	let show_if = /*i*/ ctx[18] === 0 || /*match*/ ctx[16].time.getDate() != /*upcoming*/ ctx[2][/*i*/ ctx[18] - 1].time.getDate();
    	let t0;
    	let div3;
    	let div2;
    	let div0;
    	let t1_value = toInitials(/*match*/ ctx[16].home) + "";
    	let t1;
    	let div0_style_value;
    	let t2;
    	let div1;
    	let t3_value = toInitials(/*match*/ ctx[16].away) + "";
    	let t3;
    	let div1_style_value;
    	let t4;
    	let div5;
    	let div4;
    	let t5_value = /*match*/ ctx[16].time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "";
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
    			attr_dev(div0, "style", div0_style_value = teamStyle(/*match*/ ctx[16].home));
    			add_location(div0, file$b, 209, 18, 5986);
    			attr_dev(div1, "class", "upcoming-match-away svelte-1gtw5nu");
    			attr_dev(div1, "style", div1_style_value = teamStyle(/*match*/ ctx[16].away));
    			add_location(div1, file$b, 215, 18, 6203);
    			attr_dev(div2, "class", "upcoming-match-teams svelte-1gtw5nu");
    			add_location(div2, file$b, 208, 16, 5932);
    			attr_dev(div3, "class", "upcoming-match svelte-1gtw5nu");
    			add_location(div3, file$b, 207, 14, 5886);
    			attr_dev(div4, "class", "upcoming-match-time svelte-1gtw5nu");
    			add_location(div4, file$b, 224, 16, 6523);
    			attr_dev(div5, "class", "upcoming-match-time-container svelte-1gtw5nu");
    			add_location(div5, file$b, 223, 14, 6462);
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
    			if (dirty & /*upcoming*/ 4) show_if = /*i*/ ctx[18] === 0 || /*match*/ ctx[16].time.getDate() != /*upcoming*/ ctx[2][/*i*/ ctx[18] - 1].time.getDate();

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

    			if (dirty & /*upcoming*/ 4 && t1_value !== (t1_value = toInitials(/*match*/ ctx[16].home) + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*upcoming*/ 4 && div0_style_value !== (div0_style_value = teamStyle(/*match*/ ctx[16].home))) {
    				attr_dev(div0, "style", div0_style_value);
    			}

    			if (dirty & /*upcoming*/ 4 && t3_value !== (t3_value = toInitials(/*match*/ ctx[16].away) + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*upcoming*/ 4 && div1_style_value !== (div1_style_value = teamStyle(/*match*/ ctx[16].away))) {
    				attr_dev(div1, "style", div1_style_value);
    			}

    			if (dirty & /*upcoming*/ 4 && t5_value !== (t5_value = /*match*/ ctx[16].time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "")) set_data_dev(t5, t5_value);
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
    		source: "(197:12) {#each upcoming as match, i}",
    		ctx
    	});

    	return block;
    }

    // (238:6) {#if standings != undefined}
    function create_if_block_1$4(ctx) {
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
    			add_location(div0, file$b, 239, 10, 6970);
    			attr_dev(div1, "class", "standings-position svelte-1gtw5nu");
    			add_location(div1, file$b, 242, 14, 7102);
    			attr_dev(div2, "class", "standings-team-name svelte-1gtw5nu");
    			add_location(div2, file$b, 243, 14, 7152);
    			attr_dev(div3, "class", "standings-won bold svelte-1gtw5nu");
    			add_location(div3, file$b, 244, 14, 7203);
    			attr_dev(div4, "class", "standings-drawn bold svelte-1gtw5nu");
    			add_location(div4, file$b, 245, 14, 7258);
    			attr_dev(div5, "class", "standings-lost bold svelte-1gtw5nu");
    			add_location(div5, file$b, 246, 14, 7315);
    			attr_dev(div6, "class", "standings-gf bold svelte-1gtw5nu");
    			add_location(div6, file$b, 247, 14, 7371);
    			attr_dev(div7, "class", "standings-ga bold svelte-1gtw5nu");
    			add_location(div7, file$b, 248, 14, 7426);
    			attr_dev(div8, "class", "standings-gd bold svelte-1gtw5nu");
    			add_location(div8, file$b, 249, 14, 7481);
    			attr_dev(div9, "class", "standings-played bold svelte-1gtw5nu");
    			add_location(div9, file$b, 250, 14, 7536);
    			attr_dev(div10, "class", "standings-points bold svelte-1gtw5nu");
    			add_location(div10, file$b, 251, 14, 7599);
    			attr_dev(div11, "class", "standings-rating bold svelte-1gtw5nu");
    			add_location(div11, file$b, 252, 14, 7662);
    			attr_dev(div12, "class", "standings-form bold svelte-1gtw5nu");
    			add_location(div12, file$b, 253, 14, 7725);
    			attr_dev(div13, "class", "table-row svelte-1gtw5nu");
    			add_location(div13, file$b, 241, 12, 7063);
    			attr_dev(div14, "class", "standings svelte-1gtw5nu");
    			add_location(div14, file$b, 240, 10, 7026);
    			attr_dev(div15, "class", "standings-table");
    			add_location(div15, file$b, 238, 8, 6929);
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
    				if (each_blocks[i]) {
    					each_blocks[i].m(div14, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*Object, data, standings, Math, parseInt, undefined*/ 9) {
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
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(238:6) {#if standings != undefined}",
    		ctx
    	});

    	return block;
    }

    // (256:12) {#each standings as row, i}
    function create_each_block_4(ctx) {
    	let div12;
    	let div0;
    	let t0_value = /*row*/ ctx[13].position + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*row*/ ctx[13].team + "";
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*row*/ ctx[13].won + "";
    	let t4;
    	let t5;
    	let div3;
    	let t6_value = /*row*/ ctx[13].drawn + "";
    	let t6;
    	let t7;
    	let div4;
    	let t8_value = /*row*/ ctx[13].lost + "";
    	let t8;
    	let t9;
    	let div5;
    	let t10_value = /*row*/ ctx[13].gF + "";
    	let t10;
    	let t11;
    	let div6;
    	let t12_value = /*row*/ ctx[13].gA + "";
    	let t12;
    	let t13;
    	let div7;
    	let t14_value = /*row*/ ctx[13].gD + "";
    	let t14;
    	let t15;
    	let div8;
    	let t16_value = /*row*/ ctx[13].played + "";
    	let t16;
    	let t17;
    	let div9;
    	let t18_value = /*row*/ ctx[13].points + "";
    	let t18;
    	let t19;
    	let div10;
    	let t20_value = /*data*/ ctx[0].teamRatings[/*row*/ ctx[13].team].totalRating.toFixed(2) + "";
    	let t20;
    	let t21;
    	let div11;

    	let t22_value = (Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).length > 0 && /*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id][Math.max(...Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).map(/*func*/ ctx[7]))] != undefined && /*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id][Math.max(...Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).map(/*func_1*/ ctx[8]))].formRating5 != null
    	? /*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id][Math.max(...Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).map(/*func_2*/ ctx[9]))].formRating5.toFixed(2)
    	: "") + "";

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
    			add_location(div0, file$b, 263, 16, 8105);
    			attr_dev(div1, "class", "standings-team-name svelte-1gtw5nu");
    			add_location(div1, file$b, 266, 16, 8213);
    			attr_dev(div2, "class", "standings-won svelte-1gtw5nu");
    			add_location(div2, file$b, 269, 16, 8318);
    			attr_dev(div3, "class", "standings-drawn svelte-1gtw5nu");
    			add_location(div3, file$b, 272, 16, 8416);
    			attr_dev(div4, "class", "standings-lost svelte-1gtw5nu");
    			add_location(div4, file$b, 275, 16, 8518);
    			attr_dev(div5, "class", "standings-gf svelte-1gtw5nu");
    			add_location(div5, file$b, 278, 16, 8618);
    			attr_dev(div6, "class", "standings-ga svelte-1gtw5nu");
    			add_location(div6, file$b, 281, 16, 8714);
    			attr_dev(div7, "class", "standings-gd svelte-1gtw5nu");
    			add_location(div7, file$b, 284, 16, 8810);
    			attr_dev(div8, "class", "standings-played svelte-1gtw5nu");
    			add_location(div8, file$b, 287, 16, 8906);
    			attr_dev(div9, "class", "standings-points svelte-1gtw5nu");
    			add_location(div9, file$b, 290, 16, 9010);
    			attr_dev(div10, "class", "standings-rating svelte-1gtw5nu");
    			add_location(div10, file$b, 293, 16, 9114);
    			attr_dev(div11, "class", "standings-form svelte-1gtw5nu");
    			add_location(div11, file$b, 296, 16, 9257);
    			attr_dev(div12, "class", "table-row " + (/*i*/ ctx[18] % 2 === 0 ? 'grey-row' : '') + " " + (/*i*/ ctx[18] < 4 ? 'cl' : '') + " " + (/*i*/ ctx[18] > 3 && /*i*/ ctx[18] < 6 ? 'el' : '') + " " + (/*i*/ ctx[18] > 16 ? 'relegation' : '') + " svelte-1gtw5nu");
    			add_location(div12, file$b, 256, 14, 7845);
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
    			if (dirty & /*standings*/ 8 && t0_value !== (t0_value = /*row*/ ctx[13].position + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*standings*/ 8 && t2_value !== (t2_value = /*row*/ ctx[13].team + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*standings*/ 8 && t4_value !== (t4_value = /*row*/ ctx[13].won + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*standings*/ 8 && t6_value !== (t6_value = /*row*/ ctx[13].drawn + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*standings*/ 8 && t8_value !== (t8_value = /*row*/ ctx[13].lost + "")) set_data_dev(t8, t8_value);
    			if (dirty & /*standings*/ 8 && t10_value !== (t10_value = /*row*/ ctx[13].gF + "")) set_data_dev(t10, t10_value);
    			if (dirty & /*standings*/ 8 && t12_value !== (t12_value = /*row*/ ctx[13].gA + "")) set_data_dev(t12, t12_value);
    			if (dirty & /*standings*/ 8 && t14_value !== (t14_value = /*row*/ ctx[13].gD + "")) set_data_dev(t14, t14_value);
    			if (dirty & /*standings*/ 8 && t16_value !== (t16_value = /*row*/ ctx[13].played + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*standings*/ 8 && t18_value !== (t18_value = /*row*/ ctx[13].points + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*data, standings*/ 9 && t20_value !== (t20_value = /*data*/ ctx[0].teamRatings[/*row*/ ctx[13].team].totalRating.toFixed(2) + "")) set_data_dev(t20, t20_value);

    			if (dirty & /*data, standings*/ 9 && t22_value !== (t22_value = (Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).length > 0 && /*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id][Math.max(...Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).map(/*func*/ ctx[7]))] != undefined && /*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id][Math.max(...Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).map(/*func_1*/ ctx[8]))].formRating5 != null
    			? /*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id][Math.max(...Object.keys(/*data*/ ctx[0].form[/*row*/ ctx[13].team][/*data*/ ctx[0]._id]).map(/*func_2*/ ctx[9]))].formRating5.toFixed(2)
    			: "") + "")) set_data_dev(t22, t22_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div12);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(256:12) {#each standings as row, i}",
    		ctx
    	});

    	return block;
    }

    // (332:6) {#if fixtures != undefined}
    function create_if_block$6(ctx) {
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
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
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

    			attr_dev(button0, "class", button0_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] === 'rating'
    			? 'scaling-selected'
    			: '') + " svelte-1gtw5nu");

    			add_location(button0, file$b, 334, 12, 10640);
    			attr_dev(div0, "class", "scale-team-ratings svelte-1gtw5nu");
    			add_location(div0, file$b, 333, 10, 10594);
    			attr_dev(button1, "id", "form-scale-btn");

    			attr_dev(button1, "class", button1_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] === 'form'
    			? 'scaling-selected'
    			: '') + " svelte-1gtw5nu");

    			add_location(button1, file$b, 345, 12, 10994);
    			attr_dev(div1, "class", "scale-team-form svelte-1gtw5nu");
    			add_location(div1, file$b, 344, 10, 10951);
    			attr_dev(div2, "class", "scale-btns svelte-1gtw5nu");
    			add_location(div2, file$b, 332, 8, 10558);
    			attr_dev(div3, "class", "fixtures-teams-container svelte-1gtw5nu");
    			add_location(div3, file$b, 357, 10, 11349);
    			attr_dev(div4, "class", "fixtures-matches svelte-1gtw5nu");
    			add_location(div4, file$b, 377, 14, 12111);
    			attr_dev(div5, "class", "fixtures-table-row svelte-1gtw5nu");
    			add_location(div5, file$b, 376, 12, 12063);
    			attr_dev(div6, "class", "fixtures-matches-container svelte-1gtw5nu");
    			add_location(div6, file$b, 375, 10, 12009);
    			attr_dev(div7, "class", "fixtures-table svelte-1gtw5nu");
    			add_location(div7, file$b, 356, 8, 11309);
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
    				if (each_blocks_2[i]) {
    					each_blocks_2[i].m(div3, null);
    				}
    			}

    			append_hydration_dev(div7, t4);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, div4);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(div4, null);
    				}
    			}

    			append_hydration_dev(div6, t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div6, null);
    				}
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*applyRatingFixturesScaling*/ ctx[5], false, false, false, false),
    					listen_dev(button1, "click", /*applyRatingFormScaling*/ ctx[6], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixturesScaling*/ 16 && button0_class_value !== (button0_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] === 'rating'
    			? 'scaling-selected'
    			: '') + " svelte-1gtw5nu")) {
    				attr_dev(button0, "class", button0_class_value);
    			}

    			if (dirty & /*fixturesScaling*/ 16 && button1_class_value !== (button1_class_value = "scale-btn " + (/*fixturesScaling*/ ctx[4] === 'form'
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
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
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
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(332:6) {#if fixtures != undefined}",
    		ctx
    	});

    	return block;
    }

    // (359:12) {#each fixtures as row, i}
    function create_each_block_3(ctx) {
    	let div1;
    	let div0;
    	let t0_value = toInitials(/*row*/ ctx[13].team) + "";
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

    			attr_dev(div0, "style", div0_style_value = "" + (teamStyle(/*row*/ ctx[13].team) + " " + (/*i*/ ctx[18] === 0
    			? 'border-top: 2px solid black; border-radius: 4px 0 0'
    			: '') + " " + (/*i*/ ctx[18] === /*fixtures*/ ctx[1].length - 1
    			? 'border-radius: 0 0 0 4px;'
    			: '')));

    			add_location(div0, file$b, 360, 16, 11493);
    			attr_dev(div1, "class", "fixtures-table-row svelte-1gtw5nu");
    			add_location(div1, file$b, 359, 14, 11443);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div1, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixtures*/ 2 && t0_value !== (t0_value = toInitials(/*row*/ ctx[13].team) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*fixtures*/ 2 && div0_style_value !== (div0_style_value = "" + (teamStyle(/*row*/ ctx[13].team) + " " + (/*i*/ ctx[18] === 0
    			? 'border-top: 2px solid black; border-radius: 4px 0 0'
    			: '') + " " + (/*i*/ ctx[18] === /*fixtures*/ ctx[1].length - 1
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
    		source: "(359:12) {#each fixtures as row, i}",
    		ctx
    	});

    	return block;
    }

    // (379:16) {#each Array(38) as _, i}
    function create_each_block_2(ctx) {
    	let div;
    	let t_value = /*i*/ ctx[18] + 1 + "";
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
    			add_location(div, file$b, 379, 18, 12204);
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
    		source: "(379:16) {#each Array(38) as _, i}",
    		ctx
    	});

    	return block;
    }

    // (387:18) {#each row.matches as match, i}
    function create_each_block_1$1(ctx) {
    	let div;
    	let t0_value = `${toInitials(/*match*/ ctx[16].team)} (${/*match*/ ctx[16].atHome ? "H" : "A"}` + "";
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

    			attr_dev(div, "style", div_style_value = "background: " + /*match*/ ctx[16].colour + "; " + (/*match*/ ctx[16].status == 'FINISHED'
    			? 'filter: grayscale(100%)'
    			: '') + " " + (/*i*/ ctx[18] === /*row*/ ctx[13].matches.length - 1
    			? 'border-right: 2px solid black'
    			: ''));

    			attr_dev(div, "title", div_title_value = /*match*/ ctx[16].date);
    			add_location(div, file$b, 387, 20, 12512);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(div, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixtures*/ 2 && t0_value !== (t0_value = `${toInitials(/*match*/ ctx[16].team)} (${/*match*/ ctx[16].atHome ? "H" : "A"}` + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*fixtures*/ 2 && div_style_value !== (div_style_value = "background: " + /*match*/ ctx[16].colour + "; " + (/*match*/ ctx[16].status == 'FINISHED'
    			? 'filter: grayscale(100%)'
    			: '') + " " + (/*i*/ ctx[18] === /*row*/ ctx[13].matches.length - 1
    			? 'border-right: 2px solid black'
    			: ''))) {
    				attr_dev(div, "style", div_style_value);
    			}

    			if (dirty & /*fixtures*/ 2 && div_title_value !== (div_title_value = /*match*/ ctx[16].date)) {
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
    		source: "(387:18) {#each row.matches as match, i}",
    		ctx
    	});

    	return block;
    }

    // (384:12) {#each fixtures as row, _}
    function create_each_block$4(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let each_value_1 = /*row*/ ctx[13].matches;
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
    			add_location(div0, file$b, 385, 16, 12409);
    			attr_dev(div1, "class", "fixtures-table-row svelte-1gtw5nu");
    			add_location(div1, file$b, 384, 14, 12359);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div0, null);
    				}
    			}

    			append_hydration_dev(div1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fixtures, toInitials*/ 2) {
    				each_value_1 = /*row*/ ctx[13].matches;
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
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(384:12) {#each fixtures as row, _}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
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
    	let if_block0 = /*upcoming*/ ctx[2] != undefined && create_if_block_2$3(ctx);
    	let if_block1 = /*standings*/ ctx[3] != undefined && create_if_block_1$4(ctx);
    	let if_block2 = /*fixtures*/ ctx[1] != undefined && create_if_block$6(ctx);

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
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "upcoming-matches-container");
    			add_location(div0, file$b, 192, 6, 5237);
    			attr_dev(div1, "class", "left svelte-1gtw5nu");
    			add_location(div1, file$b, 191, 4, 5211);
    			attr_dev(div2, "class", "standings-container svelte-1gtw5nu");
    			add_location(div2, file$b, 236, 4, 6850);
    			attr_dev(div3, "class", "row svelte-1gtw5nu");
    			add_location(div3, file$b, 190, 2, 5188);
    			attr_dev(div4, "class", "fixtures-title svelte-1gtw5nu");
    			add_location(div4, file$b, 330, 6, 10471);
    			attr_dev(div5, "class", "fixtures svelte-1gtw5nu");
    			add_location(div5, file$b, 329, 4, 10441);
    			attr_dev(div6, "class", "row svelte-1gtw5nu");
    			add_location(div6, file$b, 328, 2, 10418);
    			attr_dev(div7, "id", "page-content");
    			attr_dev(div7, "class", "svelte-1gtw5nu");
    			add_location(div7, file$b, 189, 0, 5161);
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
    					if_block1 = create_if_block_1$4(ctx);
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
    					if_block2 = create_if_block$6(ctx);
    					if_block2.c();
    					if_block2.m(div5, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
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

    function instance$c($$self, $$props, $$invalidate) {
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
    		if (fixturesScaling === "rating") {
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
    		if (fixturesScaling === "form") {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<Overview> was created without expected prop 'data'");
    		}
    	});

    	const writable_props = ['data'];

    	Object_1$5.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Overview> was created with unknown prop '${key}'`);
    	});

    	const func = x => parseInt(x);
    	const func_1 = x => parseInt(x);
    	const func_2 = x => parseInt(x);

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		toInitials,
    		teamStyle,
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
    		applyRatingFormScaling,
    		func,
    		func_1,
    		func_2
    	];
    }

    class Overview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { data: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Overview",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get data() {
    		throw new Error("<Overview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Overview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\nav\MobileNav.svelte generated by Svelte v3.59.2 */
    const file$a = "src\\components\\nav\\MobileNav.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    // (27:2) {#if hyphenatedTeams != undefined}
    function create_if_block$5(ctx) {
    	let div;
    	let each_value = /*hyphenatedTeams*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
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
    			attr_dev(div, "class", "team-links svelte-19ywf0");
    			add_location(div, file$a, 27, 4, 902);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*hyphenatedTeams, switchTeamToTop, toAlias, teams*/ 15) {
    				each_value = /*hyphenatedTeams*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
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
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(27:2) {#if hyphenatedTeams != undefined}",
    		ctx
    	});

    	return block;
    }

    // (30:8) {#if team != null}
    function create_if_block_1$3(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[13] === 0 || /*i*/ ctx[13] === 1 && /*hyphenatedTeams*/ ctx[2][0] === null) return create_if_block_2$2;
    		if (/*i*/ ctx[13] === /*hyphenatedTeams*/ ctx[2].length - 1 || /*i*/ ctx[13] === /*hyphenatedTeams*/ ctx[2].length - 2 && /*hyphenatedTeams*/ ctx[2][/*hyphenatedTeams*/ ctx[2].length - 1] === null) return create_if_block_3$2;
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
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(30:8) {#if team != null}",
    		ctx
    	});

    	return block;
    }

    // (51:10) {:else}
    function create_else_block$4(ctx) {
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
    			attr_dev(button, "class", "team-link svelte-19ywf0");
    			add_location(button, file$a, 51, 12, 2033);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_2, false, false, false, false);
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
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(51:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:147) 
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
    			attr_dev(button, "class", "team-link last-team svelte-19ywf0");
    			add_location(button, file$a, 42, 12, 1670);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_1, false, false, false, false);
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
    		source: "(41:147) ",
    		ctx
    	});

    	return block;
    }

    // (31:10) {#if i === 0 || (i === 1 && hyphenatedTeams[0] === null)}
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
    			attr_dev(button, "class", "team-link first-team svelte-19ywf0");
    			add_location(button, file$a, 32, 12, 1130);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
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
    		source: "(31:10) {#if i === 0 || (i === 1 && hyphenatedTeams[0] === null)}",
    		ctx
    	});

    	return block;
    }

    // (29:6) {#each hyphenatedTeams as team, i}
    function create_each_block$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*team*/ ctx[11] != null && create_if_block_1$3(ctx);

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
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(29:6) {#each hyphenatedTeams as team, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let nav;
    	let if_block = /*hyphenatedTeams*/ ctx[2] != undefined && create_if_block$5(ctx);

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
    			set_style(nav, "width", "0%");
    			attr_dev(nav, "class", "svelte-19ywf0");
    			add_location(nav, file$a, 25, 0, 819);
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
    					if_block = create_if_block$5(ctx);
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
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (hyphenatedTeam === undefined && !('hyphenatedTeam' in $$props || $$self.$$.bound[$$self.$$.props['hyphenatedTeam']])) {
    			console.warn("<MobileNav> was created without expected prop 'hyphenatedTeam'");
    		}

    		if (teams === undefined && !('teams' in $$props || $$self.$$.bound[$$self.$$.props['teams']])) {
    			console.warn("<MobileNav> was created without expected prop 'teams'");
    		}

    		if (toAlias === undefined && !('toAlias' in $$props || $$self.$$.bound[$$self.$$.props['toAlias']])) {
    			console.warn("<MobileNav> was created without expected prop 'toAlias'");
    		}

    		if (switchTeam === undefined && !('switchTeam' in $$props || $$self.$$.bound[$$self.$$.props['switchTeam']])) {
    			console.warn("<MobileNav> was created without expected prop 'switchTeam'");
    		}

    		if (toggleMobileNav === undefined && !('toggleMobileNav' in $$props || $$self.$$.bound[$$self.$$.props['toggleMobileNav']])) {
    			console.warn("<MobileNav> was created without expected prop 'toggleMobileNav'");
    		}
    	});

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

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
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
    			id: create_fragment$b.name
    		});
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

    /* src\components\team\goals_scored_and_conceded\ScoredConcededOverTimeGraph.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$4 } = globals;
    const file$9 = "src\\components\\team\\goals_scored_and_conceded\\ScoredConcededOverTimeGraph.svelte";

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
    			add_location(div0, file$9, 286, 2, 9466);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$9, 285, 0, 9445);
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

    function instance$a($$self, $$props, $$invalidate) {
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<ScoredConcededOverTimeGraph> was created without expected prop 'data'");
    		}

    		if (team === undefined && !('team' in $$props || $$self.$$.bound[$$self.$$.props['team']])) {
    			console.warn("<ScoredConcededOverTimeGraph> was created without expected prop 'team'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<ScoredConcededOverTimeGraph> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'team', 'mobileView'];

    	Object_1$4.keys($$props).forEach(key => {
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
    		lines: lines$1,
    		defaultLayout: defaultLayout$1,
    		setDefaultLayout,
    		setMobileLayout,
    		buildPlotData: buildPlotData$1,
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
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { data: 1, team: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScoredConcededOverTimeGraph",
    			options,
    			id: create_fragment$a.name
    		});
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

    const url = "https://pldashboard-backend.vercel.app/api";

    /* src\routes\Dashboard.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$3, console: console_1$2, document: document_1$2, window: window_1$1 } = globals;
    const file$8 = "src\\routes\\Dashboard.svelte";

    // (175:4) {:else}
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
    			attr_dev(button, "class", "svelte-1y2ntyl");
    			add_location(button, file$8, 175, 6, 6498);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", toggleMobileNav$1, false, false, false, false);
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
    		source: "(175:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (172:4) {#if teams.length === 0}
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
    			attr_dev(button, "class", "svelte-1y2ntyl");
    			add_location(button, file$8, 173, 6, 6407);
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
    		source: "(172:4) {#if teams.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (349:6) {:else}
    function create_else_block_1$2(ctx) {
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
    			add_location(div0, file$8, 350, 10, 12602);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$8, 349, 8, 12551);
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
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(349:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (190:6) {#if data != undefined}
    function create_if_block$4(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let t;
    	let footer;
    	let current;
    	const if_block_creators = [create_if_block_1$2, create_else_block$3];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*slug*/ ctx[0] === 'overview') return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	footer = new Footer({
    			props: { lastUpdated: /*data*/ ctx[9].lastUpdated },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			if_block.c();
    			t = space();
    			create_component(footer.$$.fragment);
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			t = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(footer, target, anchor);
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
    				if_block.m(t.parentNode, t);
    			}

    			const footer_changes = {};
    			if (dirty & /*data*/ 512) footer_changes.lastUpdated = /*data*/ ctx[9].lastUpdated;
    			footer.$set(footer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(190:6) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (193:8) {:else}
    function create_else_block$3(ctx) {
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
    				hyphenatedTeam: /*slug*/ ctx[0],
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
    			attr_dev(circle0, "fill", circle0_fill_value = "var(--" + /*slug*/ ctx[0] + "-secondary)");
    			add_location(circle0, file$8, 198, 20, 7363);
    			attr_dev(circle1, "cx", "170");
    			attr_dev(circle1, "cy", "170");
    			attr_dev(circle1, "r", "140");
    			attr_dev(circle1, "stroke-width", "0");
    			attr_dev(circle1, "fill", circle1_fill_value = "var(--" + /*slug*/ ctx[0] + ")");
    			add_location(circle1, file$8, 205, 20, 7605);
    			attr_dev(circle2, "cx", "300");
    			attr_dev(circle2, "cy", "320");
    			attr_dev(circle2, "r", "170");
    			attr_dev(circle2, "stroke-width", "0");
    			attr_dev(circle2, "fill", circle2_fill_value = "var(--" + /*slug*/ ctx[0] + ")");
    			add_location(circle2, file$8, 212, 20, 7837);
    			attr_dev(svg, "class", "circles-background svelte-1y2ntyl");
    			add_location(svg, file$8, 197, 18, 7309);
    			attr_dev(div0, "class", "circles-background-container svelte-1y2ntyl");
    			add_location(div0, file$8, 196, 16, 7247);
    			attr_dev(div1, "class", "position-central svelte-1y2ntyl");
    			add_location(div1, file$8, 221, 16, 8115);
    			attr_dev(div2, "class", "row-left position-no-badge svelte-1y2ntyl");
    			add_location(div2, file$8, 195, 14, 7189);
    			attr_dev(h10, "class", "lowered svelte-1y2ntyl");
    			add_location(h10, file$8, 226, 16, 8334);
    			attr_dev(div3, "class", "graph mini-graph mobile-margin");
    			add_location(div3, file$8, 227, 16, 8385);
    			attr_dev(div4, "class", "row-right fixtures-graph row-graph svelte-1y2ntyl");
    			add_location(div4, file$8, 225, 14, 8268);
    			attr_dev(div5, "class", "row multi-element-row small-bottom-margin svelte-1y2ntyl");
    			add_location(div5, file$8, 194, 12, 7118);
    			attr_dev(div6, "class", "row-left form-details svelte-1y2ntyl");
    			add_location(div6, file$8, 234, 14, 8626);
    			attr_dev(div7, "class", "row-right svelte-1y2ntyl");
    			add_location(div7, file$8, 243, 14, 8940);
    			attr_dev(div8, "class", "row multi-element-row svelte-1y2ntyl");
    			add_location(div8, file$8, 233, 12, 8575);
    			attr_dev(h11, "class", "lowered svelte-1y2ntyl");
    			add_location(h11, file$8, 250, 16, 9163);
    			attr_dev(div9, "class", "graph full-row-graph svelte-1y2ntyl");
    			add_location(div9, file$8, 251, 16, 9210);
    			attr_dev(div10, "class", "form-graph row-graph svelte-1y2ntyl");
    			add_location(div10, file$8, 249, 14, 9111);
    			attr_dev(div11, "class", "row svelte-1y2ntyl");
    			add_location(div11, file$8, 248, 12, 9078);
    			attr_dev(div12, "class", "page-content svelte-1y2ntyl");
    			add_location(div12, file$8, 193, 10, 7078);
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
    			if (!current || dirty & /*slug*/ 1 && circle0_fill_value !== (circle0_fill_value = "var(--" + /*slug*/ ctx[0] + "-secondary)")) {
    				attr_dev(circle0, "fill", circle0_fill_value);
    			}

    			if (!current || dirty & /*slug*/ 1 && circle1_fill_value !== (circle1_fill_value = "var(--" + /*slug*/ ctx[0] + ")")) {
    				attr_dev(circle1, "fill", circle1_fill_value);
    			}

    			if (!current || dirty & /*slug*/ 1 && circle2_fill_value !== (circle2_fill_value = "var(--" + /*slug*/ ctx[0] + ")")) {
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
    			if (dirty & /*slug*/ 1) tablesnippet_changes.hyphenatedTeam = /*slug*/ ctx[0];
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
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(193:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (191:8) {#if slug === 'overview'}
    function create_if_block_1$2(ctx) {
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
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(191:8) {#if slug === 'overview'}",
    		ctx
    	});

    	return block;
    }

    // (264:12) {#if load}
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
    			t6 = text("Goals Per Game");
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
    			t12 = text("Scorelines");
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
    			t6 = claim_text(h12_nodes, "Goals Per Game");
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
    			t12 = claim_text(h13_nodes, "Scorelines");
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
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h10, "class", "lowered svelte-1y2ntyl");
    			add_location(h10, file$8, 266, 18, 9682);
    			attr_dev(div0, "class", "graph full-row-graph svelte-1y2ntyl");
    			add_location(div0, file$8, 267, 18, 9735);
    			attr_dev(div1, "class", "position-over-time-graph row-graph svelte-1y2ntyl");
    			add_location(div1, file$8, 265, 16, 9614);
    			attr_dev(div2, "class", "row svelte-1y2ntyl");
    			add_location(div2, file$8, 264, 14, 9579);
    			attr_dev(h11, "class", "lowered svelte-1y2ntyl");
    			add_location(h11, file$8, 275, 18, 10036);
    			attr_dev(div3, "class", "graph full-row-graph svelte-1y2ntyl");
    			add_location(div3, file$8, 276, 18, 10087);
    			attr_dev(div4, "class", "position-over-time-graph row-graph svelte-1y2ntyl");
    			add_location(div4, file$8, 274, 16, 9968);
    			attr_dev(div5, "class", "row svelte-1y2ntyl");
    			add_location(div5, file$8, 273, 14, 9933);
    			attr_dev(h12, "class", "lowered svelte-1y2ntyl");
    			add_location(h12, file$8, 284, 18, 10409);
    			attr_dev(div6, "class", "graph full-row-graph svelte-1y2ntyl");
    			add_location(div6, file$8, 285, 18, 10468);
    			attr_dev(div7, "class", "goals-scored-vs-conceded-graph row-graph svelte-1y2ntyl");
    			add_location(div7, file$8, 283, 16, 10335);
    			attr_dev(div8, "class", "row no-bottom-margin svelte-1y2ntyl");
    			add_location(div8, file$8, 282, 14, 10283);
    			attr_dev(div9, "class", "clean-sheets graph full-row-graph svelte-1y2ntyl");
    			add_location(div9, file$8, 298, 18, 10877);
    			attr_dev(div10, "class", "row-graph svelte-1y2ntyl");
    			add_location(div10, file$8, 297, 16, 10834);
    			attr_dev(div11, "class", "row svelte-1y2ntyl");
    			add_location(div11, file$8, 296, 14, 10799);
    			attr_dev(div12, "class", "season-stats-row svelte-1y2ntyl");
    			add_location(div12, file$8, 309, 14, 11210);
    			attr_dev(div13, "class", "graph full-row-graph svelte-1y2ntyl");
    			add_location(div13, file$8, 315, 18, 11405);
    			attr_dev(div14, "class", "row-graph svelte-1y2ntyl");
    			add_location(div14, file$8, 314, 16, 11362);
    			attr_dev(div15, "class", "row svelte-1y2ntyl");
    			add_location(div15, file$8, 313, 14, 11327);
    			add_location(h13, file$8, 323, 18, 11702);
    			attr_dev(div16, "class", "goals-freq-row row-graph svelte-1y2ntyl");
    			add_location(div16, file$8, 322, 16, 11644);
    			attr_dev(div17, "class", "row svelte-1y2ntyl");
    			add_location(div17, file$8, 321, 14, 11609);
    			attr_dev(div18, "class", "score-freq graph svelte-1y2ntyl");
    			add_location(div18, file$8, 330, 18, 11926);
    			attr_dev(div19, "class", "row-graph svelte-1y2ntyl");
    			add_location(div19, file$8, 329, 16, 11883);
    			attr_dev(div20, "class", "row svelte-1y2ntyl");
    			add_location(div20, file$8, 328, 14, 11848);
    			add_location(h14, file$8, 338, 18, 12212);
    			attr_dev(div21, "class", "spider-chart-container svelte-1y2ntyl");
    			add_location(div21, file$8, 339, 18, 12256);
    			attr_dev(div22, "class", "spider-chart-row row-graph svelte-1y2ntyl");
    			add_location(div22, file$8, 337, 16, 12152);
    			attr_dev(div23, "class", "row svelte-1y2ntyl");
    			add_location(div23, file$8, 336, 14, 12117);
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
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(264:12) {#if load}",
    		ctx
    	});

    	return block;
    }

    // (162:0) <Router>
    function create_default_slot$5(ctx) {
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

    	let t3_value = (/*team*/ ctx[5] == '' || /*team*/ ctx[5] == 'Overview'
    	? /*team*/ ctx[5]
    	: toAlias(/*team*/ ctx[5])) + "";

    	let t3;
    	let a_href_value;
    	let t4;
    	let current_block_type_index;
    	let if_block1;
    	let current;

    	nav = new Nav({
    			props: {
    				team: /*slug*/ ctx[0],
    				teams: /*teams*/ ctx[6],
    				toAlias,
    				switchTeam: /*switchTeam*/ ctx[11]
    			},
    			$$inline: true
    		});

    	mobilenav = new MobileNav({
    			props: {
    				hyphenatedTeam: /*slug*/ ctx[0],
    				teams: /*teams*/ ctx[6],
    				toAlias,
    				switchTeam: /*switchTeam*/ ctx[11],
    				toggleMobileNav: toggleMobileNav$1
    			},
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*teams*/ ctx[6].length === 0) return create_if_block_3$1;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	const if_block_creators = [create_if_block$4, create_else_block_1$2];
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
    			attr_dev(div0, "class", "title svelte-1y2ntyl");
    			set_style(div0, "color", "var(--" + (/*slug*/ ctx[0] + '-secondary') + ")");
    			add_location(div0, file$8, 183, 10, 6769);
    			attr_dev(a, "class", "main-link no-decoration svelte-1y2ntyl");
    			attr_dev(a, "href", a_href_value = "/" + /*slug*/ ctx[0]);
    			add_location(a, file$8, 182, 8, 6707);
    			attr_dev(div1, "class", "header svelte-1y2ntyl");
    			set_style(div1, "background-color", "var(--" + /*slug*/ ctx[0] + ")");
    			add_location(div1, file$8, 181, 6, 6636);
    			attr_dev(div2, "id", "dashboard");
    			attr_dev(div2, "class", "svelte-1y2ntyl");
    			add_location(div2, file$8, 180, 4, 6608);
    			attr_dev(div3, "id", "team");
    			attr_dev(div3, "class", "svelte-1y2ntyl");
    			add_location(div3, file$8, 162, 2, 6103);
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
    			if (dirty & /*slug*/ 1) nav_changes.team = /*slug*/ ctx[0];
    			if (dirty & /*teams*/ 64) nav_changes.teams = /*teams*/ ctx[6];
    			nav.$set(nav_changes);
    			const mobilenav_changes = {};
    			if (dirty & /*slug*/ 1) mobilenav_changes.hyphenatedTeam = /*slug*/ ctx[0];
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

    			if ((!current || dirty & /*team*/ 32) && t3_value !== (t3_value = (/*team*/ ctx[5] == '' || /*team*/ ctx[5] == 'Overview'
    			? /*team*/ ctx[5]
    			: toAlias(/*team*/ ctx[5])) + "")) set_data_dev(t3, t3_value);

    			if (!current || dirty & /*slug*/ 1) {
    				set_style(div0, "color", "var(--" + (/*slug*/ ctx[0] + '-secondary') + ")");
    			}

    			if (!current || dirty & /*slug*/ 1 && a_href_value !== (a_href_value = "/" + /*slug*/ ctx[0])) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (!current || dirty & /*slug*/ 1) {
    				set_style(div1, "background-color", "var(--" + /*slug*/ ctx[0] + ")");
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
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(162:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
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
    	document_1$2.title = title_value = /*title*/ ctx[4];

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
    			const head_nodes = head_selector('svelte-1b9t1l7', document_1$2.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$8, 156, 2, 5932);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1$2.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1$1, "resize", /*onwindowresize*/ ctx[12]),
    					listen_dev(window_1$1, "scroll", () => {
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
    				scrollTo(window_1$1.pageXOffset, /*y*/ ctx[1]);
    				scrolling_timeout = setTimeout(clear_scrolling, 100);
    			}

    			if ((!current || dirty & /*title*/ 16) && title_value !== (title_value = /*title*/ ctx[4])) {
    				document_1$2.title = title_value;
    			}

    			const router_changes = {};

    			if (dirty & /*$$scope, data, slug, team, teams, mobileView, playedDates, load, currentMatchday*/ 264169) {
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
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$9($$self, $$props, $$invalidate) {
    	let mobileView;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Dashboard', slots, []);

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
    			$$invalidate(5, team = 'Overview');
    			$$invalidate(4, title = 'Dashboard | Overview');
    		} else if (slug != null) {
    			$$invalidate(0, slug = slugAlias(slug));
    			$$invalidate(5, team = toTitleCase(slug.replace(/\-/g, ' ')));
    			$$invalidate(4, title = `Dashboard | ${team}`);
    		}

    		const response = await fetch(`${url}/teams`);

    		if (!response.ok) {
    			return;
    		}

    		let json = await response.json();
    		$$invalidate(6, teams = Object.keys(json.standings));

    		if (slug === null) {
    			// If root, set team to current leader
    			$$invalidate(5, team = teams[0]);

    			$$invalidate(4, title = `Dashboard | ${team}`);
    			$$invalidate(0, slug = toHyphenatedName(team));

    			// Change url to /team-name without reloading page
    			history.pushState({}, null, window.location.href + slug);
    		} else if (team != 'Overview' && team != '' && !teams.includes(team)) {
    			window.location.href = '/error';
    		}

    		if (team != 'Overview' && team != '') {
    			$$invalidate(7, currentMatchday$1 = currentMatchday(json, team));
    			$$invalidate(8, playedDates = playedMatchdayDates(json, team));
    		}

    		$$invalidate(9, data = json);
    		console.log(data);
    		window.dispatchEvent(new Event('resize')); // Snap plots to currently set size
    	}

    	function switchTeam(newTeam) {
    		$$invalidate(0, slug = newTeam);

    		if (slug === 'overview') {
    			$$invalidate(5, team = 'Overview');
    			$$invalidate(4, title = 'Dashboard | Overview');
    		} else {
    			$$invalidate(0, slug = slugAlias(slug));
    			$$invalidate(5, team = toTitleCase(slug.replace(/\-/g, ' ')));
    			$$invalidate(4, title = `Dashboard | ${team}`);

    			// Overwrite values from new team's perspective using same data
    			$$invalidate(7, currentMatchday$1 = currentMatchday(data, team));

    			$$invalidate(8, playedDates = playedMatchdayDates(data, team));
    		}

    		window.history.pushState(null, null, slug); // Change current url without reloading
    	}

    	function lazyLoad() {
    		$$invalidate(3, load = true);
    		window.dispatchEvent(new Event('resize')); // Snap plots to currently set size
    	}

    	let y;
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

    	$$self.$$.on_mount.push(function () {
    		if (slug === undefined && !('slug' in $$props || $$self.$$.bound[$$self.$$.props['slug']])) {
    			console_1$2.warn("<Dashboard> was created without expected prop 'slug'");
    		}
    	});

    	const writable_props = ['slug'];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(2, pageWidth = window_1$1.innerWidth);
    	}

    	function onwindowscroll() {
    		$$invalidate(1, y = window_1$1.pageYOffset);
    	}

    	function formovertimegraph_lazyLoad_binding(value) {
    		load = value;
    		$$invalidate(3, load);
    	}

    	$$self.$$set = $$props => {
    		if ('slug' in $$props) $$invalidate(0, slug = $$props.slug);
    	};

    	$$self.$capture_state = () => ({
    		Router,
    		onMount,
    		CurrentForm,
    		TableSnippet,
    		NextGame,
    		StatsValues,
    		Footer,
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
    		toTitleCase,
    		url,
    		toggleMobileNav: toggleMobileNav$1,
    		playedMatchdayDates,
    		initDashboard,
    		slugAlias,
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
    		slug,
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
    		if ('slug' in $$props) $$invalidate(0, slug = $$props.slug);
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
    		slug,
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
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { slug: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get slug() {
    		throw new Error("<Dashboard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set slug(value) {
    		throw new Error("<Dashboard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\routes\Home.svelte generated by Svelte v3.59.2 */
    const file$7 = "src\\routes\\Home.svelte";

    // (9:0) <Router>
    function create_default_slot$4(ctx) {
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
    			attr_dev(div0, "class", "svelte-yx1mpi");
    			add_location(div0, file$7, 11, 6, 288);
    			if (!src_url_equal(img.src, img_src_value = "img/pldashboard5.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pldashboard");
    			attr_dev(img, "class", "svelte-yx1mpi");
    			add_location(img, file$7, 12, 6, 315);
    			attr_dev(a0, "class", "dashboard-link svelte-yx1mpi");
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$7, 14, 8, 404);
    			attr_dev(a1, "class", "fantasy-link svelte-yx1mpi");
    			attr_dev(a1, "href", "/fantasy");
    			add_location(a1, file$7, 15, 8, 462);
    			attr_dev(div1, "class", "links svelte-yx1mpi");
    			add_location(div1, file$7, 13, 6, 375);
    			attr_dev(div2, "class", "content svelte-yx1mpi");
    			add_location(div2, file$7, 10, 4, 259);
    			attr_dev(div3, "id", "home");
    			attr_dev(div3, "class", "svelte-yx1mpi");
    			add_location(div3, file$7, 9, 2, 238);
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
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(9:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
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
    			const head_nodes = head_selector('svelte-96hcuw', document.head);
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
    			add_location(meta, file$7, 5, 2, 133);
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
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src\routes\Predictions.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1, document: document_1$1 } = globals;
    const file$6 = "src\\routes\\Predictions.svelte";

    function get_each_context$2(ctx, list, i) {
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

    // (172:4) {:else}
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
    			add_location(div0, file$6, 173, 8, 6319);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$6, 172, 6, 6270);
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
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(172:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (93:4) {#if data != undefined}
    function create_if_block$3(ctx) {
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
    	let if_block = /*data*/ ctx[0].predictions != null && create_if_block_1$1(ctx);

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
    			add_location(b0, file$6, 97, 40, 3109);
    			attr_dev(span, "class", "accuracy-item svelte-g2t46v");
    			add_location(span, file$6, 96, 12, 3039);
    			add_location(br, file$6, 100, 13, 3220);
    			add_location(b1, file$6, 102, 40, 3309);
    			attr_dev(div0, "class", "accuracy-item svelte-g2t46v");
    			add_location(div0, file$6, 101, 12, 3240);
    			attr_dev(div1, "class", "accuracy svelte-g2t46v");
    			add_location(div1, file$6, 95, 10, 3003);
    			attr_dev(div2, "class", "accuracy-display svelte-g2t46v");
    			add_location(div2, file$6, 94, 8, 2961);
    			attr_dev(div3, "class", "predictions svelte-g2t46v");
    			add_location(div3, file$6, 110, 10, 3513);
    			attr_dev(div4, "class", "predictions-container svelte-g2t46v");
    			add_location(div4, file$6, 109, 8, 3466);
    			attr_dev(div5, "class", "page-content svelte-g2t46v");
    			add_location(div5, file$6, 93, 6, 2925);
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
    					if_block = create_if_block_1$1(ctx);
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
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(93:4) {#if data != undefined}",
    		ctx
    	});

    	return block;
    }

    // (112:12) {#if data.predictions != null}
    function create_if_block_1$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*data*/ ctx[0].predictions;
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
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_hydration_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data, toggleDetailsDisplay, datetimeToTime, Math*/ 1) {
    				each_value = /*data*/ ctx[0].predictions;
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
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(112:12) {#if data.predictions != null}",
    		ctx
    	});

    	return block;
    }

    // (147:20) {:else}
    function create_else_block$2(ctx) {
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
    			attr_dev(div, "class", "prediction-time svelte-g2t46v");
    			add_location(div, file$6, 147, 22, 5396);
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
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(147:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (136:20) {#if pred.actual != null}
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
    			attr_dev(div0, "class", "prediction-label svelte-g2t46v");
    			add_location(div0, file$6, 137, 24, 4855);
    			attr_dev(div1, "class", "prediction-initials svelte-g2t46v");
    			add_location(div1, file$6, 139, 26, 4982);
    			attr_dev(div2, "class", "prediction-score svelte-g2t46v");
    			add_location(div2, file$6, 140, 26, 5060);
    			attr_dev(div3, "class", "prediction-initials svelte-g2t46v");
    			add_location(div3, file$6, 143, 26, 5231);
    			attr_dev(div4, "class", "prediction-value svelte-g2t46v");
    			add_location(div4, file$6, 138, 24, 4924);
    			attr_dev(div5, "class", "actual prediction-item svelte-g2t46v");
    			add_location(div5, file$6, 136, 22, 4793);
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
    		source: "(136:20) {#if pred.actual != null}",
    		ctx
    	});

    	return block;
    }

    // (154:20) {#if pred.prediction != null}
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
    			add_location(b, file$6, 156, 26, 5813);
    			attr_dev(div0, "class", "detailed-predicted-score svelte-g2t46v");
    			add_location(div0, file$6, 155, 24, 5747);
    			attr_dev(div1, "class", "prediction-details svelte-g2t46v");
    			attr_dev(div1, "id", div1_id_value = /*pred*/ ctx[7]._id);
    			add_location(div1, file$6, 154, 22, 5675);
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
    		source: "(154:20) {#if pred.prediction != null}",
    		ctx
    	});

    	return block;
    }

    // (119:16) {#each predictions as pred}
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
    		return create_else_block$2;
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
    			attr_dev(div0, "class", "prediction-label svelte-g2t46v");
    			add_location(div0, file$6, 124, 22, 4157);
    			attr_dev(div1, "class", "prediction-initials svelte-g2t46v");
    			add_location(div1, file$6, 126, 24, 4283);
    			attr_dev(div2, "class", "prediction-score svelte-g2t46v");
    			add_location(div2, file$6, 127, 24, 4359);
    			attr_dev(div3, "class", "prediction-initials svelte-g2t46v");
    			add_location(div3, file$6, 132, 24, 4614);
    			attr_dev(div4, "class", "prediction-value svelte-g2t46v");
    			add_location(div4, file$6, 125, 22, 4227);
    			attr_dev(div5, "class", "prediction prediction-item svelte-g2t46v");
    			add_location(div5, file$6, 123, 20, 4093);
    			attr_dev(button, "class", button_class_value = "prediction-container " + /*pred*/ ctx[7].colour + " svelte-g2t46v");
    			add_location(button, file$6, 119, 18, 3910);
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
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
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

    			if (dirty & /*data*/ 1 && button_class_value !== (button_class_value = "prediction-container " + /*pred*/ ctx[7].colour + " svelte-g2t46v")) {
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
    		source: "(119:16) {#each predictions as pred}",
    		ctx
    	});

    	return block;
    }

    // (113:14) {#each data.predictions as { _id, predictions }}
    function create_each_block$2(ctx) {
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
    			attr_dev(div0, "class", "date svelte-g2t46v");
    			add_location(div0, file$6, 113, 16, 3664);
    			attr_dev(div1, "class", "medium-predictions-divider svelte-g2t46v");
    			add_location(div1, file$6, 116, 16, 3749);
    			attr_dev(div2, "class", "predictions-gap svelte-g2t46v");
    			add_location(div2, file$6, 165, 16, 6128);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, t0);
    			insert_hydration_dev(target, t1, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			insert_hydration_dev(target, t2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
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
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(113:14) {#each data.predictions as { _id, predictions }}",
    		ctx
    	});

    	return block;
    }

    // (87:0) <Router>
    function create_default_slot$3(ctx) {
    	let div1;
    	let div0;
    	let a;
    	let t0;
    	let t1;

    	function select_block_type(ctx, dirty) {
    		if (/*data*/ ctx[0] != undefined) return create_if_block$3;
    		return create_else_block_1$1;
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
    			attr_dev(a, "class", "predictions-title svelte-g2t46v");
    			attr_dev(a, "href", "/predictions");
    			add_location(a, file$6, 89, 6, 2810);
    			attr_dev(div0, "class", "predictions-header svelte-g2t46v");
    			add_location(div0, file$6, 88, 4, 2770);
    			attr_dev(div1, "id", "predictions");
    			attr_dev(div1, "class", "svelte-g2t46v");
    			add_location(div1, file$6, 87, 2, 2742);
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
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(87:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
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
    			const head_nodes = head_selector('svelte-1w56yuh', document_1$1.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			document_1$1.title = "Predictions";
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Premier League Statistics Dashboard");
    			add_location(meta, file$6, 83, 2, 2637);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1$1.head, meta);
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
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function toggleDetailsDisplay(id) {
    	let prediction = document.getElementById(id);

    	if (prediction != null) {
    		prediction.classList.toggle('expanded');
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

    function instance$7($$self, $$props, $$invalidate) {
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
    		$$invalidate(0, data = json);
    		console.log(data);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Predictions> was created with unknown prop '${key}'`);
    	});

    	const click_handler = pred => toggleDetailsDisplay(pred._id);

    	$$self.$capture_state = () => ({
    		Router,
    		onMount,
    		identicalScore,
    		sameResult,
    		url,
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
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Predictions",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src\components\nav\FantasyNav.svelte generated by Svelte v3.59.2 */

    const file$5 = "src\\components\\nav\\FantasyNav.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	child_ctx[6] = i;
    	return child_ctx;
    }

    // (29:6) {:else}
    function create_else_block$1(ctx) {
    	let button;
    	let div1;
    	let div0;
    	let t0_value = /*_page*/ ctx[4][0].toUpperCase() + /*_page*/ ctx[4].slice(1) + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[3](/*_page*/ ctx[4]);
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
    			attr_dev(div0, "class", "team-name svelte-1esiuxe");
    			add_location(div0, file$5, 36, 12, 1117);
    			attr_dev(div1, "class", "team-container svelte-1esiuxe");
    			add_location(div1, file$5, 35, 10, 1075);
    			attr_dev(button, "class", "team-link svelte-1esiuxe");
    			add_location(button, file$5, 29, 8, 941);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*pages*/ 2 && t0_value !== (t0_value = /*_page*/ ctx[4][0].toUpperCase() + /*_page*/ ctx[4].slice(1) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(29:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (18:6) {#if _page === currentPage}
    function create_if_block$2(ctx) {
    	let a;
    	let div1;
    	let div0;
    	let t0_value = /*_page*/ ctx[4][0].toUpperCase() + /*_page*/ ctx[4].slice(1) + "";
    	let t0;
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
    			div1 = claim_element(a_nodes, "DIV", { class: true });
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
    			attr_dev(div0, "class", "this-team-name svelte-1esiuxe");
    			add_location(div0, file$5, 23, 12, 779);
    			attr_dev(div1, "class", "this-team-container svelte-1esiuxe");
    			add_location(div1, file$5, 22, 10, 732);
    			attr_dev(a, "href", a_href_value = "/fantasy" + (/*_page*/ ctx[4] === 'all' ? '' : '/' + /*_page*/ ctx[4]));
    			attr_dev(a, "class", "team-link");
    			add_location(a, file$5, 18, 8, 615);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(a, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pages*/ 2 && t0_value !== (t0_value = /*_page*/ ctx[4][0].toUpperCase() + /*_page*/ ctx[4].slice(1) + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*pages*/ 2 && a_href_value !== (a_href_value = "/fantasy" + (/*_page*/ ctx[4] === 'all' ? '' : '/' + /*_page*/ ctx[4]))) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(18:6) {#if _page === currentPage}",
    		ctx
    	});

    	return block;
    }

    // (17:4) {#each pages as _page, _ (_page)}
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*_page*/ ctx[4] === /*currentPage*/ ctx[0]) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
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
    			if (detaching) detach_dev(first);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(17:4) {#each pages as _page, _ (_page)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let nav;
    	let div1;
    	let p;
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let div0;
    	let t3;
    	let t4;
    	let div2;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t5;
    	let div3;
    	let button;
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;
    	let each_value = /*pages*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*_page*/ ctx[4];
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div1 = element("div");
    			p = element("p");
    			span = element("span");
    			t0 = text("pl");
    			t1 = text("dashboard");
    			t2 = space();
    			div0 = element("div");
    			t3 = text("Fantasy");
    			t4 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t5 = space();
    			div3 = element("div");
    			button = element("button");
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav = claim_element(nodes, "NAV", { id: true, class: true });
    			var nav_nodes = children(nav);
    			div1 = claim_element(nav_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			p = claim_element(div1_nodes, "P", {});
    			var p_nodes = children(p);
    			span = claim_element(p_nodes, "SPAN", { style: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "pl");
    			span_nodes.forEach(detach_dev);
    			t1 = claim_text(p_nodes, "dashboard");
    			p_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t3 = claim_text(div0_nodes, "Fantasy");
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t4 = claim_space(nav_nodes);
    			div2 = claim_element(nav_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div2_nodes);
    			}

    			div2_nodes.forEach(detach_dev);
    			t5 = claim_space(nav_nodes);
    			div3 = claim_element(nav_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			button = claim_element(div3_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			img = claim_element(button_nodes, "IMG", { src: true, alt: true, class: true });
    			button_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			nav_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_style(span, "color", "var(--green)");
    			add_location(span, file$5, 11, 6, 386);
    			add_location(p, file$5, 10, 4, 375);
    			attr_dev(div0, "class", "fantasy-logo svelte-1esiuxe");
    			add_location(div0, file$5, 13, 4, 454);
    			attr_dev(div1, "class", "title no-selection svelte-1esiuxe");
    			add_location(div1, file$5, 9, 2, 337);
    			attr_dev(div2, "class", "team-links svelte-1esiuxe");
    			add_location(div2, file$5, 15, 2, 507);
    			if (!src_url_equal(img.src, img_src_value = "img/arrow-bar-left.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-1esiuxe");
    			add_location(img, file$5, 46, 6, 1376);
    			attr_dev(button, "class", "close-btn svelte-1esiuxe");
    			add_location(button, file$5, 45, 4, 1319);
    			attr_dev(div3, "class", "close");
    			add_location(div3, file$5, 44, 2, 1294);
    			attr_dev(nav, "id", "navBar");
    			attr_dev(nav, "class", "svelte-1esiuxe");
    			add_location(nav, file$5, 8, 0, 316);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			append_hydration_dev(nav, div1);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(p, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t3);
    			append_hydration_dev(nav, t4);
    			append_hydration_dev(nav, div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div2, null);
    				}
    			}

    			append_hydration_dev(nav, t5);
    			append_hydration_dev(nav, div3);
    			append_hydration_dev(div3, button);
    			append_hydration_dev(button, img);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", closeNavBar, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*pages, currentPage, switchPage*/ 7) {
    				each_value = /*pages*/ ctx[1];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div2, destroy_block, create_each_block$1, null, get_each_context$1);
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
    		id: create_fragment$6.name,
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

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FantasyNav', slots, []);
    	let { currentPage, pages, switchPage } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (currentPage === undefined && !('currentPage' in $$props || $$self.$$.bound[$$self.$$.props['currentPage']])) {
    			console.warn("<FantasyNav> was created without expected prop 'currentPage'");
    		}

    		if (pages === undefined && !('pages' in $$props || $$self.$$.bound[$$self.$$.props['pages']])) {
    			console.warn("<FantasyNav> was created without expected prop 'pages'");
    		}

    		if (switchPage === undefined && !('switchPage' in $$props || $$self.$$.bound[$$self.$$.props['switchPage']])) {
    			console.warn("<FantasyNav> was created without expected prop 'switchPage'");
    		}
    	});

    	const writable_props = ['currentPage', 'pages', 'switchPage'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FantasyNav> was created with unknown prop '${key}'`);
    	});

    	const click_handler = _page => {
    		switchPage(_page);
    	};

    	$$self.$$set = $$props => {
    		if ('currentPage' in $$props) $$invalidate(0, currentPage = $$props.currentPage);
    		if ('pages' in $$props) $$invalidate(1, pages = $$props.pages);
    		if ('switchPage' in $$props) $$invalidate(2, switchPage = $$props.switchPage);
    	};

    	$$self.$capture_state = () => ({
    		closeNavBar,
    		currentPage,
    		pages,
    		switchPage
    	});

    	$$self.$inject_state = $$props => {
    		if ('currentPage' in $$props) $$invalidate(0, currentPage = $$props.currentPage);
    		if ('pages' in $$props) $$invalidate(1, pages = $$props.pages);
    		if ('switchPage' in $$props) $$invalidate(2, switchPage = $$props.switchPage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [currentPage, pages, switchPage, click_handler];
    }

    class FantasyNav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { currentPage: 0, pages: 1, switchPage: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FantasyNav",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get currentPage() {
    		throw new Error("<FantasyNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentPage(value) {
    		throw new Error("<FantasyNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pages() {
    		throw new Error("<FantasyNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pages(value) {
    		throw new Error("<FantasyNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get switchPage() {
    		throw new Error("<FantasyNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchPage(value) {
    		throw new Error("<FantasyNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\nav\FantasyMobileNav.svelte generated by Svelte v3.59.2 */

    const file$4 = "src\\components\\nav\\FantasyMobileNav.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (10:2) {#if pages != undefined}
    function create_if_block$1(ctx) {
    	let div;
    	let each_value = /*pages*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
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
    			attr_dev(div, "class", "team-links svelte-1my4j6l");
    			add_location(div, file$4, 10, 4, 277);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pages, switchTeamToTop*/ 3) {
    				each_value = /*pages*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
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
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(10:2) {#if pages != undefined}",
    		ctx
    	});

    	return block;
    }

    // (12:6) {#each pages as page, i}
    function create_each_block(ctx) {
    	let button;
    	let t_value = /*pages*/ ctx[0][/*i*/ ctx[8]][0].toUpperCase() + /*pages*/ ctx[0][/*i*/ ctx[8]].slice(1) + "";
    	let t;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*page*/ ctx[6]);
    	}

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
    			attr_dev(button, "class", button_class_value = "team-link " + /*page*/ ctx[6].toLowerCase() + " svelte-1my4j6l");
    			add_location(button, file$4, 12, 8, 343);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*pages*/ 1 && t_value !== (t_value = /*pages*/ ctx[0][/*i*/ ctx[8]][0].toUpperCase() + /*pages*/ ctx[0][/*i*/ ctx[8]].slice(1) + "")) set_data_dev(t, t_value);

    			if (dirty & /*pages*/ 1 && button_class_value !== (button_class_value = "team-link " + /*page*/ ctx[6].toLowerCase() + " svelte-1my4j6l")) {
    				attr_dev(button, "class", button_class_value);
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
    		id: create_each_block.name,
    		type: "each",
    		source: "(12:6) {#each pages as page, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let nav;
    	let if_block = /*pages*/ ctx[0] != undefined && create_if_block$1(ctx);

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
    			set_style(nav, "width", "0%");
    			attr_dev(nav, "class", "svelte-1my4j6l");
    			add_location(nav, file$4, 8, 0, 204);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			if (if_block) if_block.m(nav, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*pages*/ ctx[0] != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FantasyMobileNav', slots, []);

    	function switchTeamToTop(page) {
    		switchPage(page);
    		window.scrollTo(0, 0);
    		toggleMobileNav();
    	}

    	let { currentPage, pages, switchPage, toggleMobileNav } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (currentPage === undefined && !('currentPage' in $$props || $$self.$$.bound[$$self.$$.props['currentPage']])) {
    			console.warn("<FantasyMobileNav> was created without expected prop 'currentPage'");
    		}

    		if (pages === undefined && !('pages' in $$props || $$self.$$.bound[$$self.$$.props['pages']])) {
    			console.warn("<FantasyMobileNav> was created without expected prop 'pages'");
    		}

    		if (switchPage === undefined && !('switchPage' in $$props || $$self.$$.bound[$$self.$$.props['switchPage']])) {
    			console.warn("<FantasyMobileNav> was created without expected prop 'switchPage'");
    		}

    		if (toggleMobileNav === undefined && !('toggleMobileNav' in $$props || $$self.$$.bound[$$self.$$.props['toggleMobileNav']])) {
    			console.warn("<FantasyMobileNav> was created without expected prop 'toggleMobileNav'");
    		}
    	});

    	const writable_props = ['currentPage', 'pages', 'switchPage', 'toggleMobileNav'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FantasyMobileNav> was created with unknown prop '${key}'`);
    	});

    	const click_handler = page => {
    		switchTeamToTop(page);
    	};

    	$$self.$$set = $$props => {
    		if ('currentPage' in $$props) $$invalidate(2, currentPage = $$props.currentPage);
    		if ('pages' in $$props) $$invalidate(0, pages = $$props.pages);
    		if ('switchPage' in $$props) $$invalidate(3, switchPage = $$props.switchPage);
    		if ('toggleMobileNav' in $$props) $$invalidate(4, toggleMobileNav = $$props.toggleMobileNav);
    	};

    	$$self.$capture_state = () => ({
    		switchTeamToTop,
    		currentPage,
    		pages,
    		switchPage,
    		toggleMobileNav
    	});

    	$$self.$inject_state = $$props => {
    		if ('currentPage' in $$props) $$invalidate(2, currentPage = $$props.currentPage);
    		if ('pages' in $$props) $$invalidate(0, pages = $$props.pages);
    		if ('switchPage' in $$props) $$invalidate(3, switchPage = $$props.switchPage);
    		if ('toggleMobileNav' in $$props) $$invalidate(4, toggleMobileNav = $$props.toggleMobileNav);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		pages,
    		switchTeamToTop,
    		currentPage,
    		switchPage,
    		toggleMobileNav,
    		click_handler
    	];
    }

    class FantasyMobileNav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			currentPage: 2,
    			pages: 0,
    			switchPage: 3,
    			toggleMobileNav: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FantasyMobileNav",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get currentPage() {
    		throw new Error("<FantasyMobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentPage(value) {
    		throw new Error("<FantasyMobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pages() {
    		throw new Error("<FantasyMobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pages(value) {
    		throw new Error("<FantasyMobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get switchPage() {
    		throw new Error("<FantasyMobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set switchPage(value) {
    		throw new Error("<FantasyMobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toggleMobileNav() {
    		throw new Error("<FantasyMobileNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toggleMobileNav(value) {
    		throw new Error("<FantasyMobileNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\fantasy\PointsVsPrice.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$2 } = globals;
    const file$3 = "src\\components\\fantasy\\PointsVsPrice.svelte";

    function create_fragment$4(ctx) {
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
    			add_location(div0, file$3, 175, 2, 5305);
    			attr_dev(div1, "id", "plotly");
    			add_location(div1, file$3, 174, 0, 5284);
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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PointsVsPrice', slots, []);

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
    		$$invalidate(4, setup = true);
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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<PointsVsPrice> was created without expected prop 'data'");
    		}

    		if (page === undefined && !('page' in $$props || $$self.$$.bound[$$self.$$.props['page']])) {
    			console.warn("<PointsVsPrice> was created without expected prop 'page'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<PointsVsPrice> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'page', 'mobileView'];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<PointsVsPrice> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			plotDiv = $$value;
    			$$invalidate(0, plotDiv);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('page' in $$props) $$invalidate(2, page = $$props.page);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getColours,
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
    		page,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('plotDiv' in $$props) $$invalidate(0, plotDiv = $$props.plotDiv);
    		if ('plotData' in $$props) plotData = $$props.plotData;
    		if ('setup' in $$props) $$invalidate(4, setup = $$props.setup);
    		if ('data' in $$props) $$invalidate(1, data = $$props.data);
    		if ('page' in $$props) $$invalidate(2, page = $$props.page);
    		if ('mobileView' in $$props) $$invalidate(3, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*page*/ 4) {
    			page && refreshPlot();
    		}

    		if ($$self.$$.dirty & /*mobileView*/ 8) {
    			!mobileView && setDefaultLayout();
    		}

    		if ($$self.$$.dirty & /*setup, mobileView*/ 24) {
    			setup && mobileView && setMobileLayout();
    		}
    	};

    	return [plotDiv, data, page, mobileView, setup, div0_binding];
    }

    class PointsVsPrice extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { data: 1, page: 2, mobileView: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PointsVsPrice",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get data() {
    		throw new Error("<PointsVsPrice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<PointsVsPrice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get page() {
    		throw new Error("<PointsVsPrice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set page(value) {
    		throw new Error("<PointsVsPrice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<PointsVsPrice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<PointsVsPrice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\fantasy\Table.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$1 } = globals;
    const file$2 = "src\\components\\fantasy\\Table.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let table_1;
    	let thead;
    	let tr;
    	let th0;
    	let t0;
    	let t1;
    	let th1;
    	let t2;
    	let t3;
    	let th2;
    	let t4;
    	let t5;
    	let th3;
    	let t6;
    	let t7;
    	let th4;
    	let t8;
    	let t9;
    	let th5;
    	let t10;
    	let t11;
    	let th6;
    	let t12;
    	let t13;
    	let th7;
    	let t14;
    	let t15;
    	let th8;
    	let t16;
    	let t17;
    	let th9;
    	let t18;
    	let t19;
    	let th10;
    	let t20;
    	let t21;
    	let th11;
    	let t22;
    	let t23;
    	let th12;
    	let t24;
    	let t25;
    	let th13;
    	let t26;
    	let t27;
    	let tbody;

    	const block = {
    		c: function create() {
    			div = element("div");
    			table_1 = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			t0 = text("Name");
    			t1 = space();
    			th1 = element("th");
    			t2 = text("Price");
    			t3 = space();
    			th2 = element("th");
    			t4 = text("Points");
    			t5 = space();
    			th3 = element("th");
    			t6 = text("Minutes");
    			t7 = space();
    			th4 = element("th");
    			t8 = text("Points per Game");
    			t9 = space();
    			th5 = element("th");
    			t10 = text("Points per 90");
    			t11 = space();
    			th6 = element("th");
    			t12 = text("Form");
    			t13 = space();
    			th7 = element("th");
    			t14 = text("Goals");
    			t15 = space();
    			th8 = element("th");
    			t16 = text("Assists");
    			t17 = space();
    			th9 = element("th");
    			t18 = text("Clean Sheets");
    			t19 = space();
    			th10 = element("th");
    			t20 = text("Saves");
    			t21 = space();
    			th11 = element("th");
    			t22 = text("Bonus");
    			t23 = space();
    			th12 = element("th");
    			t24 = text("Transfers In");
    			t25 = space();
    			th13 = element("th");
    			t26 = text("Transfers Out");
    			t27 = space();
    			tbody = element("tbody");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			table_1 = claim_element(div_nodes, "TABLE", { id: true, class: true });
    			var table_1_nodes = children(table_1);
    			thead = claim_element(table_1_nodes, "THEAD", {});
    			var thead_nodes = children(thead);
    			tr = claim_element(thead_nodes, "TR", {});
    			var tr_nodes = children(tr);
    			th0 = claim_element(tr_nodes, "TH", {});
    			var th0_nodes = children(th0);
    			t0 = claim_text(th0_nodes, "Name");
    			th0_nodes.forEach(detach_dev);
    			t1 = claim_space(tr_nodes);
    			th1 = claim_element(tr_nodes, "TH", {});
    			var th1_nodes = children(th1);
    			t2 = claim_text(th1_nodes, "Price");
    			th1_nodes.forEach(detach_dev);
    			t3 = claim_space(tr_nodes);
    			th2 = claim_element(tr_nodes, "TH", {});
    			var th2_nodes = children(th2);
    			t4 = claim_text(th2_nodes, "Points");
    			th2_nodes.forEach(detach_dev);
    			t5 = claim_space(tr_nodes);
    			th3 = claim_element(tr_nodes, "TH", {});
    			var th3_nodes = children(th3);
    			t6 = claim_text(th3_nodes, "Minutes");
    			th3_nodes.forEach(detach_dev);
    			t7 = claim_space(tr_nodes);
    			th4 = claim_element(tr_nodes, "TH", {});
    			var th4_nodes = children(th4);
    			t8 = claim_text(th4_nodes, "Points per Game");
    			th4_nodes.forEach(detach_dev);
    			t9 = claim_space(tr_nodes);
    			th5 = claim_element(tr_nodes, "TH", {});
    			var th5_nodes = children(th5);
    			t10 = claim_text(th5_nodes, "Points per 90");
    			th5_nodes.forEach(detach_dev);
    			t11 = claim_space(tr_nodes);
    			th6 = claim_element(tr_nodes, "TH", {});
    			var th6_nodes = children(th6);
    			t12 = claim_text(th6_nodes, "Form");
    			th6_nodes.forEach(detach_dev);
    			t13 = claim_space(tr_nodes);
    			th7 = claim_element(tr_nodes, "TH", {});
    			var th7_nodes = children(th7);
    			t14 = claim_text(th7_nodes, "Goals");
    			th7_nodes.forEach(detach_dev);
    			t15 = claim_space(tr_nodes);
    			th8 = claim_element(tr_nodes, "TH", {});
    			var th8_nodes = children(th8);
    			t16 = claim_text(th8_nodes, "Assists");
    			th8_nodes.forEach(detach_dev);
    			t17 = claim_space(tr_nodes);
    			th9 = claim_element(tr_nodes, "TH", {});
    			var th9_nodes = children(th9);
    			t18 = claim_text(th9_nodes, "Clean Sheets");
    			th9_nodes.forEach(detach_dev);
    			t19 = claim_space(tr_nodes);
    			th10 = claim_element(tr_nodes, "TH", {});
    			var th10_nodes = children(th10);
    			t20 = claim_text(th10_nodes, "Saves");
    			th10_nodes.forEach(detach_dev);
    			t21 = claim_space(tr_nodes);
    			th11 = claim_element(tr_nodes, "TH", {});
    			var th11_nodes = children(th11);
    			t22 = claim_text(th11_nodes, "Bonus");
    			th11_nodes.forEach(detach_dev);
    			t23 = claim_space(tr_nodes);
    			th12 = claim_element(tr_nodes, "TH", {});
    			var th12_nodes = children(th12);
    			t24 = claim_text(th12_nodes, "Transfers In");
    			th12_nodes.forEach(detach_dev);
    			t25 = claim_space(tr_nodes);
    			th13 = claim_element(tr_nodes, "TH", {});
    			var th13_nodes = children(th13);
    			t26 = claim_text(th13_nodes, "Transfers Out");
    			th13_nodes.forEach(detach_dev);
    			tr_nodes.forEach(detach_dev);
    			thead_nodes.forEach(detach_dev);
    			t27 = claim_space(table_1_nodes);
    			tbody = claim_element(table_1_nodes, "TBODY", {});
    			children(tbody).forEach(detach_dev);
    			table_1_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(th0, file$2, 117, 8, 3725);
    			add_location(th1, file$2, 118, 8, 3748);
    			add_location(th2, file$2, 119, 8, 3772);
    			add_location(th3, file$2, 120, 8, 3797);
    			add_location(th4, file$2, 121, 8, 3823);
    			add_location(th5, file$2, 122, 8, 3857);
    			add_location(th6, file$2, 123, 8, 3889);
    			add_location(th7, file$2, 124, 8, 3912);
    			add_location(th8, file$2, 125, 8, 3936);
    			add_location(th9, file$2, 126, 8, 3962);
    			add_location(th10, file$2, 127, 8, 3993);
    			add_location(th11, file$2, 128, 8, 4017);
    			add_location(th12, file$2, 131, 8, 4109);
    			add_location(th13, file$2, 132, 8, 4140);
    			add_location(tr, file$2, 116, 6, 3711);
    			add_location(thead, file$2, 115, 4, 3696);
    			add_location(tbody, file$2, 135, 4, 4195);
    			attr_dev(table_1, "id", "myTable");
    			attr_dev(table_1, "class", "svelte-10wi54");
    			add_location(table_1, file$2, 114, 2, 3670);
    			attr_dev(div, "class", "table svelte-10wi54");
    			add_location(div, file$2, 113, 0, 3647);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, table_1);
    			append_hydration_dev(table_1, thead);
    			append_hydration_dev(thead, tr);
    			append_hydration_dev(tr, th0);
    			append_hydration_dev(th0, t0);
    			append_hydration_dev(tr, t1);
    			append_hydration_dev(tr, th1);
    			append_hydration_dev(th1, t2);
    			append_hydration_dev(tr, t3);
    			append_hydration_dev(tr, th2);
    			append_hydration_dev(th2, t4);
    			append_hydration_dev(tr, t5);
    			append_hydration_dev(tr, th3);
    			append_hydration_dev(th3, t6);
    			append_hydration_dev(tr, t7);
    			append_hydration_dev(tr, th4);
    			append_hydration_dev(th4, t8);
    			append_hydration_dev(tr, t9);
    			append_hydration_dev(tr, th5);
    			append_hydration_dev(th5, t10);
    			append_hydration_dev(tr, t11);
    			append_hydration_dev(tr, th6);
    			append_hydration_dev(th6, t12);
    			append_hydration_dev(tr, t13);
    			append_hydration_dev(tr, th7);
    			append_hydration_dev(th7, t14);
    			append_hydration_dev(tr, t15);
    			append_hydration_dev(tr, th8);
    			append_hydration_dev(th8, t16);
    			append_hydration_dev(tr, t17);
    			append_hydration_dev(tr, th9);
    			append_hydration_dev(th9, t18);
    			append_hydration_dev(tr, t19);
    			append_hydration_dev(tr, th10);
    			append_hydration_dev(th10, t20);
    			append_hydration_dev(tr, t21);
    			append_hydration_dev(tr, th11);
    			append_hydration_dev(th11, t22);
    			append_hydration_dev(tr, t23);
    			append_hydration_dev(tr, th12);
    			append_hydration_dev(th12, t24);
    			append_hydration_dev(tr, t25);
    			append_hydration_dev(tr, th13);
    			append_hydration_dev(th13, t26);
    			append_hydration_dev(table_1, t27);
    			append_hydration_dev(table_1, tbody);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Table', slots, []);

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

    	$$self.$$.on_mount.push(function () {
    		if (data === undefined && !('data' in $$props || $$self.$$.bound[$$self.$$.props['data']])) {
    			console.warn("<Table> was created without expected prop 'data'");
    		}

    		if (page === undefined && !('page' in $$props || $$self.$$.bound[$$self.$$.props['page']])) {
    			console.warn("<Table> was created without expected prop 'page'");
    		}

    		if (mobileView === undefined && !('mobileView' in $$props || $$self.$$.bound[$$self.$$.props['mobileView']])) {
    			console.warn("<Table> was created without expected prop 'mobileView'");
    		}
    	});

    	const writable_props = ['data', 'page', 'mobileView'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Table> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('page' in $$props) $$invalidate(1, page = $$props.page);
    		if ('mobileView' in $$props) $$invalidate(2, mobileView = $$props.mobileView);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		teamToCSS,
    		buildTeamColourCSSTags,
    		getTableRows,
    		buildTable,
    		refreshTable,
    		table,
    		playerToTeam,
    		teamCSSTag,
    		setup,
    		data,
    		page,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('table' in $$props) table = $$props.table;
    		if ('playerToTeam' in $$props) playerToTeam = $$props.playerToTeam;
    		if ('teamCSSTag' in $$props) teamCSSTag = $$props.teamCSSTag;
    		if ('setup' in $$props) setup = $$props.setup;
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    		if ('page' in $$props) $$invalidate(1, page = $$props.page);
    		if ('mobileView' in $$props) $$invalidate(2, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*page, data*/ 3) {
    			page && refreshTable(data);
    		}
    	};

    	return [data, page, mobileView];
    }

    class Table extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { data: 0, page: 1, mobileView: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Table",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get data() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get page() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set page(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mobileView() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mobileView(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\routes\Fantasy.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1, console: console_1, document: document_1, window: window_1 } = globals;
    const file$1 = "src\\routes\\Fantasy.svelte";

    // (128:4) {:else}
    function create_else_block_1(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Menu");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { id: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, "Menu");
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "id", "mobileNavBtn");
    			attr_dev(button, "class", "svelte-1l590fp");
    			add_location(button, file$1, 128, 6, 4312);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", toggleMobileNav, false, false, false, false);
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
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(128:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (125:4) {#if pages.length === 0}
    function create_if_block_1(ctx) {
    	let button;
    	let t;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Menu");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { id: true, style: true, class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, "Menu");
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "id", "mobileNavBtn");
    			set_style(button, "cursor", "default");
    			attr_dev(button, "class", "svelte-1l590fp");
    			add_location(button, file$1, 126, 6, 4228);
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
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(125:4) {#if pages.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (142:6) {:else}
    function create_else_block(ctx) {
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
    			add_location(div0, file$1, 143, 10, 4789);
    			attr_dev(div1, "class", "loading-spinner-container");
    			add_location(div1, file$1, 142, 8, 4738);
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
    		id: create_else_block.name,
    		type: "else",
    		source: "(142:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (133:6) {#if pageData != undefined}
    function create_if_block(ctx) {
    	let div0;
    	let pointsvsprice;
    	let t0;
    	let div1;
    	let table;
    	let t1;
    	let footer;
    	let current;

    	pointsvsprice = new PointsVsPrice({
    			props: {
    				data: /*pageData*/ ctx[3],
    				page: /*page*/ ctx[0],
    				mobileView: /*mobileView*/ ctx[4]
    			},
    			$$inline: true
    		});

    	table = new Table({
    			props: {
    				data: /*pageData*/ ctx[3],
    				page: /*page*/ ctx[0],
    				mobileView: /*mobileView*/ ctx[4]
    			},
    			$$inline: true
    		});

    	footer = new Footer({
    			props: { lastUpdated: null },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			create_component(pointsvsprice.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			create_component(table.$$.fragment);
    			t1 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(pointsvsprice.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t0 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			claim_component(table.$$.fragment, div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "first-graph");
    			add_location(div0, file$1, 133, 8, 4464);
    			attr_dev(div1, "class", "table");
    			add_location(div1, file$1, 137, 8, 4582);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			mount_component(pointsvsprice, div0, null);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			mount_component(table, div1, null);
    			insert_hydration_dev(target, t1, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const pointsvsprice_changes = {};
    			if (dirty & /*pageData*/ 8) pointsvsprice_changes.data = /*pageData*/ ctx[3];
    			if (dirty & /*page*/ 1) pointsvsprice_changes.page = /*page*/ ctx[0];
    			if (dirty & /*mobileView*/ 16) pointsvsprice_changes.mobileView = /*mobileView*/ ctx[4];
    			pointsvsprice.$set(pointsvsprice_changes);
    			const table_changes = {};
    			if (dirty & /*pageData*/ 8) table_changes.data = /*pageData*/ ctx[3];
    			if (dirty & /*page*/ 1) table_changes.page = /*page*/ ctx[0];
    			if (dirty & /*mobileView*/ 16) table_changes.mobileView = /*mobileView*/ ctx[4];
    			table.$set(table_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(pointsvsprice.$$.fragment, local);
    			transition_in(table.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(pointsvsprice.$$.fragment, local);
    			transition_out(table.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_component(pointsvsprice);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			destroy_component(table);
    			if (detaching) detach_dev(t1);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(133:6) {#if pageData != undefined}",
    		ctx
    	});

    	return block;
    }

    // (116:0) <Router>
    function create_default_slot$2(ctx) {
    	let div1;
    	let fantasynav;
    	let t0;
    	let fantasymobilenav;
    	let t1;
    	let t2;
    	let div0;
    	let current_block_type_index;
    	let if_block1;
    	let current;

    	fantasynav = new FantasyNav({
    			props: {
    				currentPage: /*page*/ ctx[0],
    				pages: /*pages*/ ctx[6],
    				switchPage: /*switchPage*/ ctx[5]
    			},
    			$$inline: true
    		});

    	fantasymobilenav = new FantasyMobileNav({
    			props: {
    				currentPage: /*page*/ ctx[0],
    				pages: /*pages*/ ctx[6],
    				switchPage: /*switchPage*/ ctx[5],
    				toggleMobileNav
    			},
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*pages*/ ctx[6].length === 0) return create_if_block_1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*pageData*/ ctx[3] != undefined) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			create_component(fantasynav.$$.fragment);
    			t0 = space();
    			create_component(fantasymobilenav.$$.fragment);
    			t1 = space();
    			if_block0.c();
    			t2 = space();
    			div0 = element("div");
    			if_block1.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div1_nodes = children(div1);
    			claim_component(fantasynav.$$.fragment, div1_nodes);
    			t0 = claim_space(div1_nodes);
    			claim_component(fantasymobilenav.$$.fragment, div1_nodes);
    			t1 = claim_space(div1_nodes);
    			if_block0.l(div1_nodes);
    			t2 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { id: true, class: true });
    			var div0_nodes = children(div0);
    			if_block1.l(div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "dashboard");
    			attr_dev(div0, "class", "svelte-1l590fp");
    			add_location(div0, file$1, 131, 4, 4399);
    			attr_dev(div1, "id", "team");
    			attr_dev(div1, "class", "svelte-1l590fp");
    			add_location(div1, file$1, 116, 2, 3933);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			mount_component(fantasynav, div1, null);
    			append_hydration_dev(div1, t0);
    			mount_component(fantasymobilenav, div1, null);
    			append_hydration_dev(div1, t1);
    			if_block0.m(div1, null);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const fantasynav_changes = {};
    			if (dirty & /*page*/ 1) fantasynav_changes.currentPage = /*page*/ ctx[0];
    			fantasynav.$set(fantasynav_changes);
    			const fantasymobilenav_changes = {};
    			if (dirty & /*page*/ 1) fantasymobilenav_changes.currentPage = /*page*/ ctx[0];
    			fantasymobilenav.$set(fantasymobilenav_changes);
    			if_block0.p(ctx, dirty);
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
    				if_block1.m(div0, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fantasynav.$$.fragment, local);
    			transition_in(fantasymobilenav.$$.fragment, local);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fantasynav.$$.fragment, local);
    			transition_out(fantasymobilenav.$$.fragment, local);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(fantasynav);
    			destroy_component(fantasymobilenav);
    			if_block0.d();
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(116:0) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let title_value;
    	let meta;
    	let t;
    	let router;
    	let current;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[7]);
    	document_1.title = title_value = /*title*/ ctx[2];

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
    			const head_nodes = head_selector('svelte-42dgjz', document_1.head);
    			meta = claim_element(head_nodes, "META", { name: true, content: true });
    			head_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(meta, "name", "description");
    			attr_dev(meta, "content", "Fantasy Premier League Statistics Dashboard");
    			add_location(meta, file$1, 107, 2, 3758);
    		},
    		m: function mount(target, anchor) {
    			append_hydration_dev(document_1.head, meta);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window_1, "resize", /*onwindowresize*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*title*/ 4) && title_value !== (title_value = /*title*/ ctx[2])) {
    				document_1.title = title_value;
    			}

    			const router_changes = {};

    			if (dirty & /*$$scope, pageData, page, mobileView*/ 2073) {
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

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

    function abbrNum(number, decPlaces) {
    	// 2 decimal places => 100, 3 => 1000, etc
    	decPlaces = Math.pow(10, decPlaces);

    	// Enumerate number abbreviations
    	var abbrev = ["k", "m", "b", "t"];

    	// Go through the array backwards, so we do the largest first
    	for (var i = abbrev.length - 1; i >= 0; i--) {
    		// Convert array index to "1000", "1000000", etc
    		var size = Math.pow(10, (i + 1) * 3);

    		// If the number is bigger or equal do the abbreviation
    		if (size <= number) {
    			// Here, we multiply by decPlaces, round, and then divide by decPlaces.
    			// This gives us nice rounding to a particular decimal place.
    			number = Math.round(number * decPlaces / size) / decPlaces;

    			// Handle special case where we round up to the next abbreviation
    			if (number == 1000 && i < abbrev.length - 1) {
    				number = 1;
    				i++;
    			}

    			// Add the letter for the abbreviation
    			number += abbrev[i];

    			// We are done... stop
    			break;
    		}
    	}

    	return number;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let mobileView;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Fantasy', slots, []);

    	async function initFantasy() {
    		if (page === undefined) {
    			$$invalidate(0, page = pages[0]);
    		}

    		const response = await fetch(`${url}/fantasy`);

    		if (!response.ok) {
    			return;
    		}

    		let json = await response.json();
    		data = json;
    		$$invalidate(3, pageData = filterDataByPosition(data));
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
    		$$invalidate(0, page = newPage);

    		if (page === "all") {
    			$$invalidate(2, title = "Fantasy");
    		} else {
    			$$invalidate(2, title = `Fantasy | ${page[0].toUpperCase() + page.slice(1)}`);
    		}

    		$$invalidate(3, pageData = filterDataByPosition(data));
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

    	$$self.$$.on_mount.push(function () {
    		if (page === undefined && !('page' in $$props || $$self.$$.bound[$$self.$$.props['page']])) {
    			console_1.warn("<Fantasy> was created without expected prop 'page'");
    		}
    	});

    	const writable_props = ['page'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Fantasy> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(1, pageWidth = window_1.innerWidth);
    	}

    	$$self.$$set = $$props => {
    		if ('page' in $$props) $$invalidate(0, page = $$props.page);
    	};

    	$$self.$capture_state = () => ({
    		Router,
    		onMount,
    		FantasyNav,
    		FantasyMobileNav,
    		PointsVsPrice,
    		Footer,
    		Table,
    		url,
    		toggleMobileNav,
    		initFantasy,
    		filterDataByPosition,
    		abbrNum,
    		switchPage,
    		pages,
    		title,
    		data,
    		pageData,
    		pageWidth,
    		page,
    		mobileView
    	});

    	$$self.$inject_state = $$props => {
    		if ('pages' in $$props) $$invalidate(6, pages = $$props.pages);
    		if ('title' in $$props) $$invalidate(2, title = $$props.title);
    		if ('data' in $$props) data = $$props.data;
    		if ('pageData' in $$props) $$invalidate(3, pageData = $$props.pageData);
    		if ('pageWidth' in $$props) $$invalidate(1, pageWidth = $$props.pageWidth);
    		if ('page' in $$props) $$invalidate(0, page = $$props.page);
    		if ('mobileView' in $$props) $$invalidate(4, mobileView = $$props.mobileView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pageWidth*/ 2) {
    			$$invalidate(4, mobileView = pageWidth <= 700);
    		}
    	};

    	return [
    		page,
    		pageWidth,
    		title,
    		pageData,
    		mobileView,
    		switchPage,
    		pages,
    		onwindowresize
    	];
    }

    class Fantasy extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { page: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Fantasy",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get page() {
    		throw new Error("<Fantasy>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set page(value) {
    		throw new Error("<Fantasy>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\routes\Error.svelte generated by Svelte v3.59.2 */
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
    			attr_dev(div0, "class", "msg-container svelte-q4wkyh");
    			add_location(div0, file, 10, 4, 250);
    			attr_dev(div1, "id", "error");
    			attr_dev(div1, "class", "svelte-q4wkyh");
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
    			const head_nodes = head_selector('svelte-1rqatx0', document.head);
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

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { Error: Error_1 } = globals;

    // (12:2) <Route path="/">
    function create_default_slot_3(ctx) {
    	let dashboard;
    	let current;
    	dashboard = new Dashboard({ props: { slug: null }, $$inline: true });

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
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(12:2) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (15:2) <Route path="/:team" let:params>
    function create_default_slot_2(ctx) {
    	let dashboard;
    	let current;

    	dashboard = new Dashboard({
    			props: { slug: /*params*/ ctx[1].team },
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
    			if (dirty & /*params*/ 2) dashboard_changes.slug = /*params*/ ctx[1].team;
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
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(15:2) <Route path=\\\"/:team\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (20:2) <Route path="/fantasy/:page" let:params>
    function create_default_slot_1(ctx) {
    	let fantasy;
    	let current;

    	fantasy = new Fantasy({
    			props: { page: /*params*/ ctx[1].page },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(fantasy.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(fantasy.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fantasy, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const fantasy_changes = {};
    			if (dirty & /*params*/ 2) fantasy_changes.page = /*params*/ ctx[1].page;
    			fantasy.$set(fantasy_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fantasy.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fantasy.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fantasy, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(20:2) <Route path=\\\"/fantasy/:page\\\" let:params>",
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
    	let t5;
    	let route6;
    	let current;

    	route0 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route1 = new Route({
    			props: {
    				path: "/:team",
    				$$slots: {
    					default: [
    						create_default_slot_2,
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
    			props: {
    				path: "/fantasy/:page",
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

    	route5 = new Route({
    			props: { path: "/fantasy", component: Fantasy },
    			$$inline: true
    		});

    	route6 = new Route({
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
    			t5 = space();
    			create_component(route6.$$.fragment);
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
    			t5 = claim_space(nodes);
    			claim_component(route6.$$.fragment, nodes);
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
    			insert_hydration_dev(target, t5, anchor);
    			mount_component(route6, target, anchor);
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
    			const route4_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route4_changes.$$scope = { dirty, ctx };
    			}

    			route4.$set(route4_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			transition_in(route5.$$.fragment, local);
    			transition_in(route6.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			transition_out(route5.$$.fragment, local);
    			transition_out(route6.$$.fragment, local);
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
    			if (detaching) detach_dev(t5);
    			destroy_component(route6, detaching);
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
    		Dashboard,
    		Home,
    		Predictions,
    		Fantasy,
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
