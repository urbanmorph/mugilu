import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE_CSS, SITE_CSS_PATH, assetResponse, purgeCss } from "../src/ui/assets";

test("the site stylesheet has a content-hashed path and is served immutable", async () => {
  assert.match(SITE_CSS_PATH, /^\/assets\/site-[0-9a-z]+\.css$/);
  const res = assetResponse(SITE_CSS_PATH)!;
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /^text\/css/);
  assert.match(res.headers.get("cache-control")!, /immutable/);
  assert.equal(await res.text(), SITE_CSS);
});

test("an older hash still gets the current stylesheet, briefly cached, so pages cached before a deploy keep their styles", () => {
  const res = assetResponse("/assets/site-0ld.css")!;
  assert.equal(res.status, 200);
  assert.doesNotMatch(res.headers.get("cache-control")!, /immutable/);
  assert.equal(assetResponse("/assets/other.css"), undefined);
});

test("purgeCss keeps the root, the attribute rules and the rules whose classes the markup uses", () => {
  const css =
    ".mg{color:red}.a{x:1}.b .c{x:2}.zz{x:3}.mg[data-embed] .a{x:4}" +
    "@media(min-width:10px){.a{y:1}.zz{y:2}}@media(min-width:20px){.zz{y:3}}" +
    "@font-face{font-family:F;src:url(f.woff2)}:root{--k:1}";
  const out = purgeCss(css, '<div class="mg"><p class="a b"><i class="c">');
  for (const keep of [
    ".mg{color:red}",
    ".a{x:1}",
    ".b .c{x:2}",
    ".mg[data-embed] .a{x:4}",
    "@media(min-width:10px){.a{y:1}}",
    ":root{--k:1}",
  ])
    assert.ok(out.includes(keep), keep);
  for (const drop of [".zz", "@font-face", "min-width:20px"]) assert.ok(!out.includes(drop), drop);
});
