export const opt_out_line = `<hr style="display: block;">`;
export const opt_out_link = `<div style="text-align: center; display: block;"><a href="#" style="display: initial;" onclick="
location.href=location.href.indexOf('url=')!==-1
?location.href.substring(location.href.indexOf('url=')+'url='.length)
:location.href.replace(location.origin,'').replace('/minWeb/','')
">Opt-Out</a></div>`;
