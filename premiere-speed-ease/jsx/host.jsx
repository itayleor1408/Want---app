/*
 * Speed Ease — Premiere Pro host script (ExtendScript, ES3).
 *
 * Premiere's scripting API cannot set bezier handle speed/influence and cannot
 * read which keyframes are selected. So the panel works like this:
 *   - targets: the selected clip(s) in the active sequence
 *   - segment: for every animated property, the two keyframes around the playhead
 *   - the speed curve is "baked": one linear keyframe per frame between the two
 *     keyframes, with values taken from the easing curve. The two original
 *     keyframes are never moved or changed.
 * A registry (kept by the panel) remembers baked segments, so the playhead can
 * sit anywhere inside one and the panel still finds the original two keyframes.
 */

var SE = SE || {};

SE.KF_LINEAR = 0;

SE.str = function (v) {
    if (v === null || v === undefined) return 'null';
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? String(v) : 'null';
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') {
        return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
            .replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    }
    var i, out = [];
    if (v instanceof Array) {
        for (i = 0; i < v.length; i++) out.push(SE.str(v[i]));
        return '[' + out.join(',') + ']';
    }
    for (var k in v) if (v.hasOwnProperty(k)) out.push(SE.str(k) + ':' + SE.str(v[k]));
    return '{' + out.join(',') + '}';
};

SE.fail = function (msg) { return SE.str({ ok: false, error: msg }); };

/* Cubic bezier ease: P0(0,0) P1(a,0) P2(1-b,1) P3(1,1); a,b = influences 0..1 */
SE.ease = function (a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var x1 = a, x2 = 1 - b, lo = 0, hi = 1, t = x, i, u, xt;
    for (i = 0; i < 48; i++) {
        t = (lo + hi) / 2;
        u = 1 - t;
        xt = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
        if (xt < x) lo = t; else hi = t;
    }
    u = 1 - t;
    return 3 * u * t * t + t * t * t;
};

SE.time = function (ticks) {
    var t = new Time();
    t.ticks = String(Math.round(ticks));
    return t;
};

SE.isNumeric = function (v) {
    if (typeof v === 'number') return isFinite(v);
    if (v instanceof Array && v.length) {
        for (var i = 0; i < v.length; i++) if (typeof v[i] !== 'number') return false;
        return true;
    }
    return false;
};

SE.lerp = function (v1, v2, f) {
    if (typeof v1 === 'number') return v1 + (v2 - v1) * f;
    var out = [];
    for (var i = 0; i < v1.length; i++) out.push(v1[i] + (v2[i] - v1[i]) * f);
    return out;
};

SE.clips = function (seq) {
    var sel = seq.getSelection(), out = [], i;
    if (!sel) return out;
    for (i = 0; i < sel.length; i++) {
        if (sel[i] && sel[i].components) out.push(sel[i]);
    }
    return out;
};

/* Find the keyframe segment around the playhead for every animated property. */
SE.collect = function (registry) {
    var proj = app.project;
    if (!proj || !proj.activeSequence) return { error: 'No active sequence' };
    var seq = proj.activeSequence;
    var clips = SE.clips(seq);
    if (!clips.length) return { error: 'Select a clip' };

    var pos = parseFloat(seq.getPlayerPosition().ticks);
    var frame = parseFloat(seq.timebase);
    var seqId = seq.sequenceID;
    var targets = [];

    for (var c = 0; c < clips.length; c++) {
        var clip = clips[c];
        var cStart = parseFloat(clip.start.ticks), cEnd = parseFloat(clip.end.ticks);
        if (pos < cStart || pos > cEnd) continue;
        var local = pos - cStart + parseFloat(clip.inPoint.ticks);
        var clipId = clip.nodeId ? clip.nodeId : (clip.name + '@' + clip.start.ticks);

        for (var ci = 0; ci < clip.components.numItems; ci++) {
            var comp = clip.components[ci];
            for (var pi = 0; pi < comp.properties.numItems; pi++) {
                var param = comp.properties[pi];
                if (!param.isTimeVarying || !param.isTimeVarying()) continue;
                var keys = param.getKeys();
                if (!keys || keys.length < 2) continue;

                var kt = [], i;
                for (i = 0; i < keys.length; i++) kt.push(parseFloat(keys[i].ticks));
                kt.sort(function (x, y) { return x - y; });

                var id = seqId + '|' + clipId + '|' + ci + '|' + pi;
                var s = null, e = null, baked = null;

                // 1) a segment this panel baked earlier that contains the playhead
                var reg = registry[id];
                if (reg) {
                    for (i = 0; i < reg.length; i++) {
                        if (local >= reg[i].s && local <= reg[i].e &&
                            SE.hasKey(kt, reg[i].s) && SE.hasKey(kt, reg[i].e)) {
                            s = reg[i].s; e = reg[i].e; baked = reg[i]; break;
                        }
                    }
                }
                // 2) otherwise the two keyframes around the playhead
                if (s === null) {
                    if (local < kt[0] - 1 || local > kt[kt.length - 1] + 1) continue;
                    for (i = 0; i < kt.length - 1; i++) {
                        if (local >= kt[i] - 1 && local < kt[i + 1] - 1) { s = kt[i]; e = kt[i + 1]; break; }
                    }
                    if (s === null) { s = kt[kt.length - 2]; e = kt[kt.length - 1]; }
                }
                if (e - s < frame * 1.5) continue;

                targets.push({
                    id: id, param: param, s: s, e: e, kt: kt, baked: baked,
                    name: comp.displayName + ' / ' + param.displayName
                });
            }
        }
    }
    if (!targets.length) return { error: 'No keyframes at playhead' };
    return { seq: seq, frame: frame, targets: targets };
};

SE.hasKey = function (kt, t) {
    for (var i = 0; i < kt.length; i++) if (Math.abs(kt[i] - t) < 2) return true;
    return false;
};

SE.parse = function (json) {
    try { return json ? eval('(' + json + ')') : {}; } catch (err) { return {}; }
};

SE.clearBetween = function (param, kt, s, e) {
    for (var i = kt.length - 1; i >= 0; i--) {
        if (kt[i] > s + 1 && kt[i] < e - 1) param.removeKey(SE.time(kt[i]));
    }
};

/* Info about what is under the playhead: used to show duration / load a baked curve. */
SE.info = function (registryJson) {
    try {
        var r = SE.collect(SE.parse(registryJson));
        if (r.error) return SE.fail(r.error);
        var t0 = r.targets[0];
        var curve = null;
        for (var i = 0; i < r.targets.length; i++) {
            if (r.targets[i].baked) { curve = { a: r.targets[i].baked.a, b: r.targets[i].baked.b }; break; }
        }
        return SE.str({
            ok: true, count: r.targets.length,
            key: t0.id + ':' + t0.s + ':' + t0.e,
            seconds: (t0.e - t0.s) / 254016000000,
            frames: Math.round((t0.e - t0.s) / r.frame),
            curve: curve
        });
    } catch (err) { return SE.fail(String(err)); }
};

SE.apply = function (a, b, registryJson) {
    try {
        var r = SE.collect(SE.parse(registryJson));
        if (r.error) return SE.fail(r.error);
        var frame = r.frame, done = [], skipped = 0;

        for (var n = 0; n < r.targets.length; n++) {
            var tg = r.targets[n], p = tg.param;
            var v1 = p.getValueAtKey(SE.time(tg.s));
            var v2 = p.getValueAtKey(SE.time(tg.e));
            if (!SE.isNumeric(v1) || !SE.isNumeric(v2) ||
                (v1 instanceof Array && v1.length !== v2.length)) { skipped++; continue; }

            SE.clearBetween(p, tg.kt, tg.s, tg.e);

            var span = tg.e - tg.s;
            for (var t = tg.s + frame; t < tg.e - frame * 0.5; t += frame) {
                var T = SE.time(t);
                p.addKey(T);
                p.setValueAtKey(T, SE.lerp(v1, v2, SE.ease(a, b, (t - tg.s) / span)), false);
                if (p.setInterpolationTypeAtKey) p.setInterpolationTypeAtKey(T, SE.KF_LINEAR, false);
            }
            // nudge the UI once per property
            p.setValueAtKey(SE.time(tg.e), v2, true);
            done.push({ id: tg.id, s: tg.s, e: tg.e, a: a, b: b });
        }
        return SE.str({ ok: true, applied: done.length, skipped: skipped, segments: done });
    } catch (err) { return SE.fail(String(err)); }
};

SE.clear = function (registryJson) {
    try {
        var r = SE.collect(SE.parse(registryJson));
        if (r.error) return SE.fail(r.error);
        var done = [];
        for (var n = 0; n < r.targets.length; n++) {
            var tg = r.targets[n];
            SE.clearBetween(tg.param, tg.kt, tg.s, tg.e);
            tg.param.setValueAtKey(SE.time(tg.e), tg.param.getValueAtKey(SE.time(tg.e)), true);
            done.push({ id: tg.id, s: tg.s, e: tg.e });
        }
        return SE.str({ ok: true, cleared: done.length, segments: done });
    } catch (err) { return SE.fail(String(err)); }
};
