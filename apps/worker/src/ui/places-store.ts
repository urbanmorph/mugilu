// "Your places": the places this browser has opened (first-party, no login), kept in
// localStorage. One store for the place page (which records a visit) and home (which lists,
// favourites, renames and removes), so the key, the order and the limit never disagree.

/** The client-side store: \`PS.load()\`, \`PS.save(L)\`, \`PS.ord(L)\` (favourites first, then the most
 *  opened, then the most recent). A script that uses it starts with this. */
export const PLACES_STORE_JS = `var PS={K:'mugilu:places',
load:function(){try{return JSON.parse(localStorage.getItem(PS.K))||[]}catch(e){return[]}},
save:function(L){try{localStorage.setItem(PS.K,JSON.stringify(L))}catch(e){}},
ord:function(L){return L.slice().sort(function(a,b){return (b.fav?1:0)-(a.fav?1:0)||b.n-a.n||b.t-a.t})}};`;
