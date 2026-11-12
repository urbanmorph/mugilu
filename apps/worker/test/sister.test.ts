// A named place links the same place on mugilu's sister sites: its ward map on bharatlas (for the cities that have
// one) and the species of its state on yellide. Plain links, so readers and search engines follow them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aroundLinks, yellideState } from "../src/sister";
import { allSlugPlaces } from "../src/slugs";

test("a city with a ward map links it, and every place links its state's species", () => {
  assert.deepEqual(aroundLinks("jaipur"), {
    city: "Jaipur",
    state: "Rajasthan",
    wards: "https://bharatlas.com/view/wards_jaipur",
    species: "https://yellide.com/in/rajasthan",
  });
  assert.equal(aroundLinks("bengaluru")?.wards, "https://bharatlas.com/view/wards_bengaluru_gba");
  assert.equal(aroundLinks("visakhapatnam")?.wards, "https://bharatlas.com/view/wards_vizag");
  const nagpur = aroundLinks("nagpur");
  assert.equal(nagpur?.wards, undefined); // no ward map: no ward link
  assert.equal(nagpur?.species, "https://yellide.com/in/maharashtra");
  assert.equal(aroundLinks("no-such-place"), null);
});

test("state names read as yellide's places, whatever the spelling", () => {
  assert.equal(yellideState("Jammu & Kashmir"), "jammu-kashmir");
  assert.equal(yellideState("Andaman and Nicobar Islands"), "andaman-nicobar");
  assert.equal(yellideState("NCT of Delhi"), "delhi");
  assert.equal(yellideState("Dadra and Nagar Haveli and Daman and Diu"), "dadra-nagar-haveli-daman-diu");
  assert.equal(yellideState("Atlantis"), null);
});

test("every named place with a state reaches a yellide state", () => {
  const missing = allSlugPlaces()
    .filter((p) => p.state && !yellideState(p.state))
    .map((p) => `${p.slug} (${p.state})`);
  assert.deepEqual(missing, []);
});
