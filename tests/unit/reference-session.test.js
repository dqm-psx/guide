const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');
const session = loadScripts([path.resolve(__dirname,'../../js/session.js')]).DQMSession;
const plain = value => JSON.parse(JSON.stringify(value));

test('existing reference sessions keep their pairs with ordinary shrine defaults', () => {
  const saved = session.normalize({version:1,pair:{a:1,b:13},recent:[{a:11,b:99}]});
  assert.deepEqual(plain(saved.pair),{a:1,b:13,ap:0,bp:0,context:'shrine'});
  assert.deepEqual(plain(saved.recent),[{a:11,b:99,ap:0,bp:0,context:'shrine'}]);
});

test('reference sessions preserve parent values and breeding context', () => {
  const pair = {a:13,b:199,ap:7,bp:255,context:'room'};
  const recent = [pair,{a:1,b:1,ap:4,bp:0,context:'base'}];
  const saved = session.normalize({pair,recent});
  assert.deepEqual(plain(saved.pair),pair);
  assert.deepEqual(plain(saved.recent),recent);
});

test('malformed reference settings cannot persist invalid breeding calculations', () => {
  for (const bad of [-1,256,1.5,'4',null,{},NaN]) {
    assert.deepEqual(plain(session.normalize({pair:{a:1,b:1,ap:bad,bp:bad,context:'constructor'}}).pair),
      {a:1,b:1,ap:0,bp:0,context:'shrine'});
  }
  assert.deepEqual(plain(session.normalize({recent:[null,false,1,'x',[],{a:1,b:1}]}).recent),
    [{a:1,b:1,ap:0,bp:0,context:'shrine'}]);
});
