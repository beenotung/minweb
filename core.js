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

export function minWeb() {
    let c = setTimeout(function () {
    });
    for (; c >= 0; c--) {
        clearTimeout(c);
        clearInterval(c);
    }
    walk(document.body);
}
