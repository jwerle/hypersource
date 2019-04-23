const { EventEmitter } = require('events')
const WebSocketServer = require('simple-websocket/server')
const { Socket } = require('./socket')
const crypto = require('hypercore-crypto')
const https = require('https')
const pump = require('pump')

class Server extends EventEmitter {
  constructor(opts) {
    if (opts === null || typeof opts !== 'object') {
      opts = {}
    }

    super()

    this.setMaxListeners(0)

    this.connections = new WeakMap()
    this.destroyed = false
    this.opts = Object.assign({}, opts)

    this.onconnection = this.onconnection.bind(this)
    this.onlistening = this.onlistening.bind(this)
    this.onrequest = this.onrequest.bind(this)
    this.onclose = this.onclose.bind(this)
    this.onerror = this.onerror.bind(this)
  }

  onrequest(conn, request) {
    const connection = this.connections.get(conn)
    const keyPair = crypto.keyPair()
    const socket = new Socket({
      userData: keyPair.publicKey,
      socket: connection,
    })

    if (request && request.headers) {
      socket.headers = request.headers
    }

    if (request && request.url) {
      socket.url = request.url
    }

    socket.on('close', () => this.connections.delete(conn))
    socket.on('error', this.onerror)

    this.emit('connection', socket, request)

    socket.once('connect', () => {
      const req = socket
      const res = new Socket({
        userData: keyPair.publicKey,
        socket: {},
        stream: req.stream,
        key: keyPair.publicKey
      })

      socket.stream.once('feed', (discoveryKey) => {
        req.writable = false
        req.discoveryKey = discoveryKey

        res.secretKey = keyPair.secretKey
        res.discoveryKey = discoveryKey

        this.emit('request', req, res, discoveryKey)

        req.writable = true
      })
    })
  }

  onconnection(connection) {
    const conn = connection._ws
    this.connections.set(conn, connection)
  }

  onlistening() {
    this.emit('listening')
  }

  onclose() {
    this.close()
  }

  onerror(err) {
    this.emit('error', err)
  }

  address() {
    if (this.server) {
      const { protocol } = this
      const addrinfo = this.server.address()
      if (addrinfo) {
        return Object.assign({ protocol }, addrinfo)
      }
    }

    return null
  }

  listen(port, host, callback) {
    let opts = {}
    let protocol = 'ws:'

    if ('function' === typeof port) {
      callback = port
      port = 0
    }

    if ('string' === typeof port) {
      callback = host
      host = port
      port = 0
    }

    if ('function' === typeof host) {
      callback = host
      host = undefined
    }

    if (port && 'object' === typeof port) {
      opts = port
      port = undefined
    } else if (undefined !== port && host && 'object' === typeof host) {
      opts = host
      host = undefined
    }

    if (this.server) {
      const err = new Error('Already listening')
      if ('function' === typeof callback) {
        callback(err)
        return this
      } else {
        this.emit('error',err)
        throw this
      }
    }

    Object.assign(opts, this.opts)

    if (undefined !== host) {
      opts.host = host
    }

    if (undefined !== port) {
      opts.port = port
    }

    if (!opts.port && undefined !== opts.host) {
      if (!/^wss?:/.test(opts.host)) {
        opts.host = `ws://${opts.host}`
      }
      const uri = url.parse(opts.host)
      opts.host = uri.hostname
      opts.port = parseInt(uri.port)
      protocol = uri.protocol
    }

    if ('wss:' === protocol && !opts.server) {
      const httpsServer = https.createServer(this.opts)
      opts.server = httpsServer
      httpsServer.listen(opts.port, opts.host)
    }

    if (opts.server) {
      // delete 'opts.host' and 'opts.port' so `WebSocketServer
      // does not start listening when these properties are present
      // and the http server is supplied
      delete opts.host
      delete opts.port
    }

    //opts.clientTracking = true
    this.protocol = protocol
    this.server = new WebSocketServer(opts)

    if ('function' === typeof callback) {
      this.server.once('error', callback)
      this.server.once('listening', () => {
        this.server.removeListener('error', callback)
        callback(null)
      })
    }

    this.server._server.on('connection',  this.onrequest)
    this.server.on('connection', this.onconnection)
    this.server.on('listening', this.onlistening)
    this.server.on('close', this.onclose)
    this.server.on('error', this.onerror)
  }

  close(callback) {
    if (this.destroyed) {
      if ('function' === typeof callback) {
        callback(new Error('Server is closed.'))
      }

      return this
    }

    this.destroyed = true

    if (this.server) {
      this.server._server.removeListener('connection', this.onrequest)
      this.server.removeListener('connection', this.onconnection)
      this.server.removeListener('listening', this.onlistening)
      this.server.removeListener('close', this.onclose)
      this.server.removeListener('error', this.onerror)
      this.server.close(callback)
      this.server = null
      this.emit('close')
    }

    return this
  }
}

module.exports = {
  Server
}
