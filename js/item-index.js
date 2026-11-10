/* Render the same inventory, prices and sources in the guide and its HTML index. */
(() => {
  'use strict';
  const {alphabetical, enableRows} = DQMSortableIndex;
  const columns = [
    ['name','Item name'], ['description','In-game description'], ['effect','Effect'],
    ['buy','Buy price'], ['sell','Sell price'], ['source','Where to get it']
  ];
  const shopMaps = new Map();
  // The standalone HTML already contains its source links.
  for (const place of globalThis.PLAYER_ATLAS?.maps || []) {
    if (place.id !== place.placeId) continue;
    // Only link names that identify one place in the atlas.
    shopMaps.set(place.title,shopMaps.has(place.title) ? null : place.id);
  }
  const inGame = (source, game) => !game || source.game === 'both' || source.game === game;
  function shopLink(location, {mapLink,escape}) {
    const map = shopMaps.get(location.split(' / ').pop());
    return map ? mapLink(map,escape(location)) : escape(location);
  }
  function menuText(row, game, games) {
    const reference = DQMItemReference.items[row.id];
    const variants = row.menuDescriptions || reference.descriptions;
    const tail = row.id === 'item-31';
    if (!variants || (game && !(tail && game === 'dqm1'))) return [['',variants?.[game] || row.menuDescription || reference.description]];
    const labels = tail ? {
      dqm1:game ? 'In the field' : games.dqm1+' in the field',
      dqm2:game ? 'In battle' : games.dqm2+' / '+games.dqm1+' in battle'
    } : games;
    return Object.entries(variants).map(([campaign,text]) => [labels[campaign],text]);
  }
  function descriptions(row, game, {escape, games}) {
    return menuText(row,game,games).map(([label,text]) => label ?
      '<div class="item-description"><small>'+escape(label)+'</small> '+escape(text)+'</div>' : escape(text)).join('');
  }
  function sourceList(row, game) {
    const reference = DQMItemReference.items[row.id];
    const sources = reference.sources.filter(source => inGame(source,game));
    const shops = (row.prices || []).filter(price => inGame(price,game)).flatMap(price =>
      price.locations.map(location => ({text:location, game:price.game, shop:true}))
    );
    return sources.concat(shops);
  }
  function sourceMarkup(sources, {escape, games, game, entryLink, mapLink}) {
    if (!sources.length) return 'Source unconfirmed';
    function line(source) {
      const label = escape(source.text);
      const place = source.shop ? shopLink(source.text,{mapLink,escape}) : source.map ? mapLink(source.map,label) :
        source.entry ? entryLink(source.entry,label) : label;
      const prefix = [!game && source.game !== 'both' ? games[source.game] : '', source.shop ? 'Shop' : ''].filter(Boolean);
      return '<div class="item-source">'+(prefix.length ? '<small>'+escape(prefix.join(' · '))+'</small> ' : '')+place+'</div>';
    }
    return sources.map(line).join('');
  }
  function sourcePreview(row, sources, options) {
    if (sources.length <= 2) return sourceMarkup(sources,options);
    // Give each adventure a useful first stop when the player is comparing both.
    const first = sources[0];
    const otherAdventure = options.game ? [] : sources.filter(source=>source.game !== first.game);
    const second = otherAdventure.find(source=>source.shop) || otherAdventure[0] ||
      sources.find(source=>source.shop && !first.shop) || sources[1];
    return sourceMarkup(first.text.length > 75 ? [first] : [first,second],options)+
      '<div class="item-all-sources">'+options.entryLink(row.id,'All '+sources.length+' sources')+'</div>';
  }
  function range(values) {
    if (!values.length) return null;
    const min = Math.min(...values), max = Math.max(...values);
    const digits = n => n.toLocaleString('en');
    return {min, text:(min === max ? digits(min) : digits(min)+'–'+digits(max))+' G'};
  }
  function prices(row, game) {
    const reference = DQMItemReference.items[row.id];
    return {
      buy:range((row.prices || []).filter(price => inGame(price,game)).map(price => price.buy)),
      sell:reference.sell && range([reference.sell.capital,reference.sell.field])
    };
  }
  function itemFacts(row, options) {
    const {escape, game} = options;
    const reference = DQMItemReference.items[row.id];
    const price = prices(row,game);
    const sources = reference.sources.filter(source => inGame(source,game));
    return '<dl class="item-facts"><dt>In-game description</dt><dd>'+descriptions(row,game,options)+'</dd>'+
      '<dt>Effect</dt><dd>'+escape(reference.effect)+'</dd><dt>Sell price</dt><dd>'+(price.sell?.text || 'Cannot sell')+
      (price.sell && reference.sell.capital !== reference.sell.field ? ' ('+sellNote(game || row.game)+')' : '')+'</dd></dl>'+
      (sources.length ? '<section class="item-sources"><h3>Where to get it</h3>'+sourceMarkup(sources,options)+'</section>' : '');
  }
  function render(rows, options) {
    const {title, game, escape, entryLink, hidden} = options;
    const headers = columns.map(([key,label]) => '<th scope="col" data-sort="'+key+'"'+
      (key === 'name' ? ' aria-sort="ascending"' : '')+(key === 'buy' || key === 'sell' ? ' data-numeric' : '')+'>'+label+'</th>');
    const sorted = [...rows].sort((a,b) => alphabetical.compare(options.titleFor(a),options.titleFor(b)) || alphabetical.compare(a.id,b.id));
    const body = sorted.map(row => {
      const guarded = hidden(row);
      const name = escape(options.titleFor(row));
      const image = guarded ? '' : DQMItemArt.imageFor(row);
      const identity = '<span class="item-name">'+(image ? '<img src="'+escape(image)+'" title="'+escape(DQMItemArt.creditFor(row))+'" alt="" aria-hidden="true" width="40" height="40">' : '')+
        '<span>'+name+'</span></span>';
      const heading = '<tr data-entry="'+escape(row.id)+'"><th scope="row">'+entryLink(row.id,identity)+'</th>';
      if (guarded) return heading+'<td data-missing>—</td>'.repeat(columns.length-1)+'</tr>';
      const reference = DQMItemReference.items[row.id];
      const price = prices(row,game);
      const money = (value,empty) => value ? '<td class="price" data-sort-value="'+value.min+'">'+value.text+'</td>' :
        '<td data-missing>'+empty+'</td>';
      const sources = sourceList(row,game);
      return heading+'<td>'+descriptions(row,game,options)+'</td><td>'+escape(reference.effect)+'</td>'+
        money(price.buy,'No confirmed shop')+money(price.sell,'Cannot sell')+
        '<td '+(sources.length ? 'data-sort-value="'+escape(sources.map(source=>source.text).join(' '))+'"' : 'data-missing')+'>'+
        sourcePreview(row,sources,options)+'</td></tr>';
    });
    return '<div class="reference-table-panel"><p class="table-scroll-hint">Scroll sideways to see all columns.</p>'+
      '<div class="reference-table-scroll" tabindex="0" role="region" aria-label="Scrollable item list">'+
      '<table class="reference-table item-index" aria-label="'+escape(title)+'"><thead><tr>'+headers.join('')+'</tr></thead><tbody>'+
      body.join('')+'</tbody></table></div>'+
      '<p class="reference-table-note">'+sellNote(game)+'.</p></div>';
  }
  function sellNote(game) {
    if (game === 'dqm1') return 'GreatTree Bazaar pays the lower sell price. Gate shops pay the higher price';
    if (game === 'dqm2') return 'GreatLog Main Street pays the lower sell price. Other towns pay the higher price';
    return 'GreatTree Bazaar and GreatLog Main Street pay the lower sell price. Terry’s gate shops and other Cobi &amp; Tara towns pay the higher price';
  }
  function searchTerms(row, game, games) {
    return [row.title,...(row.aliases || []),row.category,DQMItemReference.items[row.id].effect,
      ...menuText(row,game,games).map(([,text])=>text),...sourceList(row,game).map(source=>source.text)];
  }
  globalThis.DQMItemIndex = {render, itemFacts, shopLink, searchTerms, enableSorting:enableRows};
  const published = globalThis.document?.querySelector('#items .item-index');
  if (published) enableRows(published);
})();
