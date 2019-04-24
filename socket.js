const { Duplex } = require('readable-stream')
const WebSocket = require('simple-websocket')
const Protocol = require('hypercore-protocol')
const pump = require('pump')
const url = require('url')
const ip = require('ip')

function parseUrl(uri, pathRegex) {
  const parsed = url.parse(uri)
  const parts = parsed.pathname.match(pathRegex)
  const hex = parts ? parts[1] : ''
  const key = Buffer.from((hex || '').slice(0, 64), 'hex')
  return Object.assign(parsed, { key })
}

class Socket extends WebSocket {
  constructor(opts) {
    if ('string' === typeof opts) {
      opts = { url: opts }
    }

    opts = Object.assign({}, opts)

    if (opts.socket && opts.socket._ws) {
      opts.socket = opts.socket._ws
    }

    if (!opts.url && !opts.socket) {
      opts.socket = {}
    }

    super(opts)

    this.setMaxListeners(0)

    // made available so `feed.replicate(socket)` works
    this.userData = opts.userData || null
    this.download = 'boolean' === typeof opts.download ? opts.download : true
    this.encrypt = 'boolean' === typeof opts.encrypt ? opts.encrypt : true
    this.upload = 'boolean' === typeof opts.upload ? opts.upload : true
    this.stream = opts.stream || null
    this.live = 'boolean' === typeof opts.live ? opts.live : true

    this.remoteAddress = null
    this.remoteFamily = null
    this.remotePort = null

    this.pathRegex = RegExp(opts.pathRegex || /\/(.*)/)

    this.discoveryKey = opts.discoveryKey || null
    this.key = this.publicKey = opts.key || null

    if (this.url) {
      const { key } = parseUrl(this.url, this.pathRegex)

      if (key && 32 === key.length) {
        this.key = this.publicKey = key
      }
    }

    this.once('connect', this.onconnect)

    if (opts.socket && 'function' === typeof opts.socket.send) {
      process.nextTick(() => this._onOpen())
    }
  }

  get localAddress() {
    if ('undefined' !== typeof window) {
      return window.location.hostname
    }

    return ip.address()
  }

  get localPort() {
    if ('undefined' !== typeof window) {
      const port = parseInt(window.location.port)

      if (port) {
        return port
      }

      return 'https:' === window.location.protocol ? 443 : 80
    }

    return null
  }

  onconnect() {
    if (this.url) {
      const { host, port, key } = parseUrl(this.url, this.pathRegex)

      if (key && 32 === key.length) {
        this.key = this.publicKey = key
      }

      this.remoteAddress = host
      this.remoteFamily = ip.isV6Format(host) ? 'IPv6' : 'IPv4'
      this.remotePort = parseInt(port)
    }

    if (!this.stream) {
      this.stream = Protocol({
        userData: this.userData,
        download: this.download,
        upload: this.upload,
        live: this.live,
      })

      pump(this, this.stream, this)
    }
  }
}

module.exports = {
  Socket
}
