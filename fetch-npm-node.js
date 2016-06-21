'use strict'

var realFetch = require('node-fetch')
var hash = require('object-hash')
var cacheManager = require('cache-manager')
var Promise = require('bluebird')
var memoryCache = cacheManager.caching({store: 'memory', max: 100, ttl: 100/*seconds*/})

module.exports = function (url, options) {
  var self = this
  if (/^\/\//.test(url)) {
    url = 'https:' + url
  }

  if (url.indexOf('theplatform.com') === -1) {
    return realFetch.call(this, url, options)
  }

  var key = hash([url, options])

  return memoryCache.get(key)
    .then(function (reply) {
      if (reply) {
        return {
          json: function () {
            return Promise.resolve(reply)
          },
          status: 200,
          fromCache: true
        }
      } else {
        return realFetch.call(self, url, options)
      }
    })
    .then(function (data) {
      if (!data.fromCache) {
        var dataCloned = data.clone()
        if (dataCloned.status === 200) {
          // save to redis
          dataCloned.json().then(function (json) {
            memoryCache.set(key, json)
          })
        }
      }

      return data
    })
}

if (!global.fetch) {
  global.fetch = module.exports
  global.Response = realFetch.Response
  global.Headers = realFetch.Headers
  global.Request = realFetch.Request
}
