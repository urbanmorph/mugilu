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
  const out = purgeCss(css, '<div class="mg" data-embed><p class="a b"><i class="c">');
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

test("purgeCss drops attribute and language rules the markup does not have (theme rules stay)", () => {
  const css =
    '.mg[data-tint="Heat"]{a:1}.mg[data-tint="Air"]{a:2}.mg[data-kiosk]{a:3}.mg :lang(hi){a:4}.mg :lang(kn){a:5}' +
    ':root[data-theme="dark"] .mg{a:6}.mg[data-tint]:not([data-tint="off"])[data-level="high"]{a:7}.mg[data-tint]:not([data-tint="off"])[data-level="low"]{a:8}';
  const out = purgeCss(css, '<body class="mg" data-embed data-tint="Air" data-level="high"><p lang="hi">');
  for (const keep of ["a:2", "a:4", "a:6", "a:7"]) assert.ok(out.includes(keep), keep);
  for (const drop of ["a:1", "a:3", "a:5", "a:8"]) assert.ok(!out.includes(drop), drop);
});
