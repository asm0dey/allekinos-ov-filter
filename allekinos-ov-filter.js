// ==UserScript==
// @name         allekinos.de OV/OmU Filter
// @namespace    https://github.com/asm0dey/allekinos-ov-filter
// @version      1.1.1
// @description  Filter movie listings on allekinos.de by version (OV, OmU/OmeU, dubbed) and by format (DBox, ScreenX, IMAX, DolbyAtmos)
// @author       you
// @match        https://allekinos.de/programm*
// @match        https://www.allekinos.de/programm*
// @run-at       document-end
// @grant        none
// @license MIT
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'allekinos-ov-filter:v2';

    // Format tokens as they appear in the <h2>'s parenthesised suffix.
    // Order here drives UI row order.
    const FORMATS = [
        { key: 'DBox',       label: 'DBox' },
        { key: 'ScreenX',    label: 'ScreenX' },
        { key: 'IMAX',       label: 'IMAX' },
        { key: 'DolbyAtmos', label: 'Dolby Atmos' },
    ];

    // Tri-state values for format filters.
    const TRI = { ANY: 'any', YES: 'yes', NO: 'no' };
    const TRI_ORDER = [TRI.ANY, TRI.YES, TRI.NO];
    const TRI_LABEL = { any: '•', yes: '✓', no: '✗' };
    const TRI_TITLE = { any: 'any', yes: 'required', no: 'excluded' };

    const defaults = {
        version: { ov: true, omu: true, dubbed: false },
        formats: Object.fromEntries(FORMATS.map(f => [f.key, TRI.ANY])),
    };

    let state;
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        state = {
            version: Object.assign({}, defaults.version, raw.version || {}),
            formats: Object.assign({}, defaults.formats, raw.formats || {}),
        };
    } catch (_) {
        state = structuredClone(defaults);
    }

    // Parse the trailing "(…)" tokens from an <h2>'s text.
    // textContent flattens Google Translate's <font> wrappers, so this works in both states.
    function classify(h2) {
        const m = h2.textContent.match(/\(([^)]*)\)\s*$/);
        const tokens = m ? m[1].split(',').map(t => t.trim()) : [];
        let version = 'dubbed';
        if (tokens.includes('OV')) version = 'ov';
        else if (tokens.includes('OmU') || tokens.includes('OmeU')) version = 'omu';
        const formats = new Set(FORMATS.map(f => f.key).filter(k => tokens.includes(k)));
        return { version, formats };
    }

    function collectBlocks() {
        // Each movie block = <div.mp> (poster) + its next sibling <div.row> (title + showtimes).
        return Array.from(document.querySelectorAll('div.movies > div.row')).map(row => {
            const h2 = row.querySelector('div.mt > h2');
            const mp = row.previousElementSibling;
            const info = h2 ? classify(h2) : { version: 'dubbed', formats: new Set() };
            return {
                row,
                mp: (mp && mp.classList.contains('mp')) ? mp : null,
                version: info.version,
                formats: info.formats,
            };
        });
    }

    let blocks = [];

    function matches(b) {
        if (!state.version[b.version]) return false;
        for (const f of FORMATS) {
            const v = state.formats[f.key];
            if (v === TRI.YES && !b.formats.has(f.key)) return false;
            if (v === TRI.NO  &&  b.formats.has(f.key)) return false;
        }
        return true;
    }

    function apply() {
        let visible = 0;
        for (const b of blocks) {
            const show = matches(b);
            b.row.style.display = show ? '' : 'none';
            if (b.mp) b.mp.style.display = show ? '' : 'none';
            if (show) visible++;
        }
        const counter = document.getElementById('ov-filter-counter');
        if (counter) counter.textContent = `${visible} / ${blocks.length}`;
    }

    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }

    function buildUI() {
        const css = `
            #ov-filter-panel {
                position: fixed; top: 10px; right: 10px; z-index: 2147483647;
                background: #1e1e1e; color: #f0f0f0;
                font: 13px/1.4 system-ui, -apple-system, sans-serif;
                border: 1px solid #444; border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                padding: 10px 12px; min-width: 210px;
                user-select: none;
            }
            #ov-filter-panel h3 {
                margin: 0 0 6px; font-size: 13px; font-weight: 600;
                display: flex; justify-content: space-between; align-items: center;
                cursor: pointer;
            }
            #ov-filter-panel h3 .caret { font-size: 10px; opacity: 0.6; }
            #ov-filter-panel h4 {
                margin: 8px 0 4px; font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px;
                color: #8a8a8a;
            }
            #ov-filter-panel label {
                display: flex; align-items: center; gap: 6px;
                padding: 2px 0; cursor: pointer;
            }
            #ov-filter-panel input[type=checkbox] { accent-color: #4a9eff; }
            #ov-filter-panel .fmt-row {
                display: flex; align-items: center; justify-content: space-between;
                padding: 2px 0;
            }
            #ov-filter-panel .fmt-row .name { flex: 1; }
            #ov-filter-panel .tri {
                display: inline-flex; border: 1px solid #444; border-radius: 4px;
                overflow: hidden;
            }
            #ov-filter-panel .tri button {
                background: transparent; border: 0; color: #bbb;
                padding: 1px 7px; cursor: pointer; font: inherit;
                border-left: 1px solid #333;
            }
            #ov-filter-panel .tri button:first-child { border-left: 0; }
            #ov-filter-panel .tri button.active { background: #4a9eff; color: #0b1220; font-weight: 600; }
            #ov-filter-panel .tri button.active[data-v="no"] { background: #e06a6a; color: #1a0707; }
            #ov-filter-panel .tri button:hover:not(.active) { background: #2a2a2a; color: #fff; }
            #ov-filter-panel .footer {
                margin-top: 8px; padding-top: 6px; border-top: 1px solid #333;
                font-size: 11px; opacity: 0.8; display: flex; justify-content: space-between;
            }
            #ov-filter-panel.collapsed .body,
            #ov-filter-panel.collapsed .footer { display: none; }
            #ov-filter-panel button.reset {
                background: transparent; border: 1px solid #555; color: #ccc;
                border-radius: 4px; padding: 1px 6px; cursor: pointer; font: inherit;
            }
            #ov-filter-panel button.reset:hover { background: #333; }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        const versionRows = [
            { kind: 'ov',     label: 'OV (Original)' },
            { kind: 'omu',    label: 'OmU / OmeU (subtitled)' },
            { kind: 'dubbed', label: 'Dubbed / standard' },
        ].map(v =>
            `<label><input type="checkbox" data-kind="${v.kind}"> <span>${v.label}</span></label>`
        ).join('');

        const formatRows = FORMATS.map(f => `
            <div class="fmt-row" data-fmt="${f.key}">
                <span class="name">${f.label}</span>
                <span class="tri">
                    ${TRI_ORDER.map(v =>
                        `<button type="button" data-v="${v}" title="${TRI_TITLE[v]}">${TRI_LABEL[v]}</button>`
                    ).join('')}
                </span>
            </div>
        `).join('');

        const panel = document.createElement('div');
        panel.id = 'ov-filter-panel';
        panel.innerHTML = `
            <h3><span>Version &amp; Format Filter</span><span class="caret">▾</span></h3>
            <div class="body">
                <h4>Version</h4>
                ${versionRows}
                <h4>Format</h4>
                ${formatRows}
            </div>
            <div class="footer">
                <span id="ov-filter-counter">0 / 0</span>
                <button class="reset" title="Reset to defaults">reset</button>
            </div>
        `;
        document.body.appendChild(panel);

        for (const cb of panel.querySelectorAll('input[type=checkbox]')) {
            cb.checked = !!state.version[cb.dataset.kind];
            cb.addEventListener('change', () => {
                state.version[cb.dataset.kind] = cb.checked;
                persist();
                apply();
            });
        }

        function paintFormatRow(row) {
            const key = row.dataset.fmt;
            for (const btn of row.querySelectorAll('button[data-v]')) {
                btn.classList.toggle('active', btn.dataset.v === state.formats[key]);
            }
        }

        for (const row of panel.querySelectorAll('.fmt-row')) {
            paintFormatRow(row);
            row.addEventListener('click', e => {
                const btn = e.target.closest('button[data-v]');
                if (!btn) return;
                const key = row.dataset.fmt;
                state.formats[key] = btn.dataset.v;
                paintFormatRow(row);
                persist();
                apply();
            });
        }

        panel.querySelector('h3').addEventListener('click', e => {
            if (e.target.closest('input,button')) return;
            panel.classList.toggle('collapsed');
        });

        panel.querySelector('button.reset').addEventListener('click', () => {
            state = structuredClone(defaults);
            persist();
            for (const cb of panel.querySelectorAll('input[type=checkbox]')) {
                cb.checked = !!state.version[cb.dataset.kind];
            }
            for (const row of panel.querySelectorAll('.fmt-row')) paintFormatRow(row);
            apply();
        });
    }

    function init() {
        if (!document.querySelector('div.movies > div.row')) return;
        blocks = collectBlocks();
        buildUI();
        apply();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
