// ==UserScript==
// @name         minWeb
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  minify the webpage
// @author       Beeno Tung
// @match        *
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Your code here...
    function walk(e) {
        if (!e.innerText || e.innerText.length === 0) {
            e.remove();
            return;
        }
        const es = Array.prototype.concat.apply([], e.children);
        for (let e of es) {
            walk(e);
        }
    }

    window.minWeb = function minWeb() {
        let c = setTimeout(function () {
        });
        for (; c >= 0; c--) {
            clearTimeout(c);
            clearInterval(c);
        }
        walk(document.body);
    };

})();