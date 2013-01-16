/**
 * xmpp bot for work dept
 *
 * ben@theworkdept.com / benjamin chodoroff
 *
 * akin to https://gist.github.com/940969
 */

var request = require('request'),
    sys = require('sys'),
    nconf = require('nconf'),
    util = require('util'),
    xmpp = require('node-xmpp'),
    execSync = require('execSync');

nconf.file('config.json');

var jid       = nconf.get('account:jid'),
    password  = nconf.get('account:password'),
    room_jid  = nconf.get('account:room_jid'),
    room_nick = nconf.get('account:room_nick');


var cl = new xmpp.Client({
  jid: jid + '/bot',
  password: password
});

// Log all data received
//cl.on('data', function(d) {
//  util.log("[data in] " + d);
//});

// Once connected, set available presence and join room
cl.on('online', function() {
  util.log("We're online!");

  // set ourselves as online
  cl.send(new xmpp.Element('presence', { type: 'available' }).
    c('show').t('chat')
   );

  // join room (and request no chat history)
  cl.send(new xmpp.Element('presence', { to: room_jid+'/'+room_nick }).
    c('x', { xmlns: 'http://jabber.org/protocol/muc' })
  );

  // send keepalive data or server will disconnect us after 150s of inactivity
  setInterval(function() {
    cl.send(' ');
  }, 30000);
});

cl.on('stanza', function(stanza) {
  util.log('[stanza] ' + stanza);
  // always log error stanzas
  if (stanza.attrs.type == 'error') {
    util.log('[error] ' + stanza);
    return;
  }

  // ignore everything that isn't a room message
  if (!stanza.is('message') || !stanza.attrs.type == 'groupchat') {
    return;
  }

  // ignore messages we sent
  if (stanza.attrs.from == room_jid+'/'+room_nick) {
    return;
  }

  var body = stanza.getChild('body');
  // message without body is probably a topic change
  if (!body) {
    return;
  }

  // if it's an old message, don't act on it
  if (stanza.getChild('delay')) {
    return;
  }

  var message = body.getText();

  // Look for messages like "!weather 94085"
  if (message.indexOf('!weather') === 0) {
    var search = message.substring(9);
    util.log('Fetching weather for: "' + search + '"');

    // hit Yahoo API
    var query = 'select item from weather.forecast where location = "'+search+'"';
    var uri = 'http://query.yahooapis.com/v1/public/yql?format=json&q='+encodeURIComponent(query);
    request({'uri': uri}, function(error, response, body) {
      body = JSON.parse(body);
      var item = body.query.results.channel.item;
      if (!item.condition) {
        response = item.title;
      } else {
        response = item.title+': '+item.condition.temp+' degrees and '+item.condition.text;
      }

      // send response
      cl.send(new xmpp.Element('message', { to: room_jid, type: 'groupchat' }).
        c('body').t(response)
      );
    });
  } else if (message.indexOf("!help") === 0) {
    var response = 'HI!';
      cl.send(new xmpp.Element('message', { to: room_jid, type: 'groupchat' }).
        c('body').t(response)
      );
  } else if (message.indexOf("!nuggie") === 0) {
    var recipient = message.substring(8);
    var response = recipient + ': have a nuggie. *nuggie*';
    cl.send(new xmpp.Element('message', { to: room_jid, type: 'groupchat' }).
      c('body').t(response)
    );
  } else if (message.indexOf('!runeinate') === 0) {
    request({'uri': 'http://jackpine.theworkdept.com:31336/'}, function(error, response, body) {
      var msg = "Changing rune at http://blog.theworkdept.com...";
      cl.send(new xmpp.Element('message', { to: room_jid, type: 'groupchat' }).
        c('body').t(msg)
      );
    });
  } else if (message.indexOf('!zippy') === 0) {
    console.log('zippying');
    var response = execSync.stdout('fortune zippy');
    cl.send(new xmpp.Element('message', { to: room_jid, type: 'groupchat' }).
      c('body').t(response)
    );
  }

});
