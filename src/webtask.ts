import {main} from "./main";

export interface Response {
  writeHead(statusCode: number, headers: any)

  end(html: string);
}

module.exports = function (context, req: Request, res: Response) {
  const url = req.url.replace('/minWeb/', '');
  if (url === "/minWeb" || url === "") {
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(
      'Please append the target url at the end'
      + '<br>Example:'
      + '<br>https://wt-2f31e8aca451cf5494a2ee7270b6a7dc-0.run.webtask.io/minWeb/https://hk.yahoo.com/'
    );
    return;
  }
  main(url)
    .then(html => {
      res.writeHead(200, {"Content-Type": "text/html"});
      res.end(html);
    })
    .catch(e => {
      res.writeHead(500, {"Content-Type": "text/html"});
      res.end(
        '<h1>Error</h1>'
        + '<p>Failed to parse destination html</p>'
        + `<p>url = ${url}</p>`
        + `<code>${JSON.stringify(e)}</code>`
      );
    })
};
