export const opt_out_html = `<hr style="display: initial;">
<div style="text-align: center; display: initial;"><a href="#" style="display: initial;" onclick="
location.href=location.href.indexOf('url=')!==-1
?location.href.substring(location.href.indexOf('url=')+'url='.length)
:location.href.replace(location.origin,'').replace('/minWeb/','')
">Opt-Out</a></div>`;
