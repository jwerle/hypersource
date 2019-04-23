const { Server } = require('./server')
const { Socket } = require('./socket')

function createServer(opts, onrequest) {
  if ('function' === typeof opts) {
    onrequest = opts
    opts = {}
  }

  const server = new Server(opts)

  if ('function' === typeof onrequest) {
    server.on('request', onrequest)
  }

  return server
}

function connect(port, host, callback) {
  let protocol = 'ws:'
  let pathname = '/'
  let opts = {}

  if (port && typeof port === 'object') {
    // quack
    if ('object' === typeof port._ws) {
      return new Socket({ socket: port._ws })
    }

    // quack quack
    if ('function' === typeof port.send) {
      return new Socket({ socket: port })
    }

    opts = port
    callback = host
    port = undefined
    host = undefined
  }

  if (host && 'object' === typeof host) {
    if (Buffer.isBuffer(host)) {
      pathname = `/${host.toString('hex')}`
      host = undefined
    } else {
      opts = host
      port = undefined
      host = undefined
    }
  }

  if ('port' in opts) {
    port = opts.port
  }

  if ('host' in opts) {
    host = opts.host
  }

  if ('pathname' in opts) {
    pathname = opts.pathname
  }

  if ('protocol' in opts) {
    protocol = opts.protocol
  }

  if (typeof host === 'function') {
    callback = host
    host = undefined
  }

  if ('string' === typeof port) {
    host = port
  }

  if (!host) {
    if ('undefined' !== typeof window) {
      host = window.location.hostname
      if ('https:' === window.location.protocol) {
        protocol = 'wss:'
      }
    } else {
      host = 'localhost'
    }
  } else {
    const uri = url.parse(host)

    if (uri.hostname) {
      host = uri.hostname
    }

    if (uri.port){
      port = parseInt(uri.port)
    }

    if (uri.protocol) {
      protocol = uri.protocol
    }

    if (uri.pathname) {
      pathname = uri.pathname
    }
  }

  if (host && port) {
    const socket = new Socket(`${protocol}//${host}:${port}${pathname}`)

    if ('function' === typeof callback) {
      socket.on('connect', callback)
    }

    return socket
  }

  return null
}

module.exports = {
  createServer,
  connect,
  Socket,
  Server,
}
